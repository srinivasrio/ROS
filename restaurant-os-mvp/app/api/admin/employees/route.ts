import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyJwt, extractTokenForRestaurant } from '@/lib/jwt-utils';
import { resolveRestaurantId } from '@/services/utils.service';
import { sanitizeEmployeeProfile } from '@/lib/entity-id';
import { resolveAuthorizedBranch } from '@/lib/branch-resolver';
import { hashPin } from '@/lib/auth-utils';
import { normalizeE164Phone } from '@/lib/entity-id';

/**
 * GET /api/admin/employees
 * Fetches all employees for a restaurant.
 * Avoids direct client-to-Supabase queries which can be blocked by browser extensions/firewalls.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        let restaurantId = searchParams.get('restaurantId') || searchParams.get('restaurantCode') || '';
        const includeDeleted = searchParams.get('includeDeleted') === 'true';

        // Check authentication (prefers restaurant-scoped token)
        const token = extractTokenForRestaurant(req.cookies, restaurantId)
            || req.headers.get('x-dine-token')
            || req.headers.get('authorization')?.replace('Bearer ', '')
            || req.cookies.get('dine_auth_token')?.value
            || req.cookies.get('admin_auth_token')?.value;
        let user: any = null;
        if (token) {
            user = await verifyJwt(token);
        }

        // Fallback to user's restaurant_id if not provided in query
        if (!restaurantId && user?.restaurantId) {
            restaurantId = user.restaurantId;
        }

        if (!restaurantId) {
            return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
        }

        const resolvedId = await resolveRestaurantId(restaurantId);

        const userRole = String(user?.role || '').toLowerCase();
        const isSuperAdmin = userRole === 'super_admin' || userRole === 'superadmin';
        const isOwner = userRole === 'owner' || userRole === 'restaurant_owner';

        let targetBranchId: string | null = null;
        if (!isSuperAdmin && !isOwner && user) {
            // Strictly enforce the authenticated admin's assigned branch
            targetBranchId = user.branch_id || user.branchId || null;
            if (!targetBranchId && user.userId) {
                const { data: empRec } = await supabaseAdmin
                    .from('employees')
                    .select('branch_id')
                    .eq('id', user.userId)
                    .maybeSingle();
                if (empRec?.branch_id) targetBranchId = empRec.branch_id;
            }
        } else {
            // Owner or Super Admin can optionally filter by branchId query param
            const paramBranch = searchParams.get('branchId') || searchParams.get('branch');
            if (paramBranch && paramBranch !== 'all') {
                targetBranchId = paramBranch;
            }
        }

        if (targetBranchId) {
            const branchRes = await resolveAuthorizedBranch(targetBranchId, [resolvedId]);
            if (branchRes.success && branchRes.validFkBranchId) {
                targetBranchId = branchRes.validFkBranchId;
            }
        }

        let query = supabaseAdmin
            .from('employees')
            .select(`
                *,
                branch:branch_id (
                    id,
                    name
                )
            `)
            .eq('restaurant_id', resolvedId);

        if (targetBranchId) {
            query = query.eq('branch_id', targetBranchId);
        }

        if (includeDeleted) {
            query = query.eq('is_deleted', true).order('deleted_at', { ascending: false });
        } else {
            query = query.eq('is_deleted', false).order('name', { ascending: true });
        }

        const rawSearch = searchParams.get('search') || searchParams.get('phone') || searchParams.get('mobile') || '';
        if (rawSearch) {
            const clean10 = rawSearch.replace(/[^0-9]/g, '');
            const e164 = clean10.length >= 10 ? `+91${clean10.slice(-10)}` : '';
            const searchFilters = [
                `name.ilike.%${rawSearch}%`,
                `email.ilike.%${rawSearch}%`,
                `employee_code.ilike.%${rawSearch}%`,
                `legacy_reference.ilike.%${rawSearch}%`,
                `employee_id.ilike.%${rawSearch}%`,
                `internal_id.eq.${rawSearch}`,
            ];
            if (clean10.length >= 10) {
                searchFilters.push(`mobile.eq.${clean10.slice(-10)}`);
                searchFilters.push(`mobile.ilike.%${clean10.slice(-10)}%`);
            }
            if (e164) {
                searchFilters.push(`phone_normalized.eq.${e164}`);
            }
            query = query.or(searchFilters.join(','));
        }

        const { data, error } = await query;

        if (error) {
            console.warn('[api/admin/employees] Branch join query failed, trying fallback select:', error);
            // Fallback without join in case of relation mismatch
            let fallbackQuery = supabaseAdmin
                .from('employees')
                .select('*')
                .eq('restaurant_id', resolvedId);

            if (targetBranchId) {
                fallbackQuery = fallbackQuery.eq('branch_id', targetBranchId);
            }

            if (includeDeleted) {
                fallbackQuery = fallbackQuery.eq('is_deleted', true).order('deleted_at', { ascending: false });
            } else {
                fallbackQuery = fallbackQuery.eq('is_deleted', false).order('name', { ascending: true });
            }

            if (rawSearch) {
                const clean10 = rawSearch.replace(/[^0-9]/g, '');
                const e164 = clean10.length >= 10 ? `+91${clean10.slice(-10)}` : '';
                const searchFilters = [
                    `name.ilike.%${rawSearch}%`,
                    `email.ilike.%${rawSearch}%`,
                    `employee_code.ilike.%${rawSearch}%`,
                    `legacy_reference.ilike.%${rawSearch}%`,
                    `employee_id.ilike.%${rawSearch}%`,
                    `internal_id.eq.${rawSearch}`,
                ];
                if (clean10.length >= 10) {
                    searchFilters.push(`mobile.eq.${clean10.slice(-10)}`);
                    searchFilters.push(`mobile.ilike.%${clean10.slice(-10)}%`);
                }
                if (e164) {
                    searchFilters.push(`phone_normalized.eq.${e164}`);
                }
                fallbackQuery = fallbackQuery.or(searchFilters.join(','));
            }

            const { data: fallbackData, error: fallbackError } = await fallbackQuery;
            if (fallbackError) {
                console.error('[api/admin/employees] Error fetching employees:', fallbackError);
                return NextResponse.json({ error: fallbackError.message }, { status: 500 });
            }
            const sanitizedFallback = (fallbackData || []).map(sanitizeEmployeeProfile);
            return NextResponse.json({ success: true, employees: sanitizedFallback });
        }

        const sanitized = (data || []).map(sanitizeEmployeeProfile);
        return NextResponse.json({ success: true, employees: sanitized });
    } catch (err: any) {
        console.error('[api/admin/employees] Unexpected error:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * PUT /api/admin/employees
 * Updates employee details (salary, overtime wages, contact, branch, role, pin, vehicle).
 * Strictly validates and preserves branch_id foreign key constraint.
 */
