-- Migration: Fast, atomic delete functions for menu items, categories, and subcategories

CREATE OR REPLACE FUNCTION delete_menu_item_safe(p_item_id bigint, p_restaurant_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_has_orders boolean;
BEGIN
    -- 1. Remove from recipes and today specials
    DELETE FROM menu_recipe_mapping 
    WHERE menu_item_id = p_item_id AND restaurant_id = p_restaurant_id;

    DELETE FROM today_special_items 
    WHERE menu_item_id = p_item_id::integer AND restaurant_id = p_restaurant_id;

    -- 2. Check if referenced in order_items
    SELECT EXISTS(
        SELECT 1 FROM order_items 
        WHERE menu_item_id = p_item_id AND restaurant_id = p_restaurant_id
    ) INTO v_has_orders;

    IF v_has_orders THEN
        -- Soft delete so historical orders keep integrity
        UPDATE menu_items 
        SET active = false, 
            is_available = false, 
            category_id = NULL, 
            sub_category_id = NULL
        WHERE id = p_item_id AND restaurant_id = p_restaurant_id;
        
        RETURN jsonb_build_object('success', true, 'action', 'soft_deleted');
    ELSE
        -- Hard delete
        DELETE FROM menu_items 
        WHERE id = p_item_id AND restaurant_id = p_restaurant_id;

        RETURN jsonb_build_object('success', true, 'action', 'hard_deleted');
    END IF;
END;
$$;

-- Fast, atomic stored procedure to delete a category and its items
CREATE OR REPLACE FUNCTION delete_category_safe(p_category_id bigint, p_restaurant_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item_ids bigint[];
BEGIN
    -- 1. Find all item IDs in this category
    SELECT COALESCE(array_agg(id), ARRAY[]::bigint[]) 
    INTO v_item_ids
    FROM menu_items 
    WHERE category_id = p_category_id AND restaurant_id = p_restaurant_id;

    IF array_length(v_item_ids, 1) > 0 THEN
        -- Delete recipe mappings and specials for all items in category in bulk
        DELETE FROM menu_recipe_mapping 
        WHERE menu_item_id = ANY(v_item_ids) AND restaurant_id = p_restaurant_id;

        DELETE FROM today_special_items 
        WHERE menu_item_id IN (SELECT unnest(v_item_ids)::integer) AND restaurant_id = p_restaurant_id;

        -- For items referenced in orders, soft delete them
        UPDATE menu_items 
        SET active = false, 
            is_available = false, 
            category_id = NULL, 
            sub_category_id = NULL
        WHERE id = ANY(v_item_ids) 
          AND restaurant_id = p_restaurant_id
          AND id IN (SELECT menu_item_id FROM order_items WHERE restaurant_id = p_restaurant_id);

        -- For items NOT referenced in orders, hard delete them
        DELETE FROM menu_items 
        WHERE id = ANY(v_item_ids) 
          AND restaurant_id = p_restaurant_id
          AND id NOT IN (SELECT menu_item_id FROM order_items WHERE restaurant_id = p_restaurant_id);
    END IF;

    -- Unlink any remaining menu items pointing to this category or its subcategories
    UPDATE menu_items 
    SET sub_category_id = NULL, category_id = NULL
    WHERE category_id = p_category_id AND restaurant_id = p_restaurant_id;

    -- 2. Delete all subcategories of this category
    DELETE FROM sub_categories 
    WHERE category_id = p_category_id AND restaurant_id = p_restaurant_id;

    -- 3. Delete the category itself
    DELETE FROM categories 
    WHERE id = p_category_id AND restaurant_id = p_restaurant_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Fast, atomic stored procedure to delete a subcategory
CREATE OR REPLACE FUNCTION delete_subcategory_safe(p_subcategory_id bigint, p_restaurant_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Unlink menu items from this subcategory
    UPDATE menu_items 
    SET sub_category_id = NULL 
    WHERE sub_category_id = p_subcategory_id AND restaurant_id = p_restaurant_id;

    -- Delete the subcategory
    DELETE FROM sub_categories 
    WHERE id = p_subcategory_id AND restaurant_id = p_restaurant_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Grant execute permissions to anon and authenticated
GRANT EXECUTE ON FUNCTION delete_menu_item_safe(bigint, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION delete_category_safe(bigint, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION delete_subcategory_safe(bigint, text) TO anon, authenticated, service_role;
