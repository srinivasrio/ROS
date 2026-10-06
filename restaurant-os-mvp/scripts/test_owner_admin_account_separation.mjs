import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE = 'http://localhost:3000';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✅ PASS: ${message}`);
        passCount++;
    } else {
        console.error(`  ❌ FAIL: ${message}`);
        failCount++;
    }
}

async function runTests() {
    console.log('================================================================');
    console.log('🧪 VERIFYING OWNER & RESTAURANT ADMIN ACCOUNT SEPARATION');
    console.log('================================================================\n');

    // Known test emails from current database
    const KNOWN_OWNER_EMAIL = 'srinivasrio8247@gmail.com';
    const KNOWN_ADMIN_EMAIL = 'kumar@gmail.com';

    // -------------------------------------------------------------------------
    // TEST SUITE 1: Database Trigger Enforcements (Direct DB Layer)
    // -------------------------------------------------------------------------
    console.log('--- TEST SUITE 1: Database Triggers & Integrity Constraints ---');

    // 1.1 Trigger blocks creating employee with role 'restaurant_admin' using an Owner email
    const fakeAdminId = crypto.randomUUID();
    const { error: dbErr1 } = await supabase.from('employees').insert({
        id: fakeAdminId,
        name: 'Conflict Admin Test',
        email: KNOWN_OWNER_EMAIL,
        role: 'restaurant_admin',
        mobile: '9000000001',
        employee_id: `ADM-TEST-${Date.now().toString().slice(-4)}`,
        status: 'active'
    });
    assert(
        dbErr1 !== null && (dbErr1.code === '23514' || dbErr1.code === '23505' || dbErr1.message?.includes('Restaurant Owner')),
        `DB trigger blocks inserting restaurant_admin with Owner email (${dbErr1?.message})`
    );
    if (!dbErr1) await supabase.from('employees').delete().eq('id', fakeAdminId);

    // 1.2 Trigger blocks creating employee with role 'owner' using a Restaurant Admin email
    const fakeOwnerId = crypto.randomUUID();
    const { error: dbErr2 } = await supabase.from('employees').insert({
        id: fakeOwnerId,
        name: 'Conflict Owner Test',
        email: KNOWN_ADMIN_EMAIL,
        role: 'owner',
        mobile: '9000000002',
        employee_id: `OWN-TEST-${Date.now().toString().slice(-4)}`,
        status: 'active'
    });
    assert(
        dbErr2 !== null && (dbErr2.code === '23514' || dbErr2.code === '23505' || dbErr2.message?.includes('Restaurant Admin')),
        `DB trigger blocks inserting owner with Restaurant Admin email (${dbErr2?.message})`
    );
    if (!dbErr2) await supabase.from('employees').delete().eq('id', fakeOwnerId);

    // 1.3 Trigger blocks role mutation on existing Owner in employees
    const { data: ownerEmp } = await supabase.from('employees').select('id, role').eq('email', KNOWN_OWNER_EMAIL).maybeSingle();
    if (ownerEmp) {
        const { error: dbErr3 } = await supabase.from('employees').update({ role: 'restaurant_admin' }).eq('id', ownerEmp.id);
        assert(
            dbErr3 !== null && (dbErr3.code === '23514' || dbErr3.message?.includes('Restaurant Owner')),
            `DB trigger blocks updating Owner role to restaurant_admin (${dbErr3?.message})`
        );
    }

    // 1.4 Trigger blocks role mutation on existing Admin in employees
    const { data: adminEmp } = await supabase.from('employees').select('id, role').eq('email', KNOWN_ADMIN_EMAIL).maybeSingle();
    if (adminEmp) {
        const { error: dbErr4 } = await supabase.from('employees').update({ role: 'owner' }).eq('id', adminEmp.id);
        assert(
            dbErr4 !== null && (dbErr4.code === '23514' || dbErr4.message?.includes('Restaurant Admin')),
            `DB trigger blocks updating Restaurant Admin role to owner (${dbErr4?.message})`
        );
    }

    // 1.5 Trigger blocks setting a Restaurant Admin as restaurant owner in restaurants table
    if (adminEmp) {
        const fakeRestId = `test_rest_${Date.now()}`;
        const { error: dbErr5 } = await supabase.from('restaurants').insert({
            id: fakeRestId,
            name: 'Illegal Owner Restaurant',
            owner_name: 'Illegal Admin',
            owner_id: adminEmp.id,
            status: 'pending'
        });
        assert(
            dbErr5 !== null && (dbErr5.code === '23514' || dbErr5.message?.includes('Restaurant Admin')),
            `DB trigger blocks assigning a Restaurant Admin as restaurant owner (${dbErr5?.message})`
        );
        if (!dbErr5) await supabase.from('restaurants').delete().eq('id', fakeRestId);
    }

    // 1.6 RPC check_account_separation function verifies roles accurately
    const { data: rpcOwnerCheck } = await supabase.rpc('check_account_separation', {
        p_email: KNOWN_ADMIN_EMAIL,
        p_target_role: 'owner'
    });
    assert(
        rpcOwnerCheck?.allowed === false && rpcOwnerCheck?.error?.includes('Restaurant Admin'),
        `RPC check_account_separation rejects Owner role for Restaurant Admin email (${rpcOwnerCheck?.error})`
    );

    const { data: rpcAdminCheck } = await supabase.rpc('check_account_separation', {
        p_email: KNOWN_OWNER_EMAIL,
        p_target_role: 'restaurant_admin'
    });
    assert(
        rpcAdminCheck?.allowed === false && rpcAdminCheck?.error?.includes('Restaurant Owner'),
        `RPC check_account_separation rejects Restaurant Admin role for Owner email (${rpcAdminCheck?.error})`
    );

    console.log('');

    // -------------------------------------------------------------------------
    // TEST SUITE 2: Registration & Creation Separation
    // -------------------------------------------------------------------------
    console.log('--- TEST SUITE 2: Registration & Creation APIs ---');

    // 2.1 Owner Register API rejects existing Restaurant Admin email
    const regRes = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fullName: 'Test Attempt',
            email: KNOWN_ADMIN_EMAIL,
            phone: '9123456780',
            password: 'StrongPassword123!'
        })
    });
    const regJson = await regRes.json();
    assert(
        regRes.status === 409 && regJson.error?.includes('Restaurant Admin'),
        `POST /api/auth/register rejects Restaurant Admin email with 409 (${regJson.error})`
    );

    // 2.2 Owner OTP Register API rejects existing Restaurant Admin email
    const ownerRegRes = await fetch(`${API_BASE}/api/auth/owner/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Test Attempt Owner',
            email: KNOWN_ADMIN_EMAIL,
            phone: '9123456781',
            password: 'StrongPassword123!'
        })
    });
    const ownerRegJson = await ownerRegRes.json();
    assert(
        ownerRegRes.status === 400 || (ownerRegRes.status === 409 && ownerRegJson.error?.includes('Restaurant Admin')),
        `POST /api/auth/owner/register blocks registration appropriately (status: ${ownerRegRes.status})`
    );

    console.log('');

    // -------------------------------------------------------------------------
    // TEST SUITE 3: Authentication & Login Separation
    // -------------------------------------------------------------------------
    console.log('--- TEST SUITE 3: Authentication & Login Panel Separation ---');

    // 3.1 Owner email attempted at Restaurant Admin login (/api/auth/admin/login without panel: 'owner')
    const adminLoginRes = await fetch(`${API_BASE}/api/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: KNOWN_OWNER_EMAIL,
            password: 'AnyPassword123!',
            pin: '1234'
        })
    });
    const adminLoginJson = await adminLoginRes.json();
    assert(
        adminLoginRes.status === 403 && adminLoginJson.error?.includes('Restaurant Owner'),
        `POST /api/auth/admin/login blocks Owner email with 403 (${adminLoginJson.error})`
    );

    // 3.2 Restaurant Admin email attempted at Owner login (/api/auth/admin/login with panel: 'owner')
    const ownerLoginRes = await fetch(`${API_BASE}/api/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            panel: 'owner',
            email: KNOWN_ADMIN_EMAIL,
            password: 'AnyPassword123!'
        })
    });
    const ownerLoginJson = await ownerLoginRes.json();
    assert(
        ownerLoginRes.status === 403 && ownerLoginJson.error?.includes('Restaurant Admin'),
        `POST /api/auth/admin/login (panel: owner) blocks Restaurant Admin email with 403 (${ownerLoginJson.error})`
    );

    // 3.3 Restaurant Admin email attempted at Dine in One main login (/api/auth/login)
    const mainLoginRes = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: KNOWN_ADMIN_EMAIL,
            password: 'AnyPassword123!'
        })
    });
    const mainLoginJson = await mainLoginRes.json();
    assert(
        mainLoginRes.status === 403 && mainLoginJson.error?.includes('Restaurant Admin'),
        `POST /api/auth/login rejects Restaurant Admin email with 403 (${mainLoginJson.error})`
    );

    console.log('');

    // -------------------------------------------------------------------------
    // TEST SUITE 4: Valid Account Functionality & Separation Integrity
    // -------------------------------------------------------------------------
    console.log('--- TEST SUITE 4: Valid Existing Account Integrity ---');

    // 4.1 Confirm existing accounts in DB have proper roles
    const { data: verifiedOwner } = await supabase
        .from('employees')
        .select('id, name, email, role')
        .eq('email', KNOWN_OWNER_EMAIL)
        .single();
    assert(
        verifiedOwner?.role === 'owner',
        `Existing Owner account ${KNOWN_OWNER_EMAIL} is cleanly set as role: 'owner'`
    );

    const { data: verifiedAdmin } = await supabase
        .from('employees')
        .select('id, name, email, role')
        .eq('email', KNOWN_ADMIN_EMAIL)
        .single();
    assert(
        verifiedAdmin?.role === 'restaurant_admin',
        `Existing Restaurant Admin account ${KNOWN_ADMIN_EMAIL} is cleanly set as role: 'restaurant_admin'`
    );

    // 4.2 Verify zero cross-role collisions in the entire database
    const { data: collisionCheck } = await supabase
        .from('employees')
        .select('email, role')
        .in('role', ['owner', 'restaurant_owner', 'restaurant_admin', 'admin']);
    
    const ownerEmails = new Set();
    const adminEmails = new Set();
    let collisionDetected = false;

    (collisionCheck || []).forEach(e => {
        const em = (e.email || '').toLowerCase().trim();
        if (!em) return;
        const isOwnerRole = ['owner', 'restaurant_owner'].includes(e.role);
        const isAdminRole = ['restaurant_admin', 'admin'].includes(e.role);
        if (isOwnerRole) {
            if (adminEmails.has(em)) collisionDetected = true;
            ownerEmails.add(em);
        }
        if (isAdminRole) {
            if (ownerEmails.has(em)) collisionDetected = true;
            adminEmails.add(em);
        }
    });

    assert(
        !collisionDetected,
        `Zero email collisions between Owner and Restaurant Admin in database (Checked ${ownerEmails.size} Owners and ${adminEmails.size} Admins)`
    );

    console.log('\n================================================================');
    console.log(`SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('================================================================\n');

    if (failCount > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
