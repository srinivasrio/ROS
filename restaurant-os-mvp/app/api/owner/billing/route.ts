import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedOwner, resolveOwnerScope } from '@/lib/owner-auth';
import { 
    resolveRestaurantEntitlements, 
    getAllPlans, 
    FEATURE_DEFINITIONS,
    FeatureKey,
    CANONICAL_PLANS
} from '@/lib/entitlements';

export async function GET(request: NextRequest) {
    try {
        const auth = await getAuthenticatedOwner(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized: Owner session required' }, { status: 401 });

        const branchFilter = request.nextUrl.searchParams.get('branch') || request.nextUrl.searchParams.get('restaurant');
        const scope = await resolveOwnerScope(auth, branchFilter);
        const targetRestaurantId = scope.targetRestaurantId || auth.restaurantId || null;
        const allRestaurantIds = (scope.restaurantIds.length > 0 ? scope.restaurantIds : (targetRestaurantId ? [targetRestaurantId] : [])).filter(Boolean);

        if (allRestaurantIds.length === 0) {
            return NextResponse.json({
                success: true,
                targetRestaurantId: null,
                currentEntitlement: null,
                restaurants: [],
                plans: getAllPlans(),
                addOns: [],
                usage: {
                    branchesUsed: 0,
                    branchesLimit: 0,
                    employeesUsed: 0,
                    employeesLimit: 0,
                },
                invoices: [],
                payments: []
            });
        }

        // 1. Fetch Invoices & Payments
        const [invoicesRes, paymentsRes, restListRes, empCountRes] = await Promise.all([
            supabaseAdmin
                .from('invoices')
                .select('*')
                .in('restaurant_id', allRestaurantIds)
                .order('created_at', { ascending: false })
                .limit(25),
            supabaseAdmin
                .from('payments')
                .select('*')
                .in('restaurant_id', allRestaurantIds)
                .order('created_at', { ascending: false })
                .limit(25),
            supabaseAdmin
                .from('restaurants')
                .select('id, name, status, subscription_plan')
                .in('id', allRestaurantIds)
                .is('deleted_at', null),
            supabaseAdmin
                .from('employees')
                .select('id', { count: 'exact' })
                .in('restaurant_id', allRestaurantIds)
                .eq('status', 'active')
        ]);

        const restaurants = restListRes.data || [];

        // 2. Independently resolve entitlements for EVERY authorized restaurant location
        const restaurantEntitlements = await Promise.all(
            restaurants.map(async (r) => {
                const ent = await resolveRestaurantEntitlements(r.id);
                return {
                    restaurantId: r.id,
                    restaurantName: r.name,
                    planName: ent.planName,
                    planSlug: ent.planSlug,
                    status: ent.status,
                    isTrial: ent.isTrial,
                    isSuspended: ent.isSuspended,
                    isExpired: ent.isExpired,
                    daysRemaining: ent.daysRemaining,
                    renewalDate: ent.currentPeriodEnd || ent.trialEndsAt,
                    currentPeriodEnd: ent.currentPeriodEnd,
                    trialEndsAt: ent.trialEndsAt,
                    maxRestaurants: ent.maxRestaurants,
                    maxEmployees: ent.maxEmployees,
                    availableFeatures: ent.availableFeatures.map(k => FEATURE_DEFINITIONS[k]).filter(Boolean),
                    lockedFeatures: ent.lockedFeatures.map(k => FEATURE_DEFINITIONS[k]).filter(Boolean),
                    overrides: ent.overrides,
                    hasWhatsAppBills: Boolean(ent.features.whatsapp_bills)
                };
            })
        );

        // Current target restaurant entitlement
        const currentTargetEntitlement = restaurantEntitlements.find(e => e.restaurantId === targetRestaurantId) 
            || restaurantEntitlements[0] 
            || null;

        const allPlans = getAllPlans();

        return NextResponse.json({
            success: true,
            targetRestaurantId,
            currentEntitlement: currentTargetEntitlement,
            restaurants: restaurantEntitlements,
            plans: allPlans,
            addOns: [
                {
                    key: 'whatsapp_bills',
                    name: 'WhatsApp Digital Bills',
                    tagline: 'Instant PDF invoices and receipts delivered directly to customers on WhatsApp',
                    price: 499,
                    currency: 'INR',
                    billingCycle: 'Monthly',
                    enabled: Boolean(currentTargetEntitlement?.hasWhatsAppBills)
                }
            ],
            usage: {
                branchesUsed: restaurants.length,
                branchesLimit: currentTargetEntitlement?.maxRestaurants || 1,
                employeesUsed: empCountRes.count || 0,
                employeesLimit: currentTargetEntitlement?.maxEmployees || 25,
            },
            invoices: invoicesRes.data || [],
            payments: paymentsRes.data || []
        });
    } catch (err: any) {
        console.error('[API /owner/billing GET] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
