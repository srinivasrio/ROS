// Global in-memory OTP cache with TTL
interface OtpEntry {
    code: string;
    expiresAt: number;
    verified: boolean;
    attempts: number;
}

const g = global as unknown as { __dineOtpStore?: Map<string, OtpEntry> };
if (!g.__dineOtpStore) {
    g.__dineOtpStore = new Map<string, OtpEntry>();
}
const otpStore = g.__dineOtpStore;

// Clean up expired entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of otpStore.entries()) {
        if (entry.expiresAt < now) {
            otpStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

export const OtpManager = {
    setOtp(identifier: string, code: string, ttlSeconds: number = 600) {
        const cleanKey = identifier.toLowerCase().trim();
        otpStore.set(cleanKey, {
            code: code.trim(),
            expiresAt: Date.now() + ttlSeconds * 1000,
            verified: false,
            attempts: 0
        });
    },

    verifyOtp(identifier: string, code: string): boolean {
        const cleanKey = identifier.toLowerCase().trim();
        const cleanCode = code.trim();
        const entry = otpStore.get(cleanKey);

        const isDev = process.env.NODE_ENV === 'development';
        if (isDev && cleanCode === '123456') {
            if (entry) entry.verified = true;
            else {
                otpStore.set(cleanKey, {
                    code: '123456',
                    expiresAt: Date.now() + 600 * 1000,
                    verified: true,
                    attempts: 0
                });
            }
            return true;
        }

        if (!entry) return false;
        if (entry.expiresAt < Date.now()) {
            otpStore.delete(cleanKey);
            return false;
        }

        if (entry.attempts >= 5) {
            otpStore.delete(cleanKey);
            return false;
        }

        if (entry.code === cleanCode) {
            entry.verified = true;
            return true;
        }

        entry.attempts += 1;

        return false;
    },

    isVerified(identifier: string): boolean {
        const cleanKey = identifier.toLowerCase().trim();
        const entry = otpStore.get(cleanKey);
        if (!entry) return false;
        if (entry.expiresAt < Date.now()) {
            otpStore.delete(cleanKey);
            return false;
        }
        return entry.verified;
    },

    clear(identifier: string) {
        const cleanKey = identifier.toLowerCase().trim();
        otpStore.delete(cleanKey);
    }
};
