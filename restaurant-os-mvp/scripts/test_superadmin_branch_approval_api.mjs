import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log('\n--- VERIFYING SUPER ADMIN BRANCH APPROVAL CAPABILITY & APIS ---\n');

    const testTimestamp = Date.now();
    const testRestId = `2026${String(testTimestamp).slice(-8)}`;
    const testBranchId = `BR-${testRestId.slice(-6)}-01`;
    const testRequestId = crypto.randomUUID();
    const testAdminId = crypto.randomUUID();
    const testOwnerId = crypto.randomUUID();

    try {
        // 1. Setup pending owner, restaurant, branch, and request
        console.log('1. Setting up pending branch registration by owner...');
        await supabaseAdmin.from('employees').insert({
            id: testOwnerId,
            name: 'API Test Owner',
            email: `owner_${testTimestamp}@testapi.com`,
            mobile: `997766${String(testTimestamp).slice(-4)}`,
            role: 'owner',
            status: 'active',
            approval_status: 'approved',
            is_deleted: false
        });

        await supabaseAdmin.from('restaurants').insert({
            id: testRestId,
            name: 'API Test Branch Bistro',
            owner_id: testOwnerId,
            owner_name: 'API Test Owner',
            phone: '9977665544',
            email: `bistro_${testTimestamp}@testapi.com`,
            address: '456 API Road',
            status: 'pending_approval',
            subscription_plan: 'Standard',
            is_main_branch: false
        });

        await supabaseAdmin.from('branches').insert({
            id: testBranchId,
            restaurant_id: testRestId,
            name: 'API Test Branch Bistro - Outlet 2',
            code: `REST-${testRestId.slice(-4)}`,
            phone: '9977665544',
            email: `bistro_${testTimestamp}@testapi.com`,
            status: 'pending_approval',
            is_main_branch: false
        });

        await supabaseAdmin.from('restaurant_registration_requests').insert({
            id: testRequestId,
            request_number: `REQ-${testRestId.slice(-6)}`,
            restaurant_id: testRestId,
            restaurant_name: 'API Test Branch Bistro',
            owner_id: testOwnerId,
            owner_name: 'API Test Owner',
            owner_email: `owner_${testTimestamp}@testapi.com`,
            owner_phone: '9977665544',
            plan_slug: 'standard',
            amount_due: 999,
            approval_status: 'PENDING_APPROVAL',
            payment_status: 'PENDING'
        });

        await supabaseAdmin.from('employees').insert({
            id: testAdminId,
            employee_id: `ADM-${testRestId.slice(-4)}-1001`,
            restaurant_id: testRestId,
            branch_id: testBranchId,
            name: 'Branch Admin Test',
            email: `admin_${testTimestamp}@testapi.com`,
            mobile: `995544${String(testTimestamp).slice(-4)}`,
            role: 'restaurant_admin',
            status: 'pending',
            approval_status: 'pending',
            is_deleted: false
        });

        console.log('✅ Pending records created successfully.');

        // 2. Test approve_restaurant_registration atomic stored procedure (as used by Super Admin route)
        console.log('2. Simulating Super Admin approving branch...');
        const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('approve_restaurant_registration', {
            p_request_id: testRequestId,
            p_plan_slug: 'growth',
            p_custom_quota: 5,
            p_amount_due: 1999,
            p_approved_by: 'superadmin@dinein.one'
        });

        if (rpcErr) throw rpcErr;
        console.log('✅ RPC executed successfully:', rpcRes);

        // 3. Verify database state
        const { data: updatedReq } = await supabaseAdmin.from('restaurant_registration_requests').select('*').eq('id', testRequestId).single();
        const { data: updatedRest } = await supabaseAdmin.from('restaurants').select('*').eq('id', testRestId).single();
        const { data: updatedBranch } = await supabaseAdmin.from('branches').select('*').eq('id', testBranchId).single();
        const { data: updatedAdmin } = await supabaseAdmin.from('employees').select('*').eq('id', testAdminId).single();
        const { data: updatedSub } = await supabaseAdmin.from('subscriptions').select('*').eq('restaurant_id', testRestId).single();

        if (updatedReq.approval_status !== 'APPROVED') throw new Error(`Request not approved: ${updatedReq.approval_status}`);
        if (updatedRest.status !== 'ACTIVE') throw new Error(`Restaurant not active: ${updatedRest.status}`);
        if (updatedBranch.status !== 'active') throw new Error(`Branch not active: ${updatedBranch.status}`);
        if (updatedAdmin.status !== 'active' || updatedAdmin.approval_status !== 'approved') {
            throw new Error(`Admin not active: status=${updatedAdmin.status}, approval=${updatedAdmin.approval_status}`);
        }
        if (updatedSub.status !== 'active') throw new Error(`Subscription not active: ${updatedSub.status}`);

        console.log('✅ Request status: APPROVED');
        console.log('✅ Restaurant status: ACTIVE');
        console.log('✅ Branch status: active');
        console.log('✅ Admin status: active, approved');
        console.log('✅ Subscription status: active');
        console.log('\n🎉 ALL SUPER ADMIN BRANCH APPROVAL PROCEDURES VERIFIED 100%!');

    } finally {
        console.log('\nCleaning up test records...');
        await supabaseAdmin.from('employees').delete().eq('id', testAdminId);
        await supabaseAdmin.from('branches').delete().eq('id', testBranchId);
        await supabaseAdmin.from('subscriptions').delete().eq('restaurant_id', testRestId);
        await supabaseAdmin.from('restaurant_registration_requests').delete().eq('id', testRequestId);
        await supabaseAdmin.from('restaurants').delete().eq('id', testRestId);
        await supabaseAdmin.from('employees').delete().eq('id', testOwnerId);
        console.log('Cleanup complete.');
    }
}

run().catch((err) => {
    console.error('❌ Error during test:', err);
    process.exit(1);
});
