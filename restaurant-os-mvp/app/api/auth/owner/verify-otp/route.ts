import { NextResponse } from 'next/server';
import { OtpManager } from '@/lib/otp-store';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, target, otp } = body;

        if (!type || !target || !otp) {
            return NextResponse.json({ error: 'Type, target, and OTP are required' }, { status: 400 });
        }

        const cleanTarget = type === 'mobile' 
            ? target.replace(/[^0-9]/g, '') 
            : target.toLowerCase().trim();

        const isValid = OtpManager.verifyOtp(cleanTarget, otp.toString().trim());

        if (!isValid) {
            return NextResponse.json({ error: 'Invalid or expired verification code. Please try again.' }, { status: 401 });
        }

        return NextResponse.json({
            success: true,
            verified: true,
            message: `${type === 'mobile' ? 'Mobile number' : 'Email'} successfully verified`
        });

    } catch (err: any) {
        console.error('verify-otp error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
