import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySuperAdmin } from '@/lib/superadmin-guard';
import { CANONICAL_PLANS, getPlanDefaultLimit, normalizePlanSlug } from '@/lib/entitlements';
import { hashPassword } from '@/lib/auth-utils';

export async function GET(request: Request) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        // 1. Fetch data from dine_users, restaurant_users, restaurants, employees, subscriptions, audit_logs, branches, and restaurant_registration_requests
        const [dineUsersRes, ruRes, restRes, empRes, subRes, auditRes, regReqsRes, branchRes] = await Promise.all([
            supabaseAdmin.from('dine_users').select('*').order('created_at', { ascending: false }),
            supabaseAdmin.from('restaurant_users').select('*'),
            supabaseAdmin.from('restaurants').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
            supabaseAdmin.from('employees').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
            supabaseAdmin.from('subscriptions').select('*'),
            supabaseAdmin.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200),
            supabaseAdmin.from('restaurant_registration_requests').select('*').order('created_at', { ascending: false }),
            supabaseAdmin.from('branches').select('*').is('deleted_at', null).order('created_at', { ascending: true })
        ]);

        const allRestaurants = restRes.data || [];
        const users = dineUsersRes.data || [];
        const restaurantUsers = ruRes.data || [];
        const allEmployees = empRes.data || [];
        const allSubscriptions = subRes.data || [];
        const recentAudits = auditRes.data || [];
        const allRegRequests = regReqsRes.data || [];
        const allBranches = branchRes.data || [];

        // Build set of ONLY genuine owner user IDs
        const ownerUserIds = new Set<string>();

        // From restaurants owner_id
        allRestaurants.forEach((r) => {
            if (r.owner_id && r.owner_id.length > 5 && !r.owner_id.includes('superadmin')) {
                ownerUserIds.add(r.owner_id);
            }
        });

        // From restaurant_users with role OWNER
        restaurantUsers.forEach((ru) => {
            if ((ru.role || '').toUpperCase() === 'OWNER' && ru.user_id) {
                ownerUserIds.add(ru.user_id);
            }
        });

        // From dine_users with explicit owner roles
        users.forEach((u) => {
            const role = (u.role || '').toLowerCase();
            if ((role === 'owner' || role === 'restaurant_owner')) {
                ownerUserIds.add(u.id);
            }
        });

        // From employees with EXPLICIT owner roles ONLY (excluding waiters, chefs, branch admins)
        allEmployees.forEach((e) => {
            const role = (e.role || '').toLowerCase();
            if ((role === 'owner' || role === 'restaurant_owner')) {
                ownerUserIds.add(e.id);
            }
        });

        // From registration requests (pending or approved owner registrations)
        allRegRequests.forEach((req) => {
            if (req.owner_id && req.owner_id.length > 5) {
                ownerUserIds.add(req.owner_id);
            } else if (req.id && (req.approval_status === 'PENDING_APPROVAL' || req.approval_status === 'PENDING_PAYMENT')) {
                ownerUserIds.add(req.id);
            }
        });

        // Format each Owner record
        const formattedOwners = Array.from(ownerUserIds).map((ownerId) => {
            const du = users.find((u) => u.id === ownerId);
            const emp = allEmployees.find((e) => e.id === ownerId);
            const regReq = allRegRequests.find((r) =>
                r.owner_id === ownerId ||
                r.id === ownerId ||
                (emp?.email && r.owner_email?.toLowerCase() === emp.email.toLowerCase()) ||
                (du?.email && r.owner_email?.toLowerCase() === du.email.toLowerCase())
            );
            const ruEntries = restaurantUsers.filter((ru) => ru.user_id === ownerId && (ru.role || '').toUpperCase() === 'OWNER');
            
            // Find all restaurants owned by this owner
            const assignedRestIds = new Set<string>();
            allRestaurants.forEach((r) => {
                if (r.owner_id === ownerId) assignedRestIds.add(r.id);
            });
            ruEntries.forEach((ru) => {
                if (ru.status === 'active' || !ru.status) assignedRestIds.add(ru.restaurant_id);
            });

            const ownedRestaurants = allRestaurants.filter((r) => assignedRestIds.has(r.id));
            const ownedBranches = allBranches.filter((b) => assignedRestIds.has(b.restaurant_id));

            // Owner Details
            const name = du?.name || emp?.name || regReq?.owner_name || ownedRestaurants[0]?.owner_name || 'Restaurant Owner';
            const email = du?.email || emp?.email || regReq?.owner_email || ownedRestaurants[0]?.email || '—';
            const phone = du?.phone || emp?.mobile || regReq?.owner_phone || ownedRestaurants[0]?.phone || '—';
            
            // Pending Approval Determination:
            // An owner is pending if their employee account has not yet been approved by Super Admin
            const empApproval = (emp?.approval_status || '').toLowerCase();
            const empStatus = (emp?.status || '').toLowerCase();
            const duStatus = (du?.status || '').toLowerCase();

            const isApproved =
                empApproval === 'approved' ||
                empStatus === 'active' ||
                duStatus === 'active';

            const isPendingApproval = !isApproved;

            const rawStatus = isPendingApproval ? 'PENDING' : (du?.status || emp?.status || ownedRestaurants[0]?.status || 'ACTIVE');
            const status = rawStatus.toUpperCase();
            const approvalStatus = isPendingApproval ? 'PENDING_APPROVAL' : 'APPROVED';

            // Subscription: Match active/trialing subscriptions for this owner's restaurants
            const restIds = ownedRestaurants.map((r) => r.id);
            const matchingSubs = allSubscriptions.filter((s) =>
                restIds.includes(s.restaurant_id) &&
                (s.status === 'active' || s.status === 'trialing')
            );
            const primarySub = matchingSubs[0];
            const hasActiveSubscription = matchingSubs.length > 0;

            // Quota: Only ACTIVE restaurants consume quota
            const activeOwnedRestaurants = ownedRestaurants.filter(r => (r.status || '').toLowerCase() === 'active');
            let quota = 0;
            let usedQuota = activeOwnedRestaurants.length;
            let remainingQuota = 0;
            let quotaStatus = 'no_subscription';
            let subscriptionPlan = 'No Active Subscription';

            const customQuota = (typeof emp?.custom_quota === 'number' && emp.custom_quota > 0)
                ? emp.custom_quota
                : null;

            if (customQuota !== null) {
                quota = customQuota;
                remainingQuota = Math.max(0, quota - usedQuota);
                quotaStatus = usedQuota >= quota ? 'limit_reached' : remainingQuota === 1 ? 'near_limit' : 'available';
                subscriptionPlan = hasActiveSubscription && primarySub?.plan_name ? (primarySub.plan_name.charAt(0).toUpperCase() + primarySub.plan_name.slice(1)) : 'Custom Quota Override';
            } else if (hasActiveSubscription) {
                const planLimit = getPlanDefaultLimit(primarySub.plan_name);
                const subLimit = primarySub.max_branches || planLimit;
                quota = subLimit;
                remainingQuota = Math.max(0, quota - usedQuota);
                quotaStatus = usedQuota >= quota ? 'limit_reached' : remainingQuota === 1 ? 'near_limit' : 'available';
            }

            // Dates & Activity
            const createdDates = [
                du?.created_at,
                emp?.created_at,
                regReq?.created_at,
                ...ownedRestaurants.map((r) => r.created_at)
            ].filter(Boolean).map((d) => new Date(d).getTime());

            const earliestCreated = createdDates.length > 0 ? new Date(Math.min(...createdDates)).toISOString() : new Date().toISOString();

            // Find last activity
            const ownerLogs = recentAudits.filter(
                (a) => a.user_id === ownerId || a.actor_id === ownerId || a.resource_id === ownerId || assignedRestIds.has(a.restaurant_id)
            );
            const latestAudit = ownerLogs[0];
            const lastActivity = du?.last_login
                ? new Date(du.last_login).toISOString()
                : latestAudit?.created_at || earliestCreated;

            return {
                id: ownerId,
                name,
                email,
                phone,
                role: 'OWNER',
                status,
                approvalStatus,
                isPendingApproval,
                requestNumber: regReq?.request_number || null,
                requestId: regReq?.id || null,
                emailVerified: emp?.email_verified ?? true,
                subscription: subscriptionPlan,
                hasSubscription: !!primarySub,
                totalRestaurants: activeOwnedRestaurants.length,
                totalBranches: ownedBranches.filter((b) => (b.status || '').toLowerCase() === 'active').length,
                totalLocations: activeOwnedRestaurants.length,
                quota,
                usedQuota,
                remainingQuota,
                quotaStatus,
                createdDate: earliestCreated,
                registrationDate: earliestCreated,
                lastActivity,
                rejectionReason: emp?.rejection_reason || regReq?.rejection_reason || null,
                pendingBranchesCount: 0,
                pendingBranches: [] as any[],
                locations: ownedRestaurants.map((r) => {
                    const rBranches = allBranches.filter((b) => b.restaurant_id === r.id);
                    const matchingReg = allRegRequests.find((req: any) => req.restaurant_id === r.id);
                    const rawStatus = (r.status || 'ACTIVE').toUpperCase();
                    const isPending = rawStatus === 'PENDING_APPROVAL' ||
                                      rawStatus === 'PENDING' ||
                                      matchingReg?.approval_status === 'PENDING_APPROVAL' ||
                                      matchingReg?.approval_status === 'PENDING_PAYMENT';

                    return {
                        id: r.id,
                        name: r.name,
                        phone: r.phone || '—',
                        email: r.email || '—',
                        address: r.address || '—',
                        status: isPending ? 'PENDING_APPROVAL' : rawStatus,
                        isPendingApproval: isPending,
                        is_main_branch: Boolean(r.is_main_branch),
                        plan: matchingReg?.plan_name || r.subscription_plan || 'Standard',
                        branchesCount: rBranches.length,
                        registrationRequest: matchingReg ? {
                            id: matchingReg.id,
                            requestNumber: matchingReg.request_number,
                            approvalStatus: matchingReg.approval_status,
                            paymentStatus: matchingReg.payment_status,
                            paymentReference: matchingReg.payment_reference,
                            amountDue: matchingReg.amount_due,
                            planSlug: matchingReg.plan_slug,
                            planName: matchingReg.plan_name,
                            createdAt: matchingReg.created_at
                        } : null,
                        branches: rBranches.map((b) => ({
                            id: b.id,
                            name: b.name,
                            code: b.code,
                            status: b.status,
                            is_main_branch: Boolean(b.is_main_branch)
                        }))
                    };
                }),
                restaurants: ownedRestaurants.map((r) => {
                    const rBranches = allBranches.filter((b) => b.restaurant_id === r.id);
                    return {
                        id: r.id,
                        name: r.name,
                        phone: r.phone || '—',
                        email: r.email || '—',
                        address: r.address || '—',
                        status: (r.status || 'ACTIVE').toUpperCase(),
                        is_main_branch: Boolean(r.is_main_branch),
                        plan: r.subscription_plan || 'Standard',
                        branchesCount: rBranches.length,
                        branches: rBranches.map((b) => ({
                            id: b.id,
                            name: b.name,
                            code: b.code,
                            status: b.status,
                            is_main_branch: Boolean(b.is_main_branch)
                        }))
                    };
                }),
                recentAudits: ownerLogs.slice(0, 5)
            };
        });

        // Summary metrics
        const totalOwners = formattedOwners.length;
        const pendingOwnerApprovals = formattedOwners.filter((o) => o.status === 'PENDING' || o.isPendingApproval).length;
        const activeOwners = formattedOwners.filter((o) => o.status === 'ACTIVE' && !o.isPendingApproval).length;
        const inactiveOwners = formattedOwners.filter((o) => o.status === 'INACTIVE' || o.status === 'SUSPENDED' || o.status === 'REJECTED').length;
        const totalLocations = allRestaurants.length;
        const activeLocations = allRestaurants.filter((r) => (r.status || '').toUpperCase() === 'ACTIVE').length;
        const totalBranches = allBranches.length;
        const totalQuota = formattedOwners.reduce((acc, o) => acc + (o.quota || 0), 0);
        const usedQuota = formattedOwners.reduce((acc, o) => acc + (o.usedQuota || 0), 0);
        const activeSubscriptions = formattedOwners.filter((o) => o.hasSubscription).length;

        // Pending owner registration requests queue
        const pendingOwnerRequests = formattedOwners.filter((o) => o.status === 'PENDING' || o.isPendingApproval);

        // Pending branch registration requests queue (created by owners awaiting approval)
        const pendingBranchRequests = allRegRequests
            .filter((req: any) =>
                ['PENDING_APPROVAL', 'PENDING_PAYMENT', 'PENDING'].includes((req.approval_status || '').toUpperCase()) &&
                Boolean(req.restaurant_id)
            )
            .map((req: any) => {
                const matchingOwner = formattedOwners.find((o) => o.id === req.owner_id || o.email?.toLowerCase() === req.owner_email?.toLowerCase());
                const matchingRest = allRestaurants.find((r) => r.id === req.restaurant_id);
                const matchingBranch = allBranches.find((b) => b.restaurant_id === req.restaurant_id);

                return {
                    id: req.id,
                    requestId: req.id,
                    requestNumber: req.request_number || `REQ-${req.restaurant_id?.slice(-6)}`,
                    restaurantId: req.restaurant_id,
                    restaurantName: req.restaurant_name || matchingRest?.name || 'Restaurant Branch',
                    branchId: matchingBranch?.id || null,
                    branchName: matchingBranch?.name || null,
                    ownerId: req.owner_id || matchingOwner?.id,
                    ownerName: req.owner_name || matchingOwner?.name || 'Owner',
                    ownerEmail: req.owner_email || matchingOwner?.email || '—',
                    ownerPhone: req.owner_phone || matchingOwner?.phone || '—',
                    planSlug: req.plan_slug || 'standard',
                    planName: req.plan_name || 'Standard',
                    planLimit: req.plan_limit || 1,
                    customQuota: req.custom_quota || null,
                    amountDue: req.amount_due || 999,
                    paymentMethod: req.payment_method || 'UPI',
                    paymentReference: req.payment_reference || null,
                    paymentStatus: req.payment_status || 'PENDING',
                    approvalStatus: req.approval_status || 'PENDING_APPROVAL',
                    createdAt: req.created_at,
                    createdDate: req.created_at
                };
            });

        // Enrich owners with pendingBranchesCount & pendingBranches
        formattedOwners.forEach((owner) => {
            const ownerBranches = pendingBranchRequests.filter((b) => b.ownerId === owner.id || b.ownerEmail?.toLowerCase() === owner.email?.toLowerCase());
            owner.pendingBranchesCount = ownerBranches.length;
            owner.pendingBranches = ownerBranches;
        });

        const pendingApprovals = pendingOwnerRequests.length + pendingBranchRequests.length;

        return NextResponse.json({
            success: true,
            owners: formattedOwners,
            pendingOwnerRequests,
            pendingBranchRequests,
            summary: {
                totalOwners,
                pendingApprovals,
                pendingOwnerApprovals: pendingOwnerRequests.length,
                pendingBranchApprovals: pendingBranchRequests.length,
                activeOwners,
                inactiveOwners,
                totalLocations,
                activeLocations,
                totalBranches,
                totalQuota,
                usedQuota,
                activeSubscriptions
            },
            allRestaurants: allRestaurants.map((r) => ({
                id: r.id,
                name: r.name,
                status: r.status,
                maxBranches: r.max_branches || 1
            }))
        });
    } catch (err: any) {
        console.error('Super Admin owners API error:', err);
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
        const { name, email, phone, restaurantId, maxBranches, password, status, approvalStatus } = body;

        if (!name?.trim() || !email?.trim()) {
            return NextResponse.json({ error: 'Owner name and email are required' }, { status: 400 });
        }

        if (typeof password !== 'string' || password.trim().length < 8) {
            return NextResponse.json({ error: 'A password of at least 8 characters is required' }, { status: 400 });
        }

        const cleanEmail = email.toLowerCase().trim();
        const cleanName = name.trim();
        const cleanPhone = phone ? phone.trim() : null;
        const initialMaxBranches = maxBranches !== undefined ? parseInt(String(maxBranches)) : (restaurantId ? 1 : 0);
        const initialStatus = status ? status.toLowerCase() : 'pending';
        const initialApproval = approvalStatus ? approvalStatus.toLowerCase() : (initialStatus === 'active' ? 'approved' : 'pending');
        const rawPassword = password.trim();

        // 1. Check if user already exists in employees or users as Restaurant Admin
        const { data: existingEmp } = await supabaseAdmin
            .from('employees')
            .select('id, email, role')
            .ilike('email', cleanEmail)
            .maybeSingle();

        if (existingEmp) {
            const empRole = (existingEmp.role || '').toLowerCase();
            if (['restaurant_admin', 'admin', 'branch_admin'].includes(empRole)) {
                return NextResponse.json({ 
                    error: 'This email is already registered as a Restaurant Admin and cannot be assigned as an Owner.' 
                }, { status: 409 });
            }
        }

        const { data: existingUser } = await supabaseAdmin
            .from('users')
            .select('id, email, role')
            .ilike('email', cleanEmail)
            .maybeSingle();

        if (existingUser) {
            const userRole = (existingUser.role || '').toLowerCase();
            if (['restaurant_admin', 'admin', 'branch_admin'].includes(userRole)) {
                return NextResponse.json({ 
                    error: 'This email is already registered as a Restaurant Admin and cannot be assigned as an Owner.' 
                }, { status: 409 });
            }
        }

        let userId: string;

        if (existingEmp) {
            userId = existingEmp.id;
            const updatePayload: Record<string, any> = {
                name: cleanName,
                mobile: cleanPhone,
                role: 'owner',
                status: initialStatus,
                approval_status: initialApproval,
                email_verified: true,
                max_branches: initialMaxBranches,
                updated_at: new Date().toISOString()
            };
            if (restaurantId) updatePayload.restaurant_id = restaurantId;

            await supabaseAdmin.from('employees').update(updatePayload).eq('id', userId);
        } else {
            let authId: string | null = null;
            try {
                const { data: authUser } = await supabaseAdmin.auth.admin.createUser({
                    email: cleanEmail,
                    password: rawPassword,
                    email_confirm: true,
                    user_metadata: { name: cleanName, role: 'owner' }
                });
                if (authUser?.user?.id) {
                    authId = authUser.user.id;
                }
            } catch (authErr) {
                console.warn('Auth user creation note:', authErr);
            }

            const insertPayload: Record<string, any> = {
                restaurant_id: restaurantId || null,
                name: cleanName,
                email: cleanEmail,
                mobile: cleanPhone,
                role: 'owner',
                status: initialStatus,
                approval_status: initialApproval,
                email_verified: true,
                max_branches: initialMaxBranches,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            if (authId) insertPayload.id = authId;

            const { data: newEmp, error: insertError } = await supabaseAdmin
                .from('employees')
                .insert(insertPayload)
                .select()
                .single();

            if (insertError) {
                console.error('Failed to create owner employee:', insertError);
                return NextResponse.json({ error: insertError.message }, { status: 500 });
            }
            userId = newEmp.id;
        }

        // Set password hash in auth table
        const hashedPassword = await hashPassword(rawPassword);
        await supabaseAdmin
            .from('auth')
            .upsert({
                user_id: userId,
                password_hash: hashedPassword,
                mfa_enabled: false,
                failed_attempts: 0,
                locked_until: null
            }, { onConflict: 'user_id' });

        // Also add or update dine_users
        await supabaseAdmin.from('dine_users').upsert({
            id: userId,
            name: cleanName,
            email: cleanEmail,
            phone: cleanPhone,
            role: 'owner',
            status: initialStatus,
            max_branches: initialMaxBranches,
            restaurant_id: restaurantId || null
        }, { onConflict: 'id' });

        // 2. Associate with restaurant if provided
        if (restaurantId) {
            await supabaseAdmin
                .from('restaurants')
                .update({
                    owner_id: userId,
                    owner_name: cleanName,
                    max_branches: initialMaxBranches,
                    updated_at: new Date().toISOString()
                })
                .eq('id', restaurantId);

            await supabaseAdmin
                .from('subscriptions')
                .update({
                    max_branches: initialMaxBranches,
                    updated_at: new Date().toISOString()
                })
                .eq('restaurant_id', restaurantId);

            await supabaseAdmin
                .from('restaurant_users')
                .upsert({
                    restaurant_id: restaurantId,
                    user_id: userId,
                    role: 'OWNER',
                    status: 'active',
                    updated_at: new Date().toISOString()
                }, { onConflict: 'restaurant_id,user_id' });
        }

        const inviteToken = Buffer.from(`${cleanEmail}:${Date.now()}:${userId}`).toString('base64');
        const onboardingLink = `https://dineinone.com/onboard?token=${inviteToken}`;

        await supabaseAdmin.from('audit_logs').insert({
            restaurant_id: restaurantId || null,
            user_id: auth.user.userId,
            actor_id: auth.user.userId,
            actor_role: 'SUPER_ADMIN',
            action: 'super_admin_create_owner_account',
            resource_type: 'owner',
            resource_id: userId,
            details: {
                owner_id: userId,
                email: cleanEmail,
                name: cleanName,
                associated_restaurant: restaurantId || null,
                max_branches: initialMaxBranches,
                timestamp: new Date().toISOString(),
            },
        });

        return NextResponse.json({
            success: true,
            ownerId: userId,
            onboardingLink,
            message: 'Owner account successfully provisioned with branch limits.',
        });
    } catch (err: any) {
        console.error('Super admin create owner error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const body = await request.json();
        const { ownerId, restaurantId, action, maxBranches, status, name, email, phone, requestId, reason, rejectionReason } = body;

        // 0-BRANCH: APPROVE RESTAURANT BRANCH REGISTRATION (ATOMIC)
        if (action === 'approve_branch' || action === 'approve_restaurant') {
            const reqId = requestId || body.id;
            const rId = restaurantId || body.restaurant_id;

            let regReq: any = null;
            if (reqId) {
                const { data } = await supabaseAdmin.from('restaurant_registration_requests').select('*').eq('id', reqId).maybeSingle();
                regReq = data;
            } else if (rId) {
                const { data } = await supabaseAdmin.from('restaurant_registration_requests').select('*').eq('restaurant_id', rId).maybeSingle();
                regReq = data;
            }

            const targetRestaurantId = rId || regReq?.restaurant_id;
            if (!targetRestaurantId) {
                return NextResponse.json({ error: 'Restaurant or Request ID is required' }, { status: 400 });
            }

            const chosenPlanSlug = normalizePlanSlug(body.planSlug || regReq?.plan_slug || 'standard');
            const planDef = CANONICAL_PLANS[chosenPlanSlug] || CANONICAL_PLANS.standard;
            const defaultLimit = getPlanDefaultLimit(chosenPlanSlug);
            const customQuota = body.customQuota !== undefined && body.customQuota !== null && Number(body.customQuota) > 0
                ? Number(body.customQuota)
                : (regReq?.custom_quota && Number(regReq.custom_quota) > 0 ? Number(regReq.custom_quota) : null);
            const effectiveLimit = customQuota ?? defaultLimit;
            const amountDue = Number(body.amountDue || regReq?.amount_due || planDef.priceMonthly);

            if (regReq) {
                const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('approve_restaurant_registration', {
                    p_request_id: regReq.id,
                    p_plan_slug: chosenPlanSlug,
                    p_custom_quota: customQuota,
                    p_amount_due: amountDue,
                    p_approved_by: auth.user.email || 'Super Admin'
                });

                if (rpcErr) {
                    console.error('[approve_restaurant_registration RPC error]:', rpcErr);
                    return NextResponse.json({ error: rpcErr.message }, { status: 400 });
                }
            } else {
                const nowIso = new Date().toISOString();
                await supabaseAdmin.from('restaurants').update({
                    status: 'ACTIVE',
                    subscription_plan: planDef.name,
                    custom_quota: customQuota,
                    max_branches: effectiveLimit,
                    deleted_at: null,
                    updated_at: nowIso
                }).eq('id', targetRestaurantId);

                await supabaseAdmin.from('branches').update({
                    status: 'active',
                    deleted_at: null,
                    updated_at: nowIso
                }).eq('restaurant_id', targetRestaurantId);

                await supabaseAdmin.from('employees').update({
                    status: 'active',
                    approval_status: 'approved',
                    updated_at: nowIso
                }).eq('restaurant_id', targetRestaurantId);

                await supabaseAdmin.from('subscriptions').upsert({
                    restaurant_id: targetRestaurantId,
                    plan_name: chosenPlanSlug,
                    plan_type: 'monthly',
                    status: 'active',
                    amount: amountDue,
                    currency: 'INR',
                    max_branches: effectiveLimit,
                    features: planDef.features || [],
                    current_period_start: nowIso,
                    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    updated_at: nowIso
                }, { onConflict: 'restaurant_id' });
            }

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: targetRestaurantId,
                user_id: auth.user.userId,
                actor_id: auth.user.userId,
                actor_role: 'SUPER_ADMIN',
                action: 'super_admin_approve_branch',
                resource_type: 'restaurant',
                resource_id: targetRestaurantId,
                details: {
                    restaurant_name: regReq?.restaurant_name,
                    plan: planDef.name,
                    quota: effectiveLimit,
                    approved_by: auth.user.email,
                    timestamp: new Date().toISOString()
                }
            });

            return NextResponse.json({
                success: true,
                message: `Branch "${regReq?.restaurant_name || targetRestaurantId}" approved and activated successfully!`
            });
        }

        // 0-BRANCH-REJECT: REJECT RESTAURANT BRANCH REGISTRATION
        if (action === 'reject_branch' || action === 'reject_restaurant') {
            const reqId = requestId || body.id;
            const rId = restaurantId || body.restaurant_id;

            let regReq: any = null;
            if (reqId) {
                const { data } = await supabaseAdmin.from('restaurant_registration_requests').select('*').eq('id', reqId).maybeSingle();
                regReq = data;
            } else if (rId) {
                const { data } = await supabaseAdmin.from('restaurant_registration_requests').select('*').eq('restaurant_id', rId).maybeSingle();
                regReq = data;
            }

            const targetRestaurantId = rId || regReq?.restaurant_id;
            const rejectMsg = rejectionReason || reason || 'Registration rejected by Super Admin';

            if (regReq) {
                const { error: rpcErr } = await supabaseAdmin.rpc('reject_restaurant_registration', {
                    p_request_id: regReq.id,
                    p_rejected_by: auth.user.email || 'Super Admin',
                    p_reason: rejectMsg
                });
                if (rpcErr) {
                    return NextResponse.json({ error: rpcErr.message }, { status: 400 });
                }
            } else if (targetRestaurantId) {
                const nowIso = new Date().toISOString();
                await supabaseAdmin.from('restaurants').update({ status: 'REJECTED', updated_at: nowIso }).eq('id', targetRestaurantId);
                await supabaseAdmin.from('branches').update({ status: 'inactive', updated_at: nowIso }).eq('restaurant_id', targetRestaurantId);
                await supabaseAdmin.from('employees').update({ status: 'inactive', approval_status: 'rejected', updated_at: nowIso }).eq('restaurant_id', targetRestaurantId);
            }

            return NextResponse.json({
                success: true,
                message: `Branch "${regReq?.restaurant_name || targetRestaurantId}" rejected.`
            });
        }

        // 0. APPROVE OWNER REGISTRATION / ACCOUNT ACTION
        if (action === 'approve_owner' || action === 'approve_registration') {
            const targetId = ownerId || requestId;
            if (!targetId && !email) {
                return NextResponse.json({ error: 'ownerId, requestId, or email is required' }, { status: 400 });
            }

            // Initialize quota as 0/0 with no subscription assigned unless explicitly provided by Super Admin
            const limitNum = (typeof maxBranches === 'number' && maxBranches > 0) ? maxBranches : 0;

            // Find target owner from employees, dine_users, or restaurant_registration_requests
            let employeeId = ownerId;
            let userEmail = email ? email.toLowerCase().trim() : null;

            if (!employeeId && requestId) {
                const { data: reqData } = await supabaseAdmin
                    .from('restaurant_registration_requests')
                    .select('owner_id, owner_email')
                    .eq('id', requestId)
                    .maybeSingle();
                employeeId = reqData?.owner_id;
                if (!userEmail) userEmail = reqData?.owner_email?.toLowerCase().trim();
            }

            if (!employeeId && userEmail) {
                const { data: empData } = await supabaseAdmin
                    .from('employees')
                    .select('id')
                    .ilike('email', userEmail)
                    .maybeSingle();
                employeeId = empData?.id;
            }

            const isUuid = (val: any): boolean => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
            const approvedByUuid = isUuid(auth.user?.userId) ? auth.user.userId : null;

            // Update employees: Initialize quota as 0/0 with no subscription assigned
            if (employeeId) {
                const { error: empUpErr } = await supabaseAdmin
                    .from('employees')
                    .update({
                        status: 'active',
                        approval_status: 'approved',
                        role: 'owner',
                        max_branches: limitNum,
                        custom_quota: limitNum > 0 ? limitNum : null,
                        approved_at: new Date().toISOString(),
                        approved_by: approvedByUuid,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', employeeId);
                if (empUpErr) console.error('Failed to update employee by id:', empUpErr);
            } else if (userEmail) {
                const { error: empUpErr } = await supabaseAdmin
                    .from('employees')
                    .update({
                        status: 'active',
                        approval_status: 'approved',
                        role: 'owner',
                        max_branches: limitNum,
                        custom_quota: limitNum > 0 ? limitNum : null,
                        approved_at: new Date().toISOString(),
                        approved_by: approvedByUuid,
                        updated_at: new Date().toISOString()
                    })
                    .ilike('email', userEmail);
                if (empUpErr) console.error('Failed to update employee by email:', empUpErr);
            }

            // Fetch updated employee for name & email
            const { data: updatedEmp } = await supabaseAdmin
                .from('employees')
                .select('*')
                .or(`id.eq.${employeeId || '00000000-0000-0000-0000-000000000000'}${userEmail ? `,email.ilike.${userEmail}` : ''}`)
                .maybeSingle();

            const effectiveId = updatedEmp?.id || employeeId;
            const effectiveEmail = updatedEmp?.email || userEmail;
            const effectiveName = updatedEmp?.name || 'Owner';

            if (effectiveId) {
                // Upsert dine_users
                await supabaseAdmin.from('dine_users').upsert({
                    id: effectiveId,
                    name: effectiveName,
                    email: effectiveEmail,
                    phone: updatedEmp?.mobile || null,
                    role: 'owner',
                    status: 'active',
                    max_branches: limitNum
                }, { onConflict: 'id' });
            }

            // Owner account approval: DO NOT create or activate restaurants automatically.
            // Owner and Restaurant creation are completely separate operations.
            if (requestId) {
                // If this was an owner registration placeholder request without a real restaurant, mark or clean it
                await supabaseAdmin
                    .from('restaurant_registration_requests')
                    .delete()
                    .eq('id', requestId)
                    .is('restaurant_id', null);
            }

            // IMPORTANT: DO NOT create a subscription in subscriptions table!
            // Preserving requirement: "Do not create a subscription for an account merely because it registered."

            // Audit log
            await supabaseAdmin.from('audit_logs').insert({
                user_id: auth.user.userId,
                actor_id: auth.user.userId,
                actor_role: 'SUPER_ADMIN',
                action: 'super_admin_approved_owner_account',
                resource_type: 'owner',
                resource_id: effectiveId,
                details: {
                    owner_id: effectiveId,
                    owner_name: effectiveName,
                    owner_email: effectiveEmail,
                    max_branches: limitNum,
                    approved_by: auth.user.email,
                    timestamp: new Date().toISOString()
                }
            });

            return NextResponse.json({
                success: true,
                message: `Owner account for ${effectiveName} has been approved and activated! The owner can now log in and set up their restaurants.`,
                ownerId: effectiveId
            });
        }

        // 0b. REJECT OWNER REGISTRATION / ACCOUNT ACTION
        if (action === 'reject_owner' || action === 'reject_registration') {
            const targetId = ownerId || requestId;
            if (!targetId && !email) {
                return NextResponse.json({ error: 'ownerId, requestId, or email is required' }, { status: 400 });
            }

            const rejectReason = reason || rejectionReason || 'Account registration rejected by Super Admin';

            let employeeId = ownerId;
            let userEmail = email ? email.toLowerCase().trim() : null;

            if (!employeeId && requestId) {
                const { data: reqData } = await supabaseAdmin
                    .from('restaurant_registration_requests')
                    .select('owner_id, owner_email')
                    .eq('id', requestId)
                    .maybeSingle();
                employeeId = reqData?.owner_id;
                if (!userEmail) userEmail = reqData?.owner_email?.toLowerCase().trim();
            }

            if (employeeId) {
                await supabaseAdmin
                    .from('employees')
                    .update({
                        status: 'rejected',
                        approval_status: 'rejected',
                        rejection_reason: rejectReason,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', employeeId);

                await supabaseAdmin
                    .from('dine_users')
                    .update({ status: 'rejected' })
                    .eq('id', employeeId);
            } else if (userEmail) {
                await supabaseAdmin
                    .from('employees')
                    .update({
                        status: 'rejected',
                        approval_status: 'rejected',
                        rejection_reason: rejectReason,
                        updated_at: new Date().toISOString()
                    })
                    .ilike('email', userEmail);
            }

            if (requestId) {
                await supabaseAdmin
                    .from('restaurant_registration_requests')
                    .update({
                        approval_status: 'REJECTED',
                        rejection_reason: rejectReason,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', requestId);
            }

            if (employeeId || userEmail) {
                const filterCond = employeeId && userEmail
                    ? `owner_id.eq.${employeeId},owner_email.ilike.${userEmail}`
                    : employeeId ? `owner_id.eq.${employeeId}` : `owner_email.ilike.${userEmail}`;

                await supabaseAdmin
                    .from('restaurant_registration_requests')
                    .update({
                        approval_status: 'REJECTED',
                        rejection_reason: rejectReason,
                        updated_at: new Date().toISOString()
                    })
                    .or(filterCond);
            }

            await supabaseAdmin.from('audit_logs').insert({
                user_id: auth.user.userId,
                actor_id: auth.user.userId,
                actor_role: 'SUPER_ADMIN',
                action: 'super_admin_rejected_owner_account',
                resource_type: 'owner',
                resource_id: employeeId,
                details: {
                    owner_id: employeeId,
                    owner_email: userEmail,
                    reason: rejectReason,
                    rejected_by: auth.user.email,
                    timestamp: new Date().toISOString()
                }
            });

            return NextResponse.json({
                success: true,
                message: 'Owner registration has been rejected.',
                ownerId: employeeId
            });
        }

        // 1. UPDATE OWNER BRANCH QUOTA ACTION
        if (action === 'update_quota' || action === 'update_branch_limit') {
            if ((!ownerId && !restaurantId) || maxBranches === undefined) {
                return NextResponse.json({ error: 'ownerId and maxBranches are required' }, { status: 400 });
            }

            const limitNum = Math.max(1, parseInt(String(maxBranches)));

            let targetOwnerId = ownerId;
            if (!targetOwnerId && restaurantId) {
                const { data: rRec } = await supabaseAdmin
                    .from('restaurants')
                    .select('owner_id')
                    .eq('id', restaurantId)
                    .maybeSingle();
                targetOwnerId = rRec?.owner_id;
            }

            if (targetOwnerId) {
                // Update employees
                await supabaseAdmin
                    .from('employees')
                    .update({ max_branches: limitNum, custom_quota: limitNum, updated_at: new Date().toISOString() })
                    .eq('id', targetOwnerId);

                // Update dine_users
                await supabaseAdmin
                    .from('dine_users')
                    .update({ max_branches: limitNum })
                    .eq('id', targetOwnerId);

                // Update ALL restaurants belonging to this owner
                await supabaseAdmin
                    .from('restaurants')
                    .update({ max_branches: limitNum, custom_quota: limitNum, updated_at: new Date().toISOString() })
                    .eq('owner_id', targetOwnerId);

                // Update subscriptions
                const { data: ownerRests } = await supabaseAdmin
                    .from('restaurants')
                    .select('id')
                    .eq('owner_id', targetOwnerId);

                const restIds = (ownerRests || []).map((r) => r.id);
                if (restIds.length > 0) {
                    await supabaseAdmin
                        .from('subscriptions')
                        .update({ max_branches: limitNum, updated_at: new Date().toISOString() })
                        .in('restaurant_id', restIds);
                }
            } else if (restaurantId) {
                await supabaseAdmin
                    .from('restaurants')
                    .update({ max_branches: limitNum, updated_at: new Date().toISOString() })
                    .eq('id', restaurantId);
            }

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: restaurantId || null,
                user_id: auth.user.userId,
                actor_id: auth.user.userId,
                actor_role: 'SUPER_ADMIN',
                action: 'super_admin_update_owner_branch_quota',
                resource_type: 'owner',
                resource_id: targetOwnerId || restaurantId,
                details: {
                    new_limit: limitNum,
                    owner_id: targetOwnerId,
                    updated_by: auth.user.email,
                    timestamp: new Date().toISOString()
                }
            });

            return NextResponse.json({
                success: true,
                message: `Owner branch quota updated to ${limitNum} locations.`,
                newLimit: limitNum,
                ownerId: targetOwnerId
            });
        }

        // 2. TOGGLE OWNER ACTIVE / INACTIVE / SUSPENDED STATUS
        if (action === 'toggle_status' || action === 'update_status') {
            if (!ownerId || !status) {
                return NextResponse.json({ error: 'ownerId and status are required' }, { status: 400 });
            }

            const cleanStatus = status.toLowerCase();

            await supabaseAdmin
                .from('employees')
                .update({
                    status: cleanStatus === 'active' ? 'active' : cleanStatus === 'suspended' ? 'suspended' : 'inactive',
                    approval_status: cleanStatus === 'active' ? 'approved' : cleanStatus === 'suspended' ? 'suspended' : 'inactive',
                    deactivated_at: cleanStatus !== 'active' ? new Date().toISOString() : null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', ownerId);

            await supabaseAdmin
                .from('dine_users')
                .update({ status: cleanStatus === 'active' ? 'active' : cleanStatus === 'suspended' ? 'suspended' : 'inactive' })
                .eq('id', ownerId);

            await supabaseAdmin
                .from('restaurant_users')
                .update({
                    status: cleanStatus === 'active' ? 'active' : cleanStatus === 'suspended' ? 'suspended' : 'inactive',
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', ownerId);

            await supabaseAdmin.from('audit_logs').insert({
                user_id: auth.user.userId,
                actor_id: auth.user.userId,
                actor_role: 'SUPER_ADMIN',
                action: `super_admin_${cleanStatus}_owner`,
                resource_type: 'owner',
                resource_id: ownerId,
                details: {
                    owner_id: ownerId,
                    new_status: cleanStatus,
                    timestamp: new Date().toISOString()
                }
            });

            return NextResponse.json({
                success: true,
                message: `Owner account has been set to ${cleanStatus.toUpperCase()}.`
            });
        }

        // 3. UPDATE OWNER PROFILE
        if (action === 'update_profile') {
            if (!ownerId) return NextResponse.json({ error: 'ownerId is required' }, { status: 400 });

            const updates: Record<string, any> = { updated_at: new Date().toISOString() };
            if (name?.trim()) updates.name = name.trim();
            if (email?.trim()) updates.email = email.toLowerCase().trim();
            if (phone?.trim()) updates.mobile = phone.trim();

            await supabaseAdmin.from('employees').update(updates).eq('id', ownerId);

            const duUpdates: Record<string, any> = {};
            if (name?.trim()) duUpdates.name = name.trim();
            if (email?.trim()) duUpdates.email = email.toLowerCase().trim();
            if (phone?.trim()) duUpdates.phone = phone.trim();
            await supabaseAdmin.from('dine_users').update(duUpdates).eq('id', ownerId);

            // Update owner name on their restaurants
            if (name?.trim()) {
                await supabaseAdmin.from('restaurants').update({ owner_name: name.trim() }).eq('owner_id', ownerId);
            }

            await supabaseAdmin.from('audit_logs').insert({
                user_id: auth.user.userId,
                actor_id: auth.user.userId,
                actor_role: 'SUPER_ADMIN',
                action: 'super_admin_update_owner_profile',
                resource_type: 'owner',
                resource_id: ownerId,
                details: { updates, timestamp: new Date().toISOString() }
            });

            return NextResponse.json({ success: true, message: 'Owner profile updated successfully.' });
        }

        // 4. ASSIGN RESTAURANT
        if (action === 'assign') {
            if (!ownerId || !restaurantId) {
                return NextResponse.json({ error: 'ownerId and restaurantId are required' }, { status: 400 });
            }

            const { data: owner } = await supabaseAdmin.from('dine_users').select('name').eq('id', ownerId).maybeSingle();
            const ownerName = owner?.name || 'Owner';

            await supabaseAdmin
                .from('restaurants')
                .update({ owner_id: ownerId, owner_name: ownerName, updated_at: new Date().toISOString() })
                .eq('id', restaurantId);

            await supabaseAdmin
                .from('restaurant_users')
                .upsert({
                    restaurant_id: restaurantId,
                    user_id: ownerId,
                    role: 'OWNER',
                    status: 'active',
                    updated_at: new Date().toISOString()
                }, { onConflict: 'restaurant_id,user_id' });

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: restaurantId,
                user_id: auth.user.userId,
                actor_id: auth.user.userId,
                actor_role: 'SUPER_ADMIN',
                action: 'super_admin_assign_restaurant_to_owner',
                details: { ownerId, restaurantId, timestamp: new Date().toISOString() }
            });

            return NextResponse.json({ success: true, message: 'Restaurant assigned successfully.' });
        }

        // 5. UNASSIGN RESTAURANT
        if (action === 'unassign') {
            if (!ownerId || !restaurantId) {
                return NextResponse.json({ error: 'ownerId and restaurantId are required' }, { status: 400 });
            }

            await supabaseAdmin
                .from('restaurants')
                .update({ owner_id: null, updated_at: new Date().toISOString() })
                .match({ id: restaurantId, owner_id: ownerId });

            await supabaseAdmin
                .from('restaurant_users')
                .update({ status: 'inactive', updated_at: new Date().toISOString() })
                .match({ restaurant_id: restaurantId, user_id: ownerId });

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: restaurantId,
                user_id: auth.user.userId,
                actor_id: auth.user.userId,
                actor_role: 'SUPER_ADMIN',
                action: 'super_admin_unassign_restaurant_from_owner',
                details: { ownerId, restaurantId, timestamp: new Date().toISOString() }
            });

            return NextResponse.json({ success: true, message: 'Restaurant unassigned successfully.' });
        }

        return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });
    } catch (err: any) {
        console.error('Super Admin patch owner error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const url = new URL(request.url);
        let ownerId = url.searchParams.get('id') || url.searchParams.get('ownerId');
        let requestEmail = url.searchParams.get('email');
        let requestId = url.searchParams.get('requestId');

        if (!ownerId) {
            try {
                const body = await request.json();
                ownerId = body.ownerId || body.id;
                if (!requestEmail) requestEmail = body.email;
                if (!requestId) requestId = body.requestId;
            } catch (_) {}
        }

        if (!ownerId && !requestEmail && !requestId) {
            return NextResponse.json({ error: 'Owner ID or email is required for deletion' }, { status: 400 });
        }

        // 1. Resolve owner details across employees, registration requests, restaurants, and auth
        let targetOwnerId = ownerId;
        let targetEmail = requestEmail ? requestEmail.toLowerCase().trim() : null;
        let targetName = 'Owner';

        // Check employees
        if (targetOwnerId) {
            const { data: emp } = await supabaseAdmin
                .from('employees')
                .select('id, name, email, role')
                .eq('id', targetOwnerId)
                .maybeSingle();
            if (emp) {
                targetName = emp.name || targetName;
                if (!targetEmail) targetEmail = emp.email?.toLowerCase().trim() || null;
            }
        } else if (targetEmail) {
            const { data: emp } = await supabaseAdmin
                .from('employees')
                .select('id, name, email, role')
                .ilike('email', targetEmail)
                .maybeSingle();
            if (emp) {
                targetOwnerId = emp.id;
                targetName = emp.name || targetName;
            }
        }

        // Check registration requests
        if (requestId || targetOwnerId || targetEmail) {
            let reqQuery = supabaseAdmin.from('restaurant_registration_requests').select('id, owner_id, owner_name, owner_email');
            if (requestId) {
                reqQuery = reqQuery.eq('id', requestId);
            } else if (targetOwnerId && targetEmail) {
                reqQuery = reqQuery.or(`owner_id.eq.${targetOwnerId},owner_email.eq.${targetEmail}`);
            } else if (targetOwnerId) {
                reqQuery = reqQuery.eq('owner_id', targetOwnerId);
            } else if (targetEmail) {
                reqQuery = reqQuery.ilike('owner_email', targetEmail);
            }
            const { data: regReqs } = await reqQuery;
            if (regReqs && regReqs.length > 0) {
                const primaryReq = regReqs[0];
                if (!targetOwnerId && primaryReq.owner_id) targetOwnerId = primaryReq.owner_id;
                if (targetName === 'Owner' && primaryReq.owner_name) targetName = primaryReq.owner_name;
                if (!targetEmail && primaryReq.owner_email) targetEmail = primaryReq.owner_email.toLowerCase().trim();
            }
        }

        // Check restaurants if owner has restaurants
        if (targetOwnerId) {
            const { data: rests } = await supabaseAdmin
                .from('restaurants')
                .select('id, name, owner_name')
                .eq('owner_id', targetOwnerId);
            if (rests && rests.length > 0 && targetName === 'Owner') {
                targetName = rests[0].owner_name || rests[0].name || targetName;
            }
        }

        // 2. Clear foreign key references on service_requests to prevent foreign key errors
        if (targetOwnerId) {
            await Promise.all([
                supabaseAdmin.from('service_requests').update({ accepted_by: null }).eq('accepted_by', targetOwnerId),
                supabaseAdmin.from('service_requests').update({ assigned_waiter_id: null }).eq('assigned_waiter_id', targetOwnerId)
            ]);
        }

        // 3. Delete from restaurant_registration_requests
        if (targetOwnerId || targetEmail || requestId) {
            if (requestId) {
                await supabaseAdmin.from('restaurant_registration_requests').delete().eq('id', requestId);
            }
            if (targetOwnerId) {
                await supabaseAdmin.from('restaurant_registration_requests').delete().eq('owner_id', targetOwnerId);
            }
            if (targetEmail) {
                await supabaseAdmin.from('restaurant_registration_requests').delete().ilike('owner_email', targetEmail);
            }
        }

        // 4. Unlink or deactivate restaurants
        if (targetOwnerId) {
            await supabaseAdmin
                .from('restaurants')
                .update({ owner_id: null, owner_name: null, updated_at: new Date().toISOString() })
                .eq('owner_id', targetOwnerId);

            // Remove restaurant_users linkage
            await supabaseAdmin.from('restaurant_users').delete().eq('user_id', targetOwnerId);

            // Delete sessions and branch access
            await supabaseAdmin.from('dine_sessions').delete().eq('user_id', targetOwnerId);
            await supabaseAdmin.from('employee_branch_access').delete().eq('employee_id', targetOwnerId);

            // Delete from auth table
            await supabaseAdmin.from('auth').delete().eq('user_id', targetOwnerId);

            // Delete from employees table
            await supabaseAdmin.from('employees').delete().eq('id', targetOwnerId);
        }

        if (targetEmail) {
            // Also clean up any employee records by email if role is owner or status pending
            await supabaseAdmin
                .from('employees')
                .delete()
                .ilike('email', targetEmail)
                .in('role', ['owner', 'restaurant_owner']);
            await supabaseAdmin
                .from('auth')
                .delete()
                .ilike('email', targetEmail);
        }

        // Try Supabase Auth user delete
        if (targetOwnerId) {
            try {
                await supabaseAdmin.auth.admin.deleteUser(targetOwnerId);
            } catch (_) {}
        }

        // Audit log
        await supabaseAdmin.from('audit_logs').insert({
            user_id: auth.user.userId,
            actor_id: auth.user.userId,
            actor_role: 'SUPER_ADMIN',
            action: 'super_admin_delete_owner',
            resource_type: 'owner',
            resource_id: targetOwnerId || requestId || 'unknown',
            details: {
                owner_id: targetOwnerId,
                name: targetName,
                email: targetEmail,
                deleted_by: auth.user.userId,
                timestamp: new Date().toISOString()
            }
        });

        return NextResponse.json({
            success: true,
            message: `Owner account "${targetName}" (${targetEmail || targetOwnerId}) has been successfully deleted.`
        });
    } catch (err: any) {
        console.error('Super Admin delete owner error:', err);
        return NextResponse.json({ error: err.message || 'Failed to delete owner account' }, { status: 500 });
    }
}
