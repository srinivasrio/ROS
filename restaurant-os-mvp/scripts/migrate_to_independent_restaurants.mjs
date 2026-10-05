import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase credentials in environment.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const OWNER_SRINIVAS_ID = '29774d5c-4bc9-4160-9c6a-3b2c0ef33b10'; // riosrinivas8247@gmail.com
const OWNER_SINGHANIA_ID = '672f02e1-4a62-4fa0-8e30-3279c1e0323e'; // newowner_test@dineinone.com
const OWNER_MINERVA_ID = '24a6beb3-fd5b-4244-9972-880ceaba0523'; // srinivasrio06@gmail.com

const REST_SRINIVAS_MAIN = '202609089153';
const REST_SRINIVAS_DLP = '202609290001';
const REST_SRINIVAS_NORTH = '202609082320';
const REST_SINGHANIA = '202609084623';
const REST_MINERVA = '202603180001';

async function runSafeMigrationAndRecovery() {
    console.log('================================================================');
    console.log('  SAFE DATA RECOVERY & MULTI-RESTAURANT INDEPENDENT MIGRATION  ');
    console.log('================================================================\n');

    // -------------------------------------------------------------------------
    // 1. RECOVER RESTAURANT 202609082320 (Srinivas In - North Express)
    // -------------------------------------------------------------------------
    console.log('[Step 1] Recovering missing restaurant 202609082320...');
    const { data: existing2320 } = await supabase
        .from('restaurants')
        .select('id')
        .eq('id', REST_SRINIVAS_NORTH)
        .maybeSingle();

    if (!existing2320) {
        const { error: ins2320Err } = await supabase
            .from('restaurants')
            .insert({
                id: REST_SRINIVAS_NORTH,
                name: 'Srinivas In - North Express',
                owner_id: OWNER_SRINIVAS_ID,
                owner_name: 'Srinivas Kumar',
                phone: '9515816084',
                email: 'riosrinivas8247@gmail.com',
                status: 'ACTIVE',
                created_at: '2026-09-17T17:30:52.203Z',
                updated_at: new Date().toISOString(),
                max_branches: 5
            });
        if (ins2320Err) throw new Error(`Failed to restore 202609082320: ${ins2320Err.message}`);
        console.log('✅ Restored restaurant record for 202609082320.');
    } else {
        console.log('ℹ️ Restaurant 202609082320 already exists.');
    }

    // Reconnect restaurant_users for 202609082320
    const { data: ru2320 } = await supabase
        .from('restaurant_users')
        .select('id')
        .eq('restaurant_id', REST_SRINIVAS_NORTH)
        .eq('user_id', OWNER_SRINIVAS_ID)
        .maybeSingle();

    if (!ru2320) {
        await supabase
            .from('restaurant_users')
            .insert({
                restaurant_id: REST_SRINIVAS_NORTH,
                user_id: OWNER_SRINIVAS_ID,
                role: 'OWNER',
                status: 'active'
            });
        console.log('✅ Reconnected Owner to 202609082320 in restaurant_users.');
    }

    // Primary branch for 202609082320
    const { data: br2320 } = await supabase
        .from('branches')
        .select('id')
        .eq('id', 'BR-082320-01')
        .maybeSingle();

    if (!br2320) {
        await supabase
            .from('branches')
            .insert({
                id: 'BR-082320-01',
                restaurant_id: REST_SRINIVAS_NORTH,
                name: 'Main Branch',
                is_main_branch: true,
                status: 'active'
            });
        console.log('✅ Created primary branch BR-082320-01 for 202609082320.');
    }

    // Sync branch_id on 202609082320 child tables
    await supabase.from('categories').update({ branch_id: 'BR-082320-01' }).eq('restaurant_id', REST_SRINIVAS_NORTH).is('branch_id', null);
    await supabase.from('menu_items').update({ branch_id: 'BR-082320-01' }).eq('restaurant_id', REST_SRINIVAS_NORTH).is('branch_id', null);
    await supabase.from('service_options').update({ branch_id: 'BR-082320-01' }).eq('restaurant_id', REST_SRINIVAS_NORTH).is('branch_id', null);
    await supabase.from('offers').update({ branch_id: 'BR-082320-01' }).eq('restaurant_id', REST_SRINIVAS_NORTH).is('branch_id', null);
    await supabase.from('today_specials').update({ branch_id: 'BR-082320-01' }).eq('restaurant_id', REST_SRINIVAS_NORTH).is('branch_id', null);
    await supabase.from('inventory_categories').update({ branch_id: 'BR-082320-01' }).eq('restaurant_id', REST_SRINIVAS_NORTH).is('branch_id', null);
    console.log('✅ Reconnected child records for 202609082320.');

    // Restore tables for 202609082320
    const { count: t2320Count } = await supabase
        .from('tables')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', REST_SRINIVAS_NORTH);

    if (!t2320Count || t2320Count === 0) {
        const tablesToInsert = [];
        for (let i = 1; i <= 10; i++) {
            tablesToInsert.push({
                table_number: String(i),
                capacity: i <= 4 ? 2 : (i <= 8 ? 4 : 6),
                status: 'available',
                restaurant_id: REST_SRINIVAS_NORTH,
                branch_id: 'BR-082320-01'
            });
        }
        await supabase.from('tables').insert(tablesToInsert);
        console.log('✅ Recreated 10 tables for 202609082320.');
    }

    // Profile & Theme for 202609082320
    const { data: prof2320 } = await supabase.from('restaurant_profile').select('restaurant_id').eq('restaurant_id', REST_SRINIVAS_NORTH).maybeSingle();
    if (!prof2320) {
        await supabase.from('restaurant_profile').insert({
            restaurant_id: REST_SRINIVAS_NORTH,
            name: 'Srinivas In - North Express',
            phone: '9515816084',
            email: 'riosrinivas8247@gmail.com'
        });
    }

    const { data: theme2320 } = await supabase.from('restaurant_theme').select('restaurant_id').eq('restaurant_id', REST_SRINIVAS_NORTH).maybeSingle();
    if (!theme2320) {
        await supabase.from('restaurant_theme').insert({
            restaurant_id: REST_SRINIVAS_NORTH,
            bg_color: '#F9FAFB',
            primary_button_color: '#F97316',
            secondary_button_color: '#000000',
            text_color: '#000000'
        });
    }

    const { data: sub2320 } = await supabase.from('subscriptions').select('id').eq('restaurant_id', REST_SRINIVAS_NORTH).maybeSingle();
    if (!sub2320) {
        await supabase.from('subscriptions').insert({
            restaurant_id: REST_SRINIVAS_NORTH,
            plan_name: 'starter',
            plan_type: 'monthly',
            status: 'active',
            amount: 1499.00,
            currency: 'INR',
            max_branches: 3,
            max_employees: 20
        });
    }

    // -------------------------------------------------------------------------
    // 2. RECONNECT SINGHANIA GRAND PALACE OWNER (672f02e1-4a62-4fa0-8e30-3279c1e0323e)
    // -------------------------------------------------------------------------
    console.log('\n[Step 2] Reconnecting Singhania Grand Palace owner...');
    const { data: ruSinghania } = await supabase
        .from('restaurant_users')
        .select('id')
        .eq('restaurant_id', REST_SINGHANIA)
        .eq('user_id', OWNER_SINGHANIA_ID)
        .maybeSingle();

    if (!ruSinghania) {
        await supabase.from('restaurant_users').insert({
            restaurant_id: REST_SINGHANIA,
            user_id: OWNER_SINGHANIA_ID,
            role: 'OWNER',
            status: 'active'
        });
        console.log('✅ Reconnected Singhania owner in restaurant_users.');
    } else {
        console.log('ℹ️ Singhania owner already mapped in restaurant_users.');
    }

    // -------------------------------------------------------------------------
    // 3. CONVERT SRNVS-DLP01 INTO INDEPENDENT RESTAURANT (202609290001)
    // -------------------------------------------------------------------------
    console.log('\n[Step 3] Converting Srinivas Inn - DLP into independent restaurant (202609290001)...');
    const { data: existingDlpRest } = await supabase
        .from('restaurants')
        .select('id')
        .eq('id', REST_SRINIVAS_DLP)
        .maybeSingle();

    if (!existingDlpRest) {
        const { error: insDlpErr } = await supabase
            .from('restaurants')
            .insert({
                id: REST_SRINIVAS_DLP,
                name: 'Srinivas Inn - DLP',
                owner_id: OWNER_SRINIVAS_ID,
                owner_name: 'Srinivas Kumar',
                phone: '7075218464',
                email: 'kumar@gmail.com',
                status: 'ACTIVE',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                max_branches: 5
            });
        if (insDlpErr) throw new Error(`Failed to create restaurant 202609290001: ${insDlpErr.message}`);
        console.log('✅ Created independent restaurant record for Srinivas Inn - DLP (202609290001).');
    } else {
        console.log('ℹ️ Restaurant 202609290001 already exists.');
    }

    // Map Owner to DLP in restaurant_users
    const { data: ruDlp } = await supabase
        .from('restaurant_users')
        .select('id')
        .eq('restaurant_id', REST_SRINIVAS_DLP)
        .eq('user_id', OWNER_SRINIVAS_ID)
        .maybeSingle();

    if (!ruDlp) {
        await supabase.from('restaurant_users').insert({
            restaurant_id: REST_SRINIVAS_DLP,
            user_id: OWNER_SRINIVAS_ID,
            role: 'OWNER',
            status: 'active'
        });
        console.log('✅ Connected Owner to 202609290001 in restaurant_users.');
    }

    // Update branch SRNVS-DLP01 to belong to 202609290001 as its main branch
    await supabase
        .from('branches')
        .update({
            restaurant_id: REST_SRINIVAS_DLP,
            is_main_branch: true,
            status: 'active'
        })
        .eq('id', 'SRNVS-DLP01');
    console.log('✅ Branch SRNVS-DLP01 updated to belong to 202609290001.');

    // Update Admin Kumar (ab89b053-5436-4f75-972b-236fe4e88a1f) to belong to 202609290001
    const KUMAR_ADMIN_ID = 'ab89b053-5436-4f75-972b-236fe4e88a1f';
    await supabase.from('employees').update({
        restaurant_id: REST_SRINIVAS_DLP,
        branch_id: 'SRNVS-DLP01'
    }).eq('id', KUMAR_ADMIN_ID);

    await supabase.from('dine_users').update({
        restaurant_id: REST_SRINIVAS_DLP
    }).eq('id', KUMAR_ADMIN_ID);

    await supabase.from('users').update({
        restaurant_id: REST_SRINIVAS_DLP,
        branch_id: 'SRNVS-DLP01'
    }).eq('id', KUMAR_ADMIN_ID);

    console.log('✅ Admin Kumar permanently assigned to independent restaurant 202609290001.');

    // DLP Tables (tables 101, 102)
    const { data: dlpTables } = await supabase
        .from('tables')
        .select('id, table_number')
        .eq('restaurant_id', REST_SRINIVAS_DLP);

    if (!dlpTables || dlpTables.length === 0) {
        await supabase.from('tables').insert([
            { table_number: '101', capacity: 4, status: 'available', restaurant_id: REST_SRINIVAS_DLP, branch_id: 'SRNVS-DLP01' },
            { table_number: '102', capacity: 6, status: 'available', restaurant_id: REST_SRINIVAS_DLP, branch_id: 'SRNVS-DLP01' }
        ]);
        console.log('✅ Created independent tables 101 and 102 for 202609290001.');
    }

    // DLP Menu Categories and Menu Items (Independent!)
    const { data: dlpCats } = await supabase
        .from('categories')
        .select('id')
        .eq('restaurant_id', REST_SRINIVAS_DLP);

    if (!dlpCats || dlpCats.length === 0) {
        const { data: cat1 } = await supabase.from('categories').insert({
            name: 'Biryanis & Pulaos',
            restaurant_id: REST_SRINIVAS_DLP,
            branch_id: 'SRNVS-DLP01',
            is_active: true
        }).select('id').single();

        const { data: cat2 } = await supabase.from('categories').insert({
            name: 'Starters & Grills',
            restaurant_id: REST_SRINIVAS_DLP,
            branch_id: 'SRNVS-DLP01',
            is_active: true
        }).select('id').single();

        if (cat1 && cat2) {
            await supabase.from('menu_items').insert([
                {
                    name: 'DLP Special Mutton Biryani',
                    price: 399,
                    category_id: cat1.id,
                    restaurant_id: REST_SRINIVAS_DLP,
                    branch_id: 'SRNVS-DLP01',
                    is_available: true
                },
                {
                    name: 'DLP Chicken Lollipop',
                    price: 289,
                    category_id: cat2.id,
                    restaurant_id: REST_SRINIVAS_DLP,
                    branch_id: 'SRNVS-DLP01',
                    is_available: true
                }
            ]);
            console.log('✅ Created independent menu categories & items for 202609290001.');
        }
    }

    // DLP Service Options (Independent!)
    const { data: dlpServices } = await supabase
        .from('service_options')
        .select('id')
        .eq('restaurant_id', REST_SRINIVAS_DLP);

    if (!dlpServices || dlpServices.length === 0) {
        await supabase.from('service_options').insert([
            { service_key: 'bill_requested', label: 'Request Bill', restaurant_id: REST_SRINIVAS_DLP, branch_id: 'SRNVS-DLP01', is_active: true },
            { service_key: 'water_requested', label: 'Water', restaurant_id: REST_SRINIVAS_DLP, branch_id: 'SRNVS-DLP01', is_active: true }
        ]);
        console.log('✅ Created independent services for 202609290001.');
    }

    // Profile, Theme, Subscription for 202609290001
    const { data: profDlp } = await supabase.from('restaurant_profile').select('restaurant_id').eq('restaurant_id', REST_SRINIVAS_DLP).maybeSingle();
    if (!profDlp) {
        await supabase.from('restaurant_profile').insert({
            restaurant_id: REST_SRINIVAS_DLP,
            name: 'Srinivas Inn - DLP',
            phone: '7075218464',
            email: 'kumar@gmail.com'
        });
    }

    const { data: themeDlp } = await supabase.from('restaurant_theme').select('restaurant_id').eq('restaurant_id', REST_SRINIVAS_DLP).maybeSingle();
    if (!themeDlp) {
        await supabase.from('restaurant_theme').insert({
            restaurant_id: REST_SRINIVAS_DLP,
            bg_color: '#F9FAFB',
            primary_button_color: '#F97316',
            secondary_button_color: '#000000',
            text_color: '#000000'
        });
    }

    const { data: subDlp } = await supabase.from('subscriptions').select('id').eq('restaurant_id', REST_SRINIVAS_DLP).maybeSingle();
    if (!subDlp) {
        await supabase.from('subscriptions').insert({
            restaurant_id: REST_SRINIVAS_DLP,
            plan_name: 'starter',
            plan_type: 'monthly',
            status: 'active',
            amount: 1499.00,
            currency: 'INR',
            max_branches: 3,
            max_employees: 20
        });
    }

    console.log('\n================================================================');
    console.log('  🎉 SAFE DATA RECOVERY & INDEPENDENT RESTAURANT SETUP COMPLETE! ');
    console.log('================================================================\n');
}

runSafeMigrationAndRecovery().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
