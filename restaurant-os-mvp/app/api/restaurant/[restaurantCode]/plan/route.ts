import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

interface PlanCacheEntry {
    data: {
        id: string;
        name: string;
        logoUrl: string | null;
        status: string;
        subscriptionPlan: string;
    };
    expiresAt: number;
}

const planCache = new Map<string, PlanCacheEntry>();
const PLAN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

        const cached = planCache.get(cleanCode);
        if (cached && cached.expiresAt > Date.now()) {
            return NextResponse.json(cached.data, {
                headers: {
                    'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
                },
            });
        }

        // 1. Resolve ID if needed (could be numeric ID, UUID, PEND-, REST-, or slug)
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
        const subscriptionPlan = restaurantData?.subscription_plan || 'Pro';

        const responseData = {
            id: resolvedId,
            name,
            logoUrl,
            status: restaurantData?.status?.toUpperCase() || 'ACTIVE',
            subscriptionPlan,
        };

        planCache.set(cleanCode, { data: responseData, expiresAt: Date.now() + PLAN_CACHE_TTL });
        if (resolvedId !== cleanCode) {
            planCache.set(resolvedId, { data: responseData, expiresAt: Date.now() + PLAN_CACHE_TTL });
        }

        return NextResponse.json(responseData, {
            headers: {
                'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
            },
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
