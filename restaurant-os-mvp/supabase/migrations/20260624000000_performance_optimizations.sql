-- Migration: Dine In One Performance Optimizations
-- Date: 2026-06-24
-- Description: Mark RLS/JWT claims functions as STABLE and add indexes on foreign keys to eliminate table scans.

-- 1. Optimize RLS and JWT functions by marking them as STABLE.
-- This allows PostgreSQL to run them once per query/transaction instead of once per row, 
-- reducing cryptographic and subquery overhead by O(N).
ALTER FUNCTION public.get_vault_setting(text) STABLE;
ALTER FUNCTION public.current_user_claims() STABLE;
ALTER FUNCTION public.validate_tenant(text) STABLE;

-- 2. Create missing indexes on menu_items foreign keys and common query filters
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant 
ON public.menu_items(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_menu_items_category_restaurant 
ON public.menu_items(category_id, restaurant_id);

CREATE INDEX IF NOT EXISTS idx_menu_items_sub_category_restaurant 
ON public.menu_items(sub_category_id, restaurant_id);

CREATE INDEX IF NOT EXISTS idx_menu_items_is_today_special 
ON public.menu_items(is_today_special) WHERE is_today_special = true;

-- 3. Create missing indexes on order_items foreign keys
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_restaurant 
ON public.order_items(menu_item_id, restaurant_id);

CREATE INDEX IF NOT EXISTS idx_order_items_branch_id 
ON public.order_items(branch_id) WHERE branch_id IS NOT NULL;

-- 4. Create missing indexes on today_special_items foreign keys
CREATE INDEX IF NOT EXISTS idx_today_special_items_menu_item_restaurant 
ON public.today_special_items(menu_item_id, restaurant_id);

CREATE INDEX IF NOT EXISTS idx_today_special_items_special_restaurant 
ON public.today_special_items(today_special_id, restaurant_id);

CREATE INDEX IF NOT EXISTS idx_today_special_items_branch_id 
ON public.today_special_items(branch_id) WHERE branch_id IS NOT NULL;

-- 5. Create missing indexes on table_merge_groups references and waitered tables
CREATE INDEX IF NOT EXISTS idx_tables_merged_group_id 
ON public.tables(merged_group_id) WHERE merged_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tables_assigned_waiter_id 
ON public.tables(assigned_waiter_id) WHERE assigned_waiter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tables_branch_id 
ON public.tables(branch_id) WHERE branch_id IS NOT NULL;

-- 6. Create missing indexes on orders waiter and merge groups
CREATE INDEX IF NOT EXISTS idx_orders_waiter_id 
ON public.orders(waiter_id) WHERE waiter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_merge_group_id 
ON public.orders(merge_group_id) WHERE merge_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_branch_id 
ON public.orders(branch_id) WHERE branch_id IS NOT NULL;

-- 7. Create indexes on order status history for audit logs
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id 
ON public.order_status_history(order_id);

CREATE INDEX IF NOT EXISTS idx_order_status_history_restaurant_id 
ON public.order_status_history(restaurant_id);

-- 8. Create indexes on query telemetry metrics for performance audits
CREATE INDEX IF NOT EXISTS idx_query_metrics_restaurant_id 
ON public.query_metrics(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_query_metrics_type_latency 
ON public.query_metrics(query_type, latency_ms);

CREATE INDEX IF NOT EXISTS idx_query_metrics_created_at 
ON public.query_metrics(created_at DESC);
