-- Migration: Enforce Single Active Session & Customer Constraint
-- 1. Ensure requester_customer_id exists
ALTER TABLE public.table_join_requests 
ADD COLUMN IF NOT EXISTS requester_customer_id TEXT;

-- 2. Deactivate older duplicate active sessions for same table
WITH ranked_tables AS (
    SELECT id,
           ROW_NUMBER() OVER(PARTITION BY restaurant_id, table_number ORDER BY created_at DESC) as rn
    FROM public.table_active_sessions
    WHERE is_active = true
)
UPDATE public.table_active_sessions
SET is_active = false, updated_at = NOW()
WHERE id IN (
    SELECT id FROM ranked_tables WHERE rn > 1
);

-- 3. Deactivate older duplicate active sessions for same host
WITH ranked_hosts AS (
    SELECT id,
           ROW_NUMBER() OVER(PARTITION BY restaurant_id, host_customer_mobile ORDER BY created_at DESC) as rn
    FROM public.table_active_sessions
    WHERE is_active = true
)
UPDATE public.table_active_sessions
SET is_active = false, updated_at = NOW()
WHERE id IN (
    SELECT id FROM ranked_hosts WHERE rn > 1
);

-- 4. Create unique partial indices ensuring at most 1 active session per table and per host
DROP INDEX IF EXISTS idx_active_sessions_unique_table;
CREATE UNIQUE INDEX idx_active_sessions_unique_table
ON public.table_active_sessions (restaurant_id, table_number)
WHERE is_active = true;

DROP INDEX IF EXISTS idx_active_sessions_unique_host;
CREATE UNIQUE INDEX idx_active_sessions_unique_host
ON public.table_active_sessions (restaurant_id, host_customer_mobile)
WHERE is_active = true;

-- 5. Prevent duplicate pending join requests
DROP INDEX IF EXISTS idx_unique_active_join_request;
CREATE UNIQUE INDEX idx_unique_active_join_request
ON public.table_join_requests (session_id, requester_customer_mobile)
WHERE status = 'pending';

-- 6. Trigger to enforce single active table membership across tables transactionally
CREATE OR REPLACE FUNCTION public.check_table_session_membership()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'table_active_sessions' THEN
        IF NEW.is_active = true THEN
            -- Check if host is already an approved member of another active session
            IF EXISTS (
                SELECT 1 FROM public.table_join_requests jr
                JOIN public.table_active_sessions s ON s.id = jr.session_id
                WHERE s.restaurant_id = NEW.restaurant_id
                  AND s.id != NEW.id
                  AND s.is_active = true
                  AND jr.requester_customer_mobile = NEW.host_customer_mobile
                  AND jr.status = 'approved'
            ) THEN
                RAISE EXCEPTION 'Customer % is already an active member of another table session at this restaurant', NEW.host_customer_mobile;
            END IF;
        END IF;
    ELSIF TG_TABLE_NAME = 'table_join_requests' THEN
        -- On approval or request, verify they aren't host of another table or approved member of another table
        IF NEW.status = 'approved' THEN
            -- Check if host of another active session
            IF EXISTS (
                SELECT 1 FROM public.table_active_sessions s
                WHERE s.restaurant_id = NEW.restaurant_id
                  AND s.is_active = true
                  AND s.id != NEW.session_id
                  AND s.host_customer_mobile = NEW.requester_customer_mobile
            ) THEN
                RAISE EXCEPTION 'Customer % is already the host of another active table session at this restaurant', NEW.requester_customer_mobile;
            END IF;

            -- Check if approved member of another active session
            IF EXISTS (
                SELECT 1 FROM public.table_join_requests jr
                JOIN public.table_active_sessions s ON s.id = jr.session_id
                WHERE s.restaurant_id = NEW.restaurant_id
                  AND s.is_active = true
                  AND s.id != NEW.session_id
                  AND jr.id != NEW.id
                  AND jr.requester_customer_mobile = NEW.requester_customer_mobile
                  AND jr.status = 'approved'
            ) THEN
                RAISE EXCEPTION 'Customer % is already an approved member of another active table session at this restaurant', NEW.requester_customer_mobile;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_active_session_host ON public.table_active_sessions;
CREATE TRIGGER trg_check_active_session_host
BEFORE INSERT OR UPDATE OF is_active, host_customer_mobile
ON public.table_active_sessions
FOR EACH ROW
EXECUTE FUNCTION public.check_table_session_membership();

DROP TRIGGER IF EXISTS trg_check_join_request_member ON public.table_join_requests;
CREATE TRIGGER trg_check_join_request_member
BEFORE INSERT OR UPDATE OF status, requester_customer_mobile
ON public.table_join_requests
FOR EACH ROW
EXECUTE FUNCTION public.check_table_session_membership();
