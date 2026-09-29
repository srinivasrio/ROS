-- Create restaurant_areas table
CREATE TABLE IF NOT EXISTS public.restaurant_areas (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add area_id to tables
ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES public.restaurant_areas(id);

-- Create Default Area for all distinct restaurants in tables and assign tables to it
DO $$
DECLARE
    r_id TEXT;
    a_id UUID;
BEGIN
    FOR r_id IN SELECT DISTINCT restaurant_id FROM public.tables LOOP
        -- Check if Default Area already exists
        SELECT id INTO a_id FROM public.restaurant_areas WHERE restaurant_id = r_id AND name = 'Default Area' LIMIT 1;
        
        IF a_id IS NULL THEN
            -- Insert a Default Area for the restaurant
            INSERT INTO public.restaurant_areas (restaurant_id, name, display_order)
            VALUES (r_id, 'Default Area', 0)
            RETURNING id INTO a_id;
        END IF;

        -- Update tables for this restaurant to use this Default Area
        UPDATE public.tables
        SET area_id = a_id
        WHERE restaurant_id = r_id AND area_id IS NULL;
    END LOOP;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_restaurant_areas_restaurant_id ON public.restaurant_areas(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_area_id ON public.tables(area_id);

-- RLS for restaurant_areas
ALTER TABLE public.restaurant_areas ENABLE ROW LEVEL SECURITY;

-- Allow read access for everyone (similar to tables or limited by restaurant_id in app logic)
CREATE POLICY "Enable read access for all users" ON public.restaurant_areas
    FOR SELECT
    USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON public.restaurant_areas
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON public.restaurant_areas
    FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users only" ON public.restaurant_areas
    FOR DELETE
    USING (auth.role() = 'authenticated');
