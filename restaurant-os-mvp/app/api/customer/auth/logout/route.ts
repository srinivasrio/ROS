import { NextRequest, NextResponse } from 'next/server';
import { getCustomerTokenName, extractCustomerTokenForRestaurant, verifyJwt } from '@/lib/jwt-utils';
import { resolveRestaurantId } from '@/services/utils.service';
import { TableSessionLifecycleService } from '@/services/table-session-lifecycle.service';
import { clearCustomerTableSessionCookie } from '@/lib/customer-table-session';

/**
 * POST /api/customer/auth/logout
 * Clears the customer session cookie, separates auth logout from dining session termination,
 * releases empty sessions, preserves protected orders/payments, and maintains shared sessions.
 */
export async function POST(req: NextRequest) {
    try {
        let restaurantId = '';
        let cart: any = null;
        try {
            const body = await req.json();
            restaurantId = body?.restaurantId || '';
            cart = body?.cart || null;
        } catch {
            const { searchParams } = new URL(req.url);
            restaurantId = searchParams.get('restaurantId') || '';
        }

        const resolvedId = restaurantId ? await resolveRestaurantId(restaurantId) : '';
        const cookieName = getCustomerTokenName(resolvedId || restaurantId);

        // Extract customer identity
        let customerMobile = '';
        const token = extractCustomerTokenForRestaurant(req.cookies, resolvedId || restaurantId);
        if (token) {
            try {
                const payload: any = await verifyJwt(token);
                if (payload?.mobile) {
                    customerMobile = payload.mobile;
                }
            } catch (_) {}
        }

        // Apply lifecycle rules: release membership, expire empty session if eligible, preserve if protected
        let lifecycleResult = { membershipReleased: false, sessionExpired: false, sessionPreserved: false, reasons: [] as string[] };
        if (customerMobile && (resolvedId || restaurantId)) {
            try {
                lifecycleResult = await TableSessionLifecycleService.handleCustomerLogout(
                    resolvedId || restaurantId,
                    customerMobile,
                    cart
                );
            } catch (lifecycleErr) {
                console.warn('[Customer Logout] Lifecycle handler notice:', lifecycleErr);
            }
        }

        const response = NextResponse.json({
            success: true,
            message: 'Customer authentication logged out. Orders and payments remain secure.',
            lifecycle: lifecycleResult,
        });

        // 1. Expire all cookies starting with dine_customer_token from incoming request
        const allCookies = req.cookies.getAll();
        for (const cookie of allCookies) {
            if (cookie.name.startsWith('dine_customer_token') || cookie.name.startsWith('ros_customer_token')) {
                response.cookies.set(cookie.name, '', {
                    httpOnly: true,
                    path: '/',
                    maxAge: 0,
                    expires: new Date(0),
                });
            }
        }

        // 2. Explicitly expire calculated scoped names
        if (cookieName) {
            response.cookies.set(cookieName, '', {
                httpOnly: true,
                path: '/',
                maxAge: 0,
                expires: new Date(0),
            });
        }
        if (restaurantId && restaurantId !== resolvedId) {
            const rawCookieName = getCustomerTokenName(restaurantId);
            response.cookies.set(rawCookieName, '', {
                httpOnly: true,
                path: '/',
                maxAge: 0,
                expires: new Date(0),
            });
        }

        // 3. Expire generic customer cookies and table session cookie
        response.cookies.set('dine_customer_token', '', {
            httpOnly: true,
            path: '/',
            maxAge: 0,
            expires: new Date(0),
        });
        response.cookies.set('ros_customer_token', '', {
            httpOnly: true,
            path: '/',
            maxAge: 0,
            expires: new Date(0),
        });

        clearCustomerTableSessionCookie(response);

        return response;
    } catch (err: any) {
        console.error('[Customer Logout Error]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
