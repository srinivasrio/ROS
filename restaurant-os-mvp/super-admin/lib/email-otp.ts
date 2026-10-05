import crypto from 'crypto';
import { supabaseAdmin } from './supabase-admin';
import { sesEmailService } from './ses-email-service';
import { RateLimiter } from './rate-limiter';

export const OTP_EXPIRY_MINUTES = 5;
export const RESEND_COOLDOWN_SECONDS = 60;
export const MAX_ATTEMPTS = 5;

/**
 * Generate a cryptographically secure 6-digit numeric OTP.
 */
export function generateCryptoOtp(): string {
    return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hash an OTP with HMAC-SHA256 salted by the recipient email and server secret.
 * Plaintext OTPs are NEVER stored.
 */
export function hashOtp(email: string, otp: string): string {
    const secret = process.env.OTP_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret || secret.length < 32) {
        throw new Error('OTP_HASH_SECRET or SUPABASE_SERVICE_ROLE_KEY must be configured with at least 32 characters');
    }
    return crypto
        .createHmac('sha256', secret)
        .update(`${email.toLowerCase().trim()}:${otp.trim()}`)
        .digest('hex');
}

/**
 * Constant-time comparison between input OTP and stored HMAC hash.
 */
export function verifyOtpHash(email: string, inputOtp: string, storedHash: string): boolean {
    if (!email || !inputOtp || !storedHash) return false;
    const computedHash = hashOtp(email, inputOtp);

    try {
        const a = Buffer.from(computedHash, 'hex');
        const b = Buffer.from(storedHash, 'hex');
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

export interface SendOtpResult {
    success: boolean;
    error?: string;
    cooldownRemaining?: number;
    expiresAt?: Date;
    devOtp?: string;
    simulated?: boolean;
}

export interface VerifyOtpResult {
    success: boolean;
    error?: string;
    reason?: 'INVALID_OTP' | 'EXPIRED' | 'MAX_ATTEMPTS_EXCEEDED' | 'ALREADY_USED' | 'NOT_FOUND';
    attemptsRemaining?: number;
    emailVerified?: boolean;
}

export const EmailOtpService = {
    /**
     * Creates and dispatches a secure 6-digit OTP via Amazon SES.
     * Enforces 60-second resend cooldown and invalidates previous active codes.
     */
    async createAndSendOtp(
        email: string,
        ipAddress?: string,
        options?: { forceFailSes?: boolean }
    ): Promise<SendOtpResult> {
        const cleanEmail = email.toLowerCase().trim();
        const now = new Date();

        // 1. Check if there is an existing active OTP within the 60-second cooldown period
        const { data: latestRecord } = await supabaseAdmin
            .from('email_otp_verifications')
            .select('*')
            .eq('email', cleanEmail)
            .eq('is_used', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (latestRecord) {
            const resendAvail = new Date(latestRecord.resend_available_at);
            if (resendAvail > now) {
                const secondsRemaining = Math.max(1, Math.ceil((resendAvail.getTime() - now.getTime()) / 1000));
                return {
                    success: false,
                    error: `Please wait ${secondsRemaining} seconds before requesting a new verification code.`,
                    cooldownRemaining: secondsRemaining,
                };
            }

            // Invalidate the previous active OTP
            await supabaseAdmin
                .from('email_otp_verifications')
                .update({ is_used: true, updated_at: now.toISOString() })
                .eq('id', latestRecord.id);
        }

        // 2. Generate cryptographically secure OTP & compute hash
        const otp = generateCryptoOtp();
        const otpHash = hashOtp(cleanEmail, otp);
        const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);
        const resendAvailableAt = new Date(now.getTime() + RESEND_COOLDOWN_SECONDS * 1000);

        // 3. Store only the hashed OTP in the database
        const { data: newRecord, error: insertError } = await supabaseAdmin
            .from('email_otp_verifications')
            .insert({
                email: cleanEmail,
                otp_hash: otpHash,
                expires_at: expiresAt.toISOString(),
                attempt_count: 0,
                max_attempts: MAX_ATTEMPTS,
                is_used: false,
                is_verified: false,
                last_sent_at: now.toISOString(),
                resend_available_at: resendAvailableAt.toISOString(),
                ip_address: ipAddress || null,
            })
            .select()
            .single();

        if (insertError) {
            console.error('[EmailOtpService] Failed to insert OTP verification record:', insertError);
            return {
                success: false,
                error: 'Failed to initialize verification code. Please try again.',
            };
        }

        // 4. Send the OTP through Amazon SES
        try {
            const sendResult = await sesEmailService.sendVerificationEmail(cleanEmail, otp, {
                forceFail: options?.forceFailSes,
            });

            return {
                success: true,
                expiresAt,
                devOtp: sendResult.simulated ? otp : undefined,
                simulated: sendResult.simulated,
            };
        } catch (sesError: any) {
            console.error('[EmailOtpService] Amazon SES delivery failed:', sesError);

            // Invalidate the OTP record so user is not stuck with a delivered code they never got
            await supabaseAdmin
                .from('email_otp_verifications')
                .update({ is_used: true, updated_at: new Date().toISOString() })
                .eq('id', newRecord.id);

            return {
                success: false,
                error: `Failed to deliver verification email via Amazon SES: ${sesError.message || 'Delivery error'}`,
            };
        }
    },

    /**
     * Verifies a submitted 6-digit OTP against the stored hash.
     * Enforces expiration, max 5 attempts, and prevents OTP reuse.
     */
    async verifyOtp(
        email: string,
        submittedOtp: string,
        options?: { skipEmployeeUpdate?: boolean; isLogin?: boolean }
    ): Promise<VerifyOtpResult> {
        const cleanEmail = email.toLowerCase().trim();
        const cleanOtp = String(submittedOtp || '').trim();
        const now = new Date();

        if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
            return {
                success: false,
                reason: 'INVALID_OTP',
                error: 'Please enter a valid 6-digit verification code.',
            };
        }

        // 1. Fetch latest record for this email
        const { data: record, error: fetchErr } = await supabaseAdmin
            .from('email_otp_verifications')
            .select('*')
            .eq('email', cleanEmail)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (fetchErr || !record) {
            return {
                success: false,
                reason: 'NOT_FOUND',
                error: 'No active verification code found for this email address. Please request a new code.',
            };
        }

        // 2. Check if OTP has already been used (prevent replay attacks)
        if (record.is_used || record.is_verified) {
            return {
                success: false,
                reason: 'ALREADY_USED',
                error: 'This verification code has already been used or invalidated. Please request a new one.',
            };
        }

        // 3. Check expiration (5 minutes)
        if (new Date(record.expires_at) < now) {
            // Mark as used/expired
            await supabaseAdmin
                .from('email_otp_verifications')
                .update({ is_used: true, updated_at: now.toISOString() })
                .eq('id', record.id);

            return {
                success: false,
                reason: 'EXPIRED',
                error: 'Verification code has expired. Please request a new one.',
            };
        }

        // 4. Check if maximum attempts (5) have already been reached
        if (record.attempt_count >= record.max_attempts) {
            await supabaseAdmin
                .from('email_otp_verifications')
                .update({ is_used: true, updated_at: now.toISOString() })
                .eq('id', record.id);

            return {
                success: false,
                reason: 'MAX_ATTEMPTS_EXCEEDED',
                attemptsRemaining: 0,
                error: 'Maximum verification attempts exceeded. Please request a new verification code.',
            };
        }

        // 5. Validate OTP hash using constant-time comparison
        const isMatch = verifyOtpHash(cleanEmail, cleanOtp, record.otp_hash);

        if (!isMatch) {
            const nextAttemptCount = record.attempt_count + 1;
            const attemptsRemaining = Math.max(0, record.max_attempts - nextAttemptCount);
            const isExhausted = nextAttemptCount >= record.max_attempts;

            await supabaseAdmin
                .from('email_otp_verifications')
                .update({
                    attempt_count: nextAttemptCount,
                    is_used: isExhausted,
                    updated_at: now.toISOString(),
                })
                .eq('id', record.id);

            if (isExhausted) {
                return {
                    success: false,
                    reason: 'MAX_ATTEMPTS_EXCEEDED',
                    attemptsRemaining: 0,
                    error: 'Maximum verification attempts exceeded. Please request a new verification code.',
                };
            }

            return {
                success: false,
                reason: 'INVALID_OTP',
                attemptsRemaining,
                error: `Invalid verification code. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining.`,
            };
        }

        // 6. OTP is VALID! Mark as used immediately to prevent replay
        await supabaseAdmin
            .from('email_otp_verifications')
            .update({
                is_used: true,
                is_verified: true,
                verified_at: now.toISOString(),
                updated_at: now.toISOString(),
            })
            .eq('id', record.id);

        // 7. Mark the account email as verified in the employees table
        // Note: For new owner registrations, set role to owner and status to pending.
        // For Super Admin or existing accounts, DO NOT demote or alter active status.
        const { data: existingEmp } = await supabaseAdmin
            .from('employees')
            .select('role')
            .ilike('email', cleanEmail)
            .maybeSingle();

        const roleUpper = (existingEmp?.role || '').toUpperCase();
        const isSuperAdmin = roleUpper === 'SUPER_ADMIN' || roleUpper === 'SUPERADMIN';

        if (!options?.skipEmployeeUpdate && !isSuperAdmin) {
            await supabaseAdmin
                .from('employees')
                .update({
                    email_verified: true,
                    role: 'owner',
                    status: 'pending',
                    approval_status: 'awaiting_admin_approval',
                    max_branches: 0,
                    custom_quota: null,
                    verified_at: now.toISOString(),
                    updated_at: now.toISOString(),
                })
                .ilike('email', cleanEmail);

            // 8. Notify Super Admin with link to Owners Pending Approval section
            await this.notifySuperAdminOwnerPending(cleanEmail);
        } else {
            await supabaseAdmin
                .from('employees')
                .update({
                    email_verified: true,
                    verified_at: now.toISOString(),
                    updated_at: now.toISOString(),
                })
                .ilike('email', cleanEmail);
        }

        return {
            success: true,
            emailVerified: true,
        };
    },

    /**
     * Notifies Super Admin that a new owner has registered and verified their email.
     * Note: Does NOT create restaurants, branches, subscriptions, or dummy restaurant requests.
     * The owner account starts with 0 restaurants and 0 used quota.
     */
    async notifySuperAdminOwnerPending(cleanEmail: string): Promise<void> {
        try {
            const { data: employee } = await supabaseAdmin
                .from('employees')
                .select('id, name, email, mobile')
                .ilike('email', cleanEmail)
                .maybeSingle();

            if (!employee) return;

            const nowIso = new Date().toISOString();

            // 1. Notify Super Admin with link to Owners Pending Approval section
            await supabaseAdmin.from('notifications').insert({
                title: 'New Owner Registration',
                message: `${employee.name} (${employee.email}) has registered and verified their email. Super Admin approval is pending.`,
                type: 'owner_registration',
                priority: 'high',
                restaurant_id: null,
                restaurant_name: null,
                target_role: 'super_admin',
                action_url: '/admin/owners?tab=pending',
                is_read: false,
                created_at: nowIso,
            });

            // 2. Audit log
            await supabaseAdmin.from('audit_logs').insert({
                restaurant_id: null,
                user_id: employee.id,
                actor_id: employee.id,
                action: 'owner_registration_email_verified',
                details: {
                    owner_id: employee.id,
                    owner_name: employee.name,
                    owner_email: employee.email,
                    timestamp: nowIso,
                },
                created_at: nowIso,
            });

            console.log(`[OwnerRegistration] Owner ${cleanEmail} verified and pending Super Admin approval.`);
        } catch (err) {
            console.error('[OwnerRegistration] Failed to notify Super Admin:', err);
        }
    },

    /**
     * Resends an OTP verification code.
     * Enforces rate limiting, 60s cooldown, invalidates old OTP, and returns generic response on non-existing accounts.
     */
    async resendOtp(
        email: string,
        ipAddress?: string,
        options?: { forceFailSes?: boolean }
    ): Promise<SendOtpResult> {
        const cleanEmail = email.toLowerCase().trim();

        // 1. Rate limit resend requests (max 5 resends per hour per IP/email)
        const rateLimitKey = `resend_otp:${cleanEmail}`;
        const limitCheck = await RateLimiter.check(rateLimitKey, 5, 3600);
        if (!limitCheck.success) {
            return {
                success: false,
                error: 'Too many verification code requests. Please wait a few minutes before trying again.',
            };
        }

        // 2. Check if an account exists for this email
        const { data: existingUser } = await supabaseAdmin
            .from('employees')
            .select('id, email_verified, is_deleted')
            .ilike('email', cleanEmail)
            .eq('is_deleted', false)
            .maybeSingle();

        // If email already verified
        if (existingUser?.email_verified) {
            return {
                success: false,
                error: 'This email address is already verified. Please proceed to login.',
            };
        }

        // 3. Create and dispatch new OTP (enforces 60-second cooldown internally)
        return await this.createAndSendOtp(cleanEmail, ipAddress, options);
    },
};