import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyPassword } from '@/lib/auth-utils';
import { signJwt } from '@/lib/jwt-utils';
import { SecurityMonitor } from '@/lib/security-monitor';
import { EmailService } from '@/lib/email-service';
import crypto from 'crypto';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, employee_id, mobile, identifier } = body;
        const rawInput = String(identifier || email || employee_id || mobile || '').trim();

        if (!rawInput) {
            return NextResponse.json({ error: 'Please enter your email, mobile number, or employee ID' }, { status: 400 });
        }
        
        const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
        const userAgent = request.headers.get('user-agent') || 'unknown';

        // Parse user-agent to get simple browser/device info
        let browser = 'unknown';
        let device = 'desktop';
        const uaLower = userAgent.toLowerCase();
        if (uaLower.includes('mobile') || uaLower.includes('android') || uaLower.includes('iphone') || uaLower.includes('ipad')) {
            device = 'mobile';
        }
        if (uaLower.includes('chrome')) {
            browser = 'chrome';
        } else if (uaLower.includes('safari')) {
            browser = 'safari';
        } else if (uaLower.includes('firefox')) {
            browser = 'firefox';
        }

        let employee: any = null;

        // 1. Fetch employee profile
        if (rawInput.includes('@')) {
            const cleanEmail = rawInput.toLowerCase().trim();
            const { data, error } = await supabaseAdmin
                .from('employees')
                .select('*')
                .eq('email', cleanEmail)
                .eq('is_deleted', false)
                .maybeSingle();

            if (!error && data) {
                employee = data;
            } else {
                // Also check public.users
                const { data: userRecord } = await supabaseAdmin
                    .from('users')
                    .select('*')
                    .eq('email', cleanEmail)
                    .maybeSingle();

                if (userRecord) {
                    employee = {
                        id: userRecord.id,
                        name: userRecord.name || 'Admin',
                        role: userRecord.role || 'restaurant_admin',
                        restaurant_id: userRecord.restaurant_id || null,
                        email: cleanEmail,
                        mobile: userRecord.phone || null,
                        status: 'active',
                        approval_status: 'approved',
                        session_version: 1
                    };
                }
            }
        } else {
            const cleanId = rawInput;
            const cleanMobile = cleanId.replace(/[^0-9]/g, '');
            const search10 = cleanMobile.length >= 10 ? cleanMobile.slice(-10) : cleanMobile;

            let orQuery = `employee_id.eq.${cleanId},mobile.eq.${cleanId}`;
            if (search10) {
                orQuery += `,mobile.eq.${search10},mobile.eq.+91${search10},mobile.ilike.%${search10}%`;
            }

            const { data, error } = await supabaseAdmin
                .from('employees')
                .select('*')
                .or(orQuery)
                .eq('is_deleted', false);

            if (!error && data && data.length > 0) {
                // Prioritize active employees, then admin
                employee = data.find((e: any) => e.status === 'active') || data[0];
            } else {
                // Also check public.users by phone or id
                let userQuery = supabaseAdmin.from('users').select('*');
                if (search10) {
                    userQuery = userQuery.or(`id.eq.${cleanId},phone.ilike.%${search10}%`);
                } else {
                    userQuery = userQuery.eq('id', cleanId);
                }
                const { data: userRecord } = await userQuery.maybeSingle();

                if (userRecord) {
                    employee = {
                        id: userRecord.id,
                        name: userRecord.name || 'Admin',
                        role: userRecord.role || 'restaurant_admin',
                        restaurant_id: userRecord.restaurant_id || null,
                        email: userRecord.email || null,
                        mobile: userRecord.phone || cleanMobile,
                        status: 'active',
                        approval_status: 'approved',
                        session_version: 1
                    };
                }
            }
        }

        if (!employee) {
            return NextResponse.json({ error: 'No account found with these credentials' }, { status: 401 });
        }

        // 2. STATUS CHECK: Check active/deleted status
        if (employee.is_deleted) {
            return NextResponse.json({ error: 'This staff account has been deactivated.' }, { status: 403 });
        }

        // Auto-activate account if pending activation or invited (password is not required)
        if (['pending_activation', 'pending', 'invited'].includes(employee.status)) {
            await supabaseAdmin
                .from('employees')
                .update({ status: 'active', approval_status: 'approved' })
                .eq('id', employee.id);
            employee.status = 'active';
            employee.approval_status = 'approved';
        } else if (employee.status === 'inactive' || employee.status === 'suspended') {
            return NextResponse.json({ 
                error: 'Account is disabled or suspended. Please contact your administrator.' 
            }, { status: 403 });
        }

        // 3. Restaurant Status Check
        if (employee.restaurant_id) {
            const { data: rest } = await supabaseAdmin
                .from('restaurants')
                .select('status')
                .eq('id', employee.restaurant_id)
                .maybeSingle();

            if (rest && rest.status?.toLowerCase() === 'suspended') {
                return NextResponse.json({ error: 'Restaurant account is currently inactive.' }, { status: 403 });
            }
        }

        // Use current session version for employee
        const currentSessionVersion = employee.session_version || 1;

        // 5. Generate new session ID and JWT
        const sessionId = crypto.randomUUID();

        let mappedRole = (employee.role || '').toLowerCase();
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
            if (db) {
                deliveryBoyRecord = db;
            } else {
                const { data: newDb } = await supabaseAdmin
                    .from('delivery_boys')
                    .upsert({
                        restaurant_id: employee.restaurant_id,
                        employee_id: employee.id,
                        status: 'active'
                    }, { onConflict: 'restaurant_id,employee_id' })
                    .select('id, status')
                    .maybeSingle();
                if (newDb) deliveryBoyRecord = newDb;
            }
        }

        const token = await signJwt({
            sessionId,
            userId: employee.id,
            name: employee.name,
            role: mappedRole,
            sessionVersion: currentSessionVersion,
            email: employee.email || null,
            mobile: employee.mobile || null,
            restaurantId: employee.restaurant_id || null,
            restaurant_id: employee.restaurant_id || null,
            employee_id: employee.employee_id || null,
            employeeId: employee.employee_id || null,
            deliveryBoyId: deliveryBoyRecord?.id || null,
        });

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        // 6. Store new active session in DB
        const { error: sessionError } = await supabaseAdmin
            .from('dine_sessions')
            .insert({
                id: sessionId,
                user_id: employee.id,
                token_hash: tokenHash,
                device_info: userAgent,
                ip_address: ip,
                is_active: true
            });

        if (sessionError) {
            console.error('Session creation failed during verification:', sessionError);
            return NextResponse.json({ error: 'Failed to establish session' }, { status: 500 });
        }

        // 7. Check if restaurant has a slug
        let restSlug: string | null = null;
        if (employee.restaurant_id) {
            try {
                const { data: prof } = await supabaseAdmin
                    .from('restaurant_profile')
                    .select('slug')
                    .eq('restaurant_id', employee.restaurant_id)
                    .maybeSingle();
                if (prof?.slug) {
                    restSlug = prof.slug.toLowerCase().trim();
                }
            } catch (_) {}
        }

        const isHttps = request.url.startsWith('https://') || request.headers.get('x-forwarded-proto') === 'https';
        const isSecure = process.env.NODE_ENV === 'production' && isHttps;

        const cookieOptions = {
            secure: isSecure,
            sameSite: 'lax' as const,
            path: '/',
            maxAge: 3600 * 8 // 8 hours
        };

        const isAdminUser = ['restaurant_admin', 'admin', 'owner', 'restaurant_owner'].includes(mappedRole) ||
            ['ADMIN', 'RESTAURANT_ADMIN', 'OWNER'].includes((employee.role || '').toUpperCase());

        try {
            const cookieStore = await cookies();
            cookieStore.set('dine_auth_token', token, cookieOptions);
            if (isAdminUser) {
                cookieStore.set('dine_auth_token_admin', token, cookieOptions);
            }
            if (employee.restaurant_id) {
                const cleanRid = String(employee.restaurant_id).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
                cookieStore.set(`dine_auth_token_${cleanRid}`, token, cookieOptions);
                if (isAdminUser) {
                    cookieStore.set(`dine_auth_token_${cleanRid}_admin`, token, cookieOptions);
                }
                if (restSlug) {
                    const cleanSlug = restSlug.replace(/[^a-zA-Z0-9_-]/g, '_');
                    cookieStore.set(`dine_auth_token_${cleanSlug}`, token, cookieOptions);
                    if (isAdminUser) {
                        cookieStore.set(`dine_auth_token_${cleanSlug}_admin`, token, cookieOptions);
                    }
                }
                const empMobile = (employee.mobile || '').replace(/[^0-9]/g, '').slice(-10);
                if (empMobile) {
                    cookieStore.set(`dine_auth_token_${cleanRid}_${empMobile}`, token, cookieOptions);
                    cookieStore.set(`dine_auth_token_staff_${empMobile}`, token, cookieOptions);
                }
                const empId = (employee.employee_id || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
                if (empId) {
                    cookieStore.set(`dine_auth_token_${cleanRid}_${empId}`, token, cookieOptions);
                }
            }
        } catch {
            // Ignore if called outside request context (e.g. testing)
        }

        // 8. Update last login details
        await supabaseAdmin
            .from('auth')
            .update({
                last_login: new Date().toISOString(),
                last_ip: ip,
                last_device: device,
                last_browser: browser,
                failed_attempts: 0,
                locked_until: null
            })
            .eq('user_id', employee.id);

        // 9. Log shift for waiters
        if (mappedRole === 'waiter') {
            await supabaseAdmin.from('waiter_shifts').insert({
                user_id: employee.id,
                shift_name: 'Morning'
            });
        }

        // 10. Write audit logs
        await supabaseAdmin.from('audit_logs').insert([
            {
                restaurant_id: employee.restaurant_id || null,
                user_id: employee.id,
                employee_id: employee.employee_id || null,
                action: 'login',
                ip_address: ip,
                device,
                browser,
                details: { method: 'passwordless', role: mappedRole }
            }
        ]);

        // Compute role-based redirect URL
        let redirectUrl = '/';
        const roleUpper = (employee.role || '').toUpperCase();
        const rid = employee.restaurant_id;

        if (roleUpper === 'SUPER_ADMIN' || roleUpper === 'SUPERADMIN' || employee.email === 'superadmin@dineinone.com') {
            redirectUrl = '/super-admin';
        } else if (roleUpper === 'ADMIN' || roleUpper === 'RESTAURANT_ADMIN') {
            if (rid) {
                redirectUrl = `/${rid}/admin/dashboard`;
            } else {
                redirectUrl = '/waiting-approval';
            }
        } else if (roleUpper === 'SUPERVISOR') {
            redirectUrl = rid ? `/${rid}/supervisor` : '/';
        } else if (roleUpper === 'WAITER') {
            const cleanWaitMobile = (employee.mobile || '').replace(/[^0-9]/g, '').slice(-10) || 'default';
            redirectUrl = rid ? `/${rid}/waiter/${cleanWaitMobile}/dashboard` : '/';
        } else if (roleUpper === 'CHEF' || roleUpper === 'KITCHEN') {
            redirectUrl = rid ? `/${rid}/kds` : '/';
        } else if (roleUpper === 'DELIVERY_BOY') {
            const dbId = deliveryBoyRecord?.id || 'default';
            redirectUrl = rid ? `/${rid}/delivery/${dbId}/dashboard` : '/';
        }

        const response = NextResponse.json({
            success: true,
            redirectUrl,
            user: {
                id: employee.id,
                name: employee.name,
                role: mappedRole,
                email: employee.email || null,
                mobile: employee.mobile || null,
                restaurant_id: employee.restaurant_id || null,
                deliveryBoyId: deliveryBoyRecord?.id || null,
                status: employee.status || 'active'
            }
        });

        // Set default token cookie
        response.cookies.set('dine_auth_token', token, cookieOptions);
        if (isAdminUser) {
            response.cookies.set('dine_auth_token_admin', token, cookieOptions);
        }
        if (roleUpper === 'DELIVERY_BOY') {
            response.cookies.set('dine_auth_token_delivery', token, cookieOptions);
        }

        // Set restaurant-scoped token cookies
        if (employee.restaurant_id) {
            const cleanRid = String(employee.restaurant_id).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
            response.cookies.set(`dine_auth_token_${cleanRid}`, token, cookieOptions);
            if (isAdminUser) {
                response.cookies.set(`dine_auth_token_${cleanRid}_admin`, token, cookieOptions);
            }
            if (roleUpper === 'DELIVERY_BOY') {
                response.cookies.set(`dine_auth_token_${cleanRid}_delivery`, token, cookieOptions);
                if (deliveryBoyRecord?.id) {
                    const cleanDbId = String(deliveryBoyRecord.id).replace(/[^a-zA-Z0-9_-]/g, '_');
                    response.cookies.set(`dine_auth_token_${cleanRid}_${cleanDbId}`, token, cookieOptions);
                    response.cookies.set(`dine_auth_token_staff_${cleanDbId}`, token, cookieOptions);
                }
            }
            if (restSlug) {
                const cleanSlug = restSlug.replace(/[^a-zA-Z0-9_-]/g, '_');
                response.cookies.set(`dine_auth_token_${cleanSlug}`, token, cookieOptions);
                if (isAdminUser) {
                    response.cookies.set(`dine_auth_token_${cleanSlug}_admin`, token, cookieOptions);
                }
                if (roleUpper === 'DELIVERY_BOY') {
                    response.cookies.set(`dine_auth_token_${cleanSlug}_delivery`, token, cookieOptions);
                }
            }
            const empMobile = (employee.mobile || '').replace(/[^0-9]/g, '').slice(-10);
            if (empMobile) {
                response.cookies.set(`dine_auth_token_${cleanRid}_${empMobile}`, token, cookieOptions);
                response.cookies.set(`dine_auth_token_staff_${empMobile}`, token, cookieOptions);
            }
            const empId = (employee.employee_id || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
            if (empId) {
                response.cookies.set(`dine_auth_token_${cleanRid}_${empId}`, token, cookieOptions);
            }
        }

        return response;

    } catch (error: any) {
        console.error('Login error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
