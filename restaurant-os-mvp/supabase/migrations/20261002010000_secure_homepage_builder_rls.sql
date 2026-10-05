-- Migration: 20261002010000_secure_homepage_builder_rls.sql
-- Fix C4 Homepage Builder RLS / public-write security vulnerability.
-- Replaces insecure "Allow public all access" (USING true WITH CHECK true) on all
-- Homepage Builder and related customization tables with least-privilege policies:
-- 1. Public SELECT is preserved so published restaurant websites continue loading.
-- 2. INSERT, UPDATE, DELETE strictly require service_role or authenticated restaurant_admin/owner
--    for the matching restaurant tenant.
-- 3. Anonymous writes, cross-tenant writes, and unauthorized staff writes are blocked.

BEGIN;

-- 1. Synchronize vault_settings jwt_secret and tenant_secret with the active application secret
INSERT INTO public.vault_settings (key, value)
VALUES 
    ('jwt_secret', 'MEfAQ-obz83Fe7Yu_60RlIFTKncal1Vu7nAjNt7PY3RSZXr5RFyAh6-pjPZvGEqn'),
    ('tenant_secret', 'MEfAQ-obz83Fe7Yu_60RlIFTKncal1Vu7nAjNt7PY3RSZXr5RFyAh6-pjPZvGEqn')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2. Enhanced verify_custom_jwt supporting both jwt_secret and tenant_secret lookups
CREATE OR REPLACE FUNCTION public.verify_custom_jwt(jwt_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

    -- Retrieve secret: prefer jwt_secret, fallback to tenant_secret
    secret := public.get_vault_setting('jwt_secret');
    IF secret IS NULL OR secret = '' THEN
        secret := public.get_vault_setting('tenant_secret');
    END IF;
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
        -- Also check tenant_secret if different
        DECLARE
            alt_secret text := public.get_vault_setting('tenant_secret');
        BEGIN
            IF alt_secret IS NOT NULL AND alt_secret <> '' AND alt_secret <> secret THEN
                IF client_sig_bytes <> hmac(parts[1] || '.' || parts[2], alt_secret, 'sha256') THEN
                    RETURN null;
                END IF;
            ELSE
                RETURN null;
            END IF;
        END;
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
$$;

-- 3. Enhanced current_user_claims extracting token from x-dine-token or Authorization: Bearer
CREATE OR REPLACE FUNCTION public.current_user_claims()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
        IF headers->>'authorization' IS NOT NULL AND headers->>'authorization' LIKE 'Bearer %' THEN
            token := substring(headers->>'authorization' FROM 8);
        END IF;
    END IF;

    IF token IS NULL OR token = '' THEN
        -- Fallback for native Supabase users
        IF auth.role() = 'authenticated' THEN
            DECLARE
                r_id text;
            BEGIN
                SELECT restaurant_id INTO r_id FROM public.users WHERE id = auth.uid();
                IF r_id IS NULL THEN
                    SELECT restaurant_id INTO r_id FROM public.employees WHERE id = auth.uid();
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
$$;

-- 4. Dedicated authorization helper for Homepage Builder & customization writes
CREATE OR REPLACE FUNCTION public.is_homepage_admin(r_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
    claims json;
    u_role text;
BEGIN
    -- Service role always permitted
    IF auth.role() = 'service_role' THEN
        RETURN true;
    END IF;

    -- Super Admin check via employees table
    IF EXISTS (
        SELECT 1 FROM public.employees 
        WHERE id = auth.uid() AND upper(role) IN ('SUPER_ADMIN', 'SUPERADMIN')
    ) THEN
        RETURN true;
    END IF;

    -- Restaurant Owner check via is_restaurant_owner
    IF public.is_restaurant_owner(r_id) THEN
        RETURN true;
    END IF;

    -- Custom JWT claims check
    claims := public.current_user_claims();
    IF claims IS NULL THEN
        RETURN false;
    END IF;

    u_role := lower(COALESCE(claims->>'role', ''));
    
    -- Disallow non-admin roles (waiter, kitchen, delivery_boy, customer, etc.)
    IF u_role NOT IN ('restaurant_admin', 'owner', 'super_admin', 'superadmin', 'admin') THEN
        RETURN false;
    END IF;

    -- Super Admin has global tenant access
    IF u_role IN ('super_admin', 'superadmin') THEN
        RETURN true;
    END IF;

    -- Restaurant Admin / Owner must match target restaurant_id
    IF (claims->>'restaurant_id' = r_id OR claims->>'restaurantId' = r_id) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

-- 5. Harden Homepage Builder and Customization tables:
-- Replace "Allow public all access" on all 11 tables with granular SELECT + tenant write policies

DO $$
DECLARE
    t text;
    tables_list text[] := ARRAY[
        'homepage_sections',
        'homepage_banners',
        'homepage_categories',
        'homepage_services',
        'homepage_specials',
        'section_style_settings',
        'restaurant_theme',
        'restaurant_profile',
        'offers',
        'today_specials',
        'today_special_items'
    ];
BEGIN
    FOREACH t IN ARRAY tables_list LOOP
        -- Ensure RLS is active
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

        -- Remove insecure all-access policies
        EXECUTE format('DROP POLICY IF EXISTS "Allow public all access" ON public.%I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Enable all access for all users" ON public.%I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation Policy" ON public.%I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Allow public read access" ON public.%I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Tenant write policy" ON public.%I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Tenant update policy" ON public.%I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Tenant delete policy" ON public.%I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Tenant admin insert policy" ON public.%I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Tenant admin update policy" ON public.%I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Tenant admin delete policy" ON public.%I;', t);

        -- 1. Public SELECT: Intentionally public for customer website and menu viewing
        EXECUTE format('
            CREATE POLICY "Allow public read access" ON public.%I
            FOR SELECT TO public
            USING (true);
        ', t);

        -- 2. Tenant Admin INSERT: Only authenticated admin/owner for matching tenant
        EXECUTE format('
            CREATE POLICY "Tenant admin insert policy" ON public.%I
            FOR INSERT TO authenticated, service_role, anon
            WITH CHECK (public.is_homepage_admin(restaurant_id));
        ', t);

        -- 3. Tenant Admin UPDATE: Only authenticated admin/owner for matching tenant
        EXECUTE format('
            CREATE POLICY "Tenant admin update policy" ON public.%I
            FOR UPDATE TO authenticated, service_role, anon
            USING (public.is_homepage_admin(restaurant_id))
            WITH CHECK (public.is_homepage_admin(restaurant_id));
        ', t);

        -- 4. Tenant Admin DELETE: Only authenticated admin/owner for matching tenant
        EXECUTE format('
            CREATE POLICY "Tenant admin delete policy" ON public.%I
            FOR DELETE TO authenticated, service_role, anon
            USING (public.is_homepage_admin(restaurant_id));
        ', t);
    END LOOP;
END $$;

COMMIT;
