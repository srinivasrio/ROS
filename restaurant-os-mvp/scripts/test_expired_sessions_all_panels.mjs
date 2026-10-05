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

async function runTests() {
    console.log('================================================================');
    console.log('🔄 EXPIRED / INVALID SESSION HANDLING ACROSS ALL PANELS');
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

    // 1. Fetch an active restaurant
    const { data: rest, error: restErr } = await supabase
        .from('restaurants')
        .select('id, name')
        .eq('status', 'ACTIVE')
        .limit(1)
        .single();

    if (restErr || !rest) throw new Error('No active restaurant found in DB');
    const REST_ID = rest.id;
    console.log(`Using Active Restaurant: ${rest.name} (${REST_ID})\n`);

    // Create test employee for session testing
    const testAdminId = crypto.randomUUID();
    const testWaiterId = crypto.randomUUID();
    const testDeliveryId = crypto.randomUUID();
    const testChefId = crypto.randomUUID();

    try {
        await supabase.from('employees').insert([
            {
                id: testAdminId,
                name: 'Session Test Admin',
                mobile: '9111111111',
                role: 'admin',
                status: 'active',
                approval_status: 'approved',
                restaurant_id: REST_ID,
                session_version: 1,
                is_deleted: false
            },
            {
                id: testWaiterId,
                name: 'Session Test Waiter',
                mobile: '9222222222',
                role: 'waiter',
                status: 'active',
                approval_status: 'approved',
                restaurant_id: REST_ID,
                session_version: 1,
                is_deleted: false
            },
            {
                id: testDeliveryId,
                name: 'Session Test Delivery',
                mobile: '9333333333',
                role: 'delivery_boy',
                status: 'active',
                approval_status: 'approved',
                restaurant_id: REST_ID,
                session_version: 1,
                is_deleted: false
            },
            {
                id: testChefId,
                name: 'Session Test Chef',
                mobile: '9444444444',
                role: 'chef',
                status: 'active',
                approval_status: 'approved',
                restaurant_id: REST_ID,
                session_version: 1,
                is_deleted: false
            }
        ]);

        // =========================================================================
        // 1. ADMIN PANEL EXPIRED / REVOKED SESSIONS
        // =========================================================================
        console.log('--- 1. Admin Panel: Expired & Invalid Sessions ---');
        
        // 1a. Expired JWT timestamp
        const expiredAdminToken = await signJwt({
            userId: testAdminId,
            role: 'admin',
            mobile: '9111111111',
            restaurantId: REST_ID,
            sessionVersion: 1
        }, -3600); // 1 hour in the past

        const adminPageRes = await fetch(`${BASE_URL}/${REST_ID}/admin/dashboard`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token=${expiredAdminToken}; dine_auth_token_${REST_ID}_admin=${expiredAdminToken}` }
        });
        const adminPageLoc = adminPageRes.headers.get('location') || '';
        assert(adminPageRes.status === 307 || adminPageRes.status === 302, `Expired admin page request returns redirect (status: ${adminPageRes.status})`);
        assert(adminPageLoc.includes('/login/admin') && adminPageLoc.includes('error=session_expired'), `Expired admin redirected to /login/admin?error=session_expired (got: ${adminPageLoc})`);
        assert(!adminPageLoc.includes('/access-denied'), `Expired admin does NOT get sent to /access-denied`);
        
        // Check cookie clearing header
        const setCookieHeaders = adminPageRes.headers.get('set-cookie') || '';
        assert(setCookieHeaders.includes('Max-Age=0') || setCookieHeaders.includes('expires='), `Response contains Set-Cookie clearing headers for expired session`);

        // 1b. Expired API request
        const adminApiRes = await fetch(`${BASE_URL}/api/admin/overview?restaurantId=${REST_ID}`, {
            headers: { 'Cookie': `dine_auth_token=${expiredAdminToken}` }
        });
        assert(adminApiRes.status === 401, `Expired admin API call returns 401 (got: ${adminApiRes.status})`);
        const adminApiData = await adminApiRes.json();
        assert(adminApiData.code === 'SESSION_EXPIRED', `API returns code: 'SESSION_EXPIRED'`);
        assert(adminApiData.loginUrl && adminApiData.loginUrl.includes('/login/admin'), `API response returns panel-specific loginUrl: ${adminApiData.loginUrl}`);

        // 1c. Revoked session version (logged in on another device)
        const bumpedAdminToken = await signJwt({
            userId: testAdminId,
            role: 'admin',
            mobile: '9111111111',
            restaurantId: REST_ID,
            sessionVersion: 1 // token has version 1
        }, 3600);
        // Bump version in DB to 2
        await supabase.from('employees').update({ session_version: 2 }).eq('id', testAdminId);
        
        const revokedAdminRes = await fetch(`${BASE_URL}/${REST_ID}/admin/dashboard`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token=${bumpedAdminToken}; dine_auth_token_${REST_ID}_admin=${bumpedAdminToken}` }
        });
        const revokedAdminLoc = revokedAdminRes.headers.get('location') || '';
        assert(revokedAdminLoc.includes('/login/admin') && revokedAdminLoc.includes('error=session_expired'), `Revoked admin session redirected to /login/admin?error=session_expired (got: ${revokedAdminLoc})`);
        assert(!revokedAdminLoc.includes('/access-denied'), `Revoked session does NOT redirect to /access-denied`);
        console.log('');

        // =========================================================================
        // 2. WAITER PANEL EXPIRED / REVOKED SESSIONS
        // =========================================================================
        console.log('--- 2. Waiter Panel: Expired & Invalid Sessions ---');
        
        const expiredWaiterToken = await signJwt({
            userId: testWaiterId,
            role: 'waiter',
            mobile: '9222222222',
            restaurantId: REST_ID,
            sessionVersion: 1
        }, -3600);

        const waiterPageRes = await fetch(`${BASE_URL}/${REST_ID}/waiter/9222222222/dashboard`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token=${expiredWaiterToken}; dine_auth_token_${REST_ID}_waiter=${expiredWaiterToken}` }
        });
        const waiterPageLoc = waiterPageRes.headers.get('location') || '';
        assert(waiterPageLoc.includes(`/${REST_ID}/waiter/login`) && waiterPageLoc.includes('error=session_expired'), `Expired waiter redirected to waiter login (got: ${waiterPageLoc})`);
        assert(!waiterPageLoc.includes('/access-denied'), `Expired waiter does NOT get sent to /access-denied`);

        // Waiter API with expired token
        const waiterApiRes = await fetch(`${BASE_URL}/api/waiter/status?restaurantId=${REST_ID}&mobile=9222222222`, {
            headers: { 'Cookie': `dine_auth_token=${expiredWaiterToken}` }
        });
        assert(waiterApiRes.status === 401, `Expired waiter API returns 401 (got: ${waiterApiRes.status})`);
        const waiterApiData = await waiterApiRes.json();
        assert(waiterApiData.code === 'SESSION_EXPIRED', `Waiter API returns code: 'SESSION_EXPIRED'`);
        assert(waiterApiData.loginUrl && waiterApiData.loginUrl.includes('waiter/login'), `Waiter API response includes waiter login URL: ${waiterApiData.loginUrl}`);
        console.log('');

        // =========================================================================
        // 3. DELIVERY BOY PANEL EXPIRED / REVOKED SESSIONS
        // =========================================================================
        console.log('--- 3. Delivery Boy Panel: Expired & Invalid Sessions ---');
        
        const expiredDeliveryToken = await signJwt({
            userId: testDeliveryId,
            role: 'delivery_boy',
            mobile: '9333333333',
            restaurantId: REST_ID,
            sessionVersion: 1
        }, -3600);

        const deliveryPageRes = await fetch(`${BASE_URL}/${REST_ID}/delivery/9333333333/dashboard`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token=${expiredDeliveryToken}; dine_auth_token_${REST_ID}_delivery=${expiredDeliveryToken}` }
        });
        const deliveryPageLoc = deliveryPageRes.headers.get('location') || '';
        assert(deliveryPageLoc.includes(`/${REST_ID}/delivery/login`) && deliveryPageLoc.includes('error=session_expired'), `Expired delivery boy redirected to delivery login (got: ${deliveryPageLoc})`);
        assert(!deliveryPageLoc.includes('/access-denied'), `Expired delivery boy does NOT get sent to /access-denied`);

        // Delivery API with expired token
        const deliveryApiRes = await fetch(`${BASE_URL}/api/delivery/profile?deliveryBoyId=${testDeliveryId}`, {
            headers: { 'Cookie': `dine_auth_token=${expiredDeliveryToken}` }
        });
        assert(deliveryApiRes.status === 401, `Expired delivery API returns 401 (got: ${deliveryApiRes.status})`);
        const deliveryApiData = await deliveryApiRes.json();
        assert(deliveryApiData.code === 'SESSION_EXPIRED', `Delivery API returns code: 'SESSION_EXPIRED'`);
        console.log('');

        // =========================================================================
        // 4. CHEF / KDS PANEL EXPIRED / REVOKED SESSIONS
        // =========================================================================
        console.log('--- 4. Chef / KDS Panel: Expired & Invalid Sessions ---');
        
        const expiredChefToken = await signJwt({
            userId: testChefId,
            role: 'chef',
            mobile: '9444444444',
            restaurantId: REST_ID,
            sessionVersion: 1
        }, -3600);

        const kdsPageRes = await fetch(`${BASE_URL}/${REST_ID}/kds`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token=${expiredChefToken}` }
        });
        const kdsPageLoc = kdsPageRes.headers.get('location') || '';
        assert(kdsPageLoc.includes('/login/kds') && kdsPageLoc.includes('error=session_expired'), `Expired KDS session redirected to /login/kds?error=session_expired (got: ${kdsPageLoc})`);
        assert(!kdsPageLoc.includes('/access-denied'), `Expired KDS does NOT get sent to /access-denied`);

        const kdsApiRes = await fetch(`${BASE_URL}/api/kds/orders?restaurantId=${REST_ID}`, {
            headers: { 'Cookie': `dine_auth_token=${expiredChefToken}` }
        });
        assert(kdsApiRes.status === 401, `Expired KDS API returns 401 (got: ${kdsApiRes.status})`);
        console.log('');

        // =========================================================================
        // 5. OWNER PANEL EXPIRED SESSIONS
        // =========================================================================
        console.log('--- 5. Owner Panel: Expired & Invalid Sessions ---');
        
        const expiredOwnerToken = await signJwt({
            userId: crypto.randomUUID(),
            role: 'owner',
            mobile: '9555555555',
            sessionVersion: 1
        }, -3600);

        const ownerPageRes = await fetch(`${BASE_URL}/owner/dashboard`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token_owner=${expiredOwnerToken}; dine_auth_token=${expiredOwnerToken}` }
        });
        const ownerPageLoc = ownerPageRes.headers.get('location') || '';
        assert(ownerPageLoc.includes('/login/owner'), `Expired owner redirected to /login/owner (got: ${ownerPageLoc})`);
        assert(!ownerPageLoc.includes('/access-denied'), `Expired owner does NOT get sent to /access-denied`);
        console.log('');

        // =========================================================================
        // 6. EMPLOYEE / OTHER STAFF PANELS EXPIRED SESSIONS
        // =========================================================================
        console.log('--- 6. Employee / Other Staff Panels: Expired Sessions ---');
        
        const expiredStaffToken = await signJwt({
            userId: crypto.randomUUID(),
            role: 'staff',
            mobile: '9666666666',
            restaurantId: REST_ID,
            sessionVersion: 1
        }, -3600);

        const staffPageRes = await fetch(`${BASE_URL}/${REST_ID}/staff/9666666666/dashboard`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token=${expiredStaffToken}` }
        });
        const staffPageLoc = staffPageRes.headers.get('location') || '';
        assert(staffPageLoc.includes('/login/employee') && staffPageLoc.includes('error=session_expired'), `Expired staff session redirected to /login/employee?error=session_expired (got: ${staffPageLoc})`);
        assert(!staffPageLoc.includes('/access-denied'), `Expired staff does NOT get sent to /access-denied`);
        console.log('');

        // =========================================================================
        // 7. SOFT-DELETED EMPLOYEE SESSION
        // =========================================================================
        console.log('--- 7. Soft-Deleted Employee Session ---');
        const deletedStaffId = crypto.randomUUID();
        await supabase.from('employees').insert({
            id: deletedStaffId,
            name: 'Deleted Staff',
            mobile: '9777777777',
            role: 'waiter',
            status: 'active',
            approval_status: 'approved',
            restaurant_id: REST_ID,
            session_version: 1,
            is_deleted: true // Soft deleted!
        });

        const deletedToken = await signJwt({
            userId: deletedStaffId,
            role: 'waiter',
            mobile: '9777777777',
            restaurantId: REST_ID,
            sessionVersion: 1
        }, 3600);

        const deletedPageRes = await fetch(`${BASE_URL}/${REST_ID}/waiter/9777777777/dashboard`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token=${deletedToken}; dine_auth_token_${REST_ID}_waiter=${deletedToken}` }
        });
        const deletedPageLoc = deletedPageRes.headers.get('location') || '';
        assert(deletedPageLoc.includes('waiter/login') && deletedPageLoc.includes('error=session_expired'), `Deleted staff session redirected cleanly to waiter login with error=session_expired (got: ${deletedPageLoc})`);
        assert(!deletedPageLoc.includes('/access-denied'), `Deleted staff does NOT get sent to /access-denied`);

        await supabase.from('employees').delete().eq('id', deletedStaffId);
        console.log('');

    } finally {
        console.log('--- Cleanup Test Employees ---');
        await supabase.from('employees').delete().in('id', [testAdminId, testWaiterId, testDeliveryId, testChefId]);
        console.log('  Cleaned up all temporary test staff.\n');
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
