'use client';

import { useState, useCallback, Suspense, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Flame, KeyRound, Phone, Loader2, ArrowRight, Monitor
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { setDineToken } from '@/lib/supabase';
import { DineInOneLogo } from '@/components/shared/DineInOneLogo';
import { showWarningPopup } from '@/components/shared/WarningPopupCard';

function KdsLoginInner() {
    const searchParams = useSearchParams();
    const [mobile, setMobile] = useState('');
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);

    const errorParam = searchParams.get('error');
    const errorMessages: Record<string, string> = {
        session_expired: 'Kitchen session expired. Please sign in again.',
        unauthorized_panel: 'Your role is not authorized for Kitchen Display System (KDS).',
        account_inactive: 'Your staff account is currently inactive. Contact your manager.'
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
            const res = await fetch('/api/auth/kds/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mobile: cleanMobile,
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

            if (data.token) {
                setDineToken(data.token);
            }

            toast.success('Kitchen access verified! Launching KDS...');
            const redirectParam = searchParams.get('redirect');
            const redirectUrl = (redirectParam && redirectParam.startsWith('/'))
                ? redirectParam
                : (data.redirectUrl || `/${data.user?.restaurant_id}/kds`);
            window.location.href = redirectUrl;

        } catch (err: any) {
            const errMsg = err?.message || 'Login failed. Please check your credentials.';
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
        <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
            {/* Ambient amber glow */}
            <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-orange-500/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-md w-full relative z-10">
                {/* Brand Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-8"
                >
                    <DineInOneLogo size={64} className="mx-auto mb-4" />
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold uppercase tracking-wider mb-2">
                            <Monitor size={12} />
                            kds.dineinone.com
                        </div>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">
                        Kitchen Display System
                    </h1>
                    <p className="text-sm text-slate-500 mt-2">
                        Staff sign in for live kitchen order stations and chefs.
                    </p>
                </motion.div>

                {/* Login Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white border border-slate-200/80 rounded-3xl p-8 shadow-xl shadow-slate-200/50"
                >
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Mobile Number */}
                        <div>
                            <label
                                htmlFor="kds-mobile-input"
                                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2"
                            >
                                Registered Mobile Number
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
                                    +91
                                </div>
                                <input
                                    id="kds-mobile-input"
                                    type="tel"
                                    inputMode="numeric"
                                    pattern="[0-9]{10}"
                                    maxLength={10}
                                    required
                                    placeholder="9876543210"
                                    value={mobile}
                                    onChange={(e) => setMobile(e.target.value.replace(/[^0-9]/g, ''))}
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-base font-mono font-semibold focus:outline-none focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all"
                                />
                            </div>
                        </div>

                        {/* PIN */}
                        <div>
                            <label
                                htmlFor="kds-pin-input"
                                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2"
                            >
                                Kitchen Employee PIN (4-6 digits)
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                    <KeyRound size={18} />
                                </div>
                                <input
                                    id="kds-pin-input"
                                    type="password"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    required
                                    placeholder="••••"
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-lg font-mono font-bold tracking-widest focus:outline-none focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all"
                                />
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium mt-1.5">
                                Validated for chef, kitchen, and supervisor staff accounts.
                            </p>
                        </div>

                        {/* Submit Button */}
                        <button
                            id="kds-login-submit-btn"
                            type="submit"
                            disabled={loading}
                            className="w-full min-h-[52px] py-3.5 px-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-extrabold rounded-xl shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 text-base transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    Verifying kitchen access...
                                </>
                            ) : (
                                <>
                                    Access Kitchen Display
                                    <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                        <p className="text-xs text-slate-400 font-medium">
                            Dedicated kitchen device access. Contact store manager for PIN assistance.
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

export default function KdsLoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Loading KDS portal...</div>}>
            <KdsLoginInner />
        </Suspense>
    );
}
