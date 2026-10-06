-- Migration: Create restaurant_staff backward-compatibility view on employees
-- Fixes "Could not find the table 'public.restaurant_staff' in the schema cache"

CREATE OR REPLACE VIEW public.restaurant_staff AS 
SELECT * FROM public.employees;

-- Grant permissions for PostgREST
GRANT ALL ON public.restaurant_staff TO authenticated, service_role, anon;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
