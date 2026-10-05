import argon2 from 'argon2';

async function verify() {
    const hash = '$argon2id$v=19$m=65536,t=3,p=4$DSmC6/z7VeNFeTubQmshlw$eybsa0SLDWhc7kFFMXOuH45G90F7wI/UykmVSQ4WRaA';
    const testPasswords = [
        'Sree@17251725',
        'Sree@17251725',
        'Admin@12345',
        'Password123!',
        'Password@123',
        'Sree@1725',
    ];
    
    for (const pwd of testPasswords) {
        try {
            const valid = await argon2.verify(hash, pwd);
            console.log(`"${pwd}": ${valid ? '✅ MATCH' : '❌ No match'}`);
        } catch (e) {
            console.log(`"${pwd}": Error - ${e.message}`);
        }
    }
}

verify().catch(console.error);
