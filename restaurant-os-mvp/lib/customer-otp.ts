import crypto from 'crypto';
import { supabaseAdmin } from './supabase-admin';
import { RateLimiter } from './rate-limiter';

export const CUSTOMER_OTP_EXPIRY_MINUTES = 5;
export const CUSTOMER_RESEND_COOLDOWN_SECONDS = 60;
export const CUSTOMER_MAX_ATTEMPTS = 5;

/**
 * Clean and standardize phone number to 10 digits
 */
export function sanitizePhone(phone: string): string {
    return phone.replace(/\D/g, '').slice(-10);
}

/**
 * Generate cryptographically secure 6-digit numeric OTP
 */
export function generateCryptoOtp(): string {
    return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hash an OTP with HMAC-SHA256 salted with restaurantId and phone.
 * Plaintext OTPs are NEVER stored in the database.
 */
export function hashCustomerOtp(restaurantId: string, phone: string, otp: string): string {
    const cleanPhone = sanitizePhone(phone);
    const cleanRestId = restaurantId.trim();
    const secret = process.env.OTP_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!secret || secret.length < 32) {
        throw new Error('OTP_HASH_SECRET or SUPABASE_SERVICE_ROLE_KEY must be configured with at least 32 characters');
    }

    return crypto
        .createHmac('sha256', secret)
        .update(`customer:${cleanRestId}:${cleanPhone}:${otp.trim()}`)
        .digest('hex');
}

/**
 * Constant-time comparison between input OTP and stored HMAC hash.
 */
