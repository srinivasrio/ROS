-- Migration: Owner Panel Foundation — Multi-Branch Architecture
-- Date: 2026-09-29
-- Description: Creates all tables and schema changes needed for the multi-branch Owner Panel.
-- NON-DESTRUCTIVE: All changes are additive. No existing data or tables are dropped.

-- ============================================================================
-- 1. EXTEND EXISTING TABLES (non-destructive column additions)
-- ============================================================================

-- 1a. restaurants: Add deletion workflow and legal columns
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS legal_name TEXT;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS permanent_deletion_at TIMESTAMPTZ;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 1b. branches: Add contact, code, and soft-delete columns
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS address JSONB;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 1c. employees: Add owner-panel specific columns
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employee_code TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

-- 1d. orders: Add branch_id for multi-branch tracking
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS branch_id TEXT;

-- 1e. audit_logs: Extend with owner-panel audit fields
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_role TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS resource_type TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS resource_id TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
-- Rename 'details' usage note: audit_logs already has 'details JSONB'. 
-- 'metadata' is added for structured owner-panel audit data; 'details' kept for backward compat.

-- 1f. tables: Add branch_id for direct branch scoping
ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS branch_id TEXT;

-- ============================================================================
-- 2. NEW TABLES
-- ============================================================================

-- 2a. roles — Standardized role definitions
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    is_system BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed standard roles
INSERT INTO public.roles (name, display_name, description, is_system) VALUES
    ('OWNER', 'Restaurant Owner', 'Full access to restaurant and all branches', true),
    ('BRANCH_ADMIN', 'Branch Administrator', 'Manages a specific branch', true),
    ('WAITER', 'Waiter', 'Takes orders and serves customers', true),
    ('CHEF', 'Chef', 'Kitchen staff preparing orders', true),
    ('KDS', 'Kitchen Display', 'Kitchen display system operator', true),
    ('CASHIER', 'Cashier', 'Handles billing and payments', true),
    ('DELIVERY_BOY', 'Delivery Personnel', 'Delivers orders to customers', true),
    ('SUPERVISOR', 'Supervisor', 'Oversees operations', true),
    ('DINE_IN_ONE_SUPER_ADMIN', 'Platform Super Admin', 'Dine in One platform administrator', true)
ON CONFLICT (name) DO NOTHING;

-- 2b. restaurant_users — Links users to restaurants with roles
CREATE TABLE IF NOT EXISTS public.restaurant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    user_id UUID NOT NULL,
    role TEXT NOT NULL DEFAULT 'OWNER',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(restaurant_id, user_id)
);

-- 2c. employee_branch_access — Multi-branch employee assignment
CREATE TABLE IF NOT EXISTS public.employee_branch_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    branch_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    UNIQUE(employee_id, branch_id)
);

-- 2d. subscriptions — Subscription management
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    plan_name TEXT NOT NULL DEFAULT 'free_trial',
    plan_type TEXT NOT NULL DEFAULT 'monthly' CHECK (plan_type IN ('monthly', 'annual', 'free_trial')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'expired')),
    trial_starts_at TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    amount NUMERIC(10, 2) DEFAULT 0,
    currency TEXT DEFAULT 'INR',
    max_branches INTEGER DEFAULT 1,
    max_employees INTEGER DEFAULT 10,
    features JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2e. payments — Payment history
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    payment_method TEXT,
    payment_gateway TEXT,
    gateway_transaction_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2f. invoices — Invoice records
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'void', 'overdue')),
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(10, 2) DEFAULT 0,
    tax_rate NUMERIC(5, 2) DEFAULT 0,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'INR',
    billing_period_start TIMESTAMPTZ,
    billing_period_end TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    pdf_storage_path TEXT,  -- Private Supabase Storage path (not a public URL)
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2g. invoice_items — Line items on invoices
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(10, 2) NOT NULL,
    tax_rate NUMERIC(5, 2) DEFAULT 0,
    tax_amount NUMERIC(10, 2) DEFAULT 0,
    total NUMERIC(10, 2) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2h. terms_acceptances — Terms & privacy acceptance tracking
