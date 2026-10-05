import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import argon2 from 'argon2';

dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function hashPin(pin) {
    return await argon2.hash(String(pin).trim(), {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4
    });
}

async function migrateEmployeePins() {
    console.log('--- Starting Safe Authentication & PIN Migration ---');

    const { data: employees, error } = await supabaseAdmin
        .from('employees')
        .select('id, name, role, mobile, email, restaurant_id, pin, is_deleted');

    if (error) {
        console.error('Failed to fetch employees:', error);
        process.exit(1);
    }

    console.log(`Found ${employees.length} employees to inspect.`);

    let migratedPlainCount = 0;
    let assignedDefaultCount = 0;
    let alreadySecureCount = 0;

    for (const emp of employees) {
        const rawPin = emp.pin;
        let finalHash = null;

        if (rawPin && String(rawPin).startsWith('$argon2')) {
            alreadySecureCount++;
            finalHash = rawPin;
        } else if (rawPin && String(rawPin).trim().length > 0) {
            // Existing plaintext PIN like '1234' or '0000'
            const cleanPin = String(rawPin).trim();
            finalHash = await hashPin(cleanPin);
            migratedPlainCount++;
            console.log(`[MIGRATE] Hashing plaintext PIN for ${emp.name} (${emp.role}) [ID: ${emp.id}]`);
        } else {
            // Null or empty PIN: assign default PIN '1234'
            const defaultPin = '1234';
            finalHash = await hashPin(defaultPin);
            assignedDefaultCount++;
            console.log(`[ASSIGN] Assigning default PIN (1234) for ${emp.name} (${emp.role}) [ID: ${emp.id}]`);
        }

        // Update employees table
        await supabaseAdmin
            .from('employees')
            .update({ pin: finalHash })
            .eq('id', emp.id);

        // Ensure auth table has matching record with failed_attempts reset
        const { data: existingAuth } = await supabaseAdmin
            .from('auth')
            .select('user_id, password_hash')
            .eq('user_id', emp.id)
            .maybeSingle();

        const roleLower = (emp.role || '').toLowerCase();
        const isAdmin = ['admin', 'restaurant_admin', 'super_admin', 'superadmin', 'owner'].includes(roleLower);

        if (!existingAuth) {
            await supabaseAdmin.from('auth').insert({
                user_id: emp.id,
                password_hash: finalHash,
                failed_attempts: 0,
                locked_until: null
            });
        } else if (!isAdmin || !existingAuth.password_hash || existingAuth.password_hash === 'pending_activation') {
            // For staff employees, keep auth password_hash in sync with PIN hash
            await supabaseAdmin
                .from('auth')
                .update({
                    password_hash: finalHash,
                    failed_attempts: 0,
                    locked_until: null
                })
                .eq('user_id', emp.id);
        }
    }

    console.log('\n--- Migration Summary ---');
    console.log(`Already Argon2 secured: ${alreadySecureCount}`);
    console.log(`Migrated from plaintext: ${migratedPlainCount}`);
    console.log(`Assigned default PIN (1234): ${assignedDefaultCount}`);
    console.log(`Total employees processed: ${employees.length}`);
    console.log('PIN Migration completed safely.\n');
}

migrateEmployeePins().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
