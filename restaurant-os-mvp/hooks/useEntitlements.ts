'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
    FeatureKey,
    PlanSlug,
    SubscriptionStatus,
    RestaurantEntitlementResult,
} from '@/lib/entitlements-shared';

interface UseEntitlementsReturn {
    loading: boolean;
    error: string | null;
    entitlement: RestaurantEntitlementResult | null;
    hasFeature: (key: FeatureKey) => boolean;
    isLocked: (key: FeatureKey) => boolean;
    planName: string;
    planSlug: PlanSlug;
    status: SubscriptionStatus;
    isTrial: boolean;
    isSuspended: boolean;
    isExpired: boolean;
    daysRemaining: number | null;
    features: Record<FeatureKey, boolean>;
    refetch: () => Promise<void>;
}

export function useEntitlements(restaurantCode?: string | null): UseEntitlementsReturn {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [entitlement, setEntitlement] = useState<RestaurantEntitlementResult | null>(null);

    const fetchEntitlements = useCallback(async () => {
        if (!restaurantCode) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`/api/restaurant/${encodeURIComponent(restaurantCode)}/plan`, {
                headers: { 'Cache-Control': 'no-cache' }
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${res.status}`);
            }

            const data = await res.json();
            if (data.entitlement) {
                setEntitlement(data.entitlement);
            }
        } catch (err: any) {
            console.error('[useEntitlements] Error:', err);
            setError(err.message || 'Failed to load subscription entitlements');
        } finally {
            setLoading(false);
        }
    }, [restaurantCode]);

    useEffect(() => {
        fetchEntitlements();
    }, [fetchEntitlements]);

    const hasFeature = useCallback((key: FeatureKey): boolean => {
        if (!entitlement) return false;
        if (entitlement.isSuspended || entitlement.isExpired) return false;
        return Boolean(entitlement.features?.[key]);
    }, [entitlement]);

    const isLocked = useCallback((key: FeatureKey): boolean => {
        return !hasFeature(key);
    }, [hasFeature]);

    return {
        loading,
        error,
        entitlement,
        hasFeature,
        isLocked,
        planName: entitlement?.planName || 'Standard',
        planSlug: entitlement?.planSlug || 'standard',
        status: entitlement?.status || 'ACTIVE',
        isTrial: Boolean(entitlement?.isTrial),
        isSuspended: Boolean(entitlement?.isSuspended),
        isExpired: Boolean(entitlement?.isExpired),
        daysRemaining: entitlement?.daysRemaining ?? null,
        features: entitlement?.features || ({} as Record<FeatureKey, boolean>),
        refetch: fetchEntitlements,
    };
}
