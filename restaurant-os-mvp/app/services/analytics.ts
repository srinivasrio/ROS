import { createClient } from '@/lib/supabase';

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
     * Fetch core KPIs with status support
     */
    async fetchKPIMetrics(restaurantId: string, range: TimeRange = 'today', customStart?: Date, customEnd?: Date) {
        const supabase = createClient();
        const { start, end } = this.getDateRange(range, customStart, customEnd);

        // 1. Fetch Orders for calculations
        let query = supabase
            .from('orders')
            .select('id, total_amount, status, created_at')
            .eq('restaurant_id', restaurantId)
            .gte('created_at', start)
            .lte('created_at', end);

        const { data: orders, error } = await query;

        if (error) {
            console.error('Error fetching analytics KPIs:', error);
            return { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, cancellationRate: 0, activeTables: 0, pendingKitchenOrders: 0 };
        }

        const completedOrders = orders.filter(o => ['served', 'paid'].includes(o.status));
        const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
        const totalOrders = completedOrders.length;
        const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
        
        const cancelledCount = orders.filter(o => o.status === 'cancelled').length;
        const totalAttempted = orders.length;
        const cancellationRate = totalAttempted > 0 ? Math.round((cancelledCount / totalAttempted) * 100) : 0;

        // 2. Fetch Active Tables (Live data - ignore date range for this)
        const { data: tables } = await supabase.from('tables').select('id').eq('restaurant_id', restaurantId).eq('status', 'occupied');
        const activeTables = tables?.length || 0;

        // 3. Fetch Pending Kitchen Orders (Live data)
        const { count: pendingKitchen } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('restaurant_id', restaurantId)
            .in('status', ['placed', 'preparing']);

        return {
            totalRevenue,
            totalOrders,
            avgOrderValue,
            cancellationRate,
            activeTables,
            pendingKitchenOrders: pendingKitchen || 0
        };
    },

    /**
     * Overhauled Revenue Trends for Recharts (Line Chart)
     * Handles hours for 'Today', days for others
     */
    async fetchRevenueTrends(restaurantId: string, range: TimeRange = '7d', customStart?: Date, customEnd?: Date) {
        const supabase = createClient();
        const { start, end } = this.getDateRange(range, customStart, customEnd);

        const { data: orders, error } = await supabase
            .from('orders')
            .select('total_amount, created_at')
            .eq('restaurant_id', restaurantId)
            .in('status', ['served', 'paid'])
            .gte('created_at', start)
            .lte('created_at', end)
            .order('created_at', { ascending: true });

        if (error) return [];

        const isShortRange = range === 'today' || range === 'yesterday';
        const format = isShortRange ? 'hour' : 'day';
        
        const map = new Map<string, number>();

        orders.forEach(o => {
            const date = new Date(o.created_at);
            const key = format === 'hour' 
                ? `${date.getHours()}:00` 
                : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            map.set(key, (map.get(key) || 0) + (o.total_amount || 0));
        });

        // Fill gaps
        const result: { label: string; value: number }[] = [];
        if (format === 'hour') {
            for (let i = 0; i < 24; i++) {
                const key = `${i}:00`;
                result.push({ label: key, value: map.get(key) || 0 });
            }
        } else {
            // Fill based on range count
            const startD = new Date(start);
            const endD = new Date(end);
            const current = new Date(startD);
            while (current <= endD) {
                const key = current.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                result.push({ label: key, value: map.get(key) || 0 });
                current.setDate(current.getDate() + 1);
            }
        }

        return result;
    },

    /**
     * Order status distribution (Donut Chart)
     */
    async fetchOrderStatusBreakdown(restaurantId: string, range: TimeRange = '7d') {
        const supabase = createClient();
        const { start, end } = this.getDateRange(range);

        const { data, error } = await supabase
            .from('orders')
            .select('status')
            .eq('restaurant_id', restaurantId)
            .gte('created_at', start)
            .lte('created_at', end);

        if (error) return [];

        const counts: Record<string, number> = {};
        data.forEach(o => counts[o.status] = (counts[o.status] || 0) + 1);

        return Object.entries(counts).map(([name, value]) => ({ 
            name: name.charAt(0).toUpperCase() + name.slice(1), 
            value 
        }));
    },

    /**
     * Revenue by Category (Donut Chart)
     */
    async fetchCategoryRevenue(restaurantId: string, range: TimeRange = '7d') {
        const supabase = createClient();
        const { start, end } = this.getDateRange(range);

        const { data, error } = await supabase
            .from('order_items')
            .select(`
                quantity,
                price_at_time,
                menu_items!inner (
                    categories (name)
                )
            `)
            .eq('restaurant_id', restaurantId)
            .gte('created_at', start)
            .lte('created_at', end);

        if (error) return [];

        const map = new Map<string, number>();
        data.forEach((item: any) => {
            const catName = item.menu_items?.categories?.name || 'Uncategorized';
            const revenue = item.quantity * item.price_at_time;
            map.set(catName, (map.get(catName) || 0) + revenue);
        });

        return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    },

    /**
     * Payment Method Split (Donut Chart)
     */
    async fetchPaymentMethodSplit(restaurantId: string, range: TimeRange = '7d') {
        const supabase = createClient();
        const { start, end } = this.getDateRange(range);

        const { data, error } = await supabase
            .from('orders')
            .select('payment_method, total_amount')
            .eq('restaurant_id', restaurantId)
            .eq('status', 'paid')
            .gte('created_at', start)
            .lte('created_at', end);

        if (error) return [];

        const map = new Map<string, number>();
        data.forEach(o => {
            const method = o.payment_method?.toUpperCase() || 'UNKNOWN';
            map.set(method, (map.get(method) || 0) + (o.total_amount || 0));
        });

        return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    },

    /**
     * Top Selling Items (Horizontal Bar)
     */
    async fetchTopSellingItems(restaurantId: string, range: TimeRange = '7d', limit = 10, slow = false) {
        const supabase = createClient();
        const { start, end } = this.getDateRange(range);

        const { data, error } = await supabase
            .from('order_items')
            .select(`
                quantity,
                price_at_time,
                menu_items!inner (
                    name,
                    categories (name)
                )
            `)
            .eq('restaurant_id', restaurantId)
            .gte('created_at', start)
            .lte('created_at', end);

        if (error) return [];

        const map = new Map<string, any>();
        data.forEach((item: any) => {
            const name = item.menu_items?.name;
            if (!map.has(name)) {
                map.set(name, { name, quantity: 0, revenue: 0, category: item.menu_items?.categories?.name });
            }
            const entry = map.get(name);
            entry.quantity += item.quantity;
            entry.revenue += item.quantity * item.price_at_time;
        });

        const items = Array.from(map.values());
        items.sort((a, b) => slow ? a.quantity - b.quantity : b.quantity - a.quantity);
        return items.slice(0, limit);
    },

    /**
     * Order Log (Table)
     */
    async fetchOrderLog(restaurantId: string, range: TimeRange = 'today') {
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
                    menu_items!order_items_menu_item_id_restaurant_fkey (name)
                )
            `)
            .eq('restaurant_id', restaurantId)
            .gte('created_at', start)
            .lte('created_at', end)
            .order('created_at', { ascending: false });

        if (error) return [];

        return data.map((o: any) => ({
            id: o.id,
            order_number: o.order_number,
            created_at: o.created_at,
            table_number: o.tables?.table_number || 'N/A',
            items: o.order_items.map((i: any) => `${i.quantity}x ${i.menu_items?.name}`).join(', '),
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
