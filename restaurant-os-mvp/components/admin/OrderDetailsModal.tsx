'use client';

import { Order } from '@/services/orders.service';
import { formatCurrency, formatAddress } from '@/lib/utils';
import { X as LucideX, Printer as LucidePrinter, Clock as LucideClock, MapPin as LucideMapPin, Receipt as LucideReceipt, ChefHat as LucideChefHat, Utensils as LucideUtensils, Minimize2, Maximize2, ShoppingBag as LucideShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SharedComboCard from '@/components/shared/SharedComboCard';
import { isComboItem, parseComboSubItems } from '@/lib/combo-utils';

import { useRef, useState, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { InvoiceComponent } from '@/components/InvoiceComponent';

interface OrderDetailsModalProps {
    order: Order | null;
    onClose: () => void;
    deliveryBoys?: any[];
    onAssignDeliveryBoy?: (orderId: string, deliveryBoyId: string) => Promise<void>;
    onInitiateTakeawayHandover?: (order: Order) => void;
}

export default function OrderDetailsModal({ 
    order, 
    onClose,
    deliveryBoys = [],
    onAssignDeliveryBoy,
    onInitiateTakeawayHandover,
}: OrderDetailsModalProps) {
    const componentRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: componentRef,
    });

    const [isMinimized, setIsMinimized] = useState(false);

    useEffect(() => {
        setIsMinimized(false);
    }, [order?.id]);

    const ceil2 = (num: number) => {
        const n = Number(num || 0);
        const clean = Math.round(n * 1e8) / 1e8;
        return Math.ceil(clean * 100) / 100;
    };
    const round2 = ceil2;

    const itemsSubtotal = round2(
        (order?.items || []).reduce((sum, item) => sum + ((Number(item.price) || Number((item as any).price_at_time) || 0) * (Number(item.quantity) || 1)), 0)
    );
    const calculatedCgst = (order?.items || []).reduce((sum, item) => {
        const rate = (item as any).cgst_percent ?? (item as any).cgst_percentage ?? (((item as any).tax_percent ?? (item as any).gst_percentage ?? 5) / 2);
        return sum + ((Number(item.price) || Number((item as any).price_at_time) || 0) * (Number(item.quantity) || 1) * (rate / 100));
    }, 0);
    const calculatedSgst = (order?.items || []).reduce((sum, item) => {
        const rate = (item as any).sgst_percent ?? (item as any).sgst_percentage ?? (((item as any).tax_percent ?? (item as any).gst_percentage ?? 5) / 2);
        return sum + ((Number(item.price) || Number((item as any).price_at_time) || 0) * (Number(item.quantity) || 1) * (rate / 100));
    }, 0);
    const calculatedGst = calculatedCgst + calculatedSgst;

    const cgstAmount = (order?.cgst_amount != null && Number(order.cgst_amount) > 0)
        ? round2(Number(order.cgst_amount))
        : round2(calculatedCgst);
    const sgstAmount = (order?.sgst_amount != null && Number(order.sgst_amount) > 0)
        ? round2(Number(order.sgst_amount))
        : round2(calculatedSgst);
    const sumCgstSgst = round2(cgstAmount + sgstAmount);
    const gstAmount = sumCgstSgst > 0
        ? sumCgstSgst
        : (order?.gst_amount != null && Number(order.gst_amount) > 0
            ? round2(Number(order.gst_amount))
            : round2(calculatedGst));

    const deliveryFee = round2(Number((order as any)?.delivery_fee || 0));
    const discountAmount = round2(Number(order?.discount_amount || 0));

    const subtotal = itemsSubtotal > 0
        ? itemsSubtotal
        : round2(Math.max(0, (Number(order?.total_amount) || 0) - gstAmount - deliveryFee + discountAmount));

    const grandTotal = (order?.total_amount != null && Number(order.total_amount) > 0)
        ? round2(Number(order.total_amount))
        : round2(subtotal + gstAmount + deliveryFee - discountAmount);

    return (
        <>
            <AnimatePresence>
                {order && isMinimized && (
                    <motion.div
                        key="order-modal-docked-pill"
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="fixed bottom-6 right-6 z-[9990] bg-white dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-3.5 flex items-center gap-3.5 max-w-sm"
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="size-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm shrink-0">
                                {order.order_type === 'DELIVERY' ? '🛵' : order.order_type === 'TAKEAWAY' ? '🛍️' : '🍽️'}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                                        Order #{order.order_number}
                                    </span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600">
                                        {order.order_type}
                                    </span>
                                </div>
                                <p className="text-xs font-black text-emerald-600 mt-0.5">
                                    {formatCurrency(grandTotal)}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 ml-auto shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsMinimized(false)}
                                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-zinc-800 text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
                                title="Expand Order Card"
                            >
                                <Maximize2 size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-zinc-800 text-neutral-400 hover:text-red-500 transition-colors cursor-pointer"
                                title="Close"
                            >
                                <LucideX size={16} />
                            </button>
                        </div>
                    </motion.div>
                )}

                {order && !isMinimized && (
                    <div key="order-details-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
                                        <h2 className="text-xl font-bold text-black">Order #{order.order_number}</h2>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border ${order.status === 'paid' ? 'bg-green-100 text-green-700 border-green-200' :
                                            order.status === 'served' ? 'bg-gray-100 text-black border-gray-200' :
                                                order.status === 'ready' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                                    'bg-orange-100 text-orange-700 border-orange-200'
                                            }`}>
                                            {order.status === 'preparing' ? 'Cooking' : order.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-black flex items-center gap-4">
                                        <span className="flex items-center gap-1"><LucideClock size={14} /> {new Date(order.created_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                        <span className="flex items-center gap-1">
                                            <LucideMapPin size={14} /> 
                                            {order.order_type === 'DELIVERY' 
                                                ? (order.delivery_address ? `Delivery: ${formatAddress(order.delivery_address)}` : 'Delivery Order') 
                                                : order.order_type === 'TAKEAWAY'
                                                    ? `Takeaway (Self Pickup)${order.customer_phone || order.delivery_phone ? ` • 📞 ${order.customer_phone || order.delivery_phone}` : ''}`
                                                    : `Table ${order.table_number || order.table_id}`
                                            }
                                        </span>
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button 
                                        type="button"
                                        onClick={() => setIsMinimized(true)} 
                                        className="p-2 hover:bg-gray-200 rounded-full transition-colors text-black cursor-pointer"
                                        title="Minimize Order Card"
                                    >
                                        <Minimize2 size={18} />
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={onClose} 
                                        className="p-2 hover:bg-gray-200 rounded-full transition-colors text-black cursor-pointer"
                                        title="Close"
                                    >
                                        <LucideX size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="p-6 overflow-y-auto flex-1">
                                {order.order_type === 'TAKEAWAY' && (
                                    <div className="mb-4 p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="size-10 rounded-full bg-emerald-100 border border-emerald-200 shrink-0 flex items-center justify-center font-bold text-sm text-emerald-700 shadow-sm">
                                                🛍️
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Takeaway Pickup</p>
                                                <p className="text-sm font-bold text-neutral-900">{order.customer_phone || order.delivery_phone ? `Customer Contact: ${order.customer_phone || order.delivery_phone}` : 'Walk-in Pickup'}</p>
                                                {order.delivery_notes && (
                                                    <p className="text-xs text-neutral-600 mt-0.5">{order.delivery_notes}</p>
                                                )}
                                            </div>
                                        </div>
                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-600 text-white uppercase tracking-wider">
                                            Takeaway
                                        </span>
                                    </div>
                                )}

                                {order.order_type === 'DELIVERY' && order.delivery_assignment?.delivery_boy && (
                                    <div className="mb-4 p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="size-10 rounded-full bg-white border border-blue-200 overflow-hidden shrink-0 flex items-center justify-center font-bold text-sm text-neutral-700 shadow-sm">
                                                {order.delivery_assignment.delivery_boy.avatar_url ? (
                                                    <img src={order.delivery_assignment.delivery_boy.avatar_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    order.delivery_assignment.delivery_boy.name?.charAt(0)?.toUpperCase() || 'D'
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Assigned Delivery Partner</p>
                                                <p className="text-sm font-bold text-neutral-900">{order.delivery_assignment.delivery_boy.name}</p>
                                                <p className="text-xs text-neutral-500">
                                                    {order.delivery_assignment.delivery_boy.mobile} 
                                                    {order.delivery_assignment.delivery_boy.vehicle_number ? ` • ${order.delivery_assignment.delivery_boy.vehicle_number}` : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 self-end sm:self-auto">
                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-600 text-white uppercase tracking-wider">
                                                {order.delivery_assignment.status}
                                            </span>
                                            {['ASSIGNED', 'ACCEPTED'].includes(order.delivery_assignment.status) && deliveryBoys.length > 0 && onAssignDeliveryBoy && (
                                                <select
                                                    value={order.delivery_assignment.delivery_boy.id || ''}
                                                    onChange={(e) => onAssignDeliveryBoy(order.id, e.target.value)}
                                                    className="text-xs bg-white border border-blue-200 text-blue-900 rounded-lg px-2 py-1 cursor-pointer font-semibold"
                                                    title="Reassign to another delivery boy"
                                                >
                                                    {deliveryBoys.map(b => (
                                                        <option key={b.id} value={b.id} disabled={b.status === 'inactive'}>
                                                            Reassign: {b.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {order.order_type === 'DELIVERY' && !order.delivery_assignment?.delivery_boy && (
                                    <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="size-10 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-lg shadow-sm">
                                                🛵
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Delivery Partner</p>
                                                <p className="text-sm font-bold text-neutral-900">Unassigned</p>
                                                <p className="text-xs text-amber-700">Assign a delivery boy to dispatch this order</p>
                                            </div>
                                        </div>
                                        {deliveryBoys.length > 0 && onAssignDeliveryBoy ? (
                                            <select
                                                value=""
                                                onChange={(e) => onAssignDeliveryBoy(order.id, e.target.value)}
                                                className="text-xs bg-white border border-amber-300 font-bold text-amber-900 rounded-lg px-3 py-2 cursor-pointer shadow-xs focus:ring-2 focus:ring-amber-500/30"
                                            >
                                                <option value="" disabled>⚡ Assign Delivery Boy...</option>
                                                {deliveryBoys.map(b => (
                                                    <option key={b.id} value={b.id} disabled={b.status === 'inactive'}>
                                                        {b.name} {b.vehicle_number ? `(${b.vehicle_number})` : ''} • {b.status === 'active' ? 'Available' : b.status}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className="text-xs text-amber-700 font-medium">No delivery boys available</span>
                                        )}
                                    </div>
                                )}

                                <h3 className="text-sm font-bold text-black mb-4 flex items-center gap-2">
                                    <LucideUtensils size={16} className="text-orange-500" /> Order Items
                                </h3>

                                <div className="space-y-4">
                                    {order.items?.map((item, idx) => {
                                        const isCombo = isComboItem(item);
                                        const subItems = isCombo ? parseComboSubItems(item) : [];

                                        if (isCombo && subItems.length > 0) {
                                            return (
                                                <SharedComboCard
                                                    key={item.id || `combo-${idx}`}
                                                    name={item.name || (item as any).item_name}
                                                    image_url={item.combo_image || item.image_url}
                                                    price={item.price}
                                                    quantity={item.quantity}
                                                    items={subItems}
                                                    notes={item.notes}
                                                    readOnly={true}
                                                />
                                            );
                                        }
                                        return (
                                            <div key={item.id || `order-item-${idx}`} className="flex justify-between items-start py-2 border-b border-gray-50 last:border-0">
                                                <div className="flex gap-3">
                                                    <div className="bg-gray-100 text-black font-bold text-xs h-6 px-2 rounded flex items-center mt-0.5">
                                                        {item.quantity}x
                                                    </div>
                                                    <div>
                                                        <p className="text-black font-medium text-sm">{item.name || (item as any).item_name}</p>
                                                        {item.notes && (
                                                            <p className="text-orange-600 text-xs mt-0.5 italic flex items-center gap-1">
                                                                <LucideChefHat size={12} /> {item.notes}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-black font-bold text-sm block">
                                                        {formatCurrency(((Number(item.price) || Number((item as any).price_at_time) || 0)) * (item.quantity || 1))}
                                                    </span>
                                                    {item.quantity > 1 && (
                                                        <span className="text-[11px] text-neutral-400 font-medium">
                                                            {formatCurrency(Number(item.price) || Number((item as any).price_at_time) || 0)} each
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-6 border-t border-gray-100 bg-gray-50/30">
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-sm text-neutral-600 font-medium">Items Subtotal</span>
                                    <span className="text-sm font-bold text-black">{formatCurrency(subtotal)}</span>
                                </div>
                                {cgstAmount > 0 && (
                                    <div className="flex justify-between items-center text-xs text-neutral-500 mb-1">
                                        <span>CGST</span>
                                        <span className="font-semibold text-neutral-800">{formatCurrency(cgstAmount)}</span>
                                    </div>
                                )}
                                {sgstAmount > 0 && (
                                    <div className="flex justify-between items-center text-xs text-neutral-500 mb-1">
                                        <span>SGST</span>
                                        <span className="font-semibold text-neutral-800">{formatCurrency(sgstAmount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
                                    <span className="text-sm text-neutral-700 font-semibold">Total GST</span>
                                    <span className="text-sm font-bold text-black">{formatCurrency(gstAmount)}</span>
                                </div>
                                {deliveryFee > 0 && (
                                    <div className="flex justify-between items-center text-xs text-blue-700 mb-1.5 font-medium">
                                        <span className="flex items-center gap-1">🛵 Delivery Fee</span>
                                        <span className="font-bold">{formatCurrency(deliveryFee)}</span>
                                    </div>
                                )}
                                {discountAmount > 0 && (
                                    <div className="flex justify-between items-center text-xs text-emerald-700 mb-1.5 font-medium">
                                        <span>Discount {order.coupon_code ? `(${order.coupon_code})` : ''}</span>
                                        <span className="font-bold">-{formatCurrency(discountAmount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center mb-6 pt-1">
                                    <span className="text-base font-black text-black">Total Amount</span>
                                    <span className="text-2xl font-black text-black">{formatCurrency(grandTotal)}</span>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        disabled={order.status !== 'paid'}
                                        onClick={handlePrint}
                                        className={`flex-1 py-3 border font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 ${order.status === 'paid'
                                            ? 'bg-white border-gray-200 text-black hover:bg-gray-50'
                                            : 'bg-gray-100 border-gray-200 text-black cursor-not-allowed'
                                            }`}
                                    >
                                        <LucidePrinter size={18} />
                                        Print Bill
                                    </button>
                                    {order.order_type === 'TAKEAWAY' && (order.status === 'ready' || order.status === 'paid') && onInitiateTakeawayHandover ? (
                                        <button 
                                            type="button"
                                            onClick={() => onInitiateTakeawayHandover(order)}
                                            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <LucideShoppingBag size={18} />
                                            Hand Over
                                        </button>
                                    ) : (order.status !== 'paid' && order.status !== 'served' && (
                                        <button className="flex-1 py-3 bg-neutral-900 text-white font-bold rounded-xl hover:bg-neutral-800 transition-colors shadow-lg shadow-neutral-900/10 flex items-center justify-center gap-2">
                                            <LucideReceipt size={18} />
                                            Settle Bill
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            {order && (
                <div style={{ display: 'none' }}>
                    <InvoiceComponent ref={componentRef} order={order} />
                </div>
            )}
        </>
    );
}
