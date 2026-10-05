-- P1 Remediation AD-01: Move analytics aggregation to PostgreSQL RPC
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created_at ON public.orders (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_restaurant_created_at ON public.order_items (restaurant_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_restaurant_analytics_summary(
    p_restaurant_id text,
    p_start_date timestamptz,
    p_end_date timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_revenue numeric := 0;
    v_total_orders bigint := 0;
    v_avg_order_value numeric := 0;
    v_cancellation_rate numeric := 0;
    v_active_tables bigint := 0;
    v_pending_kitchen bigint := 0;
    v_status_breakdown jsonb := '[]'::jsonb;
    v_payment_breakdown jsonb := '[]'::jsonb;
    v_category_breakdown jsonb := '[]'::jsonb;
    v_sales_by_day jsonb := '[]'::jsonb;
    v_sales_by_hour jsonb := '[]'::jsonb;
    v_top_items jsonb := '[]'::jsonb;
BEGIN
    -- 1. KPI calculations (Single pass aggregation over orders)
    SELECT
        COALESCE(SUM(total_amount) FILTER (WHERE status IN ('served', 'paid')), 0),
        COUNT(id) FILTER (WHERE status IN ('served', 'paid')),
        ROUND(COALESCE(AVG(total_amount) FILTER (WHERE status IN ('served', 'paid')), 0)),
        CASE 
            WHEN COUNT(id) > 0 THEN ROUND((COUNT(id) FILTER (WHERE status = 'cancelled')::numeric / COUNT(id)::numeric) * 100)
            ELSE 0 
        END
    INTO
        v_total_revenue,
        v_total_orders,
        v_avg_order_value,
        v_cancellation_rate
    FROM orders
    WHERE restaurant_id = p_restaurant_id
      AND created_at >= p_start_date
      AND created_at <= p_end_date;

    -- 2. Live metrics
    SELECT COUNT(id) INTO v_active_tables
    FROM tables
    WHERE restaurant_id = p_restaurant_id
      AND status = 'occupied';

    SELECT COUNT(id) INTO v_pending_kitchen
    FROM orders
    WHERE restaurant_id = p_restaurant_id
      AND status IN ('placed', 'preparing');

    -- 3. Order status breakdown
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', initcap(status::text),
        'value', cnt
    )), '[]'::jsonb)
    INTO v_status_breakdown
    FROM (
        SELECT status, COUNT(*)::bigint as cnt
        FROM orders
        WHERE restaurant_id = p_restaurant_id
          AND created_at >= p_start_date
          AND created_at <= p_end_date
        GROUP BY status
    ) s;

    -- 4. Payment method split
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', UPPER(COALESCE(payment_method, 'UNKNOWN')),
        'value', rev
    )), '[]'::jsonb)
    INTO v_payment_breakdown
    FROM (
        SELECT payment_method, SUM(total_amount) as rev
        FROM orders
        WHERE restaurant_id = p_restaurant_id
          AND status = 'paid'
          AND created_at >= p_start_date
          AND created_at <= p_end_date
        GROUP BY payment_method
    ) p;

    -- 5. Revenue by Category
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', cat_name,
        'value', rev
    )), '[]'::jsonb)
    INTO v_category_breakdown
    FROM (
        SELECT 
            COALESCE(c.name, 'Uncategorized') as cat_name,
            ROUND(SUM(oi.quantity * oi.price_at_time)) as rev
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        LEFT JOIN categories c ON mi.category_id = c.id
        WHERE oi.restaurant_id = p_restaurant_id
          AND oi.created_at >= p_start_date
          AND oi.created_at <= p_end_date
        GROUP BY c.name
    ) cat;

    -- 6. Sales by Day
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'label', to_char(day_series, 'DD Mon'),
        'value', COALESCE(daily.rev, 0)
    ) ORDER BY day_series), '[]'::jsonb)
    INTO v_sales_by_day
    FROM (
        SELECT date_trunc('day', p_start_date) + (n || ' days')::interval as day_series
        FROM generate_series(0, GREATEST(0, EXTRACT(DAY FROM (p_end_date - p_start_date))::int)) n
    ) d
    LEFT JOIN (
        SELECT date_trunc('day', created_at) as day_grp, SUM(total_amount) as rev
        FROM orders
        WHERE restaurant_id = p_restaurant_id
          AND status IN ('served', 'paid')
          AND created_at >= p_start_date
          AND created_at <= p_end_date
        GROUP BY date_trunc('day', created_at)
    ) daily ON d.day_series = daily.day_grp;

    -- 7. Sales by Hour (for short ranges)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'label', h || ':00',
        'value', COALESCE(hourly.rev, 0)
    ) ORDER BY h), '[]'::jsonb)
    INTO v_sales_by_hour
    FROM generate_series(0, 23) h
    LEFT JOIN (
        SELECT EXTRACT(HOUR FROM created_at)::int as hr, SUM(total_amount) as rev
        FROM orders
        WHERE restaurant_id = p_restaurant_id
          AND status IN ('served', 'paid')
          AND created_at >= p_start_date
          AND created_at <= p_end_date
        GROUP BY EXTRACT(HOUR FROM created_at)::int
    ) hourly ON h = hourly.hr;

    -- 8. Top Selling Items (top 10 by quantity)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', item_name,
        'quantity', qty,
        'revenue', rev,
        'category', cat_name
    )), '[]'::jsonb)
    INTO v_top_items
    FROM (
        SELECT 
            COALESCE(oi.combo_name, mi.name, 'Item') as item_name,
            SUM(oi.quantity)::bigint as qty,
            ROUND(SUM(oi.quantity * oi.price_at_time)) as rev,
            COALESCE(c.name, CASE WHEN oi.combo_name IS NOT NULL THEN 'Specials' ELSE 'Other' END) as cat_name
        FROM order_items oi
        LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
        LEFT JOIN categories c ON mi.category_id = c.id
        WHERE oi.restaurant_id = p_restaurant_id
          AND oi.created_at >= p_start_date
          AND oi.created_at <= p_end_date
        GROUP BY COALESCE(oi.combo_name, mi.name, 'Item'), c.name, oi.combo_name
        ORDER BY qty DESC
        LIMIT 10
    ) ti;

    RETURN jsonb_build_object(
        'kpi', jsonb_build_object(
            'totalRevenue', v_total_revenue,
            'totalOrders', v_total_orders,
            'avgOrderValue', v_avg_order_value,
            'cancellationRate', v_cancellation_rate,
            'activeTables', v_active_tables,
            'pendingKitchenOrders', v_pending_kitchen
        ),
        'status_breakdown', v_status_breakdown,
        'payment_breakdown', v_payment_breakdown,
        'category_breakdown', v_category_breakdown,
        'sales_by_day', v_sales_by_day,
        'sales_by_hour', v_sales_by_hour,
        'top_items', v_top_items
    );
END;
$$;
