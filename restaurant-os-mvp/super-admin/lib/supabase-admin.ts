import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_PRIMARY_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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

export const supabaseAdmin: AdminClient =
    supabaseUrl && supabaseServiceRoleKey
        ? createClient<AnyDatabase>(supabaseUrl, supabaseServiceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        })
        : createFailClosedAdminProxy(
            'Super Admin: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.'
        );
