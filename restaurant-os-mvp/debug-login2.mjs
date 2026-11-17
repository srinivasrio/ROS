import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

if (fs.existsSync('.env.local')) {
    dotenv.config({ path: '.env.local' });
} else if (fs.existsSync('super-admin/.env.local')) {
    dotenv.config({ path: 'super-admin/.env.local' });
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function debug() {
    const email = process.env.DEBUG_USER_EMAIL || process.argv[2];
    if (!email) {
        console.error('Usage: DEBUG_USER_EMAIL=... node debug-login2.mjs');
        console.error('   or: node debug-login2.mjs <email>');
        process.exit(1);
    }
    const cleanEmail = email.toLowerCase().trim();
    
    // Test without role filter
    const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('email', cleanEmail)
        .eq('is_deleted', false);
    
    console.log('Without role filter:', empError ? empError.message : `${employees?.length} results`);
    if (employees?.length) {
        console.log('Role:', employees[0].role);
        console.log('Role (upper):', employees[0].role?.toUpperCase());
        console.log('Status:', employees[0].status);
        console.log('Approval:', employees[0].approval_status);
        console.log('Setup completed:', employees[0].super_admin_setup_completed);
    }
    
    // Test with exact role match
    const { data: exact } = await supabase
        .from('employees')
        .select('*')
        .eq('email', cleanEmail)
        .eq('is_deleted', false)
        .eq('role', 'SUPER_ADMIN');
    console.log('\nExact role match:', exact?.length);
    
    // Test ilike
    const { data: ilike } = await supabase
        .from('employees')
        .select('*')
        .eq('email', cleanEmail)
        .eq('is_deleted', false)
        .ilike('role', 'SUPER_ADMIN%');
    console.log('ILIKE match:', ilike?.length);
}

debug().catch(console.error);
