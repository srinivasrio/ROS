-- Migration: Email OTP Verification System for Dine in One Registration
-- Date: 2026-10-01
-- Description: Dedicated OTP verification records for registration email verification with rate limits and attempt tracking.

CREATE TABLE IF NOT EXISTS public.email_otp_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    is_used BOOLEAN NOT NULL DEFAULT false,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    verified_at TIMESTAMPTZ,
    last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resend_available_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '60 seconds'),
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices for rapid lookup and security checks
CREATE INDEX IF NOT EXISTS idx_email_otp_email ON public.email_otp_verifications (lower(email));
CREATE INDEX IF NOT EXISTS idx_email_otp_expires_at ON public.email_otp_verifications (expires_at);
CREATE INDEX IF NOT EXISTS idx_email_otp_active ON public.email_otp_verifications (lower(email), is_used, expires_at);

-- Row Level Security
ALTER TABLE public.email_otp_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role access for email_otp_verifications" ON public.email_otp_verifications;
CREATE POLICY "Service role access for email_otp_verifications"
ON public.email_otp_verifications
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Ensure employees table has email_verified flag
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
