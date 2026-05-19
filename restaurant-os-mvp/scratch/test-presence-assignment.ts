import dotenv from 'dotenv';
import path from 'path';

// Load env variables from .env.local BEFORE importing modules
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
    // Dynamically import OrderService to ensure it loads AFTER env variables are set
    const { OrderService } = await import('../app/services/orders');
    console.log('--- STARTING PRESENCE & ASSIGNMENT INTEGRATION TESTS ---');

    // 1. Get restaurant ID and check staff
    const restaurantId = process.env.NEXT_PUBLIC_RESTAURANT_ID || '202603180001';
    console.log(`Using Restaurant ID: ${restaurantId}`);

    const { data: staff, error: staffErr } = await supabase
        .from('staff')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('role', 'waiter');

    if (staffErr || !staff || staff.length === 0) {
        console.error('Failed to retrieve waiters or none exist. Error:', staffErr);
        process.exit(1);
    }
    console.log(`Found ${staff.length} waiters:`);
    staff.forEach(s => console.log(`- [${s.id}] ${s.name} | Mobile: ${s.mobile}`));

    // 2. Find/create a test table
    const { data: tables, error: tableErr } = await supabase
        .from('tables')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .limit(1);

    if (tableErr || !tables || tables.length === 0) {
        console.error('Failed to retrieve tables or none exist. Error:', tableErr);
        process.exit(1);
    }
    const testTable = tables[0];
    const tableId = testTable.id;
    console.log(`Using Test Table: ID=${tableId}, Number=${testTable.table_number}, Status=${testTable.status}`);

    // Ensure table is reset to empty initially
    console.log('\nResetting table to empty...');
    await supabase
        .from('tables')
        .update({
            status: 'empty',
            assigned_waiter_id: null,
            customer_present_at: null,
            last_activity_at: null
        })
        .eq('id', tableId);

    // 3. Test: trackCustomerPresence (Initial entry)
    console.log('\n--- Test 1: Customer Presence and Auto-Assignment ---');
    await OrderService.trackCustomerPresence(tableId, restaurantId);

    // Fetch updated table
    const { data: tableAfterPresence } = await supabase
        .from('tables')
        .select('*')
        .eq('id', tableId)
        .single();

    console.log('Table after customer presence tracking:');
    console.log(`- Status: ${tableAfterPresence.status} (Expected: customer_present)`);
    console.log(`- Assigned Waiter ID: ${tableAfterPresence.assigned_waiter_id} (Expected: non-null least busy waiter)`);
    console.log(`- Customer Present At: ${tableAfterPresence.customer_present_at} (Expected: non-null timestamp)`);
    console.log(`- Last Activity At: ${tableAfterPresence.last_activity_at} (Expected: non-null timestamp)`);

    if (tableAfterPresence.status !== 'customer_present') {
        throw new Error('Table status was not set to customer_present');
    }
    if (!tableAfterPresence.assigned_waiter_id) {
        throw new Error('No waiter was auto-assigned');
    }

    const assignedWaiterId = tableAfterPresence.assigned_waiter_id;
    const assignedWaiter = staff.find(s => s.id === assignedWaiterId);
    console.log(`Auto-assigned waiter: ${assignedWaiter?.name || 'Unknown'}`);

    // 4. Test: getLeastBusyWaiter Workload logic
    console.log('\n--- Test 2: Least Busy Waiter Workload Verification ---');
    // Let's create an active service request for the assigned waiter on another table to increase their workload
    const { data: otherTables } = await supabase
        .from('tables')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .neq('id', tableId)
        .limit(1);

    if (otherTables && otherTables.length > 0) {
        const otherTableId = otherTables[0].id;
        console.log(`Creating active service request for waiter [${assignedWaiter?.name}] on other table [${otherTableId}] to increase workload...`);
        
        const { data: request, error: reqErr } = await supabase
            .from('service_requests')
            .insert({
                restaurant_id: restaurantId,
                table_id: otherTableId,
                request_type: 'water_requested',
                status: 'pending',
                assigned_staff_id: assignedWaiterId
            })
            .select()
            .single();

        if (reqErr) {
            console.error('Failed to create service request:', reqErr);
        } else {
            console.log('Created request ID:', request.id);

            // Now get least busy waiter again
            const nextWaiter = await OrderService.getLeastBusyWaiter(restaurantId);
            console.log(`Next least busy waiter: ${nextWaiter?.name} (Expected: a different waiter if another waiter has 0 workload)`);

            // Clean up request
            await supabase.from('service_requests').delete().eq('id', request.id);
        }
    } else {
        console.log('No other tables available to test workload shifting.');
    }

    // 5. Test: checkAndResetStaleTables
    console.log('\n--- Test 3: Stale Tables Automatic Reset ---');
    console.log('Artificially setting table last_activity_at to 5 hours ago...');
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    await supabase
        .from('tables')
        .update({ last_activity_at: fiveHoursAgo })
        .eq('id', tableId);

    console.log('Running checkAndResetStaleTables...');
    const resetCount = await OrderService.checkAndResetStaleTables(restaurantId);
    console.log(`Reset function completed. Tables reset count: ${resetCount}`);

    const { data: tableAfterReset } = await supabase
        .from('tables')
        .select('*')
        .eq('id', tableId)
        .single();

    console.log('Table after reset:');
    console.log(`- Status: ${tableAfterReset.status} (Expected: empty)`);
    console.log(`- Assigned Waiter ID: ${tableAfterReset.assigned_waiter_id} (Expected: null)`);
    console.log(`- Customer Present At: ${tableAfterReset.customer_present_at} (Expected: null)`);
    console.log(`- Last Activity At: ${tableAfterReset.last_activity_at} (Expected: null)`);

    if (tableAfterReset.status !== 'empty') {
        throw new Error('Stale table was not reset to empty status');
    }
    if (tableAfterReset.assigned_waiter_id !== null) {
        throw new Error('Assigned waiter was not cleared on reset');
    }

    console.log('\n--- ALL INTEGRATION TESTS PASSED SUCCESSFULY ---');
}

runTests().catch(err => {
    console.error('Test run failed with error:', err);
    process.exit(1);
});
