import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyStaffAuth } from '@/lib/staff-guard';
import { hashPin, isPinFormatValid } from '@/lib/auth-utils';
import { recordAuthAuditLog } from '@/lib/panel-auth';

/**
 * POST /api/auth/employee/update-pin
 * Allows an authorized Restaurant Admin to securely set or reset an employee's PIN.
 * Hashes PIN using Argon2id and bumps session_version to invalidate old sessions.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { employeeId, restaurantId, newPin } = body;

        if (!employeeId || !restaurantId || !newPin) {
            return NextResponse.json({ error: 'employeeId, restaurantId, and newPin are required' }, { status: 400 });
        }

        const cleanPin = String(newPin).trim();
        if (!isPinFormatValid(cleanPin)) {
            return NextResponse.json({ error: 'PIN must be a 4 to 6 digit numeric code' }, { status: 400 });
        }

        // 1. Verify caller is authorized Restaurant Admin for this restaurant
        const auth = await verifyStaffAuth(req, {
            allowedRoles: ['restaurant_admin'],
            requiredRestaurantId: restaurantId
        });

        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error || 'Unauthorized: Admin access required' }, { status: auth.status || 403 });
        }

        // 2. Verify target employee belongs to this restaurant
        const { data: employee, error: empErr } = await supabaseAdmin
            .from('employees')
            .select('id, name, role, restaurant_id, session_version')
            .eq('id', employeeId)
            .eq('restaurant_id', restaurantId)
            .maybeSingle();

        if (empErr || !employee) {
            return NextResponse.json({ error: 'Employee not found in this restaurant' }, { status: 404 });
        }

        // 3. Hash the new PIN with Argon2id
        const hashedPin = await hashPin(cleanPin);
        const nextSessionVersion = (employee.session_version || 1) + 1;

        // 4. Update employee and auth records
        const [empUpdate, authUpdate] = await Promise.all([
            supabaseAdmin
                .from('employees')
                .update({
                    pin: hashedPin,
                    raw_pin: cleanPin,
                    session_version: nextSessionVersion
                })
                .eq('id', employeeId),
            supabaseAdmin
                .from('auth')
                .upsert({
                    user_id: employeeId,
                    password_hash: hashedPin,
                    failed_attempts: 0,
                    locked_until: null
                }, { onConflict: 'user_id' })
        ]);

        if (empUpdate.error) {
            console.error('[UpdatePin] Employee update error:', empUpdate.error);
            return NextResponse.json({ error: 'Failed to update employee PIN' }, { status: 500 });
        }

        const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';

        await recordAuthAuditLog({
            restaurantId,
            userId: employeeId,
            action: 'employee_pin_reset',
            ip,
            details: {
                target_employee_id: employeeId,
                target_name: employee.name,
                admin_user_id: auth.user.userId
            }
        });

        return NextResponse.json({
            success: true,
            message: `PIN for ${employee.name} updated successfully`
        });

    } catch (err: any) {
        console.error('[UpdatePin] Error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
