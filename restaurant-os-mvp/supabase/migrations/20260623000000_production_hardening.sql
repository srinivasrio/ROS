-- Migration: Dine In One SaaS Production Hardening
-- Date: 2026-06-23

-- 1. Hardening dine_users Roles & Lockouts
ALTER TABLE public.dine_users DROP CONSTRAINT IF EXISTS dine_users_role_check;

-- Map existing roles
UPDATE public.dine_users SET role = 'restaurant_admin' WHERE role = 'ADMIN';
UPDATE public.dine_users SET role = 'waiter' WHERE role = 'WAITER';
UPDATE public.dine_users SET role = 'kitchen' WHERE role = 'CHEF';

ALTER TABLE public.dine_users ADD CONSTRAINT dine_users_role_check CHECK (role IN ('SUPER_ADMIN', 'restaurant_admin', 'manager', 'waiter', 'kitchen'));

-- Add lockouts
ALTER TABLE public.dine_users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE public.dine_users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- 2. Dine Sessions Table
CREATE TABLE IF NOT EXISTS public.dine_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.dine_users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    device_info TEXT,
    ip_address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.dine_sessions ENABLE ROW LEVEL SECURITY;

-- 3. Vault Settings Table (Store local cryptographic secret)
CREATE TABLE IF NOT EXISTS public.vault_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
ALTER TABLE public.vault_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.vault_settings (key, value)
VALUES ('tenant_secret', 'dine-in-one-jwt-secret-key-at-least-32-chars-2026')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- SECURITY DEFINER getter for Vault (bypasses RLS only within this function scope)
CREATE OR REPLACE FUNCTION public.get_vault_setting(setting_key text) 
RETURNS text AS $$
DECLARE
    res text;
BEGIN
    SELECT value INTO res FROM public.vault_settings WHERE key = setting_key;
    RETURN res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. DB Backups Table
CREATE TABLE IF NOT EXISTS public.db_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    file_size BIGINT,
    trigger_type TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'manual'
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
    error_message TEXT,
    restore_status TEXT NOT NULL DEFAULT 'none' CHECK (restore_status IN ('none', 'restoring', 'success', 'failed')),
    restored_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.db_backups ENABLE ROW LEVEL SECURITY;

-- 5. Order Status History Table
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    restaurant_id TEXT,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by TEXT NOT NULL DEFAULT 'system',
    changed_by_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- 6. Query Telemetry Metrics Table
CREATE TABLE IF NOT EXISTS public.query_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT,
    query_type TEXT NOT NULL,
    is_cache_hit BOOLEAN NOT NULL,
    latency_ms INTEGER NOT NULL,
    is_slow BOOLEAN NOT NULL DEFAULT false,
    client_info TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.query_metrics ENABLE ROW LEVEL SECURITY;

-- 7. Unique constraint on orders transaction_id
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS unique_transaction_id;
ALTER TABLE public.orders ADD CONSTRAINT unique_transaction_id UNIQUE (transaction_id);

-- 8. Cryptographic Decoders & Validations (PL/pgSQL)

-- base64url decoding helper
CREATE OR REPLACE FUNCTION public.base64url_decode(input text)
RETURNS text AS $$
DECLARE
    temp text;
    padding int;
BEGIN
    temp := translate(input, '-_', '+/');
    padding := 4 - (length(temp) % 4);
    IF padding < 4 THEN
        temp := temp || repeat('=', padding);
    END IF;
    RETURN convert_from(decode(temp, 'base64'), 'utf-8');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- base64url byte decoder
CREATE OR REPLACE FUNCTION public.base64url_decode_bytes(input text)
RETURNS bytea AS $$
DECLARE
    temp text;
    padding int;
BEGIN
    temp := translate(input, '-_', '+/');
    padding := 4 - (length(temp) % 4);
    IF padding < 4 THEN
        temp := temp || repeat('=', padding);
    END IF;
    RETURN decode(temp, 'base64');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- custom JWT verifier
CREATE OR REPLACE FUNCTION public.verify_custom_jwt(jwt_token text)
RETURNS json AS $$
DECLARE
    parts text[];
    secret text;
    computed_sig bytea;
    client_sig_bytes bytea;
    payload_text text;
    payload_json json;
