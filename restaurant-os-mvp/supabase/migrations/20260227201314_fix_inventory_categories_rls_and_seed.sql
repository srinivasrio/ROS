-- Drop old restrictive authenticated policies
DROP POLICY IF EXISTS "Users can view own categories" ON public.inventory_categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON public.inventory_categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.inventory_categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.inventory_categories;

-- Create public policies for MVP to match frontend 'Public Access' usage
CREATE POLICY "Public Access" ON public.inventory_categories FOR ALL USING (true) WITH CHECK (true);

-- Seed default categories for DEFAULT_RESTAURANT_ID directly 
-- so empty inventory_items tables don't prevent the loop from running
DO $$
DECLARE
    v_restaurant_id UUID := '00000000-0000-0000-0000-000000000000';
    cat_name TEXT;
    default_cats TEXT[] := ARRAY['Meat & Poultry', 'Vegetables', 'Dairy', 'Grains', 'Spices', 'Oils', 'Bakery', 'Beverages', 'Packaging'];
BEGIN
    FOREACH cat_name IN ARRAY default_cats LOOP
        IF NOT EXISTS (SELECT 1 FROM public.inventory_categories WHERE restaurant_id = v_restaurant_id AND name = cat_name) THEN
            INSERT INTO public.inventory_categories (restaurant_id, name) VALUES (v_restaurant_id, cat_name);
        END IF;
    END LOOP;
END $$;
