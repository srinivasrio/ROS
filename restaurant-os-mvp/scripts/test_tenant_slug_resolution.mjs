import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmcsygpphwdubnanwjwz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
if (!SUPABASE_SERVICE_ROLE_KEY || !JWT_SECRET) throw new Error('SUPABASE_SERVICE_ROLE_KEY and JWT_SECRET are required');
const BASE_URL = 'http://localhost:3000';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function base64UrlEncode(str) {
    const base64 = Buffer.from(str).toString('base64');
    return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function signJwt(payload, expiresInSeconds = 3600 * 8) {
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const jwtPayload = { ...payload, exp };
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(jwtPayload));

    const signature = crypto.createHmac('sha256', JWT_SECRET)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
}

async function runSlugResolutionTests() {
    console.log('================================================================');
    console.log('🔒 TENANT SLUG RESOLUTION & BOUNDARY VERIFICATION TEST');
    console.log('================================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`  ✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${message}`);
            failed++;
        }
    }

    const CANONICAL_REST_ID = '202609084623';
    const TEST_SLUG = 'singhania-grand-palace';
    const OTHER_REST_ID = '202603180001';
    const TEST_ADMIN_MOBILE = '9991112222';
    const TEST_ADMIN_EMPID = 'DIOADMIN999';

    const adminUserId = crypto.randomUUID();
    const adminSessionId = crypto.randomUUID();

    // Save original slug
    const { data: originalProfile } = await supabase
        .from('restaurant_profile')
        .select('slug')
        .eq('restaurant_id', CANONICAL_REST_ID)
        .single();
    const originalSlug = originalProfile?.slug;

    try {
        console.log('--- Step 0: Setting up test admin and custom slug ---');
        // Clean up any stale record
        await supabase.from('employees').delete().eq('mobile', TEST_ADMIN_MOBILE);

        // Update profile with custom human-readable slug
        await supabase.from('restaurant_profile').update({
            slug: TEST_SLUG
        }).eq('restaurant_id', CANONICAL_REST_ID);

        // Create active admin
        await supabase.from('employees').insert({
            id: adminUserId,
            employee_id: TEST_ADMIN_EMPID,
            restaurant_id: CANONICAL_REST_ID,
            name: 'Test Slug Admin',
            mobile: TEST_ADMIN_MOBILE,
            role: 'admin',
            status: 'active',
            approval_status: 'approved',
            session_version: 1,
            is_deleted: false
        });

        const adminToken = await signJwt({
            sessionId: adminSessionId,
            userId: adminUserId,
            name: 'Test Slug Admin',
            role: 'restaurant_admin',
            sessionVersion: 1,
            mobile: TEST_ADMIN_MOBILE,
            restaurantId: CANONICAL_REST_ID,
            restaurant_id: CANONICAL_REST_ID
        });

        // Register active session in dine_sessions
        const tokenHash = crypto.createHash('sha256').update(adminToken).digest('hex');
        await supabase.from('dine_sessions').insert({
            id: adminSessionId,
            user_id: adminUserId,
            token_hash: tokenHash,
            device_info: 'test-runner',
            ip_address: '127.0.0.1',
            is_active: true
        });

        console.log(`Test admin created for restaurant ${CANONICAL_REST_ID} with slug "${TEST_SLUG}".\n`);

        // Test 1: Accessing admin dashboard using canonical restaurant ID
        console.log('--- Test 1: Access via Canonical Restaurant ID ---');
        const res1 = await fetch(`${BASE_URL}/${CANONICAL_REST_ID}/admin/dashboard`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token=${adminToken}` }
        });
        const loc1 = res1.headers.get('location') || '';
        assert(res1.status === 200 || (!loc1.includes('invalid_restaurant') && !loc1.includes('waiting-approval')), 
            `Canonical ID access is NOT blocked with invalid_restaurant (status: ${res1.status}, loc: ${loc1 || 'renders 200'})`);

        // Test 2: Accessing admin dashboard using SLUG (The critical bug scenario!)
        console.log('\n--- Test 2: Access via Human-Readable Slug (False Positive Prevention) ---');
        const res2 = await fetch(`${BASE_URL}/${TEST_SLUG}/admin/dashboard`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token=${adminToken}` }
        });
        const loc2 = res2.headers.get('location') || '';
        assert(!loc2.includes('invalid_restaurant'), 
            `Slug URL access is NOT falsely blocked with invalid_restaurant (status: ${res2.status}, loc: ${loc2 || 'renders 200'})`);

        // Test 3: Accessing admin dashboard using lowercase / case-variant canonical ID
        console.log('\n--- Test 3: Access via Case Variant (Lowercase ID) ---');
        const res3 = await fetch(`${BASE_URL}/${CANONICAL_REST_ID.toLowerCase()}/admin/dashboard`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token=${adminToken}` }
        });
        const loc3 = res3.headers.get('location') || '';
        assert(!loc3.includes('invalid_restaurant'), 
            `Case variant ID is NOT falsely blocked (status: ${res3.status}, loc: ${loc3 || 'renders 200'})`);

        // Test 4: Accessing DIFFERENT restaurant's dashboard (Tenant Isolation Enforcement)
        console.log('\n--- Test 4: Cross-Tenant Access to Another Restaurant (Security Enforcement) ---');
        const res4 = await fetch(`${BASE_URL}/${OTHER_REST_ID}/admin/dashboard`, {
            redirect: 'manual',
            headers: { 'Cookie': `dine_auth_token=${adminToken}` }
        });
        const loc4 = res4.headers.get('location') || '';
        assert(loc4.includes('/access-denied') && loc4.includes('reason=invalid_restaurant'), 
            `Cross-tenant access to another restaurant is strictly blocked with invalid_restaurant: ${loc4}`);

        // Test 5: API with matching slug in searchParams
        console.log('\n--- Test 5: API Call with Slug as restaurantId Parameter ---');
        const res5 = await fetch(`${BASE_URL}/api/admin/employees?restaurantId=${TEST_SLUG}`, {
            headers: { 'Cookie': `dine_auth_token=${adminToken}` }
        });
        assert(res5.status !== 403, `API call with slug parameter is NOT blocked by tenant isolation (status: ${res5.status})`);

        // Test 6: API with tampered restaurantId parameter for another restaurant
        console.log('\n--- Test 6: API Call with Cross-Tenant restaurantId Parameter ---');
        const res6 = await fetch(`${BASE_URL}/api/admin/employees?restaurantId=${OTHER_REST_ID}`, {
            headers: { 'Cookie': `dine_auth_token=${adminToken}` }
        });
        assert(res6.status === 403, `API call with cross-tenant restaurantId is strictly blocked with 403 (status: ${res6.status})`);
        const json6 = await res6.json();
        assert(json6.error && json6.error.includes('Tenant isolation violation'), `Error explicitly confirms tenant violation: "${json6.error}"`);

    } finally {
        console.log('\n--- Cleanup ---');
        await supabase.from('employees').delete().eq('mobile', TEST_ADMIN_MOBILE);
        await supabase.from('dine_sessions').delete().eq('id', adminSessionId);
        if (originalSlug !== undefined) {
            await supabase.from('restaurant_profile').update({ slug: originalSlug }).eq('restaurant_id', CANONICAL_REST_ID);
        }
        console.log('Test cleanup complete.');
    }

    console.log('\n================================================================');
    console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
        process.exit(1);
    }
}

runSlugResolutionTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
