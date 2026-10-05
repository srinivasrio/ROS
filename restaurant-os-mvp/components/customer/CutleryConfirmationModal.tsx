'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Utensils, Minus, Plus, BellRing, X } from 'lucide-react';
import { toast } from 'sonner';
import { OrderService } from '@/services/orders.service';
import { createClient } from '@/lib/supabase';

interface CutleryItem {
    id: 'spoon' | 'knife' | 'fork';
    label: string;
    subtitle: string;
    image: string;
}

const CUTLERY_ITEMS: CutleryItem[] = [
    {
        id: 'spoon',
        label: 'Spoon',
        subtitle: 'Dining & dessert spoon',
        image: '/services/spoon.webp',
    },
    {
        id: 'knife',
        label: 'Knife',
        subtitle: 'Table & butter knife',
        image: '/services/knife.webp',
    },
    {
        id: 'fork',
        label: 'Fork',
        subtitle: 'Dinner & salad fork',
        image: '/services/fork.webp',
    },
];

interface CutleryConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    restaurantId: string;
    tableNumber: string;
    tableId?: number | null;
    onSuccess?: () => void;
}

export function CutleryConfirmationModal({
    isOpen,
    onClose,
    restaurantId,
    tableNumber,
    tableId,
    onSuccess,
}: CutleryConfirmationModalProps) {
    const [counts, setCounts] = useState<Record<'spoon' | 'knife' | 'fork', number>>({
        spoon: 1,
        knife: 1,
        fork: 1,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset counts on open
    useEffect(() => {
        if (isOpen) {
            setCounts({
                spoon: 1,
                knife: 1,
                fork: 1,
            });
            setIsSubmitting(false);
        }
    }, [isOpen]);

    // Lock body scroll and handle Escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const totalCount = counts.spoon + counts.knife + counts.fork;

    const handleIncrement = (id: 'spoon' | 'knife' | 'fork') => {
        setCounts(prev => ({
            ...prev,
            [id]: Math.min(10, prev[id] + 1),
        }));
    };

    const handleDecrement = (id: 'spoon' | 'knife' | 'fork') => {
        setCounts(prev => ({
            ...prev,
            [id]: Math.max(0, prev[id] - 1),
        }));
    };

    const handleSubmit = async () => {
        if (totalCount === 0) {
            toast.error('Please select at least 1 cutlery item');
            return;
        }

        setIsSubmitting(true);
        try {
            // Build readable breakdown for staff and customer display
            const parts: string[] = [];
            if (counts.spoon > 0) parts.push(`${counts.spoon} Spoon${counts.spoon > 1 ? 's' : ''}`);
            if (counts.knife > 0) parts.push(`${counts.knife} Knife${counts.knife > 1 ? 's' : ''}`);
            if (counts.fork > 0) parts.push(`${counts.fork} Fork${counts.fork > 1 ? 's' : ''}`);
            const breakdownNote = parts.join(', ');

            let targetTable: any = tableId;
            let resolvedTableIdNum: number | null = typeof tableId === 'number' ? tableId : null;

            if (!targetTable) {
                const tableData = await OrderService.verifyTableExists(restaurantId, tableNumber);
                if (tableData) {
                    targetTable = tableData.id;
                    resolvedTableIdNum = tableData.id;
                } else {
                    targetTable = tableNumber;
                }
            }

            // Submit cutlery request with total count
            await OrderService.submitServiceRequest(
                targetTable,
                'cutlery_requested',
                restaurantId,
                totalCount
            );

            // Record the specific cutlery breakdown in notes so staff and customer can see exact items
            try {
                const supabase = createClient();
                let query = supabase
                    .from('service_requests')
                    .update({ notes: breakdownNote })
                    .eq('request_type', 'cutlery_requested')
                    .eq('request_status', 'pending');

                if (resolvedTableIdNum) {
                    query = query.eq('table_id', resolvedTableIdNum);
                }
                await query;
            } catch (noteErr) {
                console.warn('Cutlery note update deferred:', noteErr);
            }

            toast.success('Cutlery Requested!', {
                description: `Requested ${breakdownNote}. Waiter notified!`,
                duration: 3500,
            });

            onSuccess?.();
            onClose();
        } catch (error) {
            console.error('Failed to submit cutlery request:', error);
            toast.error('Failed to send request. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const formattedTable = tableNumber
        ? (tableNumber.toLowerCase().startsWith('table') ? tableNumber : `Table ${tableNumber}`)
        : '';

    return (
        <AnimatePresence>
            <div
                className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
                onClick={onClose}
                role="dialog"
                aria-modal="true"
            >
                <motion.div
                    initial={{ scale: 0.92, y: 16, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.92, y: 16, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                    className="w-full max-w-sm rounded-3xl p-5 sm:p-6 relative overflow-hidden"
                    style={{
                        backgroundColor: '#EEF2F6',
                        boxShadow: '12px 12px 28px rgba(166, 180, 200, 0.5), -12px -12px 28px rgba(255, 255, 255, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.85)',
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        style={{
                            boxShadow: '2px 2px 5px rgba(166, 180, 200, 0.4), -2px -2px 5px rgba(255, 255, 255, 0.9)',
                            border: '1px solid rgba(255, 255, 255, 0.8)',
                        }}
                        className="absolute top-4 right-4 size-8 rounded-full bg-[#EEF2F6] text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                    >
                        <X size={16} />
                    </button>

                    {/* Header */}
                    <div className="text-center mb-4">
                        <div
                            style={{
                                boxShadow: 'inset 1px 1px 3px rgba(166, 180, 200, 0.3), inset -1px -1px 3px rgba(255, 255, 255, 0.8)',
                                border: '1px solid rgba(255, 255, 255, 0.7)',
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#EEF2F6] text-orange-700 mb-2.5"
                        >
                            <Utensils size={13} className="text-orange-600" />
                            <span>Select Cutlery Pieces</span>
                        </div>

                        <h3 className="text-lg font-black text-slate-800 leading-tight mb-0.5">
                            How many pieces do you need?
                        </h3>
                        <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                            Customise exact spoons, knives & forks{formattedTable ? ` for ${formattedTable}` : ''}
                        </p>
                    </div>

                    {/* 3 Cutlery Items List */}
                    <div className="space-y-2.5 mb-4">
                        {CUTLERY_ITEMS.map((item) => {
                            const count = counts[item.id];
                            return (
                                <div
                                    key={item.id}
                                    style={{
                                        backgroundColor: '#EEF2F6',
                                        boxShadow: count > 0
                                            ? '4px 4px 10px rgba(166, 180, 200, 0.42), -4px -4px 10px rgba(255, 255, 255, 0.95)'
                                            : '2px 2px 6px rgba(166, 180, 200, 0.25), -2px -2px 6px rgba(255, 255, 255, 0.8)',
                                        border: count > 0 ? '1px solid rgba(255, 255, 255, 0.95)' : '1px solid rgba(255, 255, 255, 0.6)',
                                    }}
                                    className={`p-2.5 sm:p-3 rounded-2xl flex items-center justify-between transition-all duration-200 ${
                                        count === 0 ? 'opacity-80' : ''
                                    }`}
                                >
                                    {/* Left: Thumbnail & Details */}
                                    <div className="flex items-center gap-3">
                                        <div
                                            style={{
                                                backgroundColor: '#EEF2F6',
                                                boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                                border: '1px solid rgba(255, 255, 255, 0.8)',
                                            }}
                                            className="size-13 rounded-xl overflow-hidden p-1 flex items-center justify-center shrink-0"
                                        >
                                            <img
                                                src={item.image}
                                                alt={item.label}
                                                className="w-full h-full object-contain"
                                            />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black text-slate-800 leading-tight">
                                                {item.label}
                                            </h4>
                                            <p className="text-[11px] font-semibold text-slate-500">
                                                {item.subtitle}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Right: Quantity Stepper */}
                                    <div
                                        style={{
                                            backgroundColor: '#EEF2F6',
                                            boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.32), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                                            border: '1px solid rgba(255, 255, 255, 0.75)',
                                        }}
                                        className="flex items-center gap-2 p-1 rounded-xl shrink-0"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleDecrement(item.id)}
                                            disabled={count === 0}
                                            style={count > 0 ? {
                                                backgroundColor: '#EEF2F6',
                                                boxShadow: '2px 2px 5px rgba(166, 180, 200, 0.4), -2px -2px 5px rgba(255, 255, 255, 0.9)',
                                                border: '1px solid rgba(255, 255, 255, 0.85)',
                                            } : undefined}
                                            className={`size-8 rounded-lg flex items-center justify-center font-black transition-all ${
                                                count > 0
                                                    ? 'text-slate-700 active:scale-90 cursor-pointer'
                                                    : 'text-slate-300 opacity-40 cursor-not-allowed'
                                            }`}
                                            aria-label={`Decrease ${item.label}`}
                                        >
                                            <Minus size={14} strokeWidth={3} />
                                        </button>

                                        <span className="w-5 text-center font-black text-sm text-slate-800 tabular-nums">
                                            {count}
                                        </span>

                                        <button
                                            type="button"
                                            onClick={() => handleIncrement(item.id)}
                                            disabled={count >= 10}
                                            style={{
                                                boxShadow: '2px 2px 5px rgba(234, 88, 12, 0.35)',
                                            }}
                                            className="size-8 rounded-lg bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center font-black active:scale-90 transition-transform cursor-pointer disabled:opacity-40"
                                            aria-label={`Increase ${item.label}`}
                                        >
                                            <Plus size={14} strokeWidth={3} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Summary Well */}
                    <div
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.3), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.85)',
                            border: '1px solid rgba(255, 255, 255, 0.7)',
                        }}
                        className="p-2.5 rounded-xl mb-4 text-center"
                    >
                        {totalCount > 0 ? (
                            <p className="text-xs font-extrabold text-slate-700">
                                Total: <span className="text-orange-600 font-black">{totalCount} {totalCount === 1 ? 'piece' : 'pieces'}</span> ({[
                                    counts.spoon > 0 ? `${counts.spoon} Spoon${counts.spoon > 1 ? 's' : ''}` : null,
                                    counts.knife > 0 ? `${counts.knife} Knife${counts.knife > 1 ? 's' : ''}` : null,
                                    counts.fork > 0 ? `${counts.fork} Fork${counts.fork > 1 ? 's' : ''}` : null,
                                ].filter(Boolean).join(' • ')})
                            </p>
                        ) : (
                            <p className="text-xs font-bold text-rose-500">
                                Please select at least 1 cutlery piece
                            </p>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                backgroundColor: '#EEF2F6',
                                boxShadow: '3px 3px 6px rgba(166, 180, 200, 0.4), -3px -3px 6px rgba(255, 255, 255, 0.9)',
                                border: '1px solid rgba(255, 255, 255, 0.9)',
                            }}
                            className="flex-1 py-3 px-4 rounded-xl text-slate-700 font-bold text-xs sm:text-sm active:scale-95 transition-all cursor-pointer"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            disabled={isSubmitting || totalCount === 0}
                            onClick={handleSubmit}
                            style={{
                                boxShadow: totalCount > 0
                                    ? '4px 4px 10px rgba(234, 88, 12, 0.35), -2px -2px 6px rgba(255, 255, 255, 0.8)'
                                    : undefined,
                                border: '1px solid rgba(255, 255, 255, 0.4)',
                            }}
                            className="flex-[1.5] py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs sm:text-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Sending...</span>
                                </>
                            ) : (
                                <>
                                    <BellRing size={15} />
                                    <span>Request Cutlery</span>
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
