/**
 * Argon2 password / PIN hashing that works on both Node.js and Cloudflare Workers.
 *
 * - On Node (VPS) the native `argon2` package is used when installed (fast).
 * - On Workers a pure-JS implementation (@noble/hashes) is used, because native
 *   modules cannot run there.
 *
 * Both produce and accept standard PHC strings ($argon2id$v=19$m=..,t=..,p=..$salt$hash),
 * so hashes created on one runtime verify on the other, and every existing
 * hash in the database keeps working. Verification always uses the
 * parameters stored inside the hash.
 */
import { argon2idAsync, argon2iAsync, argon2dAsync } from '@noble/hashes/argon2.js';
import { importNodeOnly, isCloudflareWorkers } from './runtime';

/**
 * On Cloudflare Workers, Argon2 runs in the separate `dine-in-one-auth-hash`
 * Worker (service binding AUTH_HASH, see workers/auth-hash/). Verifying an old
 * 64 MiB hash inside the app Worker exceeds the 128 MB isolate limit (HTTP 503).
 * Returns null when not on Workers or when the binding isn't configured
 * (e.g. local `next dev`), in which case hashing runs in-process.
 */
async function getAuthHashBinding(): Promise<{ fetch: typeof fetch } | null> {
    if (!isCloudflareWorkers()) return null;
    try {
        const { getCloudflareContext } = await import('@opennextjs/cloudflare');
        const { env } = await getCloudflareContext({ async: true });
        return ((env as any).AUTH_HASH as { fetch: typeof fetch }) ?? null;
    } catch {
        return null;
    }
}

