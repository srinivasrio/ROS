export interface SecurityStorage {
    get<T = unknown>(key: string): Promise<T | undefined>;
    put<T = unknown>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<boolean>;
    setAlarm?(scheduledTime: number): Promise<void>;
}

export interface RateLimitBucket {
    count: number;
    resetAtMs: number;
    lockedUntilMs?: number;
}

export interface RateLimitCheckInput {
    key?: string;
    limit: number;
    windowSeconds: number;
}

export interface RateLimitCheckOutput {
    success: boolean;
    limit: number;
    remaining: number;
    resetTimeMs: number;
    retryAfterSeconds: number;
    isLocked?: boolean;
}

export interface OtpRecord {
    otpHash: string;
    expiresAt: number;
    verified: boolean;
    attempts: number;
}

export interface OtpSetInput {
    otpHash: string;
    ttlSeconds: number;
}

export interface OtpVerifyInput {
    candidateHash: string;
    maxAttempts: number;
    verifiedWindowMs: number;
}

const RL_STORAGE_KEY = 'rl';
const OTP_STORAGE_KEY = 'otp';
const MAX_LOCKOUT_MS = 5 * 60 * 1000;

function constantTimeHexEqual(aHex: string, bHex: string): boolean {
    if (!aHex || aHex.length !== bHex.length || aHex.length % 2 !== 0) {
        return false;
    }
    let diff = 0;
    for (let i = 0; i < aHex.length; i++) {
        diff |= aHex.charCodeAt(i) ^ bHex.charCodeAt(i);
    }
    return diff === 0;
}

async function scheduleCleanupAlarm(storage: SecurityStorage, rl?: RateLimitBucket, otp?: OtpRecord): Promise<void> {
    if (typeof storage.setAlarm !== 'function') return;
    const candidates: number[] = [];
    if (rl) {
        candidates.push(Math.max(rl.resetAtMs, rl.lockedUntilMs ?? 0));
    }
    if (otp) {
        candidates.push(otp.expiresAt);
    }
    if (candidates.length > 0) {
        await storage.setAlarm(Math.min(...candidates));
    }
}

export async function handleSecurityRateLimit(
    storage: SecurityStorage,
    input: RateLimitCheckInput,
    now: number = Date.now()
): Promise<RateLimitCheckOutput> {
    const limit = Math.max(1, Math.floor(Number(input.limit) || 1));
    const windowSeconds = Math.max(1, Math.floor(Number(input.windowSeconds) || 60));
    const windowMs = windowSeconds * 1000;

    const existing = await storage.get<RateLimitBucket>(RL_STORAGE_KEY);
    const otp = await storage.get<OtpRecord>(OTP_STORAGE_KEY);

    if (existing && existing.lockedUntilMs && existing.lockedUntilMs > now) {
        const retryAfter = Math.max(1, Math.ceil((existing.lockedUntilMs - now) / 1000));
        return {
            success: false,
            limit,
            remaining: 0,
            resetTimeMs: existing.lockedUntilMs,
            retryAfterSeconds: retryAfter,
            isLocked: true,
        };
    }

    if (!existing || existing.resetAtMs <= now) {
        const fresh: RateLimitBucket = {
            count: 1,
            resetAtMs: now + windowMs,
        };
        await storage.put(RL_STORAGE_KEY, fresh);
        await scheduleCleanupAlarm(storage, fresh, otp);

        return {
            success: true,
            limit,
            remaining: Math.max(0, limit - 1),
            resetTimeMs: fresh.resetAtMs,
            retryAfterSeconds: windowSeconds,
        };
    }

    existing.count += 1;

    if (existing.count > limit) {
        const lockDurationMs = Math.min(windowMs * 2, MAX_LOCKOUT_MS);
        existing.lockedUntilMs = now + lockDurationMs;
        await storage.put(RL_STORAGE_KEY, existing);
        await scheduleCleanupAlarm(storage, existing, otp);

        const retryAfter = Math.max(1, Math.ceil(lockDurationMs / 1000));
        return {
            success: false,
            limit,
            remaining: 0,
            resetTimeMs: existing.lockedUntilMs,
            retryAfterSeconds: retryAfter,
            isLocked: true,
        };
    }

    await storage.put(RL_STORAGE_KEY, existing);
    await scheduleCleanupAlarm(storage, existing, otp);

    const remaining = Math.max(0, limit - existing.count);
    const retryAfter = Math.max(1, Math.ceil((existing.resetAtMs - now) / 1000));

    return {
        success: true,
        limit,
        remaining,
        resetTimeMs: existing.resetAtMs,
        retryAfterSeconds: retryAfter,
    };
}

