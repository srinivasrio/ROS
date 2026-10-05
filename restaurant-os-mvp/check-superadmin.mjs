import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'super-admin/.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmcsygpphwdubnanwjwz.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function check() {
    // Check employees table
    const { data: emp, error: empErr } = await supabase
        .from('employees')
        .select('*')
        .ilike('email', 'hellodineinone@gmail.com')
        .maybeSingle();
    
    console.log('=== Employee ===');
    console.log(empErr ? empErr.message : JSON.stringify(emp, null, 2));
    
    // Check auth table
    if (emp?.id) {
        const { data: auth, error: authErr } = await supabase
            .from('auth')
            .select('*')
            .eq('user_id', emp.id)
            .maybeSingle();
        
        console.log('\n=== Auth ===');
        console.log(authErr ? authErr.message : JSON.stringify(auth, null, 2));
    }
}

check().catch(console.error);
