'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Power, ShieldAlert, X } from 'lucide-react';
import { toast } from 'sonner';
import { useParams } from 'next/navigation';
import { useRestaurantId } from '@/hooks/useRestaurantId';
import { OrderService } from '@/services/orders.service';
import { haptic, springSoft } from './ui';

interface WaiterOverloadModalProps {
    waiterRecord?: any;
    onActivated?: () => void;
}

export default function WaiterOverloadModal({ waiterRecord, onActivated }: WaiterOverloadModalProps) {
    const { restaurantId } = useRestaurantId();
    const params = useParams();
    const targetRestaurantId = restaurantId || (params?.restaurantCode as string) || '';

    const [isOpen, setIsOpen] = useState(false);
    const [activating, setActivating] = useState(false);
    const [lastDismissedAt, setLastDismissedAt] = useState<number>(0);

    // Check overload status and subscribe to realtime overload events
    useEffect(() => {
        if (!targetRestaurantId) return;

        let active = true;

        const checkCurrentStatus = async () => {
            try {
                // Read current waiter status from session or record
                let isAccountActive = false;
                let isOnline = false;

                if (waiterRecord) {
                    const status = (waiterRecord.status || '').toLowerCase();
                    isAccountActive = status === 'active';
                    isOnline = Boolean(waiterRecord.is_online) && !['offline', 'break'].includes((waiterRecord.availability_status || '').toLowerCase());
                } else if (typeof window !== 'undefined') {
                    const cached = localStorage.getItem('waiterSession');
                    if (cached) {
                        const parsed = JSON.parse(cached);
                        const status = (parsed?.status || '').toLowerCase();
                        isAccountActive = status === 'active';
                        isOnline = Boolean(parsed?.is_online) && !['offline', 'break'].includes((parsed?.availability_status || '').toLowerCase());
                    }
                }

                // Modal should only appear if the waiter's account is Active but their availability is Offline
                if (!isAccountActive || isOnline) {
                    if (active) setIsOpen(false);
                    return;
                }

                // If offline and active, check if active online waiters are currently overloaded
                const now = Date.now();
                if (now - lastDismissedAt < 3 * 60 * 1000) {
                    // Snooze for 3 minutes if recently dismissed
                    return;
                }

                const result = await OrderService.checkWaitersOverloadStatus(targetRestaurantId);
                if (active && result.is_overloaded) {
                    setIsOpen(true);
                }
            } catch (err) {
                console.error('[WaiterOverloadModal] Error checking overload:', err);
            }
        };

        checkCurrentStatus();

        // Subscribe to realtime overload events
        const sub = OrderService.subscribeToWaitersOverloaded(targetRestaurantId, () => {
            if (!active) return;
            let isAccountActive = false;
            let isOnline = false;

            if (waiterRecord) {
                const status = (waiterRecord.status || '').toLowerCase();
                isAccountActive = status === 'active';
                isOnline = Boolean(waiterRecord.is_online) && !['offline', 'break'].includes((waiterRecord.availability_status || '').toLowerCase());
            } else if (typeof window !== 'undefined') {
                const cached = localStorage.getItem('waiterSession');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    const status = (parsed?.status || '').toLowerCase();
                    isAccountActive = status === 'active';
                    isOnline = Boolean(parsed?.is_online) && !['offline', 'break'].includes((parsed?.availability_status || '').toLowerCase());
                }
            }

            if (isAccountActive && !isOnline) {
                const now = Date.now();
                if (now - lastDismissedAt > 60 * 1000) {
                    setIsOpen(true);
                }
            }
        });

        const interval = setInterval(checkCurrentStatus, 45000);

        return () => {
            active = false;
            clearInterval(interval);
            sub.unsubscribe();
        };
    }, [targetRestaurantId, waiterRecord, lastDismissedAt]);

    const handleActivate = async () => {
        setActivating(true);
        haptic.selection();

        try {
            const cached = typeof window !== 'undefined' ? localStorage.getItem('waiterSession') : null;
            const session = cached ? JSON.parse(cached) : null;
            const staffId = waiterRecord?.id || session?.id;
            const mobile = waiterRecord?.mobile || session?.mobile;

            const res = await fetch('/api/waiter/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    isOnline: true,
                    waiterId: staffId,
                    mobile: mobile,
                    restaurantId: restaurantId
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to update online status');
            }

            // Update local session (ONLY updates is_online & availability_status, NEVER mutates status)
            if (typeof window !== 'undefined' && session) {
                session.is_online = true;
                session.availability_status = 'available';
                localStorage.setItem('waiterSession', JSON.stringify(session));
            }

            toast.success('You are now Online! Included in workload balancing.', {
                icon: '🚀'
            });
            haptic.success();
            setIsOpen(false);
            if (onActivated) {
                onActivated();
            }
        } catch (err: any) {
            console.error('Online activation error:', err);
            toast.error(err.message || 'Failed to update online status. Please try again.');
            haptic.heavy();
        } finally {
            setActivating(false);
        }
    };

    const handleRemainInactive = () => {
        haptic.light();
        setLastDismissedAt(Date.now());
        setIsOpen(false);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={handleRemainInactive}
                    />

                    {/* Dialog */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 15 }}
                        transition={springSoft}
                        className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border-2 border-amber-400 overflow-hidden"
                        style={{
                            boxShadow: '0 25px 50px -12px rgba(245, 158, 11, 0.25), 0 0 0 1px rgba(245, 158, 11, 0.1)'
                        }}
                    >
                        {/* Subtle decorative glow */}
                        <div className="absolute -top-16 -right-16 size-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />
                        
                        <div className="flex items-center justify-between mb-4">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-black tracking-wide border border-amber-200">
                                <AlertTriangle size={14} className="text-amber-600" />
                                HIGH SERVICE DEMAND
                            </span>
                            <button
                                onClick={handleRemainInactive}
                                className="size-8 rounded-full bg-neutral-100 text-neutral-400 hover:text-neutral-700 flex items-center justify-center transition-colors"
                                aria-label="Close"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="flex flex-col items-center text-center my-2">
                            <div className="size-16 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center mb-4 text-amber-600 shadow-inner">
                                <ShieldAlert size={34} />
                            </div>
                            <h3 className="text-lg font-black text-neutral-900 leading-snug">
                                Assistance Requested
                            </h3>
                            <p className="text-sm font-semibold text-neutral-700 mt-2.5 px-1 bg-amber-50/60 p-3 rounded-2xl border border-amber-100 leading-relaxed">
                                “All active online waiters are currently overloaded. Please go online if you are available to assist.”
                            </p>
                            <p className="text-xs text-neutral-600 mt-2 px-2">
                                Going online will immediately include you in workload balancing to receive incoming tables and orders.
                            </p>
                        </div>

                        <div className="flex flex-col gap-2.5 mt-5">
                            <button
                                onClick={handleActivate}
                                disabled={activating}
                                className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm shadow-lg shadow-emerald-600/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {activating ? (
                                    <span>Connecting...</span>
                                ) : (
                                    <>
                                        <Power size={17} />
                                        <span>Go Online & Assist</span>
                                    </>
                                )}
                            </button>
                            <button
                                onClick={handleRemainInactive}
                                disabled={activating}
                                className="w-full h-11 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs active:scale-[0.98] transition-all"
                            >
                                Remain Offline
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
