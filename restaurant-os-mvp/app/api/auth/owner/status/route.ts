import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyJwt } from '@/lib/jwt-utils';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('dine_auth_token')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await verifyJwt(token);
        if (!user || !user.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get employee record to find current restaurant_id
        const { data: employee } = await supabaseAdmin
            .from('employees')
            .select('restaurant_id, name, email, mobile, status, approval_status')
            .eq('id', user.userId)
            .maybeSingle();

        const restaurantId = employee?.restaurant_id || user.restaurantId;

        if (!restaurantId) {
            return NextResponse.json({ 
                hasRestaurant: false, 
                message: 'No restaurant registration found for this account' 
            });
        }

        // Fetch restaurant details
        const { data: restaurant } = await supabaseAdmin
            .from('restaurants')
            .select('id, name, status, subscription_plan, address, phone, email, created_at')
            .eq('id', restaurantId)
            .maybeSingle();

        // Fetch legal details
        const { data: legal } = await supabaseAdmin
            .from('restaurant_legal')
            .select('business_type, business_name, status')
            .eq('restaurant_ref', restaurantId)
            .maybeSingle();

        // Fetch profile
        const { data: profile } = await supabaseAdmin
            .from('restaurant_profile')
            .select('business_type, slug')
            .eq('restaurant_id', restaurantId)
            .maybeSingle();

        return NextResponse.json({
            hasRestaurant: true,
            restaurant: {
                id: restaurantId,
                name: restaurant?.name || 'Your Restaurant',
                status: restaurant?.status?.toUpperCase() || 'PENDING',
                subscriptionPlan: restaurant?.subscription_plan,
                address: restaurant?.address,
                phone: restaurant?.phone,
                email: restaurant?.email,
                businessType: profile?.business_type || legal?.business_type || 'Restaurant',
                slug: profile?.slug,
                createdAt: restaurant?.created_at,
                ownerApprovalStatus: employee?.approval_status
            }
        });

    } catch (err: any) {
        console.error('Owner status API error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
