import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_PRIMARY_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_PRIMARY_SUPABASE_ANON_KEY || 'placeholder-anon-key';

function resolveClientSupabaseUrl(url: string): string {
    if (typeof window !== 'undefined') {
        // Prevent browser Mixed Content blocking: on HTTPS pages, ensure Supabase connects over HTTPS
        if (window.location.protocol === 'https:' && (url.startsWith('http://') || url.includes('72.61.250.231'))) {
            return 'https://db.dineinone.com';
        }
    }
    return url;
}

const supabaseUrl = resolveClientSupabaseUrl(rawSupabaseUrl);

let inMemoryToken: string | null = null;

function detectCurrentPanel(): string | null {
    if (typeof window === 'undefined') return null;
    const path = window.location.pathname;
    if (path.startsWith('/owner') || path.includes('/owner')) return 'owner';
    if (path.includes('/admin')) return 'admin';
    if (path.includes('/waiter')) return 'waiter';
    if (path.includes('/kds')) return 'kds';
    if (path.includes('/delivery')) return 'delivery';
    if (path.includes('/employee') || path.includes('/staff')) return 'employee';
    if (path.startsWith('/super-admin') || path.startsWith('/superadmin')) return 'superadmin';
    return null;
}

export function setDineToken(token: string | null, panel?: string | null) {
    if (typeof window === 'undefined') {
        // Enforce SSR safety: never store a global in-memory token on the server
        return;
    }
    inMemoryToken = token;
    try {
        const detected = panel || detectCurrentPanel();
        const scopedKey = detected ? `dine_token_${detected}` : null;
        if (token) {
            (window as any).__dineSessionExpired = false;
            sessionStorage.setItem('dine_token', token);
            localStorage.setItem('dine_token', token);
            if (scopedKey) {
                sessionStorage.setItem(scopedKey, token);
                localStorage.setItem(scopedKey, token);
            }
        } else {
            sessionStorage.removeItem('dine_token');
            localStorage.removeItem('dine_token');
            if (scopedKey) {
                sessionStorage.removeItem(scopedKey);
                localStorage.removeItem(scopedKey);
            }
        }
    } catch (_) {}
}

export function getDineToken(panel?: string | null): string | null {
    if (typeof window === 'undefined') {
        return null;
    }
    if (inMemoryToken) return inMemoryToken;
    try {
        const detected = panel || detectCurrentPanel();
        const scopedKey = detected ? `dine_token_${detected}` : null;
        // Prefer tab-isolated sessionStorage so multiple open panels (Admin, Waiter, KDS) don't overwrite each other
        const token = (scopedKey ? sessionStorage.getItem(scopedKey) : null) ||
                      sessionStorage.getItem('dine_token') ||
                      (scopedKey ? localStorage.getItem(scopedKey) : null) ||
                      localStorage.getItem('dine_token');
        if (token) {
            inMemoryToken = token;
            return token;
        }
    } catch (_) {}
    return null;
}

export async function syncClientSession(panel?: string | null, restaurantId?: string | null): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    const existing = getDineToken(panel);
    if (existing) return existing;

    try {
        const detected = panel || detectCurrentPanel();
        const searchParams = new URLSearchParams();
        if (detected) searchParams.set('panel', detected);
        if (restaurantId) searchParams.set('restaurantId', restaurantId);

        const url = searchParams.toString() ? `/api/auth/session?${searchParams.toString()}` : '/api/auth/session';
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data?.authenticated && data?.token) {
                setDineToken(data.token, detected);
                return data.token;
            }
        }
    } catch (_) {}
    return null;
}

