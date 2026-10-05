import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateBase32Secret, generateTotpUri, verifyTotpCode } from '@/lib/auth-utils';
import { RateLimiter } from '@/lib/rate-limiter';
import { EmailService } from '@/lib/email-service';
import { verifyJwt, extractTokenForRestaurant } from '@/lib/jwt-utils';
import { resolveRestaurantId } from '@/services/utils.service';
import crypto from 'crypto';

interface AuthenticatedActor {
    userId: string;
    role: string;
    restaurantId?: string | null;
    email?: string;
}

interface AuthCheckResult {
    authorized: boolean;
    status: number;
    error?: string;
    isSuperAdmin?: boolean;
    actor?: AuthenticatedActor;
}

/**
 * Reusable authentication & role verification for complete-mfa-reset.
 * Reuses existing verifyJwt, extractTokenForRestaurant, and session verification.
 */
async function authenticateCaller(request: Request): Promise<AuthCheckResult> {
    // 1. Extract Bearer token from Authorization header
    let token: string | null = null;
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim();
    }

    // 2. Fall back to Next.js cookies
    if (!token) {
        try {
            const cookieStore = await cookies();
            token = cookieStore.get('dine_auth_token')?.value || null;
            if (!token) {
                token = extractTokenForRestaurant(cookieStore, null, null, 'admin') ||
                        extractTokenForRestaurant(cookieStore) || null;
            }
            if (!token && cookieStore.getAll) {
                const all = cookieStore.getAll();
                const found = all.find(c => c.name.startsWith('dine_auth_token') && c.value);
                if (found) token = found.value;
            }
        } catch {
            // Fallback for environments where cookies() might not be available
        }
    }

    // 3. Fall back to parsing raw Cookie header
    if (!token) {
        const cookieHeader = request.headers.get('cookie') || '';
        const match = cookieHeader.match(/dine_auth_token(?:_[^=]+)?=([^;]+)/);
        if (match) {
            token = decodeURIComponent(match[1]);
        }
    }

    // Reject unauthenticated requests with 401
    if (!token) {
        return {
            authorized: false,
            status: 401,
            error: 'Authentication required. Please log in.'
        };
    }

    // 4. Verify JWT token
    const payload = await verifyJwt(token);
    if (!payload || !payload.userId) {
        return {
            authorized: false,
            status: 401,
            error: 'Invalid or expired session. Please log in again.'
        };
    }

    // 5. Verify active session in dine_sessions if session tracking is bound to the token
    if (payload.sessionId) {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const { data: dbSession, error: sessionErr } = await supabaseAdmin
            .from('dine_sessions')
            .select('id, is_active')
            .eq('id', payload.sessionId)
            .eq('token_hash', tokenHash)
            .eq('is_active', true)
            .maybeSingle();

        if (sessionErr || !dbSession) {
            return {
                authorized: false,
                status: 401,
                error: 'Session has been invalidated or expired. Please log in again.'
            };
        }
    }

    // 6. Role check: only super_admin and restaurant_admin (or owner/admin) are permitted
    const rawRole = String(payload.role || '').toLowerCase().trim();
    const isSuperAdmin = rawRole === 'super_admin' || rawRole === 'superadmin';
    let isRestaurantAdmin = isSuperAdmin || ['restaurant_admin', 'admin', 'owner', 'restaurant_owner'].includes(rawRole);
    let callerRestaurantId = payload.restaurantId || payload.restaurant_id || null;

    // Check DB profile if role in token is not explicitly an admin string
    if (!isSuperAdmin && !isRestaurantAdmin) {
        const { data: dbEmp } = await supabaseAdmin
            .from('employees')
            .select('role, restaurant_id, is_deleted, status')
            .eq('id', payload.userId)
            .maybeSingle();

        if (dbEmp && !dbEmp.is_deleted && dbEmp.status !== 'suspended' && dbEmp.status !== 'inactive') {
            const empRole = String(dbEmp.role || '').toLowerCase().trim();
            if (['restaurant_admin', 'admin', 'owner', 'restaurant_owner'].includes(empRole)) {
                isRestaurantAdmin = true;
                if (!callerRestaurantId) callerRestaurantId = dbEmp.restaurant_id;
            }
        } else {
            const { data: dbUser } = await supabaseAdmin
                .from('users')
                .select('role, restaurant_id')
                .eq('id', payload.userId)
                .maybeSingle();

            if (dbUser) {
                const uRole = String(dbUser.role || '').toLowerCase().trim();
                if (['restaurant_admin', 'admin', 'owner', 'restaurant_owner'].includes(uRole)) {
                    isRestaurantAdmin = true;
                    if (!callerRestaurantId) callerRestaurantId = dbUser.restaurant_id;
                }
            }
        }
    }

    // Block non-admin staff (waiter, kds, delivery, normal employees) with 403
    if (!isSuperAdmin && !isRestaurantAdmin) {
        return {
            authorized: false,
            status: 403,
            error: `Forbidden: Role '${payload.role || 'staff'}' is not authorized to perform MFA reset operations.`
        };
    }

    // Additional check for active account state
    if (!isSuperAdmin) {
        const { data: activeEmp } = await supabaseAdmin
            .from('employees')
            .select('is_deleted, status')
            .eq('id', payload.userId)
            .maybeSingle();

        if (activeEmp && (activeEmp.is_deleted || activeEmp.status === 'suspended' || activeEmp.status === 'inactive')) {
            return {
                authorized: false,
                status: 403,
                error: 'Forbidden: Account is inactive or suspended.'
            };
        }
    }

    return {
        authorized: true,
        status: 200,
        isSuperAdmin,
        actor: {
            userId: payload.userId,
            role: payload.role,
            restaurantId: callerRestaurantId,
            email: payload.email
        }
    };
}

