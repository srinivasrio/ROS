-- Migration: Optimize Super Admin Dashboard Statistics (P2-04 / SA-02)
-- Moves full-table in-memory dashboard calculations into a single PostgreSQL aggregation RPC.

CREATE OR REPLACE FUNCTION get_superadmin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_restaurants int;
    v_active_restaurants int;
    v_trial_restaurants int;
    v_suspended_restaurants int;
    v_total_branches int;
    v_emp_count int;
    v_dine_user_count int;
    v_active_subscriptions int;
    v_pending_tickets int;
    v_settled_revenue numeric;
    v_sub_breakdown jsonb;
    v_recent_activity jsonb;
    v_result jsonb;
BEGIN
    -- 1. Restaurant metrics
    SELECT 
        count(*),
        count(*) FILTER (WHERE lower(coalesce(status, '')) = 'active'),
        count(*) FILTER (WHERE lower(coalesce(status, '')) IN ('trial', 'pending') OR lower(coalesce(subscription_plan, '')) LIKE '%trial%'),
        count(*) FILTER (WHERE lower(coalesce(status, '')) = 'suspended')
    INTO v_total_restaurants, v_active_restaurants, v_trial_restaurants, v_suspended_restaurants
    FROM restaurants
    WHERE deleted_at IS NULL;

    -- 2. Branches count
    SELECT count(*) INTO v_total_branches
    FROM branches
    WHERE deleted_at IS NULL;

    -- 3. Users count
    SELECT count(*) INTO v_emp_count FROM employees WHERE deleted_at IS NULL;
    SELECT count(*) INTO v_dine_user_count FROM dine_users;

    -- 4. Active subscriptions
    SELECT count(*) INTO v_active_subscriptions
    FROM subscriptions
    WHERE lower(coalesce(status, '')) = 'active';

    IF v_active_subscriptions = 0 THEN
        v_active_subscriptions := v_active_restaurants;
    END IF;

    -- 5. Pending support tickets
    SELECT count(*) INTO v_pending_tickets
    FROM support_tickets
    WHERE lower(coalesce(status, '')) IN ('open', 'in_progress');

    -- 6. Revenue from settled invoices
    SELECT coalesce(sum(total), 0) INTO v_settled_revenue
    FROM invoices
    WHERE lower(coalesce(status, '')) = 'paid';

    -- 7. Subscription Breakdown
    SELECT jsonb_build_array(
        jsonb_build_object('name', 'Trial (14-Day)', 'value', greatest((SELECT count(*) FROM subscriptions WHERE lower(coalesce(status, '')) = 'trialing'), v_trial_restaurants, 2), 'color', '#06B6D4'),
        jsonb_build_object('name', 'Starter Tier', 'value', greatest((SELECT count(*) FROM subscriptions WHERE lower(coalesce(plan_name, '')) = 'starter'), 1), 'color', '#3B82F6'),
        jsonb_build_object('name', 'Growth Monthly', 'value', greatest((SELECT count(*) FROM subscriptions WHERE lower(coalesce(plan_name, '')) = 'growth'), 4), 'color', '#4F46E5'),
        jsonb_build_object('name', 'Enterprise', 'value', greatest((SELECT count(*) FROM subscriptions WHERE lower(coalesce(plan_name, '')) = 'enterprise'), 1), 'color', '#10B981')
    ) INTO v_sub_breakdown;

    -- 8. Recent Activity (6 items)
    SELECT coalesce(jsonb_agg(sub), '[]'::jsonb) INTO v_recent_activity FROM (
        SELECT id, user_id, action, details, created_at
        FROM audit_logs
        ORDER BY created_at DESC
        LIMIT 6
    ) sub;

    v_result := jsonb_build_object(
        'totalRestaurants', v_total_restaurants,
        'activeRestaurants', v_active_restaurants,
        'trialRestaurants', v_trial_restaurants,
        'suspendedRestaurants', v_suspended_restaurants,
        'totalBranches', v_total_branches,
        'activeUsers', (v_emp_count + v_dine_user_count),
        'activeSubscriptions', v_active_subscriptions,
        'pendingTickets', v_pending_tickets,
        'settledRevenue', v_settled_revenue,
        'subscriptionBreakdown', v_sub_breakdown,
        'recentLogs', v_recent_activity
    );

    RETURN v_result;
END;
$$;
