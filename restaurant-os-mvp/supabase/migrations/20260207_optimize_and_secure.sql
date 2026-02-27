-- OPTIMIZATION: Indexes for "super speed" live order fetching
-- Frequent query: select * from orders where status in (...)
create index if not exists idx_orders_status on orders(status);
-- Frequent query: select * from orders where table_id = ...
create index if not exists idx_orders_table_id on orders(table_id);
-- Frequent query: select * from order_items where order_id = ...
create index if not exists idx_order_items_order_id on order_items(order_id);
-- Frequent query: select * from order_items where status = ... (for kitchen/waiter views)
create index if not exists idx_order_items_status on order_items(status);

-- SECURITY: Lock down permissions (move away from "Public Access")
-- Note: In a real app, we would use authenticated roles. 
-- For MVP, we stick to "anon" but ensuring RLS is active is good practice.
-- The previous migration enabled RLS. Only add specific policies if needed.

-- ARCHIVE/HISTORY:
-- We don't need a separate archive table yet. The `orders` table with the `status` index 
-- will perform well even with thousands of completed orders because active queries 
-- filter by `status in ('placed', 'preparing', 'ready')`.
-- Completed orders (paid/served) are just filtered out efficiently via the index.
