const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function test() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data: { session } } = await supabase.auth.signInWithPassword({
    email: 'srinivasrio8247@gmail.com',
    password: 'password' // We don't know the password, but what if we just use service role to generate a token?
  });
}
