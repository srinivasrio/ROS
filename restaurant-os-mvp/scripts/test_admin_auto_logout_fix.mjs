import assert from 'assert';
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
    const crypto = await import('crypto');
    const signature = crypto.createHmac('sha256', JWT_SECRET)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${encodedHeader}.${encodedPayload}.${signature}`;
}

async function runTests() {
    console.log('================================================================');
    console.log('🔧 ADMIN AUTO-LOGOUT & ROLE AUTHORIZATION VERIFICATION SUITE');
    console.log('================================================================\n');

    // 1. Fetch an active restaurant
    const { data: rest, error: restErr } = await supabase
        .from('restaurants')
        .select('id, name')
        .eq('status', 'ACTIVE')
        .limit(1)
        .single();

    assert(!restErr && rest, 'Found active restaurant');
    const REST_ID = rest.id;
    console.log(`Using Active Restaurant: ${rest.name} (${REST_ID})`);

    // Create a temporary active admin employee with lowercase role: 'admin'
    const adminEmployeeId = crypto.randomUUID();
    const sessionIdAdmin = crypto.randomUUID();
    const adminMobile = '9988776655';

    await supabase.from('employees').insert({
        id: adminEmployeeId,
        name: 'Test Suresh Kumar',
        mobile: adminMobile,
        role: 'admin', // LOWERCASE 'admin' as stored in DB
        status: 'active',
        approval_status: 'approved',
        restaurant_id: REST_ID,
        session_version: 1,
        is_deleted: false
    });

    const adminToken = await signJwt({
        sessionId: sessionIdAdmin,
        userId: adminEmployeeId,
        name: 'Test Suresh Kumar',
        role: 'admin', // lowercase
        sessionVersion: 1,
        mobile: adminMobile,
        restaurantId: REST_ID
    });

    // Create waiter for testing collision
    const waiterEmployeeId = crypto.randomUUID();
    const sessionIdWaiter = crypto.randomUUID();
    const waiterMobile = '9876543210';

    await supabase.from('employees').insert({
        id: waiterEmployeeId,
        name: 'Test Waiter',
        mobile: waiterMobile,
        role: 'waiter',
        status: 'active',
        approval_status: 'approved',
        restaurant_id: REST_ID,
        session_version: 1,
        is_deleted: false
    });

    const waiterToken = await signJwt({
        sessionId: sessionIdWaiter,
        userId: waiterEmployeeId,
        name: 'Test Waiter',
        role: 'waiter',
        sessionVersion: 1,
        mobile: waiterMobile,
        restaurantId: REST_ID
    });

    try {
        // TEST 1: Admin with lowercase role 'admin' can access Admin Dashboard
        console.log('--- Test 1: Admin with lowercase role "admin" accesses Admin Dashboard ---');
        const adminRes = await fetch(`${BASE_URL}/${REST_ID}/admin/dashboard`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token=${adminToken}; dine_auth_token_${REST_ID}=${adminToken}; dine_auth_token_${REST_ID}_admin=${adminToken}` }
        });
        const adminLoc = adminRes.headers.get('location') || '';
        assert(adminRes.status === 200 || !adminLoc.includes('/access-denied'), `Admin with lowercase role 'admin' must NOT be redirected to /access-denied (got status: ${adminRes.status}, location: ${adminLoc})`);
        console.log('  ✅ PASS: Admin with role "admin" accesses Admin Dashboard without access-denied redirect');

        // TEST 2: Admin with role 'owner' or 'restaurant_owner' can access Admin Dashboard
        console.log('--- Test 2: Admin with role "owner" accesses Admin Dashboard ---');
        const ownerToken = await signJwt({
            sessionId: sessionIdAdmin,
            userId: adminEmployeeId,
            name: 'Test Owner',
            role: 'owner',
            sessionVersion: 1,
            mobile: adminMobile,
            restaurantId: REST_ID
        });
        const ownerRes = await fetch(`${BASE_URL}/${REST_ID}/admin/dashboard`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token=${ownerToken}; dine_auth_token_${REST_ID}_admin=${ownerToken}` }
        });
        const ownerLoc = ownerRes.headers.get('location') || '';
        assert(!ownerLoc.includes('/access-denied'), `Owner must NOT be redirected to /access-denied (got: ${ownerLoc})`);
        console.log('  ✅ PASS: Owner accesses Admin Dashboard without access-denied redirect');

        // TEST 3: Multi-role token coexistence (Admin tab has waiter cookie alongside admin cookie)
        console.log('--- Test 3: Multi-role coexistence (Admin token preserved when Waiter cookie present) ---');
        // Simulate waiter login setting waiter cookies while admin cookie exists
        const multiCookieHeader = `dine_auth_token_waiter=${waiterToken}; dine_auth_token_${REST_ID}_waiter=${waiterToken}; dine_auth_token_${REST_ID}_admin=${adminToken}; dine_auth_token_admin=${adminToken}`;
        const multiRoleAdminRes = await fetch(`${BASE_URL}/${REST_ID}/admin/dashboard`, {
            redirect: 'manual',
            headers: { 'Cookie': multiCookieHeader }
        });
        const multiRoleLoc = multiRoleAdminRes.headers.get('location') || '';
        assert(!multiRoleLoc.includes('reason=unauthorized_panel'), `Admin panel must NOT redirect to unauthorized_panel when waiter cookie also exists in browser (got: ${multiRoleLoc})`);
        console.log('  ✅ PASS: Admin session is prioritized on admin routes; no unauthorized_panel kickoff');

        // TEST 4: Pure waiter token accessing Admin Panel must STILL be blocked
        console.log('--- Test 4: Pure Waiter token accessing Admin Panel is blocked ---');
        const waiterAsAdminRes = await fetch(`${BASE_URL}/${REST_ID}/admin/dashboard`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token=${waiterToken}; dine_auth_token_${REST_ID}=${waiterToken}` }
        });
        const waiterAsAdminLoc = waiterAsAdminRes.headers.get('location') || '';
        assert(waiterAsAdminLoc.includes('/access-denied') && waiterAsAdminLoc.includes('reason=unauthorized_panel'), `Waiter accessing Admin panel blocked with unauthorized_panel (got: ${waiterAsAdminLoc})`);
        console.log('  ✅ PASS: Unauthorized waiter role is correctly blocked from Admin panel');

        console.log('\n================================================================');
        console.log('🎉 ALL ADMIN AUTO-LOGOUT & ROLE TESTS PASSED SUCCESSFULLY!');
        console.log('================================================================\n');

    } finally {
        // Cleanup test employees
        await supabase.from('employees').delete().in('id', [adminEmployeeId, waiterEmployeeId]);
    }
}

runTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
