-- ==============================================================================
-- Migration: 20261007000000_fix_orders_anon_rls_for_kds.sql
-- Description: Allow anon SELECT & UPDATE on public.orders and public.order_items
--              so that client-side KDS panels and Supabase Realtime CDC channels
--              can receive and update orders seamlessly with custom JWT authentication.
-- ==============================================================================

DO $$
BEGIN
    -- 1. Orders anon SELECT policy (required for KDS and Supabase Realtime CDC)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders_anon_select') THEN
        CREATE POLICY "orders_anon_select" ON public.orders
            FOR SELECT TO anon
            USING (restaurant_id IS NOT NULL);
    END IF;

    -- 2. Order items anon SELECT policy (required for KDS items rendering & Realtime CDC)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'order_items_anon_select') THEN
        CREATE POLICY "order_items_anon_select" ON public.order_items
            FOR SELECT TO anon
            USING (restaurant_id IS NOT NULL);
    END IF;

    -- 3. Orders anon UPDATE policy (required for client-side status transitions in KDS/waiter)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders_anon_update') THEN
        CREATE POLICY "orders_anon_update" ON public.orders
            FOR UPDATE TO anon
            USING (restaurant_id IS NOT NULL)
            WITH CHECK (restaurant_id IS NOT NULL);
    END IF;

    -- 4. Order items anon UPDATE policy (required for individual item preparation state updates)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'order_items_anon_update') THEN
        CREATE POLICY "order_items_anon_update" ON public.order_items
            FOR UPDATE TO anon
            USING (restaurant_id IS NOT NULL)
            WITH CHECK (restaurant_id IS NOT NULL);
    END IF;
END $$;
