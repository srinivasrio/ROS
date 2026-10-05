import { NextResponse } from 'next/server';

export interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    resetTime: Date;
    retryAfterSeconds: number;
    isLocked?: boolean;
}

interface WindowBucket {
    count: number;
    resetAtMs: number;
    lockedUntilMs?: number;
}

// In-memory distributed-ready storage (Zero PostgreSQL calls on hot path)
const memoryBuckets = new Map<string, WindowBucket>();

// Periodic memory cleanup every 5 minutes to prevent memory leaks
if (typeof setInterval !== 'undefined') {
    const cleanupTimer = setInterval(() => {
        const now = Date.now();
        for (const [key, bucket] of memoryBuckets.entries()) {
            if (bucket.resetAtMs < now && (!bucket.lockedUntilMs || bucket.lockedUntilMs < now)) {
                memoryBuckets.delete(key);
            }
        }
    }, 5 * 60 * 1000);

    if (cleanupTimer.unref) {
        cleanupTimer.unref();
    }
}

/**
 * High-performance, centralized Rate Limiter service.
 * Removes PostgreSQL from the hot path to avoid database contention and slow responses.
 * Supports Upstash Redis REST when configured, with high-performance local multi-tier memory.
 */
export const RateLimiter = {
    /**
     * Checks if a key has exceeded its request limit.
     * 
     * @param key String identifier (e.g., endpoint + IP + identifier)
     * @param limit Max allowed requests within window
     * @param windowSeconds Window length in seconds
     * @param isAuthStrict When true, failures fail-closed to protect authentication
     */
    async check(
        key: string,
        limit: number,
        windowSeconds: number,
        isAuthStrict: boolean = false
    ): Promise<RateLimitResult> {
        const now = Date.now();
        const windowMs = windowSeconds * 1000;

        // 1. Check if Upstash Redis REST credentials exist
        const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
        const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

        if (upstashUrl && upstashToken) {
            try {
                const redisKey = `ratelimit:${key}`;
                // Pipeline INCR and PTTL in one HTTP roundtrip
                const res = await fetch(`${upstashUrl}/pipeline`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${upstashToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify([
                        ['INCR', redisKey],
                        ['PTTL', redisKey],
                    ]),
                    signal: AbortSignal.timeout(1500), // Strict 1.5s timeout
                });

                if (res.ok) {
                    const data = await res.json();
                    const count = Number(data[0]?.result || 1);
                    let ttlMs = Number(data[1]?.result || -1);

                    // If key is new, set expiry
                    if (count === 1 || ttlMs === -1) {
                        await fetch(`${upstashUrl}/PEXPIRE/${encodeURIComponent(redisKey)}/${windowMs}`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${upstashToken}` },
                            signal: AbortSignal.timeout(1000),
                        }).catch(() => {});
                        ttlMs = windowMs;
                    }

                    const remaining = Math.max(0, limit - count);
                    const retryAfter = Math.max(1, Math.ceil(ttlMs / 1000));
                    const resetTime = new Date(now + Math.max(0, ttlMs));

                    return {
                        success: count <= limit,
                        limit,
                        remaining,
                        resetTime,
                        retryAfterSeconds: retryAfter,
                    };
                }
            } catch (err) {
                console.warn('[RateLimiter] Upstash Redis check error, failing over to memory limiter:', err);
                if (isAuthStrict) {
                    // Safe behavior: strict auth routes fail closed on critical infrastructure failure
                    return {
                        success: false,
                        limit,
                        remaining: 0,
                        resetTime: new Date(now + 60000),
                        retryAfterSeconds: 60,
                    };
                }
            }
        }

        // 2. High-performance memory storage (No DB calls!)
        let bucket = memoryBuckets.get(key);

        if (!bucket || bucket.resetAtMs <= now) {
            // New or expired window
            bucket = {
                count: 1,
                resetAtMs: now + windowMs,
            };
            memoryBuckets.set(key, bucket);

            return {
                success: true,
                limit,
                remaining: limit - 1,
                resetTime: new Date(bucket.resetAtMs),
                retryAfterSeconds: Math.ceil(windowSeconds),
            };
        }

        // Check if currently locked
        if (bucket.lockedUntilMs && bucket.lockedUntilMs > now) {
            const retryAfter = Math.max(1, Math.ceil((bucket.lockedUntilMs - now) / 1000));
            return {
                success: false,
                limit,
                remaining: 0,
                resetTime: new Date(bucket.lockedUntilMs),
                retryAfterSeconds: retryAfter,
                isLocked: true,
            };
        }

        bucket.count++;

        if (bucket.count > limit) {
            // If exceeding limit, apply backoff lockout
            const lockDurationMs = Math.min(windowMs * 2, 300000); // Max 5 mins
            bucket.lockedUntilMs = now + lockDurationMs;

            const retryAfter = Math.max(1, Math.ceil(lockDurationMs / 1000));
            return {
                success: false,
                limit,
                remaining: 0,
                resetTime: new Date(bucket.lockedUntilMs),
                retryAfterSeconds: retryAfter,
                isLocked: true,
            };
        }

        const remaining = Math.max(0, limit - bucket.count);
        const retryAfter = Math.max(1, Math.ceil((bucket.resetAtMs - now) / 1000));

        return {
            success: true,
            limit,
            remaining,
            resetTime: new Date(bucket.resetAtMs),
            retryAfterSeconds: retryAfter,
        };
    },

    /**
     * Endpoint-specific Presets
     */

    // 1. Login / Staff Auth: 5 attempts per 60s per identity/IP
    async checkLogin(identifier: string, ip: string): Promise<RateLimitResult> {
        const cleanId = identifier.trim().toLowerCase();
        const key = `login:${cleanId}:${ip}`;
        return this.check(key, 5, 60, true);
    },

    // 2. Customer OTP Generation / Verification: 5 attempts per 300s per phone/IP
    async checkCustomerOtp(phone: string, ip: string): Promise<RateLimitResult> {
        const cleanPhone = phone.replace(/\D/g, '').slice(-10);
        const key = `customer_otp:${cleanPhone}:${ip}`;
        return this.check(key, 5, 300, true);
    },

    // 3. Order Placement: 10 requests per 60s per table/customer/IP
    async checkOrderCreation(identifier: string, ip: string): Promise<RateLimitResult> {
        const key = `order_create:${identifier}:${ip}`;
        return this.check(key, 10, 60, false);
    },

    // 4. Public Order Status: 30 requests per 60s per order/IP
    async checkPublicStatus(orderId: string, ip: string): Promise<RateLimitResult> {
        const key = `order_status:${orderId}:${ip}`;
        return this.check(key, 30, 60, false);
    },

    // 5. Media Upload: 10 requests per 60s per user/IP
    async checkUpload(userId: string, ip: string): Promise<RateLimitResult> {
        const key = `upload:${userId}:${ip}`;
        return this.check(key, 10, 60, false);
    },

    /**
     * Helper to return standard 429 response with Retry-After header
     */
    createRateLimitResponse(result: RateLimitResult, message?: string): NextResponse {
        return NextResponse.json(
            {
                error: message || 'Too many requests. Please try again later.',
                retryAfter: result.retryAfterSeconds,
                resetTime: result.resetTime.toISOString(),
            },
            {
                status: 429,
                headers: {
                    'Retry-After': String(result.retryAfterSeconds),
                    'X-RateLimit-Limit': String(result.limit),
                    'X-RateLimit-Remaining': String(result.remaining),
                    'X-RateLimit-Reset': result.resetTime.toISOString(),
                },
            }
        );
    },

    /**
     * Testing utility: reset in-memory buckets
     */
    resetAll(): void {
        memoryBuckets.clear();
    },
};
