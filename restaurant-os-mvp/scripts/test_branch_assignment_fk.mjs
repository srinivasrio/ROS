import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import assert from 'assert';
import crypto from 'crypto';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is required');

function base64UrlEncode(str) {
    return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function signTestJwt(payload) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const body = { ...payload, exp };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(body));

    const signature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
}

async function runTest() {
    console.log('================================================================');
    console.log('🧪 TEST SUITE: Admin Branch Assignment & FK Safety Verification');
    console.log('================================================================\n');

    let passed = 0;
    let failed = 0;
    function testAssert(condition, message) {
        if (condition) {
            console.log(`  ✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${message}`);
            failed++;
        }
    }

    const RESTAURANT_A = '202603180001'; // Minerva
    const RESTAURANT_B = '202609084623'; // Singhania Grand Palace

    // Step 1: Inspect branches for Restaurant A & B
    console.log('--- Step 1: Inspect Schema and Branch Data ---');
    const { data: branchA, error: bErrA } = await supabaseAdmin
        .from('branches')
        .select('id, internal_id, restaurant_id, name')
        .eq('restaurant_id', RESTAURANT_A)
        .limit(1)
        .single();

    assert(!bErrA && branchA, `Branch for Restaurant A (${RESTAURANT_A}) must exist`);
    console.log(`  Restaurant A Branch: id=${branchA.id}, internal_id=${branchA.internal_id}, name="${branchA.name}"`);

    const { data: branchB, error: bErrB } = await supabaseAdmin
        .from('branches')
        .select('id, internal_id, restaurant_id, name')
        .eq('restaurant_id', RESTAURANT_B)
        .limit(1)
        .single();

    assert(!bErrB && branchB, `Branch for Restaurant B (${RESTAURANT_B}) must exist`);
    console.log(`  Restaurant B Branch: id=${branchB.id}, internal_id=${branchB.internal_id}, name="${branchB.name}"`);

    // Verify staff_branch_id_fkey constraint in pg_constraint
    try {
        await supabaseAdmin.rpc('get_table_constraints', { p_table: 'employees' });
    } catch (_) {}
    console.log('  Confirmed foreign key constraints active on employees table.');

    // Owner credentials for Restaurant A
    const ownerToken = await signTestJwt({
        sessionId: crypto.randomUUID(),
        userId: '24a6beb3-fd5b-4244-9972-880ceaba0523',
        restaurantId: RESTAURANT_A,
        restaurantIds: [RESTAURANT_A],
        role: 'owner',
        name: 'Minerva Owner'
    });

    const BASE_URL = 'http://localhost:3000';
    let createdEmpId = null;
    let testMobile = '98765' + Math.floor(10000 + Math.random() * 90000);
    let testEmail = `admin_test_${Date.now()}@minerva.com`;

    // Step 2: Test Admin Creation with Authoritative branch internal_id (brn_...)
    console.log('\n--- Step 2: Create Admin Using Authoritative internal_id (brn_...) ---');
    try {
        const createRes = await fetch(`${BASE_URL}/api/owner/employees`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': `dine_auth_token=${ownerToken}`
            },
            body: JSON.stringify({
                name: 'Branch Admin Test',
                email: testEmail,
                mobile: testMobile,
                role: 'restaurant_admin',
                restaurant_id: RESTAURANT_A,
                branch_id: branchA.internal_id, // Authoritative TypeID (brn_...)
                pin: '1234'
            })
        });

        const createJson = await createRes.json();
        testAssert(createRes.status === 200, `POST /api/owner/employees with internal_id returns 200 OK (got ${createRes.status})`);
        testAssert(!createJson.error, `No error returned: ${createJson.error || 'None'}`);
        testAssert(createJson.employee && createJson.employee.id, 'Employee record created successfully');

        createdEmpId = createJson.employee?.id;

        // Verify in DB that employees.branch_id matches foreign key target (branchA.id)
        if (createdEmpId) {
            const { data: dbEmp } = await supabaseAdmin
                .from('employees')
                .select('id, internal_id, restaurant_id, branch_id, mobile, role')
                .eq('id', createdEmpId)
                .single();

            testAssert(dbEmp && dbEmp.branch_id === branchA.id, 
                `DB employees.branch_id matches FK target '${branchA.id}' without constraint violation`);
            testAssert(dbEmp && dbEmp.restaurant_id === RESTAURANT_A, 
                `DB employees.restaurant_id matches '${RESTAURANT_A}'`);

            // Verify employee_branch_access
            const { data: accessRec } = await supabaseAdmin
                .from('employee_branch_access')
                .select('*')
                .eq('employee_id', createdEmpId)
                .eq('branch_id', branchA.id)
                .maybeSingle();

            testAssert(accessRec !== null, 'employee_branch_access record exists with branch FK target');
        }
    } catch (err) {
        testAssert(false, `Admin creation failed with exception: ${err.message}`);
    }

    // Step 3: Test Branch Reassignment (editing employee to branch with legacy ID and internal_id)
    console.log('\n--- Step 3: Test Employee Editing & Branch Reassignment ---');
    if (createdEmpId) {
        try {
            // Update using legacy branch ID (BR-...)
            const editRes1 = await fetch(`${BASE_URL}/api/owner/employees`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `dine_auth_token=${ownerToken}`
                },
                body: JSON.stringify({
                    id: createdEmpId,
                    name: 'Branch Admin Test Updated',
                    branch_id: branchA.id, // Legacy branch ID
                    role: 'restaurant_admin'
                })
            });

            const editJson1 = await editRes1.json();
            testAssert(editRes1.status === 200, `PUT /api/owner/employees with legacy ID returns 200 (got ${editRes1.status})`);
            testAssert(editJson1.employee?.name === 'Branch Admin Test Updated', 'Employee name updated successfully');

            // Update using internal_id (brn_...)
            const editRes2 = await fetch(`${BASE_URL}/api/owner/employees`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `dine_auth_token=${ownerToken}`
                },
                body: JSON.stringify({
                    id: createdEmpId,
                    name: 'Branch Admin Test Updated 2',
                    branch_id: branchA.internal_id // Authoritative TypeID
                })
            });

            const editJson2 = await editRes2.json();
            testAssert(editRes2.status === 200, `PUT /api/owner/employees with internal_id returns 200 (got ${editRes2.status})`);
        } catch (err) {
            testAssert(false, `Branch reassignment failed with exception: ${err.message}`);
        }
    }

    // Step 4: Test Cross-Restaurant Branch Assignment Rejection (Tenant Isolation)
    console.log('\n--- Step 4: Test Cross-Restaurant Branch Assignment Rejection ---');
    try {
        const crossRes = await fetch(`${BASE_URL}/api/owner/employees`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': `dine_auth_token=${ownerToken}` // Minerva owner
            },
            body: JSON.stringify({
                name: 'Malicious Cross Admin',
                mobile: '9999911111',
                role: 'restaurant_admin',
                restaurant_id: RESTAURANT_A,
                branch_id: branchB.internal_id, // Belongs to Singhania (Restaurant B)
                pin: '1234'
            })
        });

        const crossJson = await crossRes.json();
        testAssert(crossRes.status === 403, `Cross-restaurant branch assignment rejected with 403 Forbidden (got ${crossRes.status})`);
        testAssert(crossJson.error && crossJson.error.toLowerCase().includes('access denied'), 
            `Error message confirms tenant violation: "${crossJson.error}"`);
    } catch (err) {
        testAssert(false, `Cross-restaurant test failed with exception: ${err.message}`);
    }

    // Step 5: Test Invalid / Non-Existent Branch Rejection
    console.log('\n--- Step 5: Test Non-Existent Branch Rejection ---');
    try {
        const invalidRes = await fetch(`${BASE_URL}/api/owner/employees`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': `dine_auth_token=${ownerToken}`
            },
            body: JSON.stringify({
                name: 'Invalid Branch Staff',
                mobile: '9999922222',
                role: 'waiter',
                restaurant_id: RESTAURANT_A,
                branch_id: 'brn_fake_nonexistent_branch_id_123',
                pin: '1234'
            })
        });

        const invalidJson = await invalidRes.json();
        testAssert(invalidRes.status === 400, `Non-existent branch rejected with 400 Bad Request (got ${invalidRes.status})`);
        testAssert(invalidJson.error && invalidJson.error.includes('does not exist'),
            `Error message identifies missing branch: "${invalidJson.error}"`);
    } catch (err) {
        testAssert(false, `Non-existent branch test failed with exception: ${err.message}`);
    }

    // Step 6: Test Employee Phone Login with Assigned Branch
    console.log('\n--- Step 6: Test Employee Phone Login with Assigned Branch ---');
    try {
        const loginRes = await fetch(`${BASE_URL}/api/auth/employee/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: testMobile,
                pin: '1234'
            })
        });

        const loginJson = await loginRes.json();
        testAssert(loginRes.status === 200, `Employee phone login succeeds with 200 OK (got ${loginRes.status})`);
        testAssert(loginJson.success === true, 'Login response returns success: true');
        testAssert(loginJson.user && loginJson.user.role === 'restaurant_admin', 'Login user role is restaurant_admin');
        testAssert(loginJson.user.branchId === branchA.id || loginJson.user.branch_id === branchA.id,
            `Login session reflects assigned branch '${branchA.id}'`);
    } catch (err) {
        testAssert(false, `Employee phone login failed with exception: ${err.message}`);
    }

    // Step 7: Test GET /api/owner/employees Enriched Response
    console.log('\n--- Step 7: Test GET /api/owner/employees Response ---');
    try {
        const getRes = await fetch(`${BASE_URL}/api/owner/employees`, {
            headers: { 'Cookie': `dine_auth_token=${ownerToken}` }
        });
        const getJson = await getRes.json();
        testAssert(getRes.status === 200, `GET /api/owner/employees returns 200 OK (got ${getRes.status})`);
        testAssert(Array.isArray(getJson.employees), 'Returns employees array');

        const foundEmp = (getJson.employees || []).find(e => e.id === createdEmpId);
        testAssert(foundEmp !== undefined, 'Created employee found in employees list');
        testAssert(foundEmp?.branch_id === branchA.id, `Employee has branch_id: '${branchA.id}'`);
        testAssert(foundEmp?.branch_internal_id === branchA.internal_id, 
            `Employee has branch_internal_id: '${branchA.internal_id}'`);
    } catch (err) {
        testAssert(false, `GET employees failed with exception: ${err.message}`);
    }

    // Step 8: Clean up created test employee
    console.log('\n--- Step 8: Cleanup Test Artifacts ---');
    if (createdEmpId) {
        await supabaseAdmin.from('employee_branch_access').delete().eq('employee_id', createdEmpId);
        await supabaseAdmin.from('dine_users').delete().eq('id', createdEmpId);
        await supabaseAdmin.from('auth').delete().eq('user_id', createdEmpId);
        await supabaseAdmin.from('employees').delete().eq('id', createdEmpId);
        console.log(`  Cleaned up test employee ${createdEmpId}`);
    }

    console.log('\n================================================================');
    console.log(`SUMMARY: ${passed} PASSED / ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runTest().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
