import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedOwner, resolveOwnerScope } from '@/lib/owner-auth';
import { hashPassword, hashPin } from '@/lib/auth-utils';
import { sanitizeEmployeeProfile, normalizeE164Phone } from '@/lib/entity-id';
import { resolveAuthorizedBranch, resolveAuthorizedBranches } from '@/lib/branch-resolver';
import crypto from 'crypto';

// GET: List employees with restaurant/branch, role, status filters and multi-branch access list
export async function GET(request: NextRequest) {
    const auth = await getAuthenticatedOwner(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const branchFilter = request.nextUrl.searchParams.get('branch') || request.nextUrl.searchParams.get('restaurant');
    const roleFilter = request.nextUrl.searchParams.get('role');
    const statusFilter = request.nextUrl.searchParams.get('status');
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '200'), 500);
    const offset = (page - 1) * limit;

    const scope = await resolveOwnerScope(auth, branchFilter);

    let query = supabaseAdmin
        .from('employees')
        .select('id, internal_id, name, email, mobile, phone_normalized, role, status, employee_id, employee_code, legacy_reference, restaurant_id, branch_id, profile_image_url, created_at, deactivated_at', { count: 'exact' })
        .in('restaurant_id', scope.restaurantIds)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (scope.targetBranchId) {
        query = query.eq('branch_id', scope.targetBranchId);
    }
    if (roleFilter && roleFilter !== 'all') {
        query = query.eq('role', roleFilter);
    }
    if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
    }

    const { data: employees, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Fetch multi-branch assignments if employees exist
    const employeeIds = (employees || []).map(e => e.id);
    let multiBranchMap: Record<string, string[]> = {};
    if (employeeIds.length > 0) {
        const { data: accesses } = await supabaseAdmin
            .from('employee_branch_access')
            .select('employee_id, branch_id')
            .in('employee_id', employeeIds);

        if (accesses) {
            accesses.forEach(a => {
                if (!multiBranchMap[a.employee_id]) multiBranchMap[a.employee_id] = [];
                multiBranchMap[a.employee_id].push(a.branch_id);
            });
        }
    }

    // Query branches for these restaurants to populate branch_internal_id and branch details
    const branchMap = new Map<string, { internal_id: string; name: string }>();
    if (scope.restaurantIds.length > 0) {
        const { data: bList } = await supabaseAdmin
            .from('branches')
            .select('id, internal_id, name')
            .in('restaurant_id', scope.restaurantIds)
            .is('deleted_at', null);
        if (bList) {
            bList.forEach(b => branchMap.set(b.id, { internal_id: b.internal_id, name: b.name }));
        }
    }

    const enrichedEmployees = (employees || []).map(e => {
        const bInfo = e.branch_id ? branchMap.get(e.branch_id) : null;
        return sanitizeEmployeeProfile({
            ...e,
            branch_internal_id: bInfo?.internal_id || null,
            branch_name: bInfo?.name || null,
            branch_ids: Array.from(new Set([...(e.branch_id ? [e.branch_id] : []), ...(multiBranchMap[e.id] || [])]))
        });
    });

    return NextResponse.json({
        employees: enrichedEmployees,
        total: count || 0,
        page,
        limit,
    });
}

