export interface SocketAttachment {
    role: string;
    tableNumber: string | null;
    userId: string | null;
    connectedAt: number;
}

export interface VerifiedTokenPayload {
    role?: string;
    scope?: string;
    restaurantId?: string;
    restaurant_id?: string;
    restaurant_code?: string;
    restaurant_ids?: string[];
    table_number?: string | number;
    table_id?: string | number;
    userId?: string;
    sub?: string;
    exp?: number;
}

export type WsAuthResult =
    | { ok: true; role: string; tableNumber: string; userId: string }
    | { ok: false; status: number; error: string };

export function getCorsHeaders(request: Request): Record<string, string> {
    const origin = request.headers.get('Origin');
    let allowedOrigin = '';

    if (origin) {
        try {
            const parsed = new URL(origin);
            const host = parsed.hostname.toLowerCase();
            if (
                host === 'dineinone.com' ||
                host.endsWith('.dineinone.com') ||
                host === 'localhost' ||
                host === '127.0.0.1' ||
                host.endsWith('.local')
            ) {
                allowedOrigin = origin;
            }
        } catch {
            // Invalid origin header; omit Allow-Origin
        }
    }

    const headers: Record<string, string> = {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-webhook-secret',
        Vary: 'Origin',
    };
    if (allowedOrigin) {
        headers['Access-Control-Allow-Origin'] = allowedOrigin;
    }
    return headers;
}

export function constantTimeEqualStrings(a: string, b: string): boolean {
    const aBytes = new TextEncoder().encode(a);
    const bBytes = new TextEncoder().encode(b);
    if (aBytes.length !== bBytes.length) return false;
    let diff = 0;
    for (let i = 0; i < aBytes.length; i++) {
        diff |= aBytes[i] ^ bBytes[i];
    }
    return diff === 0;
}

export function base64UrlToUint8Array(b64Url: string): Uint8Array {
    const norm = b64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = norm + '='.repeat((4 - (norm.length % 4)) % 4);
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        out[i] = bin.charCodeAt(i);
    }
    return out;
}

export function base64UrlDecodeUtf8(b64Url: string): string {
    return new TextDecoder().decode(base64UrlToUint8Array(b64Url));
}

export async function verifyToken(
    token: string,
    appSecret: string,
    supabaseSecret?: string
): Promise<VerifiedTokenPayload | null> {
    const secrets = [appSecret, supabaseSecret].filter(Boolean) as string[];

    for (const secret of secrets) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) continue;

            const [headerB64, payloadB64, sigB64] = parts;
            const header = JSON.parse(base64UrlDecodeUtf8(headerB64)) as { alg?: string };
            if (!header || header.alg !== 'HS256') continue;

            const key = await crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(secret),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['verify']
            );

            const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
            const sig = base64UrlToUint8Array(sigB64);

            const valid = await crypto.subtle.verify(
                'HMAC',
                key,
                sig as unknown as BufferSource,
                data
            );
            if (!valid) continue;

            const payload = JSON.parse(base64UrlDecodeUtf8(payloadB64)) as VerifiedTokenPayload;

            if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
                return null;
            }

            return payload;
        } catch {
            continue;
        }
    }

    return null;
}

export function authorizeWebSocketClaims(
    tokenUser: VerifiedTokenPayload,
    restaurantId: string
): WsAuthResult {
    const rawRole = String(tokenUser.role || '').toLowerCase().trim();
    const rawScope = String(tokenUser.scope || '').toLowerCase().trim();
    const isSuperAdmin = ['super_admin', 'superadmin'].includes(rawRole);

    const allowedRestaurantIds: string[] = [];
    if (Array.isArray(tokenUser.restaurant_ids)) {
        for (const rid of tokenUser.restaurant_ids) {
            if (rid) allowedRestaurantIds.push(String(rid).trim().toLowerCase());
        }
    }
    const scalarRest = tokenUser.restaurantId || tokenUser.restaurant_id || tokenUser.restaurant_code;
    if (scalarRest) {
        allowedRestaurantIds.push(String(scalarRest).trim().toLowerCase());
    }

    if (!isSuperAdmin) {
        if (allowedRestaurantIds.length === 0 || !allowedRestaurantIds.includes(restaurantId.toLowerCase())) {
            return { ok: false, status: 403, error: 'Forbidden: Cross-restaurant access denied' };
        }
    }

    const verifiedRole =
        rawScope === 'customer' || rawRole === 'customer_table'
            ? 'customer'
            : (rawRole && rawRole !== 'authenticated' ? rawRole : rawScope || 'staff');
    const verifiedTableNumber =
        tokenUser.table_number != null
            ? String(tokenUser.table_number).trim()
            : (tokenUser.table_id != null ? String(tokenUser.table_id).trim() : '');
    const verifiedUserId =
        tokenUser.userId != null
            ? String(tokenUser.userId).trim()
            : (tokenUser.sub != null ? String(tokenUser.sub).trim() : '');

    if (verifiedRole === 'customer' && !verifiedTableNumber) {
        return { ok: false, status: 403, error: 'Forbidden: Customer token missing table scope' };
    }

    return {
        ok: true,
        role: verifiedRole,
        tableNumber: verifiedTableNumber,
        userId: verifiedUserId,
    };
}

export function shouldDeliverBroadcast(
    meta: SocketAttachment | null,
    payload: {
        table?: string;
        record?: Record<string, unknown>;
        old_record?: Record<string, unknown>;
    }
): boolean {
    if (!meta) return false;

    const table = String(payload.table || '').toLowerCase();
    const record = payload.record || payload.old_record || {};
    const eventTableNumber = record.table_number ?? record.tableNumber;
    const eventTableId = record.table_id ?? record.tableId;

    if (meta.role === 'customer' || meta.role === 'customer_table') {
        if (!meta.tableNumber) return false;
        const matchesTableNumber =
            eventTableNumber != null &&
            String(eventTableNumber).toLowerCase() === meta.tableNumber.toLowerCase();
        const matchesTableId =
            eventTableId != null && String(eventTableId) === meta.tableNumber;
        if (!matchesTableNumber && !matchesTableId) {
            return false;
        }
    }

    if (meta.role === 'chef' || meta.role === 'kds' || meta.role === 'kitchen') {
        if (!['orders', 'order_items', 'kitchen_alerts'].includes(table)) {
            return false;
        }
    }

    if (meta.role === 'rider' || meta.role === 'delivery') {
        if (!['orders', 'delivery_assignments', 'delivery_boys'].includes(table)) {
            return false;
        }
    }

    return true;
}
