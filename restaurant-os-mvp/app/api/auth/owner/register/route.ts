import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hashPassword } from '@/lib/auth-utils';
import { signJwt } from '@/lib/jwt-utils';
import { OtpManager } from '@/lib/otp-store';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, mobile, email, password } = body;

        if (!name || !mobile || !email || !password) {
            return NextResponse.json({ error: 'All fields (name, mobile, email, password) are required' }, { status: 400 });
        }

        const cleanPhone = mobile.replace(/[^0-9]/g, '');
        const cleanEmail = email.toLowerCase().trim();

        if (cleanPhone.length < 10) {
            return NextResponse.json({ error: 'Valid 10-digit mobile number is required' }, { status: 400 });
        }

        if (password.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
        }

        // Verify both OTPs were validated
        const isMobileVerified = OtpManager.isVerified(cleanPhone);
        const isEmailVerified = OtpManager.isVerified(cleanEmail);

        if (!isMobileVerified || !isEmailVerified) {
            return NextResponse.json({ 
                error: 'Please verify both your mobile number and email address with OTP before submitting registration.' 
            }, { status: 400 });
        }

        // Check if an employee record already exists with this email or mobile
        const { data: existingByEmail } = await supabaseAdmin
            .from('employees')
            .select('id, email, mobile, role, is_deleted, status, session_version')
            .ilike('email', cleanEmail)
            .maybeSingle();

        // Check separation: If email exists as Restaurant Admin, prevent creating or assigning it as Owner
        if (existingByEmail) {
            const existingRole = (existingByEmail.role || '').toLowerCase();
            if (['restaurant_admin', 'admin', 'branch_admin'].includes(existingRole)) {
                return NextResponse.json({ 
                    error: 'This email is already registered as a Restaurant Admin and cannot be used for an Owner account.' 
                }, { status: 409 });
            }
        }

        const { data: legacyConflict } = await supabaseAdmin
            .from('users')
            .select('id, role')
            .ilike('email', cleanEmail)
            .maybeSingle();

        if (legacyConflict && ['admin', 'restaurant_admin', 'branch_admin'].includes((legacyConflict.role || '').toLowerCase())) {
            return NextResponse.json({ 
                error: 'This email is already registered as a Restaurant Admin and cannot be used for an Owner account.' 
            }, { status: 409 });
        }

        const { data: existingByPhone } = await supabaseAdmin
            .from('employees')
            .select('id, email, mobile, is_deleted, status, session_version')
            .or(`mobile.eq.${cleanPhone},mobile.eq.+91${cleanPhone.slice(-10)}`)
            .maybeSingle();

        // If an active (non-deleted) account exists with email, block duplicate
        if (existingByEmail && !existingByEmail.is_deleted) {
            return NextResponse.json({ 
                error: 'An account with this email address is already registered and active. Please sign in to the Owner Portal.' 
            }, { status: 409 });
        }

        // If an active account exists with phone under a different account, block duplicate
        if (existingByPhone && !existingByPhone.is_deleted && existingByPhone.id !== existingByEmail?.id) {
            return NextResponse.json({ 
                error: 'An account with this mobile number is already registered and active. Please sign in.' 
            }, { status: 409 });
        }

        const passwordHash = await hashPassword(password);
        const employeeId = `OWN-${cleanPhone.slice(-6)}`;

        let userId: string;

        // If an existing employee record exists with this email (e.g. soft-deleted), reactivate and re-bind it
        if (existingByEmail) {
            userId = existingByEmail.id;
            const newSessionVersion = (existingByEmail.session_version || 1) + 1;

            const { error: updateError } = await supabaseAdmin
                .from('employees')
                .update({
                    name: name.trim(),
                    email: cleanEmail,
                    mobile: cleanPhone,
                    role: 'owner',
                    employee_id: employeeId,
                    status: 'pending',
                    approval_status: 'pending',
                    restaurant_id: null,
                    session_version: newSessionVersion,
                    is_deleted: false,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (updateError) {
                console.error('Failed to reactivate employee record:', updateError);
                return NextResponse.json({ error: 'Failed to update user account: ' + updateError.message }, { status: 500 });
            }

            // Update auth table
            await supabaseAdmin
                .from('auth')
                .upsert({
                    user_id: userId,
                    password_hash: passwordHash,
                    mfa_enabled: false,
                    failed_attempts: 0,
                    locked_until: null
                });

            // Update dine_users table
            await supabaseAdmin
                .from('dine_users')
                .upsert({
                    id: userId,
                    name: name.trim(),
                    email: cleanEmail,
                    phone: cleanPhone,
                    employee_id: employeeId,
                    password_hash: passwordHash,
                    role: 'OWNER',
                    status: 'inactive',
                    restaurant_id: null
                });

        } else {
            // New account creation
            userId = crypto.randomUUID();

            // 1. Create employees record
            const { error: empError } = await supabaseAdmin
                .from('employees')
                .insert({
                    id: userId,
                    name: name.trim(),
                    email: cleanEmail,
                    mobile: cleanPhone,
                    role: 'owner',
                    employee_id: employeeId,
                    status: 'pending',
                    approval_status: 'pending',
                    restaurant_id: null,
                    session_version: 1,
                    is_deleted: false
                });

            if (empError) {
                console.error('Failed to create employee record:', empError);
                return NextResponse.json({ error: 'Failed to create user account: ' + empError.message }, { status: 500 });
            }

            // 2. Create auth record
            const { error: authError } = await supabaseAdmin
                .from('auth')
                .insert({
                    user_id: userId,
                    password_hash: passwordHash,
                    mfa_enabled: false,
                    failed_attempts: 0
                });

            if (authError) {
                console.error('Failed to create auth record:', authError);
                await supabaseAdmin.from('employees').delete().eq('id', userId);
                return NextResponse.json({ error: 'Failed to configure account security' }, { status: 500 });
            }

            // 3. Create dine_users record
            await supabaseAdmin
                .from('dine_users')
                .insert({
                    id: userId,
                    name: name.trim(),
                    email: cleanEmail,
                    phone: cleanPhone,
                    employee_id: employeeId,
                    password_hash: passwordHash,
                    role: 'OWNER',
                    status: 'inactive',
                    restaurant_id: null
                });
        }

        // 4. Create session and set cookie
        const sessionId = crypto.randomUUID();
        const token = await signJwt({
            sessionId,
            userId,
            name: name.trim(),
            role: 'owner',
            sessionVersion: 1,
            email: cleanEmail,
            mobile: cleanPhone,
            restaurantId: null,
            restaurant_id: null
        });

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        await supabaseAdmin
            .from('dine_sessions')
            .insert({
                id: sessionId,
                user_id: userId,
                token_hash: tokenHash,
                device_info: request.headers.get('user-agent') || 'Browser',
                ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1',
                is_active: true
            });

        const isHttps = request.url.startsWith('https://') || request.headers.get('x-forwarded-proto') === 'https';
        const isSecure = process.env.NODE_ENV === 'production' && isHttps;

        const cookieStore = await cookies();
        const cookieOpts = {
            secure: isSecure,
            sameSite: 'lax' as const,
            path: '/',
            maxAge: 3600 * 8
        };
        cookieStore.set('dine_auth_token', token, cookieOpts);
        cookieStore.set('dine_auth_token_admin', token, cookieOpts);

        // Clear OTPs from store
        OtpManager.clear(cleanPhone);
        OtpManager.clear(cleanEmail);

        return NextResponse.json({
            success: true,
            userId,
            user: {
                id: userId,
                name: name.trim(),
                email: cleanEmail,
                mobile: cleanPhone,
                role: 'restaurant_admin'
            }
        });

    } catch (err: any) {
        console.error('Owner register error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
