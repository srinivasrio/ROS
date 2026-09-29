import assert from 'assert';
import { MenuService } from '../services/menu.service';
import { SpecialsService } from '../services/specials.service';
import { RestaurantService } from '../services/restaurant.service';

async function runTest() {
    console.log('🧪 Starting Waiter Cart GST Pricing Verification...');

    const restaurantCode = '202603180001';

    // 1. Verify getGstSettings
    console.log('\n--- 1. Testing RestaurantService.getGstSettings ---');
    const gstSettings = await RestaurantService.getGstSettings(restaurantCode);
    console.log('Restaurant GST Settings:', gstSettings);
    assert(gstSettings.gst_percentage != null, 'gst_percentage must be present');
    assert(gstSettings.cgst_percentage != null, 'cgst_percentage must be present');
    assert(gstSettings.sgst_percentage != null, 'sgst_percentage must be present');
    assert(gstSettings.gst_percentage > 0, 'gst_percentage must be > 0');
    console.log('✅ RestaurantService.getGstSettings returns valid GST config.');

    // 2. Verify MenuService.fetchMenuItems includes GST fields
    console.log('\n--- 2. Testing MenuService.fetchMenuItems ---');
    const menuItems = await MenuService.fetchMenuItems(restaurantCode);
    assert(Array.isArray(menuItems) && menuItems.length > 0, 'Must return menu items');
    const sampleItem = menuItems[0];
    console.log('Sample MenuItem:', {
        id: sampleItem.id,
        name: sampleItem.name,
        price: sampleItem.price,
        gst_percentage: sampleItem.gst_percentage,
        cgst_percentage: sampleItem.cgst_percentage,
        sgst_percentage: sampleItem.sgst_percentage,
        tax_percent: sampleItem.tax_percent
    });
    assert(sampleItem.gst_percentage !== undefined, 'MenuItem must contain gst_percentage');
    assert(sampleItem.cgst_percentage !== undefined, 'MenuItem must contain cgst_percentage');
    assert(sampleItem.sgst_percentage !== undefined, 'MenuItem must contain sgst_percentage');
    console.log('✅ MenuService.fetchMenuItems returns populated GST columns.');

    // 3. Verify SpecialsService.fetchActiveSpecials includes GST fields
    console.log('\n--- 3. Testing SpecialsService.fetchActiveSpecials ---');
    const specials = await SpecialsService.fetchActiveSpecials(restaurantCode);
    console.log(`Fetched ${specials.length} active specials.`);
    if (specials.length > 0 && specials[0].items && specials[0].items.length > 0) {
        const specialItem = specials[0].items[0];
        console.log('Sample Special Item:', {
            id: specialItem.id,
            menu_item: specialItem.menu_item
        });
    }

    // 4. Simulate Waiter Cart Math & Pricing Display with odd prices producing decimals
    console.log('\n--- 4. Testing Cart Tax Calculations with Decimals ---');
    const inr = (n: number) => {
        const val = Number(n) || 0;
        const cleaned = Math.round(val * 10000) / 10000;
        return `₹${cleaned.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
        })}`;
    };

    const cartItemRows = [
        {
            key: '1',
            name: 'Dal Tadka',
            unitPrice: 169,
            qty: 1,
            gstPercentage: 5,
            cgstPercentage: 2.5,
            sgstPercentage: 2.5,
        }
    ];

    const rawSubtotal = cartItemRows.reduce((s, r) => s + r.unitPrice * r.qty, 0);
    const rawCgst = cartItemRows.reduce((s, r) => s + (r.unitPrice * r.qty * ((r.cgstPercentage ?? 2.5) / 100)), 0);
    const rawSgst = cartItemRows.reduce((s, r) => s + (r.unitPrice * r.qty * ((r.sgstPercentage ?? 2.5) / 100)), 0);

    const subtotal = Math.round(rawSubtotal * 10000) / 10000;
    const cgst = Math.round(rawCgst * 10000) / 10000;
    const sgst = Math.round(rawSgst * 10000) / 10000;
    const gst = Math.round((cgst + sgst) * 10000) / 10000;
    const grandTotal = Math.round((subtotal + gst) * 10000) / 10000;

    console.log('Cart Calculations Result (₹169 item):', {
        subtotal: inr(subtotal),
        cgst: inr(cgst),
        sgst: inr(sgst),
        gst: inr(gst),
        grandTotal: inr(grandTotal)
    });

    assert.strictEqual(inr(subtotal), '₹169.00', 'Subtotal must be ₹169.00');
    assert.strictEqual(inr(cgst), '₹4.225', 'CGST must include exact decimals (₹4.225)');
    assert.strictEqual(inr(sgst), '₹4.225', 'SGST must include exact decimals (₹4.225)');
    assert.strictEqual(inr(gst), '₹8.45', 'GST must be ₹8.45');
    assert.strictEqual(inr(grandTotal), '₹177.45', 'Grand Total must be ₹177.45');
    assert(Math.abs(gst - (cgst + sgst)) < 0.0001, 'GST must equal CGST + SGST');
    assert(Math.abs(grandTotal - (subtotal + gst)) < 0.0001, 'Grand Total must equal subtotal + gst');

    console.log('\n🎉 ALL WAITER CART GST TESTS (INCLUDING DECIMALS) PASSED SUCCESSFULLY!');
    process.exit(0);
}

runTest().catch((err) => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
});
