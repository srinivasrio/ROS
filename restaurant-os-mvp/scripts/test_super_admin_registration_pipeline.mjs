import { createClient } from '@supabase/supabase-js';
import assert from 'assert';
import { hashPassword } from '../lib/auth-utils.ts';
import { hashOtp } from '../lib/email-otp.ts';
import { EmailOtpService } from '../lib/email-otp.ts';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmcsygpphwdubnanwjwz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY missing');
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
    const { data: emp } = await supabaseAdmin.from('employees').select('id, restaurant_id').ilike('email', email).maybeSingle();
    if (emp?.id) {
        await supabaseAdmin.from('dine_sessions').delete().eq('user_id', emp.id);
        await supabaseAdmin.from('auth').delete().eq('user_id', emp.id);
        await supabaseAdmin.from('restaurant_registration_requests').delete().eq('owner_id', emp.id);
        await supabaseAdmin.from('restaurant_users').delete().eq('user_id', emp.id);
        await supabaseAdmin.from('notifications').delete().ilike('message', `%${email}%`);
        if (emp.restaurant_id) {
            await supabaseAdmin.from('branches').delete().eq('restaurant_id', emp.restaurant_id);
            await supabaseAdmin.from('restaurants').delete().eq('id', emp.restaurant_id);
        }
        await supabaseAdmin.from('employees').delete().eq('id', emp.id);
    }
    await supabaseAdmin.from('email_otp_verifications').delete().ilike('email', email);
}

