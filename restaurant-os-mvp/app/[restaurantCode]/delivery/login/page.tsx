'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { motion } from 'framer-motion';
import { Truck, ArrowRight, Loader2, User, ShieldCheck, Building2 } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { RestaurantService } from '@/services/restaurant.service';

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
                if (isMountedRef.current) {
                    setError(data.error || 'Sign-in failed. Please check your credentials.');
                    setLoading(false);
                }
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

            succeeded = true;
            const targetUrl = data.redirectUrl || `/${targetRestaurant}/delivery/${deliveryBoyId}/dashboard`;
            window.location.href = targetUrl;
        } catch (err) {
            console.error('Login error', err);
            if (isMountedRef.current) {
                setError('Connection failed. Please try again.');
            }
        } finally {
            if (!succeeded && isMountedRef.current) {
                setLoading(false);
            }
        }
    };

    return (
        <div className="min-h-screen flex flex-col justify-center bg-[#e8edf5] dark:bg-[#15181e] px-4 py-8">
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="max-w-sm w-full mx-auto p-8 rounded-3xl bg-[#e8edf5] dark:bg-[#1a1e26] shadow-[-8px_-8px_20px_rgba(255,255,255,0.95),8px_8px_20px_rgba(163,177,198,0.45)] dark:shadow-[-6px_-6px_16px_rgba(255,255,255,0.03),6px_6px_18px_rgba(0,0,0,0.65)] border border-white/60 dark:border-white/5"
            >
                {/* Logo & Restaurant Tile */}
                <div className="flex items-center gap-3.5 mb-6">
                    <div className="size-16 rounded-[22px] bg-[#e8edf5] dark:bg-[#1a1e26] shadow-[-4px_-4px_12px_rgba(255,255,255,0.9),4px_6px_16px_rgba(163,177,198,0.45)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.5)] p-1.5 flex items-center justify-center border border-white/60 dark:border-white/5 shrink-0 overflow-hidden">
                        {restaurantLogo ? (
                            <img src={restaurantLogo} alt={restaurantName || 'Restaurant'} className="w-full h-full rounded-2xl object-cover" />
                        ) : (
                            <div className="w-full h-full rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center">
                                <Truck size={28} className="text-white" />
                            </div>
                        )}
                    </div>
                    {restaurantName && (
                        <div className="min-w-0">
                            <h2 className="text-base font-black text-slate-800 dark:text-slate-100 truncate leading-tight">
                                {restaurantName}
                            </h2>
                            <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest mt-0.5">
                                Delivery Console
                            </p>
                        </div>
                    )}
                </div>

                <h1 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
                    Delivery Sign In
                </h1>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                    Enter your registered mobile number or employee ID to access your delivery console.
                </p>

                <form onSubmit={handleLogin} className="mt-8 space-y-5">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400 mb-2.5">
                            Mobile number or employee ID
                        </p>
                        <div className="relative">
                            <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                            <input
                                type="text"
                                inputMode="text"
                                autoComplete="username"
                                value={identifier}
                                onChange={e => setIdentifier(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                                placeholder="e.g. 9876543210 or EMP001"
                                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-[#e1e7f0] dark:bg-[#13161c] shadow-[inset_3px_3px_6px_rgba(163,177,198,0.45),inset_-3px_-3px_6px_rgba(255,255,255,0.9)] dark:shadow-[inset_3px_3px_6px_rgba(0,0,0,0.6),inset_-3px_-3px_6px_rgba(255,255,255,0.03)] border border-transparent focus:border-orange-400/60 dark:focus:border-orange-500/60 text-base font-semibold text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {error && (
                        <motion.p
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xs text-red-600 dark:text-red-400 font-semibold p-3 rounded-2xl bg-red-50/80 dark:bg-red-950/30 border border-red-200/80 dark:border-red-900/50 shadow-[inset_1px_1px_3px_rgba(239,68,68,0.15)]"
                        >
                            {error}
                        </motion.p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-rose-500 text-white font-extrabold text-sm shadow-[-4px_-4px_12px_rgba(255,255,255,0.8),5px_7px_18px_rgba(255,107,53,0.4)] dark:shadow-[0_6px_20px_rgba(255,107,53,0.35)] hover:shadow-[-2px_-2px_8px_rgba(255,255,255,0.9),4px_6px_22px_rgba(255,107,53,0.5)] active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.35)] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
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

                <div className="mt-8 flex items-center justify-center gap-2 text-xs text-neutral-400 dark:text-neutral-500 font-medium">
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
