-- Migration: Customer Table Session Lifecycle Management
-- Implements reliable session creation, retention, expiration, logout, cart recovery, and table closure rules.

-- 1. Add lifecycle columns to table_active_sessions
ALTER TABLE public.table_active_sessions
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS cart_data JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS cart_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS closure_reason VARCHAR(100);

-- Ensure check constraint on status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_table_active_sessions_status'
    ) THEN
        ALTER TABLE public.table_active_sessions
        ADD CONSTRAINT chk_table_active_sessions_status
        CHECK (status IN ('ACTIVE', 'CLOSING', 'CLOSED', 'EXPIRED'));
    END IF;
END $$;

-- Backfill status for existing rows
UPDATE public.table_active_sessions
SET status = 'CLOSED', closed_at = updated_at, closure_reason = 'LEGACY_INACTIVE'
WHERE is_active = false AND status = 'ACTIVE';

-- 2. Add membership_status to table_join_requests
ALTER TABLE public.table_join_requests
ADD COLUMN IF NOT EXISTS membership_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_table_join_requests_membership_status'
    ) THEN
        ALTER TABLE public.table_join_requests
        ADD CONSTRAINT chk_table_join_requests_membership_status
        CHECK (membership_status IN ('ACTIVE', 'INACTIVE', 'EXPIRED'));
    END IF;
END $$;

-- 3. Synchronize is_active and status automatically via trigger
CREATE OR REPLACE FUNCTION public.sync_table_session_status()
RETURNS TRIGGER AS $$
BEGIN
    -- If status was updated
    IF NEW.status = 'ACTIVE' THEN
        NEW.is_active := true;
    ELSIF NEW.status IN ('CLOSED', 'EXPIRED') THEN
        NEW.is_active := false;
        IF NEW.status = 'CLOSED' AND NEW.closed_at IS NULL THEN
            NEW.closed_at := NOW();
        ELSIF NEW.status = 'EXPIRED' AND NEW.expired_at IS NULL THEN
            NEW.expired_at := NOW();
        END IF;
    END IF;

    -- If is_active was updated directly by legacy code
    IF NEW.is_active = false AND NEW.status = 'ACTIVE' THEN
        NEW.status := 'CLOSED';
        IF NEW.closed_at IS NULL THEN
            NEW.closed_at := NOW();
        END IF;
    ELSIF NEW.is_active = true AND NEW.status IN ('CLOSED', 'EXPIRED') THEN
        NEW.status := 'ACTIVE';
        NEW.closed_at := NULL;
        NEW.expired_at := NULL;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_table_session_status ON public.table_active_sessions;
CREATE TRIGGER trg_sync_table_session_status
BEFORE INSERT OR UPDATE OF status, is_active
ON public.table_active_sessions
FOR EACH ROW
EXECUTE FUNCTION public.sync_table_session_status();

-- 4. Update check_table_session_membership to respect membership_status and session status
CREATE OR REPLACE FUNCTION public.check_table_session_membership()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'table_active_sessions' THEN
        IF NEW.is_active = true AND NEW.status = 'ACTIVE' THEN
            -- Check if host is already an approved ACTIVE member of another active session
            IF EXISTS (
                SELECT 1 FROM public.table_join_requests jr
                JOIN public.table_active_sessions s ON s.id = jr.session_id
                WHERE s.restaurant_id = NEW.restaurant_id
                  AND s.id != NEW.id
                  AND s.is_active = true
                  AND s.status = 'ACTIVE'
                  AND jr.requester_customer_mobile = NEW.host_customer_mobile
                  AND jr.status = 'approved'
                  AND jr.membership_status = 'ACTIVE'
            ) THEN
                RAISE EXCEPTION 'Customer % is already an active member of another table session at this restaurant', NEW.host_customer_mobile;
            END IF;
        END IF;
    ELSIF TG_TABLE_NAME = 'table_join_requests' THEN
        -- On approval or active membership, verify they aren't host of another active table or approved active member of another table
        IF NEW.status = 'approved' AND NEW.membership_status = 'ACTIVE' THEN
            -- Check if host of another active session
            IF EXISTS (
                SELECT 1 FROM public.table_active_sessions s
                WHERE s.restaurant_id = NEW.restaurant_id
                  AND s.is_active = true
                  AND s.status = 'ACTIVE'
                  AND s.id != NEW.session_id
                  AND s.host_customer_mobile = NEW.requester_customer_mobile
            ) THEN
                RAISE EXCEPTION 'Customer % is already the host of another active table session at this restaurant', NEW.requester_customer_mobile;
            END IF;

            -- Check if approved active member of another active session
            IF EXISTS (
                SELECT 1 FROM public.table_join_requests jr
                JOIN public.table_active_sessions s ON s.id = jr.session_id
                WHERE s.restaurant_id = NEW.restaurant_id
                  AND s.is_active = true
                  AND s.status = 'ACTIVE'
                  AND s.id != NEW.session_id
                  AND jr.id != NEW.id
                  AND jr.requester_customer_mobile = NEW.requester_customer_mobile
                  AND jr.status = 'approved'
                  AND jr.membership_status = 'ACTIVE'
            ) THEN
                RAISE EXCEPTION 'Customer % is already an approved active member of another table session at this restaurant', NEW.requester_customer_mobile;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. RPC to clean up expired sessions atomically and idempotently
