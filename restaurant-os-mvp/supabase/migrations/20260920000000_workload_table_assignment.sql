-- Migration: Workload-based waiter table and order assignment with concurrency control
-- Date: 2026-09-20

-- 1. Create or replace assign_least_busy_waiter function
CREATE OR REPLACE FUNCTION public.assign_least_busy_waiter(
    p_restaurant_id text,
    p_table_id bigint DEFAULT NULL,
    p_merge_group_id uuid DEFAULT NULL,
    p_order_id text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_existing_waiter uuid;
    v_chosen_waiter RECORD;
    v_result jsonb;
BEGIN
    -- Advisory xact lock prevents race conditions on concurrent orders for the same restaurant
    PERFORM pg_advisory_xact_lock(hashtext(p_restaurant_id));

    -- 1. Check if the table or merge group ALREADY has an assigned waiter
    IF p_table_id IS NOT NULL THEN
        SELECT assigned_waiter_id INTO v_existing_waiter 
        FROM public.tables 
        WHERE id = p_table_id AND restaurant_id = p_restaurant_id;
    ELSIF p_merge_group_id IS NOT NULL THEN
        SELECT assigned_waiter_id INTO v_existing_waiter 
        FROM public.table_merge_groups 
        WHERE id = p_merge_group_id AND restaurant_id = p_restaurant_id;
    END IF;

    -- If already assigned, ONLY preserve if the waiter is currently ACTIVE and ONLINE!
    IF v_existing_waiter IS NOT NULL THEN
        SELECT e.id INTO v_existing_active_waiter
        FROM public.employees e
        WHERE e.id = v_existing_waiter
          AND e.restaurant_id = p_restaurant_id
          AND lower(e.role) = 'waiter'
          AND e.status = 'active'
          AND e.is_deleted = false
          AND (e.is_online = true OR e.availability_status IN ('available', 'busy', 'online'))
          AND e.availability_status NOT IN ('offline', 'break');

        IF v_existing_active_waiter IS NOT NULL THEN
            -- If order_id provided, ensure order is tagged with this waiter
            IF p_order_id IS NOT NULL THEN
                UPDATE public.orders 
                SET waiter_id = v_existing_active_waiter 
                WHERE id = p_order_id AND (waiter_id IS NULL OR waiter_id <> v_existing_active_waiter);
            END IF;

            -- Ensure table status reflects occupied if it was empty/free/customer_present
            IF p_table_id IS NOT NULL THEN
                UPDATE public.tables 
                SET status = CASE WHEN status IN ('empty', 'free', 'customer_present') THEN 'occupied' ELSE status END,
                    last_activity_at = NOW()
                WHERE id = p_table_id;
            ELSIF p_merge_group_id IS NOT NULL THEN
                UPDATE public.table_merge_groups 
                SET status = CASE WHEN status IN ('empty', 'free', 'customer_present') THEN 'occupied' ELSE status END,
                    last_activity_at = NOW()
                WHERE id = p_merge_group_id;
                UPDATE public.tables 
                SET status = CASE WHEN status IN ('empty', 'free', 'customer_present') THEN 'occupied' ELSE status END,
                    last_activity_at = NOW()
                WHERE merged_group_id = p_merge_group_id;
            END IF;

            SELECT jsonb_build_object(
                'id', e.id,
                'name', e.name,
                'preserved', true,
                'active_tables_count', e.active_tables_count,
                'active_orders_count', e.active_orders_count,
                'is_overloaded', false
            ) INTO v_result
            FROM public.employees e
            WHERE e.id = v_existing_active_waiter;

            RETURN v_result;
        ELSE
            -- The existing waiter is inactive or offline! Reassign to an active waiter.
            v_existing_waiter := NULL;
        END IF;
    END IF;

    -- 2. Find the available waiter with the lowest active workload among ACTIVE waiters
    SELECT 
        e.id, 
        e.name, 
        e.last_assigned_at,
        COALESCE(t_count.active_tables, 0) AS active_tables_count,
        COALESCE(o_count.active_orders, 0) AS active_orders_count
    INTO v_chosen_waiter
    FROM public.employees e
    LEFT JOIN (
        SELECT waiter_id, count(DISTINCT table_key) AS active_tables
        FROM (
            SELECT assigned_waiter_id AS waiter_id, 'table_' || id::text AS table_key
            FROM public.tables
            WHERE restaurant_id = p_restaurant_id
              AND assigned_waiter_id IS NOT NULL
              AND status NOT IN ('empty', 'free', 'available', 'cleaning')
            UNION
            SELECT assigned_waiter_id AS waiter_id, 'group_' || id::text AS table_key
            FROM public.table_merge_groups
            WHERE restaurant_id = p_restaurant_id
              AND assigned_waiter_id IS NOT NULL
              AND status NOT IN ('empty', 'free', 'available', 'cleaning')
            UNION
            SELECT waiter_id, 
                   CASE WHEN table_id IS NOT NULL THEN 'table_' || table_id::text 
                        ELSE 'group_' || merge_group_id::text END AS table_key
            FROM public.orders
            WHERE restaurant_id = p_restaurant_id
              AND waiter_id IS NOT NULL
              AND is_completed = false
              AND status::text NOT IN ('cancelled', 'paid')
              AND (table_id IS NOT NULL OR merge_group_id IS NOT NULL)
        ) sub
        GROUP BY waiter_id
    ) t_count ON t_count.waiter_id = e.id
    LEFT JOIN (
        SELECT waiter_id, count(*) AS active_orders
        FROM public.orders
        WHERE restaurant_id = p_restaurant_id
          AND waiter_id IS NOT NULL
          AND is_completed = false
          AND status::text NOT IN ('cancelled', 'paid')
        GROUP BY waiter_id
    ) o_count ON o_count.waiter_id = e.id
    WHERE e.restaurant_id = p_restaurant_id
      AND lower(e.role) = 'waiter'
      AND e.status = 'active'
      AND e.is_deleted = false
      AND (
          e.is_online = true 
          OR e.availability_status IN ('available', 'busy', 'online')
      )
      AND e.availability_status NOT IN ('offline', 'break')
    ORDER BY
      COALESCE(t_count.active_tables, 0) ASC,
      COALESCE(o_count.active_orders, 0) ASC,
      e.last_assigned_at ASC NULLS FIRST,
      e.id ASC
    LIMIT 1;

    -- Check if overloaded
    SELECT count(*) INTO v_active_waiters_count
    FROM public.employees e
    WHERE e.restaurant_id = p_restaurant_id
      AND lower(e.role) = 'waiter'
      AND e.status = 'active'
      AND e.is_deleted = false
      AND (e.is_online = true OR e.availability_status IN ('available', 'busy', 'online'))
      AND e.availability_status NOT IN ('offline', 'break');

    IF v_active_waiters_count = 0 OR (v_chosen_waiter.id IS NOT NULL AND v_chosen_waiter.active_tables_count >= 3) THEN
        v_is_overloaded := true;
    END IF;

    -- If no available active waiter found, return null with overload flag
    IF v_chosen_waiter.id IS NULL THEN
        RETURN jsonb_build_object('id', null, 'is_overloaded', true);
    END IF;

    -- 3. Assign the chosen active waiter to table / merge group
    IF p_table_id IS NOT NULL THEN
        UPDATE public.tables 
        SET assigned_waiter_id = v_chosen_waiter.id,
            status = CASE WHEN status IN ('empty', 'free', 'customer_present') THEN 'occupied' ELSE status END,
            last_activity_at = NOW()
        WHERE id = p_table_id;
    ELSIF p_merge_group_id IS NOT NULL THEN
        UPDATE public.table_merge_groups 
        SET assigned_waiter_id = v_chosen_waiter.id,
            status = CASE WHEN status IN ('empty', 'free', 'customer_present') THEN 'occupied' ELSE status END,
            last_activity_at = NOW()
        WHERE id = p_merge_group_id;

        UPDATE public.tables 
        SET assigned_waiter_id = v_chosen_waiter.id,
            status = CASE WHEN status IN ('empty', 'free', 'customer_present') THEN 'occupied' ELSE status END,
            last_activity_at = NOW()
        WHERE merged_group_id = p_merge_group_id;
    END IF;

    -- 4. If order_id provided, assign waiter to the order
    IF p_order_id IS NOT NULL THEN
        UPDATE public.orders 
        SET waiter_id = v_chosen_waiter.id 
        WHERE id = p_order_id;
    END IF;

    -- 5. Immediately update waiter's last_assigned_at and workload counts
    UPDATE public.employees 
    SET last_assigned_at = NOW(),
        active_tables_count = v_chosen_waiter.active_tables_count + 1,
        active_orders_count = v_chosen_waiter.active_orders_count + CASE WHEN p_order_id IS NOT NULL THEN 1 ELSE 0 END,
        active_workload = ((v_chosen_waiter.active_tables_count + 1) * 100) + (v_chosen_waiter.active_orders_count + CASE WHEN p_order_id IS NOT NULL THEN 1 ELSE 0 END)
    WHERE id = v_chosen_waiter.id;

    RETURN jsonb_build_object(
        'id', v_chosen_waiter.id,
        'name', v_chosen_waiter.name,
        'preserved', false,
        'active_tables_count', v_chosen_waiter.active_tables_count + 1,
        'active_orders_count', v_chosen_waiter.active_orders_count + CASE WHEN p_order_id IS NOT NULL THEN 1 ELSE 0 END,
        'is_overloaded', v_is_overloaded
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update get_least_busy_waiter to use the same comprehensive workload logic
CREATE OR REPLACE FUNCTION public.get_least_busy_waiter(p_restaurant_id text)
RETURNS uuid AS $$
DECLARE
    v_waiter_id uuid;
BEGIN
    SELECT e.id INTO v_waiter_id
    FROM public.employees e
    LEFT JOIN (
        SELECT waiter_id, count(DISTINCT table_key) AS active_tables
        FROM (
            SELECT assigned_waiter_id AS waiter_id, 'table_' || id::text AS table_key
            FROM public.tables
            WHERE restaurant_id = p_restaurant_id
              AND assigned_waiter_id IS NOT NULL
              AND status NOT IN ('empty', 'free', 'available', 'cleaning')
            UNION
            SELECT assigned_waiter_id AS waiter_id, 'group_' || id::text AS table_key
            FROM public.table_merge_groups
            WHERE restaurant_id = p_restaurant_id
              AND assigned_waiter_id IS NOT NULL
              AND status NOT IN ('empty', 'free', 'available', 'cleaning')
            UNION
            SELECT waiter_id, 
                   CASE WHEN table_id IS NOT NULL THEN 'table_' || table_id::text 
                        ELSE 'group_' || merge_group_id::text END AS table_key
            FROM public.orders
            WHERE restaurant_id = p_restaurant_id
              AND waiter_id IS NOT NULL
              AND is_completed = false
              AND status::text NOT IN ('cancelled', 'paid')
              AND (table_id IS NOT NULL OR merge_group_id IS NOT NULL)
        ) sub
        GROUP BY waiter_id
    ) t_count ON t_count.waiter_id = e.id
    LEFT JOIN (
        SELECT waiter_id, count(*) AS active_orders
        FROM public.orders
        WHERE restaurant_id = p_restaurant_id
          AND waiter_id IS NOT NULL
          AND is_completed = false
          AND status::text NOT IN ('cancelled', 'paid')
        GROUP BY waiter_id
    ) o_count ON o_count.waiter_id = e.id
    WHERE e.restaurant_id = p_restaurant_id
      AND lower(e.role) = 'waiter'
      AND e.status = 'active'
      AND e.is_deleted = false
      AND (
          e.is_online = true 
          OR e.availability_status IN ('available', 'busy', 'online')
      )
      AND e.availability_status NOT IN ('offline', 'break')
    ORDER BY
      COALESCE(t_count.active_tables, 0) ASC,
      COALESCE(o_count.active_orders, 0) ASC,
      e.last_assigned_at ASC NULLS FIRST,
      e.id ASC
    LIMIT 1;

    RETURN v_waiter_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create check_waiters_overload_status function
CREATE OR REPLACE FUNCTION public.check_waiters_overload_status(p_restaurant_id text)
RETURNS jsonb AS $$
DECLARE
    v_active_count integer := 0;
    v_inactive_count integer := 0;
    v_overloaded_active_count integer := 0;
    v_is_overloaded boolean := false;
    v_min_tables integer := 0;
BEGIN
    -- Count active waiters
    SELECT count(*) INTO v_active_count
    FROM public.employees e
    WHERE e.restaurant_id = p_restaurant_id
      AND lower(e.role) = 'waiter'
      AND e.status = 'active'
      AND e.is_deleted = false
      AND (e.is_online = true OR e.availability_status IN ('available', 'busy', 'online'))
      AND e.availability_status NOT IN ('offline', 'break');

    -- Count offline active waiters available to assist (Account must be Active, but Availability is Offline)
    SELECT count(*) INTO v_inactive_count
    FROM public.employees e
    WHERE e.restaurant_id = p_restaurant_id
      AND lower(e.role) = 'waiter'
      AND e.status = 'active'
      AND e.is_deleted = false
      AND (
          e.is_online = false 
          OR e.availability_status IN ('offline', 'break')
      );

    -- Overload condition
    IF v_active_count = 0 THEN
        v_is_overloaded := (v_inactive_count > 0);
    ELSE
        SELECT 
            count(*),
            min(COALESCE(t_count.active_tables, 0))
        INTO v_overloaded_active_count, v_min_tables
        FROM public.employees e
        LEFT JOIN (
            SELECT waiter_id, count(DISTINCT table_key) AS active_tables
            FROM (
                SELECT assigned_waiter_id AS waiter_id, 'table_' || id::text AS table_key
                FROM public.tables
                WHERE restaurant_id = p_restaurant_id
                  AND assigned_waiter_id IS NOT NULL
                  AND status NOT IN ('empty', 'free', 'available', 'cleaning')
                UNION
                SELECT assigned_waiter_id AS waiter_id, 'group_' || id::text AS table_key
                FROM public.table_merge_groups
                WHERE restaurant_id = p_restaurant_id
                  AND assigned_waiter_id IS NOT NULL
                  AND status NOT IN ('empty', 'free', 'available', 'cleaning')
                UNION
                SELECT waiter_id, 
                       CASE WHEN table_id IS NOT NULL THEN 'table_' || table_id::text 
                            ELSE 'group_' || merge_group_id::text END AS table_key
                FROM public.orders
                WHERE restaurant_id = p_restaurant_id
                  AND waiter_id IS NOT NULL
                  AND is_completed = false
                  AND status::text NOT IN ('cancelled', 'paid')
                  AND (table_id IS NOT NULL OR merge_group_id IS NOT NULL)
            ) sub
            GROUP BY waiter_id
        ) t_count ON t_count.waiter_id = e.id
        WHERE e.restaurant_id = p_restaurant_id
          AND lower(e.role) = 'waiter'
          AND e.status = 'active'
          AND e.is_deleted = false
          AND (e.is_online = true OR e.availability_status IN ('available', 'busy', 'online'))
          AND e.availability_status NOT IN ('offline', 'break')
          AND COALESCE(t_count.active_tables, 0) >= 3;

        v_is_overloaded := (v_overloaded_active_count = v_active_count AND v_inactive_count > 0);
    END IF;

    RETURN jsonb_build_object(
        'is_overloaded', COALESCE(v_is_overloaded, false),
        'active_waiters_count', v_active_count,
        'inactive_waiters_count', v_inactive_count,
        'online_waiters_count', v_active_count,
        'offline_waiters_count', v_inactive_count,
        'min_active_tables', COALESCE(v_min_tables, 0)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Fix staff_tasks order assignment bridge so it preserves orders.waiter_id
CREATE OR REPLACE FUNCTION public.fn_order_to_staff_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    INSERT INTO public.staff_tasks (restaurant_id, task_type, task_ref_id, assigned_staff_id, metadata)
    VALUES (
        NEW.restaurant_id, 
        'order', 
        NEW.id, 
        NEW.waiter_id, 
        jsonb_build_object('required_role', 'waiter')
    );
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_assign_staff_task()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
    v_role TEXT;
    v_staff_id UUID;
BEGIN
    -- If already assigned (e.g. from order), do not overwrite!
    IF NEW.assigned_staff_id IS NOT NULL THEN
        NEW.status := 'ongoing';
        RETURN NEW;
    END IF;

    -- Get role from metadata if explicitly provided
    v_role := NEW.metadata->>'required_role';
    
    -- If not in metadata, look up in configuration table
    IF v_role IS NULL THEN
        SELECT required_role INTO v_role 
        FROM public.staff_assignment_config
        WHERE restaurant_id = NEW.restaurant_id 
          AND task_type = NEW.task_type;
    END IF;

    -- Fallback defaults if no config exists
    IF v_role IS NULL THEN
        v_role := 'waiter';
    END IF;

    -- Find the best staff using the unified workload function
    IF v_role = 'waiter' THEN
        v_staff_id := public.get_least_busy_waiter(NEW.restaurant_id);
    ELSE
        v_staff_id := public.get_best_staff(NEW.restaurant_id, v_role);
    END IF;

    IF v_staff_id IS NOT NULL THEN
        NEW.assigned_staff_id := v_staff_id;
        NEW.status := 'ongoing';
        
        -- Update staff workload and timestamp
        UPDATE public.staff 
        SET last_assigned_at = now()
        WHERE id = v_staff_id;
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_sync_task_assignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    -- Only sync if assigned_staff_id actually changed on UPDATE
    IF (TG_OP = 'UPDATE' AND OLD.assigned_staff_id IS DISTINCT FROM NEW.assigned_staff_id) THEN
        IF NEW.task_type = 'order' AND NEW.assigned_staff_id IS NOT NULL THEN
            UPDATE public.orders SET waiter_id = NEW.assigned_staff_id WHERE id = NEW.task_ref_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

