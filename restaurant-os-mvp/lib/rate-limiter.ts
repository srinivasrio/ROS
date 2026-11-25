import { NextResponse } from 'next/server';
import { getCloudflareSecurityEnv, type CloudflareSecurityEnv } from './cloudflare-bindings';
import { isCloudflareWorkers } from './runtime';

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

type PublicRateLimitBindingName = 'RL_LOOKUP_PHONE' | 'RL_ACTIVE_ORDER' | 'RL_ORDER_STATUS' | 'RL_UPLOAD';

const PUBLIC_RATE_LIMIT_ROUTES: Array<{
    prefix: string;
    binding: PublicRateLimitBindingName;
    limit: number;
    periodSeconds: number;
}> = [
    { prefix: 'phone_lookup:', binding: 'RL_LOOKUP_PHONE', limit: 5, periodSeconds: 60 },
    { prefix: 'customer_active_order:', binding: 'RL_ACTIVE_ORDER', limit: 5, periodSeconds: 60 },
    { prefix: 'order_status:', binding: 'RL_ORDER_STATUS', limit: 30, periodSeconds: 60 },
    { prefix: 'upload:', binding: 'RL_UPLOAD', limit: 10, periodSeconds: 60 },
];

const STRICT_AUTH_KEY_PREFIXES = [
    'login:',
    'login_ip:',
    'verify_ip:',
    'reg_ip:',
    'resend_ip:',
    'waiter_otp_send:',
    'customer_otp:',
    'otp_email_limit:',
    'user:',
    'actor:',
    'ip:',
];

const memoryBuckets = new Map<string, WindowBucket>();
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastSweepMs = Date.now();
let warnedMissingDoOnWorkers = false;

function sweepExpiredBuckets(now: number) {
    if (now - lastSweepMs < SWEEP_INTERVAL_MS) return;
    lastSweepMs = now;
    for (const [key, bucket] of memoryBuckets.entries()) {
        if (bucket.resetAtMs < now && (!bucket.lockedUntilMs || bucket.lockedUntilMs < now)) {
            memoryBuckets.delete(key);
        }
    }
}

function isStrictAuthKey(key: string, isAuthStrict: boolean): boolean {
    if (isAuthStrict) return true;
    return STRICT_AUTH_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function failClosedResult(limit: number, now: number): RateLimitResult {
    return {
        success: false,
        limit,
        remaining: 0,
        resetTime: new Date(now + 60_000),
        retryAfterSeconds: 60,
    };
}

function checkInMemoryBucket(key: string, limit: number, windowSeconds: number, now: number): RateLimitResult {
    const windowMs = windowSeconds * 1000;
    sweepExpiredBuckets(now);
    let bucket = memoryBuckets.get(key);

    if (!bucket || bucket.resetAtMs <= now) {
        bucket = { count: 1, resetAtMs: now + windowMs };
        memoryBuckets.set(key, bucket);
        return {
            success: true,
            limit,
            remaining: limit - 1,
            resetTime: new Date(bucket.resetAtMs),
            retryAfterSeconds: Math.ceil(windowSeconds),
        };
    }

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
        const lockDurationMs = Math.min(windowMs * 2, 300_000);
        bucket.lockedUntilMs = now + lockDurationMs;
        return {
            success: false,
            limit,
            remaining: 0,
            resetTime: new Date(bucket.lockedUntilMs),
            retryAfterSeconds: Math.max(1, Math.ceil(lockDurationMs / 1000)),
            isLocked: true,
        };
    }

    return {
        success: true,
        limit,
        remaining: Math.max(0, limit - bucket.count),
        resetTime: new Date(bucket.resetAtMs),
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAtMs - now) / 1000)),
    };
}

async function checkPublicBinding(
    env: CloudflareSecurityEnv,
    key: string,
    now: number
): Promise<RateLimitResult | null> {
    const route = PUBLIC_RATE_LIMIT_ROUTES.find((entry) => key.startsWith(entry.prefix));
    if (!route) return null;

    const binding = env[route.binding];
    if (!binding || typeof binding.limit !== 'function') return null;

    const { success } = await binding.limit({ key });
    const resetTime = new Date(now + route.periodSeconds * 1000);
    return {
        success,
        limit: route.limit,
        remaining: success ? Math.max(0, route.limit - 1) : 0,
        resetTime,
        retryAfterSeconds: route.periodSeconds,
    };
}

