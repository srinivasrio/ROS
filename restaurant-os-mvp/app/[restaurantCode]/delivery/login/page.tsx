'use client';

import { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, User, ShieldCheck, Truck, KeyRound, Eye, EyeOff } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { RestaurantService } from '@/services/restaurant.service';
import { setDineToken } from '@/lib/supabase';
import { showWarningPopup } from '@/components/shared/WarningPopupCard';
import { AuthBackground } from '@/components/auth/AuthBackground';
import { DineInOneWaveLogo } from '@/components/auth/DineInOneWaveLogo';
import { toast } from 'sonner';

function DeliveryLoginInner() {
    const params = useParams();
    const searchParams = useSearchParams();
    const restaurantCode = (params.restaurantCode as string) || '';
    const router = useRouter();

    const [mobile, setMobile] = useState('');
    const [pin, setPin] = useState('');
    const [showPin, setShowPin] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [restaurantName, setRestaurantName] = useState('');

    const errorParam = searchParams.get('error');

    useEffect(() => {
        if (errorParam === 'session_expired') {
            setError('Your session has expired. Please sign in again.');
            showWarningPopup({
                title: 'Session Expired',
                message: 'Delivery session has expired. Please sign in again.',
                type: 'warning'
            });
        }
    }, [errorParam]);

    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (!restaurantCode) return;
        let active = true;
        RestaurantService.getRestaurantInfo(restaurantCode)
            .then(info => {
                if (!active || !isMountedRef.current) return;
                if (info?.name) setRestaurantName(info.name);
            })
            .catch(() => {});
        return () => { active = false; };
    }, [restaurantCode]);

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
        let succeeded = false;
        try {
            const res = await fetch('/api/auth/delivery/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mobile: cleanMobile,
                    identifier: cleanMobile,
                    pin: cleanPin,
                    restaurantCode: restaurantCode || undefined,
                })
            });

            const data = await res.json();
            if (!res.ok) {
                const errMsg = data.error || 'Authentication failed. Please check credentials.';
                if (isMountedRef.current) {
                    setError(errMsg);
                }
                showWarningPopup({
                    title: 'Authentication Failed',
                    message: errMsg,
                    type: 'error',
                    dismissText: 'Try Again'
                });
                return;
            }

            succeeded = true;
            toast.success('Delivery shift active! Opening fleet console...');

            const deliveryBoyId = data.user?.deliveryBoyId || data.session?.deliveryBoyId || cleanMobile;
            const targetRestaurant = data.user?.restaurant_id || restaurantCode;

            const sessionData = {
                id: data.user?.id,
                name: data.user?.name,
                role: 'delivery_boy',
                restaurantId: targetRestaurant,
                employeeId: data.user?.employee_id,
                mobile: cleanMobile,
                deliveryBoyId: deliveryBoyId,
            };
            localStorage.setItem('deliverySession', JSON.stringify(sessionData));

            if (data.token) {
                setDineToken(data.token, 'delivery');
            }

            const redirectParam = searchParams.get('redirect');
            const targetUrl = (redirectParam && redirectParam.startsWith('/'))
                ? redirectParam
                : (data.redirectUrl || `/${targetRestaurant}/delivery/${deliveryBoyId}/dashboard`);
            window.location.href = targetUrl;
        } catch (err: any) {
            const errMsg = err?.message || 'Connection failed. Please try again.';
            if (isMountedRef.current) {
                setError(errMsg);
            }
            showWarningPopup({
                title: 'Authentication Failed',
                message: errMsg,
                type: 'error',
                dismissText: 'Try Again'
            });
        } finally {
            if (!succeeded && isMountedRef.current) {
                setLoading(false);
            }
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
                    <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-slate-200/80 text-sky-800 text-xs font-black uppercase tracking-wider shadow-xs backdrop-blur-md">
                        <Truck size={12} className="text-sky-500" />
                        <span>{restaurantName || 'Restaurant'} Delivery Fleet</span>
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
                            Sign in with your registered mobile number and employee PIN to access your fleet console.
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        {/* Mobile Number */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
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
                                    onChange={(e) => {
                                        setMobile(e.target.value.replace(/[^0-9]/g, ''));
                                        setError('');
                                    }}
                                    autoComplete="tel"
                                    autoFocus
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 text-sm font-semibold focus:outline-none focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all font-mono"
                                />
                            </div>
                        </div>

                        {/* PIN */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                                Employee PIN (4-6 digits)
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                    <KeyRound size={18} />
                                </div>
                                <input
                                    id="delivery-pin-input"
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
                                    className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 text-base font-mono font-bold tracking-widest focus:outline-none focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all"
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
                            id="delivery-login-submit-btn"
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-600 hover:to-blue-700 text-white font-black text-sm shadow-lg shadow-sky-500/25 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
                        >
                            {loading ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <>
                                    <span>Access Delivery Console</span>
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
                        <ShieldCheck size={14} className="text-emerald-500" />
                        <span>Multi-Tenant Fleet Dispatch Active</span>
                    </div>
                </motion.div>
            </div>
        </AuthBackground>
    );
}


export default function DeliveryLoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-neutral-400" />
            </div>
        }>
            <DeliveryLoginInner />
        </Suspense>
    );
}
