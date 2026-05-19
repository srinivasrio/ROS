const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUsers() {
  console.log('Fetching users...');
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, phone, role, is_approved')
    .limit(10);
    
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Users:', data);
  }
}

checkUsers();
