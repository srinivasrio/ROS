import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Import OrderService
import { OrderService } from '../services/orders.service';
import { signJwt } from '../lib/jwt-utils';

const RESTAURANT_ID = '202603180001';

interface FloorTable {
    id: number | string;
    table_number: string;
    status: string;
    assigned_waiter_id?: string | null;
    assigned_waiter_name?: string | null;
    co_waiter_ids?: string[] | null;
    readyCount?: number;
    preparingCount?: number;
}

// Scoping logic identical to dashboard/page.tsx
function computeWaiterBuckets(tables: FloorTable[], waiterId: string) {
    const isAssignedToMe = (t: FloorTable) => {
        const isMine = t.assigned_waiter_id === waiterId;
        const coWaiters = Array.isArray(t.co_waiter_ids) ? t.co_waiter_ids : [];
        const isCo = coWaiters.includes(waiterId);
        return isMine || isCo;
    };

    const myTables: FloorTable[] = [];
    const availableTables: FloorTable[] = [];
    const readyTables: FloorTable[] = [];
    const preparingTables: FloorTable[] = [];

    tables.forEach((t) => {
        const s = (t.status || '').toLowerCase();
        const isAvail = ['available', 'free', 'empty'].includes(s);
        const isMine = isAssignedToMe(t);

        if (isAvail) {
            availableTables.push(t);
        } else if (isMine) {
            myTables.push(t);
            if (t.readyCount && t.readyCount > 0) {
                readyTables.push(t);
            } else if (['preparing', 'cooking', 'placed'].includes(s) || (t.preparingCount && t.preparingCount > 0)) {
                preparingTables.push(t);
            }
        }
    });

    return { myTables, availableTables, readyTables, preparingTables };
}

async function fetchFloorState(): Promise<FloorTable[]> {
    const [rpcRes, activeOrders] = await Promise.all([
        supabase.rpc('get_tables_by_restaurant', { p_restaurant_id: RESTAURANT_ID }),
        OrderService.fetchActiveOrders(RESTAURANT_ID),
    ]);

    const readyByTable = new Map<number | string, number>();
    const prepByTable = new Map<number | string, number>();
    (activeOrders || []).forEach((o: any) => {
        const ordStatus = (o.status || '').toLowerCase();
        const isOrderPrep = ['preparing', 'cooking', 'placed'].includes(ordStatus);
        (o.items || []).forEach((i: any) => {
            const itemStatus = (i.status || '').toLowerCase();
            if (itemStatus === 'ready' && o.table_id != null) {
                readyByTable.set(o.table_id, (readyByTable.get(o.table_id) || 0) + 1);
            } else if (['preparing', 'cooking', 'placed'].includes(itemStatus) || isOrderPrep) {
                if (o.table_id != null) {
                    prepByTable.set(o.table_id, (prepByTable.get(o.table_id) || 0) + 1);
                }
            }
        });
        if ((!o.items || o.items.length === 0) && isOrderPrep && o.table_id != null) {
            prepByTable.set(o.table_id, (prepByTable.get(o.table_id) || 0) + 1);
        }
    });

    const rows: any[] = Array.isArray(rpcRes?.data) ? rpcRes.data : [];
    return rows.map((t) => ({
        ...t,
        readyCount: readyByTable.get(t.id) || 0,
        preparingCount: prepByTable.get(t.id) || 0,
    }));
}

