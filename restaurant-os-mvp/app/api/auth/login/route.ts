import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyPassword } from '@/lib/auth-utils';
import { signJwt } from '@/lib/jwt-utils';
import { RateLimiter } from '@/lib/rate-limiter';
import { recordAuthAuditLog, getAuthCookieOptions } from '@/lib/panel-auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/**
 * POST /api/auth/login
 * Dedicated secure authentication endpoint for Dine in One accounts.
 * Validates credentials, checks email verification and Super Admin approval states securely on the backend.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const rawEmail = String(body?.email || body?.identifier || '').toLowerCase().trim();
        const rawPassword = String(body?.password || '');

        // 1. Validate inputs
        if (!rawEmail) {
            return NextResponse.json(
                { error: 'Email address is required' },
                { status: 400 }
            );
        }

        if (!EMAIL_RE.test(rawEmail)) {
            return NextResponse.json(
                { error: 'Please enter a valid email address' },
                { status: 400 }
            );
        }

        if (!rawPassword) {
            return NextResponse.json(
                { error: 'Password is required' },
                { status: 400 }
            );
        }

        // 2. IP & Account Rate Limiting
        const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
        const userAgent = req.headers.get('user-agent') || 'unknown';
        const uaLower = userAgent.toLowerCase();
        const device = (uaLower.includes('mobile') || uaLower.includes('android') || uaLower.includes('iphone')) ? 'mobile' : 'desktop';
        const browser = uaLower.includes('chrome') ? 'chrome' : uaLower.includes('safari') ? 'safari' : uaLower.includes('firefox') ? 'firefox' : 'unknown';

        const ipLimit = await RateLimiter.check(`login_ip:${clientIp}`, 20, 60);
        if (!ipLimit.success) {
            return NextResponse.json(
                { error: 'Too many login attempts from this network. Please wait a moment.' },
                { status: 429 }
            );
        }

        // 3. Look up user by email in employees
        const { data: employee } = await supabaseAdmin
            .from('employees')
            .select('id, name, email, mobile, role, status, approval_status, email_verified, restaurant_id, branch_id, session_version, is_deleted, employee_id')
            .ilike('email', rawEmail)
            .eq('is_deleted', false)
            .maybeSingle();

        // Fallback search in users table for legacy records
        let userId = employee?.id;
        let userData = employee;

        if (!userData) {
            const { data: legacyUser } = await supabaseAdmin
                .from('users')
                .select('id, name, email, phone, role, status, restaurant_id')
                .ilike('email', rawEmail)
                .maybeSingle();

            if (legacyUser) {
                userId = legacyUser.id;
                userData = {
                    id: legacyUser.id,
                    name: legacyUser.name || 'User',
                    email: legacyUser.email,
                    mobile: legacyUser.phone || null,
                    role: legacyUser.role || 'restaurant_admin',
                    status: legacyUser.status || 'active',
                    approval_status: 'approved',
                    email_verified: true,
                    restaurant_id: legacyUser.restaurant_id || null,
                    branch_id: null,
                    session_version: 1,
                    is_deleted: false,
                    employee_id: `ADM-${legacyUser.id.slice(0, 6)}`,
                } as any;
            }
        }

        // If no user found, return generic invalid credentials without revealing email presence
        if (!userData || !userId) {
            return NextResponse.json(
                { error: 'Invalid email address or password.' },
                { status: 401 }
            );
        }

        // Enforce Account Separation: Restaurant Admins cannot log in via Owner Portal
        const candidateRole = String(userData.role || '').toLowerCase();
        if (['restaurant_admin', 'admin', 'branch_admin'].includes(candidateRole)) {
            return NextResponse.json(
                {
                    error: 'This email is registered as a Restaurant Admin and cannot access the Owner Portal. Please sign in via the Restaurant Admin panel at /login/admin.',
                    code: 'RESTAURANT_ADMIN_NOT_ALLOWED_HERE'
                },
                { status: 403 }
            );
        }

        // 4. Look up security credentials in auth table
        const { data: authRecord } = await supabaseAdmin
            .from('auth')
            .select('password_hash, failed_attempts, locked_until')
            .eq('user_id', userId)
            .maybeSingle();

        if (!authRecord || !authRecord.password_hash) {
            return NextResponse.json(
                { error: 'Invalid email address or password.' },
                { status: 401 }
            );
        }

        const now = new Date();

        // 5. Check if account is temporarily locked
        if (authRecord.locked_until && new Date(authRecord.locked_until) > now) {
            const remainingMinutes = Math.max(1, Math.ceil((new Date(authRecord.locked_until).getTime() - now.getTime()) / 60000));
            return NextResponse.json(
                { error: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}.` },
                { status: 423 }
            );
        }

        // 6. Verify password (Argon2id)
        const isPasswordValid = await verifyPassword(rawPassword, authRecord.password_hash);

        if (!isPasswordValid) {
            const newFailedAttempts = (authRecord.failed_attempts || 0) + 1;
            const isLockout = newFailedAttempts >= MAX_FAILED_ATTEMPTS;
            const lockedUntil = isLockout ? new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000).toISOString() : null;

            await supabaseAdmin
                .from('auth')
                .update({
                    failed_attempts: newFailedAttempts,
                    locked_until: lockedUntil,
                })
                .eq('user_id', userId);

            await recordAuthAuditLog({
                restaurantId: userData.restaurant_id,
                userId: userData.id,
                employeeId: userData.employee_id,
                action: 'login_failed',
                ip: clientIp,
                device,
                browser,
                details: { reason: 'invalid_password', failedAttempts: newFailedAttempts, locked: isLockout }
            });

            if (isLockout) {
                return NextResponse.json(
                    { error: `Too many failed attempts. Your account has been temporarily locked for ${LOCKOUT_MINUTES} minutes.` },
                    { status: 423 }
                );
            }

            return NextResponse.json(
                { error: 'Invalid email address or password.' },
                { status: 401 }
            );
        }

        // ------------------------------------------------------------------
        // 7. Secure Backend Status Validations (Never trust frontend state!)
        // ------------------------------------------------------------------

        // Check A: Email OTP Verification Status
        if (userData.email_verified === false) {
            return NextResponse.json(
                {
                    error: 'Your email address has not been verified yet. Please verify your email to continue.',
                    code: 'EMAIL_NOT_VERIFIED',
                    email: userData.email,
                },
                { status: 403 }
            );
        }

        // Check B: Super Admin Approval Status
        const currentStatus = String(userData.status || '').toLowerCase();
        const currentApproval = String(userData.approval_status || '').toLowerCase();

        // If rejected
        if (currentStatus === 'rejected' || currentApproval === 'rejected') {
            return NextResponse.json(
                {
                    error: 'Your account registration could not be approved. Please contact Dine in One support.',
                    code: 'ACCOUNT_REJECTED',
                },
                { status: 403 }
            );
        }

        // If suspended
        if (currentStatus === 'suspended' || currentApproval === 'suspended') {
            return NextResponse.json(
                {
                    error: 'Your account is currently suspended. Please contact Dine in One support.',
                    code: 'ACCOUNT_SUSPENDED',
                },
                { status: 403 }
            );
        }

        // Registered but not yet approved by Super Admin
        const isApprovedAndActive = (currentStatus === 'active' && currentApproval === 'approved');

        if (!isApprovedAndActive) {
            // Requirement 2:
            // "If an email/password belongs to a successfully registered account whose Super Admin approval is still pending, do not allow login. Show:
            // “Your account activation is currently under process. Dine in One will contact you once your account is activated.”"
            return NextResponse.json(
                {
                    error: 'Your account activation is currently under process. Dine in One will contact you once your account is activated.',
                    code: 'ACCOUNT_PENDING_APPROVAL',
                },
                { status: 403 }
            );
        }

        // Check C: Associated Restaurant & Branch Status
        const userRole = (userData.role || '').toLowerCase();
        if (['admin', 'restaurant_admin', 'waiter', 'kitchen', 'cashier', 'delivery_boy'].includes(userRole)) {
            if (!userData.restaurant_id) {
                return NextResponse.json(
                    { error: 'Account is not associated with any restaurant.', code: 'NO_RESTAURANT' },
                    { status: 403 }
                );
            }

            const { data: rest } = await supabaseAdmin
                .from('restaurants')
                .select('id, name, status, deleted_at')
                .eq('id', userData.restaurant_id)
                .maybeSingle();

            if (!rest || rest.deleted_at) {
                return NextResponse.json(
                    { error: 'The restaurant associated with this account does not exist or has been deleted.', code: 'RESTAURANT_NOT_FOUND' },
                    { status: 403 }
                );
            }

            const restStatusLower = (rest.status || '').toLowerCase();
            if (restStatusLower !== 'active') {
                if (['pending', 'pending_approval', 'pending_payment', 'payment_received', 'draft'].includes(restStatusLower)) {
                    return NextResponse.json(
                        { error: 'Your restaurant registration is pending Super Admin approval and activation.', code: 'RESTAURANT_PENDING_APPROVAL' },
                        { status: 403 }
                    );
                }
                return NextResponse.json(
                    { error: `Your restaurant is currently ${restStatusLower}. Access is blocked.`, code: 'RESTAURANT_INACTIVE' },
                    { status: 403 }
                );
            }

            if (userData.branch_id) {
                const { data: brn } = await supabaseAdmin
                    .from('branches')
                    .select('id, status, deleted_at')
                    .eq('id', userData.branch_id)
                    .maybeSingle();

                if (!brn || brn.deleted_at || (brn.status || '').toLowerCase() !== 'active') {
                    return NextResponse.json(
                        { error: 'The assigned branch is not active or has been deactivated/deleted.', code: 'BRANCH_INACTIVE' },
                        { status: 403 }
                    );
                }
            }
        }

        // ------------------------------------------------------------------
        // 8. Approved Account (Requirement 3): Issue Session & Cookies
        // ------------------------------------------------------------------
        // Reset failed login attempts on successful authentication
        await supabaseAdmin
            .from('auth')
            .update({
                failed_attempts: 0,
                locked_until: null,
            })
            .eq('user_id', userId);

        const sessionId = crypto.randomUUID();
        const sessionVersion = userData.session_version || 1;
        const role = (userData.role || 'owner').toLowerCase();

        const token = await signJwt({
            sessionId,
            userId: userData.id,
            name: userData.name,
            role,
            sessionVersion,
            email: userData.email,
            mobile: userData.mobile,
            restaurantId: userData.restaurant_id || null,
            restaurant_id: userData.restaurant_id || null,
            branchId: userData.branch_id || null,
            branch_id: userData.branch_id || null,
        });

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        await supabaseAdmin.from('dine_sessions').insert({
            id: sessionId,
            user_id: userData.id,
            token_hash: tokenHash,
            device_info: userAgent,
            ip_address: clientIp,
            is_active: true,
        });

        await recordAuthAuditLog({
            restaurantId: userData.restaurant_id,
            userId: userData.id,
            employeeId: userData.employee_id,
            action: 'login',
            ip: clientIp,
            device,
            browser,
            details: { method: 'password', role }
        });

        // Determine destination dashboard and owner login portal URL
        const redirectUrl = '/owner/dashboard';

        const host = req.headers.get('host') || '';
        const hostWithoutPort = host.split(':')[0].toLowerCase();
        const isLocalhost = hostWithoutPort === 'localhost' || hostWithoutPort === '127.0.0.1';
        const ownerLoginUrl = isLocalhost
            ? 'http://localhost:3000/login/owner'
            : 'https://owner.dineinone.com/login';

        const isHttps = req.nextUrl?.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
        const cookieOpts = getAuthCookieOptions(isHttps);

        const response = NextResponse.json({
            success: true,
            status: 'verified',
            verified: true,
            redirectUrl,
            ownerLoginUrl,
            user: {
                id: userData.id,
                name: userData.name,
                email: userData.email,
                role,
            },
            message: 'Account verified successfully',
        });

        // Set secure HTTP-only cookies
        response.cookies.set('dine_auth_token', token, cookieOpts);

        if (userData.restaurant_id) {
            response.cookies.set('dine_restaurant_id', userData.restaurant_id, cookieOpts);
            const cleanRid = String(userData.restaurant_id).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
            response.cookies.set(`dine_auth_token_${cleanRid}`, token, cookieOpts);
        }

        if (userData.branch_id) {
            response.cookies.set('dine_branch_id', userData.branch_id, cookieOpts);
        }

        return response;

    } catch (err: any) {
        console.error('[Login API] Error:', err);
        return NextResponse.json(
            { error: 'An unexpected error occurred during login. Please try again.' },
            { status: 500 }
        );
    }
}
