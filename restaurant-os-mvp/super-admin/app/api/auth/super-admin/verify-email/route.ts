import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { EmailOtpService } from '@/lib/email-otp';
import { RateLimiter } from '@/lib/rate-limiter';
import { generateBase32Secret, generateTotpUri } from '@/lib/auth-utils';

/**
 * POST /api/auth/super-admin/verify-email
 * Verify Super Admin email during registration using OTP
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, otp, registrationToken } = body;

        const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
        const userAgent = request.headers.get('user-agent') || 'unknown';

        // Rate limiting
        const limiterResult = await RateLimiter.check(`ip:${ip}:super_admin_verify_email`, 10, 3600);
        if (!limiterResult.success) {
            return NextResponse.json(
                { error: 'Too many verification attempts. Please try again in an hour.' },
                { status: 429 }
            );
        }

        if (!email || !otp || !registrationToken) {
            return NextResponse.json({ error: 'Email, OTP, and registration token are required' }, { status: 400 });
        }

        const cleanEmail = email.toLowerCase().trim();

        // 1. Verify OTP using the email-otp service
        const verifyResult = await EmailOtpService.verifyOtp(cleanEmail, otp);

        if (!verifyResult.success) {
            return NextResponse.json({ 
                error: verifyResult.error || 'Invalid or expired verification code',
                reason: verifyResult.reason,
                attemptsRemaining: verifyResult.attemptsRemaining
            }, { status: 400 });
        }

        // 2. Verify registration token matches
        const { data: employee, error: empError } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('email', cleanEmail)
            .eq('registration_token', registrationToken)
            .eq('is_deleted', false)
            .maybeSingle();

        if (empError || !employee) {
            return NextResponse.json({ error: 'Invalid registration token or email' }, { status: 400 });
        }

        // Check token expiration
        if (new Date(employee.registration_token_expires_at) < new Date()) {
            return NextResponse.json({ error: 'Registration token has expired. Please restart registration.' }, { status: 400 });
        }

        // 3. Generate TOTP secret for MFA setup
        const totpSecret = generateBase32Secret();
        const totpUri = generateTotpUri(cleanEmail, 'Dine In One Super Admin', totpSecret);

        // 4. Update employee: mark email verified, store TOTP secret temporarily, clear registration token
        const { error: updateError } = await supabaseAdmin
            .from('employees')
            .update({
                email_verified: true,
                email_verified_at: new Date().toISOString(),
                status: 'pending_mfa_setup',
                approval_status: 'awaiting_mfa',
                registration_token: null,
                registration_token_expires_at: null,
            })
            .eq('id', employee.id);

        if (updateError) {
            console.error('Failed to update employee after email verification:', updateError);
            return NextResponse.json({ error: 'Failed to complete email verification' }, { status: 500 });
        }

        // 5. Store TOTP secret temporarily in auth table (will be confirmed on TOTP verification)
        const { error: authError } = await supabaseAdmin
            .from('auth')
            .update({
                totp_secret: totpSecret,
                mfa_enabled: false, // Will be enabled after TOTP verification
            })
            .eq('user_id', employee.id);

        if (authError) {
            console.error('Failed to store TOTP secret:', authError);
            return NextResponse.json({ error: 'Failed to initialize MFA setup' }, { status: 500 });
        }

        // 6. Audit log
        await supabaseAdmin.from('audit_logs').insert({
            restaurant_id: null,
            user_id: employee.id,
            actor_id: employee.id,
            action: 'super_admin_email_verified',
            ip_address: ip,
            device: userAgent,
            browser: 'unknown',
            details: { 
                email: cleanEmail,
                next_step: 'totp_setup'
            }
        });

        // 7. Return TOTP setup data (secret + QR code URI)
        return NextResponse.json({
            success: true,
            message: 'Email verified successfully. Please set up Google Authenticator.',
            totpSecret,
            totpUri,
            employeeId: employee.id,
            employeeName: employee.name || 'Super Admin',
        });

    } catch (err: any) {
        console.error('Super Admin email verification error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}