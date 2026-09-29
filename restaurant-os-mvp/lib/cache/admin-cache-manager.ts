'use client';

/**
 * Admin Panel Centralized Cache Manager
 * 
 * Two-tier high-performance caching architecture:
 * - L1: Fast Memory Cache (0ms synchronous lookup in JavaScript heap)
 * - L2: Persistent Device Storage (localStorage with sessionStorage fallback)
 * 
 * Features:
 * - Strict tenant isolation: ros_adm:${tenantId}:${key}
 * - Stale-while-revalidate metadata (createdAt, updatedAt, expiresAt, staleAt, version, lastSyncAt)
 * - Event bus for cross-component cache invalidation & reactive UI updates
 * - LRU bounded eviction and quota-safe storage handling
 * - Runtime observability metrics on window.__ROS_ADMIN_CACHE__
 */

export interface CacheMetadata {
    createdAt: number;
    updatedAt: number;
    expiresAt: number;
    staleAt: number;
    version: number;
    lastSyncAt: number;
    tenantId: string;
    userId?: string;
}

export interface AdminCacheEntry<T = any> {
    key: string;
    tenantId: string;
    userId?: string;
    data: T;
    createdAt: number;
    updatedAt: number;
    expiresAt: number;
    staleAt: number;
    version: number;
    lastSyncAt: number;
}

export interface CacheOptions {
    staleTimeMs?: number; // Time until data is considered stale and revalidated in background (default: 3 min)
    ttlMs?: number;       // Time until data is expired and no longer usable (default: 30 min)
    userId?: string;      // Optional user scope
    isRealtime?: boolean; // If true, shorter stale time (default: 30s)
}

export interface CacheMetrics {
    hits: number;
    misses: number;
    staleHits: number;
    writes: number;
    invalidations: number;
    evictions: number;
    deduplicatedRequests: number;
    totalNetworkRequests: number;
    activeTenantId: string | null;
    memoryEntryCount: number;
    storageEntryCount: number;
    storageSizeBytes: number;
    lastSyncTimestamp: number;
}

type CacheChangeListener<T = any> = (data: T, entry: AdminCacheEntry<T>) => void;

const CACHE_VERSION = 2;
const STORAGE_PREFIX = 'ros_adm:';
const DEFAULT_STALE_MS = 3 * 60 * 1000;      // 3 minutes
const DEFAULT_REALTIME_STALE_MS = 20 * 1000; // 20 seconds for realtime sections
const DEFAULT_TTL_MS = 60 * 60 * 1000;       // 1 hour
const MAX_MEMORY_ENTRIES = 250;
const MAX_STORAGE_BYTES = 4.5 * 1024 * 1024; // 4.5 MB safety limit for localStorage

class AdminCacheManager {
    private memoryCache = new Map<string, AdminCacheEntry<any>>();
    private listeners = new Map<string, Set<CacheChangeListener<any>>>();
    private activeTenantId: string | null = null;
    private activeUserId: string | null = null;
    private isInitialized = false;

    // Metrics for observability
    private metrics: CacheMetrics = {
        hits: 0,
        misses: 0,
        staleHits: 0,
        writes: 0,
        invalidations: 0,
        evictions: 0,
        deduplicatedRequests: 0,
        totalNetworkRequests: 0,
        activeTenantId: null,
        memoryEntryCount: 0,
        storageEntryCount: 0,
        storageSizeBytes: 0,
        lastSyncTimestamp: 0,
    };

    constructor() {
        // Do not synchronously rehydrate storage in constructor to protect SSR hydration!
        // Storage is safely rehydrated when markAppHydrated() is called post-hydration.
    }

    /**
     * Initialize the cache manager, rehydrate persistent storage, and register dev metrics.
     */
    public init(tenantId?: string, userId?: string): void {
        if (tenantId) {
            this.setTenant(tenantId, userId);
        }

        if (this.isInitialized) return;
        this.isInitialized = true;

        this.rehydrateFromStorage();
        this.attachObservability();
    }

