import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getDeliveryOrAdminUserFromRequest } from '@/lib/jwt-utils';
import { resolveRestaurantId } from '@/services/utils.service';

/**
 * GET /api/delivery/assignments?restaurantId=xxx&status=xxx&deliveryBoyId=xxx&limit=xxx
 * 
 * Returns delivery assignments with joined order and delivery boy data.
 * - Admin: sees all assignments for their restaurant
 * - Delivery boy: sees only their own assignments
 */
export async function GET(request: NextRequest) {
    try {
        const rawRestaurantId = request.nextUrl.searchParams.get('restaurantId') || request.nextUrl.searchParams.get('restaurantCode');
        const auth = await getDeliveryOrAdminUserFromRequest(request, rawRestaurantId);
        if (!auth) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { user, isAdmin, isDeliveryBoy } = auth;

        if (!isAdmin && !isDeliveryBoy) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const targetRid = rawRestaurantId || user.restaurantId;
        if (!targetRid) {
            return NextResponse.json({ error: 'Restaurant context required' }, { status: 400 });
        }

        const rid = (await resolveRestaurantId(targetRid)) || targetRid;

        const statusFilter = request.nextUrl.searchParams.get('status');
        const deliveryBoyIdFilter = request.nextUrl.searchParams.get('deliveryBoyId');
        const limitParam = request.nextUrl.searchParams.get('limit');
        const activeOnly = request.nextUrl.searchParams.get('activeOnly') === 'true';

        // Build query
        let query = supabaseAdmin
            .from('delivery_assignments')
            .select('*')
            .eq('restaurant_id', rid)
            .order('assigned_at', { ascending: false });

        // Delivery boy: forced to only see their own
        if (isDeliveryBoy) {
            if (!user.deliveryBoyId) {
                return NextResponse.json({ error: 'Delivery boy context missing' }, { status: 400 });
            }
            query = query.eq('delivery_boy_id', user.deliveryBoyId);
        } else if (deliveryBoyIdFilter) {
            query = query.eq('delivery_boy_id', deliveryBoyIdFilter);
        }

        if (statusFilter) {
            const statuses = statusFilter.split(',').map(s => s.trim());
            if (statuses.length === 1) {
                query = query.eq('status', statuses[0]);
            } else {
                query = query.in('status', statuses);
            }
        }

        if (activeOnly) {
            query = query.not('status', 'in', '("DELIVERED","CANCELLED","REASSIGNED")');
        }

        if (limitParam) {
            query = query.limit(parseInt(limitParam, 10));
        }

        const { data: assignments, error: assErr } = await query;

        if (assErr) {
            return NextResponse.json({ error: assErr.message }, { status: 500 });
        }

        // Enrich with order and delivery boy data
        const orderIds = [...new Set((assignments || []).map(a => a.order_id))];
        const boyIds = [...new Set((assignments || []).map(a => a.delivery_boy_id))];

        let ordersMap: Record<string, any> = {};
        let boysMap: Record<string, any> = {};

        if (orderIds.length > 0) {
            const [{ data: orders }, { data: items }] = await Promise.all([
                supabaseAdmin
                    .from('orders')
                    .select('id, order_number, status, total_amount, amount_paid, delivery_address, delivery_phone, customer_phone, delivery_notes, delivery_fee, delivery_lat, delivery_lng, customer_lat, customer_lng, paid_by, payment_method, created_at, customer_id')
                    .in('id', orderIds),
                supabaseAdmin
                    .from('order_items')
                    .select('id, order_id, menu_item_id, combo_name, quantity, price_at_time, notes')
                    .in('order_id', orderIds)
            ]);

            // Resolve menu item names if present
            const menuItemIds = [...new Set((items || []).map(i => i.menu_item_id).filter(Boolean))];
            let menuItemsMap: Record<number, string> = {};
            if (menuItemIds.length > 0) {
                const { data: menuItems } = await supabaseAdmin
                    .from('menu_items')
                    .select('id, name')
                    .in('id', menuItemIds);
                if (menuItems) {
                    for (const m of menuItems) menuItemsMap[m.id] = m.name;
                }
            }

            // Resolve customer names
            const customerIds = [...new Set((orders || []).map(o => o.customer_id).filter(Boolean))];
            const customerPhones = [...new Set((orders || []).map(o => o.delivery_phone || o.customer_phone).filter(Boolean))];
            let customersMap: Record<string, string> = {};

            if (customerIds.length > 0 || customerPhones.length > 0) {
                let custQuery = supabaseAdmin.from('customers').select('id, name, mobile');
                if (customerIds.length > 0) {
                    custQuery = custQuery.in('id', customerIds);
                }
                const { data: custs } = await custQuery;
                if (custs) {
                    for (const c of custs) {
                        if (c.id) customersMap[c.id] = c.name;
                        if (c.mobile) customersMap[c.mobile] = c.name;
                    }
                }
            }

            const itemsByOrder: Record<string, any[]> = {};
            if (items) {
                for (const item of items) {
                    if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
                    const itemName = item.combo_name || (item.menu_item_id ? menuItemsMap[item.menu_item_id] : null) || 'Restaurant Dish';
                    itemsByOrder[item.order_id].push({
                        id: String(item.id),
                        name: itemName,
                        quantity: Number(item.quantity || 1),
                        price: Number(item.price_at_time || 0),
                        notes: item.notes || ''
                    });
                }
            }

            if (orders) {
                for (const o of orders) {
                    const custName = (o.customer_id ? customersMap[o.customer_id] : null) ||
                                     (o.delivery_phone ? customersMap[o.delivery_phone] : null) ||
                                     (o.customer_phone ? customersMap[o.customer_phone] : null) ||
                                     'Customer';
                    
                    const isPaid = (o.amount_paid && o.amount_paid >= o.total_amount) || 
                                   (o.paid_by && o.paid_by.toLowerCase() === 'online') ||
                                   (o.payment_method && o.payment_method.toLowerCase() !== 'cash');
                    
                    ordersMap[o.id] = {
                        ...o,
                        customer_name: custName,
                        payment_status: isPaid ? 'paid' : 'pending',
                        paid_by: o.paid_by || (isPaid ? 'online' : 'cash'),
                        delivery_lat: o.delivery_lat || o.customer_lat || null,
                        delivery_lng: o.delivery_lng || o.customer_lng || null,
                        items: itemsByOrder[o.id] || []
                    };
                }
            }
        }

        if (boyIds.length > 0) {
            const { data: boys } = await supabaseAdmin
                .from('delivery_boys')
                .select('id, employee_id, status, vehicle_type, vehicle_number')
                .in('id', boyIds);

            if (boys) {
                const empIds = boys.map(b => b.employee_id);
                const { data: emps } = await supabaseAdmin
                    .from('employees')
                    .select('id, name, mobile, avatar_url')
                    .in('id', empIds);

                const empMap: Record<string, any> = {};
                if (emps) {
                    for (const e of emps) empMap[e.id] = e;
                }

                for (const b of boys) {
                    const emp = empMap[b.employee_id];
                    boysMap[b.id] = {
                        ...b,
                        name: emp?.name || 'Unknown',
                        mobile: emp?.mobile || '',
                        avatar_url: emp?.avatar_url || null,
                    };
                }
            }
        }

        const enriched = (assignments || []).map(a => ({
            ...a,
            order: ordersMap[a.order_id] || null,
            delivery_boy: boysMap[a.delivery_boy_id] || null,
        }));

        return NextResponse.json({ assignments: enriched });

    } catch (err: any) {
        console.error('[DeliveryAssignments] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
