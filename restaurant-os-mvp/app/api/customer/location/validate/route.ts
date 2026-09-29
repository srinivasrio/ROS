import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveRestaurantId } from '@/services/utils.service';

/**
 * Server-side Haversine distance calculation in kilometers.
 * Never trust client distance.
 */
function calculateHaversineDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const rawRestaurantId = body.restaurantId || body.restaurantCode;

        if (!rawRestaurantId) {
            return NextResponse.json({ allowed: false, message: 'Restaurant ID is required' }, { status: 400 });
        }

        const restaurantId = (await resolveRestaurantId(rawRestaurantId)) || rawRestaurantId;

        const normalizedMode = String(body.mode || 'DINE_IN').toUpperCase();
        if (!['DINE_IN', 'TAKEAWAY', 'DELIVERY'].includes(normalizedMode)) {
            return NextResponse.json({ allowed: false, message: 'Invalid ordering mode' }, { status: 400 });
        }

        // Fetch restaurant settings
        const { data: settings, error } = await supabaseAdmin
            .from('delivery_settings')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .maybeSingle();

        if (error) {
            console.error('[Location Validation] DB error:', error);
            return NextResponse.json({ allowed: false, message: 'Failed to retrieve restaurant settings' }, { status: 500 });
        }

        // Fetch fallback coordinates from restaurants table if delivery_settings coordinates are null
        const { data: currentRest } = await supabaseAdmin
            .from('restaurants')
            .select('latitude, longitude')
            .eq('id', restaurantId)
            .maybeSingle();

        const dineInEnabled = settings?.dine_in_enabled !== false;
        const takeawayEnabled = settings?.takeaway_enabled !== false;
        const deliveryEnabled = settings?.delivery_enabled === true || settings?.enabled === true;

        // Check if mode is enabled
        if (normalizedMode === 'DINE_IN' && !dineInEnabled) {
            return NextResponse.json({
                allowed: false,
                reason: 'MODE_DISABLED',
                message: 'Dine In ordering is currently disabled for this restaurant.',
            });
        }
        if (normalizedMode === 'TAKEAWAY' && !takeawayEnabled) {
            return NextResponse.json({
                allowed: false,
                reason: 'MODE_DISABLED',
                message: 'Takeaway ordering is currently disabled for this restaurant.',
            });
        }
        if (normalizedMode === 'DELIVERY' && !deliveryEnabled) {
            return NextResponse.json({
                allowed: false,
                reason: 'MODE_DISABLED',
                message: 'Delivery is currently disabled for this restaurant.',
            });
        }

        const restaurantLat = settings?.latitude != null
            ? Number(settings.latitude)
            : (currentRest?.latitude != null ? Number(currentRest.latitude) : null);
        const restaurantLng = settings?.longitude != null
            ? Number(settings.longitude)
            : (currentRest?.longitude != null ? Number(currentRest.longitude) : null);

        // If restaurant hasn't set coordinates yet, allow orders with notice
        if (restaurantLat === null || restaurantLng === null) {
            return NextResponse.json({
                allowed: true,
                warning: 'Restaurant coordinates not configured',
                distanceKm: 0,
                radiusKm: null,
            });
        }

        // Validate client coordinates
        const customerLat = Number(body.latitude);
        const customerLng = Number(body.longitude);

        if (isNaN(customerLat) || isNaN(customerLng)) {
            return NextResponse.json({
                allowed: false,
                reason: 'COORDINATES_MISSING',
                message: 'Customer location coordinates are required for verification.',
            });
        }

        // Helper for user-friendly distance display
        const formatDistance = (distKm: number) => {
            if (distKm < 1) {
                return `${Math.round(distKm * 1000)}m`;
            }
            return `${distKm.toFixed(distKm % 1 === 0 ? 0 : 2)}km`;
        };

        // Calculate distance server-side
        const distanceKm = calculateHaversineDistanceKm(restaurantLat, restaurantLng, customerLat, customerLng);
        const roundedDistance = Math.round(distanceKm * 1000) / 1000;
        const distanceMeters = Math.round(distanceKm * 1000);

        if (normalizedMode === 'DINE_IN') {
            const dineInRadius = Number(settings?.dine_in_order_radius ?? settings?.dine_in_takeaway_order_radius ?? 0.1);
            const radiusMeters = Math.round(dineInRadius * 1000);
            if (distanceKm > dineInRadius) {
                return NextResponse.json({
                    allowed: false,
                    reason: 'OUT_OF_RANGE',
                    distanceKm: Math.round(distanceKm * 100) / 100,
                    distanceMeters,
                    radiusKm: dineInRadius,
                    radiusMeters,
                    message: `You must be near the restaurant to order Dine In (allowed within ${formatDistance(dineInRadius)}, your location is ${formatDistance(distanceKm)} away).`,
                });
            }
            return NextResponse.json({
                allowed: true,
                distanceKm: Math.round(distanceKm * 100) / 100,
                distanceMeters,
                radiusKm: dineInRadius,
                radiusMeters,
            });
        }

        if (normalizedMode === 'TAKEAWAY') {
            const takeawayRadius = Number(settings?.takeaway_order_radius ?? settings?.dine_in_takeaway_order_radius ?? 0.5);
            const radiusMeters = Math.round(takeawayRadius * 1000);
            if (distanceKm > takeawayRadius) {
                return NextResponse.json({
                    allowed: false,
                    reason: 'OUT_OF_RANGE',
                    distanceKm: Math.round(distanceKm * 100) / 100,
                    distanceMeters,
                    radiusKm: takeawayRadius,
                    radiusMeters,
                    message: `Takeaway ordering is available within ${formatDistance(takeawayRadius)} of the restaurant (your location is ${formatDistance(distanceKm)} away).`,
                });
            }
            return NextResponse.json({
                allowed: true,
                distanceKm: Math.round(distanceKm * 100) / 100,
                distanceMeters,
                radiusKm: takeawayRadius,
                radiusMeters,
            });
        }

        if (normalizedMode === 'DELIVERY') {
            const deliveryRadius = settings?.delivery_order_radius != null 
                ? Number(settings.delivery_order_radius) 
                : (settings?.max_delivery_radius_km != null ? Number(settings.max_delivery_radius_km) : 5.0);
            const radiusMeters = Math.round(deliveryRadius * 1000);

            // ══════════════════════════════════════════════════════════════
            // CONDITION 1: Customer location should be inside the delivery radius
            // ══════════════════════════════════════════════════════════════
            if (distanceKm > deliveryRadius) {
                return NextResponse.json({
                    allowed: false,
                    deliveryAvailable: false,
                    conditionFailed: 1,
                    reason: 'OUT_OF_RADIUS',
                    distanceKm: Math.round(distanceKm * 100) / 100,
                    distanceMeters,
                    radiusKm: deliveryRadius,
                    radiusMeters,
                    message: `Delivery is not available: your location (${Math.round(distanceKm * 10) / 10} km away) is outside the restaurant delivery radius of ${deliveryRadius} km.`,
                });
            }

            // Check if coordinates fall inside any deactivated delivery zone
            const { data: deactivatedZones } = await supabaseAdmin.rpc('check_deactivated_zone', {
                p_restaurant_id: restaurantId,
                p_lat: customerLat,
                p_lng: customerLng,
            });

            if (deactivatedZones && deactivatedZones.length > 0) {
                const dZone = deactivatedZones[0];
                return NextResponse.json({
                    allowed: false,
                    deliveryAvailable: false,
                    conditionFailed: 2,
                    reason: 'DEACTIVATED_ZONE',
                    zoneId: dZone.zone_id,
                    zoneName: dZone.zone_name,
                    distanceKm: Math.round(distanceKm * 100) / 100,
                    distanceMeters,
                    radiusKm: deliveryRadius,
                    radiusMeters,
                    message: `Delivery is currently unavailable: delivery zone "${dZone.zone_name}" has been deactivated by the restaurant.`,
                });
            }

            // ══════════════════════════════════════════════════════════════
            // CONDITION 2: Customer location inside ANY active delivery zone
            // ══════════════════════════════════════════════════════════════
            const { data: matchedZones, error: zoneErr } = await supabaseAdmin.rpc('check_delivery_zone', {
                p_restaurant_id: restaurantId,
                p_lat: customerLat,
                p_lng: customerLng,
            });

            if (zoneErr) {
                console.error('[Location Validation] check_delivery_zone error:', zoneErr);
            }

            // If customer is NOT inside any active zone -> Condition 2 fails, reject!
            if (!matchedZones || matchedZones.length === 0) {
                return NextResponse.json({
                    allowed: false,
                    deliveryAvailable: false,
                    conditionFailed: 2,
                    reason: 'OUT_OF_ZONE',
                    distanceKm: Math.round(distanceKm * 100) / 100,
                    distanceMeters,
                    radiusKm: deliveryRadius,
                    radiusMeters,
                    message: 'Delivery is not available: your location is not inside any active delivery zone.',
                });
            }

            // Both Condition 1 and Condition 2 are satisfied!
            const zone = matchedZones[0];
            return NextResponse.json({
                allowed: true,
                deliveryAvailable: true,
                zoneId: zone.zone_id,
                zoneName: zone.zone_name,
                deliveryFee: Number(zone.delivery_fee) || 0,
                minOrderAmount: Number(zone.minimum_order_amount) || 0,
                distanceKm: Math.round(distanceKm * 100) / 100,
                distanceMeters,
                radiusKm: deliveryRadius,
                radiusMeters,
                message: `Delivery available in ${zone.zone_name}`,
            });
        }

        return NextResponse.json({ 
            allowed: true, 
            distanceKm: Math.round(distanceKm * 100) / 100,
            distanceMeters,
        });
    } catch (err: any) {
        console.error('[Location Validation] Error:', err);
        return NextResponse.json({ allowed: false, message: err.message || 'Validation failed' }, { status: 500 });
    }
}
