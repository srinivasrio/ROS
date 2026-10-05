import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import assert from 'assert';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

if (!SUPABASE_URL || !ANON_KEY || !JWT_SECRET) {
    console.error('Missing required environment variables');
    process.exit(1);
}

function signJwt(payload) {
    const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', JWT_SECRET).update(h + '.' + p).digest('base64url');
    return h + '.' + p + '.' + sig;
}

const REST_A = 'test_tenant_a_' + Date.now();
const REST_B = 'test_tenant_b_' + Date.now();

// Tokens
const adminTokenA = signJwt({
    userId: 'admin-a-' + Date.now(),
    restaurant_id: REST_A,
    role: 'restaurant_admin',
    exp: Math.floor(Date.now() / 1000) + 3600
});

const adminTokenB = signJwt({
    userId: 'admin-b-' + Date.now(),
    restaurant_id: REST_B,
    role: 'restaurant_admin',
    exp: Math.floor(Date.now() / 1000) + 3600
});

const waiterTokenA = signJwt({
    userId: 'waiter-a-' + Date.now(),
    restaurant_id: REST_A,
    role: 'waiter',
    exp: Math.floor(Date.now() / 1000) + 3600
});

const customerTokenA = signJwt({
    userId: 'customer-a-' + Date.now(),
    restaurant_id: REST_A,
    role: 'customer',
    exp: Math.floor(Date.now() / 1000) + 3600
});

// Clients
const anonClient = createClient(SUPABASE_URL, ANON_KEY);

const adminClientA = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { 'x-dine-token': adminTokenA } }
});

const adminClientB = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { 'x-dine-token': adminTokenB } }
});

const waiterClientA = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { 'x-dine-token': waiterTokenA } }
});

const customerClientA = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { 'x-dine-token': customerTokenA } }
});

const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY);

const HP_TABLES = [
    'homepage_sections',
    'homepage_banners',
    'homepage_categories',
    'homepage_services',
    'homepage_specials',
    'section_style_settings',
    'restaurant_theme',
    'restaurant_profile',
    'offers',
    'today_specials',
    'today_special_items'
];

