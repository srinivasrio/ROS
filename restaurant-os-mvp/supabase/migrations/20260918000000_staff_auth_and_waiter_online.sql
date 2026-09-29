-- Migration: Add is_online column to employees, update availability check constraint, and update staff view

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS staff_availability_status_check;
ALTER TABLE public.employees ADD CONSTRAINT staff_availability_status_check 
  CHECK (availability_status = ANY (ARRAY['available'::text, 'busy'::text, 'break'::text, 'online'::text, 'offline'::text]));

CREATE OR REPLACE VIEW public.staff AS 
  SELECT id, name, role, mobile, pin, status, created_at, restaurant_id, address, aadhaar_id, id_document_url, joining_date, availability_status, last_assigned_at, active_orders_count, active_tables_count, user_id, active_workload, branch_id, employee_id, monthly_salary, per_day_salary, overtime_per_hour, updated_at, avatar_url, is_online 
  FROM public.employees 
  WHERE is_deleted = false;
