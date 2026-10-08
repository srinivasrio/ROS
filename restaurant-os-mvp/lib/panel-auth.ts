import { supabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';

export type PanelType = 'admin' | 'waiter' | 'kds' | 'delivery' | 'employee' | 'superadmin' | 'owner' | 'customer';

export const PANEL_SUBDOMAINS: Record<string, PanelType> = {
    admin: 'admin',
    waiter: 'waiter',
    kds: 'kds',
    kitchen: 'kds',
    delivery: 'delivery',
    employee: 'employee',
    staff: 'employee',
    superadmin: 'superadmin',
    'super-admin': 'superadmin',
    owner: 'owner',
    customer: 'customer',
};

/**
 * Extracts the requested panel subdomain from the request Host header,
 * or from explicit test overrides (x-subdomain header or query param).
 */
export function extractSubdomain(
    host: string | null | undefined,
    searchParams?: URLSearchParams | null,
    headers?: Headers | null
): PanelType | null {
    // 1. Explicit header override (useful for curl, Postman, test suites, API proxies)
    if (headers) {
        const headerSub = headers.get('x-subdomain') || headers.get('x-forwarded-subdomain');
        if (headerSub) {
            const clean = headerSub.toLowerCase().trim();
            if (PANEL_SUBDOMAINS[clean]) return PANEL_SUBDOMAINS[clean];
        }
    }

    // 2. Explicit search param override (?subdomain=admin)
    if (searchParams) {
        const paramSub = searchParams.get('subdomain');
        if (paramSub) {
            const clean = paramSub.toLowerCase().trim();
            if (PANEL_SUBDOMAINS[clean]) return PANEL_SUBDOMAINS[clean];
        }
    }

    if (!host) return null;

    // Remove port if present: e.g. "admin.localhost:3000" -> "admin.localhost"
    const hostWithoutPort = host.split(':')[0].toLowerCase().trim();

    // Check against standard domain patterns:
    // admin.dineinone.com -> ['admin', 'dineinone', 'com']
    // admin.localhost -> ['admin', 'localhost']
    const parts = hostWithoutPort.split('.');

    if (parts.length >= 2) {
        const candidate = parts[0];
        if (PANEL_SUBDOMAINS[candidate]) {
            return PANEL_SUBDOMAINS[candidate];
        }
    }

    return null;
}

/**
 * Validate whether a given user role has permission to access the requested panel.
 * Enforces role-based isolation so waiters cannot access admin/KDS, chefs cannot access delivery, etc.
 */
export function isRoleAuthorizedForPanel(rawRole: string | null | undefined, panel: PanelType): boolean {
    const role = String(rawRole || '').toLowerCase().trim();

    // Super Admin has global operational access
    if (role === 'super_admin' || role === 'superadmin') {
        return true;
    }

    const isRestaurantAdmin = ['admin', 'restaurant_admin', 'branch_admin', 'manager'].includes(role);
    const isOwner = ['owner', 'restaurant_owner'].includes(role);

    switch (panel) {
        case 'admin':
            return isRestaurantAdmin;

        case 'waiter':
            return role === 'waiter' || role === 'supervisor' || isRestaurantAdmin;

        case 'kds':
            return ['kitchen', 'chef', 'supervisor'].includes(role) || isRestaurantAdmin;

        case 'delivery':
            return ['delivery_boy', 'delivery'].includes(role) || isRestaurantAdmin;

        case 'employee':
            // Any recognized active employee role can access the general employee portal
            return ['waiter', 'chef', 'kitchen', 'supervisor', 'delivery_boy', 'delivery', 'cleaner', 'captain', 'manager'].includes(role) || isRestaurantAdmin;

        case 'superadmin':
            return role === 'super_admin' || role === 'superadmin';

        case 'owner':
            return isOwner;

        case 'customer':
            return true;

        default:
            return false;
    }
}

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes cooldown

/**
 * Checks if an account is currently locked out due to repeated failed attempts.
 */
export async function checkRateLimitAndLockout(userId: string): Promise<{
    locked: boolean;
    lockedUntil?: Date;
    remainingCooldownSeconds?: number;
}> {
    try {
        const { data: authRecord } = await supabaseAdmin
            .from('auth')
            .select('failed_attempts, locked_until')
            .eq('user_id', userId)
            .maybeSingle();

        if (!authRecord) {
            return { locked: false };
        }

        if (authRecord.locked_until) {
            const lockedUntil = new Date(authRecord.locked_until);
            const now = new Date();
            if (lockedUntil > now) {
                const remainingCooldownSeconds = Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000);
                return {
                    locked: true,
                    lockedUntil,
                    remainingCooldownSeconds
                };
            }
        }

        return { locked: false };
    } catch (err) {
        console.error('[RateLimit] Check error:', err);
        return { locked: false };
    }
}

