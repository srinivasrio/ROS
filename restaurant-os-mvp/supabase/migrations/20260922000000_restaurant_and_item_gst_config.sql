-- Migration: Dynamic GST Configuration for Restaurants and Menu Items
-- Date: 2026-09-22

-- 1. Alter restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS gst_percentage NUMERIC(5,2) DEFAULT 5.00,
ADD COLUMN IF NOT EXISTS cgst_percentage NUMERIC(5,2) DEFAULT 2.50,
ADD COLUMN IF NOT EXISTS sgst_percentage NUMERIC(5,2) DEFAULT 2.50;

-- 2. Alter restaurant_profile table
ALTER TABLE public.restaurant_profile
ADD COLUMN IF NOT EXISTS gst_percentage NUMERIC(5,2) DEFAULT 5.00,
ADD COLUMN IF NOT EXISTS cgst_percentage NUMERIC(5,2) DEFAULT 2.50,
ADD COLUMN IF NOT EXISTS sgst_percentage NUMERIC(5,2) DEFAULT 2.50;

-- 3. Alter menu_items table
ALTER TABLE public.menu_items
ADD COLUMN IF NOT EXISTS gst_percentage NUMERIC(5,2) DEFAULT 5.00,
ADD COLUMN IF NOT EXISTS cgst_percentage NUMERIC(5,2) DEFAULT 2.50,
ADD COLUMN IF NOT EXISTS sgst_percentage NUMERIC(5,2) DEFAULT 2.50;

-- 4. Alter order_items table
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS tax_percent NUMERIC(5,2) DEFAULT 5.00,
ADD COLUMN IF NOT EXISTS cgst_percent NUMERIC(5,2) DEFAULT 2.50,
ADD COLUMN IF NOT EXISTS sgst_percent NUMERIC(5,2) DEFAULT 2.50;

-- 5. Alter orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(10,2) DEFAULT 0.00;

-- 6. Safe Data Migration for existing restaurants
UPDATE public.restaurants
SET 
    gst_percentage = COALESCE(gst_percentage, 5.00),
    cgst_percentage = COALESCE(cgst_percentage, 2.50),
    sgst_percentage = COALESCE(sgst_percentage, 2.50)
WHERE gst_percentage IS NULL OR cgst_percentage IS NULL OR sgst_percentage IS NULL;

UPDATE public.restaurant_profile
SET 
    gst_percentage = COALESCE(gst_percentage, tax_percentage, 5.00),
    cgst_percentage = COALESCE(cgst_percentage, COALESCE(tax_percentage, 5.00) / 2.0),
    sgst_percentage = COALESCE(sgst_percentage, COALESCE(tax_percentage, 5.00) / 2.0)
WHERE gst_percentage IS NULL OR cgst_percentage IS NULL OR sgst_percentage IS NULL;

-- 7. Safe Data Migration for existing menu items based on restaurant defaults or their tax_percent
UPDATE public.menu_items mi
SET 
    gst_percentage = CASE 
        WHEN mi.tax_percent IS NOT NULL AND mi.tax_percent > 0 THEN mi.tax_percent
        WHEN r.gst_percentage IS NOT NULL THEN r.gst_percentage
        ELSE 5.00
    END,
    cgst_percentage = CASE 
        WHEN mi.tax_percent IS NOT NULL AND mi.tax_percent > 0 THEN mi.tax_percent / 2.0
        WHEN r.cgst_percentage IS NOT NULL THEN r.cgst_percentage
        ELSE 2.50
    END,
    sgst_percentage = CASE 
        WHEN mi.tax_percent IS NOT NULL AND mi.tax_percent > 0 THEN mi.tax_percent / 2.0
        WHEN r.sgst_percentage IS NOT NULL THEN r.sgst_percentage
        ELSE 2.50
    END
FROM public.restaurants r
WHERE mi.restaurant_id = r.id;

-- Any orphan items without matching restaurant
UPDATE public.menu_items
SET 
    gst_percentage = COALESCE(tax_percent, 5.00),
    cgst_percentage = COALESCE(tax_percent, 5.00) / 2.0,
    sgst_percentage = COALESCE(tax_percent, 5.00) / 2.0