    /**
     * Sets the active tenant and user. Enforces strict tenant isolation.
     */
    public setTenant(tenantId: string, userId?: string): void {
        const cleanTenant = String(tenantId).trim();
        if (!cleanTenant) return;

        if (this.activeTenantId !== cleanTenant) {
            this.activeTenantId = cleanTenant;
            this.metrics.activeTenantId = cleanTenant;
            // Clear memory entries that belong to another tenant
            for (const [key, entry] of this.memoryCache.entries()) {
                if (entry.tenantId !== cleanTenant) {
                    this.memoryCache.delete(key);
                }
            }
            this.rehydrateFromStorage();
        }

        if (userId) {
            this.activeUserId = userId;
        }
    }

    public getActiveTenantId(): string | null {
        return this.activeTenantId;
    }

    /**
     * Build standard scoped cache key.
     */
    private buildStorageKey(key: string, tenantId?: string): string {
        const tenant = tenantId || this.activeTenantId || 'global';
        return `${STORAGE_PREFIX}${tenant}:${key}`;
    }

    /**
     * Rehydrates tenant-scoped keys from localStorage into L1 memory cache.
     */
    public rehydrateFromStorage(): void {
        if (typeof window === 'undefined') return;

        try {
            const tenantPrefix = this.activeTenantId
                ? `${STORAGE_PREFIX}${this.activeTenantId}:`
                : STORAGE_PREFIX;

            const now = Date.now();
            let estimatedBytes = 0;
            let count = 0;

            const storage = this.getStorage();
            if (!storage) return;

            for (let i = 0; i < storage.length; i++) {
                const storageKey = storage.key(i);
                if (storageKey && storageKey.startsWith(tenantPrefix)) {
                    const raw = storage.getItem(storageKey);
                    if (raw) {
                        estimatedBytes += (storageKey.length + raw.length) * 2;
                        try {
                            const entry: AdminCacheEntry<any> = JSON.parse(raw);
                            // Validate entry schema, version, and tenant scope
                            if (
                                entry &&
                                entry.version === CACHE_VERSION &&
                                (!this.activeTenantId || entry.tenantId === this.activeTenantId)
                            ) {
                                // Evict if hard expired
                                if (entry.expiresAt && entry.expiresAt <= now) {
                                    storage.removeItem(storageKey);
                                    continue;
                                }

                                const resourceKey = storageKey.replace(tenantPrefix, '');
                                const scopedMemKey = `${entry.tenantId}:${resourceKey}`;
                                this.memoryCache.set(scopedMemKey, entry);
                                this.memoryCache.set(resourceKey, entry);
                                count++;
                            }
                        } catch (_) {
                            // Skip corrupted entry
                        }
                    }
                }
            }

            this.metrics.memoryEntryCount = this.memoryCache.size;
            this.metrics.storageEntryCount = count;
            this.metrics.storageSizeBytes = estimatedBytes;
        } catch (err) {
            console.warn('[AdminCacheManager] Storage rehydration warning:', err);
        }
    }

    /**
     * Retrieve safe storage provider with graceful fallback.
     */
    private getStorage(): Storage | null {
        if (typeof window === 'undefined') return null;
        try {
            if (window.localStorage) return window.localStorage;
        } catch (_) {}
        try {
            if (window.sessionStorage) return window.sessionStorage;
        } catch (_) {}
        return null;
    }

