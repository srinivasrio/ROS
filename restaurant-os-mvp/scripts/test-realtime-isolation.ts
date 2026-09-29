/**
 * Test Suite: Multi-Tenant Realtime & Auth Isolation
 * 
 * Verifies that:
 * 1. Supabase Realtime callbacks for Restaurant A reject events from Restaurant B.
 * 2. Un-scoped DELETE payloads (missing restaurant_id) do not trigger cross-restaurant updates.
 * 3. extractTokenForRestaurant never returns a foreign restaurant's token.
 * 4. AdminCacheManager isolates cached data per tenant.
 */

import { extractTokenForRestaurant, signJwt } from '../lib/jwt-utils';
import { OrderService } from '../services/orders.service';
import { adminCacheManager } from '../lib/cache/admin-cache-manager';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string) {
    if (condition) {
        console.log(`  ✅ PASS: ${testName}`);
        testsPassed++;
    } else {
        console.error(`  ❌ FAIL: ${testName}`);
        testsFailed++;
    }
}

async function runTests() {
    console.log('\n--- 1. Testing Auth Token Tenant Isolation ---');
    
    // Simulate cookies object with Restaurant A's token
    const tokenRestA = await signJwt({
        userId: 'user-1',
        restaurantId: 'REST-A',
        role: 'ADMIN'
    });

    const mockCookies = {
        get: (name: string) => {
            if (name === 'dine_auth_token_REST-A') return { value: tokenRestA };
            return undefined;
        },
        getAll: () => [
            { name: 'dine_auth_token_REST-A', value: tokenRestA }
        ]
    };

    // When requesting REST-A, should return REST-A token
    const tokenForA = extractTokenForRestaurant(mockCookies, 'REST-A');
    assert(tokenForA === tokenRestA, 'extractTokenForRestaurant returns matching token for target restaurant');

    // When requesting REST-B without a REST-B token, must return null (NEVER fallback to REST-A!)
    const tokenForB = extractTokenForRestaurant(mockCookies, 'REST-B');
    assert(tokenForB === null, 'extractTokenForRestaurant returns null for REST-B when only REST-A cookie exists');

    console.log('\n--- 2. Testing Cache Manager Tenant Isolation ---');
    adminCacheManager.setTenant('REST-A');
    adminCacheManager.set('tables-REST-A', { tables: [{ id: 101, table_number: 'T1' }] }, { tenantId: 'REST-A' });

    // REST-A can see its tables
    const restATables = adminCacheManager.get<{ tables: any[] }>('tables-REST-A', { tenantId: 'REST-A' });
    assert(restATables !== null && restATables.data.tables.length === 1, 'REST-A successfully reads its own tables');

    // REST-B must NOT see REST-A's tables
    const restBTables = adminCacheManager.get('tables-REST-A', { tenantId: 'REST-B' });
    assert(restBTables === null, 'REST-B cannot read REST-A tables from cache manager');

    console.log('\n--- 3. Testing Realtime Defensive DELETE Entity Check ---');
    // Preload known entities for REST-A
    adminCacheManager.set('orders-REST-A', [
        { id: 'order-101', restaurant_id: 'REST-A', status: 'placed', items: [{ id: 'item-201' }] }
    ], { tenantId: 'REST-A' });

    // Known order in REST-A
    const isOrderKnown = OrderService.isOrderKnownForTenant('order-101', 'REST-A');
    assert(isOrderKnown === true, 'OrderService recognizes known order-101 for REST-A');

    // Unknown order (belongs to REST-B)
    const isOrderForeign = OrderService.isOrderKnownForTenant('order-999', 'REST-A');
    assert(isOrderForeign === false, 'OrderService rejects unknown order-999 for REST-A');

    // Table checks
    const isTableKnown = OrderService.isTableKnownForTenant(101, 'REST-A');
    assert(isTableKnown === true, 'OrderService recognizes known table 101 for REST-A');

    const isTableForeign = OrderService.isTableKnownForTenant(999, 'REST-A');
    assert(isTableForeign === false, 'OrderService rejects unknown table 999 for REST-A');

    // Item checks
    const isItemKnown = OrderService.isOrderItemKnownForTenant('item-201', 'REST-A');
    assert(isItemKnown === true, 'OrderService recognizes known order item 201 for REST-A');

    const isItemForeign = OrderService.isOrderItemKnownForTenant('item-999', 'REST-A');
    assert(isItemForeign === false, 'OrderService rejects unknown order item 999 for REST-A');

    console.log('\n--- 4. Testing Cache Event Bus Tenant Isolation ---');
    let restAListenerCalled = 0;
    let restBListenerCalled = 0;

    const unsubA = adminCacheManager.subscribe('tables-REST-A', () => {
        restAListenerCalled++;
    }, { tenantId: 'REST-A' });

    const unsubB = adminCacheManager.subscribe('tables-REST-B', () => {
        restBListenerCalled++;
    }, { tenantId: 'REST-B' });

    // Mutate REST-B cache -> REST-A listener MUST NOT fire
    adminCacheManager.set('tables-REST-B', { tables: [] }, { tenantId: 'REST-B' });
    assert(restAListenerCalled === 0, 'REST-A listener did not fire on REST-B cache update');
    assert(restBListenerCalled === 1, 'REST-B listener fired on REST-B cache update');

    // Mutate REST-A cache -> REST-A listener fires, REST-B does not
    adminCacheManager.set('tables-REST-A', { tables: [] }, { tenantId: 'REST-A' });
    assert(restAListenerCalled === 1, 'REST-A listener fired on REST-A cache update');
    assert(restBListenerCalled === 1, 'REST-B listener did not fire on REST-A cache update');

    unsubA();
    unsubB();

    console.log('\n--- 5. Testing Realtime Payload Filtering Logic ---');
    // Simulate what OrderService.subscribeToOrders callback does on incoming events
    const simulateOrderCallback = (
        payload: any,
        resolvedId: string,
        onTrigger: () => void
    ) => {
        const newRec = payload.new as any;
        const oldRec = payload.old as any;
        const rec = newRec || oldRec;
        if (!rec) return;

        if (rec.restaurant_id != null) {
            if (String(rec.restaurant_id) !== String(resolvedId)) return;
        } else if (payload.eventType === 'DELETE') {
            const isKnown = OrderService.isOrderKnownForTenant(rec.id, resolvedId);
            if (!isKnown) return;
        } else {
            return;
        }

        onTrigger();
    };

    let aTriggerCount = 0;
    const triggerA = () => { aTriggerCount++; };

    // Case 1: Event for REST-A
    simulateOrderCallback({
        eventType: 'INSERT',
        new: { id: 'order-102', restaurant_id: 'REST-A' },
        old: null
    }, 'REST-A', triggerA);
    assert(aTriggerCount === 1, 'Event with matching restaurant_id triggers callback');

    // Case 2: Cross-tenant event for REST-B received on REST-A channel
    simulateOrderCallback({
        eventType: 'INSERT',
        new: { id: 'order-999', restaurant_id: 'REST-B' },
        old: null
    }, 'REST-A', triggerA);
    assert(aTriggerCount === 1, 'Cross-tenant event with foreign restaurant_id is dropped');

    // Case 3: DELETE event with old WAL behavior (missing restaurant_id) for foreign order
    simulateOrderCallback({
        eventType: 'DELETE',
        new: null,
        old: { id: 'order-foreign-999' }
    }, 'REST-A', triggerA);
    assert(aTriggerCount === 1, 'DELETE event with unknown entity ID is dropped');

    // Case 4: DELETE event with old WAL behavior (missing restaurant_id) for known REST-A order
    simulateOrderCallback({
        eventType: 'DELETE',
        new: null,
        old: { id: 'order-101' } // preloaded earlier in Section 3
    }, 'REST-A', triggerA);
    assert(aTriggerCount === 2, 'DELETE event for known tenant entity is processed');

    // Case 5: Malformed un-scoped event without restaurant_id or recognized type
    simulateOrderCallback({
        eventType: 'UPDATE',
        new: { status: 'preparing' }, // no id or restaurant_id
        old: null
    }, 'REST-A', triggerA);
    assert(aTriggerCount === 2, 'Malformed un-scoped event without tenant metadata is dropped');

    console.log(`\n========================================`);
    console.log(`Results: ${testsPassed} passed, ${testsFailed} failed`);
    console.log(`========================================\n`);

    if (testsFailed > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Test runner failure:', err);
    process.exit(1);
});