async function callAuthHash<T>(binding: { fetch: typeof fetch }, path: string, body: object): Promise<T> {
    const res = await binding.fetch(`https://auth-hash.internal${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`auth-hash ${path} failed with HTTP ${res.status}`);
    return (await res.json()) as T;
}

/**
 * Remote password-check service on the VPS (vps/auth-hash/), reached through the
 * Cloudflare Tunnel. Used on Workers when AUTH_HASH_URL and AUTH_HASH_SECRET are
 * set: the free Workers plan allows ~10 ms CPU per request, too little for Argon2.
 * Waiting on this fetch costs wall time, not CPU time.
 */
type HashService = (path: '/verify' | '/hash', body: object) => Promise<any>;

async function getHashService(): Promise<HashService | null> {
    if (!isCloudflareWorkers()) return null;

    const url = (process.env.AUTH_HASH_URL || '').replace(/\/+$/, '');
    const secret = process.env.AUTH_HASH_SECRET || '';
    if (url && secret) {
        return async (path, body) => {
            try {
                const res = await fetch(`${url}${path}`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', 'x-auth-hash-secret': secret },
                    body: JSON.stringify(body),
                    signal: AbortSignal.timeout(5_000),
                });
                if (res.ok) {
                    return await res.json();
                }
                console.warn(`[password-hash] Remote hash service returned HTTP ${res.status}, attempting fallback`);
            } catch (err) {
                console.warn(`[password-hash] Remote hash service unreachable (${err}), attempting fallback`);
            }

            const binding = await getAuthHashBinding();
            if (binding) {
                try {
                    return await callAuthHash(binding, path, body);
                } catch (bindingErr) {
                    console.warn('[password-hash] Binding fallback failed:', bindingErr);
                }
            }

            return null;
        };
    }

    const binding = await getAuthHashBinding();
    if (binding) return (path, body) => callAuthHash(binding, path, body);

    return null;
}

/**
 * Parameters for NEW hashes. OWASP-recommended Argon2id configuration
 * (19 MiB memory, 2 iterations, parallelism 1).
 *
 * The previous settings (64 MiB, t=3, p=4) take ~1.3 s of CPU and 64 MiB of RAM
 * per verify in pure JS, which risks exceeding the 128 MB Workers memory limit
 * when several staff log in at once. Old hashes still verify unchanged; use
 * needsRehash() to upgrade them on the next successful login.
 */
export const ARGON2_PARAMS = { m: 19456, t: 2, p: 1, dkLen: 32 } as const;
const SALT_BYTES = 16;

type Variant = 'argon2id' | 'argon2i' | 'argon2d';
interface ParsedHash {
    variant: Variant;
    version: number;
    m: number;
    t: number;
    p: number;
    salt: Uint8Array;
    hash: Uint8Array;
}

function b64Encode(bytes: Uint8Array): string {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/=+$/, '');
}

function b64Decode(s: string): Uint8Array {
    const norm = s.replace(/-/g, '+').replace(/_/g, '/');
    const padded = norm + '='.repeat((4 - (norm.length % 4)) % 4);
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function parsePhc(phc: string): ParsedHash | null {
    // $argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>
    const parts = phc.split('$');
    if (parts.length !== 6 || parts[0] !== '') return null;
    const variant = parts[1] as Variant;
    if (!['argon2id', 'argon2i', 'argon2d'].includes(variant)) return null;
    const version = Number(parts[2].replace('v=', ''));
    const params: Record<string, number> = {};
    for (const kv of parts[3].split(',')) {
        const [k, v] = kv.split('=');
        params[k] = Number(v);
    }
    if (!params.m || !params.t || !params.p) return null;
    return {
        variant,
        version: version || 0x13,
        m: params.m,
        t: params.t,
        p: params.p,
        salt: b64Decode(parts[4]),
        hash: b64Decode(parts[5]),
    };
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

const NOBLE = { argon2id: argon2idAsync, argon2i: argon2iAsync, argon2d: argon2dAsync };

export async function argon2Hash(plain: string): Promise<string> {
    const native = await importNodeOnly<any>('argon2');
    if (native) {
        return native.hash(plain, {
            type: native.argon2id,
            memoryCost: ARGON2_PARAMS.m,
            timeCost: ARGON2_PARAMS.t,
            parallelism: ARGON2_PARAMS.p,
            hashLength: ARGON2_PARAMS.dkLen,
        });
    }
    const remote = await getHashService();
    if (remote) {
        try {
            const res = await remote('/hash', { plain });
            if (res && res.hash) return res.hash;
        } catch (err) {
            console.warn('[password-hash] Remote hash failed, falling back to in-process noble:', err);
        }
    }
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const out = await argon2idAsync(plain, salt, { ...ARGON2_PARAMS, version: 0x13 });
    const { m, t, p } = ARGON2_PARAMS;
    return `$argon2id$v=19$m=${m},t=${t},p=${p}$${b64Encode(salt)}$${b64Encode(out)}`;
}

export async function argon2Verify(phc: string, plain: string): Promise<boolean> {
    const native = await importNodeOnly<any>('argon2');
    if (native) return native.verify(phc, plain);

    const remote = await getHashService();
    if (remote) {
        try {
            const res = await remote('/verify', { phc, plain });
            if (res && typeof res.ok === 'boolean') {
                return res.ok === true;
            }
        } catch (err) {
            console.warn('[password-hash] Remote verify failed, falling back to in-process noble:', err);
        }
    }

    const parsed = parsePhc(phc);
    if (!parsed) return false;
    const fn = NOBLE[parsed.variant];
    const out = await fn(plain, parsed.salt, {
        m: parsed.m,
        t: parsed.t,
        p: parsed.p,
        dkLen: parsed.hash.length,
        version: parsed.version,
    });
    return constantTimeEqual(out, parsed.hash);
}

/** True if a stored hash uses different parameters from ARGON2_PARAMS (rehash after a successful login). */
export function needsRehash(phc: string): boolean {
    const parsed = parsePhc(phc);
    if (!parsed) return true;
    return (
        parsed.variant !== 'argon2id' ||
        parsed.m !== ARGON2_PARAMS.m ||
        parsed.t !== ARGON2_PARAMS.t ||
        parsed.p !== ARGON2_PARAMS.p
    );
}
