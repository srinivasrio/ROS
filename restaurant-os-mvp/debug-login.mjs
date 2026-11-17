import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import argon2 from 'argon2';
import fs from 'fs';

// Try loading environment files
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
    const password = process.env.DEBUG_USER_PASSWORD || process.argv[3];

    if (!email || !password) {
        console.error('Usage: DEBUG_USER_EMAIL=... DEBUG_USER_PASSWORD=... node debug-login.mjs');
        console.error('   or: node debug-login.mjs <email> <password>');
        process.exit(1);
    }

    const cleanEmail = email.toLowerCase().trim();
    
    // Test the query from login/initiate
    const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('email', cleanEmail)
        .eq('is_deleted', false)
        .ilike('role', 'SUPER_ADMIN%');
    
    console.log('Employees query:', empError ? empError.message : `${employees?.length} results`);
    if (employees?.length) {
        console.log('Employee found:', employees[0].id, employees[0].role);
        
        // Check auth record
        const { data: authRecord } = await supabase
            .from('auth')
            .select('*')
            .eq('user_id', employees[0].id)
            .maybeSingle();
        
        console.log('\nAuth record present:', Boolean(authRecord));
        
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
