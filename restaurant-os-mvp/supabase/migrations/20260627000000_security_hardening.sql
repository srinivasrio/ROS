-- Migration: Dine In One Security Hardening Layer
-- Date: 2026-06-27

-- 1. Add email change validation columns to employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pending_email TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS email_change_token TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS email_change_token_created_at TIMESTAMPTZ;

-- 2. Create public.recovery_codes table
CREATE TABLE IF NOT EXISTS public.recovery_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT false,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create public.password_history table
CREATE TABLE IF NOT EXISTS public.password_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create public.rate_limits table
CREATE TABLE IF NOT EXISTS public.rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    request_count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_until TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS rate_limits_key_idx ON public.rate_limits (key);

-- 5. Create public.sent_emails table (Mock mailbox for verification/alert history)
CREATE TABLE IF NOT EXISTS public.sent_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Create public.security_alerts table (Anomaly warnings)
CREATE TABLE IF NOT EXISTS public.security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    details JSONB,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Fix foreign key referencing on public.dine_sessions (re-link user_id to employees)
ALTER TABLE public.dine_sessions DROP CONSTRAINT IF EXISTS dine_sessions_user_id_fkey;
ALTER TABLE public.dine_sessions ADD CONSTRAINT dine_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.employees(id) ON DELETE CASCADE;

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.recovery_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sent_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

-- 9. Create Access Policies matching project patterns
DROP POLICY IF EXISTS "Recovery Codes Self Access" ON public.recovery_codes;
CREATE POLICY "Recovery Codes Self Access" ON public.recovery_codes
FOR ALL USING (
    current_user_claims() ->> 'role' = 'SUPER_ADMIN' OR
    user_id = (current_user_claims() ->> 'userId')::uuid
);

DROP POLICY IF EXISTS "Password History Self Access" ON public.password_history;
CREATE POLICY "Password History Self Access" ON public.password_history
FOR ALL USING (
    current_user_claims() ->> 'role' = 'SUPER_ADMIN' OR
    user_id = (current_user_claims() ->> 'userId')::uuid
);

DROP POLICY IF EXISTS "Sent Emails Access" ON public.sent_emails;
CREATE POLICY "Sent Emails Access" ON public.sent_emails
FOR ALL USING (
    current_user_claims() ->> 'role' = 'SUPER_ADMIN' OR
    current_user_claims() ->> 'role' = 'restaurant_admin'
);

DROP POLICY IF EXISTS "Security Alerts Access" ON public.security_alerts;
CREATE POLICY "Security Alerts Access" ON public.security_alerts
FOR ALL USING (
    current_user_claims() ->> 'role' = 'SUPER_ADMIN' OR
    current_user_claims() ->> 'role' = 'restaurant_admin'
);
