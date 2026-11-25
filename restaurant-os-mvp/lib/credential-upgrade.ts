import { hashPassword, hashPin, needsRehash } from './auth-utils';
import { supabaseAdmin } from './supabase-admin';

/**
 * Upgrades a legacy Argon2 or weak credential hash in `auth.password_hash` to Web Crypto PBKDF2.
 * Awaited inline so serverless isolates (Cloudflare Workers) complete the write before returning.
 */
export async function upgradePasswordHashIfNeeded(
    userId: string,
    currentHash: string | null | undefined,
    rawPassword: string,
    context: string
): Promise<void> {
    if (!currentHash || !needsRehash(currentHash)) return;
    try {
        const newHash = await hashPassword(rawPassword);
        const { error } = await supabaseAdmin
            .from('auth')
            .update({ password_hash: newHash })
            .eq('user_id', userId);
        if (error) {
            console.error(`[${context}] Failed to upgrade password hash:`, error.message);
        } else {
            console.log(`[${context}] Silently upgraded password hash to PBKDF2 for user ${userId}`);
        }
    } catch (err) {
        console.error(`[${context}] Error rehashing password:`, err);
    }
}

/**
 * Upgrades a legacy Argon2 or plaintext employee PIN in `employees.pin` (and optionally
 * `auth.password_hash` for PIN-only staff roles) to Web Crypto PBKDF2.
 */
export async function upgradeEmployeePinIfNeeded(
    employeeId: string,
    storedPinHash: string | null | undefined,
    rawPin: string,
    context: string,
    mirrorAuthTable: boolean = true
): Promise<void> {
    if (!storedPinHash || !needsRehash(storedPinHash, true)) return;
    try {
        const newPinHash = await hashPin(rawPin);
        const { error } = await supabaseAdmin
            .from('employees')
            .update({ pin: newPinHash })
            .eq('id', employeeId);
        if (error) {
            console.error(`[${context}] Failed to upgrade PIN hash:`, error.message);
        } else {
            console.log(`[${context}] Silently upgraded PIN hash to PBKDF2 for employee ${employeeId}`);
        }

        if (mirrorAuthTable) {
            const { error: authErr } = await supabaseAdmin
                .from('auth')
                .update({ password_hash: newPinHash })
                .eq('user_id', employeeId);
            if (authErr) {
                console.error(`[${context}] Failed to mirror upgraded PIN hash to auth:`, authErr.message);
            }
        }
    } catch (err) {
        console.error(`[${context}] Error rehashing PIN:`, err);
    }
}
