import { createClient } from '@supabase/supabase-js';
import { hashPassword } from './lib/auth-utils';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function reset() {
  const newPassword = 'Password@123';
  const hash = await hashPassword(newPassword);

  const { data, error } = await supabase
    .from('auth')
    .update({ password_hash: hash })
    .eq('user_id', '7e64b263-a6eb-4648-92bc-09ce6c97e61b') // The ID from our previous output
    .select();

  if (error) {
    console.error(error);
  } else {
    console.log('Password successfully reset to:', newPassword);
  }
}

reset();
