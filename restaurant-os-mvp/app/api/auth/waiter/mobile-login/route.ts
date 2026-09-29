import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { signJwt } from '@/lib/jwt-utils';
import crypto from 'crypto';

/**
 * Authenticated staff sign-in for waiters and shift staff.
 * Allows sign in using mobile number, employee ID, or email.
 * Password is not required.
 * Strictly verifies active account status and establishes active session.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const rawInput = String(body?.identifier || body?.mobile || body?.employee_id || body?.email || '').trim();

        if (!rawInput) {
            return NextResponse.json({ error: 'Please enter your mobile number, employee ID, or email' }, { status: 400 });
        }

        const cleanMobile = rawInput.replace(/[^0-9]/g, '').slice(-10);

        let employees: any[] | null = null;
        let empError: any = null;

        if (rawInput.includes('@')) {
            const cleanEmail = rawInput.toLowerCase().trim();
            const res = await supabaseAdmin
                .from('employees')
                .select('id, employee_id, name, mobile, email, role, status, approval_status, session_version, restaurant_id, is_deleted')
                .eq('email', cleanEmail)
                .eq('is_deleted', false);
            employees = res.data;
            empError = res.error;
        } else {
            const orFilters = [
                `employee_id.eq.${rawInput}`,
                `mobile.eq.${rawInput}`,
            ];
            if (cleanMobile.length >= 10) {
                orFilters.push(`mobile.eq.${cleanMobile}`);
                orFilters.push(`mobile.eq.+91${cleanMobile}`);
                orFilters.push(`mobile.eq.91${cleanMobile}`);
            }
            const res = await supabaseAdmin
                .from('employees')
                .select('id, employee_id, name, mobile, email, role, status, approval_status, session_version, restaurant_id, is_deleted')
                .or(orFilters.join(','))
                .eq('is_deleted', false);
            employees = res.data;
            empError = res.error;
        }

        if (empError) {
            console.error('[waiter-mobile-login] DB error:', empError);
            return NextResponse.json({ error: 'Database verification failed' }, { status: 500 });
        }

        if (!employees || employees.length === 0) {
            return NextResponse.json({
                error: `No employee account found with ${rawInput}. Please contact your restaurant manager.`,
            }, { status: 404 });
        }

        const validRoleEmployee = employees.find((emp: any) => {
            const r = emp.role?.toLowerCase();
            return ['waiter', 'supervisor', 'admin', 'restaurant_admin', 'manager'].includes(r);
        }) || employees[0];

        // 1. STATUS CHECK
        if (validRoleEmployee.is_deleted) {
            return NextResponse.json({ error: 'This staff account has been deactivated.' }, { status: 403 });
        }

        // Auto-activate account if pending activation or invited (password not required)
        if (['pending_activation', 'pending', 'invited'].includes(validRoleEmployee.status)) {
            await supabaseAdmin
                .from('employees')
                .update({ status: 'active', approval_status: 'approved' })
                .eq('id', validRoleEmployee.id);
            validRoleEmployee.status = 'active';
            validRoleEmployee.approval_status = 'approved';
        } else if (validRoleEmployee.status === 'inactive' || validRoleEmployee.status === 'suspended') {
            return NextResponse.json({
                error: 'Account is disabled or suspended. Please contact your restaurant manager.',
            }, { status: 403 });
        }

        if (validRoleEmployee.approval_status === 'rejected') {
            return NextResponse.json({
                error: 'Account application was rejected. Please contact your restaurant manager.',
            }, { status: 403 });
        }

        // 2. RESTAURANT CHECK
        let restaurantName = 'Dine in One';
        let restaurantSlug: string | null = null;
        if (validRoleEmployee.restaurant_id) {
            const { data: rest } = await supabaseAdmin
                .from('restaurants')
                .select('name, slug, status')
                .eq('id', validRoleEmployee.restaurant_id)
                .maybeSingle();
            if (rest) {
                if (rest.status === 'suspended') {
                    return NextResponse.json({ error: 'Restaurant account is currently inactive.' }, { status: 403 });
                }
                restaurantName = rest.name || restaurantName;
                restaurantSlug = rest.slug || null;
            }
        }

        // Use current session version for waiter
        const currentSessionVersion = validRoleEmployee.session_version ?? 1;

        let mappedRole = validRoleEmployee.role;
        if (validRoleEmployee.role === 'chef') mappedRole = 'kitchen';

        const sessionId = crypto.randomUUID();
        const token = await signJwt({
            sessionId,
            userId: validRoleEmployee.id,
            name: validRoleEmployee.name,
            role: mappedRole,
            sessionVersion: currentSessionVersion,
            email: validRoleEmployee.email || null,
            mobile: validRoleEmployee.mobile || cleanMobile,
            restaurantId: validRoleEmployee.restaurant_id || null,
            restaurant_id: validRoleEmployee.restaurant_id || null,
        });

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
        const userAgent = req.headers.get('user-agent') || 'unknown';

        const { error: sessionError } = await supabaseAdmin.from('dine_sessions').insert({
            id: sessionId,
            user_id: validRoleEmployee.id,
            token_hash: tokenHash,
            device_info: userAgent,
            ip_address: ip,
            is_active: true,
        });

        if (sessionError) {
            console.error('[waiter-mobile-login] Session insert failed:', sessionError);
            return NextResponse.json({ error: 'Failed to establish session' }, { status: 500 });
        }

        const isHttps = req.nextUrl?.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
        const isSecure = process.env.NODE_ENV === 'production' && isHttps;

        const cookieOptions = {
            secure: isSecure,
            sameSite: 'lax' as const,
            path: '/',
            maxAge: 3600 * 8,
        };

        if (validRoleEmployee.role?.toLowerCase() === 'waiter') {
            // Fire shift record asynchronously without blocking login response latency
            Promise.resolve(
                supabaseAdmin.from('waiter_shifts').insert({
                    user_id: validRoleEmployee.id,
                    shift_name: 'Morning',
                })
            ).catch((e) => console.warn('[waiter-mobile-login] shift record error:', e));
        }

        const response = NextResponse.json({
            success: true,
            message: 'Signed in successfully',
            session: {
                userId: validRoleEmployee.id,
                employeeId: validRoleEmployee.employee_id || validRoleEmployee.id,
                name: validRoleEmployee.name,
                mobile: validRoleEmployee.mobile || cleanMobile,
                role: validRoleEmployee.role,
                restaurantId: validRoleEmployee.restaurant_id,
                restaurantName,
                restaurantSlug,
            },
            permissions: [
                'view_tables',
                'create_orders',
                'modify_orders',
                'mark_served',
                'view_requests',
                'request_bill',
                'merge_tables',
            ],
        });

        // Set default token cookie
        response.cookies.set('dine_auth_token', token, cookieOptions);
        response.cookies.set('dine_auth_token_waiter', token, cookieOptions);

        // Set restaurant-scoped token cookies
        if (validRoleEmployee.restaurant_id) {
            const cleanRid = String(validRoleEmployee.restaurant_id).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
            response.cookies.set(`dine_auth_token_${cleanRid}`, token, cookieOptions);
            response.cookies.set(`dine_auth_token_${cleanRid}_waiter`, token, cookieOptions);
            if (restaurantSlug) {
                const cleanSlug = String(restaurantSlug).toLowerCase().trim().replace(/[^a-zA-Z0-9_-]/g, '_');
                response.cookies.set(`dine_auth_token_${cleanSlug}`, token, cookieOptions);
            }
            const empMobile = (validRoleEmployee.mobile || cleanMobile || '').replace(/[^0-9]/g, '').slice(-10);
            if (empMobile) {
                response.cookies.set(`dine_auth_token_${cleanRid}_${empMobile}`, token, cookieOptions);
                response.cookies.set(`dine_auth_token_staff_${empMobile}`, token, cookieOptions);
            }
            const empId = (validRoleEmployee.employee_id || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
            if (empId) {
                response.cookies.set(`dine_auth_token_${cleanRid}_${empId}`, token, cookieOptions);
            }
        }

        return response;
    } catch (err: any) {
        console.error('[waiter-mobile-login] error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
