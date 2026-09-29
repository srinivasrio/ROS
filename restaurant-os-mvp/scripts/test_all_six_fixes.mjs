import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const BASE_URL = 'http://localhost:3000';
const RESTAURANT_ID = '202609084623';

async function runTests() {
    console.log('=== STARTING VERIFICATION OF ALL 6 FIXES ===\n');

    let passed = 0;
    let failed = 0;

    const assert = (condition, desc) => {
        if (condition) {
            console.log(`✅ PASS: ${desc}`);
            passed++;
        } else {
            console.error(`❌ FAIL: ${desc}`);
            failed++;
        }
    };

    // FIX 1 & 5: Waiter status toggle for existing registered staff
    console.log('--- TEST 1: Existing registered staff can become ONLINE (No unauthorized warning) ---');
    try {
        // Fetch existing waiter Nivas (mobile 9704011668)
        const { data: nivas } = await supabaseAdmin
            .from('employees')
            .select('id, name, mobile, status, approval_status, is_online')
            .eq('mobile', '9704011668')
            .eq('restaurant_id', RESTAURANT_ID)
            .single();

        assert(nivas && nivas.status === 'active' && nivas.approval_status === 'approved', 'Existing waiter Nivas is active and approved');

        // Toggle Nivas ONLINE via /api/waiter/status
        const onlineRes = await fetch(`${BASE_URL}/api/waiter/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                isOnline: true,
                waiterId: nivas.id,
                mobile: nivas.mobile,
                restaurantId: RESTAURANT_ID
            })
        });

        const onlineData = await onlineRes.json();
        assert(onlineRes.ok && onlineData.success === true && onlineData.is_online === true, 'Nivas successfully went ONLINE without unauthorized warning');

        // Verify DB state
        const { data: nivasOnline } = await supabaseAdmin
            .from('employees')
            .select('is_online, availability_status')
            .eq('id', nivas.id)
            .single();

        assert(nivasOnline.is_online === true && nivasOnline.availability_status === 'available', 'Database reflects Nivas is_online=true and availability_status=available');

        // Toggle Nivas OFFLINE via /api/waiter/status
        const offlineRes = await fetch(`${BASE_URL}/api/waiter/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                isOnline: false,
                waiterId: nivas.id,
                mobile: nivas.mobile,
                restaurantId: RESTAURANT_ID
            })
        });

        const offlineData = await offlineRes.json();
        assert(offlineRes.ok && offlineData.success === true && offlineData.is_online === false, 'Nivas successfully went OFFLINE without unauthorized warning');

    } catch (err) {
        console.error('Test 1 error:', err);
        failed++;
    }

    // TEST 2: New unactivated account gets blocked (warning: unauthorized/pending activation)
    console.log('\n--- TEST 2: Unactivated new accounts are blocked from going online ---');
    try {
        const dummyId = crypto.randomUUID();
        // Insert a new unactivated employee
        await supabaseAdmin.from('employees').insert({
            id: dummyId,
            restaurant_id: RESTAURANT_ID,
            name: 'Test New Waiter',
            mobile: '9999888877',
            role: 'waiter',
            status: 'pending_activation',
            approval_status: 'pending_verification'
        });

        const blockedRes = await fetch(`${BASE_URL}/api/waiter/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                isOnline: true,
                waiterId: dummyId,
                mobile: '9999888877',
                restaurantId: RESTAURANT_ID
            })
        });

        const blockedData = await blockedRes.json();
        assert(blockedRes.status === 403 && blockedData.error.includes('pending activation'), 'New unactivated account is strictly blocked with 403 Unauthorized');

        // Cleanup dummy
        await supabaseAdmin.from('employees').delete().eq('id', dummyId);
    } catch (err) {
        console.error('Test 2 error:', err);
        failed++;
    }

    // FIX 2, 3, 4: Menu, Service data, and Specials fetching
    console.log('\n--- TEST 3: Customer Panel Menu, Service Options, and Specials Queries ---');
    try {
        // Test Specials service directly
        const { SpecialsService } = await import('../services/specials.service.js').catch(async () => {
            return await import('../services/specials.service.ts');
        });
        const specials = await SpecialsService.fetchActiveSpecials(RESTAURANT_ID);
        assert(Array.isArray(specials) && specials.length > 0, `SpecialsService.fetchActiveSpecials returned ${specials.length} active specials without error`);

        // Test ServiceOptions service directly
        const { ServiceOptionsService } = await import('../services/service-options.service.js').catch(async () => {
            return await import('../services/service-options.service.ts');
        });
        const serviceOptions = await ServiceOptionsService.fetchActive(RESTAURANT_ID);
        assert(Array.isArray(serviceOptions) && serviceOptions.length > 0, `ServiceOptionsService.fetchActive returned ${serviceOptions.length} active options without error`);

        // Test MenuService
        const { MenuService } = await import('../services/menu.service.js').catch(async () => {
            return await import('../services/menu.service.ts');
        });
        const categories = await MenuService.fetchCategories(RESTAURANT_ID);
        assert(Array.isArray(categories) && categories.length > 0, `MenuService.fetchCategories returned ${categories.length} categories`);

        const items = await MenuService.fetchMenuItems(RESTAURANT_ID);
        assert(Array.isArray(items) && items.length > 0, `MenuService.fetchMenuItems returned ${items.length} menu items`);

    } catch (err) {
        console.error('Test 3 error:', err);
        failed++;
    }

    // FIX 6: Admin staff table shows is_online
    console.log('\n--- TEST 4: Admin Staff Fetching includes is_online field ---');
    try {
        const { StaffService } = await import('../services/staff.service.js').catch(async () => {
            return await import('../services/staff.service.ts');
        });
        const staff = await StaffService.fetchStaff(RESTAURANT_ID);
        assert(Array.isArray(staff) && staff.length > 0, `StaffService.fetchStaff returned ${staff.length} employees`);
        const hasOnlineField = staff.every(s => typeof s.is_online !== 'undefined');
        assert(hasOnlineField, 'Every staff member record includes is_online boolean field for Admin UI');
    } catch (err) {
        console.error('Test 4 error:', err);
        failed++;
    }

    console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests();
