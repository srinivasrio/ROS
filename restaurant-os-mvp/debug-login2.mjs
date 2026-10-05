import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'super-admin/.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmcsygpphwdubnanwjwz.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function debug() {
    const email = 'hellodineinone@gmail.com';
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
