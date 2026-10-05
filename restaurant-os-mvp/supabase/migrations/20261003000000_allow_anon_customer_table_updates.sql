-- Migration: Allow anon customer presence and table updates with branch isolation
-- Fixes RLS violation when customer requests bill, scans table, or updates customer presence.

ALTER POLICY "Tables branch isolation policy" ON public.tables
WITH CHECK (
  (auth.role() = 'service_role'::text) 
  OR validate_branch_access(restaurant_id, branch_id)
  OR ((auth.role() = 'anon'::text) AND (restaurant_id IS NOT NULL))
);

ALTER POLICY "Table merge groups branch isolation policy" ON public.table_merge_groups
WITH CHECK (
  (auth.role() = 'service_role'::text) 
  OR validate_branch_access(restaurant_id, branch_id)
  OR ((auth.role() = 'anon'::text) AND (restaurant_id IS NOT NULL))
);
