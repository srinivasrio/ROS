-- Update restaurants_status_check to include full restaurant lifecycle statuses
ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_status_check;
ALTER TABLE public.restaurants ADD CONSTRAINT restaurants_status_check
CHECK ((lower(status) = ANY (ARRAY[
    'pending'::text, 
    'contacted'::text, 
    'onboarding'::text, 
    'verification'::text, 
    'plan_assigned'::text, 
    'approved'::text, 
    'active'::text, 
    'rejected'::text, 
    'suspended'::text, 
    'changes_requested'::text,
    'trial'::text,
    'deactivated'::text,
    'deletion_requested'::text,
    'soft_deleted'::text
])));