BEGIN
    parts := string_to_array(jwt_token, '.');
    IF array_length(parts, 1) <> 3 THEN
        RETURN null;
    END IF;

    secret := public.get_vault_setting('tenant_secret');
    IF secret IS NULL OR secret = '' THEN
        RETURN null;
    END IF;

    BEGIN
        client_sig_bytes := public.base64url_decode_bytes(parts[3]);
        computed_sig := hmac(parts[1] || '.' || parts[2], secret, 'sha256');
    EXCEPTION WHEN OTHERS THEN
        RETURN null;
    END;

    IF client_sig_bytes <> computed_sig THEN
        RETURN null;
    END IF;

    BEGIN
        payload_text := public.base64url_decode(parts[2]);
        payload_json := payload_text::json;
    EXCEPTION WHEN OTHERS THEN
        RETURN null;
    END;

    IF payload_json->>'exp' IS NOT NULL THEN
        IF (payload_json->>'exp')::bigint < extract(epoch from now())::bigint THEN
            RETURN null;
        END IF;
    END IF;

    RETURN payload_json;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Resolves the current user's verified claims
CREATE OR REPLACE FUNCTION public.current_user_claims()
RETURNS json AS $$
DECLARE
    headers json;
    token text;
    claims json;
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN json_build_object('role', 'service_role');
    END IF;

    BEGIN
        headers := current_setting('request.headers', true)::json;
    EXCEPTION WHEN OTHERS THEN
        RETURN null;
    END;

    IF headers IS NULL THEN
        RETURN null;
    END IF;

    token := headers->>'x-dine-token';
    IF token IS NULL OR token = '' THEN
        -- Fallback for native Supabase users
        IF auth.role() = 'authenticated' THEN
            -- Get restaurant_id from users table
            DECLARE
                r_id text;
            BEGIN
                SELECT restaurant_id INTO r_id FROM public.users WHERE id = auth.uid();
                IF r_id IS NULL THEN
                    SELECT restaurant_id INTO r_id FROM public.staff WHERE id = auth.uid();
                END IF;
                RETURN json_build_object(
                    'role', auth.jwt()->>'role',
                    'restaurant_id', r_id
                );
            END;
        END IF;
        RETURN null;
    END IF;

    claims := public.verify_custom_jwt(token);
    RETURN claims;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Validates client-side signature for tenant/table isolation
CREATE OR REPLACE FUNCTION public.validate_tenant(r_id text)
RETURNS boolean AS $$
DECLARE
    headers json;
    client_sig text;
    client_table text;
    expected_restaurant_sig text;
    expected_table_sig text;
    secret text;
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN true;
    END IF;

    BEGIN
        headers := current_setting('request.headers', true)::json;
    EXCEPTION WHEN OTHERS THEN
        RETURN false;
    END;

    IF headers IS NULL THEN
        RETURN false;
    END IF;

    client_sig := headers->>'x-tenant-signature';
    IF client_sig IS NULL OR client_sig = '' THEN
        -- Fallback to JWT claims checking
        DECLARE
            claims json := public.current_user_claims();
        BEGIN
            IF claims IS NOT NULL AND claims->>'restaurant_id' = r_id THEN
                RETURN true;
            END IF;
        END;
        RETURN false;
    END IF;

    secret := public.get_vault_setting('tenant_secret');
    IF secret IS NULL OR secret = '' THEN
        RETURN false;
    END IF;

    expected_restaurant_sig := encode(hmac(r_id, secret, 'sha256'), 'hex');
    IF client_sig = expected_restaurant_sig THEN
        RETURN true;
    END IF;

    client_table := headers->>'x-table-id';
    IF client_table IS NOT NULL AND client_table <> '' THEN
        expected_table_sig := encode(hmac(r_id || ':' || client_table, secret, 'sha256'), 'hex');
        IF client_sig = expected_table_sig THEN
            RETURN true;
        END IF;
    END IF;

    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Trigger for logging order status changes
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger AS $$
DECLARE
    changed_by_user text := 'system';
    changed_by_user_name text := NULL;
    claims json;
