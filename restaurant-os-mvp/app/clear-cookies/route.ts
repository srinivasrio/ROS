import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const isHttps = request.url.startsWith('https://') || request.headers.get('x-forwarded-proto') === 'https';
    const isSecure = process.env.NODE_ENV === 'production' && isHttps;

    const allCookies = request.cookies.getAll();
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('cleared', 'true');
    const response = NextResponse.redirect(loginUrl);

    for (const c of allCookies) {
        response.cookies.set(c.name, '', {
            path: '/',
            maxAge: 0,
            httpOnly: true,
            secure: isSecure,
            sameSite: 'lax',
        });
    }

    return response;
}
