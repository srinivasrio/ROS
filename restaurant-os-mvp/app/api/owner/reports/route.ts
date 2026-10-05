import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedOwner, resolveOwnerScope } from '@/lib/owner-auth';

export async function GET(request: NextRequest) {
    try {
        const auth = await getAuthenticatedOwner(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const period = request.nextUrl.searchParams.get('period') || 'month';
        const branchFilter = request.nextUrl.searchParams.get('branch') || request.nextUrl.searchParams.get('restaurant');
        const scope = await resolveOwnerScope(auth, branchFilter);

        if (!scope.restaurantIds || scope.restaurantIds.length === 0) {
            return NextResponse.json({
                period,
                totalRevenue: 0,
                totalDiscount: 0,
                totalGst: 0,
                totalOrders: 0,
                averageOrderValue: 0,
                orderTypeStats: {
                    DINE_IN: { count: 0, revenue: 0 },
                    TAKEAWAY: { count: 0, revenue: 0 },
                    DELIVERY: { count: 0, revenue: 0 }
                },
                branchBreakdown: [],
                paymentBreakdown: {},
                statusBreakdown: {},
                topItems: []
            });
        }

        const now = new Date();
        let startDate: Date | null = null;

        if (period === 'today') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        } else if (period === 'week') {
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (period === 'month') {
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        } else if (period === 'quarter') {
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        } else if (period === 'all') {
            startDate = null;
        }

        let ordersQuery = supabaseAdmin
            .from('orders')
            .select(`
                id, 
                order_number,
                total_amount, 
                discount_amount,
                gst_amount,
                payment_method, 
                status, 
                order_type,
                restaurant_id, 
                branch_id, 
                created_at
            `)
            .in('restaurant_id', scope.restaurantIds)
            .order('created_at', { ascending: false });

        if (startDate) {
            ordersQuery = ordersQuery.gte('created_at', startDate.toISOString());
        }

        if (scope.targetBranchId) {
            ordersQuery = ordersQuery.eq('branch_id', scope.targetBranchId);
        }

        const [ordersRes, branchesRes, restsRes] = await Promise.all([
            ordersQuery,
            supabaseAdmin
                .from('branches')
                .select('id, name, restaurant_id')
                .in('restaurant_id', scope.restaurantIds)
                .is('deleted_at', null),
            supabaseAdmin
                .from('restaurants')
                .select('id, name')
                .in('id', scope.restaurantIds)
                .is('deleted_at', null)
        ]);

        const orders = ordersRes.data || [];
        const branches = branchesRes.data || [];
        const restaurants = restsRes.data || [];

        const totalRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
        const totalDiscount = orders.reduce((sum, o) => sum + (parseFloat(o.discount_amount) || 0), 0);
        const totalGst = orders.reduce((sum, o) => sum + (parseFloat(o.gst_amount) || 0), 0);
        const totalOrders = orders.length;
        const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        // Breakdown by order type (DINE_IN, TAKEAWAY, DELIVERY)
        const orderTypeStats = {
            dineIn: { count: 0, revenue: 0 },
            takeaway: { count: 0, revenue: 0 },
            delivery: { count: 0, revenue: 0 }
        };

        orders.forEach(o => {
            const amount = parseFloat(o.total_amount) || 0;
            const type = (o.order_type || '').toUpperCase();
            if (type === 'DINE_IN') {
                orderTypeStats.dineIn.count++;
                orderTypeStats.dineIn.revenue += amount;
            } else if (type === 'TAKEAWAY') {
                orderTypeStats.takeaway.count++;
                orderTypeStats.takeaway.revenue += amount;
            } else if (type === 'DELIVERY') {
                orderTypeStats.delivery.count++;
                orderTypeStats.delivery.revenue += amount;
            }
        });

        // Breakdown by restaurant / branch
        const restMap = new Map(restaurants.map(r => [r.id, r.name]));
        const branchBreakdown: Record<string, { 
            name: string; 
            restaurant_id: string; 
            revenue: number; 
            orders: number;
            dineIn: number;
            takeaway: number;
            delivery: number;
        }> = {};
        
        restaurants.forEach(r => {
            branchBreakdown[r.id] = { 
                name: r.name, 
                restaurant_id: r.id, 
                revenue: 0, 
                orders: 0,
                dineIn: 0,
                takeaway: 0,
                delivery: 0
            };
        });

        orders.forEach(o => {
            const key = o.restaurant_id || 'main';
            if (!branchBreakdown[key]) {
                branchBreakdown[key] = { 
                    name: restMap.get(o.restaurant_id) || 'Restaurant', 
                    restaurant_id: o.restaurant_id, 
                    revenue: 0, 
                    orders: 0,
                    dineIn: 0,
                    takeaway: 0,
                    delivery: 0
                };
            }
            const amt = parseFloat(o.total_amount) || 0;
            branchBreakdown[key].revenue += amt;
            branchBreakdown[key].orders += 1;
            const t = (o.order_type || '').toUpperCase();
            if (t === 'DINE_IN') branchBreakdown[key].dineIn += 1;
            else if (t === 'TAKEAWAY') branchBreakdown[key].takeaway += 1;
            else if (t === 'DELIVERY') branchBreakdown[key].delivery += 1;
        });

        // Payment method breakdown
        const paymentBreakdown: Record<string, { count: number; amount: number }> = {};
        orders.forEach(o => {
            const method = (o.payment_method || 'CASH').toUpperCase();
            if (!paymentBreakdown[method]) paymentBreakdown[method] = { count: 0, amount: 0 };
            paymentBreakdown[method].count += 1;
            paymentBreakdown[method].amount += parseFloat(o.total_amount) || 0;
        });

        // Status breakdown
        const statusBreakdown: Record<string, number> = {};
        orders.forEach(o => {
            const st = (o.status || 'placed').toLowerCase();
            statusBreakdown[st] = (statusBreakdown[st] || 0) + 1;
        });

        // Fetch top selling items if orders exist
        let topItems: any[] = [];
        if (orders.length > 0) {
            const orderIds = orders.slice(0, 100).map(o => o.id);
            const { data: itemRows } = await supabaseAdmin
                .from('order_items')
                .select('menu_item_id, quantity, price_at_time, notes, menu_items (id, name, is_veg, price)')
                .in('order_id', orderIds);

            const itemAgg: Record<string, { name: string; quantity: number; revenue: number; is_veg: boolean }> = {};
            (itemRows || []).forEach((row: any) => {
                const id = row.menu_item_id || row.menu_items?.id || (row.notes ? row.notes.slice(0, 20) : 'item');
                const name = row.menu_items?.name || (row.notes ? row.notes.replace(/\[SPECIAL:\s*|\]/g, '').trim() : 'Chef Special');
                const is_veg = row.menu_items?.is_veg ?? true;
                const qty = row.quantity || 1;
                const price = row.price_at_time || row.menu_items?.price || 0;
                if (!itemAgg[id]) {
                    itemAgg[id] = { name, quantity: 0, revenue: 0, is_veg };
                }
                itemAgg[id].quantity += qty;
                itemAgg[id].revenue += qty * price;
            });

            topItems = Object.values(itemAgg)
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, 5);
        }

        return NextResponse.json({
            period,
            totalRevenue: Math.round(totalRevenue),
            totalDiscount: Math.round(totalDiscount),
            totalGst: Math.round(totalGst),
            totalOrders,
            averageOrderValue: Math.round(averageOrderValue),
            orderTypeStats,
            branchBreakdown: Object.values(branchBreakdown),
            paymentBreakdown,
            statusBreakdown,
            topItems
        });
    } catch (err: any) {
        console.error('[API /owner/reports GET] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

