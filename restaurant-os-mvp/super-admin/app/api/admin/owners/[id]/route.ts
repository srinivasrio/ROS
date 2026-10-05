import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySuperAdmin } from '@/lib/superadmin-guard';
import { formatAuditAction, formatAuditDetails, extractAuditBadges } from '@/lib/audit-formatters';
import { getPlanDefaultLimit } from '@/lib/entitlements';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const { id: ownerId } = await params;

        // 1. Fetch owner record from dine_users, employees, and restaurants
        const [dineUserRes, empRes, restRes, ruRes, allEmpRes, subsRes, invoicesRes, paymentsRes, ordersRes, auditRes, securityRes, sessionsRes, branchesRes, tablesRes, menuRes, catRes, servicesRes, regReqRes] = await Promise.all([
            supabaseAdmin.from('dine_users').select('*').eq('id', ownerId).maybeSingle(),
            supabaseAdmin.from('employees').select('*').eq('id', ownerId).maybeSingle(),
            supabaseAdmin.from('restaurants').select('*').eq('owner_id', ownerId).is('deleted_at', null).order('created_at', { ascending: true }),
            supabaseAdmin.from('restaurant_users').select('*').eq('user_id', ownerId).eq('role', 'OWNER'),
            supabaseAdmin.from('employees').select('*').is('deleted_at', null),
            supabaseAdmin.from('subscriptions').select('*'),
            supabaseAdmin.from('invoices').select('*').order('created_at', { ascending: false }),
            supabaseAdmin.from('payments').select('*').order('created_at', { ascending: false }),
            supabaseAdmin.from('orders').select('id, restaurant_id, total_amount, status, created_at').order('created_at', { ascending: false }),
            supabaseAdmin.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200),
            supabaseAdmin.from('security_events').select('*').order('created_at', { ascending: false }).limit(100),
            supabaseAdmin.from('dine_sessions').select('*').order('created_at', { ascending: false }),
            supabaseAdmin.from('branches').select('*').is('deleted_at', null),
            supabaseAdmin.from('tables').select('id, restaurant_id, table_number, status, capacity'),
            supabaseAdmin.from('menu_items').select('id, restaurant_id, is_available'),
            supabaseAdmin.from('categories').select('id, restaurant_id, is_active'),
            supabaseAdmin.from('service_options').select('id, restaurant_id, is_active'),
            supabaseAdmin.from('restaurant_registration_requests').select('*').order('created_at', { ascending: false })
        ]);

        const du = dineUserRes.data;
        const emp = empRes.data;
        const directlyOwnedRests = restRes.data || [];
        const ruEntries = ruRes.data || [];
        const allRegRequests = regReqRes.data || [];
        const ownerRegRequests = allRegRequests.filter((r) => r.owner_id === ownerId || r.id === ownerId || directlyOwnedRests.some((dr) => dr.id === r.restaurant_id));
        const regReq = ownerRegRequests[0] || null;

        // Check if there are other restaurants linked via restaurant_users
        const ruRestIds = ruEntries.map((ru) => ru.restaurant_id).filter((rid) => !directlyOwnedRests.some((r) => r.id === rid));
        let additionalRests: any[] = [];
        if (ruRestIds.length > 0) {
            const { data: moreRests } = await supabaseAdmin.from('restaurants').select('*').in('id', ruRestIds).is('deleted_at', null);
            additionalRests = moreRests || [];
        }

        const allOwnedRestaurants = [...directlyOwnedRests, ...additionalRests];
        const ownedRestIds = allOwnedRestaurants.map((r) => r.id);

        if (!du && !emp && allOwnedRestaurants.length === 0) {
            return NextResponse.json({ error: 'Owner not found' }, { status: 404 });
        }

        // Owner Profile Details
        const name = du?.name || emp?.name || allOwnedRestaurants[0]?.owner_name || 'Restaurant Owner';
        const email = du?.email || emp?.email || allOwnedRestaurants[0]?.email || '—';
        const phone = du?.phone || emp?.mobile || allOwnedRestaurants[0]?.phone || '—';
        const rawStatus = du?.status || emp?.status || allOwnedRestaurants[0]?.status || 'ACTIVE';
        const status = rawStatus.toUpperCase();

        // Filter data for this owner's locations
        const allEmployees = allEmpRes.data || [];
        const allBranches = branchesRes.data || [];
        const allTables = tablesRes.data || [];
        const allMenuItems = menuRes.data || [];
        const allCategories = catRes.data || [];
        const allServices = servicesRes.data || [];
        const allOrders = (ordersRes.data || []).filter((o) => ownedRestIds.includes(o.restaurant_id));
        const allInvoices = (invoicesRes.data || []).filter((i) => ownedRestIds.includes(i.restaurant_id));
        const allPayments = (paymentsRes.data || []).filter((p) => ownedRestIds.includes(p.restaurant_id));
        const allSubs = (subsRes.data || []).filter((s) => ownedRestIds.includes(s.restaurant_id));
        const activeSubs = allSubs.filter((s) => s.status === 'active' || s.status === 'trialing');
        const primarySub = activeSubs[0];
        const hasActiveSub = !!primarySub;
        const allSessions = (sessionsRes.data || []).filter((s) => s.user_id === ownerId || allEmployees.some((e) => ownedRestIds.includes(e.restaurant_id) && e.id === s.user_id));

        // Owner Quota: Strictly derived from active subscription, never default/hardcoded.
        // Quota derivation: Only ACTIVE restaurants count against quota
        const activeOwnedRestaurants = allOwnedRestaurants.filter(r => (r.status || '').toLowerCase() === 'active');
        let quota = 0;
        let usedQuota = activeOwnedRestaurants.length;
        let remainingQuota = 0;
        let quotaStatus = 'no_subscription';

        const customQuota = (typeof emp?.custom_quota === 'number' && emp.custom_quota > 0)
            ? emp.custom_quota
            : null;

        if (customQuota !== null) {
            quota = customQuota;
            remainingQuota = Math.max(0, quota - usedQuota);
            quotaStatus = usedQuota >= quota ? 'limit_reached' : remainingQuota === 1 ? 'near_limit' : 'available';
        } else if (hasActiveSub) {
            const planLimit = getPlanDefaultLimit(primarySub.plan_name);
            const subLimit = primarySub.max_branches || planLimit;
            quota = subLimit;
            remainingQuota = Math.max(0, quota - usedQuota);
            quotaStatus = usedQuota >= quota ? 'limit_reached' : remainingQuota === 1 ? 'near_limit' : 'available';
        }

        // Format Locations
        const formattedLocations = allOwnedRestaurants.map((r) => {
            const locEmployees = allEmployees.filter((e) => e.restaurant_id === r.id);
            const locAdmin = locEmployees.find((e) => ['restaurant_admin', 'admin', 'manager'].includes((e.role || '').toLowerCase())) || null;
            const locStaff = locEmployees.filter((e) => !['restaurant_admin', 'admin', 'owner', 'restaurant_owner'].includes((e.role || '').toLowerCase()));
            const locOrders = allOrders.filter((o) => o.restaurant_id === r.id);
            const locRevenue = Math.round(locOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) * 100) / 100;
            const locPrimaryBranch = allBranches.find((b) => b.restaurant_id === r.id && b.is_main_branch) ||
                                     allBranches.find((b) => b.restaurant_id === r.id) || null;
            const locTables = allTables.filter((t) => t.restaurant_id === r.id);
            const locMenuItems = allMenuItems.filter((m) => m.restaurant_id === r.id);
            const locCategories = allCategories.filter((c) => c.restaurant_id === r.id);
            const locServices = allServices.filter((s) => s.restaurant_id === r.id);
            const locSub = allSubs.find((s) => s.restaurant_id === r.id) || null;
            const locRegReq = allRegRequests.find((req) => req.restaurant_id === r.id) || null;
            const rawStatus = (r.status || 'ACTIVE').toUpperCase();
            const isPendingApproval = rawStatus === 'PENDING_APPROVAL' ||
                                      rawStatus === 'PENDING' ||
                                      locRegReq?.approval_status === 'PENDING_APPROVAL' ||
                                      locRegReq?.approval_status === 'PENDING_PAYMENT';

            return {
                id: r.id,
                name: r.name,
                phone: r.phone || locPrimaryBranch?.phone || '—',
                email: r.email || locPrimaryBranch?.email || '—',
                address: r.address || locPrimaryBranch?.address || '—',
                status: isPendingApproval ? 'PENDING_APPROVAL' : rawStatus,
                isPendingApproval,
                registrationRequest: locRegReq ? {
                    id: locRegReq.id,
                    requestNumber: locRegReq.request_number || `REQ-${r.id.slice(-6)}`,
                    approvalStatus: locRegReq.approval_status,
                    paymentStatus: locRegReq.payment_status || 'PENDING',
                    paymentReference: locRegReq.payment_reference || null,
                    paymentMethod: locRegReq.payment_method || 'UPI',
                    amountDue: locRegReq.amount_due || 999,
                    planSlug: locRegReq.plan_slug || 'standard',
                    planName: locRegReq.plan_name || 'Standard',
                    createdAt: locRegReq.created_at
                } : null,
                is_main_branch: Boolean(r.is_main_branch),
                subscriptionPlan: locRegReq?.plan_name || locSub?.plan_name || r.subscription_plan || 'Growth',
                subscriptionStatus: locSub?.status || 'active',
                createdAt: r.created_at,
                updatedAt: r.updated_at,
                deletedAt: r.deleted_at,
                admin: locAdmin ? {
                    id: locAdmin.id,
                    name: locAdmin.name,
                    email: locAdmin.email,
                    mobile: locAdmin.mobile,
                    status: (locAdmin.status || 'ACTIVE').toUpperCase(),
                    role: locAdmin.role,
                    hasPin: Boolean(locAdmin.pin),
                    is_online: Boolean(locAdmin.is_online)
                } : null,
                employeeCount: locEmployees.length,
                staffCount: locStaff.length,
                orderCount: locOrders.length,
                revenue: locRevenue,
                tablesCount: locTables.length,
                menuItemsCount: locMenuItems.length,
                categoriesCount: locCategories.length,
                servicesCount: locServices.length,
                branchesCount: allBranches.filter((b) => b.restaurant_id === r.id).length,
                branches: allBranches.filter((b) => b.restaurant_id === r.id).map((b) => ({
                    id: b.id,
                    name: b.name,
                    code: b.code || b.id,
                    phone: b.phone,
                    address: b.address,
                    status: (b.status || 'ACTIVE').toUpperCase(),
                    is_main_branch: Boolean(b.is_main_branch)
                })),
                primaryBranch: locPrimaryBranch ? {
                    id: locPrimaryBranch.id,
                    name: locPrimaryBranch.name,
                    code: locPrimaryBranch.code || locPrimaryBranch.id,
                    phone: locPrimaryBranch.phone,
                    address: locPrimaryBranch.address,
                    status: locPrimaryBranch.status
                } : null
            };
        });

        // Format Users Grouped by Location
        const usersByLocation = allOwnedRestaurants.map((r) => {
            const locEmployees = allEmployees.filter((e) => e.restaurant_id === r.id);
            const admin = locEmployees.find((e) => ['restaurant_admin', 'admin', 'manager'].includes((e.role || '').toLowerCase())) || null;
            const staff = locEmployees.filter((e) => !['restaurant_admin', 'admin', 'owner', 'restaurant_owner'].includes((e.role || '').toLowerCase()));

            return {
                locationId: r.id,
                locationName: r.name,
                admin: admin ? {
                    id: admin.id,
                    name: admin.name,
                    email: admin.email,
                    mobile: admin.mobile,
                    role: admin.role,
                    status: (admin.status || 'active').toUpperCase(),
                    hasPin: Boolean(admin.pin),
                    is_online: Boolean(admin.is_online),
                    createdAt: admin.created_at
                } : null,
                employees: staff.map((e) => ({
                    id: e.id,
                    employee_id: e.employee_id || e.id.slice(0, 8),
                    name: e.name,
                    email: e.email || '—',
                    mobile: e.mobile || '—',
                    role: e.role,
                    status: (e.status || 'active').toUpperCase(),
                    hasPin: Boolean(e.pin),
                    is_online: Boolean(e.is_online),
                    createdAt: e.created_at
                }))
            };
        });

        // Overview Consolidated Data
        const totalLocations = allOwnedRestaurants.length;
        const activeLocations = allOwnedRestaurants.filter((r) => (r.status || '').toUpperCase() === 'ACTIVE').length;
        const suspendedLocations = allOwnedRestaurants.filter((r) => (r.status || '').toUpperCase() === 'SUSPENDED').length;
        const pendingApprovals = formattedLocations.filter((l) => l.isPendingApproval).length;
        const totalAdmins = allEmployees.filter((e) => ownedRestIds.includes(e.restaurant_id) && ['restaurant_admin', 'admin', 'manager'].includes((e.role || '').toLowerCase())).length;
        const totalEmployees = allEmployees.filter((e) => ownedRestIds.includes(e.restaurant_id)).length;
        const totalOrders = allOrders.length;
        const totalRevenue = Math.round(allOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) * 100) / 100;
        const subscriptionStatus = primarySub ? {
            planName: primarySub.plan_name ? (primarySub.plan_name.charAt(0).toUpperCase() + primarySub.plan_name.slice(1)) : 'Active Subscription',
            status: primarySub.status || 'active',
            periodEnd: primarySub.current_period_end || primarySub.trial_ends_at || null,
            amount: primarySub.amount || 0,
            currency: primarySub.currency || 'INR'
        } : {
            planName: 'No Active Subscription',
            status: 'no_subscription',
            periodEnd: null,
            amount: 0,
            currency: 'INR'
        };

        // Activity Logs
        const rawOwnerLogs = (auditRes.data || []).filter(
            (a) => a.user_id === ownerId || a.actor_id === ownerId || a.resource_id === ownerId || ownedRestIds.includes(a.restaurant_id)
        );

        const ownerLogs = rawOwnerLogs.map((log: any) => ({
            ...log,
            actionTitle: formatAuditAction(log.action),
            description: formatAuditDetails(log.action, log.details, log),
            badges: extractAuditBadges(log)
        }));

        // Security Events
        const rawOwnerSecurityEvents = (securityRes.data || []).filter(
            (s) => s.actor_id === ownerId || ownedRestIds.includes(s.restaurant_id)
        );

        const ownerSecurityEvents = rawOwnerSecurityEvents.map((evt: any) => ({
            ...evt,
            description: formatAuditDetails(evt.event_type, evt.details, evt)
        }));

        return NextResponse.json({
            success: true,
            owner: {
                id: ownerId,
                name,
                email,
                phone,
                role: 'OWNER',
                status,
                approvalStatus: (emp?.approval_status || regReq?.approval_status || (emp?.status === 'active' ? 'approved' : 'pending')).toUpperCase(),
                registrationDate: du?.created_at || emp?.created_at || allOwnedRestaurants[0]?.created_at || new Date().toISOString(),
                totalRestaurants: activeOwnedRestaurants.length,
                totalBranches: allBranches.filter((b) => ownedRestIds.includes(b.restaurant_id)).length,
                subscription: subscriptionStatus.planName,
                hasSubscription: hasActiveSub,
                quota,
                usedQuota,
                remainingQuota,
                quotaStatus,
                createdDate: du?.created_at || emp?.created_at || allOwnedRestaurants[0]?.created_at || new Date().toISOString(),
                lastLogin: du?.last_login || null,
                lastActivity: ownerLogs[0]?.created_at || du?.last_login || du?.created_at || new Date().toISOString()
            },
            overview: {
                totalLocations,
                activeLocations,
                suspendedLocations,
                pendingApprovals,
                totalAdmins,
                totalEmployees,
                totalOrders,
                totalRevenue,
                subscriptionStatus,
                quotaUsage: {
                    total: quota,
                    used: usedQuota,
                    remaining: remainingQuota,
                    percentage: quota > 0 ? Math.min(100, Math.round((usedQuota / quota) * 100)) : 0
                },
                recentActivity: ownerLogs.slice(0, 10)
            },
            locations: formattedLocations,
            usersByLocation,
            users: usersByLocation.flatMap((loc: any) => [...(loc.admin ? [loc.admin] : []), ...(loc.employees || [])]),
            quota: {
                total: quota,
                used: usedQuota,
                remaining: remainingQuota,
                percentage: quota > 0 ? Math.min(100, Math.round((usedQuota / quota) * 100)) : 0
            },
            subscriptions: allSubs,
            billing: {
                invoices: allInvoices,
                payments: allPayments,
                totalBilled: Math.round(allInvoices.reduce((sum, i) => sum + (Number(i.total) || 0), 0) * 100) / 100,
                totalPaid: Math.round(allPayments.filter((p) => p.status === 'completed').reduce((sum, p) => sum + (Number(p.amount) || 0), 0) * 100) / 100
            },
            activity: ownerLogs,
            audit_logs: ownerLogs,
            security: {
                events: ownerSecurityEvents,
                sessions: allSessions
            }
        });
    } catch (err: any) {
        console.error('Super Admin Owner Workspace API error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const { id: ownerId } = await params;
        const body = await request.json();
        const { action } = body;

        // 1. UPDATE OWNER QUOTA
        if (action === 'update_quota') {
            const rawQuota = body.quota !== undefined ? body.quota : body.max_branches;
            if (rawQuota === undefined || rawQuota === null) {
                return NextResponse.json({ error: 'quota is required' }, { status: 400 });
            }
            const limitNum = Math.max(1, parseInt(String(rawQuota)));

            await Promise.all([
                supabaseAdmin.from('employees').update({ max_branches: limitNum, custom_quota: limitNum, updated_at: new Date().toISOString() }).eq('id', ownerId),
                supabaseAdmin.from('dine_users').update({ max_branches: limitNum }).eq('id', ownerId),
                supabaseAdmin.from('restaurants').update({ max_branches: limitNum, custom_quota: limitNum, updated_at: new Date().toISOString() }).eq('owner_id', ownerId)
            ]);

            // Also update subscriptions
            const { data: ownerRests } = await supabaseAdmin.from('restaurants').select('id').eq('owner_id', ownerId);
            const restIds = (ownerRests || []).map((r) => r.id);
            if (restIds.length > 0) {
                await supabaseAdmin.from('subscriptions').update({ max_branches: limitNum, updated_at: new Date().toISOString() }).in('restaurant_id', restIds);
            }

            await supabaseAdmin.from('audit_logs').insert({
                user_id: auth.user.userId,
                actor_id: auth.user.userId,
                actor_role: 'SUPER_ADMIN',
                action: 'super_admin_update_owner_quota',
                resource_type: 'owner',
                resource_id: ownerId,
                details: {
                    new_quota: limitNum,
                    updated_by: auth.user.email,
                    timestamp: new Date().toISOString()
                }
            });

            return NextResponse.json({
                success: true,
                message: `Owner branch/location quota successfully set to ${limitNum}.`,
                newQuota: limitNum,
                owner: { max_branches: limitNum, quota: limitNum }
            });
        }

        // 2. UPDATE OWNER PROFILE
        if (action === 'update_profile') {
            const { name, email, phone } = body;
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

            return NextResponse.json({ success: true, message: 'Owner profile details updated.' });
        }

        // 3. TOGGLE / UPDATE STATUS (ACTIVE, INACTIVE, SUSPENDED)
        if (action === 'update_status' || action === 'toggle_status') {
            const { status, reason } = body;
            if (!status) return NextResponse.json({ error: 'status is required' }, { status: 400 });

            const cleanStatus = status.toLowerCase();

            await Promise.all([
                supabaseAdmin.from('employees').update({
                    status: cleanStatus,
                    deactivated_at: cleanStatus !== 'active' ? new Date().toISOString() : null,
                    updated_at: new Date().toISOString()
                }).eq('id', ownerId),
                supabaseAdmin.from('dine_users').update({ status: cleanStatus }).eq('id', ownerId),
                supabaseAdmin.from('restaurant_users').update({
                    status: cleanStatus,
                    updated_at: new Date().toISOString()
                }).eq('user_id', ownerId)
            ]);

            // If suspending or deactivating owner, cascade status to all their restaurants
            if (cleanStatus === 'suspended' || cleanStatus === 'inactive') {
                await supabaseAdmin.from('restaurants').update({
                    status: cleanStatus.toUpperCase(),
                    updated_at: new Date().toISOString()
                }).eq('owner_id', ownerId);
            } else if (cleanStatus === 'active') {
                await supabaseAdmin.from('restaurants').update({
                    status: 'ACTIVE',
                    updated_at: new Date().toISOString()
                }).eq('owner_id', ownerId);
            }

            await supabaseAdmin.from('audit_logs').insert({
                user_id: auth.user.userId,
                actor_id: auth.user.userId,
                actor_role: 'SUPER_ADMIN',
                action: `super_admin_${cleanStatus}_owner`,
                resource_type: 'owner',
                resource_id: ownerId,
                details: {
                    new_status: cleanStatus,
                    reason: reason || 'Administrative action by Super Admin',
                    timestamp: new Date().toISOString()
                }
            });

            return NextResponse.json({
                success: true,
                message: `Owner account status updated to ${cleanStatus.toUpperCase()}.`
            });
        }

        // 4. FORCE LOGOUT ALL SESSIONS
        if (action === 'force_logout') {
            // Delete sessions from dine_sessions for owner and all employees of their restaurants
            const { data: ownerRests } = await supabaseAdmin.from('restaurants').select('id').eq('owner_id', ownerId);
            const restIds = (ownerRests || []).map((r) => r.id);

            const { data: empList } = await supabaseAdmin.from('employees').select('id').in('restaurant_id', restIds);
            const allUserIds = [ownerId, ...(empList || []).map((e) => e.id)];

            await supabaseAdmin.from('dine_sessions').delete().in('user_id', allUserIds);

            // Increment session_version for all affected employees to invalidate JWT tokens
            const { data: currentEmps } = await supabaseAdmin.from('employees').select('id, session_version').in('id', allUserIds);
            if (currentEmps) {
                for (const e of currentEmps) {
                    await supabaseAdmin.from('employees').update({
                        session_version: (e.session_version || 1) + 1,
                        updated_at: new Date().toISOString()
                    }).eq('id', e.id);
                }
            }

            await supabaseAdmin.from('audit_logs').insert({
                user_id: auth.user.userId,
                actor_id: auth.user.userId,
                actor_role: 'SUPER_ADMIN',
                action: 'super_admin_force_logout_owner_sessions',
                resource_type: 'owner',
                resource_id: ownerId,
                details: {
                    invalidated_users_count: allUserIds.length,
                    timestamp: new Date().toISOString()
                }
            });

            return NextResponse.json({
                success: true,
                message: 'All active sessions for this Owner and their restaurants have been forcefully terminated.'
            });
        }

        // 5. UPDATE SUBSCRIPTION OVERRIDE
        if (action === 'update_subscription') {
            const { planName, status: subStatus, trialEndsAt } = body;
            const { data: ownerRests } = await supabaseAdmin.from('restaurants').select('id').eq('owner_id', ownerId);
            const restIds = (ownerRests || []).map((r) => r.id);

            if (restIds.length > 0) {
                const subUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
                if (planName) subUpdates.plan_name = planName;
                if (subStatus) subUpdates.status = subStatus;
                if (trialEndsAt) subUpdates.trial_ends_at = trialEndsAt;

                await supabaseAdmin.from('subscriptions').update(subUpdates).in('restaurant_id', restIds);
                if (planName) {
                    await supabaseAdmin.from('restaurants').update({ subscription_plan: planName }).in('id', restIds);
                }
            }

            await supabaseAdmin.from('audit_logs').insert({
                user_id: auth.user.userId,
                actor_id: auth.user.userId,
                actor_role: 'SUPER_ADMIN',
                action: 'super_admin_override_owner_subscription',
                resource_type: 'owner',
                resource_id: ownerId,
                details: { planName, subStatus, trialEndsAt, timestamp: new Date().toISOString() }
            });

            return NextResponse.json({
                success: true,
                message: 'Owner subscription settings updated successfully.'
            });
        }

        return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });
    } catch (err: any) {
        console.error('Super Admin patch owner detail error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const { id: ownerId } = await params;
        if (!ownerId) {
            return NextResponse.json({ error: 'Owner ID is required' }, { status: 400 });
        }

        // 1. Resolve owner across employees, registration requests, restaurants, and auth
        let targetOwnerId = ownerId;
        let targetEmail: string | null = null;
        let targetName = 'Owner';

        const { data: emp } = await supabaseAdmin
            .from('employees')
            .select('id, name, email')
            .eq('id', targetOwnerId)
            .maybeSingle();
        if (emp) {
            targetName = emp.name || targetName;
            targetEmail = emp.email?.toLowerCase().trim() || null;
        }

        // Check registration requests
        const { data: regReqs } = await supabaseAdmin
            .from('restaurant_registration_requests')
            .select('id, owner_id, owner_name, owner_email')
            .or(`owner_id.eq.${targetOwnerId}${targetEmail ? `,owner_email.eq.${targetEmail}` : ''}`);
        if (regReqs && regReqs.length > 0) {
            const req = regReqs[0];
            if (targetName === 'Owner' && req.owner_name) targetName = req.owner_name;
            if (!targetEmail && req.owner_email) targetEmail = req.owner_email.toLowerCase().trim();
        }

        // 2. Clear foreign key references on service_requests
        await Promise.all([
            supabaseAdmin.from('service_requests').update({ accepted_by: null }).eq('accepted_by', targetOwnerId),
            supabaseAdmin.from('service_requests').update({ assigned_waiter_id: null }).eq('assigned_waiter_id', targetOwnerId)
        ]);

        // 3. Delete from restaurant_registration_requests
        await supabaseAdmin.from('restaurant_registration_requests').delete().eq('owner_id', targetOwnerId);
        if (targetEmail) {
            await supabaseAdmin.from('restaurant_registration_requests').delete().ilike('owner_email', targetEmail);
        }

        // 4. Unlink restaurants owned by this owner
        await supabaseAdmin.from('restaurants').update({
            owner_id: null,
            owner_name: null,
            updated_at: new Date().toISOString()
        }).eq('owner_id', targetOwnerId);

        // 5. Delete links, sessions, auth, and employees
        await supabaseAdmin.from('restaurant_users').delete().eq('user_id', targetOwnerId);
        await supabaseAdmin.from('dine_sessions').delete().eq('user_id', targetOwnerId);
        await supabaseAdmin.from('employee_branch_access').delete().eq('employee_id', targetOwnerId);
        await supabaseAdmin.from('auth').delete().eq('user_id', targetOwnerId);
        await supabaseAdmin.from('employees').delete().eq('id', targetOwnerId);

        if (targetEmail) {
            await supabaseAdmin.from('employees').delete().ilike('email', targetEmail).in('role', ['owner', 'restaurant_owner']);
            await supabaseAdmin.from('auth').delete().ilike('email', targetEmail);
        }

        try {
            await supabaseAdmin.auth.admin.deleteUser(targetOwnerId);
        } catch (_) {}

        await supabaseAdmin.from('audit_logs').insert({
            user_id: auth.user.userId,
            actor_id: auth.user.userId,
            actor_role: 'SUPER_ADMIN',
            action: 'super_admin_delete_owner',
            resource_type: 'owner',
            resource_id: targetOwnerId,
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
        console.error('Super Admin delete owner detail error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
