'use client';

/**
 * Global client-side data cache for admin pages.
 * 
 * Uses a stale-while-revalidate strategy:
 * - If cached data exists, return it INSTANTLY (0ms delay)
 * - Still fetch fresh data in the background
 * - Update UI seamlessly when fresh data arrives
 * 
 * This eliminates the 2-second loading spinner on every sidebar navigation.
 */

const cache = new Map<string, { data: any; timestamp: number }>();

// Cache TTL - data older than this is considered stale (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Get cached data for a key. Returns null if no cache exists.
 */
export function getCached<T>(key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    return entry.data as T;
}

/**
 * Set cached data for a key.
 */
export function setCache<T>(key: string, data: T): void {
    cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Check if cache entry exists (regardless of age).
 */
export function hasCache(key: string): boolean {
    return cache.has(key);
}

/**
 * Clear all cached data (e.g. on sign out).
 */
export function clearAllCache(): void {
    cache.clear();
}

/**
 * Clear a specific cache key.
 */
export function clearCache(key: string): void {
    cache.delete(key);
}
