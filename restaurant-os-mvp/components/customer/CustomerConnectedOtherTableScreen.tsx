'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
    UtensilsCrossed, ArrowRight, ArrowLeftRight, 
    AlertCircle, Loader2, CheckCircle2, ShieldCheck 
} from 'lucide-react';
import { toast } from 'sonner';

interface CustomerConnectedOtherTableScreenProps {
    restaurantCode: string;
    currentTableNumber: string;
    activeTableNumber: string;
    isHost?: boolean;
    customerMobile?: string;
    onSwitched?: () => void;
}

export function CustomerConnectedOtherTableScreen({
    restaurantCode,
    currentTableNumber,
    activeTableNumber,
    isHost = false,
    customerMobile,
    onSwitched,
}: CustomerConnectedOtherTableScreenProps) {
    const [switching, setSwitching] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleReturnToActiveTable = () => {
        window.location.href = `/${restaurantCode}/customer/home/${encodeURIComponent(activeTableNumber)}`;
    };

    const handleSwitchTable = async () => {
        setSwitching(true);
        setErrorMsg('');

        try {
            const mobile = customerMobile || (typeof window !== 'undefined' ? (
                localStorage.getItem(`ros_customer_mobile_${restaurantCode}`) || ''
            ) : '');

            const res = await fetch('/api/customer/table-session/leave', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurantId: restaurantCode,
                    customerMobile: mobile,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setErrorMsg(data.error || 'Cannot switch tables while active orders are pending.');
                setSwitching(false);
                return;
            }

            toast.success(`Switched to Table ${currentTableNumber}!`);
            if (onSwitched) {
                onSwitched();
            } else {
                window.location.href = `/${restaurantCode}/customer/home/${encodeURIComponent(currentTableNumber)}`;
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Network error while attempting to switch tables.');
            setSwitching(false);
        }
    };

    return (
        <div className="fixed inset-0 h-[100dvh] bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800 z-[200]">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 text-center flex flex-col items-center"
            >
                {/* Visual Icon Badge */}
                <div className="w-20 h-20 bg-amber-50 border border-amber-100 rounded-3xl flex items-center justify-center mb-5 shadow-lg shadow-amber-500/10">
                    <UtensilsCrossed className="text-amber-600" size={36} />
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-black uppercase tracking-wider mb-3">
                    <ShieldCheck size={14} />
                    <span>Table Session Active</span>
                </div>

                <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">
                    Already Seated at Table {activeTableNumber}
                </h2>

                <p className="text-slate-500 text-xs sm:text-sm mb-6 leading-relaxed max-w-xs">
                    You scanned <strong className="text-slate-800 font-bold">Table {currentTableNumber}</strong>, but your account is already connected to <strong className="text-slate-800 font-bold">Table {activeTableNumber}</strong>. Your cart and existing orders are safe.
                </p>

                {errorMsg && (
                    <div className="w-full mb-5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs text-left flex items-start gap-2">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <span className="flex-1 font-medium">{errorMsg}</span>
                    </div>
                )}

                <div className="flex flex-col gap-3 w-full">
                    {/* Primary Button: Return to Active Table */}
                    <button
                        type="button"
                        onClick={handleReturnToActiveTable}
                        className="w-full py-4 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black transition-all active:scale-[0.98] shadow-lg shadow-slate-900/20 text-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <span>Return to Table {activeTableNumber}</span>
                        <ArrowRight size={18} />
                    </button>

                    {/* Secondary Button: Switch to Current Table */}
                    <button
                        type="button"
                        disabled={switching}
                        onClick={handleSwitchTable}
                        className="w-full py-3.5 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                        {switching ? (
                            <Loader2 size={16} className="animate-spin text-slate-500" />
                        ) : (
                            <>
                                <ArrowLeftRight size={16} />
                                <span>Switch to Table {currentTableNumber}</span>
                            </>
                        )}
                    </button>
                </div>

                <p className="text-[11px] text-slate-400 mt-6 leading-tight">
                    Each diner can only belong to one active table at a time to prevent accidental duplicate orders.
                </p>
            </motion.div>
        </div>
    );
}
