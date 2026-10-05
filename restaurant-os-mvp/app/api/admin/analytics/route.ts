import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveRestaurantId } from '@/services/utils.service';
import { verifyFeatureEntitlement } from '@/lib/entitlement-guard';

/**
 * GET /api/admin/analytics?restaurantId=xxx&range=7d
 * Server-side API endpoint for advanced analytics with strict entitlement enforcement.
 */
export async function GET(request: NextRequest) {
    try {
        const rawRestaurantId = request.nextUrl.searchParams.get('restaurantId') || request.nextUrl.searchParams.get('restaurantCode');
        if (!rawRestaurantId) {
            return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
        }

        const restaurantId = (await resolveRestaurantId(rawRestaurantId)) || rawRestaurantId;

        // Server-Side Entitlement Authorization Check
        const entitlementCheck = await verifyFeatureEntitlement(restaurantId, 'advanced_reports');
        if (!entitlementCheck.allowed) {
            return entitlementCheck.response;
        }

        // Return authorized response or metrics summary
        return NextResponse.json({ 
            success: true, 
            restaurantId, 
            entitled: true,
            plan: entitlementCheck.entitlement.planName 
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
