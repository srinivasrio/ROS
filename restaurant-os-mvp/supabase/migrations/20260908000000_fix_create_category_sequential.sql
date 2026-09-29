-- Fix create_category_sequential function
-- 1. Drop stale 3-parameter overload
DROP FUNCTION IF EXISTS public.create_category_sequential(text, text, text);

-- 2. Define 4-parameter create_category_sequential with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.create_category_sequential(
    p_name text, 
    p_restaurant_id text, 
    p_image_url text DEFAULT NULL::text, 
    p_category_type text DEFAULT 'food'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_cat_id BIGINT;
    v_sub_id BIGINT;
    v_slug TEXT;
BEGIN
    v_slug := lower(replace(p_name, ' ', '-'));

    INSERT INTO categories (name, slug, restaurant_id, sort_order, image_url, category_type)
    VALUES (p_name, v_slug, p_restaurant_id, 9999, p_image_url, p_category_type)
    RETURNING id INTO v_cat_id;

    INSERT INTO sub_categories (category_id, name, restaurant_id, sort_order)
    VALUES (v_cat_id, 'General', p_restaurant_id, 9999)
    RETURNING id INTO v_sub_id;

    RETURN jsonb_build_object('id', v_cat_id, 'name', p_name, 'slug', v_slug, 'category_type', p_category_type, 'success', true);
END;
$function$;

-- 3. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_category_sequential(text, text, text, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_subcategory_sequential(bigint, text, text) TO authenticated, anon, service_role;
