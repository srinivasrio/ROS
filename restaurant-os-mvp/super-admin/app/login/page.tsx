'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, Mail, ArrowRight, Sparkles, Building2, Zap, CheckCircle2, AlertCircle, RefreshCw, Key, Smartphone, QrCode, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { DineInOneLogo } from '../../components/DineInOneLogo';
import { showWarningPopup } from '../../components/WarningPopupCard';

type LoginStep = 'password' | 'email-verification' | 'totp';

export default function SuperAdminLoginPage() {
    const router = useRouter();
    const [step, setStep] = useState<LoginStep>('password');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [totpCode, setTotpCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showTotp, setShowTotp] = useState(false);
    const [loginVerificationToken, setLoginVerificationToken] = useState<string | null>(null);
    const [employeeId, setEmployeeId] = useState<string | null>(null);
    const [employeeName, setEmployeeName] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);

    const handleLoginInitiate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !password) {
            showWarningPopup({
                title: 'Missing Credentials',
                message: 'Please enter both founder email and password.',
                type: 'warning'
            });
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/super-admin/login/initiate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success('Password verified. Please check your email for the verification code.');
                setLoginVerificationToken(data.loginVerificationToken);
                setEmployeeId(data.employeeId);
                setEmployeeName(data.employeeName || 'Super Admin');
                setStep('email-verification');
                startResendCooldown();
            } else {
                const errMsg = data.error || 'Authentication failed. Please check your credentials.';
                showWarningPopup({
                    title: 'Authentication Failed',
                    message: errMsg,
                    type: 'error',
                    dismissText: 'Try Again'
                });
            }
        } catch (err: any) {
            const errMsg = err?.message || 'Error connecting to authentication service.';
            showWarningPopup({
                title: 'Connection Error',
                message: errMsg,
                type: 'error',
                dismissText: 'Try Again'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otp.trim() || !loginVerificationToken) {
            showWarningPopup({
                title: 'Missing Code',
                message: 'Please enter the email verification code.',
                type: 'warning'
            });
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/super-admin/login/verify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp, loginVerificationToken }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success('Email verified. Please enter your TOTP code from Google Authenticator.');
                setEmployeeId(data.employeeId);
                setEmployeeName(data.employeeName || 'Super Admin');
                setStep('totp');
            } else {
                const errMsg = data.error || 'Verification code failed or expired.';
                showWarningPopup({
                    title: 'Verification Failed',
                    message: errMsg,
                    type: 'error',
                    dismissText: 'Try Again'
                });
            }
        } catch (err: any) {
            const errMsg = err?.message || 'Error connecting to server';
            showWarningPopup({
                title: 'Verification Error',
                message: errMsg,
                type: 'error',
                dismissText: 'Try Again'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyTotp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!totpCode.trim() || !employeeId) {
            showWarningPopup({
                title: 'Missing TOTP Code',
                message: 'Please enter the 6-digit TOTP code from your authenticator app.',
                type: 'warning'
            });
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/super-admin/login/verify-totp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employeeId, otpCode: totpCode }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success('Founder verified! Accessing platform command center...');
                router.push('/admin/dashboard');
                router.refresh();
            } else {
                const errMsg = data.error || 'TOTP verification code is incorrect or expired.';
                showWarningPopup({
                    title: 'Authentication Failed',
                    message: errMsg,
                    type: 'error',
                    dismissText: 'Try Again'
                });
            }
        } catch (err: any) {
            const errMsg = err?.message || 'Error connecting to server';
            showWarningPopup({
                title: 'Authentication Error',
                message: errMsg,
                type: 'error',
                dismissText: 'Try Again'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleResendEmail = async () => {
        if (resendCooldown > 0) return;
        
        setLoading(true);
        try {
            const res = await fetch('/api/auth/super-admin/login/initiate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success('New verification code sent to your email.');
                setLoginVerificationToken(data.loginVerificationToken);
                startResendCooldown();
            } else {
                toast.error(data.error || 'Failed to resend code');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error connecting to server');
        } finally {
            setLoading(false);
        }
    };

    const startResendCooldown = () => {
        setResendCooldown(60);
        const interval = setInterval(() => {
            setResendCooldown(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const formatCooldown = (seconds: number) => {
        return `${seconds}s`;
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard`);
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#F5F7FC] px-4 py-12 selection:bg-indigo-500 selection:text-white relative overflow-hidden">
            {/* Soft Ambient Background Elements (Bright palette) */}
            <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-indigo-100/60 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-cyan-100/60 blur-3xl pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-violet-50/50 blur-3xl pointer-events-none" />

            <div className="relative w-full max-w-md">
                {/* Main Card */}
                <div className="relative overflow-hidden rounded-3xl border border-[#E4E7EC] bg-white p-8 sm:p-10 shadow-xl shadow-indigo-100/50">
                    {/* Brand Header */}
                    <div className="text-center">
                        <DineInOneLogo size={64} className="mx-auto mb-4" />
                        <h1 className="text-2xl font-black tracking-tight text-[#172033] sm:text-3xl">
                            Dine in One
                        </h1>
                        <div className="mt-2 flex items-center justify-center gap-1.5">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 border border-indigo-100">
                                <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                                Founder Command Center
                            </span>
                        </div>
                        <p className="mt-3 text-xs text-[#667085] leading-relaxed">
                            Secure multi-factor authentication required. Platform-level administration for multi-restaurant networks.
                        </p>
                    </div>

                    {/* Step Indicator */}
                    <div className="mt-6 flex items-center justify-center gap-2">
                        {['password', 'email-verification', 'totp'].map((s, idx) => (
                            <React.Fragment key={s}>
                                <div className={`flex items-center gap-1.5 ${step === s ? 'text-indigo-600' : 'text-neutral-400'}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                        step === s 
                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25' 
                                            : 'bg-neutral-100 border border-neutral-300'
                                    }`}>
                                        {idx + 1}
                                    </div>
                                    <span className="hidden sm:block text-xs font-medium capitalize">
                                        {s.replace('-', ' ')}
                                    </span>
                                </div>
                                {idx < 2 && <div className={`w-12 h-0.5 rounded ${step === 'email-verification' || step === 'totp' ? 'bg-indigo-600' : 'bg-neutral-200'}`} />}
                            </React.Fragment>
                        ))}
                    </div>

                    {/* Form - Step 1: Password */}
                    {step === 'password' && (
                        <form onSubmit={handleLoginInitiate} className="mt-8 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-[#667085]">
                                    Founder Email
                                </label>
                                <div className="relative">
                                    <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="founder@yourdomain.com"
                                        className="h-11 w-full rounded-xl border border-[#E4E7EC] bg-[#F5F7FC] pl-10 pr-4 text-sm text-[#172033] placeholder-neutral-400 shadow-2xs focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 transition-all font-medium"
                                        autoComplete="email"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold uppercase tracking-wider text-[#667085]">
                                        Master Password
                                    </label>
                                </div>
                                <div className="relative">
                                    <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••••••"
                                        className="h-11 w-full rounded-xl border border-[#E4E7EC] bg-[#F5F7FC] pl-10 pr-12 text-sm text-[#172033] placeholder-neutral-400 shadow-2xs focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 transition-all font-medium"
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute top-1/2 right-3.5 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-bold text-white shadow-md shadow-indigo-600/25 transition-all cursor-pointer disabled:opacity-60"
                            >
                                {loading ? (
                                    <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                ) : (
                                    <>
                                        <span>Verify Password & Continue</span>
                                        <ArrowRight className="h-4 w-4" />
                                    </>
                                )}
                            </button>

                            <p className="text-center text-[11px] text-neutral-500">
                                No default credentials. Strong password required (12+ chars, upper, lower, number, special).
                            </p>
                        </form>
                    )}

                    {/* Form - Step 2: Email Verification */}
                    {step === 'email-verification' && (
                        <form onSubmit={handleVerifyEmail} className="mt-8 space-y-4">
                            <div className="text-center mb-4">
                                <Mail className="mx-auto h-12 w-12 text-indigo-500" />
                                <h3 className="mt-3 text-lg font-bold text-[#172033]">Check Your Email</h3>
                                <p className="mt-1 text-sm text-neutral-500">
                                    We&apos;ve sent a 6-digit verification code to <strong>{email}</strong>
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-[#667085]">
                                    Verification Code
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        required
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="000000"
                                        className="h-11 w-full rounded-xl border border-[#E4E7EC] bg-[#F5F7FC] pl-4 pr-4 text-center text-2xl font-mono tracking-widest text-[#172033] placeholder-neutral-400 shadow-2xs focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 transition-all font-medium"
                                        autoComplete="one-time-code"
                                        inputMode="numeric"
                                        maxLength={6}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || otp.length !== 6}
                                className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-bold text-white shadow-md shadow-indigo-600/25 transition-all cursor-pointer disabled:opacity-60"
                            >
                                {loading ? (
                                    <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                ) : (
                                    <>
                                        <span>Verify Email & Continue</span>
                                        <ArrowRight className="h-4 w-4" />
                                    </>
                                )}
                            </button>

                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={handleResendEmail}
                                    disabled={resendCooldown > 0 || loading}
                                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:text-neutral-400 transition-colors"
                                >
                                    {resendCooldown > 0 
                                        ? `Resend code in ${formatCooldown(resendCooldown)}`
                                        : 'Didn&apos;t receive the code? Resend'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Form - Step 3: TOTP Verification */}
                    {step === 'totp' && (
                        <form onSubmit={handleVerifyTotp} className="mt-8 space-y-4">
                            <div className="text-center mb-4">
                                <div className="mx-auto h-12 w-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                                    <Smartphone className="h-7 w-7" />
                                </div>
                                <h3 className="mt-3 text-lg font-bold text-[#172033]">Google Authenticator</h3>
                                <p className="mt-1 text-sm text-neutral-500">
                                    Enter the 6-digit code from your authenticator app for <strong>{employeeName}</strong>
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-[#667085]">
                                    TOTP Code
                                </label>
                                <div className="relative">
                                    <input
                                        type={showTotp ? 'text' : 'password'}
                                        required
                                        value={totpCode}
                                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="000000"
                                        className="h-11 w-full rounded-xl border border-[#E4E7EC] bg-[#F5F7FC] pl-4 pr-12 text-center text-2xl font-mono tracking-widest text-[#172033] placeholder-neutral-400 shadow-2xs focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 transition-all font-medium"
                                        autoComplete="one-time-code"
                                        inputMode="numeric"
                                        maxLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowTotp(!showTotp)}
                                        className="absolute top-1/2 right-3.5 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                                        aria-label={showTotp ? 'Hide code' : 'Show code'}
                                    >
                                        {showTotp ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || totpCode.length !== 6}
                                className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-bold text-white shadow-md shadow-indigo-600/25 transition-all cursor-pointer disabled:opacity-60"
                            >
                                {loading ? (
                                    <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                ) : (
                                    <>
                                        <span>Verify TOTP & Access Console</span>
                                        <ArrowRight className="h-4 w-4" />
                                    </>
                                )}
                            </button>

                            <p className="text-center text-[11px] text-neutral-500">
                                Code refreshes every 30 seconds. Use Google Authenticator, Microsoft Authenticator, or 2FAS.
                            </p>
                        </form>
                    )}

                    {/* Footer Security Badges */}
                    <div className="mt-8 pt-6 border-t border-[#E4E7EC] flex flex-col items-center gap-3">
                        <div className="flex items-center justify-center gap-4 text-[11px] text-[#667085] font-medium flex-wrap">
                            <span className="flex items-center gap-1.5">
                                <CheckCircle2 size={13} className="text-emerald-600" />
                                Zero-Trust Audit Logged
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1.5">
                                <ShieldCheck size={13} className="text-indigo-600" />
                                SHA-256 Encrypted Session
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1.5">
                                <Smartphone size={13} className="text-indigo-600" />
                                TOTP MFA Required
                            </span>
                        </div>
                        <p className="text-[10px] text-neutral-400 text-center max-w-xs">
                            All authentication events are logged. Sessions expire in 8 hours. 
                            Recovery codes are generated during initial setup only.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}