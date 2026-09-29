import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { OrderService } from '../services/orders.service';
import { isComboItem, parseComboSubItems } from '../lib/combo-utils';
import { getCategoryMenuItemImage } from '../lib/utils';

async function main() {
    console.log('🧪 Starting Combo Display Verification Test...\n');

    const testRestaurant = '202603180001';

    // 1. Test parsing of raw sample combos (like the ones in DB)
    const sampleComboItem = {
        id: 'test-combo-1',
        item_type: 'combo',
        name: 'Super Lunch',
        combo_name: 'Super Lunch',
        combo_image: 'https://pub-fc925b324e51441ba1d8aef9ee47e211.r2.dev/restaurants/202603180001/menu/1778932794855-1778932794855.webp',
        price: 2499,
        quantity: 2,
        combo_items: [
            {
                name: 'Sweet Corn Veg Soup',
                price: 130,
                quantity: 1,
                image_url: 'https://pub-fc925b324e51441ba1d8aef9ee47e211.r2.dev/restaurants/202603180001/menu/sweet-corn-veg-soup.jpeg',
                item_type: 'Veg',
                menu_item_id: 2
            },
            {
                name: 'Butter Chicken',
                price: 320,
                quantity: 1,
                image_url: null, // should test fallback
                item_type: 'Non-Veg',
                menu_item_id: 47
            },
            {
                name: 'Butter Naan',
                price: 50,
                quantity: 3,
                image_url: '', // should test fallback
                item_type: 'Veg',
                menu_item_id: 79
            }
        ]
    };

    console.log('1. Testing isComboItem on sample item...');
    const isCombo = isComboItem(sampleComboItem);
    if (!isCombo) {
        console.error('❌ Failed: isComboItem returned false for combo item');
        process.exit(1);
    }
    console.log('✅ isComboItem detected combo successfully.');

    console.log('\n2. Testing parseComboSubItems...');
    const subItems = parseComboSubItems(sampleComboItem);
    if (subItems.length !== 3) {
        console.error(`❌ Failed: Expected 3 sub-items, got ${subItems.length}`);
        process.exit(1);
    }

    subItems.forEach((sub, i) => {
        console.log(`   Sub-item [${i}]: ${sub.name} (qty: ${sub.quantity}) [${sub.item_type}] - Price: ₹${sub.price}`);
        console.log(`     Image: ${sub.image_url}`);
        if (!sub.image_url) {
            console.error(`❌ Failed: Sub-item ${sub.name} missing image URL!`);
            process.exit(1);
        }
        if (sub.price == null || sub.price <= 0) {
            console.error(`❌ Failed: Sub-item ${sub.name} missing individual price!`);
            process.exit(1);
        }
        const effectiveQty = sub.quantity * sampleComboItem.quantity;
        if (sub.name === 'Butter Naan' && effectiveQty !== 6) {
            console.error(`❌ Failed: Expected 6 Butter Naan for 2x combo, got ${effectiveQty}`);
            process.exit(1);
        }
    });
    console.log('✅ parseComboSubItems correctly parsed constituent items, individual prices, resolved fallback images, and calculated portions.');

    // 2b. Test enrichComboSubItemsWithMenu
    console.log('\n2b. Testing enrichComboSubItemsWithMenu...');
    const { enrichComboSubItemsWithMenu } = await import('../lib/combo-utils');
    const mockMenuItems = [
        { id: 2, name: 'Sweet Corn Veg Soup', price: 130, image_url: 'soup.jpg', item_type: 'Veg' },
        { id: 47, name: 'Butter Chicken', price: 320, image_url: 'chicken.jpg', item_type: 'Non-Veg' }
    ];
    const unpricedSubs = [
        { name: 'Sweet Corn Veg Soup', quantity: 1 },
        { name: 'Butter Chicken', quantity: 2, menu_item_id: 47 }
    ];
    const enrichedSubs = enrichComboSubItemsWithMenu(unpricedSubs, mockMenuItems);
    if (enrichedSubs[0].price !== 130 || enrichedSubs[1].price !== 320) {
        console.error('❌ Failed: enrichComboSubItemsWithMenu did not populate individual prices', enrichedSubs);
        process.exit(1);
    }
    console.log(`✅ enrichComboSubItemsWithMenu populated individual prices: ₹${enrichedSubs[0].price}, ₹${enrichedSubs[1].price}`);

    // 3. Test stringified JSON combo_items parsing
    console.log('\n3. Testing stringified combo_items payload...');
    const stringifiedItem = {
        item_type: 'combo',
        name: 'String Combo',
        combo_items: JSON.stringify([
            { name: 'Paneer Tikka', quantity: 1, price: 220 }
        ])
    };
    const stringifiedParsed = parseComboSubItems(stringifiedItem);
    if (stringifiedParsed.length !== 1 || stringifiedParsed[0].name !== 'Paneer Tikka' || stringifiedParsed[0].price !== 220 || !stringifiedParsed[0].image_url) {
        console.error('❌ Failed: stringified combo_items parsing failed', stringifiedParsed);
        process.exit(1);
    }
    console.log(`✅ Stringified combo_items successfully parsed with individual price ₹${stringifiedParsed[0].price} and image: ${stringifiedParsed[0].image_url}`);

    // 4. Test database order retrieval via OrderService
    console.log('\n4. Testing OrderService.fetchActiveOrders for restaurant:', testRestaurant);
    const activeOrders = await OrderService.fetchActiveOrders(testRestaurant);
    console.log(`   Found ${activeOrders.length} active orders.`);

    // Find any order with combos or create/simulate
    let foundCombo = false;
    for (const order of activeOrders) {
        for (const item of order.items || []) {
            if (isComboItem(item)) {
                foundCombo = true;
                const subs = parseComboSubItems(item);
                console.log(`   Active Order #${order.id} has combo: "${item.name}" with ${subs.length} constituent items.`);
                subs.forEach(s => {
                    console.log(`     - ${s.name} x${s.quantity * item.quantity} (img: ${s.image_url ? 'YES' : 'NO'})`);
                });
            }
        }
    }
    if (!foundCombo) {
        console.log('   (No active order currently has a combo in DB right now, but parsing & service pipeline are verified)');
    }

    console.log('\n🎉 ALL COMBO TESTS PASSED SUCCESSFULLY!');
}

main().catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
});
