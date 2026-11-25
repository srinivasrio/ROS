import test from 'node:test';
import assert from 'node:assert/strict';
import {
    authorizeWebSocketClaims,
    constantTimeEqualStrings,
    getCorsHeaders,
    shouldDeliverBroadcast,
    verifyToken,
    type SocketAttachment,
} from '../workers/realtime/auth.ts';

async function signTestJwt(
    payload: Record<string, unknown>,
    secret: string,
    header: Record<string, unknown> = { alg: 'HS256', typ: 'JWT' }
): Promise<string> {
    const b64u = (str: string) =>
        Buffer.from(str, 'utf8').toString('base64url');
    const input = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify(payload))}`;
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input));
    return `${input}.${Buffer.from(new Uint8Array(sig)).toString('base64url')}`;
}

test('verifyToken validates HS256 JWTs across app and Supabase secrets', async () => {
    const appSecret = 'app_secret_at_least_32_characters_long_1234';
    const supaSecret = 'supa_secret_at_least_32_characters_long_5678';
    const futureExp = Math.floor(Date.now() / 1000) + 300;

    const token = await signTestJwt(
        { scope: 'customer', restaurant_ids: ['rest-1'], table_id: '7', exp: futureExp },
        supaSecret
    );

    const decoded = await verifyToken(token, appSecret, supaSecret);
    assert.ok(decoded);
    assert.equal(decoded.scope, 'customer');
    assert.deepEqual(decoded.restaurant_ids, ['rest-1']);
    assert.equal(decoded.table_id, '7');
});

test('verifyToken rejects expired, tampered, and alg:none tokens', async () => {
    const secret = 'test_secret_at_least_32_characters_long_9999';
    const pastExp = Math.floor(Date.now() / 1000) - 60;

    const expired = await signTestJwt({ restaurantId: 'r1', exp: pastExp }, secret);
    assert.equal(await verifyToken(expired, secret), null);

    const valid = await signTestJwt({ restaurantId: 'r1', exp: Math.floor(Date.now() / 1000) + 60 }, secret);
    const tampered = `${valid.slice(0, -4)}xxxx`;
    assert.equal(await verifyToken(tampered, secret), null);

    const algNone = await signTestJwt(
        { restaurantId: 'r1', role: 'super_admin', exp: Math.floor(Date.now() / 1000) + 60 },
        secret,
        { alg: 'none', typ: 'JWT' }
    );
    assert.equal(await verifyToken(algNone, secret), null);
});

test('authorizeWebSocketClaims enforces tenant isolation and ignores spoofed role/table', () => {
    // Missing restaurant claim must fail for non-superadmin
    const missingRest = authorizeWebSocketClaims({ scope: 'staff', sub: 'u1' }, 'rest-1');
    assert.equal(missingRest.ok, false);
    if (!missingRest.ok) assert.equal(missingRest.status, 403);

    // Cross-restaurant access must fail
    const wrongRest = authorizeWebSocketClaims(
        { scope: 'staff', restaurant_ids: ['rest-1'], sub: 'u1' },
        'rest-2'
    );
    assert.equal(wrongRest.ok, false);
    if (!wrongRest.ok) assert.equal(wrongRest.status, 403);

    // Customer token without table scope must fail
    const customerNoTable = authorizeWebSocketClaims(
        { scope: 'customer', restaurant_ids: ['rest-1'], sub: 'c1' },
        'rest-1'
    );
    assert.equal(customerNoTable.ok, false);
    if (!customerNoTable.ok) assert.equal(customerNoTable.status, 403);

    // Valid customer token binds strictly to JWT role and table_id
    const customerOk = authorizeWebSocketClaims(
        { scope: 'customer', restaurant_ids: ['rest-1'], table_id: '12', sub: 'sess-1' },
        'rest-1'
    );
    assert.deepEqual(customerOk, {
        ok: true,
        role: 'customer',
        tableNumber: '12',
        userId: 'sess-1',
    });

    // Super admin may connect to any requested restaurant
    const superAdminOk = authorizeWebSocketClaims(
        { role: 'super_admin', userId: 'sa-1' },
        'any-rest'
    );
    assert.deepEqual(superAdminOk, {
        ok: true,
        role: 'super_admin',
        tableNumber: '',
        userId: 'sa-1',
    });
});

test('shouldDeliverBroadcast isolates customer tables and filters KDS/delivery roles', () => {
    const customerMeta: SocketAttachment = {
        role: 'customer',
        tableNumber: '5',
        userId: 'c5',
        connectedAt: 1,
    };

    assert.equal(
        shouldDeliverBroadcast(customerMeta, { table: 'orders', record: { table_number: '5' } }),
        true
    );
    assert.equal(
        shouldDeliverBroadcast(customerMeta, { table: 'orders', record: { table_number: '6' } }),
        false
    );
    assert.equal(
        shouldDeliverBroadcast({ ...customerMeta, tableNumber: null }, { table: 'orders', record: { table_number: '5' } }),
        false
    );
    assert.equal(
        shouldDeliverBroadcast(null, { table: 'orders', record: { table_number: '5' } }),
        false
    );

    const kdsMeta: SocketAttachment = {
        role: 'kds',
        tableNumber: null,
        userId: 'k1',
        connectedAt: 1,
    };
    assert.equal(shouldDeliverBroadcast(kdsMeta, { table: 'orders', record: {} }), true);
    assert.equal(shouldDeliverBroadcast(kdsMeta, { table: 'service_requests', record: {} }), false);
});

test('getCorsHeaders and constantTimeEqualStrings enforce allowlist and exact match', () => {
    const allowedReq = new Request('https://realtime.dineinone.com/health', {
        headers: { Origin: 'https://owner.dineinone.com' },
    });
    assert.equal(getCorsHeaders(allowedReq)['Access-Control-Allow-Origin'], 'https://owner.dineinone.com');

    const evilReq = new Request('https://realtime.dineinone.com/health', {
        headers: { Origin: 'https://evil.dineinone.com.attacker.test' },
    });
    assert.equal(getCorsHeaders(evilReq)['Access-Control-Allow-Origin'], undefined);

    assert.equal(constantTimeEqualStrings('abc123', 'abc123'), true);
    assert.equal(constantTimeEqualStrings('abc123', 'abc124'), false);
    assert.equal(constantTimeEqualStrings('abc123', 'abc12'), false);
});
