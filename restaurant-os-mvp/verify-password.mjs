import argon2 from 'argon2';
import dotenv from 'dotenv';
import fs from 'fs';

if (fs.existsSync('.env.local')) {
    dotenv.config({ path: '.env.local' });
}

async function verify() {
    const hash = process.env.TEST_PASSWORD_HASH || process.argv[2];
    const password = process.env.TEST_PASSWORD || process.argv[3];
    
    if (!hash || !password) {
        console.error('Usage: TEST_PASSWORD_HASH=... TEST_PASSWORD=... node verify-password.mjs');
        console.error('   or: node verify-password.mjs <hash> <password>');
        process.exit(1);
    }
    
    try {
        const valid = await argon2.verify(hash, password);
        console.log(`Password verification: ${valid ? '✅ MATCH' : '❌ No match'}`);
    } catch (e) {
        console.log('Error verifying password:', e.message);
    }
}

verify().catch(console.error);
