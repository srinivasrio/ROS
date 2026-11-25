'use client';

import React, { useState, useCallback, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { setDineToken } from '@/lib/supabase';

interface AuthNotice {
  type: 'pending' | 'unverified' | 'error' | 'success';
  message: string;
  email?: string;
}

function MarketingLoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [identifier, setIdentifier] = useState(
    searchParams.get('email') || searchParams.get('identifier') || ''
  );
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<AuthNotice | null>(null);

  // Check if just registered
  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      setNotice({
        type: 'success',
        message: 'Account verified successfully! Please log in to your owner dashboard.',
      });
    }
  }, [searchParams]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setNotice(null);

      const cleanId = identifier.trim();
      if (!cleanId || !password) {
        setNotice({
          type: 'error',
          message: 'Please enter both your email or mobile and password.',
        });
        return;
      }

      setLoading(true);
      try {
        // Try owner authentication endpoint
        const res = await fetch('/api/auth/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanId.includes('@') ? cleanId.toLowerCase() : undefined,
            mobile: !cleanId.includes('@') ? cleanId.replace(/[^0-9]/g, '') : undefined,
            identifier: cleanId,
            password,
            panel: 'owner',
            portal: 'owner',
            role: 'owner',
          }),
        });

        const data = await res.json();

        // Case 1: Account Pending Approval (403)
        if (res.status === 403 && data.code === 'ACCOUNT_PENDING_APPROVAL') {
          setNotice({
            type: 'pending',
            message:
              'Your account activation is currently under process. Dine in One support will contact you once approved.',
          });
          return;
        }

        // Case 2: Email Not Verified (403)
        if (res.status === 403 && data.code === 'EMAIL_NOT_VERIFIED') {
          setNotice({
            type: 'unverified',
            message: 'Your email address has not been verified yet.',
            email: cleanId,
          });
          return;
        }

        // Case 3: Other errors
        if (!res.ok) {
          setNotice({
            type: 'error',
            message: data.error || 'Invalid email address or password.',
          });
          return;
        }

        // Case 4: Success
        if (data.token) {
          setDineToken(data.token, 'owner');
        }

        toast.success('Welcome back, Owner!');
        const targetUrl = searchParams.get('redirect') || data.redirectUrl || '/owner/dashboard';
        window.location.href = targetUrl;
      } catch (err: any) {
        setNotice({
          type: 'error',
          message: err.message || 'Connection error. Please try again.',
        });
      } finally {
        setLoading(false);
      }
    },
    [identifier, password, searchParams]
  );

  return (
    <div className="relative min-h-screen bg-[#FBF9F7] text-[#222125] flex flex-col justify-center items-center px-4 sm:px-6 py-12 font-sans selection:bg-[#C2412D]/15 selection:text-[#222125]">
      {/* Top Bar / Navigation Back to Home */}
      <div className="w-full max-w-[440px] mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5E5A60] hover:text-[#C2412D] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
        </Link>
        <span className="text-[11px] font-semibold tracking-wider uppercase text-[#8C8684] bg-[#F1ECE7] px-2.5 py-1 rounded-full">
          Owner Portal
        </span>
      </div>

      <div className="relative z-10 w-full max-w-[440px] mx-auto">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-block text-2xl sm:text-3xl font-extrabold tracking-tight text-[#222125]">
            Dine <span className="text-[#C2412D]">in</span> One
          </Link>
          <p className="text-xs text-[#5E5A60] font-medium mt-1">
            AI Restaurant Operating System
          </p>
        </div>

        {/* Card Container */}
        <div className="rounded-[24px] bg-[#FFFFFF] border border-[#EFE9E3] shadow-[0_20px_48px_-12px_rgba(34,33,37,0.08)] p-6 sm:p-8 relative overflow-hidden">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FFEDE8] text-[#B23A26] border border-[#FFD8CE] mb-2">
              <Sparkles className="w-3 h-3 text-[#C2412D]" />
              Owner Sign In
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#222125]">
              Welcome Back
            </h1>
            <p className="text-xs text-[#5E5A60] mt-1">
              Sign in to access your restaurant dashboard and live panels
            </p>
          </div>

          {/* Notices */}
          <AnimatePresence>
            {notice && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className={`p-3.5 mb-5 rounded-xl text-xs flex items-start gap-2.5 ${
                  notice.type === 'error'
                    ? 'bg-[#FFF0ED] border border-[#FFD5CD] text-[#B23A26]'
                    : notice.type === 'pending'
                    ? 'bg-amber-50 border border-amber-200 text-amber-800'
                    : notice.type === 'unverified'
                    ? 'bg-blue-50 border border-blue-200 text-blue-800'
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                }`}
              >
                {notice.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 text-[#C2412D] mt-0.5" />}
                {notice.type === 'pending' && <Clock className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />}
                {notice.type === 'unverified' && <Mail className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />}
                {notice.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />}
                <div className="flex-1">
                  <p className="leading-relaxed">{notice.message}</p>
                  {notice.type === 'unverified' && (
                    <Link
                      href={`/signup?verify=true&email=${encodeURIComponent(notice.email || '')}`}
                      className="inline-block mt-2 font-bold text-blue-700 underline"
                    >
                      Verify email now →
                    </Link>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email / Mobile */}
            <div>
              <label className="block text-xs font-semibold text-[#5E5A60] mb-1.5">
                Email Address or Mobile
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C8684]" />
                <input
                  type="text"
                  placeholder="owner@restaurant.com or 9876543210"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setNotice(null);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#FCFAF8] border border-[#E5DFD7] text-sm text-[#222125] placeholder:text-[#A59E99] focus:outline-none focus:border-[#C2412D] focus:ring-2 focus:ring-[#C2412D]/15 transition-all"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#5E5A60]">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-[#C2412D] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C8684]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setNotice(null);
                  }}
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-[#FCFAF8] border border-[#E5DFD7] text-sm text-[#222125] placeholder:text-[#A59E99] focus:outline-none focus:border-[#C2412D] focus:ring-2 focus:ring-[#C2412D]/15 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C8684] hover:text-[#222125] p-1 cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-full font-semibold text-sm text-white bg-[#222125] hover:bg-[#3D3A40] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shadow-[0_4px_14px_rgba(34,33,37,0.15)] mt-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                <>
                  Sign In to Dashboard
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer sign up link */}
          <div className="mt-6 text-center text-xs text-[#5E5A60]">
            Don't have an account yet?{' '}
            <Link
              href="/signup"
              className="font-bold text-[#C2412D] hover:underline ml-1"
            >
              Sign Up
            </Link>
          </div>
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

export default function MarketingLoginClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FBF9F7] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#C2412D]" />
        </div>
      }
    >
      <MarketingLoginInner />
    </Suspense>
  );
}
