-- Alter foreign key constraint to cascade deletions
ALTER TABLE public.service_assignments
DROP CONSTRAINT IF EXISTS service_assignments_service_request_id_fkey,
ADD CONSTRAINT service_assignments_service_request_id_fkey
    FOREIGN KEY (service_request_id)
    REFERENCES public.service_requests(id)
    ON DELETE CASCADE;

-- Delete any existing service requests that are already 'delivered' or 'resolved'
DELETE FROM public.service_requests
WHERE status IN ('delivered', 'resolved');
