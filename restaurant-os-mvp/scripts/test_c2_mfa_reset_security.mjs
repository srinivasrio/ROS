import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmcsygpphwdubnanwjwz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
const BASE_URL = 'http://localhost:3000';

if (!SUPABASE_SERVICE_ROLE_KEY || !JWT_SECRET) {
    console.error('SUPABASE_SERVICE_ROLE_KEY and JWT_SECRET are required');
    process.exit(1);
}

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

// TOTP helper for testing valid code submission
function getTotpCode(secret, timeIndex) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleaned = String(secret || '').toUpperCase().replace(/=+$/, '');
    let bits = '';
    for (let i = 0; i < cleaned.length; i++) {
        const val = alphabet.indexOf(cleaned[i]);
        if (val === -1) throw new Error('Invalid base32 character');
        bits += val.toString(2).padStart(5, '0');
    }
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.substring(i, i + 8), 2));
    }
    const key = Buffer.from(bytes);

    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(timeIndex), 0);
    const hmac = crypto.createHmac('sha1', key);
    hmac.update(buffer);
    const hmacResult = hmac.digest();
    const offset = hmacResult[hmacResult.length - 1] & 0xf;
    const code =
        ((hmacResult[offset] & 0x7f) << 24) |
        ((hmacResult[offset + 1] & 0xff) << 16) |
        ((hmacResult[offset + 2] & 0xff) << 8) |
        (hmacResult[offset + 3] & 0xff);
    return (code % 1000000).toString().padStart(6, '0');
}

