import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, secondaryAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedOwner } from '@/lib/owner-auth';

export async function GET(request: NextRequest) {
    try {
        const auth = await getAuthenticatedOwner(request);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const restaurantIds = (auth.restaurantIds && auth.restaurantIds.length > 0)
            ? auth.restaurantIds
            : (auth.restaurantId ? [auth.restaurantId] : []);

        if (restaurantIds.length === 0) {
            return NextResponse.json({ notifications: [], unreadCount: 0 });
        }

        // Fetch restaurants mapping to get names
        const { data: restaurantsData } = await supabaseAdmin
            .from('restaurants')
            .select('id, name')
            .in('id', restaurantIds);

        const restNameMap = new Map<string, string>();
        (restaurantsData || []).forEach(r => restNameMap.set(r.id, r.name));

        // 1. Fetch active service requests & customer complaints across branches
        let serviceReqs: any[] = [];
        try {
            const { data } = await supabaseAdmin
                .from('service_requests')
                .select('id, table_id, request_type, request_status, notes, custom_note, created_at, restaurant_id, tables:table_id(table_number)')
                .in('restaurant_id', restaurantIds)
                .order('created_at', { ascending: false })
                .limit(20);
            serviceReqs = data || [];
        } catch (e) {
            console.warn('[OwnerNotifications] service_requests fetch error:', e);
        }

        // Also check secondaryAdmin if available
        if (secondaryAdmin) {
            try {
                const { data: secReqs } = await secondaryAdmin
                    .from('service_requests')
                    .select('id, table_id, request_type, request_status, notes, custom_note, created_at, restaurant_id, tables:table_id(table_number)')
                    .in('restaurant_id', restaurantIds)
                    .order('created_at', { ascending: false })
                    .limit(20);
                if (secReqs) {
                    const existingIds = new Set(serviceReqs.map(r => r.id));
                    secReqs.forEach(r => {
                        if (!existingIds.has(r.id)) serviceReqs.push(r);
                    });
                }
            } catch (_) {}
        }

        // 2. Fetch critical order alerts across branches (e.g. cancelled, queued, placed)
        let orderAlerts: any[] = [];
        try {
            const { data } = await supabaseAdmin
                .from('orders')
                .select('id, order_number, status, total_amount, created_at, restaurant_id, tables:table_id(table_number)')
                .in('restaurant_id', restaurantIds)
                .in('status', ['cancelled', 'queued', 'placed'])
                .order('created_at', { ascending: false })
                .limit(20);
            orderAlerts = data || [];
        } catch (e) {
            console.warn('[OwnerNotifications] orders fetch error:', e);
        }

        if (secondaryAdmin) {
            try {
                const { data: secOrders } = await secondaryAdmin
                    .from('orders')
                    .select('id, order_number, status, total_amount, created_at, restaurant_id, tables:table_id(table_number)')
                    .in('restaurant_id', restaurantIds)
                    .in('status', ['cancelled', 'queued', 'placed'])
                    .order('created_at', { ascending: false })
                    .limit(20);
                if (secOrders) {
                    const existingIds = new Set(orderAlerts.map(o => o.id));
                    secOrders.forEach(o => {
                        if (!existingIds.has(o.id)) orderAlerts.push(o);
                    });
                }
            } catch (_) {}
        }

        // Format combined notifications
        const notifications: any[] = [];

        // Format service requests / customer complaints
        serviceReqs.forEach((sr: any) => {
            const isComplaint = (sr.request_type || '').toLowerCase().includes('complaint') ||
                                (sr.notes || sr.custom_note || '').toLowerCase().includes('complaint') ||
                                (sr.request_type || '').toLowerCase().includes('manager');
            const tableName = sr.tables?.table_number || `Table ${sr.table_id || '?'}`;
            const restName = restNameMap.get(sr.restaurant_id) || 'Restaurant';

            notifications.push({
                id: `sr-${sr.id}`,
                type: isComplaint ? 'complaint' : 'service',
                severity: isComplaint ? 'high' : 'normal',
                title: isComplaint ? `Customer Complaint at ${tableName}` : `Service Call: ${sr.request_type || 'Assistance'}`,
                message: sr.notes || sr.custom_note || `${tableName} requested ${sr.request_type || 'assistance'} at ${restName}`,
                restaurantId: sr.restaurant_id,
                restaurantName: restName,
                status: sr.request_status,
                createdAt: sr.created_at,
                link: '/owner/tables'
            });
        });

        // Format order notifications
        orderAlerts.forEach((ord: any) => {
            const isCancelled = ord.status === 'cancelled';
            const tableName = ord.tables?.table_number ? `Table ${ord.tables.table_number}` : '';
            const restName = restNameMap.get(ord.restaurant_id) || 'Restaurant';

            notifications.push({
                id: `ord-${ord.id}`,
                type: 'order',
                severity: isCancelled ? 'high' : 'normal',
                title: isCancelled ? `Order #${ord.order_number || ord.id.slice(0, 6)} Cancelled` : `New Order #${ord.order_number || ord.id.slice(0, 6)} Placed`,
                message: `${tableName ? tableName + ' · ' : ''}₹${parseFloat(ord.total_amount || 0).toFixed(0)} at ${restName}`,
                restaurantId: ord.restaurant_id,
                restaurantName: restName,
                status: ord.status,
                createdAt: ord.created_at,
                link: '/owner/orders'
            });
        });

        // Sort by newest first
        notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const unreadCount = notifications.filter(n => n.severity === 'high' || n.status === 'queued' || n.status === 'pending').length;

        return NextResponse.json({
            notifications: notifications.slice(0, 30),
            unreadCount: Math.min(unreadCount, 99)
        });
    } catch (err: any) {
        console.error('[OwnerNotifications GET] Fatal error:', err);
        return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 });
    }
}
