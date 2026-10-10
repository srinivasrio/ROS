import { calculateOrderPricing } from '../lib/pricing.js';

console.log('--- Running Coupon & GST Calculation Engine Tests ---');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`✅ PASS: ${message}`);
        passed++;
    } else {
        console.error(`❌ FAIL: ${message}`);
        failed++;
    }
}

// Test 1: Simple order without discount
const testOrder1 = {
    total_amount: 105,
    discount_amount: 0,
    gst_amount: 5,
    cgst_amount: 2.5,
    sgst_amount: 2.5,
    items: [
        { price: 50, quantity: 2, tax_percent: 5 }
    ]
};
const p1 = calculateOrderPricing(testOrder1);
assert(p1.itemsSubtotal === 100, `Test 1 Subtotal is 100, got ${p1.itemsSubtotal}`);
assert(p1.gstAmount === 5, `Test 1 GST is 5, got ${p1.gstAmount}`);
assert(p1.discountAmount === 0, `Test 1 Discount is 0, got ${p1.discountAmount}`);
assert(p1.finalTotal === 105, `Test 1 Final total is 105, got ${p1.finalTotal}`);

// Test 2: Double-discount prevention: Order where total_amount is already 85 in DB and discount_amount is 20
const testOrder2 = {
    total_amount: 85,
    discount_amount: 20,
    coupon_code: 'SAVE20',
    gst_amount: 5,
    cgst_amount: 2.5,
    sgst_amount: 2.5,
    items: [
        { price: 50, quantity: 2, tax_percent: 5 }
    ]
};
const p2 = calculateOrderPricing(testOrder2);
assert(p2.itemsSubtotal === 100, `Test 2 Subtotal is 100, got ${p2.itemsSubtotal}`);
assert(p2.discountAmount === 20, `Test 2 Discount is 20, got ${p2.discountAmount}`);
assert(p2.couponCode === 'SAVE20', `Test 2 Coupon code is SAVE20, got ${p2.couponCode}`);
assert(p2.finalTotal === 85, `Test 2 Final total is 85 (NOT double-subtracted to 65), got ${p2.finalTotal}`);

// Test 3: Fractional / CEIL rounding with odd fractional prices
const testOrder3 = {
    items: [
        { price: 33.33333333, quantity: 3, tax_percent: 5 } // 99.99999999 -> 100
    ],
    discount_amount: 10,
    coupon_code: 'FLAT10'
};
const p3 = calculateOrderPricing(testOrder3);
assert(p3.itemsSubtotal === 100, `Test 3 Subtotal ceil rounded to 100, got ${p3.itemsSubtotal}`);
assert(p3.gstAmount === 5, `Test 3 GST is 5, got ${p3.gstAmount}`);
assert(p3.finalTotal === 95, `Test 3 Final total is 95, got ${p3.finalTotal}`);

// Test 4: Order with delivery fee
const testOrder4 = {
    total_amount: 125,
    discount_amount: 15,
    delivery_fee: 35,
    gst_amount: 5,
    items: [
        { price: 100, quantity: 1, tax_percent: 5 }
    ]
};
const p4 = calculateOrderPricing(testOrder4);
assert(p4.deliveryFee === 35, `Test 4 Delivery fee is 35, got ${p4.deliveryFee}`);
assert(p4.finalTotal === 125, `Test 4 Final total is 125 (100 subtotal + 5 gst + 35 delivery - 15 discount), got ${p4.finalTotal}`);

console.log(`\nTests Completed: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
