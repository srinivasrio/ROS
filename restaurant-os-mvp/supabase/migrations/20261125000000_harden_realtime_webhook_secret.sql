-- Migration: Harden Cloudflare Realtime Webhook Secret (P0-2)
-- Drops the insecure column default and revokes any previously seeded default secret
-- so the broadcast endpoint cannot be forged with a repository-known literal.

ALTER TABLE public.system_realtime_config
    ALTER COLUMN webhook_secret DROP DEFAULT;

-- Disable and clear any row still using the legacy placeholder secret
UPDATE public.system_realtime_config
SET webhook_secret = '',
    is_enabled = false,
    updated_at = NOW()
WHERE webhook_secret = 'ros_cf_realtime_secret_p0';

-- Replace trigger function to fail closed when webhook_secret is blank
CREATE OR REPLACE FUNCTION public.dispatch_to_cloudflare_realtime()
RETURNS TRIGGER AS $$
DECLARE
    v_config RECORD;
    v_record JSONB;
    v_old_record JSONB;
    v_restaurant_id TEXT;
    v_payload JSONB;
BEGIN
    SELECT endpoint_url, webhook_secret, is_enabled INTO v_config
    FROM public.system_realtime_config
    WHERE id = 'default'
    LIMIT 1;

    IF v_config.is_enabled IS NOT TRUE
        OR v_config.endpoint_url IS NULL OR v_config.endpoint_url = ''
        OR v_config.webhook_secret IS NULL OR v_config.webhook_secret = '' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    IF TG_OP = 'DELETE' THEN
        v_record := NULL;
        v_old_record := to_jsonb(OLD);
        v_restaurant_id := COALESCE(v_old_record->>'restaurant_id', v_old_record->>'restaurantId');
    ELSIF TG_OP = 'INSERT' THEN
        v_record := to_jsonb(NEW);
        v_old_record := NULL;
        v_restaurant_id := COALESCE(v_record->>'restaurant_id', v_record->>'restaurantId');
    ELSE
        v_record := to_jsonb(NEW);
        v_old_record := to_jsonb(OLD);
        v_restaurant_id := COALESCE(v_record->>'restaurant_id', v_record->>'restaurantId', v_old_record->>'restaurant_id');
    END IF;

    IF v_restaurant_id IS NULL OR v_restaurant_id = '' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    v_payload := jsonb_build_object(
        'type', TG_OP,
        'table', TG_TABLE_NAME,
        'schema', TG_TABLE_SCHEMA,
        'restaurant_id', v_restaurant_id,
        'record', v_record,
        'old_record', v_old_record,
        'timestamp', NOW()
    );

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
        RAISE WARNING '[dispatch_to_cloudflare_realtime] Error: %', SQLERRM;
        RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
