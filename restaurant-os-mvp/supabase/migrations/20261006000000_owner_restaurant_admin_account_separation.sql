-- Migration: Strict Separation of Owner and Restaurant Admin Accounts
-- Date: 2026-10-06
-- Description:
-- 1. Updates existing Owner accounts whose role was mistakenly set to restaurant_admin.
-- 2. Enforces case-insensitive email uniqueness on employees table.
-- 3. Adds database trigger to enforce strict separation:
--    - An Owner email can NEVER be created or updated as a Restaurant Admin.
--    - A Restaurant Admin email can NEVER be created or updated as an Owner.
--    - An existing Owner account cannot be changed to Restaurant Admin.
--    - An existing Restaurant Admin account cannot be changed to Owner.
-- 4. Adds database trigger on restaurant_users to enforce role alignment.
-- 5. Adds database trigger on restaurants(owner_id) to forbid Restaurant Admins as owners.
-- 6. Adds check_account_separation function for instant API validation.

-- ============================================================================
-- 1. CLEAN UP EXISTING DATA INCONSISTENCIES
-- ============================================================================

-- Clean up duplicate admin record if exists
DELETE FROM public.employees WHERE id = '0c946c15-14e1-451f-b7e3-c58cc6396121';

-- Update Sunita (OWN-103252, owner of 2 restaurants) to role 'owner'
UPDATE public.employees
SET role = 'owner'
WHERE id = '5e06cf95-fad2-49dc-97ef-da624160afd1' AND lower(role) = 'restaurant_admin';

UPDATE public.users
SET role = 'owner'
WHERE id = '5e06cf95-fad2-49dc-97ef-da624160afd1';

UPDATE public.dine_users
SET role = 'owner'
WHERE id = '5e06cf95-fad2-49dc-97ef-da624160afd1';

-- Ensure Sunita is in restaurant_users as OWNER for her restaurants
INSERT INTO public.restaurant_users (restaurant_id, user_id, role, status)
VALUES 
    ('202616211532', '5e06cf95-fad2-49dc-97ef-da624160afd1', 'OWNER', 'active'),
    ('202698994545', '5e06cf95-fad2-49dc-97ef-da624160afd1', 'OWNER', 'active')
ON CONFLICT (restaurant_id, user_id) 
DO UPDATE SET role = 'OWNER', status = 'active';

-- Update Srinivas Kumar (OWN-005501, pending owner registration) to role 'owner'
UPDATE public.employees
SET role = 'owner'
WHERE id = 'c000e0a2-91ae-4cc5-88eb-3331dc63ec06' AND lower(role) = 'restaurant_admin';

UPDATE public.dine_users
SET role = 'owner'
WHERE id = 'c000e0a2-91ae-4cc5-88eb-3331dc63ec06';

-- Update Srinivas Rio in legacy users table to 'owner' (was restaurant_admin while employees was owner)
UPDATE public.users
SET role = 'owner'
WHERE id = '29774d5c-4bc9-4160-9c6a-3b2c0ef33b10';

-- ============================================================================
-- 2. CASE-INSENSITIVE EMAIL UNIQUE INDEX
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_email_lower_unique
ON public.employees (lower(trim(email)))
WHERE email IS NOT NULL AND trim(email) != '';

-- ============================================================================
-- 3. EMPLOYEES TRIGGER: OWNER & RESTAURANT ADMIN SEPARATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_owner_admin_email_separation()
RETURNS trigger AS $$
DECLARE
    v_clean_email TEXT;
    v_new_role TEXT;
    v_old_role TEXT;
    v_conflict_id UUID;
    v_conflict_role TEXT;
