import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createDualSupabaseClient } from './dual-supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_PRIMARY_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDatabase = { public: any };
type AdminClient = SupabaseClient<AnyDatabase>;

function createFailClosedAdminProxy(reason: string): AdminClient {
    return new Proxy({} as AdminClient, {
        get(_target, prop) {
            if (prop === 'then') return undefined;
            return () => {
                throw new Error(reason);
            };
        },
    });
}

const isConfigured = Boolean(supabaseUrl && supabaseKey);

const primaryAdmin: AdminClient = isConfigured
    ? createClient<AnyDatabase>(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    })
    : createFailClosedAdminProxy(
        'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured for server admin queries.'
    );

const secondaryUrl = process.env.SECONDARY_SUPABASE_URL;
const secondaryKey = process.env.SECONDARY_SUPABASE_SERVICE_ROLE_KEY;

const secondaryAdmin =
    isConfigured && secondaryUrl && secondaryKey
        ? createClient<AnyDatabase>(secondaryUrl, secondaryKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        })
        : null;

export const supabaseAdmin = isConfigured
    ? createDualSupabaseClient(primaryAdmin, secondaryAdmin)
    : primaryAdmin;
export { primaryAdmin, secondaryAdmin };
