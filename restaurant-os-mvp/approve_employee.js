const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function approveEmployee() {
  const { data, error } = await supabase
    .from('employees')
    .update({ status: 'active', approval_status: 'approved' })
    .eq('email', 'sivarowatersolutions@gmail.com')
    .select();
  
  if (error) {
    console.error(error);
  } else {
    console.log('Successfully approved employee:', data);
  }
}

approveEmployee();
