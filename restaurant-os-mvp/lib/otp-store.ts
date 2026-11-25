import crypto from 'crypto';
import { supabaseAdmin } from './supabase-admin';

interface RedisOtpEntry {
    otpHash: string;
    expiresAt: number;
    verified: boolean;
    attempts: number;
}

const MAX_ATTEMPTS = 5;
const VERIFIED_WINDOW_MS = 30 * 60 * 1000; // 30 minutes to complete registration after OTP verification

function getOtpSecret(): string {
    const secret =
        process.env.OTP_HASH_SECRET ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.JWT_SECRET ||
        '';
    if (!secret || secret.length < 16) {
        throw new Error('OTP_HASH_SECRET, SUPABASE_SERVICE_ROLE_KEY, or JWT_SECRET must be configured');
    }
    return secret;
}

function hashOtpCode(cleanKey: string, code: string): string {
    return crypto
        .createHmac('sha256', getOtpSecret())
        .update(`otp_mgr:${cleanKey}:${code.trim()}`)
        .digest('hex');
}

function constantTimeHexEqual(aHex: string, bHex: string): boolean {
    try {
        const a = Buffer.from(aHex, 'hex');
        const b = Buffer.from(bHex, 'hex');
        if (a.length === 0 || a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

function getUpstashConfig(): { url: string; token: string } | null {
    const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/+$/, '');
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (url && token) return { url, token };
    return null;
}

async function upstashCommand(config: { url: string; token: string }, args: (string | number)[]): Promise<unknown> {
    const res = await fetch(config.url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${config.token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) {
        throw new Error(`Upstash HTTP ${res.status}`);
    }
    const json = await res.json();
    return json?.result;
}

function dbKey(identifier: string): string {
    return `otp_mgr:${identifier.toLowerCase().trim()}`;
}

function redisKey(identifier: string): string {
    return `dine:otp_mgr:${identifier.toLowerCase().trim()}`;
}

/**
 * Distributed OTP Manager compatible with stateless Cloudflare Workers isolates.
 * Uses Upstash Redis when configured, and falls back to Supabase (`email_otp_verifications`)
 * with HMAC-SHA256 hashed codes. No module-level timers or process-local state.
 */
export const OtpManager = {
    async setOtp(identifier: string, code: string, ttlSeconds: number = 600): Promise<void> {
        const cleanKey = identifier.toLowerCase().trim();
        const otpHash = hashOtpCode(cleanKey, code);
        const now = Date.now();
        const expiresAt = now + ttlSeconds * 1000;

        const upstash = getUpstashConfig();
        if (upstash) {
            try {
                const entry: RedisOtpEntry = {
                    otpHash,
                    expiresAt,
                    verified: false,
                    attempts: 0,
                };
                await upstashCommand(upstash, ['SET', redisKey(cleanKey), JSON.stringify(entry), 'EX', Math.max(60, ttlSeconds)]);
                return;
            } catch (err) {
                console.warn('[OtpManager] Upstash setOtp failed, falling back to Supabase:', err);
            }
        }

        const namespacedKey = dbKey(cleanKey);
        const nowIso = new Date(now).toISOString();

        // Invalidate previous active OTPs for this identifier
        await supabaseAdmin
            .from('email_otp_verifications')
            .update({ is_used: true, updated_at: nowIso })
            .eq('email', namespacedKey)
            .eq('is_used', false);

        const { error } = await supabaseAdmin.from('email_otp_verifications').insert({
            email: namespacedKey,
            otp_hash: otpHash,
            expires_at: new Date(expiresAt).toISOString(),
            attempt_count: 0,
            max_attempts: MAX_ATTEMPTS,
            is_used: false,
            is_verified: false,
            last_sent_at: nowIso,
            resend_available_at: nowIso,
        });

        if (error) {
            throw new Error(`Failed to persist OTP: ${error.message}`);
        }
    },

    async verifyOtp(identifier: string, code: string): Promise<boolean> {
        const cleanKey = identifier.toLowerCase().trim();
        const cleanCode = String(code || '').trim();
        if (!cleanKey || !cleanCode) return false;

        const now = Date.now();
        const upstash = getUpstashConfig();
        if (upstash) {
            try {
                const rKey = redisKey(cleanKey);
                const raw = await upstashCommand(upstash, ['GET', rKey]);
                if (!raw) return false;

                const entry = JSON.parse(String(raw)) as RedisOtpEntry;
                if (!entry || entry.expiresAt < now || entry.attempts >= MAX_ATTEMPTS) {
                    await upstashCommand(upstash, ['DEL', rKey]);
                    return false;
                }

                const candidateHash = hashOtpCode(cleanKey, cleanCode);
                if (constantTimeHexEqual(candidateHash, entry.otpHash)) {
                    const updated: RedisOtpEntry = {
                        ...entry,
                        verified: true,
                        expiresAt: Math.max(entry.expiresAt, now + VERIFIED_WINDOW_MS),
                    };
                    await upstashCommand(upstash, ['SET', rKey, JSON.stringify(updated), 'EX', Math.ceil(VERIFIED_WINDOW_MS / 1000)]);
                    return true;
                }

                entry.attempts += 1;
                if (entry.attempts >= MAX_ATTEMPTS) {
                    await upstashCommand(upstash, ['DEL', rKey]);
                } else {
                    const remainingSec = Math.max(1, Math.ceil((entry.expiresAt - now) / 1000));
                    await upstashCommand(upstash, ['SET', rKey, JSON.stringify(entry), 'EX', remainingSec]);
                }
                return false;
            } catch (err) {
                console.warn('[OtpManager] Upstash verifyOtp failed, falling back to Supabase:', err);
            }
        }

        const namespacedKey = dbKey(cleanKey);
        const nowIso = new Date(now).toISOString();

        const { data: record } = await supabaseAdmin
            .from('email_otp_verifications')
            .select('*')
            .eq('email', namespacedKey)
            .eq('is_used', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!record) return false;

        if (new Date(record.expires_at).getTime() < now || record.attempt_count >= record.max_attempts) {
            await supabaseAdmin
                .from('email_otp_verifications')
                .update({ is_used: true, updated_at: nowIso })
                .eq('id', record.id);
            return false;
        }

        const candidateHash = hashOtpCode(cleanKey, cleanCode);
        if (!constantTimeHexEqual(candidateHash, record.otp_hash)) {
            const nextAttempts = record.attempt_count + 1;
            await supabaseAdmin
                .from('email_otp_verifications')
                .update({
                    attempt_count: nextAttempts,
                    is_used: nextAttempts >= record.max_attempts,
                    updated_at: nowIso,
                })
                .eq('id', record.id);
            return false;
        }

        await supabaseAdmin
            .from('email_otp_verifications')
            .update({
                is_used: true,
                is_verified: true,
                verified_at: nowIso,
                updated_at: nowIso,
            })
            .eq('id', record.id);

        return true;
    },

    async isVerified(identifier: string): Promise<boolean> {
        const cleanKey = identifier.toLowerCase().trim();
        if (!cleanKey) return false;

        const now = Date.now();
        const upstash = getUpstashConfig();
        if (upstash) {
            try {
                const raw = await upstashCommand(upstash, ['GET', redisKey(cleanKey)]);
                if (!raw) return false;
                const entry = JSON.parse(String(raw)) as RedisOtpEntry;
                return Boolean(entry?.verified && entry.expiresAt >= now);
            } catch (err) {
                console.warn('[OtpManager] Upstash isVerified failed, falling back to Supabase:', err);
            }
        }

        const namespacedKey = dbKey(cleanKey);
        const cutoffIso = new Date(now - VERIFIED_WINDOW_MS).toISOString();

        const { data } = await supabaseAdmin
            .from('email_otp_verifications')
            .select('id')
            .eq('email', namespacedKey)
            .eq('is_verified', true)
            .gte('verified_at', cutoffIso)
            .order('verified_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        return Boolean(data?.id);
    },

    async clear(identifier: string): Promise<void> {
        const cleanKey = identifier.toLowerCase().trim();
        if (!cleanKey) return;

        const upstash = getUpstashConfig();
        if (upstash) {
            try {
                await upstashCommand(upstash, ['DEL', redisKey(cleanKey)]);
            } catch (err) {
                console.warn('[OtpManager] Upstash clear failed:', err);
            }
        }

        await supabaseAdmin
            .from('email_otp_verifications')
            .delete()
            .eq('email', dbKey(cleanKey));
    },
};
