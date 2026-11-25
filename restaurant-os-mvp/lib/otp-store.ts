import crypto from 'crypto';
import { getCloudflareSecurityEnv } from './cloudflare-bindings';
import { supabaseAdmin } from './supabase-admin';

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

function dbKey(identifier: string): string {
    return `otp_mgr:${identifier.toLowerCase().trim()}`;
}

async function callSecurityDoOtp<T>(cleanKey: string, path: string, payload: Record<string, unknown> = {}): Promise<T | null> {
    const cfEnv = await getCloudflareSecurityEnv();
    if (!cfEnv?.SECURITY_DO) return null;

    const stub = cfEnv.SECURITY_DO.get(cfEnv.SECURITY_DO.idFromName(`otp:${cleanKey}`));
    const res = await stub.fetch(`https://security-do.internal${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) {
        throw new Error(`SECURITY_DO ${path} HTTP ${res.status}`);
    }
    return (await res.json()) as T;
}

/**
 * Distributed OTP Manager compatible with stateless Cloudflare Workers isolates.
 * Uses SECURITY_DO Durable Object storage when bound, and falls back to Supabase
 * (`email_otp_verifications`) with HMAC-SHA256 hashed codes.
 */
export const OtpManager = {
    async setOtp(identifier: string, code: string, ttlSeconds: number = 600): Promise<void> {
        const cleanKey = identifier.toLowerCase().trim();
        const otpHash = hashOtpCode(cleanKey, code);
        const now = Date.now();
        const expiresAt = now + ttlSeconds * 1000;

        try {
            const doResult = await callSecurityDoOtp<{ ok: boolean }>(cleanKey, '/otp/set', {
                otpHash,
                ttlSeconds,
            });
            if (doResult?.ok) return;
        } catch (err) {
            console.warn('[OtpManager] SECURITY_DO setOtp failed, falling back to Supabase:', err);
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
        const candidateHash = hashOtpCode(cleanKey, cleanCode);

        try {
            const doResult = await callSecurityDoOtp<{ ok: boolean }>(cleanKey, '/otp/verify', {
                candidateHash,
                maxAttempts: MAX_ATTEMPTS,
                verifiedWindowMs: VERIFIED_WINDOW_MS,
            });
            if (doResult !== null) {
                return Boolean(doResult.ok);
            }
        } catch (err) {
            console.warn('[OtpManager] SECURITY_DO verifyOtp failed, falling back to Supabase:', err);
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
        try {
            const doResult = await callSecurityDoOtp<{ verified: boolean }>(cleanKey, '/otp/is-verified');
            if (doResult !== null) {
                return Boolean(doResult.verified);
            }
        } catch (err) {
            console.warn('[OtpManager] SECURITY_DO isVerified failed, falling back to Supabase:', err);
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

        try {
            await callSecurityDoOtp<{ ok: boolean }>(cleanKey, '/otp/clear');
        } catch (err) {
            console.warn('[OtpManager] SECURITY_DO clear failed:', err);
        }

        await supabaseAdmin
            .from('email_otp_verifications')
            .delete()
            .eq('email', dbKey(cleanKey));
    },
};
