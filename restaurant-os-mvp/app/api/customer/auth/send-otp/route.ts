import { NextRequest, NextResponse } from 'next/server';
import { resolveRestaurantId } from '@/services/utils.service';
import { CustomerOtpService } from '@/lib/customer-otp';

/**
 * POST /api/customer/auth/send-otp
 * 
 * Initiates customer phone verification by generating a cryptographically secure 6-digit OTP,
 * hashing it with HMAC-SHA256, and storing it with strict RLS and 5-minute expiry.
 * Rate-limits requests per phone and client IP.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const restaurantCode = (body.restaurantCode || body.restaurantId || '').trim();
        const mobile = (body.mobile || body.phone || '').trim();

        if (!restaurantCode) {
            return NextResponse.json({ error: 'Restaurant code is required' }, { status: 400 });
        }

        if (!mobile) {
            return NextResponse.json({ error: 'Mobile number is required' }, { status: 400 });
        }

        const actualRestaurantId = await resolveRestaurantId(restaurantCode);
        if (!actualRestaurantId) {
            return NextResponse.json({ error: 'Invalid or unknown restaurant' }, { status: 400 });
        }

        const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

        const result = await CustomerOtpService.sendOtp(actualRestaurantId, mobile, clientIp);

        if (!result.success) {
            const status = result.cooldownRemainingSeconds ? 429 : 400;
            return NextResponse.json(
                {
                    error: result.error,
                    cooldownRemaining: result.cooldownRemainingSeconds,
                },
                { status }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Verification code sent successfully',
            maskedPhone: result.maskedPhone,
            cooldownRemaining: result.cooldownRemainingSeconds,
            expiresAt: result.expiresAt?.toISOString(),
            devOtp: result.devOtp, // Safe dev/test aid in non-production
        });
    } catch (err: any) {
        console.error('[Customer Send OTP Uncaught Error]', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
