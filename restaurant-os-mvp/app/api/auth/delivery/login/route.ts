import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { signJwt } from '@/lib/jwt-utils';
import { resolveRestaurantId } from '@/services/utils.service';
import crypto from 'crypto';

/**
 * POST /api/auth/delivery/login
 * 
 * Authenticates a delivery boy using mobile number or employee ID.
 * Validates the employee exists, is approved, and is registered as a delivery boy.
 * Returns a JWT scoped to the delivery panel and records session in dine_sessions.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { identifier, restaurantId } = body;

        if (!identifier || !identifier.trim()) {
            return NextResponse.json({ error: 'Mobile number or employee ID is required' }, { status: 400 });
        }

        const cleanIdentifier = identifier.trim();

        // 1. Resolve restaurant if provided
        let resolvedRestId: string | null = null;
        if (restaurantId && restaurantId !== 'login' && restaurantId !== 'default') {
            resolvedRestId = await resolveRestaurantId(restaurantId);
        }

        // 2. Look up employee by mobile or employee_id across the system
        let employeeQuery = supabaseAdmin
            .from('employees')
            .select('id, name, email, mobile, role, status, approval_status, restaurant_id, employee_id, is_deleted, avatar_url, session_version');

        const cleanMobile = cleanIdentifier.replace(/[^0-9]/g, '').slice(-10);
        const isNumeric = /^\d+$/.test(cleanIdentifier.replace(/[\s-+()]/g, ''));

        if (isNumeric && cleanMobile.length >= 10) {
            const orFilters = [
                `mobile.eq.${cleanMobile}`,
                `mobile.eq.+91${cleanMobile}`,
                `mobile.eq.91${cleanMobile}`,
                `mobile.eq.0${cleanMobile}`,
                `mobile.ilike.%${cleanMobile}%`,
                `employee_id.eq.${cleanIdentifier}`,
            ];
            employeeQuery = employeeQuery.or(orFilters.join(','));
        } else {
            employeeQuery = employeeQuery.or(`employee_id.ilike.${cleanIdentifier},mobile.ilike.%${cleanIdentifier}%`);
        }

        employeeQuery = employeeQuery.eq('is_deleted', false);

        const { data: employees, error: empErr } = await employeeQuery;

        if (empErr) {
            console.error('[DeliveryLogin] DB error querying employee:', empErr);
            return NextResponse.json({ error: 'Database verification failed' }, { status: 500 });
        }

        if (!employees || employees.length === 0) {
            return NextResponse.json({ 
                error: `No staff account found with identifier "${cleanIdentifier}". Please check your mobile number or contact your restaurant manager.` 
            }, { status: 404 });
        }

        // Selection priority:
        // A. If resolvedRestId is provided, look for delivery_boy in that restaurant
        // B. Look for delivery_boy in any restaurant
        // C. Look for any employee matching resolvedRestId
        // D. First employee found
        let employee = employees.find(e => 
            e.role?.toLowerCase() === 'delivery_boy' && 
            resolvedRestId && 
            e.restaurant_id === resolvedRestId
        );

        if (!employee) {
            employee = employees.find(e => e.role?.toLowerCase() === 'delivery_boy');
        }

        if (!employee && resolvedRestId) {
            employee = employees.find(e => e.restaurant_id === resolvedRestId);
        }

        if (!employee) {
            employee = employees[0];
        }

        // 3. Status checks and auto-activation
        if (employee.is_deleted) {
            return NextResponse.json({ error: 'This delivery account has been deactivated.' }, { status: 403 });
        }

        if (['pending_activation', 'pending', 'invited'].includes(employee.status) || employee.approval_status === 'pending_verification') {
            await supabaseAdmin
                .from('employees')
                .update({ status: 'active', approval_status: 'approved' })
                .eq('id', employee.id);
            employee.status = 'active';
            employee.approval_status = 'approved';
        } else if (employee.status === 'inactive' || employee.status === 'suspended') {
            return NextResponse.json({ error: `Account is ${employee.status}. Contact your restaurant admin.` }, { status: 403 });
        }

        if (employee.approval_status === 'rejected') {
            return NextResponse.json({ error: 'Account application was rejected. Contact your restaurant admin.' }, { status: 403 });
        }

        // 4. Verify/Auto-heal delivery boy registration in delivery_boys table
        let { data: deliveryBoy, error: dbErr } = await supabaseAdmin
            .from('delivery_boys')
            .select('id, status, vehicle_type, vehicle_number')
            .eq('employee_id', employee.id)
            .eq('restaurant_id', employee.restaurant_id)
            .maybeSingle();

        if (!deliveryBoy) {
            // Auto-heal: If employee has role delivery_boy, insert into delivery_boys
            if (employee.role?.toLowerCase() === 'delivery_boy') {
                const { data: newDb, error: insertErr } = await supabaseAdmin
                    .from('delivery_boys')
                    .upsert({
                        restaurant_id: employee.restaurant_id,
                        employee_id: employee.id,
                        status: 'active',
                    }, { onConflict: 'restaurant_id,employee_id' })
                    .select('id, status, vehicle_type, vehicle_number')
                    .single();

                if (newDb) {
                    deliveryBoy = newDb;
                } else {
                    console.error('[DeliveryLogin] Auto-heal delivery boy error:', insertErr);
                }
            }
        }

        if (!deliveryBoy) {
            return NextResponse.json({ 
                error: 'You are not registered as a delivery boy for this restaurant. Contact your restaurant admin.' 
            }, { status: 403 });
        }

        if (deliveryBoy.status === 'inactive') {
            return NextResponse.json({ 
                error: 'Your delivery account is currently inactive. Contact your restaurant admin.' 
            }, { status: 403 });
        }

        // Update delivery boy status to active if offline
        if (deliveryBoy.status === 'offline') {
            await supabaseAdmin
                .from('delivery_boys')
                .update({ status: 'active', updated_at: new Date().toISOString() })
                .eq('id', deliveryBoy.id);
            deliveryBoy.status = 'active';
        }

        // 5. Fetch Restaurant details for slug cookies & validation
        let restaurantName = 'Dine in One';
        let restaurantSlug: string | null = null;
        if (employee.restaurant_id) {
            const { data: rest } = await supabaseAdmin
                .from('restaurants')
                .select('name, slug, status')
                .eq('id', employee.restaurant_id)
                .maybeSingle();
            if (rest) {
                if (rest.status === 'suspended') {
                    return NextResponse.json({ error: 'Restaurant account is currently inactive.' }, { status: 403 });
                }
                restaurantName = rest.name || restaurantName;
                restaurantSlug = rest.slug || null;
            }
        }

        // 6. Sign JWT token & create dine_sessions entry
        const sessionId = crypto.randomUUID();
        const currentSessionVersion = employee.session_version ?? 1;

        const tokenPayload = {
            sessionId,
            userId: employee.id,
            name: employee.name,
            email: employee.email || null,
            mobile: employee.mobile || cleanMobile,
            role: 'delivery_boy',
            restaurantId: employee.restaurant_id,
            restaurant_id: employee.restaurant_id,
            employee_id: employee.employee_id,
            employeeId: employee.employee_id,
            deliveryBoyId: deliveryBoy.id,
            sessionVersion: currentSessionVersion,
        };

        const token = await signJwt(tokenPayload, 3600 * 12); // 12-hour session
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
        const userAgent = request.headers.get('user-agent') || 'unknown';

        // Record active session
        await supabaseAdmin.from('dine_sessions').insert({
            id: sessionId,
            user_id: employee.id,
            token_hash: tokenHash,
            device_info: userAgent,
            ip_address: ip,
            is_active: true,
        });

        // 7. Set auth cookies
        const cleanRid = String(employee.restaurant_id).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        const cleanDeliveryId = String(deliveryBoy.id).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        const empMobile = String(employee.mobile || cleanMobile || '').replace(/[^0-9]/g, '').slice(-10);
        const empId = String(employee.employee_id || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');

        const isHttps = request.nextUrl?.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
        const isSecure = process.env.NODE_ENV === 'production' && isHttps;

        const cookieOptions = {
            path: '/',
            httpOnly: false,
            secure: isSecure,
            sameSite: 'lax' as const,
            maxAge: 3600 * 12,
        };

        const redirectUrl = `/${employee.restaurant_id}/delivery/${deliveryBoy.id}/dashboard`;

        const response = NextResponse.json({
            success: true,
            redirectUrl,
            session: tokenPayload,
            user: employee,
            deliveryBoy,
            restaurantName,
            restaurantSlug,
        });

        // Default & delivery specific cookies
        response.cookies.set('dine_auth_token', token, cookieOptions);
        response.cookies.set('dine_auth_token_delivery', token, cookieOptions);
        response.cookies.set(`dine_auth_token_${cleanRid}`, token, cookieOptions);
        response.cookies.set(`dine_auth_token_${cleanRid}_delivery`, token, cookieOptions);
        response.cookies.set(`dine_auth_token_${cleanRid}_${cleanDeliveryId}`, token, cookieOptions);
        if (empMobile) {
            response.cookies.set(`dine_auth_token_${cleanRid}_${empMobile}`, token, cookieOptions);
            response.cookies.set(`dine_auth_token_staff_${empMobile}`, token, cookieOptions);
        }
        if (empId) {
            response.cookies.set(`dine_auth_token_${cleanRid}_${empId}`, token, cookieOptions);
        }
        response.cookies.set(`dine_auth_token_staff_${cleanDeliveryId}`, token, cookieOptions);

        // Also set cookies for slug if different from RID
        if (restaurantSlug) {
            const cleanSlug = String(restaurantSlug).toLowerCase().trim().replace(/[^a-zA-Z0-9_-]/g, '_');
            if (cleanSlug && cleanSlug !== cleanRid) {
                response.cookies.set(`dine_auth_token_${cleanSlug}`, token, cookieOptions);
                response.cookies.set(`dine_auth_token_${cleanSlug}_delivery`, token, cookieOptions);
                response.cookies.set(`dine_auth_token_${cleanSlug}_${cleanDeliveryId}`, token, cookieOptions);
                if (empMobile) {
                    response.cookies.set(`dine_auth_token_${cleanSlug}_${empMobile}`, token, cookieOptions);
                }
            }
        }

        return response;

    } catch (err: any) {
        console.error('[DeliveryLogin] Error:', err);
        return NextResponse.json({ error: err.message || 'Login failed' }, { status: 500 });
    }
}
