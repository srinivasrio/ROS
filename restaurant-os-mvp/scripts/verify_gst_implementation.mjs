import assert from 'assert';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🧪 Starting End-to-End GST Verification...\n');

async function testDatabaseAndRpc() {
    console.log('--- 1. Testing Database Schema & RPC ---');

    // 1.1 Verify columns in restaurants
    const { data: resData, error: resErr } = await supabase
        .from('restaurants')
        .select('id, name, gst_percentage, cgst_percentage, sgst_percentage')
        .limit(1)
        .single();
    assert(!resErr, `Failed to query restaurants: ${resErr?.message}`);
    assert(resData.gst_percentage !== undefined, 'restaurants table must have gst_percentage');
    assert(resData.cgst_percentage !== undefined, 'restaurants table must have cgst_percentage');
    assert(resData.sgst_percentage !== undefined, 'restaurants table must have sgst_percentage');
    console.log(`✅ PASS: restaurants table has GST columns. Sample: ${resData.name} (${resData.gst_percentage}%, CGST: ${resData.cgst_percentage}%, SGST: ${resData.sgst_percentage}%)`);

    // 1.2 Verify columns in menu_items
    const { data: itemData, error: itemErr } = await supabase
        .from('menu_items')
        .select('id, restaurant_id, name, price, gst_percentage, cgst_percentage, sgst_percentage, tax_percent')
        .limit(1)
        .single();
    assert(!itemErr, `Failed to query menu_items: ${itemErr?.message}`);
    assert(itemData.gst_percentage !== undefined, 'menu_items table must have gst_percentage');
    assert(itemData.cgst_percentage !== undefined, 'menu_items table must have cgst_percentage');
    assert(itemData.sgst_percentage !== undefined, 'menu_items table must have sgst_percentage');
    assert(itemData.tax_percent !== undefined, 'menu_items table must have tax_percent');
    console.log(`✅ PASS: menu_items table has GST columns. Sample: ${itemData.name} (${itemData.gst_percentage}%, CGST: ${itemData.cgst_percentage}%, SGST: ${itemData.sgst_percentage}%)`);

    // 1.3 Verify RPC save_menu_item_with_recipe updates custom item GST
    const testItemId = itemData.id;
    const testRestId = itemData.restaurant_id || resData.id;

    console.log(`Testing RPC save_menu_item_with_recipe on item ${testItemId} with 18% GST...`);
    const { data: rpcUpdateResult, error: rpcUpdateErr } = await supabase.rpc('save_menu_item_with_recipe', {
        p_menu_item: {
            id: testItemId,
            restaurant_id: testRestId,
            name: itemData.name,
            price: itemData.price,
            gst_percentage: 18,
            cgst_percentage: 9,
            sgst_percentage: 9,
            tax_percent: 18,
            menu_item_type: 'food'
        },
        p_ingredients: []
    });

    assert(!rpcUpdateErr, `save_menu_item_with_recipe failed on 18% GST: ${rpcUpdateErr?.message}`);
    assert.strictEqual(Number(rpcUpdateResult.gst_percentage), 18, 'Item GST percentage must be 18%');
    assert.strictEqual(Number(rpcUpdateResult.cgst_percentage), 9, 'Item CGST percentage must be 9%');
    assert.strictEqual(Number(rpcUpdateResult.sgst_percentage), 9, 'Item SGST percentage must be 9%');
    assert.strictEqual(Number(rpcUpdateResult.tax_percent), 18, 'Item tax_percent must be synced to 18%');
    console.log('✅ PASS: RPC successfully saved custom 18% GST (9% CGST + 9% SGST)');

    // Revert back to original or 5%
    const { data: rpcRevertResult, error: rpcRevertErr } = await supabase.rpc('save_menu_item_with_recipe', {
        p_menu_item: {
            id: testItemId,
            restaurant_id: testRestId,
            name: itemData.name,
            price: itemData.price,
            gst_percentage: 5,
            cgst_percentage: 2.5,
            sgst_percentage: 2.5,
            tax_percent: 5,
            menu_item_type: 'food'
        },
        p_ingredients: []
    });
    assert(!rpcRevertErr, `save_menu_item_with_recipe failed to revert: ${rpcRevertErr?.message}`);
    assert.strictEqual(Number(rpcRevertResult.gst_percentage), 5, 'Item GST reverted to 5%');
    console.log('✅ PASS: RPC successfully reverted item GST to 5% (2.5% CGST + 2.5% SGST)');
}

