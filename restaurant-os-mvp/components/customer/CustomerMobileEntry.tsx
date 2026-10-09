'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Phone, ArrowRight, Loader2, Utensils,
    AlertCircle, CheckCircle2, ChevronRight, User, Calendar,
    ShieldCheck, KeyRound, Edit2, RotateCcw, Sparkles, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { HomepageBuilderService } from '@/services/homepage-builder.service';
import { CustomerCache } from '@/services/homepage-cache.service';
import { formatAddress } from '@/lib/utils';
import { getPhoneEmailClientId, isPhoneEmailConfigured } from '@/lib/phone-email';
import { AuthBackground } from '@/components/auth/AuthBackground';
import { DineInOneWaveLogo } from '@/components/auth/DineInOneWaveLogo';
import { CustomerJoinTableScreen } from '@/components/customer/CustomerJoinTableScreen';

interface CustomerMobileEntryProps {
    restaurantCode: string;
    initialTable?: string | null;
    initialTableToken?: string | null;
    canonicalRestaurantId?: string | null;
}

interface RestaurantProfile {
    name?: string;
    logo_url?: string;
    logo?: string;
    address?: string;
    tagline?: string;
}

export default function CustomerMobileEntry({ 
    restaurantCode, 
    initialTable, 
    initialTableToken, 
    canonicalRestaurantId 
}: CustomerMobileEntryProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const tableFromUrl = initialTable || searchParams?.get('table') || searchParams?.get('tableNumber') || searchParams?.get('table_number') || searchParams?.get('t') || '';
    const tableToken = initialTableToken || (tableFromUrl.length >= 16 ? tableFromUrl : null);
    const targetRestaurantId = canonicalRestaurantId || restaurantCode;

    // Flow: Step 1 'phone' -> Step 2 'otp' -> (if new customer) Step 3 'details' (Name, DOB with Skip button)
    const [step, setStep] = useState<'phone' | 'otp' | 'details'>('phone');

    // Customer Form Inputs
    const [mobile, setMobile] = useState('');
    const [name, setName] = useState('');
    const [dob, setDob] = useState('');
    const [dobFocused, setDobFocused] = useState(false);
    const dobInputRef = useRef<HTMLInputElement>(null);

    // Verified Customer Cache across steps
    const [verifiedCustomer, setVerifiedCustomer] = useState<{
        id?: string;
        mobile: string;
        userJsonUrl?: string;
        isPhoneEmail: boolean;
    } | null>(null);

    // Phone.Email State
    const phoneEmailClientId = getPhoneEmailClientId();
    const phoneEmailEnabled = isPhoneEmailConfigured();
    const [phoneEmailVerified, setPhoneEmailVerified] = useState(false);
    const [verifiedJsonUrl, setVerifiedJsonUrl] = useState('');
    const [isAwaitingPhoneEmail, setIsAwaitingPhoneEmail] = useState(false);

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

    // Join Session State
    const [redirectingMessage, setRedirectingMessage] = useState('');
    const [joinSessionData, setJoinSessionData] = useState<{
        sessionId: string;
        hostName: string;
        participantCount?: number;
        initialStatus: 'pending' | 'rejected' | 'none';
        initialRequestId: string | null;
    } | null>(null);

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

    // Phone.Email PostMessage Listener
    useEffect(() => {
        const handleDirectMessage = async (event: MessageEvent) => {
            if (typeof event.data === 'string' && event.data.includes('phone.email')) {
                return;
            }

            if (event.data?.flag_phone === '1' && event.data?.user_json_url) {
                const jsonUrl = event.data.user_json_url;
                try {
                    setIsAwaitingPhoneEmail(false);
                    setVerifiedJsonUrl(jsonUrl);
                    setPhoneEmailVerified(true);

                    let finalPhone = mobile;
                    try {
                        const r = await fetch(jsonUrl);
                        if (r.ok) {
                            const d = await r.json();
                            const p = String(d.user_phone_number || d.phone_no || '').replace(/\D/g, '').slice(-10);
                            if (p) {
                                finalPhone = p;
                                setMobile(p);
                            }
                        }
                    } catch {}

                    toast.success(`Mobile +91 ${finalPhone} verified via Phone.Email!`);
                    await handleVerifyMobileToken({
                        verifiedMobile: finalPhone,
                        userJsonUrl: jsonUrl,
                        isPhoneEmail: true,
                    });
                } catch (err: any) {
                    console.error('[Phone.Email Direct Message Error]', err);
                }
            }
        };

        window.addEventListener('message', handleDirectMessage);

        // Inject Phone.Email script when on 'phone' step
        if (step === 'phone') {
            const scriptId = 'phone-email-btn-script';
            const btnEl = document.querySelector('.pe_signin_button');
            if (btnEl && !document.getElementById(scriptId)) {
                const script = document.createElement('script');
                script.id = scriptId;
                script.src = 'https://www.phone.email/sign_in_button_v1.js';
                script.async = true;
                script.onerror = () => {
                    console.warn('[Phone.Email] Script load failed.');
                };
                document.body.appendChild(script);
            }
        }

        return () => {
            window.removeEventListener('message', handleDirectMessage);
        };
    }, [phoneEmailClientId, step, mobile]);

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
     * Helper to persist verified customer info across storage keys
     */
    const persistCustomerSession = (
        verifiedMobile: string,
        customerName: string,
        customerDob: string,
        customerId?: string
    ) => {
        try {
            if (typeof window !== 'undefined') {
                sessionStorage.removeItem('ros_logged_out');
                sessionStorage.removeItem('ros_logging_out');
            }
            const keys = [restaurantCode, targetRestaurantId];
            keys.forEach(k => {
                if (!k) return;
                localStorage.setItem(`ros_customer_mobile_${k}`, verifiedMobile);
                localStorage.setItem(`ros_customer_name_${k}`, customerName);
                if (customerDob) localStorage.setItem(`ros_customer_dob_${k}`, customerDob);
                localStorage.setItem(`ros_customer_verified_${k}`, 'true');
                localStorage.setItem(`ros_customer_skipped_${k}`, 'true');
                if (customerId) localStorage.setItem(`ros_customer_${k}`, customerId);
            });
        } catch {}
    };

    /**
     * Checks table session and redirects customer to dining or join request screen
     */
    const proceedToDiningOrJoinSession = async (
        customerName: string,
        customerMobileNum: string,
        customerId?: string
    ) => {
        if (tableFromUrl) {
            try {
                const sessionRes = await fetch('/api/customer/table-session/active', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        restaurantId: targetRestaurantId,
                        tableId: tableFromUrl,
                        tableNumber: tableFromUrl,
                        tableToken: tableToken,
                        customerId: customerId,
                        customerName,
                        customerMobile: customerMobileNum,
                    }),
                });

                if (sessionRes.ok) {
                    const sessData = await sessionRes.json();
                    if (sessData.hasActiveSession && !sessData.isHost) {
                        const checkRes = await fetch(
                            `/api/customer/table-session/active?restaurantId=${encodeURIComponent(targetRestaurantId)}&tableNumber=${encodeURIComponent(tableFromUrl)}&customerMobile=${encodeURIComponent(customerMobileNum)}`
                        );
                        if (checkRes.ok) {
                            const checkData = await checkRes.json();
                            if (checkData.approvalStatus !== 'approved' && checkData.approvalStatus !== 'host') {
                                setJoinSessionData({
                                    sessionId: sessData.sessionId,
                                    hostName: sessData.hostName || 'Table Host',
                                    participantCount: sessData.participantCount || 1,
                                    initialStatus: checkData.approvalStatus || 'none',
                                    initialRequestId: checkData.requestId || null,
                                });
                                setSubmitting(false);
                                return;
                            }
                        }
                    }
                }
            } catch (sessErr) {
                console.warn('[Table Session Init Notice]:', sessErr);
            }
        }

        // Direct redirect to customer homepage
        const restaurantDisplayName = profile?.name || 'Restaurant';
        setRedirectingMessage(`Welcome, ${customerName}! Starting dining at ${restaurantDisplayName}...`);

        setTimeout(() => {
            if (tableToken) {
                window.location.href = `/customer/t/${tableToken}/home`;
            } else if (tableFromUrl) {
                window.location.href = `/${restaurantCode}/customer/home/${encodeURIComponent(tableFromUrl)}`;
            } else {
                window.location.href = `/${restaurantCode}/customer/home`;
            }
        }, 500);
    };

    /**
     * Step 1 & 2: Verify Mobile OTP
     */
    const handleVerifyMobileToken = async ({
        verifiedMobile,
        userJsonUrl,
        isPhoneEmail,
        otpCode,
    }: {
        verifiedMobile: string;
        userJsonUrl?: string;
        isPhoneEmail: boolean;
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
                    restaurantCode: targetRestaurantId,
                    mobile: verifiedMobile,
                    otp: otpCode,
                    userJsonUrl,
                    phoneEmailVerified: isPhoneEmail,
                }),
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok) {
                setServerError(verifyData.error || 'Verification failed. Please check the code and try again.');
                setSubmitting(false);
                return;
            }

            // Clean old session if a different user was logged in
            try {
                const prevMobile = localStorage.getItem(`ros_customer_mobile_${targetRestaurantId}`) || '';
                const cleanPrev = prevMobile.replace(/\D/g, '').slice(-10);
                if (cleanPrev && cleanPrev !== verifiedMobile) {
                    CustomerCache.clear(targetRestaurantId);
                    CustomerCache.clear(restaurantCode);
                }
            } catch {}

            // Check if customer was already registered previously with a name
            const isReturningCustomer = Boolean(
                verifyData.isReturning && 
                verifyData.customer?.name && 
                verifyData.customer.name.trim() !== 'Guest' &&
                verifyData.customer.name.trim() !== ''
            );

            if (isReturningCustomer) {
                const customerName = verifyData.customer.name.trim();
                const customerDob = verifyData.customer.dateOfBirth || verifyData.customer.dob || '';
                persistCustomerSession(verifiedMobile, customerName, customerDob, verifyData.customer.id);
                toast.success(`Welcome back, ${customerName}!`);
                await proceedToDiningOrJoinSession(customerName, verifiedMobile, verifyData.customer.id);
            } else {
                // Not registered before or without saved name -> proceed to Step 3: ask Name & DOB with Skip
                setVerifiedCustomer({
                    id: verifyData.customer?.id,
                    mobile: verifiedMobile,
                    userJsonUrl,
                    isPhoneEmail,
                });
                setSubmitting(false);
                setStep('details');
            }
        } catch (err: any) {
            console.error('[Verification Error]', err);
            setServerError(err.message || 'Network error during verification. Please try again.');
            setSubmitting(false);
        }
    };

    /**
     * Send OTP to customer mobile number
     */
    const handleSendOtp = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setValidationError('');
        setServerError('');

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
                    restaurantCode: targetRestaurantId,
                    mobile,
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

    /**
     * Verify manual 6-digit OTP code
     */
    const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (otp.length !== 6) {
            setValidationError('Please enter the 6-digit code');
            return;
        }

        await handleVerifyMobileToken({
            verifiedMobile: mobile,
            isPhoneEmail: false,
            otpCode: otp,
        });
    };

    /**
     * Step 3: Save Name and DOB (or Skip for now)
     */
    const handleSaveCustomerDetails = async (isSkipped: boolean) => {
        const finalName = isSkipped ? 'Guest' : (name.trim() || 'Guest');
        const finalDob = isSkipped ? '' : dob.trim();
        const activeMobile = verifiedCustomer?.mobile || mobile;
        const customerId = verifiedCustomer?.id;

        setSubmitting(true);

        try {
            // Update customer profile on server
            await fetch('/api/customer/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurantCode: targetRestaurantId,
                    mobile: activeMobile,
                    name: finalName,
                    dob: finalDob,
                    phoneEmailVerified: true,
                    userJsonUrl: verifiedCustomer?.userJsonUrl,
                }),
            });
        } catch (err) {
            console.warn('[Profile Save Notice]:', err);
        }

        persistCustomerSession(activeMobile, finalName, finalDob, customerId);

        if (!isSkipped && finalName !== 'Guest') {
            toast.success(`Welcome, ${finalName}!`);
        } else {
            toast.success('Welcome to dining!');
        }

        await proceedToDiningOrJoinSession(finalName, activeMobile, customerId);
    };

    // If join session modal is active
    if (joinSessionData) {
        return (
            <CustomerJoinTableScreen
                restaurantId={targetRestaurantId}
                tableNumber={tableFromUrl}
                customerName={name || 'Guest'}
                customerMobile={mobile}
                sessionId={joinSessionData.sessionId}
                hostName={joinSessionData.hostName}
                participantCount={joinSessionData.participantCount || 1}
                initialRequestId={joinSessionData.initialRequestId}
                initialStatus={joinSessionData.initialStatus}
                onApproved={() => {
                    setJoinSessionData(null);
                    if (tableToken) {
                        window.location.href = `/customer/t/${tableToken}/home`;
                    } else if (tableFromUrl) {
                        window.location.href = `/${restaurantCode}/customer/home/${encodeURIComponent(tableFromUrl)}`;
                    } else {
                        window.location.href = `/${restaurantCode}/customer/home`;
                    }
                }}
            />
        );
    }

    return (
        <AuthBackground className="min-h-screen py-8 px-4 flex flex-col justify-center items-center">
            {/* Dine In One Wave Animated Logo */}
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
                        {step === 'phone' ? (
                            /* ── STEP 1: Ask Mobile Number First ───────── */
                            <motion.div
                                key="step-phone"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="mb-6">
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 text-[10px] font-black uppercase tracking-wider mb-2 border border-orange-200">
                                        <Sparkles size={11} />
                                        <span>Mobile Verification</span>
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                        Verify Your Mobile
                                    </h2>
                                    <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
                                        Enter your mobile number to view the digital menu and place table orders.
                                    </p>
                                </div>

                                <form onSubmit={handleSendOtp} className="space-y-4">
                                    {/* Mobile Number Input */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1 ml-1">
                                            Mobile Number <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="flex items-center rounded-2xl p-1.5 bg-slate-50 border border-slate-200 focus-within:border-orange-500 focus-within:bg-white transition-all">
                                            <div className="flex items-center gap-1.5 pl-3 pr-2 border-r border-slate-200 text-slate-700 font-bold text-sm shrink-0">
                                                <span className="text-base">🇮🇳</span>
                                                <span>+91</span>
                                            </div>
                                            <input
                                                type="tel"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                maxLength={10}
                                                autoFocus
                                                disabled={submitting}
                                                placeholder="98765 43210"
                                                value={mobile}
                                                onChange={handlePhoneChange}
                                                className="w-full px-3 py-2 bg-transparent text-slate-900 font-bold text-base placeholder:text-slate-400 placeholder:font-normal focus:outline-none"
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

                                    {/* Primary Button: Get OTP */}
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
                                                <ShieldCheck size={18} />
                                                <span>Get OTP</span>
                                                <ArrowRight size={18} />
                                            </>
                                        )}
                                    </button>

                                    {/* Phone.Email Instant Verification (If enabled) */}
                                    {phoneEmailEnabled && (
                                        <div className="pt-2">
                                            <div className="relative flex py-2 items-center">
                                                <div className="flex-grow border-t border-slate-200" />
                                                <span className="flex-shrink mx-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">or verify instantly</span>
                                                <div className="flex-grow border-t border-slate-200" />
                                            </div>

                                            <div className="flex justify-center pt-1">
                                                <div
                                                    className="pe_signin_button"
                                                    data-client-id={phoneEmailClientId}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </form>
                            </motion.div>
                        ) : step === 'otp' ? (
                            /* ── STEP 2: OTP Verification Screen ───────── */
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

                                <form onSubmit={handleVerifyOtpSubmit} className="space-y-4">
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
                                            <span>Verify & Continue</span>
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
                                            onClick={handleSendOtp}
                                            className="text-orange-600 hover:text-orange-700 font-bold disabled:text-slate-400 cursor-pointer"
                                        >
                                            {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        ) : (
                            /* ── STEP 3: Details (Name & DOB with Skip Button) ───────── */
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
                                        <span>Tell Us About You</span>
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                        Welcome to Dining
                                    </h2>
                                    <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
                                        Add your name and birthday to personalize your table orders and receive special perks.
                                    </p>
                                </div>

                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        handleSaveCustomerDetails(false);
                                    }}
                                    className="space-y-4"
                                >
                                    {/* Full Name */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1 ml-1">
                                            Your Full Name
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
                                                }}
                                                className="w-full px-2 py-2 bg-transparent text-slate-900 font-bold text-base placeholder:text-slate-400 placeholder:font-normal focus:outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Date of Birth */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1 ml-1">
                                            Date of Birth <span className="text-slate-400 font-normal">(Optional for birthday treats)</span>
                                        </label>
                                        <div
                                            onClick={() => {
                                                setDobFocused(true);
                                                dobInputRef.current?.showPicker?.();
                                            }}
                                            className="flex items-center rounded-2xl p-1.5 bg-slate-50 border border-slate-200 focus-within:border-orange-500 focus-within:bg-white transition-all cursor-pointer"
                                        >
                                            <div className="pl-3 pr-2 text-slate-400">
                                                <Calendar size={18} />
                                            </div>
                                            <input
                                                ref={dobInputRef}
                                                type="date"
                                                disabled={submitting}
                                                max={new Date().toISOString().split('T')[0]}
                                                value={dob}
                                                onFocus={() => setDobFocused(true)}
                                                onChange={(e) => {
                                                    setDob(e.target.value);
                                                    setValidationError('');
                                                }}
                                                className="w-full px-2 py-2 bg-transparent text-slate-900 font-bold text-sm focus:outline-none"
                                            />
                                        </div>
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
                                        disabled={submitting}
                                        className="w-full py-4 rounded-2xl font-black text-sm tracking-wide bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white shadow-lg shadow-orange-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
                                    >
                                        {submitting ? (
                                            <Loader2 size={18} className="animate-spin" />
                                        ) : (
                                            <>
                                                <span>Continue to Dining</span>
                                                <ArrowRight size={18} />
                                            </>
                                        )}
                                    </button>

                                    {/* Skip for Now Button */}
                                    <div className="text-center pt-2">
                                        <button
                                            type="button"
                                            disabled={submitting}
                                            onClick={() => handleSaveCustomerDetails(true)}
                                            className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors py-2 px-4 rounded-xl hover:bg-slate-50 cursor-pointer"
                                        >
                                            Skip for now
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
