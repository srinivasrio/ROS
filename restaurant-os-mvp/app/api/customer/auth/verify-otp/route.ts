import { NextRequest, NextResponse } from 'next/server';
import { resolveRestaurantId } from '@/services/utils.service';
import { CustomerOtpService, sanitizePhone } from '@/lib/customer-otp';
import { verifyPhoneEmailPayload } from '@/lib/phone-email';
import { CustomerService } from '@/services/customers.server.service';
import { signJwt, getCustomerTokenName } from '@/lib/jwt-utils';

/**
 * POST /api/customer/auth/verify-otp
 * 
 * Verifies a customer phone OTP via Phone.Email or internal fallback.
 * Upon successful verification, upserts/fetches customer record, issues a cryptographically
 * signed Customer JWT, and sets secure httpOnly cookies.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const restaurantCode = (body.restaurantCode || body.restaurantId || '').trim();
        let mobile = (body.mobile || body.phone || '').trim();
        const otp = (body.otp || body.code || '').trim();
        const name = (body.name || '').trim();
        const email = (body.email || '').trim().toLowerCase();
        const dob = (body.dob || body.dateOfBirth || '').trim();
        const userJsonUrl = (body.userJsonUrl || body.user_json_url || '').trim();
        const phoneEmailVerified = body.phoneEmailVerified === true || !!userJsonUrl;

        if (!restaurantCode) {
            return NextResponse.json({ error: 'Restaurant code is required' }, { status: 400 });
        }

        if (!mobile && !phoneEmailVerified) {
            return NextResponse.json({ error: 'Mobile number is required' }, { status: 400 });
        }

        if (!otp && !phoneEmailVerified) {
            return NextResponse.json({ error: 'Verification code is required' }, { status: 400 });
        }

        const actualRestaurantId = await resolveRestaurantId(restaurantCode);
        if (!actualRestaurantId) {
            return NextResponse.json({ error: 'Invalid or unknown restaurant' }, { status: 400 });
        }

        const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

        // 1. Verify OTP: either through Phone.Email server-side check or internal OTP fallback
        if (phoneEmailVerified && userJsonUrl) {
            const peRes = await verifyPhoneEmailPayload(userJsonUrl);
            if (!peRes.success || !peRes.phone) {
                return NextResponse.json(
                    { error: peRes.error || 'Phone.Email OTP verification failed.' },
                    { status: 400 }
                );
            }
            // Use the verified phone number from Phone.Email
            mobile = peRes.phone;
        } else if (!phoneEmailVerified) {
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
        }

        // 2. Verified! Upsert customer record
        const cleanPhone = sanitizePhone(mobile);
        const customerResult = await CustomerService.upsertCustomer(actualRestaurantId, {
            name: name || undefined,
            mobile: cleanPhone,
            email: email || undefined,
            dateOfBirth: dob || undefined,
        });

        // 3. Issue verified Customer JWT (valid for 30 days)
        const token = await signJwt({
            customerId: customerResult.customerId,
            restaurantId: actualRestaurantId,
            restaurantCode,
            mobile: cleanPhone,
            name: name || customerResult.customer?.name || undefined,
            role: 'customer',
        }, 3600 * 24 * 30);

        const cookieName = getCustomerTokenName(actualRestaurantId);
        const isProduction = process.env.NODE_ENV === 'production';

        const finalDob = dob || customerResult.customer?.date_of_birth || undefined;
        const finalName = name || customerResult.customer?.name || undefined;

        const response = NextResponse.json({
            success: true,
            customer: {
                id: customerResult.customerId,
                name: finalName,
                mobile: cleanPhone,
                email: email || customerResult.customer?.email || undefined,
                dateOfBirth: finalDob,
                dob: finalDob,
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
