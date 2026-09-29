-- ==============================================================================
-- Migration: Zone-based Delivery for Dine in One with PostGIS
-- ==============================================================================

-- 1. Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Create delivery_zones table
CREATE TABLE IF NOT EXISTS public.delivery_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    polygon GEOMETRY(Polygon, 4326) NOT NULL,
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    minimum_order_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Spatial and BTree Indexes
CREATE INDEX IF NOT EXISTS idx_delivery_zones_polygon_gist ON public.delivery_zones USING GIST (polygon);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_restaurant_id ON public.delivery_zones (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_enabled ON public.delivery_zones (restaurant_id, enabled);

-- 4. Polygon validation constraint (prevents self-intersection or corrupted geometries)
ALTER TABLE public.delivery_zones DROP CONSTRAINT IF EXISTS delivery_zones_polygon_valid;
ALTER TABLE public.delivery_zones ADD CONSTRAINT delivery_zones_polygon_valid CHECK (ST_IsValid(polygon));

-- 5. Row Level Security (RLS)
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delivery_zones_select_policy ON public.delivery_zones;
CREATE POLICY delivery_zones_select_policy ON public.delivery_zones
    FOR SELECT USING (true);

DROP POLICY IF EXISTS delivery_zones_service_all ON public.delivery_zones;
CREATE POLICY delivery_zones_service_all ON public.delivery_zones
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. Add delivery_zone_id to orders table for historical snapshotting
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_zone_id UUID REFERENCES public.delivery_zones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_zone_id ON public.orders(delivery_zone_id) WHERE delivery_zone_id IS NOT NULL;

-- 7. PostGIS Point-In-Polygon Validation Function (Deterministic Priority Logic)
-- When polygons overlap:
-- 1. Lowest delivery fee (customer-first pricing)
-- 2. Lowest minimum order amount
-- 3. Smallest geographic area (most specific zone)
-- 4. Earliest created zone
CREATE OR REPLACE FUNCTION public.check_delivery_zone(
    p_restaurant_id TEXT,
    p_lat NUMERIC,
    p_lng NUMERIC
)
RETURNS TABLE (
    zone_id UUID,
    zone_name TEXT,
    delivery_fee NUMERIC,
    minimum_order_amount NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_point GEOMETRY;
BEGIN
    -- Construct point in SRID 4326 (lon, lat)
    v_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326);

    RETURN QUERY
    SELECT 
        dz.id AS zone_id,
        dz.name AS zone_name,
        dz.delivery_fee,
        dz.minimum_order_amount
    FROM public.delivery_zones dz
    WHERE dz.restaurant_id = p_restaurant_id
      AND dz.enabled = true
      AND ST_Covers(dz.polygon, v_point)
    ORDER BY 
        dz.delivery_fee ASC,
        dz.minimum_order_amount ASC,
        ST_Area(dz.polygon::geography) ASC,
        dz.created_at ASC
    LIMIT 1;
END;
$$;

-- 8. PostGIS Overlap Detection Helper
CREATE OR REPLACE FUNCTION public.check_zone_overlap(
    p_restaurant_id TEXT,
    p_zone_id UUID,
    p_geojson TEXT
)
RETURNS TABLE (
    overlapping_zone_id UUID,
    overlapping_zone_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_geom GEOMETRY;
BEGIN
    BEGIN
        v_geom := ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326);
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid GeoJSON polygon format: %', SQLERRM;
    END;

    IF NOT ST_IsValid(v_geom) THEN
        RAISE EXCEPTION 'Polygon geometry is invalid or self-intersecting: %', ST_IsValidReason(v_geom);
    END IF;

    RETURN QUERY
    SELECT dz.id, dz.name
    FROM public.delivery_zones dz
    WHERE dz.restaurant_id = p_restaurant_id
      AND dz.enabled = true
      AND (p_zone_id IS NULL OR dz.id != p_zone_id)
      AND ST_Intersects(dz.polygon, v_geom)
      AND NOT ST_Touches(dz.polygon, v_geom);
END;
$$;

-- 9. Fetch Restaurant Delivery Zones as GeoJSON
CREATE OR REPLACE FUNCTION public.get_restaurant_delivery_zones(p_restaurant_id TEXT)
RETURNS TABLE (
    id UUID,
    restaurant_id TEXT,
    name TEXT,
    delivery_fee NUMERIC,
    minimum_order_amount NUMERIC,
    enabled BOOLEAN,
    geojson TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dz.id,
        dz.restaurant_id,
        dz.name,
        dz.delivery_fee,
        dz.minimum_order_amount,
        dz.enabled,
        ST_AsGeoJSON(dz.polygon) AS geojson,
        dz.created_at,
        dz.updated_at
    FROM public.delivery_zones dz
    WHERE dz.restaurant_id = p_restaurant_id
    ORDER BY dz.created_at ASC;
END;
$$;

-- 10. Atomic Save Delivery Zone (handles GeoJSON conversion and ST_IsValid checks)
CREATE OR REPLACE FUNCTION public.save_delivery_zone(
    p_restaurant_id TEXT,
    p_name TEXT,
    p_geojson TEXT,
    p_delivery_fee NUMERIC,
    p_minimum_order_amount NUMERIC,
    p_enabled BOOLEAN,
    p_zone_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    restaurant_id TEXT,
    name TEXT,
    delivery_fee NUMERIC,
    minimum_order_amount NUMERIC,
    enabled BOOLEAN,
    geojson TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_geom GEOMETRY;
    v_target_id UUID;
BEGIN
    BEGIN
        v_geom := ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326);
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid GeoJSON polygon format: %', SQLERRM;
    END;

    IF NOT ST_IsValid(v_geom) THEN
        RAISE EXCEPTION 'Polygon geometry is invalid or self-intersecting: %', ST_IsValidReason(v_geom);
    END IF;

    IF ST_GeometryType(v_geom) != 'ST_Polygon' THEN
        RAISE EXCEPTION 'Geometry must be a Polygon, got %', ST_GeometryType(v_geom);
    END IF;

    IF p_zone_id IS NOT NULL THEN
        UPDATE public.delivery_zones dz
        SET 
            name = p_name,
            polygon = v_geom,
            delivery_fee = p_delivery_fee,
            minimum_order_amount = p_minimum_order_amount,
            enabled = p_enabled,
            updated_at = now()
        WHERE dz.id = p_zone_id AND dz.restaurant_id = p_restaurant_id
        RETURNING dz.id INTO v_target_id;

        IF v_target_id IS NULL THEN
            RAISE EXCEPTION 'Delivery zone % not found for restaurant %', p_zone_id, p_restaurant_id;
        END IF;
    ELSE
        INSERT INTO public.delivery_zones (
            restaurant_id, name, polygon, delivery_fee, minimum_order_amount, enabled
        ) VALUES (
            p_restaurant_id, p_name, v_geom, p_delivery_fee, p_minimum_order_amount, p_enabled
        )
        RETURNING public.delivery_zones.id INTO v_target_id;
    END IF;

    RETURN QUERY
    SELECT 
        dz.id,
        dz.restaurant_id,
        dz.name,
        dz.delivery_fee,
        dz.minimum_order_amount,
        dz.enabled,
        ST_AsGeoJSON(dz.polygon) AS geojson,
        dz.created_at,
        dz.updated_at
    FROM public.delivery_zones dz
    WHERE dz.id = v_target_id;
END;
$$;

-- 11. Delete Delivery Zone
CREATE OR REPLACE FUNCTION public.delete_delivery_zone(
    p_restaurant_id TEXT,
    p_zone_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.delivery_zones
    WHERE id = p_zone_id AND restaurant_id = p_restaurant_id;

    RETURN FOUND;
END;
$$;

