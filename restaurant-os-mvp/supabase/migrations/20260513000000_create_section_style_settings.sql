CREATE TABLE IF NOT EXISTS section_style_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    section_name TEXT NOT NULL,
    card_bg_color TEXT,
    border_color TEXT,
    title_color TEXT,
    subtitle_color TEXT,
    button_color TEXT,
    button_text_color TEXT,
    badge_color TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(restaurant_id, section_name)
);

-- Add RLS policies
ALTER TABLE section_style_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users"
    ON section_style_settings FOR SELECT
    USING (true);

CREATE POLICY "Enable write access for restaurant owners"
    ON section_style_settings FOR ALL
    USING (
        auth.uid() IN (
            SELECT owner_id FROM restaurants WHERE id = section_style_settings.restaurant_id
        )
    );
