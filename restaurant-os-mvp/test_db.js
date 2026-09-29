const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUsers() {
  const { data, error } = await supabase
    .from('employees')
    .select('id, name, email, employee_id, role, status, approval_status')
    .limit(10);
  
  if (error) console.error(error);
  else console.table(data);
}

checkUsers();
