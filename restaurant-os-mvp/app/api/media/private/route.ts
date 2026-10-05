import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getPrivatePresignedUrl } from '@/lib/r2';
import { extractTokenForRestaurant, verifyJwt } from '@/lib/jwt-utils';

type AuthResult = { authenticated: boolean; authorized: boolean };
type CustomJwtPayload = {
    userId?: string;
    role?: string;
    restaurantId?: string;
    restaurant_id?: string;
};

function canManagePrivateMedia(role?: string): boolean {
    return ['owner', 'restaurant_owner', 'restaurant_admin', 'admin', 'manager', 'super_admin', 'superadmin']
        .includes(String(role || '').toLowerCase().trim());
}

function getBearerToken(req: NextRequest): string | null {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    return authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() || null : null;
}

async function hasRestaurantAccess(userId: string, restaurantId: string, role?: string): Promise<boolean> {
    const normalizedRole = String(role || '').toLowerCase().trim();
    if (normalizedRole === 'super_admin' || normalizedRole === 'superadmin') {
        const { data: restaurant } = await supabaseAdmin
            .from('restaurants')
            .select('id')
            .eq('id', restaurantId)
            .is('deleted_at', null)
            .maybeSingle();
        return Boolean(restaurant?.id);
    }

    const [employeeResult, userResult, ownerResult, membershipResult] = await Promise.all([
        supabaseAdmin
            .from('employees')
            .select('id')
            .eq('id', userId)
            .eq('restaurant_id', restaurantId)
            .eq('is_deleted', false)
            .maybeSingle(),
        supabaseAdmin
            .from('users')
            .select('id')
            .eq('id', userId)
            .eq('restaurant_id', restaurantId)
            .maybeSingle(),
        supabaseAdmin
            .from('restaurants')
            .select('id')
            .eq('id', restaurantId)
            .eq('owner_id', userId)
            .is('deleted_at', null)
            .maybeSingle(),
        supabaseAdmin
            .from('restaurant_users')
            .select('restaurant_id')
            .eq('restaurant_id', restaurantId)
            .eq('user_id', userId)
            .eq('status', 'active')
            .maybeSingle(),
    ]);

    return Boolean(
        employeeResult.data?.id ||
        userResult.data?.id ||
        ownerResult.data?.id ||
        membershipResult.data?.restaurant_id
    );
}

async function authorizeRestaurantScope(req: NextRequest, restaurantId: string): Promise<AuthResult> {
    const bearerToken = getBearerToken(req);
    const cookieToken = bearerToken ? null : extractTokenForRestaurant(req.cookies, restaurantId);
    const customToken = bearerToken || cookieToken;

    if (customToken) {
        let payload: CustomJwtPayload | null = null;
        try {
            payload = await verifyJwt(customToken);
        } catch {
            payload = null;
        }

        if (!payload?.userId || String(payload.role || '').toLowerCase() === 'customer') {
            return { authenticated: false, authorized: false };
        }

        if (!canManagePrivateMedia(payload.role)) {
            return { authenticated: true, authorized: false };
        }

        const tokenRestaurantId = payload.restaurantId || payload.restaurant_id;
        if (tokenRestaurantId && String(tokenRestaurantId) !== String(restaurantId)) {
            return { authenticated: true, authorized: false };
        }

        return {
            authenticated: true,
            authorized: await hasRestaurantAccess(String(payload.userId), restaurantId, payload.role),
        };
    }

    try {
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return { authenticated: false, authorized: false };

        return {
            authenticated: true,
            authorized: canManagePrivateMedia(session.user.app_metadata?.role)
                && await hasRestaurantAccess(session.user.id, restaurantId, session.user.app_metadata?.role),
        };
    } catch {
        return { authenticated: false, authorized: false };
    }
}

function parsePrivatePath(path: string): { restaurantId: string; type: string } | null {
    const parts = path.split('/');
    const privateTypes = new Set(['staff', 'invoices', 'compliance', 'documents']);
    if (parts.length !== 4 || parts[0] !== 'restaurants' || !privateTypes.has(parts[2])) return null;
    if (parts.some((part, index) => !part || part === '.' || part === '..' || (index !== 3 && !/^[A-Za-z0-9_-]+$/.test(part)) || (index === 3 && !/^[A-Za-z0-9._-]+$/.test(part)))) {
        return null;
    }
    return { restaurantId: parts[1], type: parts[2] };
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const path = searchParams.get('path');

        if (!path) {
            return NextResponse.json({ error: 'Path is required' }, { status: 400 });
        }

        const parsedPath = parsePrivatePath(path);
        if (!parsedPath) {
            return NextResponse.json({ error: 'Forbidden path' }, { status: 403 });
        }

        const auth = await authorizeRestaurantScope(req, parsedPath.restaurantId);
        if (!auth.authenticated) {
            return NextResponse.json({ error: 'Unauthorized. Please sign in to access this document.' }, { status: 401 });
        }
        if (!auth.authorized) {
            return NextResponse.json({ error: 'Forbidden. Restaurant access denied.' }, { status: 403 });
        }

        // Generate the pre-signed URL (expires in 15 minutes)
        const presignedUrl = await getPrivatePresignedUrl(path, 900);

        // Redirect user to the pre-signed URL
        return NextResponse.redirect(presignedUrl);
    } catch (error: any) {
        console.error('Error serving private file:', error);
        return NextResponse.json({ error: error.message || 'Failed to access file' }, { status: 500 });
    }
}
