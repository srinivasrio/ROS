import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmcsygpphwdubnanwjwz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
if (!SUPABASE_SERVICE_ROLE_KEY || !JWT_SECRET) throw new Error('SUPABASE_SERVICE_ROLE_KEY and JWT_SECRET are required');
const BASE_URL = 'http://localhost:3000';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

async function runTests() {
    console.log('================================================================');
    console.log('🛡️  URL TAMPERING & ZERO TRUST SECURITY VERIFICATION SUITE');
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

    const RESTAURANT_A = '202609084623';
    const RESTAURANT_B = '202603180001';
    const TEST_WAITER_MOBILE = '9997771111';
    const TEST_WAITER_EMPID = 'DIO4623777';
    const OTHER_WAITER_MOBILE = '9888888888';
    const OTHER_EMPID = 'DIO4623999';

    let waiterToken = null;
    let waiterSessionId = null;
    let waiterUserId = null;

    let adminToken = null;
    let adminSessionId = null;
    const adminUserId = '672f02e1-4a62-4fa0-8e30-3279c1e0323e';

    let pendingToken = null;
    let pendingSessionId = null;
    let pendingUserId = null;

    try {
        console.log('--- Step 0: Test Environment Setup ---');
        // Clean up any stale test employee
        await supabase.from('employees').delete().eq('mobile', TEST_WAITER_MOBILE);

        // 1. Create Active Waiter
        waiterUserId = crypto.randomUUID();
        waiterSessionId = crypto.randomUUID();
        await supabase.from('employees').insert({
            id: waiterUserId,
            employee_id: TEST_WAITER_EMPID,
            restaurant_id: RESTAURANT_A,
            name: 'Active Waiter Alpha',
            mobile: TEST_WAITER_MOBILE,
            role: 'waiter',
            status: 'active',
            approval_status: 'approved',
            session_version: 1,
            is_online: false,
            is_deleted: false
        });

        waiterToken = await signJwt({
            sessionId: waiterSessionId,
            userId: waiterUserId,
            employee_id: TEST_WAITER_EMPID,
            name: 'Active Waiter Alpha',
            role: 'waiter',
            sessionVersion: 1,
            mobile: TEST_WAITER_MOBILE,
            restaurantId: RESTAURANT_A,
            restaurant_id: RESTAURANT_A
        });

        const waiterHash = crypto.createHash('sha256').update(waiterToken).digest('hex');
        await supabase.from('dine_sessions').insert({
            id: waiterSessionId,
            user_id: waiterUserId,
            token_hash: waiterHash,
            device_info: 'E2E-Tamper-Test',
            ip_address: '127.0.0.1',
            is_active: true
        });

        // 2. Create Active Admin session
        const { data: currentAdminEmp } = await supabase.from('employees').select('session_version').eq('id', adminUserId).maybeSingle();
        const adminVer = currentAdminEmp?.session_version || 1;
        adminSessionId = crypto.randomUUID();
        adminToken = await signJwt({
            sessionId: adminSessionId,
            userId: adminUserId,
            name: 'Vikram Singhania',
            role: 'restaurant_admin',
            sessionVersion: adminVer,
            mobile: '9876543219',
            restaurantId: RESTAURANT_A,
            restaurant_id: RESTAURANT_A
        });
        const adminHash = crypto.createHash('sha256').update(adminToken).digest('hex');
        await supabase.from('dine_sessions').insert({
            id: adminSessionId,
            user_id: adminUserId,
            token_hash: adminHash,
            device_info: 'E2E-Tamper-Test',
            ip_address: '127.0.0.1',
            is_active: true
        });

        // 3. Create Pending (Unactivated) Employee
        pendingUserId = crypto.randomUUID();
        pendingSessionId = crypto.randomUUID();
        await supabase.from('employees').insert({
            id: pendingUserId,
            employee_id: 'DIO4623555',
            restaurant_id: RESTAURANT_A,
            name: 'Pending Staff Beta',
            mobile: '9995554444',
            role: 'waiter',
            status: 'pending_activation',
            approval_status: 'pending_verification',
            session_version: 1,
            is_online: false,
            is_deleted: false
        });

        pendingToken = await signJwt({
            sessionId: pendingSessionId,
            userId: pendingUserId,
            name: 'Pending Staff Beta',
            role: 'waiter',
            sessionVersion: 1,
            mobile: '9995554444',
            restaurantId: RESTAURANT_A,
            restaurant_id: RESTAURANT_A
        });
        const pendingHash = crypto.createHash('sha256').update(pendingToken).digest('hex');
        await supabase.from('dine_sessions').insert({
            id: pendingSessionId,
            user_id: pendingUserId,
            token_hash: pendingHash,
            device_info: 'E2E-Tamper-Test',
            ip_address: '127.0.0.1',
            is_active: true
        });

        console.log('  Active Waiter, Active Admin, and Pending Staff configured.\n');

        // =========================================================================
        // TEST 1: Valid authenticated URL opens normally
        // =========================================================================
        console.log('--- Test 1: Valid Authenticated URL Opens Normally ---');
        const validWaiterRes = await fetch(`${BASE_URL}/${RESTAURANT_A}/waiter/${TEST_WAITER_MOBILE}/dashboard`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token=${waiterToken}` }
        });
        assert(validWaiterRes.status === 200, `Valid waiter URL opens normally with 200 (got: ${validWaiterRes.status})`);

        const validAdminRes = await fetch(`${BASE_URL}/${RESTAURANT_A}/admin/dashboard`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token=${adminToken}` }
        });
        assert(validAdminRes.status === 200, `Valid admin URL opens normally with 200 (got: ${validAdminRes.status})`);
        console.log('');

        // =========================================================================
        // TEST 2: Changed mobile number in URL -> Access Denied with Wrong waiter credentials
        // =========================================================================
        console.log('--- Test 2: Changed Mobile Number in URL (Anti-Tampering) ---');
        const tamperedMobileRes = await fetch(`${BASE_URL}/${RESTAURANT_A}/waiter/${OTHER_WAITER_MOBILE}/dashboard`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token=${waiterToken}` }
        });
        const tamperedMobileLoc = tamperedMobileRes.headers.get('location') || '';
        assert(tamperedMobileRes.status === 307 || tamperedMobileRes.status === 308 || tamperedMobileRes.status === 302, `Tampered mobile number request rejected with redirect (status: ${tamperedMobileRes.status})`);
        assert(tamperedMobileLoc.includes('/access-denied'), `Redirected to security error page: ${tamperedMobileLoc}`);
        assert(tamperedMobileLoc.includes('reason=wrong_waiter_credentials'), `Specific security reason is "wrong_waiter_credentials"`);
        assert(!tamperedMobileLoc.includes(`/${TEST_WAITER_MOBILE}/`), `Does NOT restore the original URL or silently redirect back`);
        console.log('');

        // =========================================================================
        // TEST 3: Changed employee ID in URL -> Access Denied
        // =========================================================================
        console.log('--- Test 3: Changed Employee ID in URL (Anti-Tampering) ---');
        const tamperedEmpIdRes = await fetch(`${BASE_URL}/${RESTAURANT_A}/waiter/${OTHER_EMPID}/dashboard`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token=${waiterToken}` }
        });
        const tamperedEmpIdLoc = tamperedEmpIdRes.headers.get('location') || '';
        assert(tamperedEmpIdRes.status === 307 || tamperedEmpIdRes.status === 308 || tamperedEmpIdRes.status === 302, `Tampered employee ID request rejected with redirect (status: ${tamperedEmpIdRes.status})`);
        assert(tamperedEmpIdLoc.includes('/access-denied'), `Redirected to security error page`);
        assert(tamperedEmpIdLoc.includes('reason=wrong_waiter_credentials'), `Access denied with wrong credentials/identity reason`);
        console.log('');

        // =========================================================================
        // TEST 4: Changed restaurant ID in URL (Tenant Isolation)
        // =========================================================================
        console.log('--- Test 4: Changed Restaurant ID in URL (Tenant Boundary Protection) ---');
        const tamperedRestWaiterRes = await fetch(`${BASE_URL}/${RESTAURANT_B}/waiter/${TEST_WAITER_MOBILE}/dashboard`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token=${waiterToken}` }
        });
        const tamperedRestWaiterLoc = tamperedRestWaiterRes.headers.get('location') || '';
        assert(tamperedRestWaiterRes.status === 307 || tamperedRestWaiterRes.status === 308 || tamperedRestWaiterRes.status === 302, `Tampered restaurant ID for waiter rejected with redirect`);
        assert(tamperedRestWaiterLoc.includes('/access-denied') && tamperedRestWaiterLoc.includes('reason=invalid_restaurant'), `Redirected to /access-denied?reason=invalid_restaurant: ${tamperedRestWaiterLoc}`);

        const tamperedRestAdminRes = await fetch(`${BASE_URL}/${RESTAURANT_B}/admin/dashboard`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token=${adminToken}` }
        });
        const tamperedRestAdminLoc = tamperedRestAdminRes.headers.get('location') || '';
        assert(tamperedRestAdminLoc.includes('/access-denied') && tamperedRestAdminLoc.includes('reason=invalid_restaurant'), `Tampered restaurant ID for admin blocked with reason=invalid_restaurant`);
        console.log('');

        // =========================================================================
        // TEST 5: Changed panel or role URL
        // =========================================================================
        console.log('--- Test 5: Changed Panel or Role URL (Role Authorization) ---');
        // Waiter trying to access Admin panel
        const waiterAsAdminRes = await fetch(`${BASE_URL}/${RESTAURANT_A}/admin/dashboard`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token=${waiterToken}` }
        });
        const waiterAsAdminLoc = waiterAsAdminRes.headers.get('location') || '';
        assert(waiterAsAdminLoc.includes('/access-denied') && waiterAsAdminLoc.includes('reason=unauthorized_panel'), `Waiter accessing Admin panel blocked: /access-denied?reason=unauthorized_panel`);

        // Waiter trying to access KDS (Kitchen) panel
        const waiterAsKdsRes = await fetch(`${BASE_URL}/${RESTAURANT_A}/kds`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token=${waiterToken}` }
        });
        const waiterAsKdsLoc = waiterAsKdsRes.headers.get('location') || '';
        assert(waiterAsKdsLoc.includes('/access-denied') && waiterAsKdsLoc.includes('reason=unauthorized_panel'), `Waiter accessing KDS panel blocked: /access-denied?reason=unauthorized_panel`);

        // Waiter trying to access Supervisor panel
        const waiterAsSuperRes = await fetch(`${BASE_URL}/${RESTAURANT_A}/supervisor`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token=${waiterToken}` }
        });
        const waiterAsSuperLoc = waiterAsSuperRes.headers.get('location') || '';
        assert(waiterAsSuperLoc.includes('/access-denied') && waiterAsSuperLoc.includes('reason=unauthorized_panel'), `Waiter accessing Supervisor panel blocked: /access-denied?reason=unauthorized_panel`);
        console.log('');

        // =========================================================================
        // TEST 6: Unauthenticated user accessing staff panels
        // =========================================================================
        console.log('--- Test 6: Unauthenticated User Access to Staff Panels ---');
        const unauthAdminRes = await fetch(`${BASE_URL}/${RESTAURANT_A}/admin/dashboard`, { redirect: 'manual' });
        const unauthAdminLoc = unauthAdminRes.headers.get('location') || '';
        assert(unauthAdminLoc.includes('/login'), `Unauthenticated admin access redirected to admin login: ${unauthAdminLoc}`);

        const unauthWaiterRes = await fetch(`${BASE_URL}/${RESTAURANT_A}/waiter/${TEST_WAITER_MOBILE}/dashboard`, { redirect: 'manual' });
        const unauthWaiterLoc = unauthWaiterRes.headers.get('location') || '';
        assert(unauthWaiterLoc.includes(`/${RESTAURANT_A}/waiter/login`), `Unauthenticated waiter access redirected to waiter login: ${unauthWaiterLoc}`);

        const unauthKdsRes = await fetch(`${BASE_URL}/${RESTAURANT_A}/kds`, { redirect: 'manual' });
        const unauthKdsLoc = unauthKdsRes.headers.get('location') || '';
        assert(unauthKdsLoc.includes('/login'), `Unauthenticated KDS access redirected to login: ${unauthKdsLoc}`);
        console.log('');

        // =========================================================================
        // TEST 6b: Expired / Ended Session Access to Staff Panels
        // =========================================================================
        console.log('--- Test 6b: Expired Session Access to Staff Panels ---');
        const expiredAdminToken = await signJwt({
            sessionId: crypto.randomUUID(),
            userId: adminUserId,
            name: 'Vikram Singhania',
            role: 'restaurant_admin',
            sessionVersion: adminVer,
            restaurantId: RESTAURANT_A,
            restaurant_id: RESTAURANT_A
        }, -3600);

        const expiredAdminRes = await fetch(`${BASE_URL}/${RESTAURANT_A}/admin/dashboard`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token=${expiredAdminToken}` }
        });
        const expiredAdminLoc = expiredAdminRes.headers.get('location') || '';
        assert(expiredAdminLoc.includes('/login') && expiredAdminLoc.includes('error=session_expired'), `Expired admin session redirected to admin login with error=session_expired: ${expiredAdminLoc}`);

        const expiredWaiterToken = await signJwt({
            sessionId: crypto.randomUUID(),
            userId: waiterUserId,
            name: 'Active Waiter Alpha',
            role: 'waiter',
            sessionVersion: 1,
            mobile: TEST_WAITER_MOBILE,
            restaurantId: RESTAURANT_A,
            restaurant_id: RESTAURANT_A
        }, -3600);

        const expiredWaiterRes = await fetch(`${BASE_URL}/${RESTAURANT_A}/waiter/${TEST_WAITER_MOBILE}/dashboard`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token=${expiredWaiterToken}` }
        });
        const expiredWaiterLoc = expiredWaiterRes.headers.get('location') || '';
        assert(expiredWaiterLoc.includes(`/${RESTAURANT_A}/waiter/login`) && expiredWaiterLoc.includes('error=session_expired'), `Expired waiter session redirected to waiter login with error=session_expired: ${expiredWaiterLoc}`);

        const unauthAccessDeniedRes = await fetch(`${BASE_URL}/access-denied?reason=unauthenticated`, { redirect: 'manual' });
        const unauthAccessDeniedLoc = unauthAccessDeniedRes.headers.get('location') || '';
        assert(unauthAccessDeniedLoc.includes('/login'), `/access-denied?reason=unauthenticated safely redirects to /login: ${unauthAccessDeniedLoc}`);
        console.log('');

        // =========================================================================
        // TEST 7: Inactive or Pending Employee Access
        // =========================================================================
        console.log('--- Test 7: Inactive / Pending Employee Access ---');
        const pendingRes = await fetch(`${BASE_URL}/${RESTAURANT_A}/waiter/9995554444/dashboard`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token=${pendingToken}` }
        });
        const pendingLoc = pendingRes.headers.get('location') || '';
        assert(pendingLoc.includes('/access-denied') && pendingLoc.includes('reason=account_inactive'), `Pending employee blocked with /access-denied?reason=account_inactive (got: ${pendingLoc})`);
        console.log('');

        // =========================================================================
        // TEST 8: Customer mobile number cannot access staff panels
        // =========================================================================
        console.log('--- Test 8: Customer Mobile Number Cannot Access Staff Panels ---');
        const customerMobile = '9848022338';
        const customerRes = await fetch(`${BASE_URL}/${RESTAURANT_A}/waiter/${customerMobile}/dashboard`, {
            redirect: 'manual'
        });
        const customerLoc = customerRes.headers.get('location') || '';
        assert(customerLoc.includes(`/${RESTAURANT_A}/waiter/login`), `Customer accessing waiter panel redirected to waiter login: ${customerLoc}`);
        console.log('');

        // =========================================================================
        // TEST 9: Protected APIs with Tampered URL Search Parameters
        // =========================================================================
        console.log('--- Test 9: Protected APIs with Tampered URL Parameters ---');
        // Tampered mobile search param on API
        const apiTamperMobile = await fetch(`${BASE_URL}/api/waiter/status?mobile=${OTHER_WAITER_MOBILE}`, {
            headers: { 'Cookie': `dine_auth_token=${waiterToken}` }
        });
        const apiTamperMobileData = await apiTamperMobile.json();
        assert(apiTamperMobile.status === 403, `API call with tampered mobile query rejected with 403 (got: ${apiTamperMobile.status})`);
        assert(apiTamperMobileData.error?.includes('Wrong waiter credentials') || apiTamperMobileData.error?.includes('Invalid staff identity'), `Error message confirms identity rejection: "${apiTamperMobileData.error}"`);

        // Tampered employee ID search param on API
        const apiTamperEmpId = await fetch(`${BASE_URL}/api/waiter/status?employeeId=${OTHER_EMPID}`, {
            headers: { 'Cookie': `dine_auth_token=${waiterToken}` }
        });
        const apiTamperEmpIdData = await apiTamperEmpId.json();
        assert(apiTamperEmpId.status === 403, `API call with tampered employeeId rejected with 403 (got: ${apiTamperEmpId.status})`);
        assert(apiTamperEmpIdData.error?.includes('Invalid staff identity'), `Error message confirms: "${apiTamperEmpIdData.error}"`);

        // Tampered restaurantId search param on API
        const apiTamperRest = await fetch(`${BASE_URL}/api/waiter/status?restaurantId=${RESTAURANT_B}`, {
            headers: { 'Cookie': `dine_auth_token=${waiterToken}` }
        });
        const apiTamperRestData = await apiTamperRest.json();
        assert(apiTamperRest.status === 403, `API call with tampered restaurantId rejected with 403 (got: ${apiTamperRest.status})`);
        assert(apiTamperRestData.error?.includes('Invalid restaurant identity'), `Error message confirms: "${apiTamperRestData.error}"`);

        // Waiter calling Admin API endpoint
        const apiWaiterAsAdmin = await fetch(`${BASE_URL}/api/admin/some-action`, {
            headers: { 'Cookie': `dine_auth_token=${waiterToken}` }
        });
        const apiWaiterAsAdminData = await apiWaiterAsAdmin.json();
        assert(apiWaiterAsAdmin.status === 403, `Waiter calling /api/admin/* rejected with 403`);
        assert(apiWaiterAsAdminData.error?.includes('Unauthorized panel'), `Error message confirms: "${apiWaiterAsAdminData.error}"`);
        console.log('');

        // =========================================================================
        // TEST 10: Access Denied Security Page Renders with No Information Leak
        // =========================================================================
        console.log('--- Test 10: Access Denied Security Page Rendering & Non-Disclosure ---');
        const errorPageRes = await fetch(`${BASE_URL}/access-denied?reason=wrong_waiter_credentials`);
        const errorPageHtml = await errorPageRes.text();
        assert(errorPageRes.status === 200, `Access Denied page renders with 200`);
        assert(errorPageHtml.includes('Wrong Waiter Credentials'), `Contains correct security headline "Wrong Waiter Credentials"`);
        assert(errorPageHtml.includes('URL parameter modification is strictly prohibited'), `Contains security warning`);
        assert(!errorPageHtml.includes(SUPABASE_SERVICE_ROLE_KEY), `Does NOT disclose any service keys`);
        assert(!errorPageHtml.includes(JWT_SECRET), `Does NOT disclose JWT secret`);
        console.log('');

    } finally {
        console.log('--- Cleanup Test Data ---');
        if (waiterSessionId) await supabase.from('dine_sessions').delete().eq('id', waiterSessionId);
        if (adminSessionId) await supabase.from('dine_sessions').delete().eq('id', adminSessionId);
        if (pendingSessionId) await supabase.from('dine_sessions').delete().eq('id', pendingSessionId);
        if (waiterUserId) await supabase.from('employees').delete().eq('id', waiterUserId);
        if (pendingUserId) await supabase.from('employees').delete().eq('id', pendingUserId);
        console.log('  Cleaned up all temporary test sessions and employee records.\n');
    }

    console.log('================================================================');
    console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