async function runSecurityTests() {
    console.log('================================================================');
    console.log('🔒 C2 SECURITY TEST SUITE: COMPLETE-MFA-RESET ENDPOINT');
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

    const RESTAURANT_A = '202603180001';
    const RESTAURANT_B = '202609089153';

    // Test Employee IDs
    const ADMIN_A_UUID = crypto.randomUUID(); // Active Restaurant Admin for Restaurant A
    const SUPER_ADMIN_ID = '6f0770d2-9826-4805-93eb-bb9f86b38647'; // Srinivas Kumar (SUPER_ADMIN)
    const WAITER_ID = 'b2aa8a42-70b5-431a-ae5b-3408516b03eb'; // Teja (waiter / non-admin)
    const EMPLOYEE_B_ID = '6b3132f8-32c6-458d-b71a-bc68cdd48d34'; // Sasi (Restaurant B)

    // Temporary target test employee for Restaurant A
    const TARGET_TEST_ID = 'e2e-c2-test-employee-' + Date.now();
    const TARGET_TEST_UUID = crypto.randomUUID();

    try {
        // Setup: Create active admin for Restaurant A
        await supabase.from('employees').insert({
            id: ADMIN_A_UUID,
            employee_id: 'admin_test_' + Date.now(),
            name: 'Active Test Admin A',
            email: `admin_a_${Date.now()}@example.com`,
            role: 'restaurant_admin',
            restaurant_id: RESTAURANT_A,
            status: 'active',
            approval_status: 'approved',
            session_version: 1,
            is_deleted: false
        });

        // Setup: Create temporary target employee in Restaurant A
        await supabase.from('employees').insert({
            id: TARGET_TEST_UUID,
            employee_id: TARGET_TEST_ID,
            name: 'C2 Test Target Employee',
            email: `c2test_${Date.now()}@example.com`,
            mobile: '9999111222',
            role: 'waiter',
            restaurant_id: RESTAURANT_A,
            status: 'mfa_reset_required',
            approval_status: 'approved',
            session_version: 1,
            is_deleted: false
        });

        await supabase.from('auth').insert({
            user_id: TARGET_TEST_UUID,
            password_hash: '$argon2id$placeholder',
            mfa_enabled: false,
            failed_attempts: 0
        });

        // Generate JWTs for different actors
        const adminAToken = await signJwt({
            userId: ADMIN_A_UUID,
            role: 'restaurant_admin',
            restaurantId: RESTAURANT_A,
            email: 'admin_a@example.com'
        });

        const superAdminToken = await signJwt({
            userId: SUPER_ADMIN_ID,
            role: 'SUPER_ADMIN',
            email: 'superadmin@example.com'
        });

        const waiterToken = await signJwt({
            userId: WAITER_ID,
            role: 'waiter',
            restaurantId: RESTAURANT_B,
            email: 'waiter@example.com'
        });

        const expiredToken = await signJwt({
            userId: ADMIN_A_UUID,
            role: 'restaurant_admin',
            restaurantId: RESTAURANT_A
        }, -100); // Expired 100 seconds ago

        const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJub2JvZHkifQ.invalid_signature_here';

        // -------------------------------------------------------------
        // TEST 1: Unauthenticated GET → 401
        // -------------------------------------------------------------
        console.log('--- Test 1: Unauthenticated GET ---');
        const res1 = await fetch(`${BASE_URL}/api/auth/complete-mfa-reset?userId=${TARGET_TEST_UUID}`);
        const data1 = await res1.json();
        assert(res1.status === 401, `Unauthenticated GET returns 401 (got ${res1.status})`);
        assert(!data1.totpSecret && !data1.totpUri, 'No TOTP secret or URI returned in 401 response');

        // -------------------------------------------------------------
        // TEST 2: Unauthenticated POST → 401
        // -------------------------------------------------------------
        console.log('\n--- Test 2: Unauthenticated POST ---');
        const res2 = await fetch(`${BASE_URL}/api/auth/complete-mfa-reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: TARGET_TEST_UUID, totpSecret: 'TEST', otpCode: '123456' })
        });
        const data2 = await res2.json();
        assert(res2.status === 401, `Unauthenticated POST returns 401 (got ${res2.status})`);
        assert(!data2.recoveryCodes, 'No recovery codes returned in 401 response');

        // -------------------------------------------------------------
        // TEST 3: Invalid / Expired Authentication → 401
        // -------------------------------------------------------------
        console.log('\n--- Test 3: Invalid and Expired Token ---');
        const res3a = await fetch(`${BASE_URL}/api/auth/complete-mfa-reset?userId=${TARGET_TEST_UUID}`, {
            headers: { 'Authorization': `Bearer ${invalidToken}` }
        });
        assert(res3a.status === 401, `Invalid JWT returns 401 (got ${res3a.status})`);

        const res3b = await fetch(`${BASE_URL}/api/auth/complete-mfa-reset?userId=${TARGET_TEST_UUID}`, {
            headers: { 'Authorization': `Bearer ${expiredToken}` }
        });
        assert(res3b.status === 401, `Expired JWT returns 401 (got ${res3b.status})`);

        // -------------------------------------------------------------
        // TEST 4: Waiter/Normal employee attempting reset → 403
        // -------------------------------------------------------------
        console.log('\n--- Test 4: Waiter / Normal Employee Attempting Reset ---');
        const res4a = await fetch(`${BASE_URL}/api/auth/complete-mfa-reset?userId=${TARGET_TEST_UUID}`, {
            headers: { 'Authorization': `Bearer ${waiterToken}` }
        });
        const data4a = await res4a.json();
        assert(res4a.status === 403, `Waiter attempting GET returns 403 Forbidden (got ${res4a.status})`);
        assert(!data4a.totpSecret, 'No TOTP credentials exposed to waiter');

        const res4b = await fetch(`${BASE_URL}/api/auth/complete-mfa-reset`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${waiterToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId: TARGET_TEST_UUID, totpSecret: 'TEST', otpCode: '123456' })
        });
        const data4b = await res4b.json();
        assert(res4b.status === 403, `Waiter attempting POST returns 403 Forbidden (got ${res4b.status})`);
        assert(!data4b.recoveryCodes, 'No recovery codes exposed to waiter');

        // -------------------------------------------------------------
        // TEST 5: Restaurant Admin resetting another restaurant’s employee → 403
        // -------------------------------------------------------------
        console.log('\n--- Test 5: Restaurant Admin Cross-Tenant Reset Attempt ---');
        // Admin of Restaurant A targeting employee of Restaurant B
        const res5 = await fetch(`${BASE_URL}/api/auth/complete-mfa-reset?userId=${EMPLOYEE_B_ID}`, {
            headers: { 'Authorization': `Bearer ${adminAToken}` }
        });
        const data5 = await res5.json();
        assert(res5.status === 403, `Admin A targeting Employee B returns 403 Forbidden (got ${res5.status})`);
        assert(data5.error && data5.error.includes('another restaurant'), `Error indicates tenant isolation: "${data5.error}"`);

        // -------------------------------------------------------------
        // TEST 6: Restaurant Admin attempting to reset Super Admin → 403
        // -------------------------------------------------------------
        console.log('\n--- Test 6: Restaurant Admin Attempting to Reset Super Admin ---');
        const res6 = await fetch(`${BASE_URL}/api/auth/complete-mfa-reset?userId=${SUPER_ADMIN_ID}`, {
            headers: { 'Authorization': `Bearer ${adminAToken}` }
        });
        assert(res6.status === 403, `Admin A targeting Super Admin returns 403 Forbidden (got ${res6.status})`);

        // -------------------------------------------------------------
        // TEST 7: Authorized Restaurant Admin resetting their employee (GET) → 200
        // -------------------------------------------------------------
        console.log('\n--- Test 7: Authorized Restaurant Admin Resetting Their Employee (GET) ---');
        const res7 = await fetch(`${BASE_URL}/api/auth/complete-mfa-reset?userId=${TARGET_TEST_UUID}`, {
            headers: { 'Authorization': `Bearer ${adminAToken}` }
        });
        const data7 = await res7.json();
        assert(res7.status === 200, `Authorized Restaurant Admin GET returns 200 OK (got ${res7.status})`);
        assert(data7.success === true, 'Response indicates success: true');
        assert(Boolean(data7.totpSecret), `TOTP Secret generated: ${data7.totpSecret ? 'yes' : 'no'}`);
        assert(Boolean(data7.totpUri), `TOTP URI generated: ${data7.totpUri ? 'yes' : 'no'}`);

        const generatedTotpSecret = data7.totpSecret;

        // -------------------------------------------------------------
        // TEST 8: Authorized Restaurant Admin with Invalid OTP (POST) → 400
        // -------------------------------------------------------------
        console.log('\n--- Test 8: Authorized Admin with Invalid OTP Code ---');
        const res8 = await fetch(`${BASE_URL}/api/auth/complete-mfa-reset`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminAToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: TARGET_TEST_UUID,
                totpSecret: generatedTotpSecret,
                otpCode: '000000' // Intentionally invalid
            })
        });
        const data8 = await res8.json();
        assert(res8.status === 400, `Invalid OTP returns 400 (got ${res8.status})`);
        assert(!data8.recoveryCodes, 'No recovery codes returned on invalid OTP');

        // -------------------------------------------------------------
        // TEST 9: Authorized Restaurant Admin with Valid OTP (POST) → 200 & Recovery Codes
        // -------------------------------------------------------------
        console.log('\n--- Test 9: Authorized Admin with Valid OTP Code (POST) ---');
        const currentTimeIndex = Math.floor(Date.now() / 1000 / 30);
        const validOtpCode = getTotpCode(generatedTotpSecret, currentTimeIndex);

        const res9 = await fetch(`${BASE_URL}/api/auth/complete-mfa-reset`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminAToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: TARGET_TEST_UUID,
                totpSecret: generatedTotpSecret,
                otpCode: validOtpCode
            })
        });
        const data9 = await res9.json();
        assert(res9.status === 200, `Valid OTP POST returns 200 OK (got ${res9.status})`);
        assert(data9.success === true, 'Response indicates success: true');
        assert(Array.isArray(data9.recoveryCodes) && data9.recoveryCodes.length === 10, 'Generated 10 recovery codes returned');

        // Verify Database State Updates
        const { data: updatedEmp } = await supabase.from('employees').select('status, session_version, mfa_reset_by').eq('id', TARGET_TEST_UUID).single();
        assert(updatedEmp.status === 'active', `Employee status updated to 'active' (got '${updatedEmp.status}')`);
        assert(updatedEmp.session_version === 2, `Employee session_version incremented to 2 (got ${updatedEmp.session_version})`);
        assert(updatedEmp.mfa_reset_by === ADMIN_A_UUID, `Employee mfa_reset_by recorded admin ID`);

        const { data: updatedAuth } = await supabase.from('auth').select('mfa_enabled, totp_secret').eq('user_id', TARGET_TEST_UUID).single();
        assert(updatedAuth.mfa_enabled === true, 'Auth record mfa_enabled is now true');
        assert(updatedAuth.totp_secret === generatedTotpSecret, 'Auth record totp_secret saved correctly');

        // -------------------------------------------------------------
        // TEST 10: Authorized Super Admin Operation → Allowed
        // -------------------------------------------------------------
        console.log('\n--- Test 10: Super Admin Authorized Operation ---');
        // Reset employee status back to mfa_reset_required and disable mfa for test
        await supabase.from('employees').update({ status: 'mfa_reset_required' }).eq('id', TARGET_TEST_UUID);
        await supabase.from('auth').update({ mfa_enabled: false }).eq('user_id', TARGET_TEST_UUID);

        const res10 = await fetch(`${BASE_URL}/api/auth/complete-mfa-reset?userId=${TARGET_TEST_UUID}`, {
            headers: { 'Authorization': `Bearer ${superAdminToken}` }
        });
        const data10 = await res10.json();
        assert(res10.status === 200, `Super Admin operation returns 200 OK (got ${res10.status})`);
        assert(data10.success === true, 'Super Admin GET received success: true');
        assert(Boolean(data10.totpSecret), 'Super Admin received valid TOTP secret');

        // -------------------------------------------------------------
        // TEST 11: Audit Logs Security Verification
        // -------------------------------------------------------------
        console.log('\n--- Test 11: Audit Logs Security Verification ---');
        const { data: auditRecords } = await supabase
            .from('audit_logs')
            .select('*')
            .eq('target_user_id', TARGET_TEST_UUID)
            .order('created_at', { ascending: false })
            .limit(10);

        assert(auditRecords && auditRecords.length > 0, `Audit logs created for target user (${auditRecords?.length} records found)`);

        const actions = auditRecords.map(r => r.action);
        assert(actions.includes('mfa_reset_completed'), 'Found mfa_reset_completed in audit logs');
        assert(actions.includes('session_version_incremented'), 'Found session_version_incremented in audit logs');
        assert(actions.includes('recovery_code_generated'), 'Found recovery_code_generated in audit logs');

        // Verify NO sensitive information was logged
        let leakFound = false;
        for (const log of auditRecords) {
            const raw = JSON.stringify(log);
            if (raw.includes(generatedTotpSecret)) leakFound = true;
            if (raw.includes(validOtpCode)) leakFound = true;
            if (data9.recoveryCodes?.some(c => raw.includes(c))) leakFound = true;
        }
        assert(!leakFound, 'Zero secrets leaked in audit logs (no TOTP secret, no OTP, no recovery codes)');

    } finally {
        // Cleanup test employee and auth record
        console.log('\n--- Cleaning up temporary test records ---');
        await supabase.from('recovery_codes').delete().eq('user_id', TARGET_TEST_UUID);
        await supabase.from('auth').delete().eq('user_id', TARGET_TEST_UUID);
        await supabase.from('audit_logs').delete().eq('target_user_id', TARGET_TEST_UUID);
        await supabase.from('employees').delete().eq('id', TARGET_TEST_UUID);
        await supabase.from('employees').delete().eq('id', ADMIN_A_UUID);
        console.log('Cleanup finished.\n');
    }

    console.log('================================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED / ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) process.exit(1);
}

runSecurityTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