BEGIN
    -- Only check if email is provided
    IF NEW.email IS NOT NULL AND trim(NEW.email) != '' THEN
        v_clean_email := lower(trim(NEW.email));
        v_new_role := lower(trim(COALESCE(NEW.role, '')));
        v_old_role := CASE WHEN TG_OP = 'UPDATE' THEN lower(trim(COALESCE(OLD.role, ''))) ELSE NULL END;

        -- 1. If target role is OWNER (owner / restaurant_owner)
        IF v_new_role IN ('owner', 'restaurant_owner') THEN
            -- Check if trying to convert an existing Restaurant Admin to Owner on the same record
            IF TG_OP = 'UPDATE' AND v_old_role IN ('restaurant_admin', 'admin', 'branch_admin') THEN
                RAISE EXCEPTION 'Email "%" belongs to an existing Restaurant Admin account and cannot be reassigned as a Restaurant Owner.', v_clean_email
                    USING ERRCODE = '23514'; -- check_violation
            END IF;

            -- Check if email is already in use by a Restaurant Admin on any other employee record
            SELECT id, role INTO v_conflict_id, v_conflict_role
            FROM public.employees
            WHERE lower(trim(email)) = v_clean_email
              AND lower(trim(role)) IN ('restaurant_admin', 'admin', 'branch_admin')
              AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
              AND is_deleted = false
            LIMIT 1;

            IF v_conflict_id IS NOT NULL THEN
                RAISE EXCEPTION 'Email "%" is already registered as a Restaurant Admin and cannot be used for an Owner account.', v_clean_email
                    USING ERRCODE = '23505'; -- unique_violation
            END IF;
        END IF;

        -- 2. If target role is RESTAURANT ADMIN (restaurant_admin / admin / branch_admin)
        IF v_new_role IN ('restaurant_admin', 'admin', 'branch_admin') THEN
            -- Check if trying to convert an existing Owner to Restaurant Admin on the same record
            IF TG_OP = 'UPDATE' AND v_old_role IN ('owner', 'restaurant_owner') THEN
                RAISE EXCEPTION 'Email "%" belongs to an existing Restaurant Owner account and cannot be reassigned as a Restaurant Admin.', v_clean_email
                    USING ERRCODE = '23514';
            END IF;

            -- Check if email is already in use by an Owner on any other employee record
            SELECT id, role INTO v_conflict_id, v_conflict_role
            FROM public.employees
            WHERE lower(trim(email)) = v_clean_email
              AND lower(trim(role)) IN ('owner', 'restaurant_owner')
              AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
              AND is_deleted = false
            LIMIT 1;

            IF v_conflict_id IS NOT NULL THEN
                RAISE EXCEPTION 'Email "%" is already registered as a Restaurant Owner and cannot be used for a Restaurant Admin account.', v_clean_email
                    USING ERRCODE = '23505';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_owner_admin_email_separation ON public.employees;
CREATE TRIGGER trg_enforce_owner_admin_email_separation
BEFORE INSERT OR UPDATE OF email, role ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.enforce_owner_admin_email_separation();

-- ============================================================================
-- 4. RESTAURANT_USERS TRIGGER: ROLE SEPARATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_restaurant_users_role_separation()
RETURNS trigger AS $$
DECLARE
    v_emp_role TEXT;
    v_emp_email TEXT;
    v_ru_role TEXT;
BEGIN
    v_ru_role := upper(trim(COALESCE(NEW.role, '')));

    SELECT lower(trim(role)), lower(trim(email)) INTO v_emp_role, v_emp_email
    FROM public.employees
    WHERE id = NEW.user_id;

    IF v_emp_role IS NOT NULL THEN
        -- If assigning role OWNER in restaurant_users, user must NOT be a Restaurant Admin
        IF v_ru_role = 'OWNER' AND v_emp_role IN ('restaurant_admin', 'admin', 'branch_admin') THEN
            RAISE EXCEPTION 'User % (%) is a Restaurant Admin and cannot be assigned as an OWNER in restaurant_users.', NEW.user_id, COALESCE(v_emp_email, '')
                USING ERRCODE = '23514';
        END IF;

        -- If assigning role BRANCH_ADMIN or ADMIN in restaurant_users, user must NOT be an Owner
        IF v_ru_role IN ('BRANCH_ADMIN', 'ADMIN') AND v_emp_role IN ('owner', 'restaurant_owner') THEN
            RAISE EXCEPTION 'User % (%) is a Restaurant Owner and cannot be assigned as an Admin in restaurant_users.', NEW.user_id, COALESCE(v_emp_email, '')
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_restaurant_users_role_separation ON public.restaurant_users;
CREATE TRIGGER trg_enforce_restaurant_users_role_separation
BEFORE INSERT OR UPDATE OF role, user_id ON public.restaurant_users
FOR EACH ROW
EXECUTE FUNCTION public.enforce_restaurant_users_role_separation();

