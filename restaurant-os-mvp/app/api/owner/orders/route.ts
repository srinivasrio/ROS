import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedOwner, resolveOwnerScope } from '@/lib/owner-auth';

export async function GET(request: NextRequest) {
    try {
        const auth = await getAuthenticatedOwner(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized: Owner session required' }, { status: 401 });

        const { searchParams } = request.nextUrl;
        const branchFilter = searchParams.get('branch') || searchParams.get('restaurant');
        const statusFilter = searchParams.get('status');
        const orderTypeFilter = searchParams.get('order_type') || searchParams.get('type');
        const dateFilter = searchParams.get('date') || 'all';
        const mode = searchParams.get('mode') || (searchParams.get('history') === 'true' ? 'history' : null);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200);
        const offset = (page - 1) * limit;

        const scope = await resolveOwnerScope(auth, branchFilter);

        if (!scope.restaurantIds || scope.restaurantIds.length === 0) {
            return NextResponse.json({
                orders: [],
                total: 0,
                summary: {
                    total: 0,
                    dineIn: 0,
                    takeaway: 0,
                    delivery: 0,
                    totalRevenue: 0
                },
                page: 1,
                limit,
                totalPages: 0
            });
        }

        // Build query scoped strictly to owner's authorized restaurants
        let query = supabaseAdmin
            .from('orders')
            .select(`
                id, 
                order_number, 
                transaction_id, 
                total_amount, 
                amount_paid,
                discount_amount,
                coupon_code,
                gst_amount,
                cgst_amount,
                sgst_amount,
                delivery_fee,
                status, 
                is_completed,
                restaurant_id, 
                branch_id, 
                table_id, 
                order_type,
                customer_phone,
                delivery_address,
                payment_method, 
                created_at, 
                completed_at,
                tables:table_id (id, table_number)
            `, { count: 'exact' })
            .in('restaurant_id', scope.restaurantIds)
            .order('created_at', { ascending: false });

        if (scope.targetBranchId) {
            query = query.eq('branch_id', scope.targetBranchId);
        }

        // Status filter / mode
        if (statusFilter && statusFilter !== 'all') {
            const sf = statusFilter.toLowerCase();
            if (sf === 'completed') {
                query = query.eq('is_completed', true);
            } else if (['placed', 'preparing', 'ready', 'served', 'paid', 'cancelled', 'queued'].includes(sf)) {
                query = query.eq('status', sf);
            }
        } else if (mode === 'history') {
            query = query.or('is_completed.eq.true,status.in.(paid,cancelled)');
        } else if (mode === 'live') {
            query = query.eq('is_completed', false);
        }

        // Order type filter (DINE_IN, TAKEAWAY, DELIVERY)
        if (orderTypeFilter && orderTypeFilter !== 'all') {
            const normalizedType = orderTypeFilter.replace('-', '_').toUpperCase();
            query = query.eq('order_type', normalizedType);
        }

        // Date range filter
        const now = new Date();
        if (dateFilter === 'today') {
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
            query = query.gte('created_at', todayStart.toISOString());
        } else if (dateFilter === 'week') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            query = query.gte('created_at', weekAgo.toISOString());
        } else if (dateFilter === 'month') {
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            query = query.gte('created_at', monthAgo.toISOString());
        }

        // Range for pagination
        query = query.range(offset, offset + limit - 1);

        const { data: orders, count, error } = await query;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Map branch and restaurant names for enriched display
        const [branchesRes, restsRes, itemsRes] = await Promise.all([
            supabaseAdmin
                .from('branches')
                .select('id, name, restaurant_id')
                .in('restaurant_id', scope.restaurantIds),
            supabaseAdmin
                .from('restaurants')
                .select('id, name')
                .in('id', scope.restaurantIds),
            // Fetch order items for the fetched orders
            (orders && orders.length > 0)
                ? supabaseAdmin
                    .from('order_items')
                    .select('id, order_id, quantity, price_at_time, notes, menu_item_id, combo_name, combo_id, item_type, status, menu_items (id, name, is_veg)')
                    .in('order_id', orders.map(o => o.id))
                : Promise.resolve({ data: [] })
        ]);

        const branchMap = new Map((branchesRes.data || []).map(b => [b.id, b.name]));
        const restMap = new Map((restsRes.data || []).map(r => [r.id, r.name]));

        // Group order items by order_id
        const orderItemsMap = new Map<string, any[]>();
        ((itemsRes as any).data || []).forEach((item: any) => {
            if (!orderItemsMap.has(item.order_id)) {
                orderItemsMap.set(item.order_id, []);
            }
            orderItemsMap.get(item.order_id)!.push({
                id: item.id,
                name: item.combo_name || item.menu_items?.name || (item.notes ? item.notes.replace(/\[SPECIAL:\s*|\]/g, '').trim() : 'Item'),
                quantity: item.quantity || 1,
                price: parseFloat(item.price_at_time || 0),
                is_veg: item.menu_items?.is_veg ?? true,
                notes: item.notes || '',
                status: item.status || 'placed'
            });
        });

        const enrichedOrders = (orders || []).map(o => ({
            ...o,
            total: o.total_amount || 0,
            table_number: (o.tables as any)?.table_number || null,
            restaurant_name: restMap.get(o.restaurant_id) || 'Restaurant',
            branch_name: o.branch_id ? (branchMap.get(o.branch_id) || 'Main Branch') : (restMap.get(o.restaurant_id) || 'Main Branch'),
            items: orderItemsMap.get(o.id) || [],
            order_items: orderItemsMap.get(o.id) || [],
            item_count: (orderItemsMap.get(o.id) || []).reduce((acc: number, curr: any) => acc + (curr.quantity || 1), 0)
        }));

        // Compute summary counts across scoped restaurant
        let summaryQuery = supabaseAdmin
            .from('orders')
            .select('order_type, total_amount, status, is_completed')
            .in('restaurant_id', scope.restaurantIds);

        if (scope.targetBranchId) {
            summaryQuery = summaryQuery.eq('branch_id', scope.targetBranchId);
        }

        const { data: allScopedOrders } = await summaryQuery;
        const allList = allScopedOrders || [];

        let filteredForSummary = allList;
        if (statusFilter && statusFilter !== 'all') {
            const sf = statusFilter.toLowerCase();
            if (sf === 'completed') {
                filteredForSummary = allList.filter(o => o.is_completed);
            } else {
                filteredForSummary = allList.filter(o => (o.status || '').toLowerCase() === sf);
            }
        } else if (mode === 'history') {
            filteredForSummary = allList.filter(o => o.is_completed || ['paid', 'cancelled'].includes((o.status || '').toLowerCase()));
        } else if (mode === 'live') {
            filteredForSummary = allList.filter(o => !o.is_completed);
        }

        const summary = {
            total: filteredForSummary.length,
            dineIn: filteredForSummary.filter(o => (o.order_type || '').toUpperCase() === 'DINE_IN').length,
            takeaway: filteredForSummary.filter(o => (o.order_type || '').toUpperCase() === 'TAKEAWAY').length,
            delivery: filteredForSummary.filter(o => (o.order_type || '').toUpperCase() === 'DELIVERY').length,
            totalRevenue: filteredForSummary.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0)
        };

        return NextResponse.json({
            orders: enrichedOrders,
            total: count || 0,
            summary,
            page,
            limit
        });
    } catch (err: any) {
        console.error('[API /owner/orders GET] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

