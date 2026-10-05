import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function fullAudit() {
  const { data: restaurants } = await supabase.from('restaurants').select('id, name, owner_id');
  const { data: branches } = await supabase.from('branches').select('*');
  const { data: employees } = await supabase.from('employees').select('id, name, email, role, restaurant_id, branch_id');
  const { data: eba } = await supabase.from('employee_branch_access').select('*');
  const { data: restUsers } = await supabase.from('restaurant_users').select('*');

  console.log('=== RESTAURANTS & BRANCHES ===');
  for (const r of restaurants || []) {
    const rBranches = (branches || []).filter(b => b.restaurant_id === r.id);
    const rUsers = (restUsers || []).filter(ru => ru.restaurant_id === r.id);
    const rEmps = (employees || []).filter(e => e.restaurant_id === r.id);
    console.log(`\nRestaurant: ${r.name} (${r.id})`);
    console.log(`  Owner in restaurants.owner_id: ${r.owner_id}`);
    console.log(`  Owner in restaurant_users:`, rUsers.map(ru => ({ user_id: ru.user_id, role: ru.role })));
    console.log(`  Branches (${rBranches.length}):`, rBranches.map(b => ({ id: b.id, name: b.name, is_main: b.is_main_branch })));
    console.log(`  Employees (${rEmps.length}):`);
    rEmps.forEach(e => console.log(`    - ${e.name} (${e.role}) | email: ${e.email} | branch_id: ${e.branch_id}`));
  }

  const orphanedEmps = (employees || []).filter(e => !e.restaurant_id);
  console.log('\n=== EMPLOYEES WITHOUT RESTAURANT_ID ===');
  orphanedEmps.forEach(e => console.log(`  - ${e.name} (${e.role}) | email: ${e.email}`));
}
fullAudit().catch(console.error);
