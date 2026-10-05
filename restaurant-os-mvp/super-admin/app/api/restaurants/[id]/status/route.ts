import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySuperAdmin } from '@/lib/superadmin-guard';
import { seedRestaurantDefaults } from '@/lib/restaurant-defaults';

const ALLOWED_STATUSES = [
    'PENDING',
    'CONTACTED',
    'ONBOARDING',
    'VERIFICATION',
    'PLAN_ASSIGNED',
    'APPROVED',
    'ACTIVE',
    'REJECTED',
    'SUSPENDED'
];

export async function POST(
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
        const { status, reason } = body;

        if (!status) {
            return NextResponse.json({ error: 'Status is required' }, { status: 400 });
        }

        const upperStatus = status.toUpperCase().trim();
        if (!ALLOWED_STATUSES.includes(upperStatus)) {
            return NextResponse.json({ 
                error: `Invalid status. Allowed statuses: ${ALLOWED_STATUSES.join(', ')}` 
            }, { status: 400 });
        }

        // Fetch current restaurant details
        const { data: rest, error: restError } = await supabaseAdmin
            .from('restaurants')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (restError || !rest) {
            return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
        }

        // Activation rule: Must have subscription plan before activation
        if (upperStatus === 'ACTIVE') {
            if (!rest.subscription_plan) {
                return NextResponse.json({ 
                    error: 'Cannot activate restaurant without an assigned subscription plan. Please assign a subscription plan (Basic, Pro, or Enterprise) first.' 
                }, { status: 400 });
            }
        }

        // 1. Update restaurant status
        const { error: updateError } = await supabaseAdmin
            .from('restaurants')
            .update({ 
                status: upperStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (updateError) {
            return NextResponse.json({ error: 'Failed to update status: ' + updateError.message }, { status: 500 });
        }

        // 2. If ACTIVE, activate the branches, registration requests, admins, and owner
        if (upperStatus === 'ACTIVE') {
            const nowIso = new Date().toISOString();

            if (rest.owner_id) {
                await supabaseAdmin
                    .from('employees')
                    .update({ 
                        status: 'active',
                        approval_status: 'approved'
                    })
                    .eq('id', rest.owner_id);

                await supabaseAdmin
                    .from('dine_users')
                    .update({ status: 'active' })
                    .eq('id', rest.owner_id);
            }

            // Synchronize branches from pending to active
            await supabaseAdmin
                .from('branches')
                .update({ status: 'active', updated_at: nowIso })
                .eq('restaurant_id', id)
                .in('status', ['pending', 'pending_approval']);

            // Synchronize registration requests to APPROVED
            await supabaseAdmin
                .from('restaurant_registration_requests')
                .update({ 
                    approval_status: 'APPROVED', 
                    updated_at: nowIso 
                })
                .eq('restaurant_id', id)
                .in('approval_status', ['PENDING_APPROVAL', 'PENDING_PAYMENT', 'PENDING']);

            // Activate restaurant admins and staff
            await supabaseAdmin
                .from('employees')
                .update({ 
                    status: 'active', 
                    approval_status: 'approved',
                    updated_at: nowIso
                })
                .eq('restaurant_id', id)
                .in('role', ['restaurant_admin', 'admin']);

            // Activate restaurant_users mapping
            await supabaseAdmin
                .from('restaurant_users')
                .update({ status: 'active', updated_at: nowIso })
                .eq('restaurant_id', id);

            await supabaseAdmin
                .from('restaurant_legal')
                .update({ status: 'ACTIVE' })
                .eq('restaurant_ref', id);

            // Seed default theme, sections, services, and profile if missing
            await seedRestaurantDefaults(id, {
                name: rest.name,
                phone: rest.phone,
                email: rest.email,
                address: rest.address
            });
        }

        // If SUSPENDED or REJECTED, mark owner and staff as inactive, deactivate branches, and revoke sessions
        if (upperStatus === 'SUSPENDED' || upperStatus === 'REJECTED') {
            const nowIso = new Date().toISOString();

            // Deactivate branches
            await supabaseAdmin
                .from('branches')
                .update({ status: 'inactive', updated_at: nowIso })
                .eq('restaurant_id', id);

            // Update registration requests
            await supabaseAdmin
                .from('restaurant_registration_requests')
                .update({ 
                    approval_status: upperStatus === 'REJECTED' ? 'REJECTED' : 'SUSPENDED',
                    rejection_reason: reason || `Status set to ${upperStatus} by Super Admin`,
                    updated_at: nowIso 
                })
                .eq('restaurant_id', id)
                .in('approval_status', ['PENDING_APPROVAL', 'PENDING_PAYMENT', 'PENDING', 'APPROVED']);

            // Deactivate all employees
            await supabaseAdmin
                .from('employees')
                .update({ 
                    status: 'inactive',
                    approval_status: upperStatus === 'REJECTED' ? 'rejected' : 'suspended',
                    updated_at: nowIso
                })
                .eq('restaurant_id', id);

            // Deactivate restaurant_users
            await supabaseAdmin
                .from('restaurant_users')
                .update({ status: 'inactive', updated_at: nowIso })
                .eq('restaurant_id', id);

            // Revoke active sessions for all employees of this restaurant
            const { data: emps } = await supabaseAdmin
                .from('employees')
                .select('id')
                .eq('restaurant_id', id);

            const empIds = (emps || []).map((e: any) => e.id);
            if (rest.owner_id && !empIds.includes(rest.owner_id)) {
                empIds.push(rest.owner_id);
            }

            if (empIds.length > 0) {
                await supabaseAdmin
                    .from('dine_sessions')
                    .delete()
                    .in('user_id', empIds);
            }
        }

        // 3. Write audit log
        await supabaseAdmin.from('audit_logs').insert({
            restaurant_id: id,
            user_id: auth.user.userId,
            action: 'super_admin_status_change',
            details: {
                previous_status: rest.status,
                new_status: upperStatus,
                reason: reason || null,
                timestamp: new Date().toISOString()
            }
        });

        return NextResponse.json({
            success: true,
            status: upperStatus,
            message: `Restaurant status updated to ${upperStatus}`
        });

    } catch (err: any) {
        console.error('Super Admin status change error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
