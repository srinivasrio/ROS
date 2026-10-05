import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'super-admin/.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmcsygpphwdubnanwjwz.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function clear() {
    // Clear all used OTPs for this email
    const { error } = await supabase
        .from('email_otp_verifications')
        .delete()
        .eq('email', 'hellodineinone@gmail.com');
    
    console.log('Cleared OTPs:', error ? error.message : 'OK');
    
    // Clear login tokens
    await supabase
        .from('employees')
        .update({ 
            login_verification_token: null,
            login_verification_token_expires_at: null,
        })
        .eq('email', 'hellodineinone@gmail.com');
    
    console.log('Cleared login tokens: OK');
    console.log('\n✅ Now run Step 1 fresh:');
    console.log('curl -X POST http://control.localhost:3005/api/auth/super-admin/login/initiate ...');
}

clear().catch(console.error);
