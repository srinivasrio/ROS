import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/jwt-utils';

export async function verifySuperAdmin(): Promise<{ authorized: boolean; error?: string; user?: any }> {
    const cookieStore = await cookies();
    const token = cookieStore.get('dine_auth_token')?.value;

    if (!token) {
        return { authorized: false, error: 'Unauthorized: Missing authentication token' };
    }

    const user = await verifyJwt(token);
    if (!user || !user.userId) {
        return { authorized: false, error: 'Unauthorized: Invalid token' };
    }

    const role = (user.role || '').toUpperCase();
    if (role !== 'SUPER_ADMIN' && role !== 'SUPERADMIN' && user.email !== 'superadmin@dineinone.com') {
        return { authorized: false, error: 'Forbidden: Super Admin privileges required' };
    }

    return { authorized: true, user };
}
