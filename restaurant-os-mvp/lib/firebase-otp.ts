'use client';

import {
    RecaptchaVerifier,
    signInWithPhoneNumber,
    ConfirmationResult,
    UserCredential,
} from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from './firebase';

/**
 * Initializes an invisible or normal reCAPTCHA verifier for Firebase Phone Auth
 */
export function initRecaptchaVerifier(containerId: string = 'recaptcha-container'): RecaptchaVerifier | null {
    const auth = getFirebaseAuth();
    if (!auth) return null;

    if (typeof window === 'undefined') return null;

    try {
        // Clear previous verifier on window if any
        if ((window as any).recaptchaVerifier) {
            try {
                (window as any).recaptchaVerifier.clear();
            } catch {}
            (window as any).recaptchaVerifier = null;
        }

        const verifier = new RecaptchaVerifier(auth, containerId, {
            size: 'invisible',
            callback: () => {
                // reCAPTCHA solved - will proceed with submit
            },
            'expired-callback': () => {
                console.warn('[Firebase Recaptcha] Expired, will need to re-verify');
            },
        });

        (window as any).recaptchaVerifier = verifier;
        return verifier;
    } catch (err) {
        console.error('[Firebase Recaptcha Init Error]', err);
        return null;
    }
}

/**
 * Sends a Phone OTP SMS using Firebase Authentication
 * Formats 10-digit number into E.164 (+91XXXXXXXXXX)
 */
export async function sendFirebaseOtp(
    phone: string,
    verifier: RecaptchaVerifier
): Promise<{ success: boolean; confirmationResult?: ConfirmationResult; error?: string }> {
    const auth = getFirebaseAuth();
    if (!auth) {
        return { success: false, error: 'Firebase is not initialized or configured.' };
    }

    try {
        const cleanDigits = phone.replace(/\D/g, '').slice(-10);
        const e164Phone = `+91${cleanDigits}`;

        const confirmationResult = await signInWithPhoneNumber(auth, e164Phone, verifier);
        return { success: true, confirmationResult };
    } catch (err: any) {
        console.error('[Firebase sendOtp Error]', err);
        let errorMsg = 'Failed to send SMS verification code via Firebase.';

        if (err.code === 'auth/invalid-phone-number') {
            errorMsg = 'The phone number format is invalid.';
        } else if (err.code === 'auth/quota-exceeded') {
            errorMsg = 'SMS quota exceeded. Please try again later.';
        } else if (err.code === 'auth/too-many-requests') {
            errorMsg = 'Too many requests. Please wait a few moments and try again.';
        } else if (err.code === 'auth/captcha-check-failed') {
            errorMsg = 'reCAPTCHA verification failed. Please try again.';
        } else if (err.message) {
            errorMsg = err.message;
        }

        return { success: false, error: errorMsg };
    }
}

/**
 * Verifies the 6-digit OTP code against the Firebase ConfirmationResult
 */
export async function verifyFirebaseOtp(
    confirmationResult: ConfirmationResult,
    code: string
): Promise<{ success: boolean; user?: UserCredential['user']; idToken?: string; error?: string }> {
    try {
        const userCredential = await confirmationResult.confirm(code.trim());
        const user = userCredential.user;
        const idToken = await user.getIdToken();

        return { success: true, user, idToken };
    } catch (err: any) {
        console.error('[Firebase verifyOtp Error]', err);
        let errorMsg = 'Invalid verification code.';

        if (err.code === 'auth/invalid-verification-code') {
            errorMsg = 'Incorrect verification code. Please check and try again.';
        } else if (err.code === 'auth/code-expired') {
            errorMsg = 'The verification code has expired. Please request a new one.';
        } else if (err.message) {
            errorMsg = err.message;
        }

        return { success: false, error: errorMsg };
    }
}
