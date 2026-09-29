-- Migration: Customer Information Collection
-- Date: 2026-09-21
-- Purpose: Create customers table for optional customer info after QR scan

-- Drop existing customers table if it exists (it was a placeholder with incomplete schema)
DROP TABLE IF EXISTS public.customers CASCADE;

-- Create the full customers table
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    mobile TEXT,
    email TEXT,
    date_of_birth DATE,
    first_visit TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_visit TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    visit_count INT NOT NULL DEFAULT 1,
    order_count INT NOT NULL DEFAULT 0,
    total_spend NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one mobile per restaurant (only when mobile is provided)
CREATE UNIQUE INDEX idx_customers_restaurant_mobile 
    ON public.customers (restaurant_id, mobile) 
    WHERE mobile IS NOT NULL;

-- Unique constraint: one email per restaurant (only when email is provided)
CREATE UNIQUE INDEX idx_customers_restaurant_email 
    ON public.customers (restaurant_id, email) 
    WHERE email IS NOT NULL;

-- Performance indexes
CREATE INDEX idx_customers_restaurant_id ON public.customers (restaurant_id);
CREATE INDEX idx_customers_last_visit ON public.customers (last_visit DESC);
CREATE INDEX idx_customers_created_at ON public.customers (created_at DESC);

-- Enable RLS (no public policies — all access via service role from API routes)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Add optional customer_id column to orders table for linking
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'customer_id'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
        CREATE INDEX idx_orders_customer_id ON public.orders (customer_id) WHERE customer_id IS NOT NULL;
    END IF;
END $$;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW
    EXECUTE FUNCTION update_customers_updated_at();