-- ============================================================================
-- 5. RESTAURANTS TRIGGER: OWNER_ID ROLE VALIDATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_restaurant_owner_role()
RETURNS trigger AS $$
DECLARE
    v_emp_role TEXT;
    v_emp_email TEXT;
BEGIN
    IF NEW.owner_id IS NOT NULL THEN
        SELECT lower(trim(role)), lower(trim(email)) INTO v_emp_role, v_emp_email
        FROM public.employees
        WHERE id = NEW.owner_id;

        IF v_emp_role IN ('restaurant_admin', 'admin', 'branch_admin') THEN
            RAISE EXCEPTION 'User % (%) is a Restaurant Admin and cannot be set as owner_id of restaurant %.', NEW.owner_id, COALESCE(v_emp_email, ''), NEW.id
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_restaurant_owner_role ON public.restaurants;
CREATE TRIGGER trg_enforce_restaurant_owner_role
BEFORE INSERT OR UPDATE OF owner_id ON public.restaurants
FOR EACH ROW
EXECUTE FUNCTION public.enforce_restaurant_owner_role();

-- ============================================================================
-- 6. APPLICATION HELPER: check_account_separation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_account_separation(p_email TEXT, p_target_role TEXT)
RETURNS jsonb AS $$
DECLARE
    v_clean_email TEXT;
    v_target TEXT;
    v_existing_emp RECORD;
BEGIN
    v_clean_email := lower(trim(p_email));
    v_target := lower(trim(p_target_role));

    IF v_clean_email IS NULL OR v_clean_email = '' THEN
        RETURN jsonb_build_object('allowed', true);
    END IF;

    SELECT id, role, name INTO v_existing_emp
    FROM public.employees
    WHERE lower(trim(email)) = v_clean_email
      AND is_deleted = false
    LIMIT 1;

    IF v_existing_emp.id IS NULL THEN
        RETURN jsonb_build_object('allowed', true);
    END IF;

    -- Target is owner: cannot allow if existing is admin
    IF v_target IN ('owner', 'restaurant_owner') THEN
        IF lower(trim(v_existing_emp.role)) IN ('restaurant_admin', 'admin', 'branch_admin') THEN
            RETURN jsonb_build_object(
                'allowed', false,
                'conflict', 'restaurant_admin',
                'error', 'This email is already registered as a Restaurant Admin and cannot be used for an Owner account.'
            );
        END IF;
        IF lower(trim(v_existing_emp.role)) IN ('owner', 'restaurant_owner') THEN
            RETURN jsonb_build_object(
                'allowed', false,
                'conflict', 'owner',
                'error', 'An account with this email is already registered as an Owner. Please sign in to the Owner Portal.'
            );
        END IF;
    END IF;

    -- Target is admin: cannot allow if existing is owner
    IF v_target IN ('restaurant_admin', 'admin', 'branch_admin') THEN
        IF lower(trim(v_existing_emp.role)) IN ('owner', 'restaurant_owner') THEN
            RETURN jsonb_build_object(
                'allowed', false,
                'conflict', 'owner',
                'error', 'This email is already registered as a Restaurant Owner and cannot be assigned as a Restaurant Admin.'
            );
        END IF;
        IF lower(trim(v_existing_emp.role)) IN ('restaurant_admin', 'admin', 'branch_admin') THEN
            RETURN jsonb_build_object(
                'allowed', false,
                'conflict', 'restaurant_admin',
                'error', 'An account with this email is already registered as a Restaurant Admin.'
            );
        END IF;
    END IF;

    RETURN jsonb_build_object('allowed', true, 'existing_role', v_existing_emp.role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
