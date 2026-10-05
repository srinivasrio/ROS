import { NextResponse } from 'next/server';
import { resolveRestaurantEntitlements, canRestaurantAccessFeature, FeatureKey, RestaurantEntitlementResult, FEATURE_DEFINITIONS } from './entitlements';

export type EntitlementCheckResult = 
    | { allowed: true; entitlement: RestaurantEntitlementResult }
    | { allowed: false; response: NextResponse; entitlement: RestaurantEntitlementResult };

/**
 * Server-side guard to verify feature access for an API endpoint.
 * Returns either allowed: true with the full entitlement context,
 * or allowed: false with a ready-to-return 403 Forbidden NextResponse.
 */
export async function verifyFeatureEntitlement(
    restaurantId: string,
    featureKey: FeatureKey
): Promise<EntitlementCheckResult> {
    const cleanId = String(restaurantId || '').trim();
    if (!cleanId) {
        return {
            allowed: false,
            response: NextResponse.json(
                { error: 'RESTAURANT_ID_REQUIRED', message: 'Restaurant identifier is required for entitlement authorization' },
                { status: 400 }
            ),
            entitlement: null as any
        };
    }

    const check = await canRestaurantAccessFeature(cleanId, featureKey);
    const meta = FEATURE_DEFINITIONS[featureKey];

    if (!check.allowed) {
        return {
            allowed: false,
            response: NextResponse.json(
                {
                    error: 'FEATURE_ACCESS_RESTRICTED',
                    code: 'FEATURE_NOT_ENTITLED',
                    feature: featureKey,
                    featureName: meta?.label || featureKey,
                    message: check.reason || check.upgradeMessage || 'This feature is not included in your active subscription.',
                    requiredPlan: check.requiredPlan || meta?.minimumPlanLabel || 'Growth',
                    upgradeMessage: check.upgradeMessage || meta?.upgradeMessage || `Please upgrade your plan to access ${meta?.label || featureKey}.`,
                    currentPlan: check.entitlement.planName,
                    currentPlanSlug: check.entitlement.planSlug,
                    subscriptionStatus: check.entitlement.status,
                    isTrial: check.entitlement.isTrial,
                    daysRemaining: check.entitlement.daysRemaining
                },
                { status: 403 }
            ),
            entitlement: check.entitlement
        };
    }

    return {
        allowed: true,
        entitlement: check.entitlement
    };
}
