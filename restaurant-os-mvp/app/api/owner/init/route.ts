import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedOwner } from '@/lib/owner-auth';
import { resolveRestaurantEntitlements } from '@/lib/entitlements';

export async function GET(request: NextRequest) {
    try {
        const auth = await getAuthenticatedOwner(request);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized: Owner session required' }, { status: 401 });
        }

        const restaurantIds = (auth.restaurantIds && auth.restaurantIds.length > 0)
            ? auth.restaurantIds
            : (auth.restaurantId ? [auth.restaurantId] : []);

        // Fetch all owned restaurants
        let restaurants: any[] = [];
        let branches: any[] = [];
        if (restaurantIds.length > 0) {
            const [restRes, branchRes] = await Promise.all([
                supabaseAdmin
                    .from('restaurants')
                    .select('id, name, logo_url, status, subscription, owner_id, max_branches, created_at, phone, email, address, is_main_branch')
                    .in('id', restaurantIds)
                    .is('deleted_at', null)
                    .order('created_at', { ascending: true }),
                supabaseAdmin
                    .from('branches')
                    .select('id, internal_id, restaurant_id, name, code, status, phone, email, address, created_at, is_main_branch')
                    .in('restaurant_id', restaurantIds)
                    .is('deleted_at', null)
                    .order('created_at', { ascending: true })
            ]);

            if (restRes.error) {
                console.error('[API /owner/init] Failed to fetch restaurants:', restRes.error);
            }
            if (branchRes.error) {
                console.error('[API /owner/init] Failed to fetch branches:', branchRes.error);
            }

            restaurants = restRes.data || [];
            branches = branchRes.data || [];
        }

        const primaryRestaurant = restaurants?.find(r => r.is_main_branch && (r.status || '').toLowerCase() === 'active') ||
                                  restaurants?.find(r => (r.status || '').toLowerCase() === 'active') || null;

        // Fetch active subscription for primary restaurant
        let subscription: any = null;
        if (primaryRestaurant?.id) {
            const { data } = await supabaseAdmin
                .from('subscriptions')
                .select('id, plan_name, plan_type, status, trial_ends_at, current_period_end, max_branches, max_employees')
                .eq('restaurant_id', primaryRestaurant.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            subscription = data;
        }

        // Resolve independent entitlements for each restaurant
        const entitlementsMap = new Map<string, any>();
        await Promise.all(
            (restaurants || []).map(async (r) => {
                const ent = await resolveRestaurantEntitlements(r.id);
                entitlementsMap.set(r.id, ent);
            })
        );

        const primaryEntitlement = primaryRestaurant ? entitlementsMap.get(primaryRestaurant.id) : null;

        const hasAnyMain = (restaurants || []).some(r => r.is_main_branch && (r.status || '').toLowerCase() === 'active');
        const formattedRestaurants = (restaurants || []).map((r, idx) => {
            const primaryBranch = (branches || []).find(b => b.restaurant_id === r.id && b.is_main_branch) ||
                                  (branches || []).find(b => b.restaurant_id === r.id) || null;
            const isMain = hasAnyMain ? Boolean(r.is_main_branch) : idx === 0;
            const ent = entitlementsMap.get(r.id);

            return {
                id: r.id,
                restaurant_id: r.id,
                name: r.name,
                logoUrl: r.logo_url || null,
                logo_url: r.logo_url || null,
                code: primaryBranch?.code || primaryBranch?.id || r.id,
                status: (r.status || 'ACTIVE').toLowerCase() === 'active' ? 'active' : 'inactive',
                phone: r.phone || primaryBranch?.phone || null,
                email: r.email || primaryBranch?.email || null,
                address: r.address || primaryBranch?.address || null,
                is_main_branch: isMain,
                created_at: r.created_at,
                branch_id: primaryBranch?.id || `BR-${r.id.slice(-6)}-01`,
                internal_id: primaryBranch?.internal_id || null,
                entitlement: ent || null,
                planSlug: ent?.planSlug || 'standard',
                planName: ent?.planName || 'Standard'
            };
        });

        // Filter to only active branches for owner operations
        const activeFormattedRestaurants = formattedRestaurants.filter(r => r.status === 'active');

        // Fetch owner's definitive quota from employees table
        const { data: ownerEmp } = await supabaseAdmin
            .from('employees')
            .select('max_branches, custom_quota')
            .eq('id', auth.userId)
            .maybeSingle();

        const customQuota = typeof ownerEmp?.custom_quota === 'number' && ownerEmp.custom_quota > 0 ? ownerEmp.custom_quota : null;
        const allowedLimit = customQuota ?? (ownerEmp?.max_branches ?? (primaryEntitlement?.maxRestaurants || primaryRestaurant?.max_branches || subscription?.max_branches || 0));
        const currentCount = activeFormattedRestaurants.length;
        const remainingSlots = Math.max(0, allowedLimit - currentCount);

        let branchLimitStatus = currentCount === 0 ? 'available' : 'no_subscription';
        if (allowedLimit > 0) {
            if (remainingSlots === 0) branchLimitStatus = 'limit_reached';
            else if (remainingSlots === 1) branchLimitStatus = 'near_limit';
            else branchLimitStatus = 'available';
        }

        return NextResponse.json({
            restaurant: primaryRestaurant || null,
            restaurants: activeFormattedRestaurants,
            branches: activeFormattedRestaurants,
            activeBranchesCount: currentCount,
            hasOwnerPanel: true,
            hasMultiRestaurant: Boolean(primaryEntitlement?.features?.multi_restaurant),
            primaryEntitlement: primaryEntitlement || null,
            branchLimits: {
                maxAllowed: allowedLimit,
                currentCount,
                remainingSlots,
                status: branchLimitStatus
            },
            subscription: subscription || null,
            entitlement: primaryEntitlement || null,
            user: {
                id: auth.userId,
                name: auth.name || 'Owner',
                role: auth.role,
                email: auth.email,
            },
        });
    } catch (error: any) {
        console.error('[API /owner/init] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
