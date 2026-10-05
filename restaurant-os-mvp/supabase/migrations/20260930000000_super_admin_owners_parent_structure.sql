-- Migration: Super Admin Owners Parent Structure & Quota Security
-- Date: 2026-09-30
-- Description: Enforces Owners as the single parent entity for restaurants/locations,
--              secures Owner-level quotas, and prevents Restaurant Admins from creating locations.

-- 1. Helper function to check if a user can create a restaurant location under an Owner quota
CREATE OR REPLACE FUNCTION public.can_create_restaurant_location(p_owner_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_quota INTEGER;
    v_used INTEGER;
BEGIN
    -- Super admin and service role can always create
    IF auth.role() = 'service_role' THEN
        RETURN true;
    END IF;

    -- If the current user is a restaurant admin or staff, strictly forbid
    IF EXISTS (
        SELECT 1 FROM public.employees
        WHERE id = auth.uid()
        AND lower(role) IN ('restaurant_admin', 'waiter', 'chef', 'kds', 'cashier', 'delivery_boy', 'staff')
    ) THEN
        RETURN false;
    END IF;

    -- Verify that the actor is the owner or superadmin
    IF auth.uid() <> p_owner_id THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.employees
            WHERE id = auth.uid() AND upper(role) IN ('SUPER_ADMIN', 'SUPERADMIN')
        ) THEN
            RETURN false;
        END IF;
    END IF;

    -- Get owner quota
    SELECT COALESCE(
        (SELECT max_branches FROM public.employees WHERE id = p_owner_id LIMIT 1),
        (SELECT max_branches FROM public.dine_users WHERE id = p_owner_id LIMIT 1),
        (SELECT max_branches FROM public.restaurants WHERE owner_id = p_owner_id AND max_branches IS NOT NULL LIMIT 1),
        5
    ) INTO v_quota;

    -- Get count of current non-deleted restaurants for this owner
    SELECT count(*) INTO v_used
    FROM public.restaurants
    WHERE owner_id = p_owner_id AND deleted_at IS NULL;

    -- Must be strictly less than quota
    RETURN v_used < v_quota;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Add INSERT policy for restaurants enforcing Owner Quota and forbidding Restaurant Admins
DO $$
BEGIN
    DROP POLICY IF EXISTS "Owner Create Restaurant Quota Policy" ON public.restaurants;
    CREATE POLICY "Owner Create Restaurant Quota Policy" ON public.restaurants
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.role() = 'service_role' OR
        public.can_create_restaurant_location(owner_id)
    );
END $$;
