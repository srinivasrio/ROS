-- Migration: Restaurant Branch Approval Lifecycle and Authentication Consistency
-- Date: 2026-10-03
-- Description:
--   1. Reconciles existing orphaned registration requests, branches, and admin accounts.
--   2. Enforces valid state transitions: PENDING_APPROVAL -> APPROVED/REJECTED; APPROVED -> ACTIVE; ACTIVE -> DELETED.
--   3. Provides atomic stored procedures for approval, rejection, and branch deletion.

-- Step 1: Reconcile existing orphaned registration requests for deactivated/deleted restaurants
UPDATE public.restaurant_registration_requests req
SET 
    approval_status = 'CANCELLED',
    rejection_reason = 'Restaurant deactivated or deleted prior to lifecycle hardening',
    updated_at = now()
FROM public.restaurants r
WHERE req.restaurant_id = r.id
  AND (r.deleted_at IS NOT NULL OR lower(r.status) IN ('deactivated', 'deleted', 'cancelled', 'soft_deleted'))
  AND upper(req.approval_status) IN ('PENDING_APPROVAL', 'PENDING_PAYMENT');

-- Step 2: Ensure branches for pending restaurants are marked as pending_approval (never active before Super Admin approval)
UPDATE public.branches b
SET 
    status = 'pending_approval',
    updated_at = now()
FROM public.restaurants r
WHERE b.restaurant_id = r.id
  AND lower(r.status) IN ('pending', 'pending_approval', 'pending_payment')
  AND lower(b.status) = 'active';

-- Step 3: Ensure branches for deactivated restaurants are marked as inactive
UPDATE public.branches b
SET 
    status = 'inactive',
    deleted_at = COALESCE(b.deleted_at, r.deleted_at, now()),
    updated_at = now()
FROM public.restaurants r
WHERE b.restaurant_id = r.id
  AND (r.deleted_at IS NOT NULL OR lower(r.status) IN ('deactivated', 'deleted', 'cancelled', 'soft_deleted'))
  AND lower(b.status) != 'inactive';

-- Step 4: Ensure restaurant admins for pending restaurants are marked as pending
UPDATE public.employees e
SET 
    status = 'pending',
    approval_status = 'pending',
    updated_at = now()
FROM public.restaurants r
WHERE e.restaurant_id = r.id
  AND e.role IN ('restaurant_admin', 'admin')
  AND lower(r.status) IN ('pending', 'pending_approval', 'pending_payment')
  AND e.status = 'active';

-- Step 5: Add check constraints for branches.status and registration_requests.approval_status
ALTER TABLE public.branches DROP CONSTRAINT IF EXISTS branches_status_check;
ALTER TABLE public.branches ADD CONSTRAINT branches_status_check
CHECK ((lower(status) = ANY (ARRAY[
    'pending'::text, 
    'pending_approval'::text, 
    'active'::text, 
    'inactive'::text, 
    'deleted'::text
])));

ALTER TABLE public.restaurant_registration_requests DROP CONSTRAINT IF EXISTS reg_requests_approval_status_check;
ALTER TABLE public.restaurant_registration_requests ADD CONSTRAINT reg_requests_approval_status_check
CHECK ((upper(approval_status) = ANY (ARRAY[
    'PENDING_APPROVAL'::text, 
    'PENDING_PAYMENT'::text, 
    'APPROVED'::text, 
    'ACTIVE'::text, 
    'REJECTED'::text, 
    'CANCELLED'::text, 
    'DELETED'::text
])));

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check
CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'trialing'::text, 'past_due'::text, 'canceled'::text, 'cancelled'::text, 'expired'::text]));


