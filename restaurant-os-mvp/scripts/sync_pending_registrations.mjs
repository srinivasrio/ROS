import { createClient } from '@supabase/supabase-js';
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

async function main() {
    console.log('Finding all email-verified employees waiting for approval...');

    const { data: verifiedEmployees } = await supabaseAdmin
        .from('employees')
        .select('id, name, email, mobile, status, approval_status, email_verified')
        .eq('email_verified', true)
        .neq('status', 'active');

    console.log(`Found ${verifiedEmployees?.length || 0} verified pending employees:`, verifiedEmployees);

    for (const emp of verifiedEmployees || []) {
        console.log(`Syncing registration request for ${emp.email} (${emp.name})...`);
        await EmailOtpService.createPendingRegistrationRequest(emp.email);
    }

    console.log('Sync complete!');
}

main();
