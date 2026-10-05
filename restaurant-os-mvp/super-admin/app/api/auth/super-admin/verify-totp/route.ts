import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyTotpCode } from '@/lib/auth-utils';
import { RateLimiter } from '@/lib/rate-limiter';
import crypto from 'crypto';

/**
 * POST /api/auth/super-admin/verify-totp
 * Verify TOTP code during Super Admin registration to complete MFA setup
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { employeeId, totpSecret, otpCode } = body;

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
        const limiterResult = await RateLimiter.check(`ip:${ip}:super_admin_verify_totp`, 10, 3600);
        if (!limiterResult.success) {
            await supabaseAdmin.from('audit_logs').insert({
                action: 'rate_limit_triggered',
                ip_address: ip,
                details: { endpoint: 'super_admin_verify_totp', key: `ip:${ip}:super_admin_verify_totp` }
            });
            return NextResponse.json(
                { error: 'Too many TOTP verification attempts. Please try again in an hour.' },
                { status: 429 }
            );
        }

        if (!employeeId || !totpSecret || !otpCode) {
            return NextResponse.json({ error: 'Employee ID, TOTP secret, and code are required' }, { status: 400 });
        }

        // 1. Fetch employee and verify state
        const { data: employee, error: empError } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('id', employeeId)
            .eq('is_deleted', false)
            .maybeSingle();

        if (empError || !employee) {
            return NextResponse.json({ error: 'Super Admin not found' }, { status: 404 });
        }

        if (employee.status !== 'pending_mfa_setup' || employee.approval_status !== 'awaiting_mfa') {
            return NextResponse.json({ error: 'Invalid state for TOTP verification' }, { status: 400 });
        }

        // 2. Verify TOTP code matches the secret provided during email verification
        const isValid = verifyTotpCode(totpSecret, otpCode.trim());
        if (!isValid) {
            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: null,
                user_id: employee.id,
                actor_id: employee.id,
                action: 'super_admin_totp_verification_failed',
                ip_address: ip,
                device,
                browser,
                details: { reason: 'invalid_totp_code' }
            });
            return NextResponse.json({ error: 'Invalid TOTP code. Please check your authenticator app.' }, { status: 400 });
        }

        // 3. Verify the stored TOTP secret matches
        const { data: authRecord } = await supabaseAdmin
            .from('auth')
            .select('totp_secret')
            .eq('user_id', employee.id)
            .maybeSingle();

        if (!authRecord || authRecord.totp_secret !== totpSecret) {
            return NextResponse.json({ error: 'TOTP secret mismatch. Please restart MFA setup.' }, { status: 400 });
        }

        // 4. Generate 10 recovery codes and store their SHA-256 hashes
        const recoveryCodes: string[] = [];
        const hashedCodes: { user_id: string; code_hash: string }[] = [];

        for (let i = 0; i < 10; i++) {
            const code = Array.from({ length: 3 }, () => crypto.randomBytes(2).toString('hex').toUpperCase()).join('-');
            recoveryCodes.push(code);
            const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
            hashedCodes.push({
                user_id: employee.id,
                code_hash: hashedCode
            });
        }

        const { error: insertCodesError } = await supabaseAdmin
            .from('recovery_codes')
            .insert(hashedCodes);

        if (insertCodesError) {
            console.error('Failed to store recovery codes:', insertCodesError);
            return NextResponse.json({ error: 'Failed to generate recovery codes' }, { status: 500 });
        }

        // 5. Enable MFA and finalize Super Admin setup
        const nextSessionVersion = 1;

        const { error: authUpdateError } = await supabaseAdmin
            .from('auth')
            .update({
                totp_secret: totpSecret,
                mfa_enabled: true,
                failed_attempts: 0,
            })
            .eq('user_id', employee.id);

        if (authUpdateError) {
            console.error('Failed to enable MFA:', authUpdateError);
            return NextResponse.json({ error: 'Failed to enable MFA' }, { status: 500 });
        }

        const { error: empUpdateError } = await supabaseAdmin
            .from('employees')
            .update({
                status: 'active',
                approval_status: 'approved',
                super_admin_setup_completed: true,
                session_version: nextSessionVersion,
            })
            .eq('id', employee.id);

        if (empUpdateError) {
            console.error('Failed to activate Super Admin:', empUpdateError);
            return NextResponse.json({ error: 'Failed to activate Super Admin account' }, { status: 500 });
        }

        // 6. Mark bootstrap as completed
        await supabaseAdmin
            .from('super_admin_bootstrap')
            .update({
                completed: true,
                completed_at: new Date().toISOString(),
                completed_by: employee.id,
            })
            .eq('completed', false);

        // 7. Audit logs
        await supabaseAdmin.from('audit_logs').insert([
            {
                restaurant_id: null,
                user_id: employee.id,
                target_user_id: employee.id,
                actor_id: employee.id,
                action: 'super_admin_mfa_enabled',
                ip_address: ip,
                device,
                browser,
                details: { method: 'totp_registration' }
            },
            {
                restaurant_id: null,
                user_id: employee.id,
                target_user_id: employee.id,
                actor_id: employee.id,
                action: 'super_admin_setup_completed',
                ip_address: ip,
                device,
                browser,
                details: { recovery_codes_generated: 10 }
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
                details: { reason: 'super_admin_registration_complete', new_version: nextSessionVersion }
            },
            {
                restaurant_id: null,
                user_id: employee.id,
                target_user_id: employee.id,
                actor_id: employee.id,
                action: 'recovery_code_generated',
                ip_address: ip,
                device,
                browser,
                details: { count: 10, source: 'super_admin_registration' }
            }
        ]);

        // 8. Return success with recovery codes (only time they're shown in plaintext)
        return NextResponse.json({
            success: true,
            message: 'Super Admin registration complete. MFA enabled. Save your recovery codes securely.',
            recoveryCodes,
            // Do NOT return totpSecret again - it's now stored securely
        });

    } catch (err: any) {
        console.error('Super Admin TOTP verification error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}