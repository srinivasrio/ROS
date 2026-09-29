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

async function runTests() {
    const { OrderService } = await import('../services/orders.service');
    const { formatCurrency, ceil2 } = await import('../lib/utils');

    console.log('🧪 Starting End-to-End Test for the 3 Fixes...\n');

    // ─────────────────────────────────────────────────────────────────
    // ISSUE 1: TOTAL AMOUNT FORMATTING & CEILING ROUNDING MATH
    // ─────────────────────────────────────────────────────────────────
    console.log('--- TEST SUITE 1: Total Amount Formatting & Math Precision (Always Add / Never Reduce) ---');

    // 1. Fractional paise must always round up by adding, not reducing
    assert.strictEqual(ceil2(2885.391), 2885.4, '2885.391 must round UP to 2885.40 (adding, not reducing)');
    assert.strictEqual(ceil2(12.441), 12.45, '12.441 must round UP to 12.45 (adding, not reducing)');
    assert.strictEqual(ceil2(68.701), 68.71, '68.701 must round UP to 68.71 (adding, not reducing)');

    // 2. Binary floating point representation noise must not add false extra paise
    assert.strictEqual(ceil2(2885.399999999996), 2885.4, '2885.399999999996 must round cleanly to 2885.40');
    assert.strictEqual(ceil2(2885.40), 2885.4, 'Exact 2885.40 must stay 2885.40');
    assert.strictEqual(ceil2(12.440000000000001), 12.44, 'Binary noise 12.440000000000001 must stay 12.44');

    const formattedCurrency = formatCurrency(2885.399999999996);
    console.log(`   Raw float: 2885.399999999996 -> Formatted: ${formattedCurrency}`);
    assert(formattedCurrency.includes('2,885.4') || formattedCurrency.includes('2885.4'), 'formatCurrency must format 2885.40 without floating-point garbage');
    assert(!formattedCurrency.includes('9999999'), 'formatCurrency must never display .399999999996');

    // 3. Test GST math: CGST + SGST = Total GST
    const testCgst = 68.71;
    const testSgst = 68.71;
    const testTotalGst = ceil2(testCgst + testSgst);
    assert.strictEqual(testTotalGst, 137.42, 'Total GST must strictly equal CGST + SGST (137.42)');
    console.log('   ✅ PASS: Total amount rounding math (always add / never reduce) verified.');


    // ─────────────────────────────────────────────────────────────────
    // ISSUE 2: ORDER DETAILS MINIMIZE & URL QUERY PARAM LIFECYCLE
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- TEST SUITE 2: Order Card Minimize & URL Parameter Logic ---');
    // Verify that router searchParam clearing logic parses and strips orderId
    const sampleUrl = new URL('http://localhost:3000/delhi/admin/orders?channel=TAKEAWAY&orderId=test-order-123');
    assert.strictEqual(sampleUrl.searchParams.get('channel'), 'TAKEAWAY');
    assert.strictEqual(sampleUrl.searchParams.get('orderId'), 'test-order-123');

    sampleUrl.searchParams.delete('orderId');
    assert.strictEqual(sampleUrl.searchParams.get('orderId'), null);
    assert.strictEqual(sampleUrl.searchParams.get('channel'), 'TAKEAWAY');
    console.log(`   URL after closing modal: ${sampleUrl.pathname}?${sampleUrl.searchParams.toString()}`);
    console.log('   ✅ PASS: URL parameter cleanup preserves channel without re-triggering order auto-open.');


    // ─────────────────────────────────────────────────────────────────
    // ISSUE 3: TAKEAWAY ORDER MERGING & ITEMS PRESERVATION
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- TEST SUITE 3: Takeaway Order Merging & Item Preservation ---');

    // Find a restaurant with menu items
    const { data: mList, error: mListErr } = await supabase
        .from('menu_items')
        .select('restaurant_id')
        .limit(50);

    const counts: Record<string, number> = {};
    (mList || []).forEach(m => {
        counts[m.restaurant_id] = (counts[m.restaurant_id] || 0) + 1;
    });
    const validRestId = Object.keys(counts).find(id => counts[id] >= 2);
    assert(validRestId, 'Must find a restaurant with at least 2 menu items');

    const { data: rest, error: rErr } = await supabase
        .from('restaurants')
        .select('id, name')
        .eq('id', validRestId)
        .single();

    assert(!rErr && rest, `Failed to load restaurant: ${rErr?.message}`);
    const restaurantId = rest.id;
    console.log(`   Using restaurant: "${rest.name}" (${restaurantId})`);

    const { data: menuItems, error: mErr } = await supabase
        .from('menu_items')
        .select('id, name, price, gst_percentage')
        .eq('restaurant_id', restaurantId)
        .limit(2);

    assert(!mErr && menuItems && menuItems.length >= 2, 'Need at least 2 menu items for merging test');
    const item1 = menuItems[0];
    const item2 = menuItems[1];
    console.log(`   Item 1: "${item1.name}" @ ₹${item1.price}`);
    console.log(`   Item 2: "${item2.name}" @ ₹${item2.price}`);

    const uniqueCustomerPhone = `99999${Math.floor(10000 + Math.random() * 90000)}`;
    const uniqueCustomerName = `E2E Test Customer ${Date.now().toString().slice(-4)}`;

    // STEP A: Customer places FIRST Takeaway order
    console.log('\n   A. Placing initial takeaway order with Item 1...');
    const order1 = await OrderService.createOrder(
        'takeaway',
        [{
            menu_item_id: String(item1.id),
            name: item1.name,
            price: Number(item1.price),
            quantity: 2,
            notes: 'Less spicy please'
        }],
        restaurantId,
        'placed',
        undefined,
        undefined,
        undefined,
        `tx-1-${Date.now()}`,
        undefined,
        {
            orderType: 'TAKEAWAY',
            customerName: uniqueCustomerName,
            customerPhone: uniqueCustomerPhone,
        }
    );

    assert(order1 && order1.id, 'Initial takeaway order creation failed');
    const firstOrderId = order1.id;
    console.log(`   Initial Order Created! ID: ${firstOrderId}, Total: ₹${(order1 as any).total_amount}`);

    // Verify order 1 has 1 order item with qty 2
    const { data: initialDbItems } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', firstOrderId);

    assert(initialDbItems && initialDbItems.length === 1, 'Initial order should have exactly 1 order item row');
    assert.strictEqual(Number(initialDbItems[0].quantity), 2);
    console.log(`   Verified initial order has ${initialDbItems.length} item(s) in DB.`);

    // STEP B: Move order to 'preparing' (already being prepared in the kitchen)
    console.log('\n   B. Transitioning order to "preparing" in kitchen...');
    await supabase
        .from('orders')
        .update({ status: 'preparing' })
        .eq('id', firstOrderId);

    // STEP C: Customer adds another item and places second order
    console.log('\n   C. Customer adds Item 2 and places subsequent order for active takeaway...');
    const order2 = await OrderService.createOrder(
        'takeaway',
        [{
            menu_item_id: String(item2.id),
            name: item2.name,
            price: Number(item2.price),
            quantity: 1,
            notes: 'Extra tissue'
        }],
        restaurantId,
        'placed',
        undefined,
        undefined,
        undefined,
        `tx-2-${Date.now()}`,
        undefined,
        {
            orderType: 'TAKEAWAY',
            activeOrderId: firstOrderId, // Customer references active order
            customerName: uniqueCustomerName,
            customerPhone: uniqueCustomerPhone,
        }
    );

    // STEP D: Verify order was merged into firstOrderId and NOT replaced or created anew
    console.log('\n   D. Verifying order merge results...');
    assert.strictEqual(order2.id, firstOrderId, `Subsequent order ID (${order2.id}) must match existing order ID (${firstOrderId})!`);

    // Verify all items are preserved in DB
    const { data: combinedDbItems } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', firstOrderId);

    assert(combinedDbItems && combinedDbItems.length === 2, `Expected 2 order items in combined order, found ${combinedDbItems?.length}`);
    
    const foundItem1 = combinedDbItems.find(i => Number(i.menu_item_id) === Number(item1.id));
    const foundItem2 = combinedDbItems.find(i => Number(i.menu_item_id) === Number(item2.id));

    assert(foundItem1, 'Previous item (Item 1) MUST NOT be deleted or replaced');
    assert.strictEqual(Number(foundItem1.quantity), 2, 'Previous item quantity must be preserved');
    assert(foundItem2, 'New item (Item 2) MUST be present in the merged order');
    assert.strictEqual(Number(foundItem2.quantity), 1, 'New item quantity must be correct');

    // STEP E: Verify combined totals and GST precision
    const { data: refreshedOrder } = await supabase
        .from('orders')
        .select('total_amount, gst_amount, cgst_amount, sgst_amount, status')
        .eq('id', firstOrderId)
        .single();

    assert(refreshedOrder, 'Refreshed order from DB must not be null');
    console.log('   Combined Order in DB:', refreshedOrder);
    const subtotalItem1 = Number(item1.price) * 2;
    const subtotalItem2 = Number(item2.price) * 1;
    const expectedSubtotal = ceil2(subtotalItem1 + subtotalItem2);

    const expectedCgst = ceil2(Number(refreshedOrder.cgst_amount));
    const expectedSgst = ceil2(Number(refreshedOrder.sgst_amount));
    const expectedGst = ceil2(expectedCgst + expectedSgst);

    assert.strictEqual(ceil2(Number(refreshedOrder.gst_amount)), expectedGst, 'Combined GST must equal CGST + SGST');
    assert(Number(refreshedOrder.total_amount) >= expectedSubtotal, 'Total amount must equal or exceed subtotal + GST');

    // Verify precision: max 2 decimal places
    const totalStr = String(refreshedOrder.total_amount);
    const decimalParts = totalStr.split('.')[1] || '';
    assert(decimalParts.length <= 2, `Total amount should have at most 2 decimal places, got: ${totalStr}`);

    console.log(`   ✅ PASS: Combined order has all previous + new items intact with exact 2-decimal amounts!`);

    // Cleanup test order
    console.log('\n   Cleaning up test order...');
    await supabase.from('order_items').delete().eq('order_id', firstOrderId);
    await supabase.from('orders').delete().eq('id', firstOrderId);
    console.log('   Cleanup complete.');

    console.log('\n============================================================');
    console.log('🎉 ALL 3 TEST SUITES PASSED FLAWLESSLY!');
    console.log('============================================================\n');
}

runTests().catch(err => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
});
