'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ShieldCheck, UtensilsCrossed, Loader2, User } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { springSnap, haptic } from '../components/ui';
import { setDineToken } from '@/lib/supabase';
import { DineInOneLogo } from '@/components/shared/DineInOneLogo';
import { showWarningPopup } from '@/components/shared/WarningPopupCard';

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
            haptic.heavy();
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
                haptic.heavy();
                return;
            }
            haptic.success();
            const waiterMobile = data.session.mobile || cleanVal.replace(/[^0-9]/g, '').slice(-10) || 'default';
            const sessionData = {
                id: data.session?.userId || data.user?.id,
                name: data.session?.name || data.user?.name,
                role: data.session?.role || data.user?.role,
                restaurantId: data.session?.restaurantId || data.user?.restaurant_id,
                employeeId: data.session?.employeeId || data.user?.employee_id,
                mobile: data.session?.mobile || data.user?.mobile,
                status: data.user?.status || 'active',
                is_online: true
            };
            localStorage.setItem('waiterSession', JSON.stringify(sessionData));
            if (waiterMobile && waiterMobile !== 'default') {
                localStorage.setItem(`waiterSession_${waiterMobile}`, JSON.stringify(sessionData));
            }
            try {
                sessionStorage.setItem('waiterSession', JSON.stringify(sessionData));
            } catch (_) {}
            if (data.token) {
                setDineToken(data.token);
            }
            const redirectParam = searchParams.get('redirect');
            const targetRestaurant = data.session?.restaurantId || restaurantCode;
            const targetUrl = (redirectParam && redirectParam.startsWith('/'))
                ? redirectParam
                : `/${targetRestaurant}/waiter/${waiterMobile}/dashboard`;
            window.location.href = targetUrl;
        } catch (err: any) {
            const errMsg = err?.message || 'Connection failed. Please try again.';
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
        <div className="flex-1 h-full bg-w-canvas overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={springSnap}
                className="min-h-full flex flex-col justify-center px-6 py-12 max-w-sm w-full mx-auto"
            >
                {/* Logo tile */}
                <DineInOneLogo size={64} className="mb-6" />

                <h1 className="font-display text-2xl font-extrabold text-w-ink tracking-tight">Waiter Sign In</h1>
                <p className="text-sm text-w-ink-soft mt-2 leading-relaxed">
                    Enter your registered staff mobile number or employee ID to access your shift.
                </p>

                <form onSubmit={handleLogin} className="mt-8 space-y-4">
                    {/* Identifier input */}
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-w-ink-soft mb-2">
                            Staff mobile number or employee ID
                        </p>
                        <div className={`flex items-center bg-white rounded-[18px] border-[1.5px] shadow-[0_4px_10px_rgba(15,23,42,0.06)] transition-colors ${
                            error ? 'border-w-alert' : 'border-w-border focus-within:border-w-brand'
                        }`}>
                            <span className="flex items-center justify-center pl-4 pr-3 py-3.5 border-r-[1.5px] border-w-border text-w-ink-soft">
                                <User size={18} />
                            </span>
                            <input
                                value={identifier}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setIdentifier(val);
                                    setError('');
                                    const digits = val.replace(/[^0-9]/g, '').slice(-10);
                                    if (digits.length === 10) {
                                        router.prefetch(`/${restaurantCode}/waiter/${digits}/dashboard`);
                                    }
                                }}
                                autoComplete="username"
                                autoFocus
                                placeholder="e.g. 9876543210 or EMP-0001"
                                aria-label="Staff mobile number or employee ID"
                                className="flex-1 bg-transparent outline-none px-4 py-3.5 text-base font-bold text-w-ink placeholder:font-normal placeholder:text-w-muted"
                            />
                        </div>
                    </div>

                    <div className="min-h-6">
                        <AnimatePresence mode="wait">
                            {error && (
                                <motion.p
                                    key="err"
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="text-[13px] font-semibold text-w-alert pt-1"
                                >
                                    {error}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* CTA */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-[52px] rounded-[14px] bg-w-brand text-white text-sm font-extrabold shadow-[0_4px_12px_rgba(255,107,53,0.35)] active:scale-[0.97] transition-transform inline-flex items-center justify-center gap-2 disabled:opacity-70 mt-2 cursor-pointer"
                    >
                        {loading ? <Loader2 size={22} className="animate-spin" /> : (
                            <>
                                Enter Waiter Panel
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </form>

                {/* Info banner */}
                <div className="mt-8 bg-white rounded-2xl border border-w-border p-4 flex items-start gap-3">
                    <ShieldCheck size={20} className="text-w-brand shrink-0 mt-0.5" />
                    <p className="text-xs text-w-ink-soft leading-relaxed">
                        <strong className="font-bold text-w-ink">Instant Staff Access:</strong> Enter your mobile number or employee ID to sign in. No password required.
                    </p>
                </div>
            </motion.div>
        </div>
    );
}

export default function WaiterLogin() {
    return (
        <Suspense fallback={
            <div className="flex-1 h-full bg-w-canvas flex items-center justify-center">
                <Loader2 size={32} className="animate-spin text-w-brand" />
            </div>
        }>
            <WaiterLoginInner />
        </Suspense>
    );
}
