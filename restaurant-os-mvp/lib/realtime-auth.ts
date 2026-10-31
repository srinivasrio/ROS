'use client';

/**
 * Keeps the Supabase Realtime websocket authenticated with a scoped token from
 * /api/realtime/token (audit DIO-C04, option A'). Joined channels are re-authed
 * by supabase-js on setAuth, so subscribing before the first token lands is safe.
 * If the server is not configured (204) nothing changes: the socket stays anon.
 */

type RealtimeLike = { setAuth: (token?: string | null) => unknown };

let timer: ReturnType<typeof setTimeout> | null = null;
let generation = 0;

export function refreshRealtimeAuth(realtime: RealtimeLike, getDineToken: () => string | null): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();
    const mine = ++generation;

    return (async () => {
        try {
            const dineToken = getDineToken();
            const res = await fetch('/api/realtime/token', {
                credentials: 'same-origin',
                cache: 'no-store',
                headers: dineToken ? { 'x-dine-token': dineToken } : undefined,
            });
            if (res.status !== 200) return;
            const { token, expiresAt } = await res.json();
            if (!token || mine !== generation) return; // a newer token change superseded this call
            await realtime.setAuth(token);
            if (timer) clearTimeout(timer);
            const wait = Math.max(30_000, (expiresAt - Date.now()) * 0.8);
            timer = setTimeout(() => { void refreshRealtimeAuth(realtime, getDineToken); }, wait);
        } catch {
            // Network blip: the next token change or wake-up retries.
        }
    })();
}
