import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyPin } from '@/lib/auth-utils';
import { signJwt } from '@/lib/jwt-utils';
import { resolveRestaurantId } from '@/services/utils.service';
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
 * POST /api/auth/delivery/login
 * Mobile + PIN authentication for Delivery employees.
 * Server verifies role is delivery_boy (or restaurant_admin).
 * Passwords are not required. PIN is verified against secure Argon2 hash.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const rawIdentifier = String(body?.identifier || body?.mobile || '').trim();
        const rawPin = String(body?.pin || '').trim();
        const restaurantId = body?.restaurantId;

        if (!rawIdentifier || !rawPin) {
            return NextResponse.json({ error: 'Please enter both your mobile number and employee PIN' }, { status: 400 });
        }

        const cleanMobile = rawIdentifier.replace(/[^0-9]/g, '').slice(-10);
        const searchMobile = cleanMobile.length >= 10 ? cleanMobile : rawIdentifier;

        const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
        const userAgent = request.headers.get('user-agent') || 'unknown';
        const uaLower = userAgent.toLowerCase();
        const device = (uaLower.includes('mobile') || uaLower.includes('android') || uaLower.includes('iphone')) ? 'mobile' : 'desktop';
        const browser = uaLower.includes('chrome') ? 'chrome' : uaLower.includes('safari') ? 'safari' : uaLower.includes('firefox') ? 'firefox' : 'unknown';

        // 1. Resolve restaurant if provided
        let resolvedRestId: string | null = null;
        if (restaurantId && restaurantId !== 'login' && restaurantId !== 'default') {
            resolvedRestId = await resolveRestaurantId(restaurantId);
        }

        // 2. Fetch employee by mobile or employee_id
        let employeeQuery = supabaseAdmin
            .from('employees')
            .select('*');

        const e164 = normalizeE164Phone(rawIdentifier);
        if (cleanMobile.length >= 10) {
            const orFilters = [
                `mobile.eq.${cleanMobile}`,
                `mobile.eq.+91${cleanMobile}`,
                `mobile.eq.91${cleanMobile}`,
                `mobile.ilike.%${cleanMobile}%`,
                `employee_id.eq.${rawIdentifier}`,
                `employee_code.eq.${rawIdentifier}`
            ];
            if (e164) {
                orFilters.unshift(`phone_normalized.eq.${e164}`);
            }
            employeeQuery = employeeQuery.or(orFilters.join(','));
        } else {
            employeeQuery = employeeQuery.or(`employee_id.ilike.${rawIdentifier},employee_code.eq.${rawIdentifier},mobile.ilike.%${rawIdentifier}%`);
        }

        employeeQuery = employeeQuery.eq('is_deleted', false);

        const { data: employees, error: empErr } = await employeeQuery;

        if (empErr) {
            console.error('[DeliveryLogin] DB error querying employee:', empErr);
            return NextResponse.json({ error: 'Database verification failed' }, { status: 500 });
        }

        if (!employees || employees.length === 0) {
            return NextResponse.json({
                error: `No staff account found with mobile number "${searchMobile}". Please contact your restaurant manager.`
            }, { status: 404 });
        }

        // Prioritize delivery_boy role
        let employee = employees.find(e =>
            (e.role?.toLowerCase() === 'delivery_boy' || e.role?.toLowerCase() === 'delivery') &&
            (!resolvedRestId || e.restaurant_id === resolvedRestId)
        );

        if (!employee) {
            employee = employees.find(e => e.role?.toLowerCase() === 'delivery_boy' || e.role?.toLowerCase() === 'delivery');
        }

        if (!employee) {
            employee = employees[0];
        }

        // 3. ROLE AUTHORIZATION CHECK (Delivery panel only allows delivery_boy / restaurant_admin)
        const rawRole = (employee.role || '').toLowerCase().trim();
        const isAuthorizedDelivery = ['delivery_boy', 'delivery', 'restaurant_admin', 'admin'].includes(rawRole);

        if (!isAuthorizedDelivery) {
            await recordAuthAuditLog({
                restaurantId: employee.restaurant_id,
                userId: employee.id,
                employeeId: employee.employee_id,
                action: 'unauthorized_panel_attempt',
                ip,
                device,
                browser,
                details: { attempted_panel: 'delivery', actual_role: rawRole }
            });
            return NextResponse.json({
                error: `Access Denied: Role "${employee.role}" is not authorized to access the Delivery Panel.`
            }, { status: 403 });
        }

        // 4. RATE LIMIT & LOCKOUT CHECK
        const lockoutStatus = await checkRateLimitAndLockout(employee.id);
        if (lockoutStatus.locked) {
            const minutesLeft = Math.ceil((lockoutStatus.remainingCooldownSeconds || 60) / 60);
            return NextResponse.json({
                error: `Account is locked due to too many failed PIN attempts. Please try again in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.`
            }, { status: 429 });
        }

        // 5. PIN VERIFICATION
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
                panel: 'delivery',
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

        // 6. EMPLOYEE STATUS CHECKS
        if (employee.is_deleted) {
            return NextResponse.json({ error: 'This delivery account has been deactivated.' }, { status: 403 });
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

        // 7. RESTAURANT CHECK
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

        // 8. RESOLVE OR REGISTER DELIVERY BOY RECORD
        let deliveryBoyRecord: any = null;
        if (employee.restaurant_id) {
            const { data: existingDb } = await supabaseAdmin
                .from('delivery_boys')
                .select('id, status, vehicle_type, vehicle_number')
                .eq('employee_id', employee.id)
                .eq('restaurant_id', employee.restaurant_id)
                .maybeSingle();

            if (existingDb) {
                deliveryBoyRecord = existingDb;
            } else {
                const { data: newDb, error: insertDbErr } = await supabaseAdmin
                    .from('delivery_boys')
                    .upsert({
                        restaurant_id: employee.restaurant_id,
                        employee_id: employee.id,
                        status: 'active'
                    }, { onConflict: 'restaurant_id,employee_id' })
                    .select('id, status, vehicle_type, vehicle_number')
                    .maybeSingle();

                if (!insertDbErr && newDb) {
                    deliveryBoyRecord = newDb;
                }
            }
        }

        // 9. RESET FAILED ATTEMPTS
        await resetFailedAttempts(employee.id, { ip, device, browser });

        // 10. CREATE SESSION & SIGN JWT
        const sessionId = crypto.randomUUID();
        const currentSessionVersion = employee.session_version ?? 1;

        const token = await signJwt({
            sessionId,
            userId: employee.id,
            name: employee.name,
            role: 'delivery_boy',
            sessionVersion: currentSessionVersion,
            email: employee.email || null,
            mobile: employee.mobile || cleanMobile,
            restaurantId: employee.restaurant_id || null,
            restaurant_id: employee.restaurant_id || null,
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
            details: { panel: 'delivery', method: 'pin', role: 'delivery_boy', deliveryBoyId: deliveryBoyRecord?.id }
        });

        const rid = employee.restaurant_id;
        const dbId = deliveryBoyRecord?.id || 'default';
        const redirectUrl = rid ? `/${rid}/delivery/${dbId}/dashboard` : '/';

        const isHttps = request.nextUrl?.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
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
                role: 'delivery_boy',
                email: employee.email || null,
                mobile: employee.phone_normalized || employee.mobile || cleanMobile,
                restaurant_id: employee.restaurant_id || null,
                employee_id: employee.employee_code || employee.employee_id || null,
                deliveryBoyId: dbId,
                status: employee.status || 'active'
            },
            session: {
                userId: employee.id,
                internalId: employee.internal_id,
                name: employee.name,
                role: 'delivery_boy',
                restaurantId: employee.restaurant_id || null,
                employeeId: employee.employee_code || employee.employee_id || null,
                deliveryBoyId: dbId,
                mobile: employee.phone_normalized || employee.mobile || cleanMobile,
            }
        });

        // Set secure cookies
        response.cookies.set('dine_auth_token', token, cookieOpts);
        response.cookies.set('dine_auth_token_delivery', token, cookieOpts);
        if (rid) {
            const cleanRid = String(rid).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
            response.cookies.set(`dine_auth_token_${cleanRid}`, token, cookieOpts);
            response.cookies.set(`dine_auth_token_${cleanRid}_delivery`, token, cookieOpts);
            if (dbId && dbId !== 'default') {
                const cleanDbId = String(dbId).replace(/[^a-zA-Z0-9_-]/g, '_');
                response.cookies.set(`dine_auth_token_${cleanRid}_${cleanDbId}`, token, cookieOpts);
                response.cookies.set(`dine_auth_token_staff_${cleanDbId}`, token, cookieOpts);
            }
            if (cleanMobile) {
                response.cookies.set(`dine_auth_token_${cleanRid}_${cleanMobile}`, token, cookieOpts);
                response.cookies.set(`dine_auth_token_staff_${cleanMobile}`, token, cookieOpts);
            }
        }

        return response;

    } catch (err: any) {
        console.error('[DeliveryLogin] Error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
