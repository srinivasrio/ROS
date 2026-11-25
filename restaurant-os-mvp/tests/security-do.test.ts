import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
    handleSecurityAlarm,
    handleSecurityOtpClear,
    handleSecurityOtpIsVerified,
    handleSecurityOtpSet,
    handleSecurityOtpVerify,
    handleSecurityRateLimit,
    type SecurityStorage,
} from '../workers/realtime/security-core.ts';

function createMockStorage() {
    const store = new Map<string, unknown>();
    let nextAlarm: number | null = null;

    const storage: SecurityStorage = {
        async get<T = unknown>(key: string): Promise<T | undefined> {
            return store.get(key) as T | undefined;
        },
        async put<T = unknown>(key: string, value: T): Promise<void> {
            store.set(key, structuredClone(value));
        },
        async delete(key: string): Promise<boolean> {
            return store.delete(key);
        },
        async setAlarm(scheduledTime: number): Promise<void> {
            nextAlarm = scheduledTime;
        },
    };

    return {
        storage,
        getStore: () => store,
        getAlarm: () => nextAlarm,
    };
}

test('SecurityRoom rate limiter enforces limits, lockouts, window resets, and alarm cleanup', async () => {
    const mock = createMockStorage();
    const t0 = 1_700_000_000_000;

    // 1st and 2nd request within limit=2 succeed
    const r1 = await handleSecurityRateLimit(mock.storage, { limit: 2, windowSeconds: 60 }, t0);
    assert.equal(r1.success, true);
    assert.equal(r1.remaining, 1);
    assert.equal(mock.getAlarm(), t0 + 60_000);

    const r2 = await handleSecurityRateLimit(mock.storage, { limit: 2, windowSeconds: 60 }, t0 + 1_000);
    assert.equal(r2.success, true);
    assert.equal(r2.remaining, 0);

    // 3rd request triggers lockout (min(window*2, 300s) = 120s)
    const r3 = await handleSecurityRateLimit(mock.storage, { limit: 2, windowSeconds: 60 }, t0 + 2_000);
    assert.equal(r3.success, false);
    assert.equal(r3.isLocked, true);
    assert.equal(r3.retryAfterSeconds, 120);

    // Subsequent call during lockout stays blocked
    const r4 = await handleSecurityRateLimit(mock.storage, { limit: 2, windowSeconds: 60 }, t0 + 65_000);
    assert.equal(r4.success, false);
    assert.equal(r4.isLocked, true);

    // Alarm cleanup after lockout expiry removes bucket
    await handleSecurityAlarm(mock.storage, t0 + 123_000);
    assert.equal(mock.getStore().has('rl'), false);

    // Next request after reset succeeds cleanly
    const r5 = await handleSecurityRateLimit(mock.storage, { limit: 2, windowSeconds: 60 }, t0 + 124_000);
    assert.equal(r5.success, true);
    assert.equal(r5.remaining, 1);
});

test('SecurityRoom OTP lifecycle handles verification, max attempts, expiry, and alarm cleanup', async () => {
    const mock = createMockStorage();
    const t0 = 1_700_000_000_000;
    const goodHash = 'a'.repeat(64);
    const badHash = 'b'.repeat(64);

    await handleSecurityOtpSet(mock.storage, { otpHash: goodHash, ttlSeconds: 600 }, t0);
    assert.equal(mock.getAlarm(), t0 + 600_000);

    // Wrong OTP does not mark verified
    const fail1 = await handleSecurityOtpVerify(
        mock.storage,
        { candidateHash: badHash, maxAttempts: 3, verifiedWindowMs: 1_800_000 },
        t0 + 1_000
    );
    assert.equal(fail1.ok, false);
    assert.equal((await handleSecurityOtpIsVerified(mock.storage, t0 + 1_500)).verified, false);

    // Valid OTP succeeds and marks verified for verifiedWindowMs
    const pass = await handleSecurityOtpVerify(
        mock.storage,
        { candidateHash: goodHash, maxAttempts: 3, verifiedWindowMs: 1_800_000 },
        t0 + 2_000
    );
    assert.equal(pass.ok, true);
    assert.equal((await handleSecurityOtpIsVerified(mock.storage, t0 + 3_000)).verified, true);

    // Alarm after verified window clears expired OTP
    await handleSecurityAlarm(mock.storage, t0 + 1_803_000);
    assert.equal(mock.getStore().has('otp'), false);
    assert.equal((await handleSecurityOtpIsVerified(mock.storage, t0 + 1_803_000)).verified, false);

    // Exceeding maxAttempts deletes OTP immediately
    await handleSecurityOtpSet(mock.storage, { otpHash: goodHash, ttlSeconds: 600 }, t0);
    for (let i = 0; i < 2; i++) {
        const miss = await handleSecurityOtpVerify(
            mock.storage,
            { candidateHash: badHash, maxAttempts: 2, verifiedWindowMs: 1_800_000 },
            t0 + 100
        );
        assert.equal(miss.ok, false);
    }
    assert.equal(mock.getStore().has('otp'), false);

    // Clear removes stored OTP
    await handleSecurityOtpSet(mock.storage, { otpHash: goodHash, ttlSeconds: 600 }, t0);
    await handleSecurityOtpClear(mock.storage);
    assert.equal(mock.getStore().has('otp'), false);
});

test('Upstash removed and Cloudflare native ratelimits + SECURITY_DO bindings configured', () => {
    const ROOT = process.cwd();
    const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

    const rateLimiter = read('lib/rate-limiter.ts');
    const otpStore = read('lib/otp-store.ts');
    const devVars = read('.dev.vars.example');
    const pkg = read('package.json');

    for (const src of [rateLimiter, otpStore, devVars, pkg]) {
        assert.doesNotMatch(src, /UPSTASH_REDIS_REST_/);
        assert.doesNotMatch(src, /@upstash\/redis/);
    }

    assert.match(rateLimiter, /RL_LOOKUP_PHONE/);
    assert.match(rateLimiter, /RL_ACTIVE_ORDER/);
    assert.match(rateLimiter, /RL_ORDER_STATUS/);
    assert.match(rateLimiter, /RL_UPLOAD/);
    assert.match(rateLimiter, /SECURITY_DO/);

    assert.match(otpStore, /SECURITY_DO/);
    assert.match(otpStore, /email_otp_verifications/);

    const rootWrangler = read('wrangler.jsonc');
    assert.match(rootWrangler, /"ratelimits"/);
    assert.match(rootWrangler, /"SECURITY_DO"/);
    assert.match(rootWrangler, /"SecurityRoom"/);
    assert.match(rootWrangler, /"dine-in-one-realtime"/);

    const rtWrangler = read('workers/realtime/wrangler.jsonc');
    assert.match(rtWrangler, /"SecurityRoom"/);
    assert.match(read('workers/realtime/index.ts'), /export\s*\{\s*SecurityRoom\s*\}/);
});
