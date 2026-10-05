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
 * POST /api/auth/employee/login
 * Mobile + PIN authentication for general staff / employees.
 * Server validates employee status and redirects to their role's designated operational surface.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const rawMobile = String(body?.mobile || body?.identifier || body?.phone || '').trim();
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

        // 1. Fetch employee with E.164 normalization and legacy fallback
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
            console.error('[EmployeeLogin] DB lookup error:', empErr);
            return NextResponse.json({ error: 'Failed to look up employee account' }, { status: 500 });
        }

        if (!employees || employees.length === 0) {
            return NextResponse.json({
                error: `No employee account found with mobile number ${search10}. Please contact your restaurant administrator.`
            }, { status: 404 });
        }

        const employee = employees.find((e: any) => e.status === 'active') || employees[0];

        // 2. RATE LIMIT & LOCKOUT CHECK
        const lockoutStatus = await checkRateLimitAndLockout(employee.id);
        if (lockoutStatus.locked) {
            const minutesLeft = Math.ceil((lockoutStatus.remainingCooldownSeconds || 60) / 60);
            return NextResponse.json({
                error: `Account is locked due to too many failed PIN attempts. Please try again in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.`
            }, { status: 429 });
        }

        // 3. PIN VERIFICATION
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
                panel: 'employee',
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

        // 4. STATUS CHECKS
        if (employee.is_deleted) {
            return NextResponse.json({ error: 'This employee account has been deactivated.' }, { status: 403 });
        }

        if (employee.status === 'inactive' || employee.status === 'suspended') {
            return NextResponse.json({
                error: 'Account is disabled or suspended. Please contact your restaurant manager.'
            }, { status: 403 });
        }

        const rawRoleCheck = (employee.role || '').toLowerCase().trim();
        const isAdminCheck = ['admin', 'restaurant_admin'].includes(rawRoleCheck);

        // Block pending accounts awaiting Super Admin approval
        if (employee.status === 'pending' || employee.approval_status === 'pending') {
            return NextResponse.json({
                error: isAdminCheck
                    ? 'Your Restaurant Admin account is pending Super Admin approval. Access will be unlocked once approved.'
                    : 'Your employee account is pending approval. Please contact your restaurant manager.'
            }, { status: 403 });
        }

        // 5. RESTAURANT & BRANCH STATUS CHECKS
        if (employee.restaurant_id) {
            const { data: rest } = await supabaseAdmin
                .from('restaurants')
                .select('id, name, status, deleted_at')
                .eq('id', employee.restaurant_id)
                .maybeSingle();

            if (!rest || rest.deleted_at) {
                return NextResponse.json({ 
                    error: 'The restaurant associated with this account does not exist or has been deleted.' 
                }, { status: 403 });
            }

            const restStatusLower = (rest.status || '').toLowerCase();
            if (restStatusLower !== 'active') {
                if (['pending', 'pending_approval', 'pending_payment', 'payment_received', 'draft'].includes(restStatusLower)) {
                    return NextResponse.json({
                        error: 'Restaurant registration is pending Super Admin approval and payment verification. Access will be unlocked once approved.'
                    }, { status: 403 });
                }
                if (restStatusLower === 'suspended') {
                    return NextResponse.json({ error: 'Restaurant account is currently suspended.' }, { status: 403 });
                }
                return NextResponse.json({ error: `Restaurant is currently ${restStatusLower}. Access is blocked.` }, { status: 403 });
            }

            if (employee.branch_id) {
                const { data: brn } = await supabaseAdmin
                    .from('branches')
                    .select('id, status, deleted_at')
                    .eq('id', employee.branch_id)
                    .maybeSingle();

                if (!brn || brn.deleted_at || (brn.status || '').toLowerCase() !== 'active') {
                    return NextResponse.json({
                        error: 'The assigned branch is not active or has been deactivated/deleted.'
                    }, { status: 403 });
                }
            }
        } else if (isAdminCheck) {
            return NextResponse.json({ error: 'Access Denied: Account is not associated with any restaurant.' }, { status: 403 });
        }

        // Only allow first-time activation for invited non-admin staff of an active restaurant
        if (['pending_activation', 'invited'].includes(employee.status) && !isAdminCheck) {
            await supabaseAdmin
                .from('employees')
                .update({ status: 'active', approval_status: 'approved' })
                .eq('id', employee.id);
            employee.status = 'active';
            employee.approval_status = 'approved';
        }

        // 6. RESET FAILED ATTEMPTS
        await resetFailedAttempts(employee.id, { ip, device, browser });

        // 7. CREATE SESSION & JWT
        const sessionId = crypto.randomUUID();
        const currentSessionVersion = employee.session_version ?? 1;
        const rawRole = (employee.role || '').toLowerCase().trim();

        let mappedRole = rawRole;
        if (mappedRole === 'chef') mappedRole = 'kitchen';
        if (mappedRole === 'admin') mappedRole = 'restaurant_admin';

        let deliveryBoyRecord: any = null;
        if (mappedRole === 'delivery_boy' && employee.restaurant_id) {
            const { data: db } = await supabaseAdmin
                .from('delivery_boys')
                .select('id, status')
                .eq('employee_id', employee.id)
                .eq('restaurant_id', employee.restaurant_id)
                .maybeSingle();
            deliveryBoyRecord = db;
        }

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
            branchId: employee.branch_id || null,
            branch_id: employee.branch_id || null,
            employee_id: employee.employee_id || null,
            deliveryBoyId: deliveryBoyRecord?.id || null,
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
            details: { panel: 'employee', method: 'pin', role: mappedRole }
        });

        // Determine destination URL
        const rid = employee.restaurant_id;
        let redirectUrl = '/';
        if (mappedRole === 'restaurant_admin') {
            redirectUrl = rid ? `/${rid}/admin/dashboard` : '/waiting-approval';
        } else if (mappedRole === 'waiter') {
            redirectUrl = rid ? `/${rid}/waiter/${search10}/dashboard` : '/';
        } else if (mappedRole === 'kitchen') {
            redirectUrl = rid ? `/${rid}/kds` : '/';
        } else if (mappedRole === 'delivery_boy') {
            const dbId = deliveryBoyRecord?.id || 'default';
            redirectUrl = rid ? `/${rid}/delivery/${dbId}/dashboard` : '/';
        } else if (mappedRole === 'supervisor') {
            redirectUrl = rid ? `/${rid}/supervisor` : '/';
        } else {
            redirectUrl = rid ? `/${rid}/staff/${search10}` : '/';
        }

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
                branch_id: employee.branch_id || null,
                branchId: employee.branch_id || null,
                employee_id: employee.employee_code || employee.employee_id || null,
                status: employee.status || 'active'
            }
        });

        // Set secure cookies
        response.cookies.set('dine_auth_token', token, cookieOpts);
        response.cookies.set('dine_auth_token_employee', token, cookieOpts);
        if (rid) {
            const cleanRid = String(rid).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
            response.cookies.set(`dine_auth_token_${cleanRid}`, token, cookieOpts);
            response.cookies.set(`dine_auth_token_${cleanRid}_employee`, token, cookieOpts);
            response.cookies.set(`dine_auth_token_${cleanRid}_${search10}`, token, cookieOpts);
        }

        return response;

    } catch (err: any) {
        console.error('[EmployeeLogin] Error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
