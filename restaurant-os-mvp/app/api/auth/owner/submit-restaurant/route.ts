import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyJwt, signJwt } from '@/lib/jwt-utils';
import { seedRestaurantDefaults } from '@/lib/restaurant-defaults';

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('dine_auth_token')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized: Please log in or create an owner account' }, { status: 401 });
        }

        const user = await verifyJwt(token);
        if (!user || !user.userId) {
            return NextResponse.json({ error: 'Invalid or expired authentication session' }, { status: 401 });
        }

        const body = await request.json();
        const { 
            restaurantName, 
            businessType, 
            address,
            gstPercentage = 5.0,
            cgstPercentage = 2.5,
            sgstPercentage = 2.5
        } = body;

        if (!restaurantName || !businessType || !address) {
            return NextResponse.json({ 
                error: 'Restaurant name, business type, and address are required' 
            }, { status: 400 });
        }

        const parsedGst = Number(gstPercentage) >= 0 ? Number(gstPercentage) : 5.0;
        const parsedCgst = Number(cgstPercentage) >= 0 ? Number(cgstPercentage) : (parsedGst / 2.0);
        const parsedSgst = Number(sgstPercentage) >= 0 ? Number(sgstPercentage) : (parsedGst / 2.0);

        // Validate Business Types
        const validBusinessTypes = ['Restaurant', 'Bar', 'Bar and Restaurant'];
        if (!validBusinessTypes.includes(businessType)) {
            return NextResponse.json({ 
                error: `Invalid business type. Must be one of: ${validBusinessTypes.join(', ')}` 
            }, { status: 400 });
        }

        // Generate Restaurant ID in standard format (e.g. 2026MMDDxxxx)
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const randomDigits = Math.floor(1000 + Math.random() * 9000).toString();
        const restaurantId = `${dateStr}${randomDigits}`;

        const cleanName = restaurantName.trim();
        const formattedAddress = typeof address === 'string' ? address.trim() : JSON.stringify(address);
        const slug = cleanName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') + '-' + randomDigits;

        // 1. Insert into restaurants with status = 'PENDING' and GST settings
        const { error: restError } = await supabaseAdmin
            .from('restaurants')
            .insert({
                id: restaurantId,
                name: cleanName,
                owner_name: user.name,
                phone: user.mobile,
                email: user.email,
                address: formattedAddress,
                status: 'PENDING',
                subscription_plan: null,
                owner_id: user.userId,
                gst_percentage: parsedGst,
                cgst_percentage: parsedCgst,
                sgst_percentage: parsedSgst
            });

        if (restError) {
            console.error('Failed to create restaurant record:', restError);
            return NextResponse.json({ error: 'Failed to create restaurant request: ' + restError.message }, { status: 500 });
        }

        // 2. Insert into restaurant_profile
        const { error: profileError } = await supabaseAdmin
            .from('restaurant_profile')
            .insert({
                restaurant_id: restaurantId,
                name: cleanName,
                business_type: businessType,
                address: formattedAddress,
                phone: user.mobile,
                email: user.email,
                slug: slug,
                tax_percentage: parsedGst,
                gst_percentage: parsedGst,
                cgst_percentage: parsedCgst,
                sgst_percentage: parsedSgst,
                restaurant_info: {
                    name: cleanName,
                    phone: user.mobile,
                    email: user.email,
                    address: formattedAddress
                }
            });

        if (profileError) {
            console.error('Profile insert error:', profileError);
        }

        // 3. Insert into restaurant_legal
        const { error: legalError } = await supabaseAdmin
            .from('restaurant_legal')
            .insert({
                restaurant_ref: restaurantId,
                business_name: cleanName,
                business_type: businessType,
                status: 'PENDING'
            });

        if (legalError) {
            console.error('Legal insert error:', legalError);
        }

        // 4. Update owner's employee record with restaurant_id
        await supabaseAdmin
            .from('employees')
            .update({ restaurant_id: restaurantId })
            .eq('id', user.userId);

        await supabaseAdmin
            .from('dine_users')
            .update({ restaurant_id: restaurantId })
            .eq('id', user.userId);

        // 5. Seed default configuration (theme, sections, services, branch)
        await seedRestaurantDefaults(restaurantId, {
            name: cleanName,
            phone: user.mobile,
            email: user.email,
            address: formattedAddress,
            businessType,
            slug,
            gstPercentage: parsedGst,
            cgstPercentage: parsedCgst,
            sgstPercentage: parsedSgst
        });

        // 6. Update JWT session cookie with restaurantId
        const updatedToken = await signJwt({
            ...user,
            restaurantId: restaurantId,
            restaurant_id: restaurantId
        });

        const isHttps = request.url.startsWith('https://') || request.headers.get('x-forwarded-proto') === 'https';
        const isSecure = process.env.NODE_ENV === 'production' && isHttps;
        const cookieOpts = {
            secure: isSecure,
            sameSite: 'lax' as const,
            path: '/',
            maxAge: 3600 * 8
        };
        cookieStore.set('dine_auth_token', updatedToken, cookieOpts);
        cookieStore.set('dine_auth_token_admin', updatedToken, cookieOpts);
        if (restaurantId) {
            const cleanRid = String(restaurantId).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
            cookieStore.set(`dine_auth_token_${cleanRid}`, updatedToken, cookieOpts);
            cookieStore.set(`dine_auth_token_${cleanRid}_admin`, updatedToken, cookieOpts);
        }

        return NextResponse.json({
            success: true,
            restaurantId,
            status: 'PENDING',
            message: 'Restaurant registration request submitted successfully and is pending review.'
        });

    } catch (err: any) {
        console.error('Submit restaurant error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
