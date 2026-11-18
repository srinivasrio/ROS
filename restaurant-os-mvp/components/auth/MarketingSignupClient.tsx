'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Clock,
  Store
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Validation & Password Strength Helpers                           */
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

  if (score <= 2) return { label: 'Weak', pct: 33, color: '#C2412D' };
  if (score <= 3) return { label: 'Fair', pct: 66, color: '#E9A23B' };
  return { label: 'Strong', pct: 100, color: '#2E9E5B' };
}

export default function MarketingSignupClient() {
  const router = useRouter();

  // Mode: 'register' | 'verify' | 'success'
  const [mode, setMode] = useState<'register' | 'verify' | 'success'>('register');

  // Registration Form State
  const [fullName, setFullName] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
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
      setServerError('Include at least one uppercase letter');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setServerError('Include at least one number');
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
          restaurantName: restaurantName.trim(),
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
        router.push('/login?registered=true');
      }, 2000);
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
    <div className="relative min-h-screen bg-[#FBF9F7] text-[#222125] flex flex-col justify-center items-center px-4 sm:px-6 py-12 font-sans selection:bg-[#C2412D]/15 selection:text-[#222125]">
      {/* Top Bar / Navigation Back to Home */}
      <div className="w-full max-w-[820px] mb-5 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5E5A60] hover:text-[#C2412D] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
        </Link>
      </div>

      <div className="relative z-10 w-full max-w-[820px] mx-auto">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-block text-2xl sm:text-3xl font-extrabold tracking-tight text-[#222125]">
            Dine <span className="text-[#C2412D]">in</span> One
          </Link>
        </div>

        {/* Card Container */}
        <div className="rounded-[24px] bg-[#FFFFFF] border border-[#EFE9E3] shadow-[0_20px_48px_-12px_rgba(34,33,37,0.08)] p-6 sm:p-10 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {/* ---------------------------------------------------- */}
            {/* STEP 1: OWNER REGISTRATION FORM                     */}
            {/* ---------------------------------------------------- */}
            {mode === 'register' && (
              <motion.div
                key="register-step"
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-center mb-6">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#222125]">
                    Create Your Account
                  </h1>
                  <p className="text-xs text-[#5E5A60] mt-1">
                    Sign up to manage your restaurant in one unified system
                  </p>
                </div>

                {serverError && (
                  <div className="p-3 mb-5 rounded-xl bg-[#FFF0ED] border border-[#FFD5CD] text-[#B23A26] text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-[#C2412D]" />
                    <span>{serverError}</span>
                  </div>
                )}

                <form onSubmit={handleRegister} className="space-y-4" noValidate>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-x-6 md:gap-y-4">
                    {/* Full Name (Col 1) */}
                    <div>
                      <label className="block text-xs font-semibold text-[#5E5A60] mb-1.5">
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C8684]" />
                        <input
                          type="text"
                          placeholder="e.g. Rahul Sharma"
                          value={fullName}
                          onChange={(e) => { setFullName(e.target.value); setServerError(null); }}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#FCFAF8] border border-[#E5DFD7] text-sm text-[#222125] placeholder:text-[#A59E99] focus:outline-none focus:border-[#C2412D] focus:ring-2 focus:ring-[#C2412D]/15 transition-all"
                          required
                        />
                      </div>
                    </div>

                    {/* Restaurant Name (Col 2) */}
                    <div>
                      <label className="block text-xs font-semibold text-[#5E5A60] mb-1.5">
                        Restaurant / Business Name
                      </label>
                      <div className="relative">
                        <Store className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C8684]" />
                        <input
                          type="text"
                          placeholder="e.g. Spice Route Kitchen"
                          value={restaurantName}
                          onChange={(e) => { setRestaurantName(e.target.value); setServerError(null); }}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#FCFAF8] border border-[#E5DFD7] text-sm text-[#222125] placeholder:text-[#A59E99] focus:outline-none focus:border-[#C2412D] focus:ring-2 focus:ring-[#C2412D]/15 transition-all"
                        />
                      </div>
                    </div>

                    {/* Email Address (Col 1) */}
                    <div>
                      <label className="block text-xs font-semibold text-[#5E5A60] mb-1.5">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C8684]" />
                        <input
                          type="email"
                          placeholder="owner@yourrestaurant.com"
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setServerError(null); }}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#FCFAF8] border border-[#E5DFD7] text-sm text-[#222125] placeholder:text-[#A59E99] focus:outline-none focus:border-[#C2412D] focus:ring-2 focus:ring-[#C2412D]/15 transition-all"
                          required
                        />
                      </div>
                    </div>

                    {/* Phone Number (Col 2) */}
                    <div>
                      <label className="block text-xs font-semibold text-[#5E5A60] mb-1.5">
                        Mobile Number
                      </label>
                      <div className="relative flex items-center">
                        <div className="absolute left-3.5 flex items-center gap-1.5 pointer-events-none">
                          <Phone className="w-4 h-4 text-[#8C8684]" />
                          <span className="text-xs font-bold text-[#5E5A60]">+91</span>
                        </div>
                        <input
                          type="tel"
                          maxLength={10}
                          placeholder="98765 43210"
                          value={phone}
                          onChange={(e) => { setPhone(e.target.value.replace(/[^0-9]/g, '')); setServerError(null); }}
                          className="w-full pl-16 pr-4 py-2.5 rounded-xl bg-[#FCFAF8] border border-[#E5DFD7] text-sm text-[#222125] placeholder:text-[#A59E99] focus:outline-none focus:border-[#C2412D] focus:ring-2 focus:ring-[#C2412D]/15 transition-all font-mono"
                          required
                        />
                      </div>
                    </div>

                    {/* Password (Col 1) */}
                    <div>
                      <label className="block text-xs font-semibold text-[#5E5A60] mb-1.5">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C8684]" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Minimum 8 characters"
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); setServerError(null); }}
                          className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-[#FCFAF8] border border-[#E5DFD7] text-sm text-[#222125] placeholder:text-[#A59E99] focus:outline-none focus:border-[#C2412D] focus:ring-2 focus:ring-[#C2412D]/15 transition-all"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C8684] hover:text-[#222125] p-1 cursor-pointer"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Password Strength Indicator */}
                      {password && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-semibold">
                            <span className="text-[#8C8684]">Strength:</span>
                            <span style={{ color: strength.color }}>{strength.label}</span>
                          </div>
                          <div className="h-1.5 w-full bg-[#EFE9E3] rounded-full overflow-hidden">
                            <div
                              className="h-full transition-all duration-300 rounded-full"
                              style={{ width: `${strength.pct}%`, backgroundColor: strength.color }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Confirm Password (Col 2) */}
                    <div>
                      <label className="block text-xs font-semibold text-[#5E5A60] mb-1.5">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C8684]" />
                        <input
                          type={showConfirm ? 'text' : 'password'}
                          placeholder="Re-enter your password"
                          value={confirmPassword}
                          onChange={(e) => { setConfirmPassword(e.target.value); setServerError(null); }}
                          className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-[#FCFAF8] border border-[#E5DFD7] text-sm text-[#222125] placeholder:text-[#A59E99] focus:outline-none focus:border-[#C2412D] focus:ring-2 focus:ring-[#C2412D]/15 transition-all"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm(!showConfirm)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C8684] hover:text-[#222125] p-1 cursor-pointer"
                          aria-label={showConfirm ? "Hide password" : "Show password"}
                        >
                          {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Terms & Conditions */}
                  <div className="flex items-start gap-2.5 pt-2">
                    <input
                      type="checkbox"
                      id="terms"
                      checked={termsAgreed}
                      onChange={(e) => setTermsAgreed(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded text-[#C2412D] border-[#E5DFD7] focus:ring-[#C2412D]/20 cursor-pointer accent-[#C2412D]"
                    />
                    <label htmlFor="terms" className="text-xs text-[#5E5A60] cursor-pointer leading-relaxed">
                      I agree to the{' '}
                      <span className="text-[#222125] hover:underline font-semibold">Terms of Service</span> and{' '}
                      <span className="text-[#222125] hover:underline font-semibold">Privacy Policy</span>.
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-6 rounded-full font-semibold text-sm text-white bg-[#222125] hover:bg-[#3D3A40] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shadow-[0_4px_14px_rgba(34,33,37,0.15)] mt-3"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        Create Account
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* ---------------------------------------------------- */}
            {/* STEP 2: VERIFY EMAIL OTP SCREEN                     */}
            {/* ---------------------------------------------------- */}
            {mode === 'verify' && (
              <motion.div
                key="verify-step"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.25 }}
                className="max-w-[440px] mx-auto"
              >
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5E5A60] hover:text-[#222125] mb-4 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to details
                </button>

                <div className="text-center mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-[#FFEDE8] border border-[#FFD8CE] flex items-center justify-center mx-auto mb-3 text-[#C2412D]">
                    <Mail className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold text-[#222125]">
                    Verify Your Email
                  </h2>
                  <p className="text-xs text-[#5E5A60] mt-1 max-w-xs mx-auto">
                    We sent a 6-digit confirmation code to{' '}
                    <span className="font-semibold text-[#222125]">{email}</span>
                  </p>
                </div>

                {devOtp && (
                  <div className="mb-4 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs text-center font-mono">
                    ⚡ Dev Mode Code: <strong>{devOtp}</strong>
                  </div>
                )}

                {otpError && (
                  <div className="p-3 mb-4 rounded-xl bg-[#FFF0ED] border border-[#FFD5CD] text-[#B23A26] text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-[#C2412D]" />
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
                        className="w-11 sm:w-12 h-13 sm:h-14 text-center text-lg sm:text-xl font-bold rounded-xl bg-[#FCFAF8] border border-[#E5DFD7] text-[#222125] focus:outline-none focus:border-[#C2412D] focus:ring-2 focus:ring-[#C2412D]/15 transition-all font-mono"
                        autoFocus={idx === 0}
                      />
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={verifying || otp.join('').length !== 6}
                    className="w-full py-3 px-4 rounded-full font-semibold text-sm text-white bg-[#222125] hover:bg-[#3D3A40] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-[0_4px_14px_rgba(34,33,37,0.15)]"
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
                <div className="mt-6 text-center text-xs text-[#5E5A60] flex flex-col items-center gap-2">
                  <span>Didn't receive the email code?</span>
                  {cooldown > 0 ? (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[#8C8684]">
                      <Clock className="w-3.5 h-3.5" /> Resend in {cooldown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resending}
                      className="inline-flex items-center gap-1.5 font-bold text-[#C2412D] hover:underline cursor-pointer disabled:opacity-50"
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
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6"
              >
                <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-[#222125] mb-1.5">
                  Account Verified!
                </h2>
                <p className="text-xs text-[#5E5A60] max-w-xs mx-auto mb-6">
                  Welcome to Dine in One. Your owner account is registered and ready.
                </p>
                <div className="inline-flex items-center gap-2 text-xs text-[#5E5A60] font-semibold">
                  <Loader2 className="w-4 h-4 animate-spin text-[#C2412D]" />
                  Redirecting to Log In...
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Security Isolation Footer Tag */}
        <p className="text-center text-[11px] text-[#8C8684] mt-6 flex items-center justify-center gap-1.5 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          End-to-end cryptographic tenant security active
        </p>
      </div>
    </div>
  );
}
