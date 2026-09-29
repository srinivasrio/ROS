'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, AlertCircle, Loader2, Send } from 'lucide-react';
import { DeliveryAssignment } from './DeliveryCard';

interface ReportIssueModalProps {
    assignment: DeliveryAssignment | null;
    onClose: () => void;
    onSubmitIssue: (assignmentId: string, issueType: string, description: string) => Promise<void>;
}

const ISSUE_OPTIONS = [
    { id: 'customer_unreachable', label: 'Customer Unreachable / Not Answering Phone' },
    { id: 'wrong_address', label: 'Wrong / Incomplete Delivery Address' },
    { id: 'customer_cancelled', label: 'Customer Cancelled at Doorstep' },
    { id: 'payment_refused', label: 'Payment Dispute / Refused Cash on Delivery' },
    { id: 'damaged_order', label: 'Food Package Damaged / Container Spilled' },
    { id: 'vehicle_breakdown', label: 'Vehicle Breakdown / Road Emergency' },
    { id: 'other', label: 'Other Operational Issue' },
];

export default function ReportIssueModal({
    assignment,
    onClose,
    onSubmitIssue,
}: ReportIssueModalProps) {
    const [selectedIssue, setSelectedIssue] = useState<string>('customer_unreachable');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    if (!assignment) return null;

    const orderNumber = assignment.order?.order_number || assignment.order_id?.slice(0, 6) || '—';

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError('');
        try {
            const issueLabel = ISSUE_OPTIONS.find(o => o.id === selectedIssue)?.label || selectedIssue;
            await onSubmitIssue(assignment.id, issueLabel, description);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to submit issue report');
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
                            <div className="size-10 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center">
                                <AlertTriangle size={20} />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-900 dark:text-white">
                                    Report Delivery Issue
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

                    {/* Form */}
                    <div className="py-4 space-y-4">
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                                Select Primary Reason
                            </label>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {ISSUE_OPTIONS.map((opt) => (
                                    <label
                                        key={opt.id}
                                        className={`flex items-center gap-3 p-3 rounded-2xl border text-xs font-bold cursor-pointer transition-all ${
                                            selectedIssue === opt.id
                                                ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
                                                : 'bg-[#e8edf5] dark:bg-[#1f242e] shadow-[-2px_-2px_6px_rgba(255,255,255,0.9),2px_2px_6px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),2px_2px_6px_rgba(0,0,0,0.5)] border-transparent text-slate-700 dark:text-slate-300'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="delivery_issue"
                                            value={opt.id}
                                            checked={selectedIssue === opt.id}
                                            onChange={() => setSelectedIssue(opt.id)}
                                            className="text-red-600 focus:ring-red-500"
                                        />
                                        <span>{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                                Additional Notes for Manager / Dispatcher
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe what happened (e.g. called customer 3 times, arrived at building but gate was locked)..."
                                rows={3}
                                className="w-full p-3.5 rounded-2xl bg-[#e2e8f2] dark:bg-[#13161c] shadow-[inset_2px_2px_4px_rgba(163,177,198,0.45),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),inset_-2px_-2px_5px_rgba(255,255,255,0.02)] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
                            />
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
                            disabled={isSubmitting}
                            onClick={handleSubmit}
                            className="flex-1 py-3.5 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),3px_4px_12px_rgba(220,38,38,0.4)] flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
                            <span>Submit Report</span>
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
