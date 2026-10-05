import 'server-only';

import { supabaseAdmin } from '@/lib/supabase-admin';
import {
    CANONICAL_PLANS,
    FEATURE_DEFINITIONS,
    PLAN_FEATURE_MATRIX,
    normalizePlanSlug,
    type FeatureKey,
    type FeatureOverride,
    type RestaurantEntitlementResult,
    type SubscriptionStatus,
} from '@/lib/entitlements-shared';

export * from '@/lib/entitlements-shared';

// In-memory cache for fast lookup
interface CachedEntitlement {
    data: RestaurantEntitlementResult;
    expiresAt: number;
}
const entitlementCache = new Map<string, CachedEntitlement>();
const CACHE_TTL_MS = 15000; // 15 seconds

export function invalidateEntitlementCache(restaurantId?: string) {
    if (restaurantId) {
        entitlementCache.delete(restaurantId);
        // Also clear possible uppercase/clean versions
        entitlementCache.delete(restaurantId.trim());
    } else {
        entitlementCache.clear();
    }
}

/**
 * Centrally resolves all feature entitlements for an independent restaurant tenant.
 * Considers:
 * 1. Restaurant account status (ACTIVE, SUSPENDED, DELETED)
 * 2. Active subscription & billing cycle (TRIAL, ACTIVE, EXPIRED, CANCELLED, SUSPENDED)
 * 3. Base plan entitlement matrix
 * 4. Active Super Admin feature overrides (temporary grants, revoked features, add-ons)
 */
export async function resolveRestaurantEntitlements(restaurantId: string): Promise<RestaurantEntitlementResult> {
    const cleanId = String(restaurantId || '').trim();
    if (!cleanId) {
        throw new Error('Restaurant ID is required to resolve entitlements');
    }

    const cached = entitlementCache.get(cleanId);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
    }

    // 1. Fetch Restaurant & Active Subscription & Overrides in parallel
    const [restRes, subRes, overridesRes] = await Promise.all([
        supabaseAdmin
            .from('restaurants')
            .select('id, name, status, subscription_plan, max_branches, custom_quota, created_at')
            .eq('id', cleanId)
            .maybeSingle(),
        supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('restaurant_id', cleanId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabaseAdmin
            .from('restaurant_feature_overrides')
            .select('*')
            .eq('restaurant_id', cleanId),
    ]);

    // Entitlements are an authorization decision. Never silently turn a
    // database error or an unknown restaurant into an active Standard plan.
    if (restRes.error) {
        throw new Error(`Failed to resolve restaurant entitlement: ${restRes.error.message}`);
    }
    if (subRes.error) {
        throw new Error(`Failed to resolve subscription entitlement: ${subRes.error.message}`);
    }
    if (overridesRes.error) {
        throw new Error(`Failed to resolve feature overrides: ${overridesRes.error.message}`);
    }

    const restaurant = restRes.data;
    const subscription = subRes.data;
    const dbOverrides = overridesRes.data || [];

    if (!restaurant) {
        throw new Error('Restaurant not found while resolving entitlements');
    }

    const restaurantName = restaurant?.name || cleanId;
    const rawPlan = subscription?.plan_name || restaurant?.subscription_plan || 'standard';
    const planSlug = normalizePlanSlug(rawPlan);
    const planDef = CANONICAL_PLANS[planSlug] || CANONICAL_PLANS.standard;

    // 2. Lifecycle Evaluation
    const now = Date.now();
    const restStatus = (restaurant?.status || 'ACTIVE').toUpperCase();
    const subStatus = (subscription?.status || (planSlug === 'trial-14' ? 'trialing' : 'active')).toLowerCase();

    let status: SubscriptionStatus = 'ACTIVE';

    const unapprovedStatuses = ['PENDING', 'PENDING_APPROVAL', 'PENDING_PAYMENT', 'PAYMENT_RECEIVED', 'DRAFT', 'REJECTED', 'CANCELLED', 'SUSPENDED', 'INACTIVE'];
    if (unapprovedStatuses.includes(restStatus)) {
        status = 'SUSPENDED';
    } else if (subStatus === 'past_due' || subStatus === 'expired') {
        status = 'EXPIRED';
    } else if (subStatus === 'canceled' || subStatus === 'cancelled' || subscription?.canceled_at) {
        // If canceled, allow access until current_period_end (grace period)
        if (subscription?.current_period_end && new Date(subscription.current_period_end).getTime() > now) {
            status = 'CANCELLED';
        } else {
            status = 'EXPIRED';
        }
    } else if (subStatus === 'trialing' || planSlug === 'trial-14') {
        if (subscription?.trial_ends_at && new Date(subscription.trial_ends_at).getTime() < now) {
            status = 'EXPIRED';
        } else {
            status = 'TRIAL';
        }
    } else {
        // Active subscription check
        if (subscription?.current_period_end && new Date(subscription.current_period_end).getTime() < now) {
            // Expired unless within 24hr renewal window
            const expiryDiff = now - new Date(subscription.current_period_end).getTime();
            if (expiryDiff > 24 * 60 * 60 * 1000) {
                status = 'EXPIRED';
            } else {
                status = 'ACTIVE';
            }
        } else {
            status = 'ACTIVE';
        }
    }

    const isSuspended = status === 'SUSPENDED';
    const isExpired = status === 'EXPIRED';
    const isTrial = status === 'TRIAL';

    // Days remaining calculation
    let daysRemaining: number | null = null;
    if (isTrial && subscription?.trial_ends_at) {
        const diff = new Date(subscription.trial_ends_at).getTime() - now;
        daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    } else if ((status === 'ACTIVE' || status === 'CANCELLED') && subscription?.current_period_end) {
        const diff = new Date(subscription.current_period_end).getTime() - now;
        daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    // 3. Resolve Base Features from Matrix
    const baseFeatures = { ...PLAN_FEATURE_MATRIX[planSlug] };

    // 4. Merge Super Admin Overrides
    // Process DB overrides table
    const activeOverrides: FeatureOverride[] = [];

    for (const ov of dbOverrides) {
        const fKey = ov.feature_key as FeatureKey;
        if (!FEATURE_DEFINITIONS[fKey]) continue;

        const startsAt = ov.starts_at ? new Date(ov.starts_at).getTime() : 0;
        const expiresAt = ov.expires_at ? new Date(ov.expires_at).getTime() : null;

        // Check if override is currently valid
        const isStarted = startsAt <= now;
        const isNotExpired = expiresAt === null || expiresAt > now;

        if (isStarted && isNotExpired) {
            baseFeatures[fKey] = Boolean(ov.enabled);
            activeOverrides.push({
                featureKey: fKey,
                enabled: Boolean(ov.enabled),
                reason: ov.reason || undefined,
                createdBy: ov.created_by || undefined,
                startsAt: ov.starts_at || undefined,
                expiresAt: ov.expires_at || null,
            });
        }
    }

    // Also process any inline feature_overrides array from subscriptions record if present
    if (Array.isArray(subscription?.feature_overrides)) {
        for (const ov of subscription.feature_overrides) {
            const fKey = ov.featureKey as FeatureKey || ov.feature as FeatureKey;
            if (!FEATURE_DEFINITIONS[fKey]) continue;

            const startsAt = ov.startsAt ? new Date(ov.startsAt).getTime() : 0;
            const expiresAt = ov.expiresAt ? new Date(ov.expiresAt).getTime() : null;

            if (startsAt <= now && (expiresAt === null || expiresAt > now)) {
                baseFeatures[fKey] = Boolean(ov.enabled);
                if (!activeOverrides.some(a => a.featureKey === fKey)) {
                    activeOverrides.push({
                        featureKey: fKey,
                        enabled: Boolean(ov.enabled),
                        reason: ov.reason,
                        createdBy: ov.createdBy,
                        startsAt: ov.startsAt,
                        expiresAt: ov.expiresAt,
                    });
                }
            }
        }
    }

    // 5. If SUSPENDED, completely revoke all operational features immediately
    if (isSuspended) {
        (Object.keys(baseFeatures) as FeatureKey[]).forEach(k => {
            baseFeatures[k] = false;
        });
    }

    // 6. Build locked vs available feature lists
    const availableFeatures: FeatureKey[] = [];
    const lockedFeatures: FeatureKey[] = [];

    (Object.keys(FEATURE_DEFINITIONS) as FeatureKey[]).forEach(k => {
        if (baseFeatures[k]) {
            availableFeatures.push(k);
        } else {
            lockedFeatures.push(k);
        }
    });

    const customQuota = typeof (restaurant as any)?.custom_quota === 'number' && (restaurant as any).custom_quota > 0
        ? (restaurant as any).custom_quota
        : null;
    const maxRestaurants = customQuota || subscription?.max_branches || planDef.maxRestaurants;
    const maxEmployees = subscription?.max_employees || planDef.maxEmployees;

    const result: RestaurantEntitlementResult = {
        restaurantId: cleanId,
        restaurantName,
        planSlug,
        planName: planDef.name,
        status,
        isTrial,
        isSuspended,
        isExpired,
        daysRemaining,
        currentPeriodEnd: subscription?.current_period_end || null,
        trialEndsAt: subscription?.trial_ends_at || null,
        maxRestaurants,
        maxEmployees,
        features: baseFeatures,
        overrides: activeOverrides,
        lockedFeatures,
        availableFeatures,
        canAccess: (feature: FeatureKey) => {
            if (isSuspended) return false;
            if (isExpired) return false;
            return Boolean(baseFeatures[feature]);
        },
    };

    entitlementCache.set(cleanId, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });

    return result;
}

