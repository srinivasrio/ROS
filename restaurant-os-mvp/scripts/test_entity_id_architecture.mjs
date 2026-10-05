import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { normalizeE164Phone, cleanPhoneDigits, uuidToTypeID, typeIDToUuid, sanitizeEmployeeProfile } from '../lib/entity-id.ts';
import { verifyEmployeeSearchAuthorization } from '../lib/auth/rbac.ts';
import { signJwt } from '../lib/jwt-utils.ts';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmcsygpphwdubnanwjwz.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✅ PASS: ${message}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${message}`);
        failed++;
    }
}

async function runTestSuite() {
    console.log('\n======================================================');
    console.log('🧪 RUNNING DINE IN ONE ENTITY ID & IDENTITY TEST SUITE');
    console.log('======================================================\n');

    // -------------------------------------------------------------------------
    // TEST 1: TYPEID & UUIDv7 ENCODING/DECODING INTEGRITY
    // -------------------------------------------------------------------------
    console.log('[TEST 1] TypeID & UUIDv7 Bidirectional Round-Trip');
    const sampleUuid = '77413a3c-24dc-4b1e-b376-af8108e98132';
    const typeId = uuidToTypeID('usr', sampleUuid);
    const restoredUuid = typeIDToUuid(typeId);
    assert(typeId.startsWith('usr_'), `TypeID starts with usr_ prefix: ${typeId}`);
    assert(restoredUuid.toLowerCase() === sampleUuid.toLowerCase(), `TypeID restored UUID matches original exactly (${sampleUuid})`);

    // -------------------------------------------------------------------------
    // TEST 2: E.164 PHONE NUMBER NORMALIZATION
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] E.164 Phone Normalization');
    assert(normalizeE164Phone('9876543210') === '+919876543210', '10-digit mobile normalizes to +919876543210');
    assert(normalizeE164Phone('+919876543210') === '+919876543210', '+91 prefixed number remains +919876543210');
    assert(normalizeE164Phone('09876543210') === '+919876543210', '0-prefixed number normalizes to +919876543210');
    assert(normalizeE164Phone('+91 98765-43210') === '+919876543210', 'Number with spaces and hyphens normalizes to +919876543210');
    assert(cleanPhoneDigits('+919876543210') === '9876543210', 'cleanPhoneDigits returns 10 digits for legacy compatibility');

    // -------------------------------------------------------------------------
    // TEST 3: DATABASE ENTITY IMMUTABLE INTERNAL UUIDv7 TypeIDs
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] Database Entities Internal TypeIDs & Display Identifiers');
    
    // 3.1 Employees
    const { data: emps, error: empErr } = await supabaseAdmin
        .from('employees')
        .select('id, internal_id, employee_code, legacy_reference, mobile, phone_normalized');
    assert(!empErr, 'Employees table queried successfully');
    assert(emps && emps.length > 0, `Found ${emps?.length} employee records`);
    const allEmpsHaveInternalId = emps?.every(e => e.internal_id && e.internal_id.startsWith('usr_'));
    assert(allEmpsHaveInternalId, 'All employees have immutable usr_ internal_ids');
    const allEmpsHaveDisplayCode = emps?.every(e => e.employee_code && e.employee_code.startsWith('EMP-'));
    assert(allEmpsHaveDisplayCode, 'All employees have clean human-readable EMP-xxxx display codes');
    const hasLegacyRef = emps?.some(e => e.legacy_reference !== null);
    assert(hasLegacyRef, 'Legacy employee identifiers (e.g. DIO9153001, 100001) safely preserved in legacy_reference');

    // 3.2 Restaurants
    const { data: rsts } = await supabaseAdmin.from('restaurants').select('id, internal_id, restaurant_code');
    assert(rsts?.every(r => r.internal_id?.startsWith('rst_')), 'All restaurants have immutable rst_ internal_ids');
    assert(rsts?.every(r => r.restaurant_code !== null), 'All restaurants preserve restaurant_code display reference');

    // 3.3 Branches
    const { data: brns } = await supabaseAdmin.from('branches').select('id, internal_id, branch_code');
    assert(brns?.every(b => b.internal_id?.startsWith('brn_')), 'All branches have immutable brn_ internal_ids');

    // 3.4 Tables
    const { data: tbls } = await supabaseAdmin.from('tables').select('id, internal_id, table_number');
    assert(tbls?.every(t => t.internal_id?.startsWith('tbl_')), 'All tables have immutable tbl_ internal_ids');
    assert(tbls?.every(t => t.table_number !== null), 'All tables preserve table_number as display identifier');

    // 3.5 Orders
    const { data: ords } = await supabaseAdmin.from('orders').select('id, internal_id, order_number').limit(10);
    assert(ords?.every(o => o.internal_id?.startsWith('ord_')), 'All orders have immutable ord_ internal_ids');
    assert(ords?.every(o => o.order_number !== null), 'All orders preserve order_number separately for operational display');

    // 3.6 Invoices
    const { data: invs } = await supabaseAdmin.from('invoices').select('id, internal_id, invoice_number');
    assert(invs?.every(i => i.internal_id?.startsWith('inv_')), 'All invoices have immutable inv_ internal_ids');
    assert(invs?.every(i => i.invoice_number !== null), 'All invoices preserve invoice_number (e.g. INV-2026-1006)');

    // 3.7 Attendance & Payroll
    const { data: atts } = await supabaseAdmin.from('attendance').select('id, internal_id, employee_id').limit(10);
    assert(atts?.every(a => a.internal_id?.startsWith('att_')), 'All attendance records have immutable att_ internal_ids');
    const { data: plits } = await supabaseAdmin.from('payroll_items').select('id, internal_id, employee_id').limit(10);
    assert(plits?.every(p => p.internal_id?.startsWith('plit_')), 'All payroll items have immutable plit_ internal_ids');

    // -------------------------------------------------------------------------
    // TEST 4: FOREIGN KEY RELATIONSHIP PRESERVATION (ZERO DATA LOSS)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 4] Foreign-Key Relationship Preservation');
    // Attendance -> Employee
    const { data: attWithEmp } = await supabaseAdmin
        .from('attendance')
        .select('id, employee:employee_id(id, name, internal_id)')
        .limit(5);
    assert(attWithEmp?.every(a => a.employee !== null), 'Attendance records preserve foreign-key link to employees');

    // Payroll -> Employee
    const { data: plitWithEmp } = await supabaseAdmin
        .from('payroll_items')
        .select('id, employee:employee_id(id, name, internal_id)')
        .limit(5);
    assert(plitWithEmp?.every(p => p.employee !== null), 'Payroll items preserve foreign-key link to employees');

    // Order -> Branch
    const { data: ordWithBranch } = await supabaseAdmin
        .from('orders')
        .select('id, branch:branch_id(id, internal_id, branch_code)')
        .not('branch_id', 'is', null)
        .limit(5);
    assert(ordWithBranch?.every(o => o.branch !== null), 'Orders preserve foreign-key link to branches');

    // -------------------------------------------------------------------------
    // TEST 5: EMPLOYEE PROFILE SANITIZATION & SECURITY
    // -------------------------------------------------------------------------
    console.log('\n[TEST 5] Employee Profile Sanitization (No Leaked Credentials)');
    const dirtyEmp = {
        id: '77413a3c-24dc-4b1e-b376-af8108e98132',
        internal_id: 'usr_3q84x3r96w9cfb6xnfg44ek09j',
        name: 'Rahul Verma',
        role: 'chef',
        pin: '$argon2id$v=19$m=65536,t=3,p=4$fakehash',
        raw_pin: '1234',
        raw_password: 'secretpassword',
        password_hash: '$argon2id$v=19$fakepasswordhash',
        activation_token: 'secret_token_123',
        registration_token: 'reg_tok_456',
        recovery_codes: ['code1', 'code2']
    };
    const sanitized = sanitizeEmployeeProfile(dirtyEmp);
    assert(sanitized.pin === undefined, 'PIN is completely removed from sanitized profile');
    assert(sanitized.raw_pin === undefined, 'raw_pin is completely removed');
    assert(sanitized.raw_password === undefined, 'raw_password is completely removed');
    assert(sanitized.password_hash === undefined, 'password_hash is completely removed');
    assert(sanitized.activation_token === undefined, 'activation_token is completely removed');
    assert(sanitized.registration_token === undefined, 'registration_token is completely removed');
    assert(sanitized.recovery_codes === undefined, 'recovery_codes are completely removed');
    assert(sanitized.internal_id === 'usr_3q84x3r96w9cfb6xnfg44ek09j', 'internal_id is preserved');
    assert(sanitized.name === 'Rahul Verma', 'name is preserved');

    // -------------------------------------------------------------------------
    // TEST 6: CENTRALIZED RBAC & TENANT ISOLATION
    // -------------------------------------------------------------------------
    console.log('\n[TEST 6] Centralized RBAC & Tenant Scoping Rules');

    // 6.1 Super Admin can search across platform
    const superAdminUser = {
        userId: 'super-admin-uuid',
        role: 'super_admin'
    };
    const saAuth = await verifyEmployeeSearchAuthorization(superAdminUser, null, null);
    assert(saAuth.authorized === true, 'Super Admin is authorized for platform-wide employee search');

    // 6.2 Restaurant Owner can search within authorized restaurant
    const ownerUser = {
        userId: '24a6beb3-fd5b-4244-9972-880ceaba0523',
        role: 'owner',
        restaurantId: '202603180001'
    };
    const ownerAuthValid = await verifyEmployeeSearchAuthorization(ownerUser, '202603180001', null);
    assert(ownerAuthValid.authorized === true, 'Owner is authorized to search within their restaurant');

    // 6.3 Cross-Restaurant Search Prohibited
    const ownerAuthCross = await verifyEmployeeSearchAuthorization(ownerUser, '202609089153', null);
    assert(ownerAuthCross.authorized === false, 'Owner cannot search employees from another restaurant (cross-tenant denied)');

    // 6.4 Unauthorized roles (waiter, chef, cleaner) cannot search
    const waiterUser = {
        userId: 'waiter-uuid',
        role: 'waiter',
        restaurantId: '202603180001'
    };
    const waiterAuth = await verifyEmployeeSearchAuthorization(waiterUser, '202603180001', null);
    assert(waiterAuth.authorized === false, 'Waiter role is prohibited from searching employees');

    // -------------------------------------------------------------------------
    // TEST 7: BIDIRECTIONAL ENTITY RESOLVER SQL FUNCTION
    // -------------------------------------------------------------------------
    console.log('\n[TEST 7] SQL Bidirectional Entity Resolver Function');
    const { data: resEmp } = await supabaseAdmin.rpc('resolve_entity', {
        p_entity: 'employee',
        p_identifier: 'EMP-0001'
    });
    assert(resEmp && resEmp.length > 0, `resolve_entity found employee by EMP-0001: internal_id=${resEmp?.[0]?.internal_id}`);

    const { data: resRest } = await supabaseAdmin.rpc('resolve_entity', {
        p_entity: 'restaurant',
        p_identifier: '202603180001'
    });
    assert(resRest && resRest.length > 0, `resolve_entity found restaurant by code: internal_id=${resRest?.[0]?.internal_id}`);

    console.log('\n======================================================');
    console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runTestSuite().catch(err => {
    console.error('Test suite uncaught error:', err);
    process.exit(1);
});
