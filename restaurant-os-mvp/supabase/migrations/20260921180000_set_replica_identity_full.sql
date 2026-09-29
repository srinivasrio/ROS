-- Enable REPLICA IDENTITY FULL on all tables used in Supabase Realtime publications.
-- This ensures Postgres records the old values of all columns (especially restaurant_id)
-- during DELETE and UPDATE events in the logical replication stream (WAL).
-- Without this, DELETE events only include primary keys, causing Supabase Realtime to
-- fail server-side filtering (filter: restaurant_id=eq.X) and broadcast DELETE events across all tenants.

ALTER TABLE public.table_merge_groups REPLICA IDENTITY FULL;
ALTER TABLE public.menu_items REPLICA IDENTITY FULL;
ALTER TABLE public.categories REPLICA IDENTITY FULL;
ALTER TABLE public.sub_categories REPLICA IDENTITY FULL;
ALTER TABLE public.employees REPLICA IDENTITY FULL;
ALTER TABLE public.homepage_banners REPLICA IDENTITY FULL;
ALTER TABLE public.homepage_categories REPLICA IDENTITY FULL;
ALTER TABLE public.homepage_services REPLICA IDENTITY FULL;
ALTER TABLE public.homepage_specials REPLICA IDENTITY FULL;
ALTER TABLE public.homepage_sections REPLICA IDENTITY FULL;
ALTER TABLE public.section_style_settings REPLICA IDENTITY FULL;
ALTER TABLE public.offers REPLICA IDENTITY FULL;
ALTER TABLE public.service_options REPLICA IDENTITY FULL;
ALTER TABLE public.staff_tasks REPLICA IDENTITY FULL;
ALTER TABLE public.restaurant_profile REPLICA IDENTITY FULL;
ALTER TABLE public.restaurant_theme REPLICA IDENTITY FULL;
