import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getDeliveryOrAdminUserFromRequest } from '@/lib/jwt-utils';
import { resolveRestaurantId } from '@/services/utils.service';

const VALID_TRANSITIONS: Record<string, string[]> = {
    'ASSIGNED': ['ACCEPTED', 'CANCELLED', 'REASSIGNED'],
    'ACCEPTED': ['PICKED_UP', 'CANCELLED'],
    'PICKED_UP': ['OUT_FOR_DELIVERY', 'CANCELLED'],
    'OUT_FOR_DELIVERY': ['DELIVERED', 'CANCELLED'],
    'DELIVERED': [],
    'CANCELLED': [],
    'REASSIGNED': [],
};

/**
 * POST /api/delivery/status
 * Updates a delivery assignment status.
 * Body: { assignmentId, status, cancellation_reason?, notes?, newDeliveryBoyId? (for reassign), restaurantId? }
 * 
 * Delivery boys can update: ACCEPTED, PICKED_UP, OUT_FOR_DELIVERY, DELIVERED
 * Admins can do everything including CANCELLED and REASSIGNED
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { assignmentId, status: newStatus, cancellation_reason, notes, newDeliveryBoyId, restaurantId, restaurantCode } = body;

        const targetRid = restaurantId || restaurantCode;
        const auth = await getDeliveryOrAdminUserFromRequest(request, targetRid);
        if (!auth) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { user, isAdmin, isDeliveryBoy } = auth;

        if (!isAdmin && !isDeliveryBoy) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const rawRid = targetRid || user.restaurantId;
        if (!rawRid) {
            return NextResponse.json({ error: 'Restaurant context required' }, { status: 400 });
        }

        const rid = (await resolveRestaurantId(rawRid)) || rawRid;

        // Tenant check
        const role = String(user.role || '').toLowerCase();
        if (role !== 'super_admin' && role !== 'superadmin' && user.restaurantId) {
            const userRid = (await resolveRestaurantId(user.restaurantId)) || user.restaurantId;
            if (userRid && userRid !== rid) {
                return NextResponse.json({ error: 'Unauthorized restaurant access' }, { status: 403 });
            }
        }

        if (!assignmentId || !newStatus) {
            return NextResponse.json({ error: 'assignmentId and status are required' }, { status: 400 });
        }

        // Fetch current assignment
        const { data: assignment, error: fetchErr } = await supabaseAdmin
            .from('delivery_assignments')
            .select('*')
            .eq('id', assignmentId)
            .eq('restaurant_id', rid)
            .maybeSingle();

        if (fetchErr || !assignment) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        // Delivery boy can only update their own assignments
        if (isDeliveryBoy && assignment.delivery_boy_id !== user.deliveryBoyId) {
            return NextResponse.json({ error: 'You can only update your own assignments' }, { status: 403 });
        }

        // Validate status transition
        const currentStatus = assignment.status;

        // Delivery boy can reject an initial assignment or report an undeliverable issue (ASSIGNED/ACCEPTED/PICKED_UP/OUT_FOR_DELIVERY -> CANCELLED with reason)
        const isBoyReportingIssue = isDeliveryBoy && newStatus === 'CANCELLED' && Boolean(cancellation_reason || body.issue_type || notes);
        const isBoyRejectingAssignment = isDeliveryBoy && currentStatus === 'ASSIGNED' && newStatus === 'CANCELLED';

        if (isDeliveryBoy && (newStatus === 'REASSIGNED' || newStatus === 'CANCELLED') && !isBoyRejectingAssignment && !isBoyReportingIssue) {
            return NextResponse.json({ error: 'Only admin can cancel or reassign in-progress deliveries without an issue report' }, { status: 403 });
        }

        const allowed = VALID_TRANSITIONS[currentStatus];
        if (!allowed || !allowed.includes(newStatus)) {
            return NextResponse.json({
                error: `Invalid transition: ${currentStatus} → ${newStatus}. Allowed: ${allowed?.join(', ') || 'none'}`
            }, { status: 400 });
        }

        // Check delivery radius & deactivated zone when accepting delivery
        if (newStatus === 'ACCEPTED') {
            const { data: ord } = await supabaseAdmin
                .from('orders')
                .select('id, delivery_zone_id, delivery_lat, delivery_lng')
                .eq('id', assignment.order_id)
                .maybeSingle();

            if (ord) {
                if (ord.delivery_zone_id) {
                    const { data: zn } = await supabaseAdmin
                        .from('delivery_zones')
                        .select('id, name, enabled')
                        .eq('id', ord.delivery_zone_id)
                        .maybeSingle();
                    if (zn && !zn.enabled) {
                        return NextResponse.json({
                            error: `Cannot accept delivery: Delivery zone "${zn.name}" has been deactivated.`
                        }, { status: 400 });
                    }
                }

                if (ord.delivery_lat != null && ord.delivery_lng != null) {
                    const { data: dSet } = await supabaseAdmin
                        .from('delivery_settings')
                        .select('latitude, longitude, delivery_order_radius, max_delivery_radius_km')
                        .eq('restaurant_id', rid)
                        .maybeSingle();

                    const rLat = dSet?.latitude != null ? Number(dSet.latitude) : null;
                    const rLng = dSet?.longitude != null ? Number(dSet.longitude) : null;
                    const maxR = dSet?.delivery_order_radius != null 
                        ? Number(dSet.delivery_order_radius) 
                        : (dSet?.max_delivery_radius_km != null ? Number(dSet.max_delivery_radius_km) : null);

                    if (rLat != null && rLng != null && maxR != null && maxR > 0) {
                        const dLat = ((Number(ord.delivery_lat) - rLat) * Math.PI) / 180;
                        const dLng = ((Number(ord.delivery_lng) - rLng) * Math.PI) / 180;
                        const a = Math.sin(dLat / 2) ** 2 + Math.cos((rLat * Math.PI) / 180) * Math.cos((Number(ord.delivery_lat) * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
                        const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                        if (dist > maxR) {
                            return NextResponse.json({
                                error: `Cannot accept delivery: Delivery location is ${dist.toFixed(2)} km away, exceeding restaurant delivery radius of ${maxR} km.`
                            }, { status: 400 });
                        }
                    }

                    const { data: deactZones } = await supabaseAdmin.rpc('check_deactivated_zone', {
                        p_restaurant_id: rid,
                        p_lat: Number(ord.delivery_lat),
                        p_lng: Number(ord.delivery_lng),
                    });

                    if (deactZones && deactZones.length > 0) {
                        return NextResponse.json({
                            error: `Cannot accept delivery: Customer location falls inside deactivated delivery zone "${deactZones[0].zone_name}".`
                        }, { status: 400 });
                    }
                }
            }
        }

        // Handle REASSIGNMENT
        if (newStatus === 'REASSIGNED') {
            if (!newDeliveryBoyId) {
                return NextResponse.json({ error: 'newDeliveryBoyId required for reassignment' }, { status: 400 });
            }

            // Can only reassign before pickup
            if (!['ASSIGNED', 'ACCEPTED'].includes(currentStatus)) {
                return NextResponse.json({ error: 'Can only reassign before pickup' }, { status: 400 });
            }

            // Validate new delivery boy
            const { data: newBoy } = await supabaseAdmin
                .from('delivery_boys')
                .select('id, status')
                .eq('id', newDeliveryBoyId)
                .eq('restaurant_id', rid)
                .maybeSingle();

            if (!newBoy) {
                return NextResponse.json({ error: 'New delivery boy not found' }, { status: 404 });
            }
            if (newBoy.status === 'inactive' || newBoy.status === 'offline') {
                return NextResponse.json({ error: `New delivery boy is ${newBoy.status}` }, { status: 400 });
            }

            // Mark current as REASSIGNED
            await supabaseAdmin
                .from('delivery_assignments')
                .update({
                    status: 'REASSIGNED',
                    cancelled_at: new Date().toISOString(),
                    cancellation_reason: cancellation_reason || 'Reassigned by admin',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', assignmentId);

            // Create new assignment
            const { data: newAssignment, error: newErr } = await supabaseAdmin
                .from('delivery_assignments')
                .insert({
                    restaurant_id: rid,
                    order_id: assignment.order_id,
                    delivery_boy_id: newDeliveryBoyId,
                    assigned_by: user.userId || user.id || null,
                    status: 'ASSIGNED',
                    assigned_at: new Date().toISOString(),
                })
                .select()
                .single();

            if (newErr) {
                return NextResponse.json({ error: newErr.message }, { status: 500 });
            }

            return NextResponse.json({ assignment: newAssignment, message: 'Delivery reassigned successfully' });
        }

        // Build update payload
        const update: any = {
            status: newStatus,
            updated_at: new Date().toISOString(),
        };

        const now = new Date().toISOString();
        switch (newStatus) {
            case 'ACCEPTED': update.accepted_at = now; break;
            case 'PICKED_UP': update.picked_up_at = now; break;
            case 'OUT_FOR_DELIVERY': update.out_for_delivery_at = now; break;
            case 'DELIVERED': update.delivered_at = now; break;
            case 'CANCELLED':
                update.cancelled_at = now;
                if (cancellation_reason) update.cancellation_reason = cancellation_reason;
                break;
        }
        if (notes) update.notes = notes;

        const { data: updated, error: updateErr } = await supabaseAdmin
            .from('delivery_assignments')
            .update(update)
            .eq('id', assignmentId)
            .eq('restaurant_id', rid)
            .select()
            .single();

        if (updateErr) {
            return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }

        // If delivered, update the order status to 'served' (delivery equivalent of served)
        if (newStatus === 'DELIVERED') {
            await supabaseAdmin
                .from('orders')
                .update({ 
                    status: 'served',
                    is_completed: true,
                    completed_at: now 
                })
                .eq('id', assignment.order_id)
                .eq('restaurant_id', rid);
        }

        return NextResponse.json({ assignment: updated, message: `Status updated to ${newStatus}` });

    } catch (err: any) {
        console.error('[DeliveryStatus] Error:', err);
        return NextResponse.json({ error: err.message || 'Status update failed' }, { status: 500 });
    }
}
