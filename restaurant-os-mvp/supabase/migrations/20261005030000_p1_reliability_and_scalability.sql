-- ==============================================================================
-- Migration: 20261005030000_p1_reliability_and_scalability.sql
-- Description: P1 Remediation for Dine in One
--   P1-02: Atomic Order Creation RPC (create_order_v2)
--   P1-03: Evidence-based High-performance Indexes & Duplicate Index Cleanup
--   P1-05: Customer Phone OTP Verification Storage with Strict RLS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. P1-03: Evidence-Based Indexes for High-Scan Tables
-- ------------------------------------------------------------------------------

-- public.users (addresses 91M+ sequential scans)
CREATE INDEX IF NOT EXISTS idx_users_restaurant_id ON public.users (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users (phone);

-- public.tables (addresses 420K+ sequential scans)
CREATE INDEX IF NOT EXISTS idx_tables_restaurant_id ON public.tables (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant_status ON public.tables (restaurant_id, status);

-- public.employees (addresses 568K+ sequential scans)
CREATE INDEX IF NOT EXISTS idx_employees_restaurant_id ON public.employees (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_employees_mobile ON public.employees (mobile);
CREATE INDEX IF NOT EXISTS idx_employees_restaurant_status ON public.employees (restaurant_id, status);

-- public.orders duplicate index cleanup
-- idx_orders_branch and idx_orders_branch_id are identical definitions on public.orders (branch_id) WHERE branch_id IS NOT NULL.
DROP INDEX IF EXISTS public.idx_orders_branch;

-- ------------------------------------------------------------------------------
-- 2. P1-05: Customer Phone OTP Storage with RLS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.customer_phone_otps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id text NOT NULL,
    phone text NOT NULL,
    otp_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    attempt_count int DEFAULT 0,
    max_attempts int DEFAULT 5,
    is_used boolean DEFAULT false,
    is_verified boolean DEFAULT false,
    resend_available_at timestamptz NOT NULL,
    ip_address text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS to prevent public access
ALTER TABLE public.customer_phone_otps ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Service role access for customer_phone_otps" ON public.customer_phone_otps;
DROP POLICY IF EXISTS "Allow service_role full access to customer_phone_otps" ON public.customer_phone_otps;

-- Strictly service_role only. Public anon users cannot read or write OTP hashes directly.
CREATE POLICY "Allow service_role full access to customer_phone_otps"
    ON public.customer_phone_otps
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_customer_phone_otps_lookup 
    ON public.customer_phone_otps (restaurant_id, phone, is_used);

-- ------------------------------------------------------------------------------
-- 3. P1-02: PostgreSQL RPC create_order_v2 (Atomic Order Creation)
-- ------------------------------------------------------------------------------

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
    v_existing_order RECORD;
    v_order_id text;
    v_total_subtotal numeric := 0;
    v_line_subtotal numeric := 0;
    v_price numeric := 0;
    v_spec_price numeric := NULL;
    v_qty int;
    v_menu_item_id bigint;
    v_item_type text;
    v_menu_rec RECORD;
    v_offer_rec RECORD;
    v_special_rec RECORD;
    v_table_rec RECORD;
    v_raw_menu_id text;
    v_combo_id text;
    v_gst_pct numeric := 5.0;
    v_cgst_pct numeric := 2.5;
    v_sgst_pct numeric := 2.5;
    v_cgst_amount numeric := 0;
    v_sgst_amount numeric := 0;
    v_gst_amount numeric := 0;
    v_discount numeric := 0;
    v_delivery_fee numeric := 0;
    v_final_total numeric := 0;
    v_item jsonb;
    v_new_items_cgst numeric := 0;
    v_new_items_sgst numeric := 0;
    v_item_tax_pct numeric;
    v_item_cgst_pct numeric;
    v_item_sgst_pct numeric;
    v_clean_coupon text;
    v_now timestamptz := now();
    v_item_count int;
BEGIN
    -- 1. Idempotency Check: Return existing order if identical transaction_id supplied
    IF p_transaction_id IS NOT NULL AND p_transaction_id <> '' THEN
        SELECT id, total_amount, status 
        INTO v_existing_order 
        FROM public.orders 
        WHERE transaction_id = p_transaction_id AND restaurant_id = p_restaurant_id
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

    -- 2. Validate Items Array
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
        RAISE EXCEPTION 'At least one order item is required.' USING ERRCODE = '22023';
    END IF;

    v_item_count := jsonb_array_length(p_items);
    IF v_item_count = 0 THEN
        RAISE EXCEPTION 'At least one order item is required.' USING ERRCODE = '22023';
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

    -- 5. Validate Every Menu Item, Pricing, and Availability
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Validate quantity
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
            -- Lookup authoritative menu item from DB
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

            -- Check today specials on the menu_item record
            IF v_menu_rec.is_today_special = true AND v_menu_rec.special_price IS NOT NULL AND (v_menu_rec.special_expiry_datetime IS NULL OR v_menu_rec.special_expiry_datetime > v_now) THEN
                v_price := v_menu_rec.special_price;
            ELSE
                v_price := v_menu_rec.price;
            END IF;
        ELSIF v_combo_id IS NOT NULL AND v_combo_id <> '' THEN
            -- Lookup authoritative special / combo from today_specials
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
            -- Custom item or combo without ID
            v_price := COALESCE((v_item->>'price')::numeric, 0);
            IF v_price < 0 THEN
                RAISE EXCEPTION 'Invalid price for item: %', v_price USING ERRCODE = '22023';
            END IF;
        END IF;

        v_line_subtotal := v_price * v_qty;
        v_total_subtotal := v_total_subtotal + v_line_subtotal;

        -- Resolve item tax percentages
        v_item_tax_pct := COALESCE((v_item->>'tax_percent')::numeric, v_gst_pct);
        v_item_cgst_pct := COALESCE((v_item->>'cgst_percent')::numeric, v_item_tax_pct / 2.0);
        v_item_sgst_pct := COALESCE((v_item->>'sgst_percent')::numeric, v_item_tax_pct / 2.0);

        v_new_items_cgst := v_new_items_cgst + ((v_line_subtotal * v_item_cgst_pct) / 100.0);
        v_new_items_sgst := v_new_items_sgst + ((v_line_subtotal * v_item_sgst_pct) / 100.0);
    END LOOP;

    -- 6. Compute Taxes & Rounding
    v_cgst_amount := CEIL(ROUND(v_new_items_cgst, 8) * 100.0) / 100.0;
    v_sgst_amount := CEIL(ROUND(v_new_items_sgst, 8) * 100.0) / 100.0;
    v_gst_amount := CEIL((v_cgst_amount + v_sgst_amount) * 100.0) / 100.0;

    -- 7. Validate & Apply Coupon Discount Server-side
    IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) <> '' THEN
        v_clean_coupon := UPPER(TRIM(p_coupon_code));
        SELECT discount_type, discount_value, max_discount, end_datetime
        INTO v_offer_rec
        FROM public.offers
        WHERE restaurant_id = p_restaurant_id 
          AND code = v_clean_coupon 
          AND status = 'active'
        LIMIT 1;

        IF v_offer_rec.discount_type IS NOT NULL THEN
            IF v_offer_rec.end_datetime IS NULL OR v_offer_rec.end_datetime > v_now THEN
                IF v_offer_rec.discount_type = 'percentage' THEN
                    v_discount := (v_total_subtotal * v_offer_rec.discount_value) / 100.0;
                    IF v_offer_rec.max_discount IS NOT NULL AND v_discount > v_offer_rec.max_discount THEN
                        v_discount := v_offer_rec.max_discount;
                    END IF;
                ELSE
                    v_discount := COALESCE(v_offer_rec.discount_value, 0);
                END IF;
                v_discount := LEAST(v_discount, v_total_subtotal);
            END IF;
        END IF;
    END IF;

    v_discount := CEIL(ROUND(v_discount, 8) * 100.0) / 100.0;
    v_delivery_fee := CEIL(ROUND(COALESCE(p_delivery_fee, 0), 8) * 100.0) / 100.0;
    v_total_subtotal := CEIL(ROUND(v_total_subtotal, 8) * 100.0) / 100.0;

    -- 8. Atomic Order Persistence
    IF p_active_order_id IS NOT NULL AND p_active_order_id <> '' THEN
        -- Merge into active order
        SELECT id, total_amount, gst_amount, cgst_amount, sgst_amount, discount_amount, delivery_fee
        INTO v_existing_order
        FROM public.orders
        WHERE id = p_active_order_id AND restaurant_id = p_restaurant_id;

        IF v_existing_order.id IS NULL THEN
            RAISE EXCEPTION 'Active order % not found for restaurant %', p_active_order_id, p_restaurant_id USING ERRCODE = 'P0002';
        END IF;

        v_order_id := v_existing_order.id;
        v_final_total := CEIL((COALESCE(v_existing_order.total_amount, 0) + v_total_subtotal + v_gst_amount) * 100.0) / 100.0;

        UPDATE public.orders
        SET total_amount = v_final_total,
            gst_amount = COALESCE(gst_amount, 0) + v_gst_amount,
            cgst_amount = COALESCE(cgst_amount, 0) + v_cgst_amount,
            sgst_amount = COALESCE(sgst_amount, 0) + v_sgst_amount,
            waiter_id = COALESCE(p_waiter_id, waiter_id)
        WHERE id = v_order_id;
    ELSE
        -- Brand-new order
        v_order_id := gen_random_uuid()::text;
        v_final_total := CEIL((v_total_subtotal + v_gst_amount + v_delivery_fee - v_discount) * 100.0) / 100.0;

        INSERT INTO public.orders (
            id, status, total_amount, gst_amount, cgst_amount, sgst_amount,
            amount_paid, is_completed, waiter_id, restaurant_id, branch_id,
            coupon_code, discount_amount, transaction_id, order_type,
            table_id, merge_group_id, customer_id, customer_phone,
            delivery_address, delivery_phone, delivery_notes, delivery_fee,
            delivery_zone_id, delivery_lat, delivery_lng, customer_lat, customer_lng,
            created_at
        ) VALUES (
            v_order_id, COALESCE(p_status, 'placed')::public.order_status, v_final_total, v_gst_amount, v_cgst_amount, v_sgst_amount,
            0, false, p_waiter_id, p_restaurant_id, p_branch_id,
            p_coupon_code, v_discount, p_transaction_id, p_order_type,
            p_table_id, p_merge_group_id, p_customer_id, p_customer_phone,
            p_delivery_address, p_delivery_phone, p_delivery_notes, v_delivery_fee,
            p_delivery_zone_id, p_delivery_lat, p_delivery_lng, p_customer_lat, p_customer_lng,
            v_now
        );
    END IF;

    -- 9. Insert Order Items Atomically
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_qty := (v_item->>'quantity')::int;
        v_item_type := COALESCE(v_item->>'item_type', v_item->>'itemType', 'standard');
        v_raw_menu_id := COALESCE(v_item->>'menu_item_id', v_item->>'menuItemId');
        v_combo_id := COALESCE(v_item->>'combo_id', v_item->>'comboId');

        IF v_raw_menu_id IS NOT NULL AND v_raw_menu_id ~ '^[0-9]+$' THEN
            v_menu_item_id := v_raw_menu_id::bigint;
        ELSE
            v_menu_item_id := NULL;
        END IF;

        IF v_menu_item_id IS NOT NULL AND v_menu_item_id > 0 THEN
            SELECT price, is_today_special, special_price, special_expiry_datetime 
            INTO v_menu_rec 
            FROM public.menu_items 
            WHERE id = v_menu_item_id;

            IF v_menu_rec.is_today_special = true AND v_menu_rec.special_price IS NOT NULL AND (v_menu_rec.special_expiry_datetime IS NULL OR v_menu_rec.special_expiry_datetime > v_now) THEN
                v_price := v_menu_rec.special_price;
            ELSE
                v_price := v_menu_rec.price;
            END IF;
        ELSIF v_combo_id IS NOT NULL AND v_combo_id <> '' THEN
            SELECT special_price, original_price INTO v_special_rec FROM public.today_specials WHERE id::text = v_combo_id;
            v_price := COALESCE(v_special_rec.special_price, v_special_rec.original_price, 0);
        ELSE
            v_price := COALESCE((v_item->>'price')::numeric, 0);
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

    -- 11. Return Success Payload
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
        'is_duplicate', false
    );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.create_order_v2 TO anon, authenticated, service_role;
