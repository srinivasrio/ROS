import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveRestaurantEntitlements, invalidateEntitlementCache } from '@/lib/entitlements';
import { handleConditionalResponse } from '@/lib/api-cache';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ restaurantCode: string }> }
) {
    try {
        const { restaurantCode } = await params;
        const cleanCode = String(restaurantCode || '').trim();
        if (!cleanCode) {
            return NextResponse.json({ error: 'Restaurant code required' }, { status: 400 });
        }

        // 1. Resolve restaurant ID (could be numeric ID, UUID, PEND-, REST-, or slug)
        let resolvedId = cleanCode;
        const { data: directRest } = await supabaseAdmin
            .from('restaurants')
            .select('id, name, status, subscription_plan')
            .eq('id', cleanCode)
            .maybeSingle();

        let restaurantData = directRest;

        if (!restaurantData) {
            const { data: bySlug } = await supabaseAdmin
                .from('restaurant_profile')
                .select('restaurant_id')
                .eq('slug', cleanCode.toLowerCase())
                .maybeSingle();

            if (bySlug?.restaurant_id) {
                resolvedId = bySlug.restaurant_id;
                const { data: byResolved } = await supabaseAdmin
                    .from('restaurants')
                    .select('id, name, status, subscription_plan')
                    .eq('id', resolvedId)
                    .maybeSingle();
                restaurantData = byResolved;
            }
        }

        // 2. Fetch logo and details from restaurant_profile
        const { data: profile } = await supabaseAdmin
            .from('restaurant_profile')
            .select('name, restaurant_info')
            .eq('restaurant_id', resolvedId)
            .maybeSingle();

        const profileInfo = (profile?.restaurant_info as any) || {};
        const name = restaurantData?.name || profileInfo.name || profile?.name || 'Restaurant OS';
        const logoUrl = profileInfo.logo_url || null;

        // 3. Centrally resolve real-time feature entitlements from subscription & database
        const url = new URL(request.url);
        if (url.searchParams.get('fresh') === 'true') {
            invalidateEntitlementCache(resolvedId);
        }
        const entitlement = await resolveRestaurantEntitlements(resolvedId);

        const responseData = {
            id: resolvedId,
            name,
            logoUrl,
            status: entitlement.status,
            subscriptionPlan: entitlement.planName,
            planSlug: entitlement.planSlug,
            isTrial: entitlement.isTrial,
            isSuspended: entitlement.isSuspended,
            isExpired: entitlement.isExpired,
            daysRemaining: entitlement.daysRemaining,
            currentPeriodEnd: entitlement.currentPeriodEnd,
            trialEndsAt: entitlement.trialEndsAt,
            maxRestaurants: entitlement.maxRestaurants,
            maxEmployees: entitlement.maxEmployees,
            features: entitlement.features,
            lockedFeatures: entitlement.lockedFeatures,
            availableFeatures: entitlement.availableFeatures,
            overrides: entitlement.overrides,
            entitlement,
        };

        return handleConditionalResponse(request, responseData, {
            extraHeaders: {
                'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
            },
        });
    } catch (err: any) {
        console.error('[API /restaurant/[code]/plan GET] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
