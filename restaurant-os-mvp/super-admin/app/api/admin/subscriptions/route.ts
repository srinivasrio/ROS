import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySuperAdmin } from '@/lib/superadmin-guard';
import { formatAuditAction, formatAuditDetails } from '@/lib/audit-formatters';
import { getAllFeatures, CANONICAL_PLANS, PLAN_FEATURE_MATRIX, FEATURE_DEFINITIONS, FeatureKey, PlanSlug, normalizePlanSlug, getPlanDefaultLimit } from '@/lib/entitlements';

export async function GET(request: Request) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        // 1. Fetch live production tables from Supabase
        const [
            subRes,
            restRes,
            plansRes,
            dineUsersRes,
            empRes,
            invoicesRes,
            paymentsRes,
            auditRes,
            overridesRes,
            regRequestsRes
        ] = await Promise.all([
            supabaseAdmin.from('subscriptions').select('*').order('created_at', { ascending: false }),
            supabaseAdmin.from('restaurants').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
            supabaseAdmin.from('plans').select('*').order('price_monthly', { ascending: true }),
            supabaseAdmin.from('dine_users').select('id, name, email, phone, role'),
            supabaseAdmin.from('employees').select('id, name, email, phone, role').is('deleted_at', null),
            supabaseAdmin.from('invoices').select('*').order('created_at', { ascending: false }),
            supabaseAdmin.from('payments').select('*').order('created_at', { ascending: false }),
            supabaseAdmin.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100),
            supabaseAdmin.from('restaurant_feature_overrides').select('*'),
            supabaseAdmin.from('restaurant_registration_requests').select('*').order('created_at', { ascending: false })
        ]);

        const rawSubscriptions = subRes.data || [];
        const restaurants = restRes.data || [];
        const plans = plansRes.data || [];
        const dineUsers = dineUsersRes.data || [];
        const employees = empRes.data || [];
        const invoices = invoicesRes.data || [];
        const payments = paymentsRes.data || [];
        const auditLogs = auditRes.data || [];
        const rawRegRequests = regRequestsRes.data || [];

        // Build lookup maps
        const userMap = new Map<string, any>();
        dineUsers.forEach((u) => userMap.set(u.id, u));
        employees.forEach((e) => {
            if (!userMap.has(e.id)) userMap.set(e.id, e);
        });

        const planMap = new Map<string, any>();
        plans.forEach((p) => {
            planMap.set(p.slug.toLowerCase(), p);
            planMap.set(p.name.toLowerCase(), p);
        });

        const restMap = new Map<string, any>();
        restaurants.forEach((r) => restMap.set(r.id, r));

        const invoicesByRest = new Map<string, any[]>();
        invoices.forEach((inv) => {
            const arr = invoicesByRest.get(inv.restaurant_id) || [];
            arr.push(inv);
            invoicesByRest.set(inv.restaurant_id, arr);
        });

        const paymentsByRest = new Map<string, any[]>();
        payments.forEach((pay) => {
            const arr = paymentsByRest.get(pay.restaurant_id) || [];
            arr.push(pay);
            paymentsByRest.set(pay.restaurant_id, arr);
        });

        const subByRest = new Map<string, any>();
        rawSubscriptions.forEach((sub) => {
            if (!subByRest.has(sub.restaurant_id)) {
                subByRest.set(sub.restaurant_id, sub);
            }
        });

        const overrides = overridesRes?.data || [];
        const overridesByRest = new Map<string, any[]>();
        overrides.forEach((ov: any) => {
            const arr = overridesByRest.get(ov.restaurant_id) || [];
            arr.push(ov);
            overridesByRest.set(ov.restaurant_id, arr);
        });

        const now = Date.now();

        // Format subscriptions per independent restaurant
        const formattedSubscriptions = restaurants.map((rest: any) => {
            const sub = subByRest.get(rest.id);
            const owner = rest.owner_id ? userMap.get(rest.owner_id) : null;
            const ownerName = owner?.name || rest.owner_name || 'Owner';
            const ownerEmail = owner?.email || rest.email || '—';
            const ownerPhone = owner?.phone || rest.phone || '—';

            const rawPlanKey = (sub?.plan_name || rest.subscription_plan || 'standard').toLowerCase();
            let canonicalSlug: PlanSlug = 'standard';
            if (rawPlanKey.includes('trial') || rawPlanKey === 'starter-trial') canonicalSlug = 'trial-14';
            else if (rawPlanKey === 'standard' || rawPlanKey === 'starter') canonicalSlug = 'standard';
            else if (rawPlanKey === 'growth') canonicalSlug = 'growth';
            else if (rawPlanKey === 'pro') canonicalSlug = 'pro';
            else if (rawPlanKey === 'enterprise') canonicalSlug = 'enterprise';

            const matchedPlan = planMap.get(canonicalSlug) || planMap.get(rawPlanKey) || CANONICAL_PLANS[canonicalSlug] || plans[0];
            const planName = matchedPlan?.name || CANONICAL_PLANS[canonicalSlug]?.name || 'Standard';
            const planSlug = canonicalSlug;

            const planType = (sub?.plan_type || (planSlug.includes('trial') ? 'free_trial' : 'monthly')).toLowerCase();
            const rawStatus = (sub?.status || (planType === 'free_trial' ? 'trialing' : 'active')).toLowerCase();

            // Status resolution
            let status: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'CANCELLED' | 'SUSPENDED' = 'ACTIVE';

            if (rest.status === 'SUSPENDED') {
                status = 'SUSPENDED';
            } else if (rawStatus === 'canceled' || rawStatus === 'cancelled' || sub?.canceled_at) {
                status = 'CANCELLED';
            } else if (rawStatus === 'past_due' || rawStatus === 'expired') {
                status = 'EXPIRED';
            } else if (rawStatus === 'trialing' || planType === 'free_trial') {
                if (sub?.trial_ends_at && new Date(sub.trial_ends_at).getTime() < now) {
                    status = 'EXPIRED';
                } else {
                    status = 'TRIAL';
                }
            } else {
                if (sub?.current_period_end && new Date(sub.current_period_end).getTime() < now) {
                    status = 'EXPIRED';
                } else {
                    status = 'ACTIVE';
                }
            }

            // Days remaining calculation
            let daysRemaining: number | null = null;
            if (status === 'TRIAL' && sub?.trial_ends_at) {
                const diff = new Date(sub.trial_ends_at).getTime() - now;
                daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
            } else if (status === 'ACTIVE' && sub?.current_period_end) {
                const diff = new Date(sub.current_period_end).getTime() - now;
                daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
            }

            const isExpiringSoon = status === 'TRIAL' 
                ? (daysRemaining !== null && daysRemaining <= 3)
                : (daysRemaining !== null && daysRemaining <= 7);

            // Pricing
            let price = sub?.amount;
            if (price === undefined || price === null || price === 0) {
                if (status === 'TRIAL') {
                    price = 0;
                } else if (planType === 'annual') {
                    price = matchedPlan?.price_annual || CANONICAL_PLANS[canonicalSlug]?.priceAnnual || 9990;
                } else {
                    price = matchedPlan?.price_monthly || CANONICAL_PLANS[canonicalSlug]?.priceMonthly || 999;
                }
            }

            const restInvoices = invoicesByRest.get(rest.id) || [];
            const restPayments = paymentsByRest.get(rest.id) || [];

            // Entitlements & Overrides Resolution
            const restOverrides = overridesByRest.get(rest.id) || [];
            const effectiveFeatures: Record<FeatureKey, boolean> = {
                ...(PLAN_FEATURE_MATRIX[canonicalSlug] || PLAN_FEATURE_MATRIX.standard)
            };

            restOverrides.forEach((ov: any) => {
                const fKey = ov.feature_key as FeatureKey;
                if (!FEATURE_DEFINITIONS[fKey]) return;
                const startsAt = ov.starts_at ? new Date(ov.starts_at).getTime() : 0;
                const expiresAt = ov.expires_at ? new Date(ov.expires_at).getTime() : null;
                if (startsAt <= now && (expiresAt === null || expiresAt > now)) {
                    effectiveFeatures[fKey] = Boolean(ov.enabled);
                }
            });

            if (status === 'SUSPENDED') {
                (Object.keys(effectiveFeatures) as FeatureKey[]).forEach(k => {
                    effectiveFeatures[k] = false;
                });
            }

            const availableFeatures = (Object.keys(effectiveFeatures) as FeatureKey[]).filter(k => effectiveFeatures[k]);
            const lockedFeatures = (Object.keys(effectiveFeatures) as FeatureKey[]).filter(k => !effectiveFeatures[k]);

            return {
                id: sub?.id || `sub-${rest.id}`,
                restaurantId: rest.id,
                restaurantName: rest.name,
                ownerId: rest.owner_id || null,
                ownerName,
                ownerEmail,
                ownerPhone,
                plan: planName,
                planSlug,
                billingCycle: planType === 'annual' ? 'Annual' : planType === 'free_trial' ? 'Trial' : 'Monthly',
                price: Number(price),
                currency: sub?.currency || 'INR',
                status,
                trialStartsAt: sub?.trial_starts_at || null,
                trialEndsAt: sub?.trial_ends_at || null,
                currentPeriodStart: sub?.current_period_start || sub?.created_at || rest.created_at,
                currentPeriodEnd: sub?.current_period_end || null,
                canceledAt: sub?.canceled_at || null,
                daysRemaining,
                isExpiringSoon,
                maxBranches: sub?.max_branches || matchedPlan?.max_branches || rest.max_branches || 1,
                maxEmployees: sub?.max_employees || matchedPlan?.max_employees || 10,
                invoicesCount: restInvoices.length,
                paymentsCount: restPayments.length,
                lastInvoice: restInvoices[0] || null,
                features: effectiveFeatures,
                overrides: restOverrides,
                availableFeatures,
                lockedFeatures,
                hasWhatsAppBills: Boolean(effectiveFeatures.whatsapp_bills),
                createdAt: sub?.created_at || rest.created_at,
                updatedAt: sub?.updated_at || rest.updated_at
            };
        });

        // 2. Compute Accurate Summary KPIs
        const totalSubscriptions = formattedSubscriptions.length;
        const activeSubscriptions = formattedSubscriptions.filter((s) => s.status === 'ACTIVE').length;
        const trialRestaurants = formattedSubscriptions.filter((s) => s.status === 'TRIAL').length;
        const expiringSoon = formattedSubscriptions.filter((s) => s.isExpiringSoon).length;
        const expiredCancelled = formattedSubscriptions.filter((s) => s.status === 'EXPIRED' || s.status === 'CANCELLED' || s.status === 'SUSPENDED').length;

        // MRR & Annual Run-Rate
        const mrr = formattedSubscriptions
            .filter((s) => s.status === 'ACTIVE')
            .reduce((sum, s) => {
                const monthlyContribution = s.billingCycle === 'Annual' ? Math.round(s.price / 12) : s.price;
                return sum + monthlyContribution;
            }, 0);

        const arr = mrr * 12;

        // Failed payments & alerts
        const failedPaymentsList = payments.filter((p) => p.status === 'failed');
        const overdueInvoicesList = invoices.filter((i) => i.status === 'overdue');
        const failedPaymentsCount = failedPaymentsList.length + overdueInvoicesList.length;
        const failedPaymentsAmount = failedPaymentsList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) +
            overdueInvoicesList.reduce((sum, i) => sum + (Number(i.total) || 0), 0);

        // 3. Subscription Status Distribution Breakdown
        const statusDistribution = [
            {
                status: 'Active Paid',
                count: activeSubscriptions,
                percentage: totalSubscriptions > 0 ? Math.round((activeSubscriptions / totalSubscriptions) * 100) : 0,
                color: '#10B981'
            },
            {
                status: 'In Trial',
                count: trialRestaurants,
                percentage: totalSubscriptions > 0 ? Math.round((trialRestaurants / totalSubscriptions) * 100) : 0,
                color: '#06B6D4'
            },
            {
                status: 'Expiring Soon',
                count: expiringSoon,
                percentage: totalSubscriptions > 0 ? Math.round((expiringSoon / totalSubscriptions) * 100) : 0,
                color: '#F59E0B'
            },
            {
                status: 'Expired / Cancelled',
                count: expiredCancelled,
                percentage: totalSubscriptions > 0 ? Math.round((expiredCancelled / totalSubscriptions) * 100) : 0,
                color: '#F43F5E'
            }
        ];

        // 4. Revenue Trend Calculation (Real data from payments & invoices)
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentMonthIdx = new Date().getMonth();
        const revenueTrend: { month: string; revenue: number; orders: number }[] = [];

        for (let i = 5; i >= 0; i--) {
            const targetDate = new Date();
            targetDate.setMonth(currentMonthIdx - i);
            const mLabel = monthNames[targetDate.getMonth()];
            const mYear = targetDate.getFullYear();

            // Sum real payments in this month
            const monthRevenue = payments
                .filter((p) => {
                    if (p.status !== 'completed' && p.status !== 'paid') return false;
                    const d = new Date(p.paid_at || p.created_at);
                    return d.getMonth() === targetDate.getMonth() && d.getFullYear() === mYear;
                })
                .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

            // If earlier months have no transaction records, project or show 0
            revenueTrend.push({
                month: mLabel,
                revenue: monthRevenue > 0 ? monthRevenue : (i === 0 ? mrr : 0),
                orders: monthRevenue > 0 ? Math.round(monthRevenue / 1499) : (i === 0 ? activeSubscriptions : 0)
            });
        }

        // 5. Upcoming Renewals
        const upcomingRenewals = formattedSubscriptions
            .filter((s) => s.status === 'ACTIVE' || s.status === 'TRIAL')
            .sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999))
            .slice(0, 6);

        // 6. Failed Payment Alerts
        const failedPaymentAlerts = [
            ...failedPaymentsList.map((p) => ({
                id: p.id,
                type: 'PAYMENT_FAILED',
                restaurantId: p.restaurant_id,
                restaurantName: restMap.get(p.restaurant_id)?.name || p.restaurant_id,
                amount: p.amount,
                date: p.created_at,
                reason: p.metadata?.failure_reason || 'Card or auto-debit charge was declined by bank'
            })),
            ...overdueInvoicesList.map((i) => ({
                id: i.id,
                type: 'INVOICE_OVERDUE',
                restaurantId: i.restaurant_id,
                restaurantName: restMap.get(i.restaurant_id)?.name || i.restaurant_id,
                amount: i.total,
                date: i.due_date || i.created_at,
                reason: `Invoice ${i.invoice_number} is past statutory due date`
            }))
        ];

        // 7. Recent Subscription Activity Stream from audit logs
        const relevantAudits = auditLogs
            .filter((log) => {
                const act = (log.action || '').toLowerCase();
                return (
                    act.includes('subscription') ||
                    act.includes('plan') ||
                    act.includes('trial') ||
                    act.includes('payment') ||
                    act.includes('invoice') ||
                    act.includes('quota')
                );
            })
            .slice(0, 8)
            .map((log) => ({
                id: log.id,
                action: formatAuditAction(log.action),
                description: formatAuditDetails(log.action, log.details, log),
                restaurantId: log.restaurant_id,
                restaurantName: restMap.get(log.restaurant_id)?.name || 'Platform Admin',
                timestamp: log.created_at
            }));

        // 8. Formatted Payments Table
        const formattedPayments = payments.map((pay: any) => {
            const rest = restMap.get(pay.restaurant_id);
            const owner = rest?.owner_id ? userMap.get(rest.owner_id) : null;
            const linkedInvoice = invoices.find((inv) => inv.id === pay.invoice_id || inv.payment_id === pay.id || inv.restaurant_id === pay.restaurant_id);

            const rawStatus = (pay.status || 'pending').toLowerCase();
            let displayStatus: 'COMPLETED' | 'PENDING' | 'FAILED' | 'REFUNDED' = 'COMPLETED';
            if (rawStatus === 'completed' || rawStatus === 'paid' || rawStatus === 'success') displayStatus = 'COMPLETED';
            else if (rawStatus === 'failed') displayStatus = 'FAILED';
            else if (rawStatus === 'refunded') displayStatus = 'REFUNDED';
            else displayStatus = 'PENDING';

            return {
                id: pay.id,
                restaurantId: pay.restaurant_id,
                restaurantName: rest?.name || pay.restaurant_id,
                ownerName: owner?.name || rest?.owner_name || 'Owner',
                ownerEmail: owner?.email || rest?.email || '—',
                amount: Number(pay.amount),
                currency: pay.currency || 'INR',
                paymentId: pay.gateway_transaction_id || pay.id.slice(0, 13),
                paymentDate: pay.paid_at || pay.created_at,
                paymentMethod: pay.payment_method || pay.metadata?.payment_method || 'Online Gateway',
                paymentGateway: pay.payment_gateway || 'Razorpay',
                status: displayStatus,
                invoiceNumber: linkedInvoice?.invoice_number || pay.metadata?.invoice_number || 'INV-DIRECT',
                invoiceId: linkedInvoice?.id || null,
                notes: pay.metadata?.notes || null
            };
        });

        // Format Registration Requests
        const registrationRequests = rawRegRequests.map((req: any) => ({
            id: req.id,
            requestNumber: req.request_number,
            ownerId: req.owner_id,
            ownerName: req.owner_name,
            ownerEmail: req.owner_email,
            ownerPhone: req.owner_phone,
            restaurantId: req.restaurant_id,
            restaurantName: req.restaurant_name,
            restaurantCode: req.restaurant_code,
            restaurantPhone: req.restaurant_phone,
            restaurantEmail: req.restaurant_email,
            restaurantAddress: req.restaurant_address,
            adminName: req.admin_name,
            adminEmail: req.admin_email,
            adminMobile: req.admin_mobile,
            adminPassword: req.admin_password,
            adminPin: req.admin_pin,
            planSlug: req.plan_slug,
            planName: req.plan_name,
            planLimit: req.plan_limit,
            customQuota: req.custom_quota,
            effectiveLimit: req.custom_quota || req.plan_limit || 1,
            requestedCount: req.requested_count || 1,
            amountDue: Number(req.amount_due || 0),
            currency: req.currency || 'INR',
            paymentStatus: req.payment_status,
            paymentMethod: req.payment_method,
            paymentReference: req.payment_reference,
            paymentVerifiedAt: req.payment_verified_at,
            paymentVerifiedBy: req.payment_verified_by,
            approvalStatus: req.approval_status,
            rejectionReason: req.rejection_reason,
            superAdminNotes: req.super_admin_notes,
            approvedAt: req.approved_at,
            approvedBy: req.approved_by,
            createdAt: req.created_at,
            updatedAt: req.updated_at
        }));

        const pendingRequestsCount = registrationRequests.filter((r: any) => r.approvalStatus === 'PENDING_APPROVAL' || r.approvalStatus === 'PENDING_PAYMENT').length;

        return NextResponse.json({
            success: true,
            summary: {
                total: totalSubscriptions,
                active: activeSubscriptions,
                trial: trialRestaurants,
                expiringSoon,
                expiredCancelled,
                pendingRequestsCount,
                mrr,
                arr,
                failedPaymentsCount,
                failedPaymentsAmount
            },
            statusDistribution,
            revenueTrend,
            upcomingRenewals,
            failedPaymentAlerts,
            recentActivity: relevantAudits,
            subscriptions: formattedSubscriptions,
            registrationRequests,
            plans,
            canonicalPlans: Object.values(CANONICAL_PLANS),
            featureDefinitions: getAllFeatures(),
            payments: formattedPayments,
            invoices
        });
    } catch (err: any) {
        console.error('Super Admin subscriptions API error:', err);
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
        const { action } = body;

        // Plan Management: Create New Plan
        if (action === 'create_plan') {
            const {
                name,
                slug,
                tagline,
                priceMonthly,
                priceAnnual,
                trialDays,
                features,
                maxBranches,
                maxEmployees,
                maxOrdersPerMonth,
                isPopular
            } = body;

            if (!name || !slug) {
                return NextResponse.json({ error: 'Plan name and unique slug are required' }, { status: 400 });
            }

            const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-');

            const { data: newPlan, error: insertError } = await supabaseAdmin
                .from('plans')
                .insert({
                    name,
                    slug: cleanSlug,
                    tagline: tagline || '',
                    price_monthly: Number(priceMonthly) || 0,
                    price_annual: Number(priceAnnual) || 0,
                    trial_days: Number(trialDays) || 14,
                    features: Array.isArray(features) ? features : [],
                    max_branches: Number(maxBranches) || 1,
                    max_employees: Number(maxEmployees) || 10,
                    max_orders_per_month: maxOrdersPerMonth ? Number(maxOrdersPerMonth) : null,
                    is_active: true,
                    is_popular: Boolean(isPopular),
                    is_archived: false
                })
                .select()
                .single();

            if (insertError) {
                return NextResponse.json({ error: insertError.message }, { status: 500 });
            }

            await supabaseAdmin.from('audit_logs').insert({
                user_id: auth.user.userId,
                action: 'super_admin_create_plan',
                details: { planName: name, slug: cleanSlug, priceMonthly, priceAnnual, timestamp: new Date().toISOString() }
            });

            return NextResponse.json({ success: true, plan: newPlan, message: `Plan "${name}" created successfully!` });
        }

        return NextResponse.json({ error: 'Unknown POST action' }, { status: 400 });
    } catch (err: any) {
        console.error('Super Admin subscriptions POST error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const body = await request.json();
        const { action, restaurantId } = body;

        if (!action) {
            return NextResponse.json({ error: 'action parameter is required' }, { status: 400 });
        }

        // ==========================================
        // 1. PLAN MANAGEMENT MUTATIONS
        // ==========================================
        if (action === 'update_plan') {
            const {
                id,
                name,
                tagline,
                priceMonthly,
                priceAnnual,
                trialDays,
                features,
                maxBranches,
                maxEmployees,
                maxOrdersPerMonth,
                isPopular
            } = body;

            if (!id) return NextResponse.json({ error: 'Plan id is required' }, { status: 400 });

            const { data: updated, error: updateErr } = await supabaseAdmin
                .from('plans')
                .update({
                    name,
                    tagline,
                    price_monthly: Number(priceMonthly),
                    price_annual: Number(priceAnnual),
                    trial_days: Number(trialDays) || 14,
                    features: Array.isArray(features) ? features : [],
                    max_branches: Number(maxBranches),
                    max_employees: Number(maxEmployees),
                    max_orders_per_month: maxOrdersPerMonth ? Number(maxOrdersPerMonth) : null,
                    is_popular: Boolean(isPopular),
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

            await supabaseAdmin.from('audit_logs').insert({
                user_id: auth.user.userId,
                action: 'super_admin_update_plan',
                details: { planId: id, name, priceMonthly, priceAnnual, timestamp: new Date().toISOString() }
            });

            return NextResponse.json({ success: true, plan: updated, message: `Plan "${name}" updated successfully.` });
        }

        if (action === 'toggle_plan_status') {
            const { id, isActive } = body;
            if (!id) return NextResponse.json({ error: 'Plan id is required' }, { status: 400 });

            await supabaseAdmin
                .from('plans')
                .update({ is_active: Boolean(isActive), updated_at: new Date().toISOString() })
                .eq('id', id);

            await supabaseAdmin.from('audit_logs').insert({
                user_id: auth.user.userId,
                action: 'super_admin_toggle_plan_status',
                details: { planId: id, isActive: Boolean(isActive), timestamp: new Date().toISOString() }
            });

            return NextResponse.json({ success: true, message: `Plan status updated.` });
        }

        if (action === 'archive_plan') {
            const { id } = body;
            if (!id) return NextResponse.json({ error: 'Plan id is required' }, { status: 400 });

            await supabaseAdmin
                .from('plans')
                .update({ is_archived: true, is_active: false, updated_at: new Date().toISOString() })
                .eq('id', id);

            await supabaseAdmin.from('audit_logs').insert({
                user_id: auth.user.userId,
                action: 'super_admin_archive_plan',
                details: { planId: id, timestamp: new Date().toISOString() }
            });

            return NextResponse.json({ success: true, message: `Plan archived.` });
        }

        // ==========================================
        // 2. REGISTRATION REQUEST WORKFLOW MUTATIONS
        // ==========================================
        const reqId = body.requestId || body.id;
        const targetRestaurantId = restaurantId || body.restaurant_id;

        // Approve Registration Request
        if (action === 'approve_registration') {
            let regReq: any = null;

            if (reqId) {
                const { data } = await supabaseAdmin
                    .from('restaurant_registration_requests')
                    .select('*')
                    .eq('id', reqId)
                    .maybeSingle();
                regReq = data;
            } else if (targetRestaurantId) {
                const { data } = await supabaseAdmin
                    .from('restaurant_registration_requests')
                    .select('*')
                    .eq('restaurant_id', targetRestaurantId)
                    .maybeSingle();
                regReq = data;
            }

            if (!regReq) {
                return NextResponse.json({ error: 'Registration request not found' }, { status: 404 });
            }

            // State Validation: Prevent duplicate or invalid approvals
            const currentApprovalStatus = (regReq.approval_status || '').toUpperCase();
            if (['APPROVED', 'ACTIVE'].includes(currentApprovalStatus)) {
                return NextResponse.json({ 
                    error: 'Duplicate approval: Registration request has already been approved' 
                }, { status: 400 });
            }

            if (['REJECTED', 'CANCELLED', 'DELETED'].includes(currentApprovalStatus)) {
                return NextResponse.json({ 
                    error: `Invalid transition: Cannot approve a registration request in status ${regReq.approval_status}` 
                }, { status: 400 });
            }

            const rId = regReq.restaurant_id;
            const chosenPlanSlug = normalizePlanSlug(body.planSlug || regReq.plan_slug);
            const planDef = CANONICAL_PLANS[chosenPlanSlug] || CANONICAL_PLANS.standard;
            const defaultLimit = getPlanDefaultLimit(chosenPlanSlug);

            // Manual quota override logic (Requirement 6)
            const customQuota = body.customQuota !== undefined && body.customQuota !== null && Number(body.customQuota) > 0
                ? Number(body.customQuota)
                : (regReq.custom_quota && Number(regReq.custom_quota) > 0 ? Number(regReq.custom_quota) : null);

            const effectiveLimit = customQuota ?? defaultLimit;

            const nowIso = new Date().toISOString();
            const periodEndIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            const amountDue = Number(body.amountDue || regReq.amount_due || planDef.priceMonthly);

            // Execute single atomic database transaction via PostgreSQL stored procedure
            const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc('approve_restaurant_registration', {
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

            // Fetch the active subscription created by the atomic procedure
            const { data: updatedSub } = await supabaseAdmin
                .from('subscriptions')
                .select('*')
                .eq('restaurant_id', rId)
                .maybeSingle();

            // 7. Record Invoice & Payment
            const invNum = `INV-${Date.now().toString().slice(-6)}`;
            const tax = Math.round(amountDue * 0.18 * 100) / 100;
            const total = Math.round(amountDue * 1.18 * 100) / 100;

            const { data: invoice } = await supabaseAdmin.from('invoices').insert({
                restaurant_id: rId,
                subscription_id: updatedSub?.id || null,
                invoice_number: invNum,
                status: 'paid',
                subtotal: amountDue,
                tax_amount: tax,
                tax_rate: 18,
                total,
                currency: 'INR',
                billing_period_start: nowIso,
                billing_period_end: periodEndIso,
                due_date: nowIso,
                paid_at: nowIso,
                notes: `Subscription payment confirmed & approved for ${regReq.restaurant_name}`,
                metadata: {
                    request_id: regReq.id,
                    plan: planDef.name,
                    payment_reference: regReq.payment_reference,
                    payment_method: regReq.payment_method
                }
            }).select().single();

            if (invoice) {
                await supabaseAdmin.from('payments').insert({
                    restaurant_id: rId,
                    subscription_id: updatedSub?.id || null,
                    amount: total,
                    currency: 'INR',
                    status: 'completed',
                    payment_method: regReq.payment_method || 'Manual UPI',
                    payment_gateway: 'Manual Verification',
                    gateway_transaction_id: regReq.payment_reference || `man_${Date.now().toString().slice(-6)}`,
                    paid_at: nowIso,
                    metadata: { invoice_number: invNum, request_number: regReq.request_number }
                });
            }

            // 8. Record in audit_logs (Requirement 5: "Approval must be recorded in the audit log")
            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: rId,
                user_id: auth.user.userId,
                actor_id: auth.user.userId,
                actor_role: 'SUPER_ADMIN',
                action: 'super_admin_approve_restaurant_registration',
                resource_type: 'restaurant',
                resource_id: rId,
                details: {
                    request_id: regReq.id,
                    request_number: regReq.request_number,
                    restaurant_id: rId,
                    restaurant_name: regReq.restaurant_name,
                    plan_slug: chosenPlanSlug,
                    default_limit: defaultLimit,
                    custom_quota: customQuota,
                    effective_limit: effectiveLimit,
                    amount_due: amountDue,
                    payment_reference: regReq.payment_reference,
                    approved_by: auth.user.email,
                    timestamp: nowIso
                }
            });

            return NextResponse.json({
                success: true,
                message: `Restaurant "${regReq.restaurant_name}" (${rId}) successfully approved and activated with ${planDef.name} plan (Quota: ${effectiveLimit}).`,
                restaurantId: rId,
                planSlug: chosenPlanSlug,
                effectiveLimit
            });
        }

        // Mark Payment Received
        if (action === 'mark_payment_received') {
            const nowIso = new Date().toISOString();
            const { data: regReq } = await supabaseAdmin
                .from('restaurant_registration_requests')
                .update({
                    payment_status: 'RECEIVED',
                    payment_verified_at: nowIso,
                    payment_verified_by: auth.user.email || 'Super Admin',
                    updated_at: nowIso
                })
                .eq('id', reqId)
                .select()
                .single();

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: regReq?.restaurant_id || null,
                user_id: auth.user.userId,
                action: 'super_admin_mark_registration_payment_received',
                details: {
                    request_id: reqId,
                    restaurant_name: regReq?.restaurant_name,
                    payment_reference: regReq?.payment_reference,
                    verified_by: auth.user.email,
                    timestamp: nowIso
                }
            });

            return NextResponse.json({
                success: true,
                message: 'Payment marked as received and verified.'
            });
        }

        // Undo Payment Received (Revert to PENDING)
        if (action === 'undo_payment_received' || action === 'mark_payment_pending') {
            const nowIso = new Date().toISOString();
            const { data: regReq } = await supabaseAdmin
                .from('restaurant_registration_requests')
                .update({
                    payment_status: 'PENDING',
                    payment_verified_at: null,
                    payment_verified_by: null,
                    updated_at: nowIso
                })
                .eq('id', reqId)
                .select()
                .single();

            if (!regReq) {
                return NextResponse.json({ error: 'Registration request not found' }, { status: 404 });
            }

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: regReq.restaurant_id || null,
                user_id: auth.user.userId,
                action: 'super_admin_undo_registration_payment_received',
                details: {
                    request_id: reqId,
                    restaurant_name: regReq.restaurant_name,
                    reverted_by: auth.user.email,
                    timestamp: nowIso
                }
            });

            return NextResponse.json({
                success: true,
                message: `Payment status for "${regReq.restaurant_name}" reverted to PENDING.`
            });
        }

        // Request Payment / Details
        if (action === 'request_payment') {
            const notes = body.notes || 'Please provide payment reference / UTR for verification.';
            const nowIso = new Date().toISOString();

            await supabaseAdmin
                .from('restaurant_registration_requests')
                .update({
                    approval_status: 'PENDING_PAYMENT',
                    super_admin_notes: notes,
                    updated_at: nowIso
                })
                .eq('id', reqId);

            await supabaseAdmin.from('audit_logs').insert({
                user_id: auth.user.userId,
                action: 'super_admin_request_registration_payment',
                details: { request_id: reqId, notes, timestamp: nowIso }
            });

            return NextResponse.json({ success: true, message: 'Payment/details requested from owner.' });
        }

        // Set / Adjust Restaurant Limit (Manual Quota Override - Requirement 5 & 6)
        if (action === 'set_registration_quota' || action === 'adjust_restaurant_limit') {
            const quota = Math.max(1, parseInt(String(body.customQuota || body.quota || body.maxBranches || 1)));
            const nowIso = new Date().toISOString();

            let targetRest = targetRestaurantId;
            let targetOwner = body.ownerId;

            if (reqId) {
                const { data: regReq } = await supabaseAdmin
                    .from('restaurant_registration_requests')
                    .update({ custom_quota: quota, updated_at: nowIso })
                    .eq('id', reqId)
                    .select()
                    .single();

                if (regReq) {
                    targetRest = regReq.restaurant_id;
                    targetOwner = regReq.owner_id;
                }
            }

            if (targetRest) {
                await supabaseAdmin
                    .from('restaurants')
                    .update({ custom_quota: quota, max_branches: quota, updated_at: nowIso })
                    .eq('id', targetRest);

                await supabaseAdmin
                    .from('subscriptions')
                    .update({ max_branches: quota, updated_at: nowIso })
                    .eq('restaurant_id', targetRest);
            }

            if (targetOwner) {
                await supabaseAdmin
                    .from('employees')
                    .update({ custom_quota: quota, max_branches: quota, updated_at: nowIso })
                    .eq('id', targetOwner);
            }

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: targetRest || null,
                user_id: auth.user.userId,
                action: 'super_admin_adjust_restaurant_quota',
                details: { request_id: reqId, restaurant_id: targetRest, custom_quota: quota, timestamp: nowIso }
            });

            return NextResponse.json({
                success: true,
                message: `Restaurant quota set to ${quota} locations (Manual Super Admin Override).`,
                quota
            });
        }

        // Change / Confirm Subscription on Registration Request
        if (action === 'change_registration_plan') {
            const newSlug = normalizePlanSlug(body.planSlug);
            const planDef = CANONICAL_PLANS[newSlug] || CANONICAL_PLANS.standard;
            const newLimit = getPlanDefaultLimit(newSlug);
            const newPrice = planDef.priceMonthly;
            const nowIso = new Date().toISOString();

            const { data: regReq } = await supabaseAdmin
                .from('restaurant_registration_requests')
                .update({
                    plan_slug: newSlug,
                    plan_name: planDef.name,
                    plan_limit: newLimit,
                    amount_due: newPrice,
                    updated_at: nowIso
                })
                .eq('id', reqId)
                .select()
                .single();

            if (regReq?.restaurant_id) {
                await supabaseAdmin
                    .from('restaurants')
                    .update({ subscription_plan: planDef.name, updated_at: nowIso })
                    .eq('id', regReq.restaurant_id);

                await supabaseAdmin
                    .from('subscriptions')
                    .update({
                        plan_name: newSlug,
                        amount: newPrice,
                        features: planDef.features,
                        updated_at: nowIso
                    })
                    .eq('restaurant_id', regReq.restaurant_id);
            }

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: regReq?.restaurant_id || null,
                user_id: auth.user.userId,
                action: 'super_admin_change_registration_plan',
                details: { request_id: reqId, plan_slug: newSlug, plan_name: planDef.name, new_price: newPrice, timestamp: nowIso }
            });

            return NextResponse.json({
                success: true,
                message: `Subscription changed to ${planDef.name} (₹${newPrice}/mo, Limit: ${newLimit}).`
            });
        }

        // Reject Registration Request
        if (action === 'reject_registration') {
            const reason = body.reason || 'Registration request rejected by Super Admin';

            const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('reject_restaurant_registration', {
                p_request_id: reqId,
                p_reason: reason,
                p_rejected_by: auth.user.email || 'Super Admin'
            });

            if (rpcErr) {
                console.error('[reject_restaurant_registration RPC error]:', rpcErr);
                return NextResponse.json({ error: rpcErr.message }, { status: 400 });
            }

            return NextResponse.json({ success: true, message: 'Registration request rejected.' });
        }

        // Suspend Registration
        if (action === 'suspend_registration') {
            const nowIso = new Date().toISOString();
            const { data: regReq } = await supabaseAdmin
                .from('restaurant_registration_requests')
                .update({ approval_status: 'SUSPENDED', updated_at: nowIso })
                .eq('id', reqId)
                .select()
                .single();

            if (regReq?.restaurant_id) {
                await supabaseAdmin
                    .from('restaurants')
                    .update({ status: 'SUSPENDED', updated_at: nowIso })
                    .eq('id', regReq.restaurant_id);

                await supabaseAdmin
                    .from('branches')
                    .update({ status: 'inactive', updated_at: nowIso })
                    .eq('restaurant_id', regReq.restaurant_id);
            }

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: regReq?.restaurant_id || null,
                user_id: auth.user.userId,
                action: 'super_admin_suspend_registration',
                details: { request_id: reqId, timestamp: nowIso }
            });

            return NextResponse.json({ success: true, message: 'Registration and restaurant suspended.' });
        }

        // Cancel Registration Request
        if (action === 'cancel_registration') {
            const nowIso = new Date().toISOString();
            const { data: regReq } = await supabaseAdmin
                .from('restaurant_registration_requests')
                .update({ approval_status: 'CANCELLED', updated_at: nowIso })
                .eq('id', reqId)
                .select()
                .single();

            if (regReq?.restaurant_id) {
                await supabaseAdmin
                    .from('restaurants')
                    .update({ status: 'deactivated', updated_at: nowIso })
                    .eq('id', regReq.restaurant_id);

                await supabaseAdmin
                    .from('branches')
                    .update({ status: 'inactive', updated_at: nowIso })
                    .eq('restaurant_id', regReq.restaurant_id);
            }

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: regReq?.restaurant_id || null,
                user_id: auth.user.userId,
                action: 'super_admin_cancel_registration',
                details: { request_id: reqId, timestamp: nowIso }
            });

            return NextResponse.json({ success: true, message: 'Registration request cancelled.' });
        }

        // ==========================================
        // 3. SUBSCRIPTION LIFECYCLE MUTATIONS
        // ==========================================
        if (!restaurantId) {
            return NextResponse.json({ error: 'restaurantId is required for subscription lifecycle actions' }, { status: 400 });
        }

        // Change Plan
        if (action === 'change_plan') {
            const { planSlug, billingCycle } = body;
            const cycle = billingCycle === 'annual' ? 'annual' : 'monthly';

            const { data: planRecord } = await supabaseAdmin
                .from('plans')
                .select('*')
                .eq('slug', planSlug.toLowerCase())
                .maybeSingle();

            const amount = cycle === 'annual' 
                ? (planRecord?.price_annual || 49990) 
                : (planRecord?.price_monthly || 4999);

            await supabaseAdmin
                .from('subscriptions')
                .update({
                    plan_name: planSlug,
                    plan_type: cycle,
                    amount,
                    max_branches: planRecord?.max_branches || 1,
                    max_employees: planRecord?.max_employees || 10,
                    features: planRecord?.features || [],
                    updated_at: new Date().toISOString()
                })
                .eq('restaurant_id', restaurantId);

            await supabaseAdmin
                .from('restaurants')
                .update({
                    subscription_plan: planRecord?.name || planSlug,
                    updated_at: new Date().toISOString()
                })
                .eq('id', restaurantId);

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: restaurantId,
                user_id: auth.user.userId,
                action: 'super_admin_change_subscription_plan',
                details: { planSlug, planName: planRecord?.name, billingCycle: cycle, amount, timestamp: new Date().toISOString() }
            });

            return NextResponse.json({ success: true, message: `Subscription plan changed to ${planRecord?.name || planSlug} (${cycle}).` });
        }

        // Extend Subscription
        if (action === 'extend_subscription') {
            const { days = 30 } = body;

            const { data: sub } = await supabaseAdmin
                .from('subscriptions')
                .select('current_period_end')
                .eq('restaurant_id', restaurantId)
                .maybeSingle();

            const baseDate = sub?.current_period_end ? new Date(sub.current_period_end).getTime() : Date.now();
            const newPeriodEnd = new Date(baseDate + Number(days) * 24 * 60 * 60 * 1000).toISOString();

            await supabaseAdmin
                .from('subscriptions')
                .update({
                    current_period_end: newPeriodEnd,
                    status: 'active',
                    updated_at: new Date().toISOString()
                })
                .eq('restaurant_id', restaurantId);

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: restaurantId,
                user_id: auth.user.userId,
                action: 'super_admin_extend_subscription',
                details: { extendedDays: days, newPeriodEnd, timestamp: new Date().toISOString() }
            });

            return NextResponse.json({ success: true, message: `Subscription extended by ${days} days until ${new Date(newPeriodEnd).toLocaleDateString()}.` });
        }

        // Extend Trial
        if (action === 'extend_trial') {
            const { trialDays = 14 } = body;

            const { data: sub } = await supabaseAdmin
                .from('subscriptions')
                .select('trial_ends_at')
                .eq('restaurant_id', restaurantId)
                .maybeSingle();

            const baseDate = sub?.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : Date.now();
            const newTrialEnd = new Date(Math.max(Date.now(), baseDate) + Number(trialDays) * 24 * 60 * 60 * 1000).toISOString();

            await supabaseAdmin
                .from('subscriptions')
                .update({
                    trial_ends_at: newTrialEnd,
                    status: 'trialing',
                    updated_at: new Date().toISOString()
                })
                .eq('restaurant_id', restaurantId);

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: restaurantId,
                user_id: auth.user.userId,
                action: 'super_admin_extend_trial',
                details: { addedDays: trialDays, newTrialEnd, timestamp: new Date().toISOString() }
            });

            return NextResponse.json({ success: true, message: `Trial extended by ${trialDays} days until ${new Date(newTrialEnd).toLocaleDateString()}.` });
        }

        // Convert Trial to Paid
        if (action === 'convert_trial_to_paid') {
            const { planSlug = 'growth', billingCycle = 'monthly', recordInitialPayment = true } = body;
            const cycle = billingCycle === 'annual' ? 'annual' : 'monthly';

            const { data: planRecord } = await supabaseAdmin
                .from('plans')
                .select('*')
                .eq('slug', planSlug.toLowerCase())
                .maybeSingle();

            const amount = cycle === 'annual' ? (planRecord?.price_annual || 49990) : (planRecord?.price_monthly || 4999);
            const periodEndDays = cycle === 'annual' ? 365 : 30;
            const periodStart = new Date().toISOString();
            const periodEnd = new Date(Date.now() + periodEndDays * 24 * 60 * 60 * 1000).toISOString();

            const { data: updatedSub } = await supabaseAdmin
                .from('subscriptions')
                .update({
                    status: 'active',
                    plan_name: planSlug,
                    plan_type: cycle,
                    amount,
                    current_period_start: periodStart,
                    current_period_end: periodEnd,
                    updated_at: new Date().toISOString()
                })
                .eq('restaurant_id', restaurantId)
                .select()
                .single();

            await supabaseAdmin
                .from('restaurants')
                .update({
                    subscription_plan: planRecord?.name || planSlug,
                    status: 'ACTIVE',
                    updated_at: new Date().toISOString()
                })
                .eq('id', restaurantId);

            if (recordInitialPayment && updatedSub) {
                const invNum = `INV-${Date.now().toString().slice(-6)}`;
                const { data: inv } = await supabaseAdmin.from('invoices').insert({
                    restaurant_id: restaurantId,
                    subscription_id: updatedSub.id,
                    invoice_number: invNum,
                    status: 'paid',
                    subtotal: amount,
                    tax_amount: Math.round(amount * 0.18 * 100) / 100,
                    tax_rate: 18,
                    total: Math.round(amount * 1.18 * 100) / 100,
                    currency: 'INR',
                    billing_period_start: periodStart,
                    billing_period_end: periodEnd,
                    due_date: periodStart,
                    paid_at: periodStart,
                    notes: `Initial subscription payment for ${planRecord?.name || planSlug}`,
                    metadata: { plan_name: planRecord?.name || planSlug, payment_method: 'Super Admin Manual Direct' }
                }).select().single();

                if (inv) {
                    await supabaseAdmin.from('payments').insert({
                        restaurant_id: restaurantId,
                        subscription_id: updatedSub.id,
                        amount: inv.total,
                        currency: 'INR',
                        status: 'completed',
                        payment_method: 'Super Admin Manual Direct',
                        payment_gateway: 'Manual',
                        gateway_transaction_id: `pay_direct_${Date.now().toString().slice(-6)}`,
                        paid_at: periodStart,
                        metadata: { invoice_number: invNum, plan: planRecord?.name }
                    });
                }
            }

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: restaurantId,
                user_id: auth.user.userId,
                action: 'super_admin_convert_trial_to_paid',
                details: { planSlug, planName: planRecord?.name, billingCycle: cycle, amount, timestamp: new Date().toISOString() }
            });

            return NextResponse.json({ success: true, message: `Successfully converted restaurant to paid ${planRecord?.name || planSlug} plan.` });
        }

        // Cancel Trial
        if (action === 'cancel_trial') {
            const { reason = 'Trial terminated by Super Admin' } = body;

            await supabaseAdmin
                .from('subscriptions')
                .update({
                    status: 'canceled',
                    canceled_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('restaurant_id', restaurantId);

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: restaurantId,
                user_id: auth.user.userId,
                action: 'super_admin_cancel_trial',
                details: { reason, timestamp: new Date().toISOString() }
            });

            return NextResponse.json({ success: true, message: 'Trial cancelled successfully.' });
        }

        // Suspend Subscription & Restaurant
        if (action === 'suspend') {
            const { reason = 'Administrative policy suspension' } = body;

            await supabaseAdmin
                .from('subscriptions')
                .update({
                    status: 'past_due',
                    updated_at: new Date().toISOString()
                })
                .eq('restaurant_id', restaurantId);

            await supabaseAdmin
                .from('restaurants')
                .update({
                    status: 'SUSPENDED',
                    updated_at: new Date().toISOString()
                })
                .eq('id', restaurantId);

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: restaurantId,
                user_id: auth.user.userId,
                action: 'super_admin_suspend_subscription',
                details: { reason, timestamp: new Date().toISOString() }
            });

            return NextResponse.json({ success: true, message: 'Restaurant subscription suspended and access locked.' });
        }

        // Cancel Subscription
        if (action === 'cancel') {
            const { reason = 'Cancelled by Super Admin' } = body;

            await supabaseAdmin
                .from('subscriptions')
                .update({
                    status: 'canceled',
                    canceled_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('restaurant_id', restaurantId);

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: restaurantId,
                user_id: auth.user.userId,
                action: 'super_admin_cancel_subscription',
                details: { reason, timestamp: new Date().toISOString() }
            });

            return NextResponse.json({ success: true, message: 'Subscription successfully cancelled.' });
        }

        // Reactivate Subscription
        if (action === 'reactivate') {
            const { planSlug = 'growth', billingCycle = 'monthly' } = body;
            const cycle = billingCycle === 'annual' ? 'annual' : 'monthly';

            const { data: planRecord } = await supabaseAdmin
                .from('plans')
                .select('*')
                .eq('slug', planSlug.toLowerCase())
                .maybeSingle();

            const amount = cycle === 'annual' ? (planRecord?.price_annual || 49990) : (planRecord?.price_monthly || 4999);
            const periodEndDays = cycle === 'annual' ? 365 : 30;

            await supabaseAdmin
                .from('subscriptions')
                .update({
                    status: 'active',
                    plan_name: planSlug,
                    plan_type: cycle,
                    amount,
                    canceled_at: null,
                    current_period_start: new Date().toISOString(),
                    current_period_end: new Date(Date.now() + periodEndDays * 24 * 60 * 60 * 1000).toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('restaurant_id', restaurantId);

            await supabaseAdmin
                .from('restaurants')
                .update({
                    status: 'ACTIVE',
                    subscription_plan: planRecord?.name || planSlug,
                    updated_at: new Date().toISOString()
                })
                .eq('id', restaurantId);

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: restaurantId,
                user_id: auth.user.userId,
                action: 'super_admin_reactivate_subscription',
                details: { planSlug, billingCycle: cycle, amount, timestamp: new Date().toISOString() }
            });

            return NextResponse.json({ success: true, message: 'Subscription reactivated and restored to active service.' });
        }

        // Record Manual Payment
        if (action === 'record_payment' || action === 'record_manual_payment') {
            const { amount = 4999, paymentMethod = 'Bank Transfer', notes = '', days = 30 } = body;
            const periodStart = new Date().toISOString();
            const periodEnd = new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000).toISOString();

            const { data: sub } = await supabaseAdmin
                .from('subscriptions')
                .update({
                    status: 'active',
                    amount: Number(amount),
                    current_period_start: periodStart,
                    current_period_end: periodEnd,
                    updated_at: new Date().toISOString()
                })
                .eq('restaurant_id', restaurantId)
                .select()
                .maybeSingle();

            const invNum = `INV-${Date.now().toString().slice(-6)}`;
            const tax = Math.round(Number(amount) * 0.18 * 100) / 100;
            const total = Math.round(Number(amount) * 1.18 * 100) / 100;

            const { data: invoice } = await supabaseAdmin.from('invoices').insert({
                restaurant_id: restaurantId,
                subscription_id: sub?.id || null,
                invoice_number: invNum,
                status: 'paid',
                subtotal: Number(amount),
                tax_amount: tax,
                tax_rate: 18,
                total,
                currency: 'INR',
                billing_period_start: periodStart,
                billing_period_end: periodEnd,
                due_date: periodStart,
                paid_at: periodStart,
                notes: notes || 'Direct manual payment confirmed by Super Admin',
                metadata: { payment_method: paymentMethod }
            }).select().single();

            const { data: payment } = await supabaseAdmin.from('payments').insert({
                restaurant_id: restaurantId,
                subscription_id: sub?.id || null,
                amount: total,
                currency: 'INR',
                status: 'completed',
                payment_method: paymentMethod,
                payment_gateway: 'Manual Direct',
                gateway_transaction_id: `man_${Date.now().toString().slice(-6)}`,
                paid_at: periodStart,
                metadata: { invoice_number: invNum, notes }
            }).select().single();

            if (invoice && payment) {
                await supabaseAdmin.from('invoices').update({ payment_id: payment.id }).eq('id', invoice.id);
            }

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: restaurantId,
                user_id: auth.user.userId,
                action: 'super_admin_manual_payment_recorded',
                details: { amount: total, invoiceNumber: invNum, paymentMethod, timestamp: new Date().toISOString() }
            });

            return NextResponse.json({ success: true, message: `Recorded payment of ₹${total.toLocaleString('en-IN')} and generated invoice ${invNum}.` });
        }

        // ==========================================
        // 3. FEATURE OVERRIDE ACTIONS
        // ==========================================
        if (action === 'set_feature_override') {
            const { featureKey, enabled = true, reason, expiryDays } = body;
            if (!featureKey) {
                return NextResponse.json({ error: 'featureKey is required' }, { status: 400 });
            }

            const startsAt = new Date().toISOString();
            const expiresAt = expiryDays && Number(expiryDays) > 0 
                ? new Date(Date.now() + Number(expiryDays) * 24 * 60 * 60 * 1000).toISOString() 
                : null;

            const { data: override, error: ovErr } = await supabaseAdmin
                .from('restaurant_feature_overrides')
                .upsert({
                    restaurant_id: restaurantId,
                    feature_key: featureKey,
                    enabled: Boolean(enabled),
                    reason: reason || 'Administrative feature override granted by Super Admin',
                    created_by: auth.user.email || 'Super Admin',
                    starts_at: startsAt,
                    expires_at: expiresAt,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'restaurant_id,feature_key' })
                .select()
                .single();

            if (ovErr) {
                return NextResponse.json({ error: ovErr.message }, { status: 500 });
            }

            // Sync with subscriptions.feature_overrides cache column
            const { data: allActive } = await supabaseAdmin
                .from('restaurant_feature_overrides')
                .select('*')
                .eq('restaurant_id', restaurantId);

            await supabaseAdmin
                .from('subscriptions')
                .update({ feature_overrides: allActive || [], updated_at: new Date().toISOString() })
                .eq('restaurant_id', restaurantId);

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: restaurantId,
                user_id: auth.user.userId,
                action: 'super_admin_set_feature_override',
                details: { 
                    featureKey, 
                    enabled: Boolean(enabled), 
                    reason, 
                    expiryDays, 
                    expiresAt, 
                    timestamp: new Date().toISOString() 
                }
            });

            return NextResponse.json({ 
                success: true, 
                override, 
                message: `Feature "${featureKey}" override ${enabled ? 'granted' : 'revoked'} successfully.` 
            });
        }

        if (action === 'remove_feature_override') {
            const { featureKey } = body;
            if (!featureKey) {
                return NextResponse.json({ error: 'featureKey is required' }, { status: 400 });
            }

            await supabaseAdmin
                .from('restaurant_feature_overrides')
                .delete()
                .eq('restaurant_id', restaurantId)
                .eq('feature_key', featureKey);

            const { data: allActive } = await supabaseAdmin
                .from('restaurant_feature_overrides')
                .select('*')
                .eq('restaurant_id', restaurantId);

            await supabaseAdmin
                .from('subscriptions')
                .update({ feature_overrides: allActive || [], updated_at: new Date().toISOString() })
                .eq('restaurant_id', restaurantId);

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: restaurantId,
                user_id: auth.user.userId,
                action: 'super_admin_remove_feature_override',
                details: { featureKey, timestamp: new Date().toISOString() }
            });

            return NextResponse.json({ 
                success: true, 
                message: `Feature override for "${featureKey}" removed successfully.` 
            });
        }

        return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    } catch (err: any) {
        console.error('Super Admin subscriptions PATCH error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
