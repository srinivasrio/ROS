import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminUserFromRequest } from '@/lib/jwt-utils';
import { resolveRestaurantId } from '@/services/utils.service';

/**
 * POST /api/delivery/assign
 * Assigns a delivery boy to an order (admin only).
 * Body: { orderId, deliveryBoyId, restaurantId? }
 * 
 * Server-side validates:
 * - Order exists, belongs to restaurant, is DELIVERY type, is in 'ready' status
 * - Delivery boy exists, belongs to same restaurant, is active
 * - No duplicate active assignment for the order
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { orderId, deliveryBoyId, restaurantId, restaurantCode } = body;

        const targetRid = restaurantId || restaurantCode;
        const user = await getAdminUserFromRequest(request, targetRid);
        if (!user) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const rawRid = targetRid || user.restaurantId;
        if (!rawRid) {
            return NextResponse.json({ error: 'Restaurant context required' }, { status: 400 });
        }

        const rid = (await resolveRestaurantId(rawRid)) || rawRid;

        // Tenant boundary check (unless super admin)
        const role = String(user.role || '').toLowerCase();
        if (role !== 'super_admin' && role !== 'superadmin' && user.restaurantId) {
            const userRid = (await resolveRestaurantId(user.restaurantId)) || user.restaurantId;
            if (userRid && userRid !== rid) {
                return NextResponse.json({ error: 'Unauthorized restaurant access' }, { status: 403 });
            }
        }

        // Unassign flow if deliveryBoyId is empty/null
        if (!deliveryBoyId) {
            const { data: existing } = await supabaseAdmin
                .from('delivery_assignments')
                .select('id, status, delivery_boy_id')
                .eq('order_id', orderId)
                .eq('restaurant_id', rid)
                .not('status', 'in', '("CANCELLED","REASSIGNED")')
                .maybeSingle();

            if (existing) {
                if (['ASSIGNED', 'ACCEPTED'].includes(existing.status)) {
                    await supabaseAdmin
                        .from('delivery_assignments')
                        .update({
                            status: 'CANCELLED',
                            cancelled_at: new Date().toISOString(),
                            cancellation_reason: 'Unassigned by admin',
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', existing.id);

                    // Reset boy status to active if no other active deliveries
                    const { count } = await supabaseAdmin
                        .from('delivery_assignments')
                        .select('id', { count: 'exact', head: true })
                        .eq('delivery_boy_id', existing.delivery_boy_id)
                        .not('status', 'in', '("DELIVERED","CANCELLED","REASSIGNED")')
                        .neq('id', existing.id);

                    if (!count || count === 0) {
                        await supabaseAdmin
                            .from('delivery_boys')
                            .update({ status: 'active', updated_at: new Date().toISOString() })
                            .eq('id', existing.delivery_boy_id);
                    }

                    return NextResponse.json({ message: 'Delivery assignment removed' });
                } else {
                    return NextResponse.json({ 
                        error: `Cannot unassign: delivery is already ${existing.status.toLowerCase()}` 
                    }, { status: 400 });
                }
            }
            return NextResponse.json({ message: 'No active assignment found' });
        }

        // 1. Validate order: belongs to restaurant, is DELIVERY, active status
        const { data: order, error: orderErr } = await supabaseAdmin
            .from('orders')
            .select('id, status, order_type, restaurant_id')
            .eq('id', orderId)
            .eq('restaurant_id', rid)
            .maybeSingle();

        if (orderErr || !order) {
            return NextResponse.json({ error: 'Order not found in this restaurant' }, { status: 404 });
        }

        if (order.order_type !== 'DELIVERY') {
            return NextResponse.json({ error: 'This is not a delivery order' }, { status: 400 });
        }

        // Active delivery orders can be assigned when placed, preparing (accepted), or ready
        if (!['placed', 'preparing', 'ready'].includes(order.status)) {
            return NextResponse.json({ 
                error: `Cannot assign delivery boy to order in "${order.status}" status` 
            }, { status: 400 });
        }

        // 2. Validate delivery boy: belongs to restaurant, is active
        const { data: boy, error: boyErr } = await supabaseAdmin
            .from('delivery_boys')
            .select('id, status, restaurant_id')
            .eq('id', deliveryBoyId)
            .eq('restaurant_id', rid)
            .maybeSingle();

        if (boyErr || !boy) {
            return NextResponse.json({ error: 'Delivery boy not found in this restaurant' }, { status: 404 });
        }

        if (boy.status === 'inactive' || boy.status === 'offline') {
            return NextResponse.json({ error: `Delivery boy is currently ${boy.status}` }, { status: 400 });
        }

        // 3. Check for existing active assignment
        const { data: existing } = await supabaseAdmin
            .from('delivery_assignments')
            .select('id, status, delivery_boy_id')
            .eq('order_id', orderId)
            .eq('restaurant_id', rid)
            .not('status', 'in', '("CANCELLED","REASSIGNED")')
            .maybeSingle();

        if (existing) {
            // Already assigned to this delivery boy
            if (existing.delivery_boy_id === deliveryBoyId) {
                return NextResponse.json({ 
                    assignment: existing, 
                    message: 'Order is already assigned to this delivery boy' 
                });
            }

            // Can only reassign before pickup
            if (!['ASSIGNED', 'ACCEPTED'].includes(existing.status)) {
                return NextResponse.json({ 
                    error: `Cannot reassign: delivery boy has already picked up this order (${existing.status})` 
                }, { status: 400 });
            }

            // Mark existing assignment as REASSIGNED
            await supabaseAdmin
                .from('delivery_assignments')
                .update({
                    status: 'REASSIGNED',
                    cancelled_at: new Date().toISOString(),
                    cancellation_reason: 'Reassigned by admin',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);

            // If previous delivery boy has no other active assignments, reset their status to active
            const { count: prevBoyActiveCount } = await supabaseAdmin
                .from('delivery_assignments')
                .select('id', { count: 'exact', head: true })
                .eq('delivery_boy_id', existing.delivery_boy_id)
                .not('status', 'in', '("DELIVERED","CANCELLED","REASSIGNED")')
                .neq('id', existing.id);

            if (!prevBoyActiveCount || prevBoyActiveCount === 0) {
                await supabaseAdmin
                    .from('delivery_boys')
                    .update({ status: 'active', updated_at: new Date().toISOString() })
                    .eq('id', existing.delivery_boy_id);
            }
        }

        // 4. Create new assignment
        const { data: assignment, error: assignErr } = await supabaseAdmin
            .from('delivery_assignments')
            .insert({
                restaurant_id: rid,
                order_id: orderId,
                delivery_boy_id: deliveryBoyId,
                assigned_by: user.userId || user.id || null,
                status: 'ASSIGNED',
                assigned_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (assignErr) {
            if (assignErr.code === '23505') {
                return NextResponse.json({ error: 'Order already has an active assignment' }, { status: 409 });
            }
            return NextResponse.json({ error: assignErr.message }, { status: 500 });
        }

        // 5. If the order was still in 'placed' status, automatically advance to 'preparing'
        if (order.status === 'placed') {
            await supabaseAdmin
                .from('orders')
                .update({ status: 'preparing', updated_at: new Date().toISOString() })
                .eq('id', orderId)
                .eq('restaurant_id', rid);
        }

        // 6. Update delivery boy status to on_delivery
        await supabaseAdmin
            .from('delivery_boys')
            .update({ status: 'on_delivery', updated_at: new Date().toISOString() })
            .eq('id', deliveryBoyId);

        return NextResponse.json({ 
            assignment,
            message: 'Delivery boy assigned successfully' 
        });

    } catch (err: any) {
        console.error('[DeliveryAssign] Error:', err);
        return NextResponse.json({ error: err.message || 'Assignment failed' }, { status: 500 });
    }
}
