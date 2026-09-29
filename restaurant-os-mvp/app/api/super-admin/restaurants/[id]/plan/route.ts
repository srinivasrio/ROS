import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySuperAdmin } from '@/lib/superadmin-guard';

const ALLOWED_PLANS = ['Basic', 'Pro', 'Enterprise'];

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
        const { updateStatus } = body;
        const rawPlan = (body.plan || '').trim().toLowerCase();
        const planMatch = ALLOWED_PLANS.find(p => p.toLowerCase() === rawPlan);

        if (!planMatch) {
            return NextResponse.json({ 
                error: `Invalid subscription plan. Allowed plans: ${ALLOWED_PLANS.join(', ')}` 
            }, { status: 400 });
        }
        const plan = planMatch;

        // Fetch current status
        const { data: rest, error: restError } = await supabaseAdmin
            .from('restaurants')
            .select('status')
            .eq('id', id)
            .maybeSingle();

        if (restError || !rest) {
            return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
        }

        const updates: Record<string, any> = {
            subscription_plan: plan,
            updated_at: new Date().toISOString()
        };

        // If updateStatus flag is true or status is in onboarding/verification phase, advance to PLAN_ASSIGNED
        const currentStatus = (rest.status || '').toUpperCase();
        if (updateStatus || ['PENDING', 'CONTACTED', 'ONBOARDING', 'VERIFICATION'].includes(currentStatus)) {
            updates.status = 'PLAN_ASSIGNED';
        }

        const { error: updateError } = await supabaseAdmin
            .from('restaurants')
            .update(updates)
            .eq('id', id);

        if (updateError) {
            return NextResponse.json({ error: 'Failed to assign plan: ' + updateError.message }, { status: 500 });
        }

        // Log audit trail
        await supabaseAdmin.from('audit_logs').insert({
            restaurant_id: id,
            user_id: auth.user.userId,
            action: 'super_admin_plan_assignment',
            details: {
                assigned_plan: plan,
                updated_status: updates.status || currentStatus,
                timestamp: new Date().toISOString()
            }
        });

        return NextResponse.json({
            success: true,
            plan,
            status: updates.status || currentStatus,
            message: `Subscription plan '${plan}' assigned successfully.`
        });

    } catch (err: any) {
        console.error('Super Admin plan assignment error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
