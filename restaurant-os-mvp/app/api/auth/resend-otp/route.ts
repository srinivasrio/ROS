import { NextResponse } from 'next/server';
import { EmailOtpService } from '@/lib/email-otp';
import { RateLimiter } from '@/lib/rate-limiter';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

        const email = (body.email || '').toLowerCase().trim();

        if (!email) {
            return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
        }

        // Global IP rate limiting: 10 resend requests per hour per IP
        const ipLimitCheck = await RateLimiter.check(`resend_ip:${clientIp}`, 10, 3600);
        if (!ipLimitCheck.success) {
            return NextResponse.json(
                { error: 'Too many requests. Please wait a while before requesting another code.' },
                { status: 429 }
            );
        }

        // Check whether account exists without leaking information
        const { data: existingUser } = await supabaseAdmin
            .from('employees')
            .select('id, email_verified, is_deleted')
            .ilike('email', email)
            .eq('is_deleted', false)
            .maybeSingle();

        // If the email is already verified, inform user appropriately
        if (existingUser?.email_verified) {
            return NextResponse.json(
                { error: 'This email address is already verified. Please sign in.' },
                { status: 400 }
            );
        }

        // If no user exists, return generic success message to prevent email enumeration
        if (!existingUser) {
            return NextResponse.json({
                success: true,
                message: 'If an account is associated with this email, a new verification code has been sent.',
            });
        }

        // Call resendOtp which enforces the 60-second cooldown and invalidates previous OTP
        const result = await EmailOtpService.resendOtp(email, clientIp, {
            forceFailSes: body.forceFailSes === true,
        });

        if (!result.success) {
            const isCooldown = Boolean(result.cooldownRemaining);
            return NextResponse.json(
                {
                    error: result.error || 'Failed to resend verification code',
                    cooldownRemaining: result.cooldownRemaining,
                },
                { status: isCooldown ? 429 : 400 }
            );
        }

        return NextResponse.json({
            success: true,
            email,
            cooldownRemaining: 60,
            expiresAt: result.expiresAt,
            devOtp: result.devOtp,
            message: 'A new verification code has been sent to your email address.',
        });

    } catch (err: any) {
        console.error('[Resend OTP API Error]:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
