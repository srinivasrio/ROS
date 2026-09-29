import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt, extractTokenForRestaurant } from '@/lib/jwt-utils';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: Request) {
    try {
        const isHttps = request.url.startsWith('https://') || request.headers.get('x-forwarded-proto') === 'https';
        const isSecure = process.env.NODE_ENV === 'production' && isHttps;

        let targetRest: string | null = null;
        let targetStaff: string | null = null;
        try {
            const url = new URL(request.url);
            targetRest = url.searchParams.get('restaurantId') || url.searchParams.get('restaurantCode') || request.headers.get('x-restaurant-id') || null;
            targetStaff = url.searchParams.get('staffMobile') || url.searchParams.get('mobile') || url.searchParams.get('employee_id') || null;
        } catch (_) {}

        const cookieStore = await cookies();
        const token = extractTokenForRestaurant(cookieStore, targetRest, targetStaff);

        if (!token) {
            return NextResponse.json({ authenticated: false }, { status: 200 });
        }

        const payload = await verifyJwt(token);
        if (!payload) {
            return NextResponse.json({ authenticated: false }, { status: 200 });
        }

        // Validate session state in DB
        if (payload.sessionId) {
            const { data: session, error } = await supabaseAdmin
                .from('dine_sessions')
                .select('is_active')
                .eq('id', payload.sessionId)
                .single();

            if (error || !session || !session.is_active) {
                // Invalidate cookie if session in DB is inactive
                cookieStore.set('dine_auth_token', '', {
                    httpOnly: true,
                    secure: isSecure,
                    sameSite: 'lax',
                    path: '/',
                    maxAge: 0
                });
                return NextResponse.json({ authenticated: false }, { status: 200 });
            }

            // Update session last activity in the background
            supabaseAdmin
                .from('dine_sessions')
                .update({ last_activity: new Date().toISOString() })
                .eq('id', payload.sessionId)
                .then(({ error: updateErr }) => {
                    if (updateErr) console.error('Failed to update session activity:', updateErr);
                });
        }

        // Validate that employee account is explicitly active and not deleted
        if (payload.userId) {
            const { data: emp } = await supabaseAdmin
                .from('employees')
                .select('status, approval_status, is_deleted, session_version')
                .eq('id', payload.userId)
                .maybeSingle();

            if (emp) {
                const isNotActive = emp.is_deleted || emp.status !== 'active' || emp.approval_status !== 'approved';
                const versionMismatch = payload.sessionVersion && emp.session_version && payload.sessionVersion < emp.session_version;
                if (isNotActive || versionMismatch) {
                    cookieStore.set('dine_auth_token', '', {
                        httpOnly: true,
                        secure: isSecure,
                        sameSite: 'lax',
                        path: '/',
                        maxAge: 0
                    });
                    return NextResponse.json({ authenticated: false, error: 'Staff account is inactive or session has been revoked' }, { status: 200 });
                }
            }
        }

        return NextResponse.json({
            authenticated: true,
            user: {
                id: payload.userId,
                name: payload.name,
                role: payload.role,
                employee_id: payload.employeeId || null,
                email: payload.email || null,
                restaurant_id: payload.restaurantId || null
            }
        });
    } catch (error) {
        console.error('Session API error:', error);
        return NextResponse.json({ authenticated: false }, { status: 200 });
    }
}