const customFetch: typeof fetch = async (url, options = {}) => {
    let targetUrl = url;
    if (typeof url === 'string' && typeof window !== 'undefined' && window.location.protocol === 'https:') {
        if (url.startsWith('http://72.61.250.231:8010')) {
            targetUrl = url.replace('http://72.61.250.231:8010', 'https://db.dineinone.com');
        }
    }
    const headers = new Headers(options.headers || {});
    if (typeof window !== 'undefined') {
        const token = getDineToken();
        if (token && !headers.has('x-dine-token')) {
            headers.set('x-dine-token', token);
        }
    }

    try {
        const res = await fetch(targetUrl, { ...options, headers });
        return res;
    } catch (err: any) {
        // If primary URL failed to fetch (e.g. Mixed Content, CORS, DNS failure),
        // gracefully fall back to secondary Supabase cloud URL
        if (typeof url === 'string' && (err?.message?.includes('fetch') || err?.name === 'TypeError')) {
            const fallbackBase = process.env.NEXT_PUBLIC_SECONDARY_SUPABASE_URL || 'https://jmcsygpphwdubnanwjwz.supabase.co';
            const fallbackKey = process.env.NEXT_PUBLIC_SECONDARY_SUPABASE_ANON_KEY || 'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptY3N5Z3BwaHdkdWJuYW53and6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjUyMTIsImV4cCI6MjA4NTgwMTIxMn0.uQyoWluprn9Gr-ypserxqF9WM_85MWUMAO7Uch1jN14';
            try {
                const parsed = new URL(typeof targetUrl === 'string' ? targetUrl : url.toString());
                const fallbackUrl = `${fallbackBase}${parsed.pathname}${parsed.search}`;
                headers.set('apikey', fallbackKey);
                if (headers.has('authorization') && headers.get('authorization')?.startsWith('Bearer eyJhbGciOiJIUzI1Ni')) {
                    headers.set('authorization', `Bearer ${fallbackKey}`);
                }
                return await fetch(fallbackUrl, { ...options, headers });
            } catch (_) {}
        }
        throw err;
    }
};

export type AnyDatabase = {
    public: any;
};

import { createDualSupabaseClient } from './dual-supabase';

const secondaryUrl = process.env.NEXT_PUBLIC_SECONDARY_SUPABASE_URL || process.env.SECONDARY_SUPABASE_URL;
const secondaryAnonKey = process.env.NEXT_PUBLIC_SECONDARY_SUPABASE_ANON_KEY || process.env.SECONDARY_SUPABASE_ANON_KEY;

const primaryBaseClient = createSupabaseClient<AnyDatabase>(
    supabaseUrl,
    supabaseAnonKey,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        },
        global: {
            fetch: customFetch
        },
        realtime: {
            params: {
                eventsPerSecond: 10
            },
            heartbeatIntervalMs: 15000,
            timeout: 10000
        }
    }
);

const secondaryBaseClient = (secondaryUrl && secondaryAnonKey)
    ? createSupabaseClient<AnyDatabase>(secondaryUrl, secondaryAnonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        },
        global: {
            fetch: customFetch
        },
        realtime: {
            params: {
                eventsPerSecond: 10
            },
            heartbeatIntervalMs: 15000,
            timeout: 10000
        }
    })
    : null;

const globalForSupabase = globalThis as unknown as {
    __supabaseClient?: ReturnType<typeof createSupabaseClient<AnyDatabase>>;
};

export const supabase = globalForSupabase.__supabaseClient ?? createDualSupabaseClient(primaryBaseClient, secondaryBaseClient);

if (process.env.NODE_ENV !== 'production') {
    globalForSupabase.__supabaseClient = supabase;
}

export function createClient(customHeaders?: Record<string, string>) {
    if (customHeaders && Object.keys(customHeaders).length > 0) {
        const pClient = createSupabaseClient<AnyDatabase>(
            supabaseUrl,
            supabaseAnonKey,
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                },
                global: {
                    fetch: (url, options = {}) => {
                        const headers = new Headers(options.headers || {});
                        for (const [k, v] of Object.entries(customHeaders)) {
                            headers.set(k, v);
                        }
                        return customFetch(url, { ...options, headers });
                    }
                }
            }
        );

        const sClient = (secondaryUrl && secondaryAnonKey)
            ? createSupabaseClient<AnyDatabase>(
                secondaryUrl,
                secondaryAnonKey,
                {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false,
                        detectSessionInUrl: false
                    },
                    global: {
                        fetch: (url, options = {}) => {
                            const headers = new Headers(options.headers || {});
                            for (const [k, v] of Object.entries(customHeaders)) {
                                headers.set(k, v);
                            }
                            return customFetch(url, { ...options, headers });
                        }
                    }
                }
            )
            : null;

        return createDualSupabaseClient(pClient, sClient);
    }
    return supabase;
}
