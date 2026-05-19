'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OrderService, Order } from '@/app/services/orders';
import { CheckCircle as LucideCheckCircle, Clock as LucideClock, ChefHat as LucideChefHat, Utensils as LucideUtensils, Receipt as LucideReceipt, ChevronLeft as LucideChevronLeft, Loader2 as LucideLoader2, Ticket as LucideTicket, Check as LucideCheck, X as LucideX } from 'lucide-react';
import { OfferService } from '@/app/services/offers';
import { toast } from 'sonner';
import SharedComboCard from '@/app/components/shared/SharedComboCard';
import { motion } from 'framer-motion';

import BillRequestModal from '@/app/components/customer/BillRequestModal';
import ConfirmationModal from '@/app/components/ui/ConfirmationModal';

export default function OrderStatusPage() {
    const params = useParams();
    const router = useRouter();
    const orderId = typeof params.orderId === 'string' ? params.orderId : '';
    const urlRestaurantId = (params.restaurantCode || params.restaurantId) as string;
    const tableNumber = params.tableNumber as string;

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [isBillRequested, setIsBillRequested] = useState(false);
    const [orderRestaurantId, setOrderRestaurantId] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState(30);
    const [couponInput, setCouponInput] = useState('');
    const [couponLoading, setCouponLoading] = useState(false);

    const loadOrder = async () => {
        try {
            const data = await OrderService.getOrderDetails(orderId, urlRestaurantId);
            console.log('[OrderStatusPage] Loaded order:', data?.id, 'Items:', data?.items?.length);
            if (data?.items) {
                console.log('[OrderStatusPage] Item statuses:', data.items.map((i: any) => i.status));
            }
            setOrder(data);
            if (data && (data as any).restaurant_id) {
                setOrderRestaurantId((data as any).restaurant_id);
            }
        } catch (error) {
            console.error('Failed to load order:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const init = async () => {
            if (!orderId) return;
            
            // Resolve the restaurant ID first if it's a slug
            const actualId = await OrderService.resolveRestaurantId(urlRestaurantId);
            if (actualId) setOrderRestaurantId(actualId);
            
            await loadOrder();
        };
        init();
    }, [orderId, urlRestaurantId]);

    // Set up subscriptions once we have the restaurantId
    useEffect(() => {
        if (!orderId || !orderRestaurantId) return;

        const orderSub = OrderService.subscribeToOrders(orderRestaurantId, (payload) => {
            if (payload.eventType === 'UPDATE' && payload.new.id === orderId) {
                loadOrder();
            }
        });

        const itemSub = OrderService.subscribeToOrderItems(orderRestaurantId, (payload) => {
            if (payload.new && payload.new.order_id === orderId) {
                loadOrder();
            }
        });

        return () => {
            orderSub.unsubscribe();
            itemSub.unsubscribe();
        };
    }, [orderId, orderRestaurantId]);

    // Timer Logic for Queued Items
    const queuedItems = order?.items?.filter(item => item.status === 'queued') || [];
    const hasQueuedItems = queuedItems.length > 0;

    useEffect(() => {
        if (hasQueuedItems) {
            if (timeLeft > 0) {
                const timerId = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
                return () => clearTimeout(timerId);
            } else {
                // Timer finished, auto-confirm queued items to placed
                OrderService.updateOrderStatus(orderId, urlRestaurantId, 'placed')
                    .then(() => loadOrder());
            }
        } else {
            // Reset timer if no queued items exist (confirmed or cancelled)
            if (timeLeft !== 30) setTimeLeft(30);
        }
    }, [hasQueuedItems, timeLeft, orderId]);

    const [confirmationModal, setConfirmationModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        isDestructive?: boolean;
        confirmText?: string;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
    });

    const closeConfirmationModal = () => setConfirmationModal(prev => ({ ...prev, isOpen: false }));

    const handleCancelQueuedItems = async () => {
        try {
            await Promise.all(queuedItems.map(item => OrderService.deleteOrderItem(item.id, urlRestaurantId)));
            // Check if order is empty/deleted?
            // If we deleted all items, the order might be gone or empty
            // Ideally we should redirect to menu if order is empty
            const updatedOrder = await OrderService.getOrderDetails(orderId, urlRestaurantId);
            if (!updatedOrder || !updatedOrder.items || updatedOrder.items.length === 0) {
                router.push(`/${urlRestaurantId}/customer/menu/${tableNumber}`);
            } else {
                loadOrder();
            }
        } catch (e) {
            console.error('Failed to cancel items', e);
            // Fallback reload
            loadOrder();
        }
    };

    const handleCancelOrder = () => {
        setConfirmationModal({
            isOpen: true,
            title: 'Cancel Entire Order?',
            message: 'This will cancel your entire order. You will be redirected to the menu.',
            confirmText: 'Yes, Cancel Order',
            isDestructive: true,
            onConfirm: async () => {
                try {
                    await OrderService.deleteOrder(orderId, urlRestaurantId);
                    router.push(`/${urlRestaurantId}/customer/menu/${tableNumber}`);
                } catch (e) {
                    console.error(e);
                }
            }
        });
    };

    const handleRemoveItem = (itemId: string) => {
        setConfirmationModal({
            isOpen: true,
            title: 'Remove Item?',
            message: 'Are you sure you want to remove this item from your order?',
            confirmText: 'Remove',
            isDestructive: true,
            onConfirm: async () => {
                try {
                    await OrderService.deleteOrderItem(itemId, urlRestaurantId);
                    loadOrder();
                } catch (e) {
                    console.error(e);
                }
            }
        });
    };

    const handleApplyCoupon = async () => {
        if (!couponInput.trim() || !order) return;
        setCouponLoading(true);
        try {
            const offer = await OfferService.validateCoupon(couponInput.trim(), urlRestaurantId);
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

            await OrderService.updateOrderCoupon(order.id, urlRestaurantId, offer.code, discountAmount);
            await OfferService.incrementUsage(offer.id, urlRestaurantId);
            toast.success(`Coupon ${offer.code} applied successfully!`);
            setCouponInput('');
            loadOrder();
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
            await OrderService.updateOrderCoupon(order.id, urlRestaurantId, '', 0);
            toast.success('Coupon removed');
            loadOrder();
        } catch (error) {
            console.error('Failed to remove coupon', error);
            toast.error('Failed to remove coupon');
        }
    };

    const getStatusStep = (status: string) => {
        switch (status) {
            case 'placed': return 1;
            case 'preparing': return 2;
            case 'ready': return 3;
            case 'served': return 4;
            case 'paid': return 5;
            default: return 0;
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
                <p className="text-black font-medium">Loading Order Status...</p>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-6 text-center">
                <div className="size-20 bg-gray-200 rounded-full flex items-center justify-center mb-6 text-black">
                    <LucideReceipt size={32} />
                </div>
                <h2 className="text-xl font-black text-black mb-2">Session Ended</h2>
                <p className="text-black mb-8">This table has been cleared. Thank you for dining with us!</p>
                <button
                    onClick={() => {
                        router.push(`/${urlRestaurantId}/customer/menu/${tableNumber}`);
                    }}
                    className="px-8 py-3 bg-neutral-900 text-white font-bold rounded-xl hover:bg-black transition-colors"
                >
                    View Menu
                </button>
            </div>
        );
    }

    const currentStep = getStatusStep(order.status);

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white p-4 items-center flex justify-between border-b border-gray-100 sticky top-0 z-20">
                <button onClick={() => router.push(`/${urlRestaurantId}/customer/menu/${tableNumber}`)} className="flex items-center gap-1 text-sm font-bold text-black hover:text-orange-500 transition-colors">
                    <LucideChevronLeft size={18} />
                    Menu
                </button>
                <div className="text-right">
                    <h1 className="text-sm font-black text-black uppercase tracking-wide">Order #{order.id.slice(0, 6)}</h1>
                    <p className="text-xs text-black font-medium">
                        {order?.table_number ? (order.table_number.toLowerCase().includes('table') ? order.table_number : `Table ${order.table_number}`) : `Table ${tableNumber}`}
                    </p>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* UNDO / QUEUED BANNER REMOVED */}
                {hasQueuedItems && (
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mb-4 flex items-start gap-3">
                        <div className="p-2 bg-orange-100 rounded-full text-orange-600">
                            <LucideClock size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-black text-sm">Order Queued</h3>
                            <p className="text-xs text-black mt-1">
                                You can modify or cancel items before the timer ends.
                            </p>
                        </div>
                    </div>
                )}

                {/* Status Tracker (Hide if entire order is queued?) */}
                {order.status !== 'queued' && (
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-6 relative">
                            {/* Connecting Line */}
                            <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -z-10 rounded-full"></div>
                            <div
                                className="absolute top-1/2 left-0 h-1 bg-green-500 -z-10 transition-all duration-500 rounded-full"
                                style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
                            ></div>

                            {/* Steps */}
                            {[
                                { step: 1, icon: LucideClock, label: 'Placed', color: 'bg-blue-500' },
                                { step: 2, icon: LucideChefHat, label: 'Cooking', color: 'bg-orange-500' },
                                { step: 3, icon: LucideUtensils, label: 'Ready', color: 'bg-green-500' },
                                { step: 4, icon: LucideCheckCircle, label: 'Served', color: 'bg-neutral-900' },
                            ].map((s, idx) => {
                                const isActive = currentStep >= s.step;
                                return (
                                    <div key={idx} className="flex flex-col items-center gap-2 bg-white px-2">
                                        <div className={`size-10 rounded-full flex items-center justify-center transition-all duration-300 border-4 border-white shadow-sm ${isActive ? s.color + ' text-white scale-110' : 'bg-gray-200 text-black'}`}>
                                            <s.icon size={16} />
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-black' : 'text-black'}`}>
                                            {s.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="text-center p-4 bg-gray-50 rounded-xl">
                            {order.status === 'placed' && <p className="text-black font-medium animate-pulse">Waiting for kitchen confirmation...</p>}
                            {order.status === 'preparing' && <p className="text-orange-600 font-bold animate-pulse">Chefs are preparing your meal!</p>}
                            {order.status === 'ready' && <p className="text-green-600 font-bold text-lg">Your food is ready!</p>}
                            {order.status === 'served' && <p className="text-black font-bold">Enjoy your meal! 😋</p>}
                            {order.status === 'paid' && <p className="text-blue-600 font-bold">Payment Received by {order.paid_by || 'Staff'}. Thank you! 🙏</p>}
                        </div>
                    </div>
                )}


                {/* Order Items */}
                <div className="space-y-3">
                    {order.items?.map((item, idx) => {
                        if (item.item_type?.toLowerCase() === 'combo') {
                            return (
                                <div key={idx} className="relative">
                                    <SharedComboCard
                                        name={item.name}
                                        image_url={item.image_url}
                                        price={item.price}
                                        quantity={item.quantity}
                                        items={item.combo_items || []}
                                        notes={item.notes}
                                        readOnly={true}
                                    />
                                    {/* Status Badge */}
                                    <div className="absolute top-2 right-2 flex items-center gap-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg border border-gray-100 shadow-sm">
                                        <p className={`text-[10px] font-bold uppercase tracking-wider ${item.status === 'queued' ? 'text-orange-600 animate-pulse' :
                                            item.status === 'ready' ? 'text-green-600' :
                                                item.status === 'served' ? 'text-black' :
                                                    item.status === 'paid' ? 'text-green-600' :
                                                        item.status === 'preparing' ? 'text-orange-500' : 'text-blue-400'
                                            }`}>
                                            {item.status === 'queued' ? 'Sending...' : item.status}
                                        </p>

                                        {item.status === 'queued' && (
                                            <button onClick={() => handleRemoveItem(item.id)} className="text-[10px] font-bold text-red-500 hover:text-red-700 underline ml-2">
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        }

                        return (
                        <div key={idx} className={`py-3 first:pt-0 last:pb-0 flex justify-between items-center ${item.status === 'queued' ? 'bg-orange-50/50 -mx-4 px-4' : ''} bg-white rounded-2xl p-4 shadow-sm border border-gray-100`}>
                            <div className="flex items-center gap-3">
                                <span className="bg-gray-100 text-black text-xs font-bold px-2 py-1 rounded-md">
                                    {item.quantity}x
                                </span>

                                <div className="size-12 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center text-lg overflow-hidden relative mr-3">
                                    {item.image_url ? (
                                        <img
                                            src={item.image_url}
                                            alt={item.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span>🍽️</span>
                                    )}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-black">{item.name}</p>
                                    <div className="flex items-center gap-2">
                                        <p className={`text-[10px] font-bold uppercase tracking-wider ${item.status === 'queued' ? 'text-orange-600 animate-pulse' :
                                            item.status === 'ready' ? 'text-green-600' :
                                                item.status === 'served' ? 'text-black' :
                                                    item.status === 'paid' ? 'text-green-600' :
                                                        item.status === 'preparing' ? 'text-orange-500' : 'text-blue-400'
                                            }`}>
                                            {item.status === 'queued' ? 'Sending...' : item.status}
                                        </p>

                                        {item.status === 'queued' && (
                                            <button onClick={() => handleRemoveItem(item.id)} className="text-[10px] font-bold text-red-500 hover:text-red-700 underline ml-2">
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <span className="text-sm font-medium text-black">₹{item.price * item.quantity}</span>
                        </div>
                    );
                    })}
                </div>

                {/* Coupon Section (Only show if not settled) */}
                {(order.status !== 'paid') && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
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
                                            Offer Applied • You save ₹{order.discount_amount}
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
                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-black placeholder:text-black focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-300 transition-all uppercase tracking-wider"
                                />
                                <button
                                    onClick={handleApplyCoupon}
                                    disabled={!couponInput.trim() || couponLoading}
                                    className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 flex-shrink-0 ${!couponInput.trim() || couponLoading
                                            ? 'bg-gray-100 text-black cursor-not-allowed'
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

                {/* Total & Payment Status */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-sm font-medium text-black">
                        <span>Original Total</span>
                        <span>₹{order.total_amount}</span>
                    </div>

                    {(order.discount_amount || 0) > 0 && (
                        <div className="flex justify-between items-center text-green-600 font-bold text-sm">
                            <span>🎫 Coupon Discount {order.coupon_code ? `(${order.coupon_code})` : ''}</span>
                            <span>- ₹{order.discount_amount}</span>
                        </div>
                    )}

                    <div className="flex justify-between items-center border-t border-gray-50 pt-2 mt-1">
                        <span className="font-bold text-black">Total</span>
                        <span className="font-black text-xl text-black">
                            ₹{(order.total_amount || 0) - (order.discount_amount || 0)}
                        </span>
                    </div>

                    {(order.amount_paid || 0) > 0 && (
                        <div className="flex justify-between items-center text-green-600">
                            <span className="font-bold text-sm">Paid</span>
                            <span className="font-black text-lg">- ₹{order.amount_paid}</span>
                        </div>
                    )}

                    {(order.amount_paid || 0) > 0 && ((order.total_amount || 0) - (order.discount_amount || 0)) > (order.amount_paid || 0) && (
                        <div className="flex justify-between items-center text-orange-600 pt-2 border-t border-gray-50">
                            <span className="font-bold text-sm">Balance Due</span>
                            <span className="font-black text-2xl">
                                ₹{((order.total_amount || 0) - (order.discount_amount || 0)) - (order.amount_paid || 0)}
                            </span>
                        </div>
                    )}
                </div>
            </main>

            {/* Actions - Sticky Footer */}
            <div className="p-4 bg-white border-t border-gray-100 flex gap-3 sticky bottom-[64px] z-30 shadow-[0_-4px_15px_rgba(0,0,0,0.03)]">
                {hasQueuedItems ? (
                    <div className="flex gap-3 w-full">
                        <button
                            onClick={handleCancelQueuedItems}
                            className="flex-1 py-4 bg-red-100 text-red-600 font-bold rounded-xl hover:bg-red-200 transition-colors shadow-sm"
                        >
                            Undo
                        </button>
                        <button
                            onClick={() => {
                                OrderService.updateOrderStatus(orderId, urlRestaurantId, 'placed')
                                    .then(() => loadOrder())
                                    .catch(e => console.error('Failed to confirm', e));
                            }}
                            className="flex-1 py-4 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors shadow-xl shadow-green-500/20"
                        >
                            Confirm Now ({timeLeft}s)
                        </button>
                    </div>
                ) : (
                    <>
                        <button
                            onClick={() => router.push(`/${urlRestaurantId}/customer/menu/${tableNumber}`)}
                            className="flex-1 py-4 bg-white border border-neutral-200 text-black font-bold rounded-xl hover:bg-neutral-50 transition-colors shadow-sm"
                        >
                            Add More Items
                        </button>
                        <button
                            onClick={async () => {
                                try {
                                    if (tableNumber && orderRestaurantId) {
                                        await OrderService.setTableAlert(tableNumber, 'bill_requested', orderRestaurantId);
                                    }
                                    setIsBillRequested(true);
                                } catch (e) {
                                    console.error(e);
                                }
                            }}
                            className="flex-1 py-4 bg-neutral-900 text-white font-bold rounded-xl hover:bg-black transition-colors shadow-xl shadow-neutral-900/10"
                        >
                            Request Bill 📄
                        </button>
                    </>
                )}
            </div>

            <BillRequestModal
                isOpen={isBillRequested}
                onClose={() => setIsBillRequested(false)}
            />

            <ConfirmationModal
                isOpen={confirmationModal.isOpen}
                onClose={closeConfirmationModal}
                onConfirm={confirmationModal.onConfirm}
                title={confirmationModal.title}
                message={confirmationModal.message}
                confirmText={confirmationModal.confirmText}
                isSuperDestructive={confirmationModal.isDestructive}
            />
        </div>
    );
}
