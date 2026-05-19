import { createClient } from '@supabase/supabase-js'

// Secondary Supabase for SaaS Global data (uses service role key to bypass RLS)
export const saasSupabase = createClient(
  process.env.NEXT_PUBLIC_SAAS_SUPABASE_URL!,
  process.env.SAAS_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SAAS_SUPABASE_ANON_KEY!
)

// Primary Supabase for reading public restaurant data (read-only, anon key)
export const primarySupabase = createClient(
  process.env.NEXT_PUBLIC_PRIMARY_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_PRIMARY_SUPABASE_ANON_KEY!
)

// Primary Supabase ADMIN client - uses service role key to bypass RLS for approval operations
export const primarySupabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_PRIMARY_SUPABASE_URL!,
  process.env.PRIMARY_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_PRIMARY_SUPABASE_ANON_KEY!
)
