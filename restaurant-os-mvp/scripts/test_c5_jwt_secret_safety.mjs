import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmcsygpphwdubnanwjwz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REAL_JWT_SECRET = process.env.JWT_SECRET;
const BASE_URL = 'http://localhost:3000';
const OLD_FALLBACK_SECRET = 'dine-in-one-jwt-secret-key-at-least-32-chars-2026';

if (!SUPABASE_SERVICE_ROLE_KEY || !REAL_JWT_SECRET) {
    console.error('SUPABASE_SERVICE_ROLE_KEY and JWT_SECRET are required to run this test');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function base64UrlEncode(str) {
    const base64 = Buffer.from(str).toString('base64');
    return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function signWithKey(payload, secretKey, expiresInSeconds = 3600) {
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const jwtPayload = { ...payload, exp };
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(jwtPayload));

    const signature = crypto.createHmac('sha256', secretKey)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
}

async function runC5Tests() {
    console.log('================================================================');
    console.log('🔒 C5 TEST SUITE: JWT SECRET SAFETY & FAIL-CLOSED ENFORCEMENT');
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

    // -------------------------------------------------------------
    // PART 1: Unit Level Tests on lib/jwt-utils.ts behavior
    // -------------------------------------------------------------
    console.log('--- Part 1: JWT Secret Configuration & Fail-Closed Logic ---');

    // Dynamically import lib/jwt-utils
    const { signJwt, verifyJwt } = await import('../lib/jwt-utils.ts');

    // 1. JWT_SECRET configured -> JWT signing works
    const testPayload = { userId: 'test-user-123', role: 'admin', restaurantId: '202603180001' };
    let signedToken = null;
    try {
        signedToken = await signJwt(testPayload);
        assert(typeof signedToken === 'string' && signedToken.split('.').length === 3, 'JWT signing works with configured JWT_SECRET');
    } catch (err) {
        assert(false, `JWT signing failed with configured JWT_SECRET: ${err.message}`);
    }

    // 2. JWT_SECRET configured -> JWT verification works
    if (signedToken) {
        const decoded = await verifyJwt(signedToken);
        assert(decoded && decoded.userId === testPayload.userId && decoded.role === testPayload.role, 'JWT verification succeeds with verified payload matching input');
    }

    // 3. Tokens signed with old hardcoded fallback MUST be rejected
    const forgedWithOldSecret = await signWithKey(testPayload, OLD_FALLBACK_SECRET);
    const forgedResult = await verifyJwt(forgedWithOldSecret);
    assert(forgedResult === null, 'Token signed with old fallback secret is strictly rejected (returns null)');

    // 4. Test missing and empty JWT_SECRET fail-closed behavior
    const originalSecret = process.env.JWT_SECRET;
    try {
        // Test missing JWT_SECRET
        delete process.env.JWT_SECRET;
        let missingThrew = false;
        try {
            await signJwt(testPayload);
        } catch (err) {
            missingThrew = true;
            assert(err.message.includes('JWT_SECRET is required'), `Missing JWT_SECRET fails closed with configuration error: "${err.message}"`);
        }
        assert(missingThrew, 'signJwt threw error when JWT_SECRET is undefined');

        let verifyThrewMissing = false;
        try {
            await verifyJwt(signedToken);
        } catch (err) {
            verifyThrewMissing = true;
            assert(err.message.includes('JWT_SECRET is required'), `verifyJwt fails closed with configuration error when JWT_SECRET is undefined`);
        }
        assert(verifyThrewMissing, 'verifyJwt threw error when JWT_SECRET is undefined');

        // Test empty/whitespace JWT_SECRET
        process.env.JWT_SECRET = '   ';
        let emptyThrew = false;
        try {
            await signJwt(testPayload);
        } catch (err) {
            emptyThrew = true;
            assert(err.message.includes('JWT_SECRET is required'), `Empty/whitespace JWT_SECRET fails closed: "${err.message}"`);
        }
        assert(emptyThrew, 'signJwt threw error when JWT_SECRET is whitespace');

        // Test short JWT_SECRET (< 32 chars)
        process.env.JWT_SECRET = 'too-short-secret';
        let shortThrew = false;
        try {
            await signJwt(testPayload);
        } catch (err) {
            shortThrew = true;
            assert(err.message.includes('at least 32 characters long'), `Short JWT_SECRET (<32 chars) fails closed: "${err.message}"`);
        }
        assert(shortThrew, 'signJwt threw error when JWT_SECRET is too short');

    } finally {
        // Restore real secret
        process.env.JWT_SECRET = originalSecret;
    }

    // -------------------------------------------------------------
    // PART 2: End-to-End API Authentication Tests
    // -------------------------------------------------------------
    console.log('\n--- Part 2: End-to-End API Authentication Compatibility ---');

    // 5. Test legitimate token authentication on protected endpoint
    const validAdminToken = await signJwt({
        userId: '24a6beb3-fd5b-4244-9972-880ceaba0523',
        role: 'owner',
        restaurantId: '202603180001',
        email: 'owner@example.com'
    });

    const resProtectedValid = await fetch(`${BASE_URL}/api/auth/complete-mfa-reset?userId=dummy-id`, {
        headers: { 'Authorization': `Bearer ${validAdminToken}` }
    });
    // Should get past auth (401) to either 404 (employee not found) or 403, NOT 401 unauthenticated
    assert(resProtectedValid.status !== 401, `Protected route accepts token signed with real JWT_SECRET (status: ${resProtectedValid.status} != 401)`);

    // 6. Test old fallback token on protected endpoint
    const forgedAdminToken = await signWithKey({
        userId: '24a6beb3-fd5b-4244-9972-880ceaba0523',
        role: 'owner',
        restaurantId: '202603180001',
        email: 'owner@example.com'
    }, OLD_FALLBACK_SECRET);

    const resProtectedForged = await fetch(`${BASE_URL}/api/auth/complete-mfa-reset?userId=dummy-id`, {
        headers: { 'Authorization': `Bearer ${forgedAdminToken}` }
    });
    assert(resProtectedForged.status === 401, `Protected route rejects token signed with old fallback secret with 401 Unauthorized (got ${resProtectedForged.status})`);

    // -------------------------------------------------------------
    // PART 3: Security & Leakage Verification
    // -------------------------------------------------------------
    console.log('\n--- Part 3: Security & Information Exposure Checks ---');

    // Verify JWT_SECRET is not in any response
    const resBody = await resProtectedForged.text();
    assert(!resBody.includes(REAL_JWT_SECRET), 'Real JWT_SECRET is never exposed in error response');
    assert(!resBody.includes(OLD_FALLBACK_SECRET), 'Fallback secret is never exposed in error response');

    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED / ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) process.exit(1);
}

runC5Tests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
