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
        const auth = await getAuthenticatedOwner(req);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized: Owner authentication required' }, { status: 401 });
        }

        const authenticatedRole = String(auth.role || '').toLowerCase().trim();
        const isSuperAdmin = authenticatedRole === 'super_admin' || authenticatedRole === 'superadmin';
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

        // Owners and restaurant admins may only refresh access for a restaurant
        // already associated with their authenticated session.
        if (!isSuperAdmin && !(auth.restaurantIds || []).includes(requestedRestaurantId)) {
            return NextResponse.json({ error: 'Forbidden: Restaurant access denied' }, { status: 403 });
        }

        let sessionUser = {
            userId: auth.userId,
            name: auth.name || 'Restaurant Owner',
            email: auth.email || '',
            role: auth.role || 'owner',
            restaurantId: requestedRestaurantId,
        };

        // A super admin may intentionally enter a restaurant's owner panel, but
        // the target identity must still be a real owner/admin employee. Never
        // fall back to an arbitrary employee or a hard-coded identity.
        if (isSuperAdmin) {
            const { data: ownerEmp } = await supabaseAdmin
                .from('employees')
                .select('id, name, email, role, restaurant_id')
                .eq('restaurant_id', requestedRestaurantId)
                .in('role', ['admin', 'restaurant_admin', 'owner', 'restaurant_owner'])
                .limit(1)
                .maybeSingle();

            if (!ownerEmp) {
                return NextResponse.json({ error: 'Forbidden: No owner account exists for this restaurant' }, { status: 403 });
            }

            sessionUser = {
                userId: ownerEmp.id,
                name: ownerEmp.name || 'Restaurant Owner',
                email: ownerEmp.email || '',
                role: ownerEmp.role || 'owner',
                restaurantId: ownerEmp.restaurant_id || requestedRestaurantId,
            };
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
        }, 3600 * 12); // 12 hours

        const isHttps = req.nextUrl?.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
        const cookieOpts = getAuthCookieOptions(isHttps);

        const host = req.headers.get('host') || 'localhost:3000';
        const protocol = isHttps ? 'https' : 'http';
        const targetUrl = new URL('/owner/dashboard', `${protocol}://${host}`);
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
            userId: auth.userId,
            employeeId: isSuperAdmin ? sessionUser.userId : undefined,
            action: 'owner_quick_access_login',
            ip: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1',
            details: {
                panel: 'owner',
                method: 'quick_access',
                delegated_by_super_admin: isSuperAdmin,
                target_user_id: sessionUser.userId,
            }
        });

        return response;
    } catch (err: any) {
        console.error('[Owner Quick Access] Error:', err);
        return NextResponse.json({ error: 'Failed to authenticate owner session' }, { status: 500 });
    }
}
