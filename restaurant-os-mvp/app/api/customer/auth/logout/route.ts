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

        // Expire scoped cookie
        if (cookieName) {
            response.cookies.set(cookieName, '', {
                httpOnly: true,
                path: '/',
                maxAge: 0,
                expires: new Date(0),
            });
        }

        // Expire generic customer cookie
        response.cookies.set('dine_customer_token', '', {
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
