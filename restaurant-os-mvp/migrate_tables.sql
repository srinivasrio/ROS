BEGIN;

-- 1. Create Default Area for all restaurants that don't have one
INSERT INTO public.restaurant_areas (name, restaurant_id)
SELECT 'Default Area', id
FROM public.restaurants r
WHERE NOT EXISTS (
    SELECT 1 FROM public.restaurant_areas ra WHERE ra.restaurant_id = r.id
);

-- 2. Update existing tables to belong to the Default Area
UPDATE public.tables t
SET area_id = (
    SELECT id FROM public.restaurant_areas ra 
    WHERE ra.restaurant_id = t.restaurant_id 
    ORDER BY created_at ASC 
    LIMIT 1
)
WHERE t.area_id IS NULL;

-- 3. Drop the old unique constraint
ALTER TABLE public.tables DROP CONSTRAINT IF EXISTS tables_table_number_restaurant_id_key;
ALTER TABLE public.tables DROP CONSTRAINT IF EXISTS tables_table_number_branch_id_key;

-- 4. Add the new unique constraint (table_number, restaurant_id, area_id)
ALTER TABLE public.tables ADD CONSTRAINT tables_table_number_restaurant_area_key UNIQUE (table_number, restaurant_id, area_id);

COMMIT;
