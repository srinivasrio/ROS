-- Helper to check if a customer coordinate falls within any deactivated delivery zone
CREATE OR REPLACE FUNCTION public.check_deactivated_zone(
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
    v_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326);

    RETURN QUERY
    SELECT 
        dz.id AS zone_id,
        dz.name AS zone_name,
        dz.delivery_fee,
        dz.minimum_order_amount
    FROM public.delivery_zones dz
    WHERE dz.restaurant_id = p_restaurant_id
      AND dz.enabled = false
      AND ST_Covers(dz.polygon, v_point)
    LIMIT 1;
END;
$$;
