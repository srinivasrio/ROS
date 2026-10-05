import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'super-admin/.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmcsygpphwdubnanwjwz.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// Base32 TOTP secret generation
function generateBase32Secret(length = 16) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const bytes = crypto.randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
        result += alphabet[bytes[i] % 32];
    }
    return result;
}

import crypto from 'crypto';

async function setup() {
    const userId = '6f0770d2-9826-4805-93eb-bb9f86b38647';
    
    // 1. Set status to mfa_reset_required so MFA reset flow works
    await supabase
        .from('employees')
        .update({ status: 'mfa_reset_required' })
        .eq('id', userId);
    console.log('Status set to mfa_reset_required');
    
    // 2. Generate TOTP secret
    const totpSecret = generateBase32Secret();
    const totpUri = `otpauth://totp/Dine%20In%20One%20Super%20Admin:hellodineinone@gmail.com?secret=${totpSecret}&issuer=Dine%20In%20One%20Super%20Admin&algorithm=SHA1&digits=6&period=30`;
    
    console.log('\n=== TOTP SETUP ===');
    console.log('Secret:', totpSecret);
    console.log('QR Code URI:', totpUri);
    console.log('\nScan this with Google Authenticator:');
    console.log(totpUri);
    
    // 3. Store in auth table (temporarily, will be confirmed on verification)
    await supabase
        .from('auth')
        .update({ 
            totp_secret: totpSecret,
            mfa_enabled: false,
        })
        .eq('user_id', userId);
    
    console.log('\n✅ Ready! Now:');
    console.log('1. Scan the QR code above with Google Authenticator');
    console.log('2. Run the MFA reset verification to complete setup');
}

setup().catch(console.error);
