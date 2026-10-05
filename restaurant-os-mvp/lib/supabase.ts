import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_PRIMARY_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_PRIMARY_SUPABASE_ANON_KEY || 'placeholder-anon-key';

let inMemoryToken: string | null = null;

function detectCurrentPanel(): string | null {
    if (typeof window === 'undefined') return null;
    const path = window.location.pathname;
    if (path.includes('/admin')) return 'admin';
    if (path.includes('/waiter')) return 'waiter';
    if (path.includes('/kds')) return 'kds';
    if (path.includes('/delivery')) return 'delivery';
    if (path.includes('/employee') || path.includes('/staff')) return 'employee';
    if (path.startsWith('/owner')) return 'owner';
    if (path.startsWith('/super-admin') || path.startsWith('/superadmin')) return 'superadmin';
    return null;
}

export function setDineToken(token: string | null, panel?: string | null) {
    inMemoryToken = token;
    if (typeof window !== 'undefined') {
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
}

export function getDineToken(panel?: string | null): string | null {
    if (inMemoryToken) return inMemoryToken;
    if (typeof window !== 'undefined') {
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
    }
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

const customFetch: typeof fetch = (url, options = {}) => {
    const token = getDineToken();
    if (token) {
        const headers = new Headers(options.headers || {});
        if (!headers.has('x-dine-token')) {
            headers.set('x-dine-token', token);
        }
        return fetch(url, { ...options, headers });
    }
    return fetch(url, options);
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
                        const token = getDineToken();
                        const headers = new Headers(options.headers || {});
                        if (token && !headers.has('x-dine-token')) {
                            headers.set('x-dine-token', token);
                        }
                        for (const [k, v] of Object.entries(customHeaders)) {
                            headers.set(k, v);
                        }
                        return fetch(url, { ...options, headers });
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
                            const token = getDineToken();
                            const headers = new Headers(options.headers || {});
                            if (token && !headers.has('x-dine-token')) {
                                headers.set('x-dine-token', token);
                            }
                            for (const [k, v] of Object.entries(customHeaders)) {
                                headers.set(k, v);
                            }
                            return fetch(url, { ...options, headers });
                        }
                    }
                }
            )
            : null;

        return createDualSupabaseClient(pClient, sClient);
    }
    return supabase;
}
