'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Store, User, Phone, Mail, Lock, ShieldCheck, 
    ArrowRight, ArrowLeft, Loader2, CheckCircle2, 
    Building2, MapPin, Sparkles, Send
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from "@/components/landing/Navbar";

export default function RegisterPage() {
    const router = useRouter();

    // Step management: 1 = Owner Account, 2 = Restaurant Request
    const [step, setStep] = useState<1 | 2>(1);
    const [loading, setLoading] = useState(false);

    // Step 1: Owner Details
    const [ownerName, setOwnerName] = useState('');
    const [mobile, setMobile] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Mobile OTP state
    const [mobileOtpSent, setMobileOtpSent] = useState(false);
    const [mobileOtp, setMobileOtp] = useState('');
    const [mobileVerified, setMobileVerified] = useState(false);
    const [sendingMobileOtp, setSendingMobileOtp] = useState(false);
    const [verifyingMobileOtp, setVerifyingMobileOtp] = useState(false);

    // Email OTP state
    const [emailOtpSent, setEmailOtpSent] = useState(false);
    const [emailOtp, setEmailOtp] = useState('');
    const [emailVerified, setEmailVerified] = useState(false);
    const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
    const [verifyingEmailOtp, setVerifyingEmailOtp] = useState(false);

    // Step 2: Restaurant Request Details
    const [restaurantName, setRestaurantName] = useState('');
    const [businessType, setBusinessType] = useState<'Restaurant' | 'Bar' | 'Bar and Restaurant'>('Restaurant');
    const [streetAddress, setStreetAddress] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [pincode, setPincode] = useState('');
    const [gstPercentage, setGstPercentage] = useState('5');
    const [cgstPercentage, setCgstPercentage] = useState('2.5');
    const [sgstPercentage, setSgstPercentage] = useState('2.5');

    const handleGstChange = (val: string) => {
        setGstPercentage(val);
        const num = parseFloat(val);
        if (!isNaN(num) && num >= 0) {
            const half = (num / 2).toString();
            setCgstPercentage(half);
            setSgstPercentage(half);
        }
    };

    // --- OTP Handlers ---
    const handleSendMobileOtp = async () => {
        const clean = mobile.replace(/[^0-9]/g, '');
        if (clean.length < 10) {
            toast.error('Please enter a valid 10-digit mobile number');
            return;
        }

        setSendingMobileOtp(true);
        try {
            const res = await fetch('/api/auth/owner/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'mobile', target: clean })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to send mobile OTP');

            setMobileOtpSent(true);
            toast.success(data.message || 'OTP sent to mobile');
            if (data.devOtp) {
                toast.info(`Dev Mode OTP: ${data.devOtp}`, { duration: 8000 });
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to send mobile OTP');
        } finally {
            setSendingMobileOtp(false);
        }
    };

    const handleVerifyMobileOtp = async () => {
        if (!mobileOtp || mobileOtp.trim().length < 6) {
            toast.error('Please enter the 6-digit OTP');
            return;
        }

        setVerifyingMobileOtp(true);
        try {
            const res = await fetch('/api/auth/owner/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'mobile',
                    target: mobile.replace(/[^0-9]/g, ''),
                    otp: mobileOtp.trim()
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Invalid OTP code');

            setMobileVerified(true);
            toast.success('Mobile number verified successfully!');
        } catch (err: any) {
            toast.error(err.message || 'Verification failed');
        } finally {
            setVerifyingMobileOtp(false);
        }
    };

    const handleSendEmailOtp = async () => {
        const clean = email.toLowerCase().trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(clean)) {
            toast.error('Please enter a valid email address');
            return;
        }

        setSendingEmailOtp(true);
        try {
            const res = await fetch('/api/auth/owner/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'email', target: clean })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to send email code');

            setEmailOtpSent(true);
            toast.success(data.message || 'Verification code sent to email');
            if (data.devOtp) {
                toast.info(`Dev Mode Code: ${data.devOtp}`, { duration: 8000 });
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to send verification code');
        } finally {
            setSendingEmailOtp(false);
        }
    };

    const handleVerifyEmailOtp = async () => {
        if (!emailOtp || emailOtp.trim().length < 6) {
            toast.error('Please enter the 6-digit verification code');
            return;
        }

        setVerifyingEmailOtp(true);
        try {
            const res = await fetch('/api/auth/owner/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'email',
                    target: email.toLowerCase().trim(),
                    otp: emailOtp.trim()
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Invalid verification code');

            setEmailVerified(true);
            toast.success('Email verified successfully!');
        } catch (err: any) {
            toast.error(err.message || 'Verification failed');
        } finally {
            setVerifyingEmailOtp(false);
        }
    };

    // --- Submit Step 1: Owner Account Registration ---
    const handleOwnerAccountSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!ownerName.trim()) {
            toast.error('Please enter your full name');
            return;
        }
        if (!mobileVerified) {
            toast.error('Please verify your mobile number with OTP first');
            return;
        }
        if (!emailVerified) {
            toast.error('Please verify your email address with OTP first');
            return;
        }
        if (password.length < 8) {
            toast.error('Password must be at least 8 characters long');
            return;
        }
        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/owner/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: ownerName.trim(),
                    mobile: mobile.replace(/[^0-9]/g, ''),
                    email: email.toLowerCase().trim(),
                    password: password
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create owner account');

            toast.success('Owner account created! Now provide your restaurant details.');
            setStep(2);
        } catch (err: any) {
            toast.error(err.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    // --- Submit Step 2: New Restaurant Request ---
    const handleRestaurantRequestSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!restaurantName.trim()) {
            toast.error('Please enter your restaurant name');
            return;
        }
        if (!streetAddress.trim() || !city.trim() || !state.trim()) {
            toast.error('Please complete the restaurant address');
            return;
        }

        const gstNum = parseFloat(gstPercentage);
        const cgstNum = parseFloat(cgstPercentage);
        const sgstNum = parseFloat(sgstPercentage);

        if (isNaN(gstNum) || gstNum < 0) {
            toast.error('Please enter a valid GST percentage');
            return;
        }
        if (isNaN(cgstNum) || isNaN(sgstNum) || Math.abs((cgstNum + sgstNum) - gstNum) > 0.01) {
            toast.error(`CGST (${cgstNum}%) + SGST (${sgstNum}%) must equal total GST (${gstNum}%)`);
            return;
        }

        setLoading(true);
        try {
            const fullAddress = `${streetAddress.trim()}, ${city.trim()}, ${state.trim()} - ${pincode.trim()}`;

            const res = await fetch('/api/auth/owner/submit-restaurant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurantName: restaurantName.trim(),
                    businessType: businessType,
                    address: fullAddress,
                    gstPercentage: gstNum,
                    cgstPercentage: cgstNum,
                    sgstPercentage: sgstNum
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to submit restaurant request');

            toast.success('Restaurant request submitted! Redirecting to status tracker...');
            router.push('/waiting-approval');
        } catch (err: any) {
            toast.error(err.message || 'Submission failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 pt-28 pb-16 relative overflow-hidden">
            <Navbar />

            {/* Background Glows */}
            <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-[#FF6B6B]/8 rounded-full blur-[140px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-amber-500/6 rounded-full blur-[140px] translate-x-1/4 translate-y-1/4 pointer-events-none" />

            <div className="max-w-xl w-full relative z-10">

                {/* Header Branding */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-wider mb-4">
                        <Sparkles size={13} /> Controlled Onboarding
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 text-foreground">
                        Register with <span className="bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] bg-clip-text text-transparent">Dine In One</span>
                    </h1>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">
                        Create your verified owner account and request restaurant activation.
                    </p>
                </div>

                {/* Stepper Indicator */}
                <div className="flex items-center justify-between mb-8 px-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                            step === 1 ? 'bg-[#FF6B6B] text-white shadow-lg shadow-[#FF6B6B]/30' : 'bg-emerald-500 text-white'
                        }`}>
                            {step > 1 ? <CheckCircle2 size={18} /> : '1'}
                        </div>
                        <div>
                            <p className="text-xs font-bold text-foreground">Owner Account</p>
                            <p className="text-[11px] text-muted-foreground">Mobile & Email OTP</p>
                        </div>
                    </div>

                    <div className={`flex-1 h-0.5 mx-4 transition-all ${step > 1 ? 'bg-emerald-500' : 'bg-neutral-200 dark:bg-neutral-800'}`} />

                    <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                            step === 2 ? 'bg-[#FF6B6B] text-white shadow-lg shadow-[#FF6B6B]/30' : 'bg-neutral-200 dark:bg-neutral-800 text-muted-foreground'
                        }`}>
                            2
                        </div>
                        <div>
                            <p className="text-xs font-bold text-foreground">Restaurant Request</p>
                            <p className="text-[11px] text-muted-foreground">Name, Type & Location</p>
                        </div>
                    </div>
                </div>

                {/* Card Container */}
                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-xl relative"
                >
                    <AnimatePresence mode="wait">
                        {step === 1 ? (
                            <motion.form 
                                key="step-1"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                onSubmit={handleOwnerAccountSubmit}
                                className="space-y-5"
                            >
                                <div className="border-b border-border pb-4 mb-2">
                                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                                        <User size={18} className="text-[#FF6B6B]" /> Owner Account Setup
                                    </h2>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Verify your identity to manage your Dine In One restaurant entity.
                                    </p>
                                </div>

                                {/* Owner Name */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Full Name</label>
                                    <div className="relative">
                                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                        <input 
                                            type="text"
                                            required
                                            value={ownerName}
                                            onChange={(e) => setOwnerName(e.target.value)}
                                            placeholder="e.g. Rahul Sharma"
                                            className="w-full bg-background border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium text-foreground focus:outline-none focus:border-[#FF6B6B] transition-colors"
                                        />
                                    </div>
                                </div>

                                {/* Mobile Number with OTP */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Mobile Number</label>
                                        {mobileVerified && (
                                            <span className="text-emerald-500 text-xs font-bold flex items-center gap-1">
                                                <CheckCircle2 size={13} /> Verified
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                            <input 
                                                type="tel"
                                                required
                                                disabled={mobileVerified}
                                                value={mobile}
                                                onChange={(e) => setMobile(e.target.value)}
                                                placeholder="10-digit mobile (e.g. 9876543210)"
                                                className="w-full bg-background border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium text-foreground focus:outline-none focus:border-[#FF6B6B] transition-colors disabled:opacity-60"
                                            />
                                        </div>
                                        {!mobileVerified && (
                                            <button
                                                type="button"
                                                onClick={handleSendMobileOtp}
                                                disabled={sendingMobileOtp || !mobile}
                                                className="px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-foreground font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                                            >
                                                {sendingMobileOtp ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />}
                                                {mobileOtpSent ? 'Resend' : 'Send OTP'}
                                            </button>
                                        )}
                                    </div>

                                    {/* Mobile OTP Input */}
                                    {mobileOtpSent && !mobileVerified && (
                                        <motion.div 
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="flex gap-2 pt-1"
                                        >
                                            <input 
                                                type="text"
                                                maxLength={6}
                                                value={mobileOtp}
                                                onChange={(e) => setMobileOtp(e.target.value)}
                                                placeholder="Enter 6-digit Mobile OTP (Dev: 123456)"
                                                className="flex-1 bg-background border border-border rounded-xl py-2 px-3 text-sm text-foreground focus:outline-none focus:border-[#FF6B6B]"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleVerifyMobileOtp}
                                                disabled={verifyingMobileOtp || mobileOtp.length < 6}
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1 disabled:opacity-50"
                                            >
                                                {verifyingMobileOtp ? <Loader2 size={13} className="animate-spin" /> : 'Verify'}
                                            </button>
                                        </motion.div>
                                    )}
                                </div>

                                {/* Email Address with OTP */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email Address</label>
                                        {emailVerified && (
                                            <span className="text-emerald-500 text-xs font-bold flex items-center gap-1">
                                                <CheckCircle2 size={13} /> Verified
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                            <input 
                                                type="email"
                                                required
                                                disabled={emailVerified}
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="owner@example.com"
                                                className="w-full bg-background border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium text-foreground focus:outline-none focus:border-[#FF6B6B] transition-colors disabled:opacity-60"
                                            />
                                        </div>
                                        {!emailVerified && (
                                            <button
                                                type="button"
                                                onClick={handleSendEmailOtp}
                                                disabled={sendingEmailOtp || !email}
                                                className="px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-foreground font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                                            >
                                                {sendingEmailOtp ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />}
                                                {emailOtpSent ? 'Resend' : 'Send Code'}
                                            </button>
                                        )}
                                    </div>

                                    {/* Email OTP Input */}
                                    {emailOtpSent && !emailVerified && (
                                        <motion.div 
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="flex gap-2 pt-1"
                                        >
                                            <input 
                                                type="text"
                                                maxLength={6}
                                                value={emailOtp}
                                                onChange={(e) => setEmailOtp(e.target.value)}
                                                placeholder="Enter 6-digit Email Code (Dev: 123456)"
                                                className="flex-1 bg-background border border-border rounded-xl py-2 px-3 text-sm text-foreground focus:outline-none focus:border-[#FF6B6B]"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleVerifyEmailOtp}
                                                disabled={verifyingEmailOtp || emailOtp.length < 6}
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1 disabled:opacity-50"
                                            >
                                                {verifyingEmailOtp ? <Loader2 size={13} className="animate-spin" /> : 'Verify'}
                                            </button>
                                        </motion.div>
                                    )}
                                </div>

                                {/* Password Fields */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Password</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                            <input 
                                                type="password"
                                                required
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="Min 8 chars"
                                                className="w-full bg-background border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium text-foreground focus:outline-none focus:border-[#FF6B6B] transition-colors"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Confirm Password</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                            <input 
                                                type="password"
                                                required
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder="Repeat password"
                                                className="w-full bg-background border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium text-foreground focus:outline-none focus:border-[#FF6B6B] transition-colors"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Continue Button */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full mt-2 py-3.5 bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] hover:opacity-90 text-white font-bold rounded-2xl transition-all shadow-lg shadow-[#FF6B6B]/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={18} /> : (
                                        <>Create Account & Proceed <ArrowRight size={16} /></>
                                    )}
                                </button>
                            </motion.form>
                        ) : (
                            <motion.form 
                                key="step-2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                onSubmit={handleRestaurantRequestSubmit}
                                className="space-y-5"
                            >
                                <div className="border-b border-border pb-4 mb-2">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                                            <Store size={18} className="text-[#FF6B6B]" /> New Restaurant Request
                                        </h2>
                                        <button 
                                            type="button" 
                                            onClick={() => setStep(1)}
                                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                                        >
                                            <ArrowLeft size={13} /> Edit Account
                                        </button>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Submit only basic establishment details. Compliance & plan selection will be completed by Super Admin.
                                    </p>
                                </div>

                                {/* Restaurant Name */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Restaurant Name</label>
                                    <div className="relative">
                                        <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                        <input 
                                            type="text"
                                            required
                                            value={restaurantName}
                                            onChange={(e) => setRestaurantName(e.target.value)}
                                            placeholder="e.g. Royal Spice Bistro"
                                            className="w-full bg-background border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium text-foreground focus:outline-none focus:border-[#FF6B6B] transition-colors"
                                        />
                                    </div>
                                </div>

                                {/* Business Type */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Business Type</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['Restaurant', 'Bar', 'Bar and Restaurant'] as const).map((type) => (
                                            <button
                                                type="button"
                                                key={type}
                                                onClick={() => setBusinessType(type)}
                                                className={`py-3 px-2 rounded-xl border text-center font-bold text-xs transition-all ${
                                                    businessType === type 
                                                        ? 'border-[#FF6B6B] bg-[#FF6B6B]/10 text-[#FF6B6B]' 
                                                        : 'border-border bg-background text-muted-foreground hover:border-neutral-400'
                                                }`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Address Fields */}
                                <div className="space-y-3 pt-1">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Street Address / Landmark</label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3.5 top-3 text-muted-foreground" size={16} />
                                            <textarea 
                                                required
                                                rows={2}
                                                value={streetAddress}
                                                onChange={(e) => setStreetAddress(e.target.value)}
                                                placeholder="Plot No., Road No., Area"
                                                className="w-full bg-background border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium text-foreground focus:outline-none focus:border-[#FF6B6B] transition-colors resize-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-muted-foreground uppercase">City</label>
                                            <input 
                                                type="text"
                                                required
                                                value={city}
                                                onChange={(e) => setCity(e.target.value)}
                                                placeholder="e.g. Nellore"
                                                className="w-full bg-background border border-border rounded-xl py-2 px-3 text-xs text-foreground focus:outline-none focus:border-[#FF6B6B]"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-muted-foreground uppercase">State</label>
                                            <input 
                                                type="text"
                                                required
                                                value={state}
                                                onChange={(e) => setState(e.target.value)}
                                                placeholder="e.g. Andhra Pradesh"
                                                className="w-full bg-background border border-border rounded-xl py-2 px-3 text-xs text-foreground focus:outline-none focus:border-[#FF6B6B]"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-muted-foreground uppercase">PIN Code</label>
                                            <input 
                                                type="text"
                                                required
                                                maxLength={6}
                                                value={pincode}
                                                onChange={(e) => setPincode(e.target.value)}
                                                placeholder="524001"
                                                className="w-full bg-background border border-border rounded-xl py-2 px-3 text-xs text-foreground focus:outline-none focus:border-[#FF6B6B]"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* GST & Tax Configuration */}
                                <div className="space-y-3 pt-1">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tax & GST Configuration</label>
                                            <p className="text-[11px] text-muted-foreground mt-0.5">Applied to orders and menu items as restaurant default</p>
                                        </div>
                                        <span className="text-[10.5px] font-bold text-[#FF6B6B] bg-[#FF6B6B]/10 px-2.5 py-0.5 rounded-full border border-[#FF6B6B]/20">
                                            Auto-Split
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-muted-foreground uppercase">Total GST (%)</label>
                                            <div className="relative">
                                                <input 
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    required
                                                    value={gstPercentage}
                                                    onChange={(e) => handleGstChange(e.target.value)}
                                                    placeholder="5"
                                                    className="w-full bg-background border border-border rounded-xl py-2 px-3 pr-7 text-xs font-bold text-foreground focus:outline-none focus:border-[#FF6B6B]"
                                                />
                                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground font-bold">%</span>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-muted-foreground uppercase">CGST (%)</label>
                                            <div className="relative">
                                                <input 
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    required
                                                    value={cgstPercentage}
                                                    onChange={(e) => setCgstPercentage(e.target.value)}
                                                    placeholder="2.5"
                                                    className="w-full bg-background border border-border rounded-xl py-2 px-3 pr-7 text-xs font-bold text-foreground focus:outline-none focus:border-[#FF6B6B]"
                                                />
                                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground font-bold">%</span>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-muted-foreground uppercase">SGST (%)</label>
                                            <div className="relative">
                                                <input 
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    required
                                                    value={sgstPercentage}
                                                    onChange={(e) => setSgstPercentage(e.target.value)}
                                                    placeholder="2.5"
                                                    className="w-full bg-background border border-border rounded-xl py-2 px-3 pr-7 text-xs font-bold text-foreground focus:outline-none focus:border-[#FF6B6B]"
                                                />
                                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground font-bold">%</span>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-[10.5px] text-muted-foreground">
                                        💡 <span className="font-semibold">Example:</span> 5% GST → 2.5% CGST + 2.5% SGST | 18% GST → 9% CGST + 9% SGST
                                    </p>
                                </div>

                                {/* Compliance & Policy Notice */}
                                <div className="p-3.5 bg-neutral-100 dark:bg-neutral-800/60 rounded-2xl border border-neutral-200 dark:border-neutral-700/40 text-xs text-muted-foreground flex gap-3 items-start">
                                    <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                    <div>
                                        <strong className="text-foreground">Controlled Verification Process:</strong>
                                        <p className="mt-0.5">
                                            Your request will be placed in <span className="font-bold text-amber-500">PENDING</span> status. Our Super Admin onboarding team will contact you to verify compliance documents and assign your subscription plan prior to activation.
                                        </p>
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3.5 bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] hover:opacity-90 text-white font-bold rounded-2xl transition-all shadow-lg shadow-[#FF6B6B]/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={18} /> : (
                                        <>Submit Request for Review <ArrowRight size={16} /></>
                                    )}
                                </button>
                            </motion.form>
                        )}
                    </AnimatePresence>

                    {/* Footer Links */}
                    <div className="mt-6 pt-4 border-t border-border text-center">
                        <p className="text-xs text-muted-foreground">
                            Already registered?{' '}
                            <Link href="/login" className="font-bold text-[#FF6B6B] hover:underline">
                                Sign In
                            </Link>
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
