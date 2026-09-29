import assert from 'assert';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTakeawayHandoverTests() {
    const { OrderService } = await import('../services/orders.service');
    const { ceil2 } = await import('../lib/utils');

    console.log('🧪 Starting End-to-End Test for Takeaway Order Handover Payment Confirmation Flow...\n');

    // 1. Fetch a menu item and its restaurant
    const { data: menuItem, error: menuErr } = await supabase
        .from('menu_items')
        .select('id, name, price, restaurant_id')
        .limit(1)
        .single();

    assert(!menuErr && menuItem, 'Menu item must exist for testing');
    const restaurantId = menuItem.restaurant_id;

    const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id, name')
        .eq('id', restaurantId)
        .single();

    console.log(`📍 Testing with restaurant: ${restaurant?.name || 'Unknown'} (${restaurantId})`);
    console.log(`🍽️ Testing with item: ${menuItem.name} @ ₹${menuItem.price}`);

    const itemPrice = Number(menuItem.price);
    const quantity = 2;
    const subtotal = itemPrice * quantity;
    const cgst = ceil2(subtotal * 0.025);
    const sgst = ceil2(subtotal * 0.025);
    const totalTax = ceil2(cgst + sgst);
    const totalAmount = ceil2(subtotal + totalTax);

    console.log(`   Subtotal: ₹${subtotal}, CGST: ₹${cgst}, SGST: ₹${sgst}, Total: ₹${totalAmount}`);

    // 3. Create a test Takeaway order
    const orderData = {
        restaurant_id: restaurantId,
        order_type: 'TAKEAWAY',
        customer_phone: '9999999999',
        delivery_notes: 'Customer: Test Customer',
        status: 'ready', // Takeaway order cooked and ready for pickup
        total_amount: totalAmount,
        cgst_amount: cgst,
        sgst_amount: sgst,
        gst_amount: totalTax,
        amount_paid: 0,
        is_completed: false,
    };

    const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

    assert(!orderErr && order, `Order insertion failed: ${orderErr?.message}`);
    const orderId = order.id;
    console.log(`📦 Created test Takeaway order: ${orderId} (Status: ${order.status})`);

    // Insert order item
    const { error: itemErr } = await supabase
        .from('order_items')
        .insert({
            order_id: orderId,
            restaurant_id: restaurantId,
            menu_item_id: menuItem.id,
            price_at_time: itemPrice,
            quantity: quantity,
            status: 'ready'
        });

    assert(!itemErr, `Order item insertion failed: ${itemErr?.message}`);

    try {
        // ─────────────────────────────────────────────────────────────────
        // TEST 1: SAFETY - CANNOT HAND OVER BEFORE PAYMENT CONFIRMATION
        // ─────────────────────────────────────────────────────────────────
        console.log('\n--- TEST 1: Safety Enforcement - Handover Blocked Prior to Payment ---');
        let handoverBlocked = false;
        try {
            await OrderService.completeTakeawayHandover(orderId, restaurantId);
        } catch (err: any) {
            handoverBlocked = true;
            console.log(`   Caught expected safety error: "${err.message}"`);
            assert(err.message.includes('cannot be handed over before payment confirmation') || err.message.includes('Safety check failed'), 'Error message should indicate payment requirement');
        }
        assert.strictEqual(handoverBlocked, true, 'Handover must be strictly blocked before payment confirmation');
        console.log('   ✅ PASS: Unpaid takeaway order cannot be handed over.');

        // ─────────────────────────────────────────────────────────────────
        // TEST 2: PAYMENT CONFIRMATION FLOW (Cash / UPI / Card)
        // ─────────────────────────────────────────────────────────────────
        console.log('\n--- TEST 2: Payment Confirmation Flow (UPI) ---');
        const updatedOrder = await OrderService.confirmTakeawayPayment(
            orderId,
            restaurantId,
            'UPI',
            totalAmount
        );

        assert.strictEqual(updatedOrder.paid_by, 'UPI', 'paid_by must be set to UPI');
        assert.strictEqual(updatedOrder.status, 'paid', 'Order status must be recorded as paid');
        assert.strictEqual(Number(updatedOrder.amount_paid), totalAmount, 'amount_paid must equal totalAmount');
        assert.strictEqual(updatedOrder.is_completed, false, 'is_completed must still be false until handover');
        console.log(`   Updated Order: status=${updatedOrder.status}, paid_by=${updatedOrder.paid_by}, amount_paid=₹${updatedOrder.amount_paid}, is_completed=${updatedOrder.is_completed}`);

        // Verify items are marked paid
        const { data: updatedItems } = await supabase
            .from('order_items')
            .select('status')
            .eq('order_id', orderId);
        assert(updatedItems && updatedItems.every(i => i.status === 'paid'), 'All order items must be marked as paid');
        console.log('   ✅ PASS: Payment confirmed and recorded successfully on order and items.');

        // ─────────────────────────────────────────────────────────────────
        // TEST 3: ACTIVE ORDERS & READY TAB FILTERING CONSISTENCY
        // ─────────────────────────────────────────────────────────────────
        console.log('\n--- TEST 3: Active Orders & Ready Tab Filtering Consistency ---');
        // Simulate admin orders filtering logic
        const currentChannelOrders = [updatedOrder];
        const countReady = currentChannelOrders.filter(o => o.status === 'ready' || (o.order_type === 'TAKEAWAY' && o.status === 'paid' && !o.is_completed)).length;
        assert.strictEqual(countReady, 1, 'Paid takeaway order waiting for handover must be included in Ready tab count');

        const filteredReady = currentChannelOrders.filter(o => o.status === 'ready' || (o.order_type === 'TAKEAWAY' && o.status === 'paid' && !o.is_completed));
        assert.strictEqual(filteredReady.length, 1, 'Paid takeaway order waiting for handover must appear in Ready tab view');
        console.log('   ✅ PASS: Paid takeaway orders remain accessible in Ready tab until handover completion.');

        // ─────────────────────────────────────────────────────────────────
        // TEST 4: FINAL HANDOVER COMPLETION
        // ─────────────────────────────────────────────────────────────────
        console.log('\n--- TEST 4: Final Handover Completion ---');
        const completedOrder = await OrderService.completeTakeawayHandover(orderId, restaurantId);

        assert.strictEqual(completedOrder.status, 'served', 'Order status must become served');
        assert.strictEqual(completedOrder.is_completed, true, 'Order is_completed must become true');
        assert(completedOrder.completed_at, 'completed_at timestamp must be recorded');
        console.log(`   Completed Order: status=${completedOrder.status}, is_completed=${completedOrder.is_completed}, completed_at=${completedOrder.completed_at}`);

        // Verify items are marked served
        const { data: servedItems } = await supabase
            .from('order_items')
            .select('status, served_at')
            .eq('order_id', orderId);
        assert(servedItems && servedItems.every(i => i.status === 'served' && i.served_at), 'All order items must be marked served with served_at timestamp');
        console.log('   ✅ PASS: Handover completion updates status, marks is_completed, and cascades to items.');

        // ─────────────────────────────────────────────────────────────────
        // TEST 5: REMOVAL FROM ACTIVE TAKEAWAY ORDERS
        // ─────────────────────────────────────────────────────────────────
        console.log('\n--- TEST 5: Removal From Active Takeaway Orders ---');
        // Once handed over (is_completed: true), it must NOT match the active ready filter
        const postHandoverReady = [completedOrder].filter(o => o.status === 'ready' || (o.order_type === 'TAKEAWAY' && o.status === 'paid' && !o.is_completed));
        assert.strictEqual(postHandoverReady.length, 0, 'Completed takeaway order must NOT appear in Ready filter');
        console.log('   ✅ PASS: Completed order cleanly removed from active takeaway orders.');

        // ─────────────────────────────────────────────────────────────────
        // TEST 6: SAFETY - PREVENT DOUBLE HANDOVER
        // ─────────────────────────────────────────────────────────────────
        console.log('\n--- TEST 6: Safety - Prevent Double Handover ---');
        let doubleHandoverBlocked = false;
        try {
            await OrderService.completeTakeawayHandover(orderId, restaurantId);
        } catch (err: any) {
            doubleHandoverBlocked = true;
            console.log(`   Caught expected double-handover error: "${err.message}"`);
            assert(err.message.includes('already handed over and completed'), 'Error message should indicate order already completed');
        }
        assert.strictEqual(doubleHandoverBlocked, true, 'Double handover must be strictly prevented');
        console.log('   ✅ PASS: Double handover prevented.');

        console.log('\n🎉 ALL TAKEAWAY HANDOVER PAYMENT FLOW TESTS PASSED SUCCESSFULLY! 🎉\n');
    } finally {
        // Clean up test order and items
        await supabase.from('order_items').delete().eq('order_id', orderId);
        await supabase.from('orders').delete().eq('id', orderId);
        console.log('🧹 Cleaned up test order and items.');
    }
}

runTakeawayHandoverTests().catch(err => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
});