BEGIN
    claims := public.current_user_claims();
    IF claims IS NOT NULL THEN
        changed_by_user := COALESCE(claims->>'role', 'system');
        changed_by_user_name := COALESCE(claims->>'name', 'System');
    END IF;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.order_status_history (order_id, restaurant_id, old_status, new_status, changed_by, changed_by_name, notes)
        VALUES (NEW.id, NEW.restaurant_id, NULL, NEW.status, changed_by_user, changed_by_user_name, 'Order created');
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.order_status_history (order_id, restaurant_id, old_status, new_status, changed_by, changed_by_name, notes)
        VALUES (NEW.id, NEW.restaurant_id, OLD.status, NEW.status, changed_by_user, changed_by_user_name, 'Status updated');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_order_status_change ON public.orders;
CREATE TRIGGER trg_log_order_status_change
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();


-- 10. Bulk Apply Row Level Security Policies
DO $$
DECLARE
    r RECORD;
    t text;
    tables_list text[] := ARRAY[
        'users', 'categories', 'tables', 'menu_items', 
        'sub_categories', 'customers', 'staff', 'offers', 'service_requests', 
        'restaurant_profile', 'restaurant_knowledge', 'table_merge_groups', 
        'inventory_items', 'menu_recipe_mapping', 'inventory_consumption_log', 
        'inventory_adjustment_log', 'festival_calendar', 'inventory_alerts', 
        'inventory_categories', 'service_options', 'today_specials', 
        'today_special_items', 'suppliers', 'activity_logs', 'ai_snapshot', 
        'branches', 'homepage_sections', 'category_buttons', 'quick_actions', 
        'theme_settings', 'restaurant_theme', 'homepage_categories', 
        'homepage_services', 'homepage_specials', 'homepage_offers', 
        'section_style_settings', 'homepage_banners', 'waiter_workloads', 
        'waiter_assignments', 'service_assignments', 'attendance', 'payroll_runs',
        'dine_users'
    ];
