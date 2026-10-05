'use client';

import { setDineToken, getDineToken } from '@/lib/supabase';
import { resolvePanelLoginUrl, extractSubdomain } from '@/lib/panel-auth';

let isHandlingExpiry = false;
let globalInterceptorInstalled = false;

/**
 * Resets the session expiration flags so that after a successful re-login,
 * requests proceed normally without requiring a manual browser refresh.
 */
export function resetSessionExpiryState() {
    isHandlingExpiry = false;
    if (typeof window !== 'undefined') {
        (window as any).__dineSessionExpired = false;
    }
}

/**
 * Handles expired, invalid, revoked, or unauthorized sessions globally on the client side.
 * Immediately clears stored authentication/session data for the affected panel,
 * and redirects the user to the login page of the SAME panel without breaking other open tabs.
 */
export function handleSessionExpired(
    reason: string = 'session_expired',
    context?: { panel?: string | null; restaurantId?: string | null }
) {
    if (typeof window === 'undefined') return;

    const currentPath = window.location.pathname;
    const currentHost = window.location.host;
    const currentSearch = window.location.search;

    if (process.env.NODE_ENV === 'development') {
        console.warn(`[SessionManager] Session expired trigger: "${reason}". Panel: ${context?.panel || 'auto'}, Path: ${currentPath}`);
    }

    // In development mode, suppress automatic page reloads caused by passive background checks
    if (process.env.NODE_ENV === 'development' && reason === 'passive_check_unauthenticated') {
        console.warn('[SessionManager] Dev Mode: Passive check unauthenticated. Suppressing automatic page reload to allow development.');
        return;
    }

    // Prevent concurrent duplicate executions or redirect loops
    if (isHandlingExpiry || (window as any).__dineSessionExpired) {
        return;
    }
    isHandlingExpiry = true;
    (window as any).__dineSessionExpired = true;

    // 1. Clear in-memory token and panel-specific browser storage
    try {
        setDineToken(null, context?.panel);
    } catch (_) {}

    try {
        const panel = context?.panel;
        if (panel) {
            sessionStorage.removeItem(`dine_token_${panel}`);
            localStorage.removeItem(`dine_token_${panel}`);
            if (panel === 'waiter') localStorage.removeItem('waiterSession');
            if (panel === 'delivery') localStorage.removeItem('deliverySession');
        } else {
            sessionStorage.removeItem('dine_token');
        }
    } catch (_) {}

    // 2. Clear server auth cookies via endpoint
    try {
        fetch('/clear-cookies', { method: 'GET' }).catch(() => {});
    } catch (_) {}

    // 3. Resolve the exact panel login URL
    const subdomain = extractSubdomain(currentHost, new URLSearchParams(currentSearch));
    let targetLoginUrl = resolvePanelLoginUrl(currentPath, subdomain, null, reason);

    // Prevent redirect loop if already on target login page
    const targetPath = targetLoginUrl.split('?')[0];
    if (currentPath === targetPath) {
        isHandlingExpiry = false;
        (window as any).__dineSessionExpired = false;
        return;
    }

    // Preserve the current URL as a redirect parameter if it's a valid protected panel page
    if (
        currentPath && 
        !currentPath.startsWith('/login') && 
        !currentPath.startsWith('/access-denied') &&
        !currentPath.startsWith('/waiting-approval')
    ) {
        const fullCurrentUrl = currentPath + currentSearch;
        const separator = targetLoginUrl.includes('?') ? '&' : '?';
        targetLoginUrl = `${targetLoginUrl}${separator}redirect=${encodeURIComponent(fullCurrentUrl)}`;
    }

    if (process.env.NODE_ENV === 'development') {
        console.warn(`[SessionManager] Redirecting to panel login: ${targetLoginUrl}`);
    }

    // 4. Redirect cleanly
    window.location.href = targetLoginUrl;
}

/**
 * Initializes the global window.fetch interceptor on the client side.
 * Intercepts 401s and session expiration responses centrally, suppresses repeated retry loops,
 * and smoothly redirects the user to the panel's login page without UI errors or broken pages.
 */
