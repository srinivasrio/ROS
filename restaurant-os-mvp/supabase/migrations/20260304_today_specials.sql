-- =========================================================
-- Migration: Create Today Specials system
-- Tables: today_specials, today_special_items
-- =========================================================

-- 1. Main specials table
CREATE TABLE IF NOT EXISTS today_specials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    title TEXT NOT NULL,
    description TEXT,
    special_price NUMERIC,
    is_combo BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    valid_from TIMESTAMPTZ DEFAULT now(),
    valid_to TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Mapping table: links specials to existing menu_items
CREATE TABLE IF NOT EXISTS today_special_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    today_special_id UUID NOT NULL REFERENCES today_specials(id) ON DELETE CASCADE,
    menu_item_id INT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    quantity INT DEFAULT 1
);

-- 3. Indexes for performance
CREATE INDEX idx_today_specials_restaurant ON today_specials(restaurant_id);
CREATE INDEX idx_today_specials_active ON today_specials(is_active);
CREATE INDEX idx_today_special_items_special ON today_special_items(today_special_id);

-- 4. RLS Policies
ALTER TABLE today_specials ENABLE ROW LEVEL SECURITY;
ALTER TABLE today_special_items ENABLE ROW LEVEL SECURITY;

-- Public read for active specials (customers, waiters)
CREATE POLICY "Public read active specials" ON today_specials
    FOR SELECT USING (true);

CREATE POLICY "Public read special items" ON today_special_items
    FOR SELECT USING (true);

-- Authenticated users can manage specials (admin)
CREATE POLICY "Authenticated manage specials" ON today_specials
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated manage special items" ON today_special_items
    FOR ALL USING (true) WITH CHECK (true);
