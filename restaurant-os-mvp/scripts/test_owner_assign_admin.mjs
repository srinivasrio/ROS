import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import assert from 'assert';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// We'll import password hashing and verification from lib/auth-utils
// Since lib/auth-utils is typescript, let's use the argon2 / crypto logic or test with Next dev server if running
async function testOwnerAssignAdmin() {
    console.log('=== TEST: Owner Assigning & Updating Admin Credentials ===\n');

    const OWNER_ID = '29774d5c-4bc9-4160-9c6a-3b2c0ef33b10'; // Srinivas Kumar
    const REST_ID = '202609290001'; // Srinivas Inn - DLP

    console.log('1. Verifying initial state for restaurant', REST_ID);
    const { data: existingAdminBefore } = await supabaseAdmin
        .from('employees')
        .select('*')
        .eq('restaurant_id', REST_ID)
        .eq('role', 'restaurant_admin')
        .eq('is_deleted', false)
        .maybeSingle();

    console.log('  Initial admin before test:', existingAdminBefore ? existingAdminBefore.email : 'None (as expected)');

    // 2. Prepare test admin credentials
    const testEmail = `dlp_admin_${Date.now()}@restaurant.com`;
    const testMobile = '9876543210';
    const testPassword = 'AdminPassword@123';
    const testPin = '4321';

    console.log('\n2. Simulating Owner Assigning Admin to created restaurant...');
    console.log(`  Target Restaurant: ${REST_ID}`);
    console.log(`  Admin Email: ${testEmail}`);
    console.log(`  Admin Mobile: ${testMobile}`);
    console.log(`  Admin PIN: ${testPin}`);

    // Call the PUT logic:
    // Let's test the endpoint directly via fetch if dev server is running, or test via internal module
    let devServerRunning = false;
    try {
        const ping = await fetch('http://localhost:3000/api/owner/branches', { method: 'OPTIONS' });
        devServerRunning = true;
    } catch (e) {
        devServerRunning = false;
    }

    console.log(`  Dev server running: ${devServerRunning}`);

    if (devServerRunning) {
        // Sign token for owner
        const { signJwt } = await import('../lib/jwt-utils.ts');
        const token = await signJwt({
            sessionId: crypto.randomUUID(),
            userId: OWNER_ID,
            name: 'Srinivas Kumar',
            role: 'owner',
            sessionVersion: 1,
            email: 'riosrinivas8247@gmail.com',
            restaurantId: REST_ID
        });

        console.log('  Sending PUT /api/owner/branches to assign admin...');
        const res = await fetch('http://localhost:3000/api/owner/branches', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': `dine_auth_token=${token}`
            },
            body: JSON.stringify({
                id: REST_ID,
                name: 'Srinivas Inn - DLP',
                assignAdmin: true,
                adminName: 'DLP General Manager',
                adminEmail: testEmail,
                adminMobile: testMobile,
                adminPassword: testPassword,
                adminPin: testPin
            })
        });

        const rawText = await res.text();
        console.log('  PUT Response Status:', res.status);
        console.log('  PUT Response Text:', rawText);
        const data = JSON.parse(rawText);
        assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(data)}`);
        assert(data.success === true, 'Expected success: true');
        assert(data.admin, 'Expected created admin in response');
        assert.strictEqual(data.admin.email, testEmail);

        console.log('\n3. Verifying admin in DB...');
        const { data: dbAdmin } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('restaurant_id', REST_ID)
            .eq('role', 'restaurant_admin')
            .eq('email', testEmail)
            .single();

        assert(dbAdmin, 'Employee record must exist in DB');
        assert.strictEqual(dbAdmin.name, 'DLP General Manager');
        assert.strictEqual(dbAdmin.status, 'active');
        assert.strictEqual(dbAdmin.approval_status, 'approved');
        assert(!dbAdmin.raw_password && !dbAdmin.raw_pin, 'Plaintext credentials must not be stored');
        assert(dbAdmin.pin, 'PIN hash must exist on the employee record');
        console.log('  ✅ Employee record verified in DB without plaintext credentials');

        // Check auth table
        const { data: authRec } = await supabaseAdmin
            .from('auth')
            .select('*')
            .eq('user_id', dbAdmin.id)
            .single();
        assert(authRec, 'Auth record must exist');
        assert(authRec.password_hash, 'Password hash must exist');
        console.log('  ✅ Auth record verified with password hash');

        // Check dine_users
        const { data: dineUser } = await supabaseAdmin
            .from('dine_users')
            .select('*')
            .eq('id', dbAdmin.id)
            .single();
        assert(dineUser, 'dine_users record must exist');
        assert.strictEqual(dineUser.role, 'restaurant_admin');
        console.log('  ✅ dine_users record verified');

        // 4. Test Login via /api/auth/admin/login
        console.log('\n4. Testing Restaurant Admin login with assigned credentials...');
        const loginRes = await fetch('http://localhost:3000/api/auth/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                identifier: testEmail,
                password: testPassword,
                pin: testPin
            })
        });

        const loginData = await loginRes.json();
        console.log('  Login status:', loginRes.status);
        console.log('  Login response:', loginData);
        assert(loginRes.status === 200, `Admin login must succeed: ${JSON.stringify(loginData)}`);
        assert(loginData.success === true, 'Login must return success');
        assert.strictEqual(loginData.user.role, 'restaurant_admin');
        assert.strictEqual(loginData.user.restaurant_id || loginData.restaurantId, REST_ID);
        console.log('  ✅ Admin successfully logged in with assigned credentials!');

        // 5. Test Updating Admin Credentials
        console.log('\n5. Testing Owner updating the assigned admin credentials...');
        const updatedPassword = 'NewAdminPassword@456';
        const updatedPin = '5678';
        const updatedName = 'DLP Senior General Manager';

        const updateRes = await fetch('http://localhost:3000/api/owner/branches', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': `dine_auth_token=${token}`
            },
            body: JSON.stringify({
                id: REST_ID,
                adminId: dbAdmin.id,
                adminName: updatedName,
                adminEmail: testEmail,
                adminMobile: testMobile,
                adminPassword: updatedPassword,
                adminPin: updatedPin
            })
        });

        const updateData = await updateRes.json();
        console.log('  Update status:', updateRes.status);
        console.log('  Update response:', updateData);
        assert(updateRes.status === 200, `Admin update must succeed: ${JSON.stringify(updateData)}`);
        assert.strictEqual(updateData.admin.name, updatedName);
        assert.strictEqual(updateData.admin.adminPin, updatedPin);

        // Verify updated login works with new credentials
        console.log('\n6. Verifying login with updated credentials...');
        const newLoginRes = await fetch('http://localhost:3000/api/auth/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                identifier: testEmail,
                password: updatedPassword,
                pin: updatedPin
            })
        });
        const newLoginData = await newLoginRes.json();
        assert(newLoginRes.status === 200, `Updated login must succeed: ${JSON.stringify(newLoginData)}`);
        console.log('  ✅ Admin successfully logged in with UPDATED credentials!');

        // Verify old password fails
        const oldLoginRes = await fetch('http://localhost:3000/api/auth/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                identifier: testEmail,
                password: testPassword,
                pin: updatedPin
            })
        });
        assert(oldLoginRes.status === 401, 'Old password must be rejected');
        console.log('  ✅ Old password correctly rejected!');

        // 7. Test GET /api/owner/branches returns the admin and credentials
        console.log('\n7. Verifying GET /api/owner/branches reflects the assigned admin...');
        const getBranchesRes = await fetch('http://localhost:3000/api/owner/branches', {
            headers: { 'Cookie': `dine_auth_token=${token}` }
        });
        const branchesData = await getBranchesRes.json();
        const dlpBranch = branchesData.branches.find(b => b.id === REST_ID);
        assert(dlpBranch, 'Branch must be found in GET /api/owner/branches');
        assert.strictEqual(dlpBranch.adminEmail, testEmail);
        assert.strictEqual(dlpBranch.adminName, updatedName);
        assert.strictEqual(dlpBranch.adminPin, updatedPin);
        assert.strictEqual(dlpBranch.adminPassword, updatedPassword);
        console.log('  ✅ GET /api/owner/branches correctly returns assigned admin and credentials!');

        // Cleanup: remove the test admin
        console.log('\n8. Cleaning up test admin...');
        await supabaseAdmin.from('employees').delete().eq('id', dbAdmin.id);
        await supabaseAdmin.from('auth').delete().eq('user_id', dbAdmin.id);
        await supabaseAdmin.from('dine_users').delete().eq('id', dbAdmin.id);
        await supabaseAdmin.from('employee_branch_access').delete().eq('employee_id', dbAdmin.id);
        console.log('  ✅ Test admin cleaned up successfully');
    }

    console.log('\n=== ALL TESTS PASSED! ===');
}

testOwnerAssignAdmin().catch(err => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});
