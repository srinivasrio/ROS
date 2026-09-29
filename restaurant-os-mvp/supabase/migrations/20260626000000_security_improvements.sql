-- Migration: Dine In One Security Hardening & Role Refinement
-- Date: 2026-06-26

-- 1. Extend Restaurant Status Check Constraint
ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_status_check;
ALTER TABLE public.restaurants ADD CONSTRAINT restaurants_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested', 'suspended'));

-- 2. Add Columns to Employees Table
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS mfa_reset_at TIMESTAMPTZ;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS mfa_reset_by UUID;

-- 3. Re-create Check Constraints on Employees Table (allowing custom roles)
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_status_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_status_check CHECK (status IN ('pending_activation', 'verified', 'active', 'inactive', 'mfa_reset_required'));

ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_approval_status_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_approval_status_check CHECK (approval_status IN ('pending_verification', 'awaiting_admin_approval', 'approved', 'rejected', 'suspended'));

-- Drop any limiting role constraints to allow custom roles
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS staff_role_check;

-- 4. Migrate Remaining Manager Roles to Supervisor
UPDATE public.employees SET role = 'supervisor' WHERE role = 'manager';

-- 5. Add actor_id and target_user_id to Audit Logs Table
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_id UUID;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS target_user_id UUID;

-- 6. Re-create Backward Compatibility Views Filtering Deleted Users
CREATE OR REPLACE VIEW public.staff AS 
SELECT 
    id, name, role, mobile, pin, status, created_at, restaurant_id, address, aadhaar_id, 
    id_document_url, joining_date, availability_status, last_assigned_at, active_orders_count, 
    active_tables_count, user_id, active_workload, branch_id, employee_id, monthly_salary, 
    per_day_salary, overtime_per_hour, updated_at
FROM public.employees
WHERE is_deleted = false;

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
LEFT JOIN public.auth a ON e.id = a.user_id
WHERE e.is_deleted = false;
