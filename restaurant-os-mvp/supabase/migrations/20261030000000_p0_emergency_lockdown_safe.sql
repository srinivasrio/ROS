-- Migration: 20261030000000_p0_emergency_lockdown_safe.sql
-- P0 EMERGENCY LOCKDOWN — TRANCHE 1 (safe to apply)
--
-- This tranche contains only changes that do NOT alter behaviour for the
-- app's live request path (browser -> PostgREST as the `anon` role carrying
-- an `x-dine-token`, plus the super-admin app using the service role).
--
-- It addresses audit findings DIO-C03 (anon can fetch the JWT signing secret),
-- DIO-C05 (restaurant_staff view exposes employee secrets to anon), and the
-- storage half of DIO-C06 (plaintext PIN/password columns).
--
-- NOTE: This does NOT fix the permissive anon RLS (DIO-C04), the anon-callable
-- admin RPCs (DIO-C07), or drop the plaintext columns. Those require code
-- changes + staging validation and live in the companion STAGING-FIRST file.
-- Rotating JWT_SECRET / vault secrets and bumping session_version is a manual
-- operational step (see the P0 checklist) and is intentionally NOT done here.

BEGIN;

-- 1. DIO-C03: Stop anonymous/authenticated roles from reading the vault.
--    get_vault_setting is only ever meant to be called from inside other
--    SECURITY DEFINER helpers (verify_custom_jwt, validate_tenant), which run
--    as the function owner and are therefore unaffected by this revoke.
REVOKE EXECUTE ON FUNCTION public.get_vault_setting(text) FROM PUBLIC;
DO $$
BEGIN
    BEGIN
        REVOKE EXECUTE ON FUNCTION public.get_vault_setting(text) FROM anon;
    EXCEPTION WHEN undefined_object THEN NULL;
    END;
    BEGIN
        REVOKE EXECUTE ON FUNCTION public.get_vault_setting(text) FROM authenticated;
    EXCEPTION WHEN undefined_object THEN NULL;
    END;
END $$;

-- 2. DIO-C05: The restaurant_staff view is a SELECT * over employees created
--    without security_invoker and granted to anon, exposing pin/raw_pin/
--    raw_password/activation_token/registration_token to the public anon key.
--    Current application code reads `employees` directly and does NOT use this
--    view, so dropping it is safe.
DROP VIEW IF EXISTS public.restaurant_staff;

-- 3. DIO-C06 (storage): clear plaintext credential values now that application
--    code no longer writes them. Login uses the Argon2 hash in `employees.pin`
--    (and the `auth` table), so clearing these does not affect authentication.
--    The columns themselves are dropped in the STAGING-FIRST tranche, after the
--    owner/branches route stops SELECTing them.
UPDATE public.employees
SET raw_pin = NULL
WHERE raw_pin IS NOT NULL;

DO $$
BEGIN
    UPDATE public.employees SET raw_password = NULL WHERE raw_password IS NOT NULL;
EXCEPTION WHEN undefined_column THEN
    -- column may not exist on every environment; ignore
    NULL;
END $$;

COMMIT;
