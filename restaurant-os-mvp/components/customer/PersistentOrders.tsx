'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { OrderService, Order } from '@/services/orders.service';
import { 
    FileText as LucideFileText, 
    Check as LucideCheck, 
    Clock as LucideClock, 
    ChefHat as LucideChefHat, 
    Utensils as LucideUtensils, 
    CheckCircle as LucideCheckCircle, 
    Printer as LucidePrinter,
    Ticket as LucideTicket,
    X as LucideX,
    Bike as LucideBike,
    Phone as LucidePhone,
    MapPin as LucideMapPin,
    RefreshCw as LucideRefreshCw,
    ShoppingBag as LucideShoppingBag,
    History as LucideHistory,
    Sparkles as LucideSparkles,
    Calendar as LucideCalendar
} from 'lucide-react';
import { formatCurrency, getCategoryMenuItemImage, formatAddress } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useReactToPrint } from 'react-to-print';
import { InvoiceComponent } from '@/components/InvoiceComponent';
import { CustomerCache } from '@/services/homepage-cache.service';
import { OfferService } from '@/services/offers.service';
import { toast } from 'sonner';
import { showWarningPopup } from '@/components/shared/WarningPopupCard';

// Timeline Component supporting both Dine-in/Takeaway and Delivery lifecycles
const OrderTimeline = ({ status, orderType }: { status: string; orderType?: string }) => {
    const isDelivery = orderType === 'DELIVERY';

    const dineInSteps = [
        { id: 'placed', icon: LucideClock, label: 'PLACED', color: '#3b82f6' },
        { id: 'preparing', icon: LucideChefHat, label: 'COOKING', color: '#f97316' },
        { id: 'ready', icon: LucideUtensils, label: 'READY', color: '#22c55e' },
        { id: 'served', icon: LucideCheck, label: 'SERVED', color: '#10B981' },
    ];

    const deliverySteps = [
        { id: 'placed', icon: LucideClock, label: 'PLACED', color: '#3b82f6' },
        { id: 'preparing', icon: LucideChefHat, label: 'KITCHEN', color: '#f97316' },
        { id: 'ready', icon: LucideUtensils, label: 'PACKED', color: '#8b5cf6' },
        { id: 'out_for_delivery', icon: LucideBike, label: 'ON WAY', color: '#06b6d4' },
        { id: 'delivered', icon: LucideCheck, label: 'DELIVERED', color: '#10b981' },
    ];

    const steps = isDelivery ? deliverySteps : dineInSteps;
    const currentStepIndex = steps.findIndex(s => s.id === status);
    const activeIndex = currentStepIndex === -1 ? (status === 'paid' ? steps.length - 1 : 0) : currentStepIndex;

    return (
        <div
            className="p-5 rounded-[24px] mb-4 relative overflow-hidden"
            style={{
                backgroundColor: '#EEF2F6',
                boxShadow: '4px 4px 10px rgba(166, 180, 200, 0.4), -4px -4px 10px rgba(255, 255, 255, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.85)',
            }}
        >
            <div className="flex justify-between items-start relative z-10 px-2">
                {/* Sunken Groove Progress Track */}
                <div
                    className="absolute top-5 left-4 right-4 h-1.5 -z-10 rounded-full"
                    style={{
                        backgroundColor: '#EEF2F6',
                        boxShadow: 'inset 1px 1px 2.5px rgba(166, 180, 200, 0.45), inset -1px -1px 2.5px rgba(255, 255, 255, 0.95)',
                    }}
                />

                {steps.map((step, index) => {
                    const isActive = index <= activeIndex;
                    const isCurrent = index === activeIndex;

                    return (
                        <div key={step.id} className="flex flex-col items-center px-1">
                            <motion.div
                                initial={false}
                                animate={{
                                    scale: isCurrent ? 1.08 : 1,
                                }}
                                className="size-10 rounded-full flex items-center justify-center transition-all duration-300"
                                style={isActive ? {
                                    backgroundColor: step.color,
                                    color: '#FFFFFF',
                                    boxShadow: `0 3px 10px ${step.color}55`,
                                } : {
                                    backgroundColor: '#EEF2F6',
                                    color: '#94A3B8',
                                    boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.38), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                                    border: '1px solid rgba(255, 255, 255, 0.7)',
                                }}
                            >
                                <step.icon size={16} strokeWidth={isActive ? 2.8 : 2.2} />
                            </motion.div>
                            <span className={`text-[9.5px] font-black uppercase mt-2 tracking-wider ${
                                isActive ? 'text-slate-800' : 'text-slate-400'
                            }`}>
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            <div
                className="mt-5 p-3 rounded-2xl text-center"
                style={{
                    backgroundColor: '#EEF2F6',
                    boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.75)',
                }}
            >
                <AnimatePresence mode="wait">
                    <motion.p
                        key={status}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="text-xs font-extrabold text-slate-700"
                    >
                        {status === 'placed' && "Waiting for kitchen confirmation..."}
                        {status === 'preparing' && "Chefs are preparing your delicious food..."}
                        {status === 'ready' && (isDelivery ? "Food is packed and ready for delivery partner!" : "Your order is ready to be served!")}
                        {status === 'out_for_delivery' && "Your delivery partner is on the way!"}
                        {status === 'delivered' && "Order delivered! Enjoy your meal!"}
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
                        key="bill-confirm-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 animate-in fade-in"
                    />
                    <motion.div
                        key="bill-confirm-card"
                        initial={{ opacity: 0, scale: 0.94, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 15 }}
                        className="fixed left-4 right-4 bottom-32 md:left-1/2 md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:max-w-sm rounded-[28px] p-6 z-50 flex flex-col gap-4 text-center pointer-events-auto"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: '8px 8px 24px rgba(166, 180, 200, 0.5), -8px -8px 24px rgba(255, 255, 255, 0.95)',
                            border: '1px solid rgba(255, 255, 255, 0.9)',
                        }}
                    >
                        <div
                            className="size-14 rounded-2xl flex items-center justify-center mx-auto text-orange-600"
                            style={{
                                backgroundColor: '#EEF2F6',
                                boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                border: '1px solid rgba(255, 255, 255, 0.75)',
                            }}
                        >
                            <LucideFileText size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-800 tracking-tight">Request Bill?</h3>
                            <p className="text-xs font-semibold text-slate-500 mt-1.5 leading-relaxed">
                                Are you ready to settle your bill? A waiter will bring the invoice to your table shortly.
                            </p>
                        </div>
                        <div className="flex gap-3 mt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-3 rounded-2xl font-black text-xs text-slate-700 transition-all active:scale-95"
                                style={{
                                    backgroundColor: '#EEF2F6',
                                    boxShadow: '3px 3px 6px rgba(166, 180, 200, 0.38), -3px -3px 6px rgba(255, 255, 255, 0.95)',
                                    border: '1px solid rgba(255, 255, 255, 0.85)',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={onConfirm}
                                className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black rounded-2xl shadow-[0_4px_12px_rgba(255,107,53,0.35)] active:scale-95 transition-all text-xs"
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
    const isVisible = pathname.includes('/customer/myorders') || pathname.includes('/customer/orders');
    
    // Active vs Previous Orders Tabs
    const [activeTab, setActiveTab] = useState<'active' | 'previous'>('active');

    // Customer identifier for cache isolation: ensure different customers never see each other's cached orders
    const getLocalCustomerId = () => {
        try {
            return typeof window !== 'undefined' ? (localStorage.getItem(`ros_customer_${restaurantId}`) || '') : '';
        } catch {
            return '';
        }
    };
    const getLocalLastOrderId = () => {
        try {
            if (typeof window === 'undefined') return '';
            return (tableNumber ? localStorage.getItem(`ros_last_order_${restaurantId}_${tableNumber}`) : null) 
                || localStorage.getItem(`ros_last_order_${restaurantId}`) 
                || '';
        } catch {
            return '';
        }
    };

    const initialCustId = getLocalCustomerId();
    const initialLastOrder = getLocalLastOrderId();
    const userCacheScope = initialCustId 
        ? `cust_${initialCustId}` 
        : (initialLastOrder 
            ? `ord_${initialLastOrder}` 
            : (tableNumber ? `tbl_${tableNumber}` : 'anonymous'));
    const userCacheKey = `${tableNumber}:${userCacheScope}`;

    // Cached Order Lists - only use cache if user has an identity, order, or table on this device
    const cachedData = userCacheScope !== 'anonymous' 
        ? CustomerCache.get(restaurantId, 'customer_orders', userCacheKey)
        : null;
    const [activeOrders, setActiveOrders] = useState<Order[]>(cachedData?.active || []);
    const [previousOrders, setPreviousOrders] = useState<Order[]>(cachedData?.previous || []);
    const [loading, setLoading] = useState(!cachedData);
    const [refreshing, setRefreshing] = useState(false);

    // Bill & Coupon Modals / State
    const [showBillConfirmation, setShowBillConfirmation] = useState(false);
    const [billTargetTable, setBillTargetTable] = useState<string>(tableNumber);
    const [expandedCombos, setExpandedCombos] = useState<{ [itemId: string]: boolean }>({});
    const [couponInputs, setCouponInputs] = useState<{ [orderId: string]: string }>({});
    const [couponLoadingOrderId, setCouponLoadingOrderId] = useState<string | null>(null);

    // Print functionality
    const [printOrder, setPrintOrder] = useState<Order | null>(null);
    const componentRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({ contentRef: componentRef });

    const triggerPrint = (order: Order) => {
        setPrintOrder(order);
        setTimeout(() => {
            handlePrint();
        }, 120);
    };

    const isMountedRef = useRef(true);
    const isInitialFetch = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Primary Database Fetch - Authenticated Customer ID, Device Last Order ID & Persistent Orders
    const fetchOrders = useCallback(async (isManualRefresh = false) => {
        if (!restaurantId) return;
        if (isManualRefresh) setRefreshing(true);
        
        try {
            let localCustId = '';
            let localLastOrderId = '';
            try {
                localCustId = localStorage.getItem(`ros_customer_${restaurantId}`) || '';
                localLastOrderId = (tableNumber ? localStorage.getItem(`ros_last_order_${restaurantId}_${tableNumber}`) : null) 
                    || localStorage.getItem(`ros_last_order_${restaurantId}`) 
                    || '';
            } catch {}

            const queryParams = new URLSearchParams({
                restaurantId,
                tableNumber: tableNumber || '',
                customerId: localCustId,
                lastOrderId: localLastOrderId,
            });

            const res = await fetch(`/api/customer/orders?${queryParams.toString()}`, {
                cache: 'no-store',
            });

            if (res.ok) {
                const data = await res.json();
                const active: Order[] = data.activeOrders || [];
                const previous: Order[] = data.previousOrders || [];

                if (isMountedRef.current) {
                    setActiveOrders(active);
                    setPreviousOrders(previous);
                    const currentScope = localCustId 
                        ? `cust_${localCustId}` 
                        : (localLastOrderId 
                            ? `ord_${localLastOrderId}` 
                            : (tableNumber ? `tbl_${tableNumber}` : 'anonymous'));
                    if (currentScope !== 'anonymous') {
                        CustomerCache.set(restaurantId, 'customer_orders', { active, previous }, `${tableNumber}:${currentScope}`);
                    }

                    // Switch default tab if active is empty but previous has orders on initial load
                    if (isInitialFetch.current) {
                        isInitialFetch.current = false;
                        if (active.length === 0 && previous.length > 0) {
                            setActiveTab('previous');
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('Failed to fetch customer orders:', err);
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [restaurantId, tableNumber]);

    // Initial Fetch on Visibility
    useEffect(() => {
        if (isVisible) {
            fetchOrders();
        }
    }, [fetchOrders, isVisible]);

    // Realtime Sync with Supabase Orders & Order Items
    useEffect(() => {
        if (!restaurantId || !isVisible) return;

        // Subscribe to live order updates
        const subOrders = OrderService.subscribeToOrders(restaurantId, () => {
            if (!isMountedRef.current || document.visibilityState !== 'visible') return;
            fetchOrders();
        });

        // Subscribe to live order items updates
        const subItems = OrderService.subscribeToOrderItems(restaurantId, () => {
            if (!isMountedRef.current || document.visibilityState !== 'visible') return;
            fetchOrders();
        });

        let lastVisibilityFetch = Date.now();
        const handleVisibility = () => {
            if (document.visibilityState === 'visible' && isVisible) {
                const now = Date.now();
                if (now - lastVisibilityFetch > 10000) {
                    lastVisibilityFetch = now;
                    fetchOrders();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            if (subOrders?.unsubscribe) subOrders.unsubscribe();
            if (subItems?.unsubscribe) subItems.unsubscribe();
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [restaurantId, isVisible, fetchOrders]);

    // Coupon actions
    const handleApplyCoupon = async (orderId: string) => {
        const couponInput = (couponInputs[orderId] || '').trim();
        const targetOrder = activeOrders.find(o => o.id === orderId);
        if (!couponInput || !targetOrder) return;

        setCouponLoadingOrderId(orderId);
        try {
            const offer = await OfferService.validateCoupon(couponInput, restaurantId, targetOrder.order_type);
            if (!offer) {
                showWarningPopup({
                    title: 'Invalid Coupon',
                    message: 'The coupon code entered is invalid, inactive, or has expired.',
                    type: 'coupon',
                    dismissText: 'Dismiss',
                });
                return;
            }

            let discountAmount = 0;
            if (offer.discount_type === 'percentage') {
                discountAmount = Math.round((targetOrder.total_amount || 0) * (offer.discount_value / 100));
                if (offer.max_discount && discountAmount > offer.max_discount) {
                    discountAmount = offer.max_discount;
                }
            } else {
                discountAmount = Math.min(offer.discount_value, targetOrder.total_amount || 0);
            }

            await OrderService.updateOrderCoupon(targetOrder.id, restaurantId, offer.code, discountAmount);
            await OfferService.incrementUsage(offer.id, restaurantId);
            toast.success(`Coupon ${offer.code} applied successfully!`);
            setCouponInputs(prev => ({ ...prev, [orderId]: '' }));
            await fetchOrders();
        } catch (error: any) {
            showWarningPopup({
                title: 'Coupon Restriction',
                message: error?.message || 'Failed to apply coupon. Please check the order requirements.',
                type: 'coupon',
                dismissText: 'Dismiss',
            });
        } finally {
            if (isMountedRef.current) {
                setCouponLoadingOrderId(null);
            }
        }
    };

    const handleRemoveCoupon = async (orderId: string) => {
        try {
            await OrderService.updateOrderCoupon(orderId, restaurantId, '', 0);
            toast.success('Coupon removed');
            await fetchOrders();
        } catch (error: any) {
            showWarningPopup({
                title: 'Action Failed',
                message: 'Failed to remove coupon. Please try again.',
                type: 'error',
                dismissText: 'Dismiss',
            });
        }
    };

    // Request Bill handler
    const handleRequestBill = (targetTable: string) => {
        setBillTargetTable(targetTable || tableNumber);
        setShowBillConfirmation(true);
    };

    const confirmBillRequest = async () => {
        try {
            await OrderService.setTableAlert(billTargetTable, 'bill_requested', restaurantId);
            if (isMountedRef.current) setShowBillConfirmation(false);
            toast.success("Bill requested successfully! A waiter will assist you shortly.");
        } catch (e: any) {
            showWarningPopup({
                title: 'Service Notice',
                message: e?.message || 'Failed to request bill. Please call your waiter directly.',
                type: 'warning',
                dismissText: 'Dismiss',
            });
        }
    };

    // Format Date helper
    const formatOrderDate = (dateStr?: string) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <div style={{ display: isVisible ? 'block' : 'none' }} className="min-h-screen pb-36">
            {/* Header */}
            <header
                className="p-4 sticky top-0 z-20 flex items-center justify-between"
                style={{
                    backgroundColor: '#EEF2F6',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.85)',
                    boxShadow: '0 2px 8px rgba(166, 180, 200, 0.25)',
                }}
            >
                <div className="flex items-center gap-2.5">
                    <h1 className="text-lg font-black text-slate-800 tracking-tight">My Orders</h1>
                    <button
                        onClick={() => fetchOrders(true)}
                        disabled={refreshing}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 transition-colors"
                        title="Refresh Orders"
                    >
                        <LucideRefreshCw size={15} className={refreshing ? 'animate-spin text-orange-600' : ''} />
                    </button>
                </div>

                <div className="text-right">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black text-slate-700 bg-white/80 border border-slate-200/80 shadow-xs">
                        {(() => {
                            const raw = String(tableNumber || '').trim().toLowerCase();
                            if (raw === 'takeaway') return 'Takeaway';
                            if (raw === 'delivery') return 'Delivery';
                            return raw.startsWith('table') ? tableNumber : `Table ${tableNumber}`;
                        })()}
                    </span>
                </div>
            </header>

            {/* Segmented Neumorphic Tabs (Active Orders vs Previous Orders) */}
            <div className="p-4 pb-2 max-w-xl mx-auto">
                <div
                    className="p-1 rounded-2xl flex items-center gap-1.5"
                    style={{
                        backgroundColor: '#EEF2F6',
                        boxShadow: 'inset 2px 2px 5px rgba(166, 180, 200, 0.4), inset -2px -2px 5px rgba(255, 255, 255, 0.95)',
                    }}
                >
                    <button
                        type="button"
                        onClick={() => setActiveTab('active')}
                        className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            activeTab === 'active'
                                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25 scale-[1.01]'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <LucideShoppingBag size={14} />
                        <span>Active Orders</span>
                        {activeOrders.length > 0 && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                                activeTab === 'active' ? 'bg-white text-orange-600' : 'bg-orange-100 text-orange-600'
                            }`}>
                                {activeOrders.length}
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('previous')}
                        className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            activeTab === 'previous'
                                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25 scale-[1.01]'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <LucideHistory size={14} />
                        <span>Previous Orders</span>
                        {previousOrders.length > 0 && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                                activeTab === 'previous' ? 'bg-white text-orange-600' : 'bg-slate-200 text-slate-700'
                            }`}>
                                {previousOrders.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Tab Contents */}
            <main className="p-4 pt-2 space-y-5 max-w-xl mx-auto w-full">
                {/* 1. ACTIVE ORDERS TAB */}
                {activeTab === 'active' && (
                    <>
                        {activeOrders.length === 0 ? (
                            <div className="flex flex-col justify-center items-center py-16 px-4 text-center">
                                <div
                                    className="size-20 rounded-3xl flex items-center justify-center mb-6 text-orange-600"
                                    style={{
                                        backgroundColor: '#EEF2F6',
                                        boxShadow: 'inset 2.5px 2.5px 5px rgba(166, 180, 200, 0.4), inset -2.5px -2.5px 5px rgba(255, 255, 255, 0.95)',
                                        border: '1px solid rgba(255, 255, 255, 0.75)',
                                    }}
                                >
                                    <LucideCheckCircle size={36} strokeWidth={2.2} />
                                </div>
                                <h2 className="text-xl font-black text-slate-800 mb-2 tracking-tight">No Active Orders</h2>
                                <p className="text-xs font-semibold text-slate-500 mb-6 max-w-xs leading-relaxed">
                                    All your past orders have been completed or you haven&apos;t placed a new order yet.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button
                                        onClick={() => router.push(`/${restaurantId}/customer/menu/${tableNumber}`)}
                                        className="py-3 px-6 rounded-2xl font-black text-xs text-white bg-gradient-to-r from-orange-500 to-amber-500 shadow-[0_4px_14px_rgba(255,107,53,0.38)] active:scale-95 transition-all cursor-pointer"
                                    >
                                        Browse Menu
                                    </button>
                                    {previousOrders.length > 0 && (
                                        <button
                                            onClick={() => setActiveTab('previous')}
                                            className="py-3 px-6 rounded-2xl font-black text-xs text-slate-700 bg-white/80 border border-slate-200 shadow-sm active:scale-95 transition-all cursor-pointer"
                                        >
                                            View Order History ({previousOrders.length})
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {activeOrders.map((order, orderIndex) => (
                                    <div
                                        key={order.id}
                                        className="p-5 rounded-[26px] space-y-4 relative"
                                        style={{
                                            backgroundColor: '#EEF2F6',
                                            boxShadow: '4px 4px 12px rgba(166, 180, 200, 0.4), -4px -4px 12px rgba(255, 255, 255, 0.95)',
                                            border: '1px solid rgba(255, 255, 255, 0.9)',
                                        }}
                                    >
                                        {/* Order Header */}
                                        <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black text-slate-800 uppercase tracking-widest">
                                                        ORDER #{order.order_number || order.id.slice(0, 6)}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black text-orange-700 bg-orange-100/80 border border-orange-200">
                                                        {order.order_type === 'DELIVERY' ? 'Delivery' : (order.order_type === 'TAKEAWAY' ? 'Takeaway' : (order.table_name || `Table ${order.table_id || tableNumber}`))}
                                                    </span>
                                                </div>
                                                <p className="text-[10.5px] text-slate-400 font-bold mt-0.5" suppressHydrationWarning>
                                                    {formatOrderDate(order.created_at)}
                                                </p>
                                            </div>

                                            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full text-emerald-700 bg-emerald-100/80 border border-emerald-200">
                                                ● {order.status}
                                            </span>
                                        </div>

                                        {/* Timeline */}
                                        <OrderTimeline status={order.status} orderType={order.order_type} />

                                        {/* Delivery Partner Card */}
                                        {order.delivery_assignment?.delivery_boy && (
                                            <div
                                                className="p-4 rounded-2xl"
                                                style={{
                                                    backgroundColor: '#EEF2F6',
                                                    boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                                    border: '1px solid rgba(255, 255, 255, 0.75)',
                                                }}
                                            >
                                                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                                                    <div className="flex items-center gap-2">
                                                        <LucideBike size={15} className="text-orange-600" />
                                                        <span className="text-xs font-black uppercase tracking-wider text-slate-700">Delivery Partner</span>
                                                    </div>
                                                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full text-emerald-700 bg-emerald-100">
                                                        {order.delivery_assignment.status === 'OUT_FOR_DELIVERY' ? 'On The Way' :
                                                         order.delivery_assignment.status === 'PICKED_UP' ? 'Picked Up' :
                                                         order.delivery_assignment.status === 'DELIVERED' ? 'Delivered' :
                                                         order.delivery_assignment.status === 'ACCEPTED' ? 'Partner Assigned' :
                                                         order.delivery_assignment.status}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between pt-2.5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-11 rounded-xl overflow-hidden shrink-0 bg-orange-100 text-orange-600 flex items-center justify-center font-black text-sm">
                                                            {order.delivery_assignment.delivery_boy.avatar_url ? (
                                                                <img
                                                                    src={order.delivery_assignment.delivery_boy.avatar_url}
                                                                    alt={order.delivery_assignment.delivery_boy.name}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            ) : (
                                                                order.delivery_assignment.delivery_boy.name?.charAt(0)?.toUpperCase() || 'D'
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h4 className="text-xs font-black text-slate-800">
                                                                {order.delivery_assignment.delivery_boy.name}
                                                            </h4>
                                                            <p className="text-[10px] text-slate-500 font-semibold">
                                                                {order.delivery_assignment.delivery_boy.vehicle_type || 'Partner'}
                                                                {order.delivery_assignment.delivery_boy.vehicle_number ? ` • ${order.delivery_assignment.delivery_boy.vehicle_number}` : ''}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {order.delivery_assignment.delivery_boy.mobile && (
                                                        <a
                                                            href={`tel:${order.delivery_assignment.delivery_boy.mobile}`}
                                                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-xs text-white bg-orange-500 shadow-sm"
                                                        >
                                                            <LucidePhone size={12} />
                                                            <span>Call</span>
                                                        </a>
                                                    )}
                                                </div>

                                                {order.delivery_address && (
                                                    <div className="mt-2.5 pt-2 border-t border-slate-200/50 flex items-start gap-1.5 text-[11px] text-slate-500 font-medium">
                                                        <LucideMapPin size={13} className="text-orange-500 shrink-0 mt-0.5" />
                                                        <span className="line-clamp-2">{formatAddress(order.delivery_address)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Items List */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <span className="size-1.5 rounded-full bg-orange-500" />
                                                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500">Items Ordered</h3>
                                            </div>

                                            <div className="divide-y divide-slate-200/60">
                                                {(!order.items || order.items.length === 0) ? (
                                                    <p className="text-xs text-slate-400 font-semibold py-2">No item details recorded</p>
                                                ) : (
                                                    order.items.map((item) => (
                                                        <div key={item.id} className="py-2.5 first:pt-0 last:pb-0">
                                                            <div className="flex items-center gap-3">
                                                                <div className="size-12 rounded-xl overflow-hidden shrink-0 bg-white border border-slate-200/80 p-0.5">
                                                                    <img
                                                                        src={item.image_url || getCategoryMenuItemImage(item.name)}
                                                                        alt={item.name}
                                                                        onError={(e) => {
                                                                            (e.target as HTMLImageElement).src = getCategoryMenuItemImage(item.name);
                                                                        }}
                                                                        className="w-full h-full object-cover rounded-lg"
                                                                    />
                                                                </div>

                                                                <div className="flex-1 min-w-0">
                                                                    <h4 className="text-xs font-black text-slate-800 leading-tight uppercase truncate">{item.name}</h4>
                                                                    <div className="flex items-center gap-2 mt-0.5">
                                                                        <span className="text-[10px] font-black text-slate-600 bg-white/70 px-1.5 py-0.2 rounded border border-slate-200">
                                                                            x{item.quantity}
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-500 font-bold">₹{item.price}</span>
                                                                        <span className={`text-[9px] font-black uppercase ${
                                                                            item.status === 'preparing' ? 'text-orange-600' :
                                                                            item.status === 'ready' ? 'text-emerald-600' : 'text-blue-600'
                                                                        }`}>
                                                                            ● {item.status || 'placed'}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                <div className="text-right shrink-0">
                                                                    <span className="text-xs font-black text-slate-800">
                                                                        {formatCurrency(item.price * item.quantity)}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Combo details */}
                                                            {item.item_type === 'combo' && Array.isArray(item.combo_items) && (
                                                                <div className="ml-15 mt-1 text-[10px] text-slate-500 font-medium">
                                                                    {item.combo_items.map((ci: any) => ci.name).join(' + ')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        {/* Coupon Section (if not paid) */}
                                        {order.status !== 'paid' && (
                                            <div
                                                className="p-3.5 rounded-2xl"
                                                style={{
                                                    backgroundColor: '#EEF2F6',
                                                    boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                                                    border: '1px solid rgba(255, 255, 255, 0.75)',
                                                }}
                                            >
                                                {(order.discount_amount || 0) > 0 && order.coupon_code ? (
                                                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                                                        <div className="flex items-center gap-2">
                                                            <LucideCheck size={14} className="text-emerald-600" />
                                                            <span className="text-xs font-black text-emerald-800 uppercase">{order.coupon_code}</span>
                                                            <span className="text-[10px] text-emerald-600 font-bold">
                                                                (-{formatCurrency(order.discount_amount || 0)})
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemoveCoupon(order.id)}
                                                            className="text-emerald-700 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                                                        >
                                                            <LucideX size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={couponInputs[order.id] || ''}
                                                            onChange={(e) => setCouponInputs(prev => ({ ...prev, [order.id]: e.target.value.toUpperCase() }))}
                                                            placeholder="Coupon Code"
                                                            className="flex-1 px-3 py-2 text-xs font-bold uppercase rounded-xl bg-white border border-slate-200 outline-none text-slate-800 placeholder:text-slate-400"
                                                        />
                                                        <button
                                                            onClick={() => handleApplyCoupon(order.id)}
                                                            disabled={!(couponInputs[order.id] || '').trim() || couponLoadingOrderId === order.id}
                                                            className="px-3.5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-xs rounded-xl shadow-sm disabled:opacity-50 cursor-pointer"
                                                        >
                                                            {couponLoadingOrderId === order.id ? '...' : 'Apply'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Financial Breakdown */}
                                        {(() => {
                                            const itemSubtotal = order.items && order.items.length > 0
                                                ? order.items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0)
                                                : Math.round((order.total_amount || 0) / 1.05);
                                            const gst = Number(order.gst_amount || 0);

                                            return (
                                                <div className="pt-2 border-t border-slate-200/60 space-y-1.5 text-xs font-semibold text-slate-600">
                                                    <div className="flex justify-between">
                                                        <span>Subtotal</span>
                                                        <span className="font-extrabold text-slate-800">{formatCurrency(itemSubtotal)}</span>
                                                    </div>
                                                    {gst > 0 && (
                                                        <div className="flex justify-between text-[11px] text-slate-500">
                                                            <span>Taxes & GST (5%)</span>
                                                            <span>{formatCurrency(gst)}</span>
                                                        </div>
                                                    )}
                                                    {(order.discount_amount || 0) > 0 && (
                                                        <div className="flex justify-between text-emerald-600 font-bold">
                                                            <span>Coupon Savings</span>
                                                            <span>- {formatCurrency(order.discount_amount || 0)}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between items-center pt-2 border-t border-slate-200/60">
                                                        <span className="font-black text-slate-800 text-xs uppercase tracking-wider">Total</span>
                                                        <span className="text-lg font-black text-slate-900">
                                                            {formatCurrency((order.total_amount || 0) - (order.discount_amount || 0))}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Actions for this specific active order */}
                                        <div className="flex gap-2.5 pt-1">
                                            {order.status === 'paid' ? (
                                                <button
                                                    onClick={() => triggerPrint(order)}
                                                    className="w-full py-3 rounded-xl bg-white border border-emerald-300 text-emerald-700 font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-98 transition-all"
                                                >
                                                    <LucidePrinter size={15} />
                                                    Print Bill / Receipt
                                                </button>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => router.push(`/${restaurantId}/customer/menu/${tableNumber}`)}
                                                        className="flex-1 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs active:scale-98 transition-all shadow-xs cursor-pointer"
                                                    >
                                                        Add Items
                                                    </button>
                                                    <button
                                                        onClick={() => handleRequestBill(order.table_name || String(order.table_id || tableNumber))}
                                                        className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs rounded-xl shadow-md shadow-orange-500/20 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                                    >
                                                        <LucideFileText size={14} />
                                                        Request Bill
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* 2. PREVIOUS ORDERS TAB (ORDER HISTORY) */}
                {activeTab === 'previous' && (
                    <>
                        {previousOrders.length === 0 ? (
                            <div className="flex flex-col justify-center items-center py-16 px-4 text-center">
                                <div
                                    className="size-20 rounded-3xl flex items-center justify-center mb-6 text-slate-400"
                                    style={{
                                        backgroundColor: '#EEF2F6',
                                        boxShadow: 'inset 2.5px 2.5px 5px rgba(166, 180, 200, 0.4), inset -2.5px -2.5px 5px rgba(255, 255, 255, 0.95)',
                                        border: '1px solid rgba(255, 255, 255, 0.75)',
                                    }}
                                >
                                    <LucideHistory size={36} strokeWidth={2.2} />
                                </div>
                                <h2 className="text-xl font-black text-slate-800 mb-2 tracking-tight">No Previous Orders</h2>
                                <p className="text-xs font-semibold text-slate-500 mb-6 max-w-xs leading-relaxed">
                                    Your completed dining receipts and delivery history will stay permanently available here across all your visits.
                                </p>
                                <button
                                    onClick={() => router.push(`/${restaurantId}/customer/menu/${tableNumber}`)}
                                    className="py-3 px-6 rounded-2xl font-black text-xs text-white bg-gradient-to-r from-orange-500 to-amber-500 shadow-[0_4px_14px_rgba(255,107,53,0.38)] active:scale-95 transition-all cursor-pointer"
                                >
                                    Browse Menu & Order
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                                        Past Dining Records ({previousOrders.length})
                                    </p>
                                    <span className="text-[10px] font-bold text-slate-400">Permanently Saved</span>
                                </div>

                                {previousOrders.map((pOrder) => {
                                    const statusLower = (pOrder.status || '').toLowerCase();
                                    const isPaid = statusLower === 'paid' || Boolean(pOrder.is_completed);
                                    const isCancelled = statusLower === 'cancelled';

                                    return (
                                        <div
                                            key={pOrder.id}
                                            className="p-5 rounded-[24px] space-y-3"
                                            style={{
                                                backgroundColor: '#EEF2F6',
                                                boxShadow: '4px 4px 10px rgba(166, 180, 200, 0.38), -4px -4px 10px rgba(255, 255, 255, 0.95)',
                                                border: '1px solid rgba(255, 255, 255, 0.85)',
                                            }}
                                        >
                                            {/* Header */}
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-black text-slate-800 uppercase tracking-widest">
                                                            ORDER #{pOrder.order_number || pOrder.id.slice(0, 6)}
                                                        </span>
                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200">
                                                            {pOrder.order_type === 'DELIVERY' ? 'Delivery' : (pOrder.order_type === 'TAKEAWAY' ? 'Takeaway' : (pOrder.table_name || `Table ${pOrder.table_id || ''}`))}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400 font-bold mt-1" suppressHydrationWarning>
                                                        <LucideCalendar size={12} />
                                                        <span>{formatOrderDate(pOrder.created_at)}</span>
                                                    </div>
                                                </div>

                                                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                                                    isCancelled
                                                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                }`}>
                                                    {statusLower === 'paid' ? 'Completed & Paid' : (pOrder.status || 'Completed')}
                                                </span>
                                            </div>

                                            {/* Items Mini Summary */}
                                            <div
                                                className="p-3 rounded-2xl space-y-1.5"
                                                style={{
                                                    backgroundColor: '#EEF2F6',
                                                    boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                                                    border: '1px solid rgba(255, 255, 255, 0.75)',
                                                }}
                                            >
                                                {(!pOrder.items || pOrder.items.length === 0) ? (
                                                    <div className="text-xs text-slate-400 font-semibold italic py-0.5">Order record saved</div>
                                                ) : (
                                                    pOrder.items.map((item) => (
                                                        <div key={item.id} className="flex justify-between items-center text-xs">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <span className="font-black text-slate-500 text-[10px]">x{item.quantity}</span>
                                                                <span className="font-bold text-slate-800 truncate">{item.name}</span>
                                                            </div>
                                                            <span className="font-extrabold text-slate-800 shrink-0 ml-2">
                                                                {formatCurrency(item.price * item.quantity)}
                                                            </span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>

                                            {/* Financial Footer & Print Receipt Button */}
                                            <div className="flex items-center justify-between pt-1">
                                                <div>
                                                    <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                                                        Total Paid
                                                    </span>
                                                    <span className="text-base font-black text-slate-900 tracking-tight">
                                                        {formatCurrency((pOrder.total_amount || 0) - (pOrder.discount_amount || 0))}
                                                    </span>
                                                </div>

                                                <button
                                                    onClick={() => triggerPrint(pOrder)}
                                                    className="py-2 px-3.5 rounded-xl bg-white border border-slate-200/80 text-slate-700 font-bold text-xs flex items-center gap-1.5 shadow-xs hover:border-orange-300 hover:text-orange-600 active:scale-98 transition-all cursor-pointer"
                                                >
                                                    <LucidePrinter size={13} />
                                                    <span>View Receipt</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* Bill Confirmation Modal */}
            <BillConfirmationModal
                isOpen={showBillConfirmation}
                onClose={() => setShowBillConfirmation(false)}
                onConfirm={confirmBillRequest}
            />

            {/* Hidden Print Invoice Component */}
            <div style={{ display: 'none' }}>
                {printOrder && <InvoiceComponent ref={componentRef} order={printOrder} />}
            </div>
        </div>
    );
}
