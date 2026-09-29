-- Migration: Allow anonymous and authenticated roles to execute save_menu_item_with_recipe
-- and support modern menu item fields (today's specials, price variants, stock ml, safe null handling).

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
BEGIN
    v_restaurant_id := p_menu_item->>'restaurant_id';
    
    IF v_restaurant_id IS NULL THEN
        RAISE EXCEPTION 'restaurant_id is required';
    END IF;

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
            tax_percent = COALESCE((p_menu_item->>'tax_percent')::numeric, tax_percent),
            menu_item_type = COALESCE(p_menu_item->>'menu_item_type', menu_item_type),
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
            COALESCE((p_menu_item->>'tax_percent')::numeric, 0),
            COALESCE(p_menu_item->>'menu_item_type', 'food'),
            p_menu_item->'price_variants',
            NULLIF(p_menu_item->>'stock_ml', '')::numeric,
            p_menu_item->>'image_url',
            COALESCE((p_menu_item->>'is_today_special')::boolean, false),
            NULLIF(p_menu_item->>'special_price', '')::numeric,
            NULLIF(p_menu_item->>'special_expiry_datetime', '')::timestamptz
        );
    END IF;

    -- Handle ingredients if provided
    IF p_ingredients IS NOT NULL AND jsonb_array_length(p_ingredients) > 0 THEN
        DELETE FROM menu_item_ingredients WHERE menu_item_id = v_item_id;

        FOR v_ing IN SELECT * FROM jsonb_array_elements(p_ingredients)
        LOOP
            IF (v_ing->>'inventory_item_id') IS NOT NULL AND (v_ing->>'quantity_required')::numeric > 0 THEN
                INSERT INTO menu_item_ingredients (
                    menu_item_id,
                    inventory_item_id,
                    quantity_required,
                    unit
                ) VALUES (
                    v_item_id,
                    (v_ing->>'inventory_item_id')::uuid,
                    (v_ing->>'quantity_required')::numeric,
                    v_ing->>'unit'
                );
            END IF;
        END LOOP;
    END IF;

    -- Return the inserted/updated item as JSON
    SELECT to_jsonb(m.*) INTO v_item_data
    FROM menu_items m
    WHERE m.id = v_item_id;

    RETURN v_item_data;
END;
$$;

-- Explicitly grant execute to anon, authenticated, and service_role
GRANT EXECUTE ON FUNCTION public.save_menu_item_with_recipe(jsonb, jsonb) TO anon, authenticated, service_role;
