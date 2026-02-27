import { createClient } from '@/lib/supabase';

export interface AnalyticsMetrics {
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
}

export interface TopItem {
    id: number;
    name: string;
    count: number;
    revenue: number;
}

export const AnalyticsService = {
    /**
     * Fetch core KPIs: Total Revenue, Total Orders, AOV
     */
    async fetchKPIMetrics() {
        const supabase = createClient();

        // Fetch all completed orders (served, paid)
        // For MVP, we'll consider 'served' and 'paid' as revenue-generating
        const { data: orders, error } = await supabase
            .from('orders')
            .select('total_amount')
            .in('status', ['served', 'paid']);

        if (error) {
            console.error('Error fetching analytics KPIs:', error);
            return { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 };
        }

        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
        const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

        return {
            totalRevenue,
            totalOrders,
            avgOrderValue
        };
    },

    /**
     * Fetch Top Selling Items by Quantity
     */
    async fetchTopSellingItems() {
        const supabase = createClient();

        // We need to aggregate order_items. 
        // Supabase basic client doesn't do complex GROUP BY easily without RPC.
        // We'll fetch all items for completed orders and aggregate in JS for MVP.
        // (Scalability Note: In prod, use a SQL View or RPC function)

        const { data, error } = await supabase
            .from('order_items')
            .select(`
                quantity,
                price_at_time,
                menu_items (
                    id,
                    name
                )
            `);

        if (error) {
            console.error('Error fetching top items:', error);
            return [];
        }

        const itemMap = new Map<number, TopItem>();

        data.forEach((item: any) => {
            const menuId = item.menu_items?.id;
            const menuName = item.menu_items?.name || 'Unknown Item';

            if (!menuId) return;

            if (!itemMap.has(menuId)) {
                itemMap.set(menuId, {
                    id: menuId,
                    name: menuName,
                    count: 0,
                    revenue: 0
                });
            }

            const entry = itemMap.get(menuId)!;
            entry.count += item.quantity;
            entry.revenue += item.quantity * item.price_at_time;
        });

        // Convert to array and sort by count desc
        return Array.from(itemMap.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 5); // Top 5
    },

    /**
     * Fetch Orders distribution by Hour of Day
     */
    async fetchPeakHours() {
        const supabase = createClient();

        const { data: orders, error } = await supabase
            .from('orders')
            .select('created_at');

        if (error) {
            console.error('Error fetching peak hours:', error);
            return new Array(24).fill(0);
        }

        // Initialize 24h array
        const hourlyCounts = new Array(24).fill(0);

        orders.forEach(o => {
            const date = new Date(o.created_at);
            const hour = date.getHours();
            hourlyCounts[hour]++;
        });

        return hourlyCounts;
    }
};
