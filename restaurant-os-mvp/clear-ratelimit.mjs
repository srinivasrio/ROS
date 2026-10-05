import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'super-admin/.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmcsygpphwdubnanwjwz.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function clear() {
    const userId = '6f0770d2-9826-4805-93eb-bb9f86b38647';
    
    // Clear rate limits for this user and common IP patterns
    const patterns = [
        `ip:%:super_admin_login_initiate`,
        `ip:%:super_admin_login_verify_email`,
        `ip:%:super_admin_login_verify_totp`,
        `actor:${userId}:change_email`,
        `ip:%:super_admin_register`,
        `ip:%:super_admin_verify_email`,
        `ip:%:super_admin_verify_totp`,
    ];
    
    for (const pattern of patterns) {
        const { error } = await supabase
            .from('rate_limits')
            .delete()
            .like('key', pattern);
        console.log(`Cleared ${pattern}:`, error ? error.message : 'OK');
    }
    
    // Also clear any for this specific user ID
    const { error: err2 } = await supabase
        .from('rate_limits')
        .delete()
        .like('key', `%${userId}%`);
    console.log(`Cleared user ${userId}:`, err2 ? err2.message : 'OK');
    
    // Reset auth failed attempts
    await supabase
        .from('auth')
        .update({ failed_attempts: 0, locked_until: null })
        .eq('user_id', userId);
    console.log('Auth failed attempts reset: OK');
    
    console.log('\n✅ All rate limits cleared. Try login again.');
}

clear().catch(console.error);
