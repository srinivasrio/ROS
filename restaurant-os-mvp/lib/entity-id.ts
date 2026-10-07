import crypto from 'crypto';

/**
 * Supported Entity Type Prefixes for TypeID (UUIDv7 based)
 */
export const ENTITY_PREFIXES = {
    employee: 'usr',
    restaurant: 'rst',
    branch: 'brn',
    table: 'tbl',
    menu: 'mnu',
    category: 'cat',
    menu_item: 'itm',
    order: 'ord',
    order_item: 'oit',
    payment: 'pay',
    invoice: 'inv',
    reservation: 'res',
    kds_ticket: 'kds',
    delivery: 'del',
    payroll_run: 'prun',
    payroll_item: 'plit',
    attendance: 'att',
    registration_request: 'reg',
    offer: 'off',
    coupon: 'cpn',
    service_request: 'srv',
    notification: 'ntf',
    subscription: 'sub',
    audit_log: 'aud',
} as const;

export type EntityPrefix = typeof ENTITY_PREFIXES[keyof typeof ENTITY_PREFIXES];

// Crockford's Base32 alphabet (lowercase)
const CROCKFORD_ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';

/**
 * Generate RFC 9562 compliant UUIDv7 hex string
 */
export function generateUuidV7(timestampMs: number = Date.now()): string {
    const bytes = crypto.randomBytes(16);
    const ts = BigInt(timestampMs);

    // 48-bit timestamp in milliseconds (bytes 0..5)
    bytes[0] = Number((ts >> BigInt(40)) & BigInt(0xff));
    bytes[1] = Number((ts >> BigInt(32)) & BigInt(0xff));
    bytes[2] = Number((ts >> BigInt(24)) & BigInt(0xff));
    bytes[3] = Number((ts >> BigInt(16)) & BigInt(0xff));
    bytes[4] = Number((ts >> BigInt(8)) & BigInt(0xff));
    bytes[5] = Number(ts & BigInt(0xff));

    // version 7 (0b0111) in high 4 bits of byte 6
    bytes[6] = (bytes[6] & 0x0f) | 0x70;
    // variant 10 (0b10) in high 2 bits of byte 8
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    return [
        bytes.toString('hex', 0, 4),
        bytes.toString('hex', 4, 6),
        bytes.toString('hex', 6, 8),
        bytes.toString('hex', 8, 10),
        bytes.toString('hex', 10, 16),
    ].join('-');
}

/**
 * Convert a standard 128-bit UUID to Crockford Base32 TypeID with a typed prefix
 */
export function uuidToTypeID(prefix: string, uuid: string): string {
    if (!uuid) return '';
    const hex = uuid.replace(/-/g, '').toLowerCase();
    if (hex.length !== 32) {
        throw new Error(`Invalid UUID length for conversion: ${uuid}`);
    }

    let val = BigInt('0x' + hex);
    const chars = new Array(26);
    for (let i = 25; i >= 0; i--) {
        chars[i] = CROCKFORD_ALPHABET[Number(val & BigInt(0x1f))];
        val = val >> BigInt(5);
    }

    return prefix ? `${prefix}_${chars.join('')}` : chars.join('');
}

/**
 * Decode a Crockford Base32 TypeID back to a standard UUID hex string
 */
export function typeIDToUuid(typeId: string): string {
    if (!typeId) return '';
    const parts = typeId.split('_');
    const suffix = (parts.length > 1 ? parts[1] : parts[0]).toLowerCase();

    // If it is already a UUID format, return standard lowercase
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(typeId)) {
        return typeId.toLowerCase();
    }

    if (suffix.length !== 26) {
        throw new Error(`Invalid TypeID suffix length: ${suffix}`);
    }

    let val = BigInt(0);
    for (let i = 0; i < suffix.length; i++) {
        let ch = suffix[i];
        if (ch === 'o') ch = '0';
        if (ch === 'i' || ch === 'l') ch = '1';
        const idx = CROCKFORD_ALPHABET.indexOf(ch);
        if (idx === -1) {
            throw new Error(`Invalid character in TypeID: ${ch}`);
        }
        val = (val << BigInt(5)) | BigInt(idx);
    }

    const hex = val.toString(16).padStart(32, '0');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Generate a fresh TypeID with a given entity prefix backed by UUIDv7
 */
export function generateTypeID(prefix: EntityPrefix | string, timestampMs: number = Date.now()): string {
    const uuid = generateUuidV7(timestampMs);
    return uuidToTypeID(prefix, uuid);
}

/**
 * Normalizes phone numbers to standard E.164 format.
 * Defaults to Indian country code (+91) for 10-digit inputs.
 */
