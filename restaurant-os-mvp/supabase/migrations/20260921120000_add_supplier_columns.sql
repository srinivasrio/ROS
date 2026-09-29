-- Add missing supplier contact and directory columns to suppliers table
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS contact_person text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS category text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
