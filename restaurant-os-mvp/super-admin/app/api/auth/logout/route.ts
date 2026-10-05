import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { verifyJwt } from '@/lib/jwt-utils';
import { supabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';

/**
 * POST /api/auth/logout
 * Secure Super Admin logout - invalidates session and clears cookies
 */
export async function POST() {
    try {
        // Get token from cookies or headers
        const cookieStore = await cookies();
        const headersList = await headers();
        
        const authHeader = headersList.get('authorization') || headersList.get('Authorization');
        let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

        if (!token) {
            token = cookieStore.get('dine_superadmin_token')?.value ||
                    cookieStore.get('superadmin_token')?.value ||
                    cookieStore.get('dine_auth_token')?.value ||
                    null;
        }

        // If we have a valid token, invalidate the session in the database
        if (token) {
            try {
                const user = await verifyJwt(token);
                if (user && user.userId) {
                    // Invalidate session in database
                    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
                    await supabaseAdmin
                        .from('dine_sessions')
                        .update({ is_active: false })
                        .eq('user_id', user.userId)
                        .eq('token_hash', tokenHash);

                    // Audit log
                    await supabaseAdmin.from('audit_logs').insert({
                        restaurant_id: null,
                        user_id: user.userId,
                        actor_id: user.userId,
                        action: 'super_admin_logout',
                        ip_address: 'unknown',
                        device: 'unknown',
                        browser: 'unknown',
                        details: { method: 'user_initiated' }
                    });
                }
            } catch (err) {
                console.warn('Token verification failed during logout (token may be expired):', err);
                // Continue with cookie clearing even if token invalid
            }
        }

        // Clear all auth cookies
        const response = NextResponse.json({ success: true, message: 'Logged out successfully' });

        response.cookies.set('dine_superadmin_token', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 0
        });

        response.cookies.set('dine_auth_token', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 0
        });

        response.cookies.set('superadmin_token', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 0
        });

        return response;

    } catch (err: any) {
        console.error('Super Admin logout error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}