export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            id,
            restaurantId,
            restaurant_id,
            name,
            email,
            mobile,
            phone,
            role,
            status,
            branch_id,
            monthly_salary,
            per_day_salary,
            overtime_per_hour,
            joining_date,
            weekly_off,
            salary_type,
            pin,
            vehicle_type,
            vehicle_number,
        } = body;

        if (!id) {
            return NextResponse.json({ error: 'Employee id is required' }, { status: 400 });
        }

        // Fetch target employee
        const { data: existingEmp, error: fetchErr } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (fetchErr || !existingEmp) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }

        const targetRestaurantId = existingEmp.restaurant_id || restaurantId || restaurant_id;

        // Verify authentication
        const token = extractTokenForRestaurant(req.cookies, targetRestaurantId) 
            || req.headers.get('x-dine-token')
            || req.headers.get('authorization')?.replace('Bearer ', '')
            || req.cookies.get('dine_auth_token')?.value
            || req.cookies.get('admin_auth_token')?.value;

        let user: any = null;
        if (token) {
            user = await verifyJwt(token);
        }

        // Validate permissions
        if (user) {
            const userRole = String(user.role || '').toLowerCase();
            const isSuperAdmin = userRole === 'super_admin' || userRole === 'superadmin';
            const userRests = user.restaurantIds || (user.restaurantId ? [user.restaurantId] : []);
            if (!isSuperAdmin && targetRestaurantId && userRests.length > 0 && !userRests.includes(targetRestaurantId)) {
                return NextResponse.json({ error: 'Access denied: You cannot modify employees of another restaurant' }, { status: 403 });
            }
        }

        const updates: any = {
            updated_at: new Date().toISOString()
        };

        if (name?.trim()) updates.name = name.trim();
        if (email !== undefined) updates.email = email ? email.toLowerCase().trim() : null;
        if (mobile !== undefined || phone !== undefined) {
            const rawPhone = mobile !== undefined ? mobile : phone;
            updates.mobile = rawPhone ? String(rawPhone).replace(/[^0-9]/g, '').slice(-10) : null;
            updates.phone_normalized = updates.mobile ? normalizeE164Phone(updates.mobile) : null;
        }
        if (role !== undefined) updates.role = role.toLowerCase().trim();
        if (status !== undefined) updates.status = status.toLowerCase().trim();
        if (monthly_salary !== undefined) updates.monthly_salary = Number(monthly_salary) || 0;
        if (per_day_salary !== undefined) updates.per_day_salary = per_day_salary !== null && per_day_salary !== '' ? Number(per_day_salary) : null;
        if (overtime_per_hour !== undefined) updates.overtime_per_hour = overtime_per_hour !== null && overtime_per_hour !== '' ? Number(overtime_per_hour) : null;
        if (joining_date !== undefined) updates.joining_date = joining_date;
        if (weekly_off !== undefined) updates.weekly_off = weekly_off;
        if (salary_type !== undefined) updates.salary_type = salary_type === 'daily' ? 'daily' : 'monthly';

        // CRITICAL: Strictly validate branch_id to prevent staff_branch_id_fkey violation
        // 1. If branch_id was NOT explicitly passed in request (e.g. salary/overtime update), DO NOT modify branch_id.
        // 2. If existing branch_id is invalid or null, auto-repair by setting it to the restaurant's main branch.
        // 3. If branch_id WAS passed, authoritatively validate it against branches table for targetRestaurantId.
        if (branch_id !== undefined && branch_id !== null && String(branch_id).trim() !== '') {
            const rawBranch = String(branch_id).trim();
            // Don't use restaurant_id, owner_id, or invalid string
            const branchRes = await resolveAuthorizedBranch(rawBranch, [targetRestaurantId]);
            if (branchRes.success && branchRes.validFkBranchId) {
                updates.branch_id = branchRes.validFkBranchId;
            } else {
                console.warn(`[api/admin/employees PUT] Invalid branch_id '${rawBranch}' provided. Preserving existing branch.`);
                // If invalid branch was supplied, preserve existing if valid, or fall back to main branch
                if (!existingEmp.branch_id) {
                    const { data: mainB } = await supabaseAdmin
                        .from('branches')
                        .select('id')
                        .eq('restaurant_id', targetRestaurantId)
                        .order('is_main_branch', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    if (mainB?.id) updates.branch_id = mainB.id;
                }
            }
        } else if (!existingEmp.branch_id && targetRestaurantId) {
            // Existing employee has NO branch_id (e.g. legacy or unlinked record) -> heal to main branch
            const { data: mainB } = await supabaseAdmin
                .from('branches')
                .select('id')
                .eq('restaurant_id', targetRestaurantId)
                .order('is_main_branch', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (mainB?.id) updates.branch_id = mainB.id;
        }

        // Handle PIN update
        if (pin && String(pin).trim()) {
            const cleanPin = String(pin).trim();
            if (/^\d{4,6}$/.test(cleanPin)) {
                updates.pin = await hashPin(cleanPin);
                // Also update auth table
                await supabaseAdmin
                    .from('auth')
                    .upsert({ user_id: id, password_hash: updates.pin }, { onConflict: 'user_id' });
            }
        }

        const { data: updated, error: updateErr } = await supabaseAdmin
            .from('employees')
            .update(updates)
            .eq('id', id)
            .select(`
                *,
                branch:branch_id (
                    id,
                    name
                )
            `)
            .single();

        if (updateErr) {
            console.error('[api/admin/employees PUT] DB error:', updateErr);
            return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }

        // If delivery boy vehicle details supplied
        if (updates.role === 'delivery_boy' || vehicle_type !== undefined || vehicle_number !== undefined) {
            if (updates.role === 'delivery_boy') {
                await supabaseAdmin
                    .from('delivery_boys')
                    .upsert({
                        restaurant_id: targetRestaurantId,
                        employee_id: id,
                        status: 'active',
                        vehicle_type: vehicle_type || null,
                        vehicle_number: vehicle_number || null,
                    }, { onConflict: 'restaurant_id,employee_id' });
            } else if (vehicle_type !== undefined || vehicle_number !== undefined) {
                await supabaseAdmin
                    .from('delivery_boys')
                    .update({
                        vehicle_type: vehicle_type || null,
                        vehicle_number: vehicle_number || null,
                    })
                    .eq('employee_id', id);
            }
        }

        // Keep dine_users synchronized if profile changed
        if (updates.name || updates.email !== undefined || updates.mobile || updates.role || updates.status) {
            await supabaseAdmin.from('dine_users').upsert({
                id: id,
                name: updates.name || existingEmp.name,
                email: updates.email !== undefined ? updates.email : existingEmp.email,
                phone: updates.mobile !== undefined ? updates.mobile : existingEmp.mobile,
                restaurant_id: targetRestaurantId,
                role: updates.role || existingEmp.role,
                status: updates.status || existingEmp.status || 'active'
            }, { onConflict: 'id' });
        }

        return NextResponse.json({ success: true, employee: sanitizeEmployeeProfile(updated) });
    } catch (err: any) {
        console.error('[api/admin/employees PUT] Unexpected error:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}

