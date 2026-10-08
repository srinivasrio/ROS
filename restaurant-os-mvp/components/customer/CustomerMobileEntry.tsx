'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Phone, ArrowRight, Loader2, Utensils,
    AlertCircle, CheckCircle2, ChevronRight, User, Calendar,
    ShieldCheck, KeyRound, Edit2, RotateCcw, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { HomepageBuilderService } from '@/services/homepage-builder.service';
import { CustomerCache } from '@/services/homepage-cache.service';
import { formatAddress } from '@/lib/utils';
import { getPhoneEmailClientId, isPhoneEmailConfigured } from '@/lib/phone-email';
import { AuthBackground } from '@/components/auth/AuthBackground';
import { DineInOneWaveLogo } from '@/components/auth/DineInOneWaveLogo';

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

    // Step 1: 'details' (Name, DOB) -> Step 2: 'phone' (Phone.Email / Mobile OTP) -> 'otp' (Manual OTP if fallback)
    const [step, setStep] = useState<'details' | 'phone' | 'otp'>('details');

    // Customer Form Inputs
    const [name, setName] = useState('');
    const [dob, setDob] = useState('');
    const [dobFocused, setDobFocused] = useState(false);
    const dobInputRef = useRef<HTMLInputElement>(null);
    const [mobile, setMobile] = useState('');

    // Phone.Email State
    const phoneEmailClientId = getPhoneEmailClientId();
    const phoneEmailEnabled = isPhoneEmailConfigured();
    const [phoneEmailVerified, setPhoneEmailVerified] = useState(false);
    const [verifiedJsonUrl, setVerifiedJsonUrl] = useState('');

    // Fallback OTP State
    const [otp, setOtp] = useState('');
    const [devOtp, setDevOtp] = useState<string | null>(null);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [maskedPhone, setMaskedPhone] = useState('');

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

    // Resend countdown timer for fallback OTP
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setInterval(() => {
            setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [resendCooldown]);

    // Intercept third-party script errors from crashing Next.js client-side React tree
    useEffect(() => {
        const handleScriptError = (event: ErrorEvent) => {
            const src = event.filename || '';
            const msg = event.message || '';
            if (src.includes('phone.email') || src.includes('sign_in_button') || msg.includes('getAttribute')) {
                console.warn('[Phone.Email Widget notice intercepted]:', msg);
                event.preventDefault?.();
                event.stopImmediatePropagation?.();
                return true;
            }
        };

        window.addEventListener('error', handleScriptError, true);
        return () => window.removeEventListener('error', handleScriptError, true);
    }, []);

    // Register Phone.Email listener and inject official sign-in script
    useEffect(() => {
        if (!phoneEmailClientId) return;

        (window as any).phoneEmailListener = async (userObj: any) => {
            try {
                const rawPhone = userObj?.user_phone_number || userObj?.phone_no || '';
                const jsonUrl = userObj?.user_json_url || '';
                const clean = String(rawPhone).replace(/\D/g, '').slice(-10);

                if (clean) {
                    setMobile(clean);
                }
                if (jsonUrl) {
                    setVerifiedJsonUrl(jsonUrl);
                }
                setPhoneEmailVerified(true);
                setValidationError('');
                setServerError('');

                toast.success(`Mobile +91 ${clean} verified via Phone.Email!`);

                const cleanName = name.trim();
                if (cleanName && dob) {
                    await executeVerification({
                        verifiedMobile: clean,
                        userJsonUrl: jsonUrl,
                        isPhoneEmail: true,
                        customerName: cleanName,
                        customerDob: dob,
                    });
                } else {
                    toast.info('Please confirm your Name and Date of Birth to complete verification.');
                    setStep('details');
                }
            } catch (err: any) {
                console.error('[Phone.Email Listener Error]', err);
            }
        };

        // Only inject Phone.Email script when on 'phone' step and container element is verified present in DOM
        if (step === 'phone') {
            const scriptId = 'phone-email-btn-script';
            const btnEl = document.querySelector('.pe_signin_button');
            if (btnEl && !document.getElementById(scriptId)) {
                const script = document.createElement('script');
                script.id = scriptId;
                script.src = 'https://www.phone.email/sign_in_button_v1.js';
                script.async = true;
                script.onerror = () => {
                    console.warn('[Phone.Email] Script load failed, fallback OTP remains active.');
                };
                document.body.appendChild(script);
            }
        }
    }, [phoneEmailClientId, step, name, dob]);

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

    /**
     * Executes the actual server verification, JWT session issuance, and redirects to homepage
     */
    const executeVerification = async ({
        verifiedMobile,
        userJsonUrl,
        isPhoneEmail,
        customerName,
        customerDob,
        otpCode,
    }: {
        verifiedMobile: string;
        userJsonUrl?: string;
        isPhoneEmail: boolean;
        customerName: string;
        customerDob: string;
        otpCode?: string;
    }) => {
        setSubmitting(true);
        setServerError('');
        setValidationError('');

        try {
            const verifyRes = await fetch('/api/customer/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurantCode,
                    mobile: verifiedMobile,
                    otp: otpCode,
                    userJsonUrl,
                    phoneEmailVerified: isPhoneEmail,
                    name: customerName,
                    dob: customerDob,
                }),
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok) {
                setServerError(verifyData.error || 'Verification failed. Please try again.');
                setSubmitting(false);
                return;
            }

            // Clean old session if a different user logged in on this device
            try {
                const prevMobile = localStorage.getItem(`ros_customer_mobile_${restaurantCode}`) || '';
                const cleanPrev = prevMobile.replace(/\D/g, '').slice(-10);
                if (cleanPrev && cleanPrev !== verifiedMobile) {
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
                localStorage.setItem(`ros_customer_mobile_${restaurantCode}`, verifiedMobile);
                localStorage.setItem(`ros_customer_name_${restaurantCode}`, customerName);
                localStorage.setItem(`ros_customer_dob_${restaurantCode}`, customerDob);
                localStorage.setItem(`ros_customer_verified_${restaurantCode}`, 'true');
                localStorage.setItem(`ros_customer_skipped_${restaurantCode}`, 'true');
                if (verifyData.customer?.id) {
                    localStorage.setItem(`ros_customer_${restaurantCode}`, verifyData.customer.id);
                }
            } catch {}

            // Direct redirect to customer homepage (NO 3 options, customer already scanned QR)
            const restaurantDisplayName = profile?.name || 'Restaurant';
            setRedirectingMessage(`Welcome, ${customerName}! Starting dining at ${restaurantDisplayName}...`);
            toast.success('Mobile verified! Starting your dining experience.');

            setTimeout(() => {
                if (tableFromUrl) {
                    if (tableFromUrl.length >= 16) {
                        router.push(`/customer/t/${tableFromUrl}/home`);
                    } else {
                        router.push(`/${restaurantCode}/customer/home/${encodeURIComponent(tableFromUrl)}`);
                    }
                } else {
                    router.push(`/${restaurantCode}/customer/home`);
                }
            }, 600);
        } catch (err: any) {
            console.error('[executeVerification Error]', err);
            setServerError(err.message || 'Network error during verification. Please try again.');
            setSubmitting(false);
        }
    };

    // Step 1 Submission: Validate Name & DOB, then move to Step 2
    const handleContinueToPhone = (e: React.FormEvent) => {
        e.preventDefault();
        setServerError('');
        setValidationError('');

        const cleanName = name.trim();
        if (!cleanName || cleanName.length < 2) {
            setValidationError('Please enter your full name (at least 2 characters)');
            return;
        }

        if (!dob) {
            setValidationError('Please select your Date of Birth');
            return;
        }

        // Advance to Step 2 (Phone verification)
        setStep('phone');
    };

    // Send fallback OTP
    const handleSendFallbackOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setServerError('');
        setValidationError('');

        if (mobile.length !== 10) {
            setValidationError('Please enter a valid 10-digit mobile number');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/customer/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurantCode,
                    mobile,
                    name: name.trim(),
                    dob,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                setServerError(data.error || 'Failed to send OTP code');
                setSubmitting(false);
                return;
            }

            setMaskedPhone(data.maskedPhone || `+91 ******${mobile.slice(-4)}`);
            if (data.devOtp) {
                setDevOtp(data.devOtp);
            }
            setResendCooldown(30);
            setStep('otp');
            toast.success('Verification code sent to your mobile!');
        } catch (err: any) {
            setServerError('Network error. Please check your connection.');
        } finally {
            setSubmitting(false);
        }
    };

    // Verify fallback OTP
    const handleVerifyFallbackOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (otp.length !== 6) {
            setValidationError('Please enter the 6-digit code');
            return;
        }

        await executeVerification({
            verifiedMobile: mobile,
            isPhoneEmail: false,
            customerName: name.trim(),
            customerDob: dob,
            otpCode: otp,
        });
    };

    return (
        <AuthBackground className="min-h-screen py-8 px-4 flex flex-col justify-center items-center">
            {/* Dine In One Wave Animated Logo above login card */}
            <div className="mb-6 flex flex-col items-center">
                <DineInOneWaveLogo size="lg" />
                {profile?.name && (
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 border border-slate-200/80 shadow-xs backdrop-blur-md">
                        <Utensils size={13} className="text-orange-500" />
                        <span className="text-xs font-bold text-slate-800">{profile.name}</span>
                        {tableFromUrl && (
                            <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                                {tableFromUrl.length >= 16 ? 'Table Session' : `Table ${tableFromUrl}`}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Crisp Pure White Login Card */}
            <main className="w-full max-w-md mx-auto">
                <div className="bg-white rounded-3xl p-7 sm:p-8 shadow-2xl border border-slate-100 relative overflow-hidden">
                    {redirectingMessage && (
                        <div className="absolute inset-0 z-30 bg-white/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
                            <Loader2 size={36} className="text-orange-500 animate-spin mb-3" />
                            <p className="text-sm font-black text-slate-900">{redirectingMessage}</p>
                        </div>
                    )}

                    <AnimatePresence mode="wait">
                        {step === 'details' ? (
                            /* ── STEP 1: Ask Name and DOB First ───────── */
                            <motion.div
                                key="step-details"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="mb-6">
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 text-[10px] font-black uppercase tracking-wider mb-2 border border-orange-200">
                                        <Sparkles size={11} />
                                        <span>Step 1 of 2: Dining Details</span>
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                        Welcome to Dining
                                    </h2>
                                    <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
                                        Please tell us your name and date of birth to personalize your contactless table experience.
                                    </p>
                                </div>

                                <form onSubmit={handleContinueToPhone} className="space-y-4">
                                    {/* Full Name */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1 ml-1">
                                            Your Full Name <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="flex items-center rounded-2xl p-1.5 bg-slate-50 border border-slate-200 focus-within:border-orange-500 focus-within:bg-white transition-all">
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
                                                className="w-full px-2 py-2.5 bg-transparent text-slate-900 text-sm font-semibold placeholder:text-slate-400 focus:outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Date of Birth */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1 ml-1">
                                            Date of Birth <span className="text-rose-500">*</span>
                                        </label>
                                        <div 
                                            onClick={() => {
                                                try {
                                                    dobInputRef.current?.showPicker?.();
                                                } catch {
                                                    dobInputRef.current?.focus();
                                                }
                                            }}
                                            className="flex items-center rounded-2xl p-1.5 bg-slate-50 border border-slate-200 focus-within:border-orange-500 focus-within:bg-white transition-all cursor-pointer"
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
                                                placeholder="Select Date of Birth (DD/MM/YYYY)"
                                                value={dob}
                                                onChange={(e) => {
                                                    setDob(e.target.value);
                                                    setValidationError('');
                                                    setServerError('');
                                                }}
                                                max={new Date().toISOString().split('T')[0]}
                                                className="w-full px-2 py-2.5 bg-transparent text-slate-900 text-sm font-semibold placeholder:text-slate-400 focus:outline-none cursor-pointer"
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1 ml-1">
                                            Celebrate your special occasions with exclusive dining perks.
                                        </p>
                                    </div>

                                    {validationError && (
                                        <p className="text-xs text-rose-500 font-semibold mt-1 ml-1 flex items-center gap-1">
                                            <AlertCircle size={13} className="shrink-0" />
                                            <span>{validationError}</span>
                                        </p>
                                    )}

                                    {/* Continue Button */}
                                    <button
                                        type="submit"
                                        className="w-full mt-2 py-4 rounded-2xl font-black text-sm tracking-wide bg-gradient-to-r from-orange-500 via-orange-600 to-rose-500 text-white shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/35 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        <span>Continue to Phone Verification</span>
                                        <ArrowRight size={18} />
                                    </button>
                                </form>
                            </motion.div>
                        ) : step === 'phone' ? (
                            /* ── STEP 2: Mobile OTP Verification ───────── */
                            <motion.div
                                key="step-phone"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="mb-5">
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider mb-2 border border-emerald-200">
                                        <ShieldCheck size={11} />
                                        <span>Step 2 of 2: Phone Verification</span>
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                        Verify Mobile Number
                                    </h2>
                                    <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
                                        Confirm your mobile number with quick OTP to access the live menu.
                                    </p>
                                </div>

                                {/* Guest Details Summary with Edit option */}
                                <div className="p-3 rounded-2xl mb-5 bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs">
                                    <div className="min-w-0">
                                        <p className="font-extrabold text-slate-900 truncate">{name}</p>
                                        <p className="text-[11px] text-slate-500">🎂 DOB: {dob}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setStep('details')}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white text-orange-600 font-bold text-xs border border-slate-200 shadow-xs hover:bg-slate-50 cursor-pointer transition-all"
                                    >
                                        <Edit2 size={12} />
                                        <span>Edit</span>
                                    </button>
                                </div>

                                {/* Phone.Email Official Widget Button */}
                                {phoneEmailEnabled && (
                                    <div className="mb-5 p-4 rounded-2xl bg-orange-50/60 border border-orange-200/80 text-center">
                                        <p className="text-xs font-bold text-slate-800 mb-3">
                                            Instant One-Tap SMS Verification:
                                        </p>
                                        <div className="flex justify-center">
                                            <div
                                                className="pe_signin_button"
                                                data-client-id={phoneEmailClientId}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Fallback or Alternative Mobile OTP Form */}
                                <form onSubmit={handleSendFallbackOtp} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1 ml-1">
                                            Mobile Number <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="flex items-center rounded-2xl p-1.5 bg-slate-50 border border-slate-200 focus-within:border-orange-500 focus-within:bg-white transition-all">
                                            <div className="pl-3 pr-2 text-slate-400 font-bold text-sm">
                                                +91
                                            </div>
                                            <input
                                                type="tel"
                                                disabled={submitting}
                                                maxLength={10}
                                                placeholder="9876543210"
                                                value={mobile}
                                                onChange={handlePhoneChange}
                                                className="w-full px-2 py-2.5 bg-transparent text-slate-900 text-sm font-semibold placeholder:text-slate-400 focus:outline-none"
                                            />
                                        </div>
                                    </div>

                                    {validationError && (
                                        <p className="text-xs text-rose-500 font-semibold mt-1 ml-1 flex items-center gap-1">
                                            <AlertCircle size={13} className="shrink-0" />
                                            <span>{validationError}</span>
                                        </p>
                                    )}

                                    {serverError && (
                                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2">
                                            <AlertCircle size={15} className="text-rose-500 shrink-0 mt-0.5" />
                                            <div className="flex-1">{serverError}</div>
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={submitting || mobile.length !== 10}
                                        className={`w-full py-4 rounded-2xl font-black text-sm tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                            mobile.length === 10 && !submitting
                                                ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/25 hover:shadow-xl active:scale-[0.99]'
                                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        }`}
                                    >
                                        {submitting ? (
                                            <Loader2 size={18} className="animate-spin" />
                                        ) : (
                                            <>
                                                <span>Send Verification OTP</span>
                                                <ArrowRight size={18} />
                                            </>
                                        )}
                                    </button>
                                </form>
                            </motion.div>
                        ) : (
                            /* ── STEP 3: Fallback OTP Input Screen ───────── */
                            <motion.div
                                key="step-otp"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="mb-4">
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-black uppercase tracking-wider mb-2 border border-emerald-200">
                                        <KeyRound size={11} />
                                        <span>Enter OTP Code</span>
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                        Verify Code
                                    </h2>
                                    <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
                                        We sent a 6-digit code to <strong className="text-slate-800 font-bold">{maskedPhone || `+91 ******${mobile.slice(-4)}`}</strong>
                                    </p>
                                </div>

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

                                <form onSubmit={handleVerifyFallbackOtp} className="space-y-4">
                                    <div>
                                        <div className="flex items-center rounded-2xl p-2 bg-slate-50 border border-slate-200 focus-within:border-orange-500 focus-within:bg-white transition-all">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                maxLength={6}
                                                autoFocus
                                                disabled={submitting}
                                                placeholder="• • • • • •"
                                                value={otp}
                                                onChange={handleOtpChange}
                                                className="w-full py-2 bg-transparent text-slate-900 font-extrabold text-2xl text-center tracking-[0.5em] placeholder:tracking-normal placeholder:font-normal placeholder:text-sm placeholder:text-slate-400 focus:outline-none"
                                            />
                                        </div>
                                    </div>

                                    {validationError && (
                                        <p className="text-xs text-rose-500 font-semibold mt-1 ml-1 flex items-center gap-1">
                                            <AlertCircle size={13} className="shrink-0" />
                                            <span>{validationError}</span>
                                        </p>
                                    )}

                                    {serverError && (
                                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2">
                                            <AlertCircle size={15} className="text-rose-500 shrink-0 mt-0.5" />
                                            <div className="flex-1">{serverError}</div>
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={submitting || otp.length !== 6}
                                        className={`w-full py-4 rounded-2xl font-black text-sm tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                            otp.length === 6 && !submitting
                                                ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/25 hover:shadow-xl active:scale-[0.99]'
                                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        }`}
                                    >
                                        {submitting ? (
                                            <Loader2 size={18} className="animate-spin" />
                                        ) : (
                                            <span>Verify & Start Dining</span>
                                        )}
                                    </button>

                                    <div className="flex items-center justify-between text-xs pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setStep('phone')}
                                            className="text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                                        >
                                            Change Mobile
                                        </button>
                                        <button
                                            type="button"
                                            disabled={resendCooldown > 0 || submitting}
                                            onClick={handleSendFallbackOtp}
                                            className="text-orange-600 hover:text-orange-700 font-bold disabled:text-slate-400 cursor-pointer"
                                        >
                                            {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>
        </AuthBackground>
    );
}
