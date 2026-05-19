const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testLogin(email) {
  // We don't have the password for existing users, so we'll simulate the middleware using service role to "impersonate" the user loosely if needed.
  // Actually, we can just login with the exact test user we literally just registered in DB before it failed insert, but it failed insert so we don't have it.
  
  // Let's create a NEW user, with a given restaurant_id via service_role, then try to SELECT it using anon client + session.
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const testEmail = `login_${Date.now()}@example.com`;
  
  console.log('Signing up user...');
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: testEmail,
    password: 'Password123!',
    email_confirm: true
  });

  if (authError) {
    console.error('Signup error:', authError);
    return;
  }
  const userId = authData.user.id;
  const restId = 'REST_12345';
  console.log('User signed up. ID:', userId);

  console.log('Inserting profile explicitly ignoring RLS...');
  await supabaseAdmin.from('users').insert({
    id: userId,
    email: testEmail,
    role: 'restaurant_admin',
    is_approved: true,
    restaurant_id: restId
  });

  console.log('Logging in as standard user...');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  const { data: loginData } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: 'Password123!'
  });

  console.log('User logged in. Session acquired.');

  const { data: selectData, error: selectError } = await supabase
    .from('users')
    .select('role, is_approved')
    .eq('id', userId)
    .single();

  if (selectError) {
    console.error('Select error (should be RLS):', selectError);
  } else {
    console.log('Select successful using standard anon client!', selectData);
  }
}

testLogin();
