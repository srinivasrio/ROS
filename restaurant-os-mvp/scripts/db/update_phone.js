const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment configuration
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
} else if (fs.existsSync('../../.env.local')) {
  dotenv.config({ path: '../../.env.local' });
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updatePhone() {
  const userId = process.env.UPDATE_USER_ID || process.argv[2];
  const newPhone = process.env.UPDATE_USER_PHONE || process.argv[3];
  const newPassword = process.env.UPDATE_USER_PASSWORD || process.argv[4];

  if (!userId || !newPhone) {
    console.error("Usage: UPDATE_USER_ID=... UPDATE_USER_PHONE=... [UPDATE_USER_PASSWORD=...] node update_phone.js");
    console.error("   or: node update_phone.js <userId> <newPhone> [newPassword]");
    process.exit(1);
  }

  const updatePayload = { phone: newPhone };
  if (newPassword) {
    updatePayload.password = newPassword;
  }

  const { data, error } = await supabase.auth.admin.updateUserById(userId, updatePayload);
  
  if (error) {
    console.error("Error updating user:", error.message);
  } else {
    console.log(`Successfully updated phone for user ${userId}!`);
  }
}

updatePhone();
