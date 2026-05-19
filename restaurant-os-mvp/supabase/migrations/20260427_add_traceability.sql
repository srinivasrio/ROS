-- Add updated_by to orders and order_items for staff traceability
-- This aligns with the requirement to bind actions to the exact operator.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS updated_by UUID;

-- Optional: Create indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_orders_updated_by ON public.orders(updated_by);
CREATE INDEX IF NOT EXISTS idx_order_items_updated_by ON public.order_items(updated_by);
