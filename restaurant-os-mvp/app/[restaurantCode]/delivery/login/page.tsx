'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, User, ShieldCheck, Truck } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { RestaurantService } from '@/services/restaurant.service';
import { setDineToken } from '@/lib/supabase';
import { showWarningPopup } from '@/components/shared/WarningPopupCard';
import { AuthBackground } from '@/components/auth/AuthBackground';
import { DineInOneWaveLogo } from '@/components/auth/DineInOneWaveLogo';

function DeliveryLoginInner() {
    const params = useParams();
    const searchParams = useSearchParams();
    const restaurantCode = (params.restaurantCode as string) || '';
    const router = useRouter();
    const [identifier, setIdentifier] = useState('');
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
        let succeeded = false;
        try {
            const res = await fetch('/api/auth/delivery/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mobile: cleanVal,
                    identifier: cleanVal,
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
            const deliveryBoyId = data.user?.deliveryBoyId || data.session?.deliveryBoyId || cleanVal;
            const targetRestaurant = data.user?.restaurant_id || restaurantCode;

            const sessionData = {
                id: data.user?.id,
                name: data.user?.name,
                role: 'delivery_boy',
                restaurantId: targetRestaurant,
                employeeId: data.user?.employee_id,
                mobile: cleanVal,
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
                            Delivery Sign In
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                            Enter your registered mobile number or employee ID to access your delivery console.
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                                Mobile number or employee ID
                            </label>
                            <div className="flex items-center rounded-2xl p-1.5 bg-slate-50 border border-slate-200 focus-within:border-sky-500 focus-within:bg-white transition-all">
                                <div className="pl-3 pr-2 text-slate-400">
                                    <User size={18} />
                                </div>
                                <input
                                    type="text"
                                    autoComplete="username"
                                    value={identifier}
                                    onChange={e => setIdentifier(e.target.value)}
                                    placeholder="e.g. 9876543210 or EMP001"
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
                            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white font-black text-sm shadow-lg shadow-sky-500/25 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
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
