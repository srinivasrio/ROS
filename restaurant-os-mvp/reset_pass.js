const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment configuration
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
} else if (fs.existsSync('restaurant-os-mvp/.env.local')) {
  dotenv.config({ path: 'restaurant-os-mvp/.env.local' });
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updatePassword() {
  const userId = process.env.RESET_USER_ID || process.argv[2];
  const newPassword = process.env.RESET_USER_PASSWORD || process.argv[3];

  if (!userId || !newPassword) {
    console.error("Usage: RESET_USER_ID=... RESET_USER_PASSWORD=... node reset_pass.js");
    console.error("   or: node reset_pass.js <userId> <newPassword>");
    process.exit(1);
  }

  const { data, error } = await supabase.auth.admin.updateUserById(
    userId,
    { password: newPassword }
  );
  
  if (error) {
    console.error("Error updating password:", error.message);
  } else {
    console.log(`Successfully updated password for user ${userId}!`);
  }
}

updatePassword();
