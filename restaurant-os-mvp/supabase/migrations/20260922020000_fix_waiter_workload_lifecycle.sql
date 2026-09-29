-- Migration: Fix Waiter Workload Lifecycle
-- 1. Ensure calculate_waiter_workload correctly computes active tables and orders.
-- 2. Add triggers on orders, tables, and table_merge_groups to automatically keep workload in sync.
-- 3. Clean up stale completed orders and recalculate all active waiters.

CREATE OR REPLACE FUNCTION public.calculate_waiter_workload(waiter_uuid uuid)
RETURNS void AS $$
DECLARE
    v_tables_count INTEGER := 0;
    v_orders_count INTEGER := 0;
    v_services_count INTEGER := 0;
    v_score INTEGER := 0;
    v_status TEXT := 'low';
    v_restaurant_id TEXT;
BEGIN
    IF waiter_uuid IS NULL THEN
        RETURN;
    END IF;

    SELECT restaurant_id INTO v_restaurant_id 
    FROM public.employees 
    WHERE id = waiter_uuid;

    IF v_restaurant_id IS NULL THEN
        RETURN;
    END IF;

    -- 1. Active tables: physical tables or merge groups assigned to waiter with active dining status,
    --    OR tables that have an active uncompleted order assigned to this waiter.
    SELECT COUNT(DISTINCT table_key) INTO v_tables_count
    FROM (
        SELECT 'table_' || id::text AS table_key
        FROM public.tables
        WHERE assigned_waiter_id = waiter_uuid
          AND status::text NOT IN ('empty', 'free', 'available', 'cleaning', 'dirty')
        UNION
        SELECT 'group_' || id::text AS table_key
        FROM public.table_merge_groups
        WHERE assigned_waiter_id = waiter_uuid
          AND status::text NOT IN ('empty', 'free', 'available', 'cleaning', 'dirty')
        UNION
        SELECT CASE 
                 WHEN table_id IS NOT NULL THEN 'table_' || table_id::text 
                 ELSE 'group_' || merge_group_id::text 
               END AS table_key
        FROM public.orders
        WHERE waiter_id = waiter_uuid
          AND COALESCE(is_completed, false) = false
          AND status::text NOT IN ('cancelled', 'paid', 'completed')
          AND (table_id IS NOT NULL OR merge_group_id IS NOT NULL)
    ) sub;

    -- 2. Active orders: uncompleted orders that are not paid/cancelled/completed
    SELECT COUNT(*) INTO v_orders_count
    FROM public.orders
    WHERE waiter_id = waiter_uuid
      AND COALESCE(is_completed, false) = false
      AND status::text NOT IN ('cancelled', 'paid', 'completed');

    -- 3. Active pending service requests
    SELECT COUNT(*) INTO v_services_count
    FROM public.service_requests
    WHERE assigned_waiter_id = waiter_uuid
      AND request_status = 'pending';

    -- 4. Workload score calculation
    v_score := (v_tables_count * 10) + (v_orders_count * 5) + (v_services_count * 3);

    IF v_score < 20 THEN
        v_status := 'low';
    ELSIF v_score < 50 THEN
        v_status := 'medium';
    ELSE
        v_status := 'high';
    END IF;

    -- 5. Upsert into waiter_workloads
    INSERT INTO public.waiter_workloads (
        waiter_id, restaurant_id, active_tables_count, pending_orders_count, 
        pending_services_count, workload_score, status, last_updated
    )
    VALUES (
        waiter_uuid, v_restaurant_id, v_tables_count, v_orders_count, 
        v_services_count, v_score, v_status, NOW()
    )
    ON CONFLICT (waiter_id) DO UPDATE SET
        active_tables_count = v_tables_count,
        pending_orders_count = v_orders_count,
        pending_services_count = v_services_count,
        workload_score = v_score,
        status = v_status,
        last_updated = NOW();

    -- 6. Update employees table (and views referencing it)
    UPDATE public.employees SET
        active_tables_count = v_tables_count,
        active_orders_count = v_orders_count,
        active_workload = v_score
    WHERE id = waiter_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Trigger on orders: synchronize waiter workload on insert, status/completion update, waiter reassignment, or delete
