import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySuperAdmin } from '@/lib/superadmin-guard';

export async function GET(request: Request) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        // 1. Fetch branches where deleted_at is null, restaurants, and employees
        const [branchRes, restRes, empRes] = await Promise.all([
            supabaseAdmin
                .from('branches')
                .select('*')
                .is('deleted_at', null)
                .order('created_at', { ascending: false }),
            supabaseAdmin.from('restaurants').select('id, name, owner_id, owner_name, status'),
            supabaseAdmin.from('employees').select('id, name, restaurant_id, branch_id')
        ]);

        const allRestaurants = restRes.data || [];
        const allEmployees = empRes.data || [];
        const branches = branchRes.data || [];

        const restMap = new Map();
        allRestaurants.forEach((r) => restMap.set(r.id, r));

        const formatted = branches.map((b: any) => {
            const parentRest = restMap.get(b.restaurant_id) || {};
            const staffCount = allEmployees.filter((e) => e.branch_id === b.id || e.restaurant_id === b.restaurant_id).length;

            return {
                id: b.id,
                name: b.name,
                code: b.code || b.id,
                restaurantId: b.restaurant_id,
                restaurantName: parentRest.name || 'Unknown Organization',
                ownerName: parentRest.owner_name || 'Unassigned',
                phone: b.phone || '—',
                email: b.email || '—',
                address: b.address || '—',
                isMainBranch: !!b.is_main_branch,
                employeesCount: staffCount,
                status: (b.status || 'active').toUpperCase(),
                createdAt: b.created_at,
            };
        });

        return NextResponse.json({
            success: true,
            branches: formatted,
            restaurants: allRestaurants,
        });
    } catch (err: any) {
        console.error('Super Admin branches API error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const body = await request.json();
        const { restaurantId, branchName, branchCode, phone, email, address, isMainBranch } = body;

        if (!restaurantId || !branchName) {
            return NextResponse.json({ error: 'Restaurant and branch name are required' }, { status: 400 });
        }

        // Verify restaurant branch limit
        const { data: restData } = await supabaseAdmin
            .from('restaurants')
            .select('id, name, max_branches')
            .eq('id', restaurantId)
            .maybeSingle();

        // Verify restaurant branch limit derived from restaurant record or active subscription
        let maxAllowed = typeof restData?.max_branches === 'number' && restData.max_branches > 0
            ? restData.max_branches
            : 0;

        if (maxAllowed === 0) {
            const { data: sub } = await supabaseAdmin
                .from('subscriptions')
                .select('max_branches, plan_limit')
                .eq('restaurant_id', restaurantId)
                .in('status', ['active', 'trialing'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (sub) {
                maxAllowed = sub.max_branches || sub.plan_limit || 0;
            }
        }

        const { count: currentBranchCount } = await supabaseAdmin
            .from('branches')
            .select('id', { count: 'exact', head: true })
            .eq('restaurant_id', restaurantId)
            .is('deleted_at', null);

        const currentCount = currentBranchCount || 0;
        if (maxAllowed > 0 && currentCount >= maxAllowed) {
            return NextResponse.json({
                error: `Branch limit reached: Restaurant "${restData?.name || restaurantId}" is restricted to ${maxAllowed} branch(es). Current branches: ${currentCount}. Please upgrade the subscription or increase the branch limit.`
            }, { status: 400 });
        } else if (maxAllowed === 0 && currentCount > 0) {
            return NextResponse.json({
                error: `No active subscription: Restaurant "${restData?.name || restaurantId}" has no active subscription quota. Please activate a subscription plan to add more branches.`
            }, { status: 400 });
        }

        const generatedId = branchCode && branchCode.trim()
            ? branchCode.trim()
            : `BR-${restaurantId.slice(-4)}-${Math.floor(1000 + Math.random() * 9000)}`;

        const { data: newBranch, error: insertError } = await supabaseAdmin
            .from('branches')
            .insert({
                id: generatedId,
                restaurant_id: restaurantId,
                name: branchName.trim(),
                code: branchCode ? branchCode.trim() : generatedId,
                address: address || '',
                phone: phone || '',
                email: email || '',
                is_main_branch: !!isMainBranch,
                status: 'active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (insertError) {
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        // Connect owner to this new branch in employee_branch_access
        const { data: rest } = await supabaseAdmin
            .from('restaurants')
            .select('owner_id')
            .eq('id', restaurantId)
            .maybeSingle();

        if (rest?.owner_id) {
            await supabaseAdmin
                .from('employee_branch_access')
                .upsert({
                    restaurant_id: restaurantId,
                    branch_id: generatedId,
                    employee_id: rest.owner_id,
                    role: 'restaurant_admin',
                    can_manage_pos: true,
                    can_view_reports: true,
                    can_manage_inventory: true,
                    can_manage_staff: true
                }, { onConflict: 'restaurant_id,branch_id,employee_id' });
        }

        // Audit log
        await supabaseAdmin.from('audit_logs').insert({
            restaurant_id: restaurantId,
            user_id: auth.user.userId,
            action: 'super_admin_create_branch',
            details: {
                branch_id: generatedId,
                branch_name: branchName,
                timestamp: new Date().toISOString(),
            },
        });

        return NextResponse.json({
            success: true,
            branch: newBranch,
            message: 'Physical branch successfully provisioned.',
        });
    } catch (err: any) {
        console.error('Super admin create branch error:', err);
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
        const { branchId, name, phone, email, address, status, isMainBranch } = body;

        if (!branchId) {
            return NextResponse.json({ error: 'branchId is required' }, { status: 400 });
        }

        const updates: Record<string, any> = {
            updated_at: new Date().toISOString()
        };
        if (name !== undefined) updates.name = name.trim();
        if (phone !== undefined) updates.phone = phone.trim();
        if (email !== undefined) updates.email = email.trim();
        if (address !== undefined) updates.address = address;
        if (status !== undefined) updates.status = status.toLowerCase();
        if (isMainBranch !== undefined) updates.is_main_branch = !!isMainBranch;

        const { data: updatedBranch, error: updateError } = await supabaseAdmin
            .from('branches')
            .update(updates)
            .eq('id', branchId)
            .select()
            .single();

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, branch: updatedBranch });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get('id');

        if (!branchId) {
            return NextResponse.json({ error: 'Branch id is required' }, { status: 400 });
        }

        // Soft delete branch
        await supabaseAdmin
            .from('branches')
            .update({
                status: 'inactive',
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', branchId);

        return NextResponse.json({ success: true, message: 'Branch soft-deleted.' });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
