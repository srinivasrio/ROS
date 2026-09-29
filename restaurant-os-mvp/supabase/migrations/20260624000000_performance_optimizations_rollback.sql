-- Rollback Migration: Dine In One Performance Optimizations Rollback
-- Date: 2026-06-24
-- Description: Revert RLS functions back to VOLATILE and drop newly created indexes.

-- 1. Revert RLS and JWT functions to default VOLATILE state
ALTER FUNCTION public.get_vault_setting(text) VOLATILE;
ALTER FUNCTION public.current_user_claims() VOLATILE;
ALTER FUNCTION public.validate_tenant(text) VOLATILE;

-- 2. Drop menu_items indexes
DROP INDEX IF EXISTS public.idx_menu_items_restaurant;
DROP INDEX IF EXISTS public.idx_menu_items_category_restaurant;
DROP INDEX IF EXISTS public.idx_menu_items_sub_category_restaurant;
DROP INDEX IF EXISTS public.idx_menu_items_is_today_special;

-- 3. Drop order_items indexes
DROP INDEX IF EXISTS public.idx_order_items_menu_item_restaurant;
DROP INDEX IF EXISTS public.idx_order_items_branch_id;

-- 4. Drop today_special_items indexes
DROP INDEX IF EXISTS public.idx_today_special_items_menu_item_restaurant;
DROP INDEX IF EXISTS public.idx_today_special_items_special_restaurant;
DROP INDEX IF EXISTS public.idx_today_special_items_branch_id;

-- 5. Drop tables indexes
DROP INDEX IF EXISTS public.idx_tables_merged_group_id;
DROP INDEX IF EXISTS public.idx_tables_assigned_waiter_id;
DROP INDEX IF EXISTS public.idx_tables_branch_id;

-- 6. Drop orders indexes
DROP INDEX IF EXISTS public.idx_orders_waiter_id;
DROP INDEX IF EXISTS public.idx_orders_merge_group_id;
DROP INDEX IF EXISTS public.idx_orders_branch_id;

-- 7. Drop order status history indexes
DROP INDEX IF EXISTS public.idx_order_status_history_order_id;
DROP INDEX IF EXISTS public.idx_order_status_history_restaurant_id;

-- 8. Drop query metrics indexes
DROP INDEX IF EXISTS public.idx_query_metrics_restaurant_id;
DROP INDEX IF EXISTS public.idx_query_metrics_type_latency;
DROP INDEX IF EXISTS public.idx_query_metrics_created_at;
