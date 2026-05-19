CREATE TABLE IF NOT EXISTS public.inventory_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    name VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Users can view own categories" ON public.inventory_categories FOR SELECT USING (restaurant_id IN (SELECT restaurant_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "Users can insert own categories" ON public.inventory_categories FOR INSERT WITH CHECK (restaurant_id IN (SELECT restaurant_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "Users can update own categories" ON public.inventory_categories FOR UPDATE USING (restaurant_id IN (SELECT restaurant_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "Users can delete own categories" ON public.inventory_categories FOR DELETE USING (restaurant_id IN (SELECT restaurant_id FROM public.users WHERE id = auth.uid()));

-- Index
CREATE INDEX IF NOT EXISTS idx_inventory_categories_restaurant_id ON public.inventory_categories(restaurant_id);

-- Alter inventory_items
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.inventory_categories(id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category_id ON public.inventory_items(category_id);

-- Seed defaults for existing restaurants & Map existing string categories
DO $$
DECLARE
    r RECORD;
    c RECORD;
    v_cat_id UUID;
    default_cats TEXT[] := ARRAY['Meat & Poultry', 'Vegetables', 'Dairy', 'Grains', 'Spices', 'Oils', 'Bakery', 'Beverages', 'Packaging'];
    cat_name TEXT;
BEGIN
    FOR r IN SELECT DISTINCT restaurant_id FROM public.inventory_items WHERE restaurant_id IS NOT NULL LOOP
        -- Insert defaults if not exist
        FOREACH cat_name IN ARRAY default_cats LOOP
            IF NOT EXISTS (SELECT 1 FROM public.inventory_categories WHERE restaurant_id = r.restaurant_id AND name = cat_name) THEN
                INSERT INTO public.inventory_categories (restaurant_id, name) VALUES (r.restaurant_id, cat_name);
            END IF;
        END LOOP;
        
        -- Migrate existing category strings to category_ids
        FOR c IN SELECT DISTINCT category FROM public.inventory_items WHERE restaurant_id = r.restaurant_id AND category IS NOT NULL AND category != '' LOOP
            -- Try to find matching category by name case-insensitive
            SELECT id INTO v_cat_id FROM public.inventory_categories WHERE restaurant_id = r.restaurant_id AND LOWER(name) = LOWER(c.category) LIMIT 1;
            
            -- If match not found in defaults, create exactly as is
            IF v_cat_id IS NULL THEN
                INSERT INTO public.inventory_categories (restaurant_id, name) VALUES (r.restaurant_id, c.category) RETURNING id INTO v_cat_id;
            END IF;
            
            -- Assign category_id
            UPDATE public.inventory_items SET category_id = v_cat_id WHERE restaurant_id = r.restaurant_id AND category = c.category;
        END LOOP;
    END LOOP;
END $$;
