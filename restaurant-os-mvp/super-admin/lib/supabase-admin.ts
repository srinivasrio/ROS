import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmcsygpphwdubnanwjwz.supabase.co';
const supabaseServiceRoleKey = 
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
    'placeholder-service-key';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️ Super Admin: SUPABASE_SERVICE_ROLE_KEY is missing. Privileged operations may fail.');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
