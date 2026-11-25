import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { sanitizeEmployeeProfile } from '../lib/entity-id.ts';

const ROOT = process.cwd();
const read = (relPath: string) => fs.readFileSync(path.join(ROOT, relPath), 'utf8');
const exists = (relPath: string) => fs.existsSync(path.join(ROOT, relPath));

test('P0-1: realtime-auth connects cfRealtimeClient and /api/realtime/token returns scope metadata', () => {
    const rtAuth = read('lib/realtime-auth.ts');
    assert.match(rtAuth, /cfRealtimeClient\.connect\(/);
    assert.match(rtAuth, /cfRealtimeClient\.disconnect\(\)/);

    const tokenRoute = read('app/api/realtime/token/route.ts');
    assert.match(tokenRoute, /restaurantId:/);
    assert.match(tokenRoute, /role:/);
    assert.match(tokenRoute, /tableNumber:/);
});

test('P0-2: realtime webhook migrations do not seed hardcoded secret defaults', () => {
    const m1 = read('supabase/migrations/20261118120000_cloudflare_realtime_broadcast_webhook.sql');
    assert.doesNotMatch(m1, /ros_cf_realtime_secret_p0/);
    assert.match(m1, /is_enabled BOOLEAN NOT NULL DEFAULT false/);

    const m2 = read('supabase/migrations/20261125000000_harden_realtime_webhook_secret.sql');
    assert.match(m2, /ALTER COLUMN webhook_secret DROP DEFAULT/);
    assert.match(m2, /is_enabled = false/);
});

test('P0-3: public auth endpoints strip forceFailSes and gate devOtp/SES simulation', () => {
    const registerRoute = read('app/api/auth/register/route.ts');
    const resendRoute = read('app/api/auth/resend-otp/route.ts');
    assert.doesNotMatch(registerRoute, /forceFailSes/);
    assert.doesNotMatch(resendRoute, /forceFailSes/);

    for (const file of ['lib/email-otp.ts', 'super-admin/lib/email-otp.ts']) {
        const content = read(file);
        assert.match(content, /ALLOW_DEV_OTP === 'true'/);
        assert.match(content, /NODE_ENV === 'development'/);
    }

    for (const file of ['services/ses-email.service.ts', 'super-admin/lib/ses-email-service.ts']) {
        const content = read(file);
        assert.match(content, /if \(isProd\)/);
        assert.match(content, /Amazon SES email delivery is not configured/);
    }

    const custOtp = read('lib/customer-otp.ts');
    assert.match(custOtp, /NODE_ENV === 'development'/);
    assert.match(custOtp, /ALLOW_DEV_OTP === 'true'/);
});

test('P0-4: OtpManager has no module-level setInterval and all callers await it', () => {
    const otpStore = read('lib/otp-store.ts');
    assert.doesNotMatch(otpStore, /setInterval\s*\(/);
    assert.match(otpStore, /email_otp_verifications/);
    assert.match(otpStore, /UPSTASH_REDIS_REST_URL/);

    const callers = [
        'app/api/auth/owner/send-otp/route.ts',
        'app/api/auth/owner/verify-otp/route.ts',
        'app/api/auth/owner/register/route.ts',
        'app/api/auth/waiter/send-otp/route.ts',
        'app/api/auth/waiter/verify-otp/route.ts',
    ];
    for (const file of callers) {
        const content = read(file);
        const matches = content.match(/OtpManager\./g) || [];
        const awaited = content.match(/await\s+OtpManager\./g) || [];
        assert.equal(awaited.length, matches.length, `${file} must await every OtpManager call`);
    }
});

test('P0-5: sanitizeEmployeeProfile strips secrets and lockdown migration secures RPCs/orders', () => {
    const sanitized = sanitizeEmployeeProfile({
        id: 'emp-1',
        name: 'Asha',
        raw_pin: '9999',
        raw_password: 'secret',
        password_hash: '$pbkdf2-sha256$i=600000$abc$def',
        pin: '$pbkdf2-sha256$i=100000$abc$def',
        otp_secret: 'BASE32',
        recovery_codes: ['A-B-C'],
        activation_token: 'tok',
        auth_token: 'jwt',
    });

    assert.equal(sanitized.raw_pin, undefined);
    assert.equal(sanitized.raw_password, undefined);
    assert.equal(sanitized.password_hash, undefined);
    assert.equal(sanitized.otp_secret, undefined);
    assert.equal(sanitized.recovery_codes, undefined);
    assert.equal(sanitized.activation_token, undefined);
    assert.equal(sanitized.auth_token, undefined);
    assert.equal(sanitized.pin, null);

    const legacyPinSanitized = sanitizeEmployeeProfile({ id: 'emp-2', pin: '1234' });
    assert.equal(legacyPinSanitized.pin, '1234');

    const branchesUi = read('app/owner/branches/page.tsx');
    const ownersUi = read('super-admin/app/admin/owners/[id]/page.tsx');
    assert.doesNotMatch(branchesUi, /raw_pin|raw_password/);
    assert.doesNotMatch(ownersUi, /raw_pin|raw_password/);

    const lockdownSql = read('supabase/migrations/20261125010000_p0_c07_h03_lockdown.sql');
    assert.match(lockdownSql, /DROP COLUMN IF EXISTS raw_pin/);
    assert.match(lockdownSql, /DROP COLUMN IF EXISTS raw_password/);
    assert.match(lockdownSql, /validate_tenant\(p_restaurant_id\)/);
    assert.match(lockdownSql, /REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated/);
    assert.match(lockdownSql, /FROM public\.delivery_zones/);
});

test('P0-6: fail-closed supabaseAdmin proxies and production redirects', async () => {
    const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const prevPrimary = process.env.NEXT_PUBLIC_PRIMARY_SUPABASE_URL;
    const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_PRIMARY_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
        const saMod = await import(`../super-admin/lib/supabase-admin.ts?unconfigured=${Date.now()}`);
        assert.throws(() => saMod.supabaseAdmin.from('restaurants'), /must be configured/);
    } finally {
        if (prevUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
        if (prevPrimary !== undefined) process.env.NEXT_PUBLIC_PRIMARY_SUPABASE_URL = prevPrimary;
        if (prevKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
    }

    const mainAdmin = read('lib/supabase-admin.ts');
    assert.match(mainAdmin, /createFailClosedAdminProxy/);
    assert.doesNotMatch(mainAdmin, /placeholder_service_role_key/);

    const supaClient = read('lib/supabase.ts');
    assert.doesNotMatch(supaClient, /jmcsygpphwdubnanwjwz/);

    const mw = read('middleware.ts');
    assert.match(mw, /https:\/\/control\.dineinone\.com/);
});

test('P1: next.config enforces TS, ESLint ignores subprojects, and Android config is parameterized', () => {
    const nextCfg = read('next.config.ts');
    assert.doesNotMatch(nextCfg, /ignoreBuildErrors:\s*true/);

    const rootEslint = read('eslint.config.mjs');
    assert.match(rootEslint, /\.open-next\/\*\*/);
    assert.match(rootEslint, /marketing-repo\/\*\*/);
    assert.match(rootEslint, /super-admin\/\*\*/);

    assert.equal(exists('super-admin/eslint.config.mjs'), true);
    const saEslint = read('super-admin/eslint.config.mjs');
    assert.match(saEslint, /\.open-next\/\*\*/);

    const gradle = read('waiter-android/app/build.gradle.kts');
    assert.match(gradle, /https:\/\/db\.dineinone\.com/);
    assert.match(gradle, /https:\/\/waiter\.dineinone\.com/);
    assert.doesNotMatch(gradle, /127\.0\.0\.1:3000/);
});

test('P2: migrations consolidated, build logs/debug scripts/dev stubs removed', () => {
    assert.equal(exists('migrations'), false);
    assert.equal(exists('supabase/migrations/20261009000000_multi_person_table_sessions.sql'), true);
    assert.equal(exists('supabase/migrations/20261009000001_single_active_session_enforcement.sql'), true);

    const androidFiles = fs.readdirSync(path.join(ROOT, 'waiter-android'));
    assert.equal(androidFiles.some((f) => /^build\d*\.log$/.test(f)), false);

    assert.equal(exists('super-admin/app/api/dev'), false);
    assert.equal(exists('app/super-admin'), false);
    assert.equal(exists('app/superadmin'), false);
    assert.equal(exists('debug-login.mjs'), false);
    assert.equal(exists('reset_pass.js'), false);

    const migrateScript = read('scripts/dual_db_migrate.mjs');
    assert.doesNotMatch(migrateScript, /72\.61\.250\.231/);
});

test('P4: marketing assets optimized, routes lazy-loaded, backup guarded, and dual-db mirrors safely', async () => {
    const appTsx = read('marketing-repo/src/App.tsx');
    assert.match(appTsx, /lazy\(/);
    assert.match(appTsx, /<Suspense/);

    const foodDir = path.join(ROOT, 'marketing-repo/src/assets/food');
    for (const file of fs.readdirSync(foodDir)) {
        const sizeBytes = fs.statSync(path.join(foodDir, file)).size;
        assert.ok(sizeBytes <= 250 * 1024, `${file} is ${sizeBytes} bytes (>250 KB)`);
    }

    const backupRoute = read('app/api/backup/cron/route.ts');
    assert.match(backupRoute, /isCloudflareWorkers\(\)/);
    assert.match(backupRoute, /status:\s*501/);

    const dualDb = read('lib/dual-supabase.ts');
    assert.match(dualDb, /runBackgroundMirror/);
    assert.match(dualDb, /waitUntil/);

    // Functional test of createDualSupabaseClient: reads hit primary only, writes mirror to secondary
    const { createDualSupabaseClient } = await import('../lib/dual-supabase.ts');
    const calls: string[] = [];
    const makeMockClient = (label: string) => ({
        from: (table: string) => ({
            select: () => ({
                then(
                    onFulfilled?: (val: { data: unknown[]; error: null }) => unknown,
                    onRejected?: (err: unknown) => unknown
                ) {
                    calls.push(`${label}:select:${table}`);
                    return Promise.resolve({ data: [{ id: 1 }], error: null }).then(onFulfilled, onRejected);
                },
            }),
            insert: (row: unknown) => ({
                then(
                    onFulfilled?: (val: { data: unknown; error: null }) => unknown,
                    onRejected?: (err: unknown) => unknown
                ) {
                    calls.push(`${label}:insert:${table}:${JSON.stringify(row)}`);
                    return Promise.resolve({ data: row, error: null }).then(onFulfilled, onRejected);
                },
            }),
        }),
    });

    const dual = createDualSupabaseClient(makeMockClient('primary') as never, makeMockClient('secondary') as never);
    await dual.from('orders').select();
    assert.deepEqual(calls, ['primary:select:orders']);

    await dual.from('orders').insert({ id: 'o-1' } as never);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(calls.includes('primary:insert:orders:{"id":"o-1"}'), true);
    assert.equal(calls.includes('secondary:insert:orders:{"id":"o-1"}'), true);
});
