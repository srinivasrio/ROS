-- Migration: Add weekly_off, salary_type, and improve payroll tracking
-- Date: 2026-10-03

-- 1. Add weekly_off and salary_type to employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS weekly_off TEXT DEFAULT 'sunday';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS salary_type TEXT DEFAULT 'monthly';

-- Add CHECK constraint for salary_type
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_salary_type_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_salary_type_check 
    CHECK (salary_type IN ('monthly', 'daily'));

-- 2. Expand attendance status to include 'weekly_off'
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_status_check 
    CHECK (status IN ('present', 'absent', 'half_day', 'leave', 'weekly_off'));

-- 3. Add weekly_off_days and leave_days columns to payroll_items
ALTER TABLE public.payroll_items ADD COLUMN IF NOT EXISTS weekly_off_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_items ADD COLUMN IF NOT EXISTS leave_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_items ADD COLUMN IF NOT EXISTS gross_salary NUMERIC NOT NULL DEFAULT 0;

-- 4. Expand payroll_runs status to include 'calculated'
ALTER TABLE public.payroll_runs DROP CONSTRAINT IF EXISTS payroll_runs_status_check;
ALTER TABLE public.payroll_runs ADD CONSTRAINT payroll_runs_status_check 
    CHECK (status IN ('draft', 'calculated', 'paid'));
