import { createClient } from '@/lib/supabase';

const supabase = createClient();

export class BoundedCache<T> {
    private cache = new Map<string, { value: T; expiry: number }>();
    constructor(private maxEntries: number = 500, private defaultTtlMs: number = 300000) {}

    get(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return null;
        }
        return entry.value;
    }

    set(key: string, value: T, ttlMs?: number) {
        const now = Date.now();
        const expiry = now + (ttlMs ?? this.defaultTtlMs);

        // Bounded cleanup to prevent memory leaks
        if (this.cache.size >= this.maxEntries) {
            for (const [k, v] of this.cache.entries()) {
                if (v.expiry < now || this.cache.size >= this.maxEntries) {
                    this.cache.delete(k);
                }
            }
        }

        this.cache.set(key, { value, expiry });
    }

    delete(key: string) {
        this.cache.delete(key);
    }

    deletePattern(pattern: string) {
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }

    clear() {
        this.cache.clear();
    }

    keys(): string[] {
        return Array.from(this.cache.keys());
    }
}

const resolutionCache = new BoundedCache<string>(500, 1800000); // 30 minutes
const inFlightResolution = new Map<string, Promise<string>>();

/**
 * Resolves a restaurant code (ID or slug) to the actual restaurant_id.
 * Used by services to handle human-readable URLs.
 */
export async function resolveRestaurantId(codeRaw: string | number): Promise<string> {
    if (!codeRaw) return codeRaw as string;
    const code = String(codeRaw).trim();
    if (!code) return '';
    
    // Check in-memory cache first
    const cached = resolutionCache.get(code);
    if (cached) {
        return cached;
    }

    // Fast-path: If code already matches standard ID patterns (numeric 8+ digits, REST-*, PEND-*, UUID),
    // skip unnecessary network roundtrips and cache immediately!
    if (/^\d{8,}$|^REST-|^PEND-|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code)) {
        resolutionCache.set(code, code);
        return code;
    }

    // Deduplicate in-flight resolution queries across concurrent callers
    const inFlightKey = `resolve_res_id:${code.toLowerCase()}`;
    const existing = inFlightResolution.get(inFlightKey);
    if (existing) return existing;

    const promise = (async () => {
        // Double-check cache inside coalesced executor
        const recheck = resolutionCache.get(code);
        if (recheck) return recheck;

        let resolved = '';

        try {
            const supabase = createClient();

            // 1. Direct check in restaurants table first
            const { data: exists } = await supabase
                .from('restaurants')
                .select('id')
                .eq('id', code)
                .maybeSingle();

            if (exists) {
                resolved = exists.id;
            } else {
                // 2. Try as Slug or restaurant_id in restaurant_profile
                const { data: profile } = await supabase
                    .from('restaurant_profile')
                    .select('restaurant_id')
                    .or(`slug.eq.${code.toLowerCase()},restaurant_id.eq.${code}`)
                    .maybeSingle();

                if (profile) {
                    resolved = profile.restaurant_id;
                }
            }
        } catch (err) {
            console.warn(`[resolveRestaurantId] Network lookup failed for "${code}":`, err);
        }

        if (!resolved) {
            resolved = code;
        }

        // Cache the resolved ID with TTL expiration
        resolutionCache.set(code, resolved);
        return resolved;
    })().finally(() => {
        inFlightResolution.delete(inFlightKey);
    });

    inFlightResolution.set(inFlightKey, promise);
    return promise;
}
