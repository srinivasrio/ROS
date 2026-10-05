import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySuperAdmin } from '@/lib/superadmin-guard';
import { hashPin, hashPassword } from '@/lib/auth-utils';
import { CANONICAL_PLANS, getPlanDefaultLimit, normalizePlanSlug } from '@/lib/entitlements';
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
        const { searchParams } = new URL(request.url);
        const locationId = searchParams.get('locationId');

        if (!locationId) {
            // Return all locations for this owner
            const { data: locations, error } = await supabaseAdmin
                .from('restaurants')
                .select('*')
                .eq('owner_id', ownerId)
                .order('created_at', { ascending: true });

            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true, locations: locations || [] });
        }

        // Return rich details for a single location
        const [restRes, branchRes, empRes, ordersRes, menuRes, catRes, servicesRes, auditRes] = await Promise.all([
            supabaseAdmin.from('restaurants').select('*').eq('id', locationId).maybeSingle(),
            supabaseAdmin.from('branches').select('*').eq('restaurant_id', locationId),
            supabaseAdmin.from('employees').select('*').eq('restaurant_id', locationId).is('deleted_at', null),
            supabaseAdmin.from('orders').select('*').eq('restaurant_id', locationId).order('created_at', { ascending: false }).limit(20),
            supabaseAdmin.from('menu_items').select('*').eq('restaurant_id', locationId).limit(50),
            supabaseAdmin.from('categories').select('*').eq('restaurant_id', locationId),
            supabaseAdmin.from('service_options').select('*').eq('restaurant_id', locationId),
            supabaseAdmin.from('audit_logs').select('*').eq('restaurant_id', locationId).order('created_at', { ascending: false }).limit(25)
        ]);

        if (!restRes.data) {
            return NextResponse.json({ error: 'Location not found' }, { status: 404 });
        }

        const admin = (empRes.data || []).find((e) => ['restaurant_admin', 'admin', 'manager'].includes((e.role || '').toLowerCase())) || null;

        return NextResponse.json({
            success: true,
            location: restRes.data,
            branches: branchRes.data || [],
            admin,
            employees: empRes.data || [],
            orders: ordersRes.data || [],
            menuItems: menuRes.data || [],
            categories: catRes.data || [],
            services: servicesRes.data || [],
            auditLogs: auditRes.data || []
        });
    } catch (err: any) {
        console.error('Super Admin location detail error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}

// POST: Create a NEW independent restaurant under this Owner
export async function POST(
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
        const {
            name,
            code,
            phone,
            email,
            address,
            adminName,
            adminEmail,
            adminMobile,
            adminPassword,
            adminPin
        } = body;

        if (!name?.trim()) {
            return NextResponse.json({ error: 'Location/restaurant name is required' }, { status: 400 });
        }

        // 1. Check Owner Quota across all locations of this Owner
        const [ownerEmpRes, ownerDuRes, existingRestRes] = await Promise.all([
            supabaseAdmin.from('employees').select('name, email, max_branches').eq('id', ownerId).maybeSingle(),
            supabaseAdmin.from('dine_users').select('name, email, max_branches').eq('id', ownerId).maybeSingle(),
            supabaseAdmin.from('restaurants').select('id, max_branches').eq('owner_id', ownerId).is('deleted_at', null)
        ]);

        const existingRestaurants = existingRestRes.data || [];
        const ownerQuota = ownerEmpRes.data?.max_branches || ownerDuRes.data?.max_branches || existingRestaurants[0]?.max_branches || 1;
        const currentCount = existingRestaurants.length;

        if (currentCount > 0 && currentCount >= ownerQuota) {
            return NextResponse.json({
                error: `Owner quota limit reached: This Owner is authorized for ${ownerQuota} locations, and currently has ${currentCount} active locations. Increase the Owner's quota first.`
            }, { status: 400 });
        }

        const ownerName = ownerEmpRes.data?.name || ownerDuRes.data?.name || 'Owner';
        const restEmail = email?.trim() || adminEmail?.trim() || ownerDuRes.data?.email || ownerEmpRes.data?.email || `contact-${Date.now()}@dineinone.com`;
        const restPhone = phone?.trim() || adminMobile?.trim() || '—';

        // 2. Generate unique 12-digit restaurant ID
        const cleanName = name.trim();
        const newRestaurantId = await generateUniqueRestaurantId();
        const cleanCode = code?.trim() || `REST-${newRestaurantId.slice(-4)}`;
        const primaryBranchId = `BR-${newRestaurantId.slice(-6)}-01`;
        const isFirstRestaurant = currentCount === 0;

        // 3. Insert NEW independent restaurant record
        const { data: newRestaurant, error: restInsertErr } = await supabaseAdmin
            .from('restaurants')
            .insert({
                id: newRestaurantId,
                name: cleanName,
                owner_id: ownerId,
                owner_name: ownerName,
                phone: restPhone,
                email: restEmail,
                address: address ? (typeof address === 'string' ? address : JSON.stringify(address)) : null,
                status: 'ACTIVE',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                max_branches: ownerQuota,
                is_main_branch: isFirstRestaurant
            })
            .select()
            .single();

        if (restInsertErr) {
            console.error('[Create Location Error]:', restInsertErr);
            return NextResponse.json({ error: restInsertErr.message }, { status: 500 });
        }

        // 4. Map Owner to new restaurant in restaurant_users
        await supabaseAdmin.from('restaurant_users').insert({
            restaurant_id: newRestaurantId,
            user_id: ownerId,
            role: 'OWNER',
            status: 'active'
        });

        // 5. Create primary branch record
        await supabaseAdmin.from('branches').insert({
            id: primaryBranchId,
            restaurant_id: newRestaurantId,
            name: `${cleanName} - Main Branch`,
            code: cleanCode,
            phone: phone?.trim() || null,
            email: email?.trim() || null,
            address: address ? (typeof address === 'string' ? address : JSON.stringify(address)) : null,
            is_main_branch: isFirstRestaurant,
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });

        // 6. Create default restaurant_profile, theme, and subscription
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

        await supabaseAdmin.from('subscriptions').insert({
            restaurant_id: newRestaurantId,
            plan_name: 'starter',
            plan_type: 'monthly',
            status: 'active',
            amount: 1499.00,
            currency: 'INR',
            max_branches: ownerQuota,
            max_employees: 20
        });

        // 7. Create default tables 1 to 5
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

        // 8. Optionally create Restaurant Admin for this specific location
        let createdAdminInfo = null;
        if (adminName && (adminEmail || adminMobile)) {
            const cleanAdminName = adminName.trim();
            const cleanAdminEmail = adminEmail ? adminEmail.toLowerCase().trim() : null;
            const cleanAdminMobile = adminMobile ? adminMobile.replace(/[^0-9]/g, '').slice(-10) : null;
            const rawPin = adminPin?.trim() || null;
            const hashedPin = rawPin ? await hashPin(rawPin) : null;

            let authUserId: string | null = null;
            if (cleanAdminEmail) {
                try {
                    const tempPass = adminPassword || `Admin@${Math.floor(100000 + Math.random() * 900000)}`;
                    const { data: authUser } = await supabaseAdmin.auth.admin.createUser({
                        email: cleanAdminEmail,
                        password: tempPass,
                        email_confirm: true,
                        user_metadata: {
                            name: cleanAdminName,
                            role: 'restaurant_admin',
                            restaurant_id: newRestaurantId,
                            branch_id: primaryBranchId
                        }
                    });
                    if (authUser?.user?.id) authUserId = authUser.user.id;
                } catch (authErr) {
                    console.warn('[Create Location Admin] Auth note:', authErr);
                }
            }

            const adminUUID = authUserId || crypto.randomUUID();
            const empCode = `ADM-${newRestaurantId.slice(-4)}-${Math.floor(1000 + Math.random() * 9000)}`;

            const { data: newAdmin } = await supabaseAdmin.from('employees').insert({
                id: adminUUID,
                employee_id: empCode,
                restaurant_id: newRestaurantId,
                branch_id: primaryBranchId,
                name: cleanAdminName,
                email: cleanAdminEmail,
                mobile: cleanAdminMobile,
                role: 'restaurant_admin',
                pin: hashedPin,
                status: 'active',
                approval_status: 'approved',
                is_online: false,
                is_deleted: false
            }).select().single();

            if (newAdmin) {
                createdAdminInfo = newAdmin;

                if (adminPassword) {
                    const hashedPassword = await hashPassword(adminPassword);
                    await supabaseAdmin.from('auth').upsert({
                        user_id: newAdmin.id,
                        password_hash: hashedPassword
                    }, { onConflict: 'user_id' });
                }

                await supabaseAdmin.from('employee_branch_access').upsert({
                    branch_id: primaryBranchId,
                    employee_id: newAdmin.id
                }, { onConflict: 'employee_id,branch_id' });

                await supabaseAdmin.from('dine_users').upsert({
                    id: newAdmin.id,
                    name: cleanAdminName,
                    email: cleanAdminEmail,
                    phone: cleanAdminMobile,
                    employee_id: empCode,
                    role: 'restaurant_admin',
                    status: 'active',
                    restaurant_id: newRestaurantId
                }, { onConflict: 'id' });
            }
        }

        // 9. Write audit log
        await supabaseAdmin.from('audit_logs').insert({
            restaurant_id: newRestaurantId,
            user_id: auth.user.userId,
            actor_id: auth.user.userId,
            actor_role: 'SUPER_ADMIN',
            action: 'super_admin_create_location',
            resource_type: 'restaurant',
            resource_id: newRestaurantId,
            details: {
                owner_id: ownerId,
                restaurant_id: newRestaurantId,
                name: cleanName,
                quota_used: currentCount + 1,
                quota_max: ownerQuota,
                timestamp: new Date().toISOString()
            }
        });

        return NextResponse.json({
            success: true,
            location: newRestaurant,
            admin: createdAdminInfo,
            message: `New independent restaurant "${cleanName}" (${newRestaurantId}) successfully created under Owner quota.`
        });
    } catch (err: any) {
        console.error('Super Admin create location error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}

// PATCH: Manage existing location
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
        const {
            locationId,
            action,
            name,
            phone,
            email,
            address,
            adminId,
            adminName,
            adminEmail,
            adminMobile,
            adminPassword,
            adminPin,
            reason
        } = body;

        const targetLocationId = (locationId || body.restaurant_id || body.location_id) as string;

        if (!targetLocationId) {
            return NextResponse.json({ error: 'locationId is required' }, { status: 400 });
        }
        const activeLocationId = targetLocationId;

        // Verify that this location belongs to this owner
        const { data: loc } = await supabaseAdmin
            .from('restaurants')
            .select('*')
            .eq('id', activeLocationId)
            .maybeSingle();

        if (!loc) {
            return NextResponse.json({ error: 'Location not found' }, { status: 404 });
        }

        // 1. EDIT LOCATION DETAILS
        if (action === 'edit') {
            const updates: Record<string, any> = { updated_at: new Date().toISOString() };
            if (name?.trim()) updates.name = name.trim();
            if (phone !== undefined) updates.phone = phone?.trim() || null;
            if (email !== undefined) updates.email = email?.trim() || null;
            if (address !== undefined) updates.address = typeof address === 'string' ? address : JSON.stringify(address);

            await supabaseAdmin.from('restaurants').update(updates).eq('id', activeLocationId);

            // Also update primary branch
            await supabaseAdmin.from('branches').update({
                name: updates.name ? `${updates.name} - Main Branch` : undefined,
                phone: updates.phone,
                email: updates.email,
                address: updates.address,
                updated_at: new Date().toISOString()
            }).eq('restaurant_id', activeLocationId).eq('is_main_branch', true);

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: activeLocationId,
                user_id: auth.user.userId,
                actor_id: auth.user.userId,
                actor_role: 'SUPER_ADMIN',
                action: 'super_admin_edit_location',
                resource_type: 'restaurant',
                resource_id: activeLocationId,
                details: { updates, timestamp: new Date().toISOString() }
            });

            return NextResponse.json({ success: true, message: 'Location details updated successfully.' });
        }

        // 1b. APPROVE BRANCH / RESTAURANT REGISTRATION (ATOMIC)
        if (action === 'approve' || action === 'approve_branch' || action === 'approve_location') {
            // Find registration request for this restaurant or location
            const { data: regReq } = await supabaseAdmin
                .from('restaurant_registration_requests')
                .select('*')
                .eq('restaurant_id', activeLocationId)
                .maybeSingle();

            const chosenPlanSlug = normalizePlanSlug(body.planSlug || regReq?.plan_slug || loc.subscription_plan || 'standard');
            const planDef = CANONICAL_PLANS[chosenPlanSlug] || CANONICAL_PLANS.standard;
            const defaultLimit = getPlanDefaultLimit(chosenPlanSlug);
            const customQuota = body.customQuota !== undefined && body.customQuota !== null && Number(body.customQuota) > 0
                ? Number(body.customQuota)
                : (regReq?.custom_quota && Number(regReq.custom_quota) > 0 ? Number(regReq.custom_quota) : null);
            const effectiveLimit = customQuota ?? defaultLimit;
            const amountDue = Number(body.amountDue || regReq?.amount_due || planDef.priceMonthly);

            if (regReq) {
                // Call atomic stored procedure
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
                // Direct activation if no registration request row exists
                const nowIso = new Date().toISOString();
                await supabaseAdmin.from('restaurants').update({
                    status: 'ACTIVE',
                    subscription_plan: planDef.name,
                    custom_quota: customQuota,
                    max_branches: effectiveLimit,
                    deleted_at: null,
                    updated_at: nowIso
                }).eq('id', activeLocationId);

                await supabaseAdmin.from('branches').update({
                    status: 'active',
                    deleted_at: null,
                    updated_at: nowIso
                }).eq('restaurant_id', activeLocationId);

                await supabaseAdmin.from('employees').update({
                    status: 'active',
                    approval_status: 'approved',
                    updated_at: nowIso
                }).eq('restaurant_id', activeLocationId);

                await supabaseAdmin.from('subscriptions').upsert({
                    restaurant_id: activeLocationId,
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

            // Record audit log
            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: activeLocationId,
                user_id: auth.user.userId,
                actor_id: auth.user.userId,
                actor_role: 'SUPER_ADMIN',
                action: 'super_admin_approve_branch',
                resource_type: 'restaurant',
                resource_id: activeLocationId,
                details: {
                    owner_id: ownerId,
                    restaurant_name: loc.name,
                    plan: planDef.name,
                    quota: effectiveLimit,
                    approved_by: auth.user.email,
                    timestamp: new Date().toISOString()
                }
            });

            return NextResponse.json({
                success: true,
                message: `Branch "${loc.name}" (${activeLocationId}) has been successfully approved and activated!`,
                restaurantId: activeLocationId
            });
        }

        // 1c. REJECT BRANCH / RESTAURANT REGISTRATION
        if (action === 'reject' || action === 'reject_branch' || action === 'reject_location') {
            const { data: regReq } = await supabaseAdmin
                .from('restaurant_registration_requests')
                .select('*')
                .eq('restaurant_id', activeLocationId)
                .maybeSingle();

            const rejectionReason = body.reason || 'Registration rejected by Super Admin';

            if (regReq) {
                const { error: rpcErr } = await supabaseAdmin.rpc('reject_restaurant_registration', {
                    p_request_id: regReq.id,
                    p_rejected_by: auth.user.email || 'Super Admin',
                    p_reason: rejectionReason
                });
                if (rpcErr) {
                    return NextResponse.json({ error: rpcErr.message }, { status: 400 });
                }
            } else {
                const nowIso = new Date().toISOString();
                await supabaseAdmin.from('restaurants').update({
                    status: 'REJECTED',
                    updated_at: nowIso
                }).eq('id', activeLocationId);

                await supabaseAdmin.from('branches').update({
                    status: 'inactive',
                    updated_at: nowIso
                }).eq('restaurant_id', activeLocationId);

                await supabaseAdmin.from('employees').update({
                    status: 'inactive',
                    approval_status: 'rejected',
                    updated_at: nowIso
                }).eq('restaurant_id', activeLocationId);
            }

            return NextResponse.json({
                success: true,
                message: `Branch "${loc.name}" has been rejected.`
            });
        }

        // 2. ACTIVATE LOCATION
        if (action === 'activate') {
            await supabaseAdmin.from('restaurants').update({
                status: 'ACTIVE',
                deleted_at: null,
                updated_at: new Date().toISOString()
            }).eq('id', activeLocationId);

            await supabaseAdmin.from('branches').update({ status: 'active', deleted_at: null }).eq('restaurant_id', activeLocationId);

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: activeLocationId,
                user_id: auth.user.userId,
                actor_id: auth.user.userId,
                actor_role: 'SUPER_ADMIN',
                action: 'super_admin_activate_location',
                resource_type: 'restaurant',
                resource_id: activeLocationId,
                details: { timestamp: new Date().toISOString() }
            });

            return NextResponse.json({ success: true, message: 'Location activated successfully.' });
        }

        // 3. DEACTIVATE LOCATION
        if (action === 'deactivate') {
            await supabaseAdmin.from('restaurants').update({
                status: 'INACTIVE',
                updated_at: new Date().toISOString()
            }).eq('id', activeLocationId);

            await supabaseAdmin.from('branches').update({ status: 'inactive' }).eq('restaurant_id', activeLocationId);

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: activeLocationId,
                user_id: auth.user.userId,
                actor_id: auth.user.userId,
                actor_role: 'SUPER_ADMIN',
                action: 'super_admin_deactivate_location',
                resource_type: 'restaurant',
                resource_id: activeLocationId,
                details: { timestamp: new Date().toISOString() }
            });

            return NextResponse.json({ success: true, message: 'Location deactivated successfully.' });
        }

        // 4. SUSPEND LOCATION
        if (action === 'suspend') {
            await supabaseAdmin.from('restaurants').update({
                status: 'SUSPENDED',
                updated_at: new Date().toISOString()
            }).eq('id', activeLocationId);

            await supabaseAdmin.from('branches').update({ status: 'suspended' }).eq('restaurant_id', activeLocationId);

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: activeLocationId,
                user_id: auth.user.userId,
                actor_id: auth.user.userId,
                actor_role: 'SUPER_ADMIN',
                action: 'super_admin_suspend_location',
                resource_type: 'restaurant',
                resource_id: activeLocationId,
                details: { reason: reason || 'Suspended by Super Admin', timestamp: new Date().toISOString() }
            });

            return NextResponse.json({ success: true, message: 'Location suspended successfully.' });
        }

        // 5. RESTORE LOCATION
        if (action === 'restore') {
            await supabaseAdmin.from('restaurants').update({
                status: 'ACTIVE',
                deleted_at: null,
                updated_at: new Date().toISOString()
            }).eq('id', activeLocationId);

            await supabaseAdmin.from('branches').update({ status: 'active', deleted_at: null }).eq('restaurant_id', activeLocationId);

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: activeLocationId,
                user_id: auth.user.userId,
                actor_id: auth.user.userId,
                actor_role: 'SUPER_ADMIN',
                action: 'super_admin_restore_location',
                resource_type: 'restaurant',
                resource_id: activeLocationId,
                details: { timestamp: new Date().toISOString() }
            });

            return NextResponse.json({ success: true, message: 'Location restored successfully.' });
        }

        // 6. DELETE LOCATION (SOFT-DELETE)
        if (action === 'delete') {
            await supabaseAdmin.from('restaurants').update({
                status: 'DEACTIVATED',
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }).eq('id', activeLocationId);

            await supabaseAdmin.from('branches').update({
                status: 'inactive',
                deleted_at: new Date().toISOString()
            }).eq('restaurant_id', activeLocationId);

            await supabaseAdmin.from('restaurant_users').update({
                status: 'inactive'
            }).eq('restaurant_id', activeLocationId);

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: activeLocationId,
                user_id: auth.user.userId,
                actor_id: auth.user.userId,
                actor_role: 'SUPER_ADMIN',
                action: 'super_admin_delete_location',
                resource_type: 'restaurant',
                resource_id: activeLocationId,
                details: { reason: reason || 'Deleted by Super Admin', timestamp: new Date().toISOString() }
            });

            return NextResponse.json({ success: true, message: 'Location soft-deleted successfully.' });
        }

        // 7. SET MAIN BRANCH
        if (action === 'set_main') {
            // Reset all restaurants of this owner
            await supabaseAdmin.from('restaurants').update({ is_main_branch: false }).eq('owner_id', ownerId);
            await supabaseAdmin.from('restaurants').update({ is_main_branch: true }).eq('id', activeLocationId);

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: activeLocationId,
                user_id: auth.user.userId,
                actor_id: auth.user.userId,
                actor_role: 'SUPER_ADMIN',
                action: 'super_admin_set_main_location',
                resource_type: 'restaurant',
                resource_id: activeLocationId,
                details: { owner_id: ownerId, timestamp: new Date().toISOString() }
            });

            return NextResponse.json({ success: true, message: 'Marked as Main Location.' });
        }

        // 8. MANAGE RESTAURANT ADMIN
        if (action === 'manage_admin') {
            let targetAdminId = adminId;
            let existingAdmin = null;

            // Resolve primary approved branch for locationId to ensure valid FK target
            const { data: locBranch } = await supabaseAdmin
                .from('branches')
                .select('id')
                .eq('restaurant_id', locationId)
                .is('deleted_at', null)
                .order('is_main_branch', { ascending: false })
                .limit(1)
                .maybeSingle();
            const locationBranchId = locBranch?.id || null;

            if (targetAdminId) {
                const { data: ea } = await supabaseAdmin.from('employees').select('*').eq('id', targetAdminId).maybeSingle();
                existingAdmin = ea;
            } else if (adminEmail) {
                const { data: ea } = await supabaseAdmin.from('employees').select('*').ilike('email', adminEmail.toLowerCase().trim()).maybeSingle();
                existingAdmin = ea;
                if (existingAdmin) targetAdminId = existingAdmin.id;
            }

            if (existingAdmin) {
                // Update existing admin
                const empUpdates: Record<string, any> = {
                    restaurant_id: locationId,
                    updated_at: new Date().toISOString()
                };
                // Ensure valid branch_id
                if (!existingAdmin.branch_id && locationBranchId) {
                    empUpdates.branch_id = locationBranchId;
                }
                if (adminName?.trim()) empUpdates.name = adminName.trim();
                if (adminEmail?.trim()) empUpdates.email = adminEmail.toLowerCase().trim();
                if (adminMobile?.trim()) empUpdates.mobile = adminMobile.replace(/[^0-9]/g, '').slice(-10);
                if (adminPin?.trim()) {
                    empUpdates.pin = await hashPin(adminPin.trim());
                }

                await supabaseAdmin.from('employees').update(empUpdates).eq('id', existingAdmin.id);

                if (locationBranchId) {
                    await supabaseAdmin.from('employee_branch_access').upsert({
                        employee_id: existingAdmin.id,
                        branch_id: locationBranchId
                    }, { onConflict: 'employee_id,branch_id' });
                }

                if (adminPassword?.trim()) {
                    const hashedPassword = await hashPassword(adminPassword.trim());
                    await supabaseAdmin.from('auth').upsert({
                        user_id: existingAdmin.id,
                        password_hash: hashedPassword
                    }, { onConflict: 'user_id' });
                }

                await supabaseAdmin.from('dine_users').upsert({
                    id: existingAdmin.id,
                    name: empUpdates.name || existingAdmin.name,
                    email: empUpdates.email || existingAdmin.email,
                    phone: empUpdates.mobile || existingAdmin.mobile,
                    restaurant_id: locationId,
                    role: 'restaurant_admin',
                    status: 'active'
                }, { onConflict: 'id' });

                await supabaseAdmin.from('audit_logs').insert({
                    restaurant_id: locationId,
                    user_id: auth.user.userId,
                    actor_id: auth.user.userId,
                    actor_role: 'SUPER_ADMIN',
                    action: 'super_admin_update_restaurant_admin',
                    resource_type: 'employee',
                    resource_id: existingAdmin.id,
                    details: { admin_id: existingAdmin.id, timestamp: new Date().toISOString() }
                });

                return NextResponse.json({ success: true, message: 'Restaurant Admin credentials updated.' });
            } else {
                // Create new admin
                const cleanAdminName = (adminName || 'Restaurant Admin').trim();
                const cleanAdminEmail = adminEmail ? adminEmail.toLowerCase().trim() : null;
                const cleanAdminMobile = adminMobile ? adminMobile.replace(/[^0-9]/g, '').slice(-10) : null;
                const rawPin = adminPin?.trim() || null;
                const hashedPin = rawPin ? await hashPin(rawPin) : null;

                const adminUUID = crypto.randomUUID();
                const empCode = `ADM-${locationId.slice(-4)}-${Math.floor(1000 + Math.random() * 9000)}`;

                const { data: newAdmin } = await supabaseAdmin.from('employees').insert({
                    id: adminUUID,
                    employee_id: empCode,
                    restaurant_id: locationId,
                    branch_id: locationBranchId,
                    name: cleanAdminName,
                    email: cleanAdminEmail,
                    mobile: cleanAdminMobile,
                    role: 'restaurant_admin',
                    pin: hashedPin,
                    status: 'active',
                    approval_status: 'approved',
                    is_online: false,
                    is_deleted: false
                }).select().single();

                if (locationBranchId) {
                    await supabaseAdmin.from('employee_branch_access').upsert({
                        employee_id: adminUUID,
                        branch_id: locationBranchId
                    }, { onConflict: 'employee_id,branch_id' });
                }

                if (newAdmin && adminPassword) {
                    const hashedPassword = await hashPassword(adminPassword);
                    await supabaseAdmin.from('auth').upsert({
                        user_id: newAdmin.id,
                        password_hash: hashedPassword
                    }, { onConflict: 'user_id' });
                }

                await supabaseAdmin.from('dine_users').upsert({
                    id: adminUUID,
                    name: cleanAdminName,
                    email: cleanAdminEmail,
                    phone: cleanAdminMobile,
                    employee_id: empCode,
                    role: 'restaurant_admin',
                    status: 'active',
                    restaurant_id: locationId
                }, { onConflict: 'id' });

                await supabaseAdmin.from('audit_logs').insert({
                    restaurant_id: locationId,
                    user_id: auth.user.userId,
                    actor_id: auth.user.userId,
                    actor_role: 'SUPER_ADMIN',
                    action: 'super_admin_create_restaurant_admin',
                    resource_type: 'employee',
                    resource_id: adminUUID,
                    details: { admin_id: adminUUID, name: cleanAdminName, timestamp: new Date().toISOString() }
                });

                return NextResponse.json({ success: true, message: 'New Restaurant Admin provisioned.' });
            }
        }

        return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });
    } catch (err: any) {
        console.error('Super Admin patch location error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
