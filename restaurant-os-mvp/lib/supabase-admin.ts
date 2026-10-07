import { createClient } from '@supabase/supabase-js';
import { createDualSupabaseClient } from './dual-supabase';


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_PRIMARY_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = 
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    'placeholder_service_role_key';

const primaryAdmin = createClient(
    supabaseUrl,
    supabaseKey,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    }
);

const secondaryUrl = process.env.SECONDARY_SUPABASE_URL;
const secondaryKey = process.env.SECONDARY_SUPABASE_SERVICE_ROLE_KEY;

const secondaryAdmin = (secondaryUrl && secondaryKey)
    ? createClient(secondaryUrl, secondaryKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    })
    : null;

export const supabaseAdmin = createDualSupabaseClient(primaryAdmin, secondaryAdmin);
export { primaryAdmin, secondaryAdmin };
