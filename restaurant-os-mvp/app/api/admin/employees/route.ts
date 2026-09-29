import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyJwt, extractTokenForRestaurant } from '@/lib/jwt-utils';
import { resolveRestaurantId } from '@/services/utils.service';

/**
 * GET /api/admin/employees
 * Fetches all employees for a restaurant.
 * Avoids direct client-to-Supabase queries which can be blocked by browser extensions/firewalls.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        let restaurantId = searchParams.get('restaurantId') || searchParams.get('restaurantCode') || '';
        const includeDeleted = searchParams.get('includeDeleted') === 'true';

        // Check authentication (prefers restaurant-scoped token)
        const token = extractTokenForRestaurant(req.cookies, restaurantId);
        let user: any = null;
        if (token) {
            user = await verifyJwt(token);
        }

        // Fallback to user's restaurant_id if not provided in query
        if (!restaurantId && user?.restaurantId) {
            restaurantId = user.restaurantId;
        }

        if (!restaurantId) {
            return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
        }

        const resolvedId = await resolveRestaurantId(restaurantId);

        let query = supabaseAdmin
            .from('employees')
            .select(`
                *,
                branch:branch_id (
                    id,
                    name
                )
            `)
            .eq('restaurant_id', resolvedId);

        if (includeDeleted) {
            query = query.eq('is_deleted', true).order('deleted_at', { ascending: false });
        } else {
            query = query.eq('is_deleted', false).order('name', { ascending: true });
        }

        const { data, error } = await query;

        if (error) {
            console.warn('[api/admin/employees] Branch join query failed, trying fallback select:', error);
            // Fallback without join in case of relation mismatch
            let fallbackQuery = supabaseAdmin
                .from('employees')
                .select('*')
                .eq('restaurant_id', resolvedId);

            if (includeDeleted) {
                fallbackQuery = fallbackQuery.eq('is_deleted', true).order('deleted_at', { ascending: false });
            } else {
                fallbackQuery = fallbackQuery.eq('is_deleted', false).order('name', { ascending: true });
            }

            const { data: fallbackData, error: fallbackError } = await fallbackQuery;
            if (fallbackError) {
                console.error('[api/admin/employees] Error fetching employees:', fallbackError);
                return NextResponse.json({ error: fallbackError.message }, { status: 500 });
            }
            return NextResponse.json({ success: true, employees: fallbackData || [] });
        }

        return NextResponse.json({ success: true, employees: data || [] });
    } catch (err: any) {
        console.error('[api/admin/employees] Unexpected error:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
