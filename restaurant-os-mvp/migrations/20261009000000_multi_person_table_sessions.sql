-- Multi-person table sessions and join requests
CREATE TABLE IF NOT EXISTS public.table_active_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    table_id TEXT,
    table_number TEXT NOT NULL,
    table_token TEXT,
    host_customer_id TEXT,
    host_customer_name TEXT NOT NULL,
    host_customer_mobile TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.table_join_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.table_active_sessions(id) ON DELETE CASCADE,
    restaurant_id TEXT NOT NULL,
    table_number TEXT NOT NULL,
    requester_customer_name TEXT NOT NULL,
    requester_customer_mobile TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_active_table_sessions ON public.table_active_sessions (restaurant_id, table_number, is_active);
CREATE INDEX IF NOT EXISTS idx_table_join_requests_status ON public.table_join_requests (session_id, status);

ALTER TABLE public.table_active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read/write table_active_sessions" ON public.table_active_sessions;
CREATE POLICY "Allow anon read/write table_active_sessions" ON public.table_active_sessions FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon read/write table_join_requests" ON public.table_join_requests;
CREATE POLICY "Allow anon read/write table_join_requests" ON public.table_join_requests FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'table_active_sessions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.table_active_sessions;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'table_join_requests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.table_join_requests;
    END IF;
END $$;