async function runTests() {
    console.log('\n===============================================================');
    console.log('🧪 TESTING SUPER ADMIN REGISTRATION PIPELINE END-TO-END');
    console.log('===============================================================\n');

    const testEmail = `sa.pipeline.${Date.now()}@dineinone.test`;
    const testPassword = 'Password@123';
    const testName = 'Test Owner Pipeline';
    const testPhone = '9876543299';

    try {
        await cleanupUser(testEmail);

        // -------------------------------------------------------------
        // Step 1: User registers on main website (POST /api/auth/register)
        // -------------------------------------------------------------
        console.log('--- Step 1: Account Registration ---');
        const { POST: registerHandler } = await import('../app/api/auth/register/route.ts');
        const regReq = new Request('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fullName: testName,
                email: testEmail,
                phone: testPhone,
                password: testPassword,
            }),
        });

        const regRes = await registerHandler(regReq);
        const regData = await regRes.json();
        check('Registration succeeds', regRes.status === 200 && regData.success);

        // Verify employee created with pending verification
        const { data: empAfterReg } = await supabaseAdmin
            .from('employees')
            .select('*')
            .ilike('email', testEmail)
            .single();

        check('Employee created in DB', empAfterReg?.id);
        check('Email verified is false initially', empAfterReg.email_verified === false);
        check('Status is pending initially', empAfterReg.status === 'pending');

        // -------------------------------------------------------------
        // Step 2: User completes Email OTP Verification (POST /api/auth/verify-otp)
        // -------------------------------------------------------------
        console.log('\n--- Step 2: Email OTP Verification ---');
        const { data: otpRec } = await supabaseAdmin
            .from('email_otp_verifications')
            .select('*')
            .ilike('email', testEmail)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        // In test mode, create a known OTP
        const testOtp = '739281';
        const testOtpHash = hashOtp(testEmail, testOtp);
        await supabaseAdmin
            .from('email_otp_verifications')
            .update({ otp_hash: testOtpHash })
            .eq('id', otpRec.id);

        const { POST: verifyHandler } = await import('../app/api/auth/verify-otp/route.ts');
        const verifyReq = new Request('http://localhost:3000/api/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail, otp: testOtp }),
        });

        const verifyRes = await verifyHandler(verifyReq);
        const verifyData = await verifyRes.json();
        check('Email OTP verification succeeds', verifyRes.status === 200 && verifyData.success);

        // -------------------------------------------------------------
        // Step 3: Verify Super Admin Request is Generated
        // -------------------------------------------------------------
        console.log('\n--- Step 3: Super Admin Queue Verification ---');
        const { data: saReq } = await supabaseAdmin
            .from('restaurant_registration_requests')
            .select('*')
            .eq('owner_id', empAfterReg.id)
            .maybeSingle();

        check('Registration request exists in restaurant_registration_requests', saReq?.id);
        check('Request status is PENDING_APPROVAL', saReq.approval_status === 'PENDING_APPROVAL');
        check('Request number is generated', saReq.request_number?.startsWith('REQ-'));
        check('Associated restaurant record is created', saReq.restaurant_id);

        // Verify Super Admin notification
        const { data: saNotif } = await supabaseAdmin
            .from('notifications')
            .select('*')
            .ilike('message', `%${testEmail}%`)
            .maybeSingle();

        check('Notification dispatched for Super Admin', saNotif && saNotif.type === 'registration_request');
        check('Notification is marked unread', saNotif.is_read === false);

        // -------------------------------------------------------------
        // Step 4: Login Attempt while Awaiting Approval (Requirement 2)
        // -------------------------------------------------------------
        console.log('\n--- Step 4: Login Before Approval ---');
        const { POST: loginHandler } = await import('../app/api/auth/login/route.ts');
        const loginBeforeReq = new Request('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail, password: testPassword }),
        });

        const loginBeforeRes = await loginHandler(loginBeforeReq);
        const loginBeforeData = await loginBeforeRes.json();

        check('Login before approval is blocked (403)', loginBeforeRes.status === 403);
        check('Code is ACCOUNT_PENDING_APPROVAL', loginBeforeData.code === 'ACCOUNT_PENDING_APPROVAL');
        check(
            'Exact pending message returned',
            loginBeforeData.error === 'Your account activation is currently under process. Dine in One will contact you once your account is activated.'
        );

        // -------------------------------------------------------------
        // Step 5: Super Admin Approves Request
        // -------------------------------------------------------------
        console.log('\n--- Step 5: Super Admin Approves Request ---');
        
        // Approve registration via database mutation matching super-admin endpoint behavior
        await supabaseAdmin
            .from('restaurant_registration_requests')
            .update({
                approval_status: 'ACTIVE',
                payment_status: 'RECEIVED',
                approved_at: new Date().toISOString(),
                approved_by: 'superadmin-test@dineinone.com',
            })
            .eq('id', saReq.id);

        await supabaseAdmin
            .from('restaurants')
            .update({ status: 'ACTIVE' })
            .eq('id', saReq.restaurant_id);

        await supabaseAdmin
            .from('employees')
            .update({ status: 'active', approval_status: 'approved' })
            .eq('id', empAfterReg.id);

        // -------------------------------------------------------------
        // Step 6: Approved Owner Logs In Directly (Requirement 3)
        // -------------------------------------------------------------
        console.log('\n--- Step 6: Login After Approval ---');
        const loginAfterReq = new Request('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail, password: testPassword }),
        });

        const loginAfterRes = await loginHandler(loginAfterReq);
        const loginAfterData = await loginAfterRes.json();

        check('Login succeeds after approval (200)', loginAfterRes.status === 200 && loginAfterData.success);
        check('Redirect URL is /owner/dashboard', loginAfterData.redirectUrl === '/owner/dashboard');
        check('Session cookie issued', (loginAfterRes.headers.get('set-cookie') || '').includes('dine_auth_token'));

        // Cleanup
        await cleanupUser(testEmail);

        console.log('\n===============================================================');
        console.log(`🎉 ALL ${passed}/${total} PIPELINE TESTS PASSED SUCCESSFULLY!`);
        console.log('===============================================================\n');

    } catch (err) {
        console.error('Pipeline test error:', err);
        process.exit(1);
    }
}

runTests();
