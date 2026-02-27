-- Add alert_status column to tables
ALTER TABLE tables 
ADD COLUMN alert_status text DEFAULT null;

-- Add check constraint for valid statuses
ALTER TABLE tables
ADD CONSTRAINT valid_alert_status CHECK (alert_status IN ('call_waiter', 'bill_requested', null));
