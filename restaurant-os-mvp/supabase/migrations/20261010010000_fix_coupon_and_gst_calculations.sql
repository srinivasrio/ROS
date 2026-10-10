-- Migration: 20261010010000_fix_coupon_and_gst_calculations.sql
-- Fixes coupon discount and GST calculation consistency in create_order_v2 and order merges.

CREATE OR REPLACE FUNCTION public.create_order_v2(
    p_restaurant_id text,
    p_transaction_id text,
    p_items jsonb,
    p_table_id bigint DEFAULT NULL,
    p_merge_group_id text DEFAULT NULL,
    p_order_type text DEFAULT 'DINE_IN',
    p_status text DEFAULT 'placed',
    p_waiter_id text DEFAULT NULL,
    p_customer_id text DEFAULT NULL,
    p_customer_phone text DEFAULT NULL,
    p_branch_id text DEFAULT NULL,
    p_coupon_code text DEFAULT NULL,
    p_delivery_fee numeric DEFAULT 0,
    p_delivery_address text DEFAULT NULL,
    p_delivery_phone text DEFAULT NULL,
    p_delivery_notes text DEFAULT NULL,
    p_delivery_zone_id text DEFAULT NULL,
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
    v_item jsonb;
    v_menu_rec record;
    v_special_rec record;
    v_table_rec record;
    v_offer_rec record;
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
    v_line_subtotal numeric := 0;
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
BEGIN
    -- 1. Input Validation
    IF p_restaurant_id IS NULL OR TRIM(p_restaurant_id) = '' THEN
        RAISE EXCEPTION 'Restaurant ID is required.' USING ERRCODE = '22023';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'At least one order item is required.' USING ERRCODE = '22023';
    END IF;

    -- 2. Idempotency Check by transaction_id
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

    -- 3. Resolve Restaurant Default GST Percentages
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

    -- 4. Validate Table Status if DINE_IN
    IF p_order_type = 'DINE_IN' AND p_table_id IS NOT NULL THEN
        SELECT id, status, restaurant_id, assigned_waiter_id
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

    -- 5. Prepare Order Identity (Brand-new or Active Merge)
    IF p_active_order_id IS NOT NULL AND p_active_order_id <> '' THEN
        SELECT id, total_amount, gst_amount, cgst_amount, sgst_amount, discount_amount, delivery_fee, coupon_code
        INTO v_existing_order
        FROM public.orders
        WHERE id = p_active_order_id AND restaurant_id = p_restaurant_id;

        IF v_existing_order.id IS NULL THEN
            RAISE EXCEPTION 'Active order % not found for restaurant %', p_active_order_id, p_restaurant_id USING ERRCODE = 'P0002';
        END IF;

        v_order_id := v_existing_order.id;
        v_delivery_fee := COALESCE(v_existing_order.delivery_fee, p_delivery_fee, 0);
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

    -- 6. Insert Order Items Atomically
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

        IF v_menu_item_id IS NOT NULL AND v_menu_item_id > 0 THEN
            SELECT id, name, price, is_available, restaurant_id, is_today_special, special_price, special_expiry_datetime
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
            ELSE
                v_price := COALESCE((v_item->>'price')::numeric, 0);
            END IF;
        ELSE
            v_price := COALESCE((v_item->>'price')::numeric, 0);
            IF v_price < 0 THEN
                RAISE EXCEPTION 'Invalid price for item: %', v_price USING ERRCODE = '22023';
            END IF;
        END IF;

        v_item_tax_pct := COALESCE((v_item->>'tax_percent')::numeric, v_gst_pct);
        v_item_cgst_pct := COALESCE((v_item->>'cgst_percent')::numeric, v_item_tax_pct / 2.0);
        v_item_sgst_pct := COALESCE((v_item->>'sgst_percent')::numeric, v_item_tax_pct / 2.0);

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

    -- 7. Authoritative Total Recomputation across ALL order items
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

    -- 8. Resolve Effective Coupon Code
    IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) <> '' THEN
        v_clean_coupon := UPPER(TRIM(p_coupon_code));
    ELSIF v_existing_order.coupon_code IS NOT NULL AND TRIM(v_existing_order.coupon_code) <> '' THEN
        v_clean_coupon := UPPER(TRIM(v_existing_order.coupon_code));
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

    -- 9. Update Order Summary Atomically
    UPDATE public.orders
    SET total_amount = v_final_total,
        gst_amount = v_gst_amount,
        cgst_amount = v_cgst_amount,
        sgst_amount = v_sgst_amount,
        discount_amount = v_discount,
        coupon_code = v_clean_coupon,
        delivery_fee = v_delivery_fee,
        waiter_id = COALESCE(p_waiter_id, waiter_id)
    WHERE id = v_order_id;

    -- 10. Update Table and Staff State Atomically (DINE_IN only)
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

    -- 11. Return Authoritative Success Payload
    RETURN jsonb_build_object(
        'success', true,
        'id', v_order_id,
        'total_amount', v_final_total,
        'subtotal', v_total_subtotal,
        'gst_amount', v_gst_amount,
        'cgst_amount', v_cgst_amount,
        'sgst_amount', v_sgst_amount,
        'discount_amount', v_discount,
        'coupon_code', v_clean_coupon
    );
END;
$$;
