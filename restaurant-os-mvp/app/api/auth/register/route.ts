import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { seedRestaurantDefaults } from '@/lib/restaurant-defaults';
import { hashPassword } from '@/lib/auth-utils';
import { EmailOtpService } from '@/lib/email-otp';
import { RateLimiter } from '@/lib/rate-limiter';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/;

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

        // ------------------------------------------------------------------
        // Branch A: Legacy Multi-Step Restaurant Onboarding (if restaurants[])
        // ------------------------------------------------------------------
        if (body.restaurants && Array.isArray(body.restaurants) && body.restaurants.length > 0) {
            const { ownerName, mobileNumber, email, selectedPackage, restaurants } = body;
            const resData = restaurants[0];

            const datePart = '2026' + new Date().toISOString().slice(5, 10).replace(/-/g, '');
            const randomPart = Math.floor(1000 + Math.random() * 9000).toString();
            const tempRestaurantId = `PEND-${datePart}${randomPart}`;

            const { error: resError } = await supabaseAdmin
                .from('restaurants')
                .insert({
                    id: tempRestaurantId,
                    name: resData.name,
                    owner_name: ownerName,
                    phone: mobileNumber,
                    email: email,
                    address: resData.address || null,
                    opening_date: resData.openingDate || null,
                    operating_hours: resData.operatingHours || {},
                    subscription_plan: selectedPackage,
                    status: 'pending'
                });

            if (resError) {
                console.error('Pending restaurant insert error:', resError);
                return NextResponse.json({ error: resError.message }, { status: 500 });
            }

            const { error: legalError } = await supabaseAdmin
                .from('restaurant_legal')
                .insert({
                    restaurant_ref: tempRestaurantId,
                    business_name: resData.name,
                    business_type: resData.businessType,
                    gst_number: resData.gstNumber,
                    fssai_number: resData.fssaiNumber,
                    license_number: resData.fssaiNumber,
                    pan_number: resData.panCard,
                    shop_establishment_license: resData.shopLicense,
                    status: 'pending'
                });

            if (legalError) {
                console.error('Pending legal insert error:', legalError);
            }

            await seedRestaurantDefaults(tempRestaurantId, {
                name: resData.name,
                phone: mobileNumber,
                email,
                address: resData.address || '',
                businessType: resData.businessType
            });

            return NextResponse.json({ 
                success: true, 
                restaurantId: tempRestaurantId 
            });
        }

        // ------------------------------------------------------------------
        // Branch B: Dine in One Create Account Registration Flow
        // ------------------------------------------------------------------
        const fullName = (body.fullName || body.name || '').trim();
        const email = (body.email || '').toLowerCase().trim();
        const phone = (body.phone || body.mobile || '').replace(/[^0-9]/g, '');
        const password = body.password || '';

        // 1. Validate all registration fields
        if (!fullName) {
            return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
        }
        if (fullName.length < 2) {
            return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: 400 });
        }

        if (!email) {
            return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
        }
        if (!EMAIL_RE.test(email)) {
            return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
        }

        if (!phone) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }
        if (!PHONE_RE.test(phone)) {
            return NextResponse.json({ error: 'Enter a valid 10-digit Indian mobile number' }, { status: 400 });
        }

        if (!password) {
            return NextResponse.json({ error: 'Password is required' }, { status: 400 });
        }
        if (password.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
        }
        if (!/[A-Z]/.test(password)) {
            return NextResponse.json({ error: 'Password must include at least one uppercase letter' }, { status: 400 });
        }
        if (!/[0-9]/.test(password)) {
            return NextResponse.json({ error: 'Password must include at least one number' }, { status: 400 });
        }

        // Rate limiting: 10 registration requests per hour per IP
        const rateCheck = await RateLimiter.check(`reg_ip:${clientIp}`, 10, 3600);
        if (!rateCheck.success) {
            return NextResponse.json(
                { error: 'Too many registration attempts. Please try again later.' },
                { status: 429 }
            );
        }

        // 2. Check whether the email is already registered and verified
        const { data: existingUser } = await supabaseAdmin
            .from('employees')
            .select('id, email, email_verified, is_deleted, status')
            .ilike('email', email)
            .eq('is_deleted', false)
            .maybeSingle();

        if (existingUser && existingUser.email_verified) {
            return NextResponse.json(
                { error: 'An account with this email address is already registered. Please login.' },
                { status: 409 }
            );
        }

        // 3. Hash password with Argon2id
        const passwordHash = await hashPassword(password);
        const employeeId = `OWN-${phone.slice(-6)}`;

        // Check if a soft-deleted or unverified stale record exists
        const { data: staleUser } = await supabaseAdmin
            .from('employees')
            .select('id')
            .ilike('email', email)
            .maybeSingle();

        let userId: string;

        if (staleUser) {
            userId = staleUser.id;
            await supabaseAdmin
                .from('employees')
                .update({
                    name: fullName,
                    email,
                    mobile: phone,
                    role: 'restaurant_admin',
                    employee_id: employeeId,
                    status: 'pending',
                    approval_status: 'pending_verification',
                    email_verified: false,
                    is_deleted: false,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', userId);

            await supabaseAdmin
                .from('auth')
                .upsert({
                    user_id: userId,
                    password_hash: passwordHash,
                    mfa_enabled: false,
                    failed_attempts: 0,
                    locked_until: null,
                });
        } else {
            userId = crypto.randomUUID();

            const { error: empErr } = await supabaseAdmin
                .from('employees')
                .insert({
                    id: userId,
                    name: fullName,
                    email,
                    mobile: phone,
                    role: 'restaurant_admin',
                    employee_id: employeeId,
                    status: 'pending',
                    approval_status: 'pending_verification',
                    email_verified: false,
                    is_deleted: false,
                });

            if (empErr) {
                console.error('[Registration API] Failed to create employee record:', empErr);
                return NextResponse.json({ error: 'Failed to create account record' }, { status: 500 });
            }

            const { error: authErr } = await supabaseAdmin
                .from('auth')
                .insert({
                    user_id: userId,
                    password_hash: passwordHash,
                    mfa_enabled: false,
                    failed_attempts: 0,
                });

            if (authErr) {
                console.error('[Registration API] Failed to create auth record:', authErr);
                await supabaseAdmin.from('employees').delete().eq('id', userId);
                return NextResponse.json({ error: 'Failed to initialize account security' }, { status: 500 });
            }
        }

        // 4, 5 & 6: Generate 6-digit OTP, store hashed in DB (5-min expiry), send via Amazon SES
        const otpResult = await EmailOtpService.createAndSendOtp(email, clientIp, {
            forceFailSes: body.forceFailSes === true,
        });

        if (!otpResult.success) {
            return NextResponse.json(
                { error: otpResult.error || 'Failed to dispatch email verification code via Amazon SES' },
                { status: otpResult.error?.includes('Amazon SES') ? 502 : 400 }
            );
        }

        return NextResponse.json({
            success: true,
            email,
            expiresAt: otpResult.expiresAt,
            devOtp: otpResult.devOtp,
            message: 'Verification code sent to your email address.',
        });

    } catch (error: any) {
        console.error('Registration API error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
