import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedOwner, resolveOwnerScope } from '@/lib/owner-auth';

export async function GET(request: NextRequest) {
    try {
        const auth = await getAuthenticatedOwner(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = request.nextUrl;
        const branchFilter = searchParams.get('branch') || searchParams.get('restaurant');
        const filterType = searchParams.get('type') || 'all'; // all, repeat, vip
        const search = searchParams.get('search');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200);
        const offset = (page - 1) * limit;

        const scope = await resolveOwnerScope(auth, branchFilter);

        if (!scope.restaurantIds || scope.restaurantIds.length === 0) {
            return NextResponse.json({
                customers: [],
                total: 0,
                totalCustomers: 0,
                repeatCustomers: 0,
                vipCustomers: 0,
                averageSpend: 0,
                page: 1,
                limit,
                totalPages: 0
            });
        }

        let query = supabaseAdmin
            .from('customers')
            .select('*', { count: 'exact' })
            .in('restaurant_id', scope.restaurantIds)
            .order('last_visit', { ascending: false });

        if (filterType === 'repeat') {
            query = query.or('visit_count.gt.1,order_count.gt.1');
        } else if (filterType === 'vip') {
            query = query.gte('total_spend', 1000);
        }

        if (search) {
            query = query.or(`name.ilike.%${search}%,mobile.ilike.%${search}%,email.ilike.%${search}%`);
        }

        query = query.range(offset, offset + limit - 1);

        // Fetch all orders for these restaurants to accurately calculate customer spend & repeat rates
        const [custRes, restsRes, ordersRes] = await Promise.all([
            query,
            supabaseAdmin.from('restaurants').select('id, name').in('id', scope.restaurantIds),
            supabaseAdmin.from('orders').select('id, customer_id, customer_phone, total_amount, created_at, restaurant_id').in('restaurant_id', scope.restaurantIds)
        ]);

        if (custRes.error) return NextResponse.json({ error: custRes.error.message }, { status: 500 });

        const customers = custRes.data || [];
        const restMap = new Map((restsRes.data || []).map(r => [r.id, r.name]));
        const orders = ordersRes.data || [];

        // Build aggregate order stats per customer
        const customerStatsMap = new Map<string, { count: number; spend: number; lastDate: string }>();

        for (const o of orders) {
            const keyById = o.customer_id;
            const keyByPhone = o.customer_phone;
            const amount = parseFloat(o.total_amount || 0);

            if (keyById) {
                const cur = customerStatsMap.get(keyById) || { count: 0, spend: 0, lastDate: o.created_at };
                cur.count += 1;
                cur.spend += amount;
                if (!cur.lastDate || new Date(o.created_at) > new Date(cur.lastDate)) cur.lastDate = o.created_at;
                customerStatsMap.set(keyById, cur);
            }
            if (keyByPhone) {
                const cur = customerStatsMap.get(keyByPhone) || { count: 0, spend: 0, lastDate: o.created_at };
                cur.count += 1;
                cur.spend += amount;
                if (!cur.lastDate || new Date(o.created_at) > new Date(cur.lastDate)) cur.lastDate = o.created_at;
                customerStatsMap.set(keyByPhone, cur);
            }
        }

        const enrichedCustomers = customers.map(c => {
            const byId = customerStatsMap.get(c.id);
            const byPhone = c.mobile ? customerStatsMap.get(c.mobile) : null;
            const realSpend = (byId?.spend || 0) + (byPhone && byPhone !== byId ? byPhone.spend : 0) || parseFloat(c.total_spend || 0);
            const realCount = (byId?.count || 0) + (byPhone && byPhone !== byId ? byPhone.count : 0) || c.order_count || c.visit_count || 1;
            const lastVisit = byId?.lastDate || byPhone?.lastDate || c.last_visit || c.created_at;

            return {
                ...c,
                restaurant_name: restMap.get(c.restaurant_id) || 'Restaurant',
                order_count: realCount,
                total_spend: realSpend,
                last_visit: lastVisit,
                is_repeat: realCount > 1,
                is_vip: realSpend >= 1000
            };
        });

        // Filter by type if needed after calculating real stats
        let finalCustomers = enrichedCustomers;
        if (filterType === 'repeat') {
            finalCustomers = finalCustomers.filter(c => c.order_count > 1);
        } else if (filterType === 'vip') {
            finalCustomers = finalCustomers.filter(c => c.total_spend >= 1000);
        }

        const totalCustomers = enrichedCustomers.length;
        const repeatCustomers = enrichedCustomers.filter(c => c.order_count > 1).length;
        const totalRevenue = enrichedCustomers.reduce((sum, c) => sum + c.total_spend, 0);
        const avgSpend = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

        return NextResponse.json({
            customers: finalCustomers,
            totalCustomers,
            repeatCustomers,
            totalRevenue: Math.round(totalRevenue),
            avgSpend: Math.round(avgSpend),
            page,
            limit
        });
    } catch (err: any) {
        console.error('[API /owner/customers GET] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

