-- Add served_at to order_items
ALTER TABLE order_items ADD COLUMN served_at TIMESTAMPTZ;

-- Add completed_at to orders
ALTER TABLE orders ADD COLUMN completed_at TIMESTAMPTZ;

-- Update existing completed orders to have completed_at = updated_at (approx)
UPDATE orders SET completed_at = updated_at WHERE is_completed = true AND completed_at IS NULL;
