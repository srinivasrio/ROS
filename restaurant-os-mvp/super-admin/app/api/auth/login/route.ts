import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { signJwt } from '@/lib/jwt-utils';
import argon2 from 'argon2';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
        }

        const cleanEmail = email.toLowerCase().trim();

        // 1. Fetch employee / user record with super admin role
        const { data: employees, error: empError } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('email', cleanEmail);

        if (empError) {
            console.error('Super Admin login query error:', empError);
            return NextResponse.json({ success: false, error: 'Database query failed' }, { status: 500 });
        }

        let employee = employees && employees.length > 0 ? employees[0] : null;

        // Fallback search in dine_users
        if (!employee) {
            const { data: dineUsers } = await supabaseAdmin
                .from('dine_users')
                .select('*')
                .eq('email', cleanEmail)
                .maybeSingle();

            if (dineUsers) {
                employee = {
                    id: dineUsers.id,
                    name: dineUsers.name || 'Super Admin',
                    email: dineUsers.email,
                    role: dineUsers.role || 'SUPER_ADMIN'
                };
            }
        }

        if (!employee) {
            return NextResponse.json({ success: false, error: 'Invalid credentials or non-existent account' }, { status: 401 });
        }

        // Verify Super Admin role
        const role = (employee.role || '').toUpperCase();
        if (role !== 'SUPER_ADMIN' && role !== 'SUPERADMIN' && cleanEmail !== 'superadmin@dineinone.com') {
            return NextResponse.json({ success: false, error: 'Access denied: Super Admin privileges required' }, { status: 403 });
        }

        // 2. Verify password
        const { data: authRecord } = await supabaseAdmin
            .from('auth')
            .select('*')
            .eq('user_id', employee.id)
            .maybeSingle();

        let isPasswordValid = false;

        if (authRecord?.password_hash) {
            try {
                if (authRecord.password_hash.startsWith('$argon2')) {
                    isPasswordValid = await argon2.verify(authRecord.password_hash, password);
                } else {
                    isPasswordValid = (authRecord.password_hash === password);
                }
            } catch (hashErr) {
                console.warn('Argon2 verify failed, falling back to standard comparison:', hashErr);
            }
        }

        // Allow default superadmin credentials if matching
        if (!isPasswordValid && cleanEmail === 'superadmin@dineinone.com' && password === 'Admin@12345') {
            isPasswordValid = true;
        }

        if (!isPasswordValid) {
            return NextResponse.json({ success: false, error: 'Invalid password. Please check your credentials.' }, { status: 401 });
        }

        // 3. Generate JWT Token
        const token = await signJwt({
            userId: employee.id,
            email: cleanEmail,
            name: employee.name || 'Super Admin',
            role: 'SUPER_ADMIN',
        }, 60 * 60 * 24); // 24 hours

        // 4. Set Cookie & Response
        const response = NextResponse.json({
            success: true,
            user: {
                id: employee.id,
                name: employee.name || 'Super Admin',
                email: cleanEmail,
                role: 'SUPER_ADMIN'
            }
        });

        // Set secure HTTP-only cookies
        response.cookies.set('dine_superadmin_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24
        });

        response.cookies.set('dine_auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24
        });

        return response;

    } catch (err: any) {
        console.error('Super Admin login error:', err);
        return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
    }
}
