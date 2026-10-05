-- Migration: Preserve waiter table assignment after payment until cleared
-- When a waiter marks a table as paid, the table transitions to 'cleaning'/'dirty'
-- The table and its assigned waiter MUST NOT be removed automatically.
-- The table remains assigned to the waiter until either waiter or restaurant admin manually clears it.

CREATE OR REPLACE FUNCTION public.get_tables_by_restaurant(p_restaurant_id text)
 RETURNS TABLE(
   id bigint, 
   table_number text, 
   status text, 
   capacity integer, 
   restaurant_id text, 
   area_id text, 
   area_name text, 
   alert_status text, 
   is_merged boolean, 
   merged_group_id text, 
   display_name text, 
   assigned_waiter_id text, 
   assigned_waiter_name text, 
   assigned_waiter_avatar text, 
   customer_present_at timestamp with time zone, 
   last_activity_at timestamp with time zone, 
   is_pinned boolean, 
   co_waiter_ids jsonb, 
   co_waiter_names text, 
   transferred_from_waiter_id text, 
   transferred_from_waiter_name text, 
   transferred_to_waiter_id text, 
   transferred_to_waiter_name text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.table_number,
    CASE 
      WHEN active_ord.id IS NOT NULL THEN 'occupied'
      WHEN t.status::text IN ('need_bill', 'billing', 'bill_requested') THEN 'need_bill'
      WHEN t.status::text IN ('dirty', 'cleaning', 'to_clean') THEN 'dirty'
      WHEN t.status::text IN ('on_hold', 'hold') THEN 'on_hold'
      WHEN t.status::text = 'reserved' THEN 'reserved'
      WHEN t.status::text IN ('occupied', 'eating', 'cooking', 'placed') THEN 'occupied'
      ELSE 'available'
    END as status,
    COALESCE(t.capacity, 4)::integer as capacity,
    t.restaurant_id,
    t.area_id::text,
    COALESCE(ra.name, 'Main Floor') as area_name,
    t.alert_status::text,
    COALESCE(t.is_merged, false) as is_merged,
    t.merged_group_id::text,
    COALESCE(tmg.display_name, 'Table ' || t.table_number) as display_name,
    CASE 
      WHEN t.status::text IN ('available', 'empty', 'free') AND active_ord.id IS NULL THEN NULL
      ELSE COALESCE(t.assigned_waiter_id::text, active_ord.waiter_id::text, latest_ord.waiter_id::text)
    END as assigned_waiter_id,
    CASE 
      WHEN t.status::text IN ('available', 'empty', 'free') AND active_ord.id IS NULL THEN NULL
      ELSE emp.name
    END as assigned_waiter_name,
    CASE 
      WHEN t.status::text IN ('available', 'empty', 'free') AND active_ord.id IS NULL THEN NULL
      ELSE emp.avatar_url
    END as assigned_waiter_avatar,
    t.customer_present_at,
    t.last_activity_at,
    COALESCE(t.is_pinned, false) as is_pinned,
    CASE 
      WHEN t.status::text IN ('available', 'empty', 'free') AND active_ord.id IS NULL THEN '[]'::jsonb
      ELSE COALESCE(t.co_waiter_ids, '[]'::jsonb)
    END as co_waiter_ids,
    CASE 
      WHEN t.status::text IN ('available', 'empty', 'free') AND active_ord.id IS NULL THEN NULL
      ELSE (
        SELECT string_agg(DISTINCT e.name, ', ')
        FROM public.employees e
        WHERE (COALESCE(t.co_waiter_ids, '[]'::jsonb) ? e.id::text
           OR COALESCE(t.co_waiter_ids, '[]'::jsonb) ? e.employee_id)
          AND e.id::text != COALESCE(t.assigned_waiter_id::text, active_ord.waiter_id::text, latest_ord.waiter_id::text, '')
          AND e.name != COALESCE(emp.name, '')
      )
    END as co_waiter_names,
    t.transferred_from_waiter_id::text,
    emp_from.name as transferred_from_waiter_name,
    t.transferred_to_waiter_id::text,
    emp_to.name as transferred_to_waiter_name
  FROM tables t
  LEFT JOIN restaurant_areas ra ON t.area_id = ra.id
  LEFT JOIN table_merge_groups tmg ON t.merged_group_id = tmg.id
  LEFT JOIN LATERAL (
    SELECT o.id, o.waiter_id 
    FROM orders o 
    WHERE (o.table_id = t.id OR (t.merged_group_id IS NOT NULL AND o.merge_group_id = t.merged_group_id))
      AND o.restaurant_id = p_restaurant_id
      AND COALESCE(o.is_completed, false) = false
      AND o.status::text IN ('placed', 'preparing', 'ready', 'served')
    ORDER BY o.created_at DESC
    LIMIT 1
  ) active_ord ON true
  LEFT JOIN LATERAL (
    SELECT o.id, o.waiter_id 
    FROM orders o 
    WHERE (o.table_id = t.id OR (t.merged_group_id IS NOT NULL AND o.merge_group_id = t.merged_group_id))
      AND o.restaurant_id = p_restaurant_id
    ORDER BY o.created_at DESC
    LIMIT 1
  ) latest_ord ON true
  LEFT JOIN employees emp ON (
    CASE 
      WHEN t.status::text IN ('available', 'empty', 'free') AND active_ord.id IS NULL THEN NULL
      ELSE COALESCE(t.assigned_waiter_id::text, active_ord.waiter_id::text, latest_ord.waiter_id::text)
    END
  ) = emp.id::text
  LEFT JOIN employees emp_from ON t.transferred_from_waiter_id = emp_from.id
  LEFT JOIN employees emp_to ON t.transferred_to_waiter_id = emp_to.id
  WHERE t.restaurant_id = p_restaurant_id
  ORDER BY 
    COALESCE(t.is_pinned, false) DESC,
    CASE 
      WHEN t.table_number ~ '^[0-9]+$' THEN t.table_number::int 
      ELSE 9999 
    END ASC,
    t.table_number ASC;
END;
$function$;
