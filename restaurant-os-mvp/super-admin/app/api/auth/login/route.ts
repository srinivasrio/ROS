import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { signJwt } from '@/lib/jwt-utils';
import { verifyPassword } from '@/lib/auth-utils';
import { RateLimiter } from '@/lib/rate-limiter';
import crypto from 'crypto';

/**
 * POST /api/auth/login
 * 
 * LEGACY ENDPOINT - DEPRECATED
 * 
 * This endpoint now ONLY supports the new multi-step authentication flow:
 * 1. Password verification → returns requirement for email verification
 * 2. Email verification → returns requirement for TOTP
 * 3. TOTP verification → creates session
 * 
 * All default credential bypasses have been REMOVED.
 * All plaintext password fallbacks have been REMOVED.
 * 
 * Use the new endpoints instead:
 * - POST /api/auth/super-admin/login/initiate (password verification)
 * - POST /api/auth/super-admin/login/verify-email (email OTP verification)
 * - POST /api/auth/super-admin/login/verify-totp (TOTP verification)
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password, step } = body;

        // If step is provided, redirect to appropriate new endpoint
        if (step === 'initiate' || step === 'password') {
            return NextResponse.json({
                success: false,
                error: 'This endpoint is deprecated. Use /api/auth/super-admin/login/initiate for password verification.',
                redirectTo: '/api/auth/super-admin/login/initiate'
            }, { status: 410 });
        }

        if (step === 'verify-email') {
            return NextResponse.json({
                success: false,
                error: 'This endpoint is deprecated. Use /api/auth/super-admin/login/verify-email for email verification.',
                redirectTo: '/api/auth/super-admin/login/verify-email'
            }, { status: 410 });
        }

        if (step === 'verify-totp') {
            return NextResponse.json({
                success: false,
                error: 'This endpoint is deprecated. Use /api/auth/super-admin/login/verify-totp for TOTP verification.',
                redirectTo: '/api/auth/super-admin/login/verify-totp'
            }, { status: 410 });
        }

        // Legacy direct login attempt (should not work with new security model)
        // This is kept only to return a clear error message
        if (email && password) {
            const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
            
            await supabaseAdmin.from('audit_logs').insert({
                action: 'super_admin_legacy_login_attempt',
                ip_address: ip,
                details: { 
                    email: email.toLowerCase().trim(),
                    reason: 'deprecated_endpoint_used'
                }
            });

            return NextResponse.json({
                success: false,
                error: 'Direct login is no longer supported. Super Admin authentication now requires: Password → Email Verification → TOTP (Google Authenticator). Please use the new login flow.',
                deprecated: true
            }, { status: 410 });
        }

        return NextResponse.json({ 
            success: false, 
            error: 'Invalid request. Use the new multi-step authentication flow.' 
        }, { status: 400 });

    } catch (err: any) {
        console.error('Super Admin legacy login error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}