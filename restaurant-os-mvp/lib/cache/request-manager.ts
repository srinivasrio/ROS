'use client';

import { adminCacheManager, AdminCacheEntry, CacheOptions } from './admin-cache-manager';

/**
 * Centralized Request Manager & Concurrency Priority Queue
 * 
 * Capabilities:
 * 1. In-flight Request Deduplication: Coalesces identical concurrent requests into one.
 * 2. Controlled Concurrency: Limits background prefetch load to prevent database/API spikes.
 * 3. Priority Levels: Priority 1 (Immediate/High), Priority 2 (Normal), Priority 3 (Idle/Low).
 * 4. Network-Aware Resiliency: Exponential backoff with jitter on transient failures.
 * 5. Stale-While-Revalidate Engine: Executes background synchronizations smoothly.
 */

export type RequestPriority = 1 | 2 | 3;

export interface EnqueueOptions {
    priority?: RequestPriority;
    retries?: number;
    timeoutMs?: number;
}

interface QueuedTask<T = any> {
    id: string;
    key: string;
    priority: RequestPriority;
    execute: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (reason: any) => void;
    retriesLeft: number;
    enqueuedAt: number;
}

class RequestManager {
    // In-flight active promise deduplication
    private inFlight = new Map<string, Promise<any>>();

    // Priority Queues
    private priority1Queue: QueuedTask[] = []; // Highest (Dashboard, Tables, Live Kitchen)
    private priority2Queue: QueuedTask[] = []; // Normal (Menu, Customers, Specials, etc.)
    private priority3Queue: QueuedTask[] = []; // Low / Idle (Homepage Builder, Analytics, Profile, etc.)

    private activeWorkers = 0;
    private maxConcurrency = 2; // Controlled background concurrency to prevent DB spikes
    private isOffline = false;

    constructor() {
        if (typeof window !== 'undefined') {
            this.initNetworkListeners();
        }
    }

    private initNetworkListeners(): void {
        this.isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

        window.addEventListener('online', () => {
            this.isOffline = false;
            this.processQueue();
        });

        window.addEventListener('offline', () => {
            this.isOffline = true;
        });

        // Adapt concurrency based on device/network quality
        if (typeof navigator !== 'undefined' && (navigator as any).connection) {
            const conn = (navigator as any).connection;
            if (conn.saveData || conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g') {
                this.maxConcurrency = 1;
            }
        }
    }

    /**
     * Coalesces duplicate concurrent requests for the exact same key.
     * If a request with `key` is already pending, returns the existing Promise.
     */
    public coalesce<T>(key: string, fetcher: () => Promise<T>, priority?: RequestPriority): Promise<T> {
        if (!key) return fetcher();

        const existing = this.inFlight.get(key);
        if (existing) {
            adminCacheManager.recordDeduplication();
            return existing as Promise<T>;
        }

        adminCacheManager.recordNetworkRequest();
        const promise = (async () => {
            try {
                return await fetcher();
            } finally {
                this.inFlight.delete(key);
            }
        })();

        this.inFlight.set(key, promise);
        return promise;
    }

    /**
     * Check if a request for this key is currently in-flight.
     */
    public isInFlight(key: string): boolean {
        return this.inFlight.has(key);
    }

