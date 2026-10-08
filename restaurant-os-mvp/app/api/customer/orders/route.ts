import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyJwt, extractCustomerTokenForRestaurant } from '@/lib/jwt-utils';
import { resolveRestaurantId } from '@/services/utils.service';
import { getCategoryMenuItemImage } from '@/lib/utils';
import { getCustomerTableSession } from '@/lib/customer-table-session';

type CustomerJwtPayload = {
    customerId?: string;
    restaurantId?: string;
    restaurant_id?: string;
    role?: string;
};

/**
 * GET /api/customer/orders
 * 
 * Fetches persistent orders for the authenticated customer or current table.
 * Segregates results into:
 *   - activeOrders: in-flight orders still being prepared, served, or delivered
 *   - previousOrders: completed, delivered, or cancelled past orders
 * 
 * Ensures orders are permanently tied to the customer and shared with admin Live Orders.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const restaurantCode = searchParams.get('restaurantId') || searchParams.get('restaurantCode') || '';

        const actualRestaurantId = await resolveRestaurantId(restaurantCode);
        if (!actualRestaurantId) {
            return NextResponse.json({ error: 'Invalid restaurant' }, { status: 400 });
        }

        const tableNumber = searchParams.get('tableNumber');
        const clientCustomerId = searchParams.get('customerId') || '';
        const clientLastOrderId = searchParams.get('lastOrderId') || '';
        const isValidUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

        // Security Enforcement: Cryptographically check table session cookie if present
        const tableSession = await getCustomerTableSession(req);
        if (tableSession) {
            if (String(tableSession.restaurant_id) !== String(actualRestaurantId)) {
                return NextResponse.json({ error: 'Forbidden: Restaurant session mismatch' }, { status: 403 });
            }
            if (tableNumber && String(tableNumber).toLowerCase() !== 'takeaway' && String(tableNumber).toLowerCase() !== 'delivery') {
                if (String(tableSession.table_number) !== String(tableNumber) && String(tableSession.table_id) !== String(tableNumber)) {
                    return NextResponse.json({ error: 'Forbidden: Table session mismatch' }, { status: 403 });
                }
            }
        }

        let physicalTableId: number | null = null;
        if (tableNumber) {
            const { data: pTable } = await supabaseAdmin
                .from('tables')
                .select('id')
                .eq('restaurant_id', actualRestaurantId)
                .eq('table_number', tableNumber)
                .maybeSingle();
            if (pTable?.id) {
                physicalTableId = pTable.id;
            }
        }

        // 1. Resolve Authenticated Customer strictly from verified JWT
        let authenticatedCustomerId: string | null = null;
        let token: string | null = null;
        const authHeader = req.headers.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7).trim();
        }
        if (!token) {
            token = extractCustomerTokenForRestaurant(req.cookies, actualRestaurantId || restaurantCode);
        }

        if (token) {
            let payload: CustomerJwtPayload | null = null;
            try {
                payload = await verifyJwt(token);
            } catch {
                payload = null;
            }

            const tokenRestaurantId = payload?.restaurantId || payload?.restaurant_id;
            const isCustomerToken = String(payload?.role || '').toLowerCase() === 'customer';
            if (payload?.customerId && isCustomerToken && tokenRestaurantId && String(tokenRestaurantId) === String(actualRestaurantId)) {
                const { data: customerRecord } = await supabaseAdmin
                    .from('customers')
                    .select('id')
                    .eq('id', payload.customerId)
                    .eq('restaurant_id', actualRestaurantId)
                    .maybeSingle();
                if (customerRecord?.id) {
                    authenticatedCustomerId = customerRecord.id;
                }
            }
        }

        // P0-04 IDOR REMEDIATION & Table Guest Scoping:
        // A request must be scoped to either:
        // 1) An authenticated customer session (verified JWT), OR
        // 2) A valid physical table currently active in this restaurant
        // Requests with arbitrary customer IDs or lastOrderIds without a verified JWT or table context are rejected with 401.
        if (!authenticatedCustomerId && !physicalTableId) {
            return NextResponse.json(
                { error: 'Unauthorized: verified customer session or active table required' },
                { status: 401 }
            );
        }

        // 2. Query Orders strictly scoped to verified tenant and context
        let ordersQuery = supabaseAdmin
            .from('orders')
            .select(`
                id,
                order_number,
                table_id,
                customer_id,
                status,
                total_amount,
                amount_paid,
                paid_by,
                is_completed,
                order_type,
                coupon_code,
                discount_amount,
                gst_amount,
                cgst_amount,
                sgst_amount,
                customer_phone,
                restaurant_id,
                created_at,
                completed_at
            `)
            .eq('restaurant_id', actualRestaurantId);

        if (authenticatedCustomerId && physicalTableId) {
            // Authenticated customer sitting at a table:
            // Fetch their full order history OR active orders for this table
            ordersQuery = ordersQuery.or(
                `customer_id.eq.${authenticatedCustomerId},and(table_id.eq.${physicalTableId},is_completed.eq.false)`
            );
        } else if (authenticatedCustomerId) {
            // Authenticated customer outside of a table:
            ordersQuery = ordersQuery.eq('customer_id', authenticatedCustomerId);
        } else if (physicalTableId) {
            // Guest sitting at a physical table:
            // Fetch all active orders for this table. If they also have clientLastOrderId on this table, include it.
            if (clientLastOrderId && isValidUuid(clientLastOrderId)) {
                ordersQuery = ordersQuery.or(
                    `and(table_id.eq.${physicalTableId},is_completed.eq.false),and(id.eq.${clientLastOrderId},table_id.eq.${physicalTableId})`
                );
            } else {
                ordersQuery = ordersQuery
                    .eq('table_id', physicalTableId)
                    .eq('is_completed', false);
            }
        }

        const { data: rawOrders, error: ordersErr } = await ordersQuery.order('created_at', { ascending: false });

        if (ordersErr) {
            console.error('[CustomerOrders] DB query error:', ordersErr);
            return NextResponse.json({ error: 'Failed to retrieve orders' }, { status: 500 });
        }

        const ordersList = rawOrders || [];
        if (ordersList.length === 0) {
            return NextResponse.json({
                success: true,
                activeOrders: [],
                previousOrders: [],
            });
        }

        const orderIds = ordersList.map(o => o.id);

        // 5. Fetch Order Items in Batch with correct relation
        const { data: allItems, error: itemsErr } = await supabaseAdmin
            .from('order_items')
            .select(`
                id,
                order_id,
                menu_item_id,
                quantity,
                price_at_time,
                notes,
                status,
                item_type,
                combo_id,
                combo_name,
                combo_image,
                combo_items,
                tax_percent,
                cgst_percent,
                sgst_percent,
                menu_items (
                    name,
                    image_url
                )
            `)
            .in('order_id', orderIds);

        if (itemsErr) {
            console.error('[CustomerOrders] DB items query error:', itemsErr);
        }

        // 6. Fetch Delivery Assignments & Delivery Boy Details safely in Batch
        const assignmentByOrderId = new Map<string, any>();
        try {
            const { data: assignments, error: assignErr } = await supabaseAdmin
                .from('delivery_assignments')
                .select(`
                    id,
                    order_id,
                    delivery_boy_id,
                    status,
                    assigned_at,
                    accepted_at,
                    picked_up_at,
                    out_for_delivery_at,
                    delivered_at,
                    cancelled_at,
                    cancellation_reason
                `)
                .in('order_id', orderIds)
                .not('status', 'in', '("CANCELLED","REASSIGNED")');

            if (assignErr) {
                console.warn('[CustomerOrders] Error fetching delivery assignments:', assignErr);
            } else if (assignments && assignments.length > 0) {
                const boyIds = [...new Set(assignments.map(a => a.delivery_boy_id).filter(Boolean))];
                const { data: boys } = boyIds.length > 0 ? await supabaseAdmin
                    .from('delivery_boys')
                    .select('id, employee_id, vehicle_type, vehicle_number')
                    .in('id', boyIds) : { data: [] };

                const empIds = [...new Set((boys || []).map(b => b.employee_id).filter(Boolean))];
                const { data: emps } = empIds.length > 0 ? await supabaseAdmin
                    .from('employees')
                    .select('id, name, mobile, avatar_url')
                    .in('id', empIds) : { data: [] };

                const empMap = new Map((emps || []).map(e => [e.id, e]));
                const boyMap = new Map((boys || []).map(b => [b.id, {
                    ...b,
                    name: empMap.get(b.employee_id)?.name || 'Delivery Partner',
                    mobile: empMap.get(b.employee_id)?.mobile || '',
                    avatar_url: empMap.get(b.employee_id)?.avatar_url || null,
                }]));

                for (const a of assignments) {
                    const db = boyMap.get(a.delivery_boy_id);
                    assignmentByOrderId.set(a.order_id, {
                        id: a.id,
                        status: a.status,
                        assigned_at: a.assigned_at,
                        accepted_at: a.accepted_at,
                        picked_up_at: a.picked_up_at,
                        out_for_delivery_at: a.out_for_delivery_at,
                        delivered_at: a.delivered_at,
                        cancelled_at: a.cancelled_at,
                        cancellation_reason: a.cancellation_reason,
                        delivery_boy: db ? {
                            name: db.name,
                            mobile: db.mobile,
                            avatar_url: db.avatar_url,
                            vehicle_type: db.vehicle_type,
                            vehicle_number: db.vehicle_number,
                        } : null,
                    });
                }
            }
        } catch (e) {
            console.error('[CustomerOrders] Delivery assignments processing error:', e);
        }

        // Map items by order_id
        const itemsByOrderId = new Map<string, any[]>();
        (allItems || []).forEach(item => {
            const list = itemsByOrderId.get(item.order_id) || [];
            const mi = Array.isArray(item.menu_items) ? item.menu_items[0] : item.menu_items;
            const resolvedName = item.combo_name || mi?.name || `Item #${item.menu_item_id || item.id}`;
            const resolvedImage = item.combo_image || mi?.image_url || getCategoryMenuItemImage(resolvedName);

            let parsedComboItems = item.combo_items;
            if (typeof parsedComboItems === 'string') {
                try {
                    parsedComboItems = JSON.parse(parsedComboItems);
                } catch {
                    parsedComboItems = null;
                }
            }

            list.push({
                ...item,
                id: String(item.id),
                name: resolvedName,
                price: Number(item.price_at_time) || 0,
                image_url: resolvedImage,
                combo_items: parsedComboItems,
            });
            itemsByOrderId.set(item.order_id, list);
        });

        // 7. Resolve table numbers for friendly display
        const tableIds = [...new Set(ordersList.map(o => o.table_id).filter(Boolean))];
        const tableNumberMap = new Map<number, string>();
        if (tableIds.length > 0) {
            const { data: tableRows } = await supabaseAdmin
                .from('tables')
                .select('id, table_number')
                .in('id', tableIds);
            (tableRows || []).forEach(t => {
                tableNumberMap.set(t.id, t.table_number);
            });
        }

        // 8. Assemble Enriched Orders & Categorize
        const activeOrders: any[] = [];
        const previousOrders: any[] = [];

        for (const order of ordersList) {
            const items = itemsByOrderId.get(order.id) || [];
            const deliveryAssignment = assignmentByOrderId.get(order.id) || null;
            const resolvedTableNum = order.table_id ? tableNumberMap.get(order.table_id) : null;
            const tableName = resolvedTableNum
                ? `Table ${resolvedTableNum}`
                : (order.table_id ? `Table ${order.table_id}` : (order.order_type === 'DELIVERY' ? 'Delivery' : 'Takeaway'));

            const enrichedOrder = {
                ...order,
                items,
                delivery_assignment: deliveryAssignment,
                table_name: tableName,
            };

            const statusLower = (order.status || '').toLowerCase();
            const isCompleted = Boolean(order.is_completed);
            const isDineIn = order.order_type === 'DINE_IN' || Boolean(order.table_id);

            // Final statuses define Previous Orders vs Active Orders:
            // For Dine-In/Table orders:
            // The order remains active on the customer panel throughout their dining experience
            // (including placed, preparing, ready, served, paid) until either waiter or admin
            // explicitly clears the table (is_completed = true) or order is cancelled.
            let isFinalStatus: boolean;
            if (isDineIn) {
                isFinalStatus = isCompleted || statusLower === 'cancelled';
            } else if (order.order_type === 'TAKEAWAY') {
                isFinalStatus = isCompleted || ['completed', 'picked_up', 'cancelled'].includes(statusLower);
            } else {
                // DELIVERY
                isFinalStatus = isCompleted || ['delivered', 'cancelled'].includes(statusLower);
            }

            if (isFinalStatus) {
                // Past order history - only show if belonging to this authenticated customer or matching clientLastOrderId
                if (authenticatedCustomerId && order.customer_id === authenticatedCustomerId) {
                    previousOrders.push(enrichedOrder);
                } else if (clientLastOrderId && order.id === clientLastOrderId) {
                    previousOrders.push(enrichedOrder);
                }
            } else {
                // In-flight active order
                // Strict table scoping: If customer is currently at a physical table,
                // ONLY show as active order if this order belongs to this physical table!
                // An active order on Table 1 must NEVER show as active on Table 2.
                if (physicalTableId) {
                    if (order.table_id === physicalTableId) {
                        activeOrders.push(enrichedOrder);
                    } else if (authenticatedCustomerId && order.customer_id === authenticatedCustomerId) {
                        // In-flight order for a different table belongs to this user, but don't mix into active orders of this table
                        previousOrders.push(enrichedOrder);
                    }
                } else {
                    activeOrders.push(enrichedOrder);
                }
            }
        }

        return NextResponse.json({
            success: true,
            customerId: authenticatedCustomerId,
            activeOrders,
            previousOrders,
        });
    } catch (err: any) {
        console.error('[CustomerOrders Route Error]', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
