'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Mail, Loader2, ArrowRight, ShieldCheck, User
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';
import Navbar from '@/components/landing/Navbar';
import { Suspense } from 'react';

function LoginPageInner() {
    const searchParams = useSearchParams();

    const [loading, setLoading] = useState(false);

    // Credential field
    const [identifier, setIdentifier] = useState(''); // email, mobile, or employee_id

    // Detect if identifier looks like an email
    const isEmail = identifier.includes('@');

    const [isSuperAdminPort, setIsSuperAdminPort] = useState(false);

    // Detect if running on port 3005 (Super Admin port)
    useEffect(() => {
        if (typeof window !== 'undefined' && (window.location.port === '3005' || window.location.host.includes(':3005'))) {
            setIsSuperAdminPort(true);
            setIdentifier('superadmin@dineinone.com');
        }
    }, []);


    const handleCredentialsSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!identifier.trim()) return;
        setLoading(true);

        try {
            const payload: Record<string, string> = {
                identifier: identifier.trim()
            };
            if (isEmail) {
                payload.email = identifier.toLowerCase().trim();
            } else {
                payload.employee_id = identifier.trim();
                payload.mobile = identifier.trim();
            }

            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Authentication failed');
            }

            toast.success('Login successful — redirecting...');

            // Server returns the correct dashboard URL based on role
            const redirectUrl = data.redirectUrl;
            if (redirectUrl) {
                window.location.href = redirectUrl;
            } else {
                window.location.href = '/';
            }

        } catch (error: any) {
            toast.error(error.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    }, [identifier, isEmail]);

    const errorParam = searchParams.get('error');
    const errorMessages: Record<string, string> = {
        restaurant_suspended: 'Your restaurant account has been suspended. Contact support.',
        session_expired: 'Your session has expired. Please log in again.',
        unauthorized: 'You do not have permission to access that page.',
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 pt-28 relative overflow-hidden">
            <Navbar />

            {/* Background ambient glows */}
            <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-[#FF6B6B]/8 rounded-full blur-[140px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-500/6 rounded-full blur-[140px] translate-x-1/4 translate-y-1/4 pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] bg-amber-500/5 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

            <div className="max-w-md w-full relative z-10">

                {/* Error banner */}
                {errorParam && errorMessages[errorParam] && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-2xl text-red-600 dark:text-red-400 text-sm font-medium text-center"
                    >
                        {errorMessages[errorParam]}
                    </motion.div>
                )}

                {/* Brand header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-8"
                >
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-[#FF6B6B] to-[#FF8E53] shadow-xl shadow-[#FF6B6B]/25 mb-5">
                        <ShieldCheck size={28} className="text-white" />
                    </div>
                    {isSuperAdminPort ? (
                        <>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold uppercase tracking-wider mb-2">
                                <ShieldCheck size={13} />
                                Super Admin Control Center (Port 3005)
                            </div>
                            <h1 className="text-3xl font-black tracking-tight text-foreground mb-1.5">
                                Super Admin <span className="bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] bg-clip-text text-transparent">Login</span>
                            </h1>
                            <p className="text-neutral-500 text-sm font-medium">
                                Pre-filled credentials ready. Click Sign In below.
                            </p>
                        </>
                    ) : (
                        <>
                            <h1 className="text-3xl font-black tracking-tight text-foreground mb-1.5">
                                Welcome to{' '}
                                <span className="bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] bg-clip-text text-transparent">
                                    Dine in One
                                </span>
                            </h1>
                            <p className="text-neutral-500 text-sm font-medium">
                                Sign in with your email, mobile number, or employee ID
                            </p>
                        </>
                    )}
                </motion.div>

                {/* Card */}
                <div className="bg-white/70 dark:bg-neutral-900/70 backdrop-blur-2xl border border-neutral-200/80 dark:border-white/8 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden">
                    {/* Subtle card glow */}
                    <div className="absolute top-0 right-0 w-40 h-40 bg-[#FF6B6B]/5 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/4 pointer-events-none" />



                    <AnimatePresence mode="wait">
                        <motion.form
                            key="credentials"
                            initial={{ opacity: 0, x: -24 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 24 }}
                            transition={{ duration: 0.25 }}
                            onSubmit={handleCredentialsSubmit}
                            className="space-y-5"
                        >
                            {/* Identifier field */}
                            <div className="space-y-1.5">
                                <label htmlFor="identifier" className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 ml-1">
                                    Email, Mobile Number, or Employee ID
                                </label>
                                <div className="relative group">
                                    {isEmail
                                        ? <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-[#FF6B6B] transition-colors duration-200" size={18} />
                                        : <User className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-[#FF6B6B] transition-colors duration-200" size={18} />
                                    }
                                    <input
                                        id="identifier"
                                        type="text"
                                        autoComplete="username"
                                        autoFocus
                                        required
                                        className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/8 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-[#FF6B6B]/30 focus:border-[#FF6B6B]/50 transition-all placeholder:text-neutral-400 text-sm font-medium"
                                        placeholder="you@restaurant.com, 9876543210, or EMP-0001"
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                id="login-continue-btn"
                                type="submit"
                                disabled={loading || !identifier.trim()}
                                className="w-full py-4 bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-full font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-[#FF6B6B]/20 text-white text-sm mt-2"
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    <>
                                        Sign In
                                        <ArrowRight size={18} />
                                    </>
                                )}
                            </button>

                            <p className="text-center text-sm text-neutral-400 pt-1">
                                New restaurant?{' '}
                                <Link href="/register" className="text-[#FF6B6B] font-semibold hover:underline">
                                    Register here
                                </Link>
                            </p>
                        </motion.form>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginPageInner />
        </Suspense>
    );
}