export function normalizeE164Phone(rawPhone: string | null | undefined, defaultCountryCode: string = '91'): string | null {
    if (!rawPhone) return null;
    const clean = String(rawPhone).trim();
    if (!clean) return null;

    const digits = clean.replace(/[^0-9]/g, '');
    if (!digits) return null;

    // 10-digit Indian mobile number
    if (digits.length === 10 && ['6', '7', '8', '9'].includes(digits[0])) {
        return `+${defaultCountryCode}${digits}`;
    }

    // 11 digits starting with 0 (STD/0-prefixed mobile)
    if (digits.length === 11 && digits.startsWith('0')) {
        return `+${defaultCountryCode}${digits.slice(1)}`;
    }

    // 12 digits starting with country code 91
    if (digits.length === 12 && digits.startsWith('91')) {
        return `+${digits}`;
    }

    // International number with explicit leading +
    if (clean.startsWith('+')) {
        return `+${digits}`;
    }

    // Default 10 digits fallback
    if (digits.length === 10) {
        return `+${defaultCountryCode}${digits}`;
    }

    // Otherwise prefix with + if 11-15 digits
    if (digits.length >= 10 && digits.length <= 15) {
        return `+${digits}`;
    }

    return `+${digits}`;
}

/**
 * Extract clean 10-digit mobile number for legacy compatibility
 */
export function cleanPhoneDigits(rawPhone: string | null | undefined): string {
    if (!rawPhone) return '';
    const digits = String(rawPhone).replace(/[^0-9]/g, '');
    return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * Validates if a string is a valid E.164 formatted number
 */
export function isValidE164(phone: string): boolean {
    if (!phone) return false;
    return /^\+[1-9]\d{7,14}$/.test(phone);
}

/**
 * Sanitizes employee profile objects by strictly removing passwords,
 * hashes, PINs, OTPs, auth tokens, recovery codes, and secrets.
 */
export function sanitizeEmployeeProfile(emp: any): any {
    if (!emp) return null;
    const safe = { ...emp };

    // Preserve staff PIN for authorized admin display if available
    const displayPin = emp.raw_pin ? String(emp.raw_pin) : (emp.pin && !String(emp.pin).startsWith('$argon2') && !String(emp.pin).startsWith('$2') ? String(emp.pin) : null);
    safe.pin = displayPin;

    // Delete all sensitive authentication passwords/hashes
    delete safe.raw_pin;
    delete safe.raw_password;
    delete safe.password_hash;
    delete safe.activation_token;
    delete safe.registration_token;
    delete safe.registration_token_expires_at;
    delete safe.login_verification_token;
    delete safe.login_verification_token_expires_at;
    delete safe.email_change_token;
    delete safe.email_change_token_created_at;
    delete safe.mfa_reset_at;
    delete safe.mfa_reset_by;
    delete safe.recovery_codes;
    delete safe.otp_secret;
    delete safe.auth_token;

    // Ensure display identifiers are set
    if (!safe.employee_code && safe.id) {
        safe.employee_code = safe.employee_id || `EMP-${safe.id.slice(0, 4).toUpperCase()}`;
    }

    // Ensure internal_id is set
    if (!safe.internal_id && safe.id) {
        try {
            safe.internal_id = uuidToTypeID('usr', safe.id);
        } catch {
            // ignore
        }
    }

    return safe;
}

/**
 * Validates whether a string is a TypeID for a given entity prefix
 */
export function isTypeID(val: string | null | undefined, prefix?: string): boolean {
    if (!val || typeof val !== 'string') return false;
    const parts = val.split('_');
    if (parts.length !== 2) return false;
    if (prefix && parts[0] !== prefix) return false;
    return parts[1].length === 26 && /^[0-9a-z]{26}$/i.test(parts[1]);
}

/**
 * Universal Entity ID helpers for display and reference codes
 */
export const EntityIdResolver = {
    isTypeID,

    toDisplayEmployeeCode(emp: { employee_code?: string | null; legacy_reference?: string | null; employee_id?: string | null; id?: string }): string {
        return emp.employee_code || emp.legacy_reference || emp.employee_id || (emp.id ? `EMP-${emp.id.slice(0, 4).toUpperCase()}` : 'EMP-0000');
    },

    toDisplayInvoiceNumber(inv: { invoice_number?: string | null; id?: string }): string {
        return inv.invoice_number || (inv.id ? `DIO-${inv.id.slice(0, 8).toUpperCase()}` : 'INV-0000');
    },

    toDisplayOrderNumber(ord: { order_number?: number | string | null; id?: string }): string {
        return ord.order_number ? String(ord.order_number) : (ord.id ? ord.id.slice(0, 8).toUpperCase() : 'ORD-0000');
    },

    toDisplayTableNumber(tbl: { table_number?: string | null; id?: string | number }): string {
        return tbl.table_number ? String(tbl.table_number) : `Table ${tbl.id}`;
    },

    toDisplayBranchCode(brn: { branch_code?: string | null; code?: string | null; id?: string }): string {
        return brn.branch_code || brn.code || brn.id || 'MAIN';
    },

    toDisplayRestaurantCode(rst: { restaurant_code?: string | null; id?: string; name?: string }): string {
        return rst.restaurant_code || rst.id || rst.name || 'REST';
    }
};
