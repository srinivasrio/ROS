-- Add quantity column to service_requests
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1 NOT NULL;
