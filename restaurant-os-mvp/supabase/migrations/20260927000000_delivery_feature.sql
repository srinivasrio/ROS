-- Migration: Delivery Feature for Dine In One
-- Date: 2026-09-27
-- Description: Adds delivery_boys, delivery_settings, delivery_assignments tables,
--              extends orders with order_type/delivery fields, and creates RLS policies.

BEGIN;

-- ============================================================================
-- 1. EXTEND ORDERS TABLE with delivery-related fields
-- ============================================================================
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'DINE_IN';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_phone TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) DEFAULT 0;

-- Constraint: order_type must be one of the valid types
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_type_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_type_check 
    CHECK (order_type IN ('DINE_IN', 'TAKEAWAY', 'DELIVERY'));

-- Index for filtering delivery orders
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON public.orders(order_type) WHERE order_type != 'DINE_IN';
CREATE INDEX IF NOT EXISTS idx_orders_delivery_restaurant ON public.orders(restaurant_id, order_type) WHERE order_type = 'DELIVERY';

-- ============================================================================
-- 2. DELIVERY_BOYS TABLE (role-mapping: employee → delivery boy)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.delivery_boys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    employee_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_delivery', 'offline')),
    vehicle_type TEXT,
    vehicle_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(restaurant_id, employee_id)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_delivery_boys_restaurant ON public.delivery_boys(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_boys_employee ON public.delivery_boys(employee_id);
CREATE INDEX IF NOT EXISTS idx_delivery_boys_status ON public.delivery_boys(restaurant_id, status);

-- Enable RLS
ALTER TABLE public.delivery_boys ENABLE ROW LEVEL SECURITY;

-- RLS Policies for delivery_boys
-- Admin: full access scoped to restaurant
DROP POLICY IF EXISTS "delivery_boys_admin_select" ON public.delivery_boys;
CREATE POLICY "delivery_boys_admin_select" ON public.delivery_boys
    FOR SELECT USING (
        restaurant_id = (
            SELECT (public.verify_custom_jwt(current_setting('request.jwt.claim.sub', true)))::json->>'restaurantId'
        )
    );

DROP POLICY IF EXISTS "delivery_boys_admin_insert" ON public.delivery_boys;
CREATE POLICY "delivery_boys_admin_insert" ON public.delivery_boys
    FOR INSERT WITH CHECK (
        restaurant_id = (
            SELECT (public.verify_custom_jwt(current_setting('request.jwt.claim.sub', true)))::json->>'restaurantId'
        )
    );

DROP POLICY IF EXISTS "delivery_boys_admin_update" ON public.delivery_boys;
CREATE POLICY "delivery_boys_admin_update" ON public.delivery_boys
    FOR UPDATE USING (
        restaurant_id = (
            SELECT (public.verify_custom_jwt(current_setting('request.jwt.claim.sub', true)))::json->>'restaurantId'
        )
    );

DROP POLICY IF EXISTS "delivery_boys_admin_delete" ON public.delivery_boys;
CREATE POLICY "delivery_boys_admin_delete" ON public.delivery_boys
    FOR DELETE USING (
        restaurant_id = (
            SELECT (public.verify_custom_jwt(current_setting('request.jwt.claim.sub', true)))::json->>'restaurantId'
        )
    );

-- Service role bypass (for API routes using supabaseAdmin)
DROP POLICY IF EXISTS "delivery_boys_service_all" ON public.delivery_boys;
CREATE POLICY "delivery_boys_service_all" ON public.delivery_boys
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 3. DELIVERY_SETTINGS TABLE (per-restaurant delivery configuration)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.delivery_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
    minimum_order_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    max_delivery_radius_km NUMERIC(5,2),
    estimated_delivery_minutes INTEGER DEFAULT 30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_settings_restaurant ON public.delivery_settings(restaurant_id);

ALTER TABLE public.delivery_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for delivery_settings
DROP POLICY IF EXISTS "delivery_settings_select" ON public.delivery_settings;
CREATE POLICY "delivery_settings_select" ON public.delivery_settings
    FOR SELECT USING (true); -- Public read (customers need to see if delivery is available)

DROP POLICY IF EXISTS "delivery_settings_admin_insert" ON public.delivery_settings;
CREATE POLICY "delivery_settings_admin_insert" ON public.delivery_settings
    FOR INSERT WITH CHECK (
        restaurant_id = (
            SELECT (public.verify_custom_jwt(current_setting('request.jwt.claim.sub', true)))::json->>'restaurantId'
        )
    );

DROP POLICY IF EXISTS "delivery_settings_admin_update" ON public.delivery_settings;
CREATE POLICY "delivery_settings_admin_update" ON public.delivery_settings
    FOR UPDATE USING (
        restaurant_id = (
            SELECT (public.verify_custom_jwt(current_setting('request.jwt.claim.sub', true)))::json->>'restaurantId'
        )
    );

-- Service role bypass
DROP POLICY IF EXISTS "delivery_settings_service_all" ON public.delivery_settings;
CREATE POLICY "delivery_settings_service_all" ON public.delivery_settings
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 4. DELIVERY_ASSIGNMENTS TABLE (order ↔ delivery boy mapping)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.delivery_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    delivery_boy_id UUID NOT NULL REFERENCES public.delivery_boys(id) ON DELETE CASCADE,
    assigned_by UUID,  -- employee who assigned (admin)
    status TEXT NOT NULL DEFAULT 'ASSIGNED' CHECK (
        status IN ('ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REASSIGNED')
    ),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    out_for_delivery_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_restaurant ON public.delivery_assignments(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_order ON public.delivery_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_boy ON public.delivery_assignments(delivery_boy_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_status ON public.delivery_assignments(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_active ON public.delivery_assignments(delivery_boy_id, status) 
    WHERE status NOT IN ('DELIVERED', 'CANCELLED', 'REASSIGNED');

-- Prevent duplicate active assignments for the same order
CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_assignments_active_order 
    ON public.delivery_assignments(order_id) 
    WHERE status NOT IN ('CANCELLED', 'REASSIGNED');

ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for delivery_assignments
-- Admin: full access scoped to restaurant
DROP POLICY IF EXISTS "delivery_assignments_admin_select" ON public.delivery_assignments;
CREATE POLICY "delivery_assignments_admin_select" ON public.delivery_assignments
    FOR SELECT USING (
        restaurant_id = (
            SELECT (public.verify_custom_jwt(current_setting('request.jwt.claim.sub', true)))::json->>'restaurantId'
        )
    );

DROP POLICY IF EXISTS "delivery_assignments_admin_insert" ON public.delivery_assignments;
CREATE POLICY "delivery_assignments_admin_insert" ON public.delivery_assignments
    FOR INSERT WITH CHECK (
        restaurant_id = (
            SELECT (public.verify_custom_jwt(current_setting('request.jwt.claim.sub', true)))::json->>'restaurantId'
        )
    );

DROP POLICY IF EXISTS "delivery_assignments_admin_update" ON public.delivery_assignments;
CREATE POLICY "delivery_assignments_admin_update" ON public.delivery_assignments
    FOR UPDATE USING (
        restaurant_id = (
            SELECT (public.verify_custom_jwt(current_setting('request.jwt.claim.sub', true)))::json->>'restaurantId'
        )
    );

-- Service role bypass
DROP POLICY IF EXISTS "delivery_assignments_service_all" ON public.delivery_assignments;
CREATE POLICY "delivery_assignments_service_all" ON public.delivery_assignments
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 5. ENABLE REALTIME for delivery tables
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_boys;
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_assignments;

-- Set replica identity for realtime UPDATE payloads to include full row
ALTER TABLE public.delivery_boys REPLICA IDENTITY FULL;
ALTER TABLE public.delivery_assignments REPLICA IDENTITY FULL;

-- ============================================================================
-- 6. HELPER: Update delivery_boy status based on active assignments
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_delivery_boy_status()
RETURNS TRIGGER AS $$
BEGIN
    -- When assignment becomes active (ACCEPTED/PICKED_UP/OUT_FOR_DELIVERY), set delivery boy to on_delivery
    IF NEW.status IN ('ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY') THEN
        UPDATE public.delivery_boys 
        SET status = 'on_delivery', updated_at = NOW()
        WHERE id = NEW.delivery_boy_id AND status != 'on_delivery';
    END IF;

    -- When assignment completes/cancels, check if delivery boy has other active assignments
    IF NEW.status IN ('DELIVERED', 'CANCELLED', 'REASSIGNED') THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.delivery_assignments 
            WHERE delivery_boy_id = NEW.delivery_boy_id 
            AND id != NEW.id
            AND status IN ('ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY')
        ) THEN
            UPDATE public.delivery_boys 
            SET status = 'active', updated_at = NOW()
            WHERE id = NEW.delivery_boy_id AND status = 'on_delivery';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_delivery_boy_status ON public.delivery_assignments;
CREATE TRIGGER trg_update_delivery_boy_status
    AFTER UPDATE OF status ON public.delivery_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_delivery_boy_status();

-- ============================================================================
-- 7. ROLE SUPPORT: 'delivery_boy' is now a valid role in employees & dine_sessions
-- ============================================================================
-- Note: dine_users is a VIEW on employees + auth, and employees.role is text.
-- 'delivery_boy' is recognized by application middleware and auth services.

COMMIT;
