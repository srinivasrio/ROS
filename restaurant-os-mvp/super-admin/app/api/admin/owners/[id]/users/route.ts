import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySuperAdmin } from '@/lib/superadmin-guard';
import { hashPin, hashPassword } from '@/lib/auth-utils';
import crypto from 'crypto';

// GET: Fetch users for this owner's locations
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const { id: ownerId } = await params;
        const { searchParams } = new URL(request.url);
        const locationId = searchParams.get('locationId');

        // Fetch all restaurants belonging to this owner
        const { data: ownerRests } = await supabaseAdmin
            .from('restaurants')
            .select('id, name')
            .eq('owner_id', ownerId)
            .is('deleted_at', null);

        const restIds = (ownerRests || []).map((r) => r.id);

        let query = supabaseAdmin
            .from('employees')
            .select('id, employee_id, name, email, mobile, role, restaurant_id, branch_id, pin, status, approval_status, is_online, is_deleted, created_at, updated_at')
            .is('deleted_at', null)
            .order('name', { ascending: true });

        if (locationId) {
            query = query.eq('restaurant_id', locationId);
        } else {
            query = query.in('restaurant_id', restIds);
        }

        const { data: employees, error } = await query;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({
            success: true,
            users: (employees || []).map(({ pin, ...employee }) => ({
                ...employee,
                hasPin: Boolean(pin),
            })),
            locations: ownerRests || []
        });
    } catch (err: any) {
        console.error('Super Admin get owner users error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}

// POST: Add a new user/staff to a specific location
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const { id: ownerId } = await params;
        const body = await request.json();
        const {
            restaurantId,
            name,
            email,
            mobile,
            role,
            pin,
            password
        } = body;

        if (!restaurantId || !name?.trim() || !role) {
            return NextResponse.json({ error: 'restaurantId, name, and role are required' }, { status: 400 });
        }

        // Verify that restaurantId belongs to this owner
        const { data: rest } = await supabaseAdmin
            .from('restaurants')
            .select('id, name')
            .eq('id', restaurantId)
            .eq('owner_id', ownerId)
            .maybeSingle();

        if (!rest) {
            return NextResponse.json({ error: 'Selected restaurant location does not belong to this owner' }, { status: 403 });
        }

        // Fetch primary branch of this restaurant
        const { data: primaryBranch } = await supabaseAdmin
            .from('branches')
            .select('id')
            .eq('restaurant_id', restaurantId)
            .eq('is_main_branch', true)
            .maybeSingle();

        const branchId = primaryBranch?.id || `BR-${restaurantId.slice(-6)}-01`;
        const cleanName = name.trim();
        const cleanEmail = email ? email.toLowerCase().trim() : null;
        const cleanMobile = mobile ? mobile.replace(/[^0-9]/g, '').slice(-10) : null;
        const cleanRole = role.toLowerCase().trim();
        const rawPin = pin?.trim() || null;
        const hashedPin = rawPin ? await hashPin(rawPin) : null;

        const newUserId = crypto.randomUUID();
        const rolePrefix = cleanRole === 'restaurant_admin' ? 'ADM' : cleanRole === 'waiter' ? 'WTR' : cleanRole === 'chef' ? 'CHF' : 'EMP';
        const empCode = `${rolePrefix}-${restaurantId.slice(-4)}-${Math.floor(1000 + Math.random() * 9000)}`;

        const { data: newEmployee, error: empErr } = await supabaseAdmin
            .from('employees')
            .insert({
                id: newUserId,
                employee_id: empCode,
                restaurant_id: restaurantId,
                branch_id: branchId,
                name: cleanName,
                email: cleanEmail,
                mobile: cleanMobile,
                role: cleanRole,
                pin: hashedPin,
                status: 'active',
                approval_status: 'approved',
                is_online: false,
                is_deleted: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select('id, employee_id, name, email, mobile, role, restaurant_id, branch_id, status, approval_status, is_online, is_deleted, created_at, updated_at')
            .single();

        if (empErr) {
            console.error('Create user error:', empErr);
            return NextResponse.json({ error: empErr.message }, { status: 500 });
        }

        if (password?.trim()) {
            const hashedPassword = await hashPassword(password.trim());
            await supabaseAdmin.from('auth').upsert({
                user_id: newUserId,
                password_hash: hashedPassword
            }, { onConflict: 'user_id' });
        }

        await supabaseAdmin.from('employee_branch_access').upsert({
            branch_id: branchId,
            employee_id: newUserId
        }, { onConflict: 'employee_id,branch_id' });

        await supabaseAdmin.from('dine_users').upsert({
            id: newUserId,
            name: cleanName,
            email: cleanEmail,
            phone: cleanMobile,
            employee_id: empCode,
            role: cleanRole,
            status: 'active',
            restaurant_id: restaurantId
        }, { onConflict: 'id' });

        await supabaseAdmin.from('audit_logs').insert({
            restaurant_id: restaurantId,
            user_id: auth.user.userId,
            actor_id: auth.user.userId,
            actor_role: 'SUPER_ADMIN',
            action: 'super_admin_create_staff_member',
            resource_type: 'employee',
            resource_id: newUserId,
            details: {
                owner_id: ownerId,
                restaurant_id: restaurantId,
                role: cleanRole,
                name: cleanName,
                timestamp: new Date().toISOString()
            }
        });

        return NextResponse.json({
            success: true,
            user: newEmployee,
            message: `Staff member "${cleanName}" (${cleanRole}) created for ${rest.name}.`
        });
    } catch (err: any) {
        console.error('Super Admin create user error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}

// PATCH: Update user role, status, pin, password, or reassign location
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const { id: ownerId } = await params;
        const body = await request.json();
        const {
            userId,
            name,
            email,
            mobile,
            role,
            status,
            pin,
            password,
            targetRestaurantId
        } = body;

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        const updates: Record<string, any> = { updated_at: new Date().toISOString() };
        if (name?.trim()) updates.name = name.trim();
        if (email !== undefined) updates.email = email ? email.toLowerCase().trim() : null;
        if (mobile !== undefined) updates.mobile = mobile ? mobile.replace(/[^0-9]/g, '').slice(-10) : null;
        if (role) updates.role = role.toLowerCase().trim();
        if (status) updates.status = status.toLowerCase().trim();

        if (pin?.trim()) {
            updates.pin = await hashPin(pin.trim());
        }
        if (password?.trim()) {
            const hashedPassword = await hashPassword(password.trim());
            await supabaseAdmin.from('auth').upsert({
                user_id: userId,
                password_hash: hashedPassword
            }, { onConflict: 'user_id' });
        }

        // Reassign location if targetRestaurantId provided
        if (targetRestaurantId) {
            // Verify target restaurant belongs to this owner
            const { data: targetRest } = await supabaseAdmin
                .from('restaurants')
                .select('id, name')
                .eq('id', targetRestaurantId)
                .eq('owner_id', ownerId)
                .maybeSingle();

            if (!targetRest) {
                return NextResponse.json({ error: 'Target location does not belong to this owner' }, { status: 403 });
            }

            updates.restaurant_id = targetRestaurantId;

            // Fetch primary branch of target restaurant
            const { data: pb } = await supabaseAdmin
                .from('branches')
                .select('id')
                .eq('restaurant_id', targetRestaurantId)
                .eq('is_main_branch', true)
                .maybeSingle();

            updates.branch_id = pb?.id || `BR-${targetRestaurantId.slice(-6)}-01`;
        }

        const { data: updatedEmployee, error: updateErr } = await supabaseAdmin
            .from('employees')
            .update(updates)
            .eq('id', userId)
            .select('id, employee_id, name, email, mobile, role, restaurant_id, branch_id, status, approval_status, is_online, is_deleted, created_at, updated_at')
            .single();

        if (updateErr) {
            return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }

        // Sync dine_users
        const duUpdates: Record<string, any> = {};
        if (updates.name) duUpdates.name = updates.name;
        if (updates.email !== undefined) duUpdates.email = updates.email;
        if (updates.mobile !== undefined) duUpdates.phone = updates.mobile;
        if (updates.role) duUpdates.role = updates.role;
        if (updates.status) duUpdates.status = updates.status;
        if (updates.restaurant_id) duUpdates.restaurant_id = updates.restaurant_id;

        await supabaseAdmin.from('dine_users').update(duUpdates).eq('id', userId);

        await supabaseAdmin.from('audit_logs').insert({
            restaurant_id: updatedEmployee.restaurant_id,
            user_id: auth.user.userId,
            actor_id: auth.user.userId,
            actor_role: 'SUPER_ADMIN',
            action: 'super_admin_update_staff_member',
            resource_type: 'employee',
            resource_id: userId,
            details: { updates, timestamp: new Date().toISOString() }
        });

        return NextResponse.json({
            success: true,
            user: updatedEmployee,
            message: 'Staff member updated successfully.'
        });
    } catch (err: any) {
        console.error('Super Admin update user error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}

// DELETE: Remove/Deactivate user
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        // Soft delete employee
        await supabaseAdmin.from('employees').update({
            is_deleted: true,
            status: 'inactive',
            deleted_at: new Date().toISOString()
        }).eq('id', userId);

        await supabaseAdmin.from('dine_users').update({ status: 'inactive' }).eq('id', userId);
        await supabaseAdmin.from('dine_sessions').delete().eq('user_id', userId);

        await supabaseAdmin.from('audit_logs').insert({
            user_id: auth.user.userId,
            actor_id: auth.user.userId,
            actor_role: 'SUPER_ADMIN',
            action: 'super_admin_deactivate_staff_member',
            resource_type: 'employee',
            resource_id: userId,
            details: { timestamp: new Date().toISOString() }
        });

        return NextResponse.json({ success: true, message: 'Staff member deactivated.' });
    } catch (err: any) {
        console.error('Super Admin delete user error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
