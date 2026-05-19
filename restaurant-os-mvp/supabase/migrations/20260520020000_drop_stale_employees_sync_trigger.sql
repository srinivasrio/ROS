-- Migration: Drop stale employees sync trigger and function
-- Date: 2026-05-20

-- Drop the trigger from the public.staff table
DROP TRIGGER IF EXISTS trg_sync_staff_to_employees ON public.staff;

-- Drop the associated trigger function
DROP FUNCTION IF EXISTS public.sync_staff_to_employees();
