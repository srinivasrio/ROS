import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { extractCustomerTokenForRestaurant, verifyJwt } from '@/lib/jwt-utils';
import { resolveRestaurantId } from '@/services/utils.service';

async function getCustomerScope(request: NextRequest, restaurantId: string): Promise<string | null> {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const token = bearer || extractCustomerTokenForRestaurant(request.cookies, restaurantId);
    if (!token) return null;

    let payload: any = null;
    try {
        payload = await verifyJwt(token);
    } catch {
        return null;
    }

    if (
        String(payload?.role || '').toLowerCase() !== 'customer' ||
        !payload?.customerId ||
        String(payload.restaurantId || payload.restaurant_id || '') !== String(restaurantId)
    ) {
        return null;
    }

    const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('id', payload.customerId)
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

    return customer?.id || null;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = request.nextUrl;
        const restaurantCode = searchParams.get('restaurantId');
        const customerId = searchParams.get('customerId');

        if (!restaurantCode) {
            return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
        }

        const restaurantId = await resolveRestaurantId(restaurantCode);
        if (!restaurantId) return NextResponse.json({ error: 'Invalid restaurant' }, { status: 400 });

        const authenticatedCustomerId = await getCustomerScope(request, restaurantId);
        if (!authenticatedCustomerId) {
            return NextResponse.json({ error: 'Customer authentication is required' }, { status: 401 });
        }

        if (customerId && customerId !== authenticatedCustomerId) {
            return NextResponse.json({ error: 'Customer access denied' }, { status: 403 });
        }

        const query = supabaseAdmin
            .from('customer_addresses')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .eq('customer_id', authenticatedCustomerId)
            .order('created_at', { ascending: false });

        const { data, error } = await query;
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ addresses: data || [] });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            restaurantId: restaurantCode,
            customerId,
            label,
            addressLine,
            landmark,
            city,
            pincode,
            latitude,
            longitude,
            isDefault,
        } = body;

        if (!restaurantCode || !addressLine) {
            return NextResponse.json({ error: 'restaurantId and addressLine are required' }, { status: 400 });
        }

        const restaurantId = await resolveRestaurantId(String(restaurantCode));
        if (!restaurantId) return NextResponse.json({ error: 'Invalid restaurant' }, { status: 400 });

        const authenticatedCustomerId = await getCustomerScope(request, restaurantId);
        if (!authenticatedCustomerId) {
            return NextResponse.json({ error: 'Customer authentication is required' }, { status: 401 });
        }

        if (customerId && customerId !== authenticatedCustomerId) {
            return NextResponse.json({ error: 'Customer access denied' }, { status: 403 });
        }

        const { data, error } = await supabaseAdmin
            .from('customer_addresses')
            .insert({
                restaurant_id: restaurantId,
                customer_id: authenticatedCustomerId,
                label: label || 'Home',
                address_line: addressLine,
                landmark: landmark || null,
                city: city || null,
                pincode: pincode || null,
                latitude: latitude ? Number(latitude) : null,
                longitude: longitude ? Number(longitude) : null,
                is_default: Boolean(isDefault),
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ address: data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
