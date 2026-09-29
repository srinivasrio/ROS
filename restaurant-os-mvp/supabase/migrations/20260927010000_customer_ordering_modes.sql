-- Migration: Add customer ordering modes, restaurant location settings, customer addresses
-- Date: 2026-09-27

ALTER TABLE delivery_settings
ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS dine_in_takeaway_order_radius NUMERIC(5, 2) DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS dine_in_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS takeaway_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS delivery_enabled BOOLEAN DEFAULT true;

UPDATE delivery_settings SET delivery_enabled = enabled WHERE delivery_enabled IS NULL;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS delivery_lat NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS delivery_lng NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS customer_lat NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS customer_lng NUMERIC(10, 7);

CREATE TABLE IF NOT EXISTS customer_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    restaurant_id TEXT NOT NULL,
    label TEXT DEFAULT 'Home',
    address_line TEXT NOT NULL,
    landmark TEXT,
    city TEXT,
    pincode TEXT,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id ON customer_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_restaurant_id ON customer_addresses(restaurant_id);

ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'customer_addresses' AND policyname = 'customer_addresses_all'
    ) THEN
        CREATE POLICY customer_addresses_all ON customer_addresses FOR ALL USING (true) WITH CHECK (true);
    END IF;
END
$$;
