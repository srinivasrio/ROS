import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is required');

function base64UrlEncode(str) {
    const base64 = Buffer.from(str).toString('base64');
    return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function signJwt(payload, expiresInSeconds = 3600 * 8) {
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const jwtPayload = { ...payload, exp };
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(jwtPayload));
    const signature = crypto.createHmac('sha256', JWT_SECRET)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${encodedHeader}.${encodedPayload}.${signature}`;
}

async function runValidation() {
    console.log('================================================================');
    console.log('🧪 VALIDATION: SIMULTANEOUS ADMIN, WAITER & KDS PANELS SESSION');
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

    const { data: rest } = await supabase
        .from('restaurants')
        .select('id, name')
        .eq('status', 'ACTIVE')
        .limit(1)
        .single();

    if (!rest) throw new Error('No active restaurant found');
    const REST_ID = rest.id;
    console.log(`Testing with Restaurant: ${rest.name} (${REST_ID})\n`);

    const adminEmpId = crypto.randomUUID();
    const waiterEmpId = crypto.randomUUID();
    const kdsEmpId = crypto.randomUUID();

    try {
        await supabase.from('employees').insert([
            { id: adminEmpId, name: 'Admin Test', mobile: '9555555551', role: 'admin', status: 'active', approval_status: 'approved', restaurant_id: REST_ID, session_version: 1, is_deleted: false },
            { id: waiterEmpId, name: 'Waiter Test', mobile: '9555555552', role: 'waiter', status: 'active', approval_status: 'approved', restaurant_id: REST_ID, session_version: 1, is_deleted: false },
            { id: kdsEmpId, name: 'Chef Test', mobile: '9555555553', role: 'chef', status: 'active', approval_status: 'approved', restaurant_id: REST_ID, session_version: 1, is_deleted: false }
        ]);

        const adminToken = await signJwt({ userId: adminEmpId, role: 'admin', mobile: '9555555551', restaurantId: REST_ID, sessionVersion: 1 });
        const waiterToken = await signJwt({ userId: waiterEmpId, role: 'waiter', mobile: '9555555552', restaurantId: REST_ID, sessionVersion: 1 });
        const kdsToken = await signJwt({ userId: kdsEmpId, role: 'chef', mobile: '9555555553', restaurantId: REST_ID, sessionVersion: 1 });

        // Simulate a browser with cookies for Admin, Waiter, and KDS panels existing simultaneously
        const combinedCookie = [
            `dine_auth_token_${REST_ID}_admin=${adminToken}`,
            `dine_auth_token_admin=${adminToken}`,
            `dine_auth_token_${REST_ID}_waiter=${waiterToken}`,
            `dine_auth_token_waiter=${waiterToken}`,
            `dine_auth_token_${REST_ID}_kds=${kdsToken}`,
            `dine_auth_token_kds=${kdsToken}`
        ].join('; ');

        console.log('--- 1. Testing Scoped /api/auth/session with Simultaneous Cookies ---');
        
        // 1a. Test Admin session ping
        const adminRes = await fetch(`${BASE_URL}/api/auth/session?restaurantId=${REST_ID}&panel=admin`, {
            headers: { 'Cookie': combinedCookie }
        });
        assert(adminRes.status === 200, `Admin session query returns 200`);
        const adminData = await adminRes.json();
        assert(adminData.authenticated === true, `Admin session is authenticated with simultaneous cookies`);
        assert(adminData.user?.role === 'admin', `Admin session resolves role 'admin' (got: ${adminData.user?.role})`);

        // 1b. Test Waiter session ping
        const waiterRes = await fetch(`${BASE_URL}/api/auth/session?restaurantId=${REST_ID}&panel=waiter&staffMobile=9555555552`, {
            headers: { 'Cookie': combinedCookie }
        });
        assert(waiterRes.status === 200, `Waiter session query returns 200`);
        const waiterData = await waiterRes.json();
        assert(waiterData.authenticated === true, `Waiter session is authenticated with simultaneous cookies`);
        assert(waiterData.user?.role === 'waiter', `Waiter session resolves role 'waiter' (got: ${waiterData.user?.role})`);

        // 1c. Test KDS session ping
        const kdsRes = await fetch(`${BASE_URL}/api/auth/session?restaurantId=${REST_ID}&panel=kds`, {
            headers: { 'Cookie': combinedCookie }
        });
        assert(kdsRes.status === 200, `KDS session query returns 200`);
        const kdsData = await kdsRes.json();
        assert(kdsData.authenticated === true, `KDS session is authenticated with simultaneous cookies`);
        assert(kdsData.user?.role === 'chef', `KDS session resolves role 'chef' (got: ${kdsData.user?.role})`);

        console.log('\n--- 2. Testing Expired Token with Panel Scoping ---');
        const expiredAdminToken = await signJwt({ userId: adminEmpId, role: 'admin', mobile: '9555555551', restaurantId: REST_ID, sessionVersion: 1 }, -3600);
        const expiredCookie = [
            `dine_auth_token_${REST_ID}_admin=${expiredAdminToken}`,
            `dine_auth_token_admin=${expiredAdminToken}`,
            `dine_auth_token_${REST_ID}_waiter=${waiterToken}`,
            `dine_auth_token_waiter=${waiterToken}`
        ].join('; ');

        // Admin should fail authentication
        const expAdminRes = await fetch(`${BASE_URL}/api/auth/session?restaurantId=${REST_ID}&panel=admin`, {
            headers: { 'Cookie': expiredCookie }
        });
        const expAdminData = await expAdminRes.json();
        assert(expAdminData.authenticated === false, `Expired admin token correctly reports authenticated: false`);

        // But Waiter in another tab MUST still be authenticated!
        const stillWaiterRes = await fetch(`${BASE_URL}/api/auth/session?restaurantId=${REST_ID}&panel=waiter&staffMobile=9555555552`, {
            headers: { 'Cookie': expiredCookie }
        });
        const stillWaiterData = await stillWaiterRes.json();
        assert(stillWaiterData.authenticated === true, `Waiter session in other tab remains valid despite expired Admin tab`);

    } finally {
        await supabase.from('employees').delete().in('id', [adminEmpId, waiterEmpId, kdsEmpId]);
        console.log('\nCleaned up test employees.');
    }

    console.log('================================================================');
    console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');
    if (failed > 0) process.exit(1);
}

runValidation().catch(e => {
    console.error('Test error:', e);
    process.exit(1);
});
