import { createClient } from '@supabase/supabase-js';
import assert from 'assert';
import { hashPassword } from '../lib/auth-utils.js';
import { hashOtp, verifyOtpHash } from '../lib/email-otp.js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmcsygpphwdubnanwjwz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is required to run this test.');
    process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let total = 0;

function check(desc, condition) {
    total++;
    if (condition) {
        passed++;
        console.log(`✅ PASSED: ${desc}`);
    } else {
        console.error(`❌ FAILED: ${desc}`);
        throw new Error(`Assertion failed: ${desc}`);
    }
}

async function cleanupUser(email) {
    const { data: emp } = await supabaseAdmin.from('employees').select('id').ilike('email', email).maybeSingle();
    if (emp?.id) {
        await supabaseAdmin.from('dine_sessions').delete().eq('user_id', emp.id);
        await supabaseAdmin.from('auth').delete().eq('user_id', emp.id);
        await supabaseAdmin.from('employees').delete().eq('id', emp.id);
    }
    await supabaseAdmin.from('email_otp_verifications').delete().ilike('email', email);
}

async function runTests() {
    console.log('\n===============================================================');
    console.log('🧪 TESTING DINE IN ONE REGISTRATION + APPROVAL + LOGIN FLOW');
    console.log('===============================================================\n');

    const testPendingEmail = `pending.user.${Date.now()}@dineinone.test`;
    const testApprovedEmail = `approved.user.${Date.now()}@dineinone.test`;
    const testUnverifiedEmail = `unverified.user.${Date.now()}@dineinone.test`;
    const testPassword = 'Password@123';

    try {
        // ------------------------------------------------------------------
        // TEST 1: Registered but unverified account attempting login
        // ------------------------------------------------------------------
        console.log('--- TEST 1: Unverified Account Login Attempt ---');
        await cleanupUser(testUnverifiedEmail);

        const passwordHash1 = await hashPassword(testPassword);
        const unverifiedId = crypto.randomUUID();

        await supabaseAdmin.from('employees').insert({
            id: unverifiedId,
            name: 'Unverified Test User',
            email: testUnverifiedEmail,
            mobile: '9876543210',
            role: 'restaurant_admin',
            employee_id: `ADM-${unverifiedId.slice(0, 6)}`,
            status: 'pending',
            approval_status: 'pending_verification',
            email_verified: false,
            is_deleted: false,
        });

        await supabaseAdmin.from('auth').insert({
            user_id: unverifiedId,
            password_hash: passwordHash1,
            failed_attempts: 0,
        });

        // Test login endpoint via NextRequest simulation
        const { POST: loginHandler } = await import('../app/api/auth/login/route.ts');

        const unverifiedReq = new Request('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testUnverifiedEmail, password: testPassword }),
        });

        const unverifiedRes = await loginHandler(unverifiedReq);
        const unverifiedData = await unverifiedRes.json();

        check('Unverified account login is blocked with status 403', unverifiedRes.status === 403);
        check('Code is EMAIL_NOT_VERIFIED', unverifiedData.code === 'EMAIL_NOT_VERIFIED');
        check('Email verification error message is clean', unverifiedData.error.includes('email address has not been verified'));

        // ------------------------------------------------------------------
        // TEST 2: Registered + Email Verified, but Super Admin Approval Pending
        // Requirement 2: Show “Your account activation is currently under process. Dine in One will contact you once your account is activated.”
        // ------------------------------------------------------------------
        console.log('\n--- TEST 2: Registered but Super Admin Approval Pending ---');
        await cleanupUser(testPendingEmail);

        const passwordHash2 = await hashPassword(testPassword);
        const pendingId = crypto.randomUUID();

        // 1. Create employee in awaiting approval status (post email verification)
        await supabaseAdmin.from('employees').insert({
            id: pendingId,
            name: 'Pending Test User',
            email: testPendingEmail,
            mobile: '9876543211',
            role: 'restaurant_admin',
            employee_id: `ADM-${pendingId.slice(0, 6)}`,
            status: 'pending',
            approval_status: 'awaiting_admin_approval',
            email_verified: true,
            is_deleted: false,
        });

        await supabaseAdmin.from('auth').insert({
            user_id: pendingId,
            password_hash: passwordHash2,
            failed_attempts: 0,
        });

        const pendingReq = new Request('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testPendingEmail, password: testPassword }),
        });

        const pendingRes = await loginHandler(pendingReq);
        const pendingData = await pendingRes.json();

        check('Pending approval login is blocked with status 403', pendingRes.status === 403);
        check('Error code is ACCOUNT_PENDING_APPROVAL', pendingData.code === 'ACCOUNT_PENDING_APPROVAL');
        check(
            'Displays exact required message: "Your account activation is currently under process. Dine in One will contact you once your account is activated."',
            pendingData.error === 'Your account activation is currently under process. Dine in One will contact you once your account is activated.'
        );

        // ------------------------------------------------------------------
        // TEST 3: Invalid Credentials Protection (No Leaking of Account Info)
        // ------------------------------------------------------------------
        console.log('\n--- TEST 3: Invalid Password Handling ---');
        const invalidReq = new Request('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testPendingEmail, password: 'WrongPassword@999' }),
        });

        const invalidRes = await loginHandler(invalidReq);
        const invalidData = await invalidRes.json();

        check('Invalid credentials blocked with status 401', invalidRes.status === 401);
        check('Generic error prevents email enumeration', invalidData.error === 'Invalid email address or password.');

        // ------------------------------------------------------------------
        // TEST 4: Approved Account Login (Requirement 3)
        // Super Admin approved account (status = active, approval_status = approved)
        // ------------------------------------------------------------------
        console.log('\n--- TEST 4: Approved & Active Account Direct Login ---');
        await cleanupUser(testApprovedEmail);

        const passwordHash3 = await hashPassword(testPassword);
        const approvedId = crypto.randomUUID();

        await supabaseAdmin.from('employees').insert({
            id: approvedId,
            name: 'Approved Test User',
            email: testApprovedEmail,
            mobile: '9876543212',
            role: 'restaurant_admin',
            employee_id: `ADM-${approvedId.slice(0, 6)}`,
            status: 'active',
            approval_status: 'approved',
            email_verified: true,
            is_deleted: false,
        });

        await supabaseAdmin.from('auth').insert({
            user_id: approvedId,
            password_hash: passwordHash3,
            failed_attempts: 0,
        });

        const approvedReq = new Request('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testApprovedEmail, password: testPassword }),
        });

        const approvedRes = await loginHandler(approvedReq);
        const approvedData = await approvedRes.json();

        check('Approved account logs in successfully with status 200', approvedRes.status === 200);
        check('Response success is true', approvedData.success === true);
        check('Redirect URL is provided', approvedData.redirectUrl === '/owner/dashboard');
        check('User payload includes non-sensitive details', approvedData.user?.email === testApprovedEmail);

        // Verify session cookie was set
        const setCookieHeaders = approvedRes.headers.get('set-cookie') || '';
        check('dine_auth_token cookie is issued', setCookieHeaders.includes('dine_auth_token'));

        // Verify session record exists in dine_sessions table
        const { data: sessionRec } = await supabaseAdmin
            .from('dine_sessions')
            .select('*')
            .eq('user_id', approvedId)
            .eq('is_active', true)
            .maybeSingle();

        check('Session record created in dine_sessions table', sessionRec && sessionRec.user_id === approvedId);

        // ------------------------------------------------------------------
        // Clean up test data
        // ------------------------------------------------------------------
        await cleanupUser(testUnverifiedEmail);
        await cleanupUser(testPendingEmail);
        await cleanupUser(testApprovedEmail);

        console.log('\n===============================================================');
        console.log(`🎉 ALL ${passed}/${total} AUTHENTICATION & APPROVAL TESTS PASSED!`);
        console.log('===============================================================\n');

    } catch (err) {
        console.error('Test error:', err);
        process.exit(1);
    }
}

runTests();
