/**
 * Dine In One — password-check service for the VPS.
 *
 * Cloudflare's free Workers plan allows ~10 ms of CPU per request, but checking
 * an Argon2 password hash needs 100+ ms. The Workers therefore send password
 * checks here, where native `argon2` does them in ~0.1 s.
 *
 * - Listens on 127.0.0.1 only. Reached from the internet solely through the
 *   Cloudflare Tunnel hostname (e.g. https://hash.dineinone.com).
 * - Every POST must carry the header  x-auth-hash-secret: <AUTH_HASH_SECRET>.
 *
 *   GET  /health                                   -> { ok: true }
 *   POST /verify { "phc": "$argon2id$...", "plain" } -> { ok: boolean }
 *   POST /hash   { "plain" }                       -> { hash: "$argon2id$..." }
 *
 * Setup: see README.md in this folder.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const argon2 = require('argon2');
const HERE = path.dirname(fileURLToPath(import.meta.url));

// Load .env from this folder (KEY=value lines) without overriding real env vars.
try {
    for (const line of fs.readFileSync(path.join(HERE, '.env'), 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
} catch { /* no .env file: rely on the environment */ }

const SECRET = process.env.AUTH_HASH_SECRET || '';
const PORT = Number(process.env.PORT || 8020);
const HOST = '127.0.0.1';
const MAX_BODY_BYTES = 8 * 1024;

// Must match ARGON2_PARAMS in lib/password-hash.ts
const NEW_HASH_OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1, hashLength: 32 };

if (SECRET.length < 32) {
    console.error('AUTH_HASH_SECRET is missing or shorter than 32 characters. Put it in .env next to server.mjs.');
    process.exit(1);
}
const SECRET_BUF = Buffer.from(SECRET);

function secretMatches(given) {
    const buf = Buffer.from(String(given || ''));
    return buf.length === SECRET_BUF.length && crypto.timingSafeEqual(buf, SECRET_BUF);
}

function send(res, status, body) {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
}

function readJson(req) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', (c) => {
            size += c.length;
            if (size > MAX_BODY_BYTES) {
                reject(new Error('too large'));
                req.destroy();
                return;
            }
            chunks.push(c);
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
            } catch {
                reject(new Error('bad json'));
            }
        });
        req.on('error', reject);
    });
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true });
    if (req.method !== 'POST') return send(res, 404, { error: 'Not found' });
    if (!secretMatches(req.headers['x-auth-hash-secret'])) return send(res, 401, { error: 'Unauthorized' });

    let body;
    try {
        body = await readJson(req);
    } catch {
        return send(res, 400, { error: 'Invalid body' });
    }
    if (typeof body?.plain !== 'string' || body.plain.length === 0 || body.plain.length > 1024) {
        return send(res, 400, { error: 'Invalid input' });
    }

    try {
        if (url.pathname === '/verify') {
            if (typeof body.phc !== 'string' || !body.phc.startsWith('$argon2')) return send(res, 200, { ok: false });
            let ok = false;
            try {
                ok = await argon2.verify(body.phc, body.plain);
            } catch {
                ok = false; // malformed hash
            }
            return send(res, 200, { ok });
        }
        if (url.pathname === '/hash') {
            return send(res, 200, { hash: await argon2.hash(body.plain, NEW_HASH_OPTIONS) });
        }
        return send(res, 404, { error: 'Not found' });
    } catch (err) {
        console.error('[auth-hash] error:', err?.message || err);
        return send(res, 500, { error: 'Internal error' });
    }
});

server.listen(PORT, HOST, () => console.log(`[auth-hash] listening on http://${HOST}:${PORT}`));
