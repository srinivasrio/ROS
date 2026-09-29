import { NextResponse, type NextRequest } from 'next/server';
import { verifyJwt, extractTokenForRestaurant } from './lib/jwt-utils';
import { supabaseAdmin } from './lib/supabase-admin';

// Fast in-memory cache to prevent blocking DB roundtrips on every subrequest / refresh
const restStatusCache = new Map<string, { status: string | null; ownerId: string | null; expiresAt: number }>();
const userValidationCache = new Map<string, { data: any; expiresAt: number }>();
const slugResolutionCache = new Map<string, { id: string; expiresAt: number }>();
const CACHE_TTL_MS = 30000; // 30 seconds

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
    // Super Admin is now a standalone website on Port 3005
    if (path.startsWith('/super-admin')) {
        const superAdminUrl = process.env.NEXT_PUBLIC_SUPER_ADMIN_URL || 'http://localhost:3005';
        return NextResponse.redirect(new URL(superAdminUrl));
    }

    // 0. Extract target restaurant scope from path or search params (enables multi-tab multi-tenant sessions)
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

    let targetPanel: string | null = null;
    if (path.startsWith('/api/admin/') || path.includes('/admin')) {
        targetPanel = 'admin';
    } else if (path.startsWith('/api/waiter/') || path.includes('/waiter')) {
        targetPanel = 'waiter';
    } else if (path.includes('/kds')) {
        targetPanel = 'kds';
    } else if (path.includes('/supervisor')) {
        targetPanel = 'supervisor';
    } else if (path.includes('/delivery')) {
        targetPanel = 'delivery';
    } else if (path.includes('/staff')) {
        targetPanel = 'staff';
    }

    // Check Authorization header first (for API calls), then fall back to cookies
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    let token: string | null = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim();
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
        (user.role || '').toUpperCase() === 'SUPERADMIN' || 
        user.email === 'superadmin@dineinone.com'
    ) : false;

    // Exclude public routes and access denied page
    const isWaiterLoginPage = /\/waiter\/login\/?$/.test(path);
    const isDeliveryLoginPage = /\/delivery\/login\/?$/.test(path);
    const isAccessDeniedPage = path.startsWith('/access-denied');
    
    if (isAccessDeniedPage) {
        if (request.nextUrl.searchParams.get('reason') === 'unauthenticated') {
            return NextResponse.redirect(new URL('/login', request.url));
        }
        return NextResponse.next();
    }

    const isProtectedRoute = !path.startsWith('/api/') && !isWaiterLoginPage && !isDeliveryLoginPage && (
        path.includes('/admin') || 
        path.includes('/waiter') || 
        path.includes('/kds') || 
        path.includes('/supervisor') || 
        path.includes('/staff') ||
        path.includes('/delivery') ||
        path.startsWith('/waiting-approval')
    );

    // Old /portal/* routes are no longer valid — redirect to login
    if (path.startsWith('/portal') || path.match(/^\/[^/]+\/portal(\/?|\/.*)$/)) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    const isLoginPage = path === '/login' || path === '/register';

    // 1. Unauthenticated access to protected staff routes
    if (!token && isProtectedRoute) {
        if (path.includes('/waiter')) {
            const segments = path.split('/').filter(Boolean);
            const restCode = segments[0];
            if (restCode && restCode !== 'login') {
                return NextResponse.redirect(new URL(`/${restCode}/waiter/login`, request.url));
            }
            return NextResponse.redirect(new URL('/login', request.url));
        }
        if (path.includes('/delivery')) {
            const segments = path.split('/').filter(Boolean);
            const restCode = segments[0];
            if (restCode && restCode !== 'login') {
                return NextResponse.redirect(new URL(`/${restCode}/delivery/login`, request.url));
            }
            return NextResponse.redirect(new URL('/login', request.url));
        }
        // Admin, KDS, supervisor, and all other staff panels redirect to unified staff/admin login
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // 1b. Protected API routes check
    if ((path.startsWith('/api/waiter/') && !path.startsWith('/api/waiter/status')) || (path.startsWith('/api/admin/') && !path.includes('migrate-homepage'))) {
        if (!token) {
            return NextResponse.json({ error: 'Access Denied: Staff authentication required' }, { status: 401 });
        }
        if (!user) {
            return NextResponse.json({ error: 'Access Denied: Invalid staff credentials' }, { status: 401 });
        }
    }

    if (token) {
        const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

        if (!user) {
            // Token is invalid/expired (session ended). Clear it and redirect to appropriate login page
            const segments = path.split('/').filter(Boolean);
            const restCode = segments[0];

            let redirectUrl = '/login?error=session_expired';
            if (path.includes('/waiter')) {
                if (restCode && restCode !== 'login') {
                    redirectUrl = `/${restCode}/waiter/login?error=session_expired`;
                } else {
                    redirectUrl = '/login?error=session_expired';
                }
            } else if (path.includes('/delivery')) {
                if (restCode && restCode !== 'login') {
                    redirectUrl = `/${restCode}/delivery/login?error=session_expired`;
                } else {
                    redirectUrl = '/login?error=session_expired';
                }
            } else if (path.includes('/admin')) {
                redirectUrl = '/login?error=session_expired';
            }

            const response = NextResponse.redirect(new URL(redirectUrl, request.url));
            response.cookies.set('dine_auth_token', '', { path: '/', maxAge: 0 });
            if (targetRestaurantCode) {
                const cleanRid = String(targetRestaurantCode).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
                response.cookies.set(`dine_auth_token_${cleanRid}`, '', { path: '/', maxAge: 0 });
            }
            if (restCode && restCode !== 'login') {
                const cleanRid = String(restCode).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
                response.cookies.set(`dine_auth_token_${cleanRid}`, '', { path: '/', maxAge: 0 });
            }
            return response;
        }

        // Super Admin user accessing restaurant website: route them to their dedicated portal
        if (isSuperAdmin && (path === '/' || path === '/login' || path === '/register')) {
            const superAdminUrl = process.env.NEXT_PUBLIC_SUPER_ADMIN_URL || 'http://localhost:3005';
            return NextResponse.redirect(new URL(superAdminUrl));
        }

        // Map roles for checking (robust normalization across casing and persona aliases)
        const rawRole = String(user.role || '').toLowerCase().trim();
        let mappedRole = rawRole;
        if (['admin', 'restaurant_admin', 'owner', 'restaurant_owner', 'manager'].includes(rawRole)) {
            mappedRole = 'restaurant_admin';
        } else if (['waiter'].includes(rawRole)) {
            mappedRole = 'waiter';
        } else if (['chef', 'kitchen'].includes(rawRole)) {
            mappedRole = 'kitchen';
        } else if (['supervisor'].includes(rawRole)) {
            mappedRole = 'supervisor';
        } else if (['delivery_boy', 'delivery'].includes(rawRole)) {
            mappedRole = 'delivery_boy';
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
                        const { data: dbRest } = await supabaseAdmin
                            .from('restaurants')
                            .select('status, owner_id')
                            .eq('id', targetRestId)
                            .maybeSingle();
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
                    await supabaseAdmin.from('audit_logs').insert({
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

                if (!dbUser && !isSuperAdmin && !queryFailed) {
                    console.error(`[Security Block] User ${user.userId} not found in database. Revoking session.`);
                    userValidationCache.delete(user.userId);
                    const response = NextResponse.redirect(new URL('/access-denied?reason=invalid_staff_identity', request.url));
                    response.cookies.set('dine_auth_token', '', { path: '/', maxAge: 0 });
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

                        // If session version was bumped (session terminated/ended on server):
                        if (!isSessionVersionValid) {
                            const restSegments = path.split('/').filter(Boolean);
                            const restCode = restSegments[0];
                            let redirectUrl = '/login?error=session_expired';
                            if (path.includes('/waiter') && restCode && restCode !== 'login') {
                                redirectUrl = `/${restCode}/waiter/login?error=session_expired`;
                            } else if (path.includes('/delivery') && restCode && restCode !== 'login') {
                                redirectUrl = `/${restCode}/delivery/login?error=session_expired`;
                            }
                            const response = NextResponse.redirect(new URL(redirectUrl, request.url));
                            response.cookies.set('dine_auth_token', '', { path: '/', maxAge: 0 });
                            if (targetRestaurantCode) {
                                const cleanRid = String(targetRestaurantCode).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
                                response.cookies.set(`dine_auth_token_${cleanRid}`, '', { path: '/', maxAge: 0 });
                            }
                            return response;
                        }

                        const reason = isNewPending || !isStatusAllowed || !isApprovalAllowed
                            ? 'account_inactive'
                            : 'invalid_staff_identity';

                        const response = NextResponse.redirect(new URL(`/access-denied?reason=${reason}`, request.url));
                        response.cookies.set('dine_auth_token', '', { path: '/', maxAge: 0 });
                        return response;
                    }
                }
            } catch (err) {
                console.warn('Database validation in middleware skipped due to network/db latency:', err);
                // Do not aggressively kill session on transient error
            }
        }

        // 2. Allow users to freely access /login and /register to switch accounts or register new restaurants
        // (Previously forced redirect trapped users in their existing restaurant session)


        // 3. Panel Access & Restaurant Code Validation for Protected Routes
        if (isProtectedRoute) {
            const segments = path.split('/').filter(Boolean);
            const restaurantCode = segments[0];
            const nextSegment = segments[1];

            const isTenantScopedPath = segments.length > 0 && (
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
                                await supabaseAdmin.from('audit_logs').insert({
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

                // Helper: Is user an authorized restaurant admin / owner
                const isAdminAuthorized = mappedRole === 'restaurant_admin' || 
                    ['admin', 'restaurant_admin', 'owner', 'restaurant_owner'].includes(rawRole);

                // 2. Role validation for Admin panel: restaurant_admin / owner only (CHANGED PANEL)
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
                            await supabaseAdmin.from('audit_logs').insert({
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
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
