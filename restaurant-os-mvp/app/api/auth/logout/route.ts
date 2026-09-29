import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyJwt, extractTokenForRestaurant } from '@/lib/jwt-utils';

export async function POST(request: Request) {
    try {
        let targetRest: string | null = null;
        let isAll = false;
        try {
            const url = new URL(request.url);
            targetRest = url.searchParams.get('restaurantId') || url.searchParams.get('restaurantCode') || null;
            isAll = url.searchParams.get('all') === 'true';
        } catch (_) {}

        const cookieStore = await cookies();
        const token = extractTokenForRestaurant(cookieStore, targetRest);

        const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
        const userAgent = request.headers.get('user-agent') || 'unknown';

        let payload: any = null;
        if (token) {
            payload = await verifyJwt(token);
            if (payload) {
                // Deactivate the session in DB
                if (payload.sessionId) {
                    await supabaseAdmin
                        .from('dine_sessions')
                        .update({ is_active: false })
                        .eq('id', payload.sessionId);
                }

                // If it is a WAITER, end their shift log
                let mappedRole = payload.role;
                if (payload.role === 'WAITER') mappedRole = 'waiter';

                if (mappedRole === 'waiter') {
                    await supabaseAdmin
                        .from('waiter_shifts')
                        .update({ logout_time: new Date().toISOString() })
                        .eq('user_id', payload.userId)
                        .is('logout_time', null);
                }

                // Log audit logout
                await supabaseAdmin.from('login_audit_logs').insert({
                    user_id: payload.userId,
                    employee_id: payload.employeeId || null,
                    role: payload.role,
                    action: 'logout',
                    ip_address: ip,
                    user_agent: userAgent
                });
            }
        }

        const isHttps = request.url.startsWith('https://') || request.headers.get('x-forwarded-proto') === 'https';
        const isSecure = process.env.NODE_ENV === 'production' && isHttps;

        const expireCookieOptions = {
            httpOnly: true,
            secure: isSecure,
            sameSite: 'lax' as const,
            path: '/',
            maxAge: 0 // Expire instantly
        };

        // Clear all dine_auth_token cookies if isAll or if no specific restaurant target
        if (isAll) {
            const allCookies = cookieStore.getAll();
            for (const c of allCookies) {
                if (c.name.startsWith('dine_auth_token')) {
                    cookieStore.set(c.name, '', expireCookieOptions);
                }
            }
        } else {
            // Clear default cookie
            cookieStore.set('dine_auth_token', '', expireCookieOptions);

            // Clear restaurant-specific cookies
            const rids = [targetRest, payload?.restaurantId, payload?.restaurant_id].filter(Boolean);
            for (const rid of rids) {
                const cleanRid = String(rid).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
                cookieStore.set(`dine_auth_token_${cleanRid}`, '', expireCookieOptions);
                cookieStore.set(`dine_auth_token_${cleanRid}_admin`, '', expireCookieOptions);
                cookieStore.set(`dine_auth_token_${cleanRid}_waiter`, '', expireCookieOptions);
            }
            cookieStore.set('dine_auth_token_admin', '', expireCookieOptions);
            cookieStore.set('dine_auth_token_waiter', '', expireCookieOptions);
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Logout error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