export function initGlobalSessionInterceptor() {
    if (typeof window === 'undefined' || globalInterceptorInstalled) return;
    globalInterceptorInstalled = true;

    const originalFetch = window.fetch;
    window.fetch = async function(...args: Parameters<typeof fetch>): Promise<Response> {
        // If session is already known to be expired, short-circuit further polling calls to prevent retry storms
        if ((window as any).__dineSessionExpired) {
            return new Response(JSON.stringify({ error: 'Session expired', code: 'SESSION_EXPIRED' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const input = args[0];
        let urlStr = '';
        if (typeof input === 'string') {
            urlStr = input;
        } else if (input instanceof URL) {
            urlStr = input.toString();
        } else if (input && typeof (input as Request).url === 'string') {
            urlStr = (input as Request).url;
        }

        // Attach token if present and not already attached
        const token = getDineToken();
        if (token && args[1]) {
            const headers = new Headers(args[1].headers || {});
            if (!headers.has('x-dine-token')) {
                headers.set('x-dine-token', token);
            }
            args[1].headers = headers;
        }

        let response: Response;
        try {
            response = await originalFetch.apply(this, args);
        } catch (fetchErr) {
            throw fetchErr;
        }

        // Handle 401 Unauthorized globally
        if (response.status === 401) {
            // Do NOT intercept active authentication login requests (e.g. wrong password entered on login page)
            const isLoginAttempt = (
                urlStr.includes('/api/auth/admin/login') ||
                urlStr.includes('/api/auth/waiter/login') ||
                urlStr.includes('/api/auth/waiter/mobile-login') ||
                urlStr.includes('/api/auth/delivery/login') ||
                urlStr.includes('/api/auth/kds/login') ||
                urlStr.includes('/api/auth/employee/login') ||
                urlStr.includes('/api/auth/login') ||
                urlStr.includes('/api/auth/verify-otp') ||
                urlStr.includes('/api/lookup-phone')
            );

            // Do NOT intercept public customer menu browsing
            const isCustomerRoute = urlStr.includes('/api/customer/') || urlStr.includes('/customer/');

            if (!isLoginAttempt && !isCustomerRoute) {
                const path = window.location.pathname;
                const isPanelRoute = (
                    path.includes('/admin') ||
                    path.includes('/waiter') ||
                    path.includes('/delivery') ||
                    path.includes('/kds') ||
                    path.includes('/staff') ||
                    path.includes('/supervisor') ||
                    path.includes('/employee') ||
                    path.startsWith('/owner')
                );

                if (isPanelRoute) {
                    if (process.env.NODE_ENV === 'development') {
                        console.warn(`[SessionManager] Intercepted 401 Unauthorized on: ${urlStr}`);
                    }
                    
                    // Do not pre-empt /api/auth/session calls - AutoLogoutProvider handles them with route-specific context
                    const isSessionEndpoint = urlStr.includes('/api/auth/session');
                    if (!isSessionEndpoint) {
                        // Extract detected panel from route
                        let detectedPanel: string | null = null;
                        if (path.includes('/admin')) detectedPanel = 'admin';
                        else if (path.includes('/waiter')) detectedPanel = 'waiter';
                        else if (path.includes('/kds')) detectedPanel = 'kds';
                        else if (path.includes('/delivery')) detectedPanel = 'delivery';
                        else if (path.includes('/staff') || path.includes('/employee')) detectedPanel = 'employee';
                        else if (path.startsWith('/owner')) detectedPanel = 'owner';

                        // Check response clone for explicit SESSION_EXPIRED code
                        try {
                            const clone = response.clone();
                            clone.json().then(data => {
                                if (data?.code === 'SESSION_EXPIRED') {
                                    handleSessionExpired('session_expired', { panel: detectedPanel });
                                }
                            }).catch(() => {});
                        } catch (_) {}
                    }
                }
            }
        }

        return response;
    };
}
