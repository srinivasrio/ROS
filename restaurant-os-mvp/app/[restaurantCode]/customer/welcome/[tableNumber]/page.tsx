'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Sparkles, User, Phone, Mail, Calendar, ArrowRight, X, Utensils } from 'lucide-react';
import { toast } from 'sonner';
import { HomepageCache } from '@/services/homepage-cache.service';
import { HomepageBuilderService } from '@/services/homepage-builder.service';

export default function WelcomePage({ params: paramsPromise }: any) {
    const params: any = use(paramsPromise);
    const { restaurantCode, tableNumber } = params;
    const router = useRouter();
    const searchParams = useSearchParams();
    const isEdit = searchParams?.get('edit') === 'true';

    const [profile, setProfile] = useState<any>(() => {
        return HomepageCache.get(restaurantCode, tableNumber)?.profile || null;
    });

    const [name, setName] = useState('');
    const [mobile, setMobile] = useState('');
    const [email, setEmail] = useState('');
    const [dob, setDob] = useState('');
    const [dobFocused, setDobFocused] = useState(false);
    const dobInputRef = useRef<HTMLInputElement>(null);
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [skipChecked, setSkipChecked] = useState(false);

    // Fetch restaurant profile for header
    useEffect(() => {
        if (!restaurantCode) return;
        const cached = HomepageCache.get(restaurantCode, tableNumber)?.profile;
        if (cached) setProfile(cached);

        HomepageBuilderService.getProfile(restaurantCode)
            .then((data: any) => {
                if (data) setProfile(data);
            })
            .catch(() => {});
    }, [restaurantCode, tableNumber]);

    // Check if returning customer — skip prompt if already saved details or skipped, unless in edit mode
    useEffect(() => {
        if (isEdit) {
            try {
                const savedName = localStorage.getItem(`ros_customer_name_${restaurantCode}`);
                const savedMobile = localStorage.getItem(`ros_customer_mobile_${restaurantCode}`);
                const savedEmail = localStorage.getItem(`ros_customer_email_${restaurantCode}`);
                const savedDob = localStorage.getItem(`ros_customer_dob_${restaurantCode}`);
                if (savedName) setName(savedName);
                if (savedMobile) setMobile(savedMobile);
                if (savedEmail) setEmail(savedEmail);
                if (savedDob) setDob(savedDob);
                setAgreeTerms(true);
            } catch {}
            setSkipChecked(true);
            return;
        }

        try {
            const hasMobile = localStorage.getItem(`ros_customer_mobile_${restaurantCode}`);
            if (!hasMobile) {
                router.replace(`/${restaurantCode}/customer?table=${encodeURIComponent(tableNumber)}`);
                return;
            }

            const customerId = localStorage.getItem(`ros_customer_${restaurantCode}`);
            const hasSkipped = localStorage.getItem(`ros_customer_skipped_${restaurantCode}`);
            if (customerId || hasSkipped) {
                // Returning customer or previously skipped on this device — go directly to menu
                router.replace(`/${restaurantCode}/customer/home/${tableNumber}`);
                return;
            }
        } catch {}
        setSkipChecked(true);
    }, [restaurantCode, tableNumber, router, isEdit]);

    const goToMenu = () => {
        if (isEdit) {
            router.replace(`/${restaurantCode}/customer/profile/${tableNumber}`);
        } else {
            router.replace(`/${restaurantCode}/customer/home/${tableNumber}`);
        }
    };

    const handleContinue = async () => {
        const trimmedName = name.trim();
        const trimmedMobile = mobile.trim();
        const trimmedEmail = email.trim();
        const trimmedDob = dob.trim();

        // 9. Full Name and Mobile Number are MANDATORY
        if (!trimmedName) {
            toast.error('Please enter your full name');
            return;
        }

        if (!trimmedMobile) {
            toast.error('Please enter your mobile number');
            return;
        }

        // Validate mobile if provided (7-15 digits)
        if (!/^\+?[\d\s-]{7,15}$/.test(trimmedMobile.replace(/\s/g, ''))) {
            toast.error('Please enter a valid mobile number (7-15 digits)');
            return;
        }

        // Validate email if provided
        if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            toast.error('Please enter a valid email address');
            return;
        }

        // 5. Must agree to Terms & Conditions before entering with data
        if (!agreeTerms) {
            toast.error('Please agree to the Terms & Conditions to proceed');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`/api/restaurant/${restaurantCode}/customers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: trimmedName,
                    mobile: trimmedMobile,
                    email: trimmedEmail.toLowerCase() || undefined,
                    dateOfBirth: trimmedDob || undefined,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                try {
                    if (data.customerId) {
                        localStorage.setItem(`ros_customer_${restaurantCode}`, data.customerId);
                    }
                    localStorage.setItem(`ros_customer_name_${restaurantCode}`, trimmedName);
                    localStorage.setItem(`ros_customer_mobile_${restaurantCode}`, trimmedMobile);
                    if (trimmedEmail) {
                        localStorage.setItem(`ros_customer_email_${restaurantCode}`, trimmedEmail.toLowerCase());
                    }
                    if (trimmedDob) {
                        localStorage.setItem(`ros_customer_dob_${restaurantCode}`, trimmedDob);
                    }
                    localStorage.removeItem(`ros_customer_skipped_${restaurantCode}`);
                } catch {}
                toast.success(isEdit ? 'Details updated!' : 'Welcome! Starting your dining experience...');
            } else {
                const errData = await res.json().catch(() => null);
                toast.error(errData?.error || 'Could not save details, continuing to menu...');
            }
        } catch (err) {
            console.error('Failed to save customer info:', err);
        } finally {
            setSubmitting(false);
            goToMenu();
        }
    };

    // 5. Skip for now enters without taking data
    const handleSkip = () => {
        try {
            localStorage.setItem(`ros_customer_skipped_${restaurantCode}`, 'true');
        } catch {}
        goToMenu();
    };

    // Don't render until we've checked returning customer status
    if (!skipChecked) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            </div>
        );
    }

    const restaurantName = profile?.name || 'Dine in One';
    const logoUrl = profile?.logo_url || profile?.logo;
    const tagline = profile?.tagline || 'Welcome to Dine in One';
    const formattedTable = tableNumber?.toLowerCase().startsWith('table') ? tableNumber : `Table ${tableNumber}`;

    return (
        <div className="min-h-full flex flex-col bg-[#EEF2F6]">
            {/* 1. Header: Same style like customer panel homepage (Logo on left, Restaurant name on left, Table name on right) */}
            <header 
                className="sticky top-0 z-40 w-full transition-all"
                style={{
                    backgroundColor: '#EEF2F6',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.8)',
                    boxShadow: '0 2px 8px rgba(166, 180, 200, 0.15)'
                }}
            >
                <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-3">
                    {/* Left: Logo and Restaurant Info */}
                    <div className="flex items-center gap-3 min-w-0">
                        {logoUrl ? (
                            <div 
                                className="relative size-10 sm:size-12 rounded-xl overflow-hidden shrink-0 p-1"
                                style={{
                                    backgroundColor: '#EEF2F6',
                                    boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                    border: '1px solid rgba(255, 255, 255, 0.8)'
                                }}
                            >
                                <Image
                                    src={logoUrl}
                                    alt={restaurantName}
                                    fill
                                    unoptimized
                                    className="object-contain"
                                    sizes="(max-width: 640px) 40px, 48px"
                                />
                            </div>
                        ) : (
                            <div 
                                className="size-10 sm:size-12 rounded-xl text-orange-600 flex items-center justify-center shrink-0"
                                style={{
                                    backgroundColor: '#EEF2F6',
                                    boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                    border: '1px solid rgba(255, 255, 255, 0.8)'
                                }}
                            >
                                <Utensils className="size-6" />
                            </div>
                        )}

                        <div className="min-w-0">
                            <h2 className="text-base sm:text-lg font-black text-slate-800 truncate tracking-tight font-display">
                                {restaurantName}
                            </h2>
                            <p className="text-xs font-semibold text-slate-500 truncate mt-0.5">
                                {tagline}
                            </p>
                        </div>
                    </div>

                    {/* Right: Table Info */}
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <div 
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black text-emerald-800"
                            style={{
                                backgroundColor: '#EEF2F6',
                                boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                border: '1px solid rgba(255, 255, 255, 0.8)'
                            }}
                        >
                            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>{formattedTable}</span>
                        </div>

                        {isEdit && (
                            <button
                                onClick={goToMenu}
                                className="size-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
                                style={{
                                    backgroundColor: '#EEF2F6',
                                    boxShadow: '2px 2px 5px rgba(166, 180, 200, 0.4), -2px -2px 5px rgba(255, 255, 255, 0.9)',
                                    border: '1px solid rgba(255, 255, 255, 0.85)'
                                }}
                                title="Close"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Form Content */}
            <main className="flex-1 w-full max-w-md mx-auto px-4 py-6 sm:py-8 flex flex-col justify-center">
                {/* 1, 2, 3: Welcome Text Section */}
                <div className="text-center mb-6">
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        Welcome to Dine in One
                    </h1>
                    <p className="text-xs sm:text-sm font-bold text-orange-600 mt-1.5">
                        Enjoy a faster and more personalized dining experience.
                    </p>
                    <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
                        Tell us a little about yourself to receive offers, birthday benefits, order updates, and personalized experiences.
                    </p>
                </div>

                {/* Form Card */}
                <div
                    className="p-5 sm:p-6 rounded-[24px] space-y-4"
                    style={{
                        backgroundColor: '#EEF2F6',
                        boxShadow: '4px 4px 10px rgba(166, 180, 200, 0.4), -4px -4px 10px rgba(255, 255, 255, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.85)',
                    }}
                >
                    {/* 1. Full Name * (Mandatory) */}
                    <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-700 ml-1">
                            Full Name <span className="text-rose-500 font-black">*</span>
                        </label>
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Full Name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all shadow-sm"
                                autoComplete="name"
                            />
                        </div>
                    </div>

                    {/* 2. Mobile Number * (Mandatory) */}
                    <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-700 ml-1">
                            Mobile Number <span className="text-rose-500 font-black">*</span>
                        </label>
                        <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" size={18} />
                            <input
                                type="tel"
                                placeholder="Mobile Number"
                                value={mobile}
                                onChange={(e) => setMobile(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all shadow-sm"
                                autoComplete="tel"
                            />
                        </div>
                    </div>

                    {/* 3. Email Address (Optional) */}
                    <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-700 ml-1">
                            Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" size={18} />
                            <input
                                type="email"
                                placeholder="Email Address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all shadow-sm"
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    {/* 4. Date of Birth (Optional) */}
                    <div className="space-y-1 w-full max-w-full min-w-0">
                        <label className="block text-xs font-bold text-slate-700 ml-1">
                            Date of Birth <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <div
                            onClick={() => {
                                dobInputRef.current?.focus();
                                try {
                                    dobInputRef.current?.showPicker?.();
                                } catch {}
                            }}
                            className="flex items-center w-full max-w-full min-w-0 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-400 transition-all cursor-pointer"
                        >
                            <div className="pl-3.5 pr-2 flex items-center justify-center text-slate-400 shrink-0 pointer-events-none">
                                <Calendar size={18} />
                            </div>
                            <input
                                ref={dobInputRef}
                                type={dobFocused || dob ? 'date' : 'text'}
                                onFocus={() => setDobFocused(true)}
                                onBlur={() => setDobFocused(false)}
                                placeholder="Date of Birth (DD/MM/YYYY)"
                                value={dob}
                                onChange={(e) => setDob(e.target.value)}
                                max={new Date().toISOString().split('T')[0]}
                                className="w-full min-w-0 max-w-full flex-1 py-3 pr-3 bg-transparent text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none border-0 shadow-none cursor-pointer"
                                style={{ minWidth: 0, maxWidth: '100%', width: '100%' }}
                            />
                            {dob && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDob('');
                                        setDobFocused(false);
                                    }}
                                    className="pr-3 text-slate-400 hover:text-slate-600 transition-colors shrink-0 cursor-pointer"
                                    title="Clear date"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 4. Terms and Conditions (Professional safe & secure notice) */}
                    <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-white border border-slate-200/80 cursor-pointer shadow-sm select-none hover:bg-slate-50/50 transition-all">
                        <input
                            type="checkbox"
                            checked={agreeTerms}
                            onChange={(e) => setAgreeTerms(e.target.checked)}
                            className="mt-0.5 size-4 rounded text-orange-500 focus:ring-orange-500 border-slate-300 cursor-pointer accent-orange-500 shrink-0"
                        />
                        <div className="text-[11px] text-slate-600 leading-tight">
                            <span className="font-bold text-slate-800">I agree to the Terms & Conditions and Privacy Policy.</span>
                            <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                                Your personal information is safe, encrypted, and strictly confidential. We only use your data to enhance your dining experience, celebrate occasions, and deliver order updates.
                            </p>
                        </div>
                    </label>

                    {/* Buttons */}
                    <div className="space-y-2.5 pt-2">
                        <button
                            onClick={handleContinue}
                            disabled={submitting}
                            className="w-full py-4 bg-gradient-to-r from-orange-500 to-rose-500 text-white rounded-2xl font-bold text-sm tracking-wide shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                        >
                            {submitting ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                            ) : (
                                <>
                                    {isEdit ? 'Save Details' : 'Continue'}
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>

                        {!isEdit && (
                            <button
                                onClick={handleSkip}
                                disabled={submitting}
                                className="w-full py-3 bg-transparent text-slate-500 rounded-xl font-bold text-sm hover:bg-slate-100 active:scale-[0.98] transition-all disabled:opacity-70 cursor-pointer"
                            >
                                Skip for Now
                            </button>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
