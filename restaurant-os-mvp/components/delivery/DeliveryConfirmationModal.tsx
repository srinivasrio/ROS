'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Banknote, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { DeliveryAssignment } from './DeliveryCard';

interface DeliveryConfirmationModalProps {
    assignment: DeliveryAssignment | null;
    onClose: () => void;
    onConfirm: (assignmentId: string, status: string, extra?: any) => Promise<void>;
}

export default function DeliveryConfirmationModal({
    assignment,
    onClose,
    onConfirm,
}: DeliveryConfirmationModalProps) {
    const [cashCollected, setCashCollected] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    if (!assignment) return null;

    const order = assignment.order;
    const orderNumber = order?.order_number || assignment.order_id?.slice(0, 6) || '—';
    const totalAmount = order?.total_amount || 0;

    const isCOD = (order?.paid_by || '').toLowerCase() === 'cash' || 
                  (order?.payment_status || '').toLowerCase() === 'pending' || 
                  (order?.payment_status || '').toLowerCase() === 'unpaid';

    const handleConfirm = async () => {
        if (isCOD && !cashCollected) {
            setError('Please confirm that you have collected the cash payment before completing delivery.');
            return;
        }

        setIsSubmitting(true);
        setError('');
        try {
            await onConfirm(assignment.id, 'DELIVERED', {
                cashCollected: isCOD ? true : undefined,
                amountCollected: isCOD ? totalAmount : undefined,
            });
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to complete delivery');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 50 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="w-full max-w-md bg-[#e8edf5] dark:bg-[#1a1e26] rounded-t-3xl sm:rounded-3xl shadow-[-8px_-8px_20px_rgba(255,255,255,0.95),8px_8px_20px_rgba(163,177,198,0.45)] dark:shadow-[-4px_-4px_16px_rgba(255,255,255,0.03),4px_4px_16px_rgba(0,0,0,0.7)] border border-white/60 dark:border-white/5 p-6 flex flex-col overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800">
                        <div className="flex items-center gap-2.5">
                            <div className="size-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                                <CheckCircle2 size={20} />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-900 dark:text-white">
                                    Confirm Delivery
                                </h3>
                                <p className="text-xs text-slate-400">Order #{orderNumber}</p>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="size-8 rounded-full bg-[#e2e8f2] dark:bg-[#13161c] text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="py-4 space-y-4">
                        {isCOD ? (
                            /* Cash on Delivery Required Checklist */
                            <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 space-y-3">
                                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                                    <Banknote size={20} className="text-amber-600 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-bold uppercase tracking-wider">Cash on Delivery Required</p>
                                        <p className="text-xl font-black text-amber-900 dark:text-amber-100">
                                            {formatCurrency(totalAmount)}
                                        </p>
                                    </div>
                                </div>

                                <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                                    This is a cash order. Collect exact amount in cash before handing over food items.
                                </p>

                                <label className="flex items-center gap-3 p-3 bg-[#e8edf5] dark:bg-[#1a1e26] rounded-xl border border-amber-400/50 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={cashCollected}
                                        onChange={(e) => {
                                             setCashCollected(e.target.checked);
                                            if (e.target.checked) setError('');
                                        }}
                                        className="size-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                                        I have collected {formatCurrency(totalAmount)} in cash
                                    </span>
                                </label>
                            </div>
                        ) : (
                            /* Prepaid Confirmation */
                            <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 flex items-start gap-3">
                                <ShieldCheck size={22} className="text-emerald-600 shrink-0 mt-0.5" />
                                <div className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
                                    <p className="font-black text-sm">Order is Prepaid</p>
                                    <p className="mt-0.5 opacity-90">
                                        Customer has already paid online. Do not request or collect any cash.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="p-3 bg-[#e2e8f2] dark:bg-[#13161c] shadow-[inset_2px_2px_4px_rgba(163,177,198,0.4)] rounded-xl text-xs text-slate-500 dark:text-slate-400">
                            Customer: <b className="text-slate-800 dark:text-slate-200">{order?.customer_name || 'Customer'}</b> • Deliver to: <b className="text-slate-800 dark:text-slate-200">{order?.delivery_address?.slice(0, 35)}...</b>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                                <AlertCircle size={14} className="shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2.5 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 px-4 rounded-xl bg-[#e2e8f2] dark:bg-[#13161c] text-slate-700 dark:text-slate-300 font-bold text-xs transition-all cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            disabled={isSubmitting || (isCOD && !cashCollected)}
                            onClick={handleConfirm}
                            className="flex-1 py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),3px_4px_12px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            <span>Complete Delivery</span>
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
