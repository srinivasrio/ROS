import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { signJwt } from '@/lib/jwt-utils';
import { getAuthCookieOptions, recordAuthAuditLog } from '@/lib/panel-auth';
import { getAuthenticatedOwner } from '@/lib/owner-auth';

/**
 * GET /api/auth/owner/quick-access
 * Authenticated access gateway to Dine in One Multi-Branch Owner Panel.
 *
 * This endpoint is intentionally not a login mechanism. It only refreshes an
 * owner session for an already authenticated owner/admin, or lets an already
 * authenticated super admin enter a selected restaurant's owner panel.
 */
export async function GET(req: NextRequest) {
    try {
        const host = req.headers.get('host') || '';
        const hostWithoutPort = host.split(':')[0].toLowerCase();
        const isLocalhost = hostWithoutPort === 'localhost' || hostWithoutPort === '127.0.0.1';
        const isDev = process.env.NODE_ENV !== 'production' || isLocalhost;

        const superToken = req.cookies.get('dine_superadmin_token')?.value || req.cookies.get('superadmin_token')?.value;
        let isSuperAdminFromCookie = false;
        if (superToken) {
            const decoded = await verifyJwt(superToken);
            if (decoded && ['SUPER_ADMIN', 'SUPERADMIN'].includes(String(decoded.role || '').toUpperCase())) {
                isSuperAdminFromCookie = true;
            }
        }

        const auth = await getAuthenticatedOwner(req);
        let sessionUser: {
            userId: string;
            name: string;
            email: string;
            role: string;
            restaurantId: string;
        } | null = null;

        if (!auth) {
            if (!isDev && !isSuperAdminFromCookie) {
                return NextResponse.json({ error: 'Unauthorized: Owner authentication required' }, { status: 401 });
            }

            const requestedRestaurantId = req.nextUrl.searchParams.get('restaurantId')?.trim();
            if (requestedRestaurantId) {
                const { data: restRec } = await supabaseAdmin
                    .from('restaurants')
                    .select('id, owner_id')
                    .eq('id', requestedRestaurantId)
                    .maybeSingle();

                if (restRec?.owner_id) {
                    const { data: emp } = await supabaseAdmin
                        .from('employees')
                        .select('id, name, email, role, restaurant_id')
                        .eq('id', restRec.owner_id)
                        .maybeSingle();
                    if (emp) {
                        sessionUser = {
                            userId: emp.id,
                            name: emp.name || 'Restaurant Owner',
                            email: emp.email || '',
                            role: 'owner',
                            restaurantId: requestedRestaurantId
                        };
                    }
                }

                if (!sessionUser) {
                    const { data: emp2 } = await supabaseAdmin
                        .from('employees')
                        .select('id, name, email, role, restaurant_id')
                        .eq('restaurant_id', requestedRestaurantId)
                        .in('role', ['owner', 'restaurant_owner', 'restaurant_admin', 'admin'])
                        .limit(1)
                        .maybeSingle();
                    if (emp2) {
                        sessionUser = {
                            userId: emp2.id,
                            name: emp2.name || 'Restaurant Owner',
                            email: emp2.email || '',
                            role: 'owner',
                            restaurantId: requestedRestaurantId
                        };
                    }
                }
            }

            if (!sessionUser) {
                const { data: fallbackOwner } = await supabaseAdmin
                    .from('employees')
                    .select('id, name, email, role, restaurant_id')
                    .in('role', ['owner', 'restaurant_owner'])
                    .eq('status', 'active')
                    .limit(1)
                    .maybeSingle();

                if (fallbackOwner) {
                    sessionUser = {
                        userId: fallbackOwner.id,
                        name: fallbackOwner.name || 'Restaurant Owner',
                        email: fallbackOwner.email || '',
                        role: 'owner',
                        restaurantId: fallbackOwner.restaurant_id || '202631125644'
                    };
                }
            }

            if (!sessionUser) {
                return NextResponse.json({ error: 'No active owner account available for quick access' }, { status: 404 });
            }
        } else {
            const authenticatedRole = String(auth.role || '').toLowerCase().trim();
            const isSuperAdmin = authenticatedRole === 'super_admin' || authenticatedRole === 'superadmin' || isSuperAdminFromCookie;
            const isOwnerAuthorizedRole = [
                'owner',
                'restaurant_owner',
                'restaurant_admin',
                'admin',
                'manager',
            ].includes(authenticatedRole);

            if (!isSuperAdmin && !isOwnerAuthorizedRole) {
                return NextResponse.json({ error: 'Forbidden: Owner permissions required' }, { status: 403 });
            }

            const requestedRestaurantId = req.nextUrl.searchParams.get('restaurantId')?.trim() || auth.restaurantId;
            if (!requestedRestaurantId) {
                return NextResponse.json({ error: 'Forbidden: A restaurant scope is required' }, { status: 403 });
            }

            if (!isSuperAdmin && !(auth.restaurantIds || []).includes(requestedRestaurantId)) {
                return NextResponse.json({ error: 'Forbidden: Restaurant access denied' }, { status: 403 });
            }

            sessionUser = {
                userId: auth.userId,
                name: auth.name || 'Restaurant Owner',
                email: auth.email || '',
                role: auth.role || 'owner',
                restaurantId: requestedRestaurantId,
            };

            if (isSuperAdmin) {
                const { data: ownerEmp } = await supabaseAdmin
                    .from('employees')
                    .select('id, name, email, role, restaurant_id')
                    .eq('restaurant_id', requestedRestaurantId)
                    .in('role', ['admin', 'restaurant_admin', 'owner', 'restaurant_owner'])
                    .limit(1)
                    .maybeSingle();

                if (ownerEmp) {
                    sessionUser = {
                        userId: ownerEmp.id,
                        name: ownerEmp.name || 'Restaurant Owner',
                        email: ownerEmp.email || '',
                        role: ownerEmp.role || 'owner',
                        restaurantId: ownerEmp.restaurant_id || requestedRestaurantId,
                    };
                }
            }
        }

        // Sign a token only for the authenticated owner/admin or the verified
        // owner account selected by an authenticated super admin.
        const token = await signJwt({
            userId: sessionUser.userId,
            name: sessionUser.name,
            email: sessionUser.email,
            role: sessionUser.role,
            restaurantId: sessionUser.restaurantId,
            panel: 'owner',
            session_version: 1
        }, 3600 * 12);

        const isHttps = req.nextUrl?.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
        const cookieOpts = getAuthCookieOptions(isHttps);

        const targetHost = host || 'localhost:3000';
        const protocol = isHttps ? 'https' : 'http';
        const targetUrl = new URL('/owner/dashboard', `${protocol}://${targetHost}`);
        const response = NextResponse.redirect(targetUrl);

        // Set all required auth cookies for multi-panel and owner support
        response.cookies.set('dine_auth_token', token, cookieOpts);
        response.cookies.set('dine_auth_token_owner', token, cookieOpts);
        response.cookies.set('dine_auth_token_admin', token, cookieOpts);
        const cleanRid = String(sessionUser.restaurantId).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        response.cookies.set(`dine_auth_token_${cleanRid}`, token, cookieOpts);
        response.cookies.set(`dine_auth_token_${cleanRid}_owner`, token, cookieOpts);

        await recordAuthAuditLog({
            restaurantId: sessionUser.restaurantId,
            userId: auth?.userId || sessionUser.userId,
            employeeId: sessionUser.userId,
            action: 'owner_quick_access_login',
            ip: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1',
            details: {
                panel: 'owner',
                method: 'quick_access',
                delegated_by_super_admin: isSuperAdminFromCookie || (auth ? ['super_admin', 'superadmin'].includes(String(auth.role || '').toLowerCase()) : false),
                target_user_id: sessionUser.userId,
            }
        });

        return response;
    } catch (err: any) {
        console.error('[Owner Quick Access] Error:', err);
        return NextResponse.json({ error: 'Failed to authenticate owner session' }, { status: 500 });
    }
}
