'use client';

import { useState, useCallback, Suspense, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    KeyRound, Phone, Loader2, ArrowRight, BadgeCheck
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { setDineToken } from '@/lib/supabase';
import { DineInOneLogo } from '@/components/shared/DineInOneLogo';
import { showWarningPopup } from '@/components/shared/WarningPopupCard';

function EmployeeLoginInner() {
    const searchParams = useSearchParams();
    const [mobile, setMobile] = useState('');
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);

    const errorParam = searchParams.get('error');
    const errorMessages: Record<string, string> = {
        session_expired: 'Staff session expired. Please sign in again.',
        account_inactive: 'Your staff account is currently inactive. Contact your manager.',
        unauthorized_panel: 'You do not have access to that operational panel.'
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
            const res = await fetch('/api/auth/employee/login', {
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
            toast.success(`Welcome back, ${data.user?.name || 'Staff'}! Redirecting...`);
            const redirectParam = searchParams.get('redirect');
            const redirectUrl = (redirectParam && redirectParam.startsWith('/'))
                ? redirectParam
                : (data.redirectUrl || '/');
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
            {/* Ambient emerald glow */}
            <div className="absolute top-0 left-1/3 w-[450px] h-[450px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-md w-full relative z-10">
                {/* Brand Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-8"
                >
                    <DineInOneLogo size={64} className="mx-auto mb-4" />
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-2">
                            <BadgeCheck size={12} />
                            employee.dineinone.com
                        </div>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">
                        Staff & Employee Portal
                    </h1>
                    <p className="text-sm text-slate-500 mt-2">
                        Mobile number and PIN access for restaurant staff members.
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
                        {/* Mobile */}
                        <div>
                            <label
                                htmlFor="employee-mobile-input"
                                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2"
                            >
                                Registered Mobile Number
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
                                    +91
                                </div>
                                <input
                                    id="employee-mobile-input"
                                    type="tel"
                                    inputMode="numeric"
                                    pattern="[0-9]{10}"
                                    maxLength={10}
                                    required
                                    placeholder="9876543210"
                                    value={mobile}
                                    onChange={(e) => setMobile(e.target.value.replace(/[^0-9]/g, ''))}
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-base font-mono font-semibold focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                                />
                            </div>
                        </div>

                        {/* PIN */}
                        <div>
                            <label
                                htmlFor="employee-pin-input"
                                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2"
                            >
                                Employee PIN (4-6 digits)
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                    <KeyRound size={18} />
                                </div>
                                <input
                                    id="employee-pin-input"
                                    type="password"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    required
                                    placeholder="••••"
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-lg font-mono font-bold tracking-widest focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                                />
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium mt-1.5">
                                Automatically routes you to your authorized shift surface.
                            </p>
                        </div>

                        {/* Submit */}
                        <button
                            id="employee-login-submit-btn"
                            type="submit"
                            disabled={loading}
                            className="w-full min-h-[52px] py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 text-base transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    Authenticating staff...
                                </>
                            ) : (
                                <>
                                    Sign In to Shift
                                    <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                        <p className="text-xs text-slate-400 font-medium">
                            Staff operations management active.
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

export default function EmployeeLoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Loading employee portal...</div>}>
            <EmployeeLoginInner />
        </Suspense>
    );
}