BEGIN
    -- Drop previous policies
    FOR r IN 
        SELECT tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename IN (
              'users', 'categories', 'tables', 'menu_items', 'orders', 'order_items', 
              'sub_categories', 'customers', 'staff', 'offers', 'service_requests', 
              'restaurant_profile', 'restaurant_knowledge', 'table_merge_groups', 
              'inventory_items', 'menu_recipe_mapping', 'inventory_consumption_log', 
              'inventory_adjustment_log', 'festival_calendar', 'inventory_alerts', 
              'inventory_categories', 'service_options', 'today_specials', 
              'today_special_items', 'suppliers', 'activity_logs', 'ai_snapshot', 
              'branches', 'homepage_sections', 'category_buttons', 'quick_actions', 
              'theme_settings', 'restaurant_theme', 'homepage_categories', 
              'homepage_services', 'homepage_specials', 'homepage_offers', 
              'section_style_settings', 'homepage_banners', 'waiter_workloads', 
              'waiter_assignments', 'service_assignments', 'attendance', 'payroll_runs',
              'dine_users', 'dine_sessions', 'vault_settings', 'db_backups', 'order_status_history', 'query_metrics'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policyname, r.tablename);
    END LOOP;

    -- Enable RLS and add basic Tenant Isolation Policy to scoped tables
    FOREACH t IN ARRAY tables_list LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format('
            CREATE POLICY "Tenant Isolation Policy" ON public.%I
            FOR ALL TO public
            USING (
                auth.role() = ''service_role'' OR
                public.validate_tenant(restaurant_id)
            )
            WITH CHECK (
                auth.role() = ''service_role'' OR
                public.validate_tenant(restaurant_id)
            );
        ', t);
    END LOOP;
END;
$$;


-- 11. Create custom RLS policies for fine-grained / helper tables

-- A: dine_sessions (only accessible to users/sessions that belong to the user's restaurant)
CREATE POLICY "Sessions Access Policy" ON public.dine_sessions
FOR ALL TO public
USING (
    auth.role() = 'service_role' OR
    EXISTS (
        SELECT 1 FROM public.dine_users
        WHERE dine_users.id = dine_sessions.user_id
        AND public.validate_tenant(dine_users.restaurant_id)
    )
);

-- B: user_otps, waiter_shifts, login_audit_logs (isolated via user_id relationship to dine_users)
CREATE POLICY "OTPs Access Policy" ON public.user_otps
FOR ALL TO public
USING (
    auth.role() = 'service_role' OR
    EXISTS (
        SELECT 1 FROM public.dine_users
        WHERE dine_users.id = user_otps.user_id
        AND public.validate_tenant(dine_users.restaurant_id)
    )
);

CREATE POLICY "Shifts Access Policy" ON public.waiter_shifts
FOR ALL TO public
USING (
    auth.role() = 'service_role' OR
    EXISTS (
        SELECT 1 FROM public.dine_users
        WHERE dine_users.id = waiter_shifts.user_id
        AND public.validate_tenant(dine_users.restaurant_id)
    )
);

CREATE POLICY "Login Audit Logs Access Policy" ON public.login_audit_logs
FOR ALL TO public
USING (
    auth.role() = 'service_role' OR
    EXISTS (
        SELECT 1 FROM public.dine_users
        WHERE dine_users.id = login_audit_logs.user_id
        AND public.validate_tenant(dine_users.restaurant_id)
    )
);

-- C: db_backups (only accessible via service_role - SaaS Admin bypasses RLS via admin connection)
CREATE POLICY "Backups Service Role Only" ON public.db_backups
FOR ALL TO public
USING (auth.role() = 'service_role');

-- D: order_status_history (scoped via restaurant_id)
CREATE POLICY "Order Status History Tenant Policy" ON public.order_status_history
FOR ALL TO public
USING (
    auth.role() = 'service_role' OR
    public.validate_tenant(restaurant_id)
);

-- E: query_metrics (scoped via restaurant_id)
CREATE POLICY "Query Metrics Tenant Policy" ON public.query_metrics
FOR ALL TO public
USING (
    auth.role() = 'service_role' OR
    public.validate_tenant(restaurant_id)
);

-- F: orders (strict table-specific checking for customer sessions)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Orders Policy" ON public.orders
FOR ALL TO public
USING (
    auth.role() = 'service_role' OR
    (
        public.validate_tenant(restaurant_id) AND (
            current_setting('request.headers', true)::json->>'x-table-id' IS NULL OR
            current_setting('request.headers', true)::json->>'x-table-id' = '' OR
            table_id::text = current_setting('request.headers', true)::json->>'x-table-id' OR
            merge_group_id::text = current_setting('request.headers', true)::json->>'x-table-id'
        )
    )
)
WITH CHECK (
    auth.role() = 'service_role' OR
    (
        public.validate_tenant(restaurant_id) AND (
            current_setting('request.headers', true)::json->>'x-table-id' IS NULL OR
            current_setting('request.headers', true)::json->>'x-table-id' = '' OR
            table_id::text = current_setting('request.headers', true)::json->>'x-table-id' OR
            merge_group_id::text = current_setting('request.headers', true)::json->>'x-table-id'
        )
    )
);

-- G: order_items (strict table-specific order items checking)
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Order Items Policy" ON public.order_items
FOR ALL TO public
USING (
    auth.role() = 'service_role' OR
    (
        public.validate_tenant(restaurant_id) AND (
            current_setting('request.headers', true)::json->>'x-table-id' IS NULL OR
            current_setting('request.headers', true)::json->>'x-table-id' = '' OR
            EXISTS (
                SELECT 1 FROM public.orders
                WHERE orders.id = order_items.order_id
                AND (
                    orders.table_id::text = current_setting('request.headers', true)::json->>'x-table-id' OR
                    orders.merge_group_id::text = current_setting('request.headers', true)::json->>'x-table-id'
                )
            )
        )
    )
)
WITH CHECK (
    auth.role() = 'service_role' OR
    (
        public.validate_tenant(restaurant_id) AND (
            current_setting('request.headers', true)::json->>'x-table-id' IS NULL OR
            current_setting('request.headers', true)::json->>'x-table-id' = '' OR
            EXISTS (
                SELECT 1 FROM public.orders
                WHERE orders.id = order_items.order_id
                AND (
                    orders.table_id::text = current_setting('request.headers', true)::json->>'x-table-id' OR
                    orders.merge_group_id::text = current_setting('request.headers', true)::json->>'x-table-id'
                )
            )
        )
    )
);

-- H: payroll_items (isolated via payroll_runs relationship)
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Payroll Items Policy" ON public.payroll_items
FOR ALL TO public
USING (
    auth.role() = 'service_role' OR
    EXISTS (
        SELECT 1 FROM public.payroll_runs
        WHERE payroll_runs.id = payroll_items.payroll_run_id
        AND public.validate_tenant(payroll_runs.restaurant_id)
    )
);
