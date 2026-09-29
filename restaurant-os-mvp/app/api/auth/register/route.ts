import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { seedRestaurantDefaults } from '@/lib/restaurant-defaults';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { ownerName, mobileNumber, email, selectedPackage, restaurants } = body;

        if (!restaurants || restaurants.length === 0) {
            return NextResponse.json({ error: 'Restaurant details are required' }, { status: 400 });
        }

        const resData = restaurants[0];

        // 1. Generate a temporary pending restaurant reference/ID
        const datePart = '2026' + new Date().toISOString().slice(5, 10).replace(/-/g, '');
        const randomPart = Math.floor(1000 + Math.random() * 9000).toString();
        const tempRestaurantId = `PEND-${datePart}${randomPart}`;

        // 2. Insert into restaurants with status = 'pending'
        const { error: resError } = await supabaseAdmin
            .from('restaurants')
            .insert({
                id: tempRestaurantId,
                name: resData.name,
                owner_name: ownerName,
                phone: mobileNumber,
                email: email,
                address: resData.address || null,
                opening_date: resData.openingDate || null,
                operating_hours: resData.operatingHours || {},
                subscription_plan: selectedPackage,
                status: 'pending'
            });

        if (resError) {
            console.error('Pending restaurant insert error:', resError);
            return NextResponse.json({ error: resError.message }, { status: 500 });
        }

        // 3. Insert into restaurant_legal
        const { error: legalError } = await supabaseAdmin
            .from('restaurant_legal')
            .insert({
                restaurant_ref: tempRestaurantId,
                business_name: resData.name,
                business_type: resData.businessType,
                gst_number: resData.gstNumber,
                fssai_number: resData.fssaiNumber,
                license_number: resData.fssaiNumber,
                pan_number: resData.panCard,
                shop_establishment_license: resData.shopLicense,
                status: 'pending'
            });

        if (legalError) {
            console.error('Pending legal insert error:', legalError);
        }

        // 4. Seed baseline defaults (profile, theme, sections, services, branch)
        await seedRestaurantDefaults(tempRestaurantId, {
            name: resData.name,
            phone: mobileNumber,
            email,
            address: resData.address || '',
            businessType: resData.businessType
        });

        return NextResponse.json({ 
            success: true, 
            restaurantId: tempRestaurantId 
        });

    } catch (error: any) {
        console.error('Registration API error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
