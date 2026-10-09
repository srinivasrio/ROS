'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Utensils, ArrowRight, Sparkles, HeartHandshake } from 'lucide-react';

interface CustomerDiningEndedScreenProps {
    restaurantCode: string;
    tableNumber: string;
    onAcknowledge?: () => void;
}

export function CustomerDiningEndedScreen({
    restaurantCode,
    tableNumber,
    onAcknowledge,
}: CustomerDiningEndedScreenProps) {
    const handleLeave = () => {
        try {
            if (typeof window !== 'undefined') {
                sessionStorage.setItem('ros_logged_out', 'true');
                localStorage.removeItem('customer_cart');
                localStorage.removeItem('customer_table_number');
                // Remove table token session if any
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    if (key && key.startsWith('ros_session_')) {
                        sessionStorage.removeItem(key);
                    }
                }
            }
        } catch {}

        if (onAcknowledge) {
            onAcknowledge();
        } else {
            window.location.href = `/${restaurantCode}/customer`;
        }
    };

    return (
        <div className="fixed inset-0 h-[100dvh] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 font-sans text-slate-800 z-[999] animate-in fade-in duration-300">
            <motion.div 
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-full max-w-md bg-white rounded-3xl p-7 sm:p-9 shadow-2xl border border-slate-100 text-center flex flex-col items-center relative overflow-hidden"
            >
                {/* Decorative background glow */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

                {/* Celebration Icon */}
                <div className="w-20 h-20 bg-emerald-50 border border-emerald-100 rounded-3xl flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/10 relative">
                    <CheckCircle2 className="text-emerald-600" size={40} />
                    <div className="absolute -top-1.5 -right-1.5 bg-amber-400 text-white p-1 rounded-full shadow-xs">
                        <Sparkles size={12} />
                    </div>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-black uppercase tracking-wider mb-3">
                    <HeartHandshake size={14} />
                    <span>Dining Completed</span>
                </div>

                <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">
                    Table {tableNumber} Cleared
                </h2>

                <p className="text-slate-600 text-sm mb-6 leading-relaxed max-w-xs">
                    Your dining session has concluded and the table has been cleared by restaurant staff. Thank you for dining with us!
                </p>

                <div className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 mb-6 text-left">
                    <div className="flex items-center gap-3">
                        <div className="size-9 rounded-xl bg-orange-100/70 text-orange-600 flex items-center justify-center shrink-0">
                            <Utensils size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800">Orders Processed</p>
                            <p className="text-[11px] text-slate-500 truncate">Your bill and table orders have been settled.</p>
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleLeave}
                    className="w-full py-4 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black transition-all active:scale-[0.98] shadow-lg shadow-slate-900/20 text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                    <span>Leave Table</span>
                    <ArrowRight size={18} />
                </button>

                <p className="text-[11px] text-slate-400 mt-5">
                    We look forward to serving you again soon!
                </p>
            </motion.div>
        </div>
    );
}
