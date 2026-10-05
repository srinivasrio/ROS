import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import argon2 from 'argon2';

dotenv.config({ path: 'super-admin/.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmcsygpphwdubnanwjwz.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function debug() {
    const email = 'hellodineinone@gmail.com';
    const password = 'Sree@17251725';
    const cleanEmail = email.toLowerCase().trim();
    
    // Test the exact query from login/initiate
    const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('email', cleanEmail)
        .eq('is_deleted', false)
        .ilike('role', 'SUPER_ADMIN%');
    
    console.log('Employees query:', empError ? empError.message : `${employees?.length} results`);
    if (employees?.length) {
        console.log('Employee:', JSON.stringify(employees[0], null, 2));
        
        // Check auth record
        const { data: authRecord } = await supabase
            .from('auth')
            .select('*')
            .eq('user_id', employees[0].id)
            .maybeSingle();
        
        console.log('\nAuth record:', JSON.stringify(authRecord, null, 2));
        
        // Test password verification
        if (authRecord?.password_hash) {
            console.log('\nTesting password verification...');
            console.log('Hash starts with $argon2:', authRecord.password_hash.startsWith('$argon2'));
            
            try {
                const valid = await argon2.verify(authRecord.password_hash, password);
                console.log('Password valid:', valid);
            } catch (e) {
                console.log('Argon2 error:', e.message);
            }
        }
    }
}

debug().catch(console.error);