async function runTests() {
    console.log('================================================================');
    console.log('  C4 HOMEPAGE BUILDER RLS / PUBLIC-WRITE SECURITY TEST SUITE');
    console.log('================================================================');
    let passed = 0;
    let total = 0;

    function test(name, fn) {
        total++;
        try {
            fn();
            console.log(`  ✅ [PASS] ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ [FAIL] ${name}:`, err.message);
            throw err;
        }
    }

    async function asyncTest(name, fn) {
        total++;
        try {
            await fn();
            console.log(`  ✅ [PASS] ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ [FAIL] ${name}:`, err.message);
            throw err;
        }
    }

    // Setup test restaurants in database so foreign keys are satisfied
    const { error: restErr } = await serviceClient.from('restaurants').upsert([
        { id: REST_A, name: 'Test C4 Tenant A', owner_name: 'Owner A', phone: '9999999901', email: 'c4_a@test.com', status: 'active' },
        { id: REST_B, name: 'Test C4 Tenant B', owner_name: 'Owner B', phone: '9999999902', email: 'c4_b@test.com', status: 'active' }
    ]);
    if (restErr) {
        throw new Error(`Failed to seed test restaurants: ${restErr.message}`);
    }

    try {
        // ─── PART 1: ANONYMOUS USERS ─────────────────────────────────
        console.log('\n--- Part 1: Anonymous User Access (Public Read OK, Writes Blocked) ---');

        await asyncTest('Anonymous user CAN read public homepage_sections', async () => {
            const { data, error } = await anonClient.from('homepage_sections').select('id, restaurant_id').limit(1);
            assert(!error, `Read should succeed, got error: ${error?.message}`);
            assert(Array.isArray(data), 'Result must be an array');
        });

    await asyncTest('Anonymous user CAN read public homepage_banners', async () => {
        const { data, error } = await anonClient.from('homepage_banners').select('id, restaurant_id').limit(1);
        assert(!error, `Read should succeed, got error: ${error?.message}`);
    });

    await asyncTest('Anonymous user CAN read public restaurant_theme', async () => {
        const { data, error } = await anonClient.from('restaurant_theme').select('id, restaurant_id').limit(1);
        assert(!error, `Read should succeed, got error: ${error?.message}`);
    });

    await asyncTest('Anonymous user CANNOT insert into homepage_sections', async () => {
        const { data, error } = await anonClient.from('homepage_sections').insert({
            restaurant_id: REST_A,
            section_type: 'banners',
            section_title: 'Hacked'
        }).select();
        assert(error, 'Anonymous insert must be blocked by RLS');
        assert(error.message.includes('violates row-level security policy'), `Expected RLS violation, got: ${error.message}`);
    });

    await asyncTest('Anonymous user CANNOT insert into homepage_banners', async () => {
        const { data, error } = await anonClient.from('homepage_banners').insert({
            restaurant_id: REST_A,
            image_url: 'https://hacked.com/img.jpg',
            heading: 'Hacked Banner'
        }).select();
        assert(error, 'Anonymous banner insert must be blocked');
        assert(error.message.includes('violates row-level security policy'));
    });

    await asyncTest('Anonymous user CANNOT insert into restaurant_theme', async () => {
        const { data, error } = await anonClient.from('restaurant_theme').insert({
            restaurant_id: REST_A,
            primary_button_color: '#000000'
        }).select();
        assert(error, 'Anonymous theme insert must be blocked');
        assert(error.message.includes('violates row-level security policy'));
    });

    await asyncTest('Anonymous user CANNOT update homepage_sections', async () => {
        const { data, error } = await anonClient.from('homepage_sections')
            .update({ section_title: 'Hacked Title' })
            .eq('restaurant_id', REST_A)
            .select();
        // Either error or 0 rows returned
        assert(!data || data.length === 0, 'Anonymous update must affect 0 rows');
    });

    await asyncTest('Anonymous user CANNOT delete from homepage_sections', async () => {
        const { data, error } = await anonClient.from('homepage_sections')
            .delete()
            .eq('restaurant_id', REST_A)
            .select();
        assert(!data || data.length === 0, 'Anonymous delete must affect 0 rows');
    });

    // ─── PART 2: RESTAURANT ADMIN VALID TENANT ACCESS ───────────────
    console.log('\n--- Part 2: Restaurant Admin Legitimate Tenant Management ---');

    let sectionIdA = null;
    let bannerIdA = null;
    let themeIdA = null;

    await asyncTest('Admin A CAN insert homepage_sections for REST_A', async () => {
        const { data, error } = await adminClientA.from('homepage_sections').insert({
            restaurant_id: REST_A,
            section_type: 'banners',
            section_title: 'Alpha Main Banners'
        }).select();
        assert(!error, `Insert should succeed, got error: ${error?.message}`);
        assert(data && data.length > 0, 'Should return inserted row');
        sectionIdA = data[0].id;
    });

    await asyncTest('Admin A CAN update homepage_sections for REST_A', async () => {
        assert(sectionIdA, 'sectionIdA must be set');
        const { data, error } = await adminClientA.from('homepage_sections')
            .update({ section_title: 'Alpha Banners Updated' })
            .eq('id', sectionIdA)
            .select();
        assert(!error, `Update should succeed, got error: ${error?.message}`);
        assert(data && data.length > 0, 'Should return updated row');
        assert.strictEqual(data[0].section_title, 'Alpha Banners Updated');
    });

    await asyncTest('Admin A CAN insert homepage_banners for REST_A', async () => {
        const { data, error } = await adminClientA.from('homepage_banners').insert({
            restaurant_id: REST_A,
            image_url: 'https://example.com/banner.jpg',
            heading: 'Alpha Special Promo'
        }).select();
        assert(!error, `Insert banner should succeed: ${error?.message}`);
        assert(data && data.length > 0);
        bannerIdA = data[0].id;
    });

    await asyncTest('Admin A CAN update homepage_banners for REST_A', async () => {
        const { data, error } = await adminClientA.from('homepage_banners')
            .update({ heading: 'Alpha Promo Updated' })
            .eq('id', bannerIdA)
            .select();
        assert(!error, `Update banner should succeed: ${error?.message}`);
        assert.strictEqual(data[0].heading, 'Alpha Promo Updated');
    });

    await asyncTest('Admin A CAN insert restaurant_theme for REST_A', async () => {
        const { data, error } = await adminClientA.from('restaurant_theme').insert({
            restaurant_id: REST_A,
            primary_button_color: '#10B981'
        }).select();
        assert(!error, `Insert theme should succeed: ${error?.message}`);
        themeIdA = data[0].id;
    });

    await asyncTest('Admin A CAN update restaurant_theme for REST_A', async () => {
        const { data, error } = await adminClientA.from('restaurant_theme')
            .update({ primary_button_color: '#059669' })
            .eq('id', themeIdA)
            .select();
        assert(!error, `Update theme should succeed: ${error?.message}`);
        assert.strictEqual(data[0].primary_button_color, '#059669');
    });

    // ─── PART 3: CROSS-TENANT ATTACK TESTS ──────────────────────────
    console.log('\n--- Part 3: Cross-Tenant Isolation (Admin A -> Restaurant B Rejected) ---');

    // Seed Restaurant B data via serviceClient
    const { data: bSection } = await serviceClient.from('homepage_sections').insert({
        restaurant_id: REST_B,
        section_type: 'categories',
        section_title: 'Beta Original Section'
    }).select().single();

    const { data: bBanner } = await serviceClient.from('homepage_banners').insert({
        restaurant_id: REST_B,
        image_url: 'https://beta.com/banner.jpg',
        heading: 'Beta Original Banner'
    }).select().single();

    await asyncTest('Admin A CANNOT insert rows for REST_B', async () => {
        const { data, error } = await adminClientA.from('homepage_sections').insert({
            restaurant_id: REST_B,
            section_type: 'banners',
            section_title: 'Alpha Forged Section on Beta'
        }).select();
        assert(error, 'Cross-tenant insert must fail');
        assert(error.message.includes('violates row-level security policy'));
    });

    await asyncTest('Admin A CANNOT update REST_B homepage_sections', async () => {
        const { data, error } = await adminClientA.from('homepage_sections')
            .update({ section_title: 'Hacked by Alpha Admin' })
            .eq('id', bSection.id)
            .select();
        assert(!data || data.length === 0, 'Cross-tenant update must affect 0 rows');
    });

    await asyncTest('Admin A CANNOT delete REST_B homepage_sections', async () => {
        const { data, error } = await adminClientA.from('homepage_sections')
            .delete()
            .eq('id', bSection.id)
            .select();
        assert(!data || data.length === 0, 'Cross-tenant delete must affect 0 rows');
    });

    await asyncTest('Admin A CANNOT update REST_B homepage_banners', async () => {
        const { data, error } = await adminClientA.from('homepage_banners')
            .update({ heading: 'Hacked by Alpha Admin' })
            .eq('id', bBanner.id)
            .select();
        assert(!data || data.length === 0, 'Cross-tenant banner update must affect 0 rows');
    });

    await asyncTest('Admin A CANNOT delete REST_B homepage_banners', async () => {
        const { data, error } = await adminClientA.from('homepage_banners')
            .delete()
            .eq('id', bBanner.id)
            .select();
        assert(!data || data.length === 0, 'Cross-tenant banner delete must affect 0 rows');
    });

    await asyncTest('REST_B data remains intact and unchanged after attacks', async () => {
        const { data: checkSec } = await serviceClient.from('homepage_sections').select('section_title').eq('id', bSection.id).single();
        assert.strictEqual(checkSec.section_title, 'Beta Original Section', 'Beta section title must not be altered');

        const { data: checkBan } = await serviceClient.from('homepage_banners').select('heading').eq('id', bBanner.id).single();
        assert.strictEqual(checkBan.heading, 'Beta Original Banner', 'Beta banner heading must not be altered');
    });

    // ─── PART 4: ROLE-BASED ACCESS CONTROL ──────────────────────────
    console.log('\n--- Part 4: Role-Based Access Control (Unauthorized Roles Blocked) ---');

    await asyncTest('Waiter CANNOT insert into homepage_sections', async () => {
        const { data, error } = await waiterClientA.from('homepage_sections').insert({
            restaurant_id: REST_A,
            section_type: 'banners',
            section_title: 'Waiter Title'
        }).select();
        assert(error, 'Waiter insert must be blocked');
        assert(error.message.includes('violates row-level security policy'));
    });

    await asyncTest('Waiter CANNOT update homepage_sections', async () => {
        const { data, error } = await waiterClientA.from('homepage_sections')
            .update({ section_title: 'Waiter Updated' })
            .eq('id', sectionIdA)
            .select();
        assert(!data || data.length === 0, 'Waiter update must affect 0 rows');
    });

    await asyncTest('Waiter CANNOT delete homepage_sections', async () => {
        const { data, error } = await waiterClientA.from('homepage_sections')
            .delete()
            .eq('id', sectionIdA)
            .select();
        assert(!data || data.length === 0, 'Waiter delete must affect 0 rows');
    });

    await asyncTest('Customer CANNOT insert into homepage_sections', async () => {
        const { data, error } = await customerClientA.from('homepage_sections').insert({
            restaurant_id: REST_A,
            section_type: 'banners',
            section_title: 'Customer Title'
        }).select();
        assert(error, 'Customer insert must be blocked');
        assert(error.message.includes('violates row-level security policy'));
    });

    // ─── PART 5: FORGED & TAMPERED TOKEN REJECTION ──────────────────
    console.log('\n--- Part 5: Cryptographic Integrity (Forged Tokens Blocked) ---');

    const fakeSecretToken = (() => {
        const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
        const p = Buffer.from(JSON.stringify({
            userId: 'hacker',
            restaurant_id: REST_A,
            role: 'restaurant_admin',
            exp: Math.floor(Date.now() / 1000) + 3600
        })).toString('base64url');
        const sig = crypto.createHmac('sha256', 'fake-secret-key-12345678901234567890').update(h + '.' + p).digest('base64url');
        return h + '.' + p + '.' + sig;
    })();

    const fakeClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { 'x-dine-token': fakeSecretToken } }
    });

    await asyncTest('Forged JWT with wrong secret CANNOT insert', async () => {
        const { data, error } = await fakeClient.from('homepage_sections').insert({
            restaurant_id: REST_A,
            section_type: 'banners',
            section_title: 'Forged Title'
        }).select();
        assert(error, 'Forged JWT insert must fail');
        assert(error.message.includes('violates row-level security policy'));
    });

    const unsignedToken = (() => {
        const h = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
        const p = Buffer.from(JSON.stringify({
            userId: 'hacker',
            restaurant_id: REST_A,
            role: 'restaurant_admin',
            exp: Math.floor(Date.now() / 1000) + 3600
        })).toString('base64url');
        return h + '.' + p + '.';
    })();

    const unsignedClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { 'x-dine-token': unsignedToken } }
    });

    await asyncTest('Unsigned JWT (alg: none) CANNOT insert', async () => {
        const { data, error } = await unsignedClient.from('homepage_sections').insert({
            restaurant_id: REST_A,
            section_type: 'banners',
            section_title: 'Unsigned Title'
        }).select();
        assert(error, 'Unsigned JWT insert must fail');
        assert(error.message.includes('violates row-level security policy'));
    });

    // ─── PART 6: ADMIN A CLEANUP ────────────────────────────────────
    console.log('\n--- Part 6: Legitimate Admin Deletion ---');

    await asyncTest('Admin A CAN delete their own homepage_sections', async () => {
        const { data, error } = await adminClientA.from('homepage_sections')
            .delete()
            .eq('id', sectionIdA)
            .select();
        assert(!error, `Delete section should succeed: ${error?.message}`);
        assert(data && data.length > 0);
    });

    await asyncTest('Admin A CAN delete their own homepage_banners', async () => {
        const { data, error } = await adminClientA.from('homepage_banners')
            .delete()
            .eq('id', bannerIdA)
            .select();
        assert(!error, `Delete banner should succeed: ${error?.message}`);
        assert(data && data.length > 0);
    });

    await asyncTest('Admin A CAN delete their own restaurant_theme', async () => {
        const { data, error } = await adminClientA.from('restaurant_theme')
            .delete()
            .eq('id', themeIdA)
            .select();
        assert(!error, `Delete theme should succeed: ${error?.message}`);
        assert(data && data.length > 0);
    });

        console.log('\n================================================================');
        console.log(`  C4 RLS SECURITY RESULTS: ${passed}/${total} TESTS PASSED`);
        console.log('================================================================\n');
    } finally {
        // Teardown: Clean up any remaining test data for both test tenants
        try {
            await serviceClient.from('homepage_sections').delete().in('restaurant_id', [REST_A, REST_B]);
            await serviceClient.from('homepage_banners').delete().in('restaurant_id', [REST_A, REST_B]);
            await serviceClient.from('restaurant_theme').delete().in('restaurant_id', [REST_A, REST_B]);
            await serviceClient.from('restaurants').delete().in('id', [REST_A, REST_B]);
        } catch (cleanupErr) {
            console.warn('Warning during cleanup:', cleanupErr?.message);
        }
    }
}

runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
