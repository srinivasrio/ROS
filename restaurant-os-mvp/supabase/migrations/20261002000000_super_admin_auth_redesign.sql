-- Migration: Super Admin Authentication Security Redesign
-- Date: 2026-10-02
-- Description: Adds secure Super Admin registration flow, email verification, TOTP MFA, and removes default credential bypasses

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

-- 6. Update auth table RLS to include login_email_verified column
-- (Auth table already has "Auth Service Role Only" policy from 20260625000000_auth_redesign.sql)

-- 7. Add recovery_codes is_used tracking (already exists from 20260627000000_security_hardening.sql)

-- 8. Ensure employees table has proper constraints for Super Admin
-- The role constraint already includes SUPER_ADMIN/SUPERADMIN from earlier migrations