/**
 * Verifies tenant ownership for a restaurant admin against target employee.
 */
async function verifyTenantOwnership(
    caller: AuthenticatedActor,
    targetEmployee: { id: string; restaurant_id: string | null }
): Promise<boolean> {
    const callerRestId = caller.restaurantId;
    const targetRestId = targetEmployee.restaurant_id;

    if (!targetRestId) return false;

    // 1. Direct match on restaurant ID
    if (callerRestId && String(callerRestId).toLowerCase() === String(targetRestId).toLowerCase()) {
        return true;
    }

    // 2. Resolve identifiers in case of slug or custom code
    if (callerRestId) {
        const resolvedCaller = await resolveRestaurantId(String(callerRestId));
        const resolvedTarget = await resolveRestaurantId(String(targetRestId));
        if (resolvedCaller && resolvedTarget && resolvedCaller.toLowerCase() === resolvedTarget.toLowerCase()) {
            return true;
        }
    }

    // 3. Check ownership in restaurants table (if caller is owner)
    const { data: ownedRest } = await supabaseAdmin
        .from('restaurants')
        .select('id')
        .eq('id', targetRestId)
        .eq('owner_id', caller.userId)
        .is('deleted_at', null)
        .maybeSingle();

    if (ownedRest) return true;

    // 4. Check active membership in restaurant_users table
    const { data: ruRest } = await supabaseAdmin
        .from('restaurant_users')
        .select('restaurant_id')
        .eq('restaurant_id', targetRestId)
        .eq('user_id', caller.userId)
        .eq('status', 'active')
        .maybeSingle();

    if (ruRest) return true;

    return false;
}

