import { NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Standardized Cache-Control policies for Dine in One (P2-02)
 */
export const API_CACHE_POLICIES = {
    /**
     * 1. Public immutable static assets (media, fonts, icons)
     */
    PUBLIC_STATIC: 'public, max-age=31536000, immutable',

    /**
     * 2. Public restaurant content (menu, categories, public profile)
     * Cached at Cloudflare edge for 5 minutes, served stale up to 1 hour while revalidating
     */
    PUBLIC_RESTAURANT_CONTENT: 'public, s-maxage=300, stale-while-revalidate=3600',

    /**
     * 3. Short-lived public data (e.g., table QR verification check)
     */
    PUBLIC_SHORT_LIVED: 'public, max-age=15, stale-while-revalidate=60',

    /**
     * 4. Authenticated multi-tenant APIs (orders, employees, admin, reports, audit, kds, delivery, billing)
     * Strict private, zero public CDN caching
     */
    AUTHENTICATED_PRIVATE: 'private, no-store, no-cache, must-revalidate',

    /**
     * 5. Mutations / State Changes (POST, PUT, PATCH, DELETE, auth, login, logout)
     */
    MUTATION_NO_STORE: 'private, no-store',
} as const;

export type CachePolicyKey = keyof typeof API_CACHE_POLICIES;

/**
 * Helper to apply Cache-Control and security headers to a NextResponse
 */
export function withCacheHeaders(
    response: NextResponse,
    policy: (typeof API_CACHE_POLICIES)[CachePolicyKey] = API_CACHE_POLICIES.AUTHENTICATED_PRIVATE
): NextResponse {
    response.headers.set('Cache-Control', policy);
    if (policy === API_CACHE_POLICIES.AUTHENTICATED_PRIVATE || policy === API_CACHE_POLICIES.MUTATION_NO_STORE) {
        response.headers.set('Pragma', 'no-cache');
    }
    return response;
}

/**
 * Generates a deterministic, collision-resistant ETag string from serialized data (P2-03)
 */
export function generateETag(content: string | Buffer): string {
    const hash = crypto.createHash('sha1').update(content).digest('base64url').slice(0, 27);
    return `"${hash}"`;
}

/**
 * Handles conditional HTTP requests (If-None-Match) and returns HTTP 304 if unchanged.
 */
export function handleConditionalResponse(
    request: Request,
    body: any,
    options: {
        policy?: (typeof API_CACHE_POLICIES)[CachePolicyKey];
        extraHeaders?: Record<string, string>;
        status?: number;
    } = {}
): NextResponse {
    const {
        policy = API_CACHE_POLICIES.AUTHENTICATED_PRIVATE,
        extraHeaders = {},
        status = 200
    } = options;

    const serialized = typeof body === 'string' ? body : JSON.stringify(body);
    const etag = generateETag(serialized);
    const ifNoneMatch = request.headers.get('if-none-match');

    const headers = new Headers(extraHeaders);
    headers.set('ETag', etag);
    headers.set('Cache-Control', policy);

    if (policy === API_CACHE_POLICIES.AUTHENTICATED_PRIVATE || policy === API_CACHE_POLICIES.MUTATION_NO_STORE) {
        headers.set('Pragma', 'no-cache');
    }

    // Check If-None-Match condition
    if (ifNoneMatch) {
        const matches = ifNoneMatch
            .split(',')
            .map(m => m.trim())
            .some(m => m === etag || m === `W/${etag}` || m === '*');

        if (matches) {
            return new NextResponse(null, {
                status: 304,
                headers,
            });
        }
    }

    headers.set('Content-Type', 'application/json');
    return new NextResponse(serialized, {
        status,
        headers,
    });
}
