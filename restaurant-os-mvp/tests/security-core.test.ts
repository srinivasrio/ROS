import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getCustomerTokenName,
    getRestaurantTokenName,
    isTokenValidAndFresh,
    signJwt,
    verifyJwt,
} from '../lib/jwt-utils.ts';

test('signJwt and verifyJwt enforce HS256, secret length, and expiration', async () => {
    const prevSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'unit_test_jwt_secret_at_least_32_characters_long';

    try {
        const token = await signJwt(
            { userId: 'u-1', role: 'owner', restaurantId: '202609089153' },
            120
        );
        const verified = await verifyJwt(token);
        assert.ok(verified);
        assert.equal(verified.userId, 'u-1');
        assert.equal(verified.role, 'owner');
        assert.equal(isTokenValidAndFresh(token), true);

        // Tampered token must fail verification
        const tampered = `${token.slice(0, -3)}abc`;
        assert.equal(await verifyJwt(tampered), null);

        // Expired token must fail verification
        const expired = await signJwt({ userId: 'u-1' }, -30);
        assert.equal(await verifyJwt(expired), null);
        assert.equal(isTokenValidAndFresh(expired), false);

        // alg=none unsigned token must fail
        const hdr = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
        const pld = Buffer.from(JSON.stringify({ userId: 'u-1', role: 'super_admin', exp: Math.floor(Date.now() / 1000) + 60 })).toString('base64url');
        assert.equal(await verifyJwt(`${hdr}.${pld}.`), null);
    } finally {
        if (prevSecret === undefined) {
            delete process.env.JWT_SECRET;
        } else {
            process.env.JWT_SECRET = prevSecret;
        }
    }
});

test('cookie naming helpers sanitize restaurant IDs', () => {
    assert.equal(getRestaurantTokenName('2026/09..08!'), 'dine_auth_token_2026_09__08_');
    assert.equal(getCustomerTokenName('rest-abc_1'), 'dine_customer_token_rest-abc_1');
});
