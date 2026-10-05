import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'super-admin/.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmcsygpphwdubnanwjwz.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// Try to check if tables/columns exist first
async function checkSchema() {
    console.log('=== Checking current schema ===');
    
    // Check employees columns
    const { data: emp, error: empErr } = await supabase
        .from('employees')
        .select('id, super_admin_setup_completed, email_verified_at, registration_token, registration_token_expires_at, login_verification_token, login_verification_token_expires_at')
        .limit(1);
    console.log('Employees table:', empErr ? empErr.message : 'OK - columns exist');
    
    // Check auth columns
    const { data: auth, error: authErr } = await supabase
        .from('auth')
        .select('login_email_verified, last_login_verification_sent_at')
        .limit(1);
    console.log('Auth table:', authErr ? authErr.message : 'OK - columns exist');
    
    // Check bootstrap table
    const { data: boot, error: bootErr } = await supabase
        .from('super_admin_bootstrap')
        .select('*');
    console.log('Bootstrap table:', bootErr ? bootErr.message : 'OK', boot);
    
    // Check recovery_codes
    const { data: rc, error: rcErr } = await supabase
        .from('recovery_codes')
        .select('*')
        .limit(1);
    console.log('Recovery codes:', rcErr ? rcErr.message : 'OK');
}

checkSchema().catch(console.error);
