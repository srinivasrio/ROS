#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import assert from 'assert';

// 1. Auto-load environment
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && fs.existsSync('.env.local')) {
    const lines = fs.readFileSync('.env.local', 'utf8').split('\n');
    for (const line of lines) {
        const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (m) {
            let v = (m[2] || '').trim().replace(/^['\"]|['\"]$/g, '');
            process.env[m[1]] = v;
        }
    }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://72.61.250.231:8010';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false }
});

const TEST_RESTAURANT = 'lifecycle-test-rest-' + Date.now();
const OTHER_RESTAURANT = 'lifecycle-other-rest-' + Date.now();
const TEST_PHONE_A = '9876501111';
const TEST_PHONE_B = '9876502222';
const TABLE_1 = 'T-101';
const TABLE_2 = 'T-102';

async function runTests() {
    console.log('🚀 =========================================================');
    console.log('🚀 Customer Table Session Lifecycle E2E Test Suite');
    console.log('🚀 =========================================================\n');

    let createdSessionIds = [];

    try {
        // --- SETUP ---
        console.log('📦 Setting up test tables in database...');
        const { data: t1, error: t1Err } = await supabase.from('tables').insert({
            restaurant_id: TEST_RESTAURANT,
            table_number: TABLE_1,
            status: 'available',
            capacity: 4
        }).select().single();
        if (t1Err) throw new Error('Failed to create test table 1: ' + t1Err.message);

        const { data: t2, error: t2Err } = await supabase.from('tables').insert({
            restaurant_id: TEST_RESTAURANT,
            table_number: TABLE_2,
            status: 'available',
            capacity: 4
        }).select().single();
        if (t2Err) throw new Error('Failed to create test table 2: ' + t2Err.message);

        // --- TEST 1: Empty session creation, customer logout, and immediate scan of another table ---
        console.log('\n🧪 Test 1: Empty session created, customer logs out -> Session auto-expires, customer can scan new table');
        const { data: s1, error: s1Err } = await supabase.from('table_active_sessions').insert({
            restaurant_id: TEST_RESTAURANT,
            table_id: String(t1.id),
            table_number: TABLE_1,
            host_customer_name: 'Diner Alice',
            host_customer_mobile: TEST_PHONE_A,
            status: 'ACTIVE',
            is_active: true,
            last_activity_at: new Date().toISOString(),
        }).select().single();
        assert(!s1Err && s1, 'Session 1 created successfully');
        createdSessionIds.push(s1.id);

        // Simulate customer logout via lifecycle logic (empty session, no orders, no cart)
        const { TableSessionLifecycleService } = await import('../services/table-session-lifecycle.service.ts');
        const logoutRes1 = await TableSessionLifecycleService.handleCustomerLogout(
            TEST_RESTAURANT,
            TEST_PHONE_A,
            {}
        );
        assert(logoutRes1.sessionExpired === true, 'Empty session was expired upon logout');

        // Verify session 1 status in database
        const { data: s1Check } = await supabase.from('table_active_sessions').select('status, is_active').eq('id', s1.id).single();
        assert(s1Check.status === 'EXPIRED' && s1Check.is_active === false, 'Session 1 is EXPIRED and is_active is false');

        // Customer now scans Table 2 -> Should release without blocking!
        const releaseRes = await TableSessionLifecycleService.checkAndReleasePreviousSession(
            TEST_RESTAURANT,
            TEST_PHONE_A,
            TABLE_2
        );
        assert(releaseRes.released === false && !releaseRes.previousSession, 'Customer has no conflicting active session and can claim Table 2');
        console.log('✅ Test 1 Passed: Empty session released cleanly, no blocking on Table 2.');

        // --- TEST 2: Customer with cart items logs out -> Cart is preserved for recovery within 10 minutes ---
        console.log('\n🧪 Test 2: Customer logs out with cart items -> Preserved on session, recoverable within 10m');
        const { data: s2, error: s2Err } = await supabase.from('table_active_sessions').insert({
            restaurant_id: TEST_RESTAURANT,
            table_id: String(t2.id),
            table_number: TABLE_2,
            host_customer_name: 'Diner Bob',
            host_customer_mobile: TEST_PHONE_B,
            status: 'ACTIVE',
            is_active: true,
            last_activity_at: new Date().toISOString(),
        }).select().single();
        assert(!s2Err && s2, 'Session 2 created');
        createdSessionIds.push(s2.id);

        const sampleCart = {
            'item-101': { menu_item_id: 101, name: 'Paneer Butter Masala', quantity: 2, price: 250 }
        };

        const logoutRes2 = await TableSessionLifecycleService.handleCustomerLogout(
            TEST_RESTAURANT,
            TEST_PHONE_B,
            sampleCart
        );
        assert(logoutRes2.sessionPreserved === true, 'Session with cart is preserved for recovery');

        // Test cart recovery
        const recovered = await TableSessionLifecycleService.recoverCart(
            TEST_RESTAURANT,
            TABLE_2,
            TEST_PHONE_B
        );
        assert(recovered.hasRecoverableCart === true, 'Cart is recoverable from server');
        assert(recovered.cart['item-101']?.name === 'Paneer Butter Masala', 'Recovered item matches preserved cart');
        console.log('✅ Test 2 Passed: Cart items preserved and recovered successfully.');

        // --- TEST 3: Customer with active food orders logs out -> Orders and session preserved ---
        console.log('\n🧪 Test 3: Customer logs out while food orders exist -> Session and orders protected');
        // Insert an active order on Table 2
        const { data: ord1, error: ordErr } = await supabase.from('orders').insert({
            restaurant_id: TEST_RESTAURANT,
            table_id: t2.id,
            status: 'placed',
            is_completed: false,
            total_amount: 500,
            customer_phone: TEST_PHONE_B
        }).select().single();
        assert(!ordErr && ord1, 'Order created on Table 2');

        const logoutRes3 = await TableSessionLifecycleService.handleCustomerLogout(
            TEST_RESTAURANT,
            TEST_PHONE_B
        );
        assert(logoutRes3.sessionPreserved === true, 'Protected session with active orders is not terminated');

        // Verify order is completely intact in DB
        const { data: ordCheck } = await supabase.from('orders').select('id, status, is_completed').eq('id', ord1.id).single();
        assert(ordCheck && ordCheck.status === 'placed' && ordCheck.is_completed === false, 'Order remains safely active in database');
        console.log('✅ Test 3 Passed: Orders and session remain safe on logout.');

        // --- TEST 4: Multiple customers share a table -> Member logs out, session remains active ---
        console.log('\n🧪 Test 4: Member logs out -> Host and shared table session remain active');
        const { data: jr1, error: jrErr } = await supabase.from('table_join_requests').insert({
            session_id: s2.id,
            restaurant_id: TEST_RESTAURANT,
            table_number: TABLE_2,
            requester_customer_name: 'Member Charlie',
            requester_customer_mobile: '9876503333',
            status: 'approved',
            membership_status: 'ACTIVE'
        }).select().single();
        assert(!jrErr && jr1, 'Join request created and approved');

        const memberLogout = await TableSessionLifecycleService.handleCustomerLogout(
            TEST_RESTAURANT,
            '9876503333'
        );
        assert(memberLogout.membershipReleased === true && memberLogout.sessionPreserved === true, 'Member released, host session preserved');

        // Check join request membership status is INACTIVE
        const { data: jrCheck } = await supabase.from('table_join_requests').select('membership_status').eq('id', jr1.id).single();
        assert(jrCheck.membership_status === 'INACTIVE', 'Member status updated to INACTIVE');

        // Check session 2 is still ACTIVE
        const { data: s2Check } = await supabase.from('table_active_sessions').select('status, is_active').eq('id', s2.id).single();
        assert(s2Check.status === 'ACTIVE' && s2Check.is_active === true, 'Host session 2 remains ACTIVE');
        console.log('✅ Test 4 Passed: Shared session remains active when guest member logs out.');

        // --- TEST 5: Staff table closure requires orders to be settled ---
        console.log('\n🧪 Test 5: Staff table clearance -> Rejects unsettled orders, succeeds when paid');
        try {
            await TableSessionLifecycleService.closeTableByStaff(t2.id, TEST_RESTAURANT, 'staff-01');
            assert.fail('Should have thrown error due to unsettled order');
        } catch (closeErr) {
            assert(closeErr.message.includes('unsettled'), 'Table close rejected while orders are unsettled: ' + closeErr.message);
        }

        // Mark order as paid
        await supabase.from('orders').update({ status: 'paid', is_completed: true }).eq('id', ord1.id);

        // Close table again -> Should succeed
        const closeSuccess = await TableSessionLifecycleService.closeTableByStaff(t2.id, TEST_RESTAURANT, 'staff-01');
        assert(closeSuccess.success === true, 'Table closed successfully after order was paid');

        const { data: s2Closed } = await supabase.from('table_active_sessions').select('status, is_active, closed_at').eq('id', s2.id).single();
        assert(s2Closed.status === 'CLOSED' && s2Closed.is_active === false && Boolean(s2Closed.closed_at), 'Session status transitioned to CLOSED with timestamp');
        console.log('✅ Test 5 Passed: Table close enforced order settlement, cleanly transitioned status to CLOSED.');

        // --- TEST 6: Scheduled cleanup RPC expires abandoned sessions ---
        console.log('\n🧪 Test 6: Scheduled cleanup RPC -> Atomically expires abandoned empty sessions');
        // Insert an abandoned session created 15 minutes ago
        const pastDate = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const { data: sOld, error: sOldErr } = await supabase.from('table_active_sessions').insert({
            restaurant_id: TEST_RESTAURANT,
            table_id: String(t1.id),
            table_number: TABLE_1,
            host_customer_name: 'Diner Ghost',
            host_customer_mobile: '9876509999',
            status: 'ACTIVE',
            is_active: true,
            created_at: pastDate,
            last_activity_at: pastDate,
            cart_data: {},
        }).select().single();
        assert(!sOldErr && sOld, 'Old session created');
        createdSessionIds.push(sOld.id);

        const cleanupResult = await TableSessionLifecycleService.runScheduledCleanup(TEST_RESTAURANT);
        assert(cleanupResult.cleanedCount >= 1, 'Cleanup RPC expired at least 1 abandoned session');

        const { data: sOldCheck } = await supabase.from('table_active_sessions').select('status, is_active, closure_reason').eq('id', sOld.id).single();
        assert(sOldCheck.status === 'EXPIRED' && sOldCheck.is_active === false && sOldCheck.closure_reason === 'INACTIVITY_TIMEOUT', 'Old session expired due to INACTIVITY_TIMEOUT');
        console.log('✅ Test 6 Passed: Scheduled cleanup expired abandoned session.');

        // --- TEST 7: Cross-restaurant isolation ---
        console.log('\n🧪 Test 7: Cross-restaurant isolation -> Access across restaurants is segregated');
        const crossCheck = await TableSessionLifecycleService.checkAndReleasePreviousSession(
            OTHER_RESTAURANT,
            TEST_PHONE_B,
            TABLE_1
        );
        assert(crossCheck.released === false && !crossCheck.previousSession, 'Customer in Restaurant A has no session in Other Restaurant');
        console.log('✅ Test 7 Passed: Cross-restaurant queries strictly isolated.');

        console.log('\n🎉 =========================================================');
        console.log('🎉 ALL 7 LIFECYCLE TESTS PASSED PERFECTLY!');
        console.log('🎉 =========================================================\n');

    } finally {
        // --- CLEANUP ---
        console.log('🧹 Cleaning up test data...');
        if (createdSessionIds.length > 0) {
            await supabase.from('table_join_requests').delete().in('session_id', createdSessionIds);
            await supabase.from('table_active_sessions').delete().in('id', createdSessionIds);
        }
        await supabase.from('orders').delete().in('restaurant_id', [TEST_RESTAURANT, OTHER_RESTAURANT]);
        await supabase.from('tables').delete().in('restaurant_id', [TEST_RESTAURANT, OTHER_RESTAURANT]);
        console.log('✨ Cleanup complete.');
    }
}

runTests().catch(err => {
    console.error('❌ Test suite failed:', err);
    process.exit(1);
});
