/**
 * Verification test for Customer Table QR Isolation & Warning Flow
 */

const BASE_URL = 'http://localhost:3000';
const VISITED_RESTAURANT = '202603180001'; // Test Restaurant
const OTHER_RESTAURANT = 'PEND-202609082320'; // Srinivas In

async function runTests() {
    console.log('\n======================================================');
    console.log('  Customer Table QR Multi-Tenant Isolation Test Suite');
    console.log('======================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(name, condition, extra = '') {
        if (condition) {
            console.log(`  ✔ PASS: ${name} ${extra ? `(${extra})` : ''}`);
            passed++;
        } else {
            console.error(`  ✖ FAIL: ${name} ${extra ? `(${extra})` : ''}`);
            failed++;
        }
    }

    // Test 1: Visited restaurant valid table URL
    try {
        const qrUrl = `${BASE_URL}/${VISITED_RESTAURANT}/customer/table/3`;
        const res = await fetch(`${BASE_URL}/api/customer/table/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                restaurantId: VISITED_RESTAURANT,
                qrData: qrUrl,
            }),
        });
        const data = await res.json();
        assert('Valid visited restaurant table URL succeeds', data.valid === true && data.tableNumber === '3', `Table ${data.tableNumber}`);
    } catch (e) {
        assert('Valid visited restaurant table URL succeeds', false, e.message);
    }

    // Test 2: Visited restaurant valid plain table number
    try {
        const res = await fetch(`${BASE_URL}/api/customer/table/verify?restaurantId=${VISITED_RESTAURANT}&table=3`);
        const data = await res.json();
        assert('Valid plain table number for visited restaurant succeeds', data.valid === true && data.tableNumber === '3', `Table ${data.tableNumber}`);
    } catch (e) {
        assert('Valid plain table number for visited restaurant succeeds', false, e.message);
    }

    // Test 3: Scanning another restaurant table URL (cross-restaurant rejection)
    try {
        const otherQrUrl = `https://dineinone.com/${OTHER_RESTAURANT}/customer/table/1`;
        const res = await fetch(`${BASE_URL}/api/customer/table/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                restaurantId: VISITED_RESTAURANT,
                qrData: otherQrUrl,
            }),
        });
        const data = await res.json();
        assert(
            'Scanned other restaurant table QR URL is blocked',
            data.valid === false && data.reason === 'different_restaurant',
            `Reason: ${data.reason}, Msg: "${data.message}"`
        );
        assert(
            'Response includes visited & scanned restaurant metadata',
            data.visitedRestaurant?.id && data.scannedRestaurant?.id,
            `Visited: ${data.visitedRestaurant?.name}, Scanned: ${data.scannedRestaurant?.name}`
        );
    } catch (e) {
        assert('Scanned other restaurant table QR URL is blocked', false, e.message);
    }

    // Test 4: Scanning another restaurant JSON payload (cross-restaurant rejection)
    try {
        const otherQrJson = JSON.stringify({
            restaurantId: OTHER_RESTAURANT,
            tableNumber: '1',
        });
        const res = await fetch(`${BASE_URL}/api/customer/table/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                restaurantId: VISITED_RESTAURANT,
                qrData: otherQrJson,
            }),
        });
        const data = await res.json();
        assert(
            'Scanned other restaurant JSON QR is blocked',
            data.valid === false && data.reason === 'different_restaurant',
            `Reason: ${data.reason}`
        );
    } catch (e) {
        assert('Scanned other restaurant JSON QR is blocked', false, e.message);
    }

    // Test 5: Table that does not exist in visited restaurant
    try {
        const res = await fetch(`${BASE_URL}/api/customer/table/verify?restaurantId=${VISITED_RESTAURANT}&table=999`);
        const data = await res.json();
        assert(
            'Non-existent table number rejected with table_not_found',
            data.valid === false && data.reason === 'table_not_found',
            `Msg: "${data.message}"`
        );
    } catch (e) {
        assert('Non-existent table number rejected with table_not_found', false, e.message);
    }

    // Test 6: Same table number but belonging to another restaurant
    try {
        // Suppose QR is from OTHER_RESTAURANT for table 3
        const otherTable3Url = `https://dineinone.com/${OTHER_RESTAURANT}/customer/table/3`;
        const res = await fetch(`${BASE_URL}/api/customer/table/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                restaurantId: VISITED_RESTAURANT,
                qrData: otherTable3Url,
            }),
        });
        const data = await res.json();
        assert(
            'Matching table number from DIFFERENT restaurant is strictly rejected',
            data.valid === false && data.reason === 'different_restaurant',
            `Blocked cross-tenant assignment (Reason: ${data.reason})`
        );
    } catch (e) {
        assert('Matching table number from DIFFERENT restaurant is strictly rejected', false, e.message);
    }

    console.log('\n======================================================');
    console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');

    if (failed > 0) process.exit(1);
}

runTests();
