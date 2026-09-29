import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { OtpManager } from '@/lib/otp-store';
import { EmailService } from '@/lib/email-service';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, target } = body;

        if (!type || !target) {
            return NextResponse.json({ error: 'Verification type and target (phone or email) are required' }, { status: 400 });
        }

        const cleanTarget = target.trim();

        if (type === 'mobile') {
            const cleanPhone = cleanTarget.replace(/[^0-9]/g, '');
            if (cleanPhone.length < 10) {
                return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number' }, { status: 400 });
            }

            // Check if active restaurant owner already exists with this mobile
            const { data: existingUser } = await supabaseAdmin
                .from('employees')
                .select('id')
                .or(`mobile.eq.${cleanPhone},mobile.eq.+91${cleanPhone.slice(-10)}`)
                .eq('role', 'restaurant_admin')
                .eq('is_deleted', false)
                .maybeSingle();

            if (existingUser) {
                return NextResponse.json({ error: 'An owner account with this mobile number already exists. Please sign in.' }, { status: 409 });
            }

            // Generate 6-digit OTP
            const isDev = process.env.NODE_ENV === 'development' || !process.env.SMS_GATEWAY_API_KEY;
            const otp = isDev ? '123456' : crypto.randomInt(100000, 999999).toString();
            OtpManager.setOtp(cleanPhone, otp, 600);

            console.log(`[Owner Registration] Mobile OTP generated for ${cleanPhone}: ${otp}`);

            return NextResponse.json({
                success: true,
                message: `OTP sent successfully to mobile ending in ${cleanPhone.slice(-4)}`,
                devOtp: isDev ? otp : undefined
            });

        } else if (type === 'email') {
            const cleanEmail = cleanTarget.toLowerCase();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(cleanEmail)) {
                return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
            }

            // Check if email already exists
            const { data: existingEmail } = await supabaseAdmin
                .from('employees')
                .select('id')
                .eq('email', cleanEmail)
                .eq('is_deleted', false)
                .maybeSingle();

            if (existingEmail) {
                return NextResponse.json({ error: 'An account with this email address already exists' }, { status: 409 });
            }

            // Generate 6-digit OTP
            const isDev = process.env.NODE_ENV === 'development';
            const otp = isDev ? '123456' : crypto.randomInt(100000, 999999).toString();
            OtpManager.setOtp(cleanEmail, otp, 600);

            console.log(`[Owner Registration] Email OTP generated for ${cleanEmail}: ${otp}`);

            // Dispatch email
            await EmailService.sendSecurityEmail(
                cleanEmail,
                'Verify your Dine In One Account',
                `<h3>Welcome to Dine In One!</h3>
                <p>Your email verification code is: <strong style="font-size: 24px; letter-spacing: 4px; color: #FF6B6B;">${otp}</strong></p>
                <p>This code will expire in 10 minutes.</p>`
            );

            return NextResponse.json({
                success: true,
                message: `Verification code sent to ${cleanEmail}`,
                devOtp: isDev ? otp : undefined
            });

        } else {
            return NextResponse.json({ error: 'Invalid type. Expected "mobile" or "email"' }, { status: 400 });
        }

    } catch (err: any) {
        console.error('send-otp error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
