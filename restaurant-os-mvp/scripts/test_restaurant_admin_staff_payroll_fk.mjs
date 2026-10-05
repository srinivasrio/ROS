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

async function runTests() {
    console.log('========================================================================');
    console.log('🧪 TEST: Restaurant Admin Staff/Payroll & Salary/Overtime FK Safety');
    console.log('========================================================================\n');

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

    const BASE_URL = 'http://localhost:3000';
    const TEST_RESTAURANT_ID = '202603180001'; // Minerva

    // Step 1: Verify PostgreSQL Foreign Key Constraint staff_branch_id_fkey is ACTIVE
    console.log('--- Step 1: Verify Foreign Key Constraint staff_branch_id_fkey is Active ---');
    const testFakeId = crypto.randomUUID();
    const { error: fkViolationErr } = await supabaseAdmin.from('employees').insert({
        id: testFakeId,
        name: 'FK Test Dummy',
        restaurant_id: TEST_RESTAURANT_ID,
        branch_id: 'BR-NONEXISTENT-999999',
        role: 'waiter'
    });
    testAssert(
        fkViolationErr && fkViolationErr.message.includes('staff_branch_id_fkey'),
        `Foreign key constraint 'staff_branch_id_fkey' is ACTIVE in PostgreSQL: ${fkViolationErr?.message}`
    );

    // Step 2: Fetch Approved Main Branch for Minerva
    console.log('\n--- Step 2: Fetch Approved Main Branch for Target Restaurant ---');
    const { data: approvedBranch, error: bErr } = await supabaseAdmin
        .from('branches')
        .select('*')
        .eq('restaurant_id', TEST_RESTAURANT_ID)
        .order('is_main_branch', { ascending: false })
        .limit(1)
        .single();

    assert(!bErr && approvedBranch, 'Minerva approved branch must exist');
    console.log(`  Target Approved Branch: id=${approvedBranch.id}, internal_id=${approvedBranch.internal_id}, name="${approvedBranch.name}"`);

    // Owner credentials
    const ownerToken = await signTestJwt({
        sessionId: crypto.randomUUID(),
        userId: '24a6beb3-fd5b-4244-9972-880ceaba0523',
        restaurantId: TEST_RESTAURANT_ID,
        restaurantIds: [TEST_RESTAURANT_ID],
        role: 'owner',
        name: 'Minerva Owner'
    });

    // Step 3: Owner Assigns Restaurant Admin to Branch
    console.log('\n--- Step 3: Owner Assigns Restaurant Admin with Exact Approved Branch ID ---');
    const uniqueEmail = `rest_admin_${Date.now()}@testminerva.com`;
    const uniquePhone = '98' + Math.floor(10000000 + Math.random() * 90000000);

    const assignRes = await fetch(`${BASE_URL}/api/owner/branches`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': `dine_auth_token=${ownerToken}`
        },
        body: JSON.stringify({
            id: approvedBranch.id,
            assignAdmin: true,
            adminName: 'Assigned Restaurant Admin',
            adminEmail: uniqueEmail,
            adminMobile: uniquePhone,
            adminPassword: 'TestPassword123!',
            adminPin: '5678'
        })
    });

    const assignJson = await assignRes.json();
    testAssert(assignRes.status === 200, `PUT /api/owner/branches returned 200 (got ${assignRes.status})`);
    testAssert(assignJson.success === true, `Admin assignment succeeded: ${assignJson.message || 'OK'}`);
    testAssert(assignJson.admin && assignJson.admin.branch_id === approvedBranch.id, 
        `Assigned Admin has exact approved branch_id: '${assignJson.admin?.branch_id}' == '${approvedBranch.id}'`);

    const createdAdminId = assignJson.admin?.id;

    // Verify in DB directly
    const { data: dbAdmin } = await supabaseAdmin
        .from('employees')
        .select('*')
        .eq('id', createdAdminId)
        .single();

    testAssert(dbAdmin && dbAdmin.branch_id === approvedBranch.id, 
        `Database employee record has exact foreign-key branch_id '${approvedBranch.id}'`);
    testAssert(dbAdmin && dbAdmin.role === 'restaurant_admin', `Employee role is 'restaurant_admin'`);

    // Step 4: Verify Restaurant Admin Appears in Staff/Payroll
    console.log('\n--- Step 4: Verify Restaurant Admin Appears in Staff/Payroll Directory ---');
    // Admin login token
    const adminToken = await signTestJwt({
        sessionId: crypto.randomUUID(),
        userId: createdAdminId,
        restaurantId: TEST_RESTAURANT_ID,
        branch_id: approvedBranch.id,
        role: 'restaurant_admin',
        name: 'Assigned Restaurant Admin'
    });

    const listRes = await fetch(`${BASE_URL}/api/admin/employees?restaurantId=${TEST_RESTAURANT_ID}`, {
        headers: {
            'Cookie': `dine_auth_token=${adminToken}`
        }
    });

    const listJson = await listRes.json();
    testAssert(listRes.status === 200, `GET /api/admin/employees returns 200 OK (got ${listRes.status})`);
    testAssert(Array.isArray(listJson.employees), `Returned employees list is an array (length: ${listJson.employees?.length})`);

    const foundAdmin = listJson.employees?.find(e => e.id === createdAdminId || e.email === uniqueEmail);
    testAssert(foundAdmin !== undefined, `Assigned Restaurant Admin appears in Staff/Payroll directory`);
    testAssert(foundAdmin?.branch_id === approvedBranch.id, `Restaurant Admin listed with matching branch_id`);

    // Step 5: Update Salary and Overtime Wages via PUT /api/admin/employees
    console.log('\n--- Step 5: Update Salary, Overtime Wages, and Preserve Branch ID ---');
    const updateSalaryRes = await fetch(`${BASE_URL}/api/admin/employees`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': `dine_auth_token=${adminToken}`
        },
        body: JSON.stringify({
            id: createdAdminId,
            restaurantId: TEST_RESTAURANT_ID,
            name: 'Assigned Restaurant Admin Updated',
            monthly_salary: 45000,
            per_day_salary: 1500,
            overtime_per_hour: 300,
            weekly_off: 'monday',
            salary_type: 'monthly'
            // OMIT branch_id: must preserve existing valid branch_id!
        })
    });

    const updateSalaryJson = await updateSalaryRes.json();
    testAssert(updateSalaryRes.status === 200, `PUT /api/admin/employees update salary returned 200 (got ${updateSalaryRes.status})`);
    testAssert(!updateSalaryJson.error, `No foreign key or DB error: ${updateSalaryJson.error || 'None'}`);
    testAssert(updateSalaryJson.employee?.monthly_salary === 45000, `Monthly salary successfully updated to 45000`);
    testAssert(updateSalaryJson.employee?.overtime_per_hour === 300, `Overtime wage successfully updated to 300`);
    testAssert(updateSalaryJson.employee?.branch_id === approvedBranch.id, 
        `Existing valid branch_id preserved without modification ('${updateSalaryJson.employee?.branch_id}')`);

    // Step 6: Update with Authoritative TypeID / internal_id branch format
    console.log('\n--- Step 6: Update with Authoritative TypeID (internal_id) Translates to Valid FK Target ---');
    const updateWithInternalIdRes = await fetch(`${BASE_URL}/api/admin/employees`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': `dine_auth_token=${adminToken}`
        },
        body: JSON.stringify({
            id: createdAdminId,
            restaurantId: TEST_RESTAURANT_ID,
            branch_id: approvedBranch.internal_id, // e.g. brn_01...
            monthly_salary: 48000,
            overtime_per_hour: 350
        })
    });

    const updateInternalJson = await updateWithInternalIdRes.json();
    testAssert(updateWithInternalIdRes.status === 200, `PUT with internal_id returns 200 OK without FK error`);
    testAssert(updateInternalJson.employee?.branch_id === approvedBranch.id, 
        `internal_id correctly translated to FK target '${approvedBranch.id}' without constraint error`);
    testAssert(updateInternalJson.employee?.monthly_salary === 48000, `Monthly salary updated to 48000`);

    // Step 7: Update Attempt with Invalid String / Restaurant ID Preserves Valid Branch
    console.log('\n--- Step 7: Update Attempt with restaurant_id as branch_id is Prevented from FK Error ---');
    const updateWithRestIdRes = await fetch(`${BASE_URL}/api/admin/employees`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': `dine_auth_token=${adminToken}`
        },
        body: JSON.stringify({
            id: createdAdminId,
            restaurantId: TEST_RESTAURANT_ID,
            branch_id: TEST_RESTAURANT_ID, // Passing restaurant_id as branch_id
            monthly_salary: 50000,
            overtime_per_hour: 400
        })
    });

    const updateRestIdJson = await updateWithRestIdRes.json();
    testAssert(updateWithRestIdRes.status === 200, `PUT with restaurant_id as branch_id returned 200 without FK violation`);
    testAssert(updateRestIdJson.employee?.branch_id === approvedBranch.id, 
        `Resolved or preserved valid branch_id '${approvedBranch.id}' rather than corrupting DB`);
    testAssert(updateRestIdJson.employee?.monthly_salary === 50000, `Salary updated to 50000`);

    // Step 8: Update via Owner API route (PUT /api/owner/employees) with salary & overtime wages
    console.log('\n--- Step 8: Update via Owner Route (PUT /api/owner/employees) Preserves Branch ---');
    const ownerEmpUpdateRes = await fetch(`${BASE_URL}/api/owner/employees`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': `dine_auth_token=${ownerToken}`
        },
        body: JSON.stringify({
            id: createdAdminId,
            name: 'Assigned Restaurant Admin Final',
            monthly_salary: 52000,
            overtime_per_hour: 420
        })
    });

    const ownerEmpUpdateJson = await ownerEmpUpdateRes.json();
    testAssert(ownerEmpUpdateRes.status === 200, `PUT /api/owner/employees returned 200 (got ${ownerEmpUpdateRes.status})`);
    testAssert(ownerEmpUpdateJson.employee?.name === 'Assigned Restaurant Admin Final', `Employee name updated via owner route`);

    // Verify DB state after all updates
    const { data: finalDbEmp } = await supabaseAdmin
        .from('employees')
        .select('*')
        .eq('id', createdAdminId)
        .single();

    testAssert(finalDbEmp.monthly_salary === 52000, `Final monthly salary in DB is 52000`);
    testAssert(finalDbEmp.overtime_per_hour === 420, `Final overtime wage in DB is 420`);
    testAssert(finalDbEmp.branch_id === approvedBranch.id, `Final branch_id in DB is still valid '${approvedBranch.id}'`);

    // Cleanup test record
    console.log('\n--- Cleanup: Deleting Test Admin ---');
    await supabaseAdmin.from('employees').delete().eq('id', createdAdminId);
    await supabaseAdmin.from('employee_branch_access').delete().eq('employee_id', createdAdminId);
    await supabaseAdmin.from('dine_users').delete().eq('id', createdAdminId);
    await supabaseAdmin.from('auth').delete().eq('user_id', createdAdminId);
    console.log('  Cleaned up test admin record.');

    console.log('\n========================================================================');
    console.log(`Test Results: ${passed} passed, ${failed} failed`);
    console.log('========================================================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Test script error:', err);
    process.exit(1);
});
