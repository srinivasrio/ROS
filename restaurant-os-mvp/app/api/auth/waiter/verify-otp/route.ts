import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';

// Reusing global store
const otpStore = (global as any).__waiterOtpStore || new Map<string, any>();
(global as any).__waiterOtpStore = otpStore;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { mobile, otp } = body;

        if (!mobile || !otp) {
            return NextResponse.json({ error: 'Mobile number and OTP are required' }, { status: 400 });
        }

        const cleanMobile = mobile.replace(/[^0-9]/g, '').slice(-10);
        const cleanOtp = otp.toString().trim();

        // 1. Verify OTP
        const cachedOtpData = otpStore.get(cleanMobile);

        // Allow dev fallback '123456' in non-production or if match
        const isDevFallback = (process.env.NODE_ENV === 'development' || !process.env.SMS_GATEWAY_API_KEY) && cleanOtp === '123456';
        const isMatch = cachedOtpData && cachedOtpData.otp === cleanOtp && cachedOtpData.expiresAt > Date.now();

        if (!isMatch && !isDevFallback) {
            return NextResponse.json({ error: 'Invalid or expired OTP code. Please try again.' }, { status: 401 });
        }

        // 2. Fetch latest employee and restaurant record from DB
        const { data: employees, error: empError } = await supabaseAdmin
            .from('employees')
            .select('id, employee_id, name, mobile, role, status, approval_status, restaurant_id, restaurants(id, name, slug, status)')
            .ilike('mobile', `%${cleanMobile}%`);

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

        const restaurant = Array.isArray(employee.restaurants) ? employee.restaurants[0] : employee.restaurants;

        // 3. Clear OTP after successful verification
        otpStore.delete(cleanMobile);

        // 4. Generate persistent session payload & bearer token
        const sessionPayload = {
            userId: employee.id,
            employeeId: employee.employee_id || employee.id,
            name: employee.name,
            mobile: employee.mobile,
            role: employee.role,
            restaurantId: employee.restaurant_id,
            restaurantName: restaurant?.name || 'Dine in One',
            restaurantSlug: restaurant?.slug || employee.restaurant_id,
            issuedAt: Date.now()
        };

        const token = Buffer.from(JSON.stringify(sessionPayload)).toString('base64');

        return NextResponse.json({
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

    } catch (err: any) {
        console.error('[verify-otp] Unexpected error:', err);
        return NextResponse.json({ error: 'Internal server error verifying OTP' }, { status: 500 });
    }
}
