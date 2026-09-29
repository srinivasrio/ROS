BEGIN;

-- Create Default Area for any restaurant_id found in tables that doesn't have an area
INSERT INTO public.restaurant_areas (name, restaurant_id)
SELECT DISTINCT 'Default Area', restaurant_id
FROM public.tables t
WHERE NOT EXISTS (
    SELECT 1 FROM public.restaurant_areas ra WHERE ra.restaurant_id = t.restaurant_id
);

-- Update all tables that have NULL area_id
UPDATE public.tables t
SET area_id = (
    SELECT id FROM public.restaurant_areas ra 
    WHERE ra.restaurant_id = t.restaurant_id 
    ORDER BY created_at ASC 
    LIMIT 1
)
WHERE t.area_id IS NULL;

-- Now add the constraint safely! But wait, is area_id still nullable? Yes, but we should make sure no nulls exist before altering if we want.
-- We already dropped tables_table_number_restaurant_id_key.
-- If the unique constraint was ALREADY ADDED successfully before, then it's fine.
-- Wait, did my previous ALTER TABLE ADD CONSTRAINT fail?
-- Let's check!

COMMIT;
