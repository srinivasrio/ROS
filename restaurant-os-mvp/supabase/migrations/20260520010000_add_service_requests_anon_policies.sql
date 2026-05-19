-- Migration: Add UPDATE and DELETE policies for anon role on service_requests
-- Date: 2026-05-20

-- Allow anonymous users (like waiters) to update service requests (e.g. change status to accepted or delivered)
CREATE POLICY "Public Update Requests" ON public.service_requests
    FOR UPDATE TO anon
    USING (restaurant_id IS NOT NULL)
    WITH CHECK (restaurant_id IS NOT NULL);

-- Allow anonymous users (like waiters) to delete service requests (e.g. complete them or clear them when a table is cleared)
CREATE POLICY "Public Delete Requests" ON public.service_requests
    FOR DELETE TO anon
    USING (restaurant_id IS NOT NULL);