-- Step 6: Single Atomic Approval Stored Procedure
CREATE OR REPLACE FUNCTION public.approve_restaurant_registration(
    p_request_id UUID,
    p_plan_slug TEXT DEFAULT NULL,
    p_custom_quota INT DEFAULT NULL,
    p_amount_due NUMERIC DEFAULT NULL,
    p_approved_by TEXT DEFAULT 'Super Admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_req RECORD;
    v_plan_slug TEXT;
    v_plan_name TEXT;
    v_plan_limit INT;
    v_effective_limit INT;
    v_amount NUMERIC;
    v_now TIMESTAMPTZ := now();
    v_period_end TIMESTAMPTZ := now() + INTERVAL '30 days';
BEGIN
    -- 1. Fetch registration request with row lock
    SELECT * INTO v_req
    FROM public.restaurant_registration_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registration request % not found', p_request_id;
    END IF;

    -- 2. State Validation: Prevent duplicate or invalid approvals
    IF upper(v_req.approval_status) IN ('APPROVED', 'ACTIVE') THEN
        RAISE EXCEPTION 'DUPLICATE_APPROVAL: Registration request % has already been approved', p_request_id;
    END IF;

    IF upper(v_req.approval_status) IN ('REJECTED', 'CANCELLED', 'DELETED') THEN
        RAISE EXCEPTION 'INVALID_TRANSITION: Cannot approve a registration request in status %', v_req.approval_status;
    END IF;

    -- 3. Resolve plan attributes
    v_plan_slug := lower(trim(COALESCE(p_plan_slug, v_req.plan_slug, 'standard')));
    IF v_plan_slug = 'starter' THEN
        v_plan_name := 'Starter';
        v_plan_limit := 1;
    ELSIF v_plan_slug = 'pro' THEN
        v_plan_name := 'Pro';
        v_plan_limit := 5;
    ELSIF v_plan_slug = 'enterprise' THEN
        v_plan_name := 'Enterprise';
        v_plan_limit := 20;
    ELSIF v_plan_slug = 'trial-14' THEN
        v_plan_name := '14-Day Free Trial';
        v_plan_limit := 1;
    ELSE
        v_plan_name := 'Standard';
        v_plan_limit := 1;
    END IF;

    IF p_custom_quota IS NOT NULL AND p_custom_quota > 0 THEN
        v_effective_limit := p_custom_quota;
    ELSIF v_req.custom_quota IS NOT NULL AND v_req.custom_quota > 0 THEN
        v_effective_limit := v_req.custom_quota;
    ELSE
        v_effective_limit := v_plan_limit;
    END IF;

    v_amount := COALESCE(p_amount_due, v_req.amount_due, 999.00);

    -- 4. Atomic Updates:
    -- A. Update registration request
    UPDATE public.restaurant_registration_requests
    SET 
        approval_status = 'APPROVED',
        payment_status = 'RECEIVED',
        plan_slug = v_plan_slug,
        plan_name = v_plan_name,
        plan_limit = v_plan_limit,
        custom_quota = CASE WHEN v_effective_limit != v_plan_limit THEN v_effective_limit ELSE NULL END,
        amount_due = v_amount,
        approved_at = v_now,
        approved_by = p_approved_by,
        payment_verified_at = v_now,
        payment_verified_by = p_approved_by,
        updated_at = v_now
    WHERE id = p_request_id;

    -- B. Update Restaurant to ACTIVE
    UPDATE public.restaurants
    SET 
        status = 'ACTIVE',
        subscription_plan = v_plan_name,
        custom_quota = CASE WHEN v_effective_limit != v_plan_limit THEN v_effective_limit ELSE NULL END,
        max_branches = v_effective_limit,
        deleted_at = NULL,
        updated_at = v_now
    WHERE id = v_req.restaurant_id;

    -- C. Update all branches of this restaurant to active
    UPDATE public.branches
    SET 
        status = 'active',
        deleted_at = NULL,
        updated_at = v_now
    WHERE restaurant_id = v_req.restaurant_id;

    -- D. Update owner relation and owner employee
    IF v_req.owner_id IS NOT NULL THEN
        UPDATE public.restaurant_users
        SET 
            status = 'active',
            updated_at = v_now
        WHERE restaurant_id = v_req.restaurant_id 
          AND user_id = v_req.owner_id;

        UPDATE public.employees
        SET 
            status = 'active',
            approval_status = 'approved',
            custom_quota = CASE WHEN v_effective_limit != v_plan_limit THEN v_effective_limit ELSE NULL END,
            max_branches = v_effective_limit,
            restaurant_id = COALESCE(restaurant_id, v_req.restaurant_id),
            updated_at = v_now
        WHERE id = v_req.owner_id;

        UPDATE public.dine_users
        SET 
            status = 'active',
            max_branches = v_effective_limit
        WHERE id = v_req.owner_id;
    END IF;

    -- E. Update Restaurant Admins in employees to active & approved
    UPDATE public.employees
    SET 
        status = 'active',
        approval_status = 'approved',
        is_deleted = false,
        deleted_at = NULL,
        updated_at = v_now
    WHERE restaurant_id = v_req.restaurant_id
      AND role IN ('restaurant_admin', 'admin');

    UPDATE public.dine_users
    SET 
        status = 'active'
    WHERE restaurant_id = v_req.restaurant_id
      AND role IN ('restaurant_admin', 'admin');

    -- F. Upsert Subscription to active without requiring unique constraint
    IF EXISTS (SELECT 1 FROM public.subscriptions WHERE restaurant_id = v_req.restaurant_id) THEN
        UPDATE public.subscriptions
        SET
            plan_name = v_plan_slug,
            plan_type = CASE WHEN v_plan_slug = 'trial-14' THEN 'free_trial' ELSE 'monthly' END,
            status = 'active',
            amount = v_amount,
            max_branches = v_effective_limit,
            max_employees = CASE WHEN v_plan_slug = 'pro' THEN 30 WHEN v_plan_slug = 'enterprise' THEN 100 ELSE 10 END,
            current_period_start = v_now,
            current_period_end = v_period_end,
            updated_at = v_now
        WHERE restaurant_id = v_req.restaurant_id;
    ELSE
        INSERT INTO public.subscriptions (
            restaurant_id,
            plan_name,
            plan_type,
            status,
            amount,
            currency,
            max_branches,
            max_employees,
            current_period_start,
            current_period_end,
            created_at,
            updated_at
        ) VALUES (
            v_req.restaurant_id,
            v_plan_slug,
            CASE WHEN v_plan_slug = 'trial-14' THEN 'free_trial' ELSE 'monthly' END,
            'active',
            v_amount,
            'INR',
            v_effective_limit,
            CASE WHEN v_plan_slug = 'pro' THEN 30 WHEN v_plan_slug = 'enterprise' THEN 100 ELSE 10 END,
            v_now,
            v_period_end,
            v_now,
            v_now
        );
    END IF;

    -- G. Insert Audit Log
    INSERT INTO public.audit_logs (
        restaurant_id,
        action,
        details,
        created_at
    ) VALUES (
        v_req.restaurant_id,
        'super_admin_approve_restaurant_registration',
        jsonb_build_object(
            'request_id', p_request_id,
            'approved_by', p_approved_by,
            'plan_slug', v_plan_slug,
            'effective_limit', v_effective_limit,
            'timestamp', v_now
        ),
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'restaurant_id', v_req.restaurant_id,
        'restaurant_name', v_req.restaurant_name,
        'status', 'ACTIVE',
        'plan_slug', v_plan_slug,
        'effective_limit', v_effective_limit
    );
END;
$$;

-- Step 7: Single Atomic Rejection Stored Procedure
CREATE OR REPLACE FUNCTION public.reject_restaurant_registration(
    p_request_id UUID,
    p_reason TEXT DEFAULT 'Registration request rejected by Super Admin',
    p_rejected_by TEXT DEFAULT 'Super Admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_req RECORD;
    v_now TIMESTAMPTZ := now();
BEGIN
    SELECT * INTO v_req
    FROM public.restaurant_registration_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registration request % not found', p_request_id;
    END IF;

    IF upper(v_req.approval_status) IN ('REJECTED', 'CANCELLED', 'DELETED') THEN
        RAISE EXCEPTION 'DUPLICATE_REJECTION: Request % is already in status %', p_request_id, v_req.approval_status;
    END IF;

    IF upper(v_req.approval_status) IN ('APPROVED', 'ACTIVE') THEN
        RAISE EXCEPTION 'INVALID_TRANSITION: Cannot reject an approved request. Please deactivate or delete the restaurant.';
    END IF;

    -- 1. Update registration request
    UPDATE public.restaurant_registration_requests
    SET 
        approval_status = 'REJECTED',
        rejection_reason = p_reason,
        updated_at = v_now
    WHERE id = p_request_id;

    -- 2. Update restaurant
    UPDATE public.restaurants
    SET 
        status = 'rejected',
        updated_at = v_now
    WHERE id = v_req.restaurant_id;

    -- 3. Update branches
    UPDATE public.branches
    SET 
        status = 'inactive',
        updated_at = v_now
    WHERE restaurant_id = v_req.restaurant_id;

    -- 4. Update subscription
    UPDATE public.subscriptions
    SET 
        status = 'cancelled',
        updated_at = v_now
    WHERE restaurant_id = v_req.restaurant_id;

    -- 5. Revoke sessions for this restaurant's employees
    DELETE FROM public.dine_sessions
    WHERE user_id IN (
        SELECT id FROM public.employees WHERE restaurant_id = v_req.restaurant_id
    );

    -- 6. Update employees to inactive / rejected
    UPDATE public.employees
    SET 
        status = 'inactive',
        approval_status = 'rejected',
        updated_at = v_now
    WHERE restaurant_id = v_req.restaurant_id;

    UPDATE public.dine_users
    SET 
        status = 'inactive'
    WHERE restaurant_id = v_req.restaurant_id;

    -- 7. Audit Log
    INSERT INTO public.audit_logs (
        restaurant_id,
        action,
        details,
        created_at
    ) VALUES (
        v_req.restaurant_id,
        'super_admin_reject_restaurant_registration',
        jsonb_build_object(
            'request_id', p_request_id,
            'rejected_by', p_rejected_by,
            'reason', p_reason,
            'timestamp', v_now
        ),
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'restaurant_id', v_req.restaurant_id,
        'status', 'REJECTED'
    );
END;
$$;

-- Step 8: Single Atomic Branch/Restaurant Deletion Stored Procedure
CREATE OR REPLACE FUNCTION public.delete_restaurant_branch_atomic(
    p_restaurant_id TEXT,
    p_deleted_by TEXT DEFAULT 'Owner',
    p_reason TEXT DEFAULT 'Branch deactivated/deleted'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_rest RECORD;
    v_now TIMESTAMPTZ := now();
    v_admin_ids UUID[];
BEGIN
    SELECT * INTO v_rest
    FROM public.restaurants
    WHERE id = p_restaurant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Restaurant % not found', p_restaurant_id;
    END IF;

    -- 1. Soft-delete restaurant
    UPDATE public.restaurants
    SET 
        status = 'deactivated',
        deleted_at = v_now,
        updated_at = v_now
    WHERE id = p_restaurant_id;

    -- 2. Soft-delete branches
    UPDATE public.branches
    SET 
        status = 'inactive',
        deleted_at = v_now,
        updated_at = v_now
    WHERE restaurant_id = p_restaurant_id;

    -- 3. Delete related registration requests
    DELETE FROM public.restaurant_registration_requests
    WHERE restaurant_id = p_restaurant_id;

    -- 4. Cancel related subscriptions
    UPDATE public.subscriptions
    SET 
        status = 'cancelled',
        updated_at = v_now
    WHERE restaurant_id = p_restaurant_id;

    -- 5. Revoke all active sessions for all employees of this restaurant
    SELECT ARRAY_AGG(id) INTO v_admin_ids
    FROM public.employees
    WHERE restaurant_id = p_restaurant_id;

    IF v_admin_ids IS NOT NULL AND array_length(v_admin_ids, 1) > 0 THEN
        DELETE FROM public.dine_sessions
        WHERE user_id = ANY(v_admin_ids);

        DELETE FROM public.employee_branch_access
        WHERE employee_id = ANY(v_admin_ids);
    END IF;

    -- 6. Deactivate employees and mark is_deleted
    UPDATE public.employees
    SET 
        status = 'inactive',
        approval_status = 'rejected',
        is_deleted = true,
        deleted_at = v_now,
        updated_at = v_now
    WHERE restaurant_id = p_restaurant_id;

    UPDATE public.dine_users
    SET 
        status = 'inactive'
    WHERE restaurant_id = p_restaurant_id;

    -- 7. Deactivate restaurant_users relation
    UPDATE public.restaurant_users
    SET 
        status = 'deactivated',
        updated_at = v_now
    WHERE restaurant_id = p_restaurant_id;

    -- 8. Audit Log
    INSERT INTO public.audit_logs (
        restaurant_id,
        action,
        details,
        created_at
    ) VALUES (
        p_restaurant_id,
        'restaurant_branch_deleted_and_sessions_revoked',
        jsonb_build_object(
            'deleted_by', p_deleted_by,
            'reason', p_reason,
            'revoked_employee_count', COALESCE(array_length(v_admin_ids, 1), 0),
            'timestamp', v_now
        ),
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'restaurant_id', p_restaurant_id,
        'status', 'DEACTIVATED'
    );
END;
$$;

-- 6. Ensure check_restaurant_branch_limit safely handles NULL or 0 max_branches
CREATE OR REPLACE FUNCTION public.check_restaurant_branch_limit()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    current_count INTEGER;
    allowed_limit INTEGER;
BEGIN
    IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL)) THEN
        SELECT GREATEST(
            COALESCE(
                (SELECT NULLIF(s.max_branches, 0)
                 FROM subscriptions s 
                 WHERE s.restaurant_id = NEW.restaurant_id AND s.status IN ('active', 'trialing') 
                 LIMIT 1),
                (SELECT NULLIF(custom_quota, 0) FROM restaurants WHERE id = NEW.restaurant_id),
                (SELECT NULLIF(max_branches, 0) FROM restaurants WHERE id = NEW.restaurant_id),
                1
            ),
            1
        ) INTO allowed_limit;

        SELECT COUNT(*) INTO current_count
        FROM branches
        WHERE restaurant_id = NEW.restaurant_id
          AND deleted_at IS NULL
          AND id != COALESCE(NEW.id, '');

        IF current_count >= allowed_limit THEN
            RAISE EXCEPTION 'Branch limit reached: This restaurant is limited to % branch(es). Current active branches: %', allowed_limit, current_count;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

