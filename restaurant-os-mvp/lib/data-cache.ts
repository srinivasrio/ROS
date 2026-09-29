'use client';

import { adminCacheManager, AdminCacheEntry, CacheOptions } from './cache/admin-cache-manager';
import { requestManager } from './cache/request-manager';

/**
 * Backward-Compatible Facade for Data Cache.
 * All operations delegate cleanly to AdminCacheManager and RequestManager.
 */

let _isHydrated = false;
const _hydrationListeners = new Set<() => void>();

export function markAppHydrated(): void {
    if (!_isHydrated) {
        _isHydrated = true;
        adminCacheManager.rehydrateFromStorage();
        _hydrationListeners.forEach(listener => {
            try { listener(); } catch (_) {}
        });
    }
}

export function isAppHydrated(): boolean {
    return _isHydrated;
}

// Auto-mark hydrated after the initial hydration pass in the browser
if (typeof window !== 'undefined') {
    setTimeout(() => {
        markAppHydrated();
    }, 0);
}

export function rehydrateCacheFromStorage(): void {
    markAppHydrated();
}

export function getCached<T>(key: string, maxAgeMs?: number): T | null {
    if (!_isHydrated) return null;
    const res = adminCacheManager.get<T>(key, { maxAgeMs });
    return res ? res.data : null;
}

export function hasFreshCache(key: string, maxAgeMs?: number): boolean {
    if (!_isHydrated && typeof window !== 'undefined') {
        markAppHydrated();
    }
    if (!_isHydrated) return false;
    return adminCacheManager.hasFresh(key, { maxAgeMs });
}

export function coalesceRequest<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    return requestManager.coalesce<T>(key, fetcher);
}

export function isInFlight(key: string): boolean {
    return requestManager.isInFlight(key);
}

export async function fetchWithCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: { maxAgeMs?: number; forceRefresh?: boolean; silentRevalidate?: (data: T) => void }
): Promise<T> {
    return requestManager.fetchWithCache<T>(key, fetcher, {
        staleTimeMs: options?.maxAgeMs,
        forceRefresh: options?.forceRefresh,
        onBackgroundUpdate: options?.silentRevalidate
    });
}

export function setCache<T>(key: string, data: T, options?: CacheOptions): void {
    adminCacheManager.set<T>(key, data, options);
}

export function hasCache(key: string): boolean {
    return adminCacheManager.has(key);
}

export function clearCache(key: string): void {
    adminCacheManager.delete(key);
}

export function clearAllCache(): void {
    adminCacheManager.clearAll();
    requestManager.clearQueue();
}

// Re-export core modules for advanced usage
export { adminCacheManager } from './cache/admin-cache-manager';
export { requestManager } from './cache/request-manager';
export { adminPreloadManager } from './cache/preload-manager';
