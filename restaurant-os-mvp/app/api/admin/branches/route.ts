import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyJwt, extractTokenForRestaurant } from '@/lib/jwt-utils';
import { resolveRestaurantId } from '@/services/utils.service';

/**
 * GET /api/admin/branches
 * Fetches all branches for a restaurant.
 * Auto-creates a default "Main Branch" if no branches exist.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        let restaurantId = searchParams.get('restaurantId') || searchParams.get('restaurantCode') || '';

        // Check authentication (prefers restaurant-scoped token)
        const token = extractTokenForRestaurant(req.cookies, restaurantId);
        let user: any = null;
        if (token) {
            user = await verifyJwt(token);
        }

        if (!restaurantId && user?.restaurantId) {
            restaurantId = user.restaurantId;
        }

        if (!restaurantId) {
            return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
        }

        const resolvedId = await resolveRestaurantId(restaurantId);

        const { data, error } = await supabaseAdmin
            .from('branches')
            .select('*')
            .eq('restaurant_id', resolvedId)
            .order('name', { ascending: true });

        if (error) {
            console.error('[api/admin/branches] Error fetching branches:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        let branches = data || [];

        // If no branches exist for this restaurant, create a default Main Branch
        if (branches.length === 0) {
            const shortId = resolvedId.replace(/[^0-9a-zA-Z]/g, '').slice(-6) || 'MAIN';
            const defaultBranch = {
                id: `BR-${shortId}-01`,
                restaurant_id: resolvedId,
                name: 'Main Branch',
                is_main_branch: true,
                status: 'active'
            };

            const { data: createdBranch, error: insertError } = await supabaseAdmin
                .from('branches')
                .insert(defaultBranch)
                .select()
                .maybeSingle();

            if (!insertError && createdBranch) {
                branches = [createdBranch];
            } else {
                branches = [defaultBranch];
            }
        }

        return NextResponse.json({ success: true, branches });
    } catch (err: any) {
        console.error('[api/admin/branches] Unexpected error:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
