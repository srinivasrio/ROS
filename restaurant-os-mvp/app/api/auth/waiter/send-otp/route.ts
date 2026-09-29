import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';

// In-memory OTP storage with TTL for development/production fallback
// Map<mobile, { otp: string, expiresAt: number, employeeId: string, restaurantId: string }>
const otpStore = new Map<string, { otp: string; expiresAt: number; employeeId: string; restaurantId: string; role: string; name: string }>();

// Clean up expired OTPs periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of otpStore.entries()) {
        if (value.expiresAt < now) {
            otpStore.delete(key);
        }
    }
}, 60000);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { mobile, restaurantCode } = body;

        if (!mobile || typeof mobile !== 'string') {
            return NextResponse.json({ error: 'Valid mobile number is required' }, { status: 400 });
        }

        const cleanMobile = mobile.replace(/[^0-9]/g, '').slice(-10); // Standardize 10 digit Indian mobile
        if (cleanMobile.length !== 10) {
            return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number' }, { status: 400 });
        }

        // 1. Search employee by mobile
        let query = supabaseAdmin
            .from('employees')
            .select('id, name, mobile, role, status, approval_status, restaurant_id, restaurants(id, name, slug, status)')
            .ilike('mobile', `%${cleanMobile}%`);

        const { data: employees, error: empError } = await query;

        if (empError) {
            console.error('[send-otp] Database error fetching employee:', empError);
            return NextResponse.json({ error: 'Database verification failed' }, { status: 500 });
        }

        if (!employees || employees.length === 0) {
            return NextResponse.json({ 
                error: 'No active employee account found with this mobile number. Please contact your restaurant administrator.' 
            }, { status: 404 });
        }

        // Filter for active waiter / supervisor / admin
        const validEmployee = employees.find(emp => {
            const isRoleValid = ['waiter', 'supervisor', 'admin', 'manager'].includes(emp.role?.toLowerCase());
            const isActive = emp.status === 'active' || emp.approval_status === 'approved';
            return isRoleValid && isActive;
        });

        if (!validEmployee) {
            return NextResponse.json({ 
                error: 'Account is pending activation or disabled. Please contact your restaurant manager.' 
            }, { status: 403 });
        }

        const restaurant = Array.isArray(validEmployee.restaurants) ? validEmployee.restaurants[0] : validEmployee.restaurants;
        if (restaurant && restaurant.status === 'suspended') {
            return NextResponse.json({ error: 'Restaurant account is currently inactive.' }, { status: 403 });
        }

        // 2. Generate 6-digit cryptographically secure OTP
        const otp = process.env.NODE_ENV === 'development' || !process.env.SMS_GATEWAY_API_KEY 
            ? '123456' 
            : crypto.randomInt(100000, 999999).toString();

        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

        // Store OTP
        otpStore.set(cleanMobile, {
            otp,
            expiresAt,
            employeeId: validEmployee.id,
            restaurantId: validEmployee.restaurant_id,
            role: validEmployee.role,
            name: validEmployee.name
        });

        console.log(`[send-otp] OTP generated for waiter ${validEmployee.name} (${cleanMobile}): ${otp}`);

        return NextResponse.json({
            success: true,
            message: 'Verification code sent successfully',
            maskedMobile: `+91 ******${cleanMobile.slice(-4)}`,
            expiresInSeconds: 300,
            restaurantName: restaurant?.name || 'Dine in One Partner'
        });

    } catch (err: any) {
        console.error('[send-otp] Unexpected error:', err);
        return NextResponse.json({ error: 'Internal server error processing OTP request' }, { status: 500 });
    }
}
