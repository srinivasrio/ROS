#!/usr/bin/env node

/**
 * test_branch_admin_credentials_separation.mjs
 * 
 * Verifies that when an Owner sets or updates branch credentials:
 * 1. The Owner's employee record is NEVER treated as the branch admin or modified into a restaurant_admin.
 * 2. New branch credentials (e.g. admin@srinivasinn.com) are provisioned into a separate restaurant_admin record.
 * 3. The newly created restaurant_admin can log in at /api/auth/admin/login.
 * 4. The Owner can still log in with their original owner credentials.
 * 5. Attempting to assign the Owner's own email as admin returns 409 Conflict.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://72.61.250.231:8010';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = 'http://localhost:3000';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const OWNER_EMAIL = 'riosrinivas8247@gmail.com';
const OWNER_PASSWORD = 'Sree@1725';
const OWNER_ID = '29774d5c-4bc9-4160-9c6a-3b2c0ef33b10';
const RESTAURANT_ID = '202609089153';
const BRANCH_ADMIN_EMAIL = 'admin@srinivasinn.com';
const BRANCH_ADMIN_PASSWORD = 'AdminPassword@123';
const BRANCH_ADMIN_PIN = '4321';

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
    if (condition) {
        console.log(`  ✅ PASS: ${testName}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${testName} - ${details}`);
        failed++;
    }
}

async function run() {
    console.log('================================================================');
    console.log('🧪 VERIFYING BRANCH ADMIN CREDENTIALS & OWNER SEPARATION');
    console.log('================================================================\n');

    // 1. Owner Login
    console.log('--- Step 1: Owner Authentication ---');
    const ownerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: OWNER_EMAIL,
            password: OWNER_PASSWORD,
            role: 'owner'
        })
    });
    const ownerLoginData = await ownerLoginRes.json();
    const ownerCookie = ownerLoginRes.headers.get('set-cookie');
    assert(ownerLoginRes.status === 200, 'Owner logs in successfully', `Status: ${ownerLoginRes.status}`);
    assert(ownerLoginData.user?.role === 'owner', 'Owner role is strictly "owner"', `Role: ${ownerLoginData.user?.role}`);
    assert(ownerLoginData.user?.id === OWNER_ID, 'Owner ID matches expected', `ID: ${ownerLoginData.user?.id}`);

    // 2. Assign / Update Branch Admin Credentials
    console.log('\n--- Step 2: Assign Branch Admin Credentials via PUT /api/owner/branches ---');
    const putRes = await fetch(`${BASE_URL}/api/owner/branches`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': ownerCookie
        },
        body: JSON.stringify({
            id: RESTAURANT_ID,
            assignAdmin: true,
            adminName: 'Srinivas Inn Admin',
            adminEmail: BRANCH_ADMIN_EMAIL,
            adminMobile: '9515816084',
            adminPassword: BRANCH_ADMIN_PASSWORD,
            adminPin: BRANCH_ADMIN_PIN
        })
    });
    const putData = await putRes.json();
    assert(putRes.status === 200, 'PUT /api/owner/branches succeeds with 200 OK', `Status: ${putRes.status}, Error: ${putData.error}`);
    assert(putData.success === true, 'PUT returns success: true');
    assert(putData.admin?.email === BRANCH_ADMIN_EMAIL, 'Admin email matches target email', `Email: ${putData.admin?.email}`);
    assert(putData.admin?.id !== OWNER_ID, 'Assigned Admin ID is distinct from Owner ID', `Admin ID: ${putData.admin?.id}, Owner ID: ${OWNER_ID}`);

    // 3. Database Role Integrity Check
    console.log('\n--- Step 3: Database Integrity Verification ---');
    const { data: ownerEmp } = await supabase.from('employees').select('id, name, email, role, mobile').eq('id', OWNER_ID).single();
    assert(ownerEmp?.role === 'owner', 'Owner employee record role remains strictly "owner"', `Role: ${ownerEmp?.role}`);
    assert(ownerEmp?.email === OWNER_EMAIL, 'Owner employee record email remains unchanged', `Email: ${ownerEmp?.email}`);

    const { data: adminEmp } = await supabase.from('employees').select('id, name, email, role, mobile, restaurant_id').eq('email', BRANCH_ADMIN_EMAIL).single();
    assert(adminEmp?.role === 'restaurant_admin', 'New admin record has role: "restaurant_admin"', `Role: ${adminEmp?.role}`);
    assert(adminEmp?.id !== OWNER_ID, 'New admin record has distinct UUID from Owner', `Admin UUID: ${adminEmp?.id}`);
    assert(adminEmp?.restaurant_id === RESTAURANT_ID, 'New admin record linked to restaurant', `Rest ID: ${adminEmp?.restaurant_id}`);

    // 4. Admin Login Portal Test
    console.log('\n--- Step 4: Restaurant Admin Login Portal Verification ---');
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: BRANCH_ADMIN_EMAIL,
            password: BRANCH_ADMIN_PASSWORD,
            pin: BRANCH_ADMIN_PIN
        })
    });
    const adminLoginData = await adminLoginRes.json();
    assert(adminLoginRes.status === 200, 'Restaurant Admin login succeeds with 200 OK', `Status: ${adminLoginRes.status}`);
    assert(adminLoginData.success === true, 'Admin login response has success: true');
    assert(adminLoginData.user?.role === 'restaurant_admin', 'Admin login user role is "restaurant_admin"', `Role: ${adminLoginData.user?.role}`);

    // 5. Conflict Test: Cannot assign Owner email as Restaurant Admin
    console.log('\n--- Step 5: Conflict Prevention Test ---');
    const conflictRes = await fetch(`${BASE_URL}/api/owner/branches`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': ownerCookie
        },
        body: JSON.stringify({
            id: RESTAURANT_ID,
            assignAdmin: true,
            adminName: 'Conflict Tester',
            adminEmail: OWNER_EMAIL,
            adminPassword: 'Password@123'
        })
    });
    const conflictData = await conflictRes.json();
    assert(conflictRes.status === 409, 'Rejects assigning Owner email as Restaurant Admin with 409 Conflict', `Status: ${conflictRes.status}`);
    assert(Boolean(conflictData.error), 'Returns explicit conflict error message', `Error: ${conflictData.error}`);

    // 6. Subsequent Admin Update
    console.log('\n--- Step 6: Subsequent Admin Update Test ---');
    const updateRes = await fetch(`${BASE_URL}/api/owner/branches`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': ownerCookie
        },
        body: JSON.stringify({
            id: RESTAURANT_ID,
            assignAdmin: true,
            adminId: adminEmp.id,
            adminName: 'Srinivas Inn Chief Admin',
            adminEmail: BRANCH_ADMIN_EMAIL,
            adminPassword: 'UpdatedPassword@123',
            adminPin: '9876'
        })
    });
    const updateData = await updateRes.json();
    assert(updateRes.status === 200, 'Subsequent admin update succeeds with 200 OK', `Status: ${updateRes.status}`);
    assert(updateData.admin?.name === 'Srinivas Inn Chief Admin', 'Admin name updated successfully', `Name: ${updateData.admin?.name}`);

    // Final check on Owner
    const { data: finalOwner } = await supabase.from('employees').select('id, role, email').eq('id', OWNER_ID).single();
    assert(finalOwner?.role === 'owner' && finalOwner?.email === OWNER_EMAIL, 'Owner account remains completely untouched after all operations');

    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED / ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) process.exit(1);
}

run().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
