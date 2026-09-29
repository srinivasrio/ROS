import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyStaffAuth } from '@/lib/staff-guard';

/**
 * GET /api/waiter/status
 * Fetches the waiter's own online/offline status.
 */
export async function GET(req: NextRequest) {
    try {
        let targetEmployee: any = null;
        const auth = await verifyStaffAuth(req, {
            allowedRoles: ['waiter', 'supervisor', 'restaurant_admin']
        });

        if (auth.authorized && auth.employee) {
            targetEmployee = auth.employee;
        } else {
            // Fallback for registered staff via query params
            const url = new URL(req.url);
            const queryMobile = url.searchParams.get('mobile') || url.searchParams.get('staffMobile');
            const queryWaiterId = url.searchParams.get('waiterId') || url.searchParams.get('id');
            const queryRestId = url.searchParams.get('restaurantId') || url.searchParams.get('restaurantCode');

            if (queryWaiterId || queryMobile) {
                let query = supabaseAdmin
                    .from('employees')
                    .select('id, employee_id, name, mobile, role, status, approval_status, restaurant_id, is_online, availability_status, is_deleted')
                    .eq('is_deleted', false);

                if (queryWaiterId) query = query.eq('id', queryWaiterId);
                else if (queryMobile) {
                    const clean = String(queryMobile).replace(/[^0-9]/g, '').slice(-10);
                    query = query.ilike('mobile', `%${clean}%`);
                }

                if (queryRestId) query = query.eq('restaurant_id', queryRestId);

                const { data: foundEmp } = await query.maybeSingle();

                if (foundEmp) {
                    if (foundEmp.status === 'pending_activation' || foundEmp.status === 'invited') {
                        return NextResponse.json({
                            error: 'Unauthorized: Account is pending activation. Please complete account activation first.'
                        }, { status: 403 });
                    }
                    if (foundEmp.approval_status === 'rejected') {
                        return NextResponse.json({ error: 'Unauthorized: Account rejected.' }, { status: 403 });
                    }
                    targetEmployee = foundEmp;
                }
            }
        }

        if (!targetEmployee) {
            return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: auth.status || 401 });
        }

        return NextResponse.json({
            success: true,
            account_status: targetEmployee.status,
            is_online: Boolean(targetEmployee.is_online),
            availability_status: targetEmployee.availability_status || (targetEmployee.is_online ? 'available' : 'offline'),
            waiter: {
                id: targetEmployee.id,
                name: targetEmployee.name,
                role: targetEmployee.role,
                employee_id: targetEmployee.employee_id
            }
        });
    } catch (err: any) {
        console.error('[waiter-status-get] error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST /api/waiter/status
 * Updates the waiter's own online/offline status.
 * Allows existing registered staff while restricting new unactivated accounts.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { isOnline, waiterId, mobile, restaurantId: bodyRestId } = body;

        if (typeof isOnline !== 'boolean') {
            return NextResponse.json({ error: 'Valid boolean "isOnline" is required' }, { status: 400 });
        }

        let targetEmployee: any = null;
        const auth = await verifyStaffAuth(req, {
            allowedRoles: ['waiter', 'supervisor', 'restaurant_admin']
        });

        if (auth.authorized && auth.employee) {
            targetEmployee = auth.employee;
        } else if (waiterId || mobile) {
            // Fallback for existing registered staff accounts
            let query = supabaseAdmin
                .from('employees')
                .select('id, employee_id, name, mobile, role, status, approval_status, restaurant_id, is_online, availability_status, is_deleted')
                .eq('is_deleted', false);

            if (waiterId) query = query.eq('id', waiterId);
            else if (mobile) {
                const clean = String(mobile).replace(/[^0-9]/g, '').slice(-10);
                query = query.ilike('mobile', `%${clean}%`);
            }

            if (bodyRestId) query = query.eq('restaurant_id', bodyRestId);

            const { data: foundEmp } = await query.maybeSingle();

            if (foundEmp) {
                // Strict check: Only reject new unactivated or rejected accounts
                if (foundEmp.status === 'pending_activation' || foundEmp.status === 'invited') {
                    return NextResponse.json({
                        error: 'Unauthorized: Account is pending activation. Please complete account activation first.'
                    }, { status: 403 });
                }
                if (foundEmp.approval_status === 'rejected') {
                    return NextResponse.json({ error: 'Unauthorized: Account rejected.' }, { status: 403 });
                }
                targetEmployee = foundEmp;
            }
        }

        if (!targetEmployee) {
            return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: auth.status || 401 });
        }

        const callerUserId = targetEmployee.id;
        const targetRestId = targetEmployee.restaurant_id;

        // If the waiter's account is inactive, they cannot go online
        if (isOnline && (targetEmployee.status || '').toLowerCase() === 'inactive') {
            return NextResponse.json({
                error: 'Account is deactivated by administrator. You cannot go online. Please contact your manager.'
            }, { status: 403 });
        }

        const newAvailability = isOnline ? 'available' : 'offline';

        // Update ONLY the waiter's online availability, NEVER modify account status (status)
        const { data: updated, error: updateErr } = await supabaseAdmin
            .from('employees')
            .update({
                is_online: isOnline,
                availability_status: newAvailability,
                updated_at: new Date().toISOString()
            })
            .eq('id', callerUserId)
            .select('id, status, is_online, availability_status, name')
            .single();

        if (updateErr) {
            console.error('[waiter-status-update] update error:', updateErr);
            return NextResponse.json({ error: 'Failed to update waiter online status' }, { status: 500 });
        }

        const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';

        // Audit log
        await supabaseAdmin.from('audit_logs').insert({
            restaurant_id: targetRestId,
            user_id: callerUserId,
            employee_id: targetEmployee.employee_id,
            action: isOnline ? 'waiter_online' : 'waiter_offline',
            ip_address: ip,
            device: 'unknown',
            browser: 'unknown',
            details: { is_online: isOnline, availability_status: newAvailability, account_status: updated.status }
        });

        return NextResponse.json({
            success: true,
            account_status: updated.status,
            is_online: updated.is_online,
            availability_status: updated.availability_status,
            message: `Waiter availability updated to ${isOnline ? 'Online' : 'Offline'}`
        });

    } catch (err: any) {
        console.error('[waiter-status-post] error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
