import { cookies } from 'next/headers';
import crypto from 'crypto';
import { verifyJwt, extractTokenForRestaurant } from '@/lib/jwt-utils';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveRestaurantId } from '@/services/utils.service';

export interface StaffAuthOptions {
    allowedRoles?: string[];
    requiredRestaurantId?: string;
    allowSuperAdmin?: boolean;
    expectedMobile?: string;
    expectedEmployeeId?: string;
}

export interface StaffAuthResult {
    authorized: boolean;
    error?: string;
    status?: number;
    user?: any;
    employee?: any;
}

export async function verifyStaffAuth(
    req?: Request,
    options: StaffAuthOptions = {}
): Promise<StaffAuthResult> {
    try {
        let token: string | undefined;

        // 1. Try to extract token from Authorization header or x-dine-token if request is provided
        if (req) {
            const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.slice(7).trim();
            }
            if (!token) {
                const xDine = req.headers.get('x-dine-token');
                if (xDine && xDine.trim()) {
                    token = xDine.trim();
                }
            }
        }

        // 2. Fall back to cookies (prefers restaurant-scoped token)
        if (!token) {
            const cookieStore = await cookies();
            let targetRest = options.requiredRestaurantId || null;
            let targetStaff: string | null = null;
            if (req) {
                try {
                    const url = new URL(req.url);
                    if (!targetRest) {
                        targetRest = url.searchParams.get('restaurantId') || url.searchParams.get('restaurantCode') || req.headers.get('x-restaurant-id') || null;
                    }
                    targetStaff = url.searchParams.get('mobile') || url.searchParams.get('staffMobile') || url.searchParams.get('employee_id') || null;
                    const segments = url.pathname.split('/').filter(Boolean);
                    if (!targetRest && segments.length > 0 && (
                        /^\d+$/.test(segments[0]) || 
                        /^(REST|PEND)-/i.test(segments[0]) ||
                        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segments[0])
                    )) {
                        targetRest = segments[0];
                    }
                    if (!targetStaff && segments.length > 2 && (segments[1] === 'waiter' || segments[1] === 'staff')) {
                        targetStaff = segments[2];
                    }
                } catch (_) {}
            }
            token = extractTokenForRestaurant(cookieStore, targetRest, targetStaff) || undefined;
        }

        if (!token) {
            return {
                authorized: false,
                error: 'Authentication required. Please log in.',
                status: 401
            };
        }

        // 3. Verify JWT
        const user = await verifyJwt(token);
        if (!user || !user.userId) {
            return {
                authorized: false,
                error: 'Invalid or expired session. Please log in again.',
                status: 401
            };
        }

        // Check for Super Admin bypass if allowed
        const isSuperAdmin = (user.role || '').toUpperCase() === 'SUPER_ADMIN' ||
            (user.role || '').toUpperCase() === 'SUPERADMIN';

        if (isSuperAdmin && options.allowSuperAdmin !== false) {
            return { authorized: true, user, employee: null };
        }

        // 4. Verify session in dine_sessions table
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const { data: dbSession, error: sessionErr } = await supabaseAdmin
            .from('dine_sessions')
            .select('id, is_active')
            .eq('id', user.sessionId)
            .eq('token_hash', tokenHash)
            .eq('is_active', true)
            .maybeSingle();

        if (sessionErr || !dbSession) {
            return {
                authorized: false,
                error: 'Session has been invalidated or expired. Please log in again.',
                status: 401
            };
        }

        // 5. Query employee profile from database
        const { data: employee, error: empErr } = await supabaseAdmin
            .from('employees')
            .select(`
                id,
                employee_id,
                name,
                email,
                mobile,
                role,
                status,
                approval_status,
                session_version,
                restaurant_id,
                is_deleted,
                is_online,
                availability_status
            `)
            .eq('id', user.userId)
            .maybeSingle();

        if (empErr || !employee) {
            // Also check users table for owner/admin
            const { data: userRec } = await supabaseAdmin
                .from('users')
                .select('*')
                .eq('id', user.userId)
                .maybeSingle();

            if (!userRec) {
                return {
                    authorized: false,
                    error: 'Staff account not found.',
                    status: 401
                };
            }
        }

        const activeRecord = employee || null;

        if (activeRecord) {
            // Check soft deletion
            if (activeRecord.is_deleted) {
                return {
                    authorized: false,
                    error: 'Staff account has been deleted.',
                    status: 403
                };
            }

            // STATUS CHECK: Block new accounts pending activation
            if (activeRecord.status === 'pending_activation' || activeRecord.status === 'invited') {
                return {
                    authorized: false,
                    error: 'Account is pending activation. Please complete account activation before accessing staff resources.',
                    status: 403
                };
            }

            if (activeRecord.status === 'inactive' || activeRecord.status === 'suspended') {
                return {
                    authorized: false,
                    error: `Account is ${activeRecord.status}. Access is restricted.`,
                    status: 403
                };
            }

            // Approval status check: Only block if rejected or pending_verification
            if (activeRecord.approval_status === 'rejected') {
                return {
                    authorized: false,
                    error: 'Staff account application was rejected. Please contact your restaurant manager.',
                    status: 403
                };
            }

            if (activeRecord.approval_status === 'pending_verification') {
                return {
                    authorized: false,
                    error: 'Staff account is pending activation.',
                    status: 403
                };
            }

            // Session version check
            if (user.sessionVersion && activeRecord.session_version && user.sessionVersion !== activeRecord.session_version) {
                return {
                    authorized: false,
                    error: 'Your session has expired due to login on another device.',
                    status: 401
                };
            }
        }

        // Normalize roles for comparison
        let userRole = (user.role || '').toLowerCase();
        if (userRole === 'admin') userRole = 'restaurant_admin';
        if (userRole === 'chef') userRole = 'kitchen';

        // 6. Role check if specified
        if (options.allowedRoles && options.allowedRoles.length > 0) {
            const normalizedAllowed = options.allowedRoles.map(r => {
                const lr = r.toLowerCase();
                if (lr === 'admin') return 'restaurant_admin';
                if (lr === 'chef') return 'kitchen';
                return lr;
            });

            if (!normalizedAllowed.includes(userRole)) {
                return {
                    authorized: false,
                    error: `Forbidden: role '${user.role}' is not authorized to access this resource.`,
                    status: 403
                };
            }
        }

        // 7. Tenant Isolation check if specified
        const userRestId = user.restaurantId || user.restaurant_id || activeRecord?.restaurant_id;
        if (options.requiredRestaurantId && userRestId) {
            const isDirectMatch = String(userRestId).toLowerCase() === String(options.requiredRestaurantId).toLowerCase();
            if (!isDirectMatch) {
                const resolvedUserRestId = await resolveRestaurantId(String(userRestId));
                const resolvedRequiredId = await resolveRestaurantId(String(options.requiredRestaurantId));
                if (resolvedUserRestId.toLowerCase() !== resolvedRequiredId.toLowerCase()) {
                    return {
                        authorized: false,
                        error: 'Access Denied: Invalid restaurant identity. Tenant isolation violation.',
                        status: 403
                    };
                }
            }
        }

        // 8. URL Parameter & Identity Tampering Check
        if (options.expectedMobile) {
            const cleanExpected = options.expectedMobile.replace(/[^0-9]/g, '').slice(-10);
            const cleanUserMobile = (activeRecord?.mobile || user.mobile || '').replace(/[^0-9]/g, '').slice(-10);
            if (cleanExpected && cleanUserMobile && cleanExpected !== cleanUserMobile) {
                return {
                    authorized: false,
                    error: 'Access Denied: Wrong staff credentials or invalid staff identity.',
                    status: 403
                };
            }
        }

        if (options.expectedEmployeeId) {
            const userEmpId = (activeRecord?.employee_id || user.employee_id || '').toLowerCase();
            if (userEmpId && options.expectedEmployeeId.toLowerCase() !== userEmpId) {
                return {
                    authorized: false,
                    error: 'Access Denied: Invalid staff identity.',
                    status: 403
                };
            }
        }

        // Automatic URL inspection if req is provided
        if (req) {
            try {
                const url = new URL(req.url);
                const queryMobile = url.searchParams.get('mobile') || url.searchParams.get('staffMobile');
                if (queryMobile && userRole === 'waiter') {
                    const cleanQueryMobile = queryMobile.replace(/[^0-9]/g, '').slice(-10);
                    const cleanUserMobile = (activeRecord?.mobile || user.mobile || '').replace(/[^0-9]/g, '').slice(-10);
                    if (cleanQueryMobile && cleanUserMobile && cleanQueryMobile !== cleanUserMobile) {
                        return {
                            authorized: false,
                            error: 'Access Denied: Wrong staff credentials or invalid staff identity.',
                            status: 403
                        };
                    }
                }

                const queryEmployeeId = url.searchParams.get('employeeId') || url.searchParams.get('employee_id');
                if (queryEmployeeId && userRole === 'waiter') {
                    const userEmpId = (activeRecord?.employee_id || user.employee_id || '').toLowerCase();
                    if (userEmpId && queryEmployeeId.toLowerCase() !== userEmpId) {
                        return {
                            authorized: false,
                            error: 'Access Denied: Invalid staff identity.',
                            status: 403
                        };
                    }
                }

                const queryRest = url.searchParams.get('restaurantId') || url.searchParams.get('restaurantCode');
                if (queryRest && userRestId) {
                    const isDirectMatch = String(queryRest).toLowerCase() === String(userRestId).toLowerCase();
                    if (!isDirectMatch) {
                        const resolvedQuery = await resolveRestaurantId(String(queryRest));
                        const resolvedUser = await resolveRestaurantId(String(userRestId));
                        if (resolvedQuery.toLowerCase() !== resolvedUser.toLowerCase()) {
                            return {
                                authorized: false,
                                error: 'Access Denied: Invalid restaurant identity. Tenant isolation violation.',
                                status: 403
                            };
                        }
                    }
                }
            } catch (_) {}
        }

        return {
            authorized: true,
            user,
            employee: activeRecord
        };

    } catch (err: any) {
        console.error('[verifyStaffAuth] Internal error:', err);
        return {
            authorized: false,
            error: 'Authentication verification failed.',
            status: 500
        };
    }
}
