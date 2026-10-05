-- Migration: Restaurant/Branch Registration and Subscription Workflow
-- Date: 2026-10-01
-- Description: Creates restaurant_registration_requests table, updates restaurant lifecycle statuses,
--              and adds custom_quota tracking for manual Super Admin quota overrides.

-- Create restaurant_registration_requests table
CREATE TABLE IF NOT EXISTS public.restaurant_registration_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number TEXT UNIQUE,
    owner_id UUID NOT NULL,
    owner_name TEXT,
    owner_email TEXT,
    owner_phone TEXT,
    restaurant_id TEXT NOT NULL,
    restaurant_name TEXT NOT NULL,
    restaurant_code TEXT,
    restaurant_phone TEXT,
    restaurant_email TEXT,
    restaurant_address TEXT,
    admin_name TEXT,
    admin_email TEXT,
    admin_mobile TEXT,
    admin_password TEXT,
    admin_pin TEXT,
    plan_slug TEXT NOT NULL DEFAULT 'standard',
    plan_name TEXT NOT NULL DEFAULT 'Standard',
    plan_limit INT NOT NULL DEFAULT 1,
    custom_quota INT,
    requested_count INT NOT NULL DEFAULT 1,
    amount_due NUMERIC NOT NULL DEFAULT 999.00,
    currency TEXT NOT NULL DEFAULT 'INR',
    payment_status TEXT NOT NULL DEFAULT 'PENDING',
    payment_method TEXT DEFAULT 'MANUAL',
    payment_reference TEXT,
    payment_verified_at TIMESTAMPTZ,
    payment_verified_by TEXT,
    approval_status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    rejection_reason TEXT,
    super_admin_notes TEXT,
    approved_at TIMESTAMPTZ,
    approved_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS and add policy
ALTER TABLE public.restaurant_registration_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service_role and anon access to registration requests" ON public.restaurant_registration_requests;
CREATE POLICY "Allow service_role and anon access to registration requests"
ON public.restaurant_registration_requests
USING (true)
WITH CHECK (true);

-- Update restaurants_status_check
ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_status_check;
ALTER TABLE public.restaurants ADD CONSTRAINT restaurants_status_check
CHECK ((lower(status) = ANY (ARRAY[
    'pending'::text, 
    'pending_payment'::text, 
    'pending_approval'::text, 
    'payment_received'::text, 
    'draft'::text, 
    'contacted'::text, 
    'onboarding'::text, 
    'verification'::text, 
    'plan_assigned'::text, 
    'approved'::text, 
    'active'::text, 
    'rejected'::text, 
    'cancelled'::text, 
    'suspended'::text, 
    'changes_requested'::text,
    'trial'::text,
    'deactivated'::text,
    'deletion_requested'::text,
    'soft_deleted'::text
])));

-- Add optional custom_quota and registration_request_id columns
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS custom_quota INT;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS registration_request_id UUID;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS custom_quota INT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved';
