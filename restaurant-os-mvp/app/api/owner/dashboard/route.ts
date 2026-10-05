import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedOwner } from '@/lib/owner-auth';

export async function GET(request: NextRequest) {
    try {
        const auth = await getAuthenticatedOwner(request);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized: Owner session required' }, { status: 401 });
        }

        const rawIds = auth.restaurantIds && auth.restaurantIds.length > 0 ? auth.restaurantIds : (auth.restaurantId ? [auth.restaurantId] : []);
        const restaurantIds = rawIds.filter(Boolean);
        const rawFilter = request.nextUrl.searchParams.get('branch') || request.nextUrl.searchParams.get('restaurant') || 'all';

        // Short-circuit for empty accounts (0 restaurants)
        if (restaurantIds.length === 0) {
            return NextResponse.json({
                success: true,
                totalRevenue: 0,
                totalOrders: 0,
                activeBranches: 0,
                activeRestaurants: 0,
                totalRestaurants: 0,
                totalEmployees: 0,
                totalCustomers: 0,
                pendingOrders: 0,
                branchBreakdown: [],
                restaurantBreakdown: [],
                weeklyRevenue: [0, 0, 0, 0, 0, 0, 0],
                weeklyOrders: [0, 0, 0, 0, 0, 0, 0],
                trendDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                recentActivity: []
            });
        }

        // 1. Fetch all restaurants owned by this owner
        const { data: ownedRestaurants } = await supabaseAdmin
            .from('restaurants')
            .select('id, name, status, created_at')
            .in('id', restaurantIds)
            .is('deleted_at', null)
            .order('created_at', { ascending: true });

        const restaurants = ownedRestaurants || [];

        // 2. Determine target restaurant scope
        let targetRestaurantId: string | null = null;
        if (rawFilter !== 'all') {
            // Check if rawFilter is a restaurant ID directly
            if (restaurantIds.includes(rawFilter)) {
                targetRestaurantId = rawFilter;
            } else {
                // Check if rawFilter is a branch ID belonging to one of the owned restaurants
                const { data: matchingBranch } = await supabaseAdmin
                    .from('branches')
                    .select('restaurant_id')
                    .eq('id', rawFilter)
                    .in('restaurant_id', restaurantIds)
                    .maybeSingle();

                if (matchingBranch?.restaurant_id) {
                    targetRestaurantId = matchingBranch.restaurant_id;
                }
            }
        }

        const scopedRestaurantIds = targetRestaurantId ? [targetRestaurantId] : restaurantIds;

        // 3. Query orders for scoped restaurants
        const { data: allOrdersData } = await supabaseAdmin
            .from('orders')
            .select(`
                id, 
                order_number,
                total_amount, 
                status, 
                created_at, 
                restaurant_id,
                branch_id,
                order_type,
                table_id,
                tables:table_id (table_number)
            `)
            .in('restaurant_id', scopedRestaurantIds)
            .order('created_at', { ascending: false });

        const allOrders = allOrdersData || [];

        // 4. Calculate KPIs
        const totalRevenue = allOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
        const totalOrders = allOrders.length;
        const pendingOrders = allOrders.filter(o =>
            ['placed', 'pending', 'confirmed', 'preparing', 'cooking', 'ready'].includes((o.status || '').toLowerCase())
        ).length;

        // 5. Query employee count & customer count
        const [employeesRes, customersRes] = await Promise.all([
            supabaseAdmin
                .from('employees')
                .select('id, restaurant_id', { count: 'exact' })
                .in('restaurant_id', scopedRestaurantIds)
                .eq('status', 'active')
                .eq('is_deleted', false),
            supabaseAdmin
                .from('customers')
                .select('id', { count: 'exact', head: true })
                .in('restaurant_id', scopedRestaurantIds)
        ]);

        const totalEmployees = employeesRes.count || 0;
        const totalCustomers = customersRes.count || 0;
        const displayRestaurants = targetRestaurantId ? restaurants.filter(r => r.id === targetRestaurantId) : restaurants;
        const activeRestaurantsCount = displayRestaurants.filter(r => r.status?.toUpperCase() === 'ACTIVE').length;

        // 6. Restaurant breakdown (aggregated per independent restaurant)
        const branchBreakdown = displayRestaurants.map(r => {
            const restOrders = allOrders.filter(o => o.restaurant_id === r.id);
            const restRevenue = restOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
            const restEmps = (employeesRes.data || []).filter(e => e.restaurant_id === r.id).length;
            return {
                id: r.id,
                restaurant_id: r.id,
                name: r.name,
                code: r.id,
                is_main_branch: true,
                status: r.status,
                revenue: Math.round(restRevenue),
                orders: restOrders.length,
                employees: restEmps
            };
        });

        // 7. Calculate last 7 days trend for scoped orders
        const now = new Date();
        const days = 7;
        const dailyTrends: { date: string; dayName: string; revenue: number; orders: number }[] = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayName = dayNames[d.getDay()];

            const dayOrders = allOrders.filter(o => o.created_at && o.created_at.startsWith(dateStr));
            const dayRevenue = dayOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);

            dailyTrends.push({
                date: dateStr,
                dayName,
                revenue: Math.round(dayRevenue),
                orders: dayOrders.length
            });
        }

        const weeklyRevenue = dailyTrends.map(t => t.revenue);
        const weeklyOrders = dailyTrends.map(t => t.orders);
        const trendDays = dailyTrends.map(t => t.dayName);

        // 8. Recent activity from real orders
        const recentActivity = allOrders.slice(0, 8).map(o => ({
            id: o.id,
            action: `Order #${o.order_number || o.id.slice(0, 6)}`,
            detail: `${(o.order_type || 'dine-in').toUpperCase()} • ₹${o.total_amount || 0} • Status: ${o.status || 'placed'}`,
            time: o.created_at ? new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently',
            status: o.status
        }));

        return NextResponse.json({
            success: true,
            totalRevenue: Math.round(totalRevenue),
            totalOrders,
            activeBranches: activeRestaurantsCount,
            activeRestaurants: activeRestaurantsCount,
            totalRestaurants: activeRestaurantsCount,
            totalEmployees,
            totalCustomers,
            pendingOrders,
            branchBreakdown,
            restaurantBreakdown: branchBreakdown,
            weeklyRevenue,
            weeklyOrders,
            trendDays,
            recentActivity
        });
    } catch (err: any) {
        console.error('[Owner Dashboard Error]:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
