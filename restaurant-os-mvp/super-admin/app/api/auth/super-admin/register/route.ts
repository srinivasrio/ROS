import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hashPassword, validatePasswordComplexity, generateBase32Secret, generateTotpUri } from '@/lib/auth-utils';
import { RateLimiter } from '@/lib/rate-limiter';
import { EmailOtpService } from '@/lib/email-otp';
import crypto from 'crypto';

/**
 * POST /api/auth/super-admin/register
 * Secure Super Admin registration - ONLY allowed during initial platform bootstrap.
 * Requires:
 * - Email address
 * - Strong password (validated)
 * - Password confirmation
 * - Bootstrap token (only available during initial setup)
 * 
 * Flow: Register → Email verification → TOTP setup → Account activated
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password, confirmPassword, bootstrapToken } = body;

        const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
        const userAgent = request.headers.get('user-agent') || 'unknown';

        // 1. Rate Limiting (strict: 3 attempts per hour per IP)
        const limiterResult = await RateLimiter.check(`ip:${ip}:super_admin_register`, 3, 3600);
        if (!limiterResult.success) {
            await supabaseAdmin.from('audit_logs').insert({
                action: 'rate_limit_triggered',
                ip_address: ip,
                details: { endpoint: 'super_admin_register', key: `ip:${ip}:super_admin_register` }
            });
            return NextResponse.json(
                { error: 'Too many registration attempts. Please try again in an hour.' },
                { status: 429 }
            );
        }

        // 2. Validate input
        if (!email || !password || !confirmPassword) {
            return NextResponse.json({ error: 'Email, password, and password confirmation are required' }, { status: 400 });
        }

        if (password !== confirmPassword) {
            return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
        }

        const cleanEmail = email.toLowerCase().trim();

        // Basic email validation
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
        }

        // 3. Enforce strong password complexity
        if (!validatePasswordComplexity(password)) {
            return NextResponse.json({
                error: 'Password must be at least 12 characters and include uppercase, lowercase, number, and special character'
            }, { status: 400 });
        }

        // 4. CRITICAL: Check if bootstrap is allowed
        const { data: bootstrap, error: bootstrapError } = await supabaseAdmin
            .from('super_admin_bootstrap')
            .select('*')
            .maybeSingle();

        if (bootstrapError) {
            console.error('Bootstrap check error:', bootstrapError);
            return NextResponse.json({ error: 'System configuration error' }, { status: 500 });
        }

        // If bootstrap already completed, reject registration unless valid bootstrap token provided
        if (bootstrap?.completed) {
            // Allow only if a valid bootstrap token is provided (for disaster recovery)
            // This token would be generated via a secure CLI command, not exposed in code
            if (!bootstrapToken || bootstrapToken !== process.env.SUPER_ADMIN_BOOTSTRAP_TOKEN) {
                await supabaseAdmin.from('audit_logs').insert({
                    action: 'super_admin_registration_blocked',
                    ip_address: ip,
                    details: { email: cleanEmail, reason: 'bootstrap_completed_no_valid_token' }
                });
                return NextResponse.json({ 
                    error: 'Super Admin registration is not available. Platform already initialized.' 
                }, { status: 403 });
            }
        }

        // 5. Check if Super Admin already exists
        const { data: existingSuperAdmin } = await supabaseAdmin
            .from('employees')
            .select('id, email, super_admin_setup_completed')
            .ilike('role', 'SUPER_ADMIN%')
            .eq('is_deleted', false)
            .maybeSingle();

        if (existingSuperAdmin) {
            await supabaseAdmin.from('audit_logs').insert({
                action: 'super_admin_registration_blocked',
                ip_address: ip,
                details: { email: cleanEmail, reason: 'super_admin_already_exists', existing_id: existingSuperAdmin.id }
            });
            return NextResponse.json({ 
                error: 'A Super Admin account already exists. Use the login flow.' 
            }, { status: 409 });
        }

        // 6. Check if email already exists (any role)
        const { data: existingEmail } = await supabaseAdmin
            .from('employees')
            .select('id, email, role, is_deleted')
            .ilike('email', cleanEmail)
            .maybeSingle();

        if (existingEmail && !existingEmail.is_deleted) {
            return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
        }

        // 7. Generate registration token (valid for 24 hours)
        const registrationToken = crypto.randomBytes(32).toString('hex');
        const registrationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        // 8. Hash password with Argon2id
        const passwordHash = await hashPassword(password);

        // 9. Create Super Admin employee record (pending verification)
        const { data: employee, error: empError } = await supabaseAdmin
            .from('employees')
            .insert({
                name: 'Super Admin',
                email: cleanEmail,
                role: 'SUPER_ADMIN',
                status: 'pending_verification',
                approval_status: 'pending_verification',
                super_admin_setup_completed: false,
                registration_token: registrationToken,
                registration_token_expires_at: registrationTokenExpiresAt.toISOString(),
            })
            .select()
            .single();

        if (empError || !employee) {
            console.error('Failed to create Super Admin employee:', empError);
            return NextResponse.json({ error: 'Failed to create Super Admin account' }, { status: 500 });
        }

        // 10. Create auth record with password hash
        const { error: authError } = await supabaseAdmin
            .from('auth')
            .insert({
                user_id: employee.id,
                password_hash: passwordHash,
                mfa_enabled: false,
                failed_attempts: 0,
                login_email_verified: false,
            });

        if (authError) {
            // Rollback employee creation
            await supabaseAdmin.from('employees').delete().eq('id', employee.id);
            console.error('Failed to create auth record:', authError);
            return NextResponse.json({ error: 'Failed to create authentication credentials' }, { status: 500 });
        }

        // 11. Send email verification OTP
        const emailOtpResult = await EmailOtpService.createAndSendOtp(cleanEmail, ip);

        if (!emailOtpResult.success) {
            console.error('Failed to send verification email:', emailOtpResult.error);
            // Don't fail registration - user can resend OTP
        }

        // 12. Audit log
        await supabaseAdmin.from('audit_logs').insert({
            restaurant_id: null,
            user_id: employee.id,
            actor_id: employee.id,
            action: 'super_admin_registration_initiated',
            ip_address: ip,
            device: userAgent,
            browser: 'unknown',
            details: { 
                email: cleanEmail,
                registration_token_expires_at: registrationTokenExpiresAt.toISOString()
            }
        });

        return NextResponse.json({
            success: true,
            message: 'Super Admin registration initiated. Please verify your email address.',
            email: cleanEmail,
            registrationToken, // Return token so frontend can proceed to email verification step
            expiresAt: registrationTokenExpiresAt.toISOString(),
        });

    } catch (err: any) {
        console.error('Super Admin registration error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}