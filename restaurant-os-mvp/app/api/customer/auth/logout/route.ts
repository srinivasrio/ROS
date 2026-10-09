import { NextRequest, NextResponse } from 'next/server';
import { getCustomerTokenName } from '@/lib/jwt-utils';
import { resolveRestaurantId } from '@/services/utils.service';

/**
 * POST /api/customer/auth/logout
 * Clears the customer session cookie without touching or modifying ANY database orders.
 */
export async function POST(req: NextRequest) {
    try {
        let restaurantId = '';
        try {
            const body = await req.json();
            restaurantId = body?.restaurantId || '';
        } catch {
            const { searchParams } = new URL(req.url);
            restaurantId = searchParams.get('restaurantId') || '';
        }

        const resolvedId = restaurantId ? await resolveRestaurantId(restaurantId) : '';
        const cookieName = getCustomerTokenName(resolvedId || restaurantId);

        const response = NextResponse.json({
            success: true,
            message: 'Customer session logged out. Orders remain securely in the database.',
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

        // 3. Expire generic customer cookies
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

        return response;
    } catch (err: any) {
        console.error('[Customer Logout Error]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
