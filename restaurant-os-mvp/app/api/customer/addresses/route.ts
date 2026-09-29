import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = request.nextUrl;
        const restaurantId = searchParams.get('restaurantId');
        const customerId = searchParams.get('customerId');
        const mobile = searchParams.get('mobile') || searchParams.get('phone');

        if (!restaurantId) {
            return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
        }

        let query = supabaseAdmin
            .from('customer_addresses')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('created_at', { ascending: false });

        if (customerId) {
            query = query.eq('customer_id', customerId);
        } else if (mobile) {
            // Find customer by mobile first
            const { data: cust } = await supabaseAdmin
                .from('customers')
                .select('id')
                .eq('restaurant_id', restaurantId)
                .eq('mobile', mobile)
                .maybeSingle();

            if (cust) {
                query = query.eq('customer_id', cust.id);
            } else {
                return NextResponse.json({ addresses: [] });
            }
        } else {
            return NextResponse.json({ addresses: [] });
        }

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
            restaurantId,
            customerId,
            mobile,
            name,
            label,
            addressLine,
            landmark,
            city,
            pincode,
            latitude,
            longitude,
            isDefault,
        } = body;

        if (!restaurantId || !addressLine) {
            return NextResponse.json({ error: 'restaurantId and addressLine are required' }, { status: 400 });
        }

        const customerMobile = body.mobile || body.phone;

        let resolvedCustomerId = customerId;

        // If no customerId provided but mobile is, find or create customer
        if (!resolvedCustomerId && customerMobile) {
            const { data: existingCust } = await supabaseAdmin
                .from('customers')
                .select('id')
                .eq('restaurant_id', restaurantId)
                .eq('mobile', customerMobile)
                .maybeSingle();

            if (existingCust) {
                resolvedCustomerId = existingCust.id;
            } else {
                const { data: newCust, error: createCustErr } = await supabaseAdmin
                    .from('customers')
                    .insert({
                        restaurant_id: restaurantId,
                        mobile: customerMobile,
                        name: name || null,
                        visit_count: 1,
                    })
                    .select('id')
                    .single();

                if (!createCustErr && newCust) {
                    resolvedCustomerId = newCust.id;
                }
            }
        }

        const { data, error } = await supabaseAdmin
            .from('customer_addresses')
            .insert({
                restaurant_id: restaurantId,
                customer_id: resolvedCustomerId || null,
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