CREATE OR REPLACE FUNCTION public.expire_eligible_table_sessions(p_restaurant_id TEXT DEFAULT NULL)
RETURNS TABLE (
    expired_session_id UUID,
    table_num TEXT,
    rest_id TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH candidate_sessions AS (
        SELECT s.id, s.table_number, s.restaurant_id, s.table_id
        FROM public.table_active_sessions s
        WHERE s.is_active = true
          AND s.status = 'ACTIVE'
          AND (p_restaurant_id IS NULL OR s.restaurant_id = p_restaurant_id)
          -- Session inactivity timeout: last activity > 10 minutes ago
          AND COALESCE(s.last_activity_at, s.created_at) < (NOW() - INTERVAL '10 minutes')
          -- Cart recovery timeout: empty cart OR cart updated > 10 minutes ago
          AND (
              s.cart_data IS NULL 
              OR s.cart_data = '{}'::jsonb 
              OR s.cart_updated_at IS NULL 
              OR s.cart_updated_at < (NOW() - INTERVAL '10 minutes')
          )
          -- No unfinished or active orders
          AND NOT EXISTS (
              SELECT 1 FROM public.orders o
              JOIN public.tables t ON t.id = o.table_id AND t.restaurant_id = o.restaurant_id
              WHERE o.restaurant_id = s.restaurant_id
                AND (
                    t.table_number = s.table_number
                    OR (s.table_id IS NOT NULL AND (t.id::text = s.table_id OR o.table_id::text = s.table_id))
                )
                AND o.is_completed = false
                AND o.status IN ('queued', 'placed', 'preparing', 'ready', 'served')
          )
          -- No unpaid balances
          AND NOT EXISTS (
              SELECT 1 FROM public.orders o
              JOIN public.tables t ON t.id = o.table_id AND t.restaurant_id = o.restaurant_id
              WHERE o.restaurant_id = s.restaurant_id
                AND (
                    t.table_number = s.table_number
                    OR (s.table_id IS NOT NULL AND (t.id::text = s.table_id OR o.table_id::text = s.table_id))
                )
                AND o.is_completed = false
                AND o.status NOT IN ('paid', 'cancelled')
          )
          -- No pending service requests
          AND NOT EXISTS (
              SELECT 1 FROM public.service_requests sr
              WHERE sr.restaurant_id = s.restaurant_id
                AND (
                    (s.table_id IS NOT NULL AND sr.table_id::text = s.table_id)
                    OR sr.table_number = s.table_number
                )
                AND sr.request_status = 'pending'
          )
    ),
    updated_sessions AS (
        UPDATE public.table_active_sessions tas
        SET status = 'EXPIRED',
            is_active = false,
            expired_at = NOW(),
            closure_reason = 'INACTIVITY_TIMEOUT',
            updated_at = NOW()
        FROM candidate_sessions cs
        WHERE tas.id = cs.id
        RETURNING tas.id, tas.table_number, tas.restaurant_id
    )
    SELECT id, table_number, restaurant_id FROM updated_sessions;

    -- Expire membership on joined members for those sessions
    UPDATE public.table_join_requests jr
    SET membership_status = 'EXPIRED',
        updated_at = NOW()
    WHERE jr.session_id IN (
        SELECT id FROM public.table_active_sessions WHERE status = 'EXPIRED' AND is_active = false
    ) AND jr.membership_status = 'ACTIVE';

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.expire_eligible_table_sessions(TEXT) TO anon, authenticated, service_role;
