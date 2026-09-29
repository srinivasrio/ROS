import { supabaseAdmin } from '../lib/supabase-admin';
import { OrderService } from '../services/orders.service';

const BASE_URL = 'http://localhost:3000';
const RESTAURANT_ID = '202603180001';
const TABLE_NUMBER = '2';

async function runTests() {
    console.log('========================================================');
    console.log('CUSTOMER ORDER PERSISTENCE & HISTORY E2E TEST SUITE');
    console.log('========================================================\n');

    let createdOrderId: string | null = null;
    let customerAId: string | null = null;
    let customerACookie: string | null = null;

    try {
        // -------------------------------------------------------------------------
        // TEST 1: Customer A Registers / Logs In
        // -------------------------------------------------------------------------
        console.log('TEST 1: Customer A Logs In / Completes Profile');
        const phoneA = '9999911111';
        const nameA = 'Alice Persistence';

        const loginRes = await fetch(`${BASE_URL}/api/restaurant/${RESTAURANT_ID}/customers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: nameA, mobile: phoneA }),
        });

        if (!loginRes.ok) {
            throw new Error(`Login failed with status ${loginRes.status}: ${await loginRes.text()}`);
        }

        const loginData = await loginRes.json();
        customerAId = loginData.customerId;
        console.log(`✓ Customer A created/resolved with ID: ${customerAId}`);

        // Extract cookie
        const setCookieHeaders = loginRes.headers.getSetCookie 
            ? loginRes.headers.getSetCookie() 
            : [loginRes.headers.get('set-cookie') || ''];
        
        customerACookie = setCookieHeaders.map(c => c.split(';')[0]).join('; ');
        console.log(`✓ Customer A session cookie established.`);

        // Verify session endpoint
        const sessionRes = await fetch(`${BASE_URL}/api/customer/auth/session?restaurantId=${RESTAURANT_ID}`, {
            headers: { Cookie: customerACookie },
        });
        const sessionData = await sessionRes.json();
        if (!sessionData.authenticated || sessionData.customer?.id !== customerAId) {
            throw new Error(`Session verification failed: ${JSON.stringify(sessionData)}`);
        }
        console.log(`✓ TEST 1 PASSED: Customer session verified for ${sessionData.customer.name}\n`);

        // -------------------------------------------------------------------------
        // TEST 2: Customer A Places an Order
        // -------------------------------------------------------------------------
        console.log('TEST 2: Customer A Places an Order');
        const orderItems = [
            {
                menu_item_id: 50,
                name: 'Chicken Chettinad',
                quantity: 2,
                price: 280,
                notes: 'Less spicy',
            }
        ];

        const order = await OrderService.createOrder(
            TABLE_NUMBER,
            orderItems,
            RESTAURANT_ID,
            'placed',
            undefined,
            undefined,
            undefined,
            `TXN-${Date.now()}`,
            customerAId || undefined,
            {
                customerName: nameA,
                customerPhone: phoneA,
                orderType: 'DINE_IN'
            }
        );

        if (!order || !order.id) {
            throw new Error('Failed to create order');
        }
        createdOrderId = order.id;
        console.log(`✓ Order placed with ID: ${createdOrderId}`);

        // Verify order in database directly
        const { data: dbOrder, error: dbErr } = await supabaseAdmin
            .from('orders')
            .select('id, customer_id, customer_phone, status, is_completed, restaurant_id')
            .eq('id', createdOrderId)
            .single();

        if (dbErr || !dbOrder) {
            throw new Error(`Order not found in DB: ${dbErr?.message}`);
        }
        if (dbOrder.customer_id !== customerAId) {
            throw new Error(`Order customer_id mismatch: expected ${customerAId}, got ${dbOrder.customer_id}`);
        }
        console.log(`✓ Database verification: Order permanently tied to customer_id: ${dbOrder.customer_id}`);
        console.log(`✓ TEST 2 PASSED: Order permanently saved with correct customer account\n`);

        // -------------------------------------------------------------------------
        // TEST 3: Order Appears in Customer Active Orders & Admin Live Orders
        // -------------------------------------------------------------------------
        console.log('TEST 3: Customer Active Orders & Admin Sync');
        const custOrdersRes = await fetch(`${BASE_URL}/api/customer/orders?restaurantId=${RESTAURANT_ID}&tableNumber=${TABLE_NUMBER}`, {
            headers: { Cookie: customerACookie },
        });
        const custOrdersData = await custOrdersRes.json();
        
        const activeOrderMatch = (custOrdersData.activeOrders || []).find((o: any) => o.id === createdOrderId);
        if (!activeOrderMatch) {
            throw new Error(`Order ${createdOrderId} missing from customer active orders`);
        }
        console.log(`✓ Order found in Customer Active Orders with status: ${activeOrderMatch.status}`);

        // Admin live orders query
        const { data: adminLiveOrders } = await supabaseAdmin
            .from('orders')
            .select('id, status, is_completed')
            .eq('restaurant_id', RESTAURANT_ID)
            .eq('is_completed', false);

        const adminMatch = (adminLiveOrders || []).find(o => o.id === createdOrderId);
        if (!adminMatch) {
            throw new Error(`Order ${createdOrderId} missing from Admin Live Orders`);
        }
        console.log(`✓ Order confirmed visible in Admin Live Orders`);
        console.log(`✓ TEST 3 PASSED: Identical order record shared between Customer panel and Admin panel\n`);

        // -------------------------------------------------------------------------
        // TEST 4: Customer Logs Out - Order Must Remain in DB & Admin Live Orders
        // -------------------------------------------------------------------------
        console.log('TEST 4: Customer Logs Out During Active Order');
        const logoutRes = await fetch(`${BASE_URL}/api/customer/auth/logout`, {
            method: 'POST',
            headers: { Cookie: customerACookie },
        });
        if (!logoutRes.ok) {
            throw new Error('Logout endpoint failed');
        }
        console.log(`✓ Customer logged out successfully`);

        // Re-check order in Database
        const { data: dbOrderAfterLogout } = await supabaseAdmin
            .from('orders')
            .select('id, status, is_completed, customer_id')
            .eq('id', createdOrderId)
            .single();

        if (!dbOrderAfterLogout) {
            throw new Error('CRITICAL FAILURE: Order was deleted upon customer logout!');
        }
        if (dbOrderAfterLogout.customer_id !== customerAId) {
            throw new Error('CRITICAL FAILURE: Customer ID was unlinked or modified upon logout!');
        }
        if (dbOrderAfterLogout.is_completed) {
            throw new Error('CRITICAL FAILURE: Order was marked completed prematurely upon logout!');
        }
        console.log(`✓ Order in Database intact: ID=${dbOrderAfterLogout.id}, customer_id=${dbOrderAfterLogout.customer_id}, is_completed=${dbOrderAfterLogout.is_completed}`);

        // Re-check Admin Live Orders
        const { data: adminOrdersAfterLogout } = await supabaseAdmin
            .from('orders')
            .select('id')
            .eq('restaurant_id', RESTAURANT_ID)
            .eq('id', createdOrderId)
            .eq('is_completed', false);

        if (!adminOrdersAfterLogout || adminOrdersAfterLogout.length === 0) {
            throw new Error('Order disappeared from Admin Live Orders after customer logout!');
        }
        console.log(`✓ Order remains visible in Admin Live Orders`);
        console.log(`✓ TEST 4 PASSED: Customer logout NEVER deletes, modifies, or hides active orders\n`);

        // -------------------------------------------------------------------------
        // TEST 5: Customer Logs In Again (Simulating New Device/Clean Session)
        // -------------------------------------------------------------------------
        console.log('TEST 5: Customer Re-logs In (Fresh Device/Session)');
        const reloginRes = await fetch(`${BASE_URL}/api/restaurant/${RESTAURANT_ID}/customers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: nameA, mobile: phoneA }),
        });
        const reloginData = await reloginRes.json();
        if (reloginData.customerId !== customerAId) {
            throw new Error(`Customer ID mismatch after relogin: expected ${customerAId}, got ${reloginData.customerId}`);
        }
        const reloginSetCookie = reloginRes.headers.getSetCookie 
            ? reloginRes.headers.getSetCookie() 
            : [reloginRes.headers.get('set-cookie') || ''];
        const newCustomerCookie = reloginSetCookie.map(c => c.split(';')[0]).join('; ');

        // Fetch orders using only the backend database
        const fetchAfterReloginRes = await fetch(`${BASE_URL}/api/customer/orders?restaurantId=${RESTAURANT_ID}`, {
            headers: { Cookie: newCustomerCookie },
        });
        const afterReloginData = await fetchAfterReloginRes.json();
        const activeOrderAfterRelogin = (afterReloginData.activeOrders || []).find((o: any) => o.id === createdOrderId);

        if (!activeOrderAfterRelogin) {
            throw new Error('Order did not reappear in Active Orders after customer re-login!');
        }
        console.log(`✓ Order successfully restored from PostgreSQL: ${activeOrderAfterRelogin.id}`);
        console.log(`✓ TEST 5 PASSED: Relogin restores all in-flight active orders from database\n`);

        // -------------------------------------------------------------------------
        // TEST 6: Restaurant Staff Processes & Completes Order -> Moves to Previous Orders
        // -------------------------------------------------------------------------
        console.log('TEST 6: Restaurant Completes Order -> Moves to Previous Orders');
        await supabaseAdmin
            .from('orders')
            .update({ 
                status: 'paid',
                is_completed: true,
                completed_at: new Date().toISOString()
            })
            .eq('id', createdOrderId);
        console.log(`✓ Staff updated order to status: 'paid', is_completed: true`);

        // Fetch customer orders again
        const fetchCompletedRes = await fetch(`${BASE_URL}/api/customer/orders?restaurantId=${RESTAURANT_ID}`, {
            headers: { Cookie: newCustomerCookie },
        });
        const completedData = await fetchCompletedRes.json();

        const inActiveList = (completedData.activeOrders || []).some((o: any) => o.id === createdOrderId);
        const inPreviousList = (completedData.previousOrders || []).some((o: any) => o.id === createdOrderId);

        if (inActiveList) {
            throw new Error('Completed order is still in activeOrders!');
        }
        if (!inPreviousList) {
            throw new Error('Completed order did NOT move to previousOrders!');
        }
        console.log(`✓ Order has cleanly moved from Active Orders to Previous Orders`);
        console.log(`✓ TEST 6 PASSED: Order transition to history verified\n`);

        // -------------------------------------------------------------------------
        // TEST 7: Customer Logs Out and Logs In Later -> History Remains Intact
        // -------------------------------------------------------------------------
        console.log('TEST 7: Customer Logs Out and Relogins Later');
        await fetch(`${BASE_URL}/api/customer/auth/logout`, {
            method: 'POST',
            headers: { Cookie: newCustomerCookie },
        });

        // Relogin later
        const laterLoginRes = await fetch(`${BASE_URL}/api/restaurant/${RESTAURANT_ID}/customers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: nameA, mobile: phoneA }),
        });
        const laterSetCookie = laterLoginRes.headers.getSetCookie 
            ? laterLoginRes.headers.getSetCookie() 
            : [laterLoginRes.headers.get('set-cookie') || ''];
        const laterCookie = laterSetCookie.map(c => c.split(';')[0]).join('; ');

        const laterOrdersRes = await fetch(`${BASE_URL}/api/customer/orders?restaurantId=${RESTAURANT_ID}`, {
            headers: { Cookie: laterCookie },
        });
        const laterOrdersData = await laterOrdersRes.json();
        const foundInHistory = (laterOrdersData.previousOrders || []).find((o: any) => o.id === createdOrderId);

        if (!foundInHistory) {
            throw new Error('Completed order was lost from Previous Orders upon future login!');
        }
        console.log(`✓ Previous order #{${foundInHistory.order_number || foundInHistory.id.slice(0, 6)}} is permanently available`);
        console.log(`✓ TEST 7 PASSED: Order history persists across future logins and sessions\n`);

        // -------------------------------------------------------------------------
        // TEST 8: Backend Authorization & Cross-Customer Isolation
        // -------------------------------------------------------------------------
        console.log('TEST 8: Backend Authorization & Customer Isolation');
        const phoneB = '9999922222';
        const nameB = 'Bob Security';

        const loginBRes = await fetch(`${BASE_URL}/api/restaurant/${RESTAURANT_ID}/customers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: nameB, mobile: phoneB }),
        });
        const setCookieB = loginBRes.headers.getSetCookie 
            ? loginBRes.headers.getSetCookie() 
            : [loginBRes.headers.get('set-cookie') || ''];
        const cookieB = setCookieB.map(c => c.split(';')[0]).join('; ');

        const ordersBRes = await fetch(`${BASE_URL}/api/customer/orders?restaurantId=${RESTAURANT_ID}`, {
            headers: { Cookie: cookieB },
        });
        const ordersBData = await ordersBRes.json();

        const leakedOrder = [...(ordersBData.activeOrders || []), ...(ordersBData.previousOrders || [])]
            .find((o: any) => o.id === createdOrderId);

        if (leakedOrder) {
            throw new Error('SECURITY VIOLATION: Customer B was able to view Customer A’s order!');
        }
        console.log(`✓ Customer B received 0 unauthorized orders from Customer A`);
        console.log(`✓ TEST 8 PASSED: Robust customer data isolation confirmed\n`);

        console.log('========================================================');
        console.log('ALL 8 TEST SCENARIOS PASSED WITH 100% SUCCESS!');
        console.log('========================================================');

    } catch (err: any) {
        console.error('\n❌ TEST RUN FAILED:', err.message);
        process.exitCode = 1;
    } finally {
        // Clean up created order
        if (createdOrderId) {
            console.log('\nCleaning up test order...');
            await supabaseAdmin.from('order_items').delete().eq('order_id', createdOrderId);
            await supabaseAdmin.from('orders').delete().eq('id', createdOrderId);
            console.log('Cleanup completed.');
        }
    }
}

runTests();
