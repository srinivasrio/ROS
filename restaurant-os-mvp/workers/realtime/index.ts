import { DurableObject } from 'cloudflare:workers';
export { SecurityRoom } from './security-do.ts';
import {
    authorizeWebSocketClaims,
    constantTimeEqualStrings,
    getCorsHeaders,
    shouldDeliverBroadcast,
    type SocketAttachment,
    verifyToken,
} from './auth.ts';

export interface Env {
    RESTAURANT_ROOM: DurableObjectNamespace<RestaurantRoom>;
    JWT_SECRET: string;
    SUPABASE_JWT_SECRET?: string;
    WEBHOOK_SECRET: string;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const corsHeaders = getCorsHeaders(request);

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
            const secret = request.headers.get('x-webhook-secret') || '';
            if (!env.WEBHOOK_SECRET || !secret || !constantTimeEqualStrings(secret, env.WEBHOOK_SECRET)) {
                return new Response(JSON.stringify({ error: 'Unauthorized webhook secret' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                });
            }

            let payload: Record<string, any>;
            try {
                payload = await request.json();
            } catch {
                return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                });
            }

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

            const roomId = env.RESTAURANT_ROOM.idFromName(String(restaurantId).trim());
            const roomStub = env.RESTAURANT_ROOM.get(roomId);

            const roomResponse = await roomStub.fetch(
                new Request('http://internal/broadcast', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                    headers: { 'Content-Type': 'application/json' },
                })
            );

            const result = (await roomResponse.json()) as Record<string, unknown>;
            return new Response(JSON.stringify({ success: true, ...result }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        // 3. Room connection stats (admin inspection)
        if (url.pathname === '/stats' && request.method === 'GET') {
            const restaurantId = url.searchParams.get('restaurant_id');
            const secret = request.headers.get('x-webhook-secret') || '';

            if (!env.WEBHOOK_SECRET || !secret || !constantTimeEqualStrings(secret, env.WEBHOOK_SECRET) || !restaurantId) {
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
            const restaurantId = url.searchParams.get('restaurant_id')?.trim() || '';

            if (!token || !restaurantId) {
                return new Response(
                    JSON.stringify({ error: 'Missing required query parameters: token and restaurant_id' }),
                    { status: 400, headers: { 'Content-Type': 'application/json' } }
                );
            }

            const tokenUser = await verifyToken(token, env.JWT_SECRET, env.SUPABASE_JWT_SECRET);
            if (!tokenUser) {
                return new Response(JSON.stringify({ error: 'Invalid or expired authorization token' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            const authResult = authorizeWebSocketClaims(tokenUser, restaurantId);
            if (!authResult.ok) {
                return new Response(JSON.stringify({ error: authResult.error }), {
                    status: authResult.status,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            const forwardHeaders = new Headers(request.headers);
            forwardHeaders.set('x-verified-role', authResult.role);
            forwardHeaders.set('x-verified-table-number', authResult.tableNumber);
            forwardHeaders.set('x-verified-user-id', authResult.userId);

            const roomId = env.RESTAURANT_ROOM.idFromName(restaurantId);
            const roomStub = env.RESTAURANT_ROOM.get(roomId);
            return roomStub.fetch(new Request(request.url, { headers: forwardHeaders }));
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

        if (url.pathname === '/ws') {
            const pair = new WebSocketPair();
            const [client, server] = Object.values(pair);

            const role = (request.headers.get('x-verified-role') || 'staff').toLowerCase().trim();
            const tableNumber = request.headers.get('x-verified-table-number')?.trim() || null;
            const userId = request.headers.get('x-verified-user-id')?.trim() || null;

            const meta: SocketAttachment = {
                role,
                tableNumber,
                userId,
                connectedAt: Date.now(),
            };
            server.serializeAttachment(meta);
            this.ctx.acceptWebSocket(server);

            return new Response(null, {
                status: 101,
                webSocket: client,
            });
        }

        if (url.pathname === '/broadcast') {
            const payload = (await request.json()) as {
                table?: string;
                record?: Record<string, unknown>;
                old_record?: Record<string, unknown>;
            };

            const sockets = this.ctx.getWebSockets();
            let delivered = 0;
            const messageStr = JSON.stringify(payload);

            for (const ws of sockets) {
                try {
                    const meta = ws.deserializeAttachment() as SocketAttachment | null;
                    if (!shouldDeliverBroadcast(meta, payload)) {
                        continue;
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

    async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
        if (message === 'ping' || message === '{"type":"ping"}') {
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
    }

    async webSocketClose(ws: WebSocket, code: number, reason: string) {
        ws.close(code, reason);
    }

    async webSocketError(ws: WebSocket) {
        try {
            ws.close(1011, 'WebSocket internal error');
        } catch {
            // ignore close error
        }
    }
}
