'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { 
    User, Phone, Mail, Calendar, LogOut, Heart, MapPin, 
    Bell, ChevronRight, ShieldCheck, HelpCircle, Sparkles, 
    ArrowRight, Check, X, Shield, Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export function PersistentProfile({ restaurantId, tableNumber }: { restaurantId: string, tableNumber: string }) {
    const pathname = usePathname();
    const router = useRouter();
    const isVisible = pathname.includes('/customer/profile/');
    const normTable = String(tableNumber || '').trim().toLowerCase();
    const isVirtual = normTable === 'takeaway' || normTable === 'delivery';
    const formattedTable = isVirtual ? (normTable === 'takeaway' ? 'Takeaway' : 'Delivery') : (tableNumber?.toLowerCase().startsWith('table') ? tableNumber : `Table ${tableNumber}`);

    // Stored customer details
    const [customerName, setCustomerName] = useState('');
    const [customerMobile, setCustomerMobile] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [customerDob, setCustomerDob] = useState('');
    const [isRegistered, setIsRegistered] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Form inputs for completing or updating profile
    const [formName, setFormName] = useState('');
    const [formMobile, setFormMobile] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formDob, setFormDob] = useState('');
    const [formDobFocused, setFormDobFocused] = useState(false);
    const dobInputRef = useRef<HTMLInputElement>(null);
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Load customer data from backend session with localStorage fallback
    useEffect(() => {
        try {
            const name = localStorage.getItem(`ros_customer_name_${restaurantId}`) || '';
            const mob = localStorage.getItem(`ros_customer_mobile_${restaurantId}`) || '';
            const mail = localStorage.getItem(`ros_customer_email_${restaurantId}`) || '';
            const dob = localStorage.getItem(`ros_customer_dob_${restaurantId}`) || '';
            const cid = localStorage.getItem(`ros_customer_${restaurantId}`) || '';

            if (name) setCustomerName(name);
            if (mob) setCustomerMobile(mob);
            if (mail) setCustomerEmail(mail);
            if (dob) setCustomerDob(dob);

            setFormName(name);
            setFormMobile(mob);
            setFormEmail(mail);
            setFormDob(dob);

            const hasDetails = Boolean(cid || name || mob);
            setIsRegistered(hasDetails);
            if (hasDetails) {
                setAgreeTerms(true);
            }
        } catch {}

        // Verify with backend persistent session
        if (restaurantId) {
            fetch(`/api/customer/auth/session?restaurantId=${encodeURIComponent(restaurantId)}`)
                .then(res => res.json())
                .then(data => {
                    if (data.authenticated && data.customer) {
                        const c = data.customer;
                        if (c.name) { setCustomerName(c.name); setFormName(c.name); }
                        if (c.mobile) { setCustomerMobile(c.mobile); setFormMobile(c.mobile); }
                        if (c.email) { setCustomerEmail(c.email); setFormEmail(c.email); }
                        if (c.dateOfBirth) { setCustomerDob(c.dateOfBirth); setFormDob(c.dateOfBirth); }
                        setIsRegistered(true);
                        setAgreeTerms(true);
                        try {
                            localStorage.setItem(`ros_customer_${restaurantId}`, c.id);
                            if (c.name) localStorage.setItem(`ros_customer_name_${restaurantId}`, c.name);
                            if (c.mobile) localStorage.setItem(`ros_customer_mobile_${restaurantId}`, c.mobile);
                            if (c.email) localStorage.setItem(`ros_customer_email_${restaurantId}`, c.email);
                            if (c.dateOfBirth) localStorage.setItem(`ros_customer_dob_${restaurantId}`, c.dateOfBirth);
                        } catch {}
                    }
                })
                .catch(() => {});
        }
    }, [restaurantId, pathname]);

    // Handle Form Submit to Complete Profile
    const handleSaveProfile = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        const trimmedName = formName.trim();
        const trimmedMobile = formMobile.trim();
        const trimmedEmail = formEmail.trim();
        const trimmedDob = formDob.trim();

        // 9. Full Name and Mobile Number are MANDATORY
        if (!trimmedName) {
            toast.error('Please enter your full name');
            return;
        }

        if (!trimmedMobile) {
            toast.error('Please enter your mobile number');
            return;
        }

        // Validate mobile format
        if (!/^\+?[\d\s-]{7,15}$/.test(trimmedMobile.replace(/\s/g, ''))) {
            toast.error('Please enter a valid mobile number (7-15 digits)');
            return;
        }

        // Validate email format if provided
        if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            toast.error('Please enter a valid email address');
            return;
        }

        // 4 & 5. Terms & Conditions checkbox mandatory for submission
        if (!agreeTerms) {
            toast.error('Please agree to the Terms & Conditions to proceed');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`/api/restaurant/${restaurantId}/customers`, {
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
                        localStorage.setItem(`ros_customer_${restaurantId}`, data.customerId);
                    }
                    localStorage.setItem(`ros_customer_name_${restaurantId}`, trimmedName);
                    localStorage.setItem(`ros_customer_mobile_${restaurantId}`, trimmedMobile);
                    if (trimmedEmail) {
                        localStorage.setItem(`ros_customer_email_${restaurantId}`, trimmedEmail.toLowerCase());
                    }
                    if (trimmedDob) {
                        localStorage.setItem(`ros_customer_dob_${restaurantId}`, trimmedDob);
                    }
                    localStorage.removeItem(`ros_customer_skipped_${restaurantId}`);
                } catch {}

                setCustomerName(trimmedName);
                setCustomerMobile(trimmedMobile);
                setCustomerEmail(trimmedEmail);
                setCustomerDob(trimmedDob);
                setIsRegistered(true);
                setIsEditing(false);
                toast.success('Profile saved successfully! Welcome to Dine in One.');
            } else {
                const errData = await res.json().catch(() => null);
                toast.error(errData?.error || 'Could not save profile details. Please try again.');
            }
        } catch (err) {
            console.error('Failed to save profile:', err);
            toast.error('Network error while saving profile.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ display: isVisible ? 'block' : 'none' }} className="min-h-screen pb-32">
            {/* Header */}
            <header
                className="sticky top-0 z-30 flex items-center px-4 h-16"
                style={{
                    backgroundColor: '#EEF2F6',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.85)',
                    boxShadow: '0 2px 8px rgba(166, 180, 200, 0.25)',
                }}
            >
                <h1 className="flex-1 text-center text-lg font-black text-slate-800 tracking-tight">
                    {isRegistered && !isEditing ? 'Customer Profile' : 'Complete Profile'}
                </h1>
            </header>

            {/* Main Content */}
            <main className="p-4 space-y-4 max-w-xl mx-auto w-full overflow-x-hidden">
                {/* 6. If details not given or user clicked edit: Show the Details Form Card */}
                {(!isRegistered || isEditing) ? (
                    <div
                        className="p-5 sm:p-6 rounded-[24px] space-y-4 w-full max-w-full overflow-hidden"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: '4px 4px 10px rgba(166, 180, 200, 0.4), -4px -4px 10px rgba(255, 255, 255, 0.95)',
                            border: '1px solid rgba(255, 255, 255, 0.85)',
                        }}
                    >
                        {/* Form Header */}
                        <div className="text-center pb-1">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black text-orange-600 bg-orange-100/80 border border-orange-200/80 mb-2">
                                <Sparkles size={13} />
                                <span>{isEditing ? 'Update Profile' : 'Complete Your Profile'}</span>
                            </div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">
                                {isEditing ? 'Edit Your Dining Details' : 'Welcome to Dine in One'}
                            </h2>
                            <p className="text-xs font-bold text-orange-600 mt-1">
                                Enjoy a faster and more personalized dining experience.
                            </p>
                            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-md mx-auto">
                                Tell us a little about yourself to receive offers, birthday benefits, order updates, and personalized experiences.
                            </p>
                        </div>

                        {/* Form Inputs */}
                        <form onSubmit={handleSaveProfile} className="space-y-3.5 pt-1">
                            {/* Full Name * (Mandatory) */}
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-slate-700 ml-1">
                                    Full Name <span className="text-rose-500 font-black">*</span>
                                </label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Full Name"
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all shadow-sm"
                                        autoComplete="name"
                                    />
                                </div>
                            </div>

                            {/* Mobile Number * (Mandatory) */}
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-slate-700 ml-1">
                                    Mobile Number <span className="text-rose-500 font-black">*</span>
                                </label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" size={18} />
                                    <input
                                        type="tel"
                                        placeholder="Mobile Number"
                                        value={formMobile}
                                        onChange={(e) => setFormMobile(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all shadow-sm"
                                        autoComplete="tel"
                                    />
                                </div>
                            </div>

                            {/* Email Address (Optional) */}
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-slate-700 ml-1">
                                    Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" size={18} />
                                    <input
                                        type="email"
                                        placeholder="Email Address"
                                        value={formEmail}
                                        onChange={(e) => setFormEmail(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all shadow-sm"
                                        autoComplete="email"
                                    />
                                </div>
                            </div>

                            {/* Date of Birth (Optional) */}
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
                                        type={formDobFocused || formDob ? 'date' : 'text'}
                                        onFocus={() => setFormDobFocused(true)}
                                        onBlur={() => setFormDobFocused(false)}
                                        placeholder="Date of Birth (DD/MM/YYYY)"
                                        value={formDob}
                                        onChange={(e) => setFormDob(e.target.value)}
                                        max={new Date().toISOString().split('T')[0]}
                                        className="w-full min-w-0 max-w-full flex-1 py-3 pr-3 bg-transparent text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none border-0 shadow-none cursor-pointer"
                                        style={{ minWidth: 0, maxWidth: '100%', width: '100%' }}
                                    />
                                    {formDob && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFormDob('');
                                                setFormDobFocused(false);
                                            }}
                                            className="pr-3 text-slate-400 hover:text-slate-600 transition-colors shrink-0 cursor-pointer"
                                            title="Clear date"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* 4. Terms and Conditions Checkbox */}
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

                            {/* Action Buttons */}
                            <div className="space-y-2 pt-2">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-rose-500 text-white rounded-2xl font-bold text-sm tracking-wide shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    {submitting ? (
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                                    ) : (
                                        <>
                                            <span>{isEditing ? 'Save Changes' : 'Complete Profile'}</span>
                                            <ArrowRight size={17} />
                                        </>
                                    )}
                                </button>

                                {isEditing && (
                                    <button
                                        type="button"
                                        onClick={() => setIsEditing(false)}
                                        className="w-full py-2.5 text-slate-500 hover:text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200/50 transition-all cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                ) : (
                    /* Registered Customer Profile Card */
                    <div
                        className="p-5 rounded-[24px]"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: '4px 4px 10px rgba(166, 180, 200, 0.4), -4px -4px 10px rgba(255, 255, 255, 0.95)',
                            border: '1px solid rgba(255, 255, 255, 0.85)',
                        }}
                    >
                        <div className="flex items-start gap-4">
                            <div
                                className="p-1 rounded-[22px] shrink-0"
                                style={{
                                    backgroundColor: '#EEF2F6',
                                    boxShadow: 'inset 2.5px 2.5px 5px rgba(166, 180, 200, 0.38), inset -2.5px -2.5px 5px rgba(255, 255, 255, 0.95)',
                                }}
                            >
                                <div className="size-14 rounded-[18px] bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-[0_4px_14px_rgba(255,107,53,0.35)]">
                                    <User size={26} strokeWidth={2.5} />
                                </div>
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base sm:text-lg font-black text-slate-800 tracking-tight truncate">
                                        {customerName || 'Verified Diner'}
                                    </h2>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200">
                                        <Check size={10} strokeWidth={3} />
                                        Verified
                                    </span>
                                </div>

                                {/* Customer Details: Mobile, DOB, Email */}
                                <div className="mt-2 space-y-1.5 text-xs font-semibold text-slate-600">
                                    {customerMobile && (
                                        <div className="flex items-center gap-2 text-slate-700">
                                            <Phone size={13} className="text-orange-500 shrink-0" />
                                            <span className="font-bold">+91 {customerMobile.replace(/\D/g, '').slice(-10)}</span>
                                        </div>
                                    )}
                                    {customerDob && (
                                        <div className="flex items-center gap-2 text-slate-700">
                                            <Calendar size={13} className="text-orange-500 shrink-0" />
                                            <span>Date of Birth: <strong className="text-slate-900 font-bold">{customerDob}</strong></span>
                                        </div>
                                    )}
                                    {customerEmail && (
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <Mail size={13} className="text-slate-400 shrink-0" />
                                            <span className="truncate">{customerEmail}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-3 flex items-center gap-2 flex-wrap">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200/80">
                                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        {formattedTable}
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black text-orange-600 bg-orange-100/70 border border-orange-200/60">
                                        <Sparkles size={10} />
                                        MSG91 Verified
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Account & Activity Section */}
                <section>
                    <div className="flex items-center gap-2 px-1 mb-2.5">
                        <span className="size-1.5 rounded-full bg-orange-500" />
                        <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500">Account & Activity</h3>
                    </div>
                    <div
                        className="rounded-[24px] p-2 overflow-hidden"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: '4px 4px 10px rgba(166, 180, 200, 0.38), -4px -4px 10px rgba(255, 255, 255, 0.95)',
                            border: '1px solid rgba(255, 255, 255, 0.85)',
                        }}
                    >
                        <div className="divide-y divide-slate-200/60">
                            <ProfileItem
                                icon={User}
                                label={isRegistered ? 'Update Dining Details' : 'Complete Profile'}
                                onClick={() => {
                                    setIsEditing(true);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                            />
                            <ProfileItem icon={Heart} label="Favorite Dishes" />
                            <ProfileItem
                                icon={MapPin}
                                label="Dining History"
                                onClick={() => router.push(`/${restaurantId}/customer/myorders/${tableNumber}`)}
                            />
                            <ProfileItem icon={Bell} label="Service Alerts" />
                        </div>
                    </div>
                </section>

                {/* Preferences & Support Section (Dietary Preferences REMOVED) */}
                <section>
                    <div className="flex items-center gap-2 px-1 mb-2.5">
                        <span className="size-1.5 rounded-full bg-orange-500" />
                        <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500">Preferences & Support</h3>
                    </div>
                    <div
                        className="rounded-[24px] p-2 overflow-hidden"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: '4px 4px 10px rgba(166, 180, 200, 0.38), -4px -4px 10px rgba(255, 255, 255, 0.95)',
                            border: '1px solid rgba(255, 255, 255, 0.85)',
                        }}
                    >
                        <div className="divide-y divide-slate-200/60">
                            <ProfileItem icon={HelpCircle} label="Help & Feedback" />
                            <ProfileItem icon={ShieldCheck} label="Privacy & Terms" />
                            <ProfileItem
                                icon={LogOut}
                                label="Log Out"
                                color="text-rose-600"
                                onClick={() => setShowLogoutConfirm(true)}
                            />
                        </div>
                    </div>
                </section>
            </main>

            {/* Log Out Confirmation Modal */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
                        <div className="size-16 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 mb-4 shadow-lg shadow-rose-500/10">
                            <LogOut size={28} />
                        </div>
                        
                        <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">
                            Log Out Account?
                        </h3>
                        
                        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                            Are you sure you want to log out? Your session on this device will be signed out. All active and previous orders will remain safe and will appear whenever you log back in.
                        </p>
                        
                        <div className="grid grid-cols-2 gap-3 w-full">
                            <button
                                onClick={() => setShowLogoutConfirm(false)}
                                className="py-3.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all active:scale-[0.98] cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    setShowLogoutConfirm(false);
                                    try {
                                        await fetch('/api/customer/auth/logout', { method: 'POST' });
                                    } catch (err) {
                                        console.warn('Backend logout failed:', err);
                                    }
                                    try {
                                        localStorage.removeItem(`ros_customer_${restaurantId}`);
                                        localStorage.removeItem(`ros_customer_name_${restaurantId}`);
                                        localStorage.removeItem(`ros_customer_mobile_${restaurantId}`);
                                        localStorage.removeItem(`ros_customer_email_${restaurantId}`);
                                        localStorage.removeItem(`ros_customer_dob_${restaurantId}`);
                                        localStorage.removeItem(`ros_customer_skipped_${restaurantId}`);
                                    } catch {}
                                    setCustomerName('');
                                    setCustomerMobile('');
                                    setCustomerEmail('');
                                    setCustomerDob('');
                                    setFormName('');
                                    setFormMobile('');
                                    setFormEmail('');
                                    setFormDob('');
                                    setIsRegistered(false);
                                    setIsEditing(false);
                                    toast.success('Logged out successfully');
                                    router.push(`/${restaurantId}/customer/welcome/${tableNumber}`);
                                }}
                                className="py-3.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-lg shadow-rose-600/25 transition-all active:scale-[0.98] cursor-pointer"
                            >
                                Log Out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ProfileItem({
    icon: Icon,
    label,
    color = "text-slate-700",
    onClick,
}: {
    icon: any;
    label: string;
    color?: string;
    onClick?: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full flex items-center justify-between px-3 py-3 rounded-2xl transition-all duration-150 cursor-pointer active:scale-[0.98] select-none"
        >
            <div className="flex items-center gap-3 min-w-0">
                <div
                    className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}
                    style={{
                        backgroundColor: '#EEF2F6',
                        boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                        border: '1px solid rgba(255, 255, 255, 0.7)',
                    }}
                >
                    <Icon size={17} strokeWidth={2.2} />
                </div>
                <span className={`font-extrabold text-xs tracking-tight truncate ${color}`}>{label}</span>
            </div>
            <div
                className="size-6 rounded-lg flex items-center justify-center text-slate-400 shrink-0"
                style={{
                    backgroundColor: '#EEF2F6',
                    boxShadow: '1.5px 1.5px 3px rgba(166, 180, 200, 0.3), -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                }}
            >
                <ChevronRight size={14} />
            </div>
        </button>
    );
}
