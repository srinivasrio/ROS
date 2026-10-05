import { NextResponse } from 'next/server';
import { EmailOtpService } from '@/lib/email-otp';
import { RateLimiter } from '@/lib/rate-limiter';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

        const email = (body.email || '').toLowerCase().trim();
        const otp = String(body.otp || '').trim();

        if (!email) {
            return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
        }

        if (!otp) {
            return NextResponse.json({ error: 'Verification code is required' }, { status: 400 });
        }

        // Global IP rate limiting: 30 attempts per 10 minutes per IP
        const ipLimitCheck = await RateLimiter.check(`verify_ip:${clientIp}`, 30, 600);
        if (!ipLimitCheck.success) {
            return NextResponse.json(
                { error: 'Too many verification requests from this network. Please wait a few minutes.' },
                { status: 429 }
            );
        }

        // Verify the submitted OTP against the hashed record in DB
        const result = await EmailOtpService.verifyOtp(email, otp);

        if (!result.success) {
            const statusCode = result.reason === 'MAX_ATTEMPTS_EXCEEDED' ? 429 : 400;
            return NextResponse.json(
                {
                    error: result.error || 'Verification failed',
                    reason: result.reason,
                    attemptsRemaining: result.attemptsRemaining,
                },
                { status: statusCode }
            );
        }

        return NextResponse.json({
            success: true,
            verified: true,
            email,
            message: 'Email address has been successfully verified.',
        });

    } catch (err: any) {
        console.error('[Verify OTP API Error]:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
