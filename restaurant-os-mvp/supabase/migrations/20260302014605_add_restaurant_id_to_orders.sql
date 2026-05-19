-- Add restaurant_id to orders for multi-tenancy
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS restaurant_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';

-- Force it to be NOT NULL after setting the defaults for past rows
ALTER TABLE public.orders
ALTER COLUMN restaurant_id SET NOT NULL;

-- Create an index to speed up the AI handler queries
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON public.orders(restaurant_id);
