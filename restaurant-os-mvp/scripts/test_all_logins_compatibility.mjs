import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import argon2 from 'argon2';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmcsygpphwdubnanwjwz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
const BASE_URL = 'http://localhost:3000';
const SUPER_ADMIN_URL = 'http://localhost:3005';

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

async function runCompatibilityTests() {
    console.log('================================================================');
    console.log('🔄 AUTHENTICATION COMPATIBILITY & LOGIN FLOWS VERIFICATION');
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

    const { verifyJwt } = await import('../lib/jwt-utils.ts');

    const TEST_REST_ID = '202603180001';
    const TEST_PIN = '1234';
    const TEST_MOBILE = '9888877771';
    const TEST_EMAIL = `test_admin_${Date.now()}@example.com`;
    const TEST_PASSWORD = 'TestPassword@123';
    const TEST_EMP_UUID = crypto.randomUUID();

    try {
        const hashedPin = await argon2.hash(TEST_PIN, { type: argon2.argon2id });
        const hashedPassword = await argon2.hash(TEST_PASSWORD, { type: argon2.argon2id });

        // 1. Create a test employee with role waiter
        await supabase.from('employees').insert({
            id: TEST_EMP_UUID,
            employee_id: 'EMP_COMPAT_' + Date.now(),
            name: 'Compatibility Test Waiter',
            mobile: TEST_MOBILE,
            email: TEST_EMAIL,
            pin: hashedPin,
            role: 'waiter',
            restaurant_id: TEST_REST_ID,
            status: 'active',
            approval_status: 'approved',
            session_version: 1,
            is_deleted: false
        });

        await supabase.from('auth').insert({
            user_id: TEST_EMP_UUID,
            password_hash: hashedPassword,
            failed_attempts: 0
        });

        // -------------------------------------------------------------
        // TEST 1: Waiter Login Flow
        // -------------------------------------------------------------
        console.log('--- Test 1: Waiter Login Flow (/api/auth/waiter/login) ---');
        const waiterRes = await fetch(`${BASE_URL}/api/auth/waiter/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobile: TEST_MOBILE, pin: TEST_PIN })
        });
        const waiterData = await waiterRes.json();
        assert(waiterRes.status === 200, `Waiter login succeeds with 200 OK (got ${waiterRes.status})`);
        assert(waiterData.success === true, 'Waiter login returns success: true');

        const waiterToken = extractTokenFromCookies(waiterRes);
        assert(Boolean(waiterToken), 'Waiter login sets dine_auth_token cookie');

        if (waiterToken) {
            const verified = await verifyJwt(waiterToken);
            assert(verified && verified.userId === TEST_EMP_UUID, `Returned token verifies with server JWT_SECRET (userId matches)`);
            assert(verified && verified.role === 'waiter', `Token role is 'waiter'`);
        }

        // -------------------------------------------------------------
        // TEST 2: Employee Portal Login Flow
        // -------------------------------------------------------------
        console.log('\n--- Test 2: Employee Portal Login (/api/auth/employee/login) ---');
        const empRes = await fetch(`${BASE_URL}/api/auth/employee/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobile: TEST_MOBILE, pin: TEST_PIN })
        });
        const empData = await empRes.json();
        if (empRes.status !== 200) console.log('empData error:', empData);
        assert(empRes.status === 200, `Employee login succeeds with 200 OK (got ${empRes.status})`);
        assert(empData.success === true, 'Employee login returns success: true');

        const empToken = extractTokenFromCookies(empRes);
        assert(Boolean(empToken), 'Employee login sets dine_auth_token cookie');

        if (empToken) {
            const verified = await verifyJwt(empToken);
            assert(verified && verified.userId === TEST_EMP_UUID, 'Employee token verified successfully');
        }

        // -------------------------------------------------------------
        // TEST 3: Kitchen / KDS Login Flow (with chef role)
        // -------------------------------------------------------------
        console.log('\n--- Test 3: KDS Login Flow (/api/auth/kds/login) ---');
        await supabase.from('employees').update({ role: 'chef' }).eq('id', TEST_EMP_UUID);

        const kdsRes = await fetch(`${BASE_URL}/api/auth/kds/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobile: TEST_MOBILE, pin: TEST_PIN })
        });
        const kdsData = await kdsRes.json();
        assert(kdsRes.status === 200, `KDS login succeeds with 200 OK (got ${kdsRes.status})`);
        assert(kdsData.success === true, 'KDS login returns success: true');

        const kdsToken = extractTokenFromCookies(kdsRes);
        assert(Boolean(kdsToken), 'KDS login sets dine_auth_token cookie');

        if (kdsToken) {
            const verified = await verifyJwt(kdsToken);
            assert(verified && verified.userId === TEST_EMP_UUID, 'KDS token verified successfully');
        }

        // -------------------------------------------------------------
        // TEST 4: Restaurant Admin Login Flow
        // -------------------------------------------------------------
        console.log('\n--- Test 4: Restaurant Admin Login (/api/auth/admin/login) ---');
        await supabase.from('employees').update({ role: 'restaurant_admin' }).eq('id', TEST_EMP_UUID);

        const adminRes = await fetch(`${BASE_URL}/api/auth/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                identifier: TEST_EMAIL,
                password: TEST_PASSWORD,
                pin: TEST_PIN
            })
        });
        const adminData = await adminRes.json();
        if (adminRes.status !== 200) console.log('adminData error:', adminData);
        assert(adminRes.status === 200, `Restaurant Admin login succeeds with 200 OK (got ${adminRes.status})`);
        assert(adminData.success === true, 'Admin login returns success: true');

        const adminToken = extractTokenFromCookies(adminRes);
        assert(Boolean(adminToken), 'Admin login sets dine_auth_token cookie');

        if (adminToken) {
            const verified = await verifyJwt(adminToken);
            assert(verified && verified.userId === TEST_EMP_UUID, 'Admin token verified successfully');
            assert(verified && verified.role === 'restaurant_admin', `Role in token is 'restaurant_admin'`);
        }

        // -------------------------------------------------------------
        // TEST 5: Customer Active Order Endpoint
        // -------------------------------------------------------------
        console.log('\n--- Test 5: Customer Authentication (/api/customer/active-order) ---');
        const custRes = await fetch(`${BASE_URL}/api/customer/active-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                restaurantCode: TEST_REST_ID,
                mobile: '9876543210'
            })
        });
        const custData = await custRes.json();
        assert(custRes.status === 200, `Customer active-order returns 200 OK (got ${custRes.status})`);
        assert(custData.success === true, 'Customer active-order returns success: true');

        // -------------------------------------------------------------
        // TEST 6: Super Admin JWT Flow (super-admin/lib/jwt-utils.ts)
        // -------------------------------------------------------------
        console.log('\n--- Test 6: Super Admin JWT Flow ---');
        const superAdminJwtUtils = await import('../super-admin/lib/jwt-utils.ts');
        const saToken = await superAdminJwtUtils.signJwt({
            userId: '6f0770d2-9826-4805-93eb-bb9f86b38647',
            email: 'hellodineinone@gmail.com',
            name: 'Super Admin',
            role: 'SUPER_ADMIN'
        });
        assert(Boolean(saToken) && saToken.split('.').length === 3, 'Super Admin signJwt generates valid 3-part JWT');

        const verifiedSa = await superAdminJwtUtils.verifyJwt(saToken);
        assert(verifiedSa && verifiedSa.userId === '6f0770d2-9826-4805-93eb-bb9f86b38647', 'Super Admin verifyJwt verifies payload');
        assert(verifiedSa && verifiedSa.role === 'SUPER_ADMIN', 'Super Admin verifyJwt preserves role SUPER_ADMIN');

    } finally {
        console.log('\n--- Cleaning up temporary test records ---');
        await supabase.from('dine_sessions').delete().eq('user_id', TEST_EMP_UUID);
        await supabase.from('auth').delete().eq('user_id', TEST_EMP_UUID);
        await supabase.from('employees').delete().eq('id', TEST_EMP_UUID);
        console.log('Cleanup finished.\n');
    }

    console.log('================================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED / ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) process.exit(1);
}

runCompatibilityTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
