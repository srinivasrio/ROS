import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        failed++;
        throw new Error(message);
    }
    console.log(`✅ PASSED: ${message}`);
    passed++;
}

async function run() {
    console.log('\n======================================================');
    console.log('🧪 TESTING MARK PAYMENT RECEIVED & UNDO PAYMENT WORKFLOW');
    console.log('======================================================\n');

    const testRestId = `999${Date.now().toString().slice(-9)}`;
    const testOwnerId = (await import('crypto')).randomUUID();
    const testOwnerEmail = `test-undo-owner-${Date.now()}@example.com`;
    let reqId = null;

    try {
        // Step 1: Create test registration request
        console.log('--- Step 1: Create registration request with payment_status: PENDING ---');
        const { data: regReq, error: regErr } = await supabaseAdmin
            .from('restaurant_registration_requests')
            .insert({
                request_number: `REQ-${testRestId.slice(-6)}`,
                restaurant_id: testRestId,
                restaurant_name: 'Undo Test Cafe',
                owner_id: testOwnerId,
                owner_name: 'Test Owner',
                owner_email: testOwnerEmail,
                plan_slug: 'standard',
                plan_name: 'Standard',
                plan_limit: 1,
                amount_due: 2499,
                payment_status: 'PENDING',
                approval_status: 'PENDING_APPROVAL',
                payment_method: 'UPI',
                payment_reference: 'TEST-UPI-123456'
            })
            .select()
            .single();

        if (regErr) throw regErr;
        reqId = regReq.id;
        assert(regReq.payment_status === 'PENDING', 'Initial payment_status is PENDING');
        assert(regReq.payment_verified_at === null, 'payment_verified_at is null initially');

        // Step 2: Mark payment received (simulating backend API mark_payment_received)
        console.log('\n--- Step 2: Mark Payment Received ---');
        const nowIso = new Date().toISOString();
        const { data: markedReq, error: markErr } = await supabaseAdmin
            .from('restaurant_registration_requests')
            .update({
                payment_status: 'RECEIVED',
                payment_verified_at: nowIso,
                payment_verified_by: 'superadmin@example.com',
                updated_at: nowIso
            })
            .eq('id', reqId)
            .select()
            .single();

        if (markErr) throw markErr;
        assert(markedReq.payment_status === 'RECEIVED', 'payment_status updated to RECEIVED');
        assert(markedReq.payment_verified_at !== null, 'payment_verified_at is set');
        assert(markedReq.payment_verified_by === 'superadmin@example.com', 'payment_verified_by is recorded');

        // Insert audit log for marking payment
        await supabaseAdmin.from('audit_logs').insert({
            user_id: '00000000-0000-0000-0000-000000000000',
            action: 'super_admin_mark_registration_payment_received',
            details: {
                request_id: reqId,
                restaurant_name: markedReq.restaurant_name,
                payment_reference: markedReq.payment_reference,
                verified_by: 'superadmin@example.com',
                timestamp: nowIso
            }
        });

        // Step 3: Undo Payment Received (simulating backend API undo_payment_received)
        console.log('\n--- Step 3: Undo Payment Received (Revert to PENDING) ---');
        const undoIso = new Date().toISOString();
        const { data: undoneReq, error: undoErr } = await supabaseAdmin
            .from('restaurant_registration_requests')
            .update({
                payment_status: 'PENDING',
                payment_verified_at: null,
                payment_verified_by: null,
                updated_at: undoIso
            })
            .eq('id', reqId)
            .select()
            .single();

        if (undoErr) throw undoErr;
        assert(undoneReq.payment_status === 'PENDING', 'payment_status successfully reverted to PENDING');
        assert(undoneReq.payment_verified_at === null, 'payment_verified_at successfully reset to null');
        assert(undoneReq.payment_verified_by === null, 'payment_verified_by successfully reset to null');

        // Insert audit log for undoing payment
        const { error: auditErr } = await supabaseAdmin.from('audit_logs').insert({
            user_id: '00000000-0000-0000-0000-000000000000',
            action: 'super_admin_undo_registration_payment_received',
            details: {
                request_id: reqId,
                restaurant_name: undoneReq.restaurant_name,
                reverted_by: 'superadmin@example.com',
                timestamp: undoIso
            }
        });
        if (auditErr) throw auditErr;

        // Verify audit logs
        console.log('\n--- Step 4: Verify Audit Trail ---');
        const { data: logs, error: logFetchErr } = await supabaseAdmin
            .from('audit_logs')
            .select('*')
            .filter('details->>request_id', 'eq', reqId);

        if (logFetchErr) throw logFetchErr;
        const markLog = logs.find(l => l.action === 'super_admin_mark_registration_payment_received');
        const undoLog = logs.find(l => l.action === 'super_admin_undo_registration_payment_received');

        assert(Boolean(markLog), 'Audit log exists for mark_payment_received');
        assert(Boolean(undoLog), 'Audit log exists for undo_payment_received');
        console.log('✅ Audit entries properly tracked for both actions');

        console.log('\n======================================================');
        console.log(`🎉 ALL ${passed} TESTS PASSED!`);
        console.log('======================================================\n');
    } finally {
        if (reqId) {
            console.log('🧹 Cleaning up test data...');
            await supabaseAdmin.from('restaurant_registration_requests').delete().eq('id', reqId);
            await supabaseAdmin.from('audit_logs').delete().filter('details->>request_id', 'eq', reqId);
            console.log('✅ Cleanup complete.');
        }
    }
}

run().catch((e) => {
    console.error('Fatal error during test run:', e);
    process.exit(1);
});
