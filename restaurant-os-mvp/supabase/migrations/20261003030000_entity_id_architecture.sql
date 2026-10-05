-- Migration: 20261003030000_entity_id_architecture.sql
-- Purpose: Implement safe production entity ID architecture with immutable UUIDv7 TypeIDs,
--          E.164 normalized employee phone identity & search, non-sensitive human-readable codes,
--          and 100% backward-compatible database structures.

BEGIN;

-- ============================================================================
-- 1. CORE UUIDv7 AND Crockford Base32 TypeID FUNCTIONS
-- ============================================================================

-- RFC 9562 compliant UUIDv7 generator
CREATE OR REPLACE FUNCTION public.uuidv7()
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_time_ms bigint;
  v_bytes bytea;
  v_rand bytea;
BEGIN
  -- 48-bit unix timestamp in milliseconds
  v_time_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  
  -- 10 cryptographically random bytes
  v_rand := gen_random_bytes(10);
  
  -- Assemble 16 bytes: 6 bytes time + 10 bytes random
  v_bytes := set_byte(
    set_byte(
      set_byte(
        set_byte(
          set_byte(
            set_byte('\x000000000000'::bytea, 0, ((v_time_ms >> 40) & 255)::integer),
            1, ((v_time_ms >> 32) & 255)::integer),
          2, ((v_time_ms >> 24) & 255)::integer),
        3, ((v_time_ms >> 16) & 255)::integer),
      4, ((v_time_ms >> 8) & 255)::integer),
    5, (v_time_ms & 255)::integer
  ) || v_rand;

  -- Set version 7 in high nibble of byte 6 (0x70)
  v_bytes := set_byte(v_bytes, 6, (7 << 4) | (get_byte(v_bytes, 6) & 15));
  
  -- Set variant 10 in high 2 bits of byte 8 (0x80)
  v_bytes := set_byte(v_bytes, 8, (2 << 6) | (get_byte(v_bytes, 8) & 63));
  
  RETURN encode(v_bytes, 'hex')::uuid;
END;
$$;

-- Converts a 128-bit UUID to a 26-character Crockford Base32 TypeID with typed prefix
CREATE OR REPLACE FUNCTION public.uuid_to_typeid(p_prefix text, p_uuid uuid)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_chars text := '0123456789abcdefghjkmnpqrstvwxyz';
  v_bits bit(130);
  v_chunk integer;
  v_res text := '';
  v_i integer;
BEGIN
  IF p_uuid IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2 zero bits prepended to 128 bits of UUID = 130 bits
  v_bits := B'00' || ('x' || replace(p_uuid::text, '-', ''))::bit(128);

  FOR v_i IN 0..25 LOOP
    v_chunk := substring(v_bits from (v_i * 5 + 1) for 5)::integer;
    v_res := v_res || substr(v_chars, v_chunk + 1, 1);
  END LOOP;

  IF p_prefix IS NULL OR p_prefix = '' THEN
    RETURN v_res;
  ELSE
    RETURN p_prefix || '_' || v_res;
  END IF;
END;
$$;

