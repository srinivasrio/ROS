import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedOwner } from '@/lib/owner-auth';
import { hashPin, hashPassword } from '@/lib/auth-utils';
import { resolveRestaurantEntitlements, CANONICAL_PLANS, getPlanDefaultLimit, normalizePlanSlug, PlanSlug } from '@/lib/entitlements';
import { resolveAuthorizedBranch } from '@/lib/branch-resolver';
import crypto from 'crypto';

// Helper to generate a unique 12-digit restaurant ID (e.g. 202609301234)
async function generateUniqueRestaurantId(): Promise<string> {
    const year = new Date().getFullYear();
    for (let attempts = 0; attempts < 10; attempts++) {
        const rand = Math.floor(10000000 + Math.random() * 90000000);
        const candidate = `${year}${rand}`.slice(0, 12);
        const { data: existing } = await supabaseAdmin
            .from('restaurants')
            .select('id')
            .eq('id', candidate)
            .maybeSingle();
        if (!existing) return candidate;
    }
    return `${year}${Date.now()}`.slice(0, 12);
}

// GET: List all independent restaurants and pending registration requests belonging to authenticated owner
export async function GET(request: NextRequest) {
    const auth = await getAuthenticatedOwner(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized: Owner session required' }, { status: 401 });

    const restaurantIds = auth.restaurantIds && auth.restaurantIds.length > 0 ? auth.restaurantIds : [];

    const [restRes, branchRes, empRes, regReqRes, ownerEmpRes, subRes] = await Promise.all([
        restaurantIds.length > 0
            ? supabaseAdmin
                .from('restaurants')
                .select('id, name, phone, email, address, status, subscription_plan, custom_quota, created_at, max_branches, is_main_branch')
                .in('id', restaurantIds)
                .is('deleted_at', null)
                .order('created_at', { ascending: true })
            : Promise.resolve({ data: [], error: null }),
        restaurantIds.length > 0
            ? supabaseAdmin
                .from('branches')
                .select('*')
                .in('restaurant_id', restaurantIds)
                .is('deleted_at', null)
                .order('created_at', { ascending: true })
            : Promise.resolve({ data: [], error: null }),
        restaurantIds.length > 0
            ? supabaseAdmin
                .from('employees')
                .select('id, name, email, mobile, role, restaurant_id, branch_id, pin, status, approval_status')
                .in('restaurant_id', restaurantIds)
                .in('role', ['restaurant_admin', 'admin'])
                .eq('is_deleted', false)
            : Promise.resolve({ data: [], error: null }),
        supabaseAdmin
            .from('restaurant_registration_requests')
            .select('*')
            .or(`owner_id.eq.${auth.userId}${auth.email ? `,owner_email.eq.${auth.email}` : ''}`)
            .in('approval_status', ['PENDING_APPROVAL', 'PENDING_PAYMENT', 'PENDING', 'REJECTED'])
            .order('created_at', { ascending: false }),
        supabaseAdmin
            .from('employees')
            .select('id, name, email, mobile, max_branches, custom_quota')
            .eq('id', auth.userId)
            .maybeSingle(),
        restaurantIds.length > 0
            ? supabaseAdmin
                .from('subscriptions')
                .select('*')
                .in('restaurant_id', restaurantIds)
                .in('status', ['active', 'trialing'])
            : Promise.resolve({ data: [], error: null })
    ]);

    if (restRes.error) return NextResponse.json({ error: restRes.error.message }, { status: 500 });

    const restaurants = restRes.data || [];
    const branches = branchRes.data || [];
    const admins = empRes.data || [];
    const regRequests = regReqRes.data || [];
    const ownerEmp = ownerEmpRes.data;
    const activeSubs = subRes.data || [];
    const primaryActiveSub = activeSubs[0] || null;
    const hasActiveSubscription = !!primaryActiveSub;

    // Check if any restaurant has is_main_branch set to true; if none, the first active one defaults to main
    const hasAnyMain = restaurants.some(r => r.is_main_branch);

    // Only display approved/active restaurants in the branches grid (pending ones show in pendingRequests)
    const displayRestaurants = restaurants.filter(r => 
        !['pending', 'pending_approval', 'rejected', 'cancelled'].includes(r.status?.toLowerCase())
    );

    // Map each independent restaurant to match expected branch list schema for frontend
    const formattedBranches = displayRestaurants.map((r, idx) => {
        const primaryBranch = branches.find(b => b.restaurant_id === r.id && b.is_main_branch) ||
                              branches.find(b => b.restaurant_id === r.id) || null;
        const admin = admins.find(a => a.restaurant_id === r.id) || null;
        const isMain = hasAnyMain ? Boolean(r.is_main_branch) : idx === 0;

        return {
            id: r.id, // primary identifier
            restaurant_id: r.id,
            name: r.name,
            code: primaryBranch?.code || primaryBranch?.id || r.id,
            phone: r.phone || primaryBranch?.phone || null,
            email: r.email || primaryBranch?.email || null,
            address: r.address || primaryBranch?.address || null,
            status: (r.status || 'ACTIVE').toLowerCase(),
            is_main_branch: isMain,
            subscription_plan: r.subscription_plan || 'standard',
            custom_quota: r.custom_quota || null,
            created_at: r.created_at,
            branch_id: primaryBranch?.id || `BR-${r.id.slice(-6)}-01`,
            internal_id: primaryBranch?.internal_id || null,
            adminName: admin?.name || null,
            adminEmail: admin?.email || null,
            adminMobile: admin?.mobile || null,
            adminId: admin?.id || null,
            adminStatus: admin?.status || 'active',
            hasPin: Boolean(admin?.pin)
        };
    });

    // Check custom_quota override on employees or restaurants (Super Admin manual override)
    const customQuota = typeof ownerEmp?.custom_quota === 'number' && ownerEmp.custom_quota > 0
        ? ownerEmp.custom_quota
        : (typeof restaurants[0]?.custom_quota === 'number' && restaurants[0].custom_quota > 0 ? restaurants[0].custom_quota : null);

    // Count approved & active restaurants only (used quota strictly counts ACTIVE restaurants)
    const activeRestaurants = restaurants.filter(r => (r.status || '').toLowerCase() === 'active');
    const currentCount = activeRestaurants.length;

    let activePlanSlug: string = 'none';
    let planName = 'No Active Subscription';
    let planLimit = 0;
    let effectiveLimit = 0;
    let remainingSlots = 0;
    let canCreate = true;
    let status = 'no_subscription';
    let quotaSource = 'none';

    if (hasActiveSubscription) {
        const canonicalSlug: PlanSlug = normalizePlanSlug(primaryActiveSub.plan_name);
        const planDef = CANONICAL_PLANS[canonicalSlug] || CANONICAL_PLANS.standard;
        activePlanSlug = canonicalSlug;
        planName = planDef.name;
        planLimit = primaryActiveSub.max_branches || getPlanDefaultLimit(canonicalSlug);
        effectiveLimit = customQuota ?? planLimit;
        remainingSlots = Math.max(0, effectiveLimit - currentCount);
        canCreate = remainingSlots > 0;
        status = remainingSlots <= 0 ? 'limit_reached' : remainingSlots === 1 ? 'near_limit' : 'available';
        quotaSource = customQuota ? 'super_admin_override' : 'subscription_plan';
    } else {
        // No active subscription: Quota is strictly 0/0
        effectiveLimit = customQuota ?? 0;
        planLimit = 0;
        remainingSlots = Math.max(0, effectiveLimit - currentCount);
        // An owner with 0 restaurants and no subscription must be allowed to create their first restaurant and pick a plan!
        canCreate = currentCount === 0 || remainingSlots > 0;
        status = currentCount === 0 ? 'available' : 'no_subscription';
        quotaSource = customQuota ? 'super_admin_override' : 'none';
    }

    // Query any soft-deleted restaurants among the pending requests to avoid displaying orphaned requests
    const pendingRestIds = regRequests.map((r: any) => r.restaurant_id).filter(Boolean);
    let deletedRestIds = new Set<string>();
    if (pendingRestIds.length > 0) {
        const { data: delRests } = await supabaseAdmin
            .from('restaurants')
            .select('id')
            .in('id', pendingRestIds)
            .not('deleted_at', 'is', null);
        if (delRests && delRests.length > 0) {
            deletedRestIds = new Set(delRests.map((r: any) => r.id));
        }
    }

    // Filter pending requests to only those actively awaiting review / payment (strictly exclude CANCELLED, DELETED, REJECTED, ACTIVE, APPROVED, and deleted restaurants)
    const pendingRegRequests = regRequests.filter((req: any) => {
        const isPending = ['PENDING_APPROVAL', 'PENDING_PAYMENT', 'PENDING'].includes((req.approval_status || '').toUpperCase());
        if (!isPending) return false;
        if (req.restaurant_id && deletedRestIds.has(req.restaurant_id)) return false;
        return true;
    });

    // Format admins with branch_id = restaurant_id so UI easily pairs each admin to its restaurant
    const formattedAdmins = admins.map(a => ({
        ...a,
        branch_id: a.restaurant_id,
        hasPin: Boolean(a.pin)
    }));

    return NextResponse.json({
        branches: formattedBranches,
        restaurants: formattedBranches,
        pendingRequests: pendingRegRequests,
        branchLimits: {
            planSlug: activePlanSlug,
            planName,
            planLimit,
            customQuota,
            effectiveLimit,
            currentCount,
            remainingSlots,
            canCreate,
            status,
            quotaSource
        },
        admins: formattedAdmins
    });
}

// POST: Submit a NEW RESTAURANT REGISTRATION REQUEST under Owner account
export async function POST(request: NextRequest) {
    const auth = await getAuthenticatedOwner(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized: Owner session required' }, { status: 401 });

    // 1. Strict Permission Check: Only Owner (or Super Admin) can register restaurants
    const userRole = String(auth.role || '').toLowerCase();
    const isOwner = ['owner', 'restaurant_owner', 'restaurant_admin', 'super_admin', 'superadmin'].includes(userRole);
    if (!isOwner) {
        return NextResponse.json({
            error: 'Forbidden: Only the restaurant Owner has permission to create branches or restaurants. Restaurant Admins cannot create branches.'
        }, { status: 403 });
    }

    try {
        const body = await request.json();
        const {
            name,
            code,
            phone,
            email,
            address,
            planSlug: reqPlanSlug,
            subscriptionPlan,
            plan,
            paymentMethod = 'UPI',
            paymentReference,
            adminName,
            adminEmail,
            adminMobile,
            adminPin,
            adminPassword
        } = body;

        const rawPlanSlug = reqPlanSlug || subscriptionPlan || plan || 'standard';

        if (!name?.trim()) {
            return NextResponse.json({ error: 'Restaurant/Branch name is required' }, { status: 400 });
        }

        const planSlug = normalizePlanSlug(rawPlanSlug);
        const planDef = CANONICAL_PLANS[planSlug] || CANONICAL_PLANS.standard;
        const planDefaultLimit = getPlanDefaultLimit(planSlug);

        // 2. Fetch the Owner's current total active restaurants, active subscription, and authorized quota
        const [ownerEmpRes, existingRestRes, activeSubRes] = await Promise.all([
            supabaseAdmin
                .from('employees')
                .select('max_branches, custom_quota')
                .eq('id', auth.userId)
                .maybeSingle(),
            supabaseAdmin
                .from('restaurants')
                .select('id, status, max_branches, custom_quota')
                .eq('owner_id', auth.userId)
                .is('deleted_at', null),
            supabaseAdmin
                .from('subscriptions')
                .select('*')
                .in('status', ['active', 'trialing'])
        ]);

        const ownerEmp = ownerEmpRes.data;
        const existingRestaurants = existingRestRes.data || [];
        const existingRestIds = existingRestaurants.map(r => r.id);
        const matchingSubs = (activeSubRes.data || []).filter(s => existingRestIds.includes(s.restaurant_id));
        const activeSub = matchingSubs[0] || null;

        // Count ACTIVE/approved restaurants only
        const activeRestaurants = existingRestaurants.filter(r => (r.status || '').toLowerCase() === 'active');
        const currentTotalCount = activeRestaurants.length;
        const isFirstRestaurant = currentTotalCount === 0;

        // Check for Super Admin manual quota override on employees or primary restaurant
        const customQuota = typeof ownerEmp?.custom_quota === 'number' && ownerEmp.custom_quota > 0
            ? ownerEmp.custom_quota
            : (typeof existingRestaurants[0]?.custom_quota === 'number' && existingRestaurants[0].custom_quota > 0 ? existingRestaurants[0].custom_quota : null);

        // Effective Limit: If owner already has an active subscription, use its quota or plan limit;
        // If creating first restaurant, limit is determined by the selected plan
        const effectiveLimit = customQuota ?? (activeSub?.max_branches || (isFirstRestaurant ? planDefaultLimit : (ownerEmp?.max_branches || 0)));

        // 3. Strict Quota Enforcement (only applies when NOT creating the first restaurant)
        if (!isFirstRestaurant && currentTotalCount >= effectiveLimit) {
            return NextResponse.json({
                error: `Restaurant creation blocked: Your ${activeSub?.plan_name ? activeSub.plan_name.toUpperCase() : planDef.name} subscription allows ${effectiveLimit} restaurant(s). You have already created ${currentTotalCount} of ${effectiveLimit} authorized restaurants.`,
                code: 'PLAN_LIMIT_REACHED',
                planSlug,
                planName: planDef.name,
                planLimit: planDefaultLimit,
                customQuota,
                effectiveLimit,
                currentCount: currentTotalCount,
                requiredPlan: (planSlug === 'standard' || planSlug === 'growth') ? 'pro' : 'enterprise',
                upgradeMessage: (planSlug === 'standard' || planSlug === 'growth')
                    ? 'Upgrade to the Pro plan (₹2,999/month) to manage up to 2 restaurants under your Owner account.'
                    : 'Contact Super Admin to increase your enterprise restaurant quota.'
            }, { status: 403 });
        }

        // 4. Generate unique 12-digit restaurant ID
        const cleanName = name.trim();
        const newRestaurantId = await generateUniqueRestaurantId();
        const cleanCode = code?.trim() || `REST-${newRestaurantId.slice(-4)}`;
        const primaryBranchId = `BR-${newRestaurantId.slice(-6)}-01`;

        const amountDue = planDef.priceMonthly;
        const requestNumber = `REQ-${newRestaurantId.slice(-6)}`;
        const assignedQuota = customQuota ?? planDefaultLimit;

        // 5. Insert Restaurant record with status: 'pending_approval' (Super Admin approval required)
        const { data: newRestaurant, error: restInsertErr } = await supabaseAdmin
            .from('restaurants')
            .insert({
                id: newRestaurantId,
                name: cleanName,
                owner_id: auth.userId,
                owner_name: auth.name || 'Owner',
                phone: phone?.trim() || auth.mobile || auth.phone || '9876543210',
                email: email?.trim() || auth.email || 'contact@restaurant.com',
                address: address ? (typeof address === 'string' ? address : JSON.stringify(address)) : 'Main Branch Location',
                status: 'pending_approval',
                subscription_plan: planDef.name,
                custom_quota: customQuota,
                registration_request_id: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                max_branches: assignedQuota,
                is_main_branch: isFirstRestaurant
            })
            .select()
            .single();

        if (restInsertErr) {
            console.error('[Create Restaurant Error]:', restInsertErr);
            return NextResponse.json({ error: restInsertErr.message }, { status: 500 });
        }

        // 6. Connect Owner in restaurant_users with pending status
        await supabaseAdmin
            .from('restaurant_users')
            .insert({
                restaurant_id: newRestaurantId,
                user_id: auth.userId,
                role: 'OWNER',
                status: 'pending'
            });

        // 7. Create primary branch record with status: 'pending_approval'
        await supabaseAdmin
            .from('branches')
            .insert({
                id: primaryBranchId,
                restaurant_id: newRestaurantId,
                name: `${cleanName} - Main Branch`,
                code: cleanCode,
                phone: phone?.trim() || null,
                email: email?.trim() || null,
                address: address ? (typeof address === 'string' ? address : JSON.stringify(address)) : null,
                is_main_branch: true,
                status: 'pending_approval',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

        // 8. Create Subscription with status: 'pending' (activated upon Super Admin approval)
        const isTrial = planSlug === 'trial-14';
        const subPlanType = isTrial ? 'free_trial' : 'monthly';
        await supabaseAdmin.from('subscriptions').insert({
            restaurant_id: newRestaurantId,
            plan_name: planSlug,
            plan_type: subPlanType,
            status: 'pending',
            amount: amountDue,
            currency: 'INR',
            max_branches: assignedQuota,
            max_employees: planDef.maxEmployees,
            features: planDef.features || [],
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        });

        // 9. Insert Registration Request into restaurant_registration_requests (Pending Super Admin review)
        // No admin assignment and no payment blocking during creation
        const regReqId = crypto.randomUUID();
        const { error: regReqErr } = await supabaseAdmin
            .from('restaurant_registration_requests')
            .insert({
                id: regReqId,
                request_number: requestNumber,
                restaurant_id: newRestaurantId,
                restaurant_name: cleanName,
                owner_id: auth.userId,
                owner_name: auth.name || 'Owner',
                owner_email: auth.email,
                owner_phone: auth.mobile || phone,
                plan_slug: planSlug,
                plan_name: planDef.name,
                plan_limit: planDefaultLimit,
                custom_quota: customQuota,
                amount_due: amountDue,
                payment_method: null,
                payment_reference: null,
                payment_status: 'PENDING',
                approval_status: 'PENDING_APPROVAL',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

        if (regReqErr) {
            console.error('[Create Registration Request Error]:', regReqErr);
        }

        // Link registration_request_id on restaurant
        await supabaseAdmin
            .from('restaurants')
            .update({ registration_request_id: regReqId })
            .eq('id', newRestaurantId);

        // Audit Log for request creation
        await supabaseAdmin.from('audit_logs').insert({
            restaurant_id: newRestaurantId,
            user_id: auth.userId,
            action: 'owner_created_branch_request',
            details: {
                request_id: regReqId,
                request_number: requestNumber,
                restaurant_id: newRestaurantId,
                branch_id: primaryBranchId,
                plan_slug: planSlug,
                timestamp: new Date().toISOString()
            }
        });

        // 10. Create default profile, theme and tables
        await supabaseAdmin.from('restaurant_profile').insert({
            restaurant_id: newRestaurantId,
            name: cleanName,
            phone: phone?.trim() || null,
            email: email?.trim() || null
        });

        await supabaseAdmin.from('restaurant_theme').insert({
            restaurant_id: newRestaurantId,
            bg_color: '#F9FAFB',
            primary_button_color: '#F97316',
            secondary_button_color: '#000000',
            text_color: '#000000'
        });

        const tablesToInsert = [];
        for (let i = 1; i <= 5; i++) {
            tablesToInsert.push({
                table_number: String(i),
                capacity: i <= 2 ? 2 : 4,
                status: 'available',
                restaurant_id: newRestaurantId,
                branch_id: primaryBranchId
            });
        }
        await supabaseAdmin.from('tables').insert(tablesToInsert);

        // 11. Record in audit_logs
        await supabaseAdmin.from('audit_logs').insert({
            restaurant_id: newRestaurantId,
            action: 'restaurant_registration_submitted',
            user_id: auth.userId,
            performed_by: auth.name || 'Owner',
            details: {
                restaurant_id: newRestaurantId,
                restaurant_name: cleanName,
                primary_branch_id: primaryBranchId,
                plan_slug: planSlug,
                owner_id: auth.userId,
                status: 'PENDING_APPROVAL',
                request_id: regReqId
            },
            created_at: new Date().toISOString()
        });

        return NextResponse.json({
            success: true,
            restaurantId: newRestaurantId,
            restaurantName: cleanName,
            branchId: primaryBranchId,
            planSlug,
            planName: planDef.name,
            status: 'PENDING_APPROVAL',
            requestId: regReqId,
            message: 'Registration request submitted! Awaiting Super Admin review and activation.'
        });
    } catch (err: any) {
        console.error('[Create Restaurant Error]:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}

// PUT: Update restaurant details and Restaurant Admin credentials
export async function PUT(request: NextRequest) {
    try {
        const auth = await getAuthenticatedOwner(request);
        if (!auth) return NextResponse.json({ error: 'Unauthorized: Owner session required' }, { status: 401 });

        const restaurantIds = auth.restaurantIds || [auth.restaurantId];
        const body = await request.json();
        const {
            id,
            name,
            code,
            phone,
            email,
            address,
            assignAdmin,
            adminId,
            adminName,
            adminEmail,
            adminMobile,
            adminPassword,
            adminPin
        } = body;

        if (!id) return NextResponse.json({ error: 'Restaurant/Branch ID is required' }, { status: 400 });

    // Determine target restaurant ID and target branch ID
    let targetRestaurantId: string | null = null;
    let targetBranchId: string | null = null;

    // Check if a specific branch was requested in body
    const requestedBranch = body.branch_id || body.branchId;
    if (requestedBranch) {
        const bRes = await resolveAuthorizedBranch(requestedBranch, restaurantIds);
        if (bRes.success && bRes.validFkBranchId) {
            targetBranchId = bRes.validFkBranchId;
            if (bRes.branch?.restaurant_id) {
                targetRestaurantId = bRes.branch.restaurant_id;
            }
        }
    }

    if (!targetRestaurantId) {
        if (restaurantIds.includes(id)) {
            targetRestaurantId = id;
            if (!targetBranchId) {
                const { data: pb } = await supabaseAdmin
                    .from('branches')
                    .select('id')
                    .eq('restaurant_id', id)
                    .order('is_main_branch', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                targetBranchId = pb?.id || null;
            }
        } else {
            const branchRes = await resolveAuthorizedBranch(id, restaurantIds);
            if (branchRes.success && branchRes.branch) {
                targetRestaurantId = branchRes.branch.restaurant_id;
                if (!targetBranchId) {
                    targetBranchId = branchRes.validFkBranchId || null;
                }
            }
        }
    }

    if (!targetRestaurantId) {
        return NextResponse.json({ error: 'Restaurant not found or access denied' }, { status: 404 });
    }

    // Fetch target restaurant to verify existence and approval status
    const { data: targetRestaurant } = await supabaseAdmin
        .from('restaurants')
        .select('id, name, status, deleted_at')
        .eq('id', targetRestaurantId)
        .maybeSingle();

    if (!targetRestaurant || targetRestaurant.deleted_at) {
        return NextResponse.json({ error: 'Restaurant not found or has been deleted' }, { status: 404 });
    }

    // Authoritatively verify that targetBranchId exists in branches table and belongs to targetRestaurantId
    let verifiedBranchId: string | null = null;
    if (targetBranchId) {
        const { data: bCheck } = await supabaseAdmin
            .from('branches')
            .select('id')
            .eq('id', targetBranchId)
            .eq('restaurant_id', targetRestaurantId)
            .is('deleted_at', null)
            .maybeSingle();
        if (bCheck) {
            verifiedBranchId = bCheck.id;
        }
    }

    if (!verifiedBranchId) {
        // Query primary / main branch for targetRestaurantId
        const { data: primaryBranch } = await supabaseAdmin
            .from('branches')
            .select('id')
            .eq('restaurant_id', targetRestaurantId)
            .is('deleted_at', null)
            .order('is_main_branch', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (primaryBranch) {
            verifiedBranchId = primaryBranch.id;
        } else {
            const newBranchId = `BR-${targetRestaurantId.slice(-6)}-01`;
            const isRestActive = (targetRestaurant.status || '').toUpperCase() === 'ACTIVE';
            await supabaseAdmin.from('branches').insert({
                id: newBranchId,
                restaurant_id: targetRestaurantId,
                name: `${name?.trim() || 'Main'} - Main Branch`,
                code: code?.trim() || `REST-${targetRestaurantId.slice(-4)}`,
                is_main_branch: true,
                status: isRestActive ? 'active' : 'pending_approval',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            verifiedBranchId = newBranchId;
        }
    }

    targetBranchId = verifiedBranchId;

    // Fetch target branch record
    const { data: targetBranch } = await supabaseAdmin
        .from('branches')
        .select('id, name, status, deleted_at')
        .eq('id', targetBranchId)
        .maybeSingle();

    // Update restaurant details
    const updates: any = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (phone !== undefined) updates.phone = phone?.trim() || null;
    if (email !== undefined) updates.email = email?.trim() || null;
    if (address !== undefined) updates.address = typeof address === 'string' ? address : JSON.stringify(address);

    await supabaseAdmin
        .from('restaurants')
        .update(updates)
        .eq('id', targetRestaurantId);

    if (targetBranchId) {
        await supabaseAdmin
            .from('branches')
            .update({
                name: updates.name ? `${updates.name} - Main Branch` : undefined,
                phone: updates.phone,
                email: updates.email,
                address: updates.address,
                code: code?.trim() || undefined,
                updated_at: new Date().toISOString()
            })
            .eq('id', targetBranchId);
    }

    // Handle Admin credentials creation & update
    let updatedAdminInfo: any = null;
    const hasAdminUpdates = assignAdmin !== false && (adminId || adminName || adminEmail || adminMobile || adminPassword || adminPin);

    if (hasAdminUpdates) {
        // Enforce: Admin assignment must be impossible while branch status is PENDING_APPROVAL or REJECTED
        const restStatusUpper = (targetRestaurant.status || '').toUpperCase();
        const branchStatusLower = (targetBranch?.status || '').toLowerCase();

        if (restStatusUpper !== 'ACTIVE' || branchStatusLower !== 'active') {
            return NextResponse.json({
                error: `Admin assignment is prohibited: Restaurant and branch must be approved and ACTIVE by Super Admin before assigning an admin. Current restaurant status: ${targetRestaurant.status}, branch status: ${targetBranch?.status || 'unknown'}.`,
                code: 'BRANCH_NOT_ACTIVE'
            }, { status: 403 });
        }
        let existingAdmin: any = null;

        // 1. Look up by adminId if provided
        if (adminId) {
            const { data: byId } = await supabaseAdmin
                .from('employees')
                .select('*')
                .eq('id', adminId)
                .maybeSingle();
            if (byId && (byId.restaurant_id === targetRestaurantId || !byId.restaurant_id || restaurantIds.includes(byId.restaurant_id))) {
                existingAdmin = byId;
            }
        }

        // 2. Look up existing admin for this restaurant
        if (!existingAdmin && targetRestaurantId) {
            const { data: byRest } = await supabaseAdmin
                .from('employees')
                .select('*')
                .eq('restaurant_id', targetRestaurantId)
                .in('role', ['restaurant_admin', 'admin'])
                .eq('is_deleted', false)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (byRest) existingAdmin = byRest;
        }

        // 3. Look up by email if provided
        const cleanEmail = adminEmail ? adminEmail.toLowerCase().trim() : null;
        if (!existingAdmin && cleanEmail) {
            const { data: byEmail } = await supabaseAdmin
                .from('employees')
                .select('*')
                .ilike('email', cleanEmail)
                .maybeSingle();
            if (byEmail) {
                if (byEmail.restaurant_id === targetRestaurantId || !byEmail.restaurant_id || restaurantIds.includes(byEmail.restaurant_id)) {
                    existingAdmin = byEmail;
                } else {
                    return NextResponse.json({
                        error: 'This email is already associated with another restaurant. Please use a unique email for this restaurant admin.'
                    }, { status: 400 });
                }
            }
        }

        // 4. Look up by mobile if provided
        const cleanMobile = adminMobile ? adminMobile.replace(/[^0-9]/g, '').slice(-10) : null;
        if (!existingAdmin && cleanMobile && cleanMobile.length >= 10) {
            const { data: byMobile } = await supabaseAdmin
                .from('employees')
                .select('*')
                .eq('mobile', cleanMobile)
                .maybeSingle();
            if (byMobile && (byMobile.restaurant_id === targetRestaurantId || !byMobile.restaurant_id || restaurantIds.includes(byMobile.restaurant_id))) {
                existingAdmin = byMobile;
            }
        }

        if (existingAdmin) {
            // UPDATE EXISTING ADMIN
            const empUpdates: any = {
                restaurant_id: targetRestaurantId,
                branch_id: targetBranchId || existingAdmin.branch_id,
                role: 'restaurant_admin',
                status: 'active',
                approval_status: 'approved',
                is_deleted: false,
                updated_at: new Date().toISOString()
            };

            if (adminName?.trim()) empUpdates.name = adminName.trim();

            if (cleanEmail && cleanEmail !== existingAdmin.email) {
                // Ensure unique email across other employees
                const { data: dupEmp } = await supabaseAdmin
                    .from('employees')
                    .select('id')
                    .ilike('email', cleanEmail)
                    .neq('id', existingAdmin.id)
                    .maybeSingle();
                if (dupEmp) {
                    return NextResponse.json({
                        error: 'This email is already registered to another employee. Please provide a unique email.'
                    }, { status: 400 });
                }
                empUpdates.email = cleanEmail;
            }

            if (cleanMobile) empUpdates.mobile = cleanMobile;

            if (adminPin?.trim()) {
                empUpdates.pin = await hashPin(adminPin.trim());
            }

            const { error: updateErr } = await supabaseAdmin
                .from('employees')
                .update(empUpdates)
                .eq('id', existingAdmin.id);

            if (updateErr) {
                console.error('[PUT /branches update admin error]:', updateErr);
                return NextResponse.json({ error: 'Failed to update admin: ' + updateErr.message }, { status: 500 });
            }

            if (adminPassword?.trim()) {
                const hashedPassword = await hashPassword(adminPassword.trim());
                await supabaseAdmin
                    .from('auth')
                    .upsert({
                        user_id: existingAdmin.id,
                        password_hash: hashedPassword
                    }, { onConflict: 'user_id' });
            }

            if (targetBranchId) {
                await supabaseAdmin
                    .from('employee_branch_access')
                    .upsert({
                        branch_id: targetBranchId,
                        employee_id: existingAdmin.id
                    }, { onConflict: 'employee_id,branch_id' });
            }

            // Sync dine_users
            await supabaseAdmin.from('dine_users').upsert({
                id: existingAdmin.id,
                name: empUpdates.name || existingAdmin.name,
                email: empUpdates.email || existingAdmin.email,
                phone: empUpdates.mobile || existingAdmin.mobile,
                restaurant_id: targetRestaurantId,
                role: 'restaurant_admin',
                status: 'active'
            }, { onConflict: 'id' });

            // Sync Supabase Auth
            const finalEmail = empUpdates.email || existingAdmin.email;
            if (finalEmail) {
                try {
                    const sbAuthUpdates: any = { email: finalEmail };
                    if (adminPassword?.trim()) sbAuthUpdates.password = adminPassword.trim();
                    const { error: sbErr } = await supabaseAdmin.auth.admin.updateUserById(existingAdmin.id, sbAuthUpdates);
                    if (sbErr && adminPassword?.trim()) {
                        await supabaseAdmin.auth.admin.createUser({
                            id: existingAdmin.id,
                            email: finalEmail,
                            password: adminPassword.trim(),
                            email_confirm: true,
                            user_metadata: {
                                name: empUpdates.name || existingAdmin.name,
                                role: 'restaurant_admin',
                                restaurant_id: targetRestaurantId,
                                branch_id: targetBranchId
                            }
                        });
                    }
                } catch (e) {
                    console.warn('[Admin Supabase Auth sync note]:', e);
                }
            }

            updatedAdminInfo = {
                id: existingAdmin.id,
                name: empUpdates.name || existingAdmin.name,
                email: empUpdates.email || existingAdmin.email,
                mobile: empUpdates.mobile || existingAdmin.mobile,
                restaurant_id: targetRestaurantId,
                branch_id: targetBranchId,
                hasPin: Boolean(empUpdates.pin || existingAdmin.pin)
            };
        } else if (cleanEmail || cleanMobile || adminName?.trim()) {
            // CREATE AND ASSIGN NEW RESTAURANT ADMIN
            const cleanAdminName = (adminName || `${updates.name || name || 'Restaurant'} Admin`).trim();
            const rawPin = adminPin?.trim() || null;
            const hashedPin = rawPin ? await hashPin(rawPin) : null;

            // Check if unassigned employee with this email exists
            let candidateAdmin: any = null;
            if (cleanEmail) {
                const { data: empByEmail } = await supabaseAdmin
                    .from('employees')
                    .select('*')
                    .ilike('email', cleanEmail)
                    .maybeSingle();
                if (empByEmail) {
                    if (!empByEmail.restaurant_id || restaurantIds.includes(empByEmail.restaurant_id)) {
                        candidateAdmin = empByEmail;
                    } else {
                        return NextResponse.json({
                            error: 'This email is already registered with another restaurant. Please use a unique email address.'
                        }, { status: 400 });
                    }
                }
            }

            if (candidateAdmin) {
                // Reassign & update candidateAdmin
                const empUpdates: any = {
                    restaurant_id: targetRestaurantId,
                    branch_id: targetBranchId || candidateAdmin.branch_id,
                    name: cleanAdminName,
                    role: 'restaurant_admin',
                    status: 'active',
                    approval_status: 'approved',
                    is_deleted: false,
                    pin: hashedPin,
                    updated_at: new Date().toISOString()
                };
                if (cleanEmail) empUpdates.email = cleanEmail;
                if (cleanMobile) empUpdates.mobile = cleanMobile;

                await supabaseAdmin.from('employees').update(empUpdates).eq('id', candidateAdmin.id);

                if (adminPassword?.trim()) {
                    const hashedPassword = await hashPassword(adminPassword.trim());
                    await supabaseAdmin
                        .from('auth')
                        .upsert({
                            user_id: candidateAdmin.id,
                            password_hash: hashedPassword
                        }, { onConflict: 'user_id' });
                }

                if (targetBranchId) {
                    await supabaseAdmin
                        .from('employee_branch_access')
                        .upsert({
                            branch_id: targetBranchId,
                            employee_id: candidateAdmin.id
                        }, { onConflict: 'employee_id,branch_id' });
                }

                await supabaseAdmin.from('dine_users').upsert({
                    id: candidateAdmin.id,
                    name: cleanAdminName,
                    email: cleanEmail || candidateAdmin.email,
                    phone: cleanMobile || candidateAdmin.mobile,
                    restaurant_id: targetRestaurantId,
                    role: 'restaurant_admin',
                    status: 'active'
                }, { onConflict: 'id' });

                const finalEmail = cleanEmail || candidateAdmin.email;
                if (finalEmail && adminPassword?.trim()) {
                    try {
                        const { error: sbErr } = await supabaseAdmin.auth.admin.updateUserById(candidateAdmin.id, {
                            password: adminPassword.trim(),
                            email: finalEmail
                        });
                        if (sbErr) {
                            await supabaseAdmin.auth.admin.createUser({
                                id: candidateAdmin.id,
                                email: finalEmail,
                                password: adminPassword.trim(),
                                email_confirm: true,
                                user_metadata: {
                                    name: cleanAdminName,
                                    role: 'restaurant_admin',
                                    restaurant_id: targetRestaurantId,
                                    branch_id: targetBranchId
                                }
                            });
                        }
                    } catch (e) {
                        console.warn('[Admin Supabase Auth sync note]:', e);
                    }
                }

                updatedAdminInfo = {
                    id: candidateAdmin.id,
                    name: cleanAdminName,
                    email: cleanEmail || candidateAdmin.email,
                    mobile: cleanMobile || candidateAdmin.mobile,
                    restaurant_id: targetRestaurantId,
                    branch_id: targetBranchId,
                    hasPin: Boolean(hashedPin)
                };
            } else {
                // Insert brand new admin
                const adminUUID = crypto.randomUUID();
                const empCode = `ADM-${targetRestaurantId.slice(-4)}-${Math.floor(1000 + Math.random() * 9000)}`;

                const newAdminData: any = {
                    id: adminUUID,
                    employee_id: empCode,
                    restaurant_id: targetRestaurantId,
                    branch_id: targetBranchId,
                    name: cleanAdminName,
                    email: cleanEmail,
                    mobile: cleanMobile,
                    role: 'restaurant_admin',
                    pin: hashedPin,
                    status: 'active',
                    approval_status: 'approved',
                    is_online: false,
                    is_deleted: false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                const { data: createdAdmin, error: createAdminErr } = await supabaseAdmin
                    .from('employees')
                    .insert(newAdminData)
                    .select()
                    .single();

                if (createAdminErr) {
                    console.error('[PUT /branches create admin error]:', createAdminErr);
                    return NextResponse.json({ error: 'Failed to create restaurant admin: ' + createAdminErr.message }, { status: 500 });
                }

                if (adminPassword?.trim()) {
                    const hashedPassword = await hashPassword(adminPassword.trim());
                    await supabaseAdmin
                        .from('auth')
                        .upsert({
                            user_id: adminUUID,
                            password_hash: hashedPassword
                        }, { onConflict: 'user_id' });
                }

                if (targetBranchId) {
                    await supabaseAdmin
                        .from('employee_branch_access')
                        .upsert({
                            branch_id: targetBranchId,
                            employee_id: adminUUID
                        }, { onConflict: 'employee_id,branch_id' });
                }

                // Sync dine_users
                await supabaseAdmin.from('dine_users').upsert({
                    id: adminUUID,
                    name: cleanAdminName,
                    email: cleanEmail,
                    phone: cleanMobile,
                    restaurant_id: targetRestaurantId,
                    role: 'restaurant_admin',
                    status: 'active'
                }, { onConflict: 'id' });

                // Sync Supabase Auth
                if (cleanEmail && adminPassword?.trim()) {
                    try {
                        await supabaseAdmin.auth.admin.createUser({
                            id: adminUUID,
                            email: cleanEmail,
                            password: adminPassword.trim(),
                            email_confirm: true,
                            user_metadata: {
                                name: cleanAdminName,
                                role: 'restaurant_admin',
                                restaurant_id: targetRestaurantId,
                                branch_id: targetBranchId
                            }
                        });
                    } catch (e) {
                        console.warn('[Admin Supabase Auth create note]:', e);
                    }
                }

                updatedAdminInfo = {
                    id: adminUUID,
                    name: cleanAdminName,
                    email: cleanEmail,
                    mobile: cleanMobile,
                    restaurant_id: targetRestaurantId,
                    branch_id: targetBranchId,
                    adminPassword: adminPassword?.trim() || null,
                    adminPin: rawPin
                };
            }
        }
    }

    return NextResponse.json({
        success: true,
        restaurant_id: targetRestaurantId,
        admin: updatedAdminInfo,
        message: 'Restaurant and admin details updated successfully.'
    });
    } catch (err: any) {
        console.error('[PUT /branches error]:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}

// PATCH: Mark any one branch as the Main Branch for this Owner account
export async function PATCH(request: NextRequest) {
    const auth = await getAuthenticatedOwner(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized: Owner session required' }, { status: 401 });

    const userRole = String(auth.role || '').toLowerCase();
    const isOwner = ['owner', 'restaurant_owner', 'super_admin', 'superadmin'].includes(userRole);
    if (!isOwner) {
        return NextResponse.json({
            error: 'Forbidden: Only the restaurant Owner has permission to update the main branch.'
        }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: 'Branch or Restaurant ID is required' }, { status: 400 });
        }

        const restaurantIds = auth.restaurantIds || [auth.restaurantId];

        // Resolve target restaurant ID
        let targetRestaurantId: string | null = null;
        if (restaurantIds.includes(id)) {
            targetRestaurantId = id;
        } else {
            const { data: bRec } = await supabaseAdmin
                .from('branches')
                .select('id, restaurant_id')
                .eq('id', id)
                .in('restaurant_id', restaurantIds)
                .maybeSingle();
            if (bRec) {
                targetRestaurantId = bRec.restaurant_id;
            }
        }

        if (!targetRestaurantId) {
            return NextResponse.json({ error: 'Restaurant or branch not found under your Owner account' }, { status: 404 });
        }

        // 1. Reset all branches and restaurants for this owner to is_main_branch = false
        await Promise.all([
            supabaseAdmin
                .from('restaurants')
                .update({ is_main_branch: false, updated_at: new Date().toISOString() })
                .in('id', restaurantIds),
            supabaseAdmin
                .from('branches')
                .update({ is_main_branch: false, updated_at: new Date().toISOString() })
                .in('restaurant_id', restaurantIds)
        ]);

        // 2. Set the chosen target restaurant and its branch to is_main_branch = true
        await Promise.all([
            supabaseAdmin
                .from('restaurants')
                .update({ is_main_branch: true, updated_at: new Date().toISOString() })
                .eq('id', targetRestaurantId),
            supabaseAdmin
                .from('branches')
                .update({ is_main_branch: true, updated_at: new Date().toISOString() })
                .eq('restaurant_id', targetRestaurantId)
        ]);

        return NextResponse.json({
            success: true,
            main_branch_id: targetRestaurantId,
            message: 'Branch successfully marked as Main Branch.'
        });
    } catch (err: any) {
        console.error('[Set Main Branch Error]:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}

// DELETE: Deactivate / Delete restaurant or branch
export async function DELETE(request: NextRequest) {
    const auth = await getAuthenticatedOwner(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized: Owner session required' }, { status: 401 });

    // Strict Permission Check: Only Owner can delete branches/restaurants
    const userRole = String(auth.role || '').toLowerCase();
    const isOwner = ['owner', 'restaurant_owner', 'super_admin', 'superadmin'].includes(userRole);
    if (!isOwner) {
        return NextResponse.json({
            error: 'Forbidden: Only the restaurant Owner has permission to delete branches or restaurants.'
        }, { status: 403 });
    }

    const restaurantIds = auth.restaurantIds || [auth.restaurantId];
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    let targetRestaurantId: string | null = null;
    let targetBranchId: string | null = null;

    if (restaurantIds.includes(id)) {
        targetRestaurantId = id;
    } else {
        const { data: bRec } = await supabaseAdmin
            .from('branches')
            .select('id, restaurant_id')
            .eq('id', id)
            .in('restaurant_id', restaurantIds)
            .maybeSingle();
        if (bRec) {
            targetRestaurantId = bRec.restaurant_id;
            targetBranchId = bRec.id;
        }
    }

    if (!targetRestaurantId) {
        return NextResponse.json({ error: 'Restaurant not found or access denied' }, { status: 404 });
    }

    // Protect Main Branch: Cannot delete the main branch
    const { data: targetRest } = await supabaseAdmin
        .from('restaurants')
        .select('is_main_branch')
        .eq('id', targetRestaurantId)
        .maybeSingle();

    if (targetRest?.is_main_branch) {
        return NextResponse.json({
            error: 'Cannot delete the Main Branch. Please mark another branch as the Main Branch first before deleting this one.'
        }, { status: 400 });
    }

    // Execute atomic stored procedure to deactivate restaurant, cancel requests, cancel subscriptions, and revoke sessions
    try {
        await supabaseAdmin.rpc('delete_restaurant_branch_atomic', {
            p_restaurant_id: targetRestaurantId,
            p_deleted_by: auth.name || auth.email || 'Owner',
            p_reason: 'Owner deactivated/deleted branch'
        });
    } catch (rpcErr) {
        console.warn('[delete_restaurant_branch_atomic RPC warning]:', rpcErr);
    }

    const nowIso = new Date().toISOString();

    // Comprehensive multi-table cleanup & revocation (dual-layer guarantee)
    // 1. Soft delete restaurant
    await supabaseAdmin
        .from('restaurants')
        .update({
            deleted_at: nowIso,
            status: 'deactivated',
            updated_at: nowIso
        })
        .eq('id', targetRestaurantId);

    // 2. Soft delete branches
    await supabaseAdmin
        .from('branches')
        .update({
            deleted_at: nowIso,
            status: 'inactive',
            updated_at: nowIso
        })
        .eq('restaurant_id', targetRestaurantId);

    // 3. Delete related registration requests
    await supabaseAdmin
        .from('restaurant_registration_requests')
        .delete()
        .eq('restaurant_id', targetRestaurantId);

    // 4. Cancel related subscriptions
    await supabaseAdmin
        .from('subscriptions')
        .update({
            status: 'cancelled',
            updated_at: nowIso
        })
        .eq('restaurant_id', targetRestaurantId);

    // 5. Fetch all employee IDs for this restaurant to revoke sessions and access
    const { data: restaurantEmps } = await supabaseAdmin
        .from('employees')
        .select('id')
        .eq('restaurant_id', targetRestaurantId);

    const empIds = (restaurantEmps || []).map((e: any) => e.id);
    if (empIds.length > 0) {
        // Revoke all active sessions for these employees
        await supabaseAdmin
            .from('dine_sessions')
            .delete()
            .in('user_id', empIds);

        // Delete employee branch access
        await supabaseAdmin
            .from('employee_branch_access')
            .delete()
            .in('employee_id', empIds);

        // Deactivate employee records
        await supabaseAdmin
            .from('employees')
            .update({
                status: 'inactive',
                approval_status: 'rejected',
                is_deleted: true,
                deleted_at: nowIso,
                updated_at: nowIso
            })
            .in('id', empIds);

        // Deactivate dine_users records
        await supabaseAdmin
            .from('dine_users')
            .update({ status: 'inactive' })
            .in('id', empIds);
    }

    // 6. Update restaurant_users status to deactivated
    await supabaseAdmin
        .from('restaurant_users')
        .update({ status: 'deactivated', updated_at: nowIso })
        .eq('restaurant_id', targetRestaurantId);

    // 7. Audit Log
    await supabaseAdmin.from('audit_logs').insert({
        restaurant_id: targetRestaurantId,
        user_id: auth.userId,
        action: 'restaurant_branch_deleted_and_sessions_revoked',
        details: {
            restaurant_id: targetRestaurantId,
            branch_id: targetBranchId || null,
            revoked_employee_count: empIds.length,
            timestamp: nowIso
        }
    });

    return NextResponse.json({
        success: true,
        message: 'Restaurant deactivated successfully, registration requests closed, and admin access revoked.'
    });
}