/**
 * Lightweight helper to check access to a single feature with professional messaging
 */
export async function canRestaurantAccessFeature(
    restaurantId: string,
    featureKey: FeatureKey
): Promise<{
    allowed: boolean;
    reason?: string;
    requiredPlan?: string;
    upgradeMessage?: string;
    entitlement: RestaurantEntitlementResult;
}> {
    const entitlement = await resolveRestaurantEntitlements(restaurantId);
    const meta = FEATURE_DEFINITIONS[featureKey];

    if (entitlement.isSuspended) {
        return {
            allowed: false,
            reason: 'Restaurant account is suspended. Please contact platform support.',
            requiredPlan: meta?.minimumPlanLabel,
            upgradeMessage: 'Account is currently suspended. Operational access is locked.',
            entitlement,
        };
    }

    if (entitlement.isExpired) {
        return {
            allowed: false,
            reason: 'Subscription has expired. Please renew your subscription to access this feature.',
            requiredPlan: meta?.minimumPlanLabel,
            upgradeMessage: `Your subscription has expired. Please renew to continue using ${meta?.label || 'this feature'}.`,
            entitlement,
        };
    }

    if (!entitlement.features[featureKey]) {
        return {
            allowed: false,
            reason: meta?.upgradeMessage || `Access requires ${meta?.minimumPlanLabel} plan.`,
            requiredPlan: meta?.minimumPlanLabel,
            upgradeMessage: meta?.upgradeMessage || `This feature requires the ${meta?.minimumPlanLabel} plan or higher.`,
            entitlement,
        };
    }

    return {
        allowed: true,
        entitlement,
    };
}
