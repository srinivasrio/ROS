import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getDeliveryOrAdminUserFromRequest } from '@/lib/jwt-utils';
import { resolveRestaurantId } from '@/services/utils.service';
import crypto from 'crypto';

const ADMIN_ROLES = ['restaurant_admin', 'admin', 'owner', 'restaurant_owner', 'manager'];

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
}

/**
 * GET /api/delivery/orders
 * Returns delivery orders for a restaurant.
 * Query params:
 * - restaurantId (required or from token)
 * - status (optional filter, e.g. 'ready')
 * - unassigned=true (only returns ready delivery orders without an active delivery assignment)
 * - limit (optional, default 50)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = request.nextUrl;
        const rawRestaurantId = searchParams.get('restaurantId') || searchParams.get('restaurantCode');
        const auth = await getDeliveryOrAdminUserFromRequest(request, rawRestaurantId);
        const user = auth?.user || null;

        let rid = rawRestaurantId || user?.restaurantId;
        if (!rid) {
            return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
        }

        const resolvedRid = await resolveRestaurantId(rid);
        if (!resolvedRid) {
            return NextResponse.json({ error: 'Invalid restaurant' }, { status: 404 });
        }

        const statusFilter = searchParams.get('status');
        const unassignedOnly = searchParams.get('unassigned') === 'true';
        const limit = parseInt(searchParams.get('limit') || '50', 10);

        // Fetch active assignments first if checking unassigned or joining assignments
        const { data: activeAssignments } = await supabaseAdmin
            .from('delivery_assignments')
            .select('*')
            .eq('restaurant_id', resolvedRid)
            .not('status', 'in', '("CANCELLED","REASSIGNED")');

        const activeOrderIds = new Set((activeAssignments || []).map(a => a.order_id));
        const assignmentsByOrderId = new Map<string, any>();
        (activeAssignments || []).forEach(a => assignmentsByOrderId.set(a.order_id, a));

        const typeParam = searchParams.get('type') || 'DELIVERY';

        let query = supabaseAdmin
            .from('orders')
            .select('*')
            .eq('restaurant_id', resolvedRid)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (typeParam === 'TAKEAWAY') {
            query = query.eq('order_type', 'TAKEAWAY');
        } else if (typeParam === 'ALL') {
            query = query.in('order_type', ['DELIVERY', 'TAKEAWAY']);
        } else {
            query = query.eq('order_type', 'DELIVERY');
        }

        if (statusFilter) {
            const statuses = statusFilter.split(',').map(s => s.trim());
            if (statuses.length === 1) {
                query = query.eq('status', statuses[0]);
            } else {
                query = query.in('status', statuses);
            }
        }

        const { data: orders, error: ordersErr } = await query;

        if (ordersErr) {
            return NextResponse.json({ error: ordersErr.message }, { status: 500 });
        }

        let filteredOrders = orders || [];

        if (unassignedOnly) {
            filteredOrders = filteredOrders.filter(o => !activeOrderIds.has(o.id));
        }

        // Fetch items for these orders
        const orderIds = filteredOrders.map(o => o.id);
        let itemsByOrderId: Record<string, any[]> = {};

        if (orderIds.length > 0) {
            const { data: items } = await supabaseAdmin
                .from('order_items')
                .select('*')
                .in('order_id', orderIds);

            (items || []).forEach(item => {
                if (!itemsByOrderId[item.order_id]) {
                    itemsByOrderId[item.order_id] = [];
                }
                itemsByOrderId[item.order_id].push(item);
            });
        }

        // Enrich orders
        const enriched = filteredOrders.map(order => ({
            ...order,
            items: itemsByOrderId[order.id] || [],
            activeAssignment: assignmentsByOrderId.get(order.id) || null,
            isAssigned: activeOrderIds.has(order.id),
        }));

        return NextResponse.json({ orders: enriched });

    } catch (err: any) {
        console.error('[DeliveryOrders GET] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * POST /api/delivery/orders
 * Creates a delivery order directly (admin or checkout).
 * Body:
 * {
 *   restaurantId,
 *   customerName,
 *   deliveryPhone,
 *   deliveryAddress,
 *   deliveryNotes?,
 *   deliveryFee?,
 *   status?: 'placed' | 'ready',
 *   items: [{ name, price, quantity, notes? }]
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            restaurantId,
            customerName,
            deliveryPhone,
            deliveryAddress,
            deliveryNotes,
            deliveryFee: clientFee = 0,
            deliveryZoneId: clientZoneId,
            customerLat,
            customerLng,
            status = 'ready', // Default to ready for testing or manual creation
            items = []
        } = body;

        if (!restaurantId) {
            return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
        }

        const resolvedRid = await resolveRestaurantId(restaurantId);
        if (!resolvedRid) {
            return NextResponse.json({ error: 'Invalid restaurant' }, { status: 404 });
        }

        if (!deliveryAddress || !deliveryAddress.trim()) {
            return NextResponse.json({ error: 'deliveryAddress is required' }, { status: 400 });
        }

        if (!deliveryPhone || !deliveryPhone.trim()) {
            return NextResponse.json({ error: 'deliveryPhone is required' }, { status: 400 });
        }

        // Calculate item totals
        let subtotal = 0;
        const validItems = Array.isArray(items) && items.length > 0 ? items : [
            { name: 'Standard Delivery Order', price: 250, quantity: 1 }
        ];

        validItems.forEach((it: any) => {
            const price = Number(it.price) || 0;
            const qty = Number(it.quantity) || 1;
            subtotal += price * qty;
        });

        // Server-side zone validation if coordinates are present
        let finalFee = Number(clientFee) || 0;
        let finalZoneId: string | null = clientZoneId || null;

        if (customerLat == null || customerLng == null) {
            return NextResponse.json({
                error: 'Customer location coordinates are required to verify delivery eligibility.'
            }, { status: 400 });
        }

        // Fetch delivery settings for origin and radius
        const { data: dSettings } = await supabaseAdmin
            .from('delivery_settings')
            .select('latitude, longitude, delivery_order_radius, max_delivery_radius_km')
            .eq('restaurant_id', resolvedRid)
            .maybeSingle();

        const restLat = dSettings?.latitude != null ? Number(dSettings.latitude) : null;
        const restLng = dSettings?.longitude != null ? Number(dSettings.longitude) : null;
        const maxRadius = dSettings?.delivery_order_radius != null 
            ? Number(dSettings.delivery_order_radius) 
            : (dSettings?.max_delivery_radius_km != null ? Number(dSettings.max_delivery_radius_km) : 5.0);

        if (restLat == null || restLng == null) {
            return NextResponse.json({
                error: 'Restaurant location has not been configured yet.'
            }, { status: 400 });
        }

        // ══════════════════════════════════════════════════════════════
        // CONDITION 1: Customer location should be inside the delivery radius
        // ══════════════════════════════════════════════════════════════
        const distKm = calculateDistanceKm(restLat, restLng, Number(customerLat), Number(customerLng));
        if (distKm > maxRadius) {
            return NextResponse.json({
                error: `Delivery is not available: customer location is ${distKm} km away, which exceeds the maximum restaurant delivery radius of ${maxRadius} km (Condition 1 failed).`
            }, { status: 400 });
        }

        // Check deactivated zone
        const { data: deactivatedZones } = await supabaseAdmin.rpc('check_deactivated_zone', {
            p_restaurant_id: resolvedRid,
            p_lat: Number(customerLat),
            p_lng: Number(customerLng),
        });

        if (deactivatedZones && deactivatedZones.length > 0) {
            return NextResponse.json({
                error: `Cannot place order: delivery zone "${deactivatedZones[0].zone_name}" is currently deactivated.`
            }, { status: 400 });
        }

        // ══════════════════════════════════════════════════════════════
        // CONDITION 2: Customer location inside ANY active delivery zone
        // ══════════════════════════════════════════════════════════════
        const { data: matchedZones } = await supabaseAdmin.rpc('check_delivery_zone', {
            p_restaurant_id: resolvedRid,
            p_lat: Number(customerLat),
            p_lng: Number(customerLng),
        });

        if (!matchedZones || matchedZones.length === 0) {
            return NextResponse.json({
                error: 'Delivery is not available: customer location is not inside any active delivery zone (Condition 2 failed).'
            }, { status: 400 });
        }

        const zone = matchedZones[0];
        finalFee = Number(zone.delivery_fee) || 0;
        finalZoneId = zone.zone_id;

        if (Number(zone.minimum_order_amount) > 0 && subtotal < Number(zone.minimum_order_amount)) {
            return NextResponse.json({
                error: `Minimum order amount for ${zone.zone_name} is ₹${zone.minimum_order_amount}. Your subtotal is ₹${subtotal}.`
            }, { status: 400 });
        }

        const totalAmount = subtotal + finalFee;
        const orderId = crypto.randomUUID();

        // Insert delivery order
        const { data: order, error: orderErr } = await supabaseAdmin
            .from('orders')
            .insert({
                id: orderId,
                restaurant_id: resolvedRid,
                order_type: 'DELIVERY',
                status: status,
                total_amount: totalAmount,
                delivery_address: deliveryAddress.trim(),
                delivery_phone: deliveryPhone.trim(),
                delivery_notes: deliveryNotes?.trim() || null,
                delivery_fee: finalFee,
                delivery_zone_id: finalZoneId,
                customer_lat: customerLat != null ? Number(customerLat) : null,
                customer_lng: customerLng != null ? Number(customerLng) : null,
                delivery_lat: customerLat != null ? Number(customerLat) : null,
                delivery_lng: customerLng != null ? Number(customerLng) : null,
                customer_phone: deliveryPhone.trim(),
                is_completed: false,
                amount_paid: 0,
            })
            .select()
            .single();

        if (orderErr) {
            console.error('[DeliveryOrders POST] Order insert error:', orderErr);
            return NextResponse.json({ error: orderErr.message }, { status: 500 });
        }

        // Insert order items
        const orderItemsPayload = validItems.map((it: any) => ({
            order_id: orderId,
            restaurant_id: resolvedRid,
            item_name: it.name || it.item_name || 'Item',
            quantity: Number(it.quantity) || 1,
            price: Number(it.price) || 0,
            total_price: (Number(it.price) || 0) * (Number(it.quantity) || 1),
            notes: it.notes || '',
            status: status === 'ready' ? 'ready' : 'placed'
        }));

        await supabaseAdmin.from('order_items').insert(orderItemsPayload);

        return NextResponse.json({
            success: true,
            order: {
                ...order,
                items: orderItemsPayload,
            },
            message: 'Delivery order created successfully',
        }, { status: 201 });

    } catch (err: any) {
        console.error('[DeliveryOrders POST] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * PATCH /api/delivery/orders
 * Updates a delivery order status (accept, reject, ready, cancel).
 * Body: { orderId, action: 'accept' | 'reject' | 'ready' | 'cancel', cancellationReason?, restaurantId? }
 */
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { orderId, action, cancellationReason, restaurantId, restaurantCode } = body;

        const targetRid = restaurantId || restaurantCode;
        const auth = await getDeliveryOrAdminUserFromRequest(request, targetRid);
        if (!auth || (!auth.isAdmin && !auth.isDeliveryBoy)) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const rawRid = targetRid || auth.user?.restaurantId;
        if (!rawRid) {
            return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
        }

        const rid = (await resolveRestaurantId(rawRid)) || rawRid;

        if (!orderId) {
            return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
        }

        // Verify order exists and belongs to this restaurant
        const { data: order, error: orderErr } = await supabaseAdmin
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .eq('restaurant_id', rid)
            .maybeSingle();

        if (orderErr || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const now = new Date().toISOString();

        if (action === 'accept') {
            // Validate: Do not accept delivery orders from outside radius or from deactivated zones
            if (order.order_type === 'DELIVERY') {
                if (order.delivery_zone_id) {
                    const { data: zn } = await supabaseAdmin
                        .from('delivery_zones')
                        .select('id, name, enabled')
                        .eq('id', order.delivery_zone_id)
                        .maybeSingle();

                    if (zn && !zn.enabled) {
                        return NextResponse.json({
                            error: `Cannot accept order: Delivery zone "${zn.name}" has been deactivated.`
                        }, { status: 400 });
                    }
                }

                if (order.delivery_lat != null && order.delivery_lng != null) {
                    const { data: dSettings } = await supabaseAdmin
                        .from('delivery_settings')
                        .select('latitude, longitude, delivery_order_radius, max_delivery_radius_km')
                        .eq('restaurant_id', rid)
                        .maybeSingle();

                    const restLat = dSettings?.latitude != null ? Number(dSettings.latitude) : null;
                    const restLng = dSettings?.longitude != null ? Number(dSettings.longitude) : null;
                    const maxRadius = dSettings?.delivery_order_radius != null 
                        ? Number(dSettings.delivery_order_radius) 
                        : (dSettings?.max_delivery_radius_km != null ? Number(dSettings.max_delivery_radius_km) : null);

                    if (restLat != null && restLng != null && maxRadius != null && maxRadius > 0) {
                        const distKm = calculateDistanceKm(restLat, restLng, Number(order.delivery_lat), Number(order.delivery_lng));
                        if (distKm > maxRadius) {
                            return NextResponse.json({
                                error: `Cannot accept order: Delivery location is ${distKm} km away, exceeding the restaurant delivery radius of ${maxRadius} km.`
                            }, { status: 400 });
                        }
                    }

                    const { data: deactZones } = await supabaseAdmin.rpc('check_deactivated_zone', {
                        p_restaurant_id: rid,
                        p_lat: Number(order.delivery_lat),
                        p_lng: Number(order.delivery_lng),
                    });

                    if (deactZones && deactZones.length > 0) {
                        return NextResponse.json({
                            error: `Cannot accept order: Customer location falls inside deactivated delivery zone "${deactZones[0].zone_name}".`
                        }, { status: 400 });
                    }
                }
            }

            // Move order to 'preparing' (accepted by kitchen/restaurant)
            const { error: updateErr } = await supabaseAdmin
                .from('orders')
                .update({
                    status: 'preparing',
                    accepted_at: now,
                })
                .eq('id', orderId)
                .eq('restaurant_id', rid);

            if (updateErr) {
                return NextResponse.json({ error: updateErr.message }, { status: 500 });
            }

            // Update order items to preparing
            await supabaseAdmin
                .from('order_items')
                .update({ status: 'preparing' })
                .eq('order_id', orderId);

            return NextResponse.json({
                success: true,
                message: 'Order accepted and sent to kitchen for preparation',
                status: 'preparing'
            });

        } else if (action === 'reject' || action === 'cancel') {
            const reason = cancellationReason || (action === 'reject' ? 'Order rejected by restaurant' : 'Order cancelled by restaurant');

            // Move order to 'cancelled'
            const { error: updateErr } = await supabaseAdmin
                .from('orders')
                .update({
                    status: 'cancelled',
                    cancellation_reason: reason,
                    is_completed: true,
                    completed_at: now,
                })
                .eq('id', orderId)
                .eq('restaurant_id', rid);

            if (updateErr) {
                return NextResponse.json({ error: updateErr.message }, { status: 500 });
            }

            // Update items to cancelled
            await supabaseAdmin
                .from('order_items')
                .update({ status: 'cancelled' })
                .eq('order_id', orderId);

            // Cancel any active delivery assignments
            await supabaseAdmin
                .from('delivery_assignments')
                .update({
                    status: 'CANCELLED',
                    cancelled_at: now,
                    cancellation_reason: reason,
                    updated_at: now,
                })
                .eq('order_id', orderId)
                .eq('restaurant_id', rid)
                .not('status', 'in', '("DELIVERED","CANCELLED","REASSIGNED")');

            return NextResponse.json({
                success: true,
                message: action === 'reject' ? 'Order rejected successfully' : 'Order cancelled successfully',
                status: 'cancelled'
            });

        } else if (action === 'ready') {
            // Move order to 'ready' (ready for pickup)
            const { error: updateErr } = await supabaseAdmin
                .from('orders')
                .update({
                    status: 'ready',
                })
                .eq('id', orderId)
                .eq('restaurant_id', rid);

            if (updateErr) {
                return NextResponse.json({ error: updateErr.message }, { status: 500 });
            }

            await supabaseAdmin
                .from('order_items')
                .update({ status: 'ready' })
                .eq('order_id', orderId);

            return NextResponse.json({
                success: true,
                message: 'Order marked as ready for delivery assignment',
                status: 'ready'
            });

        } else if (action === 'complete' || action === 'serve' || action === 'delivered') {
            const { error: updateErr } = await supabaseAdmin
                .from('orders')
                .update({
                    status: 'served',
                    is_completed: true,
                    completed_at: now,
                })
                .eq('id', orderId)
                .eq('restaurant_id', rid);

            if (updateErr) {
                return NextResponse.json({ error: updateErr.message }, { status: 500 });
            }

            await supabaseAdmin
                .from('order_items')
                .update({ status: 'served', served_at: now })
                .eq('order_id', orderId);

            return NextResponse.json({
                success: true,
                message: 'Order marked as completed/collected',
                status: 'served'
            });

        } else {
            return NextResponse.json({ error: `Unsupported action: ${action}. Expected 'accept', 'reject', 'ready', or 'complete'` }, { status: 400 });
        }

    } catch (err: any) {
        console.error('[DeliveryOrders PATCH] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

