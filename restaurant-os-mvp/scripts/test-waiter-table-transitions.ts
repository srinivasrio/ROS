import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Import OrderService
import { OrderService } from '../services/orders.service';

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
        } else if (s === 'on_hold' && !t.assigned_waiter_id) {
            availableTables.push(t);
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
    console.log('\n======================================================');
    console.log('🧪 WAITER PANEL TABLE TRANSITION LIFECYCLE TEST SUITE');
    console.log('======================================================\n');

    // 1. Get two distinct active, online waiters for this restaurant
    const { data: staff } = await supabase
        .from('employees')
        .select('id, name, mobile, role')
        .eq('restaurant_id', RESTAURANT_ID)
        .eq('role', 'waiter')
        .eq('status', 'active')
        .eq('is_online', true)
        .eq('availability_status', 'available')
        .limit(2);

    if (!staff || staff.length < 2) {
        throw new Error(`Need at least 2 waiters in restaurant ${RESTAURANT_ID} to test isolation.`);
    }

    const waiterA = staff[0];
    const waiterB = staff[1];
    console.log(`👨‍🍳 Waiter A: ${waiterA.name} (${waiterA.id})`);
    console.log(`👨‍🍳 Waiter B: ${waiterB.name} (${waiterB.id})\n`);

    const TEST_TABLE_ID = 1;

    // Helper assertion
    let stepCount = 0;
    function assert(desc: string, condition: boolean, detail?: string) {
        stepCount++;
        if (condition) {
            console.log(`  ✅ [Step ${stepCount}] ${desc}`);
        } else {
            console.error(`  ❌ [Step ${stepCount}] FAILED: ${desc}`);
            if (detail) console.error(`     Detail: ${detail}`);
            process.exit(1);
        }
    }

    try {
        // Reset table 1 initially
        await OrderService.clearTable(TEST_TABLE_ID, RESTAURANT_ID);

        // ──────────────────────────────────────────────────────────
        // Transition 1: AVAILABLE
        // ──────────────────────────────────────────────────────────
        console.log('\n--- TRANSITION 1: Initial Available State ---');
        let floor = await fetchFloorState();
        let table1 = floor.find((t) => t.id === TEST_TABLE_ID);
        assert('Table 1 exists and is Available', table1?.status === 'available');
        assert('Table 1 has null assigned_waiter_id', table1?.assigned_waiter_id === null || table1?.assigned_waiter_id === undefined);

        let bucketsA = computeWaiterBuckets(floor, waiterA.id);
        let bucketsB = computeWaiterBuckets(floor, waiterB.id);

        assert('Table 1 is in floor Available Tables for Waiter A', bucketsA.availableTables.some((t) => t.id === TEST_TABLE_ID));
        assert('Table 1 is in floor Available Tables for Waiter B', bucketsB.availableTables.some((t) => t.id === TEST_TABLE_ID));
        assert('Table 1 is NOT in Waiter A My Tables', !bucketsA.myTables.some((t) => t.id === TEST_TABLE_ID));
        assert('Table 1 is NOT in Waiter B My Tables', !bucketsB.myTables.some((t) => t.id === TEST_TABLE_ID));

        // ──────────────────────────────────────────────────────────
        // Transition 2: ASSIGNED (Waiter A seats & takes Table 1)
        // ──────────────────────────────────────────────────────────
        console.log('\n--- TRANSITION 2: Available → Assigned to Waiter A ---');
        await OrderService.trackCustomerPresence(TEST_TABLE_ID, RESTAURANT_ID, 'occupied', waiterA.id);

        floor = await fetchFloorState();
        table1 = floor.find((t) => t.id === TEST_TABLE_ID);
        assert('Table 1 status changed to Occupied', table1?.status === 'occupied');
        assert('Table 1 assigned_waiter_id is Waiter A', table1?.assigned_waiter_id === waiterA.id);

        bucketsA = computeWaiterBuckets(floor, waiterA.id);
        bucketsB = computeWaiterBuckets(floor, waiterB.id);

        assert('Table 1 appears in Waiter A My Tables', bucketsA.myTables.some((t) => t.id === TEST_TABLE_ID));
        assert('Table 1 does NOT appear in Waiter B My Tables (Strict Isolation)', !bucketsB.myTables.some((t) => t.id === TEST_TABLE_ID));
        assert('Table 1 removed from Available Tables', !bucketsA.availableTables.some((t) => t.id === TEST_TABLE_ID));

        // ──────────────────────────────────────────────────────────
        // Transition 3: PREPARING (Order placed in kitchen)
        // ──────────────────────────────────────────────────────────
        console.log('\n--- TRANSITION 3: Assigned → Preparing ---');
        const { data: menuItems } = await supabase.from('menu_items').select('id, name, price').eq('restaurant_id', RESTAURANT_ID).limit(1);
        const menuItem = menuItems?.[0] || { id: 101, name: 'Paneer Butter Masala', price: 250 };

        const created = await OrderService.createOrder(
            TEST_TABLE_ID,
            [{ menu_item_id: menuItem.id, name: menuItem.name, price: menuItem.price, quantity: 1 }],
            RESTAURANT_ID,
            'placed',
            waiterA.id
        );
        const orderId = created.id;

        await supabase.from('orders').update({ status: 'preparing' }).eq('id', orderId);
        await supabase.from('order_items').update({ status: 'preparing' }).eq('order_id', orderId);

        floor = await fetchFloorState();
        bucketsA = computeWaiterBuckets(floor, waiterA.id);
        bucketsB = computeWaiterBuckets(floor, waiterB.id);

        assert('Table 1 appears in Waiter A Preparing filter', bucketsA.preparingTables.some((t) => t.id === TEST_TABLE_ID));
        assert('Table 1 does NOT appear in Waiter B Preparing filter (Isolation)', !bucketsB.preparingTables.some((t) => t.id === TEST_TABLE_ID));
        assert('Table 1 is still in Waiter A My Tables', bucketsA.myTables.some((t) => t.id === TEST_TABLE_ID));
        assert('Table 1 is not in Ready filter yet', !bucketsA.readyTables.some((t) => t.id === TEST_TABLE_ID));

        // ──────────────────────────────────────────────────────────
        // Transition 4: READY (Kitchen marks order item ready)
        // ──────────────────────────────────────────────────────────
        console.log('\n--- TRANSITION 4: Preparing → Ready ---');
        await supabase
            .from('order_items')
            .update({ status: 'ready' })
            .eq('order_id', orderId);

        floor = await fetchFloorState();
        table1 = floor.find((t) => t.id === TEST_TABLE_ID);
        bucketsA = computeWaiterBuckets(floor, waiterA.id);
        bucketsB = computeWaiterBuckets(floor, waiterB.id);

        assert('Table 1 readyCount > 0', (table1?.readyCount ?? 0) > 0);
        assert('Table 1 appears in Waiter A Ready filter', bucketsA.readyTables.some((t) => t.id === TEST_TABLE_ID));
        assert('Table 1 does NOT appear in Waiter B Ready filter (Isolation)', !bucketsB.readyTables.some((t) => t.id === TEST_TABLE_ID));
        assert('Table 1 is removed from Waiter A Preparing filter', !bucketsA.preparingTables.some((t) => t.id === TEST_TABLE_ID));

        // ──────────────────────────────────────────────────────────
        // Transition 5 & 6: CLEARED → AVAILABLE
        // ──────────────────────────────────────────────────────────
        console.log('\n--- TRANSITION 5 & 6: Ready → Cleared → Available ---');
        await OrderService.clearTable(TEST_TABLE_ID, RESTAURANT_ID);

        floor = await fetchFloorState();
        table1 = floor.find((t) => t.id === TEST_TABLE_ID);

        assert('Table 1 status reset to Available', table1?.status === 'available');
        assert('Table 1 assigned_waiter_id is reset to null', table1?.assigned_waiter_id === null || table1?.assigned_waiter_id === undefined);
        assert('Table 1 assigned_waiter_name is null', table1?.assigned_waiter_name === null || table1?.assigned_waiter_name === undefined);

        // Verify active orders for Table 1 are completed/archived
        const { data: activeOrdersCheck } = await supabase
            .from('orders')
            .select('id, is_completed, status')
            .eq('table_id', TEST_TABLE_ID)
            .eq('restaurant_id', RESTAURANT_ID)
            .eq('is_completed', false);

        assert('Active orders for Table 1 are archived', (activeOrdersCheck?.length ?? 0) === 0);

        bucketsA = computeWaiterBuckets(floor, waiterA.id);
        bucketsB = computeWaiterBuckets(floor, waiterB.id);

        assert('Table 1 is in floor Available Tables', bucketsA.availableTables.some((t) => t.id === TEST_TABLE_ID));
        assert('Table 1 is NOT in Waiter A My Tables', !bucketsA.myTables.some((t) => t.id === TEST_TABLE_ID));
        assert('Table 1 is NOT in Waiter A Ready filter', !bucketsA.readyTables.some((t) => t.id === TEST_TABLE_ID));
        assert('Table 1 is NOT in Waiter A Preparing filter', !bucketsA.preparingTables.some((t) => t.id === TEST_TABLE_ID));

        // ──────────────────────────────────────────────────────────
        // Transition 7: NEW ASSIGNMENT (Waiter B seats Table 1)
        // ──────────────────────────────────────────────────────────
        console.log('\n--- TRANSITION 7: Available → New Assignment (Waiter B) ---');
        await OrderService.trackCustomerPresence(TEST_TABLE_ID, RESTAURANT_ID, 'occupied', waiterB.id);

        floor = await fetchFloorState();
        table1 = floor.find((t) => t.id === TEST_TABLE_ID);

        assert('Table 1 assigned_waiter_id is now Waiter B', table1?.assigned_waiter_id === waiterB.id);
        assert('Table 1 assigned_waiter_name is now Waiter B name', table1?.assigned_waiter_name === waiterB.name);

        bucketsA = computeWaiterBuckets(floor, waiterA.id);
        bucketsB = computeWaiterBuckets(floor, waiterB.id);

        assert('Table 1 appears in Waiter B My Tables', bucketsB.myTables.some((t) => t.id === TEST_TABLE_ID));
        assert('Table 1 does NOT appear in Waiter A My Tables', !bucketsA.myTables.some((t) => t.id === TEST_TABLE_ID));
        assert('Table 1 removed from Available Tables', !bucketsB.availableTables.some((t) => t.id === TEST_TABLE_ID));

        // Final cleanup
        await OrderService.clearTable(TEST_TABLE_ID, RESTAURANT_ID);
        console.log('\n🎉 ALL TRANSITION TESTS PASSED WITH ZERO VIOLATIONS!\n');
    } catch (err) {
        console.error('\n❌ Test encountered an error:', err);
        try { await OrderService.clearTable(TEST_TABLE_ID, RESTAURANT_ID); } catch (_) {}
        process.exit(1);
    }
}

run();
