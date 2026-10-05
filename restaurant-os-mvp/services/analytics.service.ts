import { createClient } from '@/lib/supabase';
import { coalesceRequest } from '@/lib/data-cache';

export interface AnalyticsMetrics extends KPIData {
    avgOrderValue: number;
    cancellationRate: number;
    activeTables: number;
    pendingKitchenOrders: number;
}

export interface KPIData {
    totalRevenue: number;
    totalOrders: number;
}

export type TimeRange = 'today' | 'yesterday' | '7d' | '30d' | 'custom';

export interface TopItem {
    id: number;
    name: string;
    count: number;
    revenue: number;
    category?: string;
}

export interface OrderLogEntry {
    id: string;
    order_number: string;
    created_at: string;
    table_number: string;
    items: string;
    total_amount: number;
    status: string;
    payment_method: string;
}

export const AnalyticsService = {
    /**
     * Helper to get start and end dates for a range
     */
    getDateRange(range: TimeRange, customStart?: Date, customEnd?: Date) {
        const now = new Date();
        const end = new Date(now);
        const start = new Date(now);

        switch (range) {
            case 'today':
                start.setHours(0, 0, 0, 0);
                break;
            case 'yesterday':
                start.setDate(start.getDate() - 1);
                start.setHours(0, 0, 0, 0);
                end.setDate(end.getDate() - 1);
                end.setHours(23, 59, 59, 999);
                break;
            case '7d':
                start.setDate(start.getDate() - 7);
                start.setHours(0, 0, 0, 0);
                break;
            case '30d':
                start.setDate(start.getDate() - 30);
                start.setHours(0, 0, 0, 0);
                break;
            case 'custom':
                if (customStart) start.setTime(customStart.getTime());
                if (customEnd) end.setTime(customEnd.getTime());
                break;
        }

        return { start: start.toISOString(), end: end.toISOString() };
    },

    /**
     * Fetch full analytics summary from PostgreSQL database aggregation RPC
     */
    async fetchAnalyticsSummary(restaurantId: string, range: TimeRange = '7d', customStart?: Date, customEnd?: Date) {
        const cacheKey = `analytics-summary-${restaurantId}-${range}-${customStart?.getTime() || 0}-${customEnd?.getTime() || 0}`;
        return coalesceRequest(cacheKey, async () => {
            const supabase = createClient();
            const { start, end } = this.getDateRange(range, customStart, customEnd);

            const { data, error } = await supabase.rpc('get_restaurant_analytics_summary', {
                p_restaurant_id: restaurantId,
                p_start_date: start,
                p_end_date: end
            });

            if (error) {
                console.error('Error calling get_restaurant_analytics_summary RPC:', error);
                return null;
            }

            return data;
        });
    },

    /**
     * Fetch core KPIs using database aggregation RPC
     */
    async fetchKPIMetrics(restaurantId: string, range: TimeRange = 'today', customStart?: Date, customEnd?: Date) {
        const summary = await this.fetchAnalyticsSummary(restaurantId, range, customStart, customEnd);
        if (summary?.kpi) {
            return summary.kpi as AnalyticsMetrics;
        }

        return {
            totalRevenue: 0,
            totalOrders: 0,
            avgOrderValue: 0,
            cancellationRate: 0,
            activeTables: 0,
            pendingKitchenOrders: 0
        };
    },

    /**
     * Overhauled Revenue Trends for Recharts (Line Chart)
     * Handles hours for 'Today', days for others
     */
    async fetchRevenueTrends(restaurantId: string, range: TimeRange = '7d', customStart?: Date, customEnd?: Date) {
        const summary = await this.fetchAnalyticsSummary(restaurantId, range, customStart, customEnd);
        if (summary) {
            const isShortRange = range === 'today' || range === 'yesterday';
            return isShortRange ? (summary.sales_by_hour || []) : (summary.sales_by_day || []);
        }
        return [];
    },

    /**
     * Order status distribution (Donut Chart)
     */
    async fetchOrderStatusBreakdown(restaurantId: string, range: TimeRange = '7d') {
        const summary = await this.fetchAnalyticsSummary(restaurantId, range);
        return summary?.status_breakdown || [];
    },

    /**
     * Revenue by Category (Donut Chart)
     */
    async fetchCategoryRevenue(restaurantId: string, range: TimeRange = '7d') {
        const summary = await this.fetchAnalyticsSummary(restaurantId, range);
        return summary?.category_breakdown || [];
    },

    /**
     * Payment Method Split (Donut Chart)
     */
    async fetchPaymentMethodSplit(restaurantId: string, range: TimeRange = '7d') {
        const summary = await this.fetchAnalyticsSummary(restaurantId, range);
        return summary?.payment_breakdown || [];
    },

    /**
     * Top Selling Items (Horizontal Bar)
     */
    async fetchTopSellingItems(restaurantId: string, range: TimeRange = '7d', limit = 10, slow = false) {
        const summary = await this.fetchAnalyticsSummary(restaurantId, range);
        const items = summary?.top_items || [];
        if (slow) {
            return [...items].reverse().slice(0, limit);
        }
        return items.slice(0, limit);
    },

    /**
     * Order Log (Table) - Bounded to latest 50 entries
     */
    async fetchOrderLog(restaurantId: string, range: TimeRange = 'today', limit = 50) {
        const supabase = createClient();
        const { start, end } = this.getDateRange(range);

        const { data, error } = await supabase
            .from('orders')
            .select(`
                id,
                order_number,
                created_at,
                total_amount,
                status,
                payment_method,
                tables (table_number),
                order_items (
                    quantity,
                    combo_name,
                    menu_items!order_items_menu_item_id_restaurant_fkey (name)
                )
            `)
            .eq('restaurant_id', restaurantId)
            .gte('created_at', start)
            .lte('created_at', end)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) return [];

        return (data || []).map((o: any) => ({
            id: o.id,
            order_number: o.order_number,
            created_at: o.created_at,
            table_number: o.tables?.table_number || 'N/A',
            items: (o.order_items || []).map((i: any) => {
                const mi = Array.isArray(i.menu_items) ? i.menu_items[0] : i.menu_items;
                return `${i.quantity}x ${i.combo_name || mi?.name || 'Item'}`;
            }).join(', '),
            total_amount: o.total_amount,
            status: o.status,
            payment_method: o.payment_method || 'N/A'
        }));
    },

    /**
     * Low Stock Alerts
     */
    async fetchLowStockAlerts(restaurantId: string) {
        const supabase = createClient();
        // Better way for lt using another column in supabase-js is tricky without RPC, 
        // fetch all and filter client-side for simplicity here.
        const { data: all } = await supabase
            .from('inventory_items')
            .select('name, current_stock, min_threshold, unit')
            .eq('restaurant_id', restaurantId);

        return all?.filter(i => i.current_stock < i.min_threshold) || [];
    }
};
