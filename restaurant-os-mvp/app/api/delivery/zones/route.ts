import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminUserFromRequest } from '@/lib/jwt-utils';
import { resolveRestaurantId } from '@/services/utils.service';
import { verifyFeatureEntitlement } from '@/lib/entitlement-guard';

/**
 * GET /api/delivery/zones?restaurantId=xxx
 * Retrieves all delivery zones for a restaurant.
 */
export async function GET(request: NextRequest) {
    try {
        const rawRestaurantId = request.nextUrl.searchParams.get('restaurantId') || request.nextUrl.searchParams.get('restaurantCode');
        if (!rawRestaurantId) {
            return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
        }

        const restaurantId = (await resolveRestaurantId(rawRestaurantId)) || rawRestaurantId;

        // Feature Entitlement Authorization
        const entitlementCheck = await verifyFeatureEntitlement(restaurantId, 'delivery');
        if (!entitlementCheck.allowed) {
            return entitlementCheck.response;
        }

        const { data, error } = await supabaseAdmin.rpc('get_restaurant_delivery_zones', {
            p_restaurant_id: restaurantId,
        });

        if (error) {
            console.error('[GET /api/delivery/zones] RPC error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const formattedZones = (data || []).map((z: any) => ({
            id: z.id,
            restaurantId: z.restaurant_id,
            name: z.name,
            deliveryFee: Number(z.delivery_fee) || 0,
            minimumOrderAmount: Number(z.minimum_order_amount) || 0,
            enabled: Boolean(z.enabled),
            geojson: typeof z.geojson === 'string' ? JSON.parse(z.geojson) : z.geojson,
            createdAt: z.created_at,
            updatedAt: z.updated_at,
        }));

        return NextResponse.json({ zones: formattedZones });
    } catch (err: any) {
        console.error('[GET /api/delivery/zones] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

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
 * POST /api/delivery/zones
 * Creates or updates a delivery zone with polygon geometry.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            id, // Optional, for edit
            restaurantId,
            name,
            geojson,
            deliveryFee,
            minimumOrderAmount,
            enabled = true,
            allowOverlap = false,
        } = body;

        const targetRid = restaurantId || body?.restaurantCode;
        const user = await getAdminUserFromRequest(request, targetRid);
        if (!user) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const rawRid = targetRid || user.restaurantId;
        if (!rawRid) {
            return NextResponse.json({ error: 'Restaurant ID is required' }, { status: 400 });
        }
        const rid = (await resolveRestaurantId(rawRid)) || rawRid;

        // Feature Entitlement Authorization
        const entitlementCheck = await verifyFeatureEntitlement(rid, 'delivery');
        if (!entitlementCheck.allowed) {
            return entitlementCheck.response;
        }

        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'Zone name is required' }, { status: 400 });
        }

        if (!geojson) {
            return NextResponse.json({ error: 'Polygon GeoJSON is required' }, { status: 400 });
        }

        const geojsonString = typeof geojson === 'string' ? geojson : JSON.stringify(geojson);

        // Check if polygon coordinates exceed restaurant maximum delivery radius
        const { data: dSettings } = await supabaseAdmin
            .from('delivery_settings')
            .select('latitude, longitude, delivery_order_radius, max_delivery_radius_km')
            .eq('restaurant_id', rid)
            .maybeSingle();

        const restLat = dSettings?.latitude != null ? Number(dSettings.latitude) : null;
        const restLng = dSettings?.longitude != null ? Number(dSettings.longitude) : null;
        const maxDeliveryRadius = dSettings?.delivery_order_radius != null 
            ? Number(dSettings.delivery_order_radius) 
            : (dSettings?.max_delivery_radius_km != null ? Number(dSettings.max_delivery_radius_km) : null);

        if (restLat != null && restLng != null && maxDeliveryRadius != null && maxDeliveryRadius > 0) {
            const parsedGeo = typeof geojson === 'string' ? JSON.parse(geojson) : geojson;
            const ring = parsedGeo?.coordinates?.[0] || [];
            for (const pt of ring) {
                const [lng, lat] = pt;
                const dist = calculateDistanceKm(restLat, restLng, Number(lat), Number(lng));
                // Allow a small 0.05 km (50m) epsilon for floating-point/geodesic calculation differences
                if (dist > maxDeliveryRadius + 0.05) {
                    return NextResponse.json({
                        error: 'ZONE_EXCEEDS_RADIUS',
                        message: `Zone boundary point (${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}) is ${dist} km away, exceeding the restaurant delivery radius of ${maxDeliveryRadius} km. Zone must be contained within the delivery radius.`
                    }, { status: 400 });
                }
            }
        }

        // Check for overlapping zones if enabled and allowOverlap is not true
        if (enabled && !allowOverlap) {
            const { data: overlaps, error: overlapErr } = await supabaseAdmin.rpc('check_zone_overlap', {
                p_restaurant_id: rid,
                p_zone_id: id || null,
                p_geojson: geojsonString,
            });

            if (overlapErr) {
                if (overlapErr.message.includes('self-intersecting') || overlapErr.message.includes('invalid') || overlapErr.message.includes('Invalid GeoJSON')) {
                    return NextResponse.json({
                        error: 'INVALID_POLYGON',
                        message: overlapErr.message,
                    }, { status: 400 });
                }
                console.error('[POST /api/delivery/zones] Overlap check error:', overlapErr);
            }

            if (overlaps && overlaps.length > 0) {
                const names = overlaps.map((o: any) => o.overlapping_zone_name).join(', ');
                return NextResponse.json({
                    error: 'OVERLAPPING_ZONES',
                    overlappingZones: overlaps,
                    message: `Zone polygon overlaps with existing enabled zone(s): ${names}. Please adjust the boundary or confirm overlap.`,
                }, { status: 409 });
            }
        }

        // Save delivery zone using PostGIS
        const { data, error } = await supabaseAdmin.rpc('save_delivery_zone', {
            p_restaurant_id: rid,
            p_name: name.trim(),
            p_geojson: geojsonString,
            p_delivery_fee: Number(deliveryFee) || 0,
            p_minimum_order_amount: Number(minimumOrderAmount) || 0,
            p_enabled: Boolean(enabled),
            p_zone_id: id || null,
        });

        if (error) {
            console.error('[POST /api/delivery/zones] RPC error:', error);
            // Check for known PostGIS validity errors
            if (error.message.includes('self-intersecting') || error.message.includes('invalid')) {
                return NextResponse.json({
                    error: 'INVALID_GEOMETRY',
                    message: 'Polygon boundary is self-intersecting or invalid. Please adjust the vertices to form a simple closed polygon.'
                }, { status: 400 });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const saved = Array.isArray(data) ? data[0] : data;
        return NextResponse.json({
            success: true,
            zone: {
                id: saved.id,
                restaurantId: saved.restaurant_id,
                name: saved.name,
                deliveryFee: Number(saved.delivery_fee) || 0,
                minimumOrderAmount: Number(saved.minimum_order_amount) || 0,
                enabled: Boolean(saved.enabled),
                geojson: typeof saved.geojson === 'string' ? JSON.parse(saved.geojson) : saved.geojson,
                createdAt: saved.created_at,
                updatedAt: saved.updated_at,
            }
        }, { status: id ? 200 : 201 });

    } catch (err: any) {
        console.error('[POST /api/delivery/zones] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * PATCH /api/delivery/zones
 * Quick update for status, fee, minimum order without resending geometry.
 */
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, restaurantId, name, deliveryFee, minimumOrderAmount, enabled } = body;

        const targetRid = restaurantId || body?.restaurantCode;
        const user = await getAdminUserFromRequest(request, targetRid);
        if (!user) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const rawRid = targetRid || user.restaurantId;
        if (!rawRid || !id) {
            return NextResponse.json({ error: 'Zone ID and restaurant ID are required' }, { status: 400 });
        }
        const rid = (await resolveRestaurantId(rawRid)) || rawRid;

        const updatePayload: Record<string, any> = {
            updated_at: new Date().toISOString(),
        };

        if (name !== undefined) updatePayload.name = name.trim();
        if (deliveryFee !== undefined) updatePayload.delivery_fee = Number(deliveryFee) || 0;
        if (minimumOrderAmount !== undefined) updatePayload.minimum_order_amount = Number(minimumOrderAmount) || 0;
        if (enabled !== undefined) updatePayload.enabled = Boolean(enabled);

        const { data, error } = await supabaseAdmin
            .from('delivery_zones')
            .update(updatePayload)
            .eq('id', id)
            .eq('restaurant_id', rid)
            .select()
            .single();

        if (error) {
            console.error('[PATCH /api/delivery/zones] Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, zone: data });
    } catch (err: any) {
        console.error('[PATCH /api/delivery/zones] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * DELETE /api/delivery/zones?id=xxx&restaurantId=xxx
 * Deletes a delivery zone.
 */
export async function DELETE(request: NextRequest) {
    try {
        const id = request.nextUrl.searchParams.get('id');
        const rawRestaurantId = request.nextUrl.searchParams.get('restaurantId') || request.nextUrl.searchParams.get('restaurantCode');

        const user = await getAdminUserFromRequest(request, rawRestaurantId);
        if (!user) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const targetRid = rawRestaurantId || user.restaurantId;
        if (!id || !targetRid) {
            return NextResponse.json({ error: 'Zone ID and restaurant ID are required' }, { status: 400 });
        }

        const restaurantId = (await resolveRestaurantId(targetRid)) || targetRid;

        const { data, error } = await supabaseAdmin.rpc('delete_delivery_zone', {
            p_restaurant_id: restaurantId,
            p_zone_id: id,
        });

        if (error) {
            console.error('[DELETE /api/delivery/zones] Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, deleted: data });
    } catch (err: any) {
        console.error('[DELETE /api/delivery/zones] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
