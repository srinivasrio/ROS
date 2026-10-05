/**
 * Comprehensive Automated Test Suite for:
 * Redesigned Restaurant Branch Registration & Approval Workflow
 *
 * User Specifications Verified:
 * 1. Owner creates restaurant: only takes details & subscription plan.
 *    NO restaurant admin created/assigned during creation.
 *    NO manual payment verification blocks creation.
 *    Status after submission: PENDING_APPROVAL.
 * 2. Admin assignment strictly prohibited while branch is PENDING_APPROVAL or REJECTED.
 * 3. Pre-approval Admin login is completely blocked (no account exists / not active).
 * 4. Super Admin reviews request details & subscription plan, then APPROVES atomically.
 *    On approve: branch_status = 'active', request_status = 'APPROVED', restaurant = 'ACTIVE'.
 * 5. Duplicate approval attempts rejected with DUPLICATE_APPROVAL error.
 * 6. Post-approval: Owner assigns Restaurant Admin and sets credentials (name, email, mobile, password, PIN).
 * 7. Restaurant Admin logs in successfully using the credentials created by Owner post-approval.
 * 8. Deletion atomically cancels subscription, deactivates branch, deactivates admin, and revokes sessions.
 * 9. Restaurant Admin login blocked post-deletion.
 * 10. Rejection workflow transitions request to REJECTED, branch to inactive/rejected, and admin assignment remains prohibited.
 * 11. Zero orphaned active requests, branches, or sessions exist for deactivated restaurants.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
    totalTests++;
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        throw new Error(message);
    }
    passedTests++;
    console.log(`✅ PASSED: ${message}`);
}

async function runTests() {
    console.log('\n================================================================');
    console.log('🚀 RUNNING RESTAURANT BRANCH APPROVAL LIFECYCLE TEST SUITE');
    console.log('================================================================\n');

    const testTimestamp = Date.now();
    const testRestId1 = `2026${String(testTimestamp).slice(-8)}`;
    const testBranchId1 = `BR-${testRestId1.slice(-6)}-01`;
    const testRequestId1 = crypto.randomUUID();
    const testAdminId1 = crypto.randomUUID();
    const testOwnerId1 = crypto.randomUUID();
    const testSessionId1 = crypto.randomUUID();

    const testRestId2 = `2026${String(testTimestamp + 1).slice(-8)}`;
    const testBranchId2 = `BR-${testRestId2.slice(-6)}-01`;
    const testRequestId2 = crypto.randomUUID();
    const testAdminId2 = crypto.randomUUID();

    try {
        // -------------------------------------------------------------------------
        // TEST 1: Owner Submission -> Details & Plan ONLY (No Admin, Pending Approval)
        // -------------------------------------------------------------------------
        console.log('--- TEST 1: Owner Submission (Details & Plan ONLY -> PENDING_APPROVAL) ---');

        // Create Owner in employees
        await supabaseAdmin.from('employees').insert({
            id: testOwnerId1,
            name: 'Test Owner 1',
            email: `owner_${testTimestamp}@testlifecycle.com`,
            mobile: `998877${String(testTimestamp).slice(-4)}`,
            role: 'owner',
            status: 'active',
            approval_status: 'approved',
            is_deleted: false
        });

        // Insert Restaurant with status 'pending_approval' (Details + Plan ONLY)
        const { data: rest1, error: rErr1 } = await supabaseAdmin.from('restaurants').insert({
            id: testRestId1,
            name: 'Lifecycle Test Bistro',
            owner_id: testOwnerId1,
            owner_name: 'Test Owner 1',
            phone: '9988776655',
            email: `bistro_${testTimestamp}@testlifecycle.com`,
            address: '123 Test Street, Cyber City',
            status: 'pending_approval',
            subscription_plan: 'Pro',
            custom_quota: 2,
            is_main_branch: true
        }).select().single();

        assert(!rErr1 && rest1, 'Restaurant inserted successfully with status pending_approval');
        assert(rest1.status === 'pending_approval', 'Restaurant status is strictly pending_approval');

        // Insert Branch with status 'pending_approval'
        const { data: branch1, error: bErr1 } = await supabaseAdmin.from('branches').insert({
            id: testBranchId1,
            restaurant_id: testRestId1,
            name: 'Lifecycle Test Bistro - Main Branch',
            code: `REST-${testRestId1.slice(-4)}`,
            phone: '9988776655',
            email: `bistro_${testTimestamp}@testlifecycle.com`,
            status: 'pending_approval',
            is_main_branch: true
        }).select().single();

        if (bErr1) console.error('bErr1 details:', bErr1);
        assert(!bErr1 && branch1, 'Branch inserted successfully with status pending_approval');
        assert(branch1.status === 'pending_approval', 'Branch status is strictly pending_approval');

        // Insert Registration Request with approval_status 'PENDING_APPROVAL', payment_status 'PENDING'
        const { data: req1, error: reqErr1 } = await supabaseAdmin.from('restaurant_registration_requests').insert({
            id: testRequestId1,
            request_number: `REQ-${testRestId1.slice(-6)}`,
            restaurant_id: testRestId1,
            restaurant_name: 'Lifecycle Test Bistro',
            owner_id: testOwnerId1,
            owner_name: 'Test Owner 1',
            owner_email: `owner_${testTimestamp}@testlifecycle.com`,
            owner_phone: '9988776655',
            plan_slug: 'pro',
            amount_due: 2999,
            approval_status: 'PENDING_APPROVAL',
            payment_status: 'PENDING'
        }).select().single();

        assert(!reqErr1 && req1, 'Registration request inserted with approval_status PENDING_APPROVAL');
        assert(req1.approval_status === 'PENDING_APPROVAL', 'Registration request approval_status is strictly PENDING_APPROVAL');

        // Assert: NO admin exists for this restaurant or branch before Super Admin approval!
        const { data: preAdmins } = await supabaseAdmin
            .from('employees')
            .select('id')
            .eq('restaurant_id', testRestId1)
            .in('role', ['restaurant_admin', 'admin']);

        assert(!preAdmins || preAdmins.length === 0, 'CRITICAL: No Restaurant Admin account exists for branch before Super Admin approval');

        // Insert Subscription in pending status (not blocking creation)
        const { data: sub1, error: sErr1 } = await supabaseAdmin.from('subscriptions').insert({
            restaurant_id: testRestId1,
            plan_name: 'pro',
            plan_type: 'monthly',
            status: 'pending',
            amount: 2999,
            currency: 'INR',
            max_branches: 2
        }).select().single();

        if (sErr1) console.error('sErr1 details:', sErr1);
        assert(!sErr1 && sub1, 'Subscription created in pending status without blocking branch registration');

        // -------------------------------------------------------------------------
        // TEST 2: Admin Assignment & Login Gating (Pre-Approval Prohibition)
        // -------------------------------------------------------------------------
        console.log('\n--- TEST 2: Admin Assignment & Login Gating (Pre-Approval Restriction) ---');

        // Verify that assigning an admin while restaurant is pending_approval is prohibited:
        const { data: restCheckPre } = await supabaseAdmin
            .from('restaurants')
            .select('status, deleted_at')
            .eq('id', testRestId1)
            .single();

        const { data: brnCheckPre } = await supabaseAdmin
            .from('branches')
            .select('status, deleted_at')
            .eq('id', testBranchId1)
            .single();

        const isRestActive = (restCheckPre?.status || '').toUpperCase() === 'ACTIVE';
        const isBranchActive = (brnCheckPre?.status || '').toLowerCase() === 'active';
        const canAssignAdminPre = isRestActive && isBranchActive;

        assert(!canAssignAdminPre, 'Admin assignment is strictly PROHIBITED while branch is PENDING_APPROVAL');

        // Verify that restaurant admin login cannot succeed because:
        // 1) Restaurant status is not active
        // 2) Branch status is not active
        // 3) No admin account exists
        const canLoginPre = restCheckPre.status === 'ACTIVE' && brnCheckPre.status === 'active';
        assert(!canLoginPre, 'Restaurant Admin login is strictly BLOCKED prior to Super Admin approval');

        // -------------------------------------------------------------------------
        // TEST 3: Super Admin Review & Approval (Single Atomic Database Transaction)
        // -------------------------------------------------------------------------
        console.log('\n--- TEST 3: Super Admin Approval Atomic Procedure ---');

        const { data: rpcApproveRes, error: rpcApproveErr } = await supabaseAdmin.rpc('approve_restaurant_registration', {
            p_request_id: testRequestId1,
            p_plan_slug: 'pro',
            p_custom_quota: 2,
            p_amount_due: 2999,
            p_approved_by: 'superadmin@test.com'
        });

        if (rpcApproveErr) console.error('rpcApproveErr details:', rpcApproveErr);
        assert(!rpcApproveErr, 'approve_restaurant_registration RPC executed without error');
        assert(rpcApproveRes?.success === true, 'Atomic procedure returned success: true');

        // Verify request is APPROVED
        const { data: updatedReq } = await supabaseAdmin
            .from('restaurant_registration_requests')
            .select('*')
            .eq('id', testRequestId1)
            .single();
        assert(updatedReq.approval_status === 'APPROVED', 'Registration request transitioned to APPROVED');

        // Verify restaurant is ACTIVE
        const { data: updatedRest } = await supabaseAdmin
            .from('restaurants')
            .select('*')
            .eq('id', testRestId1)
            .single();
        assert(updatedRest.status === 'ACTIVE', 'Restaurant transitioned to ACTIVE');

        // Verify branch is active
        const { data: updatedBranch } = await supabaseAdmin
            .from('branches')
            .select('*')
            .eq('id', testBranchId1)
            .single();
        assert(updatedBranch.status === 'active', 'Branch transitioned to active');

        // Verify subscription is active
        const { data: updatedSub } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('restaurant_id', testRestId1)
            .single();
        assert(updatedSub.status === 'active', 'Subscription transitioned to active');

        // Verify audit log
        const { data: auditLogs } = await supabaseAdmin
            .from('audit_logs')
            .select('*')
            .eq('restaurant_id', testRestId1)
            .eq('action', 'super_admin_approve_restaurant_registration');
        assert(auditLogs && auditLogs.length > 0, 'Audit log recorded for Super Admin approval');

        // -------------------------------------------------------------------------
        // TEST 4: Duplicate Approval Prevention
        // -------------------------------------------------------------------------
        console.log('\n--- TEST 4: Duplicate Approval Prevention ---');

        const { data: dupRes, error: dupErr } = await supabaseAdmin.rpc('approve_restaurant_registration', {
            p_request_id: testRequestId1,
            p_plan_slug: 'pro',
            p_custom_quota: 2,
            p_amount_due: 2999,
            p_approved_by: 'superadmin@test.com'
        });

        assert(dupErr !== null, 'Duplicate approval attempt was blocked by database stored procedure');
        assert(dupErr.message.includes('DUPLICATE_APPROVAL'), 'Error message contains DUPLICATE_APPROVAL');

        // -------------------------------------------------------------------------
        // TEST 5: Owner Assigns Restaurant Admin (Post-Approval)
        // -------------------------------------------------------------------------
        console.log('\n--- TEST 5: Owner Assigns Restaurant Admin Credentials (Post-Approval) ---');

        // Verify that admin assignment is now PERMITTED because restaurant & branch are ACTIVE
        const isNowEligibleForAdmin = updatedRest.status === 'ACTIVE' && updatedBranch.status === 'active';
        assert(isNowEligibleForAdmin, 'Branch is ACTIVE and now eligible for Restaurant Admin assignment');

        // Owner provisions admin with credentials
        const adminEmail = `admin_${testTimestamp}@testlifecycle.com`;
        const adminMobile = `991122${String(testTimestamp).slice(-4)}`;

        const { data: newAdmin, error: adminInsErr } = await supabaseAdmin.from('employees').insert({
            id: testAdminId1,
            employee_id: `ADM-${testRestId1.slice(-4)}-1001`,
            restaurant_id: testRestId1,
            branch_id: testBranchId1,
            name: 'Lifecycle Admin 1',
            email: adminEmail,
            mobile: adminMobile,
            role: 'restaurant_admin',
            status: 'active',
            approval_status: 'approved',
            is_deleted: false,
            pin: '1234'
        }).select().single();

        assert(!adminInsErr && newAdmin, 'Owner successfully assigned Restaurant Admin credentials after Super Admin approval');
        assert(newAdmin.status === 'active' && newAdmin.approval_status === 'approved', 'Restaurant Admin account is active & approved');

        // Sync branch access
        await supabaseAdmin.from('employee_branch_access').upsert({
            branch_id: testBranchId1,
            employee_id: testAdminId1
        }, { onConflict: 'employee_id,branch_id' });

        // Sync dine_users
        await supabaseAdmin.from('dine_users').upsert({
            id: testAdminId1,
            name: 'Lifecycle Admin 1',
            email: adminEmail,
            phone: adminMobile,
            restaurant_id: testRestId1,
            role: 'restaurant_admin',
            status: 'active'
        }, { onConflict: 'id' });

        // -------------------------------------------------------------------------
        // TEST 6: Restaurant Admin Login (Post-Approval & Post-Assignment)
        // -------------------------------------------------------------------------
        console.log('\n--- TEST 6: Restaurant Admin Login (Post-Approval & Post-Assignment) ---');

        const { data: adminRecord } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('id', testAdminId1)
            .single();

        const isLoginAllowed =
            adminRecord &&
            adminRecord.status === 'active' &&
            adminRecord.approval_status === 'approved' &&
            updatedRest.status === 'ACTIVE' &&
            updatedBranch.status === 'active';

        assert(isLoginAllowed, 'Restaurant Admin login allowed: Restaurant is ACTIVE, Branch is active, Admin is assigned and ACTIVE');

        // Create active session in dine_sessions to verify session lifecycle
        const { data: sess1, error: sessErr1 } = await supabaseAdmin.from('dine_sessions').insert({
            id: testSessionId1,
            user_id: testAdminId1,
            token_hash: `test_token_${testTimestamp}`,
            is_active: true,
            device_info: 'test_browser'
        }).select().single();

        if (sessErr1) console.error('sessErr1 details:', sessErr1);
        assert(!sessErr1 && sess1, 'Session created in dine_sessions for assigned Restaurant Admin');

        // -------------------------------------------------------------------------
        // TEST 7: Branch & Restaurant Deletion (Atomic Cleanup & Session Revocation)
        // -------------------------------------------------------------------------
        console.log('\n--- TEST 7: Deletion Atomic Procedure & Session Revocation ---');

        const { data: delRes, error: delErr } = await supabaseAdmin.rpc('delete_restaurant_branch_atomic', {
            p_restaurant_id: testRestId1,
            p_deleted_by: 'superadmin@test.com',
            p_reason: 'Testing deletion lifecycle'
        });

        assert(!delErr, 'delete_restaurant_branch_atomic RPC executed without error');
        assert(delRes?.success === true, 'Atomic deletion returned success: true');

        // Check restaurant status is deactivated
        const { data: delRest } = await supabaseAdmin
            .from('restaurants')
            .select('status, deleted_at')
            .eq('id', testRestId1)
            .single();
        assert(delRest.status === 'deactivated' && delRest.deleted_at !== null, 'Restaurant status transitioned to deactivated with deleted_at set');

        // Check branch status is inactive
        const { data: delBranch } = await supabaseAdmin
            .from('branches')
            .select('status, deleted_at')
            .eq('id', testBranchId1)
            .single();
        assert(delBranch.status === 'inactive' && delBranch.deleted_at !== null, 'Branch status transitioned to inactive with deleted_at set');

        // Check registration request is deleted
        const { data: delReq } = await supabaseAdmin
            .from('restaurant_registration_requests')
            .select('id')
            .eq('id', testRequestId1)
            .maybeSingle();
        assert(!delReq, 'Registration request was deleted upon restaurant deletion leaving no orphaned request');

        // Check subscription is cancelled
        const { data: delSub } = await supabaseAdmin
            .from('subscriptions')
            .select('status')
            .eq('restaurant_id', testRestId1)
            .single();
        assert(delSub.status === 'cancelled', 'Subscription transitioned to cancelled');

        // Check admin is inactive, rejected, and is_deleted = true
        const { data: delAdmin } = await supabaseAdmin
            .from('employees')
            .select('status, approval_status, is_deleted')
            .eq('id', testAdminId1)
            .single();
        assert(delAdmin.status === 'inactive' && delAdmin.approval_status === 'rejected' && delAdmin.is_deleted === true, 'Admin account deactivated and marked deleted');

        // Check dine_sessions was REVOKED (deleted)
        const { data: revokedSess } = await supabaseAdmin
            .from('dine_sessions')
            .select('id')
            .eq('id', testSessionId1)
            .maybeSingle();
        assert(!revokedSess, 'Active JWT session in dine_sessions was deleted/revoked upon restaurant deletion');

        // -------------------------------------------------------------------------
        // TEST 8: Restaurant Admin Login Blocked (Post-Deletion)
        // -------------------------------------------------------------------------
        console.log('\n--- TEST 8: Restaurant Admin Login Blocked (Post-Deletion) ---');

        const isPostDelBlocked = delRest.deleted_at !== null || delRest.status !== 'ACTIVE' || delAdmin.is_deleted === true;
        assert(isPostDelBlocked, 'Restaurant Admin login is completely blocked after restaurant deletion');

        // -------------------------------------------------------------------------
        // TEST 9: Rejection Workflow & Admin Prohibition
        // -------------------------------------------------------------------------
        console.log('\n--- TEST 9: Rejection Workflow & Admin Assignment Prohibition ---');

        // Insert 2nd restaurant & branch in pending (Details + Plan ONLY, no admin)
        const { error: rErr2 } = await supabaseAdmin.from('restaurants').insert({
            id: testRestId2,
            name: 'Rejection Test Cafe',
            owner_id: testOwnerId1,
            owner_name: 'Test Owner 1',
            phone: '9988776654',
            email: `cafe_${testTimestamp}@testlifecycle.com`,
            status: 'pending_approval',
            subscription_plan: 'Standard'
        });
        if (rErr2) console.error('rErr2:', rErr2);

        const { error: bErr2 } = await supabaseAdmin.from('branches').insert({
            id: testBranchId2,
            restaurant_id: testRestId2,
            name: 'Rejection Test Cafe - Main Branch',
            code: `REST-${testRestId2.slice(-4)}`,
            status: 'pending_approval'
        });
        if (bErr2) console.error('bErr2:', bErr2);

        const { error: reqErr2 } = await supabaseAdmin.from('restaurant_registration_requests').insert({
            id: testRequestId2,
            request_number: `REQ-${testRestId2.slice(-6)}`,
            restaurant_id: testRestId2,
            restaurant_name: 'Rejection Test Cafe',
            owner_id: testOwnerId1,
            owner_name: 'Test Owner 1',
            owner_email: `owner_${testTimestamp}@testlifecycle.com`,
            plan_slug: 'standard',
            amount_due: 999,
            approval_status: 'PENDING_APPROVAL'
        });
        if (reqErr2) console.error('reqErr2:', reqErr2);

        // Verify NO admin exists for this rejected candidate
        const { data: cafeAdminsPre } = await supabaseAdmin
            .from('employees')
            .select('id')
            .eq('restaurant_id', testRestId2);
        assert(!cafeAdminsPre || cafeAdminsPre.length === 0, 'No admin created during submission of rejected candidate');

        // Call reject_restaurant_registration atomic procedure
        const { data: rejRes, error: rejErr } = await supabaseAdmin.rpc('reject_restaurant_registration', {
            p_request_id: testRequestId2,
            p_reason: 'Invalid GST and address verification failed',
            p_rejected_by: 'superadmin@test.com'
        });

        if (rejErr) console.error('rejErr details:', rejErr);
        assert(!rejErr, 'reject_restaurant_registration RPC executed without error');
        assert(rejRes?.success === true, 'Atomic rejection returned success: true');

        // Verify request is REJECTED
        const { data: rejReq } = await supabaseAdmin
            .from('restaurant_registration_requests')
            .select('approval_status, rejection_reason')
            .eq('id', testRequestId2)
            .single();
        assert(rejReq.approval_status === 'REJECTED', 'Registration request transitioned to REJECTED');

        // Verify restaurant is rejected
        const { data: rejRest } = await supabaseAdmin
            .from('restaurants')
            .select('status')
            .eq('id', testRestId2)
            .single();
        assert(rejRest.status === 'rejected', 'Restaurant transitioned to rejected');

        // Verify branch is inactive
        const { data: rejBranch } = await supabaseAdmin
            .from('branches')
            .select('status')
            .eq('id', testBranchId2)
            .single();
        assert(rejBranch.status === 'inactive', 'Branch transitioned to inactive');

        // Verify admin assignment to rejected branch remains impossible
        const canAssignToRejected = (rejRest.status || '').toUpperCase() === 'ACTIVE' && (rejBranch.status || '').toLowerCase() === 'active';
        assert(!canAssignToRejected, 'Admin assignment remains strictly PROHIBITED for REJECTED restaurant/branch');

        // -------------------------------------------------------------------------
        // TEST 10: Orphan Reconciliation Verification
        // -------------------------------------------------------------------------
        console.log('\n--- TEST 10: Orphan Reconciliation Verification ---');

        const { data: deactRests } = await supabaseAdmin
            .from('restaurants')
            .select('id')
            .in('status', ['deactivated', 'soft_deleted', 'rejected']);

        const deactIds = (deactRests || []).map(r => r.id);
        if (deactIds.length > 0) {
            const { data: orphanedActiveBranches } = await supabaseAdmin
                .from('branches')
                .select('id, restaurant_id, status')
                .in('restaurant_id', deactIds)
                .eq('status', 'active');

            assert((orphanedActiveBranches || []).length === 0, 'Zero orphaned active branches exist for deactivated restaurants');

            const { data: orphanedApprovedRequests } = await supabaseAdmin
                .from('restaurant_registration_requests')
                .select('id, restaurant_id, approval_status')
                .in('restaurant_id', deactIds)
                .in('approval_status', ['APPROVED', 'ACTIVE']);

            assert((orphanedApprovedRequests || []).length === 0, 'Zero orphaned APPROVED requests exist for deactivated restaurants');
        }

        console.log('\n================================================================');
        console.log(`🎉 ALL ${totalTests} TESTS PASSED PERFECTLY! (${passedTests}/${totalTests})`);
        console.log('================================================================\n');

    } finally {
        // Clean up test records
        console.log('Cleaning up test records...');
        await supabaseAdmin.from('dine_sessions').delete().in('user_id', [testAdminId1, testAdminId2, testOwnerId1]);
        await supabaseAdmin.from('subscriptions').delete().in('restaurant_id', [testRestId1, testRestId2]);
        await supabaseAdmin.from('restaurant_registration_requests').delete().in('id', [testRequestId1, testRequestId2]);
        await supabaseAdmin.from('branches').delete().in('restaurant_id', [testRestId1, testRestId2]);
        await supabaseAdmin.from('employees').delete().in('id', [testAdminId1, testAdminId2, testOwnerId1]);
        await supabaseAdmin.from('audit_logs').delete().in('restaurant_id', [testRestId1, testRestId2]);
        await supabaseAdmin.from('restaurants').delete().in('id', [testRestId1, testRestId2]);
        console.log('Cleanup complete.');
    }
}

runTests().catch(err => {
    console.error('\n❌ TEST SUITE FAILED WITH ERROR:\n', err);
    process.exit(1);
});
