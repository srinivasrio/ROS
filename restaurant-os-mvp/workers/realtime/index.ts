import { DurableObject } from 'cloudflare:workers';

export interface Env {
    RESTAURANT_ROOM: DurableObjectNamespace<RestaurantRoom>;
    JWT_SECRET: string;
    SUPABASE_JWT_SECRET?: string;
    WEBHOOK_SECRET: string;
}

interface SocketAttachment {
    role: string;
    tableNumber: string | null;
    userId: string | null;
    connectedAt: number;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // CORS headers for incoming API requests
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-webhook-secret',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // 1. Health check & status endpoint
        if (url.pathname === '/' || url.pathname === '/health') {
            return new Response(
                JSON.stringify({
                    service: 'dine-in-one-realtime',
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                }),
                { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
        }

        // 2. Broadcast webhook ingestion from Supabase Postgres
        if (url.pathname === '/broadcast' && request.method === 'POST') {
            const secret = request.headers.get('x-webhook-secret') || url.searchParams.get('secret');
            if (!env.WEBHOOK_SECRET || secret !== env.WEBHOOK_SECRET) {
                return new Response(JSON.stringify({ error: 'Unauthorized webhook secret' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                });
            }

            let payload: any;
            try {
                payload = await request.json();
            } catch {
                return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                });
            }

            // Extract restaurant ID from record, old_record, or root payload
            const record = payload.record || payload.old_record || {};
            const restaurantId =
                record.restaurant_id ||
                record.restaurantId ||
                payload.restaurant_id ||
                payload.restaurantId ||
                url.searchParams.get('restaurant_id');

            if (!restaurantId) {
                return new Response(JSON.stringify({ error: 'Missing restaurant_id in event payload' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                });
            }

            // Route to this specific restaurant's Durable Object
            const roomId = env.RESTAURANT_ROOM.idFromName(String(restaurantId).trim());
            const roomStub = env.RESTAURANT_ROOM.get(roomId);

            const roomResponse = await roomStub.fetch(
                new Request('http://internal/broadcast', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                    headers: { 'Content-Type': 'application/json' },
                })
            );

            const result = await roomResponse.json();
            return new Response(JSON.stringify({ success: true, ...result }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        // 3. Room connection stats (admin inspection)
        if (url.pathname === '/stats' && request.method === 'GET') {
            const restaurantId = url.searchParams.get('restaurant_id');
            const secret = request.headers.get('x-webhook-secret') || url.searchParams.get('secret');

            if (secret !== env.WEBHOOK_SECRET || !restaurantId) {
                return new Response(JSON.stringify({ error: 'Unauthorized or missing restaurant_id' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                });
            }

            const roomId = env.RESTAURANT_ROOM.idFromName(String(restaurantId).trim());
            const roomStub = env.RESTAURANT_ROOM.get(roomId);
            return roomStub.fetch(new Request('http://internal/stats'));
        }

        // 4. Client WebSocket upgrade endpoint (/ws)
        if (url.pathname === '/ws') {
            if (request.headers.get('Upgrade') !== 'websocket') {
                return new Response('Expected WebSocket upgrade request', { status: 426 });
            }

            const token = url.searchParams.get('token');
            const restaurantId = url.searchParams.get('restaurant_id');

            if (!token || !restaurantId) {
                return new Response(
                    JSON.stringify({ error: 'Missing required query parameters: token and restaurant_id' }),
                    { status: 400, headers: { 'Content-Type': 'application/json' } }
                );
            }

            // Authenticate token (DineInOne JWT_SECRET or Supabase JWT)
            const tokenUser = await verifyToken(token, env.JWT_SECRET, env.SUPABASE_JWT_SECRET);
            if (!tokenUser) {
                return new Response(JSON.stringify({ error: 'Invalid or expired authorization token' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            // Tenant isolation: Verify requested restaurant matches token claims
            const tokenRest = tokenUser.restaurantId || tokenUser.restaurant_id || tokenUser.restaurant_code;
            const isSuperAdmin = ['super_admin', 'superadmin'].includes(String(tokenUser.role || '').toLowerCase());

            if (!isSuperAdmin && tokenRest && String(tokenRest).toLowerCase() !== String(restaurantId).toLowerCase()) {
                return new Response(JSON.stringify({ error: 'Forbidden: Cross-restaurant access denied' }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            // Forward WebSocket upgrade request to the restaurant's Durable Object
            const roomId = env.RESTAURANT_ROOM.idFromName(String(restaurantId).trim());
            const roomStub = env.RESTAURANT_ROOM.get(roomId);
            return roomStub.fetch(request);
        }

        return new Response('Not Found', { status: 404, headers: corsHeaders });
    },
};

// ===========================================================================
// Durable Object: One coordination room instance per restaurant
// Uses SQLite storage and WebSocket Hibernation API for $0 idle cost
// ===========================================================================
export class RestaurantRoom extends DurableObject {
    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        // A. Handle WebSocket Upgrade Request
        if (url.pathname === '/ws') {
            const pair = new WebSocketPair();
            const [client, server] = Object.values(pair);

            const role = (url.searchParams.get('role') || 'staff').toLowerCase().trim();
            const tableNumber = url.searchParams.get('table_number')?.trim() || null;
            const userId = url.searchParams.get('user_id')?.trim() || null;

            // Attach metadata to the server socket so it survives hibernation
            const meta: SocketAttachment = {
                role,
                tableNumber,
                userId,
                connectedAt: Date.now(),
            };
            server.serializeAttachment(meta);

            // Accept socket via Hibernation API ($0 CPU when idle)
            this.ctx.acceptWebSocket(server);

            return new Response(null, {
                status: 101,
                webSocket: client,
            });
        }

        // B. Handle Broadcast Push to Connected Sockets
        if (url.pathname === '/broadcast') {
            const payload: any = await request.json();
            const table = String(payload.table || '').toLowerCase();
            const record = payload.record || payload.old_record || {};
            const eventTableNumber = record.table_number || record.tableNumber;
            const eventTableId = record.table_id || record.tableId;

            const sockets = this.ctx.getWebSockets();
            let delivered = 0;

            const messageStr = JSON.stringify(payload);

            for (const ws of sockets) {
                try {
                    const meta = ws.deserializeAttachment() as SocketAttachment | null;
                    if (!meta) {
                        ws.send(messageStr);
                        delivered++;
                        continue;
                    }

                    // 1. Customer Scoping: Only receive events matching their seated table
                    if (meta.role === 'customer') {
                        if (meta.tableNumber) {
                            const matchesTableNumber =
                                eventTableNumber &&
                                String(eventTableNumber).toLowerCase() === meta.tableNumber.toLowerCase();
                            const matchesTableId =
                                eventTableId && String(eventTableId) === meta.tableNumber;

                            // Allow customer to receive updates only for their table
                            if (!matchesTableNumber && !matchesTableId) {
                                continue;
                            }
                        }
                    }

                    // 2. Kitchen / KDS Scoping: Kitchen only needs orders and line items
                    if (meta.role === 'chef' || meta.role === 'kds' || meta.role === 'kitchen') {
                        if (!['orders', 'order_items', 'kitchen_alerts'].includes(table)) {
                            continue;
                        }
                    }

                    // 3. Delivery / Rider Scoping: Rider only needs delivery assignments & orders
                    if (meta.role === 'rider' || meta.role === 'delivery') {
                        if (!['orders', 'delivery_assignments', 'delivery_boys'].includes(table)) {
                            continue;
                        }
                    }

                    ws.send(messageStr);
                    delivered++;
                } catch {
                    // Socket was closed or disconnected
                }
            }

            return new Response(
                JSON.stringify({
                    delivered,
                    active_connections: sockets.length,
                }),
                { headers: { 'Content-Type': 'application/json' } }
            );
        }

        // C. Room Stats
        if (url.pathname === '/stats') {
            const sockets = this.ctx.getWebSockets();
            return new Response(
                JSON.stringify({
                    active_connections: sockets.length,
                }),
                { headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response('Not Found', { status: 404 });
    }

    // Native Hibernation API Ping / Pong handler (keeps socket alive with 0 CPU cost)
    async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
        if (message === 'ping' || message === '{"type":"ping"}') {
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
    }

    async webSocketClose(ws: WebSocket, code: number, reason: string) {
        ws.close(code, reason);
    }

    async webSocketError(ws: WebSocket, error: unknown) {
        try {
            ws.close(1011, 'WebSocket internal error');
        } catch (_) {}
    }
}

// ===========================================================================
// High-Performance Web Crypto HMAC-SHA256 Token Verifier
// Compatible with lib/jwt-utils.ts and Supabase HS256 tokens
// ===========================================================================
async function verifyToken(token: string, appSecret: string, supabaseSecret?: string): Promise<any> {
    const secrets = [appSecret, supabaseSecret].filter(Boolean) as string[];

    for (const secret of secrets) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) continue;

            const [headerB64, payloadB64, sigB64] = parts;

            const key = await crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(secret),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['verify']
            );

            const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
            const sig = Uint8Array.from(
                atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')),
                (c) => c.charCodeAt(0)
            );

            const valid = await crypto.subtle.verify('HMAC', key, sig, data);
            if (!valid) continue;

            const payloadStr = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
            const payload = JSON.parse(payloadStr);

            // Check token expiration
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
