import crypto from 'crypto';
import argon2 from 'argon2';

/**
 * Hash password using Argon2id
 */
export async function hashPassword(password: string): Promise<string> {
    return await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4
    });
}

/**
 * Verify password against Argon2 hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
        return await argon2.verify(hash, password);
    } catch (err) {
        console.error('Argon2 verification failed:', err);
        return false;
    }
}

/**
 * Base32 decode implementation
 */
function base32Decode(base32: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleaned = base32.toUpperCase().replace(/=+$/, '');
    let bits = '';
    for (let i = 0; i < cleaned.length; i++) {
        const val = alphabet.indexOf(cleaned[i]);
        if (val === -1) throw new Error('Invalid base32 character');
        bits += val.toString(2).padStart(5, '0');
    }
    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.substring(i, i + 8), 2));
    }
    return Buffer.from(bytes);
}

/**
 * Generate a random Base32 TOTP secret
 */
export function generateBase32Secret(length: number = 16): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
        result += alphabet[bytes[i] % 32];
    }
    return result;
}

/**
 * Get TOTP code for a specific time index
 */
export function getTotpCode(secret: string, timeIndex: number): string {
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

/**
 * Verify TOTP code with time window
 */
export function verifyTotpCode(secret: string, code: string, window: number = 1): boolean {
    const currentTimeIndex = Math.floor(Date.now() / 1000 / 30);
    for (let i = -window; i <= window; i++) {
        if (getTotpCode(secret, currentTimeIndex + i) === code) {
            return true;
        }
    }
    return false;
}

/**
 * Generate TOTP URI for QR codes (compatible with Google Authenticator, Microsoft Authenticator, 2FAS)
 */
export function generateTotpUri(email: string, issuer: string, secret: string): string {
    return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Validate password complexity based on policy:
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export function validatePasswordComplexity(password: string): boolean {
    if (password.length < 12) return false;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    return hasUpper && hasLower && hasDigit && hasSpecial;
}