    /**
     * Get cached entry with state classification: 'fresh' | 'stale' | null
     */
    public get<T>(
        key: string,
        options?: { tenantId?: string; maxAgeMs?: number; isRealtime?: boolean }
    ): { data: T; isStale: boolean; entry: AdminCacheEntry<T> } | null {
        if (!key) return null;

        const targetTenant = options?.tenantId || this.activeTenantId;
        const now = Date.now();

        // 1. Check L1 Fast Memory (prefer tenant-scoped key)
        const scopedMemKey = targetTenant ? `${targetTenant}:${key}` : key;
        let entry: AdminCacheEntry<T> | undefined = this.memoryCache.get(scopedMemKey);

        if (!entry && (!targetTenant || !this.activeTenantId || targetTenant === this.activeTenantId)) {
            entry = this.memoryCache.get(key);
        }

        // Verify tenant scope in memory
        if (entry && targetTenant && entry.tenantId !== targetTenant) {
            entry = undefined;
        }

        // 2. Check L2 Storage if not in memory
        if (!entry) {
            const storage = this.getStorage();
            if (storage) {
                try {
                    const storageKey = this.buildStorageKey(key, targetTenant || undefined);
                    const raw = storage.getItem(storageKey);
                    if (raw) {
                        const parsed: AdminCacheEntry<T> = JSON.parse(raw);
                        if (
                            parsed &&
                            parsed.version === CACHE_VERSION &&
                            (!targetTenant || parsed.tenantId === targetTenant)
                        ) {
                            entry = parsed;
                            // Rehydrate L1
                            this.memoryCache.set(scopedMemKey, entry);
                            this.memoryCache.set(key, entry);
                        }
                    }
                } catch (_) {}
            }
        }

        if (!entry) {
            this.metrics.misses++;
            return null;
        }

        // Check Hard Expiration (TTL)
        if (entry.expiresAt && entry.expiresAt <= now) {
            this.delete(key, targetTenant || undefined);
            this.metrics.misses++;
            return null;
        }

        // Determine Staleness
        const customStaleThreshold = options?.maxAgeMs;
        const defaultStale = options?.isRealtime ? DEFAULT_REALTIME_STALE_MS : DEFAULT_STALE_MS;
        const isStale = customStaleThreshold !== undefined
            ? (now - entry.updatedAt > customStaleThreshold)
            : (now > entry.staleAt);

        if (isStale) {
            this.metrics.staleHits++;
        } else {
            this.metrics.hits++;
        }

        return {
            data: entry.data,
            isStale,
            entry
        };
    }

    /**
     * Store data in L1 memory and L2 persistent storage.
     */
    public set<T>(
        key: string,
        data: T,
        options?: CacheOptions & { tenantId?: string }
    ): AdminCacheEntry<T> {
        if (!key) throw new Error('[AdminCacheManager] Key is required');

        const now = Date.now();
        const tenantId = options?.tenantId || this.activeTenantId || 'global';
        const staleTime = options?.staleTimeMs ?? (options?.isRealtime ? DEFAULT_REALTIME_STALE_MS : DEFAULT_STALE_MS);
        const ttl = options?.ttlMs ?? DEFAULT_TTL_MS;

        const entry: AdminCacheEntry<T> = {
            key,
            tenantId,
            userId: options?.userId || this.activeUserId || undefined,
            data,
            createdAt: now,
            updatedAt: now,
            expiresAt: now + ttl,
            staleAt: now + staleTime,
            version: CACHE_VERSION,
            lastSyncAt: now,
        };

        // Enforce L1 LRU bounded size
        if (this.memoryCache.size >= MAX_MEMORY_ENTRIES && !this.memoryCache.has(key)) {
            this.evictOldestMemoryEntry();
        }

        // 1. Set in L1 Memory Cache with tenant prefix
        const scopedMemKey = `${tenantId}:${key}`;
        this.memoryCache.set(scopedMemKey, entry);
        if (!this.activeTenantId || this.activeTenantId === tenantId) {
            this.memoryCache.set(key, entry);
        }

        // 2. Set in L2 Storage
        const storage = this.getStorage();
        if (storage) {
            const storageKey = this.buildStorageKey(key, tenantId);
            try {
                storage.setItem(storageKey, JSON.stringify(entry));
            } catch (err: any) {
                // Handle Storage Quota Exceeded
                if (
                    err?.name === 'QuotaExceededError' ||
                    err?.code === 22 ||
                    err?.code === 1014
                ) {
                    this.pruneStorageSpace();
                    try {
                        storage.setItem(storageKey, JSON.stringify(entry));
                    } catch (_) {
                        // Fall back to keeping it in L1 memory only
                    }
                }
            }
        }

        this.metrics.writes++;
        this.metrics.lastSyncTimestamp = now;
        this.metrics.memoryEntryCount = this.memoryCache.size;

        // Notify active subscribers
        this.notifyListeners(key, data, entry);

        return entry;
    }

    /**
     * Check if a fresh (non-stale) cache entry exists.
     */
    public hasFresh(key: string, options?: { tenantId?: string; maxAgeMs?: number }): boolean {
        const cached = this.get(key, options);
        return cached !== null && !cached.isStale;
    }

