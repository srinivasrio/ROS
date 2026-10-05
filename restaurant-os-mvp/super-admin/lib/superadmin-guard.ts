import { cookies, headers } from 'next/headers';
import { verifyJwt } from '@/lib/jwt-utils';

export async function verifySuperAdmin(): Promise<{ authorized: boolean; error?: string; user?: any }> {
    const headersList = await headers();
    const authHeader = headersList.get('authorization') || headersList.get('Authorization');
    let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token) {
        const cookieStore = await cookies();
        token = cookieStore.get('dine_superadmin_token')?.value ||
                cookieStore.get('superadmin_token')?.value ||
                cookieStore.get('dine_auth_token')?.value ||
                null;
    }

    if (!token) {
        return { authorized: false, error: 'Unauthorized: Missing authentication token' };
    }

    const user = await verifyJwt(token);
    if (!user || !user.userId) {
        return { authorized: false, error: 'Unauthorized: Invalid or expired token' };
    }

    const role = (user.role || '').toUpperCase();
    if (role !== 'SUPER_ADMIN' && role !== 'SUPERADMIN') {
        return { authorized: false, error: 'Forbidden: Super Admin privileges required' };
    }

    return { authorized: true, user };
}
