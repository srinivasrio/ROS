import { createClient } from '@supabase/supabase-js';
import { OrderService } from '../services/orders.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
    console.log('=== Starting Waiter Workload & Assignment Logic Tests ===');
    const restaurantId = '202603180001';

    // 1. Identify or setup two available test waiters
    const { data: waiters, error: staffErr } = await supabase
        .from('employees')
        .select('id, name, availability_status, is_online, last_assigned_at')
        .eq('restaurant_id', restaurantId)
        .ilike('role', 'waiter')
        .eq('status', 'active')
        .eq('is_deleted', false)
        .order('id', { ascending: true })
        .limit(2);

    if (staffErr || !waiters || waiters.length < 2) {
        console.error('Need at least 2 active waiters for testing. Found:', waiters);
        process.exit(1);
    }

    const waiterA = waiters[0];
    const waiterB = waiters[1];
    console.log(`Using Waiter A: ${waiterA.name} (${waiterA.id})`);
    console.log(`Using Waiter B: ${waiterB.name} (${waiterB.id})`);

    // Ensure only test waiters are available & online
    await supabase
        .from('employees')
        .update({ availability_status: 'offline', is_online: false })
        .eq('restaurant_id', restaurantId)
        .ilike('role', 'waiter');

    await supabase
        .from('employees')
        .update({ availability_status: 'available', is_online: true })
        .in('id', [waiterA.id, waiterB.id]);

    // Ensure test waiters start with a clean slate (no assigned tables from previous tests)
    await supabase
        .from('tables')
        .update({ assigned_waiter_id: null, status: 'empty', co_waiter_ids: [] })
        .eq('restaurant_id', restaurantId)
        .in('assigned_waiter_id', [waiterA.id, waiterB.id]);

    await supabase
        .from('orders')
        .update({ is_completed: true, status: 'paid' })
        .eq('restaurant_id', restaurantId)
        .in('waiter_id', [waiterA.id, waiterB.id]);

    // Helper: Cleanup test tables and orders
    async function cleanupTables(tableIds: number[]) {
        await supabase
            .from('orders')
            .update({ is_completed: true, status: 'paid' })
            .in('table_id', tableIds);

        await supabase
            .from('tables')
            .update({
                assigned_waiter_id: null,
                status: 'empty',
                co_waiter_ids: []
            })
            .in('id', tableIds);
    }

    // Helper: Create or ensure physical tables exist
    async function ensureTables(tableNumbers: number[]): Promise<number[]> {
        const tableDbIds: number[] = [];
        for (const num of tableNumbers) {
            const { data: existing } = await supabase
                .from('tables')
                .select('id')
                .eq('restaurant_id', restaurantId)
                .eq('table_number', String(num))
                .maybeSingle();

            if (existing) {
                tableDbIds.push(existing.id);
            } else {
                const { data: created } = await supabase
                    .from('tables')
                    .insert({
                        restaurant_id: restaurantId,
                        table_number: String(num),
                        status: 'empty',
                        capacity: 4
                    })
                    .select('id')
                    .single();
                if (created) tableDbIds.push(created.id);
            }
        }
        return tableDbIds;
    }

    const testTableNums = [801, 802, 803, 804, 805, 806, 807, 808, 811, 812, 813, 814];
    const tableIds = await ensureTables(testTableNums);
    await cleanupTables(tableIds);

    try {
        console.log('\n--- Suite 1: Workload-based balancing (User Example) ---');
        // Waiter A gets 3 active tables (801, 802, 803)
        // Waiter B gets 1 active table (804)
        await supabase.from('tables').update({ assigned_waiter_id: waiterA.id, status: 'occupied' }).in('table_number', ['801', '802', '803']);
        await supabase.from('tables').update({ assigned_waiter_id: waiterB.id, status: 'occupied' }).in('table_number', ['804']);

        // Place an order on unassigned Table 805
        console.log('Customer places order on unassigned Table 805...');
        const order1 = await OrderService.createOrder(
            805,
            [{ menu_item_id: 1, quantity: 1, price: 100 }],
            restaurantId,
            'queued'
        );

        // Fetch Table 805 and Order 1
        const { data: tbl805 } = await supabase.from('tables').select('assigned_waiter_id, status').eq('table_number', 805).single();
        const { data: ord1 } = await supabase.from('orders').select('waiter_id').eq('id', order1.id).single();

        console.log(`Table 805 assigned to: ${tbl805?.assigned_waiter_id} (Expected: Waiter B ${waiterB.id})`);
        console.log(`Order 1 assigned to: ${ord1?.waiter_id} (Expected: Waiter B ${waiterB.id})`);

        if (tbl805?.assigned_waiter_id === waiterB.id && ord1?.waiter_id === waiterB.id) {
            console.log('✅ Suite 1 PASSED: Order assigned to Waiter B with lowest workload (1 table vs 3 tables).');
        } else {
            throw new Error(`Suite 1 FAILED: Expected Waiter B (${waiterB.id}), got Table: ${tbl805?.assigned_waiter_id}, Order: ${ord1?.waiter_id}`);
        }

        console.log('\n--- Suite 2: Immediate Workload Update for Subsequent Customers ---');
        // Now Waiter A has 3 active tables (801, 802, 803)
        // Waiter B has 2 active tables (804, 805)
        // Place an order on unassigned Table 806 -> Should STILL go to Waiter B (2 < 3)
        console.log('Next customer places order on unassigned Table 806...');
        const order2 = await OrderService.createOrder(
            806,
            [{ menu_item_id: 1, quantity: 1, price: 100 }],
            restaurantId,
            'queued'
        );

        const { data: tbl806 } = await supabase.from('tables').select('assigned_waiter_id').eq('table_number', 806).single();
        console.log(`Table 806 assigned to: ${tbl806?.assigned_waiter_id} (Expected: Waiter B ${waiterB.id})`);
        if (tbl806?.assigned_waiter_id !== waiterB.id) {
            throw new Error(`Suite 2 Step 1 FAILED: Expected Waiter B (${waiterB.id}), got ${tbl806?.assigned_waiter_id}`);
        }

        // Now both Waiter A and Waiter B have 3 active tables!
        // Waiter B was assigned to 805 and 806 just now, so Waiter A has older last_assigned_at.
        // Place an order on unassigned Table 807 -> Should go to Waiter A!
        console.log('Next customer places order on unassigned Table 807 (both tied at 3 tables)...');
        const order3 = await OrderService.createOrder(
            807,
            [{ menu_item_id: 1, quantity: 1, price: 100 }],
            restaurantId,
            'queued'
        );

        const { data: tbl807 } = await supabase.from('tables').select('assigned_waiter_id').eq('table_number', 807).single();
        console.log(`Table 807 assigned to: ${tbl807?.assigned_waiter_id} (Expected: Waiter A ${waiterA.id})`);
        if (tbl807?.assigned_waiter_id !== waiterA.id) {
            throw new Error(`Suite 2 Step 2 FAILED: Expected Waiter A (${waiterA.id}), got ${tbl807?.assigned_waiter_id}`);
        }
        console.log('✅ Suite 2 PASSED: Workload updated immediately and ties broken correctly by least recently assigned.');

        console.log('\n--- Suite 3: Preserving Table Ownership ---');
        // Table 808 is already assigned to Waiter A
        await supabase.from('tables').update({ assigned_waiter_id: waiterA.id, status: 'occupied' }).eq('table_number', 808);
        console.log('Customer places QR order on Table 808 (already assigned to Waiter A)...');
        const order4 = await OrderService.createOrder(
            808,
            [{ menu_item_id: 1, quantity: 1, price: 100 }],
            restaurantId,
            'queued'
        );

        const { data: tbl808 } = await supabase.from('tables').select('assigned_waiter_id').eq('table_number', 808).single();
        const { data: ord4 } = await supabase.from('orders').select('waiter_id').eq('id', order4.id).single();
        console.log(`Table 808 assigned to: ${tbl808?.assigned_waiter_id} (Expected: Waiter A ${waiterA.id})`);
        console.log(`Order 4 assigned to: ${ord4?.waiter_id} (Expected: Waiter A ${waiterA.id})`);

        if (tbl808?.assigned_waiter_id === waiterA.id && ord4?.waiter_id === waiterA.id) {
            console.log('✅ Suite 3 PASSED: Existing table assignment strictly preserved.');
        } else {
            throw new Error('Suite 3 FAILED: Table assignment was overwritten.');
        }

        console.log('\n--- Suite 4: Concurrent Orders Without Stale Workload Collisions ---');
        // Reset test tables
        await cleanupTables(tableIds);

        // Set last_assigned_at to null / equal for clean slate
        await supabase
            .from('employees')
            .update({ last_assigned_at: new Date(2026, 0, 1).toISOString() })
            .in('id', [waiterA.id, waiterB.id]);

        console.log('Fired 4 concurrent orders on Tables 811, 812, 813, 814 simultaneously...');
        const concurrentPromises = [811, 812, 813, 814].map(tblNum =>
            OrderService.createOrder(
                tblNum,
                [{ menu_item_id: 1, quantity: 1, price: 50 }],
                restaurantId,
                'queued'
            )
        );

        await Promise.all(concurrentPromises);

        const { data: concTables } = await supabase
            .from('tables')
            .select('table_number, assigned_waiter_id')
            .in('table_number', [811, 812, 813, 814]);

        const counts: Record<string, number> = { [waiterA.id]: 0, [waiterB.id]: 0 };
        concTables?.forEach(t => {
            if (t.assigned_waiter_id) {
                counts[t.assigned_waiter_id] = (counts[t.assigned_waiter_id] || 0) + 1;
            }
        });

        console.log('Concurrent assignment counts:', counts);
        console.log(`Waiter A: ${counts[waiterA.id]}, Waiter B: ${counts[waiterB.id]}`);

        // With 4 orders and 2 waiters, each should receive 2 orders!
        if (counts[waiterA.id] === 2 && counts[waiterB.id] === 2) {
            console.log('✅ Suite 4 PASSED: Concurrent orders evenly balanced 2 and 2 without stale data collisions.');
        } else {
            throw new Error(`Suite 4 FAILED: Expected 2 and 2 distribution, got Waiter A: ${counts[waiterA.id]}, Waiter B: ${counts[waiterB.id]}`);
        }

        console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉');
    } finally {
        await cleanupTables(tableIds);
    }
}

runTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
