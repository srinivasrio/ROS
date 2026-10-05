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
    
    // 1. Update role to SUPER_ADMIN
    const { error: empErr } = await supabase
        .from('employees')
        .update({ 
            role: 'SUPER_ADMIN',
            status: 'active',
            approval_status: 'approved',
        })
        .eq('id', userId);
    
    console.log('Employee update:', empErr ? empErr.message : 'OK');
    
    // 2. Clear any rate limits
    const { error: rlErr } = await supabase
        .from('rate_limits')
        .delete()
        .like('key', `%${userId}%`);
    
    console.log('Rate limits cleared:', rlErr ? rlErr.message : 'OK');
    
    // 3. Clear auth failed attempts
    const { error: authErr } = await supabase
        .from('auth')
        .update({ 
            failed_attempts: 0,
            locked_until: null,
        })
        .eq('user_id', userId);
    
    console.log('Auth reset:', authErr ? authErr.message : 'OK');
    
    // 4. Clear any login verification tokens (they may be expired)
    const { error: tokenErr } = await supabase
        .from('employees')
        .update({ 
            login_verification_token: null,
            login_verification_token_expires_at: null,
        })
        .eq('id', userId);
    
    console.log('Token cleared:', tokenErr ? tokenErr.message : 'OK');
    
    console.log('\n✅ Fixed! Now try login again.');
    console.log('The account will need TOTP setup on first login after role change.');
}

fix().catch(console.error);
