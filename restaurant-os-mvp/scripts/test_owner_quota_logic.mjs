import crypto from 'crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load env
dotenv.config({ path: 'super-admin/.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmcsygpphwdubnanwjwz.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is required');
const ADMIN_BASE_URL = 'http://control.localhost:3005';
const MAIN_BASE_URL = 'http://localhost:3000';

if (!SERVICE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
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

function signOwnerJwt(userId, email, name, restaurantIds = []) {
    const payload = {
        userId,
        email,
        name,
        role: 'owner',
        restaurantIds,
        exp: Math.floor(Date.now() / 1000) + 3600
    };
    const header = { alg: 'HS256', typ: 'JWT' };
    const encHeader = base64UrlEncode(JSON.stringify(header));
    const encPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${encHeader}.${encPayload}`).digest('base64');
    const encSig = signature.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${encHeader}.${encPayload}.${encSig}`;
}

async function run() {
    console.log('========================================================================');
    console.log('🚀 VALIDATING OWNER QUOTA & SUBSCRIPTION LOGIC IN DINE IN ONE');
    console.log('========================================================================\n');

    const adminToken = signSuperAdminJwt();

    // -------------------------------------------------------------------------
    // TEST 1: Super Admin GET /api/admin/owners
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Check GET /api/admin/owners ---');
    const adminOwnersRes = await fetch(`${ADMIN_BASE_URL}/api/admin/owners`, {
        headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (!adminOwnersRes.ok) {
        throw new Error(`Failed to fetch /api/admin/owners: status ${adminOwnersRes.status}`);
    }
    const adminOwnersData = await adminOwnersRes.json();
    console.log(`✅ Loaded ${adminOwnersData.owners?.length} owners from /api/admin/owners.`);

    // 1A: Check non-subscription owners (e.g. Sunita)
    const sunita = adminOwnersData.owners.find(o => o.email === '24711f0024@necn.ac.in');
    if (sunita) {
        console.log(`Checking Sunita (no active subscription): Quota=${sunita.quota}, Used=${sunita.usedQuota}, Sub=${sunita.subscription}`);
        if (sunita.quota !== 0) throw new Error(`Sunita quota should be 0, got ${sunita.quota}`);
        if (sunita.usedQuota !== 0) throw new Error(`Sunita usedQuota should be 0, got ${sunita.usedQuota}`);
        if (sunita.remainingQuota !== 0) throw new Error(`Sunita remainingQuota should be 0, got ${sunita.remainingQuota}`);
        if (sunita.subscription !== 'No Active Subscription') throw new Error(`Sunita subscription should be 'No Active Subscription', got ${sunita.subscription}`);
        console.log('✅ Sunita correctly initialized with 0/0 and No Active Subscription!');
    }

    // 1B: Check existing subscription owners (e.g. Vikram Singhania)
    const vikram = adminOwnersData.owners.find(o => o.email === 'newowner_test@dineinone.com');
    if (vikram) {
        console.log(`Checking Vikram Singhania (active standard sub): Quota=${vikram.quota}, Used=${vikram.usedQuota}, Sub=${vikram.subscription}`);
        if (vikram.quota !== 3) throw new Error(`Vikram quota should be 3 (from active standard sub), got ${vikram.quota}`);
        if (vikram.subscription !== 'Standard') throw new Error(`Vikram subscription should be 'Standard', got ${vikram.subscription}`);
        console.log('✅ Vikram Singhania subscription and quota strictly preserved!');
    }

    // -------------------------------------------------------------------------
    // TEST 2: Create a brand new registered owner & approve via Super Admin
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: New Owner Registration & Super Admin Approval ---');
    const testOwnerId = crypto.randomUUID();
    const testEmail = `newowner.${Date.now()}@dineinone.test`;
    const testName = 'Quota Test Owner';
    const testReqNumber = `REQ-TEST-${Date.now().toString().slice(-4)}`;

    // Create pending employee & registration request in DB
    const { error: insEmpErr } = await supabase.from('employees').insert({
        id: testOwnerId,
        name: testName,
        email: testEmail,
        role: 'owner',
        status: 'pending',
        approval_status: 'pending',
        max_branches: 0,
        custom_quota: null
    });
    if (insEmpErr) throw new Error(`Failed to insert test employee: ${insEmpErr.message}`);

    const { data: testReq, error: insReqErr } = await supabase.from('restaurant_registration_requests').insert({
        request_number: testReqNumber,
        owner_id: testOwnerId,
        owner_name: testName,
        owner_email: testEmail,
        plan_slug: null,
        plan_name: 'No Active Subscription',
        plan_limit: 0,
        custom_quota: null,
        approval_status: 'PENDING_APPROVAL'
    }).select().single();
    if (insReqErr) throw new Error(`Failed to insert test registration request: ${insReqErr.message}`);

    console.log(`Created test registered owner ${testEmail} with initial 0/0 quota.`);

    // Approve the owner via PATCH /api/admin/owners
    const approveRes = await fetch(`${ADMIN_BASE_URL}/api/admin/owners`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'approve_owner',
            ownerId: testOwnerId,
            requestId: testReq.id,
            email: testEmail
        })
    });
    const approveData = await approveRes.json();
    if (!approveRes.ok || !approveData.success) {
        throw new Error(`Failed to approve owner: ${approveData.error || approveRes.statusText}`);
    }
    console.log(`✅ Approved owner via PATCH /api/admin/owners: ${approveData.message}`);

    // Verify employee record in DB has max_branches: 0, custom_quota: null, status: 'active'
    const { data: verifiedEmp } = await supabase.from('employees').select('status, approval_status, max_branches, custom_quota').eq('id', testOwnerId).single();
    console.log('Verified approved employee state in DB:', verifiedEmp);
    if (verifiedEmp.status !== 'active') throw new Error(`Expected status 'active', got ${verifiedEmp.status}`);
    if (verifiedEmp.max_branches !== 0) throw new Error(`Expected max_branches 0, got ${verifiedEmp.max_branches}`);
    if (verifiedEmp.custom_quota !== null) throw new Error(`Expected custom_quota null, got ${verifiedEmp.custom_quota}`);

    // Verify GET /api/admin/owners reflects 0/0 quota and no subscription
    const adminOwnersCheck = await fetch(`${ADMIN_BASE_URL}/api/admin/owners`, {
        headers: { Authorization: `Bearer ${adminToken}` }
    });
    const checkData = await adminOwnersCheck.json();
    const approvedCheck = checkData.owners.find(o => o.id === testOwnerId);
    if (!approvedCheck) throw new Error(`Newly approved owner ${testOwnerId} not found in /api/admin/owners`);
    console.log(`Approved Owner in Admin API: Quota=${approvedCheck.quota}, Used=${approvedCheck.usedQuota}, Sub=${approvedCheck.subscription}, QuotaStatus=${approvedCheck.quotaStatus}`);
    if (approvedCheck.quota !== 0) throw new Error(`Approved owner quota should be 0, got ${approvedCheck.quota}`);
    if (approvedCheck.subscription !== 'No Active Subscription') throw new Error(`Approved owner subscription should be 'No Active Subscription', got ${approvedCheck.subscription}`);

    // -------------------------------------------------------------------------
    // TEST 3: Owner creates first restaurant & picks a subscription plan
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Owner First Restaurant Creation & Plan Assignment ---');
    const ownerToken = signOwnerJwt(testOwnerId, testEmail, testName, []);

    // 3A: Check GET /api/owner/branches before creating first restaurant
    const ownerBranchesGet1 = await fetch(`${MAIN_BASE_URL}/api/owner/branches`, {
        headers: {
            Authorization: `Bearer ${ownerToken}`,
            Cookie: `dine_auth_token=${ownerToken}`
        }
    });
    if (!ownerBranchesGet1.ok) {
        throw new Error(`Failed to GET /api/owner/branches: status ${ownerBranchesGet1.status}`);
    }
    const branchLimitsBefore = (await ownerBranchesGet1.json()).branchLimits;
    console.log('Branch limits before creating first restaurant:', branchLimitsBefore);
    if (branchLimitsBefore.effectiveLimit !== 0) throw new Error(`effectiveLimit should be 0, got ${branchLimitsBefore.effectiveLimit}`);
    if (branchLimitsBefore.canCreate !== true) throw new Error(`canCreate should be true for first restaurant!`);
    if (branchLimitsBefore.planSlug !== 'none') throw new Error(`planSlug should be 'none', got ${branchLimitsBefore.planSlug}`);

    // 3B: Owner creates their first restaurant and selects 'pro' plan (which allows 2 locations)
    const createRestRes = await fetch(`${MAIN_BASE_URL}/api/owner/branches`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${ownerToken}`,
            Cookie: `dine_auth_token=${ownerToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: 'Spice Garden Deluxe',
            phone: '9876543210',
            email: testEmail,
            address: 'MG Road, Bengaluru',
            subscriptionPlan: 'pro',
            adminName: 'Chef Rahul',
            adminMobile: '9876543219',
            adminPin: '4321'
        })
    });
    const createRestData = await createRestRes.json();
    if (!createRestRes.ok || !createRestData.success) {
        throw new Error(`Failed to create first restaurant: ${createRestData.error || createRestRes.statusText}`);
    }
    console.log('✅ First restaurant created successfully:', createRestData.restaurantId, createRestData.restaurantName);
    const createdRestId = createRestData.restaurantId;

    // 3C: Check database subscription & employees record
    const { data: createdSub } = await supabase.from('subscriptions').select('*').eq('restaurant_id', createdRestId).single();
    console.log('Created subscription in DB:', {
        plan_name: createdSub.plan_name,
        status: createdSub.status,
        max_branches: createdSub.max_branches
    });
    if (createdSub.plan_name !== 'pro') throw new Error(`Subscription plan should be 'pro', got ${createdSub.plan_name}`);
    if (createdSub.max_branches !== 2) throw new Error(`Subscription max_branches should be 2 for Pro, got ${createdSub.max_branches}`);

    const { data: updatedOwnerEmp } = await supabase.from('employees').select('max_branches').eq('id', testOwnerId).single();
    console.log('Updated employee max_branches in DB:', updatedOwnerEmp.max_branches);
    if (updatedOwnerEmp.max_branches !== 2) throw new Error(`Owner employee max_branches should be updated to 2, got ${updatedOwnerEmp.max_branches}`);

    // 3D: Check GET /api/owner/branches after creating first restaurant
    const ownerTokenWithRest = signOwnerJwt(testOwnerId, testEmail, testName, [createdRestId]);
    const ownerBranchesGet2 = await fetch(`${MAIN_BASE_URL}/api/owner/branches`, {
        headers: {
            Authorization: `Bearer ${ownerTokenWithRest}`,
            Cookie: `dine_auth_token=${ownerTokenWithRest}`
        }
    });
    const branchLimitsAfter = (await ownerBranchesGet2.json()).branchLimits;
    console.log('Branch limits after creating first restaurant:', branchLimitsAfter);
    if (branchLimitsAfter.planSlug !== 'pro') throw new Error(`planSlug should be 'pro', got ${branchLimitsAfter.planSlug}`);
    if (branchLimitsAfter.effectiveLimit !== 2) throw new Error(`effectiveLimit should be 2, got ${branchLimitsAfter.effectiveLimit}`);
    if (branchLimitsAfter.currentCount !== 1) throw new Error(`currentCount should be 1, got ${branchLimitsAfter.currentCount}`);
    if (branchLimitsAfter.remainingSlots !== 1) throw new Error(`remainingSlots should be 1, got ${branchLimitsAfter.remainingSlots}`);
    if (branchLimitsAfter.canCreate !== true) throw new Error(`canCreate should be true (1 slot remaining)!`);

    // 3E: Check Super Admin GET /api/admin/owners reflects updated quota
    const adminOwnersCheck2 = await fetch(`${ADMIN_BASE_URL}/api/admin/owners`, {
        headers: { Authorization: `Bearer ${adminToken}` }
    });
    const checkData2 = await adminOwnersCheck2.json();
    const updatedAdminCheck = checkData2.owners.find(o => o.id === testOwnerId);
    console.log(`Owner in Super Admin API after plan assignment: Quota=${updatedAdminCheck.quota}, Used=${updatedAdminCheck.usedQuota}, Remaining=${updatedAdminCheck.remainingQuota}, Sub=${updatedAdminCheck.subscription}`);
    if (updatedAdminCheck.quota !== 2) throw new Error(`Admin quota should be 2, got ${updatedAdminCheck.quota}`);
    if (updatedAdminCheck.usedQuota !== 1) throw new Error(`Admin usedQuota should be 1, got ${updatedAdminCheck.usedQuota}`);
    if (updatedAdminCheck.remainingQuota !== 1) throw new Error(`Admin remainingQuota should be 1, got ${updatedAdminCheck.remainingQuota}`);
    if (updatedAdminCheck.subscription !== 'Pro') throw new Error(`Admin subscription should be 'Pro', got ${updatedAdminCheck.subscription}`);

    // -------------------------------------------------------------------------
    // CLEANUP TEST DATA
    // -------------------------------------------------------------------------
    console.log('\n--- Cleaning up temporary test data ---');
    await supabase.from('subscriptions').delete().eq('restaurant_id', createdRestId);
    await supabase.from('branches').delete().eq('restaurant_id', createdRestId);
    await supabase.from('restaurant_users').delete().eq('restaurant_id', createdRestId);
    await supabase.from('restaurants').delete().eq('id', createdRestId);
    await supabase.from('employees').delete().eq('restaurant_id', createdRestId);
    await supabase.from('restaurant_registration_requests').delete().eq('owner_id', testOwnerId);
    await supabase.from('employees').delete().eq('id', testOwnerId);
    console.log('✅ Temporary test data cleaned up successfully.');

    console.log('\n========================================================================');
    console.log('🎉 ALL OWNER QUOTA & SUBSCRIPTION LOGIC TESTS PASSED PERFECTLY!');
    console.log('========================================================================');
}

run().catch((err) => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
});
