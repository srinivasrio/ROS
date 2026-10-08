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
import { getPhoneEmailClientId, isPhoneEmailConfigured } from '@/lib/phone-email';

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

    // Flow Step: 'details' (Name, DOB, Mobile) -> 'otp' (Fallback verify 6-digit code)
    const [step, setStep] = useState<'details' | 'otp'>('details');

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

    // Fallback OTP State (used if Phone.Email client id is not configured yet)
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

                // If customer already entered Name & DOB, immediately submit and proceed!
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
                    toast.info('Please enter your Full Name and Date of Birth to finish.');
                }
            } catch (err: any) {
                console.error('[Phone.Email Listener Error]', err);
            }
        };

        const scriptId = 'phone-email-btn-script';
        if (!document.getElementById(scriptId)) {
            const script = document.createElement('script');
            script.id = scriptId;
            script.src = 'https://www.phone.email/sign_in_button_v1.js';
            script.async = true;
            document.body.appendChild(script);
        }
    }, [phoneEmailClientId, name, dob]);

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
     * Executes the actual server verification, JWT session issuance, and redirects
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

            // Check for existing active orders
            try {
                const activeRes = await fetch('/api/customer/active-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        restaurantCode,
                        mobile: verifiedMobile,
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
            const restaurantDisplayName = profile?.name || 'Restaurant';
            setRedirectingMessage(`Welcome to ${restaurantDisplayName}! Starting dining...`);
            toast.success('Mobile verified! Starting your dining experience.');

            setTimeout(() => {
                if (tableFromUrl) {
                    router.push(`/${restaurantCode}/customer/home/${encodeURIComponent(tableFromUrl)}`);
                } else {
                    router.push(`/${restaurantCode}/customer/order-type`);
                }
            }, 600);
        } catch (err: any) {
            console.error('[executeVerification Error]', err);
            setServerError(err.message || 'Network error during verification. Please try again.');
            setSubmitting(false);
        }
    };

    // Final form submission when Phone.Email is verified
    const handleFinalSubmitWithPhoneEmail = async (e: React.FormEvent) => {
        e.preventDefault();
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

        if (!phoneEmailVerified || !mobile) {
            setValidationError('Please click the Phone.Email button above to verify your mobile number via OTP.');
            return;
        }

        await executeVerification({
            verifiedMobile: mobile,
            userJsonUrl: verifiedJsonUrl,
            isPhoneEmail: true,
            customerName: cleanName,
            customerDob: dob,
        });
    };

    // Step 1: Send Fallback OTP (when Phone.Email is not configured yet)
    const handleSendFallbackOtp = async (e?: React.FormEvent) => {
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
            console.error('[handleSendFallbackOtp Error]', err);
            setServerError(err.message || 'Network error. Please check your connection and try again.');
            setSubmitting(false);
        }
    };

    // Resend OTP handler for fallback
    const handleResendOtp = async () => {
        if (resendCooldown > 0 || submitting) return;
        await handleSendFallbackOtp();
    };

    // Step 2: Verify Fallback OTP
    const handleVerifyFallbackOtp = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setServerError('');
        setValidationError('');

        const cleanOtp = otp.trim();
        if (cleanOtp.length !== 6) {
            setValidationError('Please enter the complete 6-digit verification code');
            return;
        }

        const cleanMobile = mobile.trim().replace(/\D/g, '');

        await executeVerification({
            verifiedMobile: cleanMobile,
            isPhoneEmail: false,
            customerName: name.trim(),
            customerDob: dob.trim(),
            otpCode: cleanOtp,
        });
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

                    <p className="text-xs sm:text-sm text-slate-500 font-medium">
                        {tagline}
                    </p>

                    {tableFromUrl && (
                        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200/80 text-orange-700 text-xs font-bold shadow-2xs">
                            <Utensils size={13} className="text-orange-500" />
                            <span>Table {tableFromUrl}</span>
                        </div>
                    )}
                </motion.div>
            </header>

            {/* Main Content Card */}
            <main className="w-full max-w-md mx-auto my-auto py-2">
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="rounded-3xl p-6 sm:p-7 relative overflow-hidden"
                    style={{
                        backgroundColor: '#EEF2F6',
                        boxShadow: '12px 12px 24px rgba(166, 180, 200, 0.5), -12px -12px 24px rgba(255, 255, 255, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.8)',
                    }}
                >
                    {redirectingMessage && (
                        <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
                            <Loader2 size={36} className="text-orange-500 animate-spin mb-3" />
                            <p className="text-sm font-black text-slate-900">{redirectingMessage}</p>
                        </div>
                    )}

                    <AnimatePresence mode="wait">
                        {step === 'details' ? (
                            /* ── STEP 1: Details & Phone.Email Verification ───────── */
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
                                        <span>Guest Details & Phone OTP</span>
                                    </div>
                                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                                        Enter Your Details
                                    </h2>
                                    <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
                                        Please provide your name, date of birth, and verify your mobile with OTP to begin dining.
                                    </p>
                                </div>

                                <form
                                    onSubmit={phoneEmailEnabled ? handleFinalSubmitWithPhoneEmail : handleSendFallbackOtp}
                                    className="space-y-4"
                                >
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

                                    {/* ── MOBILE VERIFICATION SECTION ── */}
                                    {phoneEmailEnabled ? (
                                        /* Mode A: Phone.Email Official Free SMS OTP Verification */
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">
                                                Mobile Verification <span className="text-rose-500">*</span>
                                            </label>

                                            {phoneEmailVerified && mobile ? (
                                                /* State: Verified */
                                                <div
                                                    className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-300 text-emerald-900"
                                                    style={{
                                                        boxShadow: '2px 2px 6px rgba(166, 180, 200, 0.25)',
                                                    }}
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="size-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                                            <CheckCircle2 size={18} />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-extrabold text-emerald-900 tracking-wide">
                                                                +91 {mobile}
                                                            </p>
                                                            <p className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                                                                <ShieldCheck size={11} />
                                                                <span>Phone.Email Verified</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setPhoneEmailVerified(false);
                                                            setVerifiedJsonUrl('');
                                                        }}
                                                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline px-2 py-1"
                                                    >
                                                        Change
                                                    </button>
                                                </div>
                                            ) : (
                                                /* State: Click to verify with Phone.Email */
                                                <div
                                                    className="p-4 rounded-2xl bg-white transition-all flex flex-col items-center justify-center gap-2.5"
                                                    style={{
                                                        boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.3), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                                        border: '1px solid rgba(226, 232, 240, 0.8)',
                                                    }}
                                                >
                                                    <p className="text-xs font-bold text-slate-700 text-center">
                                                        Verify your mobile number via instant SMS OTP:
                                                    </p>

                                                    {/* Official Phone.Email Button Mount */}
                                                    <div
                                                        className="pe_signin_button"
                                                        data-client-id={phoneEmailClientId}
                                                        style={{
                                                            minHeight: '44px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                        }}
                                                    />

                                                    <p className="text-[10px] text-slate-400 font-medium text-center">
                                                        🔒 Powered by Phone.Email (Zero SMS spam • 100% Secure)
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* Mode B: Direct Fallback Input (Used before Client ID is provided) */
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

                                            {/* Dev Mode Setup Tip */}
                                            <div className="mt-2 p-2.5 rounded-xl bg-orange-50/80 border border-orange-200/60 text-[11px] text-orange-800">
                                                💡 <strong>Production Tip:</strong> Add <code className="bg-orange-100 px-1 py-0.5 rounded text-[10px]">NEXT_PUBLIC_PHONE_EMAIL_CLIENT_ID</code> to enable free Phone.Email SMS OTPs.
                                            </div>
                                        </div>
                                    )}

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

                                    {/* Submit Button */}
                                    <button
                                        type="submit"
                                        disabled={
                                            submitting ||
                                            !name.trim() ||
                                            !dob ||
                                            (phoneEmailEnabled ? !phoneEmailVerified : mobile.length < 10)
                                        }
                                        className={`w-full py-4 rounded-2xl font-black text-sm tracking-wide transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                                            submitting
                                                ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                                                : name.trim() && dob && (phoneEmailEnabled ? phoneEmailVerified : mobile.length === 10)
                                                ? 'bg-gradient-to-r from-orange-500 via-orange-600 to-rose-500 text-white shadow-orange-500/30 hover:scale-[1.01] active:scale-[0.99]'
                                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        }`}
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 size={18} className="animate-spin" />
                                                <span>Completing Verification...</span>
                                            </>
                                        ) : phoneEmailEnabled ? (
                                            <>
                                                <span>{phoneEmailVerified ? 'Start Dining' : 'Verify Mobile to Continue'}</span>
                                                <ArrowRight size={18} />
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
                            /* ── STEP 2: Verify Fallback 6-digit OTP ───────────── */
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

                                <form onSubmit={handleVerifyFallbackOtp} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1 ml-1">
                                            6-Digit OTP Code <span className="text-rose-500">*</span>
                                        </label>
                                        <div
                                            className="flex items-center rounded-2xl p-1.5 bg-white transition-all focus-within:ring-2 focus-within:ring-orange-500/40"
                                            style={{
                                                boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.3), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                                border: '1px solid rgba(226, 232, 240, 0.8)',
                                            }}
                                        >
                                            <div className="pl-3 pr-2 text-slate-400">
                                                <KeyRound size={18} />
                                            </div>
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
                                                className="w-full px-2 py-2.5 bg-transparent text-slate-900 font-extrabold text-lg text-center tracking-[0.5em] placeholder:tracking-normal placeholder:font-normal placeholder:text-sm placeholder:text-slate-400 focus:outline-none"
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
                                            <div className="flex-1">
                                                <span>{serverError}</span>
                                            </div>
                                        </div>
                                    )}

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
                                                <span>Verifying...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Verify & Start Dining</span>
                                                <ArrowRight size={18} />
                                            </>
                                        )}
                                    </button>

                                    {/* Resend Countdown / Button */}
                                    <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setStep('details');
                                                setServerError('');
                                                setValidationError('');
                                            }}
                                            className="text-slate-500 hover:text-slate-700 font-medium underline"
                                        >
                                            Change Number
                                        </button>

                                        {resendCooldown > 0 ? (
                                            <span className="text-slate-400 font-medium">
                                                Resend in <strong className="font-bold text-slate-600">{resendCooldown}s</strong>
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
                            🔒 Verified via Phone.Email secure SMS OTP. Your details are safe & confidential.
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
                                boxShadow: '16px 16px 32px rgba(0, 0, 0, 0.3), -8px -8px 24px rgba(255, 255, 255, 0.9)',
                                border: '1px solid rgba(255, 255, 255, 0.9)',
                            }}
                        >
                            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                                <div>
                                    <h3 className="font-black text-slate-900 text-lg">Active Orders Found</h3>
                                    <p className="text-xs text-slate-500 font-medium">You have orders in progress with this mobile</p>
                                </div>
                                <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 font-extrabold text-xs">
                                    {multipleActiveOrders.length}
                                </span>
                            </div>

                            <div className="overflow-y-auto space-y-2.5 max-h-[50vh] pr-1">
                                {multipleActiveOrders.map((ord) => {
                                    const isDineIn = ord.orderType === 'DINE_IN';
                                    const isTakeaway = ord.orderType === 'TAKEAWAY';

                                    return (
                                        <div
                                            key={ord.id}
                                            onClick={() => handleSelectExistingOrder(ord)}
                                            className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-orange-300 transition-all cursor-pointer flex items-center justify-between group shadow-2xs hover:shadow-sm"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                    isDineIn ? 'bg-orange-100 text-orange-600' :
                                                    isTakeaway ? 'bg-blue-100 text-blue-600' :
                                                    'bg-emerald-100 text-emerald-600'
                                                }`}>
                                                    {isDineIn ? <Utensils size={18} /> :
                                                     isTakeaway ? <ShoppingBag size={18} /> :
                                                     <Bike size={18} />}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-extrabold text-slate-900 text-sm">
                                                            Order #{ord.orderNumber}
                                                        </span>
                                                        <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                                                            {ord.status.replace(/_/g, ' ')}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        {isDineIn && ord.tableNumber ? `Table ${ord.tableNumber} • ` : ''}
                                                        ₹{Number(ord.totalAmount).toFixed(0)}
                                                    </p>
                                                </div>
                                            </div>

                                            <ChevronRight size={18} className="text-slate-400 group-hover:text-orange-500 transition-colors" />
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="pt-2 flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={handleProceedToNewOrder}
                                    className="w-full py-3 rounded-2xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                                >
                                    Start a New Order Instead
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