export function verifyCustomerOtpHash(
    restaurantId: string,
    phone: string,
    inputOtp: string,
    storedHash: string
): boolean {
    if (!restaurantId || !phone || !inputOtp || !storedHash) return false;
    const computedHash = hashCustomerOtp(restaurantId, phone, inputOtp);

    try {
        const a = Buffer.from(computedHash, 'hex');
        const b = Buffer.from(storedHash, 'hex');
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

/**
 * Dispatch OTP via MSG91 SMS Service
 * Uses MSG91_AUTH_KEY and MSG91_TEMPLATE_ID environment variables.
 * Gracefully handles unconfigured keys by returning devMode: true for development/testing.
 */
export async function sendMsg91Otp(
    phone: string,
    otp: string
): Promise<{ success: boolean; error?: string; devMode?: boolean }> {
    const cleanPhone = sanitizePhone(phone);
    const authKey = process.env.MSG91_AUTH_KEY?.trim();
    const templateId = (process.env.MSG91_TEMPLATE_ID || process.env.MSG91_OTP_TEMPLATE_ID)?.trim();

    if (!authKey || !templateId) {
        console.warn(
            `[MSG91 OTP Service] Keys not configured yet. (Set MSG91_AUTH_KEY and MSG91_TEMPLATE_ID in environment). Generated verification code for +91 ${cleanPhone}: ${otp}`
        );
        return { success: true, devMode: true };
    }

    try {
        const fullPhone = `91${cleanPhone}`;
        const url = `https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(templateId)}&mobile=${encodeURIComponent(fullPhone)}&authkey=${encodeURIComponent(authKey)}&otp=${encodeURIComponent(otp)}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                authkey: authKey,
            },
            body: JSON.stringify({
                template_id: templateId,
                mobile: fullPhone,
                otp: otp,
            }),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok || (data && data.type === 'error')) {
            console.error('[MSG91 Error]', data || response.statusText);
            return {
                success: false,
                error: data?.message || 'Failed to dispatch SMS verification code via MSG91',
            };
        }

        console.log(`[MSG91 Success] OTP dispatched successfully to +91 ${cleanPhone}`);
        return { success: true };
    } catch (err: any) {
        console.error('[MSG91 Uncaught Exception]', err);
        return {
            success: false,
            error: err.message || 'Error communicating with MSG91 gateway',
        };
    }
}

export interface SendCustomerOtpResult {
    success: boolean;
    error?: string;
    cooldownRemainingSeconds?: number;
    expiresAt?: Date;
    devOtp?: string;
    maskedPhone?: string;
}

export interface VerifyCustomerOtpResult {
    success: boolean;
    error?: string;
    remainingAttempts?: number;
    customerId?: string;
}

export const CustomerOtpService = {
    /**
     * Send or generate an OTP for customer phone authentication
     */
    async sendOtp(
        restaurantId: string,
        phone: string,
        ipAddress: string = '127.0.0.1'
    ): Promise<SendCustomerOtpResult> {
        const cleanPhone = sanitizePhone(phone);
        if (cleanPhone.length !== 10) {
            return { success: false, error: 'A valid 10-digit mobile number is required' };
        }

        const cleanRestId = restaurantId.trim();
        if (!cleanRestId) {
            return { success: false, error: 'Restaurant ID is required' };
        }

        // 1. Check rate limits (max 5 OTP requests per 5 minutes per phone/IP)
        const rateCheck = await RateLimiter.checkCustomerOtp(cleanPhone, ipAddress);
        if (!rateCheck.success) {
            return {
                success: false,
                error: `Too many OTP requests. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`,
                cooldownRemainingSeconds: rateCheck.retryAfterSeconds,
            };
        }

        const now = new Date();

        // 2. Check for active unexpired OTP cooldown
        const { data: existingOtp } = await supabaseAdmin
            .from('customer_phone_otps')
            .select('id, resend_available_at, expires_at, is_used')
            .eq('restaurant_id', cleanRestId)
            .eq('phone', cleanPhone)
            .eq('is_used', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (existingOtp && existingOtp.resend_available_at) {
            const resendAvailableAt = new Date(existingOtp.resend_available_at);
            if (resendAvailableAt > now) {
                const cooldown = Math.ceil((resendAvailableAt.getTime() - now.getTime()) / 1000);
                return {
                    success: false,
                    error: `Please wait ${cooldown} seconds before requesting a new verification code.`,
                    cooldownRemainingSeconds: cooldown,
                };
            }
        }

        // 3. Invalidate any existing unused OTPs for this phone/restaurant
        await supabaseAdmin
            .from('customer_phone_otps')
            .update({ is_used: true, updated_at: now.toISOString() })
            .eq('restaurant_id', cleanRestId)
            .eq('phone', cleanPhone)
            .eq('is_used', false);

        // 4. Generate cryptographically secure OTP
        const isExplicitDev = process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_OTP === 'true';
        const rawOtp = isExplicitDev && process.env.TEST_FIXED_CUSTOMER_OTP ? process.env.TEST_FIXED_CUSTOMER_OTP : generateCryptoOtp();
        const otpHash = hashCustomerOtp(cleanRestId, cleanPhone, rawOtp);

        const expiresAt = new Date(now.getTime() + CUSTOMER_OTP_EXPIRY_MINUTES * 60 * 1000);
        const resendAvailableAt = new Date(now.getTime() + CUSTOMER_RESEND_COOLDOWN_SECONDS * 1000);

        // 5. Store OTP record in database (strictly service_role)
        const { error: insertErr } = await supabaseAdmin
            .from('customer_phone_otps')
            .insert({
                restaurant_id: cleanRestId,
                phone: cleanPhone,
                otp_hash: otpHash,
                expires_at: expiresAt.toISOString(),
                resend_available_at: resendAvailableAt.toISOString(),
                attempt_count: 0,
                max_attempts: CUSTOMER_MAX_ATTEMPTS,
                is_used: false,
                is_verified: false,
                ip_address: ipAddress,
            });

        if (insertErr) {
            console.error('[CustomerOtpService] Insert error:', insertErr);
            return { success: false, error: 'Failed to initiate OTP verification' };
        }

        // 6. Dispatch SMS via MSG91
        const smsResult = await sendMsg91Otp(cleanPhone, rawOtp);
        if (!smsResult.success && !smsResult.devMode) {
            return {
                success: false,
                error: smsResult.error || 'Failed to dispatch SMS verification code via MSG91',
            };
        }

        // In test/dev environment or when MSG91 keys are pending, safely expose devOtp for immediate testing
        const devOtp = (isExplicitDev || smsResult.devMode) ? rawOtp : undefined;

        return {
            success: true,
            cooldownRemainingSeconds: CUSTOMER_RESEND_COOLDOWN_SECONDS,
            expiresAt,
            maskedPhone: `+91 ******${cleanPhone.slice(-4)}`,
            devOtp,
        };
    },

    /**
     * Verify customer OTP and mark as verified/used
     */
    async verifyOtp(
        restaurantId: string,
        phone: string,
        inputOtp: string,
        ipAddress: string = '127.0.0.1'
    ): Promise<VerifyCustomerOtpResult> {
        const cleanPhone = sanitizePhone(phone);
        if (cleanPhone.length !== 10) {
            return { success: false, error: 'A valid 10-digit mobile number is required' };
        }

        const cleanRestId = restaurantId.trim();
        if (!cleanRestId) {
            return { success: false, error: 'Restaurant ID is required' };
        }

        if (!inputOtp || !/^\d{6}$/.test(inputOtp.trim())) {
            return { success: false, error: 'Please enter a valid 6-digit OTP code' };
        }

        // 1. Rate limiter check on verification attempts
        const rateCheck = await RateLimiter.checkCustomerOtp(cleanPhone, ipAddress);
        if (!rateCheck.success) {
            return {
                success: false,
                error: 'Too many verification attempts. Please request a new code.',
            };
        }

        const now = new Date();

        // 2. Fetch the latest active OTP for this restaurant and phone
        const { data: record, error: fetchErr } = await supabaseAdmin
            .from('customer_phone_otps')
            .select('*')
            .eq('restaurant_id', cleanRestId)
            .eq('phone', cleanPhone)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (fetchErr || !record) {
            return { success: false, error: 'No verification code found. Please request a new one.' };
        }

        // 3. Check if already used
        if (record.is_used) {
            return { success: false, error: 'This verification code has already been used. Please request a new one.' };
        }

        // 4. Check if expired
        const expiresAt = new Date(record.expires_at);
        if (now > expiresAt) {
            await supabaseAdmin
                .from('customer_phone_otps')
                .update({ is_used: true, updated_at: now.toISOString() })
                .eq('id', record.id);

            return { success: false, error: 'Verification code has expired. Please request a new one.' };
        }

        // 5. Check attempt count
        const currentAttempts = Number(record.attempt_count || 0);
        const maxAttempts = Number(record.max_attempts || CUSTOMER_MAX_ATTEMPTS);

        if (currentAttempts >= maxAttempts) {
            await supabaseAdmin
                .from('customer_phone_otps')
                .update({ is_used: true, updated_at: now.toISOString() })
                .eq('id', record.id);

            return {
                success: false,
                error: 'Too many incorrect attempts. This code is now locked. Please request a new one.',
                remainingAttempts: 0,
            };
        }

        // 6. Verify hash
        const isMatch = verifyCustomerOtpHash(cleanRestId, cleanPhone, inputOtp.trim(), record.otp_hash);

        if (!isMatch) {
            const newAttempts = currentAttempts + 1;
            const remaining = Math.max(0, maxAttempts - newAttempts);

            await supabaseAdmin
                .from('customer_phone_otps')
                .update({
                    attempt_count: newAttempts,
                    is_used: newAttempts >= maxAttempts,
                    updated_at: now.toISOString(),
                })
                .eq('id', record.id);

            if (remaining === 0) {
                return {
                    success: false,
                    error: 'Incorrect verification code. Too many attempts. Please request a new code.',
                    remainingAttempts: 0,
                };
            }

            return {
                success: false,
                error: `Incorrect verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
                remainingAttempts: remaining,
            };
        }

        // 7. OTP is valid! Mark as verified and used (prevent replay)
        await supabaseAdmin
            .from('customer_phone_otps')
            .update({
                is_used: true,
                is_verified: true,
                updated_at: now.toISOString(),
            })
            .eq('id', record.id);

        return { success: true };
    },
};
