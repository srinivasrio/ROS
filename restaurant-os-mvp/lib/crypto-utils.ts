const SALT = process.env.AUTH_SALT || 'dine-in-one-salt-key-2026';

/**
 * Hashes a given string (password or PIN) using native Web Crypto SHA-256 with a static salt.
 */
export async function hashText(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text + SALT);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Compares plain text against a stored hash.
 */
export async function compareText(text: string, hash: string): Promise<boolean> {
    const textHash = await hashText(text);
    return textHash === hash;
}

/**
 * Generates a 6-digit numeric OTP code for 2FA.
 */
export function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
