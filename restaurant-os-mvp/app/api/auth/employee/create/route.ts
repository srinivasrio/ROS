import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyStaffAuth } from '@/lib/staff-guard';
import crypto from 'crypto';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, email, mobile, role, restaurant_id, vehicle_type, vehicle_number } = body;

        const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

        if (!name || !role || !restaurant_id) {
            return NextResponse.json({ error: 'Name, role, and restaurant ID are required' }, { status: 400 });
        }

        // 1. Authenticate that caller is an active Restaurant Admin for this restaurant
        const auth = await verifyStaffAuth(request, {
            allowedRoles: ['restaurant_admin'],
            requiredRestaurantId: restaurant_id
        });

        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error || 'Unauthorized: Admin access required' }, { status: auth.status || 403 });
        }

        const validRoles = ['waiter', 'chef', 'supervisor', 'cleaner', 'manager', 'delivery_boy'];
        if (!validRoles.includes(role.toLowerCase())) {
            return NextResponse.json({ error: `Invalid employee role. Must be one of: ${validRoles.join(', ')}.` }, { status: 400 });
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

        const activationToken = crypto.randomBytes(32).toString('hex');
        const newEmployeeUUID = crypto.randomUUID();

        // 3. Insert employee profile in PENDING status with NO management access
        const { data: employee, error: insertErr } = await supabaseAdmin
            .from('employees')
            .insert({
                id: newEmployeeUUID,
                employee_id: employeeId,
                restaurant_id,
                name,
                email: email ? email.toLowerCase().trim() : null,
                mobile: mobile ? String(mobile).trim() : null,
                role: role.toLowerCase(),
                status: 'pending_activation',
                approval_status: 'pending_verification',
                activation_token: activationToken,
                is_online: false,
                is_deleted: false,
            })
            .select()
            .single();

        if (insertErr) {
            console.error('Employee insert error:', insertErr);
            return NextResponse.json({ error: insertErr.message }, { status: 500 });
        }

        // 4. Create auth table placeholder (unusable password hash until activation)
        const { error: authErr } = await supabaseAdmin
            .from('auth')
            .insert({
                user_id: newEmployeeUUID,
                password_hash: 'pending_activation'
            });

        if (authErr) {
            console.error('Auth placeholder insert error:', authErr);
        }

        // 4b. If delivery boy, register into delivery_boys table
        if (role.toLowerCase() === 'delivery_boy') {
            const { error: dboyErr } = await supabaseAdmin
                .from('delivery_boys')
                .upsert({
                    restaurant_id,
                    employee_id: newEmployeeUUID,
                    status: 'active',
                    vehicle_type: vehicle_type || null,
                    vehicle_number: vehicle_number || null,
                }, { onConflict: 'restaurant_id,employee_id' });

            if (dboyErr) {
                console.error('[EmployeeCreate] Delivery boy upsert error:', dboyErr);
            }
        }

        // 5. Log audit log
        await supabaseAdmin.from('audit_logs').insert({
            restaurant_id,
            user_id: newEmployeeUUID,
            actor_id: auth.user.userId,
            employee_id: employeeId,
            action: 'employee_creation',
            ip_address: ip,
            device: 'unknown',
            browser: 'unknown',
            details: { role: role.toLowerCase(), source: 'admin_creation', creator_id: auth.user.userId }
        });

        const activationLink = `/activation?token=${activationToken}`;
        console.log(`[Onboarding] Generated employee activation link: ${activationLink}`);

        return NextResponse.json({
            success: true,
            employee,
            activationLink
        });

    } catch (error: any) {
        console.error('Employee creation error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
