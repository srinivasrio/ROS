import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { signJwt } from '@/lib/jwt-utils';
import { verifyTotpCode } from '@/lib/auth-utils';
import { RateLimiter } from '@/lib/rate-limiter';
import crypto from 'crypto';

/**
 * POST /api/auth/super-admin/login/verify-totp
 * Verify TOTP code during Super Admin login to complete authentication
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { employeeId, otpCode } = body;

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
        const limiterResult = await RateLimiter.check(`ip:${ip}:super_admin_login_verify_totp`, 10, 900);
        if (!limiterResult.success) {
            await supabaseAdmin.from('audit_logs').insert({
                action: 'rate_limit_triggered',
                ip_address: ip,
                details: { endpoint: 'super_admin_login_verify_totp', key: `ip:${ip}:super_admin_login_verify_totp` }
            });
            return NextResponse.json(
                { error: 'Too many TOTP attempts. Please try again in 15 minutes.' },
                { status: 429 }
            );
        }

        if (!employeeId || !otpCode) {
            return NextResponse.json({ error: 'Employee ID and TOTP code are required' }, { status: 400 });
        }

        // 1. Fetch employee
        const { data: employee, error: empError } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('id', employeeId)
            .eq('is_deleted', false)
            .ilike('role', 'SUPER_ADMIN%')
            .maybeSingle();

        if (empError || !employee) {
            return NextResponse.json({ error: 'Super Admin not found' }, { status: 404 });
        }

        if (employee.status !== 'active' || employee.approval_status !== 'approved') {
            return NextResponse.json({ error: 'Account is not active' }, { status: 403 });
        }

        // 2. Fetch TOTP secret from auth table
        const { data: authRecord, error: authError } = await supabaseAdmin
            .from('auth')
            .select('totp_secret, mfa_enabled, failed_attempts, locked_until')
            .eq('user_id', employee.id)
            .maybeSingle();

        if (authError || !authRecord) {
            return NextResponse.json({ error: 'MFA not configured for this account' }, { status: 400 });
        }

        if (!authRecord.mfa_enabled || !authRecord.totp_secret) {
            return NextResponse.json({ error: 'MFA is not enabled. Please contact support.' }, { status: 400 });
        }

        // Check if account is locked
        if (authRecord.locked_until && new Date(authRecord.locked_until) > new Date()) {
            return NextResponse.json({ 
                error: 'Account is locked. Please try again later.',
                locked: true,
                lockedUntil: authRecord.locked_until
            }, { status: 429 });
        }

        // 3. Verify TOTP code
        const isValid = verifyTotpCode(authRecord.totp_secret, otpCode.trim());
        if (!isValid) {
            // Increment failed attempts
            const newFailedCount = (authRecord.failed_attempts || 0) + 1;
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
                restaurant_id: null,
                user_id: employee.id,
                actor_id: employee.id,
                action: 'super_admin_login_totp_failed',
                ip_address: ip,
                device,
                browser,
                details: { reason: 'invalid_totp', failed_attempts: newFailedCount }
            });

            if (lockedUntil) {
                return NextResponse.json({ 
                    error: 'Account locked due to 5 failed TOTP attempts. Try again in 15 minutes.',
                    locked: true,
                    lockedUntil: lockedUntil.toISOString()
                }, { status: 429 });
            }

            return NextResponse.json({ 
                error: `Invalid TOTP code. ${5 - newFailedCount} attempt${5 - newFailedCount === 1 ? '' : 's'} remaining.`
            }, { status: 401 });
        }

        // 4. TOTP verified successfully - reset failed attempts, update last login
        const nextSessionVersion = (employee.session_version || 1) + 1;

        await supabaseAdmin
            .from('auth')
            .update({
                failed_attempts: 0,
                locked_until: null,
                last_login: new Date().toISOString(),
                last_ip: ip,
                last_device: device,
                last_browser: browser,
            })
            .eq('user_id', employee.id);

        // Update session version
        await supabaseAdmin
            .from('employees')
            .update({
                session_version: nextSessionVersion,
            })
            .eq('id', employee.id);

        // 5. Generate JWT token
        const token = await signJwt({
            userId: employee.id,
            email: employee.email,
            name: employee.name || 'Super Admin',
            role: 'SUPER_ADMIN',
            sessionVersion: nextSessionVersion,
        }, 60 * 60 * 8); // 8 hours for Super Admin (shorter for security)

        // 6. Create session record
        const sessionId = crypto.randomUUID();
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        await supabaseAdmin.from('dine_sessions').insert({
            id: sessionId,
            user_id: employee.id,
            token_hash: tokenHash,
            device_info: userAgent,
            ip_address: ip,
            is_active: true,
        });

        // 7. Audit log
        await supabaseAdmin.from('audit_logs').insert([
            {
                restaurant_id: null,
                user_id: employee.id,
                actor_id: employee.id,
                action: 'super_admin_login_success',
                ip_address: ip,
                device,
                browser,
                details: { 
                    email: employee.email,
                    method: 'password_email_totp'
                }
            },
            {
                restaurant_id: null,
                user_id: employee.id,
                target_user_id: employee.id,
                actor_id: employee.id,
                action: 'session_version_incremented',
                ip_address: ip,
                device,
                browser,
                details: { reason: 'super_admin_login', new_version: nextSessionVersion }
            }
        ]);

        // 8. Set secure cookies and return success
        const response = NextResponse.json({
            success: true,
            message: 'Super Admin login successful',
            user: {
                id: employee.id,
                name: employee.name || 'Super Admin',
                email: employee.email,
                role: 'SUPER_ADMIN'
            }
        });

        // Set secure HTTP-only cookies
        response.cookies.set('dine_superadmin_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 8 // 8 hours
        });

        response.cookies.set('dine_auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 8
        });

        return response;

    } catch (err: any) {
        console.error('Super Admin TOTP verification error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}