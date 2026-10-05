import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJwt } from '@/lib/jwt-utils';

export async function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;
    const host = request.headers.get('host') || '';
    const hostname = host.split(':')[0].toLowerCase();

    // Keep the standalone portal on its dedicated local hostname.
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
        const canonicalUrl = request.nextUrl.clone();
        canonicalUrl.hostname = 'control.localhost';
        canonicalUrl.port = '3005';
        return NextResponse.redirect(canonicalUrl);
    }

    // 1. Allow Next.js internals, static files, and public auth endpoints
    if (
        path.startsWith('/_next') ||
        path.startsWith('/favicon') ||
        path.startsWith('/api/auth/login') ||
        path.startsWith('/api/auth/logout') ||
        path.startsWith('/api/auth/super-admin/register') ||
        path.startsWith('/api/auth/super-admin/verify-email') ||
        path.startsWith('/api/auth/super-admin/verify-totp') ||
        path.startsWith('/api/auth/super-admin/login/initiate') ||
        path.startsWith('/api/auth/super-admin/login/verify-email') ||
        path.startsWith('/api/auth/super-admin/login/verify-totp') ||
        path === '/login'
    ) {
        return NextResponse.next();
    }

    // 2. Check auth token (Header or Cookies)
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token) {
        token = request.cookies.get('dine_superadmin_token')?.value ||
                request.cookies.get('superadmin_token')?.value ||
                request.cookies.get('dine_auth_token')?.value ||
                null;
    }

    const isApi = path.startsWith('/api/');

    if (!token) {
        if (isApi) {
            return NextResponse.json({ error: 'Unauthorized: Missing super admin authentication token' }, { status: 401 });
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }

    const user = await verifyJwt(token);
    if (!user || !user.userId) {
        if (isApi) {
            return NextResponse.json({ error: 'Unauthorized: Invalid or expired token' }, { status: 401 });
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }

    const role = (user.role || '').toUpperCase();
    if (role !== 'SUPER_ADMIN' && role !== 'SUPERADMIN') {
        if (isApi) {
            return NextResponse.json({ error: 'Forbidden: Super Admin privileges required' }, { status: 403 });
        }
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.delete('dine_superadmin_token');
        response.cookies.delete('superadmin_token');
        response.cookies.delete('dine_auth_token');
        return response;
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
