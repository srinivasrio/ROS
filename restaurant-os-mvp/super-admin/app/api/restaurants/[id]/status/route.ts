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

        // 2. If ACTIVE, activate the owner's employee and dine_users record
        if (upperStatus === 'ACTIVE') {
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

        // If SUSPENDED or REJECTED, mark owner as inactive/rejected
        if (upperStatus === 'SUSPENDED' || upperStatus === 'REJECTED') {
            if (rest.owner_id) {
                await supabaseAdmin
                    .from('employees')
                    .update({ 
                        status: 'inactive',
                        approval_status: upperStatus === 'REJECTED' ? 'rejected' : 'suspended'
                    })
                    .eq('id', rest.owner_id);
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
