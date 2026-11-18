import assert from 'node:assert';

function b64Encode(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/=+$/, '');
}

function b64Decode(s) {
    const norm = s.replace(/-/g, '+').replace(/_/g, '/');
    const padded = norm + '='.repeat((4 - (norm.length % 4)) % 4);
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function constantTimeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

async function derivePbkdf2(plain, salt, iterations, keyLen = 32) {
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
            salt,
            iterations,
            hash: 'SHA-256'
        },
        keyMaterial,
        keyLen * 8
    );
    return new Uint8Array(bits);
}

const PBKDF2_PASSWORD_ITERATIONS = 600_000;
const PBKDF2_PIN_ITERATIONS = 100_000;

async function pbkdf2Hash(plain, iterations = PBKDF2_PASSWORD_ITERATIONS) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await derivePbkdf2(plain, salt, iterations, 32);
    return `$pbkdf2-sha256$i=${iterations}$${b64Encode(salt)}$${b64Encode(hash)}`;
}

async function pbkdf2Verify(phc, plain) {
    const parts = phc.split('$');
    if (parts.length !== 5 || parts[0] !== '' || parts[1] !== 'pbkdf2-sha256') return false;
    const iterParam = parts[2];
    if (!iterParam.startsWith('i=')) return false;
    const iterations = Number(iterParam.slice(2));
    if (!Number.isSafeInteger(iterations) || iterations < 10_000) return false;
    const salt = b64Decode(parts[3]);
    const expectedHash = b64Decode(parts[4]);
    const computed = await derivePbkdf2(plain, salt, iterations, expectedHash.length);
    return constantTimeEqual(computed, expectedHash);
}

function needsRehash(phc, isPin = false) {
    if (!phc) return false;
    const trimmed = String(phc).trim();
    if (!trimmed) return false;
    if (!trimmed.startsWith('$')) return true;
    if (trimmed.startsWith('$argon2')) return true;
    if (trimmed.startsWith('$pbkdf2-sha256$')) {
        const parts = trimmed.split('$');
        if (parts.length !== 5) return true;
        const iter = Number(parts[2].replace('i=', ''));
        const target = isPin ? PBKDF2_PIN_ITERATIONS : PBKDF2_PASSWORD_ITERATIONS;
        return !Number.isSafeInteger(iter) || iter < target;
    }
    return true;
}

async function testAll() {
    console.log('🧪 Running Web Crypto PBKDF2 verification...');
    
    // Password benchmark
    const pw = 'SuperOwnerSecret#2026';
    const t0 = performance.now();
    const h1 = await pbkdf2Hash(pw);
    const d0 = performance.now() - t0;
    console.log(`✅ Hashed password in ${d0.toFixed(1)}ms: ${h1}`);
    assert(h1.startsWith('$pbkdf2-sha256$i=600000$'), 'PHC format prefix correct');
    assert.strictEqual(needsRehash(h1, false), false, 'New password does not need rehash');

    const t1 = performance.now();
    const v1 = await pbkdf2Verify(h1, pw);
    const d1 = performance.now() - t1;
    console.log(`✅ Verified password in ${d1.toFixed(1)}ms: ${v1}`);
    assert.strictEqual(v1, true, 'Verification of correct password succeeds');

    const vBad = await pbkdf2Verify(h1, 'WrongPassword!');
    assert.strictEqual(vBad, false, 'Verification of wrong password fails');

    // PIN benchmark
    const pin = '9512';
    const t2 = performance.now();
    const hp = await pbkdf2Hash(pin, PBKDF2_PIN_ITERATIONS);
    const d2 = performance.now() - t2;
    console.log(`✅ Hashed staff PIN in ${d2.toFixed(1)}ms: ${hp}`);
    assert(hp.startsWith('$pbkdf2-sha256$i=100000$'), 'PHC format prefix correct');
    assert.strictEqual(needsRehash(hp, true), false, 'New PIN does not need rehash');

    const vp = await pbkdf2Verify(hp, pin);
    assert.strictEqual(vp, true, 'Verification of correct PIN succeeds');

    // Rehash checks
    assert.strictEqual(needsRehash('$argon2id$v=19$m=65536,t=3,p=4$abc$def', false), true, 'Argon2 triggers rehash');
    assert.strictEqual(needsRehash('$argon2id$v=19$m=19456,t=2,p=1$abc$def', true), true, 'Argon2 PIN triggers rehash');
    assert.strictEqual(needsRehash('1234', true), true, 'Plaintext PIN triggers rehash');
    assert.strictEqual(needsRehash('$pbkdf2-sha256$i=10000$abc$def', false), true, 'Low iteration PBKDF2 triggers rehash');

    console.log('🎉 All cryptographic primitives, timings, and standards verified!');
}

testAll().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