-- Decodes a 26-character Crockford Base32 TypeID back to the exact 128-bit UUID
CREATE OR REPLACE FUNCTION public.typeid_to_uuid(p_typeid text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_chars text := '0123456789abcdefghjkmnpqrstvwxyz';
  v_suffix text;
  v_bits varbit := B'';
  v_char text;
  v_pos integer;
  v_i integer;
  v_hex text := '';
BEGIN
  IF p_typeid IS NULL THEN
    RETURN NULL;
  END IF;

  IF position('_' in p_typeid) > 0 THEN
    v_suffix := lower(split_part(p_typeid, '_', 2));
  ELSE
    v_suffix := lower(p_typeid);
  END IF;

  IF length(v_suffix) <> 26 THEN
    BEGIN
      RETURN p_typeid::uuid;
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
  END IF;

  FOR v_i IN 1..26 LOOP
    v_char := substr(v_suffix, v_i, 1);
    IF v_char = 'o' THEN v_char := '0'; END IF;
    IF v_char = 'i' OR v_char = 'l' THEN v_char := '1'; END IF;
    
    v_pos := position(v_char in v_chars) - 1;
    IF v_pos < 0 THEN
      RETURN NULL;
    END IF;
    v_bits := v_bits || v_pos::bit(5);
  END LOOP;

  -- 130 bits collected; skip first 2 bits -> 128 bits in 32 hex chars
  FOR v_i IN 0..31 LOOP
    v_hex := v_hex || to_hex(substring(v_bits from (3 + v_i * 4) for 4)::integer);
  END LOOP;

  RETURN (
    substr(v_hex, 1, 8) || '-' ||
    substr(v_hex, 9, 4) || '-' ||
    substr(v_hex, 13, 4) || '-' ||
    substr(v_hex, 17, 4) || '-' ||
    substr(v_hex, 21, 12)
  )::uuid;
END;
$$;

-- Generates a fresh TypeID with a prefix using a freshly generated UUIDv7
CREATE OR REPLACE FUNCTION public.gen_typeid(p_prefix text)
RETURNS text
LANGUAGE sql
AS $$
  SELECT public.uuid_to_typeid(p_prefix, public.uuidv7());
$$;

-- Normalizes any phone number into strict E.164 format
CREATE OR REPLACE FUNCTION public.normalize_phone_e164(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_clean text;
  v_digits text;
BEGIN
  IF p_phone IS NULL OR trim(p_phone) = '' THEN
    RETURN NULL;
  END IF;

  v_clean := trim(p_phone);
  v_digits := regexp_replace(v_clean, '[^0-9]', '', 'g');

  IF length(v_digits) = 0 THEN
    RETURN NULL;
  END IF;

  -- 10-digit Indian number (starts with 6, 7, 8, 9)
  IF length(v_digits) = 10 AND substring(v_digits from 1 for 1) IN ('6', '7', '8', '9') THEN
    RETURN '+91' || v_digits;
  END IF;

  -- 11 digits starting with 0
  IF length(v_digits) = 11 AND substring(v_digits from 1 for 1) = '0' THEN
    RETURN '+91' || substring(v_digits from 2);
  END IF;

  -- 12 digits starting with 91
  IF length(v_digits) = 12 AND substring(v_digits from 1 for 2) = '91' THEN
    RETURN '+' || v_digits;
  END IF;

  -- If original started with +, prefix with +
  IF substring(v_clean from 1 for 1) = '+' THEN
    RETURN '+' || v_digits;
  END IF;

  IF length(v_digits) = 10 THEN
    RETURN '+91' || v_digits;
  END IF;

  RETURN '+' || v_digits;
END;
$$;

-- ============================================================================
-- 2. EMPLOYEES: INTERNAL UUIDv7, E.164 NORMALIZED PHONE, DISPLAY CODE & LEGACY
-- ============================================================================

-- Add new columns safely
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS internal_id TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS legacy_reference TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS phone_normalized TEXT;

-- Sequence for human-readable EMP-xxxx codes
CREATE SEQUENCE IF NOT EXISTS public.employee_code_seq START WITH 1;

-- Backfill existing employees:
-- 1. internal_id: maps existing employee UUID deterministically to usr_01K6...
UPDATE public.employees
SET internal_id = public.uuid_to_typeid('usr', id)
WHERE internal_id IS NULL;

-- 2. legacy_reference: preserves legacy identifiers (DIO9153001, OWN-816084, 100001, etc.)
UPDATE public.employees
SET legacy_reference = employee_id
WHERE legacy_reference IS NULL AND employee_id IS NOT NULL;

-- 3. phone_normalized: normalizes mobile numbers to E.164 (+91...)
UPDATE public.employees
SET phone_normalized = public.normalize_phone_e164(mobile)
WHERE phone_normalized IS NULL AND mobile IS NOT NULL;

-- 4. employee_code: assign sequential human-readable codes EMP-0001, EMP-0002...
DO $$
DECLARE
  rec RECORD;
  v_num integer := 1;
BEGIN
  FOR rec IN (
    SELECT id FROM public.employees 
    ORDER BY created_at ASC NULLS LAST, id ASC
  ) LOOP
    UPDATE public.employees 
    SET employee_code = 'EMP-' || lpad(v_num::text, 4, '0')
    WHERE id = rec.id AND (employee_code IS NULL OR employee_code = '' OR employee_code NOT LIKE 'EMP-%');
    v_num := v_num + 1;
  END LOOP;
  -- Set sequence past existing records
  PERFORM setval('public.employee_code_seq', GREATEST(v_num, 100));
END $$;

-- Set column constraints & defaults
ALTER TABLE public.employees ALTER COLUMN internal_id SET DEFAULT public.gen_typeid('usr');
ALTER TABLE public.employees ALTER COLUMN internal_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_internal_id ON public.employees (internal_id);
CREATE INDEX IF NOT EXISTS idx_employees_phone_normalized ON public.employees (phone_normalized);
CREATE INDEX IF NOT EXISTS idx_employees_employee_code ON public.employees (employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_legacy_reference ON public.employees (legacy_reference);

-- Employee identity sync trigger: ensures any new insert or update populates internal_id, phone_normalized, and code
CREATE OR REPLACE FUNCTION public.fn_sync_employee_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Generate internal_id if missing
  IF NEW.internal_id IS NULL THEN
    IF NEW.id IS NOT NULL THEN
      NEW.internal_id := public.uuid_to_typeid('usr', NEW.id);
    ELSE
      NEW.internal_id := public.gen_typeid('usr');
    END IF;
  END IF;

  -- Preserve legacy identifier
  IF NEW.legacy_reference IS NULL AND NEW.employee_id IS NOT NULL THEN
    NEW.legacy_reference := NEW.employee_id;
  END IF;

  -- Ensure clean human-readable code
  IF NEW.employee_code IS NULL OR NEW.employee_code = '' THEN
    NEW.employee_code := 'EMP-' || lpad(nextval('public.employee_code_seq')::text, 4, '0');
  END IF;

  -- Normalize phone
  IF NEW.mobile IS NOT NULL THEN
    NEW.phone_normalized := public.normalize_phone_e164(NEW.mobile);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employees_identity_sync ON public.employees;
CREATE TRIGGER trg_employees_identity_sync
BEFORE INSERT OR UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_employee_identity();

-- ============================================================================
-- 3. ENTITY INTERNAL UUIDv7 TypeIDs (ALL TARGET ENTITIES)
-- ============================================================================

-- 3.1 RESTAURANTS (rst_01K6...)
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS internal_id TEXT;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS restaurant_code TEXT;
UPDATE public.restaurants SET internal_id = public.gen_typeid('rst') WHERE internal_id IS NULL;
UPDATE public.restaurants SET restaurant_code = id WHERE restaurant_code IS NULL;
ALTER TABLE public.restaurants ALTER COLUMN internal_id SET DEFAULT public.gen_typeid('rst');
ALTER TABLE public.restaurants ALTER COLUMN internal_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurants_internal_id ON public.restaurants (internal_id);

-- 3.2 BRANCHES (brn_01K6...)
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS internal_id TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS branch_code TEXT;
UPDATE public.branches SET internal_id = public.gen_typeid('brn') WHERE internal_id IS NULL;
UPDATE public.branches SET branch_code = COALESCE(code, id) WHERE branch_code IS NULL;
ALTER TABLE public.branches ALTER COLUMN internal_id SET DEFAULT public.gen_typeid('brn');
ALTER TABLE public.branches ALTER COLUMN internal_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_internal_id ON public.branches (internal_id);

-- 3.3 TABLES (tbl_01K6...)
ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS internal_id TEXT;
UPDATE public.tables SET internal_id = public.gen_typeid('tbl') WHERE internal_id IS NULL;
ALTER TABLE public.tables ALTER COLUMN internal_id SET DEFAULT public.gen_typeid('tbl');
ALTER TABLE public.tables ALTER COLUMN internal_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tables_internal_id ON public.tables (internal_id);

-- 3.4 CATEGORIES (cat_01K6...)
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS internal_id TEXT;
UPDATE public.categories SET internal_id = public.gen_typeid('cat') WHERE internal_id IS NULL;
ALTER TABLE public.categories ALTER COLUMN internal_id SET DEFAULT public.gen_typeid('cat');
ALTER TABLE public.categories ALTER COLUMN internal_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_internal_id ON public.categories (internal_id);

-- 3.5 SUB-CATEGORIES (cat_01K6...)
ALTER TABLE public.sub_categories ADD COLUMN IF NOT EXISTS internal_id TEXT;
UPDATE public.sub_categories SET internal_id = public.gen_typeid('cat') WHERE internal_id IS NULL;
ALTER TABLE public.sub_categories ALTER COLUMN internal_id SET DEFAULT public.gen_typeid('cat');
ALTER TABLE public.sub_categories ALTER COLUMN internal_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_categories_internal_id ON public.sub_categories (internal_id);

-- 3.6 MENU ITEMS (itm_01K6...)
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS internal_id TEXT;
UPDATE public.menu_items SET internal_id = public.gen_typeid('itm') WHERE internal_id IS NULL;
ALTER TABLE public.menu_items ALTER COLUMN internal_id SET DEFAULT public.gen_typeid('itm');
ALTER TABLE public.menu_items ALTER COLUMN internal_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_items_internal_id ON public.menu_items (internal_id);

-- 3.7 ORDERS (ord_01K6...)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS internal_id TEXT;
UPDATE public.orders 
SET internal_id = CASE 
  WHEN id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN public.uuid_to_typeid('ord', id::uuid)
  ELSE public.gen_typeid('ord')
END
WHERE internal_id IS NULL;
ALTER TABLE public.orders ALTER COLUMN internal_id SET DEFAULT public.gen_typeid('ord');
ALTER TABLE public.orders ALTER COLUMN internal_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_internal_id ON public.orders (internal_id);

-- 3.8 ORDER ITEMS (oit_01K6...)
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS internal_id TEXT;
UPDATE public.order_items SET internal_id = public.gen_typeid('oit') WHERE internal_id IS NULL;
ALTER TABLE public.order_items ALTER COLUMN internal_id SET DEFAULT public.gen_typeid('oit');
ALTER TABLE public.order_items ALTER COLUMN internal_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_items_internal_id ON public.order_items (internal_id);

-- 3.9 PAYMENTS (pay_01K6...)
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS internal_id TEXT;
UPDATE public.payments SET internal_id = public.uuid_to_typeid('pay', id) WHERE internal_id IS NULL;
ALTER TABLE public.payments ALTER COLUMN internal_id SET DEFAULT public.gen_typeid('pay');
ALTER TABLE public.payments ALTER COLUMN internal_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_internal_id ON public.payments (internal_id);

-- 3.10 INVOICES (inv_01K6...)
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS internal_id TEXT;
UPDATE public.invoices SET internal_id = public.uuid_to_typeid('inv', id) WHERE internal_id IS NULL;
ALTER TABLE public.invoices ALTER COLUMN internal_id SET DEFAULT public.gen_typeid('inv');
ALTER TABLE public.invoices ALTER COLUMN internal_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_internal_id ON public.invoices (internal_id);

-- 3.11 PAYROLL RUNS (prun_01K6...)
ALTER TABLE public.payroll_runs ADD COLUMN IF NOT EXISTS internal_id TEXT;
UPDATE public.payroll_runs SET internal_id = public.uuid_to_typeid('prun', id) WHERE internal_id IS NULL;
ALTER TABLE public.payroll_runs ALTER COLUMN internal_id SET DEFAULT public.gen_typeid('prun');
ALTER TABLE public.payroll_runs ALTER COLUMN internal_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_runs_internal_id ON public.payroll_runs (internal_id);

-- 3.12 PAYROLL ITEMS (plit_01K6...)
ALTER TABLE public.payroll_items ADD COLUMN IF NOT EXISTS internal_id TEXT;
UPDATE public.payroll_items SET internal_id = public.uuid_to_typeid('plit', id) WHERE internal_id IS NULL;
ALTER TABLE public.payroll_items ALTER COLUMN internal_id SET DEFAULT public.gen_typeid('plit');
ALTER TABLE public.payroll_items ALTER COLUMN internal_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_items_internal_id ON public.payroll_items (internal_id);

-- 3.13 ATTENDANCE (att_01K6...)
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS internal_id TEXT;
UPDATE public.attendance SET internal_id = public.uuid_to_typeid('att', id) WHERE internal_id IS NULL;
ALTER TABLE public.attendance ALTER COLUMN internal_id SET DEFAULT public.gen_typeid('att');
ALTER TABLE public.attendance ALTER COLUMN internal_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_internal_id ON public.attendance (internal_id);

-- 3.14 DELIVERY ASSIGNMENTS (del_01K6...)
ALTER TABLE public.delivery_assignments ADD COLUMN IF NOT EXISTS internal_id TEXT;
UPDATE public.delivery_assignments SET internal_id = public.uuid_to_typeid('del', id) WHERE internal_id IS NULL;
ALTER TABLE public.delivery_assignments ALTER COLUMN internal_id SET DEFAULT public.gen_typeid('del');
ALTER TABLE public.delivery_assignments ALTER COLUMN internal_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_assignments_internal_id ON public.delivery_assignments (internal_id);

-- 3.15 REGISTRATION REQUESTS (reg_01K6...)
ALTER TABLE public.restaurant_registration_requests ADD COLUMN IF NOT EXISTS internal_id TEXT;
UPDATE public.restaurant_registration_requests SET internal_id = public.uuid_to_typeid('reg', id) WHERE internal_id IS NULL;
ALTER TABLE public.restaurant_registration_requests ALTER COLUMN internal_id SET DEFAULT public.gen_typeid('reg');
ALTER TABLE public.restaurant_registration_requests ALTER COLUMN internal_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_requests_internal_id ON public.restaurant_registration_requests (internal_id);

-- 3.16 OFFERS / COUPONS (off_01K6... / cpn_01K6...)
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS internal_id TEXT;
UPDATE public.offers SET internal_id = public.uuid_to_typeid('off', id) WHERE internal_id IS NULL;
ALTER TABLE public.offers ALTER COLUMN internal_id SET DEFAULT public.gen_typeid('off');
ALTER TABLE public.offers ALTER COLUMN internal_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_offers_internal_id ON public.offers (internal_id);

-- 3.17 SERVICE REQUESTS (srv_01K6...)
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS internal_id TEXT;
UPDATE public.service_requests SET internal_id = public.gen_typeid('srv') WHERE internal_id IS NULL;
ALTER TABLE public.service_requests ALTER COLUMN internal_id SET DEFAULT public.gen_typeid('srv');
ALTER TABLE public.service_requests ALTER COLUMN internal_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_requests_internal_id ON public.service_requests (internal_id);

-- 3.18 NOTIFICATIONS (ntf_01K6...)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS internal_id TEXT;
UPDATE public.notifications SET internal_id = public.uuid_to_typeid('ntf', id) WHERE internal_id IS NULL;
ALTER TABLE public.notifications ALTER COLUMN internal_id SET DEFAULT public.gen_typeid('ntf');
ALTER TABLE public.notifications ALTER COLUMN internal_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_internal_id ON public.notifications (internal_id);

-- 3.19 SUBSCRIPTIONS (sub_01K6...)
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS internal_id TEXT;
UPDATE public.subscriptions SET internal_id = public.uuid_to_typeid('sub', id) WHERE internal_id IS NULL;
ALTER TABLE public.subscriptions ALTER COLUMN internal_id SET DEFAULT public.gen_typeid('sub');
ALTER TABLE public.subscriptions ALTER COLUMN internal_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_internal_id ON public.subscriptions (internal_id);

-- 3.20 AUDIT LOGS (aud_01K6...)
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS internal_id TEXT;
UPDATE public.audit_logs SET internal_id = public.uuid_to_typeid('aud', id) WHERE internal_id IS NULL;
ALTER TABLE public.audit_logs ALTER COLUMN internal_id SET DEFAULT public.gen_typeid('aud');
ALTER TABLE public.audit_logs ALTER COLUMN internal_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_logs_internal_id ON public.audit_logs (internal_id);

-- ============================================================================
-- 4. BIDIRECTIONAL ENTITY RESOLUTION HELPER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.resolve_entity(p_entity text, p_identifier text)
RETURNS TABLE (
  primary_id text,
  internal_id text,
  display_code text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF p_entity = 'employee' THEN
    RETURN QUERY
    SELECT e.id::text, e.internal_id, e.employee_code
    FROM public.employees e
    WHERE e.internal_id = p_identifier
       OR e.id::text = p_identifier
       OR e.mobile = p_identifier
       OR e.phone_normalized = p_identifier
       OR e.employee_code = p_identifier
       OR e.employee_id = p_identifier
    LIMIT 1;

  ELSIF p_entity = 'restaurant' THEN
    RETURN QUERY
    SELECT r.id, r.internal_id, r.name
    FROM public.restaurants r
    WHERE r.internal_id = p_identifier
       OR r.id = p_identifier
       OR r.restaurant_code = p_identifier
    LIMIT 1;

  ELSIF p_entity = 'branch' THEN
    RETURN QUERY
    SELECT b.id, b.internal_id, b.branch_code
    FROM public.branches b
    WHERE b.internal_id = p_identifier
       OR b.id = p_identifier
       OR b.branch_code = p_identifier
    LIMIT 1;

  ELSIF p_entity = 'table' THEN
    RETURN QUERY
    SELECT t.id::text, t.internal_id, t.table_number
    FROM public.tables t
    WHERE t.internal_id = p_identifier
       OR t.id::text = p_identifier
    LIMIT 1;

  ELSIF p_entity = 'order' THEN
    RETURN QUERY
    SELECT o.id, o.internal_id, o.order_number::text
    FROM public.orders o
    WHERE o.internal_id = p_identifier
       OR o.id = p_identifier
       OR o.order_number::text = p_identifier
    LIMIT 1;

  ELSIF p_entity = 'invoice' THEN
    RETURN QUERY
    SELECT i.id::text, i.internal_id, i.invoice_number
    FROM public.invoices i
    WHERE i.internal_id = p_identifier
       OR i.id::text = p_identifier
       OR i.invoice_number = p_identifier
    LIMIT 1;

  END IF;
END;
$$;

-- Record audit of migration
INSERT INTO public.audit_logs (
  id, action, details, created_at
) VALUES (
  gen_random_uuid(),
  'migration_entity_id_architecture',
  jsonb_build_object(
    'version', '20261003030000',
    'status', 'completed',
    'entities_migrated', jsonb_build_array(
      'employees', 'restaurants', 'branches', 'tables', 'categories',
      'sub_categories', 'menu_items', 'orders', 'order_items', 'payments',
      'invoices', 'payroll_runs', 'payroll_items', 'attendance',
      'delivery_assignments', 'restaurant_registration_requests', 'offers',
      'service_requests', 'notifications', 'subscriptions', 'audit_logs'
    )
  ),
  now()
);

COMMIT;
