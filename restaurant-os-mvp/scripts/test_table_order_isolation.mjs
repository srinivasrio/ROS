import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = 'http://localhost:3000';
const RESTAURANT_CODE = '202616211532';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing Supabase configuration in .env.local');
    process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function run() {
    console.log('========================================================');
    console.log('Testing Cross-Customer & Cross-Table Order Isolation');
    console.log('========================================================\n');

    // 1. Resolve restaurant and find table 1 and table 2
    const { data: rest } = await supabaseAdmin
        .from('restaurants')
        .select('id, name')
        .eq('id', RESTAURANT_CODE)
        .maybeSingle();

    if (!rest) {
        throw new Error(`Restaurant ${RESTAURANT_CODE} not found`);
    }
    const restaurantId = rest.id;
    console.log(`✓ Restaurant: ${rest.name} (${restaurantId})`);

    const { data: tables } = await supabaseAdmin
        .from('tables')
        .select('id, table_number')
        .eq('restaurant_id', restaurantId)
        .in('table_number', ['1', '2']);

    const table1 = tables?.find(t => t.table_number === '1');
    const table2 = tables?.find(t => t.table_number === '2');

    if (!table1 || !table2) {
        throw new Error('Table 1 or Table 2 not found');
    }
    console.log(`✓ Found Table 1 (ID: ${table1.id}) and Table 2 (ID: ${table2.id})`);

    // 2. Find or create an active order for Customer A on Table 1
    const customerAId = 'a1111111-1111-4111-a111-111111111111';
    const customerBId = 'b2222222-2222-4222-b222-222222222222';

    // Upsert Customer A and Customer B
    await supabaseAdmin.from('customers').upsert([
        { id: customerAId, restaurant_id: restaurantId, mobile: '9111111111', name: 'Alice Customer' },
        { id: customerBId, restaurant_id: restaurantId, mobile: '9222222222', name: 'Bob Stranger' }
    ]);

    // Create an active test order for Customer A on Table 1
    const testOrderId = 'e1111111-1111-4111-e111-111111111111';
    await supabaseAdmin.from('orders').upsert({
        id: testOrderId,
        restaurant_id: restaurantId,
        table_id: table1.id,
        customer_id: customerAId,
        customer_phone: '9111111111',
        status: 'preparing',
        is_completed: false,
        order_type: 'DINE_IN',
        total_amount: 350,
        amount_paid: 0,
        order_number: 999901
    });

    console.log(`✓ Active test order created on Table 1 for Customer A (Alice)`);

    try {
        // ----------------------------------------------------
        // TEST 1: Unauthenticated stranger scans Table 1 QR
        // ----------------------------------------------------
        console.log('\n--- TEST 1: Unauthenticated stranger scans Table 1 ---');
        const res1 = await fetch(`${BASE_URL}/api/customer/orders?restaurantId=${RESTAURANT_CODE}&tableNumber=1`);
        const data1 = await res1.json();
        console.log('Response:', data1);
        if (data1.activeOrders?.length !== 0) {
            throw new Error(`LEAK DETECTED: Stranger saw ${data1.activeOrders.length} active orders on Table 1!`);
        }
        console.log('✓ PASSED: Stranger receives 0 active orders on Table 1.');

        // ----------------------------------------------------
        // TEST 2: Customer B (different customer) visits Table 1
        // ----------------------------------------------------
        console.log('\n--- TEST 2: Customer B logs in / scans Table 1 ---');
        const res2 = await fetch(`${BASE_URL}/api/customer/orders?restaurantId=${RESTAURANT_CODE}&tableNumber=1&customerId=${customerBId}`);
        const data2 = await res2.json();
        console.log('Response:', data2);
        if (data2.activeOrders?.length !== 0) {
            throw new Error(`LEAK DETECTED: Customer B saw Customer A's active order on Table 1!`);
        }
        console.log('✓ PASSED: Customer B cannot see Customer A’s order on Table 1.');

        // ----------------------------------------------------
        // TEST 3: Customer A visits Table 1 (their own table)
        // ----------------------------------------------------
        console.log('\n--- TEST 3: Customer A visits Table 1 ---');
        const res3 = await fetch(`${BASE_URL}/api/customer/orders?restaurantId=${RESTAURANT_CODE}&tableNumber=1&customerId=${customerAId}`);
        const data3 = await res3.json();
        const foundOrderA = (data3.activeOrders || []).find(o => o.id === testOrderId);
        if (!foundOrderA) {
            throw new Error(`Customer A could not view their own active order on Table 1!`);
        }
        console.log(`✓ PASSED: Customer A successfully sees their active order (${foundOrderA.id}) on Table 1.`);

        // ----------------------------------------------------
        // TEST 4: Customer A scans Table 2 (different table)
        // ----------------------------------------------------
        console.log('\n--- TEST 4: Customer A scans Table 2 (cross-table isolation) ---');
        const res4 = await fetch(`${BASE_URL}/api/customer/orders?restaurantId=${RESTAURANT_CODE}&tableNumber=2&customerId=${customerAId}`);
        const data4 = await res4.json();
        console.log('Active orders on Table 2 for Customer A:', data4.activeOrders);
        if (data4.activeOrders?.length !== 0) {
            throw new Error(`CROSS-TABLE LEAK: Table 1 active order leaked into Table 2 active orders!`);
        }
        console.log('✓ PASSED: Table 1 order does NOT appear as an active order on Table 2.');

        // ----------------------------------------------------
        // TEST 5: Guest on Table 1 with matching lastOrderId
        // ----------------------------------------------------
        console.log('\n--- TEST 5: Device with lastOrderId visits Table 1 ---');
        const res5 = await fetch(`${BASE_URL}/api/customer/orders?restaurantId=${RESTAURANT_CODE}&tableNumber=1&lastOrderId=${testOrderId}`);
        const data5 = await res5.json();
        const foundGuestOrder = (data5.activeOrders || []).find(o => o.id === testOrderId);
        if (!foundGuestOrder) {
            throw new Error(`Device with lastOrderId could not view their placed order on Table 1!`);
        }
        console.log('✓ PASSED: Device with lastOrderId can view their placed order on Table 1.');

        // ----------------------------------------------------
        // TEST 6: Device with Table 1's lastOrderId visits Table 2
        // ----------------------------------------------------
        console.log('\n--- TEST 6: Device with Table 1 lastOrderId visits Table 2 ---');
        const res6 = await fetch(`${BASE_URL}/api/customer/orders?restaurantId=${RESTAURANT_CODE}&tableNumber=2&lastOrderId=${testOrderId}`);
        const data6 = await res6.json();
        if (data6.activeOrders?.length !== 0) {
            throw new Error(`LEAK: Table 1 lastOrderId leaked into Table 2!`);
        }
        console.log('✓ PASSED: Table 1 lastOrderId does not bleed into Table 2.');

        console.log('\n========================================================');
        console.log('ALL 6 ISOLATION TESTS PASSED WITH 100% SUCCESS!');
        console.log('========================================================');

    } finally {
        // Clean up test order and customers
        await supabaseAdmin.from('orders').delete().eq('id', testOrderId);
        await supabaseAdmin.from('customers').delete().in('id', [customerAId, customerBId]);
        console.log('\nCleaned up test data.');
    }
}

run().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
