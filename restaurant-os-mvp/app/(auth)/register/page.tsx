'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Clock
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Validation & Strength Helpers                                     */
/* ------------------------------------------------------------------ */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/;

function calculatePasswordStrength(pw: string): { label: string; pct: number; color: string } {
  if (!pw) return { label: '', pct: 0, color: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 2) return { label: 'Weak', pct: 33, color: '#FF6B6B' };
  if (score <= 3) return { label: 'Fair', pct: 66, color: '#F7C948' };
  return { label: 'Strong', pct: 100, color: '#10B981' };
}

export default function RegisterPage() {
  const router = useRouter();

  // Mode: 'register' | 'verify' | 'success'
  const [mode, setMode] = useState<'register' | 'verify' | 'success'>('register');

  // Registration Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(true);

  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // OTP Verification State
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown Timer
  useEffect(() => {
    if (mode !== 'verify' || cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [mode, cooldown]);

  // Handle Registration Submit
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    // Validation
    if (!fullName.trim()) {
      setServerError('Full name is required');
      return;
    }
    if (fullName.trim().length < 2) {
      setServerError('Name must be at least 2 characters');
      return;
    }
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) {
      setServerError('Enter a valid email address');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone || !PHONE_RE.test(cleanPhone)) {
      setServerError('Enter a valid 10-digit Indian mobile number');
      return;
    }
    if (!password) {
      setServerError('Password is required');
      return;
    }
    if (password.length < 8) {
      setServerError('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setServerError('Password must include at least one uppercase letter');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setServerError('Password must include at least one number');
      return;
    }
    if (password !== confirmPassword) {
      setServerError('Passwords do not match');
      return;
    }
    if (!termsAgreed) {
      setServerError('Please agree to the Terms of Service to proceed');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: cleanEmail,
          phone: cleanPhone,
          password
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error || 'Failed to create owner account. Please try again.');
        return;
      }

      toast.success(data.message || 'Verification code sent to your email!');
      if (data.devOtp) {
        setDevOtp(data.devOtp);
      }
      setCooldown(60);
      setMode('verify');
    } catch (err: any) {
      setServerError(err.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP Digit Input
  const handleOtpChange = (index: number, val: string) => {
    setOtpError(null);
    const cleaned = val.replace(/[^0-9]/g, '');
    if (!cleaned) {
      const copy = [...otp];
      copy[index] = '';
      setOtp(copy);
      return;
    }

    if (cleaned.length > 1) {
      // Pasted multi-digit OTP
      const pasted = cleaned.slice(0, 6).split('');
      const newOtp = [...otp];
      pasted.forEach((ch, idx) => {
        newOtp[idx] = ch;
      });
      setOtp(newOtp);
      const nextFocus = Math.min(pasted.length, 5);
      otpInputRefs.current[nextFocus]?.focus();
      return;
    }

    const copy = [...otp];
    copy[index] = cleaned;
    setOtp(copy);

    if (index < 5 && cleaned) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Verify OTP Code
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setOtpError(null);

    const enteredOtp = otp.join('').trim();
    if (enteredOtp.length !== 6) {
      setOtpError('Please enter all 6 digits of your verification code');
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          otp: enteredOtp
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error || 'Invalid verification code. Please check and try again.');
        return;
      }

      setMode('success');
      toast.success('Owner account verified successfully!');
      setTimeout(() => {
        router.push('https://owner.dineinone.com/login?registered=true');
      }, 2500);
    } catch (err: any) {
      setOtpError(err.message || 'Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  // Resend OTP Code
  const handleResendOtp = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setOtpError(null);

    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error || 'Failed to resend verification code');
        return;
      }

      toast.success(data.message || 'New verification code sent to your email!');
      if (data.devOtp) {
        setDevOtp(data.devOtp);
      }
      setCooldown(60);
    } catch (err: any) {
      setOtpError(err.message || 'Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  const strength = calculatePasswordStrength(password);

  return (
    <div className="relative min-h-[100dvh] flex items-center justify-center bg-background text-foreground overflow-hidden px-4 sm:px-6 py-12">
      {/* Background Ambient Lighting (matches Hero section) */}
      <div className="absolute top-0 left-0 w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] bg-[#FF6B6B]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-0 right-0 w-[300px] sm:w-[450px] h-[300px] sm:h-[450px] bg-[#4ECDC4]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[400px] sm:w-[600px] h-[300px] sm:h-[400px] bg-purple-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-[480px] mx-auto">
        {/* Brand Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-6 sm:mb-8"
        >
          <Link href="/" className="inline-block text-2xl sm:text-3xl font-extrabold tracking-tight">
            Dine <span className="gradient-text-coral text-2xl sm:text-3xl">in</span> One
          </Link>
          <p className="text-xs text-muted-foreground font-semibold mt-1">
            Restaurant Operating System
          </p>
        </motion.div>

        {/* Card Container */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-3xl bg-white/90 dark:bg-neutral-900/90 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.08] shadow-2xl p-6 sm:p-8 md:p-9"
        >
          <AnimatePresence mode="wait">
            {/* ---------------------------------------------------- */}
            {/* STEP 1: OWNER REGISTRATION FORM                     */}
            {/* ---------------------------------------------------- */}
            {mode === 'register' && (
              <motion.div
                key="register-step"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-center mb-6 sm:mb-7">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FF6B6B]/10 text-[#FF6B6B] border border-[#FF6B6B]/20 mb-2.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Owner Account Creation
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                    Create Your Account
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Get started with your restaurant management workspace
                  </p>
                </div>

                {serverError && (
                  <div className="p-3 mb-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{serverError}</span>
                  </div>
                )}

                <form onSubmit={handleRegister} className="space-y-4" noValidate>
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="e.g. Rahul Sharma"
                        value={fullName}
                        onChange={(e) => { setFullName(e.target.value); setServerError(null); }}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-neutral-100/70 dark:bg-neutral-800/70 border border-black/[0.06] dark:border-white/[0.06] text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-[#FF6B6B]/60 focus:ring-2 focus:ring-[#FF6B6B]/15 transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* Email Address */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="email"
                        placeholder="owner@yourrestaurant.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setServerError(null); }}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-neutral-100/70 dark:bg-neutral-800/70 border border-black/[0.06] dark:border-white/[0.06] text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-[#FF6B6B]/60 focus:ring-2 focus:ring-[#FF6B6B]/15 transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Mobile Number
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3.5 flex items-center gap-1.5 pointer-events-none">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-bold text-muted-foreground">+91</span>
                      </div>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="98765 43210"
                        value={phone}
                        onChange={(e) => { setPhone(e.target.value.replace(/[^0-9]/g, '')); setServerError(null); }}
                        className="w-full pl-16 pr-4 py-2.5 rounded-xl bg-neutral-100/70 dark:bg-neutral-800/70 border border-black/[0.06] dark:border-white/[0.06] text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-[#FF6B6B]/60 focus:ring-2 focus:ring-[#FF6B6B]/15 transition-all font-mono"
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Minimum 8 characters"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setServerError(null); }}
                        className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-neutral-100/70 dark:bg-neutral-800/70 border border-black/[0.06] dark:border-white/[0.06] text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-[#FF6B6B]/60 focus:ring-2 focus:ring-[#FF6B6B]/15 transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Password Strength Indicator */}
                    {password && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold">
                          <span className="text-muted-foreground">Password Strength</span>
                          <span style={{ color: strength.color }}>{strength.label}</span>
                        </div>
                        <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all duration-300 rounded-full"
                            style={{ width: `${strength.pct}%`, backgroundColor: strength.color }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Re-enter your password"
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); setServerError(null); }}
                        className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-neutral-100/70 dark:bg-neutral-800/70 border border-black/[0.06] dark:border-white/[0.06] text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-[#FF6B6B]/60 focus:ring-2 focus:ring-[#FF6B6B]/15 transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Terms & Conditions */}
                  <div className="flex items-start gap-2.5 pt-1">
                    <input
                      type="checkbox"
                      id="terms"
                      checked={termsAgreed}
                      onChange={(e) => setTermsAgreed(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded text-[#FF6B6B] border-border focus:ring-[#FF6B6B]/20 cursor-pointer"
                    />
                    <label htmlFor="terms" className="text-xs text-muted-foreground cursor-pointer leading-relaxed">
                      I agree to the{' '}
                      <span className="text-foreground hover:underline font-semibold">Terms of Service</span> and{' '}
                      <span className="text-foreground hover:underline font-semibold">Privacy Policy</span>.
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] hover:from-[#ff5959] hover:to-[#ff7f40] shadow-lg shadow-[#FF6B6B]/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        Create Owner Account
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Footer sign in link */}
                <div className="mt-6 text-center text-xs text-muted-foreground">
                  Already have an account?{' '}
                  <Link
                    href="https://owner.dineinone.com/login"
                    className="font-bold text-[#FF6B6B] hover:underline"
                  >
                    Sign In
                  </Link>
                </div>
              </motion.div>
            )}

            {/* ---------------------------------------------------- */}
            {/* STEP 2: VERIFY EMAIL OTP SCREEN                     */}
            {/* ---------------------------------------------------- */}
            {mode === 'verify' && (
              <motion.div
                key="verify-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground mb-4 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to details
                </button>

                <div className="text-center mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-[#4ECDC4]/10 border border-[#4ECDC4]/20 flex items-center justify-center mx-auto mb-3 text-[#2BA89E]">
                    <Mail className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-extrabold text-foreground">
                    Verify Your Email
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                    We sent a 6-digit confirmation code to{' '}
                    <span className="font-semibold text-foreground">{email}</span>
                  </p>
                </div>

                {devOtp && (
                  <div className="mb-4 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs text-center font-mono">
                    ⚡ Dev Mode Code: <strong>{devOtp}</strong>
                  </div>
                )}

                {otpError && (
                  <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{otpError}</span>
                  </div>
                )}

                <form onSubmit={handleVerifyOtp} className="space-y-6">
                  {/* 6 Digit Inputs */}
                  <div className="flex items-center justify-center gap-2 sm:gap-3">
                    {otp.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => { otpInputRefs.current[idx] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        className="w-11 sm:w-12 h-13 sm:h-14 text-center text-lg sm:text-xl font-black rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-black/[0.08] dark:border-white/[0.08] text-foreground focus:outline-none focus:border-[#4ECDC4] focus:ring-2 focus:ring-[#4ECDC4]/20 transition-all font-mono"
                        autoFocus={idx === 0}
                      />
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={verifying || otp.join('').length !== 6}
                    className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#4ECDC4] to-[#2BA89E] hover:opacity-95 shadow-lg shadow-[#4ECDC4]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {verifying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Verifying Code...
                      </>
                    ) : (
                      <>
                        Verify & Complete Registration <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Resend Timer */}
                <div className="mt-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                  <span>Didn't receive the email code?</span>
                  {cooldown > 0 ? (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" /> Resend in {cooldown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resending}
                      className="inline-flex items-center gap-1.5 font-bold text-[#FF6B6B] hover:underline cursor-pointer disabled:opacity-50"
                    >
                      {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      Resend Verification Code
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* ---------------------------------------------------- */}
            {/* STEP 3: SUCCESS CELEBRATION SCREEN                  */}
            {/* ---------------------------------------------------- */}
            {mode === 'success' && (
              <motion.div
                key="success-step"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <h2 className="text-2xl font-black text-foreground mb-2">
                  Account Verified!
                </h2>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">
                  Welcome to Dine in One. Your owner account is active and ready.
                </p>
                <div className="inline-flex items-center gap-2 text-xs text-muted-foreground font-semibold">
                  <Loader2 className="w-4 h-4 animate-spin text-[#FF6B6B]" />
                  Redirecting to Owner Portal...
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Security Isolation Footer Tag */}
        <p className="text-center text-[11px] text-muted-foreground/80 mt-6 flex items-center justify-center gap-1.5 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          End-to-end cryptographic tenant security active
        </p>
      </div>
    </div>
  );
}