// GET: Generate new TOTP secret for employee in mfa_reset_required state
export async function GET(request: Request) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const uaLower = userAgent.toLowerCase();
    const device = (uaLower.includes('mobile') || uaLower.includes('android') || uaLower.includes('iphone')) ? 'mobile' : 'desktop';
    const browser = uaLower.includes('chrome') ? 'chrome' : uaLower.includes('safari') ? 'safari' : uaLower.includes('firefox') ? 'firefox' : 'unknown';

    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        // Rate Limiting (limit by IP: 10/min)
        const limiterResult = await RateLimiter.check(`ip:${ip}:complete_mfa_reset_get`, 10, 60);
        if (!limiterResult.success) {
            await supabaseAdmin.from('audit_logs').insert({
                action: 'rate_limit_triggered',
                ip_address: ip,
                device,
                browser,
                details: { endpoint: 'complete_mfa_reset_get', key: `ip:${ip}:complete_mfa_reset_get` }
            });
            return NextResponse.json(
                { error: 'Too many requests. Please try again in 5 minutes.' },
                { status: 429 }
            );
        }

        // 1. Authenticate caller (401 for unauthenticated/invalid)
        const auth = await authenticateCaller(request);
        if (!auth.authorized || !auth.actor) {
            await supabaseAdmin.from('audit_logs').insert({
                action: 'mfa_reset_auth_failed',
                ip_address: ip,
                device,
                browser,
                details: { endpoint: 'complete_mfa_reset_get', reason: auth.error }
            });
            return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: auth.status });
        }

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        // 2. Fetch target Employee
        const { data: employee, error: empError } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('id', userId)
            .eq('is_deleted', false)
            .maybeSingle();

        if (empError || !employee) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }

        // 3. Role & Tenant Isolation verification
        const targetRole = String(employee.role || '').toLowerCase().trim();
        const isTargetSuperAdmin = targetRole === 'super_admin' || targetRole === 'superadmin';

        if (isTargetSuperAdmin && !auth.isSuperAdmin) {
            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: employee.restaurant_id || null,
                user_id: employee.id,
                target_user_id: employee.id,
                actor_id: auth.actor.userId,
                action: 'mfa_reset_forbidden',
                ip_address: ip,
                device,
                browser,
                details: { reason: 'non_super_admin_targeting_super_admin', target_user_id: userId }
            });
            return NextResponse.json(
                { error: 'Forbidden: Only Super Admins can manage Super Admin accounts.' },
                { status: 403 }
            );
        }

        if (!auth.isSuperAdmin) {
            const hasOwnership = await verifyTenantOwnership(auth.actor, employee);
            if (!hasOwnership) {
                await supabaseAdmin.from('audit_logs').insert({
                    restaurant_id: employee.restaurant_id || null,
                    user_id: employee.id,
                    target_user_id: employee.id,
                    actor_id: auth.actor.userId,
                    action: 'mfa_reset_forbidden_cross_tenant',
                    ip_address: ip,
                    device,
                    browser,
                    details: {
                        reason: 'cross_tenant_mfa_reset_attempt',
                        target_user_id: userId,
                        target_restaurant_id: employee.restaurant_id,
                        caller_restaurant_id: auth.actor.restaurantId
                    }
                });
                return NextResponse.json(
                    { error: 'Forbidden: You do not have permission to reset MFA for employees of another restaurant.' },
                    { status: 403 }
                );
            }
        }

        // 4. Verify target state is mfa_reset_required
        if (employee.status !== 'mfa_reset_required') {
            return NextResponse.json({ error: 'MFA reset is not requested for this user' }, { status: 400 });
        }

        // 5. Fetch Auth details to verify MFA is disabled
        const { data: authUser, error: authError } = await supabaseAdmin
            .from('auth')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (authError || !authUser || authUser.mfa_enabled) {
            return NextResponse.json({ error: 'MFA setup is already active or credentials missing' }, { status: 400 });
        }

        // 6. Generate TOTP secret and URI
        const totpSecret = generateBase32Secret();
        const totpUri = generateTotpUri(employee.email || employee.employee_id || 'user', 'Dine In One', totpSecret);

        // Audit log for initiated MFA setup (without logging secret or URI)
        await supabaseAdmin.from('audit_logs').insert({
            restaurant_id: employee.restaurant_id || null,
            user_id: employee.id,
            target_user_id: employee.id,
            actor_id: auth.actor.userId,
            action: 'mfa_reset_initiated',
            ip_address: ip,
            device,
            browser,
            details: { endpoint: 'complete_mfa_reset_get' }
        });

        return NextResponse.json({
            success: true,
            email: employee.email,
            name: employee.name,
            totpSecret,
            totpUri
        });

    } catch (error: any) {
        console.error('MFA Reset Gen Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

// POST: Verify first TOTP code and activate MFA configuration
export async function POST(request: Request) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const uaLower = userAgent.toLowerCase();
    const device = (uaLower.includes('mobile') || uaLower.includes('android') || uaLower.includes('iphone')) ? 'mobile' : 'desktop';
    const browser = uaLower.includes('chrome') ? 'chrome' : uaLower.includes('safari') ? 'safari' : uaLower.includes('firefox') ? 'firefox' : 'unknown';

    try {
        const body = await request.json();
        const { userId, totpSecret, otpCode } = body;

        // Rate Limiting (limit by IP: 10/min)
        const limiterResult = await RateLimiter.check(`ip:${ip}:complete_mfa_reset_post`, 10, 60);
        if (!limiterResult.success) {
            await supabaseAdmin.from('audit_logs').insert({
                action: 'rate_limit_triggered',
                ip_address: ip,
                device,
                browser,
                details: { endpoint: 'complete_mfa_reset_post', key: `ip:${ip}:complete_mfa_reset_post` }
            });
            return NextResponse.json(
                { error: 'Too many attempts. Please try again in 5 minutes.' },
                { status: 429 }
            );
        }

        // 1. Authenticate caller (401 for unauthenticated/invalid)
        const auth = await authenticateCaller(request);
        if (!auth.authorized || !auth.actor) {
            await supabaseAdmin.from('audit_logs').insert({
                action: 'mfa_reset_auth_failed',
                ip_address: ip,
                device,
                browser,
                details: { endpoint: 'complete_mfa_reset_post', reason: auth.error }
            });
            return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: auth.status });
        }

        if (!userId || !totpSecret || !otpCode) {
            return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
        }

        // 2. Fetch target Employee
        const { data: employee, error: empError } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('id', userId)
            .eq('is_deleted', false)
            .maybeSingle();

        if (empError || !employee) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }

        // 3. Role & Tenant Isolation verification
        const targetRole = String(employee.role || '').toLowerCase().trim();
        const isTargetSuperAdmin = targetRole === 'super_admin' || targetRole === 'superadmin';

        if (isTargetSuperAdmin && !auth.isSuperAdmin) {
            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: employee.restaurant_id || null,
                user_id: employee.id,
                target_user_id: employee.id,
                actor_id: auth.actor.userId,
                action: 'mfa_reset_forbidden',
                ip_address: ip,
                device,
                browser,
                details: { reason: 'non_super_admin_targeting_super_admin', target_user_id: userId }
            });
            return NextResponse.json(
                { error: 'Forbidden: Only Super Admins can manage Super Admin accounts.' },
                { status: 403 }
            );
        }

        if (!auth.isSuperAdmin) {
            const hasOwnership = await verifyTenantOwnership(auth.actor, employee);
            if (!hasOwnership) {
                await supabaseAdmin.from('audit_logs').insert({
                    restaurant_id: employee.restaurant_id || null,
                    user_id: employee.id,
                    target_user_id: employee.id,
                    actor_id: auth.actor.userId,
                    action: 'mfa_reset_forbidden_cross_tenant',
                    ip_address: ip,
                    device,
                    browser,
                    details: {
                        reason: 'cross_tenant_mfa_reset_attempt',
                        target_user_id: userId,
                        target_restaurant_id: employee.restaurant_id,
                        caller_restaurant_id: auth.actor.restaurantId
                    }
                });
                return NextResponse.json(
                    { error: 'Forbidden: You do not have permission to reset MFA for employees of another restaurant.' },
                    { status: 403 }
                );
            }
        }

        if (employee.status !== 'mfa_reset_required') {
            return NextResponse.json({ error: 'MFA reset is not requested for this user' }, { status: 400 });
        }

        // 4. Verify TOTP Code
        const isValid = verifyTotpCode(totpSecret, otpCode.trim());
        if (!isValid) {
            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: employee.restaurant_id || null,
                user_id: employee.id,
                target_user_id: employee.id,
                actor_id: auth.actor.userId,
                action: 'mfa_reset_failed',
                ip_address: ip,
                device,
                browser,
                details: { reason: 'invalid_otp_code', target_user_id: userId }
            });
            return NextResponse.json({ error: 'Invalid verification code. Please check your authenticator app.' }, { status: 400 });
        }

        // 5. Save TOTP credentials to auth table
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
            return NextResponse.json({ error: 'Failed to update security credentials' }, { status: 500 });
        }

        // 6. Invalidate old recovery codes for the user
        const { error: deleteCodesError } = await supabaseAdmin
            .from('recovery_codes')
            .delete()
            .eq('user_id', userId);

        if (deleteCodesError) {
            console.error('Failed to clear old recovery codes:', deleteCodesError);
        }

        // 7. Generate 10 new recovery codes and store their SHA-256 hashes
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

        // 8. Update employee status to active & bump session version
        const nextSessionVersion = (employee.session_version || 1) + 1;
        const { error: updateErr } = await supabaseAdmin
            .from('employees')
            .update({
                status: 'active',
                session_version: nextSessionVersion,
                mfa_reset_at: new Date().toISOString(),
                mfa_reset_by: auth.actor.userId
            })
            .eq('id', userId);

        if (updateErr) {
            console.error('Failed to activate employee profile:', updateErr);
            return NextResponse.json({ error: 'Failed to update employee status' }, { status: 500 });
        }

        // 9. Write audit logs (strictly without logging passwords, OTPs, TOTP secrets, recovery codes, or tokens)
        await supabaseAdmin.from('audit_logs').insert([
            {
                restaurant_id: employee.restaurant_id || null,
                user_id: employee.id,
                target_user_id: employee.id,
                actor_id: auth.actor.userId,
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
                actor_id: auth.actor.userId,
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
                actor_id: auth.actor.userId,
                employee_id: employee.employee_id || null,
                action: 'recovery_code_generated',
                ip_address: ip,
                device,
                browser,
                details: { count: 10, source: 'mfa_reset' }
            }
        ]);

        // 10. Send security notification
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
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