export async function handleSecurityOtpSet(
    storage: SecurityStorage,
    input: OtpSetInput,
    now: number = Date.now()
): Promise<{ ok: true }> {
    const ttlSeconds = Math.max(60, Math.floor(Number(input.ttlSeconds) || 600));
    const entry: OtpRecord = {
        otpHash: String(input.otpHash || ''),
        expiresAt: now + ttlSeconds * 1000,
        verified: false,
        attempts: 0,
    };
    const rl = await storage.get<RateLimitBucket>(RL_STORAGE_KEY);
    await storage.put(OTP_STORAGE_KEY, entry);
    await scheduleCleanupAlarm(storage, rl, entry);
    return { ok: true };
}

export async function handleSecurityOtpVerify(
    storage: SecurityStorage,
    input: OtpVerifyInput,
    now: number = Date.now()
): Promise<{ ok: boolean }> {
    const entry = await storage.get<OtpRecord>(OTP_STORAGE_KEY);
    if (!entry) return { ok: false };

    const maxAttempts = Math.max(1, Math.floor(Number(input.maxAttempts) || 5));
    if (entry.expiresAt < now || entry.attempts >= maxAttempts) {
        await storage.delete(OTP_STORAGE_KEY);
        return { ok: false };
    }

    if (constantTimeHexEqual(String(input.candidateHash || ''), entry.otpHash)) {
        const verifiedWindowMs = Math.max(60_000, Number(input.verifiedWindowMs) || 30 * 60 * 1000);
        const updated: OtpRecord = {
            ...entry,
            verified: true,
            expiresAt: Math.max(entry.expiresAt, now + verifiedWindowMs),
        };
        const rl = await storage.get<RateLimitBucket>(RL_STORAGE_KEY);
        await storage.put(OTP_STORAGE_KEY, updated);
        await scheduleCleanupAlarm(storage, rl, updated);
        return { ok: true };
    }

    entry.attempts += 1;
    if (entry.attempts >= maxAttempts) {
        await storage.delete(OTP_STORAGE_KEY);
    } else {
        const rl = await storage.get<RateLimitBucket>(RL_STORAGE_KEY);
        await storage.put(OTP_STORAGE_KEY, entry);
        await scheduleCleanupAlarm(storage, rl, entry);
    }

    return { ok: false };
}

export async function handleSecurityOtpIsVerified(
    storage: SecurityStorage,
    now: number = Date.now()
): Promise<{ verified: boolean }> {
    const entry = await storage.get<OtpRecord>(OTP_STORAGE_KEY);
    if (!entry || entry.expiresAt < now) {
        if (entry) {
            await storage.delete(OTP_STORAGE_KEY);
        }
        return { verified: false };
    }
    return { verified: Boolean(entry.verified) };
}

export async function handleSecurityOtpClear(storage: SecurityStorage): Promise<{ ok: true }> {
    await storage.delete(OTP_STORAGE_KEY);
    return { ok: true };
}

export async function handleSecurityAlarm(storage: SecurityStorage, now: number = Date.now()): Promise<void> {
    let rl = await storage.get<RateLimitBucket>(RL_STORAGE_KEY);
    let otp = await storage.get<OtpRecord>(OTP_STORAGE_KEY);

    if (rl && Math.max(rl.resetAtMs, rl.lockedUntilMs ?? 0) <= now) {
        await storage.delete(RL_STORAGE_KEY);
        rl = undefined;
    }

    if (otp && otp.expiresAt <= now) {
        await storage.delete(OTP_STORAGE_KEY);
        otp = undefined;
    }

    await scheduleCleanupAlarm(storage, rl, otp);
}
