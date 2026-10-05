import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySuperAdmin } from '@/lib/superadmin-guard';
import { formatAuditAction, formatAuditDetails, extractAuditBadges } from '@/lib/audit-formatters';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const { id } = await params;

        // Fetch primary restaurant
        const { data: rest, error: restError } = await supabaseAdmin
            .from('restaurants')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (restError || !rest) {
            return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
        }

        // Fetch legal details
        const { data: legal } = await supabaseAdmin
            .from('restaurant_legal')
            .select('*')
            .eq('restaurant_ref', id)
            .maybeSingle();

        // Fetch profile
        const { data: profile } = await supabaseAdmin
            .from('restaurant_profile')
            .select('*')
            .eq('restaurant_id', id)
            .maybeSingle();

        // Fetch branches
        const { data: branches } = await supabaseAdmin
            .from('branches')
            .select('*')
            .eq('restaurant_id', id)
            .order('created_at', { ascending: true });

        // Fetch all employees of this restaurant
        const { data: employees } = await supabaseAdmin
            .from('employees')
            .select('id, name, email, mobile, role, status, approval_status, created_at, branch_id')
            .eq('restaurant_id', id)
            .order('created_at', { ascending: false });

        // Fetch owner employee
        let owner = null;
        if (rest.owner_id) {
            const { data: emp } = await supabaseAdmin
                .from('employees')
                .select('id, name, email, mobile, role, status, approval_status, created_at')
                .eq('id', rest.owner_id)
                .maybeSingle();
            owner = emp;
        }

        // Fetch active subscription
        const { data: subscription } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('restaurant_id', id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        // Fetch real invoices
        const { data: invoices } = await supabaseAdmin
            .from('invoices')
            .select('*')
            .eq('restaurant_id', id)
            .order('created_at', { ascending: false });

        // Count real orders
        const { count: orderCount } = await supabaseAdmin
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('restaurant_id', id);

        // Fetch Audit Trail Logs
        const { data: rawAuditLogs } = await supabaseAdmin
            .from('audit_logs')
            .select('*')
            .eq('restaurant_id', id)
            .order('created_at', { ascending: false })
            .limit(30);

        const auditLogs = (rawAuditLogs || []).map((log: any) => ({
            ...log,
            actionTitle: formatAuditAction(log.action),
            description: formatAuditDetails(log.action, log.details, log),
            badges: extractAuditBadges(log)
        }));

        return NextResponse.json({
            success: true,
            restaurant: {
                id: rest.id,
                name: rest.name,
                ownerName: rest.owner_name,
                phone: rest.phone,
                email: rest.email,
                address: rest.address,
                status: (rest.status || 'PENDING').toUpperCase(),
                subscriptionPlan: subscription?.plan_name || rest.subscription_plan || 'Growth',
                openingDate: rest.opening_date,
                operatingHours: rest.operating_hours || {},
                operationalDetails: rest.operational_details || {},
                createdAt: rest.created_at,
                updatedAt: rest.updated_at,
                deletedAt: rest.deleted_at
            },
            legal: legal || {
                business_name: rest.name,
                business_type: profile?.business_type || 'Restaurant',
                business_constitution: '',
                gst_number: '',
                fssai_number: '',
                pan_number: '',
                shop_establishment_license: '',
                compliance_documents: []
            },
            profile: profile || {},
            branches: branches || [],
            employees: employees || [],
            owner: owner,
            subscription: subscription || null,
            invoices: invoices || [],
            orderCount: orderCount || 0,
            auditLogs: auditLogs || []
        });

    } catch (err: any) {
        console.error('Super Admin get restaurant detail error:', err);
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

        const { id } = await params;
        const body = await request.json();

        const {
            name,
            ownerName,
            phone,
            email,
            address,
            openingDate,
            operatingHours,
            operationalDetails,
            // Legal details
            legalBusinessName,
            businessType,
            businessConstitution,
            gstNumber,
            fssaiNumber,
            panNumber,
            shopLicense,
            complianceDocuments,
            // Branches
            branches
        } = body;

        // 1. Update restaurants table
        const restUpdates: Record<string, any> = {
            updated_at: new Date().toISOString()
        };
        if (name !== undefined) restUpdates.name = name.trim();
        if (ownerName !== undefined) restUpdates.owner_name = ownerName.trim();
        if (phone !== undefined) restUpdates.phone = phone.trim();
        if (email !== undefined) restUpdates.email = email.trim();
        if (address !== undefined) restUpdates.address = address;
        if (openingDate !== undefined) restUpdates.opening_date = openingDate || null;
        if (operatingHours !== undefined) restUpdates.operating_hours = operatingHours;
        if (operationalDetails !== undefined) restUpdates.operational_details = operationalDetails;

        const { error: restUpdateError } = await supabaseAdmin
            .from('restaurants')
            .update(restUpdates)
            .eq('id', id);

        if (restUpdateError) {
            return NextResponse.json({ error: 'Failed to update restaurant: ' + restUpdateError.message }, { status: 500 });
        }

        // 2. Update or Upsert restaurant_legal
        const legalUpdates: Record<string, any> = {
            restaurant_ref: id,
            updated_at: new Date().toISOString()
        };
        const resolvedLegalName = legalBusinessName !== undefined ? legalBusinessName : body.entityName;
        if (resolvedLegalName !== undefined) legalUpdates.business_name = resolvedLegalName;
        if (businessType !== undefined) legalUpdates.business_type = businessType;
        if (businessConstitution !== undefined) legalUpdates.business_constitution = businessConstitution;
        if (gstNumber !== undefined) legalUpdates.gst_number = gstNumber;
        if (fssaiNumber !== undefined) legalUpdates.fssai_number = fssaiNumber;
        if (panNumber !== undefined) legalUpdates.pan_number = panNumber;
        if (shopLicense !== undefined) legalUpdates.shop_establishment_license = shopLicense;
        if (complianceDocuments !== undefined) legalUpdates.compliance_documents = complianceDocuments;

        // Check if legal record exists
        const { data: existingLegal } = await supabaseAdmin
            .from('restaurant_legal')
            .select('id')
            .eq('restaurant_ref', id)
            .maybeSingle();

        if (existingLegal) {
            await supabaseAdmin
                .from('restaurant_legal')
                .update(legalUpdates)
                .eq('restaurant_ref', id);
        } else {
            await supabaseAdmin
                .from('restaurant_legal')
                .insert(legalUpdates);
        }

        // 3. Update restaurant_profile
        const profileUpdates: Record<string, any> = {};
        if (name !== undefined) profileUpdates.name = name.trim();
        if (businessType !== undefined) profileUpdates.business_type = businessType;
        if (address !== undefined) profileUpdates.address = address;
        if (phone !== undefined) profileUpdates.phone = phone;
        if (email !== undefined) profileUpdates.email = email;

        if (Object.keys(profileUpdates).length > 0) {
            await supabaseAdmin
                .from('restaurant_profile')
                .update(profileUpdates)
                .eq('restaurant_id', id);
        }

        // 4. Process branches if provided
        if (Array.isArray(branches)) {
            for (const b of branches) {
                if (b.is_deleted && b.id) {
                    await supabaseAdmin.from('branches').delete().eq('id', b.id);
                } else if (b.id) {
                    await supabaseAdmin.from('branches').update({
                        name: b.name,
                        address: b.address,
                        phone: b.phone,
                        email: b.email,
                        updated_at: new Date().toISOString()
                    }).eq('id', b.id);
                } else if (b.name) {
                    await supabaseAdmin.from('branches').insert({
                        restaurant_id: id,
                        name: b.name,
                        address: b.address || '',
                        phone: b.phone || '',
                        email: b.email || '',
                        is_main_branch: !!b.is_main_branch
                    });
                }
            }
        }

        // If status was updated in PATCH
        if (body.status !== undefined) {
            const rawStatus = String(body.status).toLowerCase();
            const statusUpdates: Record<string, any> = {
                status: rawStatus,
                updated_at: new Date().toISOString()
            };
            if (rawStatus === 'soft_deleted') {
                statusUpdates.deleted_at = new Date().toISOString();
            } else {
                statusUpdates.deleted_at = null;
            }

            await supabaseAdmin
                .from('restaurants')
                .update(statusUpdates)
                .eq('id', id);

            // Log lifecycle change
            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: id,
                user_id: auth.user.userId,
                action: `super_admin_status_change_${rawStatus}`,
                details: {
                    new_status: rawStatus,
                    reason: body.reason || 'Founder action',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Log audit event
        await supabaseAdmin.from('audit_logs').insert({
            restaurant_id: id,
            user_id: auth.user.userId,
            action: 'super_admin_update_details',
            details: {
                timestamp: new Date().toISOString()
            }
        });

        return NextResponse.json({
            success: true,
            message: 'Restaurant onboarding information updated successfully'
        });

    } catch (err: any) {
        console.error('Super Admin update restaurant error:', err);
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

        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const permanent = searchParams.get('permanent') === 'true';

        if (permanent) {
            // Cascading cleanup of dependent entities
            await supabaseAdmin.from('employee_branch_access').delete().eq('restaurant_id', id);
            await supabaseAdmin.from('restaurant_users').delete().eq('restaurant_id', id);
            await supabaseAdmin.from('support_tickets').delete().eq('restaurant_id', id);
            await supabaseAdmin.from('invoices').delete().eq('restaurant_id', id);
            await supabaseAdmin.from('subscriptions').delete().eq('restaurant_id', id);
            await supabaseAdmin.from('orders').delete().eq('restaurant_id', id);
            await supabaseAdmin.from('branches').delete().eq('restaurant_id', id);
            
            // Fetch employees to clean sessions & users
            const { data: emps } = await supabaseAdmin.from('employees').select('id').eq('restaurant_id', id);
            const empIds = (emps || []).map((e: any) => e.id);
            if (empIds.length > 0) {
                await supabaseAdmin.from('dine_sessions').delete().in('user_id', empIds);
                await supabaseAdmin.from('dine_users').delete().in('id', empIds);
            }

            await supabaseAdmin.from('employees').delete().eq('restaurant_id', id);
            await supabaseAdmin.from('restaurant_registration_requests').delete().eq('restaurant_id', id);
            await supabaseAdmin.from('restaurant_legal').delete().eq('restaurant_ref', id);
            await supabaseAdmin.from('restaurant_profile').delete().eq('restaurant_id', id);
            await supabaseAdmin.from('audit_logs').delete().eq('restaurant_id', id);
            
            const { error: delError } = await supabaseAdmin.from('restaurants').delete().eq('id', id);
            if (delError) {
                return NextResponse.json({ error: 'Failed to permanently delete restaurant: ' + delError.message }, { status: 500 });
            }

            return NextResponse.json({ success: true, message: 'Restaurant permanently deleted.' });
        } else {
            // Soft delete workflow: execute atomic stored procedure
            try {
                await supabaseAdmin.rpc('delete_restaurant_branch_atomic', {
                    p_restaurant_id: id,
                    p_deleted_by: auth.user.email || 'Super Admin',
                    p_reason: 'Super Admin soft delete'
                });
            } catch (rpcErr) {
                console.warn('[delete_restaurant_branch_atomic RPC warning]:', rpcErr);
            }

            const nowIso = new Date().toISOString();

            // Multi-table soft deletion & session revocation guarantee
            await supabaseAdmin
                .from('restaurants')
                .update({
                    status: 'soft_deleted',
                    deleted_at: nowIso,
                    updated_at: nowIso
                })
                .eq('id', id);

            await supabaseAdmin
                .from('branches')
                .update({
                    status: 'inactive',
                    deleted_at: nowIso,
                    updated_at: nowIso
                })
                .eq('restaurant_id', id);

            // Delete registration requests associated with the deleted restaurant
            await supabaseAdmin
                .from('restaurant_registration_requests')
                .delete()
                .eq('restaurant_id', id);

            await supabaseAdmin
                .from('subscriptions')
                .update({
                    status: 'cancelled',
                    updated_at: nowIso
                })
                .eq('restaurant_id', id);

            const { data: restEmps } = await supabaseAdmin
                .from('employees')
                .select('id')
                .eq('restaurant_id', id);

            const empIds = (restEmps || []).map((e: any) => e.id);
            if (empIds.length > 0) {
                await supabaseAdmin.from('dine_sessions').delete().in('user_id', empIds);
                await supabaseAdmin.from('employee_branch_access').delete().in('employee_id', empIds);
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
                await supabaseAdmin.from('dine_users').update({ status: 'inactive' }).in('id', empIds);
            }

            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: id,
                user_id: auth.user.userId,
                action: 'super_admin_soft_delete',
                details: {
                    restaurant_id: id,
                    revoked_employee_count: empIds.length,
                    timestamp: nowIso
                }
            });

            return NextResponse.json({ success: true, message: 'Restaurant soft deleted into retention pool, registration requests cancelled, and sessions revoked.' });
        }
    } catch (err: any) {
        console.error('Super admin delete error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}

export const PUT = PATCH;
