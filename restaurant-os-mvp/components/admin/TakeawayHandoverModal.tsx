'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, 
    ShoppingBag, 
    CheckCircle2, 
    CreditCard, 
    QrCode, 
    Banknote, 
    ArrowRight, 
    Loader2, 
    ShieldCheck, 
    Phone, 
    Utensils, 
    AlertCircle,
    Receipt
} from 'lucide-react';
import { Order, OrderService } from '@/services/orders.service';
import { formatCurrency, ceil2 } from '@/lib/utils';
import { toast } from 'sonner';

type PaymentMethodType = 'Cash' | 'UPI' | 'Card';

interface TakeawayHandoverModalProps {
    order: Order | null;
    restaurantId: string;
    isOpen: boolean;
    onClose: () => void;
    onHandoverComplete: (orderId: string) => void;
    onPaymentSuccess?: (updatedOrder: Order) => void;
}

export default function TakeawayHandoverModal({
    order,
    restaurantId,
    isOpen,
    onClose,
    onHandoverComplete,
    onPaymentSuccess,
}: TakeawayHandoverModalProps) {
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('Cash');
    const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
    const [isHandingOver, setIsHandingOver] = useState(false);
    const [isPaidState, setIsPaidState] = useState(false);
    const [confirmedPaymentMethod, setConfirmedPaymentMethod] = useState<string | null>(null);

    // Calculate exact payable amount using ceiling logic
    const totalAmount = ceil2(Number(order?.total_amount || 0));
    const discountAmount = ceil2(Number(order?.discount_amount || 0));
    const payableAmount = ceil2(Math.max(0, totalAmount - discountAmount));

    // Synchronize initial payment state when modal opens or order changes
    useEffect(() => {
        if (order) {
            const alreadyPaid = !!order.paid_by || 
                order.status === 'paid' || 
                (order.amount_paid != null && Number(order.amount_paid) >= payableAmount && payableAmount > 0);
            
            setIsPaidState(alreadyPaid);
            if (alreadyPaid) {
                setConfirmedPaymentMethod(order.paid_by || 'Paid');
            } else {
                setConfirmedPaymentMethod(null);
                setSelectedMethod('Cash');
            }
        }
    }, [order?.id, order?.paid_by, order?.status, order?.amount_paid, payableAmount]);

    if (!isOpen || !order) return null;

    const orderNumberDisplay = order.order_number 
        ? `#${order.order_number}` 
        : `#${order.id.slice(0, 6).toUpperCase()}`;

    // Step 1: Confirm Payment Method
    const handleConfirmPayment = async () => {
        if (!restaurantId || !order?.id) return;
        setIsConfirmingPayment(true);
        try {
            const updated = await OrderService.confirmTakeawayPayment(
                order.id,
                restaurantId,
                selectedMethod,
                payableAmount
            );

            setIsPaidState(true);
            setConfirmedPaymentMethod(selectedMethod);
            toast.success(`Payment of ${formatCurrency(payableAmount)} confirmed via ${selectedMethod}!`);
            
            if (onPaymentSuccess && updated) {
                onPaymentSuccess(updated as any);
            }
        } catch (err: any) {
            console.error('[TakeawayHandoverModal] Payment confirmation error:', err);
            toast.error(err.message || 'Failed to record payment. Please try again.');
        } finally {
            setIsConfirmingPayment(false);
        }
    };

    // Step 2: Final Hand Over
    const handleCompleteHandover = async () => {
        if (!restaurantId || !order?.id) return;
        if (!isPaidState) {
            toast.error('Safety check: You must confirm payment before handing over the order.');
            return;
        }

        setIsHandingOver(true);
        try {
            await OrderService.completeTakeawayHandover(order.id, restaurantId);
            toast.success(`Order ${orderNumberDisplay} handed over to customer successfully!`);
            onHandoverComplete(order.id);
            onClose();
        } catch (err: any) {
            console.error('[TakeawayHandoverModal] Handover completion error:', err);
            toast.error(err.message || 'Failed to complete handover. Please try again.');
        } finally {
            setIsHandingOver(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={(!isConfirmingPayment && !isHandingOver) ? onClose : undefined}
                    className="absolute inset-0 bg-black/60 backdrop-blur-xs"
                />

                {/* Modal Container */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative overflow-hidden flex flex-col max-h-[92vh] border border-neutral-200"
                >
                    {/* Header */}
                    <div className="p-5 border-b border-neutral-100 flex justify-between items-center bg-gradient-to-r from-orange-50/60 to-amber-50/40">
                        <div className="flex items-center gap-3">
                            <div className="size-11 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
                                <ShoppingBag size={22} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-black text-neutral-900">Takeaway Handover</h2>
                                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
                                        {orderNumberDisplay}
                                    </span>
                                </div>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                    Confirm customer payment & complete pickup
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isConfirmingPayment || isHandingOver}
                            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer disabled:opacity-50"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Scrollable Body */}
                    <div className="p-6 overflow-y-auto space-y-5 flex-1">
                        {/* Customer & Bill Summary Card */}
                        <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/80 space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">
                                        Customer Details
                                    </span>
                                    <p className="text-sm font-bold text-neutral-900">
                                        {order.customer_name || 'Takeaway Customer'}
                                    </p>
                                    {(order.customer_phone || (order as any).delivery_phone) && (
                                        <a 
                                            href={`tel:${order.customer_phone || (order as any).delivery_phone}`}
                                            className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1 mt-0.5"
                                        >
                                            <Phone size={11} />
                                            <span>{order.customer_phone || (order as any).delivery_phone}</span>
                                        </a>
                                    )}
                                </div>

                                <div className="text-right">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">
                                        Final Amount
                                    </span>
                                    <p className="text-2xl font-black text-neutral-900 tracking-tight">
                                        {formatCurrency(payableAmount)}
                                    </p>
                                    {discountAmount > 0 && (
                                        <span className="text-[11px] font-semibold text-emerald-600 block">
                                            (-{formatCurrency(discountAmount)} coupon)
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Order Items Preview */}
                            <div className="pt-2.5 border-t border-neutral-200/60">
                                <span className="text-[11px] font-bold text-neutral-500 flex items-center gap-1 mb-1.5">
                                    <Utensils size={12} className="text-orange-500" />
                                    <span>Items ({order.items?.length || 0})</span>
                                </span>
                                <div className="max-h-24 overflow-y-auto space-y-1 pr-1 text-xs">
                                    {(order.items || []).map((it: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center text-neutral-700 py-0.5">
                                            <span className="truncate pr-2">
                                                <span className="font-bold text-neutral-900">{it.quantity}x</span> {it.name || it.item_name}
                                            </span>
                                            <span className="font-semibold shrink-0 text-neutral-900">
                                                {formatCurrency((Number(it.price) || Number(it.price_at_time) || 0) * (it.quantity || 1))}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Payment Confirmation Stage */}
                        {isPaidState ? (
                            /* ─── PAYMENT ALREADY CONFIRMED ─── */
                            <div className="rounded-2xl p-4.5 bg-emerald-50/80 border border-emerald-200 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
                                        <CheckCircle2 size={22} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-black text-emerald-900">
                                                Payment Confirmed
                                            </p>
                                            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-800">
                                                ✓ Paid
                                            </span>
                                        </div>
                                        <p className="text-xs text-emerald-700 mt-0.5">
                                            Received <span className="font-bold">{formatCurrency(payableAmount)}</span> via <span className="font-bold uppercase tracking-wide">{confirmedPaymentMethod || order.paid_by || 'Verified'}</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-xs text-emerald-800 bg-white/70 rounded-xl px-3 py-2 border border-emerald-100">
                                    <span className="flex items-center gap-1.5 font-medium">
                                        <ShieldCheck size={14} className="text-emerald-600" />
                                        <span>Order is verified and ready for customer handover</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setIsPaidState(false)}
                                        className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                                    >
                                        Change
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* ─── PAYMENT METHOD SELECTION REQUIRED ─── */
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5">
                                        <Receipt size={14} className="text-orange-500" />
                                        <span>Select Payment Method Received</span>
                                    </label>
                                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                        Required before handover
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2.5">
                                    {/* 1. Cash */}
                                    <button
                                        type="button"
                                        onClick={() => setSelectedMethod('Cash')}
                                        className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between h-24 ${
                                            selectedMethod === 'Cash'
                                                ? 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-500/20'
                                                : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className={`size-8 rounded-xl flex items-center justify-center ${
                                                selectedMethod === 'Cash' ? 'bg-emerald-600 text-white' : 'bg-neutral-100 text-neutral-600'
                                            }`}>
                                                <Banknote size={18} />
                                            </div>
                                            {selectedMethod === 'Cash' && (
                                                <div className="size-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">
                                                    ✓
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-black text-xs text-neutral-900">Cash</p>
                                            <p className="text-[10px] text-neutral-500 font-medium">Counter cash</p>
                                        </div>
                                    </button>

                                    {/* 2. UPI / QR */}
                                    <button
                                        type="button"
                                        onClick={() => setSelectedMethod('UPI')}
                                        className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between h-24 ${
                                            selectedMethod === 'UPI'
                                                ? 'border-blue-600 bg-blue-50/70 shadow-sm ring-2 ring-blue-500/20'
                                                : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className={`size-8 rounded-xl flex items-center justify-center ${
                                                selectedMethod === 'UPI' ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-600'
                                            }`}>
                                                <QrCode size={18} />
                                            </div>
                                            {selectedMethod === 'UPI' && (
                                                <div className="size-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">
                                                    ✓
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-black text-xs text-neutral-900">UPI / QR</p>
                                            <p className="text-[10px] text-neutral-500 font-medium">PhonePe, GPay</p>
                                        </div>
                                    </button>

                                    {/* 3. Card */}
                                    <button
                                        type="button"
                                        onClick={() => setSelectedMethod('Card')}
                                        className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between h-24 ${
                                            selectedMethod === 'Card'
                                                ? 'border-purple-600 bg-purple-50/70 shadow-sm ring-2 ring-purple-500/20'
                                                : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className={`size-8 rounded-xl flex items-center justify-center ${
                                                selectedMethod === 'Card' ? 'bg-purple-600 text-white' : 'bg-neutral-100 text-neutral-600'
                                            }`}>
                                                <CreditCard size={18} />
                                            </div>
                                            {selectedMethod === 'Card' && (
                                                <div className="size-4 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-black">
                                                    ✓
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-black text-xs text-neutral-900">Card</p>
                                            <p className="text-[10px] text-neutral-500 font-medium">Credit / Debit</p>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-5 border-t border-neutral-200 bg-neutral-50 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isConfirmingPayment || isHandingOver}
                            className="px-4 py-3 border border-neutral-300 hover:bg-neutral-100 text-neutral-700 font-bold rounded-2xl transition-all cursor-pointer disabled:opacity-50 text-sm"
                        >
                            Cancel
                        </button>

                        {!isPaidState ? (
                            /* Step 1 Button: Confirm Payment */
                            <button
                                type="button"
                                onClick={handleConfirmPayment}
                                disabled={isConfirmingPayment}
                                className="flex-1 py-3 px-5 bg-neutral-900 hover:bg-black text-white font-bold rounded-2xl transition-all shadow-lg shadow-neutral-900/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 text-sm active:scale-98"
                            >
                                {isConfirmingPayment ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        <span>Recording Payment...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={16} className="text-emerald-400" />
                                        <span>Confirm Payment ({formatCurrency(payableAmount)})</span>
                                        <ArrowRight size={14} className="ml-1 opacity-70" />
                                    </>
                                )}
                            </button>
                        ) : (
                            /* Step 2 Button: Final Hand Over */
                            <button
                                type="button"
                                onClick={handleCompleteHandover}
                                disabled={isHandingOver}
                                className="flex-1 py-3 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 text-sm active:scale-98"
                            >
                                {isHandingOver ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        <span>Completing Handover...</span>
                                    </>
                                ) : (
                                    <>
                                        <ShoppingBag size={18} />
                                        <span>Hand Over Order</span>
                                        <CheckCircle2 size={16} className="ml-1 opacity-90" />
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
