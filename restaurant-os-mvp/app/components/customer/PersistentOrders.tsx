'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { OrderService, Order } from '@/app/services/orders';
import { 
    ChevronLeft as LucideChevronLeft, 
    FileText as LucideFileText, 
    Check as LucideCheck, 
    Clock as LucideClock, 
    ChefHat as LucideChefHat, 
    Utensils as LucideUtensils, 
    CheckCircle as LucideCheckCircle, 
    Printer as LucidePrinter,
    Ticket as LucideTicket,
    X as LucideX
} from 'lucide-react';
import { formatCurrency, getCategoryMenuItemImage } from '@/app/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useReactToPrint } from 'react-to-print';
import { InvoiceComponent } from '@/app/components/InvoiceComponent';
import { CustomerCache } from '@/app/services/homepage-cache.service';
import { OfferService } from '@/app/services/offers';
import { toast } from 'sonner';

// Timeline Component
const OrderTimeline = ({ status }: { status: string }) => {
    const steps = [
        { id: 'placed', icon: LucideClock, label: 'PLACED', color: 'bg-blue-500', shadow: 'shadow-blue-200', hex: '#3b82f6' },
        { id: 'preparing', icon: LucideChefHat, label: 'COOKING', color: 'bg-orange-500', shadow: 'shadow-orange-200', hex: '#f97316' },
        { id: 'ready', icon: LucideUtensils, label: 'READY', color: 'bg-green-500', shadow: 'shadow-green-200', hex: '#22c55e' },
        { id: 'served', icon: LucideCheck, label: 'SERVED', color: 'bg-neutral-900', shadow: 'shadow-neutral-200', hex: '#000000' },
    ];

    const currentStepIndex = steps.findIndex(s => s.id === status);
    const activeIndex = currentStepIndex === -1 ? (status === 'paid' ? 3 : 0) : currentStepIndex;

    return (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-100 mb-6 relative overflow-hidden">
            <div className="flex justify-between items-start relative z-10 px-2">
                {/* Progress Bar Background */}
                <div className="absolute top-5 left-0 w-full h-0.5 bg-neutral-100 -z-10" />

                {steps.map((step, index) => {
                    const isActive = index <= activeIndex;
                    const isCurrent = index === activeIndex;

                    return (
                        <div key={step.id} className="flex flex-col items-center bg-white px-1">
                            <motion.div
                                initial={false}
                                animate={{
                                    scale: isCurrent ? 1.1 : 1,
                                    backgroundColor: isActive ? step.hex : '#f5f5f5',
                                    borderColor: isActive ? step.hex : '#ffffff'
                                }}
                                className={`size-10 rounded-full flex items-center justify-center transition-all duration-500 border-4 ${isActive ? `text-white` : 'text-black shadow-none'
                                    }`}
                            >
                                <step.icon size={16} strokeWidth={isActive ? 3 : 2.5} />
                            </motion.div>
                            <span className={`text-[9px] font-black uppercase mt-2 tracking-widest transition-colors duration-300 ${isActive ? 'text-black' : 'text-black'
                                }`}>
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            <div className="mt-6 bg-neutral-50 rounded-xl p-3 text-center border border-neutral-100">
                <AnimatePresence mode="wait">
                    <motion.p
                        key={status}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="text-xs font-bold text-black"
                    >
                        {status === 'placed' && "Waiting for kitchen confirmation..."}
                        {status === 'preparing' && "Chefs are preparing your delicious food..."}
                        {status === 'ready' && "Your order is ready to be served!"}
                        {status === 'served' && "Enjoy your meal!"}
                        {status === 'paid' && "Thank you for dining with us!"}
                    </motion.p>
                </AnimatePresence>
            </div>
        </div>
    );
};

// Bill Confirmation Modal
const BillConfirmationModal = ({ isOpen, onClose, onConfirm }: { isOpen: boolean; onClose: () => void; onConfirm: () => void }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-in fade-in"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed left-4 right-4 bottom-32 md:left-1/2 md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:max-w-sm bg-white rounded-3xl p-6 shadow-2xl z-50 flex flex-col gap-4 text-center pointer-events-auto"
                    >
                        <div className="size-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-black">
                            <LucideFileText size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-black">Request Bill?</h3>
                            <p className="text-sm text-black mt-1">
                                Are you ready to settle your bill? A waiter will come to your table shortly.
                            </p>
                        </div>
                        <div className="flex gap-3 mt-2">
                            <button
                                onClick={onClose}
                                className="flex-1 py-3 bg-neutral-100 text-black font-bold rounded-xl active:scale-95 transition-transform text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={onConfirm}
                                className="flex-1 py-3 bg-neutral-900 text-white font-bold rounded-xl active:scale-95 transition-transform text-sm"
                            >
                                Confirm
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export function PersistentOrders({ restaurantId, tableNumber }: { restaurantId: string, tableNumber: string }) {
    const pathname = usePathname();
    const router = useRouter();
    const isVisible = pathname.includes('/customer/myorders/');
    
    const cachedData = CustomerCache.get(restaurantId, 'orders', tableNumber);
    const [order, setOrder] = useState<Order | null>(cachedData?.order || null);
    const [loading, setLoading] = useState(!cachedData);
    const [showBillConfirmation, setShowBillConfirmation] = useState(false);
    const [expandedCombos, setExpandedCombos] = useState<{ [itemId: string]: boolean }>({});
    const [couponInput, setCouponInput] = useState('');
    const [couponLoading, setCouponLoading] = useState(false);

    const componentRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({ contentRef: componentRef });

    const scrollPos = useRef(0);
    const isFirstRun = useRef(true);

    const fetchOrder = useCallback(async () => {
        try {
            const activeOrder = await OrderService.getActiveOrderForTable(tableNumber, restaurantId);
            setOrder(activeOrder);
            CustomerCache.set(restaurantId, 'orders', { order: activeOrder }, tableNumber);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [tableNumber, restaurantId]);

    const handleApplyCoupon = async () => {
        if (!couponInput.trim() || !order) return;
        setCouponLoading(true);
        try {
            const offer = await OfferService.validateCoupon(couponInput.trim(), restaurantId);
            if (!offer) {
                toast.error('Invalid or expired coupon code');
                setCouponLoading(false);
                return;
            }

            // Calculate discount based on order's original total
            let discountAmount = 0;
            if (offer.discount_type === 'percentage') {
                discountAmount = Math.round((order.total_amount || 0) * (offer.discount_value / 100));
                if (offer.max_discount && discountAmount > offer.max_discount) {
                    discountAmount = offer.max_discount;
                }
            } else {
                discountAmount = Math.min(offer.discount_value, order.total_amount || 0);
            }

            await OrderService.updateOrderCoupon(order.id, restaurantId, offer.code, discountAmount);
            await OfferService.incrementUsage(offer.id, restaurantId);
            toast.success(`Coupon ${offer.code} applied successfully!`);
            setCouponInput('');
            await fetchOrder();
        } catch (error) {
            console.error('Failed to apply coupon', error);
            toast.error('Failed to apply coupon. Please try again.');
        } finally {
            setCouponLoading(false);
        }
    };

    const handleRemoveCoupon = async () => {
        if (!order) return;
        try {
            await OrderService.updateOrderCoupon(order.id, restaurantId, '', 0);
            toast.success('Coupon removed');
            await fetchOrder();
        } catch (error) {
            console.error('Failed to remove coupon', error);
            toast.error('Failed to remove coupon');
        }
    };

    useEffect(() => {
        if (isFirstRun.current) {
            fetchOrder();
            isFirstRun.current = false;
        }

        const sub = OrderService.subscribeToOrders(restaurantId, (payload) => {
            if (payload.new && (payload.new as any).table_id === tableNumber) fetchOrder();
        });
        const subItems = OrderService.subscribeToOrderItems(restaurantId, () => fetchOrder());
        return () => { sub.unsubscribe(); subItems.unsubscribe(); };
    }, [fetchOrder, restaurantId, tableNumber]);

    useEffect(() => {
        if (isVisible) {
            window.scrollTo(0, scrollPos.current);
            const handleScroll = () => { scrollPos.current = window.scrollY; };
            window.addEventListener('scroll', handleScroll);
            return () => window.removeEventListener('scroll', handleScroll);
        }
    }, [isVisible]);

    // Handle "Request Bill"
    const handleRequestBill = () => {
        setShowBillConfirmation(true);
    };

    const confirmBillRequest = async () => {
        try {
            await OrderService.setTableAlert(tableNumber, 'bill_requested', restaurantId);
            setShowBillConfirmation(false);
            toast.success("Bill requested successfully! A waiter will assist you shortly.");
        } catch (e) {
            console.error(e);
            toast.error("Failed to request bill.");
        }
    };

    if (!order && isVisible && !loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-8 text-center">
                <div className="size-20 bg-gray-200 rounded-full flex items-center justify-center mb-6 text-black">
                    <LucideCheckCircle size={32} />
                </div>
                <h2 className="text-xl font-black text-black mb-2">No Active Order</h2>
                <p className="text-black mb-8 font-medium">Scan QR or browse menu to start.</p>
                <button onClick={() => router.push(`/${restaurantId}/customer/menu/${tableNumber}`)} className="bg-neutral-900 text-white px-8 py-3 rounded-xl font-bold">View Menu</button>
            </div>
        );
    }

    return (
        <div style={{ display: isVisible ? 'flex' : 'none' }} className="min-h-screen bg-gray-50 flex flex-col w-full pb-32">
            {/* Header */}
            <header className="bg-white p-4 sticky top-0 z-20 flex items-center justify-between border-b border-neutral-100 shadow-sm pt-safe-top">
                <button
                    onClick={() => router.push(`/${restaurantId}/customer/menu/${tableNumber}`)}
                    className="flex items-center text-black font-bold text-sm"
                >
                    <LucideChevronLeft size={20} className="-ml-1 mr-1" />
                    Menu
                </button>
                {order && (
                    <div className="text-right">
                        <p className="text-xs font-black text-black uppercase tracking-widest">ORDER #{order.id.slice(0, 6)}</p>
                        <p className="text-[10px] text-black font-bold">
                            {order?.table_number ? (order.table_number.toLowerCase().includes('table') ? order.table_number : `Table ${order.table_number}`) : `Table ${tableNumber}`}
                        </p>
                    </div>
                )}
            </header>

            <div className="flex-1 p-4 overflow-y-auto no-scrollbar">
                {order && (
                    <>
                        {/* Timeline */}
                        <OrderTimeline status={order.status} />

                        {/* Items List */}
                        <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 p-6">
                            <h2 className="text-sm font-bold text-black mb-6">Items Ordered</h2>

                            <div className="space-y-6">
                                {order.items?.map((item) => (
                                    <div key={item.id} className="flex flex-col gap-4 py-4 border-b border-neutral-100 last:border-0">
                                        <div className="flex items-center gap-4">
                                            {/* Left: Image */}
                                            <div className="size-16 bg-neutral-50 rounded-xl overflow-hidden flex-shrink-0 border border-neutral-100 relative">
                                                <img
                                                    src={item.image_url || getCategoryMenuItemImage(item.name)}
                                                    alt={item.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>

                                            {/* Middle: Name and Status */}
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-[13px] font-black text-black leading-tight uppercase tracking-tight truncate">{item.name}</h3>
                                                
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <span className="text-[11px] font-black text-black bg-neutral-100 px-2 py-0.5 rounded uppercase">QTY: {item.quantity}</span>
                                                    <span className="text-[10px] text-black font-bold opacity-60">₹{item.price} each</span>
                                                </div>

                                                {/* Item Status Tag */}
                                                <p className={`text-[9px] font-black uppercase mt-1.5 tracking-widest ${
                                                    item.status === 'placed' ? 'text-blue-600' :
                                                    item.status === 'preparing' ? 'text-orange-600' :
                                                    item.status === 'ready' ? 'text-green-600' :
                                                    'text-black'
                                                }`}>
                                                    {item.status || 'PLACED'}
                                                </p>
                                            </div>

                                            {/* Right: Total Price */}
                                            <div className="text-right flex-shrink-0">
                                                <span className="text-sm font-black text-black">{formatCurrency(item.price * item.quantity)}</span>
                                            </div>
                                        </div>

                                        {/* Combo Details Toggle Section */}
                                        {item.item_type === 'combo' && (
                                            <div className="ml-20 -mt-2">
                                                <div className="flex items-center justify-between bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                                                    <p className="text-[10px] font-bold text-black line-clamp-1 flex-1 mr-2 opacity-70 italic">
                                                        {Array.isArray(item.combo_items) 
                                                            ? item.combo_items.map((ci: any) => ci.name).join(' + ')
                                                            : 'Combo Items Included'}
                                                    </p>
                                                    <button 
                                                        onClick={() => {
                                                            setExpandedCombos(prev => ({
                                                                ...prev,
                                                                [item.id]: !prev[item.id]
                                                            }));
                                                        }}
                                                        className="text-[10px] font-black text-black uppercase tracking-tighter underline underline-offset-4 whitespace-nowrap"
                                                    >
                                                        {expandedCombos[item.id] ? 'Hide Info' : 'Show Full Info'}
                                                    </button>
                                                </div>

                                                {/* Expanded Details */}
                                                <AnimatePresence>
                                                    {expandedCombos[item.id] && (
                                                        <motion.div 
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="mt-2 space-y-2 p-3 bg-white rounded-xl border border-neutral-100 shadow-sm">
                                                                {Array.isArray(item.combo_items) && item.combo_items.map((sub: any, idx: number) => (
                                                                    <div key={idx} className="flex items-center justify-between text-[11px] font-bold text-black border-b border-neutral-50 last:border-0 pb-1.5 last:pb-0">
                                                                        <span className="flex items-center gap-2">
                                                                            <span className="size-1.5 bg-black rounded-full" />
                                                                            {sub.name}
                                                                        </span>
                                                                        <span className="text-black font-black">x{sub.quantity || 1}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Coupon Section (Only show if not paid) */}
                        {(order.status !== 'paid') && (
                            <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-100 mt-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <LucideTicket size={16} className="text-orange-500" />
                                    <h3 className="font-bold text-sm text-black">Apply Coupon</h3>
                                </div>

                                {(order.discount_amount || 0) > 0 && order.coupon_code ? (
                                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="size-7 bg-green-500 rounded-full flex items-center justify-center">
                                                <LucideCheck size={14} className="text-white" />
                                            </div>
                                            <div>
                                                <span className="font-black text-green-800 text-sm tracking-wider">{order.coupon_code}</span>
                                                <p className="text-[10px] text-green-600 font-medium whitespace-nowrap">
                                                    Offer Applied • You save {formatCurrency(order.discount_amount || 0)}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleRemoveCoupon}
                                            className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition-colors flex-shrink-0 ml-2"
                                        >
                                            <LucideX size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={couponInput}
                                            onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                                            placeholder="Enter coupon code"
                                            className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm font-bold text-black placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-300 transition-all uppercase tracking-wider"
                                        />
                                        <button
                                            onClick={handleApplyCoupon}
                                            disabled={!couponInput.trim() || couponLoading}
                                            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 flex-shrink-0 ${!couponInput.trim() || couponLoading
                                                    ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                                                    : 'bg-orange-500 text-white shadow-md shadow-orange-200 hover:bg-orange-600'
                                                }`}
                                        >
                                            {couponLoading ? (
                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mx-auto"></div>
                                            ) : (
                                                'Apply'
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Total Summary */}
                        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 mt-4 flex flex-col gap-2">
                            <div className="flex justify-between items-center text-sm font-medium text-black">
                                <span>Original Total</span>
                                <span>{formatCurrency(order.total_amount)}</span>
                            </div>

                            {(order.discount_amount || 0) > 0 && (
                                <div className="flex justify-between items-center text-green-600 font-bold text-sm">
                                    <span>🎫 Coupon Discount {order.coupon_code ? `(${order.coupon_code})` : ''}</span>
                                    <span>- {formatCurrency(order.discount_amount || 0)}</span>
                                </div>
                            )}

                            <div className="flex justify-between items-center border-t border-neutral-50 pt-3 mt-1">
                                <div className="flex flex-col">
                                    <span className="font-bold text-black text-sm">Total Amount</span>
                                    {order.status === 'paid' && (
                                        <span className="text-[10px] font-black uppercase tracking-wider text-green-600 bg-green-50 px-2 py-0.5 rounded-md w-fit mt-1 border border-green-100">
                                            PAID
                                        </span>
                                    )}
                                </div>
                                <span className="text-2xl font-black text-black tracking-tight">
                                    {formatCurrency((order.total_amount || 0) - (order.discount_amount || 0))}
                                </span>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Bottom Actions - Floating above Nav */}
            <div className="fixed bottom-20 left-0 w-full flex justify-center z-40 pointer-events-none">
                <div className="w-full max-w-xs px-4 flex gap-3">
                    {order && order.status === 'paid' ? (
                        <div className="w-full flex gap-3 animate-in slide-in-from-bottom-5 pointer-events-auto">
                            <div className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm">
                                <LucideCheckCircle size={18} />
                                Bill Paid
                            </div>
                            <button
                                onClick={() => handlePrint()}
                                className="flex-1 py-3 bg-white border border-green-200 text-green-700 font-bold rounded-xl flex items-center justify-center gap-2 text-sm active:scale-95 transition-transform"
                            >
                                <LucidePrinter size={18} />
                                Print Bill
                            </button>
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={() => router.push(`/${restaurantId}/customer/menu/${tableNumber}`)}
                                className="flex-1 py-2.5 bg-white border border-neutral-200 text-black font-bold rounded-xl active:scale-95 transition-transform text-xs pointer-events-auto"
                            >
                                Add More Items
                            </button>
                            <button
                                onClick={handleRequestBill}
                                className="flex-1 py-2.5 bg-neutral-900 text-white font-bold rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2 text-xs pointer-events-auto"
                            >
                                Request Bill
                                <LucideFileText size={14} className="text-white" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Bill Confirmation Modal */}
            <BillConfirmationModal
                isOpen={showBillConfirmation}
                onClose={() => setShowBillConfirmation(false)}
                onConfirm={confirmBillRequest}
            />

            {/* Hidden Print Component */}
            <div style={{ display: 'none' }}>
                {order && <InvoiceComponent ref={componentRef} order={order} />}
            </div>
        </div>
    );
}
