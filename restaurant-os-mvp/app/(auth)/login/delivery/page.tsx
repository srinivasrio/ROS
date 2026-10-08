'use client';

import { useState, useCallback, Suspense, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    KeyRound, Loader2, ArrowRight, Truck
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { setDineToken } from '@/lib/supabase';
import { showWarningPopup } from '@/components/shared/WarningPopupCard';
import { AuthBackground } from '@/components/auth/AuthBackground';
import { DineInOneWaveLogo } from '@/components/auth/DineInOneWaveLogo';

function DeliveryLoginInner() {
    const searchParams = useSearchParams();
    const [mobile, setMobile] = useState('');
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);

    const errorParam = searchParams.get('error');
    const errorMessages: Record<string, string> = {
        session_expired: 'Delivery session expired. Please sign in again.',
        unauthorized_panel: 'Only registered delivery staff are authorized for this fleet portal.',
        account_inactive: 'Your delivery account is currently inactive. Contact your manager.'
    };

    useEffect(() => {
        if (errorParam && errorMessages[errorParam]) {
            showWarningPopup({
                title: errorParam === 'session_expired' ? 'Session Expired' : 'Access Restricted',
                message: errorMessages[errorParam],
                type: 'warning',
                dismissText: 'Understand'
            });
        }
    }, [errorParam]);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanMobile = mobile.replace(/[^0-9]/g, '').slice(-10);
        const cleanPin = pin.trim();

        if (!cleanMobile || cleanMobile.length < 10) {
            showWarningPopup({
                title: 'Invalid Mobile Number',
                message: 'Please enter your 10-digit registered mobile number.',
                type: 'warning'
            });
            return;
        }

        if (!cleanPin || cleanPin.length < 4) {
            showWarningPopup({
                title: 'Invalid PIN',
                message: 'Please enter your employee PIN.',
                type: 'warning'
            });
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/delivery/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mobile: cleanMobile,
                    identifier: cleanMobile,
                    pin: cleanPin
                })
            });

            const data = await res.json();

            if (!res.ok) {
                const errMsg = data.error || 'Authentication failed. Please check your credentials.';
                showWarningPopup({
                    title: 'Authentication Failed',
                    message: errMsg,
                    type: 'error',
                    dismissText: 'Try Again'
                });
                return;
            }

            toast.success('Delivery shift active! Opening fleet console...');

            const deliveryBoyId = data.user?.deliveryBoyId || data.session?.deliveryBoyId || 'default';
            const sessionData = {
                id: data.user?.id,
                name: data.user?.name,
                role: 'delivery_boy',
                restaurantId: data.user?.restaurant_id,
                employeeId: data.user?.employee_id,
                mobile: cleanMobile,
                deliveryBoyId: deliveryBoyId,
            };
            localStorage.setItem('deliverySession', JSON.stringify(sessionData));

            if (data.token) {
                setDineToken(data.token, 'delivery');
            }

            const redirectParam = searchParams.get('redirect');
            const redirectUrl = (redirectParam && redirectParam.startsWith('/'))
                ? redirectParam
                : (data.redirectUrl || `/delivery/${deliveryBoyId}/dashboard`);
            window.location.href = redirectUrl;

        } catch (err: any) {
            const errMsg = err?.message || 'Login failed. Please check network connection.';
            showWarningPopup({
                title: 'Authentication Failed',
                message: errMsg,
                type: 'error',
                dismissText: 'Try Again'
            });
        } finally {
            setLoading(false);
        }
    }, [mobile, pin, searchParams]);

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
                    <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-slate-200/80 text-sky-800 text-xs font-black uppercase tracking-wider shadow-xs backdrop-blur-md">
                        <Truck size={12} className="text-sky-500" />
                        <span>Delivery Fleet Portal</span>
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
                            Delivery Partner Sign In
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                            Sign in with your registered mobile number and PIN to start receiving orders.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Mobile */}
                        <div>
                            <label
                                htmlFor="delivery-mobile-input"
                                className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
                            >
                                Registered Mobile Number
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
                                    +91
                                </div>
                                <input
                                    id="delivery-mobile-input"
                                    type="tel"
                                    inputMode="numeric"
                                    pattern="[0-9]{10}"
                                    maxLength={10}
                                    required
                                    placeholder="9876543210"
                                    value={mobile}
                                    onChange={(e) => setMobile(e.target.value.replace(/[^0-9]/g, ''))}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 text-sm font-semibold focus:outline-none focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all font-mono"
                                />
                            </div>
                        </div>

                        {/* PIN */}
                        <div>
                            <label
                                htmlFor="delivery-pin-input"
                                className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
                            >
                                Employee PIN (4-6 digits)
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                    <KeyRound size={18} />
                                </div>
                                <input
                                    id="delivery-pin-input"
                                    type="password"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    required
                                    placeholder="••••"
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 text-base font-mono font-bold tracking-widest focus:outline-none focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all"
                                />
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium mt-1">
                                Authorized fleet partner account.
                            </p>
                        </div>

                        {/* Submit */}
                        <button
                            id="delivery-login-submit-btn"
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-black rounded-2xl shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 text-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Connecting dispatch...
                                </>
                            ) : (
                                <>
                                    Start Delivery Shift
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                        <p className="text-xs text-slate-400 font-medium">
                            Delivery partner live dispatch active.
                        </p>
                    </div>
                </motion.div>
            </div>
        </AuthBackground>
    );
}

export default function DeliveryLoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Loading delivery portal...</div>}>
            <DeliveryLoginInner />
        </Suspense>
    );
}
