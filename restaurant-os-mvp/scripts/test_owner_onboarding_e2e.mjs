import crypto from 'crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: 'super-admin/.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmcsygpphwdubnanwjwz.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is required');
const ADMIN_BASE_URL = 'http://control.localhost:3005';
const MAIN_BASE_URL = 'http://localhost:3000';

if (!SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

function base64UrlEncode(str) {
    const base64 = Buffer.from(str).toString('base64');
    return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signSuperAdminJwt() {
    const payload = {
        userId: 'superadmin-master',
        role: 'SUPER_ADMIN',
        email: 'superadmin-test@dineinone.com',
        exp: Math.floor(Date.now() / 1000) + 3600
    };
    const header = { alg: 'HS256', typ: 'JWT' };
    const encHeader = base64UrlEncode(JSON.stringify(header));
    const encPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${encHeader}.${encPayload}`).digest('base64');
    const encSig = signature.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${encHeader}.${encPayload}.${encSig}`;
}

async function runOwnerFlowTest(ownerIndex) {
    const timestamp = Date.now();
    const ownerEmail = `test.owner${ownerIndex}.${timestamp}@dineinone.test`;
    const ownerName = `Test Owner ${ownerIndex}`;
    const ownerPhone = `9876543${String(ownerIndex).padStart(2, '0')}${String(timestamp).slice(-1)}`;
    const ownerPassword = `TestOwnerPass@${ownerIndex}123`;
    const superAdminToken = signSuperAdminJwt();

    console.log(`\n========================================================================`);
    console.log(`🚀 STARTING COMPLETE ONBOARDING & REGISTRATION TEST FOR OWNER ${ownerIndex}`);
    console.log(`Email: ${ownerEmail} | Name: ${ownerName}`);
    console.log(`========================================================================\n`);

    // -------------------------------------------------------------------------
    // Step 1: Super Admin creates Owner
    // -------------------------------------------------------------------------
    console.log(`[Step 1] Super Admin creates Owner account via POST /api/admin/owners...`);
    const createOwnerRes = await fetch(`${ADMIN_BASE_URL}/api/admin/owners`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${superAdminToken}`,
            'Cookie': `superadmin_token=${superAdminToken}`
        },
        body: JSON.stringify({
            name: ownerName,
            email: ownerEmail,
            phone: ownerPhone,
            password: ownerPassword,
            status: 'pending',
            approvalStatus: 'pending',
            maxBranches: 0
        })
    });

    const createOwnerJson = await createOwnerRes.json();
    if (!createOwnerRes.ok || !createOwnerJson.success) {
        throw new Error(`Failed to create owner: ${JSON.stringify(createOwnerJson)}`);
    }

    const ownerId = createOwnerJson.ownerId;
    console.log(`✅ Owner created successfully! Owner ID: ${ownerId}`);

    // -------------------------------------------------------------------------
    // Step 2: Verify Owner has 0 restaurants
    // -------------------------------------------------------------------------
    console.log(`\n[Step 2] Verifying Owner has 0 restaurants and pending status in Database...`);
    
    // Check restaurants table
    const { data: dbRestaurants, error: restErr } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', ownerId)
        .is('deleted_at', null);

    if (restErr) throw new Error(`Database error fetching restaurants: ${restErr.message}`);
    console.log(`   Database restaurants count for owner: ${dbRestaurants.length}`);
    if (dbRestaurants.length !== 0) {
        throw new Error(`❌ VIOLATION: Owner has ${dbRestaurants.length} restaurants upon creation! Expected 0.`);
    }

    // Check restaurant_users
    const { data: dbRu } = await supabase
        .from('restaurant_users')
        .select('*')
        .eq('user_id', ownerId);
    console.log(`   restaurant_users count for owner: ${dbRu?.length || 0}`);
    if (dbRu && dbRu.length > 0) {
        throw new Error(`❌ VIOLATION: Found restaurant_users entries for owner before any restaurant creation!`);
    }

    // Check employees table
    const { data: empRecord } = await supabase
        .from('employees')
        .select('*')
        .eq('id', ownerId)
        .single();

    console.log(`   Owner employee record: status=${empRecord?.status}, approval_status=${empRecord?.approval_status}, max_branches=${empRecord?.max_branches}`);
    if (empRecord.status !== 'pending' || empRecord.approval_status !== 'pending') {
        throw new Error(`❌ VIOLATION: New owner should be pending approval! Got status=${empRecord.status}, approval=${empRecord.approval_status}`);
    }
    console.log(`✅ Verified: Owner has 0 restaurants and is properly pending approval.`);

    // -------------------------------------------------------------------------
    // Step 3: Approve Owner
    // -------------------------------------------------------------------------
    console.log(`\n[Step 3] Super Admin approves Owner account via PATCH /api/admin/owners...`);
    const approveOwnerRes = await fetch(`${ADMIN_BASE_URL}/api/admin/owners`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${superAdminToken}`,
            'Cookie': `superadmin_token=${superAdminToken}`
        },
        body: JSON.stringify({
            ownerId,
            action: 'approve_owner'
        })
    });

    const approveOwnerJson = await approveOwnerRes.json();
    if (!approveOwnerRes.ok || !approveOwnerJson.success) {
        throw new Error(`Failed to approve owner: ${JSON.stringify(approveOwnerJson)}`);
    }
    console.log(`✅ Owner approved by Super Admin: ${approveOwnerJson.message}`);

    // Verify after approval: Still 0 restaurants!
    const { data: restAfterApprove } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', ownerId)
        .is('deleted_at', null);
    if (restAfterApprove.length !== 0) {
        throw new Error(`❌ VIOLATION: Restaurant was auto-created during Owner approval! Count: ${restAfterApprove.length}`);
    }
    console.log(`✅ Confirmed: Approving owner did NOT auto-create any restaurant records.`);

    // -------------------------------------------------------------------------
    // Step 4: Owner logs in
    // -------------------------------------------------------------------------
    console.log(`\n[Step 4] Owner logs in via POST /api/auth/admin/login with panel: 'owner'...`);
    const loginRes = await fetch(`${MAIN_BASE_URL}/api/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            identifier: ownerEmail,
            password: ownerPassword,
            panel: 'owner'
        })
    });

    const loginJson = await loginRes.json();
    if (!loginRes.ok || !loginJson.user) {
        throw new Error(`Owner login failed: ${JSON.stringify(loginJson)}`);
    }

    const setCookie = loginRes.headers.get('set-cookie') || '';
    const tokenMatch = setCookie.match(/dine_auth_token=([^;]+)/);
    const ownerAuthToken = tokenMatch ? tokenMatch[1] : null;

    if (!ownerAuthToken) {
        throw new Error(`Login succeeded but did not receive dine_auth_token cookie!`);
    }
    console.log(`✅ Owner logged in successfully! Received auth session token.`);

    // -------------------------------------------------------------------------
    // Step 5: Verify 0 restaurants / 0 active restaurants / 0 used quota
    // -------------------------------------------------------------------------
    console.log(`\n[Step 5] Checking Owner panel init & branches endpoints...`);
    
    // Call GET /api/owner/init
    const initRes = await fetch(`${MAIN_BASE_URL}/api/owner/init`, {
        headers: {
            'Authorization': `Bearer ${ownerAuthToken}`,
            'Cookie': `dine_auth_token=${ownerAuthToken}`
        }
    });
    const initJson = await initRes.json();
    if (!initRes.ok) throw new Error(`/api/owner/init failed: ${JSON.stringify(initJson)}`);

    console.log(`   /api/owner/init response:`);
    console.log(`     restaurant: ${initJson.restaurant}`);
    console.log(`     activeBranchesCount: ${initJson.activeBranchesCount}`);
    console.log(`     restaurants list: ${initJson.restaurants?.length || 0}`);
    console.log(`     branchLimits:`, initJson.branchLimits);

    if (initJson.restaurant !== null) {
        throw new Error(`❌ VIOLATION: /api/owner/init returned primary restaurant! Expected null.`);
    }
    if (initJson.activeBranchesCount !== 0) {
        throw new Error(`❌ VIOLATION: activeBranchesCount is ${initJson.activeBranchesCount}, expected 0.`);
    }
    if ((initJson.restaurants || []).length !== 0) {
        throw new Error(`❌ VIOLATION: restaurants list has ${initJson.restaurants.length} items, expected 0.`);
    }

    // Call GET /api/owner/branches
    const branchesRes = await fetch(`${MAIN_BASE_URL}/api/owner/branches`, {
        headers: {
            'Authorization': `Bearer ${ownerAuthToken}`,
            'Cookie': `dine_auth_token=${ownerAuthToken}`
        }
    });
    const branchesJson = await branchesRes.json();
    if (!branchesRes.ok) throw new Error(`/api/owner/branches failed: ${JSON.stringify(branchesJson)}`);

    console.log(`   /api/owner/branches response:`);
    console.log(`     branches count: ${branchesJson.branches?.length || 0}`);
    console.log(`     pendingRequests count: ${branchesJson.pendingRequests?.length || 0}`);
    console.log(`     branchLimits currentCount (used quota): ${branchesJson.branchLimits?.currentCount}`);
    console.log(`     canCreate: ${branchesJson.branchLimits?.canCreate}`);

    if ((branchesJson.branches || []).length !== 0) {
        throw new Error(`❌ VIOLATION: branches list has ${branchesJson.branches.length} items, expected 0.`);
    }
    if (branchesJson.branchLimits?.currentCount !== 0) {
        throw new Error(`❌ VIOLATION: used quota currentCount is ${branchesJson.branchLimits?.currentCount}, expected 0.`);
    }
    if (!branchesJson.branchLimits?.canCreate) {
        throw new Error(`❌ VIOLATION: New owner should be allowed to create their first restaurant!`);
    }

    console.log(`✅ Verified: 0 restaurants, 0 active restaurants, 0 used quota.`);

    // -------------------------------------------------------------------------
    // Step 6: Verify no restaurant was automatically created in DB
    // -------------------------------------------------------------------------
    console.log(`\n[Step 6] Double-checking DB for any auto-created restaurants after login...`);
    const { data: dbRestAfterLogin } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', ownerId)
        .is('deleted_at', null);

    if (dbRestAfterLogin.length !== 0) {
        throw new Error(`❌ VIOLATION: Restaurant was auto-created during first login!`);
    }
    console.log(`✅ Confirmed: 0 restaurants exist in database.`);

    // -------------------------------------------------------------------------
    // Step 7 & 8: Owner manually creates Restaurant 1 & submits registration request
    // -------------------------------------------------------------------------
    const restaurantName = `Royal Bistro Branch ${ownerIndex}`;
    const restaurantPhone = `9123456${String(ownerIndex).padStart(2, '0')}${String(timestamp).slice(-1)}`;
    const adminEmail = `bistro${ownerIndex}.admin.${timestamp}@dineinone.test`;

    console.log(`\n[Step 7 & 8] Owner explicitly creates Restaurant 1 ("${restaurantName}") with Standard Plan via POST /api/owner/branches...`);
    const createBranchRes = await fetch(`${MAIN_BASE_URL}/api/owner/branches`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ownerAuthToken}`,
            'Cookie': `dine_auth_token=${ownerAuthToken}`
        },
        body: JSON.stringify({
            name: restaurantName,
            phone: restaurantPhone,
            email: `contact.${ownerEmail}`,
            address: `${ownerIndex * 100} MG Road, Hyderabad, Telangana`,
            planSlug: 'standard',
            paymentMethod: 'UPI',
            paymentReference: `UPI-UTR-${ownerIndex}-${timestamp}`,
            adminName: `${restaurantName} Manager`,
            adminEmail,
            adminMobile: restaurantPhone,
            adminPin: '4321',
            adminPassword: `AdminPass@${ownerIndex}123`
        })
    });

    const createBranchJson = await createBranchRes.json();
    if (!createBranchRes.ok || !createBranchJson.success) {
        throw new Error(`Failed to submit restaurant registration: ${JSON.stringify(createBranchJson)}`);
    }

    const createdRestaurantId = createBranchJson.restaurantId;
    const registrationRequestId = createBranchJson.requestId;
    console.log(`✅ Registration request submitted!`);
    console.log(`   Restaurant ID: ${createdRestaurantId} (Length: ${createdRestaurantId.length})`);
    console.log(`   Request ID: ${registrationRequestId}`);
    console.log(`   Status: ${createBranchJson.status}`);

    if (createdRestaurantId.length !== 12) {
        throw new Error(`❌ VIOLATION: Restaurant ID should be 12 digits! Got: ${createdRestaurantId}`);
    }

    // Verify status in DB: MUST BE 'PENDING', NOT 'ACTIVE'!
    const { data: dbRestPending } = await supabase
        .from('restaurants')
        .select('id, name, status, subscription_plan')
        .eq('id', createdRestaurantId)
        .single();

    console.log(`   DB Restaurant Status: ${dbRestPending.status}`);
    if (dbRestPending.status !== 'PENDING') {
        throw new Error(`❌ VIOLATION: Newly submitted restaurant should have status 'PENDING'! Got: ${dbRestPending.status}`);
    }

    // Verify registration request in DB
    const { data: dbRegReq } = await supabase
        .from('restaurant_registration_requests')
        .select('*')
        .eq('id', registrationRequestId)
        .single();

    console.log(`   DB Registration Request: ${dbRegReq.request_number} | approval_status=${dbRegReq.approval_status} | payment_status=${dbRegReq.payment_status}`);
    if (dbRegReq.approval_status !== 'PENDING_APPROVAL') {
        throw new Error(`❌ VIOLATION: Registration request should be PENDING_APPROVAL! Got: ${dbRegReq.approval_status}`);
    }

    // Verify that Owner Panel does NOT show this restaurant as active yet!
    const branchesPendingRes = await fetch(`${MAIN_BASE_URL}/api/owner/branches`, {
        headers: {
            'Authorization': `Bearer ${ownerAuthToken}`,
            'Cookie': `dine_auth_token=${ownerAuthToken}`
        }
    });
    const branchesPendingJson = await branchesPendingRes.json();
    console.log(`   Active branches displayed in UI while pending: ${branchesPendingJson.branches?.length || 0}`);
    console.log(`   Pending requests displayed in UI: ${branchesPendingJson.pendingRequests?.length || 0}`);
    console.log(`   Current quota count (used): ${branchesPendingJson.branchLimits?.currentCount}`);

    if ((branchesPendingJson.branches || []).length !== 0) {
        throw new Error(`❌ VIOLATION: Unapproved pending restaurant showed up in active branches grid!`);
    }
    if ((branchesPendingJson.pendingRequests || []).length === 0) {
        throw new Error(`❌ VIOLATION: Pending request should appear under pendingRequests!`);
    }
    if (branchesPendingJson.branchLimits?.currentCount !== 0) {
        throw new Error(`❌ VIOLATION: Quota was consumed before Super Admin approval! Used: ${branchesPendingJson.branchLimits?.currentCount}`);
    }
    console.log(`✅ Quota remains 0 used before Super Admin approval.`);

    // -------------------------------------------------------------------------
    // Step 9: Super Admin approves the restaurant registration request
    // -------------------------------------------------------------------------
    console.log(`\n[Step 9] Super Admin approves restaurant registration via PATCH /api/admin/subscriptions...`);
    const approveSubRes = await fetch(`${ADMIN_BASE_URL}/api/admin/subscriptions`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${superAdminToken}`,
            'Cookie': `superadmin_token=${superAdminToken}`
        },
        body: JSON.stringify({
            action: 'approve_registration',
            requestId: registrationRequestId
        })
    });

    const approveSubJson = await approveSubRes.json();
    if (!approveSubRes.ok || !approveSubJson.success) {
        throw new Error(`Failed to approve restaurant registration: ${JSON.stringify(approveSubJson)}`);
    }
    console.log(`✅ Super Admin approved restaurant registration: ${approveSubJson.message}`);

    // -------------------------------------------------------------------------
    // Step 10 & 11: Verify Restaurant 1 is ACTIVE and Quota changes only after approval
    // -------------------------------------------------------------------------
    console.log(`\n[Step 10 & 11] Verifying Restaurant 1 is ACTIVE and quota updated...`);

    // Verify DB status
    const { data: dbRestActive } = await supabase
        .from('restaurants')
        .select('id, name, status, subscription_plan, max_branches')
        .eq('id', createdRestaurantId)
        .single();

    console.log(`   DB Restaurant Status: ${dbRestActive.status} | Plan: ${dbRestActive.subscription_plan}`);
    if (dbRestActive.status !== 'ACTIVE') {
        throw new Error(`❌ VIOLATION: Approved restaurant should be ACTIVE! Got: ${dbRestActive.status}`);
    }

    // Verify Owner Panel API reflection
    // Re-login to refresh JWT token with updated restaurantIds claim
    const refreshLoginRes = await fetch(`${MAIN_BASE_URL}/api/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            identifier: ownerEmail,
            password: ownerPassword,
            panel: 'owner'
        })
    });
    const refreshedSetCookie = refreshLoginRes.headers.get('set-cookie') || '';
    const refreshedTokenMatch = refreshedSetCookie.match(/dine_auth_token=([^;]+)/);
    const refreshedOwnerToken = refreshedTokenMatch ? refreshedTokenMatch[1] : ownerAuthToken;

    const branchesApprovedRes = await fetch(`${MAIN_BASE_URL}/api/owner/branches`, {
        headers: {
            'Authorization': `Bearer ${refreshedOwnerToken}`,
            'Cookie': `dine_auth_token=${refreshedOwnerToken}`
        }
    });
    const branchesApprovedJson = await branchesApprovedRes.json();

    console.log(`   Owner branches after approval:`);
    console.log(`     Active branches: ${branchesApprovedJson.branches?.length}`);
    console.log(`     First branch name: ${branchesApprovedJson.branches[0]?.name}`);
    console.log(`     First branch ID: ${branchesApprovedJson.branches[0]?.id}`);
    console.log(`     Quota currentCount (used): ${branchesApprovedJson.branchLimits?.currentCount}`);
    console.log(`     Quota effectiveLimit: ${branchesApprovedJson.branchLimits?.effectiveLimit}`);
    console.log(`     Quota planName: ${branchesApprovedJson.branchLimits?.planName}`);

    if (branchesApprovedJson.branches.length !== 1) {
        throw new Error(`❌ VIOLATION: Expected exactly 1 active branch after approval, got ${branchesApprovedJson.branches.length}`);
    }
    if (branchesApprovedJson.branches[0].id !== createdRestaurantId) {
        throw new Error(`❌ VIOLATION: Branch ID mismatch! Expected ${createdRestaurantId}, got ${branchesApprovedJson.branches[0].id}`);
    }
    if (branchesApprovedJson.branchLimits?.currentCount !== 1) {
        throw new Error(`❌ VIOLATION: Quota used count should be 1 after approval! Got: ${branchesApprovedJson.branchLimits?.currentCount}`);
    }

    console.log(`✅ VERIFIED: Restaurant 1 appears correctly and quota reflects 1 used.`);

    // -------------------------------------------------------------------------
    // Cleanup Test Data (Preserving existing real data)
    // -------------------------------------------------------------------------
    console.log(`\n🧹 Cleaning up test records for Owner ${ownerIndex}...`);
    await supabase.from('tables').delete().eq('restaurant_id', createdRestaurantId);
    await supabase.from('restaurant_theme').delete().eq('restaurant_id', createdRestaurantId);
    await supabase.from('restaurant_profile').delete().eq('restaurant_id', createdRestaurantId);
    await supabase.from('subscriptions').delete().eq('restaurant_id', createdRestaurantId);
    await supabase.from('branches').delete().eq('restaurant_id', createdRestaurantId);
    await supabase.from('restaurant_users').delete().eq('restaurant_id', createdRestaurantId);
    await supabase.from('restaurant_registration_requests').delete().eq('restaurant_id', createdRestaurantId);
    await supabase.from('employees').delete().eq('restaurant_id', createdRestaurantId);
    await supabase.from('restaurants').delete().eq('id', createdRestaurantId);
    await supabase.from('employees').delete().eq('id', ownerId);
    await supabase.from('dine_users').delete().eq('id', ownerId);
    await supabase.from('auth').delete().eq('user_id', ownerId);
    console.log(`✅ Cleaned up test data for Owner ${ownerIndex}.`);

    return true;
}

async function main() {
    try {
        console.log('🏁 Starting Complete 12-Step Owner Onboarding & Registration Suite...\n');
        
        // Run full flow for Owner 1
        console.log('>>> TESTING OWNER 1 <<<');
        await runOwnerFlowTest(1);

        // Step 12: Repeat full flow for Owner 2
        console.log('\n>>> STEP 12: REPEATING TEST WITH OWNER 2 <<<');
        await runOwnerFlowTest(2);

        console.log('\n========================================================================');
        console.log('🎉 ALL 12 TEST STEPS PASSED SUCCESSFULLY FOR BOTH OWNERS!');
        console.log('Owner creation and Restaurant creation are 100% cleanly decoupled.');
        console.log('========================================================================\n');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ TEST RUN FAILED:', err);
        process.exit(1);
    }
}

main();
