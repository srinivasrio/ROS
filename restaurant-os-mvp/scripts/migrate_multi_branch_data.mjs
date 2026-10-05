import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function migrateData() {
  console.log('--- STARTING MULTI-BRANCH DATA CORRECTION ---');

  // 1. Clean up orphan tables from deleted test restaurant 202609082320
  const { error: delOrphanErr } = await supabase.from('tables').delete().eq('restaurant_id', '202609082320');
  if (delOrphanErr) console.warn('Clean orphan tables warning:', delOrphanErr.message);
  else console.log('Cleaned up orphan tables from deleted test restaurant 202609082320');

  // 2. Fix Singhania Grand Palace (202609084623)
  // Main Branch: BR-084623-01
  const { error: tErr1 } = await supabase
    .from('tables')
    .update({ branch_id: 'BR-084623-01' })
    .eq('restaurant_id', '202609084623')
    .is('branch_id', null);
  console.log('202609084623: Tables linked to BR-084623-01', tErr1 ? tErr1.message : 'OK');

  const { error: eErr1 } = await supabase
    .from('employees')
    .update({ branch_id: 'BR-084623-01' })
    .eq('restaurant_id', '202609084623')
    .is('branch_id', null);
  console.log('202609084623: Employees linked to BR-084623-01', eErr1 ? eErr1.message : 'OK');

  // 3. Fix Minerva (202603180001)
  // Main Branch: BR-180001-01
  // Sync owner_id to restaurant
  await supabase
    .from('restaurants')
    .update({ owner_id: '24a6beb3-fd5b-4244-9972-880ceaba0523' })
    .eq('id', '202603180001');

  const { error: tErr2 } = await supabase
    .from('tables')
    .update({ branch_id: 'BR-180001-01' })
    .eq('restaurant_id', '202603180001')
    .is('branch_id', null);
  console.log('202603180001: Tables linked to BR-180001-01', tErr2 ? tErr2.message : 'OK');

  const { error: oErr2 } = await supabase
    .from('orders')
    .update({ branch_id: 'BR-180001-01' })
    .eq('restaurant_id', '202603180001')
    .is('branch_id', null);
  console.log('202603180001: Orders linked to BR-180001-01', oErr2 ? oErr2.message : 'OK');

  const { error: eErr2 } = await supabase
    .from('employees')
    .update({ branch_id: 'BR-180001-01' })
    .eq('restaurant_id', '202603180001')
    .is('branch_id', null);
  console.log('202603180001: Employees linked to BR-180001-01', eErr2 ? eErr2.message : 'OK');

  // 4. Fix Srinivas Inn (202609089153)
  // Main Branch: BR-089153-01
  // DLP Branch: SRNVS-DLP01
  // Sync owner_id to restaurant
  await supabase
    .from('restaurants')
    .update({ owner_id: '29774d5c-4bc9-4160-9c6a-3b2c0ef33b10' })
    .eq('id', '202609089153');

  // Existing tables belong to Main Branch (BR-089153-01)
  const { error: tErr3 } = await supabase
    .from('tables')
    .update({ branch_id: 'BR-089153-01' })
    .eq('restaurant_id', '202609089153')
    .is('branch_id', null);
  console.log('202609089153: Tables linked to BR-089153-01', tErr3 ? tErr3.message : 'OK');

  // Existing orders belong to Main Branch (BR-089153-01)
  const { error: oErr3 } = await supabase
    .from('orders')
    .update({ branch_id: 'BR-089153-01' })
    .eq('restaurant_id', '202609089153')
    .is('branch_id', null);
  console.log('202609089153: Orders linked to BR-089153-01', oErr3 ? oErr3.message : 'OK');

  // Main branch employees: Sasi, Ravi, Srinivas Kumar, Abhinav, Teja
  const { error: eErr3 } = await supabase
    .from('employees')
    .update({ branch_id: 'BR-089153-01' })
    .eq('restaurant_id', '202609089153')
    .neq('id', 'ab89b053-5436-4f75-972b-236fe4e88a1f') // Keep Kumar on SRNVS-DLP01
    .is('branch_id', null);
  console.log('202609089153: Employees linked to BR-089153-01', eErr3 ? eErr3.message : 'OK');

  // Ensure Kumar is explicitly linked to SRNVS-DLP01
  await supabase
    .from('employees')
    .update({ branch_id: 'SRNVS-DLP01' })
    .eq('id', 'ab89b053-5436-4f75-972b-236fe4e88a1f');

  // 5. Populate employee_branch_access
  const accessRecords = [
    // Srinivas Inn - Main Branch Admin
    {
      restaurant_id: '202609089153',
      branch_id: 'BR-089153-01',
      employee_id: '29774d5c-4bc9-4160-9c6a-3b2c0ef33b10',
      role: 'restaurant_admin',
      can_manage_pos: true,
      can_view_reports: true,
      can_manage_inventory: true,
      can_manage_staff: true
    },
    // Srinivas Inn - DLP Branch Admin (Kumar)
    {
      restaurant_id: '202609089153',
      branch_id: 'SRNVS-DLP01',
      employee_id: 'ab89b053-5436-4f75-972b-236fe4e88a1f',
      role: 'restaurant_admin',
      can_manage_pos: true,
      can_view_reports: true,
      can_manage_inventory: true,
      can_manage_staff: true
    },
    // Minerva - Main Branch Admin
    {
      restaurant_id: '202603180001',
      branch_id: 'BR-180001-01',
      employee_id: '24a6beb3-fd5b-4244-9972-880ceaba0523',
      role: 'restaurant_admin',
      can_manage_pos: true,
      can_view_reports: true,
      can_manage_inventory: true,
      can_manage_staff: true
    }
  ];

  for (const rec of accessRecords) {
    const { error: accErr } = await supabase
      .from('employee_branch_access')
      .upsert(rec, { onConflict: 'restaurant_id,branch_id,employee_id' });
    if (accErr) console.warn('employee_branch_access error:', accErr.message);
  }
  console.log('employee_branch_access records upserted successfully.');

  console.log('--- DATA MIGRATION COMPLETE ---');
}

migrateData().catch(console.error);
