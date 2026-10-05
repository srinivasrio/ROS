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
    
    // Force update role to SUPER_ADMIN
    const { error } = await supabase
        .from('employees')
        .update({ 
            role: 'SUPER_ADMIN',
            status: 'active',
            approval_status: 'approved',
        })
        .eq('id', userId);
    
    console.log('Update:', error ? error.message : '✅ OK');
    
    // Verify immediately
    const { data } = await supabase
        .from('employees')
        .select('role, status, approval_status, super_admin_setup_completed')
        .eq('id', userId)
        .single();
    
    console.log('Verified:', data);
    
    // Also clear rate limits again
    await supabase.from('rate_limits').delete().like('key', `%${userId}%`);
    await supabase.from('auth').update({ failed_attempts: 0, locked_until: null }).eq('user_id', userId);
    console.log('Rate limits & auth cleared');
}

fix().catch(console.error);
