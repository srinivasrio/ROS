/**
 * Mints short-lived Supabase Realtime JWTs (audit DIO-C04 / DIO-H05, option A').
 *
 * Realtime validates the websocket token against the Supabase PROJECT JWT secret,
 * which is a different secret from the app's JWT_SECRET (verified). This module
 * signs with SUPABASE_REALTIME_JWT_SECRET (= the primary stack's JWT secret).
 * Tokens only ever grant the `authenticated` role, and RLS policies on the
 * realtime tables read the tenant/table claims below via auth.jwt().
 *
 * Server-only. Never import from client code.
 */

export const REALTIME_TOKEN_TTL_SECONDS = 15 * 60;

export interface RealtimeClaims {
    sub: string;
    scope: 'staff' | 'customer';
    restaurant_ids: string[];
    table_id?: string;
}

const b64url = (input: string | Uint8Array): string =>
    Buffer.from(input).toString('base64url');

export function isRealtimeTokenConfigured(): boolean {
    return !!process.env.SUPABASE_REALTIME_JWT_SECRET;
}

export async function signRealtimeToken(claims: RealtimeClaims): Promise<{ token: string; expiresAt: number }> {
    const secret = process.env.SUPABASE_REALTIME_JWT_SECRET;
    if (!secret) throw new Error('SUPABASE_REALTIME_JWT_SECRET is not configured');

    const now = Math.floor(Date.now() / 1000);
    const exp = now + REALTIME_TOKEN_TTL_SECONDS;
    // auth.uid() casts `sub` to uuid; existing authenticated policies call it, so a non-uuid sub would error the query.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const payload = {
        aud: 'authenticated',
        role: 'authenticated',
        iat: now,
        exp,
        ...claims,
        sub: UUID_RE.test(claims.sub) ? claims.sub : '00000000-0000-0000-0000-000000000000',
    };

    const signingInput = `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify(payload))}`;
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
    return { token: `${signingInput}.${b64url(new Uint8Array(sig))}`, expiresAt: exp * 1000 };
}
