import { NextRequest, NextResponse } from 'next/server';
import { resolveRestaurantId } from '@/services/utils.service';
import { CustomerOtpService, sanitizePhone } from '@/lib/customer-otp';
import { CustomerService } from '@/services/customers.server.service';
import { signJwt, getCustomerTokenName } from '@/lib/jwt-utils';

/**
 * POST /api/customer/auth/verify-otp
 * 
 * Verifies a customer phone OTP.
 * Upon successful verification, upserts/fetches customer record, issues a cryptographically
 * signed Customer JWT, and sets secure httpOnly cookies.
 * Strictly required before any Customer JWT can be issued.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const restaurantCode = (body.restaurantCode || body.restaurantId || '').trim();
        const mobile = (body.mobile || body.phone || '').trim();
        const otp = (body.otp || body.code || '').trim();
        const name = (body.name || '').trim();
        const email = (body.email || '').trim().toLowerCase();

        if (!restaurantCode) {
            return NextResponse.json({ error: 'Restaurant code is required' }, { status: 400 });
        }

        if (!mobile) {
            return NextResponse.json({ error: 'Mobile number is required' }, { status: 400 });
        }

        if (!otp) {
            return NextResponse.json({ error: 'Verification code is required' }, { status: 400 });
        }

        const actualRestaurantId = await resolveRestaurantId(restaurantCode);
        if (!actualRestaurantId) {
            return NextResponse.json({ error: 'Invalid or unknown restaurant' }, { status: 400 });
        }

        const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

        // 1. Verify OTP with attempt limits, expiry, and single-use checks
        const verification = await CustomerOtpService.verifyOtp(actualRestaurantId, mobile, otp, clientIp);

        if (!verification.success) {
            const status = verification.remainingAttempts === 0 ? 429 : 400;
            return NextResponse.json(
                {
                    error: verification.error,
                    remainingAttempts: verification.remainingAttempts,
                },
                { status }
            );
        }

        // 2. Verified! Upsert customer record
        const cleanPhone = sanitizePhone(mobile);
        const customerResult = await CustomerService.upsertCustomer(actualRestaurantId, {
            name: name || undefined,
            mobile: cleanPhone,
            email: email || undefined,
        });

        // 3. Issue verified Customer JWT (valid for 30 days)
        const token = await signJwt({
            customerId: customerResult.customerId,
            restaurantId: actualRestaurantId,
            restaurantCode,
            mobile: cleanPhone,
            name: name || undefined,
            role: 'customer',
        }, 3600 * 24 * 30);

        const cookieName = getCustomerTokenName(actualRestaurantId);
        const isProduction = process.env.NODE_ENV === 'production';

        const response = NextResponse.json({
            success: true,
            customer: {
                id: customerResult.customerId,
                name: name || undefined,
                mobile: cleanPhone,
                email: email || undefined,
            },
            token,
        });

        // Set customer-scoped auth cookie
        response.cookies.set(cookieName, token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            path: '/',
            maxAge: 3600 * 24 * 30, // 30 days
        });

        // Also set generic fallback customer cookie
        response.cookies.set('dine_customer_token', token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            path: '/',
            maxAge: 3600 * 24 * 30,
        });

        return response;
    } catch (err: any) {
        console.error('[Customer Verify OTP Uncaught Error]', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
