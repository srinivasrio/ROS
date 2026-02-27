'use client';

import { Order } from '@/app/services/orders';
import { formatCurrency } from '@/app/lib/utils';
import { LucideX, LucidePrinter, LucideClock, LucideMapPin, LucideReceipt, LucideChefHat, LucideUtensils } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { InvoiceComponent } from '@/app/components/InvoiceComponent';

interface OrderDetailsModalProps {
    order: Order | null;
    onClose: () => void;
}

export default function OrderDetailsModal({ order, onClose }: OrderDetailsModalProps) {
    const componentRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: componentRef,
    });

    if (!order) return null;



    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white rounded-2xl shadow-xl w-full max-w-lg relative overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h2 className="text-xl font-bold text-neutral-900">Order #{order.order_number}</h2>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border ${order.status === 'paid' ? 'bg-green-100 text-green-700 border-green-200' :
                                    order.status === 'served' ? 'bg-gray-100 text-gray-700 border-gray-200' :
                                        order.status === 'ready' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                            'bg-orange-100 text-orange-700 border-orange-200'
                                    }`}>
                                    {order.status === 'preparing' ? 'Cooking' : order.status}
                                </span>
                            </div>
                            <p className="text-sm text-neutral-500 flex items-center gap-4">
                                <span className="flex items-center gap-1"><LucideClock size={14} /> {new Date(order.created_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                <span className="flex items-center gap-1"><LucideMapPin size={14} /> Table {order.table_id}</span>
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                            <LucideX size={20} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 overflow-y-auto flex-1">
                        <h3 className="text-sm font-bold text-neutral-900 mb-4 flex items-center gap-2">
                            <LucideUtensils size={16} className="text-orange-500" /> Order Items
                        </h3>

                        <div className="space-y-4">
                            {order.items?.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-start py-2 border-b border-gray-50 last:border-0">
                                    <div className="flex gap-3">
                                        <div className="bg-gray-100 text-neutral-600 font-bold text-xs h-6 px-2 rounded flex items-center mt-0.5">
                                            {item.quantity}x
                                        </div>
                                        <div>
                                            <p className="text-neutral-900 font-medium text-sm">{item.name}</p>
                                            {item.notes && (
                                                <p className="text-orange-600 text-xs mt-0.5 italic flex items-center gap-1">
                                                    <LucideChefHat size={12} /> {item.notes}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-neutral-900 font-bold text-sm">
                                        {formatCurrency(item.price * item.quantity)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-gray-100 bg-gray-50/30">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-neutral-500 font-medium">Subtotal</span>
                            <span className="text-sm font-bold text-neutral-900">{formatCurrency(order.total_amount)}</span>
                        </div>
                        <div className="flex justify-between items-center mb-4 border-b border-gray-200 pb-4">
                            <span className="text-sm text-neutral-500 font-medium">Tax (5%)</span>
                            <span className="text-sm font-bold text-neutral-900">{formatCurrency(order.total_amount * 0.05)}</span>
                        </div>
                        <div className="flex justify-between items-center mb-6">
                            <span className="text-neutral-900 font-bold">Total Amount</span>
                            <span className="text-2xl font-black text-neutral-900">{formatCurrency(order.total_amount * 1.05)}</span>
                        </div>

                        <div className="flex gap-3">
                            <button
                                disabled={order.status !== 'paid'}
                                className={`flex-1 py-3 border font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 ${order.status === 'paid'
                                    ? 'bg-white border-gray-200 text-neutral-700 hover:bg-gray-50'
                                    : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                <LucidePrinter size={18} />
                                Print Bill
                            </button>
                            {order.status !== 'paid' && order.status !== 'served' && (
                                <button className="flex-1 py-3 bg-neutral-900 text-white font-bold rounded-xl hover:bg-neutral-800 transition-colors shadow-lg shadow-neutral-900/10 flex items-center justify-center gap-2">
                                    <LucideReceipt size={18} />
                                    Settle Bill
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
            <div style={{ display: 'none' }}>
                <InvoiceComponent ref={componentRef} order={order} />
            </div>
        </AnimatePresence >
    );
}
