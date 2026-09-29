-- Migration: Add separate dine_in, takeaway, and delivery radius columns
-- Date: 2026-09-27

ALTER TABLE delivery_settings
ADD COLUMN IF NOT EXISTS dine_in_order_radius NUMERIC(10, 3),
ADD COLUMN IF NOT EXISTS takeaway_order_radius NUMERIC(10, 3),
ADD COLUMN IF NOT EXISTS delivery_order_radius NUMERIC(10, 3);

UPDATE delivery_settings
SET dine_in_order_radius = COALESCE(dine_in_order_radius, dine_in_takeaway_order_radius, 0.5),
    takeaway_order_radius = COALESCE(takeaway_order_radius, dine_in_takeaway_order_radius, 0.5),
    delivery_order_radius = COALESCE(delivery_order_radius, max_delivery_radius_km, 5.0);
