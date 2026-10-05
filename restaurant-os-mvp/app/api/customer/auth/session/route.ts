import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt, extractCustomerTokenForRestaurant } from '@/lib/jwt-utils';
import { CustomerService } from '@/services/customers.server.service';
import { resolveRestaurantId } from '@/services/utils.service';

/**
 * GET /api/customer/auth/session
 * Verifies current customer session from HTTP cookie or Bearer token.
 * Returns the fresh customer profile and ID from the database.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const restaurantCode = searchParams.get('restaurantId') || searchParams.get('restaurantCode') || '';
        const restaurantId = await resolveRestaurantId(restaurantCode);

        // Check Bearer header first, then cookies
        let token: string | null = null;
        const authHeader = req.headers.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7).trim();
        }

        if (!token) {
            token = extractCustomerTokenForRestaurant(req.cookies, restaurantId || restaurantCode);
        }

        if (!token) {
            return NextResponse.json({ authenticated: false, customer: null });
        }

        const payload = await verifyJwt(token);
        if (!payload || !payload.customerId) {
            return NextResponse.json({ authenticated: false, customer: null });
        }

        const effectiveRestId = restaurantId || payload.restaurantId;
        const customer = await CustomerService.getCustomerById(effectiveRestId, payload.customerId);

        if (!customer) {
            return NextResponse.json({ authenticated: false, customer: null });
        }

        return NextResponse.json({
            authenticated: true,
            customer: {
                id: customer.id,
                name: customer.name,
                mobile: customer.mobile,
                email: customer.email,
                dateOfBirth: customer.date_of_birth,
                restaurantId: customer.restaurant_id,
            },
        });
    } catch (err: any) {
        console.error('[Customer Session Error]', err);
        return NextResponse.json({ authenticated: false, error: err.message }, { status: 500 });
    }
}
