-- Migration: Cloudflare Durable Objects Realtime Database Triggers
-- Sends mutation events asynchronously via pg_net to Cloudflare Durable Objects /broadcast
-- Replaces expensive Supabase Realtime WebSocket connections with edge-sharded Durable Objects.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA net;

-- Create config table or settings row for Cloudflare Realtime URL and secret
CREATE TABLE IF NOT EXISTS public.system_realtime_config (
    id TEXT PRIMARY KEY DEFAULT 'default',
    endpoint_url TEXT NOT NULL DEFAULT 'https://realtime.dineinone.com/broadcast',
    webhook_secret TEXT NOT NULL DEFAULT 'ros_cf_realtime_secret_p0',
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.system_realtime_config (id, endpoint_url, webhook_secret, is_enabled)
VALUES ('default', 'https://realtime.dineinone.com/broadcast', 'ros_cf_realtime_secret_p0', true)
ON CONFLICT (id) DO NOTHING;

-- Trigger function to asynchronously dispatch events to Cloudflare Durable Objects
CREATE OR REPLACE FUNCTION public.dispatch_to_cloudflare_realtime()
RETURNS TRIGGER AS $$
DECLARE
    v_config RECORD;
    v_record JSONB;
    v_old_record JSONB;
    v_restaurant_id TEXT;
    v_payload JSONB;
BEGIN
    -- Read configuration
    SELECT endpoint_url, webhook_secret, is_enabled INTO v_config
    FROM public.system_realtime_config
    WHERE id = 'default'
    LIMIT 1;

    -- Exit if disabled or unconfigured
    IF v_config.is_enabled IS NOT TRUE OR v_config.endpoint_url IS NULL OR v_config.endpoint_url = '' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Extract record data
    IF TG_OP = 'DELETE' THEN
        v_record := NULL;
        v_old_record := to_jsonb(OLD);
        v_restaurant_id := COALESCE(v_old_record->>'restaurant_id', v_old_record->>'restaurantId');
    ELSIF TG_OP = 'INSERT' THEN
        v_record := to_jsonb(NEW);
        v_old_record := NULL;
        v_restaurant_id := COALESCE(v_record->>'restaurant_id', v_record->>'restaurantId');
    ELSE -- UPDATE
        v_record := to_jsonb(NEW);
        v_old_record := to_jsonb(OLD);
        v_restaurant_id := COALESCE(v_record->>'restaurant_id', v_record->>'restaurantId', v_old_record->>'restaurant_id');
    END IF;

    -- Skip if no restaurant context
    IF v_restaurant_id IS NULL OR v_restaurant_id = '' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Build payload matching standard webhook schema
    v_payload := jsonb_build_object(
        'type', TG_OP,
        'table', TG_TABLE_NAME,
        'schema', TG_TABLE_SCHEMA,
        'restaurant_id', v_restaurant_id,
        'record', v_record,
        'old_record', v_old_record,
        'timestamp', NOW()
    );

    -- Asynchronous non-blocking HTTP POST via pg_net
    PERFORM net.http_post(
        url := v_config.endpoint_url,
        body := v_payload,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', v_config.webhook_secret
        ),
        timeout_milliseconds := 3000
    );

    RETURN COALESCE(NEW, OLD);
EXCEPTION
    WHEN OTHERS THEN
        -- Never abort the database transaction if the external webhook fails
        RAISE WARNING '[dispatch_to_cloudflare_realtime] Error: %', SQLERRM;
        RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers on primary operational tables

-- 1. Orders
DROP TRIGGER IF EXISTS trg_cf_realtime_orders ON public.orders;
CREATE TRIGGER trg_cf_realtime_orders
AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.dispatch_to_cloudflare_realtime();

-- 2. Order Items
DROP TRIGGER IF EXISTS trg_cf_realtime_order_items ON public.order_items;
CREATE TRIGGER trg_cf_realtime_order_items
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.dispatch_to_cloudflare_realtime();

-- 3. Tables
DROP TRIGGER IF EXISTS trg_cf_realtime_tables ON public.tables;
CREATE TRIGGER trg_cf_realtime_tables
AFTER UPDATE ON public.tables
FOR EACH ROW EXECUTE FUNCTION public.dispatch_to_cloudflare_realtime();

-- 4. Service Requests (Call Waiter / Bill Requested)
DROP TRIGGER IF EXISTS trg_cf_realtime_service_requests ON public.service_requests;
CREATE TRIGGER trg_cf_realtime_service_requests
AFTER INSERT OR UPDATE ON public.service_requests
FOR EACH ROW EXECUTE FUNCTION public.dispatch_to_cloudflare_realtime();

-- 5. Table Active Sessions (Session Expiration / Table Cleared)
DROP TRIGGER IF EXISTS trg_cf_realtime_table_active_sessions ON public.table_active_sessions;
CREATE TRIGGER trg_cf_realtime_table_active_sessions
AFTER UPDATE ON public.table_active_sessions
FOR EACH ROW EXECUTE FUNCTION public.dispatch_to_cloudflare_realtime();