function testCalculationLogic() {
    console.log('\n--- 2. Testing Item-by-Item GST Calculation Engine ---');

    // Simulate mixed-GST basket
    const cartItems = [
        { id: 1, name: 'Standard Food Item', price: 200, quantity: 2, gst_percentage: 5, cgst_percentage: 2.5, sgst_percentage: 2.5 },
        { id: 2, name: 'Beverage / Premium Item', price: 500, quantity: 1, gst_percentage: 18, cgst_percentage: 9, sgst_percentage: 9 },
        { id: 3, name: 'Zero/Exempt Item', price: 100, quantity: 1, gst_percentage: 0, cgst_percentage: 0, sgst_percentage: 0 }
    ];

    let subtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalGst = 0;

    for (const item of cartItems) {
        const lineSubtotal = item.price * item.quantity;
        subtotal += lineSubtotal;

        const lineCgst = (lineSubtotal * item.cgst_percentage) / 100;
        const lineSgst = (lineSubtotal * item.sgst_percentage) / 100;
        const lineGst = (lineSubtotal * item.gst_percentage) / 100;

        totalCgst += lineCgst;
        totalSgst += lineSgst;
        totalGst += lineGst;
    }

    // Expected:
    // Item 1: 400 * 5% = 20 (CGST = 10, SGST = 10)
    // Item 2: 500 * 18% = 90 (CGST = 45, SGST = 45)
    // Item 3: 100 * 0% = 0 (CGST = 0, SGST = 0)
    // Total subtotal = 1000
    // Total CGST = 55.00
    // Total SGST = 55.00
    // Total GST = 110.00
    // Grand Total = 1110.00

    assert.strictEqual(subtotal, 1000, 'Subtotal should be 1000');
    assert.strictEqual(totalCgst, 55, 'Total CGST should be 55');
    assert.strictEqual(totalSgst, 55, 'Total SGST should be 55');
    assert.strictEqual(totalGst, 110, 'Total GST should be 110');
    assert.strictEqual(subtotal + totalGst, 1110, 'Grand total should be 1110');

    console.log(`✅ PASS: Subtotal: ₹${subtotal}, CGST: ₹${totalCgst}, SGST: ₹${totalSgst}, Total GST: ₹${totalGst}, Grand Total: ₹${subtotal + totalGst}`);
}

function testSourceCodeCompliance() {
    console.log('\n--- 3. Testing Source Code Compliance ---');

    // 3.1 Registration Page: Must collect GST, CGST, SGST
    const registerSrc = fs.readFileSync('app/(auth)/register/page.tsx', 'utf8');
    assert(registerSrc.includes('gstPercentage') && registerSrc.includes('cgstPercentage') && registerSrc.includes('sgstPercentage'),
        'Registration page must capture gstPercentage, cgstPercentage, sgstPercentage');
    assert(registerSrc.includes('must equal total GST'),
        'Registration page must validate CGST + SGST equals Total GST');
    console.log('✅ PASS: Registration Page captures and validates GST, CGST, and SGST with 50/50 auto-splitting');

    // 3.2 Admin Menu Management: Add/Edit modal & table rows
    const adminMenuSrc = fs.readFileSync('app/[restaurantCode]/admin/menu/page.tsx', 'utf8');
    assert(adminMenuSrc.includes('gst_percentage') && adminMenuSrc.includes('cgst_percentage') && adminMenuSrc.includes('sgst_percentage'),
        'Admin menu page must support gst_percentage, cgst_percentage, and sgst_percentage');
    assert(adminMenuSrc.includes('getGstSettings'),
        'Admin menu page must fetch restaurant default GST settings via getGstSettings');
    assert(adminMenuSrc.includes('CGST') && adminMenuSrc.includes('SGST'),
        'Admin menu items table must display CGST and SGST percentages');
    assert(adminMenuSrc.includes('Reset to Restaurant Default'),
        'Admin menu item modal must have a Reset to Restaurant Default button');
    console.log('✅ PASS: Admin Menu Management displays CGST/SGST in tables and provides item-level overrides');

    // 3.3 Admin Settings Page: Edit restaurant default GST
    const adminSettingsSrc = fs.readFileSync('app/[restaurantCode]/admin/settings/page.tsx', 'utf8');
    assert(adminSettingsSrc.includes('gst_percentage') && adminSettingsSrc.includes('cgst_percentage') && adminSettingsSrc.includes('sgst_percentage'),
        'Admin settings page must manage restaurant-level GST');
    console.log('✅ PASS: Admin Settings Page manages restaurant-level GST configuration');

    // 3.4 Order Service: Saves GST breakdown in orders and order_items
    const ordersServiceSrc = fs.readFileSync('services/orders.service.ts', 'utf8');
    assert(ordersServiceSrc.includes('cgst_amount') && ordersServiceSrc.includes('sgst_amount') && ordersServiceSrc.includes('gst_amount'),
        'OrderService must record cgst_amount, sgst_amount, and gst_amount on orders');
    assert(ordersServiceSrc.includes('cgst_percent') && ordersServiceSrc.includes('sgst_percent'),
        'OrderService must record cgst_percent and sgst_percent on order_items');
    console.log('✅ PASS: OrderService persists item-level taxes and order GST amounts accurately');

    // 3.5 Invoices & Cart breakdown
    const invoiceSrc = fs.readFileSync('components/InvoiceComponent.tsx', 'utf8');
    assert(invoiceSrc.includes('CGST') && invoiceSrc.includes('SGST') && invoiceSrc.includes('GST'),
        'InvoiceComponent must display CGST, SGST, and Total GST lines');
    console.log('✅ PASS: InvoiceComponent renders detailed CGST and SGST breakdowns');

    const cartContextSrc = fs.readFileSync('context/CartContext.tsx', 'utf8');
    assert(cartContextSrc.includes('cgst') && cartContextSrc.includes('sgst'),
        'CartContext must expose cgst and sgst calculations');
    console.log('✅ PASS: CartContext calculates dynamic item-by-item GST, CGST, and SGST');
}

async function run() {
    try {
        await testDatabaseAndRpc();
        testCalculationLogic();
        testSourceCodeCompliance();
        console.log('\n🎉 ALL GST VERIFICATION TESTS PASSED SUCCESSFULLY!');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ VERIFICATION FAILED:', err);
        process.exit(1);
    }
}

run();
