-- Migration to add Restaurant Home Page Builder tables

CREATE TABLE IF NOT EXISTS public.homepage_sections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    section_type TEXT NOT NULL,
    section_title TEXT,
    section_subtitle TEXT,
    display_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.banners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    image_url TEXT NOT NULL,
    heading TEXT,
    subheading TEXT,
    cta_text TEXT,
    cta_action TEXT,
    redirect_target TEXT,
    start_datetime TIMESTAMP WITH TIME ZONE,
    end_datetime TIMESTAMP WITH TIME ZONE,
    repeat_type TEXT,
    priority INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Offers table already exists, we will add the missing columns for the homepage builder
ALTER TABLE public.offers
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS expiry TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS start_datetime TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS end_datetime TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

CREATE TABLE IF NOT EXISTS public.category_buttons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    image_url TEXT,
    title TEXT,
    redirect_target TEXT,
    order_index INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.quick_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    icon TEXT,
    label TEXT,
    redirect_target TEXT,
    order_index INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.theme_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id TEXT NOT NULL UNIQUE,
    primary_color TEXT,
    secondary_color TEXT,
    background_color TEXT,
    button_color TEXT,
    font_style TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.homepage_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_buttons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_settings ENABLE ROW LEVEL SECURITY;

-- Add RLS policies (allow all for MVP)
CREATE POLICY "Enable read access for all users" ON public.homepage_sections FOR SELECT USING (true);
CREATE POLICY "Enable all access for all users" ON public.homepage_sections FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON public.banners FOR SELECT USING (true);
CREATE POLICY "Enable all access for all users" ON public.banners FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON public.category_buttons FOR SELECT USING (true);
CREATE POLICY "Enable all access for all users" ON public.category_buttons FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON public.quick_actions FOR SELECT USING (true);
CREATE POLICY "Enable all access for all users" ON public.quick_actions FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON public.theme_settings FOR SELECT USING (true);
CREATE POLICY "Enable all access for all users" ON public.theme_settings FOR ALL USING (true) WITH CHECK (true);
