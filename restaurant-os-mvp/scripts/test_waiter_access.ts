import { OrderService } from '../services/orders.service';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
    console.log('=== Starting Waiter Access & Table Ownership Test ===');
    const restaurantId = '202603180001';

    // 1. Fetch distinct waiters (role = 'waiter')
    const { data: staffList, error: staffError } = await supabase
        .from('staff')
        .select('id, name, mobile, role')
        .eq('restaurant_id', restaurantId)
        .eq('role', 'waiter')
        .limit(5);

    if (staffError || !staffList || staffList.length < 2) {
        console.error('Failed to fetch test staff:', staffError);
        process.exit(1);
    }

    const waiterA = staffList[0];
    const waiterB = staffList[1];
    // Ensure Waiter C is a regular waiter without admin role
    const waiterC = { id: '00000000-0000-0000-0000-000000000099', name: 'Waiter C (Unauthorized)', role: 'waiter' };

    console.log(`Waiter A (Owner): ${waiterA.name} (${waiterA.id})`);
    console.log(`Waiter B (Requester): ${waiterB.name} (${waiterB.id})`);
    console.log(`Waiter C (Unauthorized): ${waiterC.name} (${waiterC.id})`);

    // 2. Pick a test table and assign to Waiter A
    const { data: tables } = await supabase
        .from('tables')
        .select('id, table_number')
        .eq('restaurant_id', restaurantId)
        .limit(1);

    if (!tables || tables.length === 0) {
        console.error('No tables found for test');
        process.exit(1);
    }

    const testTable = tables[0];
    console.log(`Using Table: ${testTable.table_number} (ID: ${testTable.id})`);

    // Reset table ownership
    await supabase
        .from('tables')
        .update({
            assigned_waiter_id: waiterA.id,
            co_waiter_ids: [],
            transferred_from_waiter_id: null,
            transferred_to_waiter_id: null,
            status: 'available'
        })
        .eq('id', testTable.id);

    // Clean up any old service requests for this table
    await supabase
        .from('service_requests')
        .delete()
        .eq('table_id', testTable.id);

    // 3. Test 1: Customer QR Order Assignment Preservation
    console.log('\n--- Test 1: Customer places order from QR ---');
    const qrOrderResult = await OrderService.createOrder(
        testTable.id,
        [
            {
                menu_item_id: 1,
                name: 'Test Dish',
                price: 250,
                quantity: 1,
                notes: 'Test note',
                item_type: 'standard'
            }
        ],
        restaurantId,
        'queued' // Customer QR order status
    );

    // Verify order waiter_id and table assigned_waiter_id
    const { data: createdOrder } = await supabase
        .from('orders')
        .select('id, waiter_id')
        .eq('id', qrOrderResult.id)
        .single();

    const { data: tableAfterOrder } = await supabase
        .from('tables')
        .select('assigned_waiter_id')
        .eq('id', testTable.id)
        .single();

    console.log(`Table assigned_waiter_id: ${tableAfterOrder?.assigned_waiter_id}`);
    console.log(`Order waiter_id: ${createdOrder?.waiter_id}`);

    if (tableAfterOrder?.assigned_waiter_id !== waiterA.id) {
        console.error('FAIL: Table assigned_waiter_id was changed!');
        process.exit(1);
    }
    if (createdOrder?.waiter_id !== waiterA.id) {
        console.error('FAIL: Order waiter_id was not set to the table assigned waiter!');
        process.exit(1);
    }
    console.log('PASS: Table and Order remain assigned to Waiter A.');

    // 4. Test 2: Chef marks food ready -> only Waiter A receives alert
    console.log('\n--- Test 2: Chef marks dish ready in KDS ---');
    const { data: orderItems } = await supabase
        .from('order_items')
        .select('id')
        .eq('order_id', createdOrder!.id);

    const testItemId = orderItems![0].id;
    await OrderService.updateOrderItemStatus(testItemId, restaurantId, 'ready');

    // Fetch alerts for Waiter A
    const alertsForA = await OrderService.fetchActiveServiceRequests(restaurantId, waiterA.id);
    const readyAlertForA = alertsForA.find((a: any) => a.table_id === testTable.id && a.request_type === 'order_ready');
    console.log(`Waiter A received order_ready alert: ${!!readyAlertForA}`);

    // Fetch alerts for Waiter B
    const alertsForB = await OrderService.fetchActiveServiceRequests(restaurantId, waiterB.id);
    const readyAlertForB = alertsForB.find((a: any) => a.table_id === testTable.id && a.request_type === 'order_ready');
    console.log(`Waiter B received order_ready alert: ${!!readyAlertForB}`);

    if (!readyAlertForA) {
        console.error('FAIL: Waiter A should receive order_ready alert!');
        process.exit(1);
    }
    if (readyAlertForB) {
        console.error('FAIL: Waiter B must NOT receive order_ready alert for Waiter A\'s table!');
        process.exit(1);
    }
    console.log('PASS: Only assigned Waiter A receives the order_ready alert.');

    // 5. Test 3: Unauthorized waiter trying to serve dish
    console.log('\n--- Test 3: Unauthorized Waiter C attempts to mark dish as served ---');
    let threwUnauthorized = false;
    try {
        await OrderService.updateOrderItemStatus(testItemId, restaurantId, 'served', waiterC.id);
    } catch (err: any) {
        threwUnauthorized = true;
        console.log(`Caught expected error: ${err.message}`);
    }

    if (!threwUnauthorized) {
        console.error('FAIL: Unauthorized waiter was able to mark item as served!');
        process.exit(1);
    }
    console.log('PASS: Unauthorized waiter was blocked from serving item.');

    // 6. Test 4: Waiter B sends Table Access Request
    console.log('\n--- Test 4: Waiter B requests table access ---');
    const accessReqResult = await OrderService.requestTableAccess(
        testTable.id,
        waiterB.id,
        waiterB.name || 'Waiter B',
        restaurantId
    );
    console.log('Table access request result:', accessReqResult);

    // Verify Waiter A receives the table access request
    const alertsForAAfterReq = await OrderService.fetchActiveServiceRequests(restaurantId, waiterA.id);
    const tableAccessAlert = alertsForAAfterReq.find((a: any) => a.table_id === testTable.id && a.request_type === 'table_access_request');
    console.log(`Waiter A received table_access_request: ${!!tableAccessAlert}`);

    if (!tableAccessAlert) {
        console.error('FAIL: Waiter A should receive the table access request!');
        process.exit(1);
    }
    console.log('PASS: Table access request delivered to Waiter A.');

    // 7. Test 5: Waiter A approves table access (share)
    console.log('\n--- Test 5: Waiter A approves table access (share) ---');
    const approveResult = await OrderService.approveTableAccess(
        tableAccessAlert.id,
        waiterA.id,
        'share'
    );
    console.log('Approve result:', approveResult);

    // Verify Waiter B is now in co_waiter_ids
    const { data: tableAfterApproval } = await supabase
        .from('tables')
        .select('assigned_waiter_id, co_waiter_ids')
        .eq('id', testTable.id)
        .single();

    console.log('Table after approval:', tableAfterApproval);
    const isNowCoWaiter = (tableAfterApproval?.co_waiter_ids || []).includes(waiterB.id);
    if (!isNowCoWaiter) {
        console.error('FAIL: Waiter B should be in co_waiter_ids after approval!');
        process.exit(1);
    }
    console.log('PASS: Waiter B is now approved as co-waiter on Table.');

    // 8. Test 6: Waiter B now receives order_ready alert and can serve dish
    console.log('\n--- Test 6: Waiter B now receives alert and can serve dish ---');
    const alertsForBAfterApproval = await OrderService.fetchActiveServiceRequests(restaurantId, waiterB.id);
    const readyAlertForBNow = alertsForBAfterApproval.find((a: any) => a.table_id === testTable.id && a.request_type === 'order_ready');
    console.log(`Waiter B receives order_ready alert after approval: ${!!readyAlertForBNow}`);

    if (!readyAlertForBNow) {
        console.error('FAIL: Waiter B should receive order_ready alert after being approved as co-waiter!');
        process.exit(1);
    }

    // Waiter B marks dish as served
    await OrderService.updateOrderItemStatus(testItemId, restaurantId, 'served', waiterB.id);
    const { data: servedItem } = await supabase
        .from('order_items')
        .select('status')
        .eq('id', testItemId)
        .single();

    console.log(`Item status after Waiter B served: ${servedItem?.status}`);
    if (servedItem?.status !== 'served') {
        console.error('FAIL: Item status should be served!');
        process.exit(1);
    }
    console.log('PASS: Waiter B successfully served the dish after approval.');

    // Cleanup test order
    await supabase.from('order_items').delete().eq('order_id', createdOrder!.id);
    await supabase.from('orders').delete().eq('id', createdOrder!.id);
    await supabase.from('service_requests').delete().eq('table_id', testTable.id);
    await supabase.from('tables').update({ co_waiter_ids: [] }).eq('id', testTable.id);

    console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
}

runTest().catch((err) => {
    console.error('Test failed with error:', err);
    process.exit(1);
});
