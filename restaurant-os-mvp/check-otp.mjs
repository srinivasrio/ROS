import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: 'super-admin/.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmcsygpphwdubnanwjwz.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function check() {
    const email = 'hellodineinone@gmail.com';

    // 1. Fetch latest active OTP record
    const { data: otp, error } = await supabase
        .from('email_otp_verifications')
        .select('*')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!otp) {
        console.log('No OTP records found for', email);
        return;
    }

    const isExpired = new Date(otp.expires_at) < new Date();
    const secret = process.env.OTP_HASH_SECRET || SERVICE_KEY;

    let plaintextOtp = null;
    if (otp.otp_hash) {
        for (let i = 100000; i <= 999999; i++) {
            const candidate = String(i);
            const hash = crypto.createHmac('sha256', secret).update(`${email}:${candidate}`).digest('hex');
            if (hash === otp.otp_hash) {
                plaintextOtp = candidate;
                break;
            }
        }
    }

    console.log('==============================================');
    console.log(`🔑 ACTIVE 6-DIGIT EMAIL CODE: [ ${plaintextOtp || 'UNKNOWN'} ]`);
    console.log(`Status: ${isExpired ? '❌ EXPIRED' : '✅ VALID'} (Expires: ${otp.expires_at})`);
    console.log(`Is Used: ${otp.is_used ? 'YES' : 'NO'}`);
    console.log('==============================================');

    // 2. Check employee status
    const { data: emp } = await supabase
        .from('employees')
        .select('id, name, email, role, status, login_verification_token')
        .eq('email', email)
        .maybeSingle();

    console.log(`Super Admin: ${emp?.name} (${emp?.email}) | Role: ${emp?.role} | Status: ${emp?.status}`);
    console.log(`Login Token: ${emp?.login_verification_token ? 'Present' : 'None'}`);
}

check().catch(console.error);
