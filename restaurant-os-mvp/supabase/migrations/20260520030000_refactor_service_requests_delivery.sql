BEGIN;

ALTER TABLE public.service_requests RENAME COLUMN assigned_staff_id TO assigned_waiter_id;
ALTER TABLE public.service_requests RENAME COLUMN status TO request_status;
ALTER TABLE public.service_requests RENAME COLUMN resolved_at TO completed_at;
ALTER TABLE public.service_requests ADD COLUMN accepted_by UUID REFERENCES public.staff(id);
ALTER TABLE public.service_requests ADD COLUMN accepted_at TIMESTAMP WITH TIME ZONE;

-- Recreate calculate_waiter_workload
CREATE OR REPLACE FUNCTION public.calculate_waiter_workload(waiter_uuid uuid)
RETURNS void AS $$
DECLARE
    v_tables_count INTEGER;
    v_orders_count INTEGER;
    v_services_count INTEGER;
    v_score INTEGER;
    v_status TEXT;
    v_restaurant_id TEXT;
BEGIN
    SELECT restaurant_id INTO v_restaurant_id FROM public.staff WHERE id = waiter_uuid;

    SELECT COUNT(*) INTO v_tables_count 
    FROM public.tables 
    WHERE assigned_waiter_id = waiter_uuid AND status IN ('occupied', 'payment_pending');

    SELECT v_tables_count + COUNT(*) INTO v_tables_count
    FROM public.table_merge_groups
    WHERE assigned_waiter_id = waiter_uuid AND status = 'occupied';

    SELECT COUNT(*) INTO v_orders_count
    FROM public.orders
    WHERE waiter_id = waiter_uuid AND status IN ('placed', 'preparing', 'ready', 'queued');

    SELECT COUNT(*) INTO v_services_count
    FROM public.service_requests
    WHERE assigned_waiter_id = waiter_uuid AND request_status = 'pending';

    v_score := (v_tables_count * 10) + (v_orders_count * 5) + (v_services_count * 3);

    IF v_score < 20 THEN
        v_status := 'low';
    ELSIF v_score < 50 THEN
        v_status := 'medium';
    ELSE
        v_status := 'high';
    END IF;

    INSERT INTO public.waiter_workloads (waiter_id, restaurant_id, active_tables_count, pending_orders_count, pending_services_count, workload_score, status, last_updated)
    VALUES (waiter_uuid, v_restaurant_id, v_tables_count, v_orders_count, v_services_count, v_score, v_status, NOW())
    ON CONFLICT (waiter_id) DO UPDATE SET
        active_tables_count = v_tables_count,
        pending_orders_count = v_orders_count,
        pending_services_count = v_services_count,
        workload_score = v_score,
        status = v_status,
        last_updated = NOW();

    UPDATE public.staff SET
        active_tables_count = v_tables_count,
        active_orders_count = v_orders_count,
        active_workload = v_score
    WHERE id = waiter_uuid;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger function
CREATE OR REPLACE FUNCTION public.trigger_update_workload_services()
RETURNS trigger AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF (NEW.assigned_waiter_id IS NOT NULL) THEN
            PERFORM calculate_waiter_workload(NEW.assigned_waiter_id);
        END IF;
        IF (TG_OP = 'UPDATE' AND OLD.assigned_waiter_id IS NOT NULL AND OLD.assigned_waiter_id <> NEW.assigned_waiter_id) THEN
            PERFORM calculate_waiter_workload(OLD.assigned_waiter_id);
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF (OLD.assigned_waiter_id IS NOT NULL) THEN
            PERFORM calculate_waiter_workload(OLD.assigned_waiter_id);
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Recreate calculate_ops_knowledge
CREATE OR REPLACE FUNCTION public.calculate_ops_knowledge()
RETURNS void AS $$
DECLARE
    ops_json JSONB;
    v_restaurant_id TEXT;
BEGIN
    SELECT restaurant_id INTO v_restaurant_id FROM public.restaurant_profile LIMIT 1;
    
    IF v_restaurant_id IS NULL THEN
        RETURN;
    END IF;

    SELECT jsonb_build_object(
        'active_tables', (SELECT COUNT(*) FROM tables WHERE restaurant_id = v_restaurant_id AND status = 'occupied'),
        'pending_service_requests', (SELECT COUNT(*) FROM service_requests WHERE restaurant_id = v_restaurant_id AND request_status = 'pending'),
        'active_orders', (SELECT COUNT(*) FROM orders WHERE restaurant_id = v_restaurant_id AND status NOT IN ('paid', 'cancelled')),
        'avg_prep_time', (SELECT AVG(EXTRACT(EPOCH FROM (oi.served_at - oi.created_at))/60)::NUMERIC(10,2) 
                          FROM order_items oi
                          JOIN orders o ON oi.order_id = o.id
                          WHERE o.restaurant_id = v_restaurant_id 
                          AND oi.status = 'served' 
                          AND oi.created_at > NOW() - INTERVAL '24 hours'),
        'top_selling_items', (
            SELECT jsonb_agg(
                jsonb_build_object('name', mi.name, 'count', COALESCE(item_counts.count, 0))
            )
            FROM (
                SELECT oi.menu_item_id, COUNT(*) as count
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                WHERE o.restaurant_id = v_restaurant_id
                GROUP BY oi.menu_item_id
                ORDER BY count DESC
                LIMIT 5
            ) item_counts
            JOIN menu_items mi ON item_counts.menu_item_id = mi.id
        )
    ) INTO ops_json;

    INSERT INTO public.restaurant_knowledge (restaurant_id, module, content, last_updated)
    VALUES (v_restaurant_id, 'operations', ops_json, NOW())
    ON CONFLICT (restaurant_id, module) 
    DO UPDATE SET content = EXCLUDED.content, last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
