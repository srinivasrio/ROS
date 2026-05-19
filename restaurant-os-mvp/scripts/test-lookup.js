const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testLookup(mobile) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('email, phone')
    .or(`phone.eq.${mobile},phone.eq.+91${mobile}`)
    .maybeSingle();
    
  console.log(`Lookup for ${mobile}:`, { data, error });
}

testLookup('8247005501');
