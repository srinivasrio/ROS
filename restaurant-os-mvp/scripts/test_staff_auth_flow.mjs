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
    console.log('🚀 E2E VERIFICATION: RESTAURANT STAFF AUTH & ACTIVATION LIFECYCLE');
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

    const TEST_RESTAURANT_ID = '202609084623';
    const TEST_MOBILE = '9998881234';
    const TEST_EMAIL = 'testwaiter.authflow@example.com';
    const TEST_PASSWORD = 'P@ssw0rd2026!Secure';

    // Clean up any stale test employee from previous runs
    await supabase.from('employees').delete().eq('mobile', TEST_MOBILE);

    let adminToken = null;
    let adminSessionId = null;

    try {
        // Step 0: Set up Admin Session for Vikram Singhania
        console.log('--- Step 0: Generate Active Admin Session ---');
        const adminUserId = '672f02e1-4a62-4fa0-8e30-3279c1e0323e';
        adminSessionId = crypto.randomUUID();

        const { data: currentAdminEmp } = await supabase.from('employees').select('session_version').eq('id', adminUserId).maybeSingle();
        const adminVer = currentAdminEmp?.session_version || 1;

        adminToken = await signJwt({
            sessionId: adminSessionId,
            userId: adminUserId,
            name: 'Vikram Singhania',
            role: 'restaurant_admin',
            sessionVersion: adminVer,
            email: 'newowner_test@dineinone.com',
            mobile: '9876543219',
            restaurantId: TEST_RESTAURANT_ID,
            restaurant_id: TEST_RESTAURANT_ID
        });

        const adminTokenHash = crypto.createHash('sha256').update(adminToken).digest('hex');
        await supabase.from('dine_sessions').insert({
            id: adminSessionId,
            user_id: adminUserId,
            token_hash: adminTokenHash,
            device_info: 'E2E-Test-Runner',
            ip_address: '127.0.0.1',
            is_active: true
        });
        console.log('  Admin session registered successfully.\n');

        // Step 1: Admin Creates Employee
        console.log('--- Step 1: Admin Creates Employee ---');
        const createRes = await fetch(`${BASE_URL}/api/auth/employee/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': `dine_auth_token=${adminToken}`
            },
            body: JSON.stringify({
                name: 'Test Waiter AuthFlow',
                role: 'waiter',
                restaurant_id: TEST_RESTAURANT_ID,
                mobile: TEST_MOBILE,
                email: TEST_EMAIL
            })
        });

        const createData = await createRes.json();
        assert(createRes.status === 200, `Admin successfully created employee (status: ${createRes.status})`);
        assert(createData.employee && createData.employee.status === 'pending_activation', 'Employee status is strictly "pending_activation"');
        assert(createData.employee && createData.employee.approval_status === 'pending_verification', 'Approval status is "pending_verification"');
        assert(createData.activationLink && createData.activationLink.includes('token='), `Activation link generated: ${createData.activationLink}`);

        const newEmployeeId = createData.employee.id;
        const activationToken = new URL(createData.activationLink, BASE_URL).searchParams.get('token');

        // Check DB state
        const { data: dbEmp } = await supabase.from('employees').select('*').eq('id', newEmployeeId).single();
        assert(dbEmp.status === 'pending_activation', 'DB confirms employee status is "pending_activation"');
        assert(dbEmp.is_online === false, 'DB confirms employee is_online is initially false');
        assert(dbEmp.activation_token === activationToken, 'DB confirms activation_token is stored');

        // Check Auth table placeholder
        const { data: dbAuth } = await supabase.from('auth').select('*').eq('user_id', newEmployeeId).single();
        assert(dbAuth.password_hash === 'pending_activation', 'DB confirms auth.password_hash is "pending_activation" placeholder');
        console.log('');

        // Step 2: Employee has NO access before activation
        console.log('--- Step 2: Pre-Activation Restrictions (Blocked from All Access) ---');

        // Attempt login via /api/auth/login
        const loginBeforeAct = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: TEST_EMAIL,
                password: TEST_PASSWORD
            })
        });
        const loginBeforeActData = await loginBeforeAct.json();
        assert(loginBeforeAct.status === 403, `Pre-activation login via /api/auth/login blocked with 403 (got: ${loginBeforeAct.status})`);
        assert(loginBeforeActData.error?.includes('not activated') || loginBeforeActData.error?.includes('pending activation'), `Correct error message: "${loginBeforeActData.error}"`);

        // Attempt login via /api/auth/waiter/mobile-login
        const waiterLoginBeforeAct = await fetch(`${BASE_URL}/api/auth/waiter/mobile-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mobile: TEST_MOBILE,
                password: TEST_PASSWORD
            })
        });
        const waiterLoginBeforeActData = await waiterLoginBeforeAct.json();
        assert(waiterLoginBeforeAct.status === 403, `Pre-activation login via /api/auth/waiter/mobile-login blocked with 403 (got: ${waiterLoginBeforeAct.status})`);
        assert(waiterLoginBeforeActData.error?.includes('pending activation') || waiterLoginBeforeActData.error?.includes('not activated'), `Correct error message: "${waiterLoginBeforeActData.error}"`);

        // Attempt access to /api/waiter/status without auth
        const unauthStatus = await fetch(`${BASE_URL}/api/waiter/status`);
        assert(unauthStatus.status === 401, `Unauthenticated call to /api/waiter/status returned 401 (got: ${unauthStatus.status})`);

        // Attempt access with forged token for pending employee
        const pendingToken = await signJwt({
            sessionId: crypto.randomUUID(),
            userId: newEmployeeId,
            name: 'Test Waiter AuthFlow',
            role: 'waiter',
            sessionVersion: 1,
            restaurantId: TEST_RESTAURANT_ID
        });
        const forgedStatusRes = await fetch(`${BASE_URL}/api/waiter/status`, {
            headers: { 'Cookie': `dine_auth_token=${pendingToken}` }
        });
        assert(forgedStatusRes.status === 401 || forgedStatusRes.status === 403, `Pending employee token blocked by verifyStaffAuth (got: ${forgedStatusRes.status})`);
        console.log('');

        // Step 3: Activation Link Security & Validation
        console.log('--- Step 3: Activation Link Security ---');

        // Invalid token validation
        const invalidTokenRes = await fetch(`${BASE_URL}/api/auth/activate?token=invalid_token_99999`);
        assert(invalidTokenRes.status === 404, `Invalid activation token rejected with 404 (got: ${invalidTokenRes.status})`);

        // Valid token validation (GET should NOT authenticate or grant access)
        const validTokenGetRes = await fetch(`${BASE_URL}/api/auth/activate?token=${activationToken}`);
        const validTokenGetData = await validTokenGetRes.json();
        const setCookieHeader = validTokenGetRes.headers.get('set-cookie');
        assert(validTokenGetRes.status === 200, `Valid activation token verified successfully`);
        assert(validTokenGetData.valid === true, `Response confirms valid token`);
        assert(!setCookieHeader || !setCookieHeader.includes('dine_auth_token'), `Activation GET link does NOT issue any auth cookies or sessions`);

        // Password complexity validation
        const weakPassRes = await fetch(`${BASE_URL}/api/auth/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: activationToken,
                password: 'short'
            })
        });
        assert(weakPassRes.status === 400, `Weak password rejected with 400 (got: ${weakPassRes.status})`);
        console.log('');

        // Step 4: Employee Activates Account and Sets Password
        console.log('--- Step 4: Employee Activates Account ---');
        const activateRes = await fetch(`${BASE_URL}/api/auth/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: activationToken,
                password: TEST_PASSWORD
            })
        });
        const activateData = await activateRes.json();
        assert(activateRes.status === 200, `Activation POST succeeded with 200: "${activateData.message}"`);

        // Verify DB status is now strictly ACTIVE
        const { data: activatedEmp } = await supabase.from('employees').select('*').eq('id', newEmployeeId).single();
        assert(activatedEmp.status === 'active', 'Employee status is now strictly "active"');
        assert(activatedEmp.approval_status === 'approved', 'Employee approval_status is now "approved"');
        assert(activatedEmp.activation_token === null, 'Employee activation_token is immediately cleared (NULL)');
        console.log('');

        // Step 5: Activation Link Single-Use Enforcement
        console.log('--- Step 5: Single-Use Activation Link Invalidation ---');
        const reuseRes = await fetch(`${BASE_URL}/api/auth/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: activationToken,
                password: TEST_PASSWORD
            })
        });
        assert(reuseRes.status === 404, `Re-using already activated token immediately rejected with 404 (got: ${reuseRes.status})`);
        console.log('');

        // Step 6: Employee Logs In Normally
        console.log('--- Step 6: Employee Logs In with Approved Staff Authentication ---');

        // Wrong password test
        const wrongPassRes = await fetch(`${BASE_URL}/api/auth/waiter/mobile-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mobile: TEST_MOBILE,
                password: 'WrongPassword123!'
            })
        });
        assert(wrongPassRes.status === 401, `Wrong password rejected with 401 (got: ${wrongPassRes.status})`);

        // Correct password test
        const correctLoginRes = await fetch(`${BASE_URL}/api/auth/waiter/mobile-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mobile: TEST_MOBILE,
                password: TEST_PASSWORD
            })
        });
        const loginData = await correctLoginRes.json();
        assert(correctLoginRes.status === 200, `Active employee logged in successfully with 200`);
        assert(loginData.session && loginData.session.role === 'waiter', `Session confirms role: ${loginData.session?.role}`);

        const waiterCookie = correctLoginRes.headers.get('set-cookie');
        assert(Boolean(waiterCookie && waiterCookie.includes('dine_auth_token')), `dine_auth_token cookie issued upon successful login`);
        const tokenMatch = waiterCookie?.match(/dine_auth_token=([^;]+)/);
        const waiterAuthToken = tokenMatch ? tokenMatch[1] : null;
        console.log('');

        // Step 7: Waiter Panel Access & Role Isolation
        console.log('--- Step 7: Role Authorization & Tenant Protection ---');

        // Waiter calling Admin API -> MUST BE FORBIDDEN
        const waiterAsAdminRes = await fetch(`${BASE_URL}/api/auth/employee/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': `dine_auth_token=${waiterAuthToken}`
            },
            body: JSON.stringify({
                name: 'Unauthorized Employee',
                role: 'waiter',
                restaurant_id: TEST_RESTAURANT_ID,
                mobile: '9998889999'
            })
        });
        assert(waiterAsAdminRes.status === 403, `Waiter attempting Admin operations blocked with 403 (got: ${waiterAsAdminRes.status})`);
        console.log('');

        // Step 8: Waiter Online / Offline Status
        console.log('--- Step 8: Waiter Self-Managed Online / Offline Status ---');

        // Get initial status
        const initialStatusRes = await fetch(`${BASE_URL}/api/waiter/status`, {
            headers: { 'Cookie': `dine_auth_token=${waiterAuthToken}` }
        });
        const initialStatusData = await initialStatusRes.json();
        assert(initialStatusRes.status === 200, `GET /api/waiter/status returned 200`);
        assert(initialStatusData.is_online === false, `Initial status is Offline (is_online: false)`);

        // Set status to ONLINE
        const setOnlineRes = await fetch(`${BASE_URL}/api/waiter/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': `dine_auth_token=${waiterAuthToken}`
            },
            body: JSON.stringify({ isOnline: true })
        });
        const setOnlineData = await setOnlineRes.json();
        assert(setOnlineRes.status === 200, `POST /api/waiter/status with isOnline: true succeeded with 200`);
        assert(setOnlineData.is_online === true, `Response confirms is_online: true`);
        assert(setOnlineData.availability_status === 'available', `Response confirms availability_status: "available"`);

        // Verify in DB
        const { data: dbOnlineCheck } = await supabase.from('employees').select('is_online, availability_status').eq('id', newEmployeeId).single();
        assert(dbOnlineCheck.is_online === true, `DB confirms employees.is_online === true`);
        assert(dbOnlineCheck.availability_status === 'available', `DB confirms employees.availability_status === "available"`);

        // Set status back to OFFLINE
        const setOfflineRes = await fetch(`${BASE_URL}/api/waiter/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': `dine_auth_token=${waiterAuthToken}`
            },
            body: JSON.stringify({ isOnline: false })
        });
        const setOfflineData = await setOfflineRes.json();
        assert(setOfflineRes.status === 200, `POST /api/waiter/status with isOnline: false succeeded with 200`);
        assert(setOfflineData.is_online === false, `Response confirms is_online: false`);

        const { data: dbOfflineCheck } = await supabase.from('employees').select('is_online, availability_status').eq('id', newEmployeeId).single();
        assert(dbOfflineCheck.is_online === false, `DB confirms employees.is_online === false`);
        assert(dbOfflineCheck.availability_status === 'offline', `DB confirms employees.availability_status === "offline"`);
        console.log('');

        // Step 9: Unauthorized users cannot change Waiter status
        console.log('--- Step 9: Unauthorized Status Change Protection ---');
        const unauthChangeRes = await fetch(`${BASE_URL}/api/waiter/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isOnline: true })
        });
        assert(unauthChangeRes.status === 401, `Unauthenticated user cannot change waiter online status (got: ${unauthChangeRes.status})`);
        console.log('');

    } finally {
        // Step 10: Cleanup Test Artifacts
        console.log('--- Step 10: Cleanup Test Data ---');
        if (adminSessionId) {
            await supabase.from('dine_sessions').delete().eq('id', adminSessionId);
        }
        const { data: testEmps } = await supabase.from('employees').select('id').eq('mobile', TEST_MOBILE);
        if (testEmps && testEmps.length > 0) {
            const ids = testEmps.map(e => e.id);
            await supabase.from('dine_sessions').delete().in('user_id', ids);
            await supabase.from('auth').delete().in('user_id', ids);
            await supabase.from('password_history').delete().in('user_id', ids);
            await supabase.from('audit_logs').delete().in('user_id', ids);
            await supabase.from('employees').delete().in('id', ids);
            console.log(`  Cleaned up ${ids.length} test employee record(s).`);
        }
    }

    console.log('\n================================================================');
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
