import { createClient } from '@supabase/supabase-js';
import { OrderService } from '../services/orders.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runOccupancyLifecycleTest() {
    console.log('===========================================================');
    console.log('   TABLE OCCUPANCY & ASSIGNMENT LIFECYCLE TEST SUITE       ');
    console.log('===========================================================');

    const restaurantId = '202603180001';

    // 1. Get 2 active waiters for testing
    const { data: waiters, error: waiterErr } = await supabase
        .from('employees')
        .select('id, name, is_online, availability_status')
        .eq('restaurant_id', restaurantId)
        .ilike('role', 'waiter')
        .eq('status', 'active')
        .eq('is_deleted', false)
        .order('id', { ascending: true })
        .limit(2);

    if (waiterErr || !waiters || waiters.length < 2) {
        console.error('Need at least 2 active waiters. Found:', waiters);
        process.exit(1);
    }

    const waiterA = waiters[0];
    const waiterB = waiters[1];
    console.log(`[Setup] Waiter A: ${waiterA.name} (${waiterA.id})`);
    console.log(`[Setup] Waiter B: ${waiterB.name} (${waiterB.id})`);

    // 2. Pick a test table (e.g. Table 1)
    const { data: tableData, error: tableErr } = await supabase
        .from('tables')
        .select('id, table_number, status, assigned_waiter_id')
        .eq('restaurant_id', restaurantId)
        .eq('table_number', '1')
        .single();

    if (tableErr || !tableData) {
        console.error('Test table 1 not found:', tableErr);
        process.exit(1);
    }

    const testTableId = tableData.id;
    console.log(`[Setup] Test Table: ID ${testTableId}, Table Number: ${tableData.table_number}`);

    // Pre-test cleanup: ensure table 1 is cleared and any leftover test orders are completed
    await OrderService.clearTable(testTableId, restaurantId);

    // TEST 1: Initial state must be AVAILABLE with no waiter
    console.log('\n--- TEST 1: Initial State Verification ---');
    const { data: initialRpc } = await supabase.rpc('get_tables_by_restaurant', { p_restaurant_id: restaurantId });
    const tableInitial = (initialRpc || []).find((t: any) => String(t.id) === String(testTableId));

    if (!tableInitial) throw new Error('Table not found in RPC output');
    console.log(`Table Status: "${tableInitial.status}", Assigned Waiter: "${tableInitial.assigned_waiter_name || 'NONE'}"`);

    if (tableInitial.status !== 'available') {
        throw new Error(`Expected status 'available', got '${tableInitial.status}'`);
    }
    if (tableInitial.assigned_waiter_id !== null || tableInitial.assigned_waiter_name !== null) {
        throw new Error(`Expected assigned_waiter to be null, got '${tableInitial.assigned_waiter_name}'`);
    }
    console.log('✓ TEST 1 PASSED: Table starts as genuinely AVAILABLE with no waiter.');

    // TEST 2: Customer orders food -> Table becomes OCCUPIED with Waiter A
    console.log('\n--- TEST 2: Order Placed -> Occupied with Waiter A ---');
    // Get a menu item for order
    const { data: menuItem } = await supabase
        .from('menu_items')
        .select('id, name, price')
        .eq('restaurant_id', restaurantId)
        .limit(1)
        .single();

    if (!menuItem) throw new Error('No menu item found to place test order');

    const createdOrder = await OrderService.createOrder(
        tableData.table_number,
        [{
            menu_item_id: menuItem.id,
            quantity: 2,
            price: menuItem.price || 100,
            status: 'placed'
        }],
        restaurantId,
        'placed',
        waiterA.id
    );

    console.log(`Created Order #${createdOrder.id} assigned to Waiter A (${waiterA.name})`);

    // Verify RPC output reflects occupied state and Waiter A
    const { data: rpcAfterOrder } = await supabase.rpc('get_tables_by_restaurant', { p_restaurant_id: restaurantId });
    const tableOccupied = (rpcAfterOrder || []).find((t: any) => String(t.id) === String(testTableId));

    console.log(`Table Status: "${tableOccupied.status}", Host: "${tableOccupied.assigned_waiter_name}"`);
    if (tableOccupied.status !== 'occupied') {
        throw new Error(`Expected status 'occupied', got '${tableOccupied.status}'`);
    }
    if (tableOccupied.assigned_waiter_id !== waiterA.id) {
        throw new Error(`Expected assigned_waiter_id '${waiterA.id}', got '${tableOccupied.assigned_waiter_id}'`);
    }
    console.log('✓ TEST 2 PASSED: Table is OCCUPIED with Waiter A assigned.');

    // TEST 3: Order Completed & Bill Settled
    console.log('\n--- TEST 3: Order Completed & Bill Settled ---');
    await OrderService.settleBill(createdOrder.id, restaurantId, undefined, 'Cashier Test');

    const { data: settledOrder } = await supabase
        .from('orders')
        .select('id, status, is_completed, amount_paid')
        .eq('id', createdOrder.id)
        .single();

    console.log(`Order Status: "${settledOrder?.status}", is_completed: ${settledOrder?.is_completed}`);
    if (settledOrder?.status !== 'paid') {
        throw new Error(`Expected order status 'paid', got '${settledOrder?.status}'`);
    }
    if (settledOrder?.is_completed !== true) {
        throw new Error(`Expected order is_completed = true, got ${settledOrder?.is_completed}`);
    }
    console.log('✓ TEST 3 PASSED: Order is paid and is_completed = true.');

    // TEST 4: Table Cleared -> Immediately AVAILABLE, Waiter Name Removed
    console.log('\n--- TEST 4: Table Cleared -> Immediately AVAILABLE, Waiter Name Removed ---');
    await OrderService.clearTable(testTableId, restaurantId);

    // Check DB table row
    const { data: dbTableAfterClear } = await supabase
        .from('tables')
        .select('id, status, assigned_waiter_id, co_waiter_ids, alert_status')
        .eq('id', testTableId)
        .single();

    console.log(`DB Table status: "${dbTableAfterClear?.status}", assigned_waiter_id: ${dbTableAfterClear?.assigned_waiter_id}`);
    if (dbTableAfterClear?.status !== 'available') {
        throw new Error(`Expected DB status 'available', got '${dbTableAfterClear?.status}'`);
    }
    if (dbTableAfterClear?.assigned_waiter_id !== null) {
        throw new Error(`Expected DB assigned_waiter_id null, got '${dbTableAfterClear?.assigned_waiter_id}'`);
    }

    // Check RPC output
    const { data: rpcAfterClear } = await supabase.rpc('get_tables_by_restaurant', { p_restaurant_id: restaurantId });
    const tableCleared = (rpcAfterClear || []).find((t: any) => String(t.id) === String(testTableId));

    console.log(`RPC Table status: "${tableCleared.status}", Host: "${tableCleared.assigned_waiter_name || 'NONE'}"`);
    if (tableCleared.status !== 'available') {
        throw new Error(`Expected RPC status 'available', got '${tableCleared.status}'`);
    }
    if (tableCleared.assigned_waiter_id !== null || tableCleared.assigned_waiter_name !== null) {
        throw new Error(`Expected RPC assigned_waiter to be null, got '${tableCleared.assigned_waiter_name}'`);
    }

    // Check fetchActiveOrders
    const activeOrders = await OrderService.fetchActiveOrders(restaurantId);
    const orderFoundInActive = activeOrders.some((o: any) => o.id === createdOrder.id);
    if (orderFoundInActive) {
        throw new Error('Cleared order was still returned by fetchActiveOrders!');
    }
    console.log('✓ TEST 4 PASSED: Table status is AVAILABLE, waiter name completely removed, order excluded from active orders.');

    // TEST 5: New customer / waiter can immediately use the table without seeing old waiter
    console.log('\n--- TEST 5: New Customer/Waiter Assignment on Cleared Table ---');
    const newOrder = await OrderService.createOrder(
        tableData.table_number,
        [{
            menu_item_id: menuItem.id,
            quantity: 1,
            price: menuItem.price || 100,
            status: 'placed'
        }],
        restaurantId,
        'placed',
        waiterB.id
    );

    console.log(`New Order #${newOrder.id} placed for Table 1 assigned to Waiter B (${waiterB.name})`);

    const { data: rpcNewCustomer } = await supabase.rpc('get_tables_by_restaurant', { p_restaurant_id: restaurantId });
    const tableWithNewCust = (rpcNewCustomer || []).find((t: any) => String(t.id) === String(testTableId));

    console.log(`Table Status: "${tableWithNewCust.status}", Host: "${tableWithNewCust.assigned_waiter_name}"`);
    if (tableWithNewCust.status !== 'occupied') {
        throw new Error(`Expected new order to mark table occupied, got '${tableWithNewCust.status}'`);
    }
    if (tableWithNewCust.assigned_waiter_id !== waiterB.id || tableWithNewCust.assigned_waiter_name !== waiterB.name) {
        throw new Error(`Expected Waiter B (${waiterB.name}), got '${tableWithNewCust.assigned_waiter_name}'`);
    }
    console.log('✓ TEST 5 PASSED: New order successfully assigned to Waiter B with zero trace of Waiter A.');

    // Cleanup after test
    console.log('\n--- Post-Test Cleanup ---');
    await OrderService.clearTable(testTableId, restaurantId);
    console.log('✓ Table 1 cleared back to AVAILABLE.');

    console.log('\n===========================================================');
    console.log('  ALL OCCUPANCY & ASSIGNMENT LIFECYCLE TESTS PASSED!       ');
    console.log('===========================================================');
}

runOccupancyLifecycleTest().catch((err) => {
    console.error('\n❌ TEST SUITE FAILED:', err);
    process.exit(1);
});
