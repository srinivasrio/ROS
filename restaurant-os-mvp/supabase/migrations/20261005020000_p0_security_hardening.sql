-- ==============================================================================
-- Migration: 20261005020000_p0_security_hardening.sql
-- Description: P0 Security Hardening: RLS Least Privilege & Session Lockdown
-- Affected Tables: dine_sessions, orders, order_items, tables, table_merge_groups, branches
-- ==============================================================================

-- 1. Helper function: is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.employees 
    WHERE id = auth.uid() 
      AND upper(role) IN ('SUPER_ADMIN', 'SUPERADMIN')
      AND status = 'active'
      AND is_deleted = false
  );
END;
$$;

-- 2. Enhanced validate_branch_access with proper null-branch handling & restaurant_users check
CREATE OR REPLACE FUNCTION public.validate_branch_access(p_restaurant_id text, p_branch_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;

  -- Super admin check
  IF public.is_super_admin() THEN
    RETURN true;
  END IF;

  -- Owner has access to all branches of their restaurant
  IF public.is_restaurant_owner(p_restaurant_id) THEN
    RETURN true;
  END IF;

  -- Restaurant user membership check (e.g. manager, admin)
  IF EXISTS (
    SELECT 1 FROM public.restaurant_users
    WHERE restaurant_id = p_restaurant_id 
      AND user_id = auth.uid() 
      AND status = 'active'
  ) THEN
    RETURN true;
  END IF;

  -- Primary branch employee check
  IF EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = auth.uid() 
      AND restaurant_id = p_restaurant_id
      AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id)
      AND is_deleted = false
      AND status = 'active'
  ) THEN
    RETURN true;
  END IF;

  -- Multi-branch access check
  IF p_branch_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.employee_branch_access
    WHERE branch_id = p_branch_id
      AND employee_id = auth.uid()
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 3. Ensure RLS is active on all core tables
ALTER TABLE public.dine_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_merge_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- 4. Drop all overly permissive blanket policies
DROP POLICY IF EXISTS "Enable all access for all users" ON public.dine_sessions;
DROP POLICY IF EXISTS "Allow public all access" ON public.dine_sessions;
DROP POLICY IF EXISTS "dine_sessions_service_role_all" ON public.dine_sessions;
DROP POLICY IF EXISTS "dine_sessions_authenticated_select" ON public.dine_sessions;

DROP POLICY IF EXISTS "Orders branch isolation policy" ON public.orders;
DROP POLICY IF EXISTS "Allow all operations for authenticated users on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow all operations for anon users on orders" ON public.orders;
DROP POLICY IF EXISTS "orders_service_role_all" ON public.orders;
DROP POLICY IF EXISTS "orders_authenticated_select" ON public.orders;
DROP POLICY IF EXISTS "orders_authenticated_insert" ON public.orders;
DROP POLICY IF EXISTS "orders_authenticated_update" ON public.orders;
DROP POLICY IF EXISTS "orders_authenticated_delete" ON public.orders;
DROP POLICY IF EXISTS "orders_anon_insert" ON public.orders;

DROP POLICY IF EXISTS "Order items branch isolation policy" ON public.order_items;
DROP POLICY IF EXISTS "Allow all operations for authenticated users on order_items" ON public.order_items;
DROP POLICY IF EXISTS "Allow all operations for anon users on order_items" ON public.order_items;
DROP POLICY IF EXISTS "order_items_service_role_all" ON public.order_items;
DROP POLICY IF EXISTS "order_items_authenticated_select" ON public.order_items;
DROP POLICY IF EXISTS "order_items_authenticated_insert" ON public.order_items;
DROP POLICY IF EXISTS "order_items_authenticated_update" ON public.order_items;
DROP POLICY IF EXISTS "order_items_authenticated_delete" ON public.order_items;
DROP POLICY IF EXISTS "order_items_anon_insert" ON public.order_items;

DROP POLICY IF EXISTS "Tables branch isolation policy" ON public.tables;
DROP POLICY IF EXISTS "Allow all operations for authenticated users on tables" ON public.tables;
DROP POLICY IF EXISTS "Allow all operations for anon users on tables" ON public.tables;
DROP POLICY IF EXISTS "tables_service_role_all" ON public.tables;
DROP POLICY IF EXISTS "tables_authenticated_all" ON public.tables;
DROP POLICY IF EXISTS "tables_anon_select" ON public.tables;
DROP POLICY IF EXISTS "tables_anon_update" ON public.tables;

DROP POLICY IF EXISTS "Table merge groups branch isolation policy" ON public.table_merge_groups;
DROP POLICY IF EXISTS "Allow all operations for authenticated users on table_merge_groups" ON public.table_merge_groups;
DROP POLICY IF EXISTS "Allow all operations for anon users on table_merge_groups" ON public.table_merge_groups;
DROP POLICY IF EXISTS "table_merge_groups_service_role_all" ON public.table_merge_groups;
DROP POLICY IF EXISTS "table_merge_groups_authenticated_all" ON public.table_merge_groups;
DROP POLICY IF EXISTS "table_merge_groups_anon_select" ON public.table_merge_groups;
DROP POLICY IF EXISTS "table_merge_groups_anon_update" ON public.table_merge_groups;

DROP POLICY IF EXISTS "Branches isolation policy" ON public.branches;
DROP POLICY IF EXISTS "Tenant Isolation Policy" ON public.branches;
DROP POLICY IF EXISTS "Allow all operations for authenticated users on branches" ON public.branches;
DROP POLICY IF EXISTS "Allow all operations for anon users on branches" ON public.branches;
DROP POLICY IF EXISTS "branches_service_role_all" ON public.branches;
DROP POLICY IF EXISTS "branches_authenticated_select" ON public.branches;
DROP POLICY IF EXISTS "branches_authenticated_write" ON public.branches;
DROP POLICY IF EXISTS "branches_anon_select" ON public.branches;

