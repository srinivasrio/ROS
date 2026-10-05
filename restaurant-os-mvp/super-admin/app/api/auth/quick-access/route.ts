import { NextResponse } from 'next/server';
import { signJwt } from '@/lib/jwt-utils';
import { verifySuperAdmin } from '@/lib/superadmin-guard';

export async function GET(request: Request) {
    try {
        // Quick access is a session refresh, not a login path. The caller must
        // already hold a JWT whose verified role is SUPER_ADMIN/SUPERADMIN.
        const auth = await verifySuperAdmin();
        if (!auth.authorized || !auth.user) {
            const status = auth.error?.startsWith('Forbidden:') ? 403 : 401;
            return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status });
        }

        const token = await signJwt({
            userId: auth.user.userId,
            email: auth.user.email,
            name: auth.user.name || 'Super Admin',
            role: auth.user.role,
        }, 60 * 60 * 24 * 7);

        const response = NextResponse.redirect(new URL('/admin/dashboard', request.url));

        response.cookies.set('dine_superadmin_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7
        });

        response.cookies.set('dine_auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7
        });

        return response;
    } catch (err: any) {
        console.error('[Super Admin Quick Access] Error:', err);
        return NextResponse.json({ error: 'Failed to refresh super admin session' }, { status: 500 });
    }
}