WHERE gst_percentage IS NULL;

-- 8. Update save_menu_item_with_recipe RPC to handle gst_percentage, cgst_percentage, sgst_percentage
CREATE OR REPLACE FUNCTION public.save_menu_item_with_recipe(
    p_menu_item jsonb,
    p_ingredients jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item_id bigint;
    v_restaurant_id text;
    v_item_data jsonb;
    v_ing jsonb;
    v_gst numeric;
    v_cgst numeric;
    v_sgst numeric;
BEGIN
    v_restaurant_id := p_menu_item->>'restaurant_id';
    
    IF v_restaurant_id IS NULL THEN
        RAISE EXCEPTION 'restaurant_id is required';
    END IF;

    -- Compute GST values
    v_gst := COALESCE(
        NULLIF(p_menu_item->>'gst_percentage', '')::numeric,
        NULLIF(p_menu_item->>'tax_percent', '')::numeric,
        5.00
    );
    v_cgst := COALESCE(
        NULLIF(p_menu_item->>'cgst_percentage', '')::numeric,
        v_gst / 2.0
    );
    v_sgst := COALESCE(
        NULLIF(p_menu_item->>'sgst_percentage', '')::numeric,
        v_gst / 2.0
    );

    -- Check if editing or creating
    IF (p_menu_item->>'id') IS NOT NULL AND (p_menu_item->>'id') != '' THEN
        v_item_id := (p_menu_item->>'id')::bigint;
        
        UPDATE menu_items
        SET
            name = COALESCE(p_menu_item->>'name', name),
            price = COALESCE((p_menu_item->>'price')::numeric, price),
            description = p_menu_item->>'description',
            category_id = (p_menu_item->>'category_id')::bigint,
            sub_category_id = NULLIF(p_menu_item->>'sub_category_id', '')::bigint,
            item_type = COALESCE(p_menu_item->>'item_type', item_type),
            is_veg = COALESCE((p_menu_item->>'is_veg')::boolean, (p_menu_item->>'item_type' = 'Veg')),
            is_available = COALESCE((p_menu_item->>'is_available')::boolean, is_available),
            is_popular = COALESCE((p_menu_item->>'is_popular')::boolean, is_popular),
            active = COALESCE((p_menu_item->>'active')::boolean, active),
            rating = COALESCE((p_menu_item->>'rating')::numeric, rating),
            preparation_time = COALESCE((p_menu_item->>'preparation_time')::integer, preparation_time),
            tax_percent = v_gst,
            gst_percentage = v_gst,
            cgst_percentage = v_cgst,
            sgst_percentage = v_sgst,
            menu_item_type = COALESCE(NULLIF(p_menu_item->>'menu_item_type', '')::menu_item_type, menu_item_type),
            price_variants = CASE 
                WHEN p_menu_item ? 'price_variants' THEN p_menu_item->'price_variants'
                ELSE price_variants 
            END,
            stock_ml = CASE 
                WHEN p_menu_item ? 'stock_ml' THEN NULLIF(p_menu_item->>'stock_ml', '')::numeric
                ELSE stock_ml 
            END,
            image_url = CASE 
                WHEN p_menu_item ? 'image_url' THEN p_menu_item->>'image_url'
                ELSE image_url 
            END,
            is_today_special = COALESCE((p_menu_item->>'is_today_special')::boolean, is_today_special, false),
            special_price = NULLIF(p_menu_item->>'special_price', '')::numeric,
            special_expiry_datetime = NULLIF(p_menu_item->>'special_expiry_datetime', '')::timestamptz
        WHERE id = v_item_id AND restaurant_id = v_restaurant_id;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Menu item not found or unauthorized';
        END IF;
    ELSE
        -- Insert new item with auto-generated sequential id
        SELECT COALESCE(MAX(id), 0) + 1 INTO v_item_id
        FROM menu_items;

        INSERT INTO menu_items (
            id,
            restaurant_id,
            name,
            price,
            description,
            category_id,
            sub_category_id,
            item_type,
            is_veg,
            is_available,
            is_popular,
            active,
            rating,
            preparation_time,
            tax_percent,
            gst_percentage,
            cgst_percentage,
            sgst_percentage,
            menu_item_type,
            price_variants,
            stock_ml,
            image_url,
            is_today_special,
            special_price,
            special_expiry_datetime
        ) VALUES (
            v_item_id,
            v_restaurant_id,
            p_menu_item->>'name',
            COALESCE((p_menu_item->>'price')::numeric, 0),
            p_menu_item->>'description',
            (p_menu_item->>'category_id')::bigint,
            NULLIF(p_menu_item->>'sub_category_id', '')::bigint,
            COALESCE(p_menu_item->>'item_type', 'Veg'),
            COALESCE((p_menu_item->>'is_veg')::boolean, (p_menu_item->>'item_type' = 'Veg'), true),
            COALESCE((p_menu_item->>'is_available')::boolean, true),
            COALESCE((p_menu_item->>'is_popular')::boolean, false),
            COALESCE((p_menu_item->>'active')::boolean, true),
            COALESCE((p_menu_item->>'rating')::numeric, 0),
            COALESCE((p_menu_item->>'preparation_time')::integer, 15),
            v_gst,
            v_gst,
            v_cgst,
            v_sgst,
            COALESCE(NULLIF(p_menu_item->>'menu_item_type', '')::menu_item_type, 'food'::menu_item_type),
            p_menu_item->'price_variants',
            NULLIF(p_menu_item->>'stock_ml', '')::numeric,
            p_menu_item->>'image_url',
            COALESCE((p_menu_item->>'is_today_special')::boolean, false),
            NULLIF(p_menu_item->>'special_price', '')::numeric,
            NULLIF(p_menu_item->>'special_expiry_datetime', '')::timestamptz
        );
    END IF;

    -- Manage Recipe / Ingredients mapping
    DELETE FROM menu_recipe_mapping
    WHERE menu_item_id = v_item_id AND restaurant_id = v_restaurant_id;

    IF p_ingredients IS NOT NULL AND jsonb_array_length(p_ingredients) > 0 THEN
        FOR v_ing IN SELECT * FROM jsonb_array_elements(p_ingredients)
        LOOP
            IF (v_ing->>'inventory_item_id') IS NOT NULL 
               AND (v_ing->>'quantity_required')::numeric > 0 THEN
                INSERT INTO menu_recipe_mapping (
                    menu_item_id,
                    inventory_item_id,
                    quantity_required,
                    unit,
                    restaurant_id
                ) VALUES (
                    v_item_id,
                    (v_ing->>'inventory_item_id')::uuid,
                    (v_ing->>'quantity_required')::double precision,
                    v_ing->>'unit',
                    v_restaurant_id
                );
            END IF;
        END LOOP;
    END IF;

    -- Return full item data
    SELECT json_build_object(
        'id', m.id,
        'name', m.name,
        'price', m.price,
        'description', m.description,
        'category_id', m.category_id,
        'sub_category_id', m.sub_category_id,
        'item_type', m.item_type,
        'is_veg', m.is_veg,
        'is_available', m.is_available,
        'is_popular', m.is_popular,
        'active', m.active,
        'rating', m.rating,
        'preparation_time', m.preparation_time,
        'tax_percent', m.tax_percent,
        'gst_percentage', m.gst_percentage,
        'cgst_percentage', m.cgst_percentage,
        'sgst_percentage', m.sgst_percentage,
        'menu_item_type', m.menu_item_type,
        'price_variants', m.price_variants,
        'stock_ml', m.stock_ml,
        'image_url', m.image_url,
        'is_today_special', m.is_today_special,
        'special_price', m.special_price,
        'special_expiry_datetime', m.special_expiry_datetime
    ) INTO v_item_data
    FROM menu_items m
    WHERE m.id = v_item_id;

    RETURN v_item_data;
END;
$$;
