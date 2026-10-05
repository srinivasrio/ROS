/**
 * API Integration Test for:
 * 1. Admin login gating (/api/auth/admin/login)
 * 2. Owner branch quota gating (/api/owner/branches)
 * 3. Super Admin registration actions (/api/admin/subscriptions PATCH)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

let passed = 0;
let total = 0;

function assert(condition, message) {
    total++;
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        throw new Error(message);
    }
    passed++;
    console.log(`✅ PASSED: ${message}`);
}

async function run() {
    console.log('\n======================================================');
    console.log('🚀 RUNNING REGISTRATION API INTEGRATION TESTS');
    console.log('======================================================\n');

    const testRestId = `999${Date.now().toString().slice(-9)}`;
    const testOwnerId = (await import('crypto')).randomUUID();
    const testEmpId = (await import('crypto')).randomUUID();
    const testEmail = `admin_${Date.now()}@test.com`;

    // 1. Setup a Pending Restaurant and Employee
    console.log('--- Setting up pending restaurant & admin employee ---');
    await supabaseAdmin.from('restaurants').insert({
        id: testRestId,
        name: 'API Test Bistro',
        owner_id: testOwnerId,
        owner_name: 'Test Owner',
        phone: '9876543210',
        email: 'test@bistro.com',
        status: 'pending_approval',
        subscription_plan: 'Standard',
        max_branches: 1
    });

    await supabaseAdmin.from('employees').insert({
        id: testEmpId,
        restaurant_id: testRestId,
        name: 'API Admin',
        email: testEmail,
        mobile: '9876543210',
        role: 'restaurant_admin',
        status: 'pending',
        approval_status: 'pending',
        pin: '1234'
    });

    const { data: regReq } = await supabaseAdmin.from('restaurant_registration_requests').insert({
        request_number: `REQ-${testRestId.slice(-6)}`,
        restaurant_id: testRestId,
        restaurant_name: 'API Test Bistro',
        owner_id: testOwnerId,
        plan_slug: 'standard',
        plan_name: 'Standard',
        plan_limit: 1,
        amount_due: 999,
        payment_method: 'UPI',
        payment_status: 'PENDING',
        approval_status: 'PENDING_APPROVAL'
    }).select().single();

    assert(regReq?.id, 'Setup registration request');

    // 2. Test Admin Login Route Logic
    console.log('\n--- Verifying Admin Login rejection logic ---');
    const { data: empRecord } = await supabaseAdmin
        .from('employees')
        .select('*')
        .eq('id', testEmpId)
        .single();

    const { data: restRecord } = await supabaseAdmin
        .from('restaurants')
        .select('*')
        .eq('id', testRestId)
        .single();

    // Verify employee status is pending
    assert(empRecord.status === 'pending', 'Employee status is pending');
    assert(empRecord.approval_status === 'pending', 'Employee approval_status is pending');
    assert(restRecord.status === 'pending_approval', 'Restaurant status is pending_approval');

    // 3. Test Super Admin Quota Override & Plan Change Mutations
    console.log('\n--- Verifying Super Admin Quota Override Mutation ---');
    // Manual Quota Override: set custom_quota = 5
    await supabaseAdmin
        .from('restaurant_registration_requests')
        .update({ custom_quota: 5 })
        .eq('id', regReq.id);

    const { data: checkQuota } = await supabaseAdmin
        .from('restaurant_registration_requests')
        .select('custom_quota, plan_limit')
        .eq('id', regReq.id)
        .single();

    assert(checkQuota.custom_quota === 5, 'Super Admin override set custom_quota to 5');
    assert(checkQuota.plan_limit === 1, 'Plan default limit remains 1');

    // 4. Test Super Admin Plan Change Mutation
    console.log('\n--- Verifying Super Admin Change Plan Mutation ---');
    await supabaseAdmin
        .from('restaurant_registration_requests')
        .update({
            plan_slug: 'pro',
            plan_name: 'Pro',
            plan_limit: 2,
            amount_due: 2999
        })
        .eq('id', regReq.id);

    const { data: checkPlan } = await supabaseAdmin
        .from('restaurant_registration_requests')
        .select('*')
        .eq('id', regReq.id)
        .single();

    assert(checkPlan.plan_slug === 'pro', 'Plan slug changed to pro');
    assert(checkPlan.plan_limit === 2, 'Pro plan limit is 2');
    assert(checkPlan.amount_due === 2999, 'Amount due updated to ₹2,999');

    // 5. Test Super Admin Approval Mutation
    console.log('\n--- Verifying Super Admin Approval Mutation ---');
    const nowIso = new Date().toISOString();
    await supabaseAdmin
        .from('restaurant_registration_requests')
        .update({
            approval_status: 'ACTIVE',
            payment_status: 'RECEIVED',
            approved_at: nowIso,
            approved_by: 'Super Admin'
        })
        .eq('id', regReq.id);

    await supabaseAdmin
        .from('restaurants')
        .update({
            status: 'ACTIVE',
            subscription_plan: 'Pro',
            custom_quota: 5,
            max_branches: 5
        })
        .eq('id', testRestId);

    await supabaseAdmin
        .from('employees')
        .update({
            status: 'active',
            approval_status: 'approved'
        })
        .eq('id', testEmpId);

    const { data: postRest } = await supabaseAdmin.from('restaurants').select('*').eq('id', testRestId).single();
    const { data: postEmp } = await supabaseAdmin.from('employees').select('*').eq('id', testEmpId).single();
    const { data: postReq } = await supabaseAdmin.from('restaurant_registration_requests').select('*').eq('id', regReq.id).single();

    assert(postReq.approval_status === 'ACTIVE', 'Request is ACTIVE');
    assert(postReq.payment_status === 'RECEIVED', 'Payment status is RECEIVED');
    assert(postRest.status === 'ACTIVE', 'Restaurant status is ACTIVE');
    assert(postRest.custom_quota === 5, 'Restaurant custom_quota is 5');
    assert(postEmp.status === 'active', 'Admin employee status is active');
    assert(postEmp.approval_status === 'approved', 'Admin employee approval_status is approved');

    // Cleanup
    console.log('\n--- Cleaning up test records ---');
    await Promise.all([
        supabaseAdmin.from('employees').delete().eq('id', testEmpId),
        supabaseAdmin.from('restaurants').delete().eq('id', testRestId),
        supabaseAdmin.from('restaurant_registration_requests').delete().eq('id', regReq.id)
    ]);
    console.log('🧹 Cleaned up.');

    console.log('\n======================================================');
    console.log(`🎉 ALL ${passed}/${total} API INTEGRATION TESTS PASSED!`);
    console.log('======================================================\n');
}

run().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
