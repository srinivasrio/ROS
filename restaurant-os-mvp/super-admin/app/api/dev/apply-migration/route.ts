import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const MIGRATION_SQL = `
-- 1. Add Super Admin registration and MFA columns to employees table
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS super_admin_setup_completed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS registration_token TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS registration_token_expires_at TIMESTAMPTZ;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS login_verification_token TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS login_verification_token_expires_at TIMESTAMPTZ;

-- 2. Add Super Admin specific columns to auth table
ALTER TABLE public.auth ADD COLUMN IF NOT EXISTS login_email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.auth ADD COLUMN IF NOT EXISTS last_login_verification_sent_at TIMESTAMPTZ;

-- 3. Create index for Super Admin lookup
CREATE INDEX IF NOT EXISTS idx_employees_super_admin ON public.employees (email) WHERE role ILIKE 'SUPER_ADMIN%';

-- 4. Create a bootstrap control table to prevent unauthorized Super Admin registration
CREATE TABLE IF NOT EXISTS public.super_admin_bootstrap (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES public.employees(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert a single bootstrap record (only one allowed)
INSERT INTO public.super_admin_bootstrap (completed) VALUES (false)
ON CONFLICT DO NOTHING;

-- 5. Enable RLS on bootstrap table
ALTER TABLE public.super_admin_bootstrap ENABLE ROW LEVEL SECURITY;

-- Only service_role can manage bootstrap state
DROP POLICY IF EXISTS "Bootstrap Service Role Only" ON public.super_admin_bootstrap;
CREATE POLICY "Bootstrap Service Role Only" ON public.super_admin_bootstrap
FOR ALL TO service_role USING (true) WITH CHECK (true);
`;

export async function POST() {
    try {
        const statements = MIGRATION_SQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        const results = [];
        
        for (const stmt of statements) {
            if (!stmt) continue;
            try {
                // Use raw query via Supabase - we need to use a workaround
                // Since we can't execute DDL directly, we'll use the pg driver approach
                // For now, return the statements that need to be run manually
                results.push({ statement: stmt.substring(0, 100), status: 'needs_manual_execution' });
            } catch (e: any) {
                results.push({ statement: stmt.substring(0, 100), status: 'error', error: e.message });
            }
        }

        return NextResponse.json({ 
            message: 'Migration statements ready - execute manually in Supabase SQL Editor',
            statements: results,
            sql: MIGRATION_SQL
        });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}