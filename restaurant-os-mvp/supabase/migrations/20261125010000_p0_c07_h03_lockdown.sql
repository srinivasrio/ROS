-- Migration: P0-5 Lockdown — Drop Plaintext Columns (DIO-C06), Harden Admin RPCs (DIO-C07),
-- and Derive Authoritative Delivery Zone Fees in create_order_v2 (DIO-H03).
-- Test on staging before applying to production.

BEGIN;

-- =============================================================================
-- 1. DIO-C06: Drop legacy plaintext credential columns on public.employees
-- =============================================================================
ALTER TABLE public.employees DROP COLUMN IF EXISTS raw_pin;
ALTER TABLE public.employees DROP COLUMN IF EXISTS raw_password;

-- =============================================================================
-- 2. DIO-C07: Add tenant authorization checks (validate_tenant) to browser-callable
--    SECURITY DEFINER menu RPCs so raw anon calls without a valid x-dine-token fail.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.delete_menu_item_safe(p_item_id bigint, p_restaurant_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_has_orders boolean;
BEGIN
    IF auth.role() <> 'service_role' AND NOT public.validate_tenant(p_restaurant_id) THEN
        RAISE EXCEPTION 'Unauthorized: Invalid tenant token' USING ERRCODE = '42501';
    END IF;

    DELETE FROM menu_recipe_mapping
    WHERE menu_item_id = p_item_id AND restaurant_id = p_restaurant_id;

    DELETE FROM today_special_items
    WHERE menu_item_id = p_item_id::integer AND restaurant_id = p_restaurant_id;

    SELECT EXISTS(
        SELECT 1 FROM order_items
        WHERE menu_item_id = p_item_id AND restaurant_id = p_restaurant_id
    ) INTO v_has_orders;

    IF v_has_orders THEN
        UPDATE menu_items
        SET active = false,
            is_available = false,
            category_id = NULL,
            sub_category_id = NULL
        WHERE id = p_item_id AND restaurant_id = p_restaurant_id;

        RETURN jsonb_build_object('success', true, 'action', 'soft_deleted');
    ELSE
        DELETE FROM menu_items
        WHERE id = p_item_id AND restaurant_id = p_restaurant_id;

        RETURN jsonb_build_object('success', true, 'action', 'hard_deleted');
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_category_safe(p_category_id bigint, p_restaurant_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_item_ids bigint[];
BEGIN
    IF auth.role() <> 'service_role' AND NOT public.validate_tenant(p_restaurant_id) THEN
        RAISE EXCEPTION 'Unauthorized: Invalid tenant token' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(array_agg(id), ARRAY[]::bigint[])
    INTO v_item_ids
    FROM menu_items
    WHERE category_id = p_category_id AND restaurant_id = p_restaurant_id;

    IF array_length(v_item_ids, 1) > 0 THEN
        DELETE FROM menu_recipe_mapping
        WHERE menu_item_id = ANY(v_item_ids) AND restaurant_id = p_restaurant_id;

        DELETE FROM today_special_items
        WHERE menu_item_id IN (SELECT unnest(v_item_ids)::integer) AND restaurant_id = p_restaurant_id;

        UPDATE menu_items
        SET active = false,
            is_available = false,
            category_id = NULL,
            sub_category_id = NULL
        WHERE id = ANY(v_item_ids)
          AND restaurant_id = p_restaurant_id
          AND id IN (SELECT menu_item_id FROM order_items WHERE restaurant_id = p_restaurant_id);

        DELETE FROM menu_items
        WHERE id = ANY(v_item_ids)
          AND restaurant_id = p_restaurant_id
          AND id NOT IN (SELECT menu_item_id FROM order_items WHERE restaurant_id = p_restaurant_id);
    END IF;

    UPDATE menu_items
    SET sub_category_id = NULL, category_id = NULL
    WHERE category_id = p_category_id AND restaurant_id = p_restaurant_id;

    DELETE FROM sub_categories
    WHERE category_id = p_category_id AND restaurant_id = p_restaurant_id;

    DELETE FROM categories
    WHERE id = p_category_id AND restaurant_id = p_restaurant_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_subcategory_safe(p_subcategory_id bigint, p_restaurant_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.role() <> 'service_role' AND NOT public.validate_tenant(p_restaurant_id) THEN
        RAISE EXCEPTION 'Unauthorized: Invalid tenant token' USING ERRCODE = '42501';
    END IF;

    UPDATE menu_items
    SET sub_category_id = NULL
    WHERE sub_category_id = p_subcategory_id AND restaurant_id = p_restaurant_id;

    DELETE FROM sub_categories
    WHERE id = p_subcategory_id AND restaurant_id = p_restaurant_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_category_sequential(
    p_name text,
    p_restaurant_id text,
    p_image_url text DEFAULT NULL::text,
    p_category_type text DEFAULT 'food'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_cat_id BIGINT;
    v_sub_id BIGINT;
    v_slug TEXT;
BEGIN
    IF auth.role() <> 'service_role' AND NOT public.validate_tenant(p_restaurant_id) THEN
        RAISE EXCEPTION 'Unauthorized: Invalid tenant token' USING ERRCODE = '42501';
    END IF;

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

CREATE OR REPLACE FUNCTION public.save_menu_item_with_recipe(
    p_menu_item jsonb,
    p_ingredients jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

    IF auth.role() <> 'service_role' AND NOT public.validate_tenant(v_restaurant_id) THEN
        RAISE EXCEPTION 'Unauthorized: Invalid tenant token' USING ERRCODE = '42501';
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
        SELECT COALESCE(MAX(id), 0) + 1 INTO v_item_id
        FROM menu_items;

        INSERT INTO menu_items (
            id, restaurant_id, name, price, description, category_id, sub_category_id,
            item_type, is_veg, is_available, is_popular, active, rating,
            preparation_time, tax_percent, gst_percentage, cgst_percentage, sgst_percentage,
            menu_item_type, price_variants, stock_ml,
            image_url, is_today_special, special_price, special_expiry_datetime
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

    DELETE FROM menu_recipe_mapping
    WHERE menu_item_id = v_item_id AND restaurant_id = v_restaurant_id;

    IF p_ingredients IS NOT NULL AND jsonb_array_length(p_ingredients) > 0 THEN
        FOR v_ing IN SELECT * FROM jsonb_array_elements(p_ingredients)
        LOOP
            IF (v_ing->>'inventory_item_id') IS NOT NULL
               AND (v_ing->>'quantity_required')::numeric > 0 THEN
                INSERT INTO menu_recipe_mapping (
                    menu_item_id, inventory_item_id, quantity_required, unit, restaurant_id
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

    SELECT to_jsonb(m.*) INTO v_item_data
    FROM menu_items m
    WHERE m.id = v_item_id;

    RETURN v_item_data;
END;
$$;

-- Restrict server-only SECURITY DEFINER RPCs exclusively to service_role
DO $$
DECLARE
    fn RECORD;
BEGIN
    FOR fn IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
              'save_delivery_zone',
              'delete_delivery_zone',
              'check_zone_overlap',
              'delete_restaurant_branch_atomic',
              'restore_backup_data'
          )
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
    END LOOP;
END $$;

-- =============================================================================
-- 3. DIO-H03: Authoritative delivery_fee lookup from delivery_zones in create_order_v2
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_order_v2(
    p_restaurant_id text,
    p_transaction_id text,
    p_items jsonb,
    p_table_id bigint DEFAULT NULL,
    p_merge_group_id uuid DEFAULT NULL,
    p_order_type text DEFAULT 'DINE_IN',
    p_status text DEFAULT 'placed',
    p_waiter_id uuid DEFAULT NULL,
    p_customer_id uuid DEFAULT NULL,
    p_customer_phone text DEFAULT NULL,
    p_branch_id text DEFAULT NULL,
    p_coupon_code text DEFAULT NULL,
    p_delivery_fee numeric DEFAULT 0,
    p_delivery_address text DEFAULT NULL,
    p_delivery_phone text DEFAULT NULL,
    p_delivery_notes text DEFAULT NULL,
    p_delivery_zone_id uuid DEFAULT NULL,
    p_delivery_lat numeric DEFAULT NULL,
    p_delivery_lng numeric DEFAULT NULL,
    p_customer_lat numeric DEFAULT NULL,
    p_customer_lng numeric DEFAULT NULL,
    p_active_order_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_id text;
    v_existing_order record;
    v_existing_coupon_code text := NULL;
    v_item jsonb;
    v_menu_rec record;
    v_special_rec record;
    v_table_rec record;
    v_offer_rec record;
    v_zone_rec record;
    v_price numeric;
    v_qty int;
    v_item_type text;
    v_raw_menu_id text;
    v_menu_item_id bigint;
    v_combo_id text;
    v_item_tax_pct numeric;
    v_item_cgst_pct numeric;
    v_item_sgst_pct numeric;
    v_gst_pct numeric := 5.0;
    v_cgst_pct numeric := 2.5;
    v_sgst_pct numeric := 2.5;
    v_total_subtotal numeric := 0;
    v_new_items_cgst numeric := 0;
    v_new_items_sgst numeric := 0;
    v_cgst_amount numeric := 0;
    v_sgst_amount numeric := 0;
    v_gst_amount numeric := 0;
    v_discount numeric := 0;
    v_clean_coupon text := NULL;
    v_delivery_fee numeric := 0;
    v_final_total numeric := 0;
    v_now timestamptz := clock_timestamp();
    v_price_verified boolean;
BEGIN
    IF p_restaurant_id IS NULL OR TRIM(p_restaurant_id) = '' THEN
        RAISE EXCEPTION 'Restaurant ID is required.' USING ERRCODE = '22023';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'At least one order item is required.' USING ERRCODE = '22023';
    END IF;

    p_status := CASE WHEN LOWER(COALESCE(p_status, '')) = 'queued' THEN 'queued' ELSE 'placed' END;
    p_order_type := UPPER(COALESCE(NULLIF(TRIM(p_order_type), ''), 'DINE_IN'));
    IF p_order_type <> 'DELIVERY' THEN
        p_delivery_fee := 0;
    ELSE
        IF p_delivery_zone_id IS NOT NULL THEN
            SELECT id, delivery_fee, enabled
            INTO v_zone_rec
            FROM public.delivery_zones
            WHERE id = p_delivery_zone_id
              AND restaurant_id = p_restaurant_id;

            IF v_zone_rec.id IS NULL OR v_zone_rec.enabled IS NOT TRUE THEN
                RAISE EXCEPTION 'Selected delivery zone is invalid or disabled.' USING ERRCODE = '22023';
            END IF;
            p_delivery_fee := COALESCE(v_zone_rec.delivery_fee, 0);
        ELSIF p_delivery_lat IS NOT NULL AND p_delivery_lng IS NOT NULL THEN
            SELECT zone_id, delivery_fee
            INTO v_zone_rec
            FROM public.check_delivery_zone(p_restaurant_id, p_delivery_lat, p_delivery_lng)
            LIMIT 1;

            IF v_zone_rec.zone_id IS NOT NULL THEN
                p_delivery_zone_id := v_zone_rec.zone_id;
                p_delivery_fee := COALESCE(v_zone_rec.delivery_fee, 0);
            ELSE
                p_delivery_fee := GREATEST(0, COALESCE(p_delivery_fee, 0));
            END IF;
        ELSE
            p_delivery_fee := GREATEST(0, COALESCE(p_delivery_fee, 0));
        END IF;
    END IF;

    IF p_transaction_id IS NOT NULL AND TRIM(p_transaction_id) <> '' THEN
        SELECT id, total_amount, status
        INTO v_existing_order
        FROM public.orders
        WHERE transaction_id = p_transaction_id
        LIMIT 1;

        IF v_existing_order.id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'id', v_existing_order.id,
                'total_amount', v_existing_order.total_amount,
                'status', v_existing_order.status,
                'is_duplicate', true
            );
        END IF;
    END IF;

    SELECT
        COALESCE(gst_percentage, 5.0),
        COALESCE(cgst_percentage, gst_percentage / 2.0, 2.5),
        COALESCE(sgst_percentage, gst_percentage / 2.0, 2.5)
    INTO v_gst_pct, v_cgst_pct, v_sgst_pct
    FROM public.restaurants
    WHERE id = p_restaurant_id;

    IF NOT FOUND THEN
        v_gst_pct := 5.0;
        v_cgst_pct := 2.5;
        v_sgst_pct := 2.5;
    END IF;

    IF p_order_type = 'DINE_IN' AND p_table_id IS NOT NULL THEN
        SELECT id, status, restaurant_id, assigned_waiter_id, branch_id
        INTO v_table_rec
        FROM public.tables
        WHERE id = p_table_id;

        IF v_table_rec.id IS NULL THEN
            RAISE EXCEPTION 'Table % does not exist.', p_table_id USING ERRCODE = 'P0002';
        END IF;

        IF v_table_rec.restaurant_id <> p_restaurant_id THEN
            RAISE EXCEPTION 'Tenant isolation violation: Table % does not belong to restaurant %', p_table_id, p_restaurant_id USING ERRCODE = '42501';
        END IF;

        IF LOWER(COALESCE(v_table_rec.status::text, '')) IN ('cleaning', 'dirty', 'to_clean') THEN
            RAISE EXCEPTION 'Table % is currently being cleaned and not ready for new orders.', p_table_id USING ERRCODE = '22023';
        END IF;
    END IF;

    IF p_branch_id IS NULL OR TRIM(p_branch_id) = '' THEN
        IF p_table_id IS NOT NULL THEN
            SELECT branch_id INTO p_branch_id FROM public.tables WHERE id = p_table_id;
        END IF;

        IF (p_branch_id IS NULL OR TRIM(p_branch_id) = '') AND p_merge_group_id IS NOT NULL THEN
            SELECT branch_id INTO p_branch_id FROM public.table_merge_groups WHERE id = p_merge_group_id;
        END IF;

        IF (p_branch_id IS NULL OR TRIM(p_branch_id) = '') AND p_waiter_id IS NOT NULL THEN
            SELECT branch_id INTO p_branch_id FROM public.staff WHERE id = p_waiter_id;
            IF p_branch_id IS NULL OR TRIM(p_branch_id) = '' THEN
                SELECT branch_id INTO p_branch_id FROM public.employees WHERE id = p_waiter_id;
            END IF;
        END IF;

        IF p_branch_id IS NULL OR TRIM(p_branch_id) = '' THEN
            SELECT id INTO p_branch_id FROM public.branches
            WHERE restaurant_id = p_restaurant_id
            ORDER BY is_main_branch DESC NULLS LAST, created_at ASC
            LIMIT 1;
        END IF;
    END IF;

    IF p_active_order_id IS NOT NULL AND p_active_order_id <> '' THEN
        SELECT id, total_amount, gst_amount, cgst_amount, sgst_amount, discount_amount, delivery_fee, coupon_code, branch_id
        INTO v_existing_order
        FROM public.orders
        WHERE id = p_active_order_id
          AND restaurant_id = p_restaurant_id
          AND COALESCE(is_completed, false) = false
          AND (p_table_id IS NULL OR table_id = p_table_id)
          AND (p_merge_group_id IS NULL OR merge_group_id = p_merge_group_id);

        IF v_existing_order.id IS NULL THEN
            RAISE EXCEPTION 'Active order % not found for restaurant %', p_active_order_id, p_restaurant_id USING ERRCODE = 'P0002';
        END IF;

        v_order_id := v_existing_order.id;
        v_delivery_fee := COALESCE(v_existing_order.delivery_fee, p_delivery_fee, 0);
        v_existing_coupon_code := v_existing_order.coupon_code;

        IF v_existing_order.branch_id IS NULL AND p_branch_id IS NOT NULL THEN
            UPDATE public.orders SET branch_id = p_branch_id WHERE id = v_order_id;
        END IF;
    ELSE
        v_order_id := gen_random_uuid()::text;
        v_delivery_fee := CEIL(ROUND(COALESCE(p_delivery_fee, 0), 8) * 100.0) / 100.0;

        INSERT INTO public.orders (
            id, status, total_amount, gst_amount, cgst_amount, sgst_amount,
            amount_paid, is_completed, waiter_id, restaurant_id, branch_id,
            coupon_code, discount_amount, transaction_id, order_type,
            table_id, merge_group_id, customer_id, customer_phone,
            delivery_address, delivery_phone, delivery_notes, delivery_fee,
            delivery_zone_id, delivery_lat, delivery_lng, customer_lat, customer_lng,
            created_at
        ) VALUES (
            v_order_id, COALESCE(p_status, 'placed')::public.order_status, 0, 0, 0, 0,
            0, false, p_waiter_id, p_restaurant_id, p_branch_id,
            p_coupon_code, 0, p_transaction_id, p_order_type,
            p_table_id, p_merge_group_id, p_customer_id, p_customer_phone,
            p_delivery_address, p_delivery_phone, p_delivery_notes, v_delivery_fee,
            p_delivery_zone_id, p_delivery_lat, p_delivery_lng, p_customer_lat, p_customer_lng,
            v_now
        );
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty := (v_item->>'quantity')::int;
        IF v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'Invalid item quantity: %. Must be a positive integer.', v_qty USING ERRCODE = '22023';
        END IF;

        v_item_type := COALESCE(v_item->>'item_type', v_item->>'itemType', 'standard');
        v_raw_menu_id := COALESCE(v_item->>'menu_item_id', v_item->>'menuItemId');
        v_combo_id := COALESCE(v_item->>'combo_id', v_item->>'comboId');

        IF v_raw_menu_id IS NOT NULL AND v_raw_menu_id <> '' THEN
            IF v_raw_menu_id ~ '^[0-9]+$' THEN
                v_menu_item_id := v_raw_menu_id::bigint;
            ELSE
                RAISE EXCEPTION 'Menu item % does not exist.', v_raw_menu_id USING ERRCODE = 'P0002';
            END IF;
        ELSE
            v_menu_item_id := NULL;
        END IF;

        v_price_verified := false;
        IF v_menu_item_id IS NOT NULL AND v_menu_item_id > 0 THEN
            v_price_verified := true;
            SELECT id, name, price, is_available, restaurant_id, is_today_special, special_price, special_expiry_datetime,
                   gst_percentage, cgst_percentage, sgst_percentage
            INTO v_menu_rec
            FROM public.menu_items
            WHERE id = v_menu_item_id;

            IF v_menu_rec.id IS NULL THEN
                RAISE EXCEPTION 'Menu item % does not exist.', v_menu_item_id USING ERRCODE = 'P0002';
            END IF;

            IF v_menu_rec.restaurant_id <> p_restaurant_id THEN
                RAISE EXCEPTION 'Tenant isolation violation: Menu item % belongs to restaurant % but order is for %',
                    v_menu_item_id, v_menu_rec.restaurant_id, p_restaurant_id USING ERRCODE = '42501';
            END IF;

            IF v_menu_rec.is_available = false THEN
                RAISE EXCEPTION 'Menu item "%" (ID %) is currently unavailable.', v_menu_rec.name, v_menu_item_id USING ERRCODE = '22023';
            END IF;

            IF v_menu_rec.is_today_special = true AND v_menu_rec.special_price IS NOT NULL AND (v_menu_rec.special_expiry_datetime IS NULL OR v_menu_rec.special_expiry_datetime > v_now) THEN
                v_price := v_menu_rec.special_price;
            ELSE
                v_price := v_menu_rec.price;
            END IF;
        ELSIF v_combo_id IS NOT NULL AND v_combo_id <> '' THEN
            SELECT id, title, special_price, original_price, is_active, valid_to
            INTO v_special_rec
            FROM public.today_specials
            WHERE id::text = v_combo_id AND restaurant_id = p_restaurant_id;

            IF v_special_rec.id IS NOT NULL THEN
                IF v_special_rec.is_active = false OR (v_special_rec.valid_to IS NOT NULL AND v_special_rec.valid_to < v_now) THEN
                    RAISE EXCEPTION 'Special/combo % is expired or inactive.', v_special_rec.title USING ERRCODE = '22023';
                END IF;
                v_price := COALESCE(v_special_rec.special_price, v_special_rec.original_price, 0);
                v_price_verified := true;
            ELSE
                v_price := COALESCE((v_item->>'price')::numeric, 0);
            END IF;
        ELSE
            v_price := COALESCE((v_item->>'price')::numeric, 0);
        END IF;

        IF v_price < 0 OR (NOT v_price_verified AND v_price <= 0) THEN
            RAISE EXCEPTION 'Item price could not be verified.' USING ERRCODE = '22023';
        END IF;

        IF v_menu_item_id IS NOT NULL AND v_menu_item_id > 0 THEN
            v_item_tax_pct := COALESCE(v_menu_rec.gst_percentage, v_gst_pct);
            v_item_cgst_pct := COALESCE(v_menu_rec.cgst_percentage, v_item_tax_pct / 2.0);
            v_item_sgst_pct := COALESCE(v_menu_rec.sgst_percentage, v_item_tax_pct / 2.0);
        ELSE
            v_item_tax_pct := v_gst_pct;
            v_item_cgst_pct := v_cgst_pct;
            v_item_sgst_pct := v_sgst_pct;
        END IF;

        INSERT INTO public.order_items (
            order_id, restaurant_id, branch_id, menu_item_id,
            quantity, notes, price_at_time, status, item_type,
            combo_id, combo_name, combo_image, combo_items,
            tax_percent, cgst_percent, sgst_percent, created_at
        ) VALUES (
            v_order_id, p_restaurant_id, p_branch_id,
            CASE WHEN v_menu_item_id > 0 THEN v_menu_item_id ELSE NULL END,
            v_qty, COALESCE(v_item->>'notes', ''), v_price,
            CASE WHEN p_order_type <> 'DINE_IN' THEN 'placed' WHEN p_status = 'queued' THEN 'queued' ELSE 'placed' END,
            v_item_type,
            v_item->>'combo_id', v_item->>'combo_name', v_item->>'combo_image',
            v_item->'combo_items',
            v_item_tax_pct, v_item_cgst_pct, v_item_sgst_pct, v_now
        );
    END LOOP;

    SELECT
        COALESCE(SUM(price_at_time * quantity), 0),
        COALESCE(SUM((price_at_time * quantity * COALESCE(cgst_percent, v_cgst_pct)) / 100.0), 0),
        COALESCE(SUM((price_at_time * quantity * COALESCE(sgst_percent, v_sgst_pct)) / 100.0), 0)
    INTO v_total_subtotal, v_new_items_cgst, v_new_items_sgst
    FROM public.order_items
    WHERE order_id = v_order_id;

    v_total_subtotal := CEIL(ROUND(v_total_subtotal, 8) * 100.0) / 100.0;
    v_cgst_amount := CEIL(ROUND(v_new_items_cgst, 8) * 100.0) / 100.0;
    v_sgst_amount := CEIL(ROUND(v_new_items_sgst, 8) * 100.0) / 100.0;
    v_gst_amount := CEIL((v_cgst_amount + v_sgst_amount) * 100.0) / 100.0;

    IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) <> '' THEN
        v_clean_coupon := UPPER(TRIM(p_coupon_code));
    ELSIF v_existing_coupon_code IS NOT NULL AND TRIM(v_existing_coupon_code) <> '' THEN
        v_clean_coupon := UPPER(TRIM(v_existing_coupon_code));
    ELSE
        v_clean_coupon := NULL;
    END IF;

    v_discount := 0;
    IF v_clean_coupon IS NOT NULL THEN
        SELECT discount_type, discount_value, max_discount, start_datetime, end_datetime, applicable_order_type
        INTO v_offer_rec
        FROM public.offers
        WHERE restaurant_id = p_restaurant_id
          AND code = v_clean_coupon
          AND status = 'active'
        LIMIT 1;

        IF v_offer_rec.discount_type IS NOT NULL THEN
            IF (v_offer_rec.start_datetime IS NULL OR v_offer_rec.start_datetime <= v_now)
               AND (v_offer_rec.end_datetime IS NULL OR v_offer_rec.end_datetime > v_now)
               AND (
                   v_offer_rec.applicable_order_type IS NULL
                   OR v_offer_rec.applicable_order_type = 'all'
                   OR UPPER(v_offer_rec.applicable_order_type) = UPPER(COALESCE(p_order_type, 'DINE_IN'))
               ) THEN
                IF v_offer_rec.discount_type = 'percentage' THEN
                    v_discount := (v_total_subtotal * v_offer_rec.discount_value) / 100.0;
                    IF v_offer_rec.max_discount IS NOT NULL AND v_discount > v_offer_rec.max_discount THEN
                        v_discount := v_offer_rec.max_discount;
                    END IF;
                ELSE
                    v_discount := COALESCE(v_offer_rec.discount_value, 0);
                END IF;
                v_discount := LEAST(v_discount, v_total_subtotal);
            ELSE
                v_discount := 0;
            END IF;
        END IF;
    END IF;

    v_discount := CEIL(ROUND(v_discount, 8) * 100.0) / 100.0;
    v_final_total := CEIL(GREATEST(0, (v_total_subtotal + v_gst_amount + v_delivery_fee - v_discount)) * 100.0) / 100.0;

    UPDATE public.orders
    SET total_amount = v_final_total,
        gst_amount = v_gst_amount,
        cgst_amount = v_cgst_amount,
        sgst_amount = v_sgst_amount,
        discount_amount = v_discount,
        coupon_code = v_clean_coupon,
        delivery_fee = v_delivery_fee,
        delivery_zone_id = COALESCE(delivery_zone_id, p_delivery_zone_id),
        waiter_id = COALESCE(p_waiter_id, waiter_id),
        branch_id = COALESCE(branch_id, p_branch_id)
    WHERE id = v_order_id;

    IF p_order_type = 'DINE_IN' AND p_table_id IS NOT NULL THEN
        UPDATE public.tables
        SET status = 'occupied',
            last_activity_at = v_now,
            assigned_waiter_id = COALESCE(p_waiter_id, assigned_waiter_id)
        WHERE id = p_table_id;
    END IF;

    IF p_waiter_id IS NOT NULL THEN
        UPDATE public.employees
        SET last_assigned_at = v_now
        WHERE id = p_waiter_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'id', v_order_id,
        'total_amount', v_final_total,
        'subtotal', v_total_subtotal,
        'gst_amount', v_gst_amount,
        'cgst_amount', v_cgst_amount,
        'sgst_amount', v_sgst_amount,
        'discount_amount', v_discount,
        'delivery_fee', v_delivery_fee,
        'coupon_code', v_clean_coupon
    );
END;
$$;

COMMIT;
