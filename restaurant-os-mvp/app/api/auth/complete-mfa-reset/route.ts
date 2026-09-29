import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateBase32Secret, generateTotpUri, verifyTotpCode } from '@/lib/auth-utils';
import { RateLimiter } from '@/lib/rate-limiter';
import { EmailService } from '@/lib/email-service';
import crypto from 'crypto';

// GET: Generate new TOTP secret for employee in mfa_reset_required state
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

        // Rate Limiting (limit by IP: 10/min)
        const limiterResult = await RateLimiter.check(`ip:${ip}:complete_mfa_reset_get`, 10, 60);
        if (!limiterResult.success) {
            await supabaseAdmin.from('audit_logs').insert({
                action: 'rate_limit_triggered',
                ip_address: ip,
                details: { endpoint: 'complete_mfa_reset_get', key: `ip:${ip}:complete_mfa_reset_get` }
            });
            return NextResponse.json(
                { error: 'Too many requests. Please try again in 5 minutes.' },
                { status: 429 }
            );
        }

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        // 1. Fetch Employee
        const { data: employee, error: empError } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('id', userId)
            .eq('is_deleted', false)
            .maybeSingle();

        if (empError || !employee) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }

        // Verify state is mfa_reset_required
        if (employee.status !== 'mfa_reset_required') {
            return NextResponse.json({ error: 'MFA reset is not requested for this user' }, { status: 400 });
        }

        // 2. Fetch Auth details to verify MFA is disabled
        const { data: authUser, error: authError } = await supabaseAdmin
            .from('auth')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (authError || !authUser || authUser.mfa_enabled) {
            return NextResponse.json({ error: 'MFA setup is already active or credentials missing' }, { status: 400 });
        }

        // 3. Generate TOTP secret and URI
        const totpSecret = generateBase32Secret();
        const totpUri = generateTotpUri(employee.email || employee.employee_id || 'user', 'Dine In One', totpSecret);

        return NextResponse.json({
            success: true,
            email: employee.email,
            name: employee.name,
            totpSecret,
            totpUri
        });

    } catch (error: any) {
        console.error('MFA Reset Gen Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 550 });
    }
}

// POST: Verify first TOTP code and activate MFA configuration
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId, totpSecret, otpCode } = body;

        const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
        const userAgent = request.headers.get('user-agent') || 'unknown';

        // Rate Limiting (limit by IP: 10/min)
        const limiterResult = await RateLimiter.check(`ip:${ip}:complete_mfa_reset_post`, 10, 60);
        if (!limiterResult.success) {
            await supabaseAdmin.from('audit_logs').insert({
                action: 'rate_limit_triggered',
                ip_address: ip,
                details: { endpoint: 'complete_mfa_reset_post', key: `ip:${ip}:complete_mfa_reset_post` }
            });
            return NextResponse.json(
                { error: 'Too many attempts. Please try again in 5 minutes.' },
                { status: 429 }
            );
        }

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

        if (!userId || !totpSecret || !otpCode) {
            return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
        }

        // 1. Fetch Employee
        const { data: employee, error: empError } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('id', userId)
            .eq('is_deleted', false)
            .maybeSingle();

        if (empError || !employee) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }

        if (employee.status !== 'mfa_reset_required') {
            return NextResponse.json({ error: 'MFA reset is not requested for this user' }, { status: 400 });
        }

        // 2. Verify TOTP Code
        const isValid = verifyTotpCode(totpSecret, otpCode.trim());
        if (!isValid) {
            return NextResponse.json({ error: 'Invalid verification code. Please check your authenticator app.' }, { status: 400 });
        }

        // 3. Save TOTP credentials to auth table
        const { error: authError } = await supabaseAdmin
            .from('auth')
            .update({
                totp_secret: totpSecret,
                mfa_enabled: true,
                failed_attempts: 0
            })
            .eq('user_id', userId);

        if (authError) {
            console.error('Failed to update TOTP credentials:', authError);
            return NextResponse.json({ error: 'Failed to update security credentials' }, { status: 550 });
        }

        // 4. Invalidate old recovery codes for the user
        const { error: deleteCodesError } = await supabaseAdmin
            .from('recovery_codes')
            .delete()
            .eq('user_id', userId);

        if (deleteCodesError) {
            console.error('Failed to clear old recovery codes:', deleteCodesError);
        }

        // 5. Generate 10 new recovery codes and store their SHA-256 hashes
        const recoveryCodes: string[] = [];
        const hashedCodes: { user_id: string; code_hash: string }[] = [];

        for (let i = 0; i < 10; i++) {
            const code = Array.from({ length: 3 }, () => crypto.randomBytes(2).toString('hex').toUpperCase()).join('-');
            recoveryCodes.push(code);
            const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
            hashedCodes.push({
                user_id: userId,
                code_hash: hashedCode
            });
        }

        const { error: insertCodesError } = await supabaseAdmin
            .from('recovery_codes')
            .insert(hashedCodes);

        if (insertCodesError) {
            console.error('Failed to store new recovery codes:', insertCodesError);
        }

        // 6. Update employee status to active
        const nextSessionVersion = (employee.session_version || 1) + 1;
        const { error: updateErr } = await supabaseAdmin
            .from('employees')
            .update({
                status: 'active',
                session_version: nextSessionVersion
            })
            .eq('id', userId);

        if (updateErr) {
            console.error('Failed to activate employee profile:', updateErr);
            return NextResponse.json({ error: 'Failed to update employee status' }, { status: 550 });
        }

        // 7. Write audit logs
        await supabaseAdmin.from('audit_logs').insert([
            {
                restaurant_id: employee.restaurant_id || null,
                user_id: employee.id,
                target_user_id: employee.id,
                actor_id: employee.id,
                employee_id: employee.employee_id || null,
                action: 'mfa_reset_completed',
                ip_address: ip,
                device,
                browser,
                details: { method: 'totp_mfa_reset' }
            },
            {
                restaurant_id: employee.restaurant_id || null,
                user_id: employee.id,
                target_user_id: employee.id,
                actor_id: employee.id,
                employee_id: employee.employee_id || null,
                action: 'session_version_incremented',
                ip_address: ip,
                device,
                browser,
                details: { reason: 'mfa_reset_completed', new_version: nextSessionVersion }
            },
            {
                restaurant_id: employee.restaurant_id || null,
                user_id: employee.id,
                target_user_id: employee.id,
                actor_id: employee.id,
                employee_id: employee.employee_id || null,
                action: 'recovery_code_generated',
                ip_address: ip,
                device,
                browser,
                details: { count: 10, source: 'mfa_reset' }
            }
        ]);

        // 8. Send security notification
        if (employee.email) {
            await EmailService.notifyMfaReset(employee.email, {
                ip,
                device,
                browser,
                timestamp: new Date().toLocaleString()
            }, true);
        }

        return NextResponse.json({ success: true, recoveryCodes });

    } catch (error: any) {
        console.error('Complete MFA Reset Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 550 });
    }
}
