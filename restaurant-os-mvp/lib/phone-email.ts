/**
 * Phone.Email integration helpers for Customer Phone OTP SMS Verification
 * Free SMS verification for Indian phone numbers without DLT/TRAI registration.
 */

export function getPhoneEmailClientId(): string {
    return (
        process.env.NEXT_PUBLIC_PHONE_EMAIL_CLIENT_ID ||
        process.env.PHONE_EMAIL_CLIENT_ID ||
        ''
    ).trim();
}

export function isPhoneEmailConfigured(): boolean {
    return !!getPhoneEmailClientId();
}

/**
 * Server-side verification of Phone.Email verified payload.
 * When Phone.Email verifies a phone number via SMS OTP, it supplies a user_json_url
 * (e.g., https://user.phone.email/user_xxxx.json) containing the cryptographically authentic
 * verification data.
 */
export async function verifyPhoneEmailPayload(userJsonUrl: string): Promise<{
    success: boolean;
    phone?: string;
    countryCode?: string;
    error?: string;
}> {
    try {
        if (!userJsonUrl || typeof userJsonUrl !== 'string') {
            return { success: false, error: 'Verification URL is missing.' };
        }

        const trimmedUrl = userJsonUrl.trim();
        // Strict domain verification to prevent SSRF
        if (!trimmedUrl.startsWith('https://user.phone.email/')) {
            return {
                success: false,
                error: 'Invalid Phone.Email verification host. Expected https://user.phone.email/',
            };
        }

        const res = await fetch(trimmedUrl, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'User-Agent': 'Restaurant-OS-Verification/1.0',
            },
            cache: 'no-store',
        });

        if (!res.ok) {
            return {
                success: false,
                error: `Failed to fetch verification status from Phone.Email (HTTP ${res.status}).`,
            };
        }

        const data = await res.json();
        const rawPhone = data.user_phone_number || data.phone_no || data.phone || '';
        const countryCode = data.user_country_code || data.country_code || '+91';

        if (!rawPhone) {
            return {
                success: false,
                error: 'Phone number not found in Phone.Email verification response.',
            };
        }

        const cleanPhone = String(rawPhone).replace(/\D/g, '').slice(-10);
        if (cleanPhone.length !== 10) {
            return {
                success: false,
                error: `Invalid phone number length returned (${cleanPhone}).`,
            };
        }

        return {
            success: true,
            phone: cleanPhone,
            countryCode,
        };
    } catch (err: any) {
        console.error('[verifyPhoneEmailPayload Exception]', err);
        return {
            success: false,
            error: err.message || 'Error communicating with Phone.Email verification server.',
        };
    }
}
