-- Create the restaurant_profile table to hold meta info
CREATE TABLE IF NOT EXISTS public.restaurant_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    name TEXT NOT NULL DEFAULT 'My Restaurant',
    meta_info JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(restaurant_id)
);

-- Enable RLS
ALTER TABLE public.restaurant_profile ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public Access" ON public.restaurant_profile;
DROP POLICY IF EXISTS "Admin All operations" ON public.restaurant_profile;

-- Public read access
CREATE POLICY "Public Access" ON public.restaurant_profile FOR SELECT USING (true);

-- Admin full access
CREATE POLICY "Admin All operations" ON public.restaurant_profile FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.staff 
        WHERE staff.id = auth.uid() AND staff.role = 'Admin'
    )
);

-- Seed default restaurant profile
INSERT INTO public.restaurant_profile (restaurant_id, name, meta_info)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'Main Branch',
    '{
        "facilities": {
            "parking": false,
            "ac_available": false,
            "wifi_available": false,
            "pet_friendly": false,
            "wheelchair_accessible": false
        },
        "services": {
            "catering": false,
            "private_party": false,
            "birthday_setup": false,
            "home_delivery": false
        },
        "payment_methods": {
            "cash": true,
            "upi": true,
            "card": true
        },
        "cuisine": [],
        "policies": {
            "outside_food_allowed": false,
            "smoking_zone": false
        },
        "custom_categories": []
    }'::jsonb
)
ON CONFLICT (restaurant_id) DO UPDATE 
SET meta_info = public.restaurant_profile.meta_info; -- Keep existing meta_info if already exists
