import { NextResponse, type NextRequest } from 'next/server';
import { verifyJwt, extractTokenForRestaurant } from './lib/jwt-utils';
import { supabaseAdmin } from './lib/supabase-admin';
import { extractSubdomain, isRoleAuthorizedForPanel, PanelType, resolvePanelLoginUrl, clearAllAuthCookies } from './lib/panel-auth';

// Fast in-memory cache to prevent blocking DB roundtrips on every subrequest / refresh
const restStatusCache = new Map<string, { status: string | null; ownerId: string | null; expiresAt: number }>();
const userValidationCache = new Map<string, { data: any; expiresAt: number }>();
const slugResolutionCache = new Map<string, { id: string; expiresAt: number }>();
const CACHE_TTL_MS = 60000; // 60 seconds

// P1 FIX (DB-02): Asynchronous, non-blocking security audit logger
function logSecurityEventAsync(payload: Record<string, unknown>) {
    Promise.resolve(supabaseAdmin.from('audit_logs').insert(payload as never))
        .catch((err: unknown) => {
            console.error('[middleware:audit_log] Async security event insert failed:', err);
        });
}

async function resolveRestaurantCodeToId(code: string | null | undefined): Promise<string> {
    if (!code) return '';
    const cleanCode = String(code).trim();
    if (!cleanCode) return '';

    const lowerCode = cleanCode.toLowerCase();
    const nowMs = Date.now();
    const cached = slugResolutionCache.get(lowerCode);
    if (cached && cached.expiresAt > nowMs) {
        return cached.id;
    }

    // Fast-path: If code already matches standard ID patterns (numeric 8+ digits, REST-*, PEND-*, UUID),
    // skip unnecessary network roundtrips and cache immediately
    if (/^\d{8,}$|^REST-|^PEND-|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanCode)) {
        slugResolutionCache.set(lowerCode, { id: cleanCode, expiresAt: nowMs + CACHE_TTL_MS });
        return cleanCode;
    }

    try {
        // 1. Direct check in restaurants table first
        const { data: exists } = await supabaseAdmin
            .from('restaurants')
            .select('id')
            .eq('id', cleanCode)
            .maybeSingle();

        if (exists?.id) {
            slugResolutionCache.set(lowerCode, { id: exists.id, expiresAt: nowMs + CACHE_TTL_MS });
            return exists.id;
        }

        // 2. Try as Slug or restaurant_id in restaurant_profile
        const { data: profile } = await supabaseAdmin
            .from('restaurant_profile')
            .select('restaurant_id')
            .or(`slug.eq.${lowerCode},restaurant_id.eq.${cleanCode}`)
            .maybeSingle();

        if (profile?.restaurant_id) {
            slugResolutionCache.set(lowerCode, { id: profile.restaurant_id, expiresAt: nowMs + CACHE_TTL_MS });
            return profile.restaurant_id;
        }
    } catch (err) {
        console.warn(`[middleware:resolveRestaurantCodeToId] Lookup failed for "${cleanCode}":`, err);
    }

    // Fallback: return original code (short TTL so transient failures recover quickly)
    slugResolutionCache.set(lowerCode, { id: cleanCode, expiresAt: nowMs + 5000 });
    return cleanCode;
}


