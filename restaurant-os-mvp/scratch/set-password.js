const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials in env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.auth.admin.updateUserById(
    "29774d5c-4bc9-4160-9c6a-3b2c0ef33b10",
    { password: "password123", email_confirm: true }
  );
  if (error) {
    console.error("Error resetting password:", error);
  } else {
    console.log("Successfully reset password to 'password123' for riosrinivas8247@gmail.com!");
  }
}

run();