/**
 * Records a failed login attempt for an account. If failed attempts exceed threshold, locks the account.
 */
export async function recordFailedAttempt(
    userId: string,
    params: {
        restaurantId?: string | null;
        employeeId?: string | null;
        ip?: string;
        device?: string;
        browser?: string;
        panel?: string;
        method?: string;
    } = {}
): Promise<{ locked: boolean; failedAttempts: number; lockedUntil?: Date }> {
    try {
        const { data: currentAuth } = await supabaseAdmin
            .from('auth')
            .select('failed_attempts')
            .eq('user_id', userId)
            .maybeSingle();

        const newFailedCount = (currentAuth?.failed_attempts || 0) + 1;
        const now = new Date();
        let lockedUntil: Date | null = null;
        let isLocked = false;

        if (newFailedCount >= MAX_FAILED_ATTEMPTS) {
            lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS);
            isLocked = true;
        }

        if (currentAuth) {
            await supabaseAdmin
                .from('auth')
                .update({
                    failed_attempts: newFailedCount,
                    locked_until: lockedUntil ? lockedUntil.toISOString() : null,
                    last_ip: params.ip || null,
                    last_device: params.device || null,
                    last_browser: params.browser || null
                })
                .eq('user_id', userId);
        } else {
            await supabaseAdmin
                .from('auth')
                .insert({
                    user_id: userId,
                    password_hash: '$argon2id$placeholder',
                    failed_attempts: newFailedCount,
                    locked_until: lockedUntil ? lockedUntil.toISOString() : null,
                    last_ip: params.ip || null,
                    last_device: params.device || null,
                    last_browser: params.browser || null
                });
        }

        // Record security audit log
        await recordAuthAuditLog({
            restaurantId: params.restaurantId,
            userId,
            employeeId: params.employeeId,
            action: isLocked ? 'account_lockout' : 'failed_login_attempt',
            ip: params.ip,
            device: params.device,
            browser: params.browser,
            details: {
                panel: params.panel || 'unknown',
                method: params.method || 'credentials',
                failed_attempts: newFailedCount,
                is_locked: isLocked,
                locked_until: lockedUntil ? lockedUntil.toISOString() : null
            }
        });

        return {
            locked: isLocked,
            failedAttempts: newFailedCount,
            lockedUntil: lockedUntil || undefined
        };
    } catch (err) {
        console.error('[RateLimit] Failed attempt recording error:', err);
        return { locked: false, failedAttempts: 1 };
    }
}

/**
 * Resets failed attempt counter and clears lock status on successful login.
 */
export async function resetFailedAttempts(
    userId: string,
    params: {
        ip?: string;
        device?: string;
        browser?: string;
    } = {}
): Promise<void> {
    try {
        await supabaseAdmin
            .from('auth')
            .update({
                failed_attempts: 0,
                locked_until: null,
                last_login: new Date().toISOString(),
                last_ip: params.ip || null,
                last_device: params.device || null,
                last_browser: params.browser || null
            })
            .eq('user_id', userId);
    } catch (err) {
        console.error('[RateLimit] Reset failed attempts error:', err);
    }
}

/**
 * Writes an event to public.audit_logs
 */
export async function recordAuthAuditLog(params: {
    restaurantId?: string | null;
    userId?: string | null;
    employeeId?: string | null;
    action: string;
    ip?: string;
    device?: string;
    browser?: string;
    details?: any;
}): Promise<void> {
    try {
        await supabaseAdmin.from('audit_logs').insert({
            restaurant_id: params.restaurantId || null,
            user_id: params.userId || null,
            employee_id: params.employeeId || null,
            action: params.action,
            ip_address: params.ip || '127.0.0.1',
            device: params.device || 'desktop',
            browser: params.browser || 'unknown',
            details: params.details || {},
            created_at: new Date().toISOString()
        });
    } catch (err) {
        console.error('[AuditLog] Insert failed:', err);
    }
}

/**
 * Returns standard production-ready cookie security options
 */
export function getAuthCookieOptions(isHttps: boolean) {
    return {
        httpOnly: true,
        secure: isHttps,
        sameSite: 'lax' as const,
        path: '/',
        maxAge: 3600 * 8 // 8 hours
    };
}

/**
 * Resolves the exact panel login URL for a given path, subdomain, and restaurant scope.
 * Preserves the exact panel context so expired sessions cleanly redirect to the SAME panel's login page.
 */
