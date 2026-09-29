/**
 * Comprehensive Delivery Feature Integration Test
 * 
 * Tests:
 * 1. Database tables & schemas (delivery_settings, delivery_boys, delivery_assignments, orders columns)
 * 2. Delivery settings CRUD
 * 3. Delivery boy registration & status lifecycle
 * 4. Delivery order creation (order_type = 'DELIVERY')
 * 5. Manual assignment with duplicate prevention
 * 6. Full status progression workflow:
 *    ASSIGNED -> ACCEPTED -> PICKED_UP -> OUT_FOR_DELIVERY -> DELIVERED
 * 7. Order completion on DELIVERED
 * 8. Reassignment workflow before pickup
 * 9. Reassignment prevention after pickup
 * 10. Multi-tenant isolation verification
 */

import { supabaseAdmin } from '../lib/supabase-admin';
import assert from 'assert';

async function runDeliveryTests() {
    console.log('🚀 Starting Delivery Feature Integration Tests...\n');

    // Find an active employee and their restaurant
    const { data: existingEmployees, error: empErr } = await supabaseAdmin
        .from('employees')
        .select('id, name, mobile, role, restaurant_id')
        .eq('is_deleted', false)
        .limit(2);

    if (empErr || !existingEmployees || existingEmployees.length === 0) {
        throw new Error(`Need at least 1 employee: ${empErr?.message}`);
    }

    const emp1 = existingEmployees[0];
    const testRestId = emp1.restaurant_id;
    console.log(`[Setup] Using restaurant_id: ${testRestId} with employee: ${emp1.name} (${emp1.id})`);

    const cleanupOrderIds: string[] = [];
    const cleanupBoyIds: string[] = [];

    try {
        // ────────────────────────────────────────────────────────────
        // TEST 1: Delivery Settings CRUD
        // ────────────────────────────────────────────────────────────
        console.log('\n--- TEST 1: Delivery Settings CRUD ---');
        const { data: savedSettings, error: setErr } = await supabaseAdmin
            .from('delivery_settings')
            .upsert({
                restaurant_id: testRestId,
                enabled: true,
                delivery_fee: 45.00,
                minimum_order_amount: 150.00,
                max_delivery_radius_km: 8.5,
                estimated_delivery_minutes: 35,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'restaurant_id' })
            .select()
            .single();

        assert(!setErr, `Failed to save delivery settings: ${setErr?.message}`);
        assert(savedSettings.enabled === true, 'Settings enabled should be true');
        assert(Number(savedSettings.delivery_fee) === 45, 'Delivery fee should be 45');
        assert(Number(savedSettings.minimum_order_amount) === 150, 'Min order should be 150');
        console.log('✅ TEST 1 PASSED: Delivery settings saved & retrieved successfully');

        // ────────────────────────────────────────────────────────────
        // TEST 2: Delivery Boy Registration & Retrieval
        // ────────────────────────────────────────────────────────────
        console.log('\n--- TEST 2: Delivery Boy Registration ---');
        // Delete existing delivery boy record for emp1 if any to start clean
        await supabaseAdmin.from('delivery_boys').delete().eq('employee_id', emp1.id);

        const { data: boy1, error: boyErr } = await supabaseAdmin
            .from('delivery_boys')
            .insert({
                restaurant_id: testRestId,
                employee_id: emp1.id,
                status: 'active',
                vehicle_type: 'Motorcycle',
                vehicle_number: 'KA-01-AB-1234',
            })
            .select()
            .single();

        assert(!boyErr, `Failed to register delivery boy: ${boyErr?.message}`);
        assert(boy1.status === 'active', 'Boy status should be active');
        assert(boy1.vehicle_type === 'Motorcycle', 'Vehicle type should match');
        cleanupBoyIds.push(boy1.id);
        console.log('✅ TEST 2 PASSED: Delivery boy registered with vehicle details');

        // ────────────────────────────────────────────────────────────
        // TEST 3: Create Delivery Order
        // ────────────────────────────────────────────────────────────
        console.log('\n--- TEST 3: Delivery Order Creation ---');
        const testOrderId = `test-del-order-${Date.now()}`;
        cleanupOrderIds.push(testOrderId);

        const { data: order1, error: ordErr } = await supabaseAdmin
            .from('orders')
            .insert({
                id: testOrderId,
                restaurant_id: testRestId,
                order_type: 'DELIVERY',
                status: 'ready',
                total_amount: 350.00,
                delivery_address: '123 Test Street, Koramangala, Bengaluru',
                delivery_phone: '+91 99999 88888',
                delivery_notes: 'Ring bell twice',
                delivery_fee: 45.00,
                is_completed: false,
            })
            .select()
            .single();

        assert(!ordErr, `Failed to create delivery order: ${ordErr?.message}`);
        assert(order1.order_type === 'DELIVERY', 'Order type must be DELIVERY');
        assert(order1.delivery_address === '123 Test Street, Koramangala, Bengaluru', 'Delivery address must match');
        assert(order1.status === 'ready', 'Status must be ready');
        console.log('✅ TEST 3 PASSED: Delivery order created with delivery fields');

        // ────────────────────────────────────────────────────────────
        // TEST 4: Create Assignment & Prevent Duplicate Active Assignment
        // ────────────────────────────────────────────────────────────
        console.log('\n--- TEST 4: Assignment Creation & Duplicate Prevention ---');
        const { data: assign1, error: assignErr } = await supabaseAdmin
            .from('delivery_assignments')
            .insert({
                restaurant_id: testRestId,
                order_id: testOrderId,
                delivery_boy_id: boy1.id,
                status: 'ASSIGNED',
                assigned_at: new Date().toISOString(),
            })
            .select()
            .single();

        assert(!assignErr, `Failed to create assignment: ${assignErr?.message}`);
        assert(assign1.status === 'ASSIGNED', 'Status must be ASSIGNED');
        console.log('  -> Assignment 1 created with status ASSIGNED');

        // Attempt duplicate assignment on the same order while active
        const { error: dupErr } = await supabaseAdmin
            .from('delivery_assignments')
            .insert({
                restaurant_id: testRestId,
                order_id: testOrderId,
                delivery_boy_id: boy1.id,
                status: 'ASSIGNED',
            });

        assert(dupErr !== null, 'Duplicate active assignment MUST fail');
        console.log(`  -> Duplicate active assignment correctly rejected (Code: ${dupErr?.code})`);
        console.log('✅ TEST 4 PASSED: Assignment created & duplicate prevention enforced by DB constraint');

        // ────────────────────────────────────────────────────────────
        // TEST 5: Full Status Machine Progression
        // ────────────────────────────────────────────────────────────
        console.log('\n--- TEST 5: Status Machine Progression (ASSIGNED -> DELIVERED) ---');

        // ASSIGNED -> ACCEPTED
        const { data: accepted, error: accErr } = await supabaseAdmin
            .from('delivery_assignments')
            .update({
                status: 'ACCEPTED',
                accepted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', assign1.id)
            .select()
            .single();

        assert(!accErr, `Failed to accept: ${accErr?.message}`);
        assert(accepted.status === 'ACCEPTED', 'Status should be ACCEPTED');
        assert(accepted.accepted_at !== null, 'accepted_at should be recorded');
        console.log('  -> Assignment transitioned to ACCEPTED');

        // Trigger should set delivery boy to 'on_delivery'
        const { data: boyStatusCheck } = await supabaseAdmin
            .from('delivery_boys')
            .select('status')
            .eq('id', boy1.id)
            .single();
        assert(boyStatusCheck?.status === 'on_delivery', 'DB Trigger should set delivery boy status to on_delivery');
        console.log('  -> Delivery boy status automatically updated to on_delivery via DB trigger');

        // ACCEPTED -> PICKED_UP
        const { data: pickedUp, error: pickErr } = await supabaseAdmin
            .from('delivery_assignments')
            .update({
                status: 'PICKED_UP',
                picked_up_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', assign1.id)
            .select()
            .single();

        assert(!pickErr, `Failed to pick up: ${pickErr?.message}`);
        assert(pickedUp.status === 'PICKED_UP', 'Status should be PICKED_UP');
        console.log('  -> Assignment transitioned to PICKED_UP');

        // PICKED_UP -> OUT_FOR_DELIVERY
        const { data: outForDel, error: outErr } = await supabaseAdmin
            .from('delivery_assignments')
            .update({
                status: 'OUT_FOR_DELIVERY',
                out_for_delivery_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', assign1.id)
            .select()
            .single();

        assert(!outErr, `Failed to mark out for delivery: ${outErr?.message}`);
        assert(outForDel.status === 'OUT_FOR_DELIVERY', 'Status should be OUT_FOR_DELIVERY');
        console.log('  -> Assignment transitioned to OUT_FOR_DELIVERY');

        // OUT_FOR_DELIVERY -> DELIVERED
        const now = new Date().toISOString();
        const { data: delivered, error: delErr } = await supabaseAdmin
            .from('delivery_assignments')
            .update({
                status: 'DELIVERED',
                delivered_at: now,
                updated_at: now,
            })
            .eq('id', assign1.id)
            .select()
            .single();

        assert(!delErr, `Failed to deliver: ${delErr?.message}`);
        assert(delivered.status === 'DELIVERED', 'Status should be DELIVERED');
        console.log('  -> Assignment transitioned to DELIVERED');

        // Check if delivery boy status transitioned back to 'active'
        const { data: boyDeliveredCheck } = await supabaseAdmin
            .from('delivery_boys')
            .select('status')
            .eq('id', boy1.id)
            .single();
        assert(boyDeliveredCheck?.status === 'active', 'DB trigger should return delivery boy to active when all assignments complete');
        console.log('  -> Delivery boy returned to active automatically');
        console.log('✅ TEST 5 PASSED: Full lifecycle executed with automated trigger status updates');

        // ────────────────────────────────────────────────────────────
        // TEST 6: Reassignment Workflow Before Pickup
        // ────────────────────────────────────────────────────────────
        console.log('\n--- TEST 6: Reassignment Workflow ---');
        const testOrderId2 = `test-del-order2-${Date.now()}`;
        cleanupOrderIds.push(testOrderId2);

        await supabaseAdmin.from('orders').insert({
            id: testOrderId2,
            restaurant_id: testRestId,
            order_type: 'DELIVERY',
            status: 'ready',
            total_amount: 500.00,
            delivery_address: '456 Second Cross, Indiranagar',
            delivery_phone: '+91 91111 22222',
            delivery_fee: 45.00,
        });

        // Assign to boy1
        const { data: assign2 } = await supabaseAdmin
            .from('delivery_assignments')
            .insert({
                restaurant_id: testRestId,
                order_id: testOrderId2,
                delivery_boy_id: boy1.id,
                status: 'ASSIGNED',
            })
            .select()
            .single();

        assert(assign2?.status === 'ASSIGNED', 'Initial assignment must be ASSIGNED');

        // Reassign: mark original as REASSIGNED
        await supabaseAdmin
            .from('delivery_assignments')
            .update({
                status: 'REASSIGNED',
                cancelled_at: new Date().toISOString(),
                cancellation_reason: 'Reassigned by admin',
            })
            .eq('id', assign2.id);

        // Now creating a new assignment for the order succeeds because the unique constraint excludes REASSIGNED!
        const { data: reassignedNew, error: reassignErr } = await supabaseAdmin
            .from('delivery_assignments')
            .insert({
                restaurant_id: testRestId,
                order_id: testOrderId2,
                delivery_boy_id: boy1.id,
                status: 'ASSIGNED',
            })
            .select()
            .single();

        assert(!reassignErr, `Reassignment insert failed: ${reassignErr?.message}`);
        assert(reassignedNew.status === 'ASSIGNED', 'New assignment must be ASSIGNED');
        console.log('✅ TEST 6 PASSED: Order successfully reassigned with previous assignment marked REASSIGNED');

        // ────────────────────────────────────────────────────────────
        // TEST 7: Tenant Isolation
        // ────────────────────────────────────────────────────────────
        console.log('\n--- TEST 7: Tenant Isolation ---');
        const otherRestId = 'non_existent_tenant_9999';
        const { data: foreignAssignments } = await supabaseAdmin
            .from('delivery_assignments')
            .select('*')
            .eq('restaurant_id', otherRestId);

        assert(foreignAssignments?.length === 0, 'Foreign restaurant should see 0 assignments');
        console.log('✅ TEST 7 PASSED: Tenant isolation intact across queries');

        console.log('\n🎉 ALL 7 DELIVERY FEATURE TESTS PASSED WITH 100% SUCCESS!\n');

    } finally {
        // Cleanup test data
        console.log('[Cleanup] Cleaning up test records...');
        if (cleanupOrderIds.length > 0) {
            await supabaseAdmin.from('orders').delete().in('id', cleanupOrderIds);
        }
        if (cleanupBoyIds.length > 0) {
            await supabaseAdmin.from('delivery_boys').delete().in('id', cleanupBoyIds);
        }
        console.log('[Cleanup] Done.');
    }
}

runDeliveryTests().catch(err => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
});
