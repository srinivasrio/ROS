import { NextRequest, NextResponse } from 'next/server';
import { TableSessionLifecycleService } from '@/services/table-session-lifecycle.service';
import { extractCustomerTokenForRestaurant, verifyJwt } from '@/lib/jwt-utils';
import { resolveRestaurantId } from '@/services/utils.service';

/**
 * GET /api/customer/table-session/cart
 * Recovers cart items from active table session if within the 10-minute recovery window.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const restaurantId = searchParams.get('restaurantId')?.trim();
        const tableNumber = searchParams.get('tableNumber')?.trim();
        let customerMobile = searchParams.get('customerMobile')?.trim() || '';

        if (!restaurantId || !tableNumber) {
            return NextResponse.json({ error: 'restaurantId and tableNumber are required' }, { status: 400 });
        }

        const canonicalRestaurantId = (await resolveRestaurantId(restaurantId)) || restaurantId;

        if (!customerMobile) {
            const token = extractCustomerTokenForRestaurant(req.cookies, canonicalRestaurantId || restaurantId);
            if (token) {
                try {
                    const payload: any = await verifyJwt(token);
                    if (payload?.mobile) customerMobile = payload.mobile;
                } catch {}
            }
        }

        const recovery = await TableSessionLifecycleService.recoverCart(
            canonicalRestaurantId,
            tableNumber,
            customerMobile
        );

        return NextResponse.json(recovery);
    } catch (err: any) {
        console.error('[table-session/cart GET] Exception:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}

/**
 * POST /api/customer/table-session/cart
 * Persists current cart to active session for 10-minute recovery window.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const { restaurantId, tableNumber, cart } = body;
        let customerMobile = body?.customerMobile?.trim() || '';

        if (!restaurantId || !tableNumber) {
            return NextResponse.json({ error: 'restaurantId and tableNumber are required' }, { status: 400 });
        }

        const canonicalRestaurantId = (await resolveRestaurantId(restaurantId)) || restaurantId;

        if (!customerMobile) {
            const token = extractCustomerTokenForRestaurant(req.cookies, canonicalRestaurantId || restaurantId);
            if (token) {
                try {
                    const payload: any = await verifyJwt(token);
                    if (payload?.mobile) customerMobile = payload.mobile;
                } catch {}
            }
        }

        const success = await TableSessionLifecycleService.syncCart(
            canonicalRestaurantId,
            tableNumber,
            customerMobile,
            cart || {}
        );

        return NextResponse.json({ success });
    } catch (err: any) {
        console.error('[table-session/cart POST] Exception:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}