export function resolvePanelLoginUrl(
    pathname: string,
    subdomain?: PanelType | string | null,
    restaurantCode?: string | null,
    reason: string = 'session_expired'
): string {
    const cleanPath = pathname || '';
    const segments = cleanPath.split('/').filter(Boolean);
    const firstSegment = segments[0] || '';
    const isTenantCode = (
        /^\d+$/.test(firstSegment) || 
        /^(REST|PEND)-/i.test(firstSegment) || 
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(firstSegment)
    );
    const restCode = restaurantCode || (isTenantCode ? firstSegment : null);
    const errParam = reason ? `error=${encodeURIComponent(reason)}` : '';

    const appendParam = (url: string) => {
        if (!errParam) return url;
        return url.includes('?') ? `${url}&${errParam}` : `${url}?${errParam}`;
    };

    // 0. Customer Panel - public guest dining interface, never redirect to staff login
    if (subdomain === 'customer' || cleanPath.includes('/customer') || cleanPath.startsWith('/api/customer')) {
        return cleanPath || '/';
    }

    // 1. Owner Panel
    if (subdomain === 'owner' || cleanPath.startsWith('/owner') || cleanPath.startsWith('/api/owner')) {
        return appendParam(subdomain === 'owner' ? '/login' : '/login/owner');
    }

    // 2. Admin Panel
    if (subdomain === 'admin' || cleanPath.includes('/admin')) {
        if (subdomain === 'admin') return appendParam('/login');
        return appendParam('/login/admin');
    }

    // 3. Waiter Panel
    if (subdomain === 'waiter' || cleanPath.includes('/waiter')) {
        if (subdomain === 'waiter') return appendParam('/login');
        if (restCode) return appendParam(`/${restCode}/waiter/login`);
        return appendParam('/login/waiter');
    }

    // 4. Delivery Panel
    if (subdomain === 'delivery' || cleanPath.includes('/delivery')) {
        if (subdomain === 'delivery') return appendParam('/login');
        if (restCode) return appendParam(`/${restCode}/delivery/login`);
        return appendParam('/login/delivery');
    }

    // 5. Kitchen / KDS Panel
    if (subdomain === 'kds' || cleanPath.includes('/kds') || cleanPath.includes('/kitchen')) {
        if (subdomain === 'kds') return appendParam('/login');
        return appendParam('/login/kds');
    }

    // 6. Supervisor / General Employee / Staff
    if (subdomain === 'employee' || cleanPath.includes('/supervisor') || cleanPath.includes('/staff') || cleanPath.includes('/employee')) {
        if (subdomain === 'employee') return appendParam('/login');
        return appendParam('/login/employee');
    }

    // 7. Fallback
    if (subdomain) return appendParam('/login');
    return appendParam('/login');
}

/**
 * Clears all authentication and session-related cookies from the response
 */
export function clearAllAuthCookies(
    response: { cookies: { set: (name: string, value: string, options: any) => void } },
    requestCookies?: { getAll?: () => Array<{ name: string }> },
    restaurantCode?: string | null
) {
    const isHttps = process.env.NODE_ENV === 'production';
    const clearOpts = {
        path: '/',
        maxAge: 0,
        httpOnly: true,
        secure: isHttps,
        sameSite: 'lax' as const,
    };

    const knownCookies = [
        'dine_auth_token',
        'dine_auth_token_admin',
        'dine_auth_token_waiter',
        'dine_auth_token_delivery',
        'dine_auth_token_kds',
        'dine_auth_token_employee',
        'dine_auth_token_owner',
        'dine_restaurant_id',
        'dine_branch_id',
        'session_token',
        'supabase-auth-token'
    ];

    if (restaurantCode) {
        const cleanRid = String(restaurantCode).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        knownCookies.push(
            `dine_auth_token_${cleanRid}`,
            `dine_auth_token_${cleanRid}_admin`,
            `dine_auth_token_${cleanRid}_waiter`,
            `dine_auth_token_${cleanRid}_delivery`,
            `dine_branch_id_${cleanRid}`
        );
    }

    for (const name of knownCookies) {
        response.cookies.set(name, '', clearOpts);
    }

    // Also inspect incoming cookies to clear any dynamically prefixed tokens
    if (requestCookies && typeof requestCookies.getAll === 'function') {
        try {
            const allIncoming = requestCookies.getAll();
            for (const c of allIncoming) {
                if (
                    c.name.startsWith('dine_') || 
                    c.name.startsWith('sb-') || 
                    c.name.includes('auth_token') ||
                    c.name === 'session_token'
                ) {
                    response.cookies.set(c.name, '', clearOpts);
                }
            }
        } catch (_) {}
    }
}