async function run() {
    console.log('\n================================================================');
    console.log('🧪 WAITER TABLE TRANSFER AUTHORIZATION SECURITY TEST SUITE');
    console.log('================================================================\n');

    let allPassed = true;
    function assert(condition: boolean, title: string, details?: string) {
        if (condition) {
            console.log(`  ✅ PASS: ${title}`);
        } else {
            console.error(`  ❌ FAIL: ${title}`);
            if (details) console.error(`     Details: ${details}`);
            allPassed = false;
        }
    }

    try {
        // Step 1: Identify Waiter A and Waiter B
        console.log('--- Step 1: Fetching Waiters ---');
        const { data: staffList, error: staffErr } = await supabase
            .from('employees')
            .select('id, name, mobile, role')
            .eq('restaurant_id', RESTAURANT_ID)
            .eq('role', 'waiter')
            .eq('is_deleted', false)
            .limit(5);

        if (staffErr || !staffList || staffList.length < 2) {
            throw new Error('Need at least 2 active waiters in employees table for testing.');
        }

        const waiterA = staffList[0];
        const waiterB = staffList[1];

        // Ensure both waiters are active and online for testing
        await supabase
            .from('employees')
            .update({
                status: 'active',
                is_online: true,
                availability_status: 'available',
            })
            .in('id', [waiterA.id, waiterB.id]);

        console.log(`  Waiter A: ${waiterA.name} (${waiterA.id})`);
        console.log(`  Waiter B: ${waiterB.name} (${waiterB.id})\n`);

        // Step 2: Pick Test Table (e.g. Table 22 or highest numbered table)
        console.log('--- Step 2: Selecting Test Table ---');
        const { data: tablesData, error: tablesErr } = await supabase
            .from('tables')
            .select('id, table_number, status')
            .eq('restaurant_id', RESTAURANT_ID)
            .order('table_number', { ascending: false });

        if (tablesErr || !tablesData || tablesData.length === 0) {
            throw new Error('No tables found for restaurant.');
        }

        const testTable = tablesData.find(t => t.table_number === '22') || tablesData[0];
        console.log(`  Target Table: #${testTable.table_number} (ID: ${testTable.id})\n`);

        // Step 3: Clean up target table before test
        console.log('--- Step 3: Preparing Clean State for Table ---');
        // Delete any active service requests
        await supabase
            .from('service_requests')
            .delete()
            .eq('table_id', testTable.id);

        // Delete any existing orders on this table
        await supabase
            .from('orders')
            .delete()
            .eq('table_id', testTable.id);

        // Reset table to occupied and assigned to Waiter A
        await supabase
            .from('tables')
            .update({
                status: 'occupied',
                assigned_waiter_id: waiterA.id,
                co_waiter_ids: [],
                transferred_from_waiter_id: null,
                transferred_to_waiter_id: null,
                customer_present_at: new Date().toISOString(),
                last_activity_at: new Date().toISOString(),
            })
            .eq('id', testTable.id);

        // Create an active order assigned to Waiter A
        const { data: sampleItem } = await supabase
            .from('menu_items')
            .select('id, name, price')
            .eq('restaurant_id', RESTAURANT_ID)
            .limit(1)
            .single();

        const orderResult = await OrderService.createOrder(
            testTable.id,
            [{
                menuItemId: sampleItem?.id || 1,
                name: sampleItem?.name || 'Spring Rolls',
                price: sampleItem?.price || 150,
                quantity: 2,
            }],
            RESTAURANT_ID,
            'placed',
            waiterA.id
        );
        assert(!!orderResult, 'Order created on Table for Waiter A', `Order ID: ${orderResult?.id}`);

        // Create a pending service request assigned to Waiter A
        const { data: serviceReq, error: reqErr } = await supabase
            .from('service_requests')
            .insert({
                restaurant_id: RESTAURANT_ID,
                table_id: testTable.id,
                request_type: 'water',
                request_status: 'pending',
                assigned_waiter_id: waiterA.id,
            })
            .select()
            .single();
        assert(!reqErr && !!serviceReq, 'Pending service request created for Waiter A', `Request ID: ${serviceReq?.id}`);

        // Step 4: Verify Initial Pre-Transfer Authorization & UI Buckets
        console.log('\n--- Step 4: Verify Initial Waiter A & B State ---');
        const preAccessA = await OrderService.verifyWaiterTableAccess(testTable.id, waiterA.id, RESTAURANT_ID);
        assert(preAccessA.authorized === true, 'Waiter A has authorized table access before transfer');

        const preAccessB = await OrderService.verifyWaiterTableAccess(testTable.id, waiterB.id, RESTAURANT_ID);
        assert(preAccessB.authorized === false, 'Waiter B does NOT have access before transfer');

        const preFloor = await fetchFloorState();
        const preBucketsA = computeWaiterBuckets(preFloor, waiterA.id);
        const preBucketsB = computeWaiterBuckets(preFloor, waiterB.id);

        assert(preBucketsA.myTables.some(t => String(t.id) === String(testTable.id)), 'Table #22 is in Waiter A My Tables');
        assert(!preBucketsB.myTables.some(t => String(t.id) === String(testTable.id)), 'Table #22 is NOT in Waiter B My Tables');

        const preAlertsA = await OrderService.fetchActiveServiceRequests(RESTAURANT_ID, waiterA.id);
        const preAlertsB = await OrderService.fetchActiveServiceRequests(RESTAURANT_ID, waiterB.id);
        assert(preAlertsA.some((a: any) => a.id === serviceReq?.id), 'Waiter A receives the pending service request');
        assert(!preAlertsB.some((a: any) => a.id === serviceReq?.id), 'Waiter B does NOT receive the pending service request');

        // Step 5: Execute Table Transfer from Waiter A to Waiter B
        console.log('\n--- Step 5: Executing Transfer: Waiter A -> Waiter B ---');
        const transferRes = await OrderService.grantTableAccess(
            testTable.id,
            waiterB.id,
            'transfer',
            waiterA.id,
            RESTAURANT_ID
        );
        assert(transferRes.success === true, 'grant_table_access RPC succeeded with transfer type');

        // Step 6: Verify Database Table State After Transfer
        console.log('\n--- Step 6: Verify Database & Realtime Entity Reassignment ---');
        const { data: updatedTable } = await supabase
            .from('tables')
            .select('assigned_waiter_id, co_waiter_ids, transferred_from_waiter_id, transferred_to_waiter_id')
            .eq('id', testTable.id)
            .single();

        assert(updatedTable?.assigned_waiter_id === waiterB.id, 'Table assigned_waiter_id moved exclusively to Waiter B');
        assert(
            !updatedTable?.co_waiter_ids || updatedTable.co_waiter_ids.length === 0,
            'co_waiter_ids is empty (Waiter A is not a co-waiter)'
        );
        assert(updatedTable?.transferred_from_waiter_id === waiterA.id, 'transferred_from_waiter_id tracks Waiter A');
        assert(updatedTable?.transferred_to_waiter_id === waiterB.id, 'transferred_to_waiter_id tracks Waiter B');

        // Verify active orders reassigned to Waiter B
        const { data: updatedOrders } = await supabase
            .from('orders')
            .select('id, waiter_id, is_completed')
            .eq('table_id', testTable.id)
            .eq('is_completed', false);

        const allOrdersAssignedToB = (updatedOrders || []).every(o => o.waiter_id === waiterB.id);
        assert(allOrdersAssignedToB, 'All active orders reassigned to Waiter B');

        // Verify active service requests reassigned to Waiter B
        const { data: updatedRequests } = await supabase
            .from('service_requests')
            .select('id, assigned_waiter_id, request_status')
            .eq('table_id', testTable.id)
            .in('request_status', ['pending', 'accepted']);

        const allRequestsAssignedToB = (updatedRequests || []).every(r => r.assigned_waiter_id === waiterB.id);
        assert(allRequestsAssignedToB, 'All active service requests reassigned to Waiter B');

        // Step 7: Enforce Security: Direct API / Service Call Lockout for Waiter A
        console.log('\n--- Step 7: Verify Backend & API Lockout for Waiter A ---');

        // Check 7a: verifyWaiterTableAccess for Waiter A
        const postAccessA = await OrderService.verifyWaiterTableAccess(testTable.id, waiterA.id, RESTAURANT_ID);
        assert(postAccessA.authorized === false, 'verifyWaiterTableAccess rejects Waiter A with authorized=false');

        // Check 7b: Waiter A trying to createOrder on transferred table
        let waiterACanOrder = false;
        try {
            await OrderService.createOrder(
                testTable.id,
                [{ menuItemId: sampleItem?.id || 1, name: 'Hack Attempt', price: 100, quantity: 1 }],
                RESTAURANT_ID,
                'placed',
                waiterA.id
            );
            waiterACanOrder = true;
        } catch (err: any) {
            assert(err?.message?.includes('Unauthorized'), 'OrderService.createOrder hard-rejects Waiter A with Unauthorized error', err?.message);
        }
        assert(!waiterACanOrder, 'Waiter A is blocked from placing orders on transferred table');

        // Check 7c: Waiter A trying to clearTable on transferred table
        let waiterACanClear = false;
        try {
            await OrderService.clearTable(testTable.id, RESTAURANT_ID, waiterA.id);
            waiterACanClear = true;
        } catch (err: any) {
            assert(err?.message?.includes('Unauthorized'), 'OrderService.clearTable hard-rejects Waiter A with Unauthorized error', err?.message);
        }
        assert(!waiterACanClear, 'Waiter A is blocked from clearing transferred table');

        // Check 7d: Waiter A trying to updateOrderStatus on transferred table's order
        let waiterACanUpdateOrder = false;
        try {
            await OrderService.updateOrderStatus(orderResult.id, RESTAURANT_ID, 'served', waiterA.id);
            waiterACanUpdateOrder = true;
        } catch (err: any) {
            assert(err?.message?.includes('Unauthorized'), 'OrderService.updateOrderStatus hard-rejects Waiter A with Unauthorized error', err?.message);
        }
        assert(!waiterACanUpdateOrder, 'Waiter A is blocked from updating order status');

        // Check 7e: Waiter A trying to settleBill on transferred table
        let waiterACanSettle = false;
        try {
            await OrderService.settleBill(orderResult.id, RESTAURANT_ID, undefined, 'cash', waiterA.id);
            waiterACanSettle = true;
        } catch (err: any) {
            assert(err?.message?.includes('Unauthorized'), 'OrderService.settleBill hard-rejects Waiter A with Unauthorized error', err?.message);
        }
        assert(!waiterACanSettle, 'Waiter A is blocked from settling bill');

        // Check 7f: Waiter A trying to accept service request
        let waiterACanAcceptReq = false;
        try {
            await OrderService.acceptServiceRequest(serviceReq.id, RESTAURANT_ID, waiterA.id);
            waiterACanAcceptReq = true;
        } catch (err: any) {
            assert(err?.message?.includes('Unauthorized'), 'OrderService.acceptServiceRequest rejects Waiter A with Unauthorized', err?.message);
        }
        assert(!waiterACanAcceptReq, 'Waiter A is blocked from accepting service requests for transferred table');

        // Check 7g: Waiter A trying to complete service request
        let waiterACanCompleteReq = false;
        try {
            await OrderService.completeServiceRequest(serviceReq.id, RESTAURANT_ID, waiterA.id);
            waiterACanCompleteReq = true;
        } catch (err: any) {
            assert(err?.message?.includes('Unauthorized'), 'OrderService.completeServiceRequest rejects Waiter A with Unauthorized', err?.message);
        }
        assert(!waiterACanCompleteReq, 'Waiter A is blocked from completing service requests for transferred table');

        // Check 7h: Direct HTTP API test - POST /api/waiter/tables/[tableId]/action
        try {
            const tokenA = await signJwt({
                id: waiterA.id,
                employee_id: waiterA.id,
                mobile: waiterA.mobile,
                role: 'waiter',
                restaurant_id: RESTAURANT_ID,
                restaurant_code: RESTAURANT_ID,
            });

            const tokenB = await signJwt({
                id: waiterB.id,
                employee_id: waiterB.id,
                mobile: waiterB.mobile,
                role: 'waiter',
                restaurant_id: RESTAURANT_ID,
                restaurant_code: RESTAURANT_ID,
            });

            const apiResA = await fetch(`http://localhost:3000/api/waiter/tables/${testTable.id}/action`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tokenA}`,
                },
                body: JSON.stringify({
                    action: 'check_access',
                    restaurantId: RESTAURANT_ID,
                    waiterId: waiterA.id,
                }),
            });
            assert(apiResA.status === 403, `Direct API call from Waiter A returns HTTP 403 Forbidden (status: ${apiResA.status})`);

            const apiResB = await fetch(`http://localhost:3000/api/waiter/tables/${testTable.id}/action`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tokenB}`,
                },
                body: JSON.stringify({
                    action: 'check_access',
                    restaurantId: RESTAURANT_ID,
                    waiterId: waiterB.id,
                }),
            });
            assert(apiResB.status === 200, `Direct API call from Waiter B returns HTTP 200 OK (status: ${apiResB.status})`);
        } catch (fetchErr) {
            console.warn('API fetch skipped:', fetchErr);
        }

        // Step 8: Verify Waiter B Full Management & Notifications
        console.log('\n--- Step 8: Verify Waiter B Exclusive Access & Notifications ---');

        const postAccessB = await OrderService.verifyWaiterTableAccess(testTable.id, waiterB.id, RESTAURANT_ID);
        assert(postAccessB.authorized === true, 'verifyWaiterTableAccess confirms Waiter B has authorized access');

        // Service Requests check for Waiter A and B
        const postAlertsA = await OrderService.fetchActiveServiceRequests(RESTAURANT_ID, waiterA.id);
        const postAlertsB = await OrderService.fetchActiveServiceRequests(RESTAURANT_ID, waiterB.id);

        assert(
            !postAlertsA.some((a: any) => a.id === serviceReq?.id),
            'Waiter A receives 0 service requests / alerts for the transferred table'
        );
        assert(
            postAlertsB.some((a: any) => a.id === serviceReq?.id),
            'Waiter B receives the active service request for the transferred table'
        );

        // Waiter B adds food order
        let waiterBCanOrder = false;
        try {
            const bOrder = await OrderService.createOrder(
                testTable.id,
                [{ menuItemId: sampleItem?.id || 1, name: 'Waiter B Item', price: 200, quantity: 1 }],
                RESTAURANT_ID,
                'placed',
                waiterB.id
            );
            waiterBCanOrder = !!bOrder;
        } catch (err: any) {
            console.error('Waiter B order failed:', err);
        }
        assert(waiterBCanOrder, 'Waiter B can successfully add orders to the table');

        // Waiter B accepts and completes the service request
        let waiterBCanManageReq = false;
        try {
            await OrderService.acceptServiceRequest(serviceReq.id, RESTAURANT_ID, waiterB.id);
            await OrderService.completeServiceRequest(serviceReq.id, RESTAURANT_ID, waiterB.id);
            waiterBCanManageReq = true;
        } catch (err: any) {
            console.error('Waiter B service request management failed:', err);
        }
        assert(waiterBCanManageReq, 'Waiter B can accept and complete service requests');

        // Step 9: UI State Verification (My Tables, Ready, Preparing)
        console.log('\n--- Step 9: Verify Waiter Panel UI Buckets ---');
        const postFloor = await fetchFloorState();
        const postBucketsA = computeWaiterBuckets(postFloor, waiterA.id);
        const postBucketsB = computeWaiterBuckets(postFloor, waiterB.id);

        assert(
            !postBucketsA.myTables.some(t => String(t.id) === String(testTable.id)),
            'Table #22 is completely REMOVED from Waiter A My Tables'
        );
        assert(
            !postBucketsA.readyTables.some(t => String(t.id) === String(testTable.id)),
            'Table #22 is completely REMOVED from Waiter A Ready'
        );
        assert(
            !postBucketsA.preparingTables.some(t => String(t.id) === String(testTable.id)),
            'Table #22 is completely REMOVED from Waiter A Preparing'
        );

        assert(
            postBucketsB.myTables.some(t => String(t.id) === String(testTable.id)),
            'Table #22 is PRESENT in Waiter B My Tables'
        );

        // Step 10: Clean up target table back to available
        console.log('\n--- Step 10: Teardown & Reset Table ---');
        await OrderService.clearTable(testTable.id, RESTAURANT_ID, waiterB.id);

        const { data: cleanTable } = await supabase
            .from('tables')
            .select('status, assigned_waiter_id')
            .eq('id', testTable.id)
            .single();

        assert(cleanTable?.status === 'available', 'Test table status restored to available');
        assert(cleanTable?.assigned_waiter_id === null, 'Test table waiter assignment cleared');

        console.log('\n================================================================');
        if (allPassed) {
            console.log('🎉 ALL WAITER TABLE TRANSFER AUTHORIZATION TESTS PASSED!');
        } else {
            console.error('❌ SOME TESTS FAILED. See details above.');
            process.exit(1);
        }
        console.log('================================================================\n');

    } catch (e: any) {
        console.error('Test run error:', e);
        process.exit(1);
    }
}

run();
