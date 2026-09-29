import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminUserFromRequest } from '@/lib/jwt-utils';
import { resolveRestaurantId } from '@/services/utils.service';

/**
 * GET /api/delivery/settings?restaurantId=xxx
 * Returns delivery settings for a restaurant.
 * 
 * POST /api/delivery/settings
 * Creates or updates delivery settings (admin only).
 */

export async function GET(request: NextRequest) {
    try {
        const rawRestaurantId = request.nextUrl.searchParams.get('restaurantId') || request.nextUrl.searchParams.get('restaurantCode');
        if (!rawRestaurantId) {
            return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
        }

        const restaurantId = await resolveRestaurantId(rawRestaurantId) || rawRestaurantId;

        const { data, error } = await supabaseAdmin
            .from('delivery_settings')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .maybeSingle();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Fetch current restaurant details from restaurants table
        const { data: currentRest } = await supabaseAdmin
            .from('restaurants')
            .select('id, name, address, latitude, longitude')
            .eq('id', restaurantId)
            .maybeSingle();

        const finalLat = data?.latitude != null
            ? Number(data.latitude)
            : (currentRest?.latitude != null ? Number(currentRest.latitude) : null);
        const finalLng = data?.longitude != null
            ? Number(data.longitude)
            : (currentRest?.longitude != null ? Number(currentRest.longitude) : null);
        const finalAddress = data?.address || currentRest?.address || '';
        const restaurantName = currentRest?.name || 'Restaurant Kitchen';

        // availableRestaurants MUST ONLY contain this restaurant (if coordinates exist),
        // NEVER random restaurants from other tenants or cities!
        const availableRestaurants = [];
        if (finalLat != null && finalLng != null) {
            availableRestaurants.push({
                id: restaurantId,
                name: restaurantName,
                address: finalAddress,
                latitude: finalLat,
                longitude: finalLng,
            });
        }

        // Return defaults if no settings exist
        return NextResponse.json({
            settings: {
                ...(data || {
                    restaurant_id: restaurantId,
                    enabled: false,
                    delivery_enabled: false,
                    dine_in_enabled: true,
                    takeaway_enabled: true,
                    delivery_fee: 0,
                    minimum_order_amount: 0,
                    max_delivery_radius_km: 5.0,
                    delivery_order_radius: 5.0,
                    dine_in_takeaway_order_radius: 0.1,
                    dine_in_order_radius: 0.1,
                    takeaway_order_radius: 0.5,
                    estimated_delivery_minutes: 30,
                    latitude: null,
                    longitude: null,
                    address: '',
                }),
                latitude: finalLat,
                longitude: finalLng,
                address: finalAddress,
                restaurant_name: restaurantName,
            },
            availableRestaurants,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            restaurantId,
            enabled,
            delivery_enabled,
            dine_in_enabled,
            takeaway_enabled,
            delivery_fee,
            minimum_order_amount,
            max_delivery_radius_km,
            delivery_order_radius,
            dine_in_takeaway_order_radius,
            dine_in_order_radius,
            takeaway_order_radius,
            estimated_delivery_minutes,
            latitude,
            longitude,
            address,
        } = body;

        const targetRid = restaurantId || body?.restaurantCode;
        const user = await getAdminUserFromRequest(request, targetRid);
        if (!user) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        // Server-side: resolve restaurant from body or token, resolving any code/slug
        const rawRid = targetRid || user.restaurantId;
        if (!rawRid) {
            return NextResponse.json({ error: 'Restaurant ID is required' }, { status: 400 });
        }
        const rid = (await resolveRestaurantId(rawRid)) || rawRid;

        const isDeliveryActive = delivery_enabled !== undefined ? Boolean(delivery_enabled) : (enabled !== undefined ? Boolean(enabled) : false);

        // Resolve delivery radius prioritizing delivery_order_radius then max_delivery_radius_km
        const resolvedDeliveryRadius = delivery_order_radius !== undefined && delivery_order_radius !== '' 
            ? Number(delivery_order_radius) 
            : (max_delivery_radius_km !== undefined && max_delivery_radius_km !== '' ? Number(max_delivery_radius_km) : null);

        // Resolve dine-in radius prioritizing dine_in_order_radius then dine_in_takeaway_order_radius
        const resolvedDineInRadius = dine_in_order_radius !== undefined && dine_in_order_radius !== ''
            ? Number(dine_in_order_radius)
            : (dine_in_takeaway_order_radius !== undefined && dine_in_takeaway_order_radius !== '' ? Number(dine_in_takeaway_order_radius) : 0.1);

        // Resolve takeaway radius prioritizing takeaway_order_radius then dine_in_takeaway_order_radius
        const resolvedTakeawayRadius = takeaway_order_radius !== undefined && takeaway_order_radius !== ''
            ? Number(takeaway_order_radius)
            : (dine_in_takeaway_order_radius !== undefined && dine_in_takeaway_order_radius !== '' ? Number(dine_in_takeaway_order_radius) : 0.5);

        const upsertPayload: Record<string, any> = {
            restaurant_id: rid,
            enabled: isDeliveryActive,
            delivery_enabled: isDeliveryActive,
            delivery_fee: delivery_fee !== undefined ? Number(delivery_fee) : 0,
            minimum_order_amount: minimum_order_amount !== undefined ? Number(minimum_order_amount) : 0,
            max_delivery_radius_km: resolvedDeliveryRadius,
            delivery_order_radius: resolvedDeliveryRadius,
            dine_in_order_radius: resolvedDineInRadius,
            takeaway_order_radius: resolvedTakeawayRadius,
            // Backwards compatibility for legacy fields
            dine_in_takeaway_order_radius: resolvedDineInRadius,
            estimated_delivery_minutes: estimated_delivery_minutes !== undefined ? Number(estimated_delivery_minutes) : 30,
            updated_at: new Date().toISOString(),
        };

        if (dine_in_enabled !== undefined) upsertPayload.dine_in_enabled = Boolean(dine_in_enabled);
        if (takeaway_enabled !== undefined) upsertPayload.takeaway_enabled = Boolean(takeaway_enabled);
        if (latitude !== undefined) upsertPayload.latitude = latitude !== null && latitude !== '' ? Number(latitude) : null;
        if (longitude !== undefined) upsertPayload.longitude = longitude !== null && longitude !== '' ? Number(longitude) : null;
        if (address !== undefined) upsertPayload.address = address;

        const { data, error } = await supabaseAdmin
            .from('delivery_settings')
            .upsert(upsertPayload, { onConflict: 'restaurant_id' })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Also update restaurants table for latitude, longitude, and address
        if (latitude !== undefined || longitude !== undefined || address !== undefined) {
            const restUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
            if (latitude !== undefined) restUpdates.latitude = latitude !== null && latitude !== '' ? Number(latitude) : null;
            if (longitude !== undefined) restUpdates.longitude = longitude !== null && longitude !== '' ? Number(longitude) : null;
            if (address !== undefined) restUpdates.address = address;

            await supabaseAdmin
                .from('restaurants')
                .update(restUpdates)
                .eq('id', rid);
        }

        // Also update restaurant_profile address if provided
        if (address) {
            await supabaseAdmin
                .from('restaurant_profile')
                .update({ address, last_updated: new Date().toISOString() })
                .eq('restaurant_id', rid);
        }

        return NextResponse.json({ settings: data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