CREATE TABLE IF NOT EXISTS public.terms_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    restaurant_id TEXT,
    terms_version TEXT NOT NULL,
    document_type TEXT NOT NULL DEFAULT 'terms_and_conditions' CHECK (document_type IN ('terms_and_conditions', 'privacy_policy', 'data_processing')),
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT
);

-- 2i. restaurant_deletion_requests — Deletion workflow tracking
CREATE TABLE IF NOT EXISTS public.restaurant_deletion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    requested_by UUID NOT NULL,
    reason TEXT,
    retention_days INTEGER DEFAULT 30,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'canceled')),
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    scheduled_deletion_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. INDEXES for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_restaurant_users_restaurant ON public.restaurant_users(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_users_user ON public.restaurant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_branch_access_employee ON public.employee_branch_access(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_branch_access_branch ON public.employee_branch_access(branch_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_restaurant ON public.subscriptions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_payments_restaurant ON public.payments(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_restaurant ON public.invoices(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_terms_acceptances_user ON public.terms_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_deletion_requests_restaurant ON public.restaurant_deletion_requests(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_branch ON public.orders(branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_branch ON public.audit_logs(branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_role);
CREATE INDEX IF NOT EXISTS idx_employees_employee_code ON public.employees(employee_code) WHERE employee_code IS NOT NULL;

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_branch_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Roles: Read-only for all authenticated, write for service_role
CREATE POLICY "Roles Read Policy" ON public.roles
FOR SELECT TO public USING (true);

CREATE POLICY "Roles Write Policy" ON public.roles
FOR ALL TO public USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Restaurant Users: Tenant isolated
CREATE POLICY "Restaurant Users Tenant Policy" ON public.restaurant_users
FOR ALL TO public
USING (
    auth.role() = 'service_role' OR
    public.validate_tenant(restaurant_id)
)
WITH CHECK (
    auth.role() = 'service_role' OR
    public.validate_tenant(restaurant_id)
);

-- Employee Branch Access: Via employee's restaurant tenant
CREATE POLICY "Employee Branch Access Policy" ON public.employee_branch_access
FOR ALL TO public
USING (
    auth.role() = 'service_role' OR
    EXISTS (
        SELECT 1 FROM public.employees
        WHERE employees.id = employee_branch_access.employee_id
        AND public.validate_tenant(employees.restaurant_id)
    )
);

-- Subscriptions: Tenant isolated
CREATE POLICY "Subscriptions Tenant Policy" ON public.subscriptions
FOR ALL TO public
USING (
    auth.role() = 'service_role' OR
    public.validate_tenant(restaurant_id)
)
WITH CHECK (
    auth.role() = 'service_role' OR
    public.validate_tenant(restaurant_id)
);

-- Payments: Tenant isolated
CREATE POLICY "Payments Tenant Policy" ON public.payments
FOR ALL TO public
USING (
    auth.role() = 'service_role' OR
    public.validate_tenant(restaurant_id)
)
WITH CHECK (
    auth.role() = 'service_role' OR
    public.validate_tenant(restaurant_id)
);

-- Invoices: Tenant isolated
CREATE POLICY "Invoices Tenant Policy" ON public.invoices
FOR ALL TO public
USING (
    auth.role() = 'service_role' OR
    public.validate_tenant(restaurant_id)
)
WITH CHECK (
    auth.role() = 'service_role' OR
    public.validate_tenant(restaurant_id)
);

-- Invoice Items: Via invoice's restaurant tenant
CREATE POLICY "Invoice Items Policy" ON public.invoice_items
FOR ALL TO public
USING (
    auth.role() = 'service_role' OR
    EXISTS (
        SELECT 1 FROM public.invoices
        WHERE invoices.id = invoice_items.invoice_id
        AND public.validate_tenant(invoices.restaurant_id)
    )
);

-- Terms Acceptances: Service role only (sensitive)
CREATE POLICY "Terms Acceptances Policy" ON public.terms_acceptances
FOR ALL TO public
USING (auth.role() = 'service_role');

-- Restaurant Deletion Requests: Tenant isolated
CREATE POLICY "Deletion Requests Tenant Policy" ON public.restaurant_deletion_requests
FOR ALL TO public
USING (
    auth.role() = 'service_role' OR
    public.validate_tenant(restaurant_id)
)
WITH CHECK (
    auth.role() = 'service_role' OR
    public.validate_tenant(restaurant_id)
);

-- ============================================================================
-- 5. OWNER ACCESS VERIFICATION FUNCTION
-- ============================================================================

-- Validates that a user is an owner of a specific restaurant
CREATE OR REPLACE FUNCTION public.verify_owner_access(p_user_id UUID, p_restaurant_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    is_owner BOOLEAN := false;
BEGIN
    -- Check 1: restaurants.owner_id
    SELECT EXISTS(
        SELECT 1 FROM public.restaurants
        WHERE id = p_restaurant_id AND owner_id = p_user_id
    ) INTO is_owner;
    
    IF is_owner THEN RETURN true; END IF;
    
    -- Check 2: restaurant_users table
    SELECT EXISTS(
        SELECT 1 FROM public.restaurant_users
        WHERE restaurant_id = p_restaurant_id 
        AND user_id = p_user_id
        AND role = 'OWNER'
        AND status = 'active'
    ) INTO is_owner;
    
    IF is_owner THEN RETURN true; END IF;
    
    -- Check 3: employees table with owner/admin role
    SELECT EXISTS(
        SELECT 1 FROM public.employees
        WHERE id = p_user_id
        AND restaurant_id = p_restaurant_id
        AND role IN ('restaurant_admin', 'owner', 'restaurant_owner', 'manager')
        AND status = 'active'
    ) INTO is_owner;
    
    RETURN is_owner;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Validates branch access for an employee
CREATE OR REPLACE FUNCTION public.verify_branch_access(p_user_id UUID, p_branch_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    has_access BOOLEAN := false;
    user_restaurant TEXT;
BEGIN
    -- Get user's restaurant
    SELECT restaurant_id INTO user_restaurant 
    FROM public.employees WHERE id = p_user_id;
    
    -- Owners have access to all branches in their restaurant
    IF public.verify_owner_access(p_user_id, user_restaurant) THEN
        SELECT EXISTS(
            SELECT 1 FROM public.branches
            WHERE id = p_branch_id AND restaurant_id = user_restaurant
        ) INTO has_access;
        RETURN has_access;
    END IF;
    
    -- Check employee_branch_access
    SELECT EXISTS(
        SELECT 1 FROM public.employee_branch_access
        WHERE employee_id = p_user_id AND branch_id = p_branch_id
    ) INTO has_access;
    
    IF has_access THEN RETURN true; END IF;
    
    -- Check direct branch_id on employee
    SELECT EXISTS(
        SELECT 1 FROM public.employees
        WHERE id = p_user_id AND branch_id = p_branch_id
    ) INTO has_access;
    
    RETURN has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. SEED DEFAULT SUBSCRIPTION FOR EXISTING RESTAURANT
-- ============================================================================

-- Create a free trial subscription for the existing restaurant
INSERT INTO public.subscriptions (restaurant_id, plan_name, plan_type, status, trial_starts_at, trial_ends_at, max_branches, max_employees)
SELECT 
    id,
    'starter',
    'free_trial',
    'trialing',
    NOW(),
    NOW() + INTERVAL '14 days',
    3,
    20
FROM public.restaurants
WHERE NOT EXISTS (
    SELECT 1 FROM public.subscriptions WHERE subscriptions.restaurant_id = restaurants.id
)
LIMIT 5;

-- Seed restaurant_users for existing restaurant owners
INSERT INTO public.restaurant_users (restaurant_id, user_id, role, status)
SELECT 
    r.id,
    e.id,
    'OWNER',
    'active'
FROM public.restaurants r
JOIN public.employees e ON e.restaurant_id = r.id AND e.role IN ('restaurant_admin', 'owner', 'restaurant_owner')
WHERE NOT EXISTS (
    SELECT 1 FROM public.restaurant_users ru
    WHERE ru.restaurant_id = r.id AND ru.user_id = e.id
)
ON CONFLICT (restaurant_id, user_id) DO NOTHING;
