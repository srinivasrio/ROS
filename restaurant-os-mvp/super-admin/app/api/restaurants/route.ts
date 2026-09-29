import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySuperAdmin } from '@/lib/superadmin-guard';
import { seedRestaurantDefaults } from '@/lib/restaurant-defaults';

export async function GET(request: Request) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const statusFilter = searchParams.get('status');
        const search = searchParams.get('search')?.toLowerCase();

        // 1. Query restaurants
        let restQuery = supabaseAdmin
            .from('restaurants')
            .select('*')
            .order('created_at', { ascending: false });

        if (statusFilter && statusFilter !== 'ALL') {
            restQuery = restQuery.ilike('status', statusFilter);
        }

        const { data: restaurants, error: restError } = await restQuery;

        if (restError) {
            console.error('Super Admin fetch restaurants error:', restError);
            return NextResponse.json({ error: restError.message }, { status: 500 });
        }

        const restList = restaurants || [];
        const restIds = restList.map(r => r.id);

        // 2. Query legal and profile records for these restaurants
        const [legalRes, profileRes] = await Promise.all([
            supabaseAdmin.from('restaurant_legal').select('*').in('restaurant_ref', restIds),
            supabaseAdmin.from('restaurant_profile').select('*').in('restaurant_id', restIds)
        ]);

        const legalMap = new Map();
        (legalRes.data || []).forEach(l => legalMap.set(l.restaurant_ref, l));

        const profileMap = new Map();
        (profileRes.data || []).forEach(p => profileMap.set(p.restaurant_id, p));

        // 3. Merge data
        let formatted = restList.map((r: any) => {
            const legal = legalMap.get(r.id);
            const profile = profileMap.get(r.id);

            return {
                id: r.id,
                name: r.name,
                ownerName: r.owner_name,
                phone: r.phone,
                email: r.email,
                address: r.address,
                status: (r.status || 'PENDING').toUpperCase(),
                subscriptionPlan: r.subscription_plan || null,
                businessType: profile?.business_type || legal?.business_type || 'Restaurant',
                businessConstitution: legal?.business_constitution || null,
                gstNumber: legal?.gst_number || null,
                fssaiNumber: legal?.fssai_number || null,
                panNumber: legal?.pan_number || null,
                shopLicense: legal?.shop_establishment_license || null,
                openingDate: r.opening_date,
                createdAt: r.created_at,
                slug: profile?.slug
            };
        });

        if (search) {
            formatted = formatted.filter((r: any) => 
                (r.name && r.name.toLowerCase().includes(search)) ||
                (r.id && r.id.toLowerCase().includes(search)) ||
                (r.ownerName && r.ownerName.toLowerCase().includes(search)) ||
                (r.phone && r.phone.includes(search)) ||
                (r.email && r.email.toLowerCase().includes(search))
            );
        }

        return NextResponse.json({ success: true, restaurants: formatted });

    } catch (err: any) {
        console.error('Super admin restaurants API error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const body = await request.json();
        const {
            name,
            ownerName,
            phone,
            email,
            address,
            businessType = 'Restaurant',
            businessConstitution,
            gstNumber,
            fssaiNumber,
            panNumber,
            shopLicense,
            subscriptionPlan,
            status = 'PENDING'
        } = body;

        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'Restaurant name is required' }, { status: 400 });
        }

        const cleanName = name.trim();
        const randomDigits = Math.floor(1000 + Math.random() * 9000);
        const slug = cleanName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') + '-' + randomDigits;

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const restaurantId = `REST-${dateStr}-${randomDigits}`;

        // 1. Insert into restaurants
        const restRecord = {
            id: restaurantId,
            name: cleanName,
            owner_name: ownerName ? ownerName.trim() : 'Owner',
            phone: phone ? phone.trim() : '',
            email: email ? email.trim() : '',
            address: address || '',
            status: status ? status.toUpperCase() : 'PENDING',
            subscription_plan: subscriptionPlan || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { error: restError } = await supabaseAdmin
            .from('restaurants')
            .insert(restRecord);

        if (restError) {
            console.error('Super Admin create restaurant error:', restError);
            return NextResponse.json({ error: 'Failed to create restaurant: ' + restError.message }, { status: 500 });
        }

        // 2. Insert into restaurant_profile
        await supabaseAdmin
            .from('restaurant_profile')
            .insert({
                restaurant_id: restaurantId,
                name: cleanName,
                business_type: businessType,
                address: address || '',
                phone: phone || '',
                email: email || '',
                slug: slug,
                restaurant_info: {
                    name: cleanName,
                    phone: phone || '',
                    email: email || '',
                    address: address || ''
                }
            });

        // 3. Insert into restaurant_legal
        await supabaseAdmin
            .from('restaurant_legal')
            .insert({
                restaurant_ref: restaurantId,
                business_name: cleanName,
                business_type: businessType,
                business_constitution: businessConstitution || null,
                gst_number: gstNumber || null,
                fssai_number: fssaiNumber || null,
                pan_number: panNumber || null,
                shop_establishment_license: shopLicense || null,
                status: status === 'ACTIVE' ? 'ACTIVE' : 'PENDING'
            });

        // 4. Create default branch
        await supabaseAdmin
            .from('branches')
            .insert({
                id: `BR-${restaurantId.slice(-6)}-${randomDigits}`,
                restaurant_id: restaurantId,
                name: 'Main Branch',
                address: address || '',
                phone: phone || '',
                email: email || '',
                is_main_branch: true
            });

        // 5. Seed default configuration (theme, sections, services)
        await seedRestaurantDefaults(restaurantId, {
            name: cleanName,
            phone: phone || '',
            email: email || '',
            address: address || '',
            businessType,
            slug
        });

        // 6. Audit log
        await supabaseAdmin.from('audit_logs').insert({
            restaurant_id: restaurantId,
            user_id: auth.user.userId,
            action: 'super_admin_create_restaurant',
            details: {
                name: cleanName,
                status: status,
                timestamp: new Date().toISOString()
            }
        });

        return NextResponse.json({
            success: true,
            restaurant: {
                ...restRecord,
                slug,
                businessType,
                businessConstitution,
                gstNumber,
                fssaiNumber,
                panNumber,
                shopLicense
            }
        }, { status: 201 });

    } catch (err: any) {
        console.error('Super admin create restaurant error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
