import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: 'super-admin/.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmcsygpphwdubnanwjwz.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function verifyTotpCode(secret, code, window = 1) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    function base32Decode(base32) {
        const cleaned = base32.toUpperCase().replace(/=+$/, '');
        let bits = '';
        for (let i = 0; i < cleaned.length; i++) {
            const val = alphabet.indexOf(cleaned[i]);
            if (val === -1) throw new Error('Invalid base32 character');
            bits += val.toString(2).padStart(5, '0');
        }
        const bytes = [];
        for (let i = 0; i + 8 <= bits.length; i += 8) {
            bytes.push(parseInt(bits.substring(i, i + 8), 2));
        }
        return Buffer.from(bytes);
    }
    
    function getTotpCode(secret, timeIndex) {
        const key = base32Decode(secret);
        const buffer = Buffer.alloc(8);
        buffer.writeBigInt64BE(BigInt(timeIndex), 0);
        const hmac = crypto.createHmac('sha1', key);
        hmac.update(buffer);
        const hmacResult = hmac.digest();
        const offset = hmacResult[hmacResult.length - 1] & 0xf;
        const code =
            ((hmacResult[offset] & 0x7f) << 24) |
            ((hmacResult[offset + 1] & 0xff) << 16) |
            ((hmacResult[offset + 2] & 0xff) << 8) |
            (hmacResult[offset + 3] & 0xff);
        return (code % 1000000).toString().padStart(6, '0');
    }
    
    const currentTimeIndex = Math.floor(Date.now() / 1000 / 30);
    for (let i = -window; i <= window; i++) {
        if (getTotpCode(secret, currentTimeIndex + i) === code) {
            return true;
        }
    }
    return false;
}

async function completeMFA() {
    const userId = '6f0770d2-9826-4805-93eb-bb9f86b38647';
    const totpSecret = 'UH4H4TOHDWYHOIUI';
    
    // Get the code from user
    const code = process.argv[2];
    if (!code) {
        console.log('Usage: node complete-mfa.mjs <6-digit-code-from-google-authenticator>');
        console.log('Example: node complete-mfa.mjs 123456');
        process.exit(1);
    }
    
    // Verify TOTP
    const isValid = verifyTotpCode(totpSecret, code.trim());
    if (!isValid) {
        console.log('❌ Invalid TOTP code. Check Google Authenticator and try again.');
        process.exit(1);
    }
    
    console.log('✅ TOTP verified!');
    
    // Generate 10 recovery codes
    const recoveryCodes = [];
    const hashedCodes = [];
    for (let i = 0; i < 10; i++) {
        const code = Array.from({ length: 3 }, () => crypto.randomBytes(2).toString('hex').toUpperCase()).join('-');
        recoveryCodes.push(code);
        const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
        hashedCodes.push({ user_id: userId, code_hash: hashedCode });
    }
    
    await supabase.from('recovery_codes').insert(hashedCodes);
    
    // Enable MFA and update employee
    const nextSessionVersion = 12;
    
    await supabase
        .from('auth')
        .update({
            totp_secret: totpSecret,
            mfa_enabled: true,
            failed_attempts: 0,
        })
        .eq('user_id', userId);
    
    await supabase
        .from('employees')
        .update({
            status: 'active',
            approval_status: 'approved',
            session_version: nextSessionVersion,
        })
        .eq('id', userId);
    
    // Audit logs
    await supabase.from('audit_logs').insert([
        { restaurant_id: null, user_id: userId, target_user_id: userId, actor_id: userId, action: 'mfa_reset_completed', ip_address: '127.0.0.1', device: 'desktop', browser: 'cli', details: { method: 'totp_manual_setup' } },
        { restaurant_id: null, user_id: userId, target_user_id: userId, actor_id: userId, action: 'session_version_incremented', ip_address: '127.0.0.1', device: 'desktop', browser: 'cli', details: { reason: 'mfa_manual_setup', new_version: nextSessionVersion } },
        { restaurant_id: null, user_id: userId, target_user_id: userId, actor_id: userId, action: 'recovery_code_generated', ip_address: '127.0.0.1', device: 'desktop', browser: 'cli', details: { count: 10, source: 'mfa_manual_setup' } }
    ]);
    
    console.log('\n✅ MFA ENABLED SUCCESSFULLY!');
    console.log('\n=== RECOVERY CODES (SAVE THESE - SHOWN ONCE) ===');
    recoveryCodes.forEach((code, i) => console.log(`${i + 1}. ${code}`));
    console.log('\n✅ Now you can login with the 3-step flow!');
    console.log('Run: curl -X POST http://control.localhost:3005/api/auth/super-admin/login/initiate ...');
}

completeMFA().catch(console.error);
