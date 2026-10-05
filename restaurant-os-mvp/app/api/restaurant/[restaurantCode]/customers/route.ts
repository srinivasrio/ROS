import { NextResponse, type NextRequest } from 'next/server';
import { CustomerService } from '@/services/customers.server.service';
import { resolveRestaurantId } from '@/services/utils.service';
import { verifyJwt, extractTokenForRestaurant, extractCustomerTokenForRestaurant, signJwt, getCustomerTokenName } from '@/lib/jwt-utils';
import { CustomerOtpService } from '@/lib/customer-otp';

/**
 * POST /api/restaurant/[restaurantCode]/customers
 * Upsert customer info and establish customer session.
 * STRICT SECURITY REQUIREMENT (P1-05):
 * Prevents phone-only authentication. Requires verified OTP or existing verified Customer JWT.
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ restaurantCode: string }> }
) {
    try {
        const { restaurantCode } = await params;
        const restaurantId = await resolveRestaurantId(restaurantCode);

        if (!restaurantId) {
            return NextResponse.json({ error: 'Invalid restaurant' }, { status: 400 });
        }

        const body = await req.json();
        const { name, mobile, email, dateOfBirth, otp } = body;

        // At least one field must be provided
        if (!name && !mobile && !email && !dateOfBirth) {
            return NextResponse.json({ error: 'At least one field is required' }, { status: 400 });
        }

        // Basic validation
        if (mobile && !/^\+?[\d\s-]{7,15}$/.test(mobile.replace(/\s/g, ''))) {
            return NextResponse.json({ error: 'Invalid mobile number' }, { status: 400 });
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
        }

        // P1-05: Check if request has an existing verified Customer JWT session
        let existingToken: string | null = null;
        const authHeader = req.headers.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            existingToken = authHeader.substring(7).trim();
        }
        if (!existingToken) {
            existingToken = extractCustomerTokenForRestaurant(req.cookies, restaurantId || restaurantCode);
        }

        let isSessionVerified = false;
        if (existingToken) {
            try {
                const payload = await verifyJwt(existingToken);
                const tokenRestId = payload?.restaurantId || payload?.restaurant_id;
                if (payload?.customerId && payload?.role === 'customer' && tokenRestId && String(tokenRestId) === String(restaurantId)) {
                    isSessionVerified = true;
                }
            } catch {}
        }

        // If not already verified, check if valid OTP is supplied
        if (!isSessionVerified && otp && mobile) {
            const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
            const otpVerification = await CustomerOtpService.verifyOtp(restaurantId, mobile, otp, clientIp);
            if (!otpVerification.success) {
                const status = otpVerification.remainingAttempts === 0 ? 429 : 400;
                return NextResponse.json(
                    { error: otpVerification.error || 'Invalid verification code' },
                    { status }
                );
            }
            isSessionVerified = true;
        }

        // STRICT ENFORCEMENT: Customer JWT CANNOT be issued using phone number alone
        if (!isSessionVerified) {
            return NextResponse.json(
                { error: 'OTP verification required. Please verify phone number with an OTP before authenticating.' },
                { status: 401 }
            );
        }

        const result = await CustomerService.upsertCustomer(restaurantId, {
            name: name?.trim(),
            mobile: mobile?.trim(),
            email: email?.trim().toLowerCase(),
            dateOfBirth,
        });

        // Sign persistent Customer JWT (30 days validity)
        const token = await signJwt({
            customerId: result.customerId,
            restaurantId,
            restaurantCode,
            mobile: mobile?.trim(),
            name: name?.trim(),
            role: 'customer'
        }, 3600 * 24 * 30);

        const cookieName = getCustomerTokenName(restaurantId);
        const isProduction = process.env.NODE_ENV === 'production';

        const response = NextResponse.json({
            ...result,
            token,
        });

        // Set customer-scoped auth cookie
        response.cookies.set(cookieName, token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            path: '/',
            maxAge: 3600 * 24 * 30, // 30 days
        });

        // Also set generic customer cookie for fallback
        response.cookies.set('dine_customer_token', token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            path: '/',
            maxAge: 3600 * 24 * 30,
        });

        return response;
    } catch (error: any) {
        console.error('[Customer Upsert Error]', error);
        return NextResponse.json(
            { error: 'Failed to save customer info' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/restaurant/[restaurantCode]/customers
 * Admin-only — paginated customer list.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ restaurantCode: string }> }
) {
    try {
        const { restaurantCode } = await params;
        const restaurantId = await resolveRestaurantId(restaurantCode);
        if (!restaurantId) {
            return NextResponse.json({ error: 'Invalid restaurant' }, { status: 400 });
        }

        // Auth check: check cookies for scoped token, or fallback to Bearer header
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
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const role = (user.role || '').toLowerCase();
        const isSuperAdmin = role === 'super_admin' || role === 'superadmin';
        const isAdmin = ['restaurant_admin', 'admin', 'owner', 'manager'].includes(role) || isSuperAdmin;

        if (!isAdmin) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        // Tenant isolation check for non-superadmin
        const userRestId = user.restaurantId || user.restaurant_id;
        if (!isSuperAdmin && userRestId) {
            const resolvedUserRestId = await resolveRestaurantId(String(userRestId));
            if (resolvedUserRestId && resolvedUserRestId !== restaurantId && String(userRestId) !== String(restaurantCode)) {
                return NextResponse.json({ error: 'Access denied for this restaurant' }, { status: 403 });
            }
        }

        const { searchParams } = new URL(req.url);
        const search = searchParams.get('search') || '';
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '20', 10);
        const sortBy = searchParams.get('sortBy') || 'last_visit';
        const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

        // Get stats in parallel
        const [result, stats] = await Promise.all([
            CustomerService.fetchCustomers(restaurantId, { search, page, limit, sortBy, sortOrder }),
            CustomerService.getCustomerStats(restaurantId),
        ]);

        return NextResponse.json({ ...result, stats });
    } catch (error: any) {
        console.error('[Customer List Error]', error);
        return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
    }
}
