'use client';

import React, { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { initGlobalSessionInterceptor, handleSessionExpired } from '@/lib/session-manager';
import { getDineToken, setDineToken } from '@/lib/supabase';

function parseJwtExp(token: string): number | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payloadStr = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
        const payload = JSON.parse(payloadStr);
        return payload?.exp ? payload.exp * 1000 : null;
    } catch (_) {
        return null;
    }
}

function parseRouteContext(pathname: string): {
    isPanelRoute: boolean;
    panel: string | null;
    restaurantId: string | null;
    staffMobile: string | null;
} {
    const segments = pathname.split('/').filter(Boolean);
    let panel: string | null = null;
    let restaurantId: string | null = null;
    let staffMobile: string | null = null;

    if (pathname.startsWith('/owner') || pathname.includes('/owner')) panel = 'owner';
    else if (pathname.includes('/admin')) panel = 'admin';
    else if (pathname.includes('/waiter')) panel = 'waiter';
    else if (pathname.includes('/kds')) panel = 'kds';
    else if (pathname.includes('/delivery')) panel = 'delivery';
    else if (pathname.includes('/staff') || pathname.includes('/employee')) panel = 'employee';
    else if (pathname.includes('/supervisor')) panel = 'supervisor';

    if (segments.length > 0 && segments[0] !== 'login' && segments[0] !== 'owner' && segments[0] !== 'access-denied') {
        restaurantId = segments[0];
    }
    if (panel === 'waiter' && segments.length >= 3) {
        staffMobile = segments[2];
    } else if (panel === 'delivery' && segments.length >= 3) {
        staffMobile = segments[2];
    }

    return {
        isPanelRoute: Boolean(panel),
        panel,
        restaurantId,
        staffMobile
    };
}

/**
 * Global provider for detecting and gracefully managing expired sessions across all panels.
 * Catches 401s, handles returning to idle tabs via visibilitychange/focus, and prevents
 * retry storms, blank screens, or unauthorized UI.
 */
export function AutoLogoutProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname() || '';
    const lastCheckRef = useRef<number>(Date.now());

    // 1. Initialize global 401 fetch interceptor once
    useEffect(() => {
        initGlobalSessionInterceptor();
    }, []);

    // 2. Health check when returning to tab (focus / visibilitychange) or periodically
    useEffect(() => {
        const { isPanelRoute, panel, restaurantId, staffMobile } = parseRouteContext(pathname);

        if (!isPanelRoute) return;

        const checkSessionHealth = async (trigger: string = 'periodic') => {
            const now = Date.now();
            lastCheckRef.current = now;

            if (process.env.NODE_ENV === 'development') {
                console.log(`[AutoLogoutProvider] Checking session health (${trigger}) on ${pathname}`, { panel, restaurantId, staffMobile });
            }

            // Check client token expiration locally first
            const token = getDineToken(panel);
            if (token) {
                const expMs = parseJwtExp(token);
                if (expMs && now >= expMs) {
                    if (process.env.NODE_ENV === 'development') {
                        console.warn(`[AutoLogoutProvider] JWT expired locally. ExpMs: ${expMs}, Now: ${now}`);
                    }
                    handleSessionExpired('session_expired', { panel, restaurantId });
                    return;
                }
            }

            // Quick session validation ping against /api/auth/session with panel context
            try {
                const searchParams = new URLSearchParams();
                if (panel) searchParams.set('panel', panel);
                if (restaurantId) searchParams.set('restaurantId', restaurantId);
                if (staffMobile) searchParams.set('staffMobile', staffMobile);

                const url = `/api/auth/session?${searchParams.toString()}`;
                const res = await fetch(url, { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    if (!data.authenticated) {
                        if (process.env.NODE_ENV === 'development') {
                            console.warn(`[AutoLogoutProvider] Dev Mode: Passive session check returned unauthenticated for panel "${panel}". Redirect suppressed.`);
                            return;
                        }
                        handleSessionExpired('passive_check_unauthenticated', { panel, restaurantId });
                    } else if (data.token) {
                        setDineToken(data.token, panel);
                    }
                } else if (res.status === 401) {
                    if (process.env.NODE_ENV === 'development') {
                        console.warn(`[AutoLogoutProvider] Dev Mode: 401 from session check for panel "${panel}". Redirect suppressed.`);
                        return;
                    }
                    handleSessionExpired('session_expired', { panel, restaurantId });
                }
            } catch (_) {
                // If offline / transient network drop, do not immediately force logout
            }
        };

        // Check on window focus and visibility change (e.g. user resumes computer or switches back to tab)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                const elapsed = Date.now() - lastCheckRef.current;
                // If returning after more than 15 seconds of inactivity, verify session
                if (elapsed > 15000) {
                    checkSessionHealth('visibilitychange');
                }
            }
        };

        const handleFocus = () => {
            const elapsed = Date.now() - lastCheckRef.current;
            if (elapsed > 15000) {
                checkSessionHealth('focus');
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);

        // Periodic check every 45 seconds
        const intervalId = setInterval(() => {
            checkSessionHealth('interval');
        }, 45000);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
            clearInterval(intervalId);
        };
    }, [pathname]);

    return <>{children}</>;
}

export default AutoLogoutProvider;
