import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'super-admin/.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmcsygpphwdubnanwjwz.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function fix() {
    const userId = '6f0770d2-9826-4805-93eb-bb9f86b38647';
    
    // Update role to SUPER_ADMIN and fix status
    const { error } = await supabase
        .from('employees')
        .update({ 
            role: 'SUPER_ADMIN',
            status: 'active',
            approval_status: 'approved',
        })
        .eq('id', userId);
    
    console.log('Update:', error ? error.message : '✅ OK');
    
    // Verify
    const { data } = await supabase
        .from('employees')
        .select('role, status, approval_status')
        .eq('id', userId)
        .single();
    
    console.log('Verified:', data);
}

fix().catch(console.error);
