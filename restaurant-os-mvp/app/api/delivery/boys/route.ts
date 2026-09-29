import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminUserFromRequest, getDeliveryOrAdminUserFromRequest } from '@/lib/jwt-utils';
import { resolveRestaurantId } from '@/services/utils.service';

/**
 * GET /api/delivery/boys?restaurantId=xxx
 * Returns delivery boys for a restaurant (admin or delivery boy).
 * Joins employee data for name/mobile.
 */
export async function GET(request: NextRequest) {
    try {
        const rawRestaurantId = request.nextUrl.searchParams.get('restaurantId') || request.nextUrl.searchParams.get('restaurantCode');
        const auth = await getDeliveryOrAdminUserFromRequest(request, rawRestaurantId);
        if (!auth) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const targetRid = rawRestaurantId || auth.user.restaurantId;
        if (!targetRid) {
            return NextResponse.json({ error: 'Restaurant context required' }, { status: 400 });
        }

        const rid = (await resolveRestaurantId(targetRid)) || targetRid;

        // Fetch delivery boys
        const { data: boys, error: boysErr } = await supabaseAdmin
            .from('delivery_boys')
            .select('*')
            .eq('restaurant_id', rid)
            .order('created_at', { ascending: false });

        if (boysErr) {
            return NextResponse.json({ error: boysErr.message }, { status: 500 });
        }

        // Fetch employee details for each delivery boy
        const employeeIds = (boys || []).map(b => b.employee_id).filter(Boolean);
        let employeesMap: Record<string, any> = {};

        if (employeeIds.length > 0) {
            const { data: employees } = await supabaseAdmin
                .from('employees')
                .select('id, name, mobile, email, avatar_url, employee_id, status, is_online, availability_status')
                .in('id', employeeIds);

            if (employees) {
                for (const emp of employees) {
                    employeesMap[emp.id] = emp;
                }
            }
        }

        // Merge employee data into delivery boys
        const enriched = (boys || []).map(boy => {
            const emp = employeesMap[boy.employee_id];
            return {
                ...boy,
                name: emp?.name || 'Unknown',
                mobile: emp?.mobile || '',
                email: emp?.email || '',
                avatar_url: emp?.avatar_url || null,
                emp_employee_id: emp?.employee_id || '',
                emp_status: emp?.status || '',
                is_online: emp?.is_online ?? false,
                availability_status: emp?.availability_status || '',
            };
        });

        return NextResponse.json({ deliveryBoys: enriched });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * POST /api/delivery/boys
 * Create or update a delivery boy (admin only).
 * Body: { employeeId, vehicle_type?, vehicle_number?, action?: 'create'|'update'|'delete', deliveryBoyId? }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action = 'create', employeeId, deliveryBoyId, vehicle_type, vehicle_number, status, restaurantId, restaurantCode } = body;

        const targetRid = restaurantId || restaurantCode;
        const user = await getAdminUserFromRequest(request, targetRid);
        if (!user) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const rawRid = targetRid || user.restaurantId;
        if (!rawRid) {
            return NextResponse.json({ error: 'Restaurant context required' }, { status: 400 });
        }

        const rid = (await resolveRestaurantId(rawRid)) || rawRid;

        if (action === 'create') {
            if (!employeeId) {
                return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
            }

            // Verify employee belongs to the same restaurant
            const { data: emp, error: empErr } = await supabaseAdmin
                .from('employees')
                .select('id, restaurant_id, name, role')
                .eq('id', employeeId)
                .eq('restaurant_id', rid)
                .eq('is_deleted', false)
                .maybeSingle();

            if (empErr || !emp) {
                return NextResponse.json({ error: 'Employee not found in this restaurant' }, { status: 404 });
            }

            // Check if already registered
            const { data: existing } = await supabaseAdmin
                .from('delivery_boys')
                .select('id')
                .eq('employee_id', employeeId)
                .eq('restaurant_id', rid)
                .maybeSingle();

            if (existing) {
                return NextResponse.json({ error: 'This employee is already registered as a delivery boy' }, { status: 409 });
            }

            // Update employee role to delivery_boy if not already
            if (emp.role?.toLowerCase() !== 'delivery_boy') {
                await supabaseAdmin
                    .from('employees')
                    .update({ role: 'delivery_boy' })
                    .eq('id', employeeId)
                    .eq('restaurant_id', rid);
            }

            const { data, error } = await supabaseAdmin
                .from('delivery_boys')
                .insert({
                    restaurant_id: rid,
                    employee_id: employeeId,
                    status: 'active',
                    vehicle_type: vehicle_type || null,
                    vehicle_number: vehicle_number || null,
                })
                .select()
                .single();

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ deliveryBoy: data, message: 'Delivery boy registered successfully' });

        } else if (action === 'update') {
            if (!deliveryBoyId) {
                return NextResponse.json({ error: 'Delivery boy ID is required for update' }, { status: 400 });
            }

            const updates: any = { updated_at: new Date().toISOString() };
            if (vehicle_type !== undefined) updates.vehicle_type = vehicle_type;
            if (vehicle_number !== undefined) updates.vehicle_number = vehicle_number;
            if (status !== undefined) updates.status = status;

            const { error } = await supabaseAdmin
                .from('delivery_boys')
                .update(updates)
                .eq('id', deliveryBoyId)
                .eq('restaurant_id', rid);

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ message: 'Delivery boy updated successfully' });

        } else if (action === 'delete') {
            if (!deliveryBoyId) {
                return NextResponse.json({ error: 'Delivery boy ID is required for deletion' }, { status: 400 });
            }

            // Check for active assignments
            const { data: activeAssignments } = await supabaseAdmin
                .from('delivery_assignments')
                .select('id')
                .eq('delivery_boy_id', deliveryBoyId)
                .eq('restaurant_id', rid)
                .not('status', 'in', '("DELIVERED","CANCELLED","REASSIGNED")')
                .limit(1);

            if (activeAssignments && activeAssignments.length > 0) {
                return NextResponse.json({ error: 'Cannot delete: delivery boy has active assignments' }, { status: 409 });
            }

            const { error } = await supabaseAdmin
                .from('delivery_boys')
                .delete()
                .eq('id', deliveryBoyId)
                .eq('restaurant_id', rid);

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ message: 'Delivery boy removed successfully' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