export async function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;
    const host = request.headers.get('host') || '';
    const hostWithoutPort = host.split(':')[0].toLowerCase().trim();
    const isProductionMarketingApex = (
        hostWithoutPort === 'dineinone.com' || 
        hostWithoutPort === 'www.dineinone.com'
    );
    const subdomain = extractSubdomain(host, request.nextUrl.searchParams, request.headers);
    const isPrefetch = request.headers.get('next-router-prefetch') === '1' || request.headers.get('purpose') === 'prefetch';

    // Super Admin is now a standalone website on Port 3005
    if (path.startsWith('/super-admin') || (subdomain === 'superadmin' && (path === '/' || path.startsWith('/dashboard')))) {
        const superAdminUrl = process.env.NEXT_PUBLIC_SUPER_ADMIN_URL || 'http://control.localhost:3005';
        return NextResponse.redirect(new URL(superAdminUrl));
    }

    const isCustomerRoute = path.includes('/customer') || path.startsWith('/api/customer/');

    // Operational Subdomain Isolation for Customer Dining:
    // If a customer scans a table QR code printed with a staff subdomain (e.g. admin.dineinone.com/202609089153/customer/table/1),
    // immediately redirect them to the apex customer domain (dineinone.com) so staff auth checks are never triggered.
    if (subdomain && subdomain !== 'customer' && isCustomerRoute) {
        const targetUrl = new URL(request.url);
        if (hostWithoutPort.endsWith('dineinone.com')) {
            targetUrl.host = 'dineinone.com';
            targetUrl.port = '';
        } else {
            targetUrl.host = hostWithoutPort.replace(new RegExp(`^${subdomain}\\.`), '');
            if (request.nextUrl.port) targetUrl.port = request.nextUrl.port;
        }
        return NextResponse.redirect(targetUrl);
    }

    // Customer Subdomain Root: Route directly to customer dining portal
    if (subdomain === 'customer' && path === '/') {
        const url = request.nextUrl.clone();
        url.pathname = '/customer';
        return NextResponse.rewrite(url);
    }

    // 0a. Rewrite subdomain /login to dedicated panel login page
    // e.g. admin.dineinone.com/login -> /login/admin
    // waiter.dineinone.com/login -> /login/waiter
    if (subdomain && path === '/login') {
        const url = request.nextUrl.clone();
        url.pathname = `/login/${subdomain}`;
        return NextResponse.rewrite(url);
    }

    // Cross-panel login access defense on subdomains:
    // If a user visits e.g. waiter.dineinone.com/login/admin, block with 404 (wrong subdomain for that panel).
    if (subdomain && !path.startsWith('/api/') && path.startsWith('/login/') && path !== `/login/${subdomain}`) {
        return new NextResponse(null, { status: 404 });
    }

    // Public Marketing Website Isolation:
    // Only applies to production marketing apex domain (dineinone.com).
    // On localhost, IP addresses, and dedicated subdomains, internal panels and logins remain accessible.
    if (isProductionMarketingApex && !subdomain && !path.startsWith('/api/')) {
        if (path === '/') {
            return NextResponse.next();
        }

        if (path === '/login' || path === '/login/owner') {
            return NextResponse.redirect(new URL(`https://owner.dineinone.com/login${request.nextUrl.search}`));
        }

        if (path.startsWith('/owner')) {
            return NextResponse.redirect(new URL(`https://owner.dineinone.com${path}${request.nextUrl.search}`));
        }

        if (
            path === '/login' ||
            path.startsWith('/login/') ||
            /\/(admin|waiter|kds|delivery|employee|superadmin)\/login\/?$/.test(path)
        ) {
            return new NextResponse(null, { status: 404 });
        }
    }

    // 0b. Extract target restaurant scope from path or search params (enables multi-tab multi-tenant sessions)
    const segments = path.split('/').filter(Boolean);
    let targetRestaurantCode: string | null = null;

    if (path.startsWith('/api/')) {
        targetRestaurantCode = request.nextUrl.searchParams.get('restaurantId') || 
            request.nextUrl.searchParams.get('restaurantCode') || 
            request.headers.get('x-restaurant-id') || 
            null;

        if (!targetRestaurantCode) {
            const referer = request.headers.get('referer');
            if (referer) {
                try {
                    const refererUrl = new URL(referer);
                    const refSegments = refererUrl.pathname.split('/').filter(Boolean);
                    if (refSegments.length > 0) {
                        const firstSegment = refSegments[0];
                        const nextSegment = refSegments[1];
                        const isTenantScoped = (
                            /^\d+$/.test(firstSegment) || 
                            /^(REST|PEND)-/i.test(firstSegment) ||
                            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(firstSegment) ||
                            ['admin', 'waiter', 'kds', 'supervisor', 'staff', 'delivery'].includes(nextSegment || '')
                        );
                        if (isTenantScoped) {
                            targetRestaurantCode = firstSegment;
                        }
                    }
                } catch (_) {}
            }
        }
    } else if (segments.length > 0) {
        const firstSegment = segments[0];
        const nextSegment = segments[1];
        const isTenantScoped = (
            /^\d+$/.test(firstSegment) || 
            /^(REST|PEND)-/i.test(firstSegment) ||
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(firstSegment) ||
            ['admin', 'waiter', 'kds', 'supervisor', 'staff', 'delivery'].includes(nextSegment || '')
        );
        if (isTenantScoped) {
            targetRestaurantCode = firstSegment;
        }
    }

    let targetStaffIdentifier: string | null = null;
    if (segments.length > 2 && (segments[1] === 'waiter' || segments[1] === 'staff' || segments[1] === 'delivery')) {
        targetStaffIdentifier = segments[2];
    } else if (path.startsWith('/api/waiter/') || path.startsWith('/api/staff/') || path.startsWith('/api/delivery/')) {
        targetStaffIdentifier = request.nextUrl.searchParams.get('deliveryBoyId') ||
            request.nextUrl.searchParams.get('mobile') || 
            request.nextUrl.searchParams.get('staffMobile') || 
            request.nextUrl.searchParams.get('employee_id');

        if (!targetStaffIdentifier) {
            const referer = request.headers.get('referer');
            if (referer) {
                try {
                    const refererUrl = new URL(referer);
                    const refSegments = refererUrl.pathname.split('/').filter(Boolean);
                    if (refSegments.length > 2 && (refSegments[1] === 'waiter' || refSegments[1] === 'staff' || refSegments[1] === 'delivery')) {
                        targetStaffIdentifier = refSegments[2];
                    }
                } catch (_) {}
            }
        }
    }

    let targetPanel: PanelType | null = null;
    if (path.startsWith('/owner') || path.startsWith('/api/owner/')) {
        targetPanel = 'owner';
    } else if (path.startsWith('/api/admin/') || path.includes('/admin')) {
        targetPanel = 'admin';
    } else if (path.startsWith('/api/waiter/') || path.includes('/waiter')) {
        targetPanel = 'waiter';
    } else if (path.startsWith('/api/kds/') || path.includes('/kds')) {
        targetPanel = 'kds';
    } else if (path.startsWith('/api/delivery/') || path.includes('/delivery')) {
        targetPanel = 'delivery';
    } else if (path.startsWith('/api/staff/') || path.includes('/staff') || path.includes('/employee')) {
        targetPanel = 'employee';
    } else if (subdomain) {
        targetPanel = subdomain;
    }

    // Check Authorization header first (for API calls), then x-dine-token, then fall back to cookies
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    let token: string | null = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim();
    }
    if (!token) {
        const xDine = request.headers.get('x-dine-token');
        if (xDine && xDine.trim()) {
            token = xDine.trim();
        }
    }
    if (!token) {
        token = extractTokenForRestaurant(request.cookies, targetRestaurantCode, targetStaffIdentifier, targetPanel);
        if (!token && targetRestaurantCode) {
            const resolvedTargetCode = await resolveRestaurantCodeToId(targetRestaurantCode);
            if (resolvedTargetCode && resolvedTargetCode !== targetRestaurantCode) {
                token = extractTokenForRestaurant(request.cookies, resolvedTargetCode, targetStaffIdentifier, targetPanel);
            }
        }
    }

    let user = null;
    if (token) {
        user = await verifyJwt(token);
    }

    const isSuperAdmin = user ? (
        (user.role || '').toUpperCase() === 'SUPER_ADMIN' || 
        (user.role || '').toUpperCase() === 'SUPERADMIN'
    ) : false;

    // Login pages across all direct URLs and rewrite targets
    const isLoginPage = (
        path === '/login' ||
        path.startsWith('/login/') ||
        path.startsWith('/register') ||
        /\/(admin|waiter|kds|delivery|employee|superadmin)\/login\/?$/.test(path) ||
        path.endsWith('/login')
    );

    const isAccessDeniedPage = path.startsWith('/access-denied');
    
    if (isAccessDeniedPage) {
        if (request.nextUrl.searchParams.get('reason') === 'unauthenticated') {
            return NextResponse.redirect(new URL('/login', request.url));
        }
        return NextResponse.next();
    }

    // 0c. Root path on subdomains: route unauthenticated to login, or authenticated to panel dashboard
    if (subdomain && subdomain !== 'customer' && (path === '/' || (subdomain === 'kds' && (path === '/kds' || path === '/kds/')))) {
        if (!token || !user) {
            return NextResponse.redirect(new URL('/login', request.url));
        }
        if (!isRoleAuthorizedForPanel(user.role, subdomain)) {
            return NextResponse.redirect(new URL('/access-denied?reason=unauthorized_panel', request.url));
        }
        const cleanMobile = (user.mobile || 'default').replace(/[^0-9]/g, '').slice(-10);
        const dbId = user.deliveryBoyId || user.userId || 'default';
        if (subdomain === 'owner') {
            return NextResponse.redirect(new URL('/owner/dashboard', request.url));
        } else if (subdomain === 'admin') {
            return NextResponse.redirect(new URL(`/${user.restaurantId}/admin/dashboard`, request.url));
        } else if (subdomain === 'waiter') {
            return NextResponse.redirect(new URL(`/${user.restaurantId}/waiter/${cleanMobile}/dashboard`, request.url));
        } else if (subdomain === 'kds') {
            if (!user.restaurantId) {
                return NextResponse.redirect(new URL('/access-denied?reason=missing_restaurant', request.url));
            }
            return NextResponse.redirect(new URL(`/${user.restaurantId}/kds`, request.url));
        } else if (subdomain === 'delivery') {
            return NextResponse.redirect(new URL(`/${user.restaurantId}/delivery/${dbId}/dashboard`, request.url));
        } else if (subdomain === 'employee') {
            const rawRole = String(user.role || '').toLowerCase();
            if (['waiter', 'captain'].includes(rawRole)) {
                return NextResponse.redirect(new URL(`/${user.restaurantId}/waiter/${cleanMobile}/dashboard`, request.url));
            } else if (['chef', 'kitchen'].includes(rawRole)) {
                return NextResponse.redirect(new URL(`/${user.restaurantId}/kds`, request.url));
            } else if (['delivery_boy', 'delivery'].includes(rawRole)) {
                return NextResponse.redirect(new URL(`/${user.restaurantId}/delivery/${dbId}/dashboard`, request.url));
            } else {
                return NextResponse.redirect(new URL(`/${user.restaurantId}/admin/dashboard`, request.url));
            }
        }
    }

    // 0c. Dedicated Owner Panel & API Route Protection
    if (path.startsWith('/api/owner/')) {
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized: Owner authentication required' }, { status: 401 });
        }
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized: Invalid credentials' }, { status: 401 });
        }
        const userRole = String(user.role || '').toLowerCase();
        const isSuper = (user.role || '').toUpperCase() === 'SUPER_ADMIN' || (user.role || '').toUpperCase() === 'SUPERADMIN';
        if (!['owner', 'restaurant_owner'].includes(userRole) && !isSuper) {
            return NextResponse.json({ error: 'Forbidden: Owner permissions required' }, { status: 403 });
        }
    }

    if (path.startsWith('/owner')) {
        if (!token || !user) {
            const redirectUrl = subdomain ? '/login' : '/login/owner';
            return NextResponse.redirect(new URL(redirectUrl, request.url));
        }
        const userRole = String(user.role || '').toLowerCase();
        const isSuper = (user.role || '').toUpperCase() === 'SUPER_ADMIN' || (user.role || '').toUpperCase() === 'SUPERADMIN';
        if (!['owner', 'restaurant_owner'].includes(userRole) && !isSuper) {
            return new NextResponse('Access Denied: Owner permissions required', { status: 403 });
        }
    }

    const isProtectedRoute = !path.startsWith('/api/') && !path.startsWith('/owner') && !isLoginPage && !isAccessDeniedPage && (
        path.includes('/admin') || 
        path.includes('/waiter') || 
        path.includes('/kds') || 
        path.includes('/supervisor') || 
        path.includes('/staff') ||
        path.includes('/delivery') ||
        path.startsWith('/waiting-approval')
    );

    // Old /portal/* routes are no longer valid — redirect to login on subdomain, 404 on apex
    if (path.startsWith('/portal') || path.match(/^\/[^/]+\/portal(\/?|\/.*)$/)) {
        if (subdomain) {
            return NextResponse.redirect(new URL('/login', request.url));
        }
        return new NextResponse(null, { status: 404 });
    }

    // 1. Marketing website isolation:
    // Protected staff/admin panel routes do not exist on the production apex domain.
    // Return 404 to ensure zero exposure of internal panels on the public website.
    if (isProductionMarketingApex && !subdomain && isProtectedRoute) {
        return new NextResponse(null, { status: 404 });
    }

    // Unauthenticated access to protected staff routes:
    if (!token && isProtectedRoute) {
        if (isPrefetch) {
            return new NextResponse(null, { status: 204 });
        }
        const restCode = targetRestaurantCode || segments[0];
        const loginUrl = resolvePanelLoginUrl(path, subdomain, restCode, '');
        const response = NextResponse.redirect(new URL(loginUrl, request.url));
        // Do not clear cookies on unauthenticated access: the user merely lacks a token for this specific panel route
        return response;
    }

    // 1b. Protected API routes check
    const isProtectedApiRoute = (
        (path.startsWith('/api/waiter/') && !path.startsWith('/api/waiter/status')) ||
        (path.startsWith('/api/admin/') && !path.includes('migrate-homepage')) ||
        (path.startsWith('/api/kds/')) ||
        (path.startsWith('/api/delivery/') && !(path.startsWith('/api/delivery/settings') && request.method === 'GET')) ||
        (path.startsWith('/api/staff/') && !path.startsWith('/api/staff/login'))
    );

    if (isProtectedApiRoute && !path.startsWith('/api/auth/')) {
        if (!token) {
            return NextResponse.json({ error: 'Access Denied: Staff authentication required', code: 'UNAUTHENTICATED' }, { status: 401 });
        }
        if (!user) {
            const restCode = targetRestaurantCode || segments[0];
            const loginUrl = resolvePanelLoginUrl(path, subdomain, restCode, 'session_expired');
            const response = NextResponse.json({ error: 'Access Denied: Invalid staff credentials', code: 'SESSION_EXPIRED', loginUrl }, { status: 401 });
            if (!isPrefetch) {
                clearAllAuthCookies(response, request.cookies, restCode);
            }
            return response;
        }
    }

    if (token) {
        const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

        if (!user) {
            // A stale auth cookie must never turn an API request into an HTML
            // redirect. In particular, login requests may arrive with a token
            // signed by a previous secret and need to be allowed to establish
            // a fresh session.
            if (path.startsWith('/api/auth/')) {
                return NextResponse.next();
            }

            // Public Customer Dining Exception:
            // Stale or expired staff/test tokens must NEVER block customer orders or redirect diners to staff login.
            if (isCustomerRoute) {
                const response = NextResponse.next();
                clearAllAuthCookies(response, request.cookies, targetRestaurantCode || segments[0]);
                return response;
            }

            const restCode = targetRestaurantCode || segments[0];

            if (path.startsWith('/api/')) {
                const loginUrl = resolvePanelLoginUrl(path, subdomain, restCode, 'session_expired');
                const response = NextResponse.json(
                    { error: 'Invalid or expired session', code: 'SESSION_EXPIRED', loginUrl },
                    { status: 401 }
                );
                if (!isPrefetch) {
                    clearAllAuthCookies(response, request.cookies, restCode);
                }
                return response;
            }

            if (isPrefetch) {
                return new NextResponse(null, { status: 204 });
            }

            // Token is invalid/expired (session ended). Clear it and redirect to the SAME panel's login page
            const loginUrl = resolvePanelLoginUrl(path, subdomain, restCode, 'session_expired');
            const response = NextResponse.redirect(new URL(loginUrl, request.url));
            clearAllAuthCookies(response, request.cookies, restCode);
            return response;
        }

        // Super Admin user accessing restaurant website: route them to their dedicated portal
        if (isSuperAdmin && (path === '/' || path === '/login' || path === '/register')) {
            const superAdminUrl = process.env.NEXT_PUBLIC_SUPER_ADMIN_URL || 'http://control.localhost:3005';
            return NextResponse.redirect(new URL(superAdminUrl));
        }

        // Map roles for checking (robust normalization across casing and persona aliases)
        const rawRole = String(user.role || '').toLowerCase().trim();
        let mappedRole = rawRole;
        if (['admin', 'restaurant_admin', 'manager', 'branch_admin'].includes(rawRole)) {
            mappedRole = 'restaurant_admin';
        } else if (['owner', 'restaurant_owner'].includes(rawRole)) {
            mappedRole = 'owner';
        } else if (['waiter'].includes(rawRole)) {
            mappedRole = 'waiter';
        } else if (['chef', 'kitchen'].includes(rawRole)) {
            mappedRole = 'kitchen';
        } else if (['supervisor'].includes(rawRole)) {
            mappedRole = 'supervisor';
        } else if (['delivery_boy', 'delivery'].includes(rawRole)) {
            mappedRole = 'delivery_boy';
        }

        // Subdomain Role Check: Ensure user role is authorized for the requested subdomain
        if (subdomain && !isLoginPage && !path.startsWith('/access-denied') && !path.startsWith('/api/auth/')) {
            if (!isRoleAuthorizedForPanel(user.role, subdomain)) {
                if (path.startsWith('/api/')) {
                    return NextResponse.json({ error: 'Access Denied: Unauthorized panel' }, { status: 403 });
                }
                return NextResponse.redirect(new URL('/access-denied?reason=unauthorized_panel', request.url));
            }
        }

        // Target Panel Role Check: Ensure user role is authorized for the target panel (prevents tampering)
        if (targetPanel && !isLoginPage && !path.startsWith('/access-denied') && !path.startsWith('/api/auth/')) {
            if (!isRoleAuthorizedForPanel(user.role, targetPanel as PanelType)) {
                if (path.startsWith('/api/')) {
                    return NextResponse.json({ error: 'Access Denied: Unauthorized panel' }, { status: 403 });
                }
                return NextResponse.redirect(new URL('/access-denied?reason=unauthorized_panel', request.url));
            }
        }

        // Protected API Security & Parameter Tampering Guards
        if (path.startsWith('/api/delivery/')) {
            const isPublicDeliveryGet = path.startsWith('/api/delivery/settings') && request.method === 'GET';
            if (!isPublicDeliveryGet) {
                if (!['delivery_boy', 'restaurant_admin'].includes(mappedRole) && !isSuperAdmin) {
                    return NextResponse.json({ error: 'Access Denied: Unauthorized panel' }, { status: 403 });
                }
            }
        }

        if (path.startsWith('/api/waiter/') || (path.startsWith('/api/admin/') && !path.includes('migrate-homepage'))) {
            if (path.startsWith('/api/waiter/')) {
                if (!['waiter', 'supervisor', 'restaurant_admin'].includes(mappedRole) && !isSuperAdmin) {
                    return NextResponse.json({ error: 'Access Denied: Unauthorized panel' }, { status: 403 });
                }
                const queryMobile = request.nextUrl.searchParams.get('mobile') || request.nextUrl.searchParams.get('staffMobile');
                if (queryMobile && mappedRole === 'waiter') {
                    const cleanQuery = queryMobile.replace(/[^0-9]/g, '').slice(-10);
                    const cleanUser = (user.mobile || '').replace(/[^0-9]/g, '').slice(-10);
                    if (cleanQuery && cleanUser && cleanQuery !== cleanUser) {
                        return NextResponse.json({ error: 'Access Denied: Wrong waiter credentials or invalid staff identity' }, { status: 403 });
                    }
                }
                const queryEmp = request.nextUrl.searchParams.get('employeeId') || request.nextUrl.searchParams.get('employee_id');
                if (queryEmp && mappedRole === 'waiter') {
                    const userEmp = (user.employee_id || user.employeeId || '').toLowerCase();
                    if (userEmp && queryEmp.toLowerCase() !== userEmp) {
                        return NextResponse.json({ error: 'Access Denied: Invalid staff identity' }, { status: 403 });
                    }
                }
            }

            if (path.startsWith('/api/admin/')) {
                if (mappedRole !== 'restaurant_admin' && !isSuperAdmin) {
                    return NextResponse.json({ error: 'Access Denied: Unauthorized panel' }, { status: 403 });
                }
            }

            const queryRest = request.nextUrl.searchParams.get('restaurantId') || request.nextUrl.searchParams.get('restaurantCode');
            if (queryRest && user.restaurantId && !isSuperAdmin) {
                const isDirectMatch = queryRest === user.restaurantId ||
                    queryRest.toLowerCase() === String(user.restaurantId).toLowerCase();

                if (!isDirectMatch) {
                    const resolvedQueryRest = await resolveRestaurantCodeToId(queryRest);
                    const resolvedUserRest = await resolveRestaurantCodeToId(user.restaurantId);
                    if (resolvedQueryRest.toLowerCase() !== resolvedUserRest.toLowerCase()) {
                        return NextResponse.json({ error: 'Access Denied: Invalid restaurant identity. Tenant isolation violation' }, { status: 403 });
                    }
                }
            }
        }

        // Allow access to status page for any authenticated user without restaurant status lock
        if (path.startsWith('/waiting-approval')) {
            return NextResponse.next();
        }

        // Check if the user is suspended/disabled/deleted in the database
        if (isProtectedRoute && !isSuperAdmin) {
            try {
                const nowMs = Date.now();

                // Fetch Restaurant status (cached for 30s)
                let restaurantStatus: string | null = null;
                const rawRestId = user.restaurantId;
                if (rawRestId) {
                    const targetRestId = await resolveRestaurantCodeToId(rawRestId);
                    const cachedRest = restStatusCache.get(targetRestId);
                    if (cachedRest && cachedRest.expiresAt > nowMs) {
                        restaurantStatus = cachedRest.status;
                    } else {
                        const { data: dbRest, error: dbRestError } = await supabaseAdmin
                            .from('restaurants')
                            .select('status, owner_id')
                            .eq('id', targetRestId)
                            .maybeSingle();
                        if (dbRestError) {
                            throw new Error(`Restaurant status validation failed: ${dbRestError.message}`);
                        }
                        if (dbRest) {
                            restaurantStatus = dbRest.status;
                            restStatusCache.set(targetRestId, {
                                status: dbRest.status,
                                ownerId: dbRest.owner_id,
                                expiresAt: nowMs + CACHE_TTL_MS
                            });
                        }
                    }
                }

                // If restaurant is suspended, block immediately
                if (restaurantStatus?.toLowerCase() === 'suspended') {
                    console.warn(`[Security Block] Tenant ${user.restaurantId} is suspended. Denying access to user ${user.userId}.`);
                    logSecurityEventAsync({
                        restaurant_id: user.restaurantId || null,
                        user_id: user.userId,
                        target_user_id: user.userId,
                        actor_id: user.userId,
                        employee_id: user.employee_id || null,
                        action: 'session_forced_logout',
                        ip_address: ip,
                        device: 'unknown',
                        browser: 'unknown',
                        details: { reason: 'restaurant_suspended' }
                    });

                    const response = NextResponse.redirect(new URL('/login?error=restaurant_suspended', request.url));
                    response.cookies.set('dine_auth_token', '', { path: '/', maxAge: 0 });
                    return response;
                }

                // If restaurant is not ACTIVE or approved, block operational panels and redirect to status page
                const isRestaurantActive = !restaurantStatus || ['ACTIVE', 'APPROVED'].includes(restaurantStatus.toUpperCase());
                if (!isRestaurantActive) {
                    return NextResponse.redirect(new URL('/waiting-approval', request.url));
                }

                // Fetch Employee profile along with MFA and Lockout state (cached for 30s)
                let dbUser = null;
                let queryFailed = false;
                const cachedUser = userValidationCache.get(user.userId);
                // Only use cache if it hasn't expired AND the session_version matches the incoming token
                if (cachedUser && cachedUser.expiresAt > nowMs && (!user.sessionVersion || cachedUser.data?.session_version === user.sessionVersion)) {
                    dbUser = cachedUser.data;
                } else {
                    const { data: fetchedUser, error: dbError } = await supabaseAdmin
                        .from('employees')
                        .select(`
                            status, 
                            approval_status, 
                            session_version, 
                            is_deleted,
                            auth:auth(locked_until)
                        `)
                        .eq('id', user.userId)
                        .maybeSingle();

                    if (dbError) {
                        queryFailed = true;
                    }

                    if (!dbError && fetchedUser) {
                        dbUser = fetchedUser;
                        userValidationCache.set(user.userId, {
                            data: fetchedUser,
                            expiresAt: nowMs + CACHE_TTL_MS
                        });
                    } else if (!dbError) {
                        // Fallback check for restaurant owner/admin in users table
                        const { data: fetchedOwner, error: ownerError } = await supabaseAdmin
                            .from('users')
                            .select('status, is_deleted')
                            .eq('id', user.userId)
                            .maybeSingle();
                        if (ownerError) {
                            queryFailed = true;
                        } else if (fetchedOwner) {
                            dbUser = {
                                status: fetchedOwner.status || 'active',
                                approval_status: 'approved',
                                session_version: user.sessionVersion,
                                is_deleted: fetchedOwner.is_deleted,
                                auth: null
                            };
                            userValidationCache.set(user.userId, {
                                data: dbUser,
                                expiresAt: nowMs + CACHE_TTL_MS
                            });
                        }
                    }
                }

                    if (queryFailed) {
                        console.warn('[Middleware] DB validation query encountered a transient error. Permitting request without clearing cookies to prevent false logout.');
                        if (cachedUser?.data) {
                            dbUser = cachedUser.data;
                        } else {
                            return NextResponse.next();
                        }
                    }

                    if (!dbUser && !isSuperAdmin) {
                        console.error(`[Security Block] User ${user.userId} not found in database. Revoking session.`);
                        userValidationCache.delete(user.userId);
                        const restCode = targetRestaurantCode || segments[0];
                        const loginUrl = resolvePanelLoginUrl(path, subdomain, restCode, 'session_expired');
                        const response = path.startsWith('/api/')
                            ? NextResponse.json({ error: 'Staff account not found or session revoked', code: 'SESSION_EXPIRED', loginUrl }, { status: 401 })
                            : NextResponse.redirect(new URL(loginUrl, request.url));
                        clearAllAuthCookies(response, request.cookies, restCode);
                        return response;
                    }

                if (dbUser) {
                    const authData = Array.isArray(dbUser?.auth) ? dbUser.auth[0] : dbUser?.auth;
                    const lockedUntil = authData?.locked_until;
                    const now = new Date();
                    const isLocked = lockedUntil && new Date(lockedUntil) > now;

                    const userStatus = (dbUser.status || '').toLowerCase();
                    const isNewPending = userStatus === 'pending_activation' || userStatus === 'invited' || dbUser.approval_status === 'pending_verification';
                    const isStatusAllowed = !isNewPending && userStatus !== 'inactive' && userStatus !== 'suspended';
                    const isApprovalAllowed = (dbUser.approval_status || '').toLowerCase() !== 'rejected';

                    const isSessionVersionValid = !user.sessionVersion || !dbUser.session_version || user.sessionVersion >= dbUser.session_version;

                    const validations = [
                        isRestaurantActive,
                        isStatusAllowed,
                        isApprovalAllowed,
                        dbUser.is_deleted !== true,
                        isSessionVersionValid,
                        !isLocked
                    ];

                    if (validations.includes(false)) {
                        console.error(`[Security Block] User ${user.userId} failed validation check. Revoking session.`, {
                            status: dbUser.status,
                            approval: dbUser.approval_status,
                            deleted: dbUser.is_deleted,
                            versionMatch: isSessionVersionValid,
                            locked: isLocked
                        });

                        userValidationCache.delete(user.userId);
                        const restCode = targetRestaurantCode || segments[0];

                        // If session version was bumped (session terminated/ended on server):
                        if (!isSessionVersionValid) {
                            const loginUrl = resolvePanelLoginUrl(path, subdomain, restCode, 'session_expired');
                            const response = path.startsWith('/api/')
                                ? NextResponse.json({ error: 'Session expired due to login on another device', code: 'SESSION_EXPIRED', loginUrl }, { status: 401 })
                                : NextResponse.redirect(new URL(loginUrl, request.url));
                            clearAllAuthCookies(response, request.cookies, restCode);
                            return response;
                        }

                        // If account was soft-deleted:
                        if (dbUser.is_deleted === true) {
                            const loginUrl = resolvePanelLoginUrl(path, subdomain, restCode, 'session_expired');
                            const response = path.startsWith('/api/')
                                ? NextResponse.json({ error: 'Staff account has been deleted', code: 'SESSION_EXPIRED', loginUrl }, { status: 401 })
                                : NextResponse.redirect(new URL(loginUrl, request.url));
                            clearAllAuthCookies(response, request.cookies, restCode);
                            return response;
                        }

                        const reason = isNewPending || !isStatusAllowed || !isApprovalAllowed
                            ? 'account_inactive'
                            : 'invalid_staff_identity';

                        const response = NextResponse.redirect(new URL(`/access-denied?reason=${reason}`, request.url));
                        clearAllAuthCookies(response, request.cookies, restCode);
                        return response;
                    }
                }
            } catch (err) {
                console.warn('Database validation in middleware encountered a transient error:', err);
                return NextResponse.next();
            }
        }

        // 2. Allow users to freely access /login and /register to switch accounts or register new restaurants
        // (Previously forced redirect trapped users in their existing restaurant session)


        // 3. Panel Access & Restaurant Code Validation for Protected Routes
        if (isProtectedRoute && !path.startsWith('/owner')) {
            const segments = path.split('/').filter(Boolean);
            const restaurantCode = segments[0];
            const nextSegment = segments[1];

            const isTenantScopedPath = segments.length > 0 && restaurantCode !== 'owner' && (
                /^\d+$/.test(restaurantCode) || 
                /^(REST|PEND)-/i.test(restaurantCode) ||
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(restaurantCode) ||
                ['admin', 'waiter', 'kds', 'supervisor', 'staff', 'delivery'].includes(nextSegment || '')
            );

            if (isTenantScopedPath) {
                let panel = null;
                const panels = ['admin', 'waiter', 'kds', 'supervisor', 'staff', 'delivery'];
                
                if (panels.includes(nextSegment)) {
                    panel = nextSegment;
                } else if (segments.length > 2 && panels.includes(segments[2])) {
                    panel = segments[2];
                }

                // Subdomain to panel binding enforcement:
                // Ensures panels can ONLY be accessed through their assigned subdomain.
                if (subdomain && panel && subdomain !== 'owner') {
                    const isSubdomainAllowed = (
                        subdomain === 'superadmin' ||
                        (subdomain === 'admin' && (panel === 'admin' || panel === 'supervisor')) ||
                        (subdomain === 'waiter' && panel === 'waiter') ||
                        (subdomain === 'kds' && panel === 'kds') ||
                        (subdomain === 'delivery' && panel === 'delivery') ||
                        (subdomain === 'employee' && ['waiter', 'kds', 'delivery', 'staff', 'supervisor'].includes(panel))
                    );
                    if (!isSubdomainAllowed) {
                        console.warn(`[Security Block] Panel ${panel} is not accessible on subdomain ${subdomain}`);
                        return NextResponse.redirect(new URL('/access-denied?reason=unauthorized_panel', request.url));
                    }
                }

                // Super Admin has global inspection access to all restaurant panels
                if (isSuperAdmin) {
                    return NextResponse.next();
                }

                // 1. Validate restaurant scope matching user profile (CHANGED RESTAURANT ID)
                if (user.restaurantId) {
                    const isDirectMatch = restaurantCode === user.restaurantId || 
                        restaurantCode.toLowerCase() === String(user.restaurantId).toLowerCase();

                    if (!isDirectMatch) {
                        const resolvedTargetId = await resolveRestaurantCodeToId(restaurantCode);
                        const resolvedUserRestId = await resolveRestaurantCodeToId(user.restaurantId);

                        const isResolvedMatch = resolvedTargetId.toLowerCase() === resolvedUserRestId.toLowerCase();

                        if (!isResolvedMatch) {
                            const nowMs = Date.now();
                            let cachedRest = restStatusCache.get(resolvedTargetId);
                            if (!cachedRest || cachedRest.expiresAt <= nowMs) {
                                const { data: dbRest } = await supabaseAdmin
                                    .from('restaurants')
                                    .select('status, owner_id')
                                    .eq('id', resolvedTargetId)
                                    .maybeSingle();
                                if (dbRest) {
                                    cachedRest = {
                                        status: dbRest.status,
                                        ownerId: dbRest.owner_id,
                                        expiresAt: nowMs + CACHE_TTL_MS
                                    };
                                    restStatusCache.set(resolvedTargetId, cachedRest);
                                }
                            }
                            const isOwner = cachedRest?.ownerId === user.userId;
                            if (!isOwner) {
                                console.error(`[Security Block] Tenant mismatch: User from restaurant ${user.restaurantId} (${resolvedUserRestId}) tried accessing ${restaurantCode} (${resolvedTargetId})`);
                                logSecurityEventAsync({
                                    restaurant_id: user.restaurantId || null,
                                    user_id: user.userId,
                                    actor_id: user.userId,
                                    action: 'tenant_tamper_blocked',
                                    ip_address: ip,
                                    device: 'unknown',
                                    browser: 'unknown',
                                    details: { attempted_restaurant: restaurantCode, resolved_attempted: resolvedTargetId, user_restaurant: user.restaurantId }
                                });
                                return NextResponse.redirect(new URL('/access-denied?reason=invalid_restaurant', request.url));
                            }
                        }
                    }
                }

                // Helper: Is user an authorized restaurant admin
                const isAdminAuthorized = mappedRole === 'restaurant_admin' || 
                    ['admin', 'restaurant_admin', 'branch_admin', 'manager'].includes(rawRole);

                // 2. Role validation for Admin panel: restaurant_admin only
                if (panel === 'admin' && !isAdminAuthorized) {
                    console.warn(`[Security Block] User ${user.userId} with role ${mappedRole} attempted to access Admin panel`);
                    return NextResponse.redirect(new URL('/access-denied?reason=unauthorized_panel', request.url));
                }

                // Role validation for Supervisor panel: supervisor or restaurant_admin
                if (panel === 'supervisor' && mappedRole !== 'supervisor' && !isAdminAuthorized) {
                    console.warn(`[Security Block] User ${user.userId} with role ${mappedRole} attempted to access Supervisor panel`);
                    return NextResponse.redirect(new URL('/access-denied?reason=unauthorized_panel', request.url));
                }

                // Role validation for KDS (Kitchen) panel: kitchen, supervisor, or restaurant_admin
                if (panel === 'kds' && mappedRole !== 'kitchen' && mappedRole !== 'supervisor' && !isAdminAuthorized) {
                    console.warn(`[Security Block] User ${user.userId} with role ${mappedRole} attempted to access KDS panel`);
                    return NextResponse.redirect(new URL('/access-denied?reason=unauthorized_panel', request.url));
                }

                // Role validation for Waiter panel: waiter, supervisor, or restaurant_admin
                if (panel === 'waiter') {
                    if (mappedRole !== 'waiter' && mappedRole !== 'supervisor' && !isAdminAuthorized) {
                        console.warn(`[Security Block] User ${user.userId} with role ${mappedRole} attempted to access Waiter panel`);
                        return NextResponse.redirect(new URL('/access-denied?reason=unauthorized_panel', request.url));
                    }

                    // 3. Waiter URL Parameter Tampering Defense (CHANGED MOBILE NUMBER OR EMPLOYEE ID)
                    // If the user changed the mobile number or employee ID parameter in the URL:
                    // DO NOT redirect back to the original URL!
                    // DO NOT silently restore the correct URL!
                    // Immediately show the security error page:
                    if (mappedRole === 'waiter' && segments.length > 2) {
                        const targetParam = segments[2];
                        const cleanTarget = targetParam.replace(/[^0-9]/g, '').slice(-10);
                        const cleanUserMobile = (user.mobile || '').replace(/[^0-9]/g, '').slice(-10);
                        const userEmpId = (user.employee_id || user.employeeId || '').toLowerCase();

                        const matchesMobile = cleanTarget && cleanUserMobile && cleanTarget === cleanUserMobile;
                        const matchesEmpId = userEmpId && targetParam.toLowerCase() === userEmpId;

                        if (targetParam !== 'default' && !matchesMobile && !matchesEmpId) {
                            console.warn(`[Security Tamper Block] Waiter ${user.userId} attempted URL tampering with identity: ${targetParam}`);
                            logSecurityEventAsync({
                                restaurant_id: user.restaurantId || null,
                                user_id: user.userId,
                                actor_id: user.userId,
                                action: 'url_tamper_blocked',
                                ip_address: ip,
                                device: 'unknown',
                                browser: 'unknown',
                                details: { attempted_param: targetParam, user_mobile: cleanUserMobile, user_emp_id: userEmpId }
                            });

                            return NextResponse.redirect(new URL('/access-denied?reason=wrong_waiter_credentials', request.url));
                        }
                    }
                }

                // Role validation for Staff panel
                if (panel === 'staff') {
                    if (!['waiter', 'kitchen', 'supervisor', 'restaurant_admin'].includes(mappedRole) && !isAdminAuthorized) {
                        return NextResponse.redirect(new URL('/access-denied?reason=unauthorized_panel', request.url));
                    }
                    if (segments.length > 2) {
                        const targetParam = segments[2];
                        const cleanTarget = targetParam.replace(/[^0-9]/g, '').slice(-10);
                        const cleanUserMobile = (user.mobile || '').replace(/[^0-9]/g, '').slice(-10);
                        const userEmpId = (user.employee_id || user.employeeId || '').toLowerCase();

                        const matchesMobile = cleanTarget && cleanUserMobile && cleanTarget === cleanUserMobile;
                        const matchesEmpId = userEmpId && targetParam.toLowerCase() === userEmpId;

                        if (targetParam !== 'default' && !matchesMobile && !matchesEmpId) {
                            return NextResponse.redirect(new URL('/access-denied?reason=invalid_staff_identity', request.url));
                        }
                    }
                }

                // Role validation for Delivery panel: delivery_boy or restaurant_admin
                if (panel === 'delivery') {
                    if (mappedRole !== 'delivery_boy' && !isAdminAuthorized) {
                        console.warn(`[Security Block] User ${user.userId} with role ${mappedRole} attempted to access Delivery panel`);
                        return NextResponse.redirect(new URL('/access-denied?reason=unauthorized_panel', request.url));
                    }
                    if (mappedRole === 'delivery_boy' && segments.length > 2) {
                        const targetParam = segments[2];
                        const userDeliveryBoyId = (user.deliveryBoyId || '').toLowerCase();
                        const userEmpId = (user.employee_id || user.employeeId || '').toLowerCase();
                        const userUserId = (user.userId || '').toLowerCase();
                        const cleanTarget = targetParam.replace(/[^0-9]/g, '').slice(-10);
                        const cleanUserMobile = (user.mobile || '').replace(/[^0-9]/g, '').slice(-10);

                        const matchesId = userDeliveryBoyId && targetParam.toLowerCase() === userDeliveryBoyId;
                        const matchesEmpId = userEmpId && targetParam.toLowerCase() === userEmpId;
                        const matchesUserId = userUserId && targetParam.toLowerCase() === userUserId;
                        const matchesMobile = cleanTarget.length >= 10 && cleanUserMobile.length >= 10 && cleanTarget === cleanUserMobile;

                        if (targetParam !== 'default' && targetParam !== 'login' && !matchesId && !matchesEmpId && !matchesUserId && !matchesMobile) {
                            console.warn(`[Security Tamper Block] Delivery boy ${user.userId} attempted URL tampering with identity: ${targetParam}`);
                            return NextResponse.redirect(new URL('/access-denied?reason=invalid_staff_identity', request.url));
                        }
                    }
                }
            }
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|api/public|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mp4|webm|mov|mp3|woff|woff2|ttf|eot)$).*)',
    ],
};
