'use client';

import { LucideChefHat, LucideCheckCircle, LucideX } from 'lucide-react';

interface OrderReadyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPickup: () => void;
    tableId: number;
    items: { name: string; quantity: number; image_url?: string | null }[];
}

export default function OrderReadyModal({ isOpen, onClose, onPickup, tableId, items }: OrderReadyModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            {/* Card Container */}
            <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-300 relative flex flex-col">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 transition-colors z-10"
                >
                    <LucideX size={20} />
                </button>

                {/* Header Section with Icon */}
                <div className="pt-10 pb-6 flex flex-col items-center bg-gradient-to-b from-green-50 to-white">
                    <div className="size-20 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 mb-4 animate-bounce-short">
                        <LucideChefHat size={40} className="text-white" />
                    </div>
                    <h2 className="text-2xl font-black text-neutral-900 tracking-tight">Order Ready!</h2>
                    <p className="text-sm text-neutral-500 font-medium mt-1">Kitchen has completed your order</p>
                </div>

                {/* Content Section */}
                <div className="px-6 pb-8 flex flex-col items-center">

                    {/* Table Number Badge */}
                    <div className="flex flex-col items-center justify-center mb-6">
                        <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">Table</span>
                        <span className="text-5xl font-black text-neutral-900 leading-none">{tableId}</span>
                    </div>

                    {/* Items List (Scrollable if many) */}
                    <div className="w-full bg-neutral-50 rounded-xl p-4 mb-6 max-h-64 overflow-y-auto custom-scrollbar border border-neutral-100">
                        {items.length > 0 ? (
                            <div className="space-y-3">
                                {items.map((item, idx) => (
                                    <div key={idx} className="flex gap-3 items-center bg-white p-2 rounded-lg border border-gray-100 shadow-sm">

                                        <div className="size-10 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                                            {item.image_url ? (
                                                <img
                                                    src={item.image_url}
                                                    alt={item.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <LucideChefHat size={16} className="text-gray-400" />
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                                    {item.quantity}x
                                                </span>
                                                <span className="text-sm font-bold text-neutral-800 leading-tight truncate">
                                                    {item.name}
                                                </span>
                                            </div>
                                        </div>

                                        <LucideCheckCircle size={18} className="text-green-500 shrink-0" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-neutral-400 text-sm italic py-2">Full order details unavailable</p>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="w-full space-y-3">
                        <button
                            onClick={onPickup}
                            className="w-full py-4 bg-green-600 hover:bg-green-700 active:scale-95 text-white font-bold rounded-xl shadow-lg shadow-green-600/20 transition-all flex items-center justify-center gap-2 text-lg"
                        >
                            <span className="uppercase tracking-wide">Pickup Now</span>
                            <LucideCheckCircle size={20} className="text-green-200" />
                        </button>

                        <button
                            onClick={onClose}
                            className="w-full py-2 text-neutral-400 hover:text-neutral-600 font-medium text-xs uppercase tracking-widest transition-colors"
                        >
                            Dismiss
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
