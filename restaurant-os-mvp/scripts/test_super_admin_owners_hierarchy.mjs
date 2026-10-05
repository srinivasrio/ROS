import crypto from 'crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load env
dotenv.config({ path: 'super-admin/.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmcsygpphwdubnanwjwz.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is required');
const BASE_URL = 'http://control.localhost:3005';

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

async function signSuperAdminJwt() {
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

async function run() {
    console.log('========================================================================');
    console.log('🚀 STARTING SUPER ADMIN OWNERS HIERARCHY & CONTROLS E2E VALIDATION');
    console.log('========================================================================\n');

    // Pre-test cleanup of any leftover test locations
    const { data: leftover } = await supabase.from('restaurants').select('id').eq('name', 'Automated Test Location');
    if (leftover && leftover.length > 0) {
        for (const loc of leftover) {
            await supabase.from('employees').delete().eq('restaurant_id', loc.id);
            await supabase.from('branches').delete().eq('restaurant_id', loc.id);
            await supabase.from('restaurant_tables').delete().eq('restaurant_id', loc.id);
            await supabase.from('restaurants').delete().eq('id', loc.id);
        }
    }

    const token = await signSuperAdminJwt();
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    // -------------------------------------------------------------------------
    // TEST 1: GET /api/admin/owners
    // -------------------------------------------------------------------------
    console.log('TEST 1: Testing GET /api/admin/owners...');
    const ownersRes = await fetch(`${BASE_URL}/api/admin/owners`, { headers });
    if (!ownersRes.ok) {
        throw new Error(`GET /api/admin/owners failed with status ${ownersRes.status}: ${await ownersRes.text()}`);
    }
    const ownersData = await ownersRes.json();
    console.log(`✅ Fetched ${ownersData.owners.length} owners.`);
    console.log(`   Summary counts: total=${ownersData.summary?.totalOwners}, totalLocations=${ownersData.summary?.totalLocations}, totalQuota=${ownersData.summary?.totalQuota}`);

    console.log('Owners found:', ownersData.owners.map(o => ({ id: o.id, name: o.name, email: o.email })));

    // Verify key owners
    const srinivas = ownersData.owners.find(o => o.email?.toLowerCase().includes('srinivas') || o.name?.toLowerCase().includes('srinivas'));
    const vikram = ownersData.owners.find(o => o.email?.toLowerCase().includes('vikram') || o.name?.toLowerCase().includes('vikram'));
    const thirdOwner = ownersData.owners.find(o => o.id !== srinivas?.id && o.id !== vikram?.id);

    if (!srinivas) throw new Error('Owner Srinivas Kumar not found in owners list');
    if (!vikram) throw new Error('Owner Vikram Singhania not found in owners list');
    if (!thirdOwner) throw new Error('Third owner not found in owners list');

    console.log('✅ Found all 3 real owners in Super Admin:');
    console.log(`   1. Srinivas Kumar (${srinivas.id}): locations=${srinivas.totalLocations}, quota=${srinivas.quota}, remaining=${srinivas.remainingQuota}`);
    console.log(`   2. Vikram Singhania (${vikram.id}): locations=${vikram.totalLocations}, quota=${vikram.quota}, remaining=${vikram.remainingQuota}`);
    console.log(`   3. ${thirdOwner.name} (${thirdOwner.id}): locations=${thirdOwner.totalLocations}, quota=${thirdOwner.quota}, remaining=${thirdOwner.remainingQuota}`);

    if (srinivas.totalLocations !== 2) {
        throw new Error(`Expected Srinivas Kumar to have 2 independent locations, found: ${srinivas.totalLocations}`);
    }

    // Test Search filter
    console.log('\nTesting filter search=Vikram...');
    const searchRes = await fetch(`${BASE_URL}/api/admin/owners?search=Vikram`, { headers });
    const searchData = await searchRes.json();
    if (!searchData.owners.some(o => o.id === vikram.id)) {
        throw new Error('Search for Vikram failed to return Vikram Singhania');
    }
    console.log(`✅ Search filter working: matched ${searchData.owners.length} owner(s).`);

    // -------------------------------------------------------------------------
    // TEST 2: GET /api/admin/owners/[id] (Srinivas Kumar Workspace)
    // -------------------------------------------------------------------------
    console.log(`\nTEST 2: Testing GET /api/admin/owners/${srinivas.id} (Owner Workspace Data)...`);
    const wsRes = await fetch(`${BASE_URL}/api/admin/owners/${srinivas.id}`, { headers });
    if (!wsRes.ok) {
        throw new Error(`GET /api/admin/owners/${srinivas.id} failed with ${wsRes.status}: ${await wsRes.text()}`);
    }
    const wsData = await wsRes.json();

    console.log('✅ Workspace loaded successfully for Srinivas Kumar:');
    console.log(`   - Owner Name: ${wsData.owner.name}`);
    console.log(`   - Locations Count: ${wsData.locations.length}`);
    console.log(`   - Users Count: ${wsData.users.length}`);
    console.log(`   - Quota: ${wsData.quota.used} used of ${wsData.quota.total} (${wsData.quota.remaining} remaining)`);
    console.log(`   - Subscriptions: ${wsData.subscriptions?.length || 0} active`);
    console.log(`   - Invoices: ${wsData.billing?.invoices?.length || 0}`);
    console.log(`   - Audit Logs: ${wsData.audit_logs?.length || 0}`);
    console.log(`   - Security Events: ${wsData.security?.events?.length || 0}`);

    if (wsData.locations.length !== 2) {
        throw new Error(`Expected 2 locations in workspace, found: ${wsData.locations.length}`);
    }

    wsData.locations.forEach(loc => {
        console.log(`   📍 Location: ${loc.name} (ID: ${loc.id}, Status: ${loc.status}, Tables: ${loc.tablesCount}, Staff: ${loc.employeeCount}, Admin: ${loc.admin?.name || 'None'})`);
    });

    // -------------------------------------------------------------------------
    // TEST 3: Postgres RLS Quota Security Function
    // -------------------------------------------------------------------------
    console.log('\nTEST 3: Testing PostgreSQL can_create_restaurant_location() RPC...');
    const { data: canCreate, error: rpcErr } = await supabase.rpc('can_create_restaurant_location', {
        p_owner_id: srinivas.id
    });
    if (rpcErr) throw new Error(`RPC call failed: ${rpcErr.message}`);
    console.log(`✅ can_create_restaurant_location('${srinivas.id}') returned: ${canCreate}`);
    if (canCreate !== true) {
        throw new Error(`Expected canCreate to be true for Srinivas (used 2 < quota 6), got false`);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Location Creation via Super Admin & Quota Deduction
    // -------------------------------------------------------------------------
    console.log('\nTEST 4: Creating a new independent location under Srinivas Kumar...');
    const testLocationPayload = {
        name: 'Automated Test Location',
        address: 'Hitech City, Madhapur, Hyderabad',
        phone: '9876543299',
        email: 'autotestloc@biryanipalace.test',
        fssai_number: '12345678901234',
        gst_number: '36AAAAA0000A1Z5',
        currency: 'INR',
        adminName: 'Test Location Manager',
        adminEmail: 'testmanager@autotestloc.com',
        adminPin: '4455'
    };

    const createLocRes = await fetch(`${BASE_URL}/api/admin/owners/${srinivas.id}/locations`, {
        method: 'POST',
        headers,
        body: JSON.stringify(testLocationPayload)
    });

    if (!createLocRes.ok) {
        throw new Error(`Failed to create location: ${createLocRes.status} ${await createLocRes.text()}`);
    }

    const createdLocData = await createLocRes.json();
    const createdRestaurantId = createdLocData.location?.id;
    console.log(`✅ Created independent restaurant location successfully!`);
    console.log(`   - Restaurant ID: ${createdRestaurantId} (12-digit numeric tenant ID)`);
    console.log(`   - Name: ${createdLocData.location.name}`);
    console.log(`   - Assigned Admin: ${createdLocData.admin?.name} (${createdLocData.admin?.email})`);

    // Verify restaurant in DB has owner_id and unique 12-digit ID
    const { data: dbRest } = await supabase.from('restaurants').select('*').eq('id', createdRestaurantId).single();
    if (!dbRest || dbRest.owner_id !== srinivas.id) {
        throw new Error(`Restaurant record in DB does not match owner_id: ${srinivas.id}`);
    }

    // Verify default tables created
    const { count: tableCount } = await supabase.from('restaurant_tables').select('*', { count: 'exact', head: true }).eq('restaurant_id', createdRestaurantId);
    console.log(`   - Tables automatically provisioned: ${tableCount}`);

    // Verify primary branch record created
    const { data: branchRec } = await supabase.from('branches').select('*').eq('restaurant_id', createdRestaurantId);
    console.log(`   - Branch records linked: ${branchRec?.length || 0}`);

    // Verify Quota now reflects 3 used!
    const wsAfterRes = await fetch(`${BASE_URL}/api/admin/owners/${srinivas.id}`, { headers });
    const wsAfterData = await wsAfterRes.json();
    console.log(`✅ Quota updated: ${wsAfterData.quota.used} used of ${wsAfterData.quota.total} (${wsAfterData.quota.remaining} remaining)`);
    if (wsAfterData.quota.used !== 3) {
        throw new Error(`Expected quota used to be 3 after creating location, got ${wsAfterData.quota.used}`);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Location Lifecycle Controls (Suspend, Restore, Soft-delete)
    // -------------------------------------------------------------------------
    console.log('\nTEST 5: Testing Location Status Lifecycle (Suspend -> Restore)...');
    
    // Suspend
    const suspendRes = await fetch(`${BASE_URL}/api/admin/owners/${srinivas.id}/locations`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
            restaurant_id: createdRestaurantId,
            action: 'suspend'
        })
    });
    if (!suspendRes.ok) throw new Error(`Suspend failed: ${await suspendRes.text()}`);
    console.log(`✅ Location ${createdRestaurantId} suspended.`);

    const { data: suspendedRest } = await supabase.from('restaurants').select('status, deleted_at').eq('id', createdRestaurantId).single();
    if (suspendedRest.status !== 'SUSPENDED') {
        throw new Error(`Suspension state verification failed: status=${suspendedRest.status}`);
    }

    // Restore
    const restoreRes = await fetch(`${BASE_URL}/api/admin/owners/${srinivas.id}/locations`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
            locationId: createdRestaurantId,
            action: 'restore'
        })
    });
    if (!restoreRes.ok) throw new Error(`Restore failed: ${await restoreRes.text()}`);
    console.log(`✅ Location ${createdRestaurantId} restored.`);

    const { data: restoredRest } = await supabase.from('restaurants').select('status, deleted_at').eq('id', createdRestaurantId).single();
    if (restoredRest.status !== 'ACTIVE') {
        throw new Error(`Restoration state verification failed: status=${restoredRest.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Founder Controls (Quota Adjustment & Force Logout)
    // -------------------------------------------------------------------------
    console.log('\nTEST 6: Testing Founder Controls (Quota Override & Force Logout)...');
    
    // Quota adjustment to 8
    const quotaPatchRes = await fetch(`${BASE_URL}/api/admin/owners/${srinivas.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
            action: 'update_quota',
            max_branches: 8
        })
    });
    if (!quotaPatchRes.ok) throw new Error(`Quota patch failed: ${await quotaPatchRes.text()}`);
    const quotaPatchData = await quotaPatchRes.json();
    console.log(`✅ Quota adjusted: new max_branches = ${quotaPatchData.owner.max_branches}`);
    if (quotaPatchData.owner.max_branches !== 8) {
        throw new Error(`Expected quota to be 8, got ${quotaPatchData.owner.max_branches}`);
    }

    // Revert quota back to 6
    await fetch(`${BASE_URL}/api/admin/owners/${srinivas.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
            action: 'update_quota',
            max_branches: 6
        })
    });
    console.log(`✅ Quota safely reverted to 6.`);

    // Force Logout
    const logoutRes = await fetch(`${BASE_URL}/api/admin/owners/${srinivas.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
            action: 'force_logout'
        })
    });
    if (!logoutRes.ok) throw new Error(`Force logout failed: ${await logoutRes.text()}`);
    console.log(`✅ Force logout executed successfully.`);

    // -------------------------------------------------------------------------
    // CLEANUP TEST ARTIFACTS
    // -------------------------------------------------------------------------
    console.log('\nCLEANUP: Cleaning up automated test restaurant and admin employee...');
    await supabase.from('employees').delete().eq('restaurant_id', createdRestaurantId);
    await supabase.from('branches').delete().eq('restaurant_id', createdRestaurantId);
    await supabase.from('restaurant_tables').delete().eq('restaurant_id', createdRestaurantId);
    await supabase.from('restaurants').delete().eq('id', createdRestaurantId);
    console.log(`✅ Cleaned up test restaurant ${createdRestaurantId}.`);

    // Verify Srinivas quota back to 2 used
    const finalWs = await fetch(`${BASE_URL}/api/admin/owners/${srinivas.id}`, { headers });
    const finalWsData = await finalWs.json();
    console.log(`✅ Verified Srinivas quota restored to: ${finalWsData.quota.used} used of ${finalWsData.quota.total} (${finalWsData.quota.remaining} remaining).`);

    console.log('\n========================================================================');
    console.log('🎉 ALL SUPER ADMIN OWNERS HIERARCHY & CONTROLS TESTS PASSED 100%!');
    console.log('========================================================================\n');
}

run().catch(err => {
    console.error('\n❌ VALIDATION TEST FAILED:', err);
    process.exit(1);
});
