import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Auto-load .env.local if not already present
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && fs.existsSync('.env.local')) {
    const lines = fs.readFileSync('.env.local', 'utf8').split('\n');
    for (const line of lines) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
            process.env[key] = value.trim();
        }
    }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://72.61.250.231:8010';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
    console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY is required to run verification tests.');
    process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, message, details = '') {
    if (condition) {
        passed++;
        results.push({ status: 'PASS', message });
        console.log(`  \x1b[32m✔ PASS:\x1b[0m ${message}`);
    } else {
        failed++;
        results.push({ status: 'FAIL', message, details });
        console.error(`  \x1b[31m✖ FAIL:\x1b[0m ${message}${details ? ' - ' + details : ''}`);
    }
}

async function runP1VerificationSuite() {
    console.log('================================================================');
    console.log('       DINE IN ONE — P1 SECURITY & RELIABILITY TEST SUITE       ');
    console.log('================================================================');

    let testRestAId = null;
    let testRestBId = null;
    let testTableAId = null;
    let testMenuItemAId = null;
    let testMenuItemBId = null;
    let createdOrderIds = [];

    try {
        // Setup: Resolve or create test fixture restaurants and items
        const { data: restA } = await supabaseAdmin
            .from('restaurants')
            .select('id, name')
            .limit(1)
            .single();

        testRestAId = restA.id;

        // Ensure we have a second restaurant for tenant isolation checks
        const { data: restB } = await supabaseAdmin
            .from('restaurants')
            .select('id, name')
            .neq('id', testRestAId)
            .limit(1)
            .maybeSingle();

        if (restB) {
            testRestBId = restB.id;
        } else {
            const { data: newRestB } = await supabaseAdmin
                .from('restaurants')
                .insert({ name: 'P1 Isolation Test Restaurant B' })
                .select('id')
                .single();
            testRestBId = newRestB.id;
        }

        // Get or create table for Restaurant A
        const { data: tableA } = await supabaseAdmin
            .from('tables')
            .select('id')
            .eq('restaurant_id', testRestAId)
            .limit(1)
            .maybeSingle();

        if (tableA) {
            testTableAId = tableA.id;
        } else {
            const { data: newTable } = await supabaseAdmin
                .from('tables')
                .insert({
                    restaurant_id: testRestAId,
                    table_number: 'P1-99',
                    status: 'available',
                    capacity: 4
                })
                .select('id')
                .single();
            testTableAId = newTable.id;
        }

        // Ensure an active menu item for Restaurant A
        const { data: itemA } = await supabaseAdmin
            .from('menu_items')
            .select('id, price')
            .eq('restaurant_id', testRestAId)
            .eq('is_available', true)
            .limit(1)
            .maybeSingle();

        if (itemA) {
            testMenuItemAId = itemA.id;
        } else {
            const { data: newItemA } = await supabaseAdmin
                .from('menu_items')
                .insert({
                    restaurant_id: testRestAId,
                    name: 'P1 Test Pizza',
                    price: 299,
                    is_available: true
                })
                .select('id, price')
                .single();
            testMenuItemAId = newItemA.id;
        }

        // Ensure an active menu item for Restaurant B
        const { data: itemB } = await supabaseAdmin
            .from('menu_items')
            .select('id, price')
            .eq('restaurant_id', testRestBId)
            .limit(1)
            .maybeSingle();

        if (itemB) {
            testMenuItemBId = itemB.id;
        } else {
            const { data: newItemB } = await supabaseAdmin
                .from('menu_items')
                .insert({
                    restaurant_id: testRestBId,
                    name: 'Restaurant B Burger',
                    price: 199,
                    is_available: true
                })
                .select('id, price')
                .single();
            testMenuItemBId = newItemB.id;
        }

        // =============================================================
        // P1-01: Flutter Realtime Multi-Tenant Isolation
        // =============================================================
        console.log('\n--- P1-01: Cross-Tenant Realtime Event Isolation ---');

        const realtimeServicePath = path.resolve('waiter_app/lib/core/realtime/supabase_service.dart');
        assert(fs.existsSync(realtimeServicePath), 'waiter_app SupabaseService file exists');

        const realtimeContent = fs.readFileSync(realtimeServicePath, 'utf8');

        // Check server-side change filter on order_items
        const orderItemsFilterPresent = realtimeContent.includes("table: 'order_items'") &&
            realtimeContent.includes("column: 'restaurant_id'") &&
            realtimeContent.includes("value: sanitizedRestId");
        assert(orderItemsFilterPresent, 'order_items subscription enforces server-side PostgresChangeFilter with sanitized restaurant_id');

        // Check server-side change filter on service_requests
        const serviceReqFilterPresent = realtimeContent.includes("table: 'service_requests'") &&
            realtimeContent.includes("column: 'restaurant_id'") &&
            realtimeContent.includes("value: sanitizedRestId");
        assert(serviceReqFilterPresent, 'service_requests subscription enforces server-side PostgresChangeFilter with sanitized restaurant_id');

        // Check that strict tenant equality check is enforced
        const strictTenantCheck = realtimeContent.includes("if (rowRestId == null || rowRestId.toString() != sanitizedRestId) return;");
        assert(strictTenantCheck, 'Realtime callbacks strictly reject null and cross-tenant restaurant_id');

        // Check controller files for eliminated hardcoded fallback restaurant IDs
        const controllersToCheck = [
            'waiter_app/lib/features/navigation/screens/main_navigation_screen.dart',
            'waiter_app/lib/features/orders/controllers/orders_controller.dart',
            'waiter_app/lib/features/requests/controllers/requests_controller.dart',
            'waiter_app/lib/features/tables/controllers/tables_controller.dart',
            'waiter_app/lib/features/menu/controllers/menu_controller.dart',
        ];

        let anyHardcodedFallbackFound = false;
        for (const ctrlPath of controllersToCheck) {
            if (fs.existsSync(ctrlPath)) {
                const ctrlContent = fs.readFileSync(ctrlPath, 'utf8');
                if (ctrlContent.includes('?? \'202603180001\'')) {
                    anyHardcodedFallbackFound = true;
                    console.error(`Found hardcoded fallback in ${ctrlPath}`);
                }
            }
        }
        assert(!anyHardcodedFallbackFound, 'Flutter controllers require real authenticated restaurant_id with no dummy fallback');

        // =============================================================
        // P1-02: Atomic Order Creation RPC (create_order_v2)
        // =============================================================
        console.log('\n--- P1-02: Atomic Order Creation & Idempotency (create_order_v2) ---');

        // 1. Forced failure leaves no partial order (invalid item)
        const fakeItemId = 999999999;
        const txIdFail = `p1_fail_${Date.now()}`;
        const { data: failResult, error: failErr } = await supabaseAdmin.rpc('create_order_v2', {
            p_restaurant_id: testRestAId,
            p_transaction_id: txIdFail,
            p_table_id: testTableAId,
            p_items: [{ menu_item_id: fakeItemId, quantity: 1, item_type: 'standard' }]
        });

        assert(Boolean(failErr), 'create_order_v2 rejects order with non-existent menu item', failErr?.message);

        // Verify rollback: no order created with that transaction ID
        const { data: rolledBackOrder } = await supabaseAdmin
            .from('orders')
            .select('id')
            .eq('transaction_id', txIdFail)
            .maybeSingle();
        assert(!rolledBackOrder, 'Failed order creation cleanly rolls back entire transaction (no partial order created)');

        // 2. Cross-tenant menu item injection rejected
        const txIdCross = `p1_cross_${Date.now()}`;
        const { data: crossResult, error: crossErr } = await supabaseAdmin.rpc('create_order_v2', {
            p_restaurant_id: testRestAId,
            p_transaction_id: txIdCross,
            p_table_id: testTableAId,
            p_items: [{ menu_item_id: testMenuItemBId, quantity: 1, item_type: 'standard' }] // Item belonging to Restaurant B!
        });

        assert(Boolean(crossErr), 'create_order_v2 rejects cross-tenant menu item belonging to Restaurant B', crossErr?.message);

        // 3. Successful Atomic Order Creation with Server Authoritative Pricing
        const txIdSuccess = `p1_success_${Date.now()}`;
        const clientManipulatedPrice = 0.50; // Malicious client attempt to pay 50 cents
        const { data: rpcSuccessRes, error: successErr } = await supabaseAdmin.rpc('create_order_v2', {
            p_restaurant_id: testRestAId,
            p_transaction_id: txIdSuccess,
            p_table_id: testTableAId,
            p_order_type: 'DINE_IN',
            p_status: 'placed',
            p_items: [{
                menu_item_id: testMenuItemAId,
                quantity: 2,
                price: clientManipulatedPrice, // Client tries to override price
                item_type: 'standard'
            }]
        });

        const successOrderId = rpcSuccessRes?.id;
        assert(!successErr && Boolean(successOrderId), 'create_order_v2 successfully creates valid order', successErr?.message);
        if (successOrderId) createdOrderIds.push(successOrderId);

        // Verify Server-Authoritative pricing in created order
        const { data: createdOrder } = await supabaseAdmin
            .from('orders')
            .select('id, total_amount, gst_amount, is_completed')
            .eq('id', successOrderId)
            .single();

        const { data: createdItems } = await supabaseAdmin
            .from('order_items')
            .select('id, order_id, menu_item_id, quantity, price_at_time')
            .eq('order_id', successOrderId);

        assert(createdItems && createdItems.length === 1, 'order_items atomically inserted with order');
        assert(createdItems && Number(createdItems[0].price_at_time) > 1.0, `Server-authoritative price enforced: ${createdItems?.[0]?.price_at_time} (client price 0.50 ignored)`);
        assert(createdOrder && Number(createdOrder.total_amount) > 2.0, `Order total_amount calculated server-side: ${createdOrder?.total_amount}`);

        // 4. Idempotency test: Re-submitting identical request with same transaction ID
        const { data: retryRes, error: retryErr } = await supabaseAdmin.rpc('create_order_v2', {
            p_restaurant_id: testRestAId,
            p_transaction_id: txIdSuccess,
            p_table_id: testTableAId,
            p_order_type: 'DINE_IN',
            p_status: 'placed',
            p_items: [{ menu_item_id: testMenuItemAId, quantity: 2, item_type: 'standard' }]
        });

        assert(!retryErr && retryRes?.id === successOrderId, 'Repeated request with same transactionId returns existing order ID (idempotency preserved)');

        // Verify no duplicate order or duplicate order_items created
        const { count: orderCount } = await supabaseAdmin
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('transaction_id', txIdSuccess);
        assert(orderCount === 1, 'Exactly one order exists for the transactionId');

        const { count: itemsCount } = await supabaseAdmin
            .from('order_items')
            .select('id', { count: 'exact', head: true })
            .eq('order_id', successOrderId);
        assert(itemsCount === 1, 'No duplicate order_items created upon idempotency retry');

        // =============================================================
        // P1-03: Evidence-Based Indexes & Duplicate Cleanup
        // =============================================================
        console.log('\n--- P1-03: Evidence-Based Indexes & Duplicate Cleanup ---');

        const { data: pgIndexes } = await supabaseAdmin
            .from('p1_indexes')
            .select('tablename, indexname')
            .in('tablename', ['users', 'tables', 'employees', 'orders']);

        const indexNames = (pgIndexes || []).map(i => i.indexname);

        assert(indexNames.includes('idx_users_restaurant_id'), 'idx_users_restaurant_id exists on users');
        assert(indexNames.includes('idx_users_email'), 'idx_users_email exists on users');
        assert(indexNames.includes('idx_users_phone'), 'idx_users_phone exists on users');

        assert(indexNames.includes('idx_tables_restaurant_id'), 'idx_tables_restaurant_id exists on tables');
        assert(indexNames.includes('idx_tables_restaurant_status'), 'idx_tables_restaurant_status exists on tables');

        assert(indexNames.includes('idx_employees_restaurant_id'), 'idx_employees_restaurant_id exists on employees');
        assert(indexNames.includes('idx_employees_mobile'), 'idx_employees_mobile exists on employees');
        assert(indexNames.includes('idx_employees_restaurant_status'), 'idx_employees_restaurant_status exists on employees');

        // Check duplicate index cleanup on orders
        assert(!indexNames.includes('idx_orders_branch'), 'Duplicate index idx_orders_branch was dropped from orders');
        assert(indexNames.includes('idx_orders_branch_id'), 'Canonical index idx_orders_branch_id is retained on orders');

        // =============================================================
        // P1-04: Distributed Rate Limiting (No Postgres on Hot Path)
        // =============================================================
        console.log('\n--- P1-04: Distributed Rate Limiting (Zero DB Hot Path) ---');

        const { RateLimiter } = await import('../lib/rate-limiter.ts');

        RateLimiter.resetAll();

        // 1. Burst limit test: limit 5 requests
        const testKey = `test_burst_${Date.now()}`;
        let blocked = false;
        let retryAfterVal = 0;

        for (let i = 1; i <= 6; i++) {
            const res = await RateLimiter.check(testKey, 5, 60);
            if (i <= 5) {
                assert(res.success === true, `Burst request #${i} succeeds within limit 5`);
            } else {
                blocked = !res.success;
                retryAfterVal = res.retryAfterSeconds;
                assert(res.success === false, 'Burst request #6 exceeds limit and triggers rate limit block');
                assert(res.retryAfterSeconds > 0, `Retry-After seconds returned: ${res.retryAfterSeconds}s`);
            }
        }

        // 2. Response helper test
        const blockedResult = await RateLimiter.check(testKey, 5, 60);
        const rateLimitResponse = RateLimiter.createRateLimitResponse(blockedResult);
        assert(rateLimitResponse.status === 429, 'RateLimiter.createRateLimitResponse returns HTTP 429');
        assert(Boolean(rateLimitResponse.headers.get('Retry-After')), 'Response includes Retry-After header');
        assert(Boolean(rateLimitResponse.headers.get('X-RateLimit-Limit')), 'Response includes X-RateLimit-Limit header');

        // 3. User isolation test: Different keys must not share limits
        const otherUserKey = `test_other_user_${Date.now()}`;
        const otherUserRes = await RateLimiter.check(otherUserKey, 5, 60);
        assert(otherUserRes.success === true, 'Different user key is not blocked by another user limit exhaustion');

        // =============================================================
        // P1-05: Customer Phone OTP Verification
        // =============================================================
        console.log('\n--- P1-05: Customer Phone OTP Verification ---');

        const { CustomerOtpService, hashCustomerOtp, verifyCustomerOtpHash } = await import('../lib/customer-otp.ts');

        const testPhone = '9876540001';

        // 1. Hash computation and timing-safe comparison
        const sampleOtp = '482910';
        const hash = hashCustomerOtp(testRestAId, testPhone, sampleOtp);
        assert(typeof hash === 'string' && hash.length === 64, 'hashCustomerOtp produces secure 64-char HMAC-SHA256 hex string');
        assert(verifyCustomerOtpHash(testRestAId, testPhone, sampleOtp, hash), 'verifyCustomerOtpHash verifies correct OTP');
        assert(!verifyCustomerOtpHash(testRestAId, testPhone, '000000', hash), 'verifyCustomerOtpHash rejects incorrect OTP');

        // 2. Send OTP
        const sendResult = await CustomerOtpService.sendOtp(testRestAId, testPhone, '127.0.0.1');
        assert(sendResult.success === true, 'CustomerOtpService.sendOtp generates and stores OTP', sendResult.error);
        assert(sendResult.maskedPhone.includes('******'), `Phone number is masked: ${sendResult.maskedPhone}`);

        // 3. Verify OTP record stored securely with hash in DB
        const { data: storedOtp } = await supabaseAdmin
            .from('customer_phone_otps')
            .select('otp_hash, is_used, is_verified, attempt_count, expires_at')
            .eq('restaurant_id', testRestAId)
            .eq('phone', testPhone)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        assert(Boolean(storedOtp?.otp_hash), 'OTP is stored in database as a hash (plaintext never stored)');
        assert(storedOtp.is_used === false, 'Stored OTP is marked is_used: false');

        // 4. Invalid OTP rejection and attempt increment
        const invalidCheck = await CustomerOtpService.verifyOtp(testRestAId, testPhone, '000000', '127.0.0.1');
        assert(invalidCheck.success === false, 'CustomerOtpService.verifyOtp rejects incorrect OTP');
        assert(invalidCheck.remainingAttempts === 4, `Attempt count tracked, 4 remaining attempts reported (got ${invalidCheck.remainingAttempts})`);

        // 5. Valid OTP verification (using devOtp in non-production)
        const activeOtpCode = sendResult.devOtp;
        assert(Boolean(activeOtpCode), 'devOtp available in test execution environment');

        const validCheck = await CustomerOtpService.verifyOtp(testRestAId, testPhone, activeOtpCode, '127.0.0.1');
        assert(validCheck.success === true, 'CustomerOtpService.verifyOtp succeeds with valid OTP', validCheck.error);

        // 6. Anti-replay: cannot reuse the same OTP
        const reuseCheck = await CustomerOtpService.verifyOtp(testRestAId, testPhone, activeOtpCode, '127.0.0.1');
        assert(reuseCheck.success === false, 'Replaying previously verified OTP fails (single-use enforced)');

        // =============================================================
        // P1-06: Observability & Production Health Monitoring
        // =============================================================
        console.log('\n--- P1-06: Observability & Health Monitoring ---');

        const { Observability, redactSensitiveData } = await import('../lib/observability.ts');

        // 1. Redaction of sensitive credentials
        const sensitivePayload = {
            email: 'customer@example.com',
            password: 'SuperSecretPassword123!',
            jwtToken: 'header.payload.signature',
            otpCode: '123456',
            token_hash: 'abcdef123456',
            service_role_key: 'supersecretkey',
            meta: {
                apiKey: 'secret_api_key',
                normalField: 'safeValue'
            }
        };

        const redacted = redactSensitiveData(sensitivePayload);
        assert(redacted.password === '[REDACTED]', 'password is redacted');
        assert(redacted.jwtToken === '[REDACTED]', 'jwtToken is redacted');
        assert(redacted.otpCode === '[REDACTED]', 'otpCode is redacted');
        assert(redacted.token_hash === '[REDACTED]', 'token_hash is redacted');
        assert(redacted.service_role_key === '[REDACTED]', 'service_role_key is redacted');
        assert(redacted.meta.apiKey === '[REDACTED]', 'nested apiKey is redacted');
        assert(redacted.meta.normalField === 'safeValue', 'non-sensitive fields are preserved');

        // 2. Metrics Tracking and Latency Percentiles
        Observability.resetMetrics();
        Observability.recordRequest('/api/menu', 'GET', 200, 45);
        Observability.recordRequest('/api/orders', 'POST', 201, 80);
        Observability.recordRequest('/api/orders', 'POST', 500, 150);
        Observability.recordDbQuery(25, true);
        Observability.recordEvent('otp_failure', { phone: '9876540001' });

        const snapshot = Observability.getMetricsSnapshot();
        assert(snapshot.requests.total === 3, `Metrics records total requests (got ${snapshot.requests.total})`);
        assert(snapshot.requests.errorRate5xxPercent > 30, `Metrics tracks 5xx error rate (got ${snapshot.requests.errorRate5xxPercent}%)`);
        assert(snapshot.latencyMs.p50 > 0, `p50 latency calculated: ${snapshot.latencyMs.p50}ms`);
        assert(snapshot.counters.otpFailures === 1, 'Operational counter otpFailures incremented');

        // =============================================================
        // Live HTTP API Route Integration Tests (P1-04, P1-05, P1-06)
        // =============================================================
        console.log('\n--- P1-04, P1-05, P1-06: Live HTTP API Route Integration Tests ---');
        RateLimiter.resetAll();
        const { NextRequest } = await import('next/server');

        const livePhoneA = `987${Math.floor(1000000 + Math.random() * 9000000)}`;
        const livePhoneB = `987${Math.floor(1000000 + Math.random() * 9000000)}`;
        const livePhoneC = `987${Math.floor(1000000 + Math.random() * 9000000)}`;

        // 1. POST /api/customer/auth/send-otp
        const sendOtpRoute = await import('../app/api/customer/auth/send-otp/route.ts');
        const sendReq = new NextRequest('http://localhost:3000/api/customer/auth/send-otp', {
            method: 'POST',
            body: JSON.stringify({ restaurantCode: testRestAId, mobile: livePhoneA }),
            headers: { 'Content-Type': 'application/json' }
        });
        const sendRes = await sendOtpRoute.POST(sendReq);
        assert(sendRes.status === 200, `POST /api/customer/auth/send-otp returns 200 OK (got ${sendRes.status})`);
        const sendData = await sendRes.json();
        assert(sendData.success === true, 'send-otp returns success: true');
        assert(Boolean(sendData.devOtp), 'send-otp returns devOtp in test environment');
        const receivedOtp = sendData.devOtp;

        // 2. POST /api/customer/auth/verify-otp
        const verifyOtpRoute = await import('../app/api/customer/auth/verify-otp/route.ts');
        
        // Bad OTP attempt
        const badVerifyReq = new NextRequest('http://localhost:3000/api/customer/auth/verify-otp', {
            method: 'POST',
            body: JSON.stringify({ restaurantCode: testRestAId, mobile: livePhoneA, otp: '000000' }),
            headers: { 'Content-Type': 'application/json' }
        });
        const badVerifyRes = await verifyOtpRoute.POST(badVerifyReq);
        assert(badVerifyRes.status === 400, `verify-otp rejects bad OTP with 400 (got ${badVerifyRes.status})`);

        // Good OTP attempt
        const goodVerifyReq = new NextRequest('http://localhost:3000/api/customer/auth/verify-otp', {
            method: 'POST',
            body: JSON.stringify({ restaurantCode: testRestAId, mobile: livePhoneA, otp: receivedOtp, name: 'P1 Test Customer' }),
            headers: { 'Content-Type': 'application/json' }
        });
        const goodVerifyRes = await verifyOtpRoute.POST(goodVerifyReq);
        assert(goodVerifyRes.status === 200, `verify-otp with valid OTP returns 200 OK (got ${goodVerifyRes.status})`);
        const goodVerifyData = await goodVerifyRes.json();
        assert(Boolean(goodVerifyData.token), 'verify-otp issues Customer JWT upon valid OTP');
        assert(goodVerifyData.customer?.name === 'P1 Test Customer', 'verify-otp returns verified customer profile');

        // 3. POST /api/restaurant/[restaurantCode]/customers (Enforce OTP requirement)
        const customersRoute = await import('../app/api/restaurant/[restaurantCode]/customers/route.ts');
        
        // Phone-only attempt without OTP
        const phoneOnlyReq = new NextRequest(`http://localhost:3000/api/restaurant/${testRestAId}/customers`, {
            method: 'POST',
            body: JSON.stringify({ name: 'Unverified Attacker', mobile: livePhoneB }),
            headers: { 'Content-Type': 'application/json' }
        });
        const phoneOnlyRes = await customersRoute.POST(phoneOnlyReq, { params: Promise.resolve({ restaurantCode: testRestAId }) });
        assert(phoneOnlyRes.status === 401, `POST /api/restaurant/[restaurantCode]/customers hard-rejects phone-only registration with 401 (got ${phoneOnlyRes.status})`);

        // 4. POST /api/customer/active-order (Zero unverified Customer JWT issuance)
        const activeOrderRoute = await import('../app/api/customer/active-order/route.ts');
        const activeOrderReq = new NextRequest('http://localhost:3000/api/customer/active-order', {
            method: 'POST',
            body: JSON.stringify({ restaurantCode: testRestAId, mobile: livePhoneC }),
            headers: { 'Content-Type': 'application/json' }
        });
        const activeOrderRes = await activeOrderRoute.POST(activeOrderReq);
        assert(activeOrderRes.status === 200, `POST /api/customer/active-order returns 200 for lookup (got ${activeOrderRes.status})`);
        const activeOrderData = await activeOrderRes.json();
        assert(activeOrderData.token === undefined, 'POST /api/customer/active-order NEVER issues Customer JWT on unverified phone query');

        // 5. GET /api/health
        const healthRoute = await import('../app/api/health/route.ts');
        const healthReq = new NextRequest('http://localhost:3000/api/health');
        const healthRes = await healthRoute.GET(healthReq);
        assert(healthRes.status === 200, `GET /api/health returns 200 OK (got ${healthRes.status})`);
        const healthData = await healthRes.json();
        assert(healthData.status === 'healthy' || healthData.status === 'degraded', `Health probe reports status: ${healthData.status}`);
        assert(healthData.database?.status === 'connected', 'Health probe verifies database connectivity');
        assert(typeof healthData.database?.latencyMs === 'number', `Health probe reports DB latency: ${healthData.database?.latencyMs}ms`);
        assert(typeof healthData.uptimeSeconds === 'number', `Health probe reports uptimeSeconds: ${healthData.uptimeSeconds}s`);

        // 6. GET /api/healthz alias
        const healthzRoute = await import('../app/api/healthz/route.ts');
        const healthzReq = new NextRequest('http://localhost:3000/api/healthz');
        const healthzRes = await healthzRoute.GET(healthzReq);
        assert(healthzRes.status === 200, `GET /api/healthz alias returns 200 OK (got ${healthzRes.status})`);

    } finally {
        // Cleanup test orders
        if (createdOrderIds.length > 0) {
            console.log('\n--- Cleaning up temporary test orders ---');
            await supabaseAdmin.from('order_items').delete().in('order_id', createdOrderIds);
            await supabaseAdmin.from('orders').delete().in('id', createdOrderIds);
        }
    }

    console.log('\n================================================================');
    console.log(`P1 VERIFICATION RESULT: ${passed} PASSED / ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
        process.exit(1);
    }
}

runP1VerificationSuite().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
