import { NextResponse, type NextRequest } from 'next/server';
import { CustomerService } from '@/services/customers.service';
import { resolveRestaurantId } from '@/services/utils.service';
import { verifyJwt, extractTokenForRestaurant } from '@/lib/jwt-utils';

async function getAuthenticatedUser(req: NextRequest, restaurantCode: string, restaurantId: string) {
    let token = extractTokenForRestaurant(req.cookies, restaurantCode) ||
                extractTokenForRestaurant(req.cookies, restaurantId);

    if (!token) {
        const authHeader = req.headers.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7).trim();
        }
    }

    const user = token ? await verifyJwt(token) : null;
    if (!user) {
        return { error: 'Authentication required', status: 401 };
    }

    const role = (user.role || '').toLowerCase();
    const isSuperAdmin = role === 'super_admin' || role === 'superadmin' || user.email === 'superadmin@dineinone.com';
    const isAdmin = ['restaurant_admin', 'admin', 'owner', 'manager'].includes(role) || isSuperAdmin;

    if (!isAdmin) {
        return { error: 'Admin access required', status: 403 };
    }

    const userRestId = user.restaurantId || user.restaurant_id;
    if (!isSuperAdmin && userRestId) {
        const resolvedUserRestId = await resolveRestaurantId(String(userRestId));
        if (resolvedUserRestId && resolvedUserRestId !== restaurantId && String(userRestId) !== String(restaurantCode)) {
            return { error: 'Access denied for this restaurant', status: 403 };
        }
    }

    return { user };
}

/**
 * GET /api/restaurant/[restaurantCode]/customers/[customerId]
 * Admin-only — single customer profile + order history.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ restaurantCode: string; customerId: string }> }
) {
    try {
        const { restaurantCode, customerId } = await params;
        const restaurantId = await resolveRestaurantId(restaurantCode);
        if (!restaurantId) {
            return NextResponse.json({ error: 'Invalid restaurant' }, { status: 400 });
        }

        const auth = await getAuthenticatedUser(req, restaurantCode, restaurantId);
        if ('error' in auth) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const result = await CustomerService.getCustomerProfile(customerId, restaurantId);

        if (!result.customer) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[Customer Profile Error]', error);
        return NextResponse.json({ error: 'Failed to fetch customer profile' }, { status: 500 });
    }
}

/**
 * PATCH /api/restaurant/[restaurantCode]/customers/[customerId]
 * Admin-only — update customer details.
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ restaurantCode: string; customerId: string }> }
) {
    try {
        const { restaurantCode, customerId } = await params;
        const restaurantId = await resolveRestaurantId(restaurantCode);
        if (!restaurantId) {
            return NextResponse.json({ error: 'Invalid restaurant' }, { status: 400 });
        }

        const auth = await getAuthenticatedUser(req, restaurantCode, restaurantId);
        if ('error' in auth) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const body = await req.json();
        const updates: any = {};
        if (body.mobile !== undefined) updates.mobile = body.mobile;
        if (body.email !== undefined) updates.email = body.email;
        if (body.date_of_birth !== undefined) updates.date_of_birth = body.date_of_birth;

        await CustomerService.updateCustomer(customerId, restaurantId, updates);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[Customer Update Error]', error);
        return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
    }
}
