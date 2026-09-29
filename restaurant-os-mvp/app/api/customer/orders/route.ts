import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyJwt, extractCustomerTokenForRestaurant } from '@/lib/jwt-utils';
import { resolveRestaurantId } from '@/services/utils.service';

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
        const tableNumber = searchParams.get('tableNumber') || '';
        const clientCustomerId = searchParams.get('customerId') || '';

        const actualRestaurantId = await resolveRestaurantId(restaurantCode);
        if (!actualRestaurantId) {
            return NextResponse.json({ error: 'Invalid restaurant' }, { status: 400 });
        }

        // 1. Resolve Authenticated Customer
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
            const payload = await verifyJwt(token);
            if (payload?.customerId) {
                authenticatedCustomerId = payload.customerId;
            }
        }

        // Fallback: If token not present, verify clientCustomerId against customers table
        if (!authenticatedCustomerId && clientCustomerId) {
            const { data: verifiedCust } = await supabaseAdmin
                .from('customers')
                .select('id')
                .eq('restaurant_id', actualRestaurantId)
                .eq('id', clientCustomerId)
                .maybeSingle();
            if (verifiedCust?.id) {
                authenticatedCustomerId = verifiedCust.id;
            }
        }

        // 2. Resolve Table ID if physical table provided
        let physicalTableId: number | null = null;
        const isVirtual = tableNumber === 'takeaway' || tableNumber === 'delivery';
        if (tableNumber && !isVirtual) {
            const cleanTable = tableNumber.replace(/^table\s*[-_]?\s*/i, '').trim();
            const { data: tRow } = await supabaseAdmin
                .from('tables')
                .select('id, table_number')
                .eq('restaurant_id', actualRestaurantId)
                .or(`table_number.eq.${cleanTable},id.eq.${cleanTable}`)
                .maybeSingle();
            if (tRow?.id) {
                physicalTableId = tRow.id;
            }
        }

        // 3. Link any unlinked active orders on current physical table to this customer
        if (authenticatedCustomerId && physicalTableId) {
            try {
                await supabaseAdmin
                    .from('orders')
                    .update({ customer_id: authenticatedCustomerId })
                    .eq('restaurant_id', actualRestaurantId)
                    .eq('table_id', physicalTableId)
                    .eq('is_completed', false)
                    .is('customer_id', null);
            } catch (err) {
                console.warn('[CustomerOrders] Auto-link active table order warning:', err);
            }
        }

        // 4. Query Orders
        // If customer is authenticated: Query by customer_id
        // If unauthenticated: Query active order for current table ONLY (prevent viewing other customers)
        let ordersQuery = supabaseAdmin
            .from('orders')
            .select(`
                id,
                order_number,
                table_id,
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
                delivery_address,
                delivery_phone,
                delivery_notes,
                delivery_fee,
                customer_phone,
                customer_id,
                restaurant_id,
                created_at,
                completed_at
            `)
            .eq('restaurant_id', actualRestaurantId);

        if (authenticatedCustomerId) {
            ordersQuery = ordersQuery.eq('customer_id', authenticatedCustomerId);
        } else if (physicalTableId) {
            ordersQuery = ordersQuery.eq('table_id', physicalTableId).eq('is_completed', false);
        } else {
            // Unauthenticated without a table has no orders
            return NextResponse.json({
                success: true,
                activeOrders: [],
                previousOrders: [],
            });
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

        // 5. Fetch Order Items in Batch
        const { data: allItems } = await supabaseAdmin
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
                menu_items:menu_item_id (
                    name,
                    image_url
                )
            `)
            .in('order_id', orderIds);

        // 6. Fetch Delivery Assignments & Delivery Boy Details in Batch
        const { data: allAssignments } = await supabaseAdmin
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
                cancellation_reason,
                delivery_boys:delivery_boy_id (
                    id,
                    vehicle_type,
                    vehicle_number,
                    employee:employee_id (
                        name,
                        mobile,
                        avatar_url
                    )
                )
            `)
            .in('order_id', orderIds);

        // Map items and assignments by order_id
        const itemsByOrderId = new Map<string, any[]>();
        (allItems || []).forEach(item => {
            const list = itemsByOrderId.get(item.order_id) || [];
            const mi = Array.isArray(item.menu_items) ? item.menu_items[0] : item.menu_items;
            const resolvedName = item.combo_name || mi?.name || `Item #${item.menu_item_id || item.id}`;
            const resolvedImage = item.combo_image || mi?.image_url || null;

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
                name: resolvedName,
                price: Number(item.price_at_time) || 0,
                image_url: resolvedImage,
                combo_items: parsedComboItems,
            });
            itemsByOrderId.set(item.order_id, list);
        });

        const assignmentByOrderId = new Map<string, any>();
        (allAssignments || []).forEach(a => {
            const dboy = a.delivery_boys as any;
            const emp = dboy?.employee as any;
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
                delivery_boy: emp ? {
                    name: emp.name,
                    mobile: emp.mobile,
                    avatar_url: emp.avatar_url,
                    vehicle_type: dboy.vehicle_type,
                    vehicle_number: dboy.vehicle_number,
                } : null,
            });
        });

        // 7. Assemble Enriched Orders & Categorize
        const activeOrders: any[] = [];
        const previousOrders: any[] = [];

        for (const order of ordersList) {
            const items = itemsByOrderId.get(order.id) || [];
            const deliveryAssignment = assignmentByOrderId.get(order.id) || null;

            const enrichedOrder = {
                ...order,
                items,
                delivery_assignment: deliveryAssignment,
                table_name: order.table_id ? `Table ${order.table_id}` : (order.order_type === 'DELIVERY' ? 'Delivery' : 'Takeaway'),
            };

            const statusLower = (order.status || '').toLowerCase();
            const isCompleted = Boolean(order.is_completed);

            // Final statuses define Previous Orders:
            // Completed, Delivered, Picked Up, Cancelled, or Paid
            const isFinalStatus = 
                isCompleted ||
                ['completed', 'delivered', 'picked_up', 'cancelled', 'paid'].includes(statusLower);

            if (isFinalStatus) {
                previousOrders.push(enrichedOrder);
            } else {
                activeOrders.push(enrichedOrder);
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