    /**
     * Check if any valid cache exists (even if stale).
     */
    public has(key: string, tenantId?: string): boolean {
        const cached = this.get(key, { tenantId });
        return cached !== null;
    }

    /**
     * Invalidate one or more cache keys matching a pattern.
     * Marks entries as immediately stale or deletes them.
     */
    public invalidate(pattern: string, tenantId?: string, soft = true): void {
        const targetTenant = tenantId || this.activeTenantId;
        const keysToInvalidate: string[] = [];

        for (const [key, entry] of this.memoryCache.entries()) {
            if (!targetTenant || entry.tenantId === targetTenant) {
                if (key === pattern || key.includes(pattern)) {
                    keysToInvalidate.push(key);
                }
            }
        }

        keysToInvalidate.forEach(key => {
            if (soft) {
                const entry = this.memoryCache.get(key);
                if (entry) {
                    entry.staleAt = 0; // Force immediate revalidation on next access
                    this.memoryCache.set(key, entry);
                    // Update persistent storage
                    const storage = this.getStorage();
                    if (storage) {
                        try {
                            const storageKey = this.buildStorageKey(key, entry.tenantId);
                            storage.setItem(storageKey, JSON.stringify(entry));
                        } catch (_) {}
                    }
                }
            } else {
                this.delete(key, targetTenant || undefined);
            }
        });

        this.metrics.invalidations++;
    }

    /**
     * Delete a specific cache key from all tiers.
     */
    public delete(key: string, tenantId?: string): void {
        this.memoryCache.delete(key);
        const storage = this.getStorage();
        if (storage) {
            try {
                const storageKey = this.buildStorageKey(key, tenantId || this.activeTenantId || undefined);
                storage.removeItem(storageKey);
            } catch (_) {}
        }
        this.metrics.memoryEntryCount = this.memoryCache.size;
    }

    /**
     * Clear all cached data for a specific tenant (e.g. tenant switch or logout).
     */
    public clearTenant(tenantId: string): void {
        if (!tenantId) return;

        // Clear from memory
        for (const [key, entry] of this.memoryCache.entries()) {
            if (entry.tenantId === tenantId) {
                this.memoryCache.delete(key);
            }
        }

        // Clear from storage
        const storage = this.getStorage();
        if (storage) {
            const prefix = `${STORAGE_PREFIX}${tenantId}:`;
            const keysToRemove: string[] = [];
            for (let i = 0; i < storage.length; i++) {
                const k = storage.key(i);
                if (k && k.startsWith(prefix)) {
                    keysToRemove.push(k);
                }
            }
            keysToRemove.forEach(k => storage.removeItem(k));
        }

        this.metrics.memoryEntryCount = this.memoryCache.size;
    }

    /**
     * Clear all admin cache across all tenants (e.g. on full user sign out).
     */
    public clearAll(): void {
        this.memoryCache.clear();
        this.listeners.clear();

        const storage = this.getStorage();
        if (storage) {
            const keysToRemove: string[] = [];
            for (let i = 0; i < storage.length; i++) {
                const k = storage.key(i);
                if (k && (k.startsWith(STORAGE_PREFIX) || k.startsWith('ros_adm_cache_'))) {
                    keysToRemove.push(k);
                }
            }
            keysToRemove.forEach(k => storage.removeItem(k));
        }

        this.activeTenantId = null;
        this.activeUserId = null;
        this.metrics.memoryEntryCount = 0;
        this.metrics.storageEntryCount = 0;
        this.metrics.storageSizeBytes = 0;
    }

    /**
     * Subscribe to updates for a specific cache key with optional tenant isolation.
     */
    public subscribe<T>(
        key: string,
        listener: CacheChangeListener<T>,
        options?: { tenantId?: string }
    ): () => void {
        const targetTenant = options?.tenantId || this.activeTenantId;
        const listenKey = targetTenant ? `${targetTenant}:${key}` : key;

        if (!this.listeners.has(listenKey)) {
            this.listeners.set(listenKey, new Set());
        }
        this.listeners.get(listenKey)!.add(listener);

        return () => {
            const set = this.listeners.get(listenKey);
            if (set) {
                set.delete(listener);
                if (set.size === 0) {
                    this.listeners.delete(listenKey);
                }
            }
        };
    }

