/**
 * Hybrid Password and PIN hashing architecture for Dine In One.
 *
 * - Native Web Crypto PBKDF2-HMAC-SHA256:
 *   - Fast, zero external dependency, native BoringSSL/C++ inside isolate.
 *   - Passwords: 600,000 iterations (OWASP standard), ~65ms on Cloudflare Workers / Node.
 *   - Staff PINs: 100,000 iterations, ~11ms.
 *   - PHC string format: $pbkdf2-sha256$i=<iter>$<salt_b64>$<hash_b64>
 *
 * - Backward Compatibility (Argon2id):
 *   - Existing hashes in database ($argon2id$...) continue to verify seamlessly
 *     via the remote hash service (VPS), internal Worker service binding, or
 *     in-process @noble/hashes fallback.
 *   - On successful login, accounts with $argon2... hashes are automatically
 *     and silently re-hashed to PBKDF2 via needsRehash().
 */
import { argon2idAsync, argon2iAsync, argon2dAsync } from '@noble/hashes/argon2.js';
import { importNodeOnly, isCloudflareWorkers } from './runtime';

// ---------------------------------------------------------------------------
// 1. Web Crypto PBKDF2 Implementation (Primary Engine)
// ---------------------------------------------------------------------------

export const PBKDF2_PASSWORD_ITERATIONS = 600_000;
export const PBKDF2_PIN_ITERATIONS = 100_000;
export const PBKDF2_KEY_LEN = 32;
export const PBKDF2_SALT_BYTES = 16;

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

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

async function derivePbkdf2(plain: string, salt: Uint8Array, iterations: number, keyLen: number = 32): Promise<Uint8Array> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(plain),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: salt as any,
            iterations,
            hash: 'SHA-256'
        },
        keyMaterial,
        keyLen * 8
    );
    return new Uint8Array(bits);
}

/**
 * Hash a plaintext string using Web Crypto PBKDF2-HMAC-SHA256 into a standard PHC string.
 */
export async function pbkdf2Hash(plain: string, iterations: number = PBKDF2_PASSWORD_ITERATIONS): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES));
    const hash = await derivePbkdf2(plain, salt, iterations, PBKDF2_KEY_LEN);
    return `$pbkdf2-sha256$i=${iterations}$${b64Encode(salt)}$${b64Encode(hash)}`;
}

/**
 * Verify a plaintext string against a $pbkdf2-sha256$... PHC string.
 */
export async function pbkdf2Verify(phc: string, plain: string): Promise<boolean> {
    const parts = phc.split('$');
    // Format: ["", "pbkdf2-sha256", "i=600000", "<salt>", "<hash>"]
    if (parts.length !== 5 || parts[0] !== '' || parts[1] !== 'pbkdf2-sha256') {
        return false;
    }
    const iterParam = parts[2];
    if (!iterParam.startsWith('i=')) return false;
    const iterations = Number(iterParam.slice(2));
    if (!Number.isSafeInteger(iterations) || iterations < 10_000) return false;

    const salt = b64Decode(parts[3]);
    const expectedHash = b64Decode(parts[4]);
    const computed = await derivePbkdf2(plain, salt, iterations, expectedHash.length);
    return constantTimeEqual(computed, expectedHash);
}

// ---------------------------------------------------------------------------
// 2. Legacy Argon2 Support (For Existing Hashes and Migration)
// ---------------------------------------------------------------------------

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

function parsePhc(phc: string): ParsedHash | null {
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

// ---------------------------------------------------------------------------
// 3. Unified Primary Hash & Verification API
// ---------------------------------------------------------------------------

/**
 * Hash a password using Web Crypto PBKDF2-HMAC-SHA256 (600,000 iterations).
 */
export async function hashPassword(plain: string): Promise<string> {
    return pbkdf2Hash(plain, PBKDF2_PASSWORD_ITERATIONS);
}

/**
 * Hash a staff PIN using Web Crypto PBKDF2-HMAC-SHA256 (100,000 iterations).
 */
export async function hashPin(pin: string): Promise<string> {
    const cleanPin = String(pin || '').trim();
    if (!cleanPin) throw new Error('PIN cannot be empty');
    return pbkdf2Hash(cleanPin, PBKDF2_PIN_ITERATIONS);
}

/**
 * Verify a password against either a PBKDF2 ($pbkdf2-sha256$...) or legacy Argon2 ($argon2...) hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
        if (!hash || !password) return false;
        const trimmedHash = String(hash).trim();
        if (trimmedHash.startsWith('$pbkdf2-sha256$')) {
            return await pbkdf2Verify(trimmedHash, password);
        }
        if (trimmedHash.startsWith('$argon2')) {
            return await argon2Verify(trimmedHash, password);
        }
        return false;
    } catch (err) {
        console.error('[password-hash] Password verification failed:', err);
        return false;
    }
}

/**
 * Verify a staff PIN against either PBKDF2, legacy Argon2, or legacy plaintext PIN.
 */
export async function verifyPin(pin: string, storedHashOrPlain: string | null | undefined): Promise<boolean> {
    if (!pin || !storedHashOrPlain) return false;
    const cleanPin = String(pin).trim();
    const stored = String(storedHashOrPlain).trim();

    if (stored.startsWith('$pbkdf2-sha256$')) {
        try {
            return await pbkdf2Verify(stored, cleanPin);
        } catch (err) {
            console.error('[password-hash] PBKDF2 PIN verification failed:', err);
            return false;
        }
    }

    if (stored.startsWith('$argon2')) {
        try {
            return await argon2Verify(stored, cleanPin);
        } catch (err) {
            console.error('[password-hash] Argon2 PIN verification failed:', err);
            return false;
        }
    }

    // Graceful backward-compatibility check for unmigrated legacy plaintext PIN
    if (stored === cleanPin) {
        return true;
    }

    return false;
}

/**
 * Determines whether a stored hash should be upgraded to the current PBKDF2 standard.
 * Returns true for:
 * - Legacy Argon2 hashes ($argon2...)
 * - Unhashed plaintext PINs
 * - Older PBKDF2 hashes with fewer iterations than current standards
 */
export function needsRehash(phc: string | null | undefined, isPin: boolean = false): boolean {
    if (!phc) return false;
    const trimmed = String(phc).trim();
    if (!trimmed) return false;

    // Plaintext (doesn't start with $) must be rehashed
    if (!trimmed.startsWith('$')) return true;

    // Any Argon2 hash should be upgraded to PBKDF2 on login
    if (trimmed.startsWith('$argon2')) return true;

    // PBKDF2 hash: check if iterations match or exceed standard
    if (trimmed.startsWith('$pbkdf2-sha256$')) {
        const parts = trimmed.split('$');
        if (parts.length !== 5) return true;
        const iter = Number(parts[2].replace('i=', ''));
        const target = isPin ? PBKDF2_PIN_ITERATIONS : PBKDF2_PASSWORD_ITERATIONS;
        return !Number.isSafeInteger(iter) || iter < target;
    }

    // Any other hash format (e.g. legacy bcrypt $2)
    return true;
}
