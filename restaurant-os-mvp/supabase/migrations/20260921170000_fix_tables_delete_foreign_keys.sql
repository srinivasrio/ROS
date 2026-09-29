-- Fix foreign key constraints on orders and waiter_assignments referencing tables(id)
-- When a table is deleted:
-- 1. orders.table_id is set to NULL (preserving historical order reporting and financials)
-- 2. waiter_assignments for that table are cascaded

ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_table_id_fkey,
ADD CONSTRAINT orders_table_id_fkey
    FOREIGN KEY (table_id)
    REFERENCES public.tables(id)
    ON DELETE SET NULL;

ALTER TABLE public.waiter_assignments
DROP CONSTRAINT IF EXISTS waiter_assignments_table_id_fkey,
ADD CONSTRAINT waiter_assignments_table_id_fkey
    FOREIGN KEY (table_id)
    REFERENCES public.tables(id)
    ON DELETE CASCADE;

ALTER TABLE public.waiter_assignments
DROP CONSTRAINT IF EXISTS waiter_assignments_merge_group_id_fkey,
ADD CONSTRAINT waiter_assignments_merge_group_id_fkey
    FOREIGN KEY (merge_group_id)
    REFERENCES public.table_merge_groups(id)
    ON DELETE CASCADE;
