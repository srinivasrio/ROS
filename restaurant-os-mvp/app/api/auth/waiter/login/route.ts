import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyPin } from '@/lib/auth-utils';
import { signJwt } from '@/lib/jwt-utils';
import {
    checkRateLimitAndLockout,
    recordFailedAttempt,
    resetFailedAttempts,
    recordAuthAuditLog,
    getAuthCookieOptions
} from '@/lib/panel-auth';
import { normalizeE164Phone } from '@/lib/entity-id';
import crypto from 'crypto';

/**
 * POST /api/auth/waiter/login
 * Mobile + PIN authentication for Waiters and Floor Staff.
 * Passwords are NOT required. OTP is NOT required for normal login.
 * PIN is verified against secure Argon2 hash.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const rawMobile = String(body?.mobile || body?.identifier || '').trim();
        const rawPin = String(body?.pin || '').trim();

        if (!rawMobile || !rawPin) {
            return NextResponse.json({ error: 'Please enter both your mobile number and employee PIN' }, { status: 400 });
        }

        const cleanMobile = rawMobile.replace(/[^0-9]/g, '');
        const search10 = cleanMobile.length >= 10 ? cleanMobile.slice(-10) : cleanMobile;

        if (!search10 || search10.length < 10) {
            return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number' }, { status: 400 });
        }

        const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
        const userAgent = req.headers.get('user-agent') || 'unknown';
        const uaLower = userAgent.toLowerCase();
        const device = (uaLower.includes('mobile') || uaLower.includes('android') || uaLower.includes('iphone')) ? 'mobile' : 'desktop';
        const browser = uaLower.includes('chrome') ? 'chrome' : uaLower.includes('safari') ? 'safari' : uaLower.includes('firefox') ? 'firefox' : 'unknown';

        // 1. Fetch employee by mobile number (normalized E.164 and legacy)
        const e164 = normalizeE164Phone(rawMobile);
        const orFilters = [
            `mobile.eq.${search10}`,
            `mobile.eq.+91${search10}`,
            `mobile.eq.91${search10}`,
            `mobile.ilike.%${search10}%`,
            `employee_id.eq.${rawMobile}`,
            `employee_code.eq.${rawMobile}`
        ];
        if (e164) {
            orFilters.unshift(`phone_normalized.eq.${e164}`);
        }

        const { data: employees, error: empErr } = await supabaseAdmin
            .from('employees')
            .select('*')
            .or(orFilters.join(','))
            .eq('is_deleted', false);

        if (empErr) {
            console.error('[waiter-login] DB query failed:', empErr);
            return NextResponse.json({ error: 'Failed to look up employee account' }, { status: 500 });
        }

        if (!employees || employees.length === 0) {
            return NextResponse.json({
                error: `No waiter account found with mobile number ${search10}. Please contact your restaurant manager.`
            }, { status: 404 });
        }

        // Filter for waiter or supervisor roles
        const employee = employees.find((e: any) => {
            const r = (e.role || '').toLowerCase();
            return ['waiter', 'supervisor', 'admin', 'restaurant_admin'].includes(r);
        }) || employees[0];

        // 2. ROLE AUTHORIZATION CHECK (Waiter panel only allows waiter / supervisor / admin)
        const employeeRole = (employee.role || '').toLowerCase().trim();
        const isAuthorizedWaiter = ['waiter', 'supervisor', 'admin', 'restaurant_admin'].includes(employeeRole);

        if (!isAuthorizedWaiter) {
            await recordAuthAuditLog({
                restaurantId: employee.restaurant_id,
                userId: employee.id,
                employeeId: employee.employee_id,
                action: 'unauthorized_panel_attempt',
                ip,
                device,
                browser,
                details: { attempted_panel: 'waiter', actual_role: employeeRole }
            });
            return NextResponse.json({
                error: `Access Denied: Your account role (${employee.role}) does not have waiter panel permissions.`
            }, { status: 403 });
        }

        // 3. RATE LIMIT & LOCKOUT CHECK
        const lockoutStatus = await checkRateLimitAndLockout(employee.id);
        if (lockoutStatus.locked) {
            const minutesLeft = Math.ceil((lockoutStatus.remainingCooldownSeconds || 60) / 60);
            return NextResponse.json({
                error: `Too many failed PIN attempts. Account locked. Please try again in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.`
            }, { status: 429 });
        }

        // 4. EMPLOYEE STATUS CHECKS
        if (employee.is_deleted) {
            return NextResponse.json({ error: 'This staff account has been deactivated.' }, { status: 403 });
        }

        if (employee.status === 'inactive' || employee.status === 'suspended') {
            return NextResponse.json({
                error: 'Account is disabled or suspended. Please contact your restaurant manager.'
            }, { status: 403 });
        }

        if (employee.approval_status === 'rejected') {
            return NextResponse.json({
                error: 'Account application was rejected. Please contact your restaurant manager.'
            }, { status: 403 });
        }

        // 5. PIN VERIFICATION AGAINST SECURE HASH
        // Check employees.pin first, then auth.password_hash as fallback
        let storedHash = employee.pin;
        if (!storedHash) {
            const { data: authRecord } = await supabaseAdmin
                .from('auth')
                .select('password_hash')
                .eq('user_id', employee.id)
                .maybeSingle();
            storedHash = authRecord?.password_hash;
        }

        const isPinValid = await verifyPin(rawPin, storedHash);

        if (!isPinValid) {
            const failResult = await recordFailedAttempt(employee.id, {
                restaurantId: employee.restaurant_id,
                employeeId: employee.employee_id,
                ip,
                device,
                browser,
                panel: 'waiter',
                method: 'pin'
            });

            if (failResult.locked) {
                return NextResponse.json({
                    error: 'Account locked due to 5 failed PIN attempts. Cooldown period: 15 minutes.'
                }, { status: 429 });
            }

            return NextResponse.json({
                error: `Incorrect employee PIN. (${5 - failResult.failedAttempts} attempt${5 - failResult.failedAttempts === 1 ? '' : 's'} remaining)`
            }, { status: 401 });
        }

        // Auto-activate pending employee upon valid PIN entry
        if (['pending_activation', 'pending', 'invited'].includes(employee.status)) {
            await supabaseAdmin
                .from('employees')
                .update({ status: 'active', approval_status: 'approved' })
                .eq('id', employee.id);
            employee.status = 'active';
            employee.approval_status = 'approved';
        }

        // 6. RESTAURANT STATUS CHECK
        if (employee.restaurant_id) {
            const { data: rest } = await supabaseAdmin
                .from('restaurants')
                .select('id, name, status, slug')
                .eq('id', employee.restaurant_id)
                .maybeSingle();

            if (rest && rest.status?.toLowerCase() === 'suspended') {
                return NextResponse.json({ error: 'Restaurant account is currently suspended.' }, { status: 403 });
            }
        }

        // 7. RESET FAILED ATTEMPTS on successful login
        await resetFailedAttempts(employee.id, { ip, device, browser });

        // 8. CREATE SESSION & SIGN JWT
        const sessionId = crypto.randomUUID();
        const currentSessionVersion = employee.session_version ?? 1;

        const token = await signJwt({
            sessionId,
            userId: employee.id,
            name: employee.name,
            role: 'waiter',
            sessionVersion: currentSessionVersion,
            email: employee.email || null,
            mobile: employee.mobile || search10,
            restaurantId: employee.restaurant_id || null,
            restaurant_id: employee.restaurant_id || null,
            employee_id: employee.employee_id || null,
            employeeId: employee.employee_id || null,
        });

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        await supabaseAdmin.from('dine_sessions').insert({
            id: sessionId,
            user_id: employee.id,
            token_hash: tokenHash,
            device_info: userAgent,
            ip_address: ip,
            is_active: true,
        });

        // Record shift & online status
        await Promise.all([
            supabaseAdmin.from('employees').update({
                is_online: true,
                availability_status: 'available'
            }).eq('id', employee.id),
            supabaseAdmin.from('waiter_shifts').insert({
                user_id: employee.id,
                shift_name: 'Shift'
            })
        ]).catch(() => {});

        // Audit log
        await recordAuthAuditLog({
            restaurantId: employee.restaurant_id,
            userId: employee.id,
            employeeId: employee.employee_id,
            action: 'login',
            ip,
            device,
            browser,
            details: { panel: 'waiter', method: 'pin', role: 'waiter' }
        });

        const rid = employee.restaurant_id;
        const formattedMobile = search10 || 'default';
        const redirectUrl = rid ? `/${rid}/waiter/${formattedMobile}/dashboard` : '/';

        const isHttps = req.nextUrl?.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
        const cookieOpts = getAuthCookieOptions(isHttps);

        const response = NextResponse.json({
            success: true,
            redirectUrl,
            token,
            user: {
                id: employee.id,
                internal_id: employee.internal_id,
                employee_code: employee.employee_code,
                legacy_reference: employee.legacy_reference || employee.employee_id,
                name: employee.name,
                role: 'waiter',
                email: employee.email || null,
                mobile: employee.phone_normalized || employee.mobile || search10,
                restaurant_id: employee.restaurant_id || null,
                employee_id: employee.employee_code || employee.employee_id || null,
                status: employee.status || 'active'
            },
            session: {
                userId: employee.id,
                internalId: employee.internal_id,
                name: employee.name,
                role: 'waiter',
                restaurantId: employee.restaurant_id || null,
                employeeId: employee.employee_code || employee.employee_id || null,
                mobile: employee.phone_normalized || employee.mobile || search10,
            }
        });

        // Set secure cookies
        response.cookies.set('dine_auth_token', token, cookieOpts);
        response.cookies.set('dine_auth_token_waiter', token, cookieOpts);
        if (rid) {
            const cleanRid = String(rid).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
            response.cookies.set(`dine_auth_token_${cleanRid}`, token, cookieOpts);
            response.cookies.set(`dine_auth_token_${cleanRid}_waiter`, token, cookieOpts);
            response.cookies.set(`dine_auth_token_${cleanRid}_${search10}`, token, cookieOpts);
            response.cookies.set(`dine_auth_token_staff_${search10}`, token, cookieOpts);
        }

        return response;

    } catch (err: any) {
        console.error('[WaiterLogin] Error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
