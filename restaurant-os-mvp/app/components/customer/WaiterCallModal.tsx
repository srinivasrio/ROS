'use client';

import { OrderService } from '@/app/services/orders';
import { LucideX, LucideGlassWater, LucideReceipt, LucideUtensils, LucideHandPlatter } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/app/lib/utils';

interface WaiterCallModalProps {
    isOpen: boolean;
    onClose: () => void;
    tableId: number;
}

export function WaiterCallModal({ isOpen, onClose, tableId }: WaiterCallModalProps) {
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleCall = async (type: 'call_waiter' | 'bill_requested' | 'water_requested' | 'cutlery_requested') => {
        setLoading(true);
        try {
            let statusToSend: any = type;
            if (type === 'water_requested' || type === 'cutlery_requested') {
                statusToSend = 'call_waiter';
            }

            await OrderService.setTableAlert(tableId, statusToSend);

            toast.success('Waiter notified!', {
                description: 'Someone will be with you shortly.',
                duration: 3000,
            });
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Failed to notify waiter');
        } finally {
            setLoading(false);
        }
    };

    const options = [
        {
            id: 'call_waiter',
            label: 'Call Waiter',
            sub: 'General Assistance',
            icon: LucideHandPlatter,
            bg: 'bg-orange-50 hover:bg-orange-100',
            text: 'text-orange-700',
            border: 'border-orange-100'
        },
        {
            id: 'bill_requested',
            label: 'Request Bill',
            sub: 'Ready to Pay',
            icon: LucideReceipt,
            bg: 'bg-neutral-50 hover:bg-neutral-100',
            text: 'text-neutral-900',
            border: 'border-neutral-200'
        },
        {
            id: 'water_requested',
            label: 'Water',
            sub: 'Refill Please',
            icon: LucideGlassWater,
            bg: 'bg-blue-50 hover:bg-blue-100',
            text: 'text-blue-700',
            border: 'border-blue-100'
        },
        {
            id: 'cutlery_requested',
            label: 'Cutlery',
            sub: 'Spoons, Forks...',
            icon: LucideUtensils,
            bg: 'bg-emerald-50 hover:bg-emerald-100',
            text: 'text-emerald-700',
            border: 'border-emerald-100'
        },
    ];

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-neutral-900/40 backdrop-blur-[2px] animate-in fade-in duration-200">
            {/* Backdrop Click to Close */}
            <div className="absolute inset-0" onClick={onClose} />

            <div className="relative bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
                <div className="px-6 py-5 border-b border-neutral-100 flex justify-between items-center bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                    <div>
                        <h3 className="text-xl font-black text-neutral-900 tracking-tight">Assistance</h3>
                        <p className="text-sm text-neutral-500 font-medium">How can we help you?</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 transition-colors"
                    >
                        <LucideX size={24} />
                    </button>
                </div>

                <div className="p-6 grid grid-cols-2 gap-4 bg-white/50">
                    {options.map((opt) => (
                        <button
                            key={opt.id}
                            disabled={loading}
                            onClick={() => handleCall(opt.id as any)}
                            className={cn(
                                "flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border transition-all duration-200 shadow-sm active:scale-[0.98]",
                                opt.bg,
                                opt.border
                            )}
                        >
                            <div className={cn(
                                "size-12 rounded-xl flex items-center justify-center bg-white shadow-sm mb-1",
                                opt.text
                            )}>
                                <opt.icon size={26} strokeWidth={2.5} />
                            </div>
                            <div className="text-center">
                                <span className={cn("block font-bold text-sm", opt.text)}>{opt.label}</span>
                                <span className="block text-[10px] uppercase font-bold tracking-wider text-neutral-400 mt-1">{opt.sub}</span>
                            </div>
                        </button>
                    ))}
                </div>

                <div className="p-6 pt-2 pb-8 bg-gradient-to-t from-white to-white/0">
                    <p className="text-center text-xs text-neutral-400 font-medium px-8 leading-relaxed">
                        Tap an option above to instantly notify our staff. We'll be right with you!
                    </p>
                </div>
            </div>
        </div>
    );
}
