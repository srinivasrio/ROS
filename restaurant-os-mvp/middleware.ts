import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const path = request.nextUrl.pathname

    // 1. Identify if the route is protected
    // Support both old URLs (/admin) and new tenant-scoped URLs (/[id]/admin)
    const isProtectedRoute = path.includes('/admin') || 
                             path.includes('/waiter') || 
                             path.includes('/kds') || 
                             path.includes('/manager') || 
                             path.startsWith('/portal') || 
                             path.startsWith('/waiting-approval');

    if (!user && isProtectedRoute) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    if (user) {
        // 2. Fetch user role and approval status
        const { data: profile } = await supabase
            .from('users')
            .select('role, is_approved, restaurant_id, branch_id')
            .eq('id', user.id)
            .single()

        if (profile) {
            const isAuthOrWaitingPage = path === '/login' || path === '/register' || path === '/waiting-approval' || path === '/';
            
            // Check if user is trying to access OLD root paths and redirect to tenant-scoped paths
            if (profile.restaurant_id) {
                if (path.startsWith('/admin')) {
                    return NextResponse.redirect(new URL(`/${profile.restaurant_id}${path}`, request.url));
                }
                if (path.startsWith('/waiter')) {
                    return NextResponse.redirect(new URL(`/${profile.restaurant_id}${path}`, request.url));
                }
                if (path.startsWith('/kitchen') || path.startsWith('/kds')) {
                    const newPath = path.replace(/^\/kitchen/, '/kds');
                    return NextResponse.redirect(new URL(`/${profile.restaurant_id}${newPath}`, request.url));
                }
                if (path.startsWith('/manager')) {
                    return NextResponse.redirect(new URL(`/${profile.restaurant_id}${path}`, request.url));
                }
            }

            if (profile.is_approved) {
                if (isAuthOrWaitingPage) {
                    return NextResponse.redirect(new URL('/portal', request.url));
                }
            } else {
                // Not approved - redirect away from login/register/portal to waiting
                if (path === '/login' || path === '/register' || path.startsWith('/portal')) {
                    return NextResponse.redirect(new URL('/waiting-approval', request.url));
                }
            }

            // 3. SaaS Admin redirection
            if (profile.role === 'saas_admin') {
                // Future saas-admin logic
            }

            // 4. Restaurant Admin approval check
            if (profile.role === 'restaurant_admin' && !profile.is_approved) {
                if (isProtectedRoute && !path.startsWith('/waiting-approval')) {
                    return NextResponse.redirect(new URL('/waiting-approval', request.url))
                }
            }

            // 5. Global Context & Multi-Branch Validation
            const segments = path.split('/').filter(Boolean);
            const restaurantCode = segments[0];
            const nextSegment = segments[1];
            
            const isTenantScopedPath = segments.length > 0 && (
                /^\d+$/.test(restaurantCode) || 
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(restaurantCode)
            );

            if (isTenantScopedPath) {
                // Determine if the next segment is a branch code or a panel
                const panels = ['admin', 'waiter', 'kds', 'manager', 'menu', 'order'];
                let branchCode = null;
                let panel = null;

                if (panels.includes(nextSegment)) {
                    panel = nextSegment;
                } else if (segments.length > 2 && panels.includes(segments[2])) {
                    branchCode = nextSegment;
                    panel = segments[2];
                }

                // A. Validate Restaurant Ownership
                if (profile.restaurant_id && restaurantCode !== profile.restaurant_id && profile.role !== 'saas_admin') {
                    console.error('Context Mismatch: Restaurant Access Denied');
                    return NextResponse.redirect(new URL('/portal', request.url));
                }

                // B. Validate Branch Access (if applicable)
                if (branchCode && profile.branch_id && branchCode !== profile.branch_id) {
                    console.error('Context Mismatch: Branch Access Denied');
                    return NextResponse.redirect(new URL('/portal', request.url));
                }

                // C. Panel Access Validation
                if (panel === 'admin' && profile.role !== 'restaurant_admin') {
                    return NextResponse.redirect(new URL('/portal', request.url));
                }
                if (panel === 'waiter' && !['restaurant_admin', 'waiter', 'manager'].includes(profile.role)) {
                    return NextResponse.redirect(new URL('/portal', request.url));
                }
                // ... other panel checks
            }
        } else {
            // No profile found
            if (isProtectedRoute && !path.startsWith('/register')) {
                return NextResponse.redirect(new URL('/register', request.url))
            }
        }
    }

    return supabaseResponse
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
