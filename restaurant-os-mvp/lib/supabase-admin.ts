import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_PRIMARY_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = 
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    'placeholder_service_role_key';

export const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseKey,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    }
);
