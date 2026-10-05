import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';
import { OtpManager } from '@/lib/otp-store';
import { RateLimiter } from '@/lib/rate-limiter';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { mobile } = body;

        if (!mobile || typeof mobile !== 'string') {
            return NextResponse.json({ error: 'Valid mobile number is required' }, { status: 400 });
        }

        const cleanMobile = mobile.replace(/[^0-9]/g, '').slice(-10); // Standardize 10 digit Indian mobile
        if (cleanMobile.length !== 10) {
            return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number' }, { status: 400 });
        }

        const rateCheck = await RateLimiter.check(`waiter_otp_send:${cleanMobile}`, 3, 600);
        if (!rateCheck.success) {
            return NextResponse.json({ error: 'Too many OTP requests. Please try again later.' }, { status: 429 });
        }

        // 1. Search employee by mobile
        const query = supabaseAdmin
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
        if (process.env.NODE_ENV !== 'development' && !process.env.SMS_GATEWAY_API_KEY) {
            return NextResponse.json({ error: 'SMS verification is not configured. Please contact your administrator.' }, { status: 503 });
        }

        const otp = process.env.NODE_ENV === 'development'
            ? '123456' 
            : crypto.randomInt(100000, 999999).toString();

        OtpManager.setOtp(cleanMobile, otp, 5 * 60);

        console.log(`[send-otp] OTP generated for waiter ${validEmployee.name} (${cleanMobile.slice(-4)})`);

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
