'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ShieldCheck, Loader2, User, UtensilsCrossed } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { setDineToken } from '@/lib/supabase';
import { showWarningPopup } from '@/components/shared/WarningPopupCard';
import { AuthBackground } from '@/components/auth/AuthBackground';
import { DineInOneWaveLogo } from '@/components/auth/DineInOneWaveLogo';

function WaiterLoginInner() {
    const params = useParams();
    const searchParams = useSearchParams();
    const restaurantCode = (params.restaurantCode as string) || '';
    const router = useRouter();
    const [identifier, setIdentifier] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const errorParam = searchParams.get('error');

    useEffect(() => {
        if (errorParam === 'session_expired') {
            setError('Your session has expired. Please sign in again.');
            showWarningPopup({
                title: 'Session Expired',
                message: 'Your shift session has expired. Please sign in again.',
                type: 'warning'
            });
        }
    }, [errorParam]);

    const handleLogin = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const cleanVal = identifier.trim();
        if (!cleanVal) {
            setError('Please enter your mobile number or employee ID');
            showWarningPopup({
                title: 'Missing Identifier',
                message: 'Please enter your mobile number or employee ID.',
                type: 'warning'
            });
            return;
        }

        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/waiter/mobile-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: cleanVal, mobile: cleanVal }),
            });
            const data = await res.json();
            if (!res.ok) {
                const errMsg = data.error || 'Sign-in failed. Please check your credentials.';
                setError(errMsg);
                showWarningPopup({
                    title: 'Authentication Failed',
                    message: errMsg,
                    type: 'error',
                    dismissText: 'Try Again'
                });
                return;
            }

            if (data.token) {
                setDineToken(data.token, 'waiter');
            }

            const mobileDigits = (data.user?.mobile || cleanVal).replace(/[^0-9]/g, '').slice(-10);
            const redirectUrl = `/${data.user?.restaurant_id || restaurantCode}/waiter/${mobileDigits}/dashboard`;
            window.location.href = redirectUrl;

        } catch (err: any) {
            const errMsg = err?.message || 'Login failed. Please check network connection.';
            setError(errMsg);
            showWarningPopup({
                title: 'Authentication Failed',
                message: errMsg,
                type: 'error',
                dismissText: 'Try Again'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthBackground className="min-h-screen py-10 px-4 flex flex-col justify-center items-center">
            <div className="max-w-md w-full relative z-10">
                {/* Dine In One Wave Animated Logo above card */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-6 flex flex-col items-center"
                >
                    <DineInOneWaveLogo size="lg" />
                    <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-slate-200/80 text-orange-700 text-xs font-black uppercase tracking-wider shadow-xs backdrop-blur-md">
                        <UtensilsCrossed size={12} className="text-orange-500" />
                        <span>Waiter Floor Staff</span>
                    </div>
                </motion.div>

                {/* Pure Crisp White Login Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white border border-slate-100 rounded-3xl p-7 sm:p-8 shadow-2xl relative overflow-hidden"
                >
                    <div className="mb-6">
                        <h2 className="text-2xl font-black tracking-tight text-slate-900">
                            Waiter Sign In
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                            Enter your registered staff mobile number or employee ID to access your shift.
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                                Staff mobile number or employee ID
                            </label>
                            <div className="flex items-center rounded-2xl p-1.5 bg-slate-50 border border-slate-200 focus-within:border-orange-500 focus-within:bg-white transition-all">
                                <div className="pl-3 pr-2 text-slate-400">
                                    <User size={18} />
                                </div>
                                <input
                                    value={identifier}
                                    onChange={(e) => {
                                        setIdentifier(e.target.value);
                                        setError('');
                                    }}
                                    autoComplete="username"
                                    autoFocus
                                    placeholder="e.g. 9876543210 or EMP-0001"
                                    className="w-full px-2 py-2.5 bg-transparent text-slate-900 text-sm font-semibold placeholder:text-slate-400 focus:outline-none"
                                />
                            </div>
                        </div>

                        {error && (
                            <p className="text-xs font-semibold text-rose-500 pt-1">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 text-white text-sm font-black shadow-lg shadow-orange-500/25 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 disabled:opacity-70 mt-2 cursor-pointer"
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : (
                                <>
                                    <span>Enter Waiter Panel</span>
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-5 border-t border-slate-100 flex items-start gap-2.5 text-xs text-slate-500">
                        <ShieldCheck size={16} className="text-orange-500 shrink-0 mt-0.5" />
                        <p className="leading-relaxed">
                            <strong className="font-bold text-slate-800">Instant Staff Access:</strong> Enter your registered mobile number or employee ID to sign in. No password required.
                        </p>
                    </div>
                </motion.div>
            </div>
        </AuthBackground>
    );
}

export default function WaiterLogin() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 size={32} className="animate-spin text-orange-500" />
            </div>
        }>
            <WaiterLoginInner />
        </Suspense>
    );
}
