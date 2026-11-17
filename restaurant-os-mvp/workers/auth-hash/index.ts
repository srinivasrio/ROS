/**
 * dine-in-one-auth-hash: a small, private Worker that does Argon2 password/PIN
 * verification and hashing for the Dine In One app Workers.
 *
 * Why it exists: old hashes use 64 MiB of memory per verify. Inside the full
 * Next.js Worker that pushes the isolate past Cloudflare's 128 MB limit
 * (HTTP 503, "Worker exceeded resource limits"). This Worker has its own
 * 128 MB and almost nothing else loaded.
 *
 * It has no public URL (workers_dev = false, no routes). It is reachable only
 * through the AUTH_HASH service binding in the app Workers.
 *
 * POST /verify  { "phc": "$argon2id$...", "plain": "..." }  -> { "ok": boolean }
 * POST /hash    { "plain": "..." }                           -> { "hash": "$argon2id$..." }
 */
import { argon2idAsync, argon2iAsync, argon2dAsync } from '@noble/hashes/argon2.js';

// Keep in sync with ARGON2_PARAMS in lib/password-hash.ts
const NEW_PARAMS = { m: 19456, t: 2, p: 1, dkLen: 32 } as const;
const MAX_MEMORY_KIB = 65536; // refuse anything heavier than the old 64 MiB hashes

type Variant = 'argon2id' | 'argon2i' | 'argon2d';
const NOBLE = { argon2id: argon2idAsync, argon2i: argon2iAsync, argon2d: argon2dAsync };

function b64Encode(bytes: Uint8Array): string {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/=+$/, '');
}

function b64Decode(s: string): Uint8Array {
    const norm = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(norm + '='.repeat((4 - (norm.length % 4)) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function parsePhc(phc: string) {
    const parts = phc.split('$');
    if (parts.length !== 6 || parts[0] !== '') return null;
    const variant = parts[1] as Variant;
    if (!(variant in NOBLE)) return null;
    const params: Record<string, number> = {};
    for (const kv of parts[3].split(',')) {
        const [k, v] = kv.split('=');
        params[k] = Number(v);
    }
    if (!params.m || !params.t || !params.p) return null;
    return {
        variant,
        version: Number(parts[2].replace('v=', '')) || 0x13,
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

// One Argon2 job at a time per isolate, so two concurrent 64 MiB verifies
// can never share the same 128 MB isolate.
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(job: () => Promise<T>): Promise<T> {
    const run = queue.then(job, job);
    queue = run.catch(() => undefined);
    return run;
}

async function verify(phc: string, plain: string): Promise<boolean> {
    const parsed = parsePhc(phc);
    if (!parsed || parsed.m > MAX_MEMORY_KIB) return false;
    return serialized(async () => {
        const out = await NOBLE[parsed.variant](plain, parsed.salt, {
            m: parsed.m,
            t: parsed.t,
            p: parsed.p,
            dkLen: parsed.hash.length,
            version: parsed.version,
        });
        return constantTimeEqual(out, parsed.hash);
    });
}

async function hash(plain: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const out = await serialized(() => argon2idAsync(plain, salt, { ...NEW_PARAMS, version: 0x13 }));
    const { m, t, p } = NEW_PARAMS;
    return `$argon2id$v=19$m=${m},t=${t},p=${p}$${b64Encode(salt)}$${b64Encode(out)}`;
}

export default {
    async fetch(request: Request): Promise<Response> {
        if (request.method !== 'POST') return new Response('Not found', { status: 404 });
        const { pathname } = new URL(request.url);
        let body: any;
        try {
            body = await request.json();
        } catch {
            return Response.json({ error: 'Invalid JSON' }, { status: 400 });
        }
        if (typeof body?.plain !== 'string' || body.plain.length === 0 || body.plain.length > 1024) {
            return Response.json({ error: 'Invalid input' }, { status: 400 });
        }
        if (pathname === '/verify') {
            if (typeof body.phc !== 'string') return Response.json({ error: 'Invalid input' }, { status: 400 });
            return Response.json({ ok: await verify(body.phc, body.plain) });
        }
        if (pathname === '/hash') {
            return Response.json({ hash: await hash(body.plain) });
        }
        return new Response('Not found', { status: 404 });
    },
};
