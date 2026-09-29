'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { adminCacheManager, CacheOptions } from '@/lib/cache/admin-cache-manager';
import { requestManager, RequestPriority } from '@/lib/cache/request-manager';
import { useRestaurantId } from '@/hooks/useRestaurantId';
import { useParams } from 'next/navigation';

export interface UseAdminSectionOptions<T> extends CacheOptions {
    priority?: RequestPriority;
    enabled?: boolean;
    onSuccess?: (data: T) => void;
    onError?: (error: any) => void;
}

export interface UseAdminSectionResult<T> {
    data: T | null;
    isLoading: boolean;
    isRevalidating: boolean;
    error: Error | null;
    mutate: (newData: T | ((prev: T | null) => T), options?: { persist?: boolean; revalidate?: boolean }) => void;
    refresh: () => Promise<T | null>;
    invalidate: () => void;
}

/**
 * Unified Cache-First Stale-While-Revalidate Hook for Admin Panel Sections.
 * 
 * Guarantees:
 * - 0ms instant display from local L1/L2 cache
 * - Automatic background revalidation without full-screen loading screens
 * - Strict tenant isolation
 * - Reactive cross-component cache subscription
 * - Optimistic mutations with write-through cache update
 */
export function useAdminSection<T = any>(
    sectionKey: string,
    fetcher: () => Promise<T>,
    options?: UseAdminSectionOptions<T>
): UseAdminSectionResult<T> {
    const params = useParams();
    const urlRestaurantCode = (params?.restaurantCode as string) || '';
    const { restaurantId } = useRestaurantId();

    const activeTenantId = restaurantId || urlRestaurantCode || adminCacheManager.getActiveTenantId() || '';
    const fullKey = activeTenantId ? `${sectionKey}-${activeTenantId}` : sectionKey;

    const enabled = options?.enabled ?? true;
    const priority = options?.priority ?? 2;
    const isRealtime = options?.isRealtime ?? false;
    const staleTimeMs = options?.staleTimeMs;
    const ttlMs = options?.ttlMs;

    // 1. Initial Synchronous Cache Lookup (0ms visual delay)
    const initialCache = activeTenantId
        ? adminCacheManager.get<T>(fullKey, { tenantId: activeTenantId, maxAgeMs: staleTimeMs, isRealtime })
        : null;

    const [data, setData] = useState<T | null>(initialCache ? initialCache.data : null);
    const [isLoading, setIsLoading] = useState<boolean>(!initialCache && enabled);
    const [isRevalidating, setIsRevalidating] = useState<boolean>(
        initialCache ? initialCache.isStale && enabled : false
    );
    const [error, setError] = useState<Error | null>(null);

    const isMountedRef = useRef(true);
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;

    // Ensure tenant is active in manager
    useEffect(() => {
        if (activeTenantId) {
            adminCacheManager.setTenant(activeTenantId);
        }
    }, [activeTenantId]);

    // 2. Main Data Execution Logic (SWR)
    const executeFetch = useCallback(async (force = false): Promise<T | null> => {
        if (!enabled || !activeTenantId) return null;

        const cached = adminCacheManager.get<T>(fullKey, {
            tenantId: activeTenantId,
            maxAgeMs: staleTimeMs,
            isRealtime
        });

        // If fresh cache exists and not forced, return immediately
        if (!force && cached && !cached.isStale) {
            if (isMountedRef.current) {
                setData(cached.data);
                setIsLoading(false);
                setIsRevalidating(false);
            }
            return cached.data;
        }

        // Stale Cache: keep displaying stale data while revalidating
        if (cached) {
            if (isMountedRef.current) {
                setData(cached.data);
                setIsLoading(false);
                setIsRevalidating(true);
            }
        } else {
            if (isMountedRef.current) {
                setIsLoading(true);
            }
        }

        try {
            const freshData = await requestManager.enqueue(
                fullKey,
                () => fetcherRef.current(),
                { priority: force ? 1 : priority, retries: 2 }
            );

            if (isMountedRef.current && freshData !== undefined && freshData !== null) {
                adminCacheManager.set(fullKey, freshData, {
                    tenantId: activeTenantId,
                    staleTimeMs,
                    ttlMs,
                    isRealtime
                });
                setData(freshData);
                setError(null);
                options?.onSuccess?.(freshData);
            }
            return freshData;
        } catch (err: any) {
            console.warn(`[useAdminSection] Revalidation failed for "${fullKey}":`, err);
            if (isMountedRef.current) {
                setError(err instanceof Error ? err : new Error(String(err)));
                options?.onError?.(err);
                // Retain existing cached data on network failure! Never destroy valid cache.
            }
            return cached ? cached.data : null;
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
                setIsRevalidating(false);
            }
        }
    }, [enabled, activeTenantId, fullKey, staleTimeMs, isRealtime, priority, ttlMs]);

    // Run fetch on mount or tenant/key change
    useEffect(() => {
        isMountedRef.current = true;
        if (enabled && activeTenantId) {
            executeFetch(false);
        }

        // 3. Subscribe to cache events for this key across components
        const unsubscribe = adminCacheManager.subscribe<T>(fullKey, (newData) => {
            if (isMountedRef.current) {
                setData(newData);
                setIsLoading(false);
            }
        });

        return () => {
            isMountedRef.current = false;
            unsubscribe();
        };
    }, [fullKey, enabled, activeTenantId, executeFetch]);

    // 4. Optimistic Mutation Handler
    const mutate = useCallback(
        (
            newData: T | ((prev: T | null) => T),
            mutationOptions?: { persist?: boolean; revalidate?: boolean }
        ) => {
            setData(prev => {
                const resolved = typeof newData === 'function' ? (newData as any)(prev) : newData;
                if (mutationOptions?.persist !== false && activeTenantId) {
                    adminCacheManager.set(fullKey, resolved, {
                        tenantId: activeTenantId,
                        staleTimeMs,
                        ttlMs,
                        isRealtime
                    });
                }
                return resolved;
            });

            if (mutationOptions?.revalidate) {
                executeFetch(true);
            }
        },
        [fullKey, activeTenantId, staleTimeMs, ttlMs, isRealtime, executeFetch]
    );

    const refresh = useCallback(() => executeFetch(true), [executeFetch]);

    const invalidate = useCallback(() => {
        if (activeTenantId) {
            adminCacheManager.invalidate(fullKey, activeTenantId);
            executeFetch(true);
        }
    }, [fullKey, activeTenantId, executeFetch]);

    return {
        data,
        isLoading,
        isRevalidating,
        error,
        mutate,
        refresh,
        invalidate
    };
}
