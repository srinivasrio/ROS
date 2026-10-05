import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { EmailOtpService } from '@/lib/email-otp';
import { RateLimiter } from '@/lib/rate-limiter';

/**
 * POST /api/auth/super-admin/login/verify-email
 * Verify email OTP during Super Admin login
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, otp, loginVerificationToken } = body;

        const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
        const userAgent = request.headers.get('user-agent') || 'unknown';

        let browser = 'unknown';
        let device = 'desktop';
        if (userAgent.toLowerCase().includes('mobile') || userAgent.toLowerCase().includes('android') || userAgent.toLowerCase().includes('iphone')) {
            device = 'mobile';
        }
        if (userAgent.toLowerCase().includes('chrome')) {
            browser = 'chrome';
        } else if (userAgent.toLowerCase().includes('safari')) {
            browser = 'safari';
        } else if (userAgent.toLowerCase().includes('firefox')) {
            browser = 'firefox';
        }

        // Rate limiting
        const limiterResult = await RateLimiter.check(`ip:${ip}:super_admin_login_verify_email`, 10, 900);
        if (!limiterResult.success) {
            await supabaseAdmin.from('audit_logs').insert({
                action: 'rate_limit_triggered',
                ip_address: ip,
                details: { endpoint: 'super_admin_login_verify_email', key: `ip:${ip}:super_admin_login_verify_email` }
            });
            return NextResponse.json(
                { error: 'Too many verification attempts. Please try again in 15 minutes.' },
                { status: 429 }
            );
        }

        if (!email || !otp || !loginVerificationToken) {
            return NextResponse.json({ error: 'Email, OTP, and verification token are required' }, { status: 400 });
        }

        const cleanEmail = email.toLowerCase().trim();

        // 1. Verify OTP using the email-otp service
        const verifyResult = await EmailOtpService.verifyOtp(cleanEmail, otp, { skipEmployeeUpdate: true, isLogin: true });

        if (!verifyResult.success) {
            return NextResponse.json({ 
                error: verifyResult.error || 'Invalid or expired verification code',
                reason: verifyResult.reason,
                attemptsRemaining: verifyResult.attemptsRemaining
            }, { status: 400 });
        }

        // 2. Verify login verification token matches and hasn't expired
        const { data: employee, error: empError } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('email', cleanEmail)
            .eq('login_verification_token', loginVerificationToken)
            .eq('is_deleted', false)
            .ilike('role', 'SUPER_ADMIN%')
            .maybeSingle();

        if (empError || !employee) {
            return NextResponse.json({ error: 'Invalid or expired verification token' }, { status: 400 });
        }

        // Check token expiration
        if (new Date(employee.login_verification_token_expires_at) < new Date()) {
            return NextResponse.json({ error: 'Verification token has expired. Please restart login.' }, { status: 400 });
        }

        // 3. Clear the login verification token (single-use)
        await supabaseAdmin
            .from('employees')
            .update({
                login_verification_token: null,
                login_verification_token_expires_at: null,
            })
            .eq('id', employee.id);

        // 4. Audit log
        await supabaseAdmin.from('audit_logs').insert({
            restaurant_id: null,
            user_id: employee.id,
            actor_id: employee.id,
            action: 'super_admin_login_email_verified',
            ip_address: ip,
            device,
            browser,
            details: { 
                email: cleanEmail,
                next_step: 'totp_verification'
            }
        });

        // 5. Return success with TOTP requirement
        return NextResponse.json({
            success: true,
            message: 'Email verified. Please enter your TOTP code from Google Authenticator.',
            employeeId: employee.id,
            employeeName: employee.name || 'Super Admin',
            requiresTotp: true,
        });

    } catch (err: any) {
        console.error('Super Admin login email verification error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}