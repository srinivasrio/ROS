'use client';

import { ChefHat as LucideChefHat, CheckCircle as LucideCheckCircle, X as LucideX } from 'lucide-react';
import { isComboItem, parseComboSubItems } from '@/lib/combo-utils';
import { getCategoryMenuItemImage } from '@/lib/utils';

interface OrderReadyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPickup: () => void;
    tableId: number | string;
    items: { name: string; quantity: number; image_url?: string | null; combo_items?: any; item_type?: string }[];
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
                    className="absolute top-4 right-4 p-2 rounded-full bg-neutral-100 hover:bg-neutral-200 text-black transition-colors z-10"
                >
                    <LucideX size={20} />
                </button>

                {/* Header Section with Icon */}
                <div className="pt-10 pb-6 flex flex-col items-center bg-gradient-to-b from-green-50 to-white">
                    <div className="size-20 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 mb-4 animate-bounce-short">
                        <LucideChefHat size={40} className="text-white" />
                    </div>
                    <h2 className="text-2xl font-black text-black tracking-tight">Order Ready!</h2>
                    <p className="text-sm text-black font-medium mt-1">Kitchen has completed your order</p>
                </div>

                {/* Content Section */}
                <div className="px-6 pb-8 flex flex-col items-center">

                    {/* Table Number Badge */}
                    <div className="flex flex-col items-center justify-center mb-6">
                        <span className="text-xs font-bold text-black uppercase tracking-widest mb-1">Table</span>
                        <span className="text-5xl font-black text-black leading-none">{tableId}</span>
                    </div>

                    {/* Items List (Scrollable if many) */}
                    <div className="w-full bg-neutral-50 rounded-xl p-4 mb-6 max-h-64 overflow-y-auto custom-scrollbar border border-neutral-100">
                        {items.length > 0 ? (
                            <div className="space-y-3">
                                {items.map((item, idx) => {
                                    const isCombo = isComboItem(item);
                                    const subItems = isCombo ? parseComboSubItems(item) : [];
                                    const itemImg = item.image_url || getCategoryMenuItemImage(item.name);

                                    if (isCombo && subItems.length > 0) {
                                        return (
                                            <div key={idx} className="bg-white p-3 rounded-xl border border-orange-200/80 shadow-xs space-y-2.5">
                                                <div className="flex gap-3 items-center">
                                                    <div className="size-11 bg-gray-100 rounded-lg shrink-0 flex items-center justify-center overflow-hidden border border-gray-100">
                                                        <img
                                                            src={itemImg}
                                                            alt={item.name}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                const target = e.currentTarget;
                                                                const fallback = getCategoryMenuItemImage(item.name);
                                                                if (target.src !== fallback && !target.src.endsWith(fallback)) {
                                                                    target.src = fallback;
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                                                                COMBO
                                                            </span>
                                                            <span className="text-sm font-black text-black leading-tight truncate">
                                                                {item.name}
                                                            </span>
                                                            <span className="text-xs font-bold text-neutral-500">
                                                                ({item.quantity}x)
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <LucideCheckCircle size={18} className="text-green-500 shrink-0" />
                                                </div>

                                                {/* Sub items inside combo */}
                                                <div className="pt-2 border-t border-orange-100 space-y-1.5">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                                        Includes ({subItems.length} items):
                                                    </p>
                                                    <div className="space-y-1">
                                                        {subItems.map((sub, sIdx) => {
                                                            const subImg = sub.image_url || getCategoryMenuItemImage(sub.name);
                                                            return (
                                                                <div key={sIdx} className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <div className="size-7 rounded bg-white overflow-hidden shrink-0 border border-slate-200">
                                                                            <img
                                                                                src={subImg}
                                                                                alt={sub.name}
                                                                                className="w-full h-full object-cover"
                                                                                onError={(e) => {
                                                                                    const target = e.currentTarget;
                                                                                    const fallback = getCategoryMenuItemImage(sub.name);
                                                                                    if (target.src !== fallback && !target.src.endsWith(fallback)) {
                                                                                        target.src = fallback;
                                                                                    }
                                                                                }}
                                                                            />
                                                                        </div>
                                                                        <span className="text-xs font-bold text-slate-800 truncate">{sub.name}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                        {sub.price != null && Number(sub.price) > 0 && (
                                                                            <span className="text-[10.5px] font-bold text-slate-600">
                                                                                ₹{Number(sub.price).toFixed(2)}
                                                                            </span>
                                                                        )}
                                                                        <span className="text-[10px] font-black text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                                                            x{sub.quantity * item.quantity}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={idx} className="flex gap-3 items-center bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                                            <div className="size-10 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                                                {item.image_url ? (
                                                    <img
                                                        src={item.image_url}
                                                        alt={item.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <LucideChefHat size={16} className="text-black" />
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                                        {item.quantity}x
                                                    </span>
                                                    <span className="text-sm font-bold text-black leading-tight truncate">
                                                        {item.name}
                                                    </span>
                                                </div>
                                            </div>

                                            <LucideCheckCircle size={18} className="text-green-500 shrink-0" />
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-center text-black text-sm italic py-2">Full order details unavailable</p>
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
                            className="w-full py-2 text-black hover:text-black font-medium text-xs uppercase tracking-widest transition-colors"
                        >
                            Dismiss
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
