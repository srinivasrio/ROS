-- Close customer table sessions that were left active after their table was
-- cleared or settled (older clear-table code could miss them). A real dining
-- session never lasts 12 hours, so anything older is a leftover that wrongly
-- shows customers "You are already seated at Table N" when they scan a new table.
--
-- Only the customer-to-table binding is released. Orders, payments and tables
-- are not touched. Safe to run more than once.

WITH stale_sessions AS (
    UPDATE public.table_active_sessions
    SET is_active      = false,
        status         = 'CLOSED',
        closed_at      = NOW(),
        closure_reason = 'STALE_SESSION_CLEANUP',
        updated_at     = NOW()
    WHERE is_active = true
      AND created_at < NOW() - INTERVAL '12 hours'
    RETURNING id
)
UPDATE public.table_join_requests AS jr
SET membership_status = 'EXPIRED',
    updated_at        = NOW()
FROM stale_sessions
WHERE jr.session_id = stale_sessions.id
  AND jr.membership_status = 'ACTIVE';
