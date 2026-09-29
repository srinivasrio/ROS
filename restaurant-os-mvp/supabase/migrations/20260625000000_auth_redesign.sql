-- Migration: Complete Authentication, Authorization, Employee Onboarding Redesign
-- Date: 2026-06-25

-- 1. Update existing restaurants to approved status so check constraint doesn't fail
UPDATE public.restaurants SET status = 'approved' WHERE status = 'active' OR status IS NULL;

-- 2. Add subscription column and copy from subscription_plan if not exist
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS subscription TEXT;
UPDATE public.restaurants SET subscription = subscription_plan WHERE subscription IS NULL;

-- 3. Add constraint to restaurants status
ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_status_check;
ALTER TABLE public.restaurants ADD CONSTRAINT restaurants_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested'));

-- 4. Update audit_staff_changes function to support null restaurant_id (for Super Admin)
CREATE OR REPLACE FUNCTION public.audit_staff_changes()
RETURNS trigger AS $$
BEGIN
    IF COALESCE(NEW.restaurant_id, OLD.restaurant_id) IS NOT NULL THEN
        INSERT INTO public.activity_logs (restaurant_id, user_id, action, module, details)
        VALUES (
            COALESCE(NEW.restaurant_id, OLD.restaurant_id),
            auth.uid(),
            TG_OP,
            'staff',
            jsonb_build_object('id', COALESCE(NEW.id, OLD.id), 'name', COALESCE(NEW.name, OLD.name))
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Rename public.staff table to public.employees
ALTER TABLE public.staff RENAME TO employees;

-- 5b. Drop NOT NULL constraints on mobile and restaurant_id columns
ALTER TABLE public.employees ALTER COLUMN mobile DROP NOT NULL;
ALTER TABLE public.employees ALTER COLUMN restaurant_id DROP NOT NULL;

-- 6. Add new columns to public.employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS activation_token TEXT;

-- 7. Update approval_status constraint and default
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_approval_status_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_approval_status_check CHECK (approval_status IN ('pending_verification', 'awaiting_admin_approval', 'approved', 'rejected', 'suspended'));

-- Set default approval status for new employees
ALTER TABLE public.employees ALTER COLUMN approval_status SET DEFAULT 'pending_verification';

-- Set default status for new employees
ALTER TABLE public.employees ALTER COLUMN status SET DEFAULT 'pending_activation';

-- Make sure existing employees are marked as active and approved
UPDATE public.employees SET approval_status = 'approved' WHERE approval_status IS NULL;
UPDATE public.employees SET status = 'active' WHERE status IS NULL OR status = '';

-- 8. Add constraint to status column in employees
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_status_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_status_check CHECK (status IN ('pending_activation', 'verified', 'active', 'inactive'));

-- 9. Create public.auth table
CREATE TABLE IF NOT EXISTS public.auth (
    user_id UUID PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    totp_secret TEXT,
    mfa_enabled BOOLEAN NOT NULL DEFAULT false,
    failed_attempts INTEGER DEFAULT 0,
    last_login TIMESTAMPTZ,
    locked_until TIMESTAMPTZ,
    last_ip TEXT,
    last_device TEXT,
    last_browser TEXT
);

-- 10. Create public.audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT,
    user_id UUID,
    employee_id TEXT,
    action TEXT NOT NULL,
    ip_address TEXT,
    device TEXT,
    browser TEXT,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Create staff view for backward compatibility
CREATE OR REPLACE VIEW public.staff AS 
SELECT 
    id, name, role, mobile, pin, status, created_at, restaurant_id, address, aadhaar_id, 
    id_document_url, joining_date, availability_status, last_assigned_at, active_orders_count, 
    active_tables_count, user_id, active_workload, branch_id, employee_id, monthly_salary, 
    per_day_salary, overtime_per_hour, updated_at
FROM public.employees;

-- 12. Drop old dine_users table and replace with view
DROP TABLE IF EXISTS public.dine_users CASCADE;

CREATE OR REPLACE VIEW public.dine_users AS
SELECT 
    e.id,
    e.name,
    e.email,
    e.mobile AS phone,
    e.employee_id,
    e.pin AS pin_hash,
    a.password_hash,
    e.role,
    e.status,
    e.restaurant_id,
    a.last_login,
    e.created_at,
    a.failed_attempts AS failed_login_attempts,
    a.locked_until
FROM public.employees e
LEFT JOIN public.auth a ON e.id = a.user_id;

-- 13. Seed default accounts in employees and auth
-- Default password: Password123!
-- Super Admin
INSERT INTO public.employees (id, name, role, email, status, approval_status)
VALUES ('5c3edf0c-6caf-47a8-b250-f2e1d2279496', 'Super Admin', 'SUPER_ADMIN', 'superadmin@dineinone.com', 'active', 'approved')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.auth (user_id, password_hash)
VALUES ('5c3edf0c-6caf-47a8-b250-f2e1d2279496', '$argon2id$v=19$m=65536,t=3,p=4$eGMSbUUp3EPWRMyG3Q9rWA$f5l8rA3uB4+/ZvFwlbXoYhCzl2hWBrJwoFgZwiCqlZI')
ON CONFLICT (user_id) DO NOTHING;

-- Restaurant Admin
INSERT INTO public.employees (id, name, role, email, restaurant_id, status, approval_status)
VALUES ('24a6beb3-fd5b-4244-9972-880ceaba0523', 'Restaurant Admin', 'restaurant_admin', 'admin@dineinone.com', '202603180001', 'active', 'approved')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.auth (user_id, password_hash)
VALUES ('24a6beb3-fd5b-4244-9972-880ceaba0523', '$argon2id$v=19$m=65536,t=3,p=4$eGMSbUUp3EPWRMyG3Q9rWA$f5l8rA3uB4+/ZvFwlbXoYhCzl2hWBrJwoFgZwiCqlZI')
ON CONFLICT (user_id) DO NOTHING;

-- John Waiter
INSERT INTO public.employees (id, name, role, email, mobile, restaurant_id, employee_id, status, approval_status)
VALUES ('0c3b4dc0-1689-4c5e-be76-d201ce71047b', 'John Waiter', 'waiter', 'waiter@dineinone.com', '9876543211', '202603180001', 'DIO0001001', 'active', 'approved')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.auth (user_id, password_hash)
VALUES ('0c3b4dc0-1689-4c5e-be76-d201ce71047b', '$argon2id$v=19$m=65536,t=3,p=4$eGMSbUUp3EPWRMyG3Q9rWA$f5l8rA3uB4+/ZvFwlbXoYhCzl2hWBrJwoFgZwiCqlZI')
ON CONFLICT (user_id) DO NOTHING;

-- Chef Gordon
INSERT INTO public.employees (id, name, role, email, mobile, restaurant_id, employee_id, status, approval_status)
VALUES ('9fe9171d-d0a9-4eec-ab5c-7e01b56c665d', 'Chef Gordon', 'chef', 'chef@dineinone.com', '9876543212', '202603180001', 'DIO0001002', 'active', 'approved')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.auth (user_id, password_hash)
VALUES ('9fe9171d-d0a9-4eec-ab5c-7e01b56c665d', '$argon2id$v=19$m=65536,t=3,p=4$eGMSbUUp3EPWRMyG3Q9rWA$f5l8rA3uB4+/ZvFwlbXoYhCzl2hWBrJwoFgZwiCqlZI')
ON CONFLICT (user_id) DO NOTHING;

-- 14. Update RLS policies and enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Isolation Policy" ON public.employees;
CREATE POLICY "Tenant Isolation Policy" ON public.employees
FOR ALL TO public
USING (
    auth.role() = 'service_role' OR
    public.validate_tenant(restaurant_id)
)
WITH CHECK (
    auth.role() = 'service_role' OR
    public.validate_tenant(restaurant_id)
);

DROP POLICY IF EXISTS "Auth Service Role Only" ON public.auth;
CREATE POLICY "Auth Service Role Only" ON public.auth
FOR ALL TO public
USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Audit Logs Tenant Isolation Policy" ON public.audit_logs;
CREATE POLICY "Audit Logs Tenant Isolation Policy" ON public.audit_logs
FOR ALL TO public
USING (
    auth.role() = 'service_role' OR
    public.validate_tenant(restaurant_id)
)
WITH CHECK (
    auth.role() = 'service_role' OR
    public.validate_tenant(restaurant_id)
);

-- 15. Recreate current_user_claims with public.employees support
CREATE OR REPLACE FUNCTION public.current_user_claims()
RETURNS json AS $$
DECLARE
    headers json;
    token text;
    claims json;
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN json_build_object('role', 'service_role');
    END IF;

    BEGIN
        headers := current_setting('request.headers', true)::json;
    EXCEPTION WHEN OTHERS THEN
        RETURN null;
    END;

    IF headers IS NULL THEN
        RETURN null;
    END IF;

    token := headers->>'x-dine-token';
    IF token IS NULL OR token = '' THEN
        -- Fallback for native Supabase users
        IF auth.role() = 'authenticated' THEN
            DECLARE
                r_id text;
            BEGIN
                SELECT restaurant_id INTO r_id FROM public.users WHERE id = auth.uid();
                IF r_id IS NULL THEN
                    SELECT restaurant_id INTO r_id FROM public.employees WHERE id = auth.uid();
                END IF;
                RETURN json_build_object(
                    'role', auth.jwt()->>'role',
                    'restaurant_id', r_id
                );
            END;
        END IF;
        RETURN null;
    END IF;

    claims := public.verify_custom_jwt(token);
    RETURN claims;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