    /**
     * Enqueue a request into the priority queue with controlled concurrency.
     */
    public enqueue<T>(
        key: string,
        fetcher: () => Promise<T>,
        options?: EnqueueOptions
    ): Promise<T> {
        const priority = options?.priority ?? 2;
        const retries = options?.retries ?? 2;

        // If Priority 1, execute via coalesce immediately to never block critical UI
        if (priority === 1) {
            return this.coalesce(key, () => this.executeWithRetry(fetcher, retries));
        }

        // Check if an identical request is already queued or in flight
        if (this.inFlight.has(key)) {
            adminCacheManager.recordDeduplication();
            return this.inFlight.get(key) as Promise<T>;
        }

        return new Promise<T>((resolve, reject) => {
            const task: QueuedTask<T> = {
                id: `${key}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                key,
                priority,
                execute: fetcher,
                resolve,
                reject,
                retriesLeft: retries,
                enqueuedAt: Date.now(),
            };

            if (priority === 2) {
                this.priority2Queue.push(task);
            } else {
                this.priority3Queue.push(task);
            }

            this.processQueue();
        });
    }

    /**
     * Process tasks according to priority: Priority 1 > Priority 2 > Priority 3
     */
    private processQueue(): void {
        if (this.isOffline) return;

        while (this.activeWorkers < this.maxConcurrency) {
            let nextTask: QueuedTask | undefined;

            if (this.priority1Queue.length > 0) {
                nextTask = this.priority1Queue.shift();
            } else if (this.priority2Queue.length > 0) {
                nextTask = this.priority2Queue.shift();
            } else if (this.priority3Queue.length > 0) {
                nextTask = this.priority3Queue.shift();
            }

            if (!nextTask) break;

            this.activeWorkers++;
            this.runTask(nextTask);
        }
    }

    /**
     * Run a single queued task with deduplication and retry logic.
     */
    private async runTask(task: QueuedTask): Promise<void> {
        try {
            const result = await this.coalesce(task.key, () =>
                this.executeWithRetry(task.execute, task.retriesLeft)
            );
            task.resolve(result);
        } catch (err) {
            task.reject(err);
        } finally {
            this.activeWorkers--;
            // Allow event loop breathing room (40ms) between background batches
            setTimeout(() => {
                this.processQueue();
            }, 40);
        }
    }

    /**
     * Execute operation with exponential backoff and jitter.
     */
    private async executeWithRetry<T>(operation: () => Promise<T>, retries: number): Promise<T> {
        let attempt = 0;
        let lastError: any;

        while (attempt <= retries) {
            try {
                return await operation();
            } catch (err: any) {
                lastError = err;
                attempt++;

                if (attempt > retries) {
                    break;
                }

                // Exponential backoff: 300ms, 800ms, 1800ms... + random jitter
                const backoffMs = Math.min(
                    300 * Math.pow(2, attempt) + Math.random() * 200,
                    4000
                );
                await new Promise(r => setTimeout(r, backoffMs));
            }
        }

        throw lastError;
    }

    /**
     * High-performance Stale-While-Revalidate fetcher:
     * 1. If fresh cache exists: returns immediately (0ms).
     * 2. If stale cache exists: returns stale immediately, enqueues background revalidation.
     * 3. If no cache exists: fetches through queue/coalesce, stores in cache, and returns.
     */
    public async fetchWithCache<T>(
        key: string,
        fetcher: () => Promise<T>,
        options?: CacheOptions & EnqueueOptions & {
            forceRefresh?: boolean;
            tenantId?: string;
            onBackgroundUpdate?: (data: T) => void;
        }
    ): Promise<T> {
        const force = options?.forceRefresh ?? false;
        const tenantId = options?.tenantId;

        if (!force) {
            const cached = adminCacheManager.get<T>(key, {
                tenantId,
                maxAgeMs: options?.staleTimeMs,
                isRealtime: options?.isRealtime
            });

            if (cached) {
                // Fresh hit -> return instantly
                if (!cached.isStale) {
                    return cached.data;
                }

                // Stale hit -> return stale immediately, trigger silent background revalidation
                this.enqueue(
                    key,
                    async () => {
                        try {
                            const fresh = await fetcher();
                            if (fresh !== undefined && fresh !== null) {
                                adminCacheManager.set(key, fresh, {
                                    tenantId,
                                    staleTimeMs: options?.staleTimeMs,
                                    ttlMs: options?.ttlMs,
                                    isRealtime: options?.isRealtime,
                                });
                                options?.onBackgroundUpdate?.(fresh);
                            }
                            return fresh;
                        } catch (err) {
                            console.warn(`[RequestManager] Background revalidation failed for "${key}":`, err);
                            return cached.data;
                        }
                    },
                    { priority: options?.priority ?? 2, retries: 1 }
                ).catch(() => {});

                return cached.data;
            }
        }

        // Cache Miss or Force Refresh
        const result = await this.enqueue(
            key,
            async () => {
                const data = await fetcher();
                if (data !== undefined && data !== null) {
                    adminCacheManager.set(key, data, {
                        tenantId,
                        staleTimeMs: options?.staleTimeMs,
                        ttlMs: options?.ttlMs,
                        isRealtime: options?.isRealtime,
                    });
                }
                return data;
            },
            { priority: options?.priority ?? 1, retries: options?.retries ?? 2 }
        );

        return result;
    }

    /**
     * Clear all queued background tasks (e.g., on tenant change or logout).
     */
    public clearQueue(): void {
        this.priority1Queue.forEach(t => t.reject(new Error('Queue cancelled')));
        this.priority2Queue.forEach(t => t.reject(new Error('Queue cancelled')));
        this.priority3Queue.forEach(t => t.reject(new Error('Queue cancelled')));
        this.priority1Queue = [];
        this.priority2Queue = [];
        this.priority3Queue = [];
        this.inFlight.clear();
    }
}

export const requestManager = new RequestManager();
