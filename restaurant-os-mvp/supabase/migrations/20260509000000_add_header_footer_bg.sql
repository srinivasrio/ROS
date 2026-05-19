ALTER TABLE public.theme_settings
ADD COLUMN IF NOT EXISTS header_bg TEXT,
ADD COLUMN IF NOT EXISTS footer_bg TEXT;
