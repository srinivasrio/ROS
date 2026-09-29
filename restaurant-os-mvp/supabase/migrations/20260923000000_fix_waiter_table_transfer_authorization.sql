-- Migration: 20260923000000_fix_waiter_table_transfer_authorization.sql
-- Fix Waiter Table Transfer Authorization Bug:
-- 1. Enforces caller authorization before granting/transferring table access.
-- 2. Completely transfers active uncompleted orders, merge groups, and active service requests to the target waiter.
-- 3. Clears co_waiter_ids on transfer and records the transfer in waiter_assignments.

CREATE OR REPLACE FUNCTION public.grant_table_access(
  p_table_id bigint, 
  p_owner_id text, 
  p_target_waiter_id text, 
  p_grant_type text DEFAULT 'share'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_owner_uuid uuid;
  v_target_uuid uuid;
  v_owner_name text;
  v_target_name text;
  v_current_table RECORD;
  v_current_co_waiters jsonb;
  v_is_privileged boolean := false;
BEGIN
  -- Resolve owner UUID safely
  BEGIN
    v_owner_uuid := p_owner_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    SELECT id INTO v_owner_uuid FROM public.employees WHERE employee_id = p_owner_id OR mobile = p_owner_id LIMIT 1;
  END;

  -- Resolve target UUID safely
  BEGIN
    v_target_uuid := p_target_waiter_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    SELECT id INTO v_target_uuid FROM public.employees WHERE employee_id = p_target_waiter_id OR mobile = p_target_waiter_id LIMIT 1;
  END;

  IF v_target_uuid IS NULL THEN
    RAISE EXCEPTION 'Target waiter not found';
  END IF;

  SELECT name INTO v_owner_name FROM public.employees WHERE id = v_owner_uuid;
  SELECT name INTO v_target_name FROM public.employees WHERE id = v_target_uuid;

  -- Fetch table
  SELECT * INTO v_current_table FROM public.tables WHERE id = p_table_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Table not found';
  END IF;

  -- Verify caller authorization:
  -- Caller must be the assigned_waiter_id OR an admin/supervisor/manager
  IF v_owner_uuid IS NOT NULL THEN
    SELECT (lower(role) IN ('admin', 'supervisor', 'restaurant_admin', 'manager'))
    INTO v_is_privileged
    FROM public.employees
    WHERE id = v_owner_uuid;
  END IF;

  IF v_current_table.assigned_waiter_id IS NOT NULL 
     AND v_current_table.assigned_waiter_id <> v_owner_uuid 
     AND NOT COALESCE(v_is_privileged, false) THEN
    RAISE EXCEPTION 'Unauthorized: You are not assigned to Table % and cannot transfer or grant access to it', v_current_table.table_number;
  END IF;

  IF p_grant_type = 'transfer' THEN
    -- COMPLETE TRANSFER: table ownership moves completely to target waiter
    -- The previous waiter loses all management access
    UPDATE public.tables
    SET assigned_waiter_id = v_target_uuid,
        transferred_from_waiter_id = COALESCE(v_current_table.assigned_waiter_id, v_owner_uuid),
        transferred_to_waiter_id = v_target_uuid,
        co_waiter_ids = '[]'::jsonb,
        last_activity_at = NOW()
    WHERE id = p_table_id 
       OR (v_current_table.merged_group_id IS NOT NULL AND merged_group_id = v_current_table.merged_group_id);

    -- If part of a merge group, update merge group table as well
    IF v_current_table.merged_group_id IS NOT NULL THEN
      UPDATE public.table_merge_groups
      SET assigned_waiter_id = v_target_uuid,
          last_activity_at = NOW()
      WHERE id = v_current_table.merged_group_id;
    END IF;

    -- Update active uncompleted orders to new assigned waiter (both single table and merge group orders)
    UPDATE public.orders
    SET waiter_id = v_target_uuid
    WHERE (table_id = p_table_id OR (v_current_table.merged_group_id IS NOT NULL AND merge_group_id = v_current_table.merged_group_id))
      AND is_completed = false;

    -- TRANSFER ALL PENDING AND ACCEPTED SERVICE REQUESTS TO TARGET WAITER
    UPDATE public.service_requests
    SET assigned_waiter_id = v_target_uuid
    WHERE (table_id = p_table_id OR (v_current_table.merged_group_id IS NOT NULL AND table_id IN (
        SELECT id FROM public.tables WHERE merged_group_id = v_current_table.merged_group_id
    )))
      AND request_status IN ('pending', 'accepted');

    -- Record transfer in waiter_assignments audit log
    BEGIN
      INSERT INTO public.waiter_assignments (
        waiter_id, table_id, merge_group_id, restaurant_id, assigned_at, status
      ) VALUES (
        v_target_uuid, 
        p_table_id, 
        v_current_table.merged_group_id, 
        v_current_table.restaurant_id, 
        NOW(), 
        'transferred'
      );
    EXCEPTION WHEN OTHERS THEN
      -- Silently ignore if table schema differences exist
      NULL;
    END;

    -- Update employees workload counts
    UPDATE public.employees
    SET last_assigned_at = NOW()
    WHERE id = v_target_uuid;

    RETURN jsonb_build_object(
      'success', true,
      'grant_type', 'transfer',
      'table_id', p_table_id,
      'transferred_from_id', COALESCE(v_current_table.assigned_waiter_id, v_owner_uuid),
      'transferred_to_id', v_target_uuid,
      'transferred_from_name', COALESCE(v_owner_name, 'Original Waiter'),
      'transferred_to_name', COALESCE(v_target_name, 'New Waiter'),
      'message', 'Table successfully transferred to ' || COALESCE(v_target_name, 'waiter')
    );

  ELSE
    -- GIVE ACCESS ONLY (SHARE): both waiters can now manage and take orders
    SELECT COALESCE(co_waiter_ids, '[]'::jsonb) INTO v_current_co_waiters
    FROM public.tables
    WHERE id = p_table_id;

    -- Filter out target and owner from co_waiter array to avoid duplicates
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb) INTO v_current_co_waiters
    FROM jsonb_array_elements_text(v_current_co_waiters) elem
    WHERE elem != v_target_uuid::text AND elem != COALESCE(v_current_table.assigned_waiter_id::text, v_owner_uuid::text);

    -- Add target waiter
    v_current_co_waiters := v_current_co_waiters || jsonb_build_array(v_target_uuid::text);

    UPDATE public.tables
    SET assigned_waiter_id = COALESCE(v_current_table.assigned_waiter_id, v_owner_uuid),
        co_waiter_ids = v_current_co_waiters,
        transferred_from_waiter_id = NULL,
        transferred_to_waiter_id = NULL,
        last_activity_at = NOW()
    WHERE id = p_table_id 
       OR (v_current_table.merged_group_id IS NOT NULL AND merged_group_id = v_current_table.merged_group_id);

    IF v_current_table.merged_group_id IS NOT NULL THEN
      UPDATE public.table_merge_groups
      SET assigned_waiter_id = COALESCE(v_current_table.assigned_waiter_id, v_owner_uuid),
          last_activity_at = NOW()
      WHERE id = v_current_table.merged_group_id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'grant_type', 'share',
      'table_id', p_table_id,
      'primary_waiter_name', COALESCE(v_owner_name, 'Waiter'),
      'co_waiter_name', COALESCE(v_target_name, 'Co-Waiter'),
      'message', 'Access granted to ' || COALESCE(v_target_name, 'waiter') || '. Both waiters can now manage this table.'
    );
  END IF;
END;
$function$;
