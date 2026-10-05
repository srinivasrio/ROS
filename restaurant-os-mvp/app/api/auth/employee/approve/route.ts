import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyJwt, extractTokenForRestaurant } from '@/lib/jwt-utils';
import { resolveRestaurantId } from '@/services/utils.service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { employeeId, action, restaurantId: clientRestaurantId } = body;

        const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
        const userAgent = request.headers.get('user-agent') || 'unknown';

        let browser = 'unknown';
        let device = 'desktop';
        if (userAgent.toLowerCase().includes('mobile') || userAgent.toLowerCase().includes('android') || userAgent.toLowerCase().includes('iphone')) {
            device = 'mobile';
        }
        if (userAgent.toLowerCase().includes('chrome')) {
            browser = 'chrome';
        } else if (userAgent.toLowerCase().includes('safari')) {
            browser = 'safari';
        } else if (userAgent.toLowerCase().includes('firefox')) {
            browser = 'firefox';
        }

        if (!employeeId || !action) {
            return NextResponse.json({ error: 'Employee ID and action are required' }, { status: 400 });
        }

        const validActions = ['approve', 'reject', 'suspend', 'delete', 'restore', 'permanent_delete'];
        if (!validActions.includes(action)) {
            return NextResponse.json({ error: 'Invalid action. Must be approve, reject, suspend, delete, restore, or permanent_delete.' }, { status: 400 });
        }

        // 1. Fetch target employee first so we can verify existence and know the exact restaurant context
        const { data: employee, error: empError } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('id', employeeId)
            .maybeSingle();

        if (empError || !employee) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }

        const targetRestaurantId = clientRestaurantId || employee.restaurant_id || null;

        // 2. Authenticate Admin Actor with full cookie & header fallback
        const cookieStore = await cookies();
        let token = extractTokenForRestaurant(cookieStore, targetRestaurantId) ||
                    cookieStore.get('dine_auth_token')?.value;

        // Check Authorization header if cookie not found
        if (!token) {
            const authHeader = request.headers.get('authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7).trim();
            }
        }

        // Fallback to any dine_auth_token* cookie present
        if (!token && cookieStore.getAll) {
            const all = cookieStore.getAll();
            const found = all.find(c => c.name.startsWith('dine_auth_token') && c.value);
            if (found) token = found.value;
        }

        const actor = token ? await verifyJwt(token) : null;
        if (!actor || !actor.userId) {
            return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
        }

        // 3. Validate Admin / Owner Role (case-insensitive)
        const rawRole = (actor.role || '').toLowerCase();
        const isSuperAdmin = rawRole === 'super_admin' || 
                             rawRole === 'superadmin';
        let isAdmin = isSuperAdmin || ['restaurant_admin', 'admin', 'owner', 'manager'].includes(rawRole);

        // Fallback DB check if JWT role is not an explicit admin string
        let dbActorRestaurantId: string | null = null;
        if (!isAdmin) {
            const { data: dbEmp } = await supabaseAdmin
                .from('employees')
                .select('role, restaurant_id, status')
                .eq('id', actor.userId)
                .maybeSingle();

            if (dbEmp) {
                const dbEmpRole = (dbEmp.role || '').toLowerCase();
                dbActorRestaurantId = dbEmp.restaurant_id;
                if (['restaurant_admin', 'admin', 'owner', 'manager'].includes(dbEmpRole)) {
                    isAdmin = true;
                }
            } else {
                const { data: dbUser } = await supabaseAdmin
                    .from('users')
                    .select('role, restaurant_id')
                    .eq('id', actor.userId)
                    .maybeSingle();
                if (dbUser) {
                    const uRole = (dbUser.role || '').toLowerCase();
                    if (['restaurant_admin', 'admin', 'owner', 'manager'].includes(uRole)) {
                        isAdmin = true;
                        dbActorRestaurantId = dbUser.restaurant_id;
                    }
                }
            }
        }

        if (!isAdmin) {
            return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
        }

        // 4. Validate Tenant Isolation for non-Super-Admins
        if (!isSuperAdmin) {
            const actorRestaurantId = actor.restaurantId || actor.restaurant_id || dbActorRestaurantId;
            if (actorRestaurantId && employee.restaurant_id) {
                if (actorRestaurantId !== employee.restaurant_id) {
                    const [resolvedActorRest, resolvedEmpRest] = await Promise.all([
                        resolveRestaurantId(actorRestaurantId),
                        resolveRestaurantId(employee.restaurant_id)
                    ]);
                    if (resolvedActorRest && resolvedEmpRest && resolvedActorRest !== resolvedEmpRest) {
                        return NextResponse.json({ error: 'Unauthorized: Cross-tenant modification' }, { status: 403 });
                    }
                }
            }
        }

        // 4. Handle Permanent Deletion
        if (action === 'permanent_delete') {
            await supabaseAdmin.from('auth').delete().eq('user_id', employeeId);
            await supabaseAdmin.from('waiter_assignments').delete().eq('waiter_id', employeeId);
            await supabaseAdmin.from('waiter_workloads').delete().eq('waiter_id', employeeId);
            await supabaseAdmin.from('waiter_shifts').delete().eq('user_id', employeeId);
            await supabaseAdmin.from('attendance').delete().eq('employee_id', employeeId);
            await supabaseAdmin.from('payroll_items').delete().eq('employee_id', employeeId);
            await supabaseAdmin.from('staff_tasks').delete().eq('employee_id', employeeId);
            await supabaseAdmin.from('delivery_boys').delete().eq('employee_id', employeeId);
            
            const { error: delErr } = await supabaseAdmin.from('employees').delete().eq('id', employeeId);
            if (delErr) {
                console.error('Failed to permanently delete employee:', delErr);
                return NextResponse.json({ error: 'Failed to permanently delete employee' }, { status: 500 });
            }

            await supabaseAdmin.from('audit_logs').insert([{
                restaurant_id: employee.restaurant_id || null,
                user_id: employee.id,
                target_user_id: employee.id,
                actor_id: actor.userId,
                employee_id: employee.employee_id || null,
                action: 'employee_permanently_deleted',
                ip_address: ip,
                device,
                browser,
                details: { action_performed: 'permanent_delete' }
            }]);

            return NextResponse.json({ success: true, permanent: true });
        }

        // 5. Set new status, approval state, and session version
        let newStatus = employee.status;
        let newApproval = employee.approval_status;
        let auditAction = 'employee_update';
        let isDeleted = employee.is_deleted;
        let deletedAt = employee.deleted_at;
        let deletedBy = employee.deleted_by;

        const nextSessionVersion = (employee.session_version || 1) + 1;

        if (action === 'approve') {
            newStatus = 'active';
            newApproval = 'approved';
            auditAction = 'employee_approved';
        } else if (action === 'reject') {
            newStatus = 'inactive';
            newApproval = 'rejected';
            auditAction = 'employee_rejection';
        } else if (action === 'suspend') {
            newStatus = 'inactive';
            newApproval = 'suspended';
            auditAction = 'employee_suspension';
        } else if (action === 'delete') {
            isDeleted = true;
            deletedAt = new Date().toISOString();
            deletedBy = actor.userId;
            newStatus = 'inactive';
            auditAction = 'employee_deleted';
            // Deactivate waiter workload
            await supabaseAdmin
                .from('waiter_workloads')
                .update({ is_online: false, status: 'offline', current_active_tables: 0 })
                .eq('waiter_id', employeeId);
        } else if (action === 'restore') {
            isDeleted = false;
            deletedAt = null;
            deletedBy = null;
            newStatus = 'active';
            newApproval = 'approved';
            auditAction = 'employee_restored';
        }

        // Sync delivery_boys status if employee has delivery_boy role
        if (employee.role?.toLowerCase() === 'delivery_boy') {
            if (action === 'approve' || action === 'restore') {
                await supabaseAdmin
                    .from('delivery_boys')
                    .upsert({
                        restaurant_id: employee.restaurant_id,
                        employee_id: employeeId,
                        status: 'active'
                    }, { onConflict: 'restaurant_id,employee_id' });
            } else if (action === 'reject' || action === 'suspend' || action === 'delete') {
                await supabaseAdmin
                    .from('delivery_boys')
                    .update({ status: 'inactive' })
                    .eq('employee_id', employeeId);
            }
        }

        // 6. Update employee
        const { error: updateErr } = await supabaseAdmin
            .from('employees')
            .update({
                status: newStatus,
                approval_status: newApproval,
                is_deleted: isDeleted,
                deleted_at: deletedAt,
                deleted_by: deletedBy,
                session_version: nextSessionVersion,
                approved_at: action === 'approve' ? new Date().toISOString() : employee.approved_at,
                approved_by: action === 'approve' ? actor.userId : employee.approved_by
            })
            .eq('id', employeeId);

        if (updateErr) {
            console.error(`Failed to execute ${action} on employee:`, updateErr);
            return NextResponse.json({ error: `Failed to update employee status to ${action}` }, { status: 500 });
        }

        // 6. Write audit logs
        await supabaseAdmin.from('audit_logs').insert([
            {
                restaurant_id: employee.restaurant_id || null,
                user_id: employee.id,
                target_user_id: employee.id,
                actor_id: actor.userId,
                employee_id: employee.employee_id || null,
                action: auditAction,
                ip_address: ip,
                device,
                browser,
                details: { action_performed: action }
            },
            {
                restaurant_id: employee.restaurant_id || null,
                user_id: employee.id,
                target_user_id: employee.id,
                actor_id: actor.userId,
                employee_id: employee.employee_id || null,
                action: 'session_version_incremented',
                ip_address: ip,
                device,
                browser,
                details: { reason: `employee_${action}`, new_version: nextSessionVersion }
            }
        ]);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Employee approval/action error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
