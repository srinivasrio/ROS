import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import argon2 from 'argon2';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmcsygpphwdubnanwjwz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
const BASE_URL = 'http://localhost:3000';

if (!SUPABASE_SERVICE_ROLE_KEY || !JWT_SECRET) {
    console.error('SUPABASE_SERVICE_ROLE_KEY and JWT_SECRET are required');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function extractTokenFromCookies(res) {
    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) return null;
    const match = setCookie.match(/dine_auth_token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

function base64UrlEncode(str) {
    return Buffer.from(str).toString('base64url');
}

async function runC3TokenConsistencyTests() {
    console.log('================================================================');
    console.log('🔒 C3 TEST SUITE: EMPLOYEE TOKEN CONSISTENCY & SIGNED JWT ENFORCEMENT');
    console.log('================================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`  ✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${message}`);
            failed++;
        }
    }

    const { verifyJwt, signJwt } = await import('../lib/jwt-utils.ts');

    const RESTAURANT_A = '202603180001';
    const RESTAURANT_B = '202609084623';
    const TEST_PIN = '4321';
    const TEST_MOBILE = '9777788881';
    const TEST_WAITER_ID = crypto.randomUUID();
    const TEST_CHEF_ID = crypto.randomUUID();

    try {
        const hashedPin = await argon2.hash(TEST_PIN, { type: argon2.argon2id });

        // Seed test waiter in Restaurant A
        await supabase.from('employees').insert({
            id: TEST_WAITER_ID,
            employee_id: 'WAITER_C3_' + Date.now(),
            name: 'C3 Test Waiter',
            mobile: TEST_MOBILE,
            pin: hashedPin,
            role: 'waiter',
            restaurant_id: RESTAURANT_A,
            status: 'active',
            approval_status: 'approved',
            session_version: 1,
            is_deleted: false
        });

        // Seed test chef in Restaurant A
        const CHEF_MOBILE = '9777788882';
        await supabase.from('employees').insert({
            id: TEST_CHEF_ID,
            employee_id: 'CHEF_C3_' + Date.now(),
            name: 'C3 Test Chef',
            mobile: CHEF_MOBILE,
            pin: hashedPin,
            role: 'chef',
            restaurant_id: RESTAURANT_A,
            status: 'active',
            approval_status: 'approved',
            session_version: 1,
            is_deleted: false
        });

        // -------------------------------------------------------------
        // PART 1: Waiter Login Flow & Token Return
        // -------------------------------------------------------------
        console.log('--- Part 1: Waiter Login (Mobile + PIN, No OTP) ---');
        const waiterRes = await fetch(`${BASE_URL}/api/auth/waiter/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobile: TEST_MOBILE, pin: TEST_PIN })
        });
        const waiterData = await waiterRes.json();

        assert(waiterRes.status === 200, `Waiter login succeeds with 200 OK (got ${waiterRes.status})`);
        assert(waiterData.success === true, 'Waiter login returns success: true');
        assert(!waiterData.otpRequired, 'No OTP challenge required for waiter login');
        assert(typeof waiterData.token === 'string' && waiterData.token.split('.').length === 3,
            'Waiter login returns cryptographically signed 3-part JWT in response JSON');

        const waiterCookieToken = extractTokenFromCookies(waiterRes);
        assert(Boolean(waiterCookieToken), 'Waiter login sets dine_auth_token cookie');
        assert(waiterData.token === waiterCookieToken, 'JSON token matches dine_auth_token cookie');

        const verifiedWaiter = await verifyJwt(waiterData.token);
        assert(verifiedWaiter && verifiedWaiter.userId === TEST_WAITER_ID, 'verifyJwt successfully verifies waiter token');
        assert(verifiedWaiter && verifiedWaiter.role === 'waiter', 'Waiter token role is "waiter"');

        // -------------------------------------------------------------
        // PART 2: Chef / KDS Login Flow & Token Return
        // -------------------------------------------------------------
        console.log('\n--- Part 2: Chef / KDS Login (Mobile + PIN, No OTP) ---');
        const kdsRes = await fetch(`${BASE_URL}/api/auth/kds/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobile: CHEF_MOBILE, pin: TEST_PIN })
        });
        const kdsData = await kdsRes.json();

        assert(kdsRes.status === 200, `KDS login succeeds with 200 OK (got ${kdsRes.status})`);
        assert(kdsData.success === true, 'KDS login returns success: true');
        assert(!kdsData.otpRequired, 'No OTP challenge required for KDS login');
        assert(typeof kdsData.token === 'string' && kdsData.token.split('.').length === 3,
            'KDS login returns cryptographically signed 3-part JWT in response JSON');

        const verifiedChef = await verifyJwt(kdsData.token);
        assert(verifiedChef && verifiedChef.userId === TEST_CHEF_ID, 'verifyJwt successfully verifies KDS token');

        // -------------------------------------------------------------
        // PART 3: Token Transport: Bearer vs x-dine-token
        // -------------------------------------------------------------
        console.log('\n--- Part 3: Token Transport (Authorization Bearer & x-dine-token) ---');

        // 3a. Authorization: Bearer <valid-token>
        const bearerRes = await fetch(`${BASE_URL}/api/waiter/status?restaurantId=${RESTAURANT_A}&waiterId=${TEST_WAITER_ID}`, {
            headers: { 'Authorization': `Bearer ${waiterData.token}` }
        });
        const bearerJson = await bearerRes.json();
        assert(bearerRes.status === 200, `API accepts Authorization: Bearer <signed-jwt> (status ${bearerRes.status})`);
        assert(bearerJson.success === true, 'Bearer auth response is success: true');

        // 3b. x-dine-token: <valid-token> (backward compatibility)
        const xDineRes = await fetch(`${BASE_URL}/api/waiter/status?restaurantId=${RESTAURANT_A}&waiterId=${TEST_WAITER_ID}`, {
            headers: { 'x-dine-token': waiterData.token }
        });
        const xDineJson = await xDineRes.json();
        assert(xDineRes.status === 200, `API accepts x-dine-token with signed JWT (status ${xDineRes.status})`);
        assert(xDineJson.success === true, 'x-dine-token auth response is success: true');

        // -------------------------------------------------------------
        // PART 4: Insecure & Base64 Token Rejection
        // -------------------------------------------------------------
        console.log('\n--- Part 4: Strict Rejection of Base64 / Unsigned / Tampered Tokens ---');

        // 4a. Base64 payload without signature (the old insecure pattern)
        const rawBase64Token = Buffer.from(JSON.stringify({
            userId: TEST_WAITER_ID,
            role: 'waiter',
            restaurantId: RESTAURANT_A
        })).toString('base64');

        const base64Verify = await verifyJwt(rawBase64Token);
        assert(base64Verify === null, 'verifyJwt strictly rejects raw Base64 token (returns null)');

        const base64Res = await fetch(`${BASE_URL}/api/waiter/status?restaurantId=${RESTAURANT_A}&waiterId=${TEST_WAITER_ID}`, {
            headers: { 'Authorization': `Bearer ${rawBase64Token}` }
        });
        assert(base64Res.status === 401, `API rejects Base64-only token with 401 Unauthorized (got ${base64Res.status})`);

        // 4b. Dummy Flutter token placeholder ('token_<id>')
        const dummyRes = await fetch(`${BASE_URL}/api/waiter/status?restaurantId=${RESTAURANT_A}&waiterId=${TEST_WAITER_ID}`, {
            headers: { 'Authorization': `Bearer token_${TEST_WAITER_ID}` }
        });
        assert(dummyRes.status === 401, `API rejects dummy placeholder "token_<id>" with 401 (got ${dummyRes.status})`);

        // 4c. Tampered token (modified payload)
        const parts = waiterData.token.split('.');
        const tamperedPayload = base64UrlEncode(JSON.stringify({
            ...JSON.parse(Buffer.from(parts[1], 'base64url').toString()),
            role: 'admin' // privilege escalation attempt
        }));
        const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

        const tamperedVerify = await verifyJwt(tamperedToken);
        assert(tamperedVerify === null, 'verifyJwt strictly rejects tampered payload token');

        const tamperedRes = await fetch(`${BASE_URL}/api/waiter/status?restaurantId=${RESTAURANT_A}&waiterId=${TEST_WAITER_ID}`, {
            headers: { 'Authorization': `Bearer ${tamperedToken}` }
        });
        assert(tamperedRes.status === 401, `API rejects tampered token with 401 (got ${tamperedRes.status})`);

        // 4d. Forged token signed with wrong secret
        const forgedKey = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode('an-attacker-crafted-secret-key-32-chars-long'),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        const forgedSig = base64UrlEncode(Buffer.from(await crypto.subtle.sign(
            'HMAC',
            forgedKey,
            new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
        )));
        const forgedToken = `${parts[0]}.${parts[1]}.${forgedSig}`;

        const forgedVerify = await verifyJwt(forgedToken);
        assert(forgedVerify === null, 'verifyJwt strictly rejects token forged with unauthorized secret');

        const forgedRes = await fetch(`${BASE_URL}/api/waiter/status?restaurantId=${RESTAURANT_A}&waiterId=${TEST_WAITER_ID}`, {
            headers: { 'Authorization': `Bearer ${forgedToken}` }
        });
        assert(forgedRes.status === 401, `API rejects forged secret token with 401 (got ${forgedRes.status})`);

        // 4e. Algorithm "none" attack
        const noneHeader = base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }));
        const noneToken = `${noneHeader}.${parts[1]}.`;
        const noneVerify = await verifyJwt(noneToken);
        assert(noneVerify === null, 'verifyJwt strictly rejects alg "none" unsigned token');

        const noneRes = await fetch(`${BASE_URL}/api/waiter/status?restaurantId=${RESTAURANT_A}&waiterId=${TEST_WAITER_ID}`, {
            headers: { 'Authorization': `Bearer ${noneToken}` }
        });
        assert(noneRes.status === 401, `API rejects alg "none" token with 401 (got ${noneRes.status})`);

        // 4f. Expired token
        const expiredToken = await signJwt({
            userId: TEST_WAITER_ID,
            role: 'waiter'
        }, -3600); // 1 hour ago
        const expiredVerify = await verifyJwt(expiredToken);
        assert(expiredVerify === null, 'verifyJwt strictly rejects expired JWT');

        const expiredRes = await fetch(`${BASE_URL}/api/waiter/status?restaurantId=${RESTAURANT_A}&waiterId=${TEST_WAITER_ID}`, {
            headers: { 'Authorization': `Bearer ${expiredToken}` }
        });
        assert(expiredRes.status === 401, `API rejects expired token with 401 (got ${expiredRes.status})`);

        // -------------------------------------------------------------
        // PART 5: Tenant Isolation Enforcement
        // -------------------------------------------------------------
        console.log('\n--- Part 5: Tenant Isolation & Role Authorization ---');

        // 5a. Waiter from Restaurant A accessing Restaurant B
        const crossTenantRes = await fetch(`${BASE_URL}/api/waiter/status?restaurantId=${RESTAURANT_B}&waiterId=${TEST_WAITER_ID}`, {
            headers: { 'Authorization': `Bearer ${waiterData.token}` }
        });
        assert(crossTenantRes.status === 403,
            `Cross-tenant access blocked: Waiter from Restaurant A cannot access Restaurant B (got ${crossTenantRes.status})`);

        // 5b. Waiter attempting to access Restaurant Admin resources (/api/owner/reports)
        const adminAccessRes = await fetch(`${BASE_URL}/api/owner/reports?restaurantId=${RESTAURANT_A}`, {
            headers: { 'Authorization': `Bearer ${waiterData.token}` }
        });
        assert(adminAccessRes.status === 403 || adminAccessRes.status === 401,
            `Role check enforced: Waiter token cannot access admin endpoint (got ${adminAccessRes.status})`);

        // 5c. Chef attempting to access Waiter floor resources (/api/waiter/status)
        const chefToWaiterRes = await fetch(`${BASE_URL}/api/waiter/status?restaurantId=${RESTAURANT_A}&waiterId=${TEST_CHEF_ID}`, {
            headers: { 'Authorization': `Bearer ${kdsData.token}` }
        });
        assert(chefToWaiterRes.status === 403,
            `Role check enforced: Chef/KDS token cannot access waiter floor resources (got ${chefToWaiterRes.status})`);

        // -------------------------------------------------------------
        // PART 6: Legacy Verify-OTP Endpoint produces Signed HS256 JWT
        // -------------------------------------------------------------
        console.log('\n--- Part 6: Legacy Verify-OTP Safe Migration ---');

        const otpRes = await fetch(`${BASE_URL}/api/auth/waiter/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobile: TEST_MOBILE, otp: '123456' })
        });
        const otpData = await otpRes.json();

        assert(otpRes.status === 200, `verify-otp succeeds with 200 OK (got ${otpRes.status})`);
        assert(typeof otpData.token === 'string' && otpData.token.split('.').length === 3,
            'verify-otp now returns a signed HS256 JWT (not a raw Base64 string)');

        const otpTokenVerify = await verifyJwt(otpData.token);
        assert(otpTokenVerify && otpTokenVerify.userId === TEST_WAITER_ID,
            'Token returned by verify-otp successfully verifies with server verifyJwt');

        const otpBearerRes = await fetch(`${BASE_URL}/api/waiter/status?restaurantId=${RESTAURANT_A}&waiterId=${TEST_WAITER_ID}`, {
            headers: { 'Authorization': `Bearer ${otpData.token}` }
        });
        assert(otpBearerRes.status === 200,
            `Token returned by verify-otp is accepted as a valid session (got ${otpBearerRes.status})`);

    } catch (err) {
        console.error('Test execution error:', err);
        failed++;
    } finally {
        // Cleanup test employees and sessions
        console.log('\n--- Cleaning up temporary test records ---');
        await supabase.from('dine_sessions').delete().in('user_id', [TEST_WAITER_ID, TEST_CHEF_ID]);
        await supabase.from('employees').delete().in('id', [TEST_WAITER_ID, TEST_CHEF_ID]);
        console.log('Cleanup finished.\n');
    }

    console.log('================================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED / ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runC3TokenConsistencyTests();