    private notifyListeners<T>(key: string, data: T, entry: AdminCacheEntry<T>): void {
        const scopedKey = `${entry.tenantId}:${key}`;
        const targets = new Set<CacheChangeListener<any>>();

        // 1. Listeners registered with this tenant's scope
        const scopedSet = this.listeners.get(scopedKey);
        if (scopedSet) scopedSet.forEach(l => targets.add(l));

        // 2. Global/unscoped listeners (registered directly on key)
        const directSet = this.listeners.get(key);
        if (directSet) {
            directSet.forEach(l => targets.add(l));
        }

        targets.forEach(listener => {
            try {
                listener(data, entry);
            } catch (err) {
                console.error(`[AdminCacheManager] Listener error for key "${key}":`, err);
            }
        });
    }

    /**
     * Evicts the oldest entry in L1 memory cache.
     */
    private evictOldestMemoryEntry(): void {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;

        for (const [k, v] of this.memoryCache.entries()) {
            if (v.updatedAt < oldestTime) {
                oldestTime = v.updatedAt;
                oldestKey = k;
            }
        }

        if (oldestKey) {
            this.memoryCache.delete(oldestKey);
            this.metrics.evictions++;
        }
    }

    /**
     * Prunes oldest 25% of entries from persistent storage when quota is reached.
     */
    private pruneStorageSpace(): void {
        const storage = this.getStorage();
        if (!storage) return;

        try {
            const items: { key: string; updatedAt: number; size: number }[] = [];
            for (let i = 0; i < storage.length; i++) {
                const k = storage.key(i);
                if (k && k.startsWith(STORAGE_PREFIX)) {
                    const raw = storage.getItem(k);
                    if (raw) {
                        try {
                            const parsed = JSON.parse(raw);
                            items.push({ key: k, updatedAt: parsed.updatedAt || 0, size: raw.length });
                        } catch (_) {
                            items.push({ key: k, updatedAt: 0, size: raw.length });
                        }
                    }
                }
            }

            // Sort oldest first
            items.sort((a, b) => a.updatedAt - b.updatedAt);

            // Remove oldest 30%
            const toRemoveCount = Math.max(1, Math.ceil(items.length * 0.3));
            for (let i = 0; i < toRemoveCount; i++) {
                storage.removeItem(items[i].key);
                this.metrics.evictions++;
            }
        } catch (_) {}
    }

    /**
     * Attach dev metrics to window.__ROS_ADMIN_CACHE__
     */
    private attachObservability(): void {
        if (typeof window === 'undefined') return;

        (window as any).__ROS_ADMIN_CACHE__ = {
            getMetrics: () => ({ ...this.metrics }),
            printSummary: () => {
                const hitRate = (this.metrics.hits + this.metrics.staleHits) /
                    Math.max(1, (this.metrics.hits + this.metrics.staleHits + this.metrics.misses));
                console.table({
                    'Active Tenant': this.metrics.activeTenantId || 'None',
                    'Cache Hit Rate': `${(hitRate * 100).toFixed(1)}%`,
                    'Fresh Hits': this.metrics.hits,
                    'Stale Hits (SWR)': this.metrics.staleHits,
                    'Cache Misses': this.metrics.misses,
                    'Deduplicated Requests': this.metrics.deduplicatedRequests,
                    'Total Network Requests': this.metrics.totalNetworkRequests,
                    'Memory Entries': this.metrics.memoryEntryCount,
                    'Storage Entries': this.metrics.storageEntryCount,
                    'Storage Size (KB)': Math.round(this.metrics.storageSizeBytes / 1024),
                });
            },
            inspectKeys: () => Array.from(this.memoryCache.keys()),
            clear: () => this.clearAll(),
            invalidate: (pattern: string) => this.invalidate(pattern),
        };
    }

    // Helper metrics incrementors for request manager
    public recordDeduplication(): void {
        this.metrics.deduplicatedRequests++;
    }

    public recordNetworkRequest(): void {
        this.metrics.totalNetworkRequests++;
    }
}

export const adminCacheManager = new AdminCacheManager();
