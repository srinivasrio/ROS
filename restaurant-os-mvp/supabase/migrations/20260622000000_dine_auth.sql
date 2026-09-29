-- Migration: Dine in One Role-Based Authentication
-- Date: 2026-06-22

-- 1. Create User table
CREATE TABLE IF NOT EXISTS public.dine_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    employee_id TEXT UNIQUE,
    pin_hash TEXT,
    password_hash TEXT,
    role TEXT NOT NULL CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'WAITER', 'CHEF')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    restaurant_id TEXT,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user queries
CREATE INDEX IF NOT EXISTS idx_dine_users_employee_id ON public.dine_users(employee_id);
CREATE INDEX IF NOT EXISTS idx_dine_users_email ON public.dine_users(email);

-- 2. Create OTP storage table (for 2FA)
CREATE TABLE IF NOT EXISTS public.user_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.dine_users(id) ON DELETE CASCADE,
    otp_code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for expiring old OTPs
CREATE INDEX IF NOT EXISTS idx_user_otps_expiry ON public.user_otps(expires_at);

-- 3. Create Shift log table (for Waiters)
CREATE TABLE IF NOT EXISTS public.waiter_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.dine_users(id) ON DELETE CASCADE,
    login_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    logout_time TIMESTAMPTZ,
    shift_name TEXT NOT NULL, -- e.g., 'Morning', 'Afternoon', 'Evening', 'Night'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create Audit Logs table
CREATE TABLE IF NOT EXISTS public.login_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.dine_users(id) ON DELETE SET NULL,
    employee_id TEXT,
    role TEXT,
    action TEXT NOT NULL, -- e.g. 'login_attempt', 'login_success', '2fa_sent', '2fa_success', 'logout', 'failed_login_attempt'
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Enable Row Level Security (RLS) on all new tables
ALTER TABLE public.dine_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiter_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_audit_logs ENABLE ROW LEVEL SECURITY;

-- Note: We do not expose public policies for these tables. 
-- All auth operations run in Next.js Server Side Functions using the service role key,
-- protecting them from client-side scraping.
