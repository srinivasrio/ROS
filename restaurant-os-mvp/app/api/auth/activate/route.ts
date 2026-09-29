import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hashPassword, validatePasswordComplexity } from '@/lib/auth-utils';
import { RateLimiter } from '@/lib/rate-limiter';
import { SecurityMonitor } from '@/lib/security-monitor';

// GET: Validate activation token
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get('token');
        const restaurantCode = searchParams.get('restaurantCode');

        const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

        // Rate Limiting (limit by IP: 10/min)
        const limiterResult = await RateLimiter.check(`ip:${ip}:activate_get`, 10, 60);
        if (!limiterResult.success) {
            await supabaseAdmin.from('audit_logs').insert({
                action: 'rate_limit_triggered',
                ip_address: ip,
                details: { endpoint: 'activate_get', key: `ip:${ip}:activate_get` }
            });
            return NextResponse.json(
                { error: 'Too many verification attempts. Please try again in 5 minutes.' },
                { status: 429 }
            );
        }

        if (!token || token.trim() === '') {
            return NextResponse.json({ error: 'Activation token is required' }, { status: 400 });
        }

        // Find employee with this activation token (must be in pending_activation status and not deleted)
        const { data: employee, error: empError } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('activation_token', token.trim())
            .eq('status', 'pending_activation')
            .eq('is_deleted', false)
            .maybeSingle();

        if (empError || !employee) {
            return NextResponse.json({ error: 'Invalid, expired, or already used activation link.' }, { status: 404 });
        }

        // Validate Restaurant Ownership if restaurantCode is provided (Cross-Tenant check)
        if (restaurantCode) {
            let resolvedRestaurantId = null;
            const { data: profile } = await supabaseAdmin
                .from('restaurant_profile')
                .select('restaurant_id')
                .eq('restaurant_id', restaurantCode)
                .maybeSingle();

            if (profile) {
                resolvedRestaurantId = profile.restaurant_id;
            } else {
                const { data: profileBySlug } = await supabaseAdmin
                    .from('restaurant_profile')
                    .select('restaurant_id')
                    .eq('slug', restaurantCode.toLowerCase())
                    .maybeSingle();
                if (profileBySlug) {
                    resolvedRestaurantId = profileBySlug.restaurant_id;
                }
            }

            if (!resolvedRestaurantId || resolvedRestaurantId !== employee.restaurant_id) {
                console.error('[Security Check Failed] Cross-tenant activation attempt detected!', {
                    employeeId: employee.id,
                    employeeTenant: employee.restaurant_id,
                    attemptedCode: restaurantCode,
                    resolvedId: resolvedRestaurantId
                });

                await supabaseAdmin.from('audit_logs').insert({
                    restaurant_id: employee.restaurant_id || null,
                    user_id: employee.id,
                    target_user_id: employee.id,
                    actor_id: employee.id,
                    employee_id: employee.employee_id || null,
                    action: 'cross_tenant_activation_attempt',
                    ip_address: ip,
                    device: 'unknown',
                    browser: 'unknown',
                    details: { attempted_code: restaurantCode }
                });

                await SecurityMonitor.triggerCrossTenantActivation(employee.restaurant_id, employee.id, {
                    attempted_code: restaurantCode,
                    ip
                });

                return NextResponse.json({ error: 'Cross-tenant activation attempt detected.' }, { status: 400 });
            }
        }

        // Validate Token Expiration (24 hours lifespan)
        const tokenLifeSpan = 24 * 60 * 60 * 1000;
        const createdTime = new Date(employee.created_at || '').getTime();
        const isExpired = Date.now() - createdTime > tokenLifeSpan;

        if (isExpired) {
            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: employee.restaurant_id || null,
                user_id: employee.id,
                target_user_id: employee.id,
                actor_id: employee.id,
                employee_id: employee.employee_id || null,
                action: 'activation_failed',
                ip_address: ip,
                device: 'unknown',
                browser: 'unknown',
                details: { reason: 'Token expired' }
            });
            return NextResponse.json({ error: 'Activation link has expired. Please ask your administrator to send a new invite.' }, { status: 400 });
        }

        return NextResponse.json({
            valid: true,
            email: employee.email,
            mobile: employee.mobile,
            name: employee.name,
            role: employee.role,
            employeeId: employee.employee_id
        });

    } catch (error: any) {
        console.error('Activation validation error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

// POST: Set password and activate account
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { token, password, restaurantCode } = body;

        const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

        // Rate Limiting (limit by IP: 10/min)
        const limiterResult = await RateLimiter.check(`ip:${ip}:activate_post`, 10, 60);
        if (!limiterResult.success) {
            await supabaseAdmin.from('audit_logs').insert({
                action: 'rate_limit_triggered',
                ip_address: ip,
                details: { endpoint: 'activate_post', key: `ip:${ip}:activate_post` }
            });
            return NextResponse.json(
                { error: 'Too many activation attempts. Please try again in 5 minutes.' },
                { status: 429 }
            );
        }

        if (!token || !password) {
            return NextResponse.json({ error: 'Activation token and password are required' }, { status: 400 });
        }

        // 1. Enforce Password Policy Complexity
        if (!validatePasswordComplexity(password)) {
            return NextResponse.json({ 
                error: 'Password is too weak. It must be at least 12 characters long and include at least one uppercase letter, one lowercase letter, one numeric digit, and one special character.' 
            }, { status: 400 });
        }

        // 2. Fetch employee with active activation token
        const { data: employee, error: empError } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('activation_token', token.trim())
            .eq('status', 'pending_activation')
            .eq('is_deleted', false)
            .maybeSingle();

        if (empError || !employee) {
            return NextResponse.json({ error: 'Invalid, expired, or already used activation token.' }, { status: 404 });
        }

        // Validate Restaurant Ownership if restaurantCode is provided (Cross-Tenant check)
        if (restaurantCode) {
            let resolvedRestaurantId = null;
            const { data: profile } = await supabaseAdmin
                .from('restaurant_profile')
                .select('restaurant_id')
                .eq('restaurant_id', restaurantCode)
                .maybeSingle();

            if (profile) {
                resolvedRestaurantId = profile.restaurant_id;
            } else {
                const { data: profileBySlug } = await supabaseAdmin
                    .from('restaurant_profile')
                    .select('restaurant_id')
                    .eq('slug', restaurantCode.toLowerCase())
                    .maybeSingle();
                if (profileBySlug) {
                    resolvedRestaurantId = profileBySlug.restaurant_id;
                }
            }

            if (!resolvedRestaurantId || resolvedRestaurantId !== employee.restaurant_id) {
                await supabaseAdmin.from('audit_logs').insert({
                    restaurant_id: employee.restaurant_id || null,
                    user_id: employee.id,
                    target_user_id: employee.id,
                    actor_id: employee.id,
                    employee_id: employee.employee_id || null,
                    action: 'cross_tenant_activation_attempt',
                    ip_address: ip,
                    device: 'unknown',
                    browser: 'unknown',
                    details: { attempted_code: restaurantCode }
                });

                await SecurityMonitor.triggerCrossTenantActivation(employee.restaurant_id, employee.id, {
                    attempted_code: restaurantCode,
                    ip
                });

                return NextResponse.json({ error: 'Cross-tenant activation attempt detected.' }, { status: 400 });
            }
        }

        // Validate Token Expiration (24 hours)
        const tokenLifeSpan = 24 * 60 * 60 * 1000;
        const createdTime = new Date(employee.created_at || '').getTime();
        const isExpired = Date.now() - createdTime > tokenLifeSpan;

        if (isExpired) {
            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: employee.restaurant_id || null,
                user_id: employee.id,
                target_user_id: employee.id,
                actor_id: employee.id,
                employee_id: employee.employee_id || null,
                action: 'activation_failed',
                ip_address: ip,
                device: 'unknown',
                browser: 'unknown',
                details: { reason: 'Token expired' }
            });
            return NextResponse.json({ error: 'Activation token has expired. Please request a new invitation.' }, { status: 400 });
        }

        // 3. Hash password using Argon2
        const passwordHash = await hashPassword(password);

        // 4. Update auth table credentials
        const { error: authError } = await supabaseAdmin
            .from('auth')
            .upsert({
                user_id: employee.id,
                password_hash: passwordHash,
                mfa_enabled: false,
                failed_attempts: 0,
                locked_until: null
            });

        if (authError) {
            console.error('Failed to update auth credentials:', authError);
            return NextResponse.json({ error: 'Failed to update security credentials' }, { status: 500 });
        }

        // 5. Save initial password hash to password_history
        await supabaseAdmin
            .from('password_history')
            .insert({
                user_id: employee.id,
                password_hash: passwordHash
            });

        // 6. Complete Activation: The employee becomes explicitly ACTIVE upon setting password!
        // Immediately nullify activation_token to guarantee SINGLE USE!
        const { error: updateErr } = await supabaseAdmin
            .from('employees')
            .update({
                status: 'active',
                approval_status: 'approved',
                activation_token: null, // CLEAR TOKEN: Single use enforced!
                verified_at: new Date().toISOString()
            })
            .eq('id', employee.id);

        if (updateErr) {
            console.error('Failed to update employee status:', updateErr);
            return NextResponse.json({ error: 'Failed to complete activation' }, { status: 500 });
        }

        // 7. Write audit logs
        await supabaseAdmin.from('audit_logs').insert([
            {
                restaurant_id: employee.restaurant_id || null,
                user_id: employee.id,
                target_user_id: employee.id,
                actor_id: employee.id,
                employee_id: employee.employee_id || null,
                action: 'activation_success',
                ip_address: ip,
                device: 'unknown',
                browser: 'unknown',
                details: { role: employee.role, result: 'account_activated' }
            },
            {
                restaurant_id: employee.restaurant_id || null,
                user_id: employee.id,
                target_user_id: employee.id,
                actor_id: employee.id,
                employee_id: employee.employee_id || null,
                action: 'password_changes',
                ip_address: ip,
                device: 'unknown',
                browser: 'unknown',
                details: { method: 'activation_onboarding' }
            }
        ]);

        // Return success without issuing a session (user must log in separately)
        return NextResponse.json({
            success: true,
            message: 'Account activated successfully! You can now log in with your credentials.'
        });

    } catch (error: any) {
        console.error('Activation completion error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
