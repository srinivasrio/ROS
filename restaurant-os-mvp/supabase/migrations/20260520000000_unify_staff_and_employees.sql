-- Migration: Unify staff and employees tables
-- Date: 2026-05-20

-- 1. Add payroll/employee columns to public.staff table
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS per_day_salary NUMERIC DEFAULT 0;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS overtime_per_hour NUMERIC DEFAULT 0;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2a. Delete duplicate attendance records for employees that already have attendance marked for staff on the same date
DELETE FROM public.attendance a
WHERE EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.staff s ON e.phone = s.mobile AND e.restaurant_id = s.restaurant_id
    WHERE a.employee_id = e.id AND s.id <> e.id
      AND EXISTS (
          SELECT 1 FROM public.attendance a2
          WHERE a2.employee_id = s.id AND a2.date = a.date
      )
);

-- 2b. Delete duplicate payroll items for employees that already have payroll items for staff in the same run
DELETE FROM public.payroll_items pi
WHERE EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.staff s ON e.phone = s.mobile AND e.restaurant_id = s.restaurant_id
    WHERE pi.employee_id = e.id AND s.id <> e.id
      AND EXISTS (
          SELECT 1 FROM public.payroll_items pi2
          WHERE pi2.employee_id = s.id AND pi2.payroll_run_id = pi.payroll_run_id
      )
);

-- 2c. Update attendance and payroll_items references to map to existing staff IDs if their UUIDs differ but phone numbers match
UPDATE public.attendance a
SET employee_id = s.id
FROM public.employees e
JOIN public.staff s ON e.phone = s.mobile AND e.restaurant_id = s.restaurant_id
WHERE a.employee_id = e.id AND s.id <> e.id;

UPDATE public.payroll_items pi
SET employee_id = s.id
FROM public.employees e
JOIN public.staff s ON e.phone = s.mobile AND e.restaurant_id = s.restaurant_id
WHERE pi.employee_id = e.id AND s.id <> e.id;

-- 3. Copy financial parameters from employees to matching staff records (matching by id or mobile/phone)
UPDATE public.staff s
SET 
    employee_id = e.employee_id,
    monthly_salary = e.monthly_salary,
    per_day_salary = e.per_day_salary,
    overtime_per_hour = e.overtime_per_hour,
    joining_date = COALESCE(s.joining_date, e.joining_date),
    branch_id = COALESCE(s.branch_id, e.branch_id),
    status = COALESCE(s.status, e.status),
    updated_at = NOW()
FROM public.employees e
WHERE s.id = e.id OR (s.mobile = e.phone AND s.restaurant_id = e.restaurant_id);

-- 4. Insert employees that are NOT in the staff table at all
INSERT INTO public.staff (
    id,
    restaurant_id,
    name,
    mobile,
    role,
    branch_id,
    joining_date,
    status,
    employee_id,
    monthly_salary,
    per_day_salary,
    overtime_per_hour,
    created_at,
    updated_at
)
SELECT 
    id,
    restaurant_id,
    name,
    phone,
    role,
    branch_id,
    joining_date,
    status,
    employee_id,
    monthly_salary,
    per_day_salary,
    overtime_per_hour,
    created_at,
    updated_at
FROM public.employees e
WHERE NOT EXISTS (
    SELECT 1 FROM public.staff s 
    WHERE s.id = e.id OR (s.mobile = e.phone AND s.restaurant_id = e.restaurant_id)
);

-- 5. Drop foreign key constraints referencing public.employees
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_employee_id_fkey;
ALTER TABLE public.payroll_items DROP CONSTRAINT IF EXISTS payroll_items_employee_id_fkey;

-- 6. Add new foreign key constraints referencing public.staff
ALTER TABLE public.attendance 
    ADD CONSTRAINT attendance_employee_id_fkey 
    FOREIGN KEY (employee_id) REFERENCES public.staff(id) ON DELETE CASCADE;

ALTER TABLE public.payroll_items 
    ADD CONSTRAINT payroll_items_employee_id_fkey 
    FOREIGN KEY (employee_id) REFERENCES public.staff(id) ON DELETE CASCADE;

-- 7. Drop public.employees and public.salary_structures tables
DROP TABLE IF EXISTS public.employees CASCADE;
DROP TABLE IF EXISTS public.salary_structures CASCADE;
