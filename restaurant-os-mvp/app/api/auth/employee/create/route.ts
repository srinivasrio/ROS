import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyStaffAuth } from '@/lib/staff-guard';
import { hashPin } from '@/lib/auth-utils';
import { sanitizeEmployeeProfile } from '@/lib/entity-id';
import { resolveAuthorizedBranch } from '@/lib/branch-resolver';
import crypto from 'crypto';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            name,
            email,
            mobile,
            role,
            restaurant_id,
            branch_id,
            pin,
            vehicle_type,
            vehicle_number,
            monthly_salary,
            per_day_salary,
            overtime_per_hour,
            joining_date,
            weekly_off,
            salary_type
        } = body;

        const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

        if (!name || !role || !restaurant_id) {
            return NextResponse.json({ error: 'Name, role, and restaurant ID are required' }, { status: 400 });
        }

        // 1. Authenticate caller (Must be restaurant_admin or owner)
        const auth = await verifyStaffAuth(request, {
            allowedRoles: ['restaurant_admin', 'owner', 'restaurant_owner', 'super_admin', 'superadmin'],
            requiredRestaurantId: restaurant_id
        });

        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error || 'Unauthorized: Admin access required' }, { status: auth.status || 403 });
        }

        // Validate and resolve branch_id if provided
        let resolvedBranchFk: string | null = null;
        let resolvedBranchInternalId: string | null = null;
        if (branch_id) {
            const branchRes = await resolveAuthorizedBranch(branch_id, [restaurant_id]);
            if (!branchRes.success) {
                return NextResponse.json({ error: branchRes.error }, { status: branchRes.status || 400 });
            }
            resolvedBranchFk = branchRes.validFkBranchId || null;
            resolvedBranchInternalId = branchRes.branchInternalId || null;

            // If caller is a branch-restricted Restaurant Admin, verify they belong to this branch
            if (auth.user?.role?.toLowerCase() === 'restaurant_admin' && auth.user?.branchId) {
                if (auth.user.branchId !== resolvedBranchFk && auth.user.branchId !== resolvedBranchInternalId) {
                    return NextResponse.json({ error: 'Access Denied: You cannot create staff for another branch.' }, { status: 403 });
                }
            }
        }

        const callerRole = (auth.user?.role || '').toLowerCase();
        const isOwnerCaller = ['owner', 'restaurant_owner', 'super_admin', 'superadmin'].includes(callerRole);

        const targetRole = role.toLowerCase().trim();
        const isAdminRole = ['admin', 'restaurant_admin'].includes(targetRole);

        if (isAdminRole && !isOwnerCaller) {
            return NextResponse.json({ 
                error: 'Access Denied: Only restaurant owners can create or assign administrator accounts.' 
            }, { status: 403 });
        }

        const validRoles = ['waiter', 'chef', 'supervisor', 'cleaner', 'manager', 'delivery_boy', 'kitchen', 'cashier', 'restaurant_admin', 'admin'];
        if (!validRoles.includes(targetRole)) {
            return NextResponse.json({ error: `Invalid employee role. Must be one of: ${validRoles.join(', ')}.` }, { status: 400 });
        }

        // Validate & hash PIN
        let hashedPin: string | null = null;
        const cleanPin = String(pin || '').trim();
        if (cleanPin) {
            if (!/^\d{4,6}$/.test(cleanPin)) {
                return NextResponse.json({ error: 'Employee PIN must be a 4 to 6 digit numeric code' }, { status: 400 });
            }
            hashedPin = await hashPin(cleanPin);
        } else {
            hashedPin = await hashPin('1234');
        }

        // 2. Calculate the next employee sequence ID
        const { count, error: countErr } = await supabaseAdmin
            .from('employees')
            .select('*', { count: 'exact', head: true })
            .eq('restaurant_id', restaurant_id);

        if (countErr) {
            console.error('Failed to get employee count:', countErr);
            return NextResponse.json({ error: 'Failed to generate employee sequence' }, { status: 500 });
        }

        const sequence = (count || 0) + 1;
        const paddedSequence = String(sequence).padStart(3, '0');
        const last4 = String(restaurant_id).slice(-4);
        const employeeId = `DIO${last4}${paddedSequence}`;

        const newEmployeeUUID = crypto.randomUUID();

        // 3. Insert employee profile with secure PIN hash and branch_id
        const { data: employee, error: insertErr } = await supabaseAdmin
            .from('employees')
            .insert({
                id: newEmployeeUUID,
                employee_id: employeeId,
                restaurant_id,
                branch_id: resolvedBranchFk || null,
                name: name.trim(),
                email: email ? email.toLowerCase().trim() : null,
                mobile: mobile ? String(mobile).trim().replace(/[^0-9]/g, '').slice(-10) : null,
                role: role.toLowerCase(),
                pin: hashedPin,
                raw_pin: cleanPin || '1234',
                status: 'active',
                approval_status: 'approved',
                activation_token: null,
                is_online: false,
                is_deleted: false,
                monthly_salary: Number(monthly_salary) || 0,
                per_day_salary: per_day_salary !== undefined && per_day_salary !== null && per_day_salary !== '' ? Number(per_day_salary) : null,
                overtime_per_hour: overtime_per_hour !== undefined && overtime_per_hour !== null && overtime_per_hour !== '' ? Number(overtime_per_hour) : null,
                joining_date: joining_date || new Date().toISOString().split('T')[0],
                weekly_off: weekly_off || 'sunday',
                salary_type: salary_type === 'daily' ? 'daily' : 'monthly',
            })
            .select()
            .single();

        if (insertErr) {
            console.error('Employee insert error:', insertErr);
            return NextResponse.json({ error: insertErr.message }, { status: 500 });
        }

        // 4. Create auth record with hashed PIN
        await supabaseAdmin
            .from('auth')
            .upsert({
                user_id: newEmployeeUUID,
                password_hash: hashedPin
            }, { onConflict: 'user_id' });

        // 4b. Link into employee_branch_access if branch is assigned
        if (resolvedBranchFk) {
            await supabaseAdmin
                .from('employee_branch_access')
                .upsert({
                    branch_id: resolvedBranchFk,
                    employee_id: newEmployeeUUID
                }, { onConflict: 'employee_id,branch_id' });
        }

        // 4c. If delivery boy, register into delivery_boys table
        if (role.toLowerCase() === 'delivery_boy') {
            await supabaseAdmin
                .from('delivery_boys')
                .upsert({
                    restaurant_id,
                    employee_id: newEmployeeUUID,
                    branch_id: resolvedBranchFk || null,
                    status: 'active',
                    vehicle_type: vehicle_type || null,
                    vehicle_number: vehicle_number || null,
                }, { onConflict: 'restaurant_id,employee_id' });
        }

        // 4d. Synchronize profile with dine_users
        await supabaseAdmin.from('dine_users').upsert({
            id: newEmployeeUUID,
            name: name.trim(),
            email: email ? email.toLowerCase().trim() : null,
            phone: mobile ? String(mobile).trim().replace(/[^0-9]/g, '').slice(-10) : null,
            restaurant_id,
            role: role.toLowerCase(),
            status: 'active'
        }, { onConflict: 'id' });

        // 5. Log audit log
        await supabaseAdmin.from('audit_logs').insert({
            restaurant_id,
            user_id: newEmployeeUUID,
            actor_id: auth.user.userId,
            employee_id: employeeId,
            branch_id: resolvedBranchFk || null,
            action: 'employee_creation',
            ip_address: ip,
            device: 'unknown',
            browser: 'unknown',
            details: {
                role: role.toLowerCase(),
                branch_id: resolvedBranchFk || null,
                source: 'admin_creation',
                creator_id: auth.user.userId
            }
        });

        return NextResponse.json({
            success: true,
            employee: sanitizeEmployeeProfile(employee)
        });

    } catch (error: any) {
        console.error('Employee creation error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
