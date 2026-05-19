const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// We need an auth token. Let's use the DB bypass to get a user and then try to login?
// Wait, we don't have the password.
// Let's just create a new test user using the real signup, which returns a session, then try to select from users.
async function test() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const testEmail = `test_${Date.now()}@example.com`;
  
  console.log('Signing up user...');
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: testEmail,
    password: 'Password123!',
    options: {
        data: { full_name: 'Test RLS' }
    }
  });

  if (authError) {
    console.error('Signup error:', authError);
    return;
  }

  console.log('User signed up. ID:', authData.user.id);
  
  // Now using the session, try to insert a profile (since RegistrationService does this with ANON key? No, Registration Service uses standard client)
  // Wait, RegistrationService uses `import { supabase } from '@/lib/supabase'` which uses ANON KEY!
  console.log('Attempting to insert profile...');
  const { error: insertError } = await supabase
    .from('users')
    .insert({
        id: authData.user.id,
        email: testEmail,
        role: 'restaurant_admin',
        is_approved: false
    });

  if (insertError) {
    console.error('Insert error (RLS):', insertError);
  } else {
    console.log('Profile inserted!');
  }

  // Now try to select the profile
  console.log('Attempting to select profile...');
  const { data: selectData, error: selectError } = await supabase
    .from('users')
    .select('role, is_approved')
    .eq('id', authData.user.id)
    .single();

  if (selectError) {
    console.error('Select error (RLS):', selectError);
  } else {
    console.log('Select successful:', selectData);
  }
}

test();