-- ========================================================
-- 5. DINE_SESSIONS POLICIES (P0-03)
-- ========================================================
CREATE POLICY "dine_sessions_service_role_all" ON public.dine_sessions
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "dine_sessions_authenticated_select" ON public.dine_sessions
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- ========================================================
-- 6. ORDERS POLICIES (P0-02)
-- ========================================================
CREATE POLICY "orders_service_role_all" ON public.orders
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "orders_authenticated_select" ON public.orders
    FOR SELECT TO authenticated
    USING (public.validate_branch_access(restaurant_id, branch_id));

CREATE POLICY "orders_authenticated_insert" ON public.orders
    FOR INSERT TO authenticated
    WITH CHECK (public.validate_branch_access(restaurant_id, branch_id));

CREATE POLICY "orders_authenticated_update" ON public.orders
    FOR UPDATE TO authenticated
    USING (public.validate_branch_access(restaurant_id, branch_id))
    WITH CHECK (public.validate_branch_access(restaurant_id, branch_id));

CREATE POLICY "orders_authenticated_delete" ON public.orders
    FOR DELETE TO authenticated
    USING (public.is_restaurant_owner(restaurant_id) OR public.is_super_admin());

CREATE POLICY "orders_anon_insert" ON public.orders
    FOR INSERT TO anon
    WITH CHECK (restaurant_id IS NOT NULL AND status IN ('placed', 'queued'));

-- ========================================================
-- 7. ORDER_ITEMS POLICIES (P0-02)
-- ========================================================
CREATE POLICY "order_items_service_role_all" ON public.order_items
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "order_items_authenticated_select" ON public.order_items
    FOR SELECT TO authenticated
    USING (public.validate_branch_access(restaurant_id, branch_id));

CREATE POLICY "order_items_authenticated_insert" ON public.order_items
    FOR INSERT TO authenticated
    WITH CHECK (public.validate_branch_access(restaurant_id, branch_id));

CREATE POLICY "order_items_authenticated_update" ON public.order_items
    FOR UPDATE TO authenticated
    USING (public.validate_branch_access(restaurant_id, branch_id))
    WITH CHECK (public.validate_branch_access(restaurant_id, branch_id));

CREATE POLICY "order_items_authenticated_delete" ON public.order_items
    FOR DELETE TO authenticated
    USING (public.validate_branch_access(restaurant_id, branch_id));

CREATE POLICY "order_items_anon_insert" ON public.order_items
    FOR INSERT TO anon
    WITH CHECK (restaurant_id IS NOT NULL AND quantity > 0);

-- ========================================================
-- 8. TABLES POLICIES (P0-02)
-- ========================================================
CREATE POLICY "tables_service_role_all" ON public.tables
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "tables_authenticated_all" ON public.tables
    FOR ALL TO authenticated
    USING (public.validate_branch_access(restaurant_id, branch_id))
    WITH CHECK (public.validate_branch_access(restaurant_id, branch_id));

CREATE POLICY "tables_anon_select" ON public.tables
    FOR SELECT TO anon
    USING (restaurant_id IS NOT NULL);

CREATE POLICY "tables_anon_update" ON public.tables
    FOR UPDATE TO anon
    USING (restaurant_id IS NOT NULL)
    WITH CHECK (restaurant_id IS NOT NULL AND status::text IN ('available', 'free', 'empty', 'occupied', 'customer_present', 'billing', 'need_bill', 'on_hold', 'ordering', 'eating'));

-- ========================================================
-- 9. TABLE_MERGE_GROUPS POLICIES (P0-02)
-- ========================================================
CREATE POLICY "table_merge_groups_service_role_all" ON public.table_merge_groups
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "table_merge_groups_authenticated_all" ON public.table_merge_groups
    FOR ALL TO authenticated
    USING (public.validate_branch_access(restaurant_id, branch_id))
    WITH CHECK (public.validate_branch_access(restaurant_id, branch_id));

CREATE POLICY "table_merge_groups_anon_select" ON public.table_merge_groups
    FOR SELECT TO anon
    USING (restaurant_id IS NOT NULL);

CREATE POLICY "table_merge_groups_anon_update" ON public.table_merge_groups
    FOR UPDATE TO anon
    USING (restaurant_id IS NOT NULL)
    WITH CHECK (restaurant_id IS NOT NULL AND status IN ('available', 'free', 'empty', 'occupied', 'customer_present', 'bill_requested', 'on_hold'));

-- ========================================================
-- 10. BRANCHES POLICIES (P0-02)
-- ========================================================
CREATE POLICY "branches_service_role_all" ON public.branches
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "branches_authenticated_select" ON public.branches
    FOR SELECT TO authenticated
    USING (public.is_restaurant_owner(restaurant_id) OR public.validate_branch_access(restaurant_id, id) OR public.is_super_admin());

CREATE POLICY "branches_authenticated_write" ON public.branches
    FOR ALL TO authenticated
    USING (public.is_restaurant_owner(restaurant_id) OR public.is_super_admin())
    WITH CHECK (public.is_restaurant_owner(restaurant_id) OR public.is_super_admin());

CREATE POLICY "branches_anon_select" ON public.branches
    FOR SELECT TO anon
    USING (restaurant_id IS NOT NULL AND (status IS NULL OR status = 'active'));
