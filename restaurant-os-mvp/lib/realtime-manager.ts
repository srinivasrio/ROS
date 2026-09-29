'use client';

import { supabase } from '@/lib/supabase';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type ChangeListener<T extends { [key: string]: any } = any> = (payload: RealtimePostgresChangesPayload<T>) => void;
type WakeupListener = () => void;

interface ChannelSubscription<T extends { [key: string]: any } = any> {
    channel: RealtimeChannel;
    listeners: Set<ChangeListener<T>>;
    teardownTimer: NodeJS.Timeout | null;
    refCount: number;
    channelKey: string;
}

/**
 * Centralized Realtime Subscription Manager
 * 
 * Solves:
 * 1. Zombie channel leaks on page navigation / async resolution
 * 2. Static channel collisions and cascading teardowns
 * 3. Stale WebSocket connections after long idle periods
 * 4. WebSocket thrashing via debounced channel reuse (5s grace window)
 */
class RealtimeSubscriptionManager {
    private channels = new Map<string, ChannelSubscription<any>>();
    private wakeupListeners = new Set<WakeupListener>();
    private isInitialized = false;
    private lastWakeupCheck = 0;

    constructor() {
        if (typeof window !== 'undefined') {
            this.initVisibilityAndConnectionListeners();
        }
    }

    /**
     * Initializes global listeners for tab visibility and network online events.
     * Automatically recovers dropped or stale WebSockets when waking from idle.
     */
    private initVisibilityAndConnectionListeners(): void {
        if (this.isInitialized || typeof window === 'undefined') return;
        this.isInitialized = true;

        const handleWakeup = () => {
            const now = Date.now();
            // Throttle wakeup recovery checks to once every 20 seconds to prevent tab switching thrashing
            if (now - this.lastWakeupCheck < 20000) return;
            this.lastWakeupCheck = now;

            this.recoverRealtimeConnection();
        };

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                handleWakeup();
            }
        });

        window.addEventListener('online', handleWakeup);
    }

    /**
     * Check Realtime WebSocket connection health and reconnect if disconnected/stale.
     */
    public recoverRealtimeConnection(): void {
        try {
            const realtime = (supabase as any).realtime;
            if (!realtime) return;

            const isConnected = realtime.isConnected?.() ?? (realtime.conn && realtime.conn.readyState === 1);

            if (!isConnected) {
                // Force reconnect the underlying socket
                try {
                    realtime.disconnect?.();
                } catch (_) {}
                realtime.connect?.();
            }

            // Trigger quiet revalidation across all active wakeup listeners
            this.wakeupListeners.forEach(listener => {
                try {
                    listener();
                } catch (err) {
                    console.warn('[RealtimeManager] Error in wakeup listener:', err);
                }
            });
        } catch (err) {
            console.warn('[RealtimeManager] Connection recovery error:', err);
        }
    }

    /**
     * Register a callback to be notified when the tab wakes up from idle.
     */
    public onWakeup(listener: WakeupListener): () => void {
        this.wakeupListeners.add(listener);
        return () => {
            this.wakeupListeners.delete(listener);
        };
    }

    /**
     * Subscribes to Postgres table changes using a shared, reference-counted channel.
     * 
     * @param channelKey Unique identifier for the shared channel (e.g. "orders:uuid:main:all")
     * @param setupChannel Callback that instantiates and binds the Supabase RealtimeChannel
     * @param onChange Callback to receive change payloads
     * @returns Unsubscribe function that decrements the ref-count with debounced teardown
     */
    public subscribe<T extends { [key: string]: any } = any>(
        channelKey: string,
        setupChannel: () => RealtimeChannel,
        onChange: ChangeListener<T>
    ): { unsubscribe: () => void } {
        let entry = this.channels.get(channelKey);

        if (entry) {
            // Cancel any pending debounced teardown
            if (entry.teardownTimer) {
                clearTimeout(entry.teardownTimer);
                entry.teardownTimer = null;
            }
            entry.refCount++;
            entry.listeners.add(onChange);
        } else {
            // Create a brand new channel entry
            const channel = setupChannel();
            const listeners = new Set<ChangeListener<T>>([onChange]);

            entry = {
                channel,
                listeners,
                teardownTimer: null,
                refCount: 1,
                channelKey,
            };
            this.channels.set(channelKey, entry);
        }

        let isUnsubscribed = false;

        return {
            unsubscribe: () => {
                if (isUnsubscribed) return;
                isUnsubscribed = true;

                const current = this.channels.get(channelKey);
                if (!current) return;

                current.listeners.delete(onChange);
                current.refCount = Math.max(0, current.refCount - 1);

                if (current.refCount === 0) {
                    // Start a 5-second grace window before tearing down the channel.
                    // If a user navigates to another page that needs the same channel,
                    // the channel will be reused without reconnecting!
                    if (current.teardownTimer) {
                        clearTimeout(current.teardownTimer);
                    }
                    current.teardownTimer = setTimeout(() => {
                        const check = this.channels.get(channelKey);
                        if (check && check.refCount === 0) {
                            try {
                                supabase.removeChannel(check.channel);
                            } catch (_) {}
                            this.channels.delete(channelKey);
                        }
                    }, 5000);
                }
            }
        };
    }

    /**
     * Broadcast a payload to all active listeners on a channel.
     */
    public dispatch<T extends { [key: string]: any } = any>(channelKey: string, payload: RealtimePostgresChangesPayload<T>): void {
        const entry = this.channels.get(channelKey);
        if (!entry || entry.listeners.size === 0) return;

        entry.listeners.forEach(fn => {
            try {
                fn(payload);
            } catch (err) {
                console.error(`[RealtimeManager] Error dispatching payload on ${channelKey}:`, err);
            }
        });
    }

    /**
     * Get active channel count (useful for diagnostics and testing).
     */
    public getActiveChannelCount(): number {
        return this.channels.size;
    }

    /**
     * Force clean teardown of all channels (e.g. on user sign-out).
     */
    public clearAll(): void {
        for (const [key, entry] of this.channels.entries()) {
            if (entry.teardownTimer) clearTimeout(entry.teardownTimer);
            try {
                supabase.removeChannel(entry.channel);
            } catch (_) {}
        }
        this.channels.clear();
        this.wakeupListeners.clear();
    }
}

export const realtimeManager = new RealtimeSubscriptionManager();