/**
 * Distributed Rate Limiter powered by Cloudflare native Rate Limiting bindings
 * (public high-traffic endpoints) and SECURITY_DO Durable Objects (auth/OTP),
 * with an in-memory fallback for local development.
 */
export const RateLimiter = {
    async check(
        key: string,
        limit: number,
        windowSeconds: number,
        isAuthStrict: boolean = false
    ): Promise<RateLimitResult> {
        const now = Date.now();
        const strict = isStrictAuthKey(key, isAuthStrict);
        const cfEnv = await getCloudflareSecurityEnv();

        if (cfEnv) {
            try {
                const publicResult = await checkPublicBinding(cfEnv, key, now);
                if (publicResult) return publicResult;

                if (cfEnv.SECURITY_DO) {
                    const stub = cfEnv.SECURITY_DO.get(cfEnv.SECURITY_DO.idFromName(`rl:${key}`));
                    const res = await stub.fetch('https://security-do.internal/rate-limit', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key, limit, windowSeconds }),
                        signal: AbortSignal.timeout(2000),
                    });

                    if (res.ok) {
                        const data = (await res.json()) as {
                            success: boolean;
                            limit: number;
                            remaining: number;
                            resetTimeMs: number;
                            retryAfterSeconds: number;
                            isLocked?: boolean;
                        };
                        return {
                            success: Boolean(data.success),
                            limit: Number(data.limit ?? limit),
                            remaining: Number(data.remaining ?? 0),
                            resetTime: new Date(Number(data.resetTimeMs || now + windowSeconds * 1000)),
                            retryAfterSeconds: Number(data.retryAfterSeconds ?? 1),
                            isLocked: Boolean(data.isLocked),
                        };
                    }

                    console.warn(`[RateLimiter] SECURITY_DO HTTP ${res.status} for ${key}`);
                    if (strict) return failClosedResult(limit, now);
                }
            } catch (err) {
                console.warn('[RateLimiter] Cloudflare rate-limit check failed:', err);
                if (strict) return failClosedResult(limit, now);
            }
        }

        if (isCloudflareWorkers()) {
            if (!warnedMissingDoOnWorkers) {
                warnedMissingDoOnWorkers = true;
                console.error('[RateLimiter] Cloudflare SECURITY_DO / RL_* bindings unavailable on Workers; falling back.');
            }
            if (strict) return failClosedResult(limit, now);
        }

        return checkInMemoryBucket(key, limit, windowSeconds, now);
    },

    // 1. Login / Staff Auth: 5 attempts per 60s per identity/IP
    async checkLogin(identifier: string, ip: string): Promise<RateLimitResult> {
        const cleanId = identifier.trim().toLowerCase();
        return this.check(`login:${cleanId}:${ip}`, 5, 60, true);
    },

    // 2. Customer OTP Generation / Verification: 5 attempts per 300s per phone/IP
    async checkCustomerOtp(phone: string, ip: string): Promise<RateLimitResult> {
        const cleanPhone = phone.replace(/\D/g, '').slice(-10);
        return this.check(`customer_otp:${cleanPhone}:${ip}`, 5, 300, true);
    },

    // 3. Order Placement: 10 requests per 60s per table/customer/IP
    async checkOrderCreation(identifier: string, ip: string): Promise<RateLimitResult> {
        return this.check(`order_create:${identifier}:${ip}`, 10, 60, false);
    },

    // 4. Public Order Status: 30 requests per 60s per order/IP
    async checkPublicStatus(orderId: string, ip: string): Promise<RateLimitResult> {
        return this.check(`order_status:${orderId}:${ip}`, 30, 60, false);
    },

    // 5. Media Upload: 10 requests per 60s per user/IP
    async checkUpload(userId: string, ip: string): Promise<RateLimitResult> {
        return this.check(`upload:${userId}:${ip}`, 10, 60, false);
    },

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

    resetAll(): void {
        memoryBuckets.clear();
    },
};
