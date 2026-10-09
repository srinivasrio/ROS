import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyPassword, verifyPin, hashPassword } from '@/lib/auth-utils';
import { signJwt } from '@/lib/jwt-utils';
import {
    checkRateLimitAndLockout,
    recordFailedAttempt,
    resetFailedAttempts,
    recordAuthAuditLog,
    getAuthCookieOptions
} from '@/lib/panel-auth';
import { normalizeE164Phone } from '@/lib/entity-id';
import crypto from 'crypto';

/**
 * POST /api/auth/admin/login
 * Dedicated secure password-based authentication for Restaurant Admins.
 * Enforces role check, tenant verification, rate limiting, and session security.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const host = req.headers.get('host') || '';
        const referer = req.headers.get('referer') || '';
        const isOwnerPanel = 
            body?.panel === 'owner' || 
            body?.portal === 'owner' || 
            body?.role === 'owner' ||
            host.toLowerCase().startsWith('owner.') ||
            referer.includes('/login/owner');

        const rawIdentifier = String(body?.email || body?.identifier || body?.mobile || '').trim();
        const rawPassword = String(body?.password || '');
        const rawPin = String(body?.pin || '').trim();

        if (isOwnerPanel) {
            // Owner Login: Only Email/Identifier and Password are required. Security PIN is NEVER required.
            if (!rawIdentifier || !rawPassword) {
                return NextResponse.json({ error: 'Please enter both your email/username and password' }, { status: 400 });
            }
        } else {
            // Restaurant Admin Login: Mobile/Email, Password, AND Security PIN are all COMPULSORY
            if (!rawIdentifier) {
                return NextResponse.json({ error: 'Mobile number or Email is compulsory to login' }, { status: 400 });
            }
            if (!rawPassword) {
                return NextResponse.json({ error: 'Password is compulsory to login' }, { status: 400 });
            }
            if (!rawPin) {
                // If no PIN provided, check if this user is a Restaurant Owner who accidentally logged in via Admin panel
                const cleanCheck = rawIdentifier.toLowerCase();
                const { data: ownerCandidate } = await supabaseAdmin
                    .from('employees')
                    .select('id, role')
                    .or(`email.eq.${cleanCheck},mobile.eq.${cleanCheck.replace(/\D/g, '').slice(-10)}`)
                    .eq('is_deleted', false)
                    .maybeSingle();

                if (ownerCandidate && ['owner', 'restaurant_owner'].includes(String(ownerCandidate.role || '').toLowerCase())) {
                    return NextResponse.json({
                        error: 'This account is registered as a Restaurant Owner (no Security PIN required). Please sign in via the Owner Portal at https://owner.dineinone.com/login or /login/owner.'
                    }, { status: 403 });
                }

                return NextResponse.json({ error: 'Security PIN (4-6 digits) is compulsory to login' }, { status: 400 });
            }
        }

        const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
        const userAgent = req.headers.get('user-agent') || 'unknown';
        const uaLower = userAgent.toLowerCase();
        const device = (uaLower.includes('mobile') || uaLower.includes('android') || uaLower.includes('iphone')) ? 'mobile' : 'desktop';
        const browser = uaLower.includes('chrome') ? 'chrome' : uaLower.includes('safari') ? 'safari' : uaLower.includes('firefox') ? 'firefox' : 'unknown';

        let candidateUsers: any[] = [];

        // 1. Look up user by email or phone in employees
        if (rawIdentifier.includes('@')) {
            const cleanEmail = rawIdentifier.toLowerCase();
            const { data: empList } = await supabaseAdmin
                .from('employees')
                .select('*')
                .eq('email', cleanEmail)
                .eq('is_deleted', false)
                .order('created_at', { ascending: false });

            if (empList && empList.length > 0) {
                candidateUsers.push(...empList);
            }

            const { data: userList } = await supabaseAdmin
                .from('users')
                .select('*')
                .eq('email', cleanEmail);

            if (userList && userList.length > 0) {
                for (const u of userList) {
                    if (!candidateUsers.some(c => c.id === u.id)) {
                        candidateUsers.push({
                            id: u.id,
                            name: u.name || 'Admin',
                            role: u.role || 'restaurant_admin',
                            restaurant_id: u.restaurant_id || null,
                            email: cleanEmail,
                            mobile: u.phone || null,
                            status: 'active',
                            approval_status: 'approved',
                            session_version: 1
                        });
                    }
                }
            }
        } else {
            const cleanMobile = rawIdentifier.replace(/[^0-9]/g, '');
            const search10 = cleanMobile.length >= 10 ? cleanMobile.slice(-10) : cleanMobile;
            const e164 = normalizeE164Phone(rawIdentifier);
            const queryParts = [
                `employee_id.eq.${rawIdentifier}`,
                `employee_code.eq.${rawIdentifier}`,
                `internal_id.eq.${rawIdentifier}`
            ];
            if (search10) {
                queryParts.push(`mobile.eq.${search10}`);
                queryParts.push(`mobile.eq.+91${search10}`);
                queryParts.push(`mobile.ilike.%${search10}%`);
            }
            if (e164) {
                queryParts.push(`phone_normalized.eq.${e164}`);
            }
            const orQuery = queryParts.join(',');

            const { data: empList } = await supabaseAdmin
                .from('employees')
                .select('*')
                .or(orQuery)
                .eq('is_deleted', false)
                .order('created_at', { ascending: false });

            if (empList && empList.length > 0) {
                candidateUsers.push(...empList);
            }

            const { data: userList } = await supabaseAdmin
                .from('users')
                .select('*')
                .or(`phone.ilike.%${search10}%,id.eq.${rawIdentifier}`);

            if (userList && userList.length > 0) {
                for (const u of userList) {
                    if (!candidateUsers.some(c => c.id === u.id)) {
                        candidateUsers.push({
                            id: u.id,
                            name: u.name || 'Admin',
                            role: u.role || 'restaurant_admin',
                            restaurant_id: u.restaurant_id || null,
                            email: u.email || null,
                            mobile: u.phone || cleanMobile,
                            status: 'active',
                            approval_status: 'approved',
                            session_version: 1
                        });
                    }
                }
            }
        }

        if (candidateUsers.length === 0) {
            return NextResponse.json({ error: 'Invalid admin credentials' }, { status: 401 });
        }

        // Strict Separation Check on candidate accounts
        if (!isOwnerPanel) {
            const hasAdminCandidate = candidateUsers.some(c => 
                ['admin', 'restaurant_admin', 'branch_admin', 'manager', 'super_admin'].includes(String(c.role || '').toLowerCase())
            );
            const isOwnerOnly = candidateUsers.every(c => 
                ['owner', 'restaurant_owner'].includes(String(c.role || '').toLowerCase())
            );
            if (isOwnerOnly && !hasAdminCandidate) {
                return NextResponse.json({
                    error: 'This email is registered as a Restaurant Owner and cannot access the Restaurant Admin panel. Please sign in via the Owner Portal at /login/owner.'
                }, { status: 403 });
            }
        } else {
            const hasOwnerCandidate = candidateUsers.some(c => 
                ['owner', 'restaurant_owner', 'super_admin'].includes(String(c.role || '').toLowerCase())
            );
            const isAdminOnly = candidateUsers.every(c => 
                ['admin', 'restaurant_admin', 'branch_admin', 'manager'].includes(String(c.role || '').toLowerCase())
            );
            if (isAdminOnly && !hasOwnerCandidate) {
                return NextResponse.json({
                    error: 'This email is registered as a Restaurant Admin and cannot access the Owner Portal. Please sign in via the Restaurant Admin panel.'
                }, { status: 403 });
            }
        }

        // If multiple candidates found (e.g. same mobile number used across restaurants/staff),
        // resolve candidate by checking password verification
        let adminUser: any = null;
        if (candidateUsers.length === 1) {
            adminUser = candidateUsers[0];
        } else {
            for (const cand of candidateUsers) {
                const { data: aRec } = await supabaseAdmin
                    .from('auth')
                    .select('password_hash')
                    .eq('user_id', cand.id)
                    .maybeSingle();

                if (aRec?.password_hash && await verifyPassword(rawPassword, aRec.password_hash)) {
                    adminUser = cand;
                    break;
                }
            }
            if (!adminUser) {
                adminUser = candidateUsers[0];
            }
        }

        // 2. RATE LIMIT & LOCKOUT CHECK
        const lockoutStatus = await checkRateLimitAndLockout(adminUser.id);
        if (lockoutStatus.locked) {
            const minutesLeft = Math.ceil((lockoutStatus.remainingCooldownSeconds || 60) / 60);
            return NextResponse.json({
                error: `Account is temporarily locked due to repeated failed login attempts. Please try again in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.`
            }, { status: 429 });
        }

        // 3. PASSWORD VERIFICATION (Compulsory)
        const { data: authRecord } = await supabaseAdmin
            .from('auth')
            .select('password_hash')
            .eq('user_id', adminUser.id)
            .maybeSingle();

        const passwordHash = authRecord?.password_hash;
        let isPasswordValid = passwordHash ? await verifyPassword(rawPassword, passwordHash) : false;

        // Fallback: Check Supabase Auth if user exists there (and sync hash to auth table)
        if (!isPasswordValid && adminUser.email) {
            try {
                const { data: sbAuthData, error: sbAuthErr } = await supabaseAdmin.auth.signInWithPassword({
                    email: adminUser.email,
                    password: rawPassword
                });
                if (!sbAuthErr && sbAuthData?.user) {
                    isPasswordValid = true;
                    const newHash = await hashPassword(rawPassword);
                    await supabaseAdmin
                        .from('auth')
                        .upsert({
                            user_id: adminUser.id,
                            password_hash: newHash
                        }, { onConflict: 'user_id' });
                }
            } catch (sbErr) {
                // Ignore fallback error
            }
        }

        if (!isPasswordValid) {
            const failResult = await recordFailedAttempt(adminUser.id, {
                restaurantId: adminUser.restaurant_id,
                employeeId: adminUser.employee_id,
                ip,
                device,
                browser,
                panel: isOwnerPanel ? 'owner' : 'admin',
                method: 'password'
            });

            if (failResult.locked) {
                return NextResponse.json({
                    error: 'Account locked due to 5 consecutive failed login attempts. Cooldown period: 15 minutes.'
                }, { status: 429 });
            }

            return NextResponse.json({
                error: `Invalid password. (${5 - failResult.failedAttempts} attempt${5 - failResult.failedAttempts === 1 ? '' : 's'} remaining)`
            }, { status: 401 });
        }

        // 4. SECURITY PIN VERIFICATION (Compulsory for Restaurant Admin)
        if (!isOwnerPanel) {
            if (!adminUser.pin) {
                return NextResponse.json({
                    error: 'Security PIN is not set for this account. Please ask the restaurant owner to set your Security PIN.'
                }, { status: 401 });
            }

            const isPinValid = await verifyPin(rawPin, adminUser.pin);
            if (!isPinValid) {
                const failResult = await recordFailedAttempt(adminUser.id, {
                    restaurantId: adminUser.restaurant_id,
                    employeeId: adminUser.employee_id,
                    ip,
                    device,
                    browser,
                    panel: 'admin',
                    method: 'pin'
                });

                if (failResult.locked) {
                    return NextResponse.json({
                        error: 'Account locked due to 5 consecutive failed login attempts. Cooldown period: 15 minutes.'
                    }, { status: 429 });
                }

                return NextResponse.json({
                    error: `Invalid Security PIN. (${5 - failResult.failedAttempts} attempt${5 - failResult.failedAttempts === 1 ? '' : 's'} remaining)`
                }, { status: 401 });
            }
        }

        // 4. ROLE-BASED ACCESS CONTROL (Separation between Owner and Restaurant Admin)
        const rawRole = String(adminUser.role || '').toLowerCase().trim();

        if (isOwnerPanel) {
            if (['restaurant_admin', 'admin', 'branch_admin'].includes(rawRole)) {
                return NextResponse.json({
                    error: 'This email is registered as a Restaurant Admin and cannot access the Owner Portal. Please sign in via the Restaurant Admin panel.'
                }, { status: 403 });
            }

            const isSuper = (adminUser.role || '').toUpperCase() === 'SUPER_ADMIN';
            let isOwner = isSuper || ['owner', 'restaurant_owner'].includes(rawRole);
            if (!isOwner && adminUser.restaurant_id) {
                const { data: isOwnerRest } = await supabaseAdmin
                    .from('restaurants')
                    .select('id')
                    .eq('id', adminUser.restaurant_id)
                    .eq('owner_id', adminUser.id)
                    .maybeSingle();
                if (isOwnerRest) isOwner = true;
            }
            if (!isOwner) {
                const { data: isOwnerRu } = await supabaseAdmin
                    .from('restaurant_users')
                    .select('id, restaurant_id')
                    .eq('user_id', adminUser.id)
                    .eq('role', 'OWNER')
                    .eq('status', 'active')
                    .maybeSingle();
                if (isOwnerRu) {
                    isOwner = true;
                    if (!adminUser.restaurant_id) adminUser.restaurant_id = isOwnerRu.restaurant_id;
                }
            }

            if (!isOwner) {
                return NextResponse.json({
                    error: 'Access Denied: You do not have owner privileges. Please sign in via the Restaurant Admin portal.'
                }, { status: 403 });
            }
        } else {
            // Restaurant Admin Panel
            if (['owner', 'restaurant_owner'].includes(rawRole)) {
                return NextResponse.json({
                    error: 'This email is registered as a Restaurant Owner and cannot access the Restaurant Admin panel. Please sign in via the Owner Portal at /login/owner.'
                }, { status: 403 });
            }

            const isAllowedAdminRole = ['admin', 'restaurant_admin', 'branch_admin', 'manager', 'super_admin'].includes(rawRole);
            if (!isAllowedAdminRole) {
                await recordAuthAuditLog({
                    restaurantId: adminUser.restaurant_id,
                    userId: adminUser.id,
                    employeeId: adminUser.employee_id,
                    action: 'privilege_escalation_attempt',
                    ip,
                    device,
                    browser,
                    details: { attempted_panel: 'admin', actual_role: rawRole }
                });
                return NextResponse.json({
                    error: 'Access Denied: You are not authorized to access the Admin Panel.'
                }, { status: 403 });
            }
        }

        // 5. EMPLOYEE & RESTAURANT STATUS CHECKS
        if (adminUser.is_deleted) {
            return NextResponse.json({ error: 'This account has been deactivated.' }, { status: 403 });
        }

        if (adminUser.status === 'inactive' || adminUser.status === 'suspended') {
            return NextResponse.json({ error: 'Account is disabled or suspended. Please contact support.' }, { status: 403 });
        }

        if (!isOwnerPanel) {
            if (adminUser.status === 'pending' || adminUser.approval_status === 'pending') {
                return NextResponse.json({
                    error: 'Your Restaurant Admin account is pending Super Admin approval and payment verification. Access will be unlocked once approved.'
                }, { status: 403 });
            }

            if (!adminUser.restaurant_id) {
                return NextResponse.json({
                    error: 'Access Denied: Account is not associated with any restaurant.'
                }, { status: 403 });
            }

            const { data: rest } = await supabaseAdmin
                .from('restaurants')
                .select('id, name, status, deleted_at')
                .eq('id', adminUser.restaurant_id)
                .maybeSingle();

            if (!rest || rest.deleted_at) {
                return NextResponse.json({
                    error: 'The restaurant associated with this account does not exist or has been deleted.'
                }, { status: 403 });
            }

            const restStatusLower = (rest.status || '').toLowerCase();
            if (restStatusLower !== 'active') {
                const pendingRestStatuses = ['pending', 'pending_approval', 'pending_payment', 'payment_received', 'draft'];
                if (pendingRestStatuses.includes(restStatusLower)) {
                    return NextResponse.json({
                        error: 'Restaurant registration is pending Super Admin approval and payment verification. Please wait for Super Admin activation.'
                    }, { status: 403 });
                }

                if (restStatusLower === 'suspended') {
                    return NextResponse.json({ error: 'Your restaurant account has been suspended. Please contact support.' }, { status: 403 });
                }

                return NextResponse.json({ error: `Restaurant registration was ${restStatusLower}. Access is blocked.` }, { status: 403 });
            }

            // If branch is specified on employee, ensure branch is also active and not deleted
            if (adminUser.branch_id) {
                const { data: branchRec } = await supabaseAdmin
                    .from('branches')
                    .select('id, status, deleted_at')
                    .eq('id', adminUser.branch_id)
                    .maybeSingle();

                if (!branchRec || branchRec.deleted_at || (branchRec.status || '').toLowerCase() !== 'active') {
                    return NextResponse.json({
                        error: 'The assigned branch is not active or has been deactivated/deleted.'
                    }, { status: 403 });
                }
            }
        }

        // 6. RESOLVE BRANCH CONTEXT STRICTLY FROM DATABASE RELATIONSHIPS
        let assignedBranchId: string | null = adminUser.branch_id || null;
        let assignedBranchName: string | null = null;

        if (!assignedBranchId && adminUser.restaurant_id) {
            const { data: eba } = await supabaseAdmin
                .from('employee_branch_access')
                .select('branch_id')
                .eq('employee_id', adminUser.id)
                .limit(1)
                .maybeSingle();
            if (eba?.branch_id) {
                assignedBranchId = eba.branch_id;
            }
        }

        if (!assignedBranchId && adminUser.restaurant_id && !isOwnerPanel) {
            const { data: mainB } = await supabaseAdmin
                .from('branches')
                .select('id, name')
                .eq('restaurant_id', adminUser.restaurant_id)
                .order('is_main_branch', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (mainB) {
                assignedBranchId = mainB.id;
                assignedBranchName = mainB.name;
                await supabaseAdmin
                    .from('employees')
                    .update({ branch_id: mainB.id })
                    .eq('id', adminUser.id);
                await supabaseAdmin
                    .from('employee_branch_access')
                    .upsert({
                        employee_id: adminUser.id,
                        branch_id: mainB.id
                    }, { onConflict: 'employee_id,branch_id' });
            }
        }

        if (assignedBranchId && !assignedBranchName) {
            const { data: bRec } = await supabaseAdmin
                .from('branches')
                .select('name')
                .eq('id', assignedBranchId)
                .maybeSingle();
            if (bRec?.name) assignedBranchName = bRec.name;
        }

        // 7. RESET FAILED ATTEMPTS on successful login
        await resetFailedAttempts(adminUser.id, { ip, device, browser });

        // 8. CREATE SESSION & SIGN JWT
        const sessionId = crypto.randomUUID();
        const sessionVersion = adminUser.session_version || 1;
        const effectiveRole = isOwnerPanel ? 'owner' : 'restaurant_admin';

        const token = await signJwt({
            sessionId,
            userId: adminUser.id,
            name: adminUser.name,
            role: effectiveRole,
            sessionVersion,
            email: adminUser.email || null,
            mobile: adminUser.mobile || null,
            restaurantId: adminUser.restaurant_id || null,
            restaurant_id: adminUser.restaurant_id || null,
            employee_id: adminUser.employee_id || null,
            branchId: assignedBranchId,
            branch_id: assignedBranchId,
            branchName: assignedBranchName
        });

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        await supabaseAdmin.from('dine_sessions').insert({
            id: sessionId,
            user_id: adminUser.id,
            token_hash: tokenHash,
            device_info: userAgent,
            ip_address: ip,
            is_active: true
        });

        await recordAuthAuditLog({
            restaurantId: adminUser.restaurant_id,
            userId: adminUser.id,
            employeeId: adminUser.employee_id,
            action: 'login',
            ip,
            device,
            browser,
            details: { panel: isOwnerPanel ? 'owner' : 'admin', method: 'password', role: effectiveRole, branch_id: assignedBranchId }
        });

        const rid = adminUser.restaurant_id;
        const redirectUrl = isOwnerPanel
            ? '/owner/dashboard'
            : (rid ? `/${rid}/admin/dashboard` : '/waiting-approval');

        const isHttps = req.nextUrl?.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
        const cookieOpts = getAuthCookieOptions(isHttps);

        const response = NextResponse.json({
            success: true,
            redirectUrl,
            token,
            restaurant_id: rid || null,
            restaurantId: rid || null,
            branch_id: assignedBranchId,
            branchId: assignedBranchId,
            branchName: assignedBranchName,
            user: {
                id: adminUser.id,
                internal_id: adminUser.internal_id,
                employee_code: adminUser.employee_code,
                legacy_reference: adminUser.legacy_reference || adminUser.employee_id,
                name: adminUser.name,
                role: effectiveRole,
                email: adminUser.email || null,
                mobile: adminUser.phone_normalized || adminUser.mobile || null,
                restaurant_id: adminUser.restaurant_id || null,
                employee_id: adminUser.employee_code || adminUser.employee_id || null,
                branch_id: assignedBranchId,
                branchId: assignedBranchId,
                branch_name: assignedBranchName
            }
        });

        // Set secure cookies
        response.cookies.set('dine_auth_token', token, cookieOpts);
        if (isOwnerPanel) {
            response.cookies.set('dine_auth_token_owner', token, cookieOpts);
        } else {
            response.cookies.set('dine_auth_token_admin', token, cookieOpts);
        }
        if (rid) {
            response.cookies.set('dine_restaurant_id', rid, cookieOpts);
        }
        if (assignedBranchId) {
            response.cookies.set('dine_branch_id', assignedBranchId, cookieOpts);
        }
        if (rid) {
            const cleanRid = String(rid).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
            response.cookies.set(`dine_auth_token_${cleanRid}`, token, cookieOpts);
            if (isOwnerPanel) {
                response.cookies.set(`dine_auth_token_${cleanRid}_owner`, token, cookieOpts);
            } else {
                response.cookies.set(`dine_auth_token_${cleanRid}_admin`, token, cookieOpts);
            }
            if (assignedBranchId) {
                response.cookies.set(`dine_branch_id_${cleanRid}`, assignedBranchId, cookieOpts);
            }
        }

        return response;

    } catch (err: any) {
        console.error('[AdminLogin] Error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
