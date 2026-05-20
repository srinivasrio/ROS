import dotenv from 'dotenv';
import path from 'path';

// Load env variables from .env.local BEFORE importing modules
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
    const { OrderService } = await import('../app/services/orders');
    console.log('--- STARTING SINGLE-WAITER SERVICE REQUEST TESTS ---');

    const restaurantId = process.env.NEXT_PUBLIC_RESTAURANT_ID || '202603180001';
    console.log(`Using Restaurant ID: ${restaurantId}`);

    // Get active waiters
    const { data: staff, error: staffErr } = await supabase
        .from('staff')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('role', 'waiter');

    if (staffErr || !staff || staff.length < 2) {
        console.error('Test requires at least 2 waiters in the restaurant. Found:', staff?.length);
        process.exit(1);
    }
    const waiterA = staff[0];
    const waiterB = staff[1];
    console.log(`Waiter A: Name=${waiterA.name}, ID=${waiterA.id}`);
    console.log(`Waiter B: Name=${waiterB.name}, ID=${waiterB.id}`);

    // Get a test table
    const { data: tables, error: tableErr } = await supabase
        .from('tables')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .limit(1);

    if (tableErr || !tables || tables.length === 0) {
        console.error('Failed to retrieve tables. Error:', tableErr);
        process.exit(1);
    }
    const testTable = tables[0];
    const tableId = testTable.id;
    console.log(`Using Test Table: ID=${tableId}, Number=${testTable.table_number}`);

    // Clean up any existing service requests on this table
    console.log('\nCleaning up existing service requests on test table...');
    await supabase
        .from('service_requests')
        .delete()
        .eq('table_id', tableId);

    // Ensure the table has no waiter assigned
    await supabase
        .from('tables')
        .update({ assigned_waiter_id: null, alert_status: null })
        .eq('id', tableId);

    // 1. Submit a service request
    console.log('\n--- Test 1: Submit Service Request (Auto-Assignment) ---');
    await OrderService.submitServiceRequest(tableId, 'water_requested', restaurantId, 1);

    // Fetch the inserted request from DB
    const { data: reqs, error: fetchErr } = await supabase
        .from('service_requests')
        .select('*')
        .eq('table_id', tableId)
        .eq('request_type', 'water_requested')
        .eq('request_status', 'pending');

    if (fetchErr || !reqs || reqs.length === 0) {
        throw new Error('Failed to fetch the submitted service request from DB');
    }
    const newRequest = reqs[0];
    console.log('Submitted Request details:');
    console.log(`- Request ID: ${newRequest.id}`);
    console.log(`- Status (request_status): ${newRequest.request_status} (Expected: pending)`);
    console.log(`- Assigned Waiter (assigned_waiter_id): ${newRequest.assigned_waiter_id} (Expected: non-null)`);

    if (newRequest.request_status !== 'pending') {
        throw new Error(`Expected request_status to be 'pending', got '${newRequest.request_status}'`);
    }
    if (!newRequest.assigned_waiter_id) {
        throw new Error('Expected a waiter to be automatically assigned');
    }

    const initialAssignedWaiterId = newRequest.assigned_waiter_id;
    const initialAssignedWaiter = staff.find(s => s.id === initialAssignedWaiterId);
    console.log(`Auto-assigned waiter: ${initialAssignedWaiter?.name}`);

    // Let's decide who will accept.
    // Waiter A is waiterA.id, Waiter B is waiterB.id.
    // Let's re-assign the request to Waiter A for testing consistency.
    console.log('\nManually re-assigning service request to Waiter A for deterministic concurrency tests...');
    await supabase
        .from('service_requests')
        .update({ assigned_waiter_id: waiterA.id })
        .eq('id', newRequest.id);

    // 2. Concurrency Race Condition Test
    console.log('\n--- Test 2: Concurrency Race Condition (Single Acceptance) ---');
    console.log('Simulating Waiter B (not assigned) trying to accept...');

    let waiterBSuccess = false;
    let waiterBError: any = null;

    try {
        await OrderService.acceptServiceRequest(newRequest.id, restaurantId, waiterB.id);
        waiterBSuccess = true;
        console.log('Waiter B successfully accepted the request! (FAIL: This should have failed!)');
    } catch (err: any) {
        waiterBError = err;
        console.log('Waiter B failed to accept as expected:', err.message);
    }

    if (waiterBSuccess) {
        throw new Error('Waiter B (not assigned waiter) was able to accept the request');
    }
    if (!waiterBError || !waiterBError.message.includes('assigned to another waiter')) {
        throw new Error(`Expected error message to mention assignment constraint, got: ${waiterBError?.message}`);
    }

    console.log('\nSimulating Waiter A (assigned) accepting request...');
    let waiterASuccess = false;
    try {
        await OrderService.acceptServiceRequest(newRequest.id, restaurantId, waiterA.id);
        waiterASuccess = true;
        console.log('Waiter A successfully accepted the request!');
    } catch (err: any) {
        console.error('Waiter A failed to accept:', err);
    }

    if (!waiterASuccess) {
        throw new Error('Waiter A (assigned waiter) failed to accept request');
    }

    // Now test double-accept by Waiter A (who is assigned but the request is already accepted).
    console.log('\nSimulating Waiter A trying to accept the request a second time (already accepted)...');
    let doubleAcceptSuccess = false;
    let doubleAcceptError: any = null;
    try {
        await OrderService.acceptServiceRequest(newRequest.id, restaurantId, waiterA.id);
        doubleAcceptSuccess = true;
    } catch (err: any) {
        doubleAcceptError = err;
        console.log('Waiter A failed to accept again as expected:', err.message);
    }

    if (doubleAcceptSuccess) {
        throw new Error('Waiter A was able to accept an already accepted request');
    }
    if (!doubleAcceptError || !doubleAcceptError.message.includes('already been accepted')) {
        throw new Error(`Expected error message to mention 'already been accepted', got: ${doubleAcceptError?.message}`);
    }

    // Check DB state
    const { data: requestInDb } = await supabase
        .from('service_requests')
        .select('*')
        .eq('id', newRequest.id)
        .single();

    console.log('DB State after acceptance tests:');
    console.log(`- request_status: ${requestInDb.request_status} (Expected: accepted)`);
    console.log(`- accepted_by: ${requestInDb.accepted_by} (Expected: ${waiterA.id})`);
    console.log(`- accepted_at: ${requestInDb.accepted_at} (Expected: non-null)`);

    if (requestInDb.request_status !== 'accepted') {
        throw new Error(`Expected request_status to be 'accepted', got '${requestInDb.request_status}'`);
    }
    if (requestInDb.accepted_by !== waiterA.id) {
        throw new Error(`Expected accepted_by to be '${waiterA.id}', got '${requestInDb.accepted_by}'`);
    }
    if (!requestInDb.accepted_at) {
        throw new Error('Expected accepted_at timestamp to be set');
    }

    // 3. Workload Transfer Test
    console.log('\n--- Test 3: Transferring Service Request ---');
    console.log(`Transferring request [${newRequest.id}] from Waiter A (${waiterA.name}) to Waiter B (${waiterB.name})...`);
    await OrderService.transferServiceRequest(newRequest.id, waiterB.id, restaurantId);

    const { data: requestAfterTransfer } = await supabase
        .from('service_requests')
        .select('*')
        .eq('id', newRequest.id)
        .single();

    console.log('Request state after transfer:');
    console.log(`- assigned_waiter_id: ${requestAfterTransfer.assigned_waiter_id} (Expected: ${waiterB.id})`);
    console.log(`- request_status: ${requestAfterTransfer.request_status} (Expected: pending)`);
    console.log(`- accepted_by: ${requestAfterTransfer.accepted_by} (Expected: null)`);
    console.log(`- accepted_at: ${requestAfterTransfer.accepted_at} (Expected: null)`);

    if (requestAfterTransfer.assigned_waiter_id !== waiterB.id) {
        throw new Error('Transfer failed to change assigned_waiter_id');
    }
    if (requestAfterTransfer.request_status !== 'pending') {
        throw new Error('Transfer did not reset status to pending');
    }

    // 4. Mark Request Delivered / Completed
    console.log('\n--- Test 4: Complete Service Request ---');
    console.log('Marking request as completed...');
    await OrderService.completeServiceRequest(newRequest.id, restaurantId);

    const { data: requestAfterComplete } = await supabase
        .from('service_requests')
        .select('*')
        .eq('id', newRequest.id)
        .single();

    console.log('Request state after completion:');
    console.log(`- request_status: ${requestAfterComplete.request_status} (Expected: completed)`);
    console.log(`- completed_at: ${requestAfterComplete.completed_at} (Expected: non-null)`);

    if (requestAfterComplete.request_status !== 'completed') {
        throw new Error('Failed to set status to completed');
    }
    if (!requestAfterComplete.completed_at) {
        throw new Error('completed_at was not populated');
    }

    console.log('\n--- ALL TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
    console.error('Test run failed with error:', err);
    process.exit(1);
});
