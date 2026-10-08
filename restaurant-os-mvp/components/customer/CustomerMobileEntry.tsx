'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Phone, ArrowRight, Loader2, Utensils, ShoppingBag, Bike,
    AlertCircle, CheckCircle2, ChevronRight, MapPin, User, Calendar,
    ShieldCheck, KeyRound, Edit2, RotateCcw, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { HomepageBuilderService } from '@/services/homepage-builder.service';
import { CustomerCache } from '@/services/homepage-cache.service';
import { formatAddress } from '@/lib/utils';
import { isFirebaseConfigured } from '@/lib/firebase';
import { initRecaptchaVerifier, sendFirebaseOtp, verifyFirebaseOtp } from '@/lib/firebase-otp';
import type { ConfirmationResult } from 'firebase/auth';

interface CustomerMobileEntryProps {
    restaurantCode: string;
    initialTable?: string | null;
}

interface ActiveOrderInfo {
    id: string;
    orderNumber: number | string;
    orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
    status: string;
    tableNumber: string | null;
    totalAmount: number;
    createdAt: string;
    redirectUrl: string;
}

interface RestaurantProfile {
    name?: string;
    logo_url?: string;
    logo?: string;
    address?: string;
    tagline?: string;
}

export default function CustomerMobileEntry({ restaurantCode, initialTable }: CustomerMobileEntryProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const tableFromUrl = initialTable || searchParams?.get('table') || searchParams?.get('tableNumber') || searchParams?.get('table_number') || searchParams?.get('t') || '';

    // Flow Step: 'details' (Name, DOB, Mobile) -> 'otp' (Verify 6-digit code)
    const [step, setStep] = useState<'details' | 'otp'>('details');

    // Customer Form Inputs
    const [name, setName] = useState('');
    const [dob, setDob] = useState('');
    const [dobFocused, setDobFocused] = useState(false);
    const dobInputRef = useRef<HTMLInputElement>(null);
    const [mobile, setMobile] = useState('');

    // OTP State
    const [otp, setOtp] = useState('');
    const [devOtp, setDevOtp] = useState<string | null>(null);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [maskedPhone, setMaskedPhone] = useState('');
    const confirmationResultRef = useRef<ConfirmationResult | null>(null);
    const recaptchaContainerId = 'customer-firebase-recaptcha';

    // Restaurant Profile
    const [profile, setProfile] = useState<RestaurantProfile | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);

    // Submission & Error states
    const [submitting, setSubmitting] = useState(false);
    const [validationError, setValidationError] = useState('');
    const [serverError, setServerError] = useState('');

    // Active Orders State
    const [multipleActiveOrders, setMultipleActiveOrders] = useState<ActiveOrderInfo[]>([]);
    const [showMultipleOrdersModal, setShowMultipleOrdersModal] = useState(false);
    const [redirectingMessage, setRedirectingMessage] = useState('');

    // Load saved details and restaurant profile on mount
    useEffect(() => {
        if (!restaurantCode) return;

        try {
            const savedName = localStorage.getItem(`ros_customer_name_${restaurantCode}`) || '';
            const savedDob = localStorage.getItem(`ros_customer_dob_${restaurantCode}`) || '';
            const savedMobile = localStorage.getItem(`ros_customer_mobile_${restaurantCode}`) || '';

            if (savedName) setName(savedName);
            if (savedDob) setDob(savedDob);
            if (savedMobile) {
                const digits = savedMobile.replace(/\D/g, '');
                setMobile(digits.length > 10 ? digits.slice(-10) : digits);
            }
        } catch {}

        HomepageBuilderService.getProfile(restaurantCode)
            .then(profileData => {
                if (profileData) {
                    setProfile({
                        name: profileData.name || profileData.restaurant_name,
                        logo_url: profileData.logo_url || profileData.logo,
                        address: formatAddress(profileData.address),
                        tagline: profileData.tagline,
                    });
                }
            })
            .catch(err => {
                console.warn('Could not load restaurant profile:', err);
            })
            .finally(() => setLoadingProfile(false));
    }, [restaurantCode]);

    // Resend countdown timer
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setInterval(() => {
            setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [resendCooldown]);

    // Phone format handler
    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let raw = e.target.value.replace(/\D/g, '');
        if (raw.startsWith('91') && raw.length > 10) {
            raw = raw.slice(2);
        } else if (raw.startsWith('0') && raw.length > 10) {
            raw = raw.slice(1);
        }
        const val = raw.slice(0, 10);
        setMobile(val);
        setValidationError('');
        setServerError('');
    };

    // OTP format handler
    const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
        setOtp(val);
        setValidationError('');
        setServerError('');
    };

    // Step 1: Send OTP
    const handleSendOtp = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setServerError('');
        setValidationError('');

        const cleanName = name.trim();
        if (!cleanName || cleanName.length < 2) {
            setValidationError('Please enter your full name');
            return;
        }

        if (!dob) {
            setValidationError('Please select your Date of Birth');
            return;
        }

        const cleanMobile = mobile.trim().replace(/\D/g, '');
        if (!cleanMobile) {
            setValidationError('Please enter your mobile number');
            return;
        }
        if (cleanMobile.length !== 10) {
            setValidationError('Please enter a complete 10-digit mobile number');
            return;
        }
        if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
            setValidationError('Mobile number should start with 6, 7, 8, or 9');
            return;
        }

        try {
            setSubmitting(true);

            // Primary: Firebase Authentication Phone OTP
            if (isFirebaseConfigured()) {
                const verifier = initRecaptchaVerifier(recaptchaContainerId);
                if (!verifier) {
                    throw new Error('Security check could not be initialized. Please refresh the page.');
                }

                const fbRes = await sendFirebaseOtp(cleanMobile, verifier);
                if (!fbRes.success || !fbRes.confirmationResult) {
                    setServerError(fbRes.error || 'Failed to dispatch SMS code via Firebase.');
                    setSubmitting(false);
                    return;
                }

                confirmationResultRef.current = fbRes.confirmationResult;
                setMaskedPhone(`+91 ******${cleanMobile.slice(-4)}`);
                setResendCooldown(60);
                setDevOtp(null);
                setStep('otp');
                setOtp('');
                setSubmitting(false);
                toast.success('Firebase SMS verification code sent!');
                return;
            }

            // Fallback (when Firebase keys are pending in environment)
            const res = await fetch('/api/customer/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurantCode,
                    mobile: cleanMobile,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setServerError(data.error || 'Failed to send verification code. Please try again.');
                setSubmitting(false);
                return;
            }

            setMaskedPhone(data.maskedPhone || `+91 ******${cleanMobile.slice(-4)}`);
            setResendCooldown(data.cooldownRemaining || 60);
            setDevOtp(data.devOtp || null);
            setStep('otp');
            setOtp('');
            setSubmitting(false);

            if (data.devOtp) {
                toast.info(`Development Mode: Verification code is ${data.devOtp}`, {
                    duration: 10000,
                });
            } else {
                toast.success('Verification code dispatched via SMS!');
            }
        } catch (err: any) {
            console.error('[handleSendOtp Error]', err);
            setServerError(err.message || 'Network error. Please check your connection and try again.');
            setSubmitting(false);
        }
    };

    // Resend OTP handler
    const handleResendOtp = async () => {
        if (resendCooldown > 0 || submitting) return;
        await handleSendOtp();
    };

    // Step 2: Verify OTP and Redirect
    const handleVerifyOtp = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setServerError('');
        setValidationError('');

        const cleanOtp = otp.trim();
        if (cleanOtp.length !== 6) {
            setValidationError('Please enter the complete 6-digit verification code');
            return;
        }

        const cleanMobile = mobile.trim().replace(/\D/g, '');

        try {
            setSubmitting(true);

            let idToken: string | undefined = undefined;

            // If Firebase confirmation result is active, verify through Firebase Auth
            if (confirmationResultRef.current) {
                const fbVerify = await verifyFirebaseOtp(confirmationResultRef.current, cleanOtp);
                if (!fbVerify.success) {
                    setServerError(fbVerify.error || 'Incorrect verification code. Please check and try again.');
                    setSubmitting(false);
                    return;
                }
                idToken = fbVerify.idToken;
            }

            const verifyRes = await fetch('/api/customer/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurantCode,
                    mobile: cleanMobile,
                    otp: cleanOtp,
                    idToken,
                    firebaseVerified: !!idToken,
                    name: name.trim(),
                    dob: dob.trim(),
                }),
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok) {
                setServerError(verifyData.error || 'Invalid verification code. Please try again.');
                setSubmitting(false);
                return;
            }

            // Successfully Verified!
            // Clean old session if a different user logged in on this device
            try {
                const prevMobile = localStorage.getItem(`ros_customer_mobile_${restaurantCode}`) || '';
                const cleanPrev = prevMobile.replace(/\D/g, '').slice(-10);
                if (cleanPrev && cleanPrev !== cleanMobile) {
                    localStorage.removeItem(`ros_customer_${restaurantCode}`);
                    localStorage.removeItem(`ros_customer_name_${restaurantCode}`);
                    localStorage.removeItem(`ros_customer_email_${restaurantCode}`);
                    localStorage.removeItem(`ros_customer_dob_${restaurantCode}`);
                    localStorage.removeItem(`ros_last_order_${restaurantCode}`);
                    if (tableFromUrl) {
                        localStorage.removeItem(`ros_last_order_${restaurantCode}_${tableFromUrl}`);
                    }
                    localStorage.removeItem('customer_cart');
                    localStorage.removeItem('customer_table_number');
                    CustomerCache.clear(restaurantCode);
                }
            } catch {}

            // Persist verified customer info
            try {
                localStorage.setItem(`ros_customer_mobile_${restaurantCode}`, cleanMobile);
                localStorage.setItem(`ros_customer_name_${restaurantCode}`, name.trim());
                localStorage.setItem(`ros_customer_dob_${restaurantCode}`, dob.trim());
                localStorage.setItem(`ros_customer_verified_${restaurantCode}`, 'true');
                localStorage.setItem(`ros_customer_skipped_${restaurantCode}`, 'true');
                if (verifyData.customer?.id) {
                    localStorage.setItem(`ros_customer_${restaurantCode}`, verifyData.customer.id);
                }
            } catch {}

            // Check for existing active orders
            try {
                const activeRes = await fetch('/api/customer/active-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        restaurantCode,
                        mobile: cleanMobile,
                    }),
                });

                if (activeRes.ok) {
                    const activeData = await activeRes.json();
                    const activeOrders: ActiveOrderInfo[] = activeData.activeOrders || [];

                    if (activeData.hasActiveOrder && activeOrders.length > 0) {
                        const isDifferentTable = Boolean(
                            tableFromUrl &&
                            activeOrders.length === 1 &&
                            activeOrders[0].tableNumber &&
                            String(activeOrders[0].tableNumber).toLowerCase() !== String(tableFromUrl).toLowerCase()
                        );

                        if (!isDifferentTable && activeOrders.length === 1) {
                            const singleOrder = activeOrders[0];
                            const orderTypeLabel = singleOrder.orderType === 'DELIVERY'
                                ? 'Home Delivery'
                                : singleOrder.orderType === 'TAKEAWAY'
                                ? 'Takeaway'
                                : (singleOrder.tableNumber ? `Dine In (Table ${singleOrder.tableNumber})` : 'Dine In');

                            setRedirectingMessage(`Active ${orderTypeLabel} order found! Opening...`);
                            toast.success(`Active ${orderTypeLabel} order found!`);
                            setTimeout(() => {
                                router.push(singleOrder.redirectUrl);
                            }, 600);
                            return;
                        } else if (!isDifferentTable) {
                            setMultipleActiveOrders(activeOrders);
                            setShowMultipleOrdersModal(true);
                            setSubmitting(false);
                            return;
                        }
                    }
                }
            } catch (activeErr) {
                console.warn('[Active Order Check Warning]', activeErr);
            }

            // Redirect to dining experience
            setRedirectingMessage('Verification successful! Welcome...');
            toast.success('Mobile verified! Starting your dining experience.');

            setTimeout(() => {
                if (tableFromUrl) {
                    router.push(`/${restaurantCode}/customer/home/${encodeURIComponent(tableFromUrl)}`);
                } else {
                    router.push(`/${restaurantCode}/customer/order-type`);
                }
            }, 600);
        } catch (err: any) {
            console.error('[handleVerifyOtp Error]', err);
            setServerError('Network error during verification. Please try again.');
            setSubmitting(false);
        }
    };

    const handleSelectExistingOrder = (order: ActiveOrderInfo) => {
        setShowMultipleOrdersModal(false);
        setRedirectingMessage(`Opening Order #${order.orderNumber}...`);
        router.push(order.redirectUrl);
    };

    const handleProceedToNewOrder = () => {
        setShowMultipleOrdersModal(false);
        if (tableFromUrl) {
            router.push(`/${restaurantCode}/customer/home/${encodeURIComponent(tableFromUrl)}`);
        } else {
            router.push(`/${restaurantCode}/customer/order-type`);
        }
    };

    const restaurantName = profile?.name || 'Restaurant';
    const logoUrl = profile?.logo_url || profile?.logo;
    const address = formatAddress(profile?.address);
    const tagline = profile?.tagline || 'Experience dining perfected';

    return (
        <div className="min-h-screen bg-[#EEF2F6] flex flex-col justify-between p-4 sm:p-6 md:p-8 font-sans text-slate-800 relative">
            {/* Header with Restaurant Branding */}
            <header className="w-full max-w-md mx-auto text-center pt-6 sm:pt-8 pb-3">
                <motion.div
                    initial={{ opacity: 0, y: -15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="flex flex-col items-center"
                >
                    <div
                        className="size-20 sm:size-24 rounded-3xl p-1 mb-3 flex items-center justify-center overflow-hidden"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: '8px 8px 20px rgba(166, 180, 200, 0.45), -8px -8px 20px rgba(255, 255, 255, 0.95)',
                            border: '1px solid rgba(255, 255, 255, 0.9)',
                        }}
                    >
                        {logoUrl ? (
                            <img src={logoUrl} alt={restaurantName} className="w-full h-full object-cover rounded-2xl" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-orange-500 to-rose-500 rounded-2xl flex items-center justify-center text-white font-black text-3xl">
                                {restaurantName.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-1">
                        {restaurantName}
                    </h1>

                    <p className="text-xs sm:text-sm text-slate-500 max-w-xs line-clamp-1">
                        {tagline}
                    </p>

                    {tableFromUrl && (
                        <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
                            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Table {tableFromUrl}</span>
                        </div>
                    )}
                </motion.div>
            </header>

            {/* Main Form Content */}
            <main className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center py-2 sm:py-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.35, delay: 0.1 }}
                    className="p-6 sm:p-7 rounded-[28px] relative overflow-hidden"
                    style={{
                        backgroundColor: '#EEF2F6',
                        boxShadow: '8px 8px 22px rgba(166, 180, 200, 0.45), -8px -8px 22px rgba(255, 255, 255, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.85)',
                    }}
                >
                    {/* Redirecting Banner */}
                    <AnimatePresence>
                        {redirectingMessage && (
                            <motion.div
                                key="banner-redirecting"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-5 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2.5"
                            >
                                <CheckCircle2 size={18} className="text-emerald-600 shrink-0 animate-bounce" />
                                <span>{redirectingMessage}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Step Switcher */}
                    <AnimatePresence mode="wait">
                        {step === 'details' ? (
                            /* ── STEP 1: Name, DOB, Mobile ─────────────────────── */
                            <motion.div
                                key="step-details"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.25 }}
                            >
                                <div className="mb-5">
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100/70 text-orange-700 text-[10px] font-black uppercase tracking-wider mb-2">
                                        <Sparkles size={11} />
                                        <span>Guest Details & OTP Verification</span>
                                    </div>
                                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                                        Enter Your Details
                                    </h2>
                                    <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
                                        Please provide your name, date of birth, and mobile number to verify with OTP and begin dining.
                                    </p>
                                </div>

                                <form onSubmit={handleSendOtp} className="space-y-4">
                                    {/* Full Name */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1 ml-1">
                                            Full Name <span className="text-rose-500">*</span>
                                        </label>
                                        <div
                                            className="flex items-center rounded-2xl p-1.5 bg-white transition-all focus-within:ring-2 focus-within:ring-orange-500/40"
                                            style={{
                                                boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.3), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                                border: '1px solid rgba(226, 232, 240, 0.8)',
                                            }}
                                        >
                                            <div className="pl-3 pr-2 text-slate-400">
                                                <User size={18} />
                                            </div>
                                            <input
                                                type="text"
                                                autoFocus
                                                disabled={submitting}
                                                placeholder="e.g. Rahul Sharma"
                                                value={name}
                                                onChange={(e) => {
                                                    setName(e.target.value);
                                                    setValidationError('');
                                                    setServerError('');
                                                }}
                                                className="w-full px-2 py-2.5 bg-transparent text-slate-900 font-bold text-sm placeholder:text-slate-400 placeholder:font-normal focus:outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Date of Birth (DOB) */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1 ml-1">
                                            Date of Birth (DOB) <span className="text-rose-500">*</span>
                                        </label>
                                        <div
                                            onClick={() => {
                                                dobInputRef.current?.focus();
                                                try { dobInputRef.current?.showPicker?.(); } catch {}
                                            }}
                                            className="flex items-center rounded-2xl p-1.5 bg-white transition-all cursor-pointer focus-within:ring-2 focus-within:ring-orange-500/40"
                                            style={{
                                                boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.3), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                                border: '1px solid rgba(226, 232, 240, 0.8)',
                                            }}
                                        >
                                            <div className="pl-3 pr-2 text-slate-400">
                                                <Calendar size={18} />
                                            </div>
                                            <input
                                                ref={dobInputRef}
                                                type={dobFocused || dob ? 'date' : 'text'}
                                                onFocus={() => setDobFocused(true)}
                                                onBlur={() => setDobFocused(false)}
                                                disabled={submitting}
                                                placeholder="Select Date of Birth"
                                                value={dob}
                                                max={new Date().toISOString().split('T')[0]}
                                                onChange={(e) => {
                                                    setDob(e.target.value);
                                                    setValidationError('');
                                                    setServerError('');
                                                }}
                                                className="w-full px-2 py-2.5 bg-transparent text-slate-900 font-bold text-sm placeholder:text-slate-400 placeholder:font-normal focus:outline-none cursor-pointer"
                                            />
                                        </div>
                                    </div>

                                    {/* Mobile Number with +91 Prefix */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1 ml-1">
                                            Mobile Number <span className="text-rose-500">*</span>
                                        </label>
                                        <div
                                            className={`flex items-center rounded-2xl p-1.5 transition-all ${
                                                validationError || serverError
                                                    ? 'ring-2 ring-rose-400 bg-rose-50/30'
                                                    : mobile.length === 10
                                                    ? 'ring-2 ring-emerald-400/50 bg-white'
                                                    : 'focus-within:ring-2 focus-within:ring-orange-500/40 bg-white'
                                            }`}
                                            style={{
                                                boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.3), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                                border: '1px solid rgba(226, 232, 240, 0.8)',
                                            }}
                                        >
                                            <div
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 select-none shrink-0"
                                                style={{
                                                    backgroundColor: '#EEF2F6',
                                                    boxShadow: '2px 2px 4px rgba(166, 180, 200, 0.3), -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                                }}
                                            >
                                                <span className="text-sm">🇮🇳</span>
                                                <span>+91</span>
                                            </div>

                                            <input
                                                type="tel"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                disabled={submitting}
                                                placeholder="10-digit number"
                                                value={mobile}
                                                onChange={handlePhoneChange}
                                                className="w-full px-3 py-2 bg-transparent text-slate-900 font-bold text-base placeholder:text-slate-400 placeholder:font-normal focus:outline-none tracking-wider"
                                            />

                                            {mobile && !submitting && (
                                                <button
                                                    type="button"
                                                    onClick={() => setMobile('')}
                                                    className="size-7 rounded-full text-slate-400 hover:text-slate-600 flex items-center justify-center text-xs font-bold hover:bg-slate-100 transition-colors mr-1 cursor-pointer"
                                                    title="Clear"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Validation Error */}
                                    {validationError && (
                                        <p className="text-xs text-rose-500 font-semibold mt-1 ml-1 flex items-center gap-1">
                                            <AlertCircle size={13} className="shrink-0" />
                                            <span>{validationError}</span>
                                        </p>
                                    )}

                                    {/* Server Error */}
                                    {serverError && (
                                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2">
                                            <AlertCircle size={15} className="text-rose-500 shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <span>{serverError}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Invisible Firebase reCAPTCHA Container */}
                                    <div id={recaptchaContainerId} />

                                    {/* Submit Button */}
                                    <button
                                        type="submit"
                                        disabled={submitting || !name.trim() || !dob || mobile.length < 10}
                                        className={`w-full py-4 rounded-2xl font-black text-sm tracking-wide transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                                            submitting
                                                ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                                                : name.trim() && dob && mobile.length === 10
                                                ? 'bg-gradient-to-r from-orange-500 via-orange-600 to-rose-500 text-white shadow-orange-500/30 hover:scale-[1.01] active:scale-[0.99]'
                                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        }`}
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 size={18} className="animate-spin" />
                                                <span>Sending Verification Code...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Get Verification Code</span>
                                                <ArrowRight size={18} />
                                            </>
                                        )}
                                    </button>
                                </form>
                            </motion.div>
                        ) : (
                            /* ── STEP 2: Verify 6-digit OTP ───────────────────── */
                            <motion.div
                                key="step-otp"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.25 }}
                            >
                                <div className="mb-4">
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider mb-2">
                                        <KeyRound size={11} />
                                        <span>Step 2 of 2: OTP Verification</span>
                                    </div>
                                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                                        Enter Verification Code
                                    </h2>
                                    <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
                                        We sent a 6-digit code to <strong className="text-slate-800 font-bold">{maskedPhone || `+91 ******${mobile.slice(-4)}`}</strong>
                                    </p>
                                </div>

                                {/* Customer Summary Card with Edit Button */}
                                <div
                                    className="p-3.5 rounded-2xl mb-4 flex items-center justify-between gap-3 text-xs"
                                    style={{
                                        backgroundColor: '#EEF2F6',
                                        boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                        border: '1px solid rgba(226, 232, 240, 0.9)',
                                    }}
                                >
                                    <div className="min-w-0 space-y-0.5">
                                        <p className="font-extrabold text-slate-800 truncate">{name}</p>
                                        <p className="text-[11px] text-slate-500">
                                            🎂 DOB: {dob} • 📱 +91 {mobile}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setStep('details');
                                            setServerError('');
                                            setValidationError('');
                                        }}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-orange-600 font-bold text-[11px] shrink-0 border border-slate-200 shadow-xs cursor-pointer active:scale-95 transition-all"
                                    >
                                        <Edit2 size={12} />
                                        <span>Edit</span>
                                    </button>
                                </div>

                                {/* Dev Mode OTP helper badge if SMS keys pending */}
                                {devOtp && (
                                    <div
                                        onClick={() => setOtp(devOtp)}
                                        className="mb-4 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center justify-between cursor-pointer hover:bg-amber-100/60 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                                            <span>Dev Code: <strong className="font-mono text-sm tracking-widest">{devOtp}</strong></span>
                                        </div>
                                        <span className="text-[11px] underline font-bold text-amber-900">Auto-fill</span>
                                    </div>
                                )}

                                <form onSubmit={handleVerifyOtp} className="space-y-4">
                                    {/* 6-Digit OTP Input */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">
                                            6-Digit OTP Code <span className="text-rose-500">*</span>
                                        </label>
                                        <div
                                            className={`flex items-center rounded-2xl p-2 transition-all ${
                                                validationError || serverError
                                                    ? 'ring-2 ring-rose-400 bg-rose-50/30'
                                                    : otp.length === 6
                                                    ? 'ring-2 ring-emerald-400/50 bg-white'
                                                    : 'focus-within:ring-2 focus-within:ring-orange-500/40 bg-white'
                                            }`}
                                            style={{
                                                boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.3), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                                border: '1px solid rgba(226, 232, 240, 0.8)',
                                            }}
                                        >
                                            <input
                                                type="tel"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                autoFocus
                                                disabled={submitting}
                                                maxLength={6}
                                                placeholder="• • • • • •"
                                                value={otp}
                                                onChange={handleOtpChange}
                                                className="w-full text-center py-2 bg-transparent text-slate-900 font-black text-2xl tracking-[0.4em] placeholder:text-slate-300 placeholder:tracking-[0.4em] focus:outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Errors */}
                                    {validationError && (
                                        <p className="text-xs text-rose-500 font-semibold mt-1 ml-1 flex items-center gap-1">
                                            <AlertCircle size={13} className="shrink-0" />
                                            <span>{validationError}</span>
                                        </p>
                                    )}

                                    {serverError && (
                                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2">
                                            <AlertCircle size={15} className="text-rose-500 shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <span>{serverError}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Verify Button */}
                                    <button
                                        type="submit"
                                        disabled={submitting || otp.length !== 6}
                                        className={`w-full py-4 rounded-2xl font-black text-sm tracking-wide transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                                            submitting
                                                ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                                                : otp.length === 6
                                                ? 'bg-gradient-to-r from-orange-500 via-orange-600 to-rose-500 text-white shadow-orange-500/30 hover:scale-[1.01] active:scale-[0.99]'
                                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        }`}
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 size={18} className="animate-spin" />
                                                <span>Verifying Code...</span>
                                            </>
                                        ) : (
                                            <>
                                                <ShieldCheck size={18} />
                                                <span>Verify & Start Dining</span>
                                            </>
                                        )}
                                    </button>

                                    {/* Resend OTP Action */}
                                    <div className="pt-2 flex items-center justify-between text-xs text-slate-500 px-1">
                                        <span>Didn't receive the SMS code?</span>
                                        {resendCooldown > 0 ? (
                                            <span className="font-semibold text-slate-400">
                                                Resend in {resendCooldown}s
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={handleResendOtp}
                                                disabled={submitting}
                                                className="font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer transition-colors"
                                            >
                                                <RotateCcw size={12} />
                                                <span>Resend OTP</span>
                                            </button>
                                        )}
                                    </div>
                                </form>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Trust footer info */}
                    <div className="mt-5 pt-4 border-t border-slate-200/60 text-center">
                        <p className="text-[11px] text-slate-400 font-medium">
                            🔒 Verified via secure Firebase SMS. Your details are safe & confidential.
                        </p>
                    </div>
                </motion.div>
            </main>

            {/* Footer with Restaurant Address */}
            <footer className="w-full max-w-md mx-auto text-center py-2">
                {address && (
                    <p className="text-xs text-slate-400 flex items-center justify-center gap-1 line-clamp-1">
                        <MapPin size={12} className="text-orange-500 shrink-0" />
                        <span>{address}</span>
                    </p>
                )}
            </footer>

            {/* Multiple Active Orders Modal */}
            <AnimatePresence>
                {showMultipleOrdersModal && (
                    <div key="modal-multiple-orders" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            className="w-full max-w-md rounded-3xl p-5 sm:p-6 space-y-4 max-h-[85vh] flex flex-col"
                            style={{
                                backgroundColor: '#EEF2F6',
                                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
                                border: '1px solid rgba(255, 255, 255, 0.9)',
                            }}
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase mb-1">
                                        <span>{multipleActiveOrders.length} Active Orders Found</span>
                                    </div>
                                    <h3 className="text-lg font-black text-slate-900">
                                        Select Active Order
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                        We found ongoing orders for +91 {mobile}. Which one would you like to open?
                                    </p>
                                </div>
                            </div>

                            {/* Active Orders List */}
                            <div className="flex-1 overflow-y-auto space-y-3 py-1 pr-1">
                                {multipleActiveOrders.map((order, idx) => {
                                    const isDelivery = order.orderType === 'DELIVERY';
                                    const isTakeaway = order.orderType === 'TAKEAWAY';

                                    return (
                                        <button
                                            key={order.id || `order-${idx}`}
                                            onClick={() => handleSelectExistingOrder(order)}
                                            className="w-full text-left p-4 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-between gap-3 group cursor-pointer"
                                            style={{
                                                backgroundColor: '#EEF2F6',
                                                boxShadow: '4px 4px 10px rgba(166, 180, 200, 0.4), -4px -4px 10px rgba(255, 255, 255, 0.95)',
                                                border: '1px solid rgba(255, 255, 255, 0.85)',
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${
                                                        isDelivery
                                                            ? 'text-blue-600'
                                                            : isTakeaway
                                                            ? 'text-emerald-600'
                                                            : 'text-orange-600'
                                                    }`}
                                                    style={{
                                                        backgroundColor: '#EEF2F6',
                                                        boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                                    }}
                                                >
                                                    {isDelivery ? (
                                                        <Bike size={22} />
                                                    ) : isTakeaway ? (
                                                        <ShoppingBag size={22} />
                                                    ) : (
                                                        <Utensils size={22} />
                                                    )}
                                                </div>

                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-black text-xs text-slate-900">
                                                            Order #{order.orderNumber || order.id.slice(0, 6)}
                                                        </span>
                                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                            isDelivery
                                                                ? 'bg-blue-100 text-blue-700'
                                                                : isTakeaway
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : 'bg-orange-100 text-orange-700'
                                                        }`}>
                                                            {isDelivery ? 'Delivery' : isTakeaway ? 'Takeaway' : `Table ${order.tableNumber || 'Dine-In'}`}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-medium">
                                                        <span className="capitalize font-bold text-slate-700">
                                                            ● {order.status}
                                                        </span>
                                                        {order.totalAmount > 0 && (
                                                            <>
                                                                <span>•</span>
                                                                <span>₹{order.totalAmount}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="size-8 rounded-full flex items-center justify-center text-slate-400 group-hover:text-orange-500 group-hover:translate-x-1 transition-all">
                                                <ChevronRight size={18} />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Option to start a new order */}
                            <div className="pt-2 border-t border-slate-200/80 flex flex-col gap-2">
                                <button
                                    onClick={handleProceedToNewOrder}
                                    className="w-full py-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                                >
                                    <span>Or Start a New Order</span>
                                    <ArrowRight size={14} />
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
