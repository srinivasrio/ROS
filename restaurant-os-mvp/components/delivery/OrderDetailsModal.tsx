'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, MapPin, Navigation, Banknote, Clock, Receipt, User, ShieldCheck } from 'lucide-react';
import { formatCurrency, formatAddress } from '@/lib/utils';
import { DeliveryAssignment } from './DeliveryCard';

interface OrderDetailsModalProps {
    assignment: DeliveryAssignment | null;
    onClose: () => void;
}

export default function OrderDetailsModal({
    assignment,
    onClose,
}: OrderDetailsModalProps) {
    if (!assignment) return null;

    const order = assignment.order;
    const orderNumber = order?.order_number || assignment.order_id?.slice(0, 6) || '—';
    const customerName = order?.customer_name || 'Customer';
    const customerPhone = order?.delivery_phone || order?.customer_phone || '';
    const address = formatAddress(order?.delivery_address) || 'Address provided on invoice';
    const items = order?.items || [];
    const totalAmount = order?.total_amount || 0;
    const deliveryFee = order?.delivery_fee || 0;

    const isCOD = (order?.paid_by || '').toLowerCase() === 'cash' || 
                  (order?.payment_status || '').toLowerCase() === 'pending' || 
                  (order?.payment_status || '').toLowerCase() === 'unpaid';

    const handleOpenNavigation = () => {
        const query = order?.delivery_lat && order?.delivery_lng 
            ? `${order.delivery_lat},${order.delivery_lng}` 
            : encodeURIComponent(address);
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}`, '_blank');
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 100 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="w-full max-w-lg bg-[#e8edf5] dark:bg-[#1a1e26] rounded-t-3xl sm:rounded-3xl shadow-[-8px_-8px_20px_rgba(255,255,255,0.95),8px_8px_20px_rgba(163,177,198,0.45)] dark:shadow-[-4px_-4px_16px_rgba(255,255,255,0.03),4px_4px_16px_rgba(0,0,0,0.7)] border border-white/60 dark:border-white/5 max-h-[90vh] flex flex-col overflow-hidden"
                >
                    {/* Header */}
                    <div className="p-4 px-5 border-b border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="size-10 rounded-2xl bg-[#e2e8f2] dark:bg-[#13161c] text-orange-600 flex items-center justify-center">
                                <Receipt size={18} />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-900 dark:text-white">
                                    Order #{orderNumber}
                                </h3>
                                <p className="text-[11px] font-bold text-slate-400">Order Details & Breakdown</p>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="size-8 rounded-full bg-[#e2e8f2] dark:bg-[#13161c] text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="p-5 space-y-4 overflow-y-auto flex-1">
                        {/* Customer & Address Card */}
                        <div className="bg-[#e2e8f2] dark:bg-[#13161c] shadow-[inset_2px_2px_4px_rgba(163,177,198,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),inset_-2px_-2px_5px_rgba(255,255,255,0.02)] p-4 rounded-2xl space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="size-7 rounded-xl bg-[#e8edf5] dark:bg-[#1a1e26] flex items-center justify-center text-slate-600 dark:text-slate-300">
                                        <User size={14} />
                                    </div>
                                    <span className="text-sm font-black text-slate-900 dark:text-white">{customerName}</span>
                                </div>

                                {customerPhone && (
                                    <a
                                        href={`tel:${customerPhone}`}
                                        className="py-1.5 px-3 rounded-xl bg-[#e8edf5] dark:bg-[#1a1e26] shadow-[-2px_-2px_5px_rgba(255,255,255,0.9),2px_2px_5px_rgba(163,177,198,0.4)] text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1.5 active:scale-95"
                                    >
                                        <Phone size={12} />
                                        <span>{customerPhone}</span>
                                    </a>
                                )}
                            </div>

                            <div className="flex items-start gap-2 pt-1 text-xs text-slate-600 dark:text-slate-300">
                                <MapPin size={15} className="text-orange-500 shrink-0 mt-0.5" />
                                <span className="flex-1 leading-relaxed">{address}</span>
                            </div>

                            {order?.delivery_notes && (
                                <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
                                    <span className="font-bold">Instructions:</span> {order.delivery_notes}
                                </div>
                            )}

                            <button
                                onClick={handleOpenNavigation}
                                className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-98 transition-all"
                            >
                                <Navigation size={13} />
                                <span>Open Address in Google Maps</span>
                            </button>
                        </div>

                        {/* Order Items Breakdown */}
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">
                                Ordered Items ({items.length || '1'})
                            </h4>

                            <div className="bg-[#e8edf5] dark:bg-[#1a1e26] shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),2px_2px_8px_rgba(0,0,0,0.5)] rounded-2xl divide-y divide-slate-200/50 dark:divide-slate-800">
                                {items.length > 0 ? (
                                    items.map((item, idx) => (
                                        <div key={item.id || idx} className="p-3.5 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="size-6 rounded-lg bg-[#e2e8f2] dark:bg-[#13161c] font-bold text-xs flex items-center justify-center text-slate-700 dark:text-slate-300">
                                                    {item.quantity}x
                                                </span>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.name}</p>
                                                    {item.notes && (
                                                        <p className="text-[11px] text-slate-400 italic">{item.notes}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                {formatCurrency(item.price * item.quantity)}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-4 text-center text-xs text-slate-400">
                                        Package contains items as per kitchen ticket.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bill Summary */}
                        <div className="bg-[#e2e8f2] dark:bg-[#13161c] shadow-[inset_2px_2px_4px_rgba(163,177,198,0.4)] rounded-2xl p-4 space-y-2 text-xs">
                            <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                <span>Item Total</span>
                                <span className="font-bold">{formatCurrency(totalAmount - deliveryFee)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                <span>Delivery Fee</span>
                                <span className="font-bold">{formatCurrency(deliveryFee)}</span>
                            </div>
                            <div className="pt-2 border-t border-slate-300/40 dark:border-slate-800 flex justify-between font-black text-sm text-slate-900 dark:text-white">
                                <span>Bill Total</span>
                                <span className="text-orange-600 dark:text-orange-400">{formatCurrency(totalAmount)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-1 text-[11px]">
                                <span className="text-slate-400">Payment Status:</span>
                                <span className={`font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                    isCOD ? 'bg-amber-500/10 text-amber-700' : 'bg-emerald-500/10 text-emerald-700'
                                }`}>
                                    {isCOD ? 'Cash on Delivery' : 'Prepaid (Online)'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-200/60 dark:border-slate-800">
                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-[#e2e8f2] dark:bg-[#13161c] text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                        >
                            Close Details
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
