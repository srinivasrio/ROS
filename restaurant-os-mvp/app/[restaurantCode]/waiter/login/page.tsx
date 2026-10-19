'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ShieldCheck, Loader2, Phone, UtensilsCrossed, KeyRound, Eye, EyeOff } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { setDineToken } from '@/lib/supabase';
import { showWarningPopup } from '@/components/shared/WarningPopupCard';
import { AuthBackground } from '@/components/auth/AuthBackground';
import { DineInOneWaveLogo } from '@/components/auth/DineInOneWaveLogo';
import { toast } from 'sonner';

function WaiterLoginInner() {
    const params = useParams();
    const searchParams = useSearchParams();
    const restaurantCode = (params.restaurantCode as string) || '';
    const router = useRouter();

    const [mobile, setMobile] = useState('');
    const [pin, setPin] = useState('');
    const [showPin, setShowPin] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const errorParam = searchParams.get('error');

    useEffect(() => {
        if (errorParam === 'session_expired') {
            setError('Your shift session has expired. Please sign in again.');
            showWarningPopup({
                title: 'Session Expired',
                message: 'Your shift session has expired. Please sign in again.',
                type: 'warning'
            });
        }
    }, [errorParam]);

    const handleLogin = useCallback(async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const cleanMobile = mobile.replace(/[^0-9]/g, '').slice(-10);
        const cleanPin = pin.trim();

        if (!cleanMobile || cleanMobile.length < 10) {
            const msg = 'Please enter your 10-digit registered mobile number.';
            setError(msg);
            showWarningPopup({
                title: 'Invalid Mobile Number',
                message: msg,
                type: 'warning'
            });
            return;
        }

        if (!cleanPin || cleanPin.length < 4) {
            const msg = 'Please enter your 4 to 6 digit employee PIN.';
            setError(msg);
            showWarningPopup({
                title: 'Invalid PIN',
                message: msg,
                type: 'warning'
            });
            return;
        }

        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/waiter/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mobile: cleanMobile,
                    pin: cleanPin,
                    restaurantCode: restaurantCode || undefined
                }),
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

            toast.success('Shift verified! Entering floor...');

            const mobileDigits = (data.user?.mobile || cleanMobile).replace(/[^0-9]/g, '').slice(-10);
            const targetRestaurant = data.user?.restaurant_id || restaurantCode;

            // Persist waiter session to localStorage for floor state and notification sync
            const sessionData = {
                id: data.user?.id,
                name: data.user?.name,
                role: 'waiter',
                restaurantId: targetRestaurant,
                employeeId: data.user?.employee_id,
                mobile: mobileDigits,
                status: 'active',
                is_online: true
            };
            localStorage.setItem('waiterSession', JSON.stringify(sessionData));
            if (mobileDigits) {
                localStorage.setItem(`waiterSession_${mobileDigits}`, JSON.stringify(sessionData));
            }

            if (data.token) {
                setDineToken(data.token, 'waiter');
            }

            const redirectParam = searchParams.get('redirect');
            const redirectUrl = redirectParam || data.redirectUrl || `/${targetRestaurant}/waiter/${mobileDigits}/dashboard`;
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
    }, [mobile, pin, restaurantCode, searchParams]);

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
                            Enter your registered mobile number and employee PIN to begin your shift.
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        {/* Mobile Number */}
                        <div>
                            <label
                                htmlFor="waiter-mobile-input"
                                className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
                            >
                                Registered Mobile Number
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
                                    +91
                                </div>
                                <input
                                    id="waiter-mobile-input"
                                    type="tel"
                                    inputMode="numeric"
                                    pattern="[0-9]{10}"
                                    maxLength={10}
                                    required
                                    placeholder="9876543210"
                                    value={mobile}
                                    onChange={(e) => {
                                        setMobile(e.target.value.replace(/[^0-9]/g, ''));
                                        setError('');
                                    }}
                                    autoComplete="tel"
                                    autoFocus
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 text-sm font-semibold focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all font-mono"
                                />
                            </div>
                        </div>

                        {/* PIN */}
                        <div>
                            <label
                                htmlFor="waiter-pin-input"
                                className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
                            >
                                Employee PIN (4-6 digits)
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                    <KeyRound size={18} />
                                </div>
                                <input
                                    id="waiter-pin-input"
                                    type={showPin ? "text" : "password"}
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    required
                                    placeholder="••••"
                                    value={pin}
                                    onChange={(e) => {
                                        setPin(e.target.value.replace(/[^0-9]/g, ''));
                                        setError('');
                                    }}
                                    className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 text-base font-mono font-bold tracking-widest focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                                />
                                <button
                                    type="button"
                                    tabIndex={-1}
                                    onClick={() => setShowPin(!showPin)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                    {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium mt-1">
                                PIN set by your restaurant admin.
                            </p>
                        </div>

                        {error && (
                            <p className="text-xs font-semibold text-rose-500 pt-1">
                                {error}
                            </p>
                        )}

                        <button
                            id="waiter-login-submit-btn"
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black rounded-2xl shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 text-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                        >
                            {loading ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
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
                            <strong className="font-bold text-slate-800">Secure Staff Access:</strong> Enter your registered mobile number and employee PIN to sign in.
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
