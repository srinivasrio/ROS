import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { OtpManager } from '@/lib/otp-store';
import { signJwt } from '@/lib/jwt-utils';
import { getAuthCookieOptions } from '@/lib/panel-auth';
import crypto from 'crypto';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { mobile, otp } = body;

        if (!mobile || !otp) {
            return NextResponse.json({ error: 'Mobile number and OTP are required' }, { status: 400 });
        }

        const cleanMobile = mobile.replace(/[^0-9]/g, '').slice(-10);
        const cleanOtp = otp.toString().trim();

        // 1. Verify OTP using the same bounded store used by the send route.
        if (!OtpManager.verifyOtp(cleanMobile, cleanOtp)) {
            return NextResponse.json({ error: 'Invalid or expired OTP code. Please try again.' }, { status: 401 });
        }

        // 2. Fetch latest employee and restaurant record from DB
        const { data: employees, error: empError } = await supabaseAdmin
            .from('employees')
            .select('id, employee_id, name, mobile, role, status, approval_status, session_version, restaurant_id')
            .ilike('mobile', `%${cleanMobile}%`)
            .eq('is_deleted', false);

        if (empError || !employees || employees.length === 0) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }

        const employee = employees.find(emp => {
            const isRoleValid = ['waiter', 'supervisor', 'admin', 'manager'].includes(emp.role?.toLowerCase());
            const isActive = emp.status === 'active' || emp.approval_status === 'approved';
            return isRoleValid && isActive;
        });

        if (!employee) {
            return NextResponse.json({ error: 'Account is not authorized for waiter access' }, { status: 403 });
        }

        let restaurant: any = null;
        if (employee.restaurant_id) {
            const { data: rest } = await supabaseAdmin
                .from('restaurants')
                .select('id, name, slug, status')
                .eq('id', employee.restaurant_id)
                .maybeSingle();
            restaurant = rest;
        }

        // 3. Clear OTP after successful verification
        OtpManager.clear(cleanMobile);

        // 4. Create authenticated session & sign cryptographically secure HS256 JWT
        const sessionId = crypto.randomUUID();
        const currentSessionVersion = employee.session_version ?? 1;

        const sessionPayload = {
            sessionId,
            userId: employee.id,
            employeeId: employee.employee_id || employee.id,
            name: employee.name,
            mobile: employee.mobile || cleanMobile,
            role: 'waiter',
            sessionVersion: currentSessionVersion,
            restaurantId: employee.restaurant_id || null,
            restaurant_id: employee.restaurant_id || null,
            employee_id: employee.employee_id || null,
            restaurantName: restaurant?.name || 'Dine in One',
            restaurantSlug: restaurant?.slug || employee.restaurant_id,
            issuedAt: Date.now()
        };

        const token = await signJwt({
            sessionId,
            userId: employee.id,
            name: employee.name,
            role: 'waiter',
            sessionVersion: currentSessionVersion,
            email: (employee as any).email || null,
            mobile: employee.mobile || cleanMobile,
            restaurantId: employee.restaurant_id || null,
            restaurant_id: employee.restaurant_id || null,
            employee_id: employee.employee_id || null,
            employeeId: employee.employee_id || null,
        });

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        await supabaseAdmin.from('dine_sessions').insert({
            id: sessionId,
            user_id: employee.id,
            token_hash: tokenHash,
            device_info: req.headers.get('user-agent') || 'waiter_client',
            ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
            is_active: true,
        });

        const isHttps = req.headers.get('x-forwarded-proto') === 'https';
        const cookieOpts = getAuthCookieOptions(isHttps);

        const response = NextResponse.json({
            success: true,
            message: 'OTP verified successfully',
            token,
            session: sessionPayload,
            permissions: [
                'view_tables',
                'create_orders',
                'modify_orders',
                'mark_served',
                'view_requests',
                'request_bill',
                'merge_tables'
            ]
        });

        // Set secure cookies for unified auth consistency
        response.cookies.set('dine_auth_token', token, cookieOpts);
        response.cookies.set('dine_auth_token_waiter', token, cookieOpts);
        if (employee.restaurant_id) {
            const cleanRid = String(employee.restaurant_id).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
            response.cookies.set(`dine_auth_token_${cleanRid}`, token, cookieOpts);
            response.cookies.set(`dine_auth_token_${cleanRid}_waiter`, token, cookieOpts);
            response.cookies.set(`dine_auth_token_${cleanRid}_${cleanMobile}`, token, cookieOpts);
            response.cookies.set(`dine_auth_token_staff_${cleanMobile}`, token, cookieOpts);
        }

        return response;

    } catch (err: any) {
        console.error('[verify-otp] Unexpected error:', err);
        return NextResponse.json({ error: 'Internal server error verifying OTP' }, { status: 500 });
    }
}
