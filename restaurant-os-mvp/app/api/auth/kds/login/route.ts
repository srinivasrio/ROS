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
 * POST /api/auth/kds/login
 * Mobile + PIN authentication for Kitchen / KDS employees.
 * Server validates that role is kitchen, chef, supervisor, or restaurant_admin.
 * No station ID required; employee account is sufficient.
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

        // 1. Fetch employee by mobile with E.164 normalization and legacy fallback
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
            console.error('[kds-login] DB error:', empErr);
            return NextResponse.json({ error: 'Failed to look up employee account' }, { status: 500 });
        }

        if (!employees || employees.length === 0) {
            return NextResponse.json({
                error: `No kitchen staff account found with mobile number ${search10}. Please contact your restaurant administrator.`
            }, { status: 404 });
        }

        // Prioritize kitchen/chef roles
        const employee = employees.find((e: any) => {
            const r = (e.role || '').toLowerCase();
            return ['kitchen', 'chef', 'supervisor', 'restaurant_admin', 'admin'].includes(r);
        }) || employees[0];

        // 2. SERVER-SIDE ROLE AUTHORIZATION FOR KDS
        const rawRole = (employee.role || '').toLowerCase().trim();
        const isAuthorizedKds = ['kitchen', 'chef', 'supervisor', 'restaurant_admin', 'admin'].includes(rawRole);

        if (!isAuthorizedKds) {
            await recordAuthAuditLog({
                restaurantId: employee.restaurant_id,
                userId: employee.id,
                employeeId: employee.employee_id,
                action: 'unauthorized_panel_attempt',
                ip,
                device,
                browser,
                details: { attempted_panel: 'kds', actual_role: rawRole }
            });
            return NextResponse.json({
                error: `Access Denied: Role "${employee.role}" is not authorized to access Kitchen Display System (KDS).`
            }, { status: 403 });
        }

        // 3. RATE LIMIT & LOCKOUT CHECK
        const lockoutStatus = await checkRateLimitAndLockout(employee.id);
        if (lockoutStatus.locked) {
            const minutesLeft = Math.ceil((lockoutStatus.remainingCooldownSeconds || 60) / 60);
            return NextResponse.json({
                error: `Account is locked due to too many failed PIN attempts. Please try again in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.`
            }, { status: 429 });
        }

        // 4. VERIFY PIN
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
                panel: 'kds',
                method: 'pin'
            });

            if (failResult.locked) {
                return NextResponse.json({
                    error: 'Account locked due to 5 consecutive failed PIN attempts. Cooldown period: 15 minutes.'
                }, { status: 429 });
            }

            return NextResponse.json({
                error: `Incorrect employee PIN. (${5 - failResult.failedAttempts} attempt${5 - failResult.failedAttempts === 1 ? '' : 's'} remaining)`
            }, { status: 401 });
        }

        // 5. STATUS CHECK
        if (employee.is_deleted) {
            return NextResponse.json({ error: 'This staff account has been deactivated.' }, { status: 403 });
        }

        if (employee.status === 'inactive' || employee.status === 'suspended') {
            return NextResponse.json({
                error: 'Account is disabled or suspended. Please contact your restaurant manager.'
            }, { status: 403 });
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

        // 6. RESTAURANT CHECK
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

        // 7. RESET FAILED ATTEMPTS
        await resetFailedAttempts(employee.id, { ip, device, browser });

        // 8. CREATE SESSION & SIGN JWT
        const sessionId = crypto.randomUUID();
        const currentSessionVersion = employee.session_version ?? 1;

        let mappedRole = rawRole;
        if (mappedRole === 'chef') mappedRole = 'kitchen';

        const token = await signJwt({
            sessionId,
            userId: employee.id,
            name: employee.name,
            role: mappedRole,
            sessionVersion: currentSessionVersion,
            email: employee.email || null,
            mobile: employee.mobile || search10,
            restaurantId: employee.restaurant_id || null,
            restaurant_id: employee.restaurant_id || null,
            employee_id: employee.employee_id || null,
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

        await recordAuthAuditLog({
            restaurantId: employee.restaurant_id,
            userId: employee.id,
            employeeId: employee.employee_id,
            action: 'login',
            ip,
            device,
            browser,
            details: { panel: 'kds', method: 'pin', role: mappedRole }
        });

        const rid = employee.restaurant_id;
        const redirectUrl = rid ? `/${rid}/kds` : '/';

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
                role: mappedRole,
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
                role: mappedRole,
                restaurantId: employee.restaurant_id || null,
                employeeId: employee.employee_code || employee.employee_id || null,
                mobile: employee.phone_normalized || employee.mobile || search10,
            }
        });

        // Set secure cookies
        response.cookies.set('dine_auth_token', token, cookieOpts);
        response.cookies.set('dine_auth_token_kds', token, cookieOpts);
        if (rid) {
            const cleanRid = String(rid).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
            response.cookies.set(`dine_auth_token_${cleanRid}`, token, cookieOpts);
            response.cookies.set(`dine_auth_token_${cleanRid}_kds`, token, cookieOpts);
            response.cookies.set(`dine_auth_token_${cleanRid}_${search10}`, token, cookieOpts);
        }

        return response;

    } catch (err: any) {
        console.error('[KDSLogin] Error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
