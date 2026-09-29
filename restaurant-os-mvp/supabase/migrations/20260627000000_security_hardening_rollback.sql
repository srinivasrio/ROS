-- Migration Rollback: Dine In One Security Hardening Layer
-- Date: 2026-06-27

-- 1. Drop Access Policies
DROP POLICY IF EXISTS "Recovery Codes Self Access" ON public.recovery_codes;
DROP POLICY IF EXISTS "Password History Self Access" ON public.password_history;
DROP POLICY IF EXISTS "Sent Emails Access" ON public.sent_emails;
DROP POLICY IF EXISTS "Security Alerts Access" ON public.security_alerts;

-- 2. Restore public.dine_sessions foreign key to original view status (omit FK reference)
ALTER TABLE public.dine_sessions DROP CONSTRAINT IF EXISTS dine_sessions_user_id_fkey;

-- 3. Drop Tables
DROP TABLE IF EXISTS public.recovery_codes CASCADE;
DROP TABLE IF EXISTS public.password_history CASCADE;
DROP TABLE IF EXISTS public.rate_limits CASCADE;
DROP TABLE IF EXISTS public.sent_emails CASCADE;
DROP TABLE IF EXISTS public.security_alerts CASCADE;

-- 4. Drop columns from employees
ALTER TABLE public.employees DROP COLUMN IF EXISTS pending_email;
ALTER TABLE public.employees DROP COLUMN IF EXISTS email_change_token;
ALTER TABLE public.employees DROP COLUMN IF EXISTS email_change_token_created_at;
