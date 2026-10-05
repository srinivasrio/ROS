import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedOwner, resolveOwnerScope } from '@/lib/owner-auth';

// Valid PostgreSQL enum order_status values:
// 'placed', 'preparing', 'ready', 'served', 'paid', 'cancelled', 'queued'
const ACTIVE_KITCHEN_STATUSES = ['queued', 'placed', 'preparing', 'ready'];

export async function GET(request: NextRequest) {
    try {
        const auth = await getAuthenticatedOwner(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const allRestaurantIds = (auth.restaurantIds && auth.restaurantIds.length > 0 ? auth.restaurantIds : (auth.restaurantId ? [auth.restaurantId] : [])).filter(Boolean);
        const branchFilter = request.nextUrl.searchParams.get('branch') || request.nextUrl.searchParams.get('restaurant');
        const statusFilter = request.nextUrl.searchParams.get('status');

        if (allRestaurantIds.length === 0) {
            return NextResponse.json({
                tickets: [],
                branches: [],
                stats: {
                    activeCount: 0,
                    preparingCount: 0,
                    readyCount: 0,
                    avgPrepMinutes: 0
                }
            });
        }

        // 1. Fetch all restaurants and branches belonging to this owner
        const [restaurantsRes, branchesRes, allActiveOrdersRes] = await Promise.all([
            supabaseAdmin
                .from('restaurants')
                .select('id, name, is_main_branch, address, phone, email')
                .in('id', allRestaurantIds)
                .is('deleted_at', null)
                .order('created_at', { ascending: true }),
            supabaseAdmin
                .from('branches')
                .select('id, name, restaurant_id, is_main_branch, address, code, phone, email')
                .in('restaurant_id', allRestaurantIds)
                .is('deleted_at', null)
                .order('created_at', { ascending: true }),
            supabaseAdmin
                .from('orders')
                .select('id, restaurant_id, branch_id, status')
                .in('restaurant_id', allRestaurantIds)
                .in('status', ACTIVE_KITCHEN_STATUSES)
        ]);

        const restaurants = restaurantsRes.data || [];
        const branches = branchesRes.data || [];
        const allActiveOrders = allActiveOrdersRes.data || [];

        const hasAnyMain = restaurants.some(r => r.is_main_branch);

        // Build enriched branches list with real-time active order counts
        const enrichedBranches = restaurants.map((r, idx) => {
            const primaryBranch = branches.find(b => b.restaurant_id === r.id && b.is_main_branch) ||
                                  branches.find(b => b.restaurant_id === r.id) || null;
            const isMain = hasAnyMain ? Boolean(r.is_main_branch) : idx === 0;

            const branchOrders = allActiveOrders.filter(o => 
                o.restaurant_id === r.id || (primaryBranch?.id && o.branch_id === primaryBranch.id)
            );

            return {
                id: r.id,
                restaurant_id: r.id,
                name: r.name,
                branch_id: primaryBranch?.id || `BR-${r.id.slice(-6)}-01`,
                code: primaryBranch?.code || primaryBranch?.id || r.id,
                is_main_branch: isMain,
                address: r.address || primaryBranch?.address || '',
                phone: r.phone || primaryBranch?.phone || '',
                active_orders_count: branchOrders.length,
                placed_count: branchOrders.filter(o => o.status === 'placed').length,
                preparing_count: branchOrders.filter(o => o.status === 'preparing').length,
                ready_count: branchOrders.filter(o => o.status === 'ready').length,
            };
        });

        // 2. Fetch active kitchen orders for the requested scope
        const scope = await resolveOwnerScope(auth, branchFilter);
        const queryStatuses = statusFilter && ACTIVE_KITCHEN_STATUSES.includes(statusFilter)
            ? [statusFilter]
            : ACTIVE_KITCHEN_STATUSES;

        let query = supabaseAdmin
            .from('orders')
            .select(`
                id,
                order_number,
                status,
                created_at,
                order_type,
                table_id,
                restaurant_id,
                branch_id,
                tables:table_id (
                    id,
                    table_number
                ),
                order_items (
                    id,
                    quantity,
                    notes,
                    status,
                    combo_name,
                    combo_id,
                    item_type,
                    menu_items (
                        id,
                        name
                    )
                )
            `)
            .in('restaurant_id', scope.restaurantIds)
            .in('status', queryStatuses)
            .order('created_at', { ascending: true }) // Oldest first (FIFO) for kitchen efficiency
            .limit(60);

        if (scope.targetBranchId) {
            query = query.eq('branch_id', scope.targetBranchId);
        }

        const { data: orders, error } = await query;
        if (error) {
            console.error('[API /owner/kds GET] Error querying orders:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            branches: enrichedBranches,
            activeKitchenOrders: orders || [],
            totalActiveOrders: allActiveOrders.length
        });
    } catch (err: any) {
        console.error('[API /owner/kds GET] Internal error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH: Update order and order items status directly from KDS
export async function PATCH(request: NextRequest) {
    try {
        const auth = await getAuthenticatedOwner(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { orderId, status } = body;
        if (!orderId || !status) {
            return NextResponse.json({ error: 'orderId and status are required' }, { status: 400 });
        }

        const validStatuses = ['placed', 'preparing', 'ready', 'served', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
        }

        // Verify order belongs to owner
        const allIds = auth.restaurantIds || [auth.restaurantId];
        const { data: order, error: findErr } = await supabaseAdmin
            .from('orders')
            .select('id, restaurant_id, status')
            .eq('id', orderId)
            .in('restaurant_id', allIds)
            .maybeSingle();

        if (findErr || !order) {
            return NextResponse.json({ error: 'Order not found or unauthorized' }, { status: 404 });
        }

        // Update order status
        const updates: any = { status };
        if (status === 'served') {
            updates.completed_at = new Date().toISOString();
        }

        const { error: updateErr } = await supabaseAdmin
            .from('orders')
            .update(updates)
            .eq('id', orderId);

        if (updateErr) {
            console.error('[API /owner/kds PATCH] Order update error:', updateErr);
            return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }

        // Also update active order items status
        if (['preparing', 'ready', 'served'].includes(status)) {
            await supabaseAdmin
                .from('order_items')
                .update({ status })
                .eq('order_id', orderId)
                .neq('status', 'cancelled');
        }

        return NextResponse.json({
            success: true,
            orderId,
            status
        });
    } catch (err: any) {
        console.error('[API /owner/kds PATCH] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
