import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { EmailOtpService } from '@/lib/email-otp';
import { RateLimiter } from '@/lib/rate-limiter';
import { verifyPassword } from '@/lib/auth-utils';
import crypto from 'crypto';

/**
 * POST /api/auth/super-admin/login/initiate
 * Initiate Super Admin login: verify password, then send email verification OTP
 * Flow: Password verification → Email OTP → TOTP → Session created
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password } = body;

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

        // Rate limiting (stricter for login)
        const limiterResult = await RateLimiter.check(`ip:${ip}:super_admin_login_initiate`, 5, 900); // 5 per 15 min
        if (!limiterResult.success) {
            await supabaseAdmin.from('audit_logs').insert({
                action: 'rate_limit_triggered',
                ip_address: ip,
                details: { endpoint: 'super_admin_login_initiate', key: `ip:${ip}:super_admin_login_initiate` }
            });
            return NextResponse.json(
                { error: 'Too many login attempts. Please try again in 15 minutes.' },
                { status: 429 }
            );
        }

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        const cleanEmail = email.toLowerCase().trim();

        // 1. Fetch Super Admin employee
        const { data: employees, error: empError } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('email', cleanEmail)
            .eq('is_deleted', false)
            .ilike('role', 'SUPER_ADMIN%');

        if (empError) {
            console.error('Super Admin login query error:', empError);
            return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
        }

        let employee = employees && employees.length > 0 ? employees[0] : null;

        // Fallback to dine_users view
        if (!employee) {
            const { data: dineUsers } = await supabaseAdmin
                .from('dine_users')
                .select('*')
                .eq('email', cleanEmail)
                .ilike('role', 'SUPER_ADMIN%')
                .maybeSingle();

            if (dineUsers) {
                employee = {
                    id: dineUsers.id,
                    name: dineUsers.name || 'Super Admin',
                    email: dineUsers.email,
                    role: dineUsers.role || 'SUPER_ADMIN',
                    status: dineUsers.status,
                    approval_status: 'approved',
                    super_admin_setup_completed: true,
                };
            }
        }

        if (!employee) {
            // Generic error to prevent email enumeration
            await supabaseAdmin.from('audit_logs').insert({
                action: 'super_admin_login_failed',
                ip_address: ip,
                device,
                browser,
                details: { reason: 'account_not_found', email: cleanEmail }
            });
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        // Verify Super Admin role
        const role = (employee.role || '').toUpperCase();
        if (role !== 'SUPER_ADMIN' && role !== 'SUPERADMIN') {
            await supabaseAdmin.from('audit_logs').insert({
                action: 'super_admin_login_failed',
                ip_address: ip,
                device,
                browser,
                details: { reason: 'invalid_role', email: cleanEmail, role: employee.role }
            });
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        // Check account status
        if (employee.status !== 'active' || employee.approval_status !== 'approved') {
            await supabaseAdmin.from('audit_logs').insert({
                action: 'super_admin_login_failed',
                ip_address: ip,
                device,
                browser,
                details: { reason: 'account_not_active', email: cleanEmail, status: employee.status, approval: employee.approval_status }
            });
            return NextResponse.json({ error: 'Account is not active or not approved' }, { status: 403 });
        }

        if (!employee.super_admin_setup_completed) {
            return NextResponse.json({ error: 'Super Admin setup incomplete. Please complete registration.' }, { status: 403 });
        }

        // 2. Verify password using Argon2id ONLY (no fallback)
        const { data: authRecord } = await supabaseAdmin
            .from('auth')
            .select('*')
            .eq('user_id', employee.id)
            .maybeSingle();

        let isPasswordValid = false;

        if (authRecord?.password_hash) {
            try {
                // STRICT: Only accept Argon2id hashes
                if (authRecord.password_hash.startsWith('$argon2')) {
                    isPasswordValid = await verifyPassword(password, authRecord.password_hash);
                } else {
                    // Reject plaintext or non-Argon2 hashes
                    console.warn(`[Super Admin Login] Non-Argon2 password hash detected for user ${employee.id}`);
                    isPasswordValid = false;
                }
            } catch (hashErr) {
                console.error('Argon2 verification failed:', hashErr);
                isPasswordValid = false;
            }
        }

        if (!isPasswordValid) {
            // Record failed attempt
            const newFailedCount = (authRecord?.failed_attempts || 0) + 1;
            const now = new Date();
            let lockedUntil: Date | null = null;

            if (newFailedCount >= 5) {
                lockedUntil = new Date(now.getTime() + 15 * 60 * 1000); // 15 min lockout
            }

            await supabaseAdmin
                .from('auth')
                .update({
                    failed_attempts: newFailedCount,
                    locked_until: lockedUntil?.toISOString() || null,
                    last_ip: ip,
                    last_device: device,
                    last_browser: browser,
                })
                .eq('user_id', employee.id);

            await supabaseAdmin.from('audit_logs').insert({
                action: 'super_admin_login_failed',
                ip_address: ip,
                device,
                browser,
                details: { reason: 'invalid_password', email: cleanEmail, failed_attempts: newFailedCount }
            });

            if (lockedUntil) {
                return NextResponse.json({ 
                    error: 'Account locked due to 5 failed attempts. Try again in 15 minutes.',
                    locked: true,
                    lockedUntil: lockedUntil.toISOString()
                }, { status: 429 });
            }

            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        // Check if account is locked
        if (authRecord?.locked_until && new Date(authRecord.locked_until) > new Date()) {
            return NextResponse.json({ 
                error: 'Account is locked. Please try again later.',
                locked: true,
                lockedUntil: authRecord.locked_until
            }, { status: 429 });
        }

        // 3. Password verified - now send email verification OTP
        const emailOtpResult = await EmailOtpService.createAndSendOtp(cleanEmail, ip);

        if (!emailOtpResult.success) {
            console.error('Failed to send login verification email:', emailOtpResult.error);
            return NextResponse.json({ error: 'Failed to send verification email. Please try again.' }, { status: 500 });
        }

        // 4. Generate login verification token (valid for 10 minutes)
        const loginVerificationToken = crypto.randomBytes(32).toString('hex');
        const loginVerificationTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Store the token in employees table for verification in next step
        await supabaseAdmin
            .from('employees')
            .update({
                login_verification_token: loginVerificationToken,
                login_verification_token_expires_at: loginVerificationTokenExpiresAt.toISOString(),
            })
            .eq('id', employee.id);

        // 5. Audit log
        await supabaseAdmin.from('audit_logs').insert({
            restaurant_id: null,
            user_id: employee.id,
            actor_id: employee.id,
            action: 'super_admin_password_verified',
            ip_address: ip,
            device,
            browser,
            details: { 
                email: cleanEmail,
                next_step: 'email_verification'
            }
        });

        return NextResponse.json({
            success: true,
            message: 'Password verified. Please check your email for the verification code.',
            email: cleanEmail,
            loginVerificationToken,
            expiresAt: loginVerificationTokenExpiresAt.toISOString(),
            requiresEmailVerification: true,
            requiresTotp: true,
        });

    } catch (err: any) {
        console.error('Super Admin login initiate error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}