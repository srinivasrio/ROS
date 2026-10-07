import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt, extractTokenForRestaurant } from '@/lib/jwt-utils';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: Request) {
    try {
        const isHttps = request.url.startsWith('https://') || request.headers.get('x-forwarded-proto') === 'https';
        const isSecure = process.env.NODE_ENV === 'production' && isHttps;

        let targetRest: string | null = null;
        let targetStaff: string | null = null;
        let targetPanel: string | null = null;
        try {
            const url = new URL(request.url);
            targetRest = url.searchParams.get('restaurantId') || url.searchParams.get('restaurantCode') || request.headers.get('x-restaurant-id') || null;
            targetStaff = url.searchParams.get('staffMobile') || url.searchParams.get('mobile') || url.searchParams.get('employee_id') || null;
            targetPanel = url.searchParams.get('panel') || request.headers.get('x-panel') || null;
        } catch (_) {}

        if (!targetPanel) {
            const referer = request.headers.get('referer');
            if (referer) {
                try {
                    const refUrl = new URL(referer);
                    const refPath = refUrl.pathname.toLowerCase();
                    if (refPath.startsWith('/owner') || refPath.includes('/owner')) targetPanel = 'owner';
                    else if (refPath.includes('/admin')) targetPanel = 'admin';
                    else if (refPath.includes('/waiter')) targetPanel = 'waiter';
                    else if (refPath.includes('/kds') || refPath.includes('/kitchen')) targetPanel = 'kds';
                    else if (refPath.includes('/delivery')) targetPanel = 'delivery';
                    else if (refPath.includes('/employee') || refPath.includes('/staff')) targetPanel = 'employee';
                } catch (_) {}
            }
        }

        const cookieStore = await cookies();
        let token = extractTokenForRestaurant(cookieStore, targetRest, targetStaff, targetPanel);

        if (!token) {
            const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.slice(7).trim();
            }
            if (!token) {
                const xDine = request.headers.get('x-dine-token');
                if (xDine && xDine.trim()) {
                    token = xDine.trim();
                }
            }
        }

        if (!token) {
            return NextResponse.json({ authenticated: false }, { status: 200 });
        }

        const payload = await verifyJwt(token);
        if (!payload) {
            return NextResponse.json({ authenticated: false }, { status: 200 });
        }

        const normalizedRole = (payload.role || '').toLowerCase().trim();
        const isOwner = ['owner', 'restaurant_owner', 'super_admin', 'superadmin'].includes(normalizedRole);

        const clearAuthCookies = () => {
            const opts = {
                httpOnly: true,
                secure: isSecure,
                sameSite: 'lax' as const,
                path: '/',
                maxAge: 0
            };
            cookieStore.set('dine_auth_token', '', opts);
            if (isOwner) {
                cookieStore.set('dine_auth_token_owner', '', opts);
            } else {
                cookieStore.set('dine_auth_token_admin', '', opts);
            }
            if (targetRest) {
                const clean = String(targetRest).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
                cookieStore.set(`dine_auth_token_${clean}`, '', opts);
                if (isOwner) {
                    cookieStore.set(`dine_auth_token_${clean}_owner`, '', opts);
                } else {
                    cookieStore.set(`dine_auth_token_${clean}_admin`, '', opts);
                }
            }
        };

        // Validate session state in DB
        if (payload.sessionId) {
            const { data: session, error } = await supabaseAdmin
                .from('dine_sessions')
                .select('is_active')
                .eq('id', payload.sessionId)
                .maybeSingle();

            // Invalidate cookie if session in DB was explicitly revoked/deactivated
            if (!error && session && session.is_active === false) {
                clearAuthCookies();
                return NextResponse.json({ authenticated: false, error: 'Session was revoked' }, { status: 200 });
            }

            // For non-owner staff, if session is missing, invalidate
            if (!isOwner && !error && !session) {
                clearAuthCookies();
                return NextResponse.json({ authenticated: false, error: 'Session does not exist' }, { status: 200 });
            }

            // Update session last activity in the background
            if (session && session.is_active) {
                supabaseAdmin
                    .from('dine_sessions')
                    .update({ last_activity: new Date().toISOString() })
                    .eq('id', payload.sessionId)
                    .then(({ error: updateErr }) => {
                        if (updateErr) console.error('Failed to update session activity:', updateErr);
                    });
            }
        }

        // Validate that employee account is explicitly active and not deleted
        let dbBranchId: string | null = null;
        let dbBranchName: string | null = null;
        let emp: any = null;
        if (payload.userId) {
            const { data: empData } = await supabaseAdmin
                .from('employees')
                .select('status, approval_status, is_deleted, session_version, branch_id, internal_id, employee_code, mobile, phone_normalized')
                .eq('id', payload.userId)
                .maybeSingle();

            emp = empData;
            if (emp) {
                dbBranchId = emp.branch_id || null;
                const isNotActive = emp.is_deleted || emp.status !== 'active' || emp.approval_status !== 'approved';
                const versionMismatch = payload.sessionVersion && emp.session_version && payload.sessionVersion < emp.session_version;
                // Only enforce staff deactivation checks on non-owners (owners are managed via users table)
                if (!isOwner && (isNotActive || versionMismatch)) {
                    clearAuthCookies();
                    return NextResponse.json({ authenticated: false, error: 'Staff account is inactive or session has been revoked' }, { status: 200 });
                }
            }
        }

        const effectiveRestId = payload.restaurantId || payload.restaurant_id || null;

        // Enforce that restaurant must be active and not deleted for restaurant-level staff roles (NOT for Owners/Superadmins)
        if (effectiveRestId && !isOwner) {
            const { data: restRec } = await supabaseAdmin
                .from('restaurants')
                .select('id, status, deleted_at')
                .eq('id', effectiveRestId)
                .maybeSingle();

            if (!restRec || restRec.deleted_at || (restRec.status || '').toLowerCase() !== 'active') {
                clearAuthCookies();
                return NextResponse.json({ authenticated: false, error: 'Restaurant is not active or has been deactivated/deleted' }, { status: 200 });
            }
        }

        const effectiveBranchId = dbBranchId || payload.branchId || payload.branch_id || null;
        if (effectiveBranchId) {
            const { data: bRec } = await supabaseAdmin
                .from('branches')
                .select('name, status, deleted_at')
                .eq('id', effectiveBranchId)
                .maybeSingle();

            if (bRec) {
                // If branch is deleted or inactive and role is branch-bound, invalidate session
                if ((bRec.deleted_at || (bRec.status || '').toLowerCase() !== 'active') && !isOwner) {
                    clearAuthCookies();
                    return NextResponse.json({ authenticated: false, error: 'Assigned branch is not active or has been deactivated/deleted' }, { status: 200 });
                }
                dbBranchName = bRec.name;
            }
        }

        return NextResponse.json({
            authenticated: true,
            token,
            user: {
                id: payload.userId,
                internal_id: emp?.internal_id || payload.internalId || null,
                employee_code: emp?.employee_code || null,
                name: payload.name,
                role: payload.role,
                employee_id: payload.employeeId || null,
                email: payload.email || null,
                mobile: emp?.mobile || payload.mobile || null,
                phone_normalized: emp?.phone_normalized || null,
                restaurant_id: payload.restaurantId || null,
                branch_id: effectiveBranchId,
                branchId: effectiveBranchId,
                branch_name: dbBranchName || payload.branchName || null
            }
        });
    } catch (error) {
        console.error('Session API error:', error);
        return NextResponse.json({ authenticated: false }, { status: 200 });
    }
}
