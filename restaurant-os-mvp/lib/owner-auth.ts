import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyJwt, extractTokenForRestaurant } from '@/lib/jwt-utils';

export interface AuthenticatedOwner {
    userId: string;
    restaurantId: string;
    restaurantIds?: string[];
    role: string;
    email?: string;
    name?: string;
    phone?: string;
    mobile?: string;
    ip: string;
    userAgent: string;
}

/**
 * Resolves the authenticated owner or restaurant admin and their associated restaurant ID.
 * Strictly verifies identity via Supabase Auth / JWT and database relationship mapping.
 * Never relies on hardcoded or mock IDs.
 */
export async function getAuthenticatedOwner(request: NextRequest): Promise<AuthenticatedOwner | null> {
    try {
        const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
        let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
        if (!token) {
            token = request.cookies.get('dine_auth_token_owner')?.value || request.cookies.get('dine_auth_token')?.value || null;
        }

        if (!token) {
            // Check restaurant scoped cookies as fallback
            token = extractTokenForRestaurant(request.cookies, null, null, 'owner');
        }

        if (!token) return null;

        const user = await verifyJwt(token);
        if (!user || !user.userId) return null;

        const role = String(user.role || '').toLowerCase().trim();
        const isAuthorizedRole = ['owner', 'restaurant_owner', 'restaurant_admin', 'admin', 'manager', 'super_admin', 'superadmin'].includes(role);
        if (!isAuthorizedRole) return null;

        // Resolve all restaurants owned by this owner
        const [ownedRestRes, ruRestRes] = await Promise.all([
            supabaseAdmin
                .from('restaurants')
                .select('id, name')
                .eq('owner_id', user.userId)
                .is('deleted_at', null),
            supabaseAdmin
                .from('restaurant_users')
                .select('restaurant_id')
                .eq('user_id', user.userId)
                .eq('status', 'active')
        ]);

        const idSet = new Set<string>();
        (ownedRestRes.data || []).forEach(r => idSet.add(r.id));
        (ruRestRes.data || []).forEach(ru => idSet.add(ru.restaurant_id));

        // For non-owner staff roles if idSet is empty, verify restaurant_id in employees
        if (idSet.size === 0 && user.restaurantId) {
            const { data: empRest } = await supabaseAdmin
                .from('employees')
                .select('restaurant_id')
                .eq('id', user.userId)
                .eq('restaurant_id', user.restaurantId)
                .is('deleted_at', null)
                .maybeSingle();
            if (empRest?.restaurant_id) {
                idSet.add(empRest.restaurant_id);
            }
        }

        const restaurantIds = Array.from(idSet);
        if (restaurantIds.length === 0 && !['owner', 'restaurant_owner', 'restaurant_admin', 'super_admin', 'superadmin'].includes(role)) {
            return null;
        }

        // Check if an explicit restaurant is requested via cookie or header
        const requestedRestId = request.headers.get('x-restaurant-id') || request.cookies.get('dine_restaurant_id')?.value;
        const restaurantId = (requestedRestId && restaurantIds.includes(requestedRestId))
            ? requestedRestId
            : (user.restaurantId && restaurantIds.includes(user.restaurantId) ? user.restaurantId : (restaurantIds[0] || ''));

        return {
            userId: user.userId,
            restaurantId,
            restaurantIds,
            role: user.role || 'OWNER',
            email: user.email,
            name: user.name,
            phone: (user as any).phone || (user as any).mobile || undefined,
            mobile: (user as any).mobile || (user as any).phone || undefined,
            ip: request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1',
            userAgent: request.headers.get('user-agent') || 'unknown',
        };
    } catch (err) {
        console.error('[owner-auth] Failed to authenticate owner:', err);
        return null;
    }
}

/**
 * Resolves the operational restaurant scope based on query parameters (e.g. branch or restaurant selector).
 * Guarantees strict multi-tenant isolation and consolidated cross-restaurant querying.
 */
export async function resolveOwnerScope(
    auth: AuthenticatedOwner,
    filterParam?: string | null
): Promise<{
    isAll: boolean;
    restaurantIds: string[];
    targetRestaurantId: string | null;
    targetBranchId: string | null;
}> {
    const allIds = auth.restaurantIds || [auth.restaurantId];
    if (!filterParam || filterParam === 'all') {
        return {
            isAll: true,
            restaurantIds: allIds,
            targetRestaurantId: null,
            targetBranchId: null
        };
    }

    // Direct match with restaurant ID
    if (allIds.includes(filterParam)) {
        return {
            isAll: false,
            restaurantIds: [filterParam],
            targetRestaurantId: filterParam,
            targetBranchId: null
        };
    }

    // Match with branch ID
    if (allIds.length > 0) {
        const { data: bRec } = await supabaseAdmin
            .from('branches')
            .select('id, internal_id, restaurant_id')
            .or(`id.eq.${filterParam},internal_id.eq.${filterParam},code.eq.${filterParam}`)
            .in('restaurant_id', allIds)
            .maybeSingle();

        if (bRec) {
            return {
                isAll: false,
                restaurantIds: [bRec.restaurant_id],
                targetRestaurantId: bRec.restaurant_id,
                targetBranchId: bRec.id
            };
        }
    }

    // If param does not match, fallback to empty to enforce strict isolation
    return {
        isAll: false,
        restaurantIds: [],
        targetRestaurantId: null,
        targetBranchId: null
    };
}

