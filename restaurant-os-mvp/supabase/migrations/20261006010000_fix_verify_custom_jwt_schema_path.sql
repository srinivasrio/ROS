-- Migration: 20261006010000_fix_verify_custom_jwt_schema_path.sql
-- Fix verify_custom_jwt to explicitly use extensions.hmac and set search_path = public, extensions.
-- This ensures HMAC computation succeeds in SECURITY DEFINER context under PostgREST.

CREATE OR REPLACE FUNCTION public.verify_custom_jwt(jwt_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    parts text[];
    secret text;
    computed_sig bytea;
    client_sig_bytes bytea;
    payload_text text;
    payload_json json;
BEGIN
    parts := string_to_array(jwt_token, '.');
    IF array_length(parts, 1) <> 3 THEN
        RETURN null;
    END IF;

    -- Retrieve secret: prefer jwt_secret, fallback to tenant_secret
    secret := public.get_vault_setting('jwt_secret');
    IF secret IS NULL OR secret = '' THEN
        secret := public.get_vault_setting('tenant_secret');
    END IF;
    IF secret IS NULL OR secret = '' THEN
        RETURN null;
    END IF;

    BEGIN
        client_sig_bytes := public.base64url_decode_bytes(parts[3]);
        computed_sig := extensions.hmac(parts[1] || '.' || parts[2], secret, 'sha256');
    EXCEPTION WHEN OTHERS THEN
        RETURN null;
    END;

    IF client_sig_bytes <> computed_sig THEN
        -- Also check tenant_secret if different
        DECLARE
            alt_secret text := public.get_vault_setting('tenant_secret');
        BEGIN
            IF alt_secret IS NOT NULL AND alt_secret <> '' AND alt_secret <> secret THEN
                IF client_sig_bytes <> extensions.hmac(parts[1] || '.' || parts[2], alt_secret, 'sha256') THEN
                    RETURN null;
                END IF;
            ELSE
                RETURN null;
            END IF;
        END;
    END IF;

    BEGIN
        payload_text := public.base64url_decode(parts[2]);
        payload_json := payload_text::json;
    EXCEPTION WHEN OTHERS THEN
        RETURN null;
    END;

    IF payload_json->>'exp' IS NOT NULL THEN
        IF (payload_json->>'exp')::bigint < extract(epoch from now())::bigint THEN
            RETURN null;
        END IF;
    END IF;

    RETURN payload_json;
END;
$$;
