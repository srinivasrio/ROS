-- Security hardening: remove public write policies that are not required by
-- the application API. API routes use service_role and remain unchanged.

BEGIN;

-- Registration requests are created and managed by authenticated API routes,
-- not by direct browser writes to Supabase.
ALTER TABLE public.restaurant_registration_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow service_role and anon access to registration requests"
    ON public.restaurant_registration_requests;
DROP POLICY IF EXISTS "Registration requests service role only"
    ON public.restaurant_registration_requests;
CREATE POLICY "Registration requests service role only"
    ON public.restaurant_registration_requests
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Customer address reads/writes go through the authenticated customer API,
-- which verifies the signed customer token and restaurant scope.
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_addresses_all ON public.customer_addresses;
DROP POLICY IF EXISTS "Customer addresses service role only" ON public.customer_addresses;
CREATE POLICY "Customer addresses service role only"
    ON public.customer_addresses
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- These policies were intended as service-role bypasses but omitted the role
-- target, making them public policies. Keep the existing tenant policies and
-- make the bypass explicit.
ALTER TABLE public.delivery_boys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "delivery_boys_service_all" ON public.delivery_boys;
CREATE POLICY "delivery_boys_service_all" ON public.delivery_boys
    FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.delivery_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "delivery_settings_service_all" ON public.delivery_settings;
CREATE POLICY "delivery_settings_service_all" ON public.delivery_settings
    FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "delivery_assignments_service_all" ON public.delivery_assignments;
CREATE POLICY "delivery_assignments_service_all" ON public.delivery_assignments
    FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;
