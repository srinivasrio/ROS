import assert from 'assert';
import fs from 'fs';

console.log('Testing Waiter Cart and Order Now Button fixes...\n');

// 1. Verify BottomNav hides on /cart/
const bottomNavSrc = fs.readFileSync('app/[restaurantCode]/waiter/components/BottomNav.tsx', 'utf8');
assert(
    bottomNavSrc.includes("pathname.includes('/cart/')"),
    'BottomNav must check pathname.includes("/cart/") to hide on cart pages'
);
console.log('✅ PASS: BottomNav hides on cart pages, preventing overlay on Order Now button');

// 2. Verify Waiter Menu saves cartDetails and has View Cart & Order
const waiterMenuSrc = fs.readFileSync('app/[restaurantCode]/waiter/[staffMobile]/menu/[tableId]/page.tsx', 'utf8');
assert(
    waiterMenuSrc.includes('cartDetails'),
    'Waiter menu must store cartDetails in draft order for instantaneous cart loading'
);
assert(
    waiterMenuSrc.includes('View Cart & Order'),
    'Waiter menu floating bar must display "View Cart & Order"'
);
console.log('✅ PASS: Waiter Menu saves rich cartDetails and shows "View Cart & Order"');

// 3. Verify Waiter Cart page has Order Now button, prices, and buttons
const waiterCartSrc = fs.readFileSync('app/[restaurantCode]/waiter/[staffMobile]/cart/[tableId]/page.tsx', 'utf8');

// Check Order Now button
assert(
    waiterCartSrc.includes('Order Now (Send to Kitchen)'),
    'Waiter Cart must feature prominent "Order Now (Send to Kitchen)" button'
);
assert(
    waiterCartSrc.includes('id="order-now-btn"'),
    'Waiter Cart must have id="order-now-btn"'
);

// Check price breakdown & elements
assert(
    waiterCartSrc.includes('inr(r.unitPrice * r.qty)'),
    'Waiter Cart must show multiplied row item total (price * qty)'
);
assert(
    waiterCartSrc.includes('inr(r.unitPrice)') && waiterCartSrc.includes('each'),
    'Waiter Cart must show unit price'
);
assert(
    waiterCartSrc.includes('Item Subtotal') && waiterCartSrc.includes('inr(subtotal)'),
    'Waiter Cart must display Subtotal'
);
assert(
    waiterCartSrc.includes('GST') && waiterCartSrc.includes('inr(gst)'),
    'Waiter Cart must display GST'
);
assert(
    waiterCartSrc.includes('Grand Total') && waiterCartSrc.includes('inr(grandTotal)'),
    'Waiter Cart must display Grand Total'
);
assert(
    waiterCartSrc.includes('Total to Pay') || waiterCartSrc.includes('Total Amount'),
    'Waiter Cart footer must display total amount'
);

// Check action buttons
assert(
    waiterCartSrc.includes('Add More Dishes'),
    'Waiter Cart must have "Add More Dishes" button'
);
assert(
    waiterCartSrc.includes('Clear'),
    'Waiter Cart must have Clear Cart button'
);
assert(
    waiterCartSrc.includes('CustomizationSheet') && waiterCartSrc.includes('Add note'),
    'Waiter Cart must support Cooking Notes and Customization sheet'
);

// Check sticky positioning
assert(
    waiterCartSrc.includes('sticky bottom-0 z-50'),
    'Waiter Cart footer must be sticky at bottom with z-50'
);

console.log('✅ PASS: Waiter Cart has Order Now button, all prices, unit & row totals, tax breakdown, and all action buttons');

console.log('\nAll assertions passed successfully!');
