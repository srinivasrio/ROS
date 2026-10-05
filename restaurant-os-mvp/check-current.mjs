import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'super-admin/.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmcsygpphwdubnanwjwz.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function check() {
    const { data: emp, error } = await supabase
        .from('employees')
        .select('*')
        .eq('email', 'hellodineinone@gmail.com')
        .maybeSingle();
    
    console.log('Employee:', JSON.stringify(emp, null, 2));
}

check().catch(console.error);
