'use client';

import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type EventCallback<T extends { [key: string]: any } = any> = (payload: RealtimePostgresChangesPayload<T>) => void;

interface SubscriptionEntry {
    table: string;
    callback: EventCallback;
}

/**
 * High-performance WebSocket client connecting to Cloudflare Durable Objects Realtime Gateway.
 * Supports multiplexed subscriptions, auto-reconnection, and seamless fallback to Supabase.
 */
class CloudflareRealtimeClient {
    private ws: WebSocket | null = null;
    private subscriptions = new Set<SubscriptionEntry>();
    private pingInterval: any = null;
    private reconnectTimeout: any = null;
    private reconnectAttempts = 0;
    private isConnecting = false;
    private currentRestaurantId: string | null = null;

    /**
     * Check if Cloudflare Realtime is enabled via environment variables.
     */
    public isEnabled(): boolean {
        if (typeof window === 'undefined') return false;
        return (
            process.env.NEXT_PUBLIC_CF_REALTIME_ENABLED === 'true' &&
            Boolean(process.env.NEXT_PUBLIC_CF_REALTIME_URL)
        );
    }

    /**
     * Connect or switch restaurant room on Cloudflare Durable Object.
     */
    public connect(restaurantId: string, token: string, role: string = 'staff', tableNumber?: string): void {
        if (!this.isEnabled() || !restaurantId || !token) return;

        // If already connected to this restaurant and socket is open, do nothing
        if (
            this.ws &&
            this.currentRestaurantId === restaurantId &&
            (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
        ) {
            return;
        }

        this.disconnect();
        this.currentRestaurantId = restaurantId;
        this.isConnecting = true;

        try {
            const baseUrl = (process.env.NEXT_PUBLIC_CF_REALTIME_URL || '').replace(/^http/, 'ws');
            const wsUrl = new URL('/ws', baseUrl);
            wsUrl.searchParams.set('restaurant_id', restaurantId);
            wsUrl.searchParams.set('token', token);
            wsUrl.searchParams.set('role', role);
            if (tableNumber) {
                wsUrl.searchParams.set('table_number', tableNumber);
            }

            this.ws = new WebSocket(wsUrl.toString());

            this.ws.onopen = () => {
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                if (process.env.NODE_ENV === 'development') {
                    console.log(`[CF Realtime] Connected to restaurant room: ${restaurantId}`);
                }

                // Heartbeat to keep connection active and test latency
                clearInterval(this.pingInterval);
                this.pingInterval = setInterval(() => {
                    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                        this.ws.send('ping');
                    }
                }, 25000);
            };

            this.ws.onmessage = (event) => {
                try {
                    const rawData = typeof event.data === 'string' ? event.data : '';
                    if (rawData === 'pong' || rawData.includes('"type":"pong"')) return;

                    const msg = JSON.parse(rawData);
                    if (!msg || !msg.table) return;

                    // Convert Cloudflare DO webhook event to standard Supabase Realtime payload
                    const formattedPayload: RealtimePostgresChangesPayload<any> = {
                        schema: msg.schema || 'public',
                        table: msg.table,
                        commit_timestamp: msg.timestamp || new Date().toISOString(),
                        eventType: (msg.type || 'UPDATE').toUpperCase() as any,
                        new: msg.record || {},
                        old: msg.old_record || {},
                        errors: [],
                    };

                    // Dispatch to matching table subscribers
                    const targetTable = String(msg.table).toLowerCase();
                    this.subscriptions.forEach((entry) => {
                        if (entry.table === targetTable || entry.table === '*') {
                            entry.callback(formattedPayload);
                        }
                    });
                } catch (parseErr) {
                    console.warn('[CF Realtime] Message parse error:', parseErr);
                }
            };

            this.ws.onerror = (err) => {
                console.warn('[CF Realtime] WebSocket connection warning:', err);
            };

            this.ws.onclose = () => {
                this.isConnecting = false;
                clearInterval(this.pingInterval);
                this.scheduleReconnect(restaurantId, token, role, tableNumber);
            };
        } catch (err) {
            this.isConnecting = false;
            console.warn('[CF Realtime] Connection failed, falling back to Supabase:', err);
        }
    }

    private scheduleReconnect(restaurantId: string, token: string, role: string, tableNumber?: string): void {
        clearTimeout(this.reconnectTimeout);
        this.reconnectAttempts++;
        // Exponential backoff: 1s, 2s, 4s, up to 15s
        const delay = Math.min(15000, 1000 * Math.pow(1.5, this.reconnectAttempts));
        this.reconnectTimeout = setTimeout(() => {
            if (this.currentRestaurantId === restaurantId) {
                this.connect(restaurantId, token, role, tableNumber);
            }
        }, delay);
    }

    /**
     * Subscribe to real-time events for a specific database table.
     */
    public subscribeTable<T extends { [key: string]: any } = any>(table: string, callback: EventCallback<T>): () => void {
        const entry: SubscriptionEntry = { table: table.toLowerCase(), callback };
        this.subscriptions.add(entry);

        return () => {
            this.subscriptions.delete(entry);
        };
    }

    /**
     * Disconnect WebSocket and clean up timers.
     */
    public disconnect(): void {
        clearInterval(this.pingInterval);
        clearTimeout(this.reconnectTimeout);
        if (this.ws) {
            try {
                this.ws.close();
            } catch (_) {}
            this.ws = null;
        }
        this.currentRestaurantId = null;
        this.isConnecting = false;
    }
}

export const cfRealtimeClient = new CloudflareRealtimeClient();