// POST: Create a new employee with primary restaurant and branch access
export async function POST(request: NextRequest) {
    const auth = await getAuthenticatedOwner(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { name, mobile, email, role, restaurant_id, branch_id, branch_ids, employee_code, profile_image_url, password, pin } = body;

        if (!name?.trim()) return NextResponse.json({ error: 'Employee name is required' }, { status: 400 });
        if (!mobile?.trim() && !email?.trim()) {
            return NextResponse.json({ error: 'Mobile number or email is required' }, { status: 400 });
        }

        const allIds = auth.restaurantIds || [auth.restaurantId];
        let targetRestaurantId = restaurant_id && allIds.includes(restaurant_id) ? restaurant_id : null;
        let resolvedBranchFk: string | null = null;
        let resolvedBranchInternalId: string | null = null;

        if (branch_id) {
            const branchRes = await resolveAuthorizedBranch(branch_id, allIds);
            if (!branchRes.success) {
                return NextResponse.json({ error: branchRes.error }, { status: branchRes.status || 400 });
            }
            if (branchRes.branch) {
                resolvedBranchFk = branchRes.validFkBranchId || null;
                resolvedBranchInternalId = branchRes.branchInternalId || null;
                if (!targetRestaurantId) {
                    targetRestaurantId = branchRes.branch.restaurant_id;
                } else if (targetRestaurantId !== branchRes.branch.restaurant_id) {
                    return NextResponse.json({ 
                        error: 'Access denied: Selected branch belongs to a different restaurant' 
                    }, { status: 403 });
                }
            }
        }

        if (!targetRestaurantId) {
            targetRestaurantId = auth.restaurantId;
        }

        // Validate multi-branch assignments if passed
        let resolvedBranchAccessIds: string[] = [];
        if (Array.isArray(branch_ids) && branch_ids.length > 0) {
            const multiRes = await resolveAuthorizedBranches(branch_ids, allIds);
            if (!multiRes.success) {
                return NextResponse.json({ error: multiRes.error }, { status: multiRes.status || 400 });
            }
            resolvedBranchAccessIds = multiRes.validFkBranchIds;
        }

        const cleanMobile = mobile?.trim().replace(/[^0-9]/g, '').slice(-10) || null;
        const cleanEmail = email?.trim().toLowerCase() || null;
        const hashedPin = pin?.trim() ? await hashPin(pin.trim()) : null;

        const { data: newEmp, error: insertErr } = await supabaseAdmin
            .from('employees')
            .insert({
                restaurant_id: targetRestaurantId,
                name: name.trim(),
                mobile: cleanMobile,
                email: cleanEmail,
                role: (role || 'waiter').toLowerCase(),
                branch_id: resolvedBranchFk || null,
                employee_code: employee_code?.trim() || `EMP-${Date.now().toString().slice(-4)}`,
                profile_image_url: profile_image_url || null,
                pin: hashedPin,
                status: 'active',
                approval_status: 'approved',
                is_deleted: false
            })
            .select()
            .single();

        if (insertErr) {
            console.error('[Employee Create] DB error:', insertErr);
            return NextResponse.json({ error: insertErr.message }, { status: 500 });
        }

        // Save password if provided
        if (password?.trim()) {
            const hashedPassword = await hashPassword(password.trim());
            await supabaseAdmin
                .from('auth')
                .upsert({
                    user_id: newEmp.id,
                    password_hash: hashedPassword
                }, { onConflict: 'user_id' });

            if (cleanEmail) {
                try {
                    await supabaseAdmin.auth.admin.createUser({
                        id: newEmp.id,
                        email: cleanEmail,
                        password: password.trim(),
                        email_confirm: true,
                        user_metadata: {
                            name: newEmp.name,
                            role: newEmp.role,
                            restaurant_id: targetRestaurantId,
                            branch_id: newEmp.branch_id
                        }
                    });
                } catch (e) {
                    console.warn('[Employee Create] Supabase auth note:', e);
                }
            }
        }

        // Sync dine_users
        await supabaseAdmin.from('dine_users').upsert({
            id: newEmp.id,
            name: newEmp.name,
            email: newEmp.email,
            phone: newEmp.mobile,
            employee_id: newEmp.employee_id,
            restaurant_id: targetRestaurantId,
            role: newEmp.role,
            status: 'active'
        }, { onConflict: 'id' });

        // Handle multi-branch assignments if provided
        const allBranches = Array.from(new Set([...(resolvedBranchFk ? [resolvedBranchFk] : []), ...resolvedBranchAccessIds]));
        if (allBranches.length > 0) {
            const branchRows = allBranches.map(bid => ({
                employee_id: newEmp.id,
                branch_id: bid,
                created_by: auth.userId
            }));
            await supabaseAdmin.from('employee_branch_access').upsert(branchRows, { onConflict: 'employee_id,branch_id' });
        }

        // Audit log
        await supabaseAdmin.from('audit_logs').insert({
            restaurant_id: targetRestaurantId,
            actor_user_id: auth.userId,
            actor_role: auth.role,
            action: 'employee_created',
            resource_type: 'employee',
            resource_id: newEmp.id,
            metadata: { name: newEmp.name, role: newEmp.role, branch_ids: allBranches },
            ip_address: auth.ip,
            user_agent: auth.userAgent
        });

        return NextResponse.json({ success: true, employee: sanitizeEmployeeProfile(newEmp) });
    } catch (err: any) {
        console.error('[API /owner/employees POST] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH: Toggle employee status (Active <-> Inactive / Deactivated)
export async function PATCH(request: NextRequest) {
    const auth = await getAuthenticatedOwner(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { id, status, branch_ids } = body;

        if (!id) return NextResponse.json({ error: 'Employee ID required' }, { status: 400 });

        const allIds = auth.restaurantIds || [auth.restaurantId];

        // Ensure employee belongs to one of the owner's restaurants
        const { data: existing } = await supabaseAdmin
            .from('employees')
            .select('id, name, status, restaurant_id')
            .eq('id', id)
            .in('restaurant_id', allIds)
            .maybeSingle();

        if (!existing) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

        const updates: any = {};
        if (status) {
            const cleanStatus = status.toLowerCase() === 'active' ? 'active' : 'inactive';
            updates.status = cleanStatus;
            updates.deactivated_at = cleanStatus === 'inactive' ? new Date().toISOString() : null;
        }

        const { data: updated, error } = await supabaseAdmin
            .from('employees')
            .update(updates)
            .eq('id', id)
            .eq('restaurant_id', existing.restaurant_id)
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // If branch_ids was updated, sync employee_branch_access
        if (Array.isArray(branch_ids)) {
            await supabaseAdmin.from('employee_branch_access').delete().eq('employee_id', id);
            if (branch_ids.length > 0) {
                const branchRows = branch_ids.map(bid => ({
                    employee_id: id,
                    branch_id: bid,
                    created_by: auth.userId
                }));
                await supabaseAdmin.from('employee_branch_access').insert(branchRows);
            }
        }

        // Audit log
        await supabaseAdmin.from('audit_logs').insert({
            restaurant_id: existing.restaurant_id,
            actor_user_id: auth.userId,
            actor_role: auth.role,
            action: status === 'inactive' ? 'employee_deactivated' : 'employee_status_updated',
            resource_type: 'employee',
            resource_id: id,
            metadata: { new_status: updates.status, updated_by: auth.userId },
            ip_address: auth.ip,
            user_agent: auth.userAgent
        });

        return NextResponse.json({ success: true, employee: sanitizeEmployeeProfile(updated) });
    } catch (err: any) {
        console.error('[API /owner/employees PATCH] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PUT: Update employee details including credentials
export async function PUT(request: NextRequest) {
    const auth = await getAuthenticatedOwner(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized: Owner session required' }, { status: 401 });

    try {
        const body = await request.json();
        const {
            id,
            name,
            mobile,
            phone,
            email,
            role,
            branch_id,
            branch_ids,
            employee_code,
            status,
            password,
            pin,
            monthly_salary,
            per_day_salary,
            overtime_per_hour,
            salary_type,
            weekly_off,
            joining_date
        } = body;

        if (!id) return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });

        const allIds = auth.restaurantIds || [auth.restaurantId];

        // Ensure employee belongs to one of owner's restaurants
        const { data: existingList } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('id', id)
            .limit(1);

        const existing = existingList?.[0];
        if (!existing) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }

        if (existing.restaurant_id && !allIds.includes(existing.restaurant_id)) {
            return NextResponse.json({ error: 'Access denied: Employee belongs to another restaurant' }, { status: 403 });
        }

        const targetRestaurantId = existing.restaurant_id || auth.restaurantId;

        const updates: any = { 
            updated_at: new Date().toISOString(),
            restaurant_id: targetRestaurantId
        };
        if (name?.trim()) updates.name = name.trim();
        if (email !== undefined) updates.email = email ? email.toLowerCase().trim() : null;
        if (mobile !== undefined || phone !== undefined) {
            const rawPhone = mobile !== undefined ? mobile : phone;
            updates.mobile = rawPhone ? String(rawPhone).replace(/[^0-9]/g, '').slice(-10) : null;
            updates.phone_normalized = updates.mobile ? normalizeE164Phone(updates.mobile) : null;
        }
        if (role !== undefined) updates.role = role.toLowerCase().trim();
        if (monthly_salary !== undefined) updates.monthly_salary = Number(monthly_salary) || 0;
        if (per_day_salary !== undefined) updates.per_day_salary = per_day_salary !== null && per_day_salary !== '' ? Number(per_day_salary) : null;
        if (overtime_per_hour !== undefined) updates.overtime_per_hour = overtime_per_hour !== null && overtime_per_hour !== '' ? Number(overtime_per_hour) : null;
        if (salary_type !== undefined) updates.salary_type = salary_type === 'daily' ? 'daily' : 'monthly';
        if (weekly_off !== undefined) updates.weekly_off = weekly_off;
        if (joining_date !== undefined) updates.joining_date = joining_date;

        // Preserve existing valid branch_id on updates; only reassign if a valid non-empty branch is supplied
        if (branch_id !== undefined && branch_id !== null && String(branch_id).trim() !== '') {
            const rawBranch = String(branch_id).trim();
            const branchRes = await resolveAuthorizedBranch(rawBranch, allIds);
            if (!branchRes.success) {
                return NextResponse.json({ error: branchRes.error }, { status: branchRes.status || 400 });
            }
            if (branchRes.branch) {
                if (existing.restaurant_id && branchRes.branch.restaurant_id !== existing.restaurant_id) {
                    return NextResponse.json({ 
                        error: 'Access denied: Branch belongs to a different restaurant than the employee' 
                    }, { status: 403 });
                }
                updates.branch_id = branchRes.validFkBranchId || null;
            }
        } else if (!existing.branch_id && targetRestaurantId) {
            // Auto-heal missing branch_id for admins or staff
            const { data: mainB } = await supabaseAdmin
                .from('branches')
                .select('id')
                .eq('restaurant_id', targetRestaurantId)
                .order('is_main_branch', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (mainB?.id) updates.branch_id = mainB.id;
        }
        if (status) updates.status = status.toLowerCase().trim();

        // Update PIN if supplied
        if (pin?.trim()) {
            updates.pin = await hashPin(pin.trim());
        }

        updates.approval_status = 'approved';

        const { data: updatedEmployee, error: updateErr } = await supabaseAdmin
            .from('employees')
            .update(updates)
            .eq('id', id)
            .eq('restaurant_id', targetRestaurantId)
            .select()
            .single();

        if (updateErr) {
            return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }

        // Update Password if supplied
        if (password?.trim()) {
            const hashedPassword = await hashPassword(password.trim());
            await supabaseAdmin
                .from('auth')
                .upsert({
                    user_id: id,
                    password_hash: hashedPassword
                }, { onConflict: 'user_id' });

            const finalEmail = updates.email || existing.email;
            if (finalEmail) {
                try {
                    const { error: sbUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(id, {
                        password: password.trim(),
                        email: finalEmail
                    });
                    if (sbUpdateErr) {
                        await supabaseAdmin.auth.admin.createUser({
                            id,
                            email: finalEmail,
                            password: password.trim(),
                            email_confirm: true,
                            user_metadata: {
                                name: updates.name || existing.name,
                                role: updates.role || existing.role,
                                restaurant_id: targetRestaurantId,
                                branch_id: updates.branch_id || existing.branch_id
                            }
                        });
                    }
                } catch (sbErr) {
                    console.warn('[Employee Update] Supabase Auth update note:', sbErr);
                }
            }
        }

        // Sync dine_users
        await supabaseAdmin.from('dine_users').upsert({
            id: id,
            name: updates.name || existing.name,
            email: updates.email !== undefined ? updates.email : existing.email,
            phone: updates.mobile !== undefined ? updates.mobile : existing.mobile,
            restaurant_id: targetRestaurantId,
            role: updates.role || existing.role,
            status: updates.status || existing.status || 'active'
        }, { onConflict: 'id' });

        // Sync branch access
        const targetBranchId = updates.branch_id !== undefined ? updates.branch_id : existing.branch_id;
        let resolvedMultiFks: string[] = [];
        if (Array.isArray(branch_ids)) {
            if (branch_ids.length > 0) {
                const multiRes = await resolveAuthorizedBranches(branch_ids, allIds);
                if (!multiRes.success) {
                    return NextResponse.json({ error: multiRes.error }, { status: multiRes.status || 400 });
                }
                resolvedMultiFks = multiRes.validFkBranchIds;
            }
        }
        const allBranches = Array.from(new Set([
            ...(targetBranchId ? [targetBranchId] : []),
            ...resolvedMultiFks
        ]));

        if (allBranches.length > 0) {
            const branchRows = allBranches.map(bid => ({
                employee_id: id,
                branch_id: bid,
                created_by: auth.userId
            }));
            await supabaseAdmin.from('employee_branch_access').upsert(branchRows, { onConflict: 'employee_id,branch_id' });
        }

        // Audit log
        await supabaseAdmin.from('audit_logs').insert({
            restaurant_id: targetRestaurantId,
            actor_user_id: auth.userId,
            actor_role: auth.role,
            action: 'employee_updated',
            resource_type: 'employee',
            resource_id: id,
            metadata: {
                updated_fields: Object.keys(updates),
                password_updated: !!password?.trim(),
                pin_updated: !!pin?.trim()
            },
            ip_address: auth.ip,
            user_agent: auth.userAgent
        });

        return NextResponse.json({
            success: true,
            employee: sanitizeEmployeeProfile(updatedEmployee),
            message: 'Employee credentials and details updated successfully'
        });
    } catch (err: any) {
        console.error('[API /owner/employees PUT] Error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
