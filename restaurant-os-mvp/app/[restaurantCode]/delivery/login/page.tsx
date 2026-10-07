'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, User, ShieldCheck, Building2 } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { RestaurantService } from '@/services/restaurant.service';
import { setDineToken } from '@/lib/supabase';
import { DineInOneLogo } from '@/components/shared/DineInOneLogo';
import { showWarningPopup } from '@/components/shared/WarningPopupCard';

function DeliveryLoginInner() {
    const params = useParams();
    const searchParams = useSearchParams();
    const restaurantCode = (params.restaurantCode as string) || '';
    const router = useRouter();
    const [identifier, setIdentifier] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [restaurantName, setRestaurantName] = useState('');
    const [restaurantLogo, setRestaurantLogo] = useState<string | null>(null);

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
                if (info?.logo_url) setRestaurantLogo(info.logo_url);
            })
            .catch(() => {});
        return () => { active = false; };
    }, [restaurantCode]);

    const handleLogin = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const cleanVal = identifier.trim();
        if (!cleanVal) {
            if (isMountedRef.current) setError('Please enter your mobile number or employee ID');
            showWarningPopup({
                title: 'Missing Identifier',
                message: 'Please enter your mobile number or employee ID.',
                type: 'warning'
            });
            return;
        }

        if (isMountedRef.current) {
            setLoading(true);
            setError('');
        }
        let succeeded = false;
        try {
            const res = await fetch('/api/auth/delivery/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: cleanVal, restaurantId: restaurantCode }),
            });
            const data = await res.json();
            if (!res.ok) {
                const errMsg = data.error || 'Sign-in failed. Please check your credentials.';
                if (isMountedRef.current) {
                    setError(errMsg);
                    setLoading(false);
                }
                showWarningPopup({
                    title: 'Authentication Failed',
                    message: errMsg,
                    type: 'error',
                    dismissText: 'Try Again'
                });
                return;
            }

            const deliveryBoyId = data.deliveryBoy?.id || data.session?.deliveryBoyId || 'default';
            const targetRestaurant = data.session?.restaurantId || restaurantCode;
            const sessionData = {
                id: data.session?.userId || data.user?.id,
                name: data.session?.name || data.user?.name,
                role: 'delivery_boy',
                restaurantId: targetRestaurant,
                employeeId: data.session?.employee_id || data.user?.employee_id,
                mobile: data.session?.mobile || data.user?.mobile,
                deliveryBoyId: deliveryBoyId,
            };

            localStorage.setItem('deliverySession', JSON.stringify(sessionData));
            try {
                sessionStorage.setItem('deliverySession', JSON.stringify(sessionData));
            } catch (_) {}

            if (data.token) {
                setDineToken(data.token);
            }

            succeeded = true;
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
        <div className="min-h-screen flex flex-col justify-center bg-slate-50 px-4 py-8">
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="max-w-sm w-full mx-auto p-8 rounded-3xl bg-white shadow-xl shadow-slate-200/50 border border-slate-200/80"
            >
                {/* Logo & Restaurant Tile */}
                <div className="flex items-center gap-3.5 mb-6">
                    <div className="size-16 rounded-[22px] bg-slate-50 shadow-xs p-1.5 flex items-center justify-center border border-slate-200 shrink-0 overflow-hidden">
                        {restaurantLogo ? (
                            <img src={restaurantLogo} alt={restaurantName || 'Restaurant'} className="w-full h-full rounded-2xl object-cover" />
                        ) : (
                            <DineInOneLogo size={52} className="w-full h-full !rounded-2xl" />
                        )}
                    </div>
                    {restaurantName && (
                        <div className="min-w-0">
                            <h2 className="text-base font-black text-slate-800 truncate leading-tight">
                                {restaurantName}
                            </h2>
                            <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mt-0.5">
                                Delivery Console
                            </p>
                        </div>
                    )}
                </div>

                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                    Delivery Sign In
                </h1>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Enter your registered mobile number or employee ID to access your delivery console.
                </p>

                <form onSubmit={handleLogin} className="mt-8 space-y-5">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-2.5">
                            Mobile number or employee ID
                        </p>
                        <div className="relative">
                            <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                inputMode="text"
                                autoComplete="username"
                                value={identifier}
                                onChange={e => setIdentifier(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                                placeholder="e.g. 9876543210 or EMP001"
                                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 text-base font-semibold text-slate-900 placeholder:text-slate-400 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {error && (
                        <motion.p
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xs text-red-600 font-semibold p-3 rounded-2xl bg-red-50 border border-red-200"
                        >
                            {error}
                        </motion.p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-rose-500 text-white font-extrabold text-sm shadow-lg shadow-orange-500/25 hover:from-orange-600 hover:to-rose-600 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                        {loading ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <>
                                <span>Access Console</span>
                                <ArrowRight size={16} />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    <span>Multi-Tenant Secured • Dine In One</span>
                </div>
            </motion.div>
        </div>
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
