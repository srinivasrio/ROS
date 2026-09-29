-- Migration Rollback: Dine In One Security Hardening & Role Refinement
-- Date: 2026-06-26

-- 1. Restore Restaurant Status Check Constraint
ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_status_check;
ALTER TABLE public.restaurants ADD CONSTRAINT restaurants_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested'));

-- 2. Drop Columns from Employees Table
ALTER TABLE public.employees DROP COLUMN IF EXISTS session_version;
ALTER TABLE public.employees DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE public.employees DROP COLUMN IF EXISTS deleted_by;
ALTER TABLE public.employees DROP COLUMN IF EXISTS is_deleted;
ALTER TABLE public.employees DROP COLUMN IF EXISTS mfa_reset_at;
ALTER TABLE public.employees DROP COLUMN IF EXISTS mfa_reset_by;

-- 3. Restore Check Constraints on Employees Table
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_status_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_status_check CHECK (status IN ('pending_activation', 'verified', 'active', 'inactive'));

ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_approval_status_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_approval_status_check CHECK (approval_status IN ('pending_verification', 'awaiting_admin_approval', 'approved', 'rejected', 'suspended'));

ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_role_check CHECK (role IN ('restaurant_admin', 'manager', 'waiter', 'chef', 'SUPER_ADMIN'));

-- 4. Restore Audit Logs Columns
ALTER TABLE public.audit_logs DROP COLUMN IF EXISTS actor_id;
ALTER TABLE public.audit_logs DROP COLUMN IF EXISTS target_user_id;

-- 5. Restore Views
CREATE OR REPLACE VIEW public.staff AS 
SELECT 
    id, name, role, mobile, pin, status, created_at, restaurant_id, address, aadhaar_id, 
    id_document_url, joining_date, availability_status, last_assigned_at, active_orders_count, 
    active_tables_count, user_id, active_workload, branch_id, employee_id, monthly_salary, 
    per_day_salary, overtime_per_hour, updated_at
FROM public.employees;

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
