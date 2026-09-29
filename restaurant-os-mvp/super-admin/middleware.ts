import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJwt } from '@/lib/jwt-utils';

export async function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;

    // 1. Allow Next.js internals, static files, and public auth endpoints
    if (
        path.startsWith('/_next') ||
        path.startsWith('/favicon') ||
        path.startsWith('/api/auth/login') ||
        path.startsWith('/api/auth/logout') ||
        path === '/login'
    ) {
        return NextResponse.next();
    }

    // 2. Check auth token
    const token = request.cookies.get('dine_superadmin_token')?.value || request.cookies.get('dine_auth_token')?.value;

    if (!token) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    const user = await verifyJwt(token);
    if (!user || !user.userId) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    const role = (user.role || '').toUpperCase();
    if (role !== 'SUPER_ADMIN' && role !== 'SUPERADMIN' && user.email !== 'superadmin@dineinone.com') {
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.delete('dine_superadmin_token');
        response.cookies.delete('dine_auth_token');
        return response;
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