CREATE OR REPLACE FUNCTION public.trigger_sync_order_waiter_workload()
RETURNS trigger AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF NEW.waiter_id IS NOT NULL THEN
            PERFORM public.calculate_waiter_workload(NEW.waiter_id);
        END IF;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF NEW.waiter_id IS NOT NULL THEN
            PERFORM public.calculate_waiter_workload(NEW.waiter_id);
        END IF;
        IF OLD.waiter_id IS NOT NULL AND OLD.waiter_id IS DISTINCT FROM NEW.waiter_id THEN
            PERFORM public.calculate_waiter_workload(OLD.waiter_id);
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.waiter_id IS NOT NULL THEN
            PERFORM public.calculate_waiter_workload(OLD.waiter_id);
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_workload_sync ON public.orders;
CREATE TRIGGER trg_orders_workload_sync
AFTER INSERT OR UPDATE OF waiter_id, status, is_completed OR DELETE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_sync_order_waiter_workload();


-- Trigger on tables: synchronize waiter workload on table status change or waiter assignment change
CREATE OR REPLACE FUNCTION public.trigger_sync_table_waiter_workload()
RETURNS trigger AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF NEW.assigned_waiter_id IS NOT NULL THEN
            PERFORM public.calculate_waiter_workload(NEW.assigned_waiter_id);
        END IF;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF NEW.assigned_waiter_id IS NOT NULL THEN
            PERFORM public.calculate_waiter_workload(NEW.assigned_waiter_id);
        END IF;
        IF OLD.assigned_waiter_id IS NOT NULL AND OLD.assigned_waiter_id IS DISTINCT FROM NEW.assigned_waiter_id THEN
            PERFORM public.calculate_waiter_workload(OLD.assigned_waiter_id);
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.assigned_waiter_id IS NOT NULL THEN
            PERFORM public.calculate_waiter_workload(OLD.assigned_waiter_id);
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tables_workload_sync ON public.tables;
CREATE TRIGGER trg_tables_workload_sync
AFTER INSERT OR UPDATE OF assigned_waiter_id, status OR DELETE ON public.tables
FOR EACH ROW
EXECUTE FUNCTION public.trigger_sync_table_waiter_workload();


-- Trigger on table_merge_groups: synchronize waiter workload
DROP TRIGGER IF EXISTS trg_table_merge_groups_workload_sync ON public.table_merge_groups;
CREATE TRIGGER trg_table_merge_groups_workload_sync
AFTER INSERT OR UPDATE OF assigned_waiter_id, status OR DELETE ON public.table_merge_groups
FOR EACH ROW
EXECUTE FUNCTION public.trigger_sync_table_waiter_workload();


-- Data cleanup:
-- 1. Orders marked is_completed=true but with pending statuses should be marked 'paid'
UPDATE public.orders 
SET status = 'paid' 
WHERE is_completed = true 
  AND status::text NOT IN ('cancelled', 'paid', 'completed');

-- 2. Clear assigned_waiter_id on non-active tables if no active order exists
UPDATE public.tables t
SET assigned_waiter_id = NULL
WHERE t.status::text IN ('empty', 'free', 'available', 'cleaning', 'dirty')
  AND t.assigned_waiter_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.orders o
      WHERE (o.table_id = t.id OR (t.merged_group_id IS NOT NULL AND o.merge_group_id = t.merged_group_id))
        AND COALESCE(o.is_completed, false) = false
        AND o.status::text NOT IN ('cancelled', 'paid', 'completed')
  );

-- 3. Recalculate workloads for all waiters across all restaurants to restore clean state
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.employees WHERE lower(role) = 'waiter' LOOP
        PERFORM public.calculate_waiter_workload(r.id);
    END LOOP;
END $$;
