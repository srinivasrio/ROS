import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminUserFromRequest } from '@/lib/jwt-utils';
import { resolveRestaurantId } from '@/services/utils.service';
import { verifyFeatureEntitlement } from '@/lib/entitlement-guard';

/**
 * GET /api/admin/inventory?restaurantId=xxx
 * Server-side API endpoint for inventory items with strict entitlement enforcement.
 */
export async function GET(request: NextRequest) {
    try {
        const rawRestaurantId = request.nextUrl.searchParams.get('restaurantId') || request.nextUrl.searchParams.get('restaurantCode');
        if (!rawRestaurantId) {
            return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
        }

        const restaurantId = (await resolveRestaurantId(rawRestaurantId)) || rawRestaurantId;

        // Server-Side Entitlement Authorization Check
        const entitlementCheck = await verifyFeatureEntitlement(restaurantId, 'inventory');
        if (!entitlementCheck.allowed) {
            return entitlementCheck.response;
        }

        const { data: items, error } = await supabaseAdmin
            .from('inventory_items')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('name');

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ items: items || [] });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
