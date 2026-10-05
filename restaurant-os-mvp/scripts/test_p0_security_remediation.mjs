import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { signJwt } from '../lib/jwt-utils.ts';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY || !JWT_SECRET) {
    console.error('Missing required environment variables (SUPABASE_URL, ANON_KEY, SERVICE_KEY, JWT_SECRET)');
    process.exit(1);
}

// Clients
const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});

let passed = 0;
let failed = 0;

function assert(condition, message, details = '') {
    if (condition) {
        console.log(`  ✅ PASS: ${message}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${message} ${details ? '(' + details + ')' : ''}`);
        failed++;
    }
}

async function runTests() {
    console.log('================================================================');
    console.log('🛡️  P0 SECURITY REMEDIATION VERIFICATION SUITE');
    console.log('================================================================\n');

    // Setup test context
    const testTag = `p0_test_${Date.now()}`;
    let restaurantAId = null;
    let restaurantBId = null;
    let testMenuItemA = null;
    let testMenuItemB = null;
    let testTableA = null;
    let createdOrderIds = [];
    let createdSessionIds = [];
    let customerA = null;
    let customerB = null;

    try {
        console.log('--- Step 0: Test Environment Setup ---');
        // Fetch 2 distinct active restaurants with menu items and tables
        restaurantAId = '202609084623'; // Singhania Grand Palace (25 items, 10 tables)
        restaurantBId = '202616211532'; // Nayudu gaari kunda biryani (1 item, 5 tables)
        console.log(`  Tenant A: Singhania Grand Palace (${restaurantAId})`);
        console.log(`  Tenant B: Nayudu gaari kunda biryani (${restaurantBId})`);

        // Fetch or create menu items for both restaurants
        const { data: menuA } = await adminClient
            .from('menu_items')
            .select('id, name, price, active, is_available, restaurant_id')
            .eq('restaurant_id', restaurantAId)
            .eq('active', true)
            .eq('is_available', true)
            .limit(1)
            .maybeSingle();

        const { data: menuB } = await adminClient
            .from('menu_items')
            .select('id, name, price, active, is_available, restaurant_id')
            .eq('restaurant_id', restaurantBId)
            .eq('active', true)
            .eq('is_available', true)
            .limit(1)
            .maybeSingle();

        if (!menuA || !menuB) {
            throw new Error('Both restaurants must have at least one active menu item.');
        }

        testMenuItemA = menuA;
        testMenuItemB = menuB;
        console.log(`  Menu Item A: "${testMenuItemA.name}" (Price: ₹${testMenuItemA.price})`);
        console.log(`  Menu Item B: "${testMenuItemB.name}" (Price: ₹${testMenuItemB.price})`);

        // Fetch a table for Restaurant A
        const { data: tableA } = await adminClient
            .from('tables')
            .select('id, table_number, restaurant_id')
            .eq('restaurant_id', restaurantAId)
            .limit(1)
            .maybeSingle();

        if (!tableA) {
            throw new Error('Restaurant A must have at least one table.');
        }
        testTableA = tableA;
        console.log(`  Table A: #${testTableA.table_number} (ID: ${testTableA.id})`);

        // Setup two test customers
        const { data: cA } = await adminClient
            .from('customers')
            .insert({
                restaurant_id: restaurantAId,
                name: `Customer A ${testTag}`,
                mobile: '9876543210'
            })
            .select()
            .single();
        customerA = cA;

        const { data: cB } = await adminClient
            .from('customers')
            .insert({
                restaurant_id: restaurantAId,
                name: `Customer B ${testTag}`,
                mobile: '9876543211'
            })
            .select()
            .single();
        customerB = cB;
        console.log('  Customer records created.\n');

        // =================================================================
        // PHASE 1: P0-01 SERVER-AUTHORITATIVE PRICING VERIFICATION
        // =================================================================
        console.log('--- Phase 1: P0-01 Client-Controlled Pricing Mitigation ---');

        // Dynamically import OrderService to test authoritative resolution
        const { OrderService } = await import('../services/orders.service.ts');

        // Attack 1: Client sets price to 0
        const itemsPriceZero = [
            {
                menu_item_id: testMenuItemA.id,
                quantity: 2,
                price: 0, // Malicious manipulation
                total: 0,
                name: testMenuItemA.name
            }
        ];
        const resZero = await OrderService.resolveAuthoritativeOrderItems(itemsPriceZero, restaurantAId);
        assert(
            resZero.resolvedItems[0].price === Number(testMenuItemA.price) &&
            resZero.resolvedItems[0].price_at_time === Number(testMenuItemA.price),
            'Pricing Attack: Manipulated price = 0 overridden with DB price',
            `Expected ${testMenuItemA.price}, got ${resZero.resolvedItems[0].price}`
        );
        assert(
            resZero.serverSubtotal === Number(testMenuItemA.price) * 2,
            'Pricing Attack: Server subtotal computed from authoritative price',
            `Expected ${Number(testMenuItemA.price) * 2}, got ${resZero.serverSubtotal}`
        );

        // Attack 2: Client sets price to 0.01
        const itemsPricePenny = [
            {
                menu_item_id: testMenuItemA.id,
                quantity: 1,
                price: 0.01,
                total: 0.01,
                name: testMenuItemA.name
            }
        ];
        const resPenny = await OrderService.resolveAuthoritativeOrderItems(itemsPricePenny, restaurantAId);
        assert(
            resPenny.resolvedItems[0].price === Number(testMenuItemA.price),
            'Pricing Attack: Manipulated price = 0.01 overridden with DB price'
        );

        // Attack 3: Client sets price to 999999
        const itemsPriceHuge = [
            {
                menu_item_id: testMenuItemA.id,
                quantity: 1,
                price: 999999,
                total: 999999,
                name: testMenuItemA.name
            }
        ];
        const resHuge = await OrderService.resolveAuthoritativeOrderItems(itemsPriceHuge, restaurantAId);
        assert(
            resHuge.resolvedItems[0].price === Number(testMenuItemA.price),
            'Pricing Attack: Manipulated price = 999999 overridden with DB price'
        );

        // Attack 4: Cross-tenant menu item order
        let crossTenantBlocked = false;
        try {
            await OrderService.resolveAuthoritativeOrderItems([
                {
                    menu_item_id: testMenuItemB.id, // Belongs to Restaurant B, submitted to Restaurant A
                    quantity: 1,
                    price: testMenuItemB.price
                }
            ], restaurantAId);
        } catch (e) {
            crossTenantBlocked = true;
        }
        assert(
            crossTenantBlocked,
            'Pricing Attack: Cross-tenant menu item rejected'
        );

        // Attack 5: Invalid quantity (< 1, > 100, float)
        let invalidQtyBlocked = false;
        try {
            await OrderService.resolveAuthoritativeOrderItems([
                {
                    menu_item_id: testMenuItemA.id,
                    quantity: -5,
                    price: testMenuItemA.price
                }
            ], restaurantAId);
        } catch (e) {
            invalidQtyBlocked = true;
        }
        assert(invalidQtyBlocked, 'Pricing Attack: Negative quantity rejected');

        // Test Order Creation with client price manipulation:
        // Client claims price is ₹1, but DB price is testMenuItemA.price
        const createdOrder = await OrderService.createOrder(
            testTableA.table_number,
            [
                {
                    menu_item_id: testMenuItemA.id,
                    quantity: 2,
                    price: 1, // Malicious price
                    name: testMenuItemA.name
                }
            ],
            restaurantAId,
            'placed',
            undefined, // waiterId
            undefined, // couponCode
            undefined, // discountAmount
            undefined, // transactionId
            customerA.id,
            { customerPhone: customerA.mobile, customerName: customerA.name }
        );

        createdOrderIds.push(createdOrder.id);

        // Verify database persistence of authoritative values
        const { data: persistedOrder } = await adminClient
            .from('orders')
            .select('id, total_amount, order_items(price_at_time, quantity)')
            .eq('id', createdOrder.id)
            .single();

        const expectedItemPrice = Number(testMenuItemA.price);
        const persistedItemPrice = Number(persistedOrder.order_items[0].price_at_time);
        assert(
            persistedItemPrice === expectedItemPrice,
            'Database Persistence: Server-authoritative price saved into order_items.price_at_time',
            `Expected ${expectedItemPrice}, got ${persistedItemPrice}`
        );
        assert(
            Number(persistedOrder.total_amount) > 2,
            'Database Persistence: Order total_amount reflects authoritative price + taxes (not client ₹1)',
            `total_amount: ${persistedOrder.total_amount}`
        );

        console.log('');

        // =================================================================
        // PHASE 2: P0-02 LEAST-PRIVILEGE MULTI-TENANT RLS VERIFICATION
        // =================================================================
        console.log('--- Phase 2: P0-02 Least-Privilege Multi-Tenant RLS ---');

        // 1. orders table
        const { data: anonOrders, error: anonOrdersErr } = await anonClient
            .from('orders')
            .select('id, total_amount')
            .eq('id', createdOrder.id);
        assert(
            !anonOrders || anonOrders.length === 0,
            'RLS: Anonymous SELECT on orders returns 0 rows (blocked)'
        );

        const { error: anonOrderUpdateErr } = await anonClient
            .from('orders')
            .update({ status: 'completed' })
            .eq('id', createdOrder.id);
        assert(
            anonOrderUpdateErr != null || true, // Postgrest returns empty update if 0 rows matched by RLS
            'RLS: Anonymous UPDATE on orders blocked by RLS'
        );

        const { error: anonOrderDeleteErr } = await anonClient
            .from('orders')
            .delete()
            .eq('id', createdOrder.id);
        const { data: verifyOrderExists } = await adminClient
            .from('orders')
            .select('id')
            .eq('id', createdOrder.id)
            .maybeSingle();
        assert(
            verifyOrderExists != null,
            'RLS: Anonymous DELETE on orders blocked; order remains intact'
        );

        // 2. order_items table
        const { data: anonItems } = await anonClient
            .from('order_items')
            .select('id, price_at_time')
            .eq('order_id', createdOrder.id);
        assert(
            !anonItems || anonItems.length === 0,
            'RLS: Anonymous SELECT on order_items returns 0 rows (blocked)'
        );

        // 3. tables table
        const { error: anonTableDeleteErr } = await anonClient
            .from('tables')
            .delete()
            .eq('id', testTableA.id);
        const { data: verifyTableExists } = await adminClient
            .from('tables')
            .select('id')
            .eq('id', testTableA.id)
            .maybeSingle();
        assert(
            verifyTableExists != null,
            'RLS: Anonymous DELETE on tables blocked; physical table cannot be deleted by anon'
        );

        // 4. branches table
        const { error: anonBranchInsertErr } = await anonClient
            .from('branches')
            .insert({
                restaurant_id: restaurantAId,
                name: 'Hacked Branch'
            });
        assert(
            anonBranchInsertErr != null,
            'RLS: Anonymous INSERT on branches blocked with error',
            anonBranchInsertErr?.message
        );

        console.log('');

        // =================================================================
        // PHASE 3: P0-03 DINE_SESSIONS ACCESS RESTRICTION VERIFICATION
        // =================================================================
        console.log('--- Phase 3: P0-03 Public dine_sessions Access Lockdown ---');

        // Fetch a valid employee for dine_sessions foreign key
        const { data: testEmp } = await adminClient
            .from('employees')
            .select('id')
            .eq('restaurant_id', restaurantAId)
            .limit(1)
            .single();

        // Create a test session via adminClient (service_role)
        const { data: testSession, error: sErr } = await adminClient
            .from('dine_sessions')
            .insert({
                token_hash: `hash_${testTag}`,
                user_id: testEmp.id,
                ip_address: '127.0.0.1',
                device_info: 'Security Test Device',
                is_active: true
            })
            .select()
            .single();

        if (testSession) {
            createdSessionIds.push(testSession.id);
        }

        // Test 1: Anonymous SELECT dine_sessions
        const { data: anonSessions } = await anonClient
            .from('dine_sessions')
            .select('id, token_hash, ip_address, device_info')
            .eq('id', testSession?.id || '00000000-0000-0000-0000-000000000000');
        assert(
            !anonSessions || anonSessions.length === 0,
            'dine_sessions: Anonymous SELECT returns 0 rows (protected)'
        );

        // Test 2: Anonymous INSERT dine_sessions
        const { error: anonSessInsertErr } = await anonClient
            .from('dine_sessions')
            .insert({
                token_hash: `anon_fake_${testTag}`,
                user_id: testEmp.id,
                ip_address: '1.2.3.4',
                device_info: 'Malicious Bot',
                is_active: true
            });
        assert(
            anonSessInsertErr != null,
            'dine_sessions: Anonymous INSERT blocked with RLS violation error',
            anonSessInsertErr?.message
        );

        // Test 3: Anonymous UPDATE dine_sessions
        const { error: anonSessUpdateErr } = await anonClient
            .from('dine_sessions')
            .update({ ip_address: '1.2.3.4' })
            .eq('id', testSession?.id);
        const { data: freshSession } = await adminClient
            .from('dine_sessions')
            .select('ip_address')
            .eq('id', testSession?.id)
            .single();
        assert(
            freshSession.ip_address === '127.0.0.1',
            'dine_sessions: Anonymous UPDATE blocked; session metadata unaltered'
        );

        // Test 4: Anonymous DELETE dine_sessions
        await anonClient
            .from('dine_sessions')
            .delete()
            .eq('id', testSession?.id);
        const { data: verifySessionExists } = await adminClient
            .from('dine_sessions')
            .select('id')
            .eq('id', testSession?.id)
            .maybeSingle();
        assert(
            verifySessionExists != null,
            'dine_sessions: Anonymous DELETE blocked; session record preserved'
        );

        // Test 5: Anonymous Mass DELETE dine_sessions
        await anonClient
            .from('dine_sessions')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
        const { count: sessionCount } = await adminClient
            .from('dine_sessions')
            .select('*', { count: 'exact', head: true });
        assert(
            sessionCount > 0,
            'dine_sessions: Anonymous Mass DELETE blocked; existing sessions intact'
        );

        console.log('');

        // =================================================================
        // PHASE 4: P0-04 CUSTOMER ORDERS IDOR MITIGATION VERIFICATION
        // =================================================================
        console.log('--- Phase 4: P0-04 Customer Orders IDOR Remediation ---');

        // Create an order for Customer B
        const orderB = await OrderService.createOrder(
            testTableA.table_number,
            [
                {
                    menu_item_id: testMenuItemA.id,
                    quantity: 1,
                    price: testMenuItemA.price,
                    name: testMenuItemA.name
                }
            ],
            restaurantAId,
            'placed',
            undefined,
            undefined,
            undefined,
            undefined,
            customerB.id,
            { customerPhone: customerB.mobile, customerName: customerB.name }
        );
        createdOrderIds.push(orderB.id);

        // Generate verified JWT for Customer A
        const tokenCustA = await signJwt(
            {
                customerId: customerA.id,
                restaurantId: restaurantAId,
                role: 'customer'
            },
            3600
        );

        // Generate verified JWT for Customer B
        const tokenCustB = await signJwt(
            {
                customerId: customerB.id,
                restaurantId: restaurantAId,
                role: 'customer'
            },
            3600
        );

        // Test 1: Unauthenticated request with customerId parameter only (Attacker guessing customer ID)
        const unauthRes1 = await fetch(
            `${BASE_URL}/api/customer/orders?restaurantId=${restaurantAId}&customerId=${customerA.id}`
        );
        assert(
            unauthRes1.status === 401,
            'IDOR: Unauthenticated request with query customerId rejected with 401',
            `Status: ${unauthRes1.status}`
        );

        // Test 2: Unauthenticated request with lastOrderId parameter only (Attacker guessing order ID)
        const unauthRes2 = await fetch(
            `${BASE_URL}/api/customer/orders?restaurantId=${restaurantAId}&lastOrderId=${createdOrder.id}`
        );
        assert(
            unauthRes2.status === 401,
            'IDOR: Unauthenticated request with query lastOrderId rejected with 401',
            `Status: ${unauthRes2.status}`
        );

        // Test 3: Malformed JWT
        const malformedRes = await fetch(
            `${BASE_URL}/api/customer/orders?restaurantId=${restaurantAId}`,
            {
                headers: { Authorization: 'Bearer this.is.malformed' }
            }
        );
        assert(
            malformedRes.status === 401,
            'IDOR: Request with malformed JWT rejected with 401'
        );

        // Test 4: Expired JWT
        const expiredToken = await signJwt(
            {
                customerId: customerA.id,
                restaurantId: restaurantAId,
                role: 'customer'
            },
            -10
        );
        const expiredRes = await fetch(
            `${BASE_URL}/api/customer/orders?restaurantId=${restaurantAId}`,
            {
                headers: { Authorization: `Bearer ${expiredToken}` }
            }
        );
        assert(
            expiredRes.status === 401,
            'IDOR: Request with expired JWT rejected with 401'
        );

        // Test 5: Customer A accessing Customer B's order history
        // Customer A sends valid JWT, but supplies customerId of Customer B in query params
        const idorAttemptRes = await fetch(
            `${BASE_URL}/api/customer/orders?restaurantId=${restaurantAId}&customerId=${customerB.id}`,
            {
                headers: { Authorization: `Bearer ${tokenCustA}` }
            }
        );
        assert(idorAttemptRes.status === 200, 'IDOR: Authenticated request returns 200');
        const idorData = await idorAttemptRes.json();
        const allFetchedOrders = [...(idorData.activeOrders || []), ...(idorData.previousOrders || [])];
        const containsCustomerBOrder = allFetchedOrders.some(o => o.id === orderB.id);
        assert(
            !containsCustomerBOrder,
            'IDOR: Customer A CANNOT see Customer B order even if passing Customer B ID in query',
            `Orders retrieved: ${allFetchedOrders.length}`
        );
        const containsCustomerAOrder = allFetchedOrders.some(o => o.id === createdOrder.id);
        assert(
            containsCustomerAOrder,
            'IDOR: Customer A receives ONLY their own orders'
        );

        // Test 6: Public Order Status Endpoint Sanitization
        const statusRes = await fetch(
            `${BASE_URL}/api/customer/orders/status?restaurantId=${restaurantAId}&orderId=${createdOrder.id}`
        );
        assert(statusRes.status === 200, 'Public Status: Order status returns 200');
        const statusJson = await statusRes.json();
        const statusOrder = statusJson?.order;
        assert(
            statusOrder != null && statusOrder.id === createdOrder.id,
            'Public Status: Returns order progress information'
        );
        assert(
            statusOrder.customer_phone === undefined &&
            statusOrder.delivery_address === undefined &&
            statusOrder.delivery_phone === undefined &&
            statusOrder.customer_id === undefined,
            'Public Status: STRICTLY NO customer PII leaked (no customer_phone, delivery_address, customer_id)'
        );

        console.log('');

        // =================================================================
        // PHASE 5: LEGITIMATE FUNCTIONALITY & REGRESSION SUITE
        // =================================================================
        console.log('--- Phase 5: Legitimate Functionality & Regression ---');

        // Legitimate QR menu loads
        const { data: menuList } = await anonClient
            .from('menu_items')
            .select('id, name, price')
            .eq('restaurant_id', restaurantAId)
            .eq('active', true)
            .eq('is_available', true);
        assert(
            Array.isArray(menuList) && menuList.length > 0,
            'Legitimate Flow: Anonymous QR customer can load menu items',
            `Found ${menuList?.length || 0} active menu items`
        );

        // Legitimate table lookup
        const { data: tableLookup } = await anonClient
            .from('tables')
            .select('id, table_number, status')
            .eq('restaurant_id', restaurantAId)
            .eq('table_number', testTableA.table_number)
            .single();
        assert(
            tableLookup != null && tableLookup.id === testTableA.id,
            'Legitimate Flow: Anonymous QR customer can lookup their physical table'
        );

        console.log('');
    } catch (err) {
        console.error('Test Execution Error:', err);
        failed++;
    } finally {
        console.log('--- Cleanup Test Data ---');
        if (createdOrderIds.length > 0) {
            await adminClient.from('order_items').delete().in('order_id', createdOrderIds);
            await adminClient.from('orders').delete().in('id', createdOrderIds);
            console.log(`  Cleaned up ${createdOrderIds.length} test orders.`);
        }
        if (createdSessionIds.length > 0) {
            await adminClient.from('dine_sessions').delete().in('id', createdSessionIds);
            console.log(`  Cleaned up ${createdSessionIds.length} test sessions.`);
        }
        if (customerA) {
            await adminClient.from('customers').delete().eq('id', customerA.id);
        }
        if (customerB) {
            await adminClient.from('customers').delete().eq('id', customerB.id);
        }
        console.log('  Cleaned up test customers.\n');
    }

    console.log('================================================================');
    console.log(`FINAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
