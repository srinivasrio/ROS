-- Migration: Fix RLS policies on homepage and restaurant customization tables
-- Allows public/anon access consistent with tables, orders, homepage_services, etc.
-- Tenant isolation is enforced at the application/routing layer.

DO $$
BEGIN
    -- homepage_banners
    DROP POLICY IF EXISTS "Tenant Isolation Policy" ON public.homepage_banners;
    DROP POLICY IF EXISTS "Allow public all access" ON public.homepage_banners;
    CREATE POLICY "Allow public all access" ON public.homepage_banners FOR ALL TO public USING (true) WITH CHECK (true);

    -- homepage_sections
    DROP POLICY IF EXISTS "Tenant Isolation Policy" ON public.homepage_sections;
    DROP POLICY IF EXISTS "Allow public all access" ON public.homepage_sections;
    CREATE POLICY "Allow public all access" ON public.homepage_sections FOR ALL TO public USING (true) WITH CHECK (true);

    -- homepage_categories
    DROP POLICY IF EXISTS "Tenant Isolation Policy" ON public.homepage_categories;
    DROP POLICY IF EXISTS "Allow public all access" ON public.homepage_categories;
    CREATE POLICY "Allow public all access" ON public.homepage_categories FOR ALL TO public USING (true) WITH CHECK (true);

    -- section_style_settings
    DROP POLICY IF EXISTS "Tenant Isolation Policy" ON public.section_style_settings;
    DROP POLICY IF EXISTS "Allow public all access" ON public.section_style_settings;
    CREATE POLICY "Allow public all access" ON public.section_style_settings FOR ALL TO public USING (true) WITH CHECK (true);

    -- restaurant_theme
    DROP POLICY IF EXISTS "Tenant Isolation Policy" ON public.restaurant_theme;
    DROP POLICY IF EXISTS "Allow public all access" ON public.restaurant_theme;
    CREATE POLICY "Allow public all access" ON public.restaurant_theme FOR ALL TO public USING (true) WITH CHECK (true);

    -- restaurant_profile
    DROP POLICY IF EXISTS "Tenant write policy" ON public.restaurant_profile;
    DROP POLICY IF EXISTS "Tenant update policy" ON public.restaurant_profile;
    DROP POLICY IF EXISTS "Tenant delete policy" ON public.restaurant_profile;
    DROP POLICY IF EXISTS "Allow public read access" ON public.restaurant_profile;
    DROP POLICY IF EXISTS "Allow public all access" ON public.restaurant_profile;
    CREATE POLICY "Allow public all access" ON public.restaurant_profile FOR ALL TO public USING (true) WITH CHECK (true);

    -- homepage_specials
    DROP POLICY IF EXISTS "Tenant Isolation Policy" ON public.homepage_specials;
    DROP POLICY IF EXISTS "Allow public all access" ON public.homepage_specials;
    CREATE POLICY "Allow public all access" ON public.homepage_specials FOR ALL TO public USING (true) WITH CHECK (true);

    -- homepage_offers
    DROP POLICY IF EXISTS "Tenant Isolation Policy" ON public.homepage_offers;
    DROP POLICY IF EXISTS "Allow public all access" ON public.homepage_offers;
    CREATE POLICY "Allow public all access" ON public.homepage_offers FOR ALL TO public USING (true) WITH CHECK (true);

    -- category_buttons
    DROP POLICY IF EXISTS "Tenant Isolation Policy" ON public.category_buttons;
    DROP POLICY IF EXISTS "Allow public all access" ON public.category_buttons;
    CREATE POLICY "Allow public all access" ON public.category_buttons FOR ALL TO public USING (true) WITH CHECK (true);

    -- quick_actions
    DROP POLICY IF EXISTS "Tenant Isolation Policy" ON public.quick_actions;
    DROP POLICY IF EXISTS "Allow public all access" ON public.quick_actions;
    CREATE POLICY "Allow public all access" ON public.quick_actions FOR ALL TO public USING (true) WITH CHECK (true);

    -- theme_settings
    DROP POLICY IF EXISTS "Tenant Isolation Policy" ON public.theme_settings;
    DROP POLICY IF EXISTS "Allow public all access" ON public.theme_settings;
    CREATE POLICY "Allow public all access" ON public.theme_settings FOR ALL TO public USING (true) WITH CHECK (true);

    -- offers
    DROP POLICY IF EXISTS "Tenant Isolation Policy" ON public.offers;
    DROP POLICY IF EXISTS "Allow public all access" ON public.offers;
    CREATE POLICY "Allow public all access" ON public.offers FOR ALL TO public USING (true) WITH CHECK (true);

    -- today_specials
    DROP POLICY IF EXISTS "Tenant Isolation Policy" ON public.today_specials;
    DROP POLICY IF EXISTS "Allow public all access" ON public.today_specials;
    CREATE POLICY "Allow public all access" ON public.today_specials FOR ALL TO public USING (true) WITH CHECK (true);

    -- today_special_items
    DROP POLICY IF EXISTS "Tenant Isolation Policy" ON public.today_special_items;
    DROP POLICY IF EXISTS "Allow public all access" ON public.today_special_items;
    CREATE POLICY "Allow public all access" ON public.today_special_items FOR ALL TO public USING (true) WITH CHECK (true);
END $$;
