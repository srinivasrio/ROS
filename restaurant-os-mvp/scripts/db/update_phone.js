const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function updatePhone() {
  const { data, error } = await supabase.auth.admin.updateUserById(
    "f9c05fbf-ea98-4b09-8f7a-770d91d7a4f6", // User ID
    { phone: "8247005501", password: "password123" }
  );
  
  if (error) {
    console.error("Error updating phone:", error);
  } else {
    console.log("Successfully updated phone!");
  }
}

updatePhone();
