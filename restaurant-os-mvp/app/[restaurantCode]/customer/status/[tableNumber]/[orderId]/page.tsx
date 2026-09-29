'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OrderService, Order } from '@/services/orders.service';
import { supabase } from '@/lib/supabase';
import {
    CheckCircle as LucideCheckCircle, Clock as LucideClock, ChefHat as LucideChefHat,
    Utensils as LucideUtensils, Receipt as LucideReceipt, ChevronLeft as LucideChevronLeft,
    Loader2 as LucideLoader2, Ticket as LucideTicket, Check as LucideCheck, X as LucideX,
    Bike as LucideBike, Phone as LucidePhone, MapPin as LucideMapPin,
    ShoppingBag as LucideShoppingBag, Package as LucidePackage,
    Navigation as LucideNavigation, ExternalLink as LucideExternalLink
} from 'lucide-react';
import { OfferService } from '@/services/offers.service';
import { toast } from 'sonner';
import SharedComboCard from '@/components/shared/SharedComboCard';
import { motion } from 'framer-motion';

import BillRequestModal from '@/components/customer/BillRequestModal';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { formatAddress } from '@/lib/utils';

export default function OrderStatusPage() {
    const params = useParams();
    const router = useRouter();
    const orderId = typeof params.orderId === 'string' ? params.orderId : '';
    const urlRestaurantId = (params.restaurantCode || params.restaurantId) as string;
    const tableNumber = params.tableNumber as string;

    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

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
            if (!isMountedRef.current) return;
            setOrder(data);
            if (data && (data as any).restaurant_id && isMountedRef.current) {
                setOrderRestaurantId((data as any).restaurant_id);
            }
        } catch (error) {
            console.error('Failed to load order:', error);
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        const init = async () => {
            if (!orderId) return;
            
            // Resolve the restaurant ID first if it's a slug
            const actualId = await OrderService.resolveRestaurantId(urlRestaurantId);
            if (actualId && isMountedRef.current) setOrderRestaurantId(actualId);
            
            if (isMountedRef.current) await loadOrder();
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

        // Realtime updates for delivery partner assignment & delivery tracking
        const deliverySub = supabase
            .channel(`order-delivery-${orderId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'delivery_assignments',
                    filter: `order_id=eq.${orderId}`
                },
                () => {
                    loadOrder();
                }
            )
            .subscribe();

        return () => {
            orderSub.unsubscribe();
            itemSub.unsubscribe();
            supabase.removeChannel(deliverySub);
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
                    .then(() => {
                        if (isMountedRef.current) loadOrder();
                    });
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

    const isTakeaway = order?.order_type === 'TAKEAWAY' || tableNumber === 'takeaway';
    const isDelivery = order?.order_type === 'DELIVERY' || tableNumber === 'delivery';
    const isDineIn = !isTakeaway && !isDelivery;

    const getStepsConfig = () => {
        if (!order) return { currentStep: 1, totalSteps: 4, steps: [] };

        if (isDelivery) {
            const daStatus = order.delivery_assignment?.status;
            let current = 1;
            if (['preparing', 'ready', 'served', 'paid'].includes(order.status)) current = 2;
            if (['ready', 'served', 'paid'].includes(order.status)) current = 3;
            if (['PICKED_UP', 'OUT_FOR_DELIVERY'].includes(daStatus || '')) current = 4;
            if (daStatus === 'DELIVERED' || ['served', 'paid'].includes(order.status)) current = 5;

            return {
                currentStep: current,
                totalSteps: 5,
                steps: [
                    { step: 1, icon: LucideClock, label: 'Placed', color: 'bg-blue-500' },
                    { step: 2, icon: LucideChefHat, label: 'Cooking', color: 'bg-orange-500' },
                    { step: 3, icon: LucidePackage, label: 'Ready', color: 'bg-amber-500' },
                    { step: 4, icon: LucideBike, label: 'On The Way', color: 'bg-orange-600' },
                    { step: 5, icon: LucideCheckCircle, label: 'Delivered', color: 'bg-emerald-600' },
                ]
            };
        }

        if (isTakeaway) {
            let current = 1;
            if (['preparing', 'ready', 'served', 'paid'].includes(order.status)) current = 2;
            if (['ready', 'served', 'paid'].includes(order.status)) current = 3;
            if (order.status === 'served' || order.is_completed) current = 4;

            return {
                currentStep: current,
                totalSteps: 4,
                steps: [
                    { step: 1, icon: LucideClock, label: 'Placed', color: 'bg-blue-500' },
                    { step: 2, icon: LucideChefHat, label: 'Cooking', color: 'bg-orange-500' },
                    { step: 3, icon: LucideShoppingBag, label: 'Pickup Ready', color: 'bg-emerald-500' },
                    { step: 4, icon: LucideCheckCircle, label: 'Collected', color: 'bg-neutral-900' },
                ]
            };
        }

        // DINE IN
        let current = 1;
        if (['preparing', 'ready', 'served', 'paid'].includes(order.status)) current = 2;
        if (['ready', 'served', 'paid'].includes(order.status)) current = 3;
        if (['served', 'paid'].includes(order.status)) current = 4;

        return {
            currentStep: current,
            totalSteps: 4,
            steps: [
                { step: 1, icon: LucideClock, label: 'Placed', color: 'bg-blue-500' },
                { step: 2, icon: LucideChefHat, label: 'Cooking', color: 'bg-orange-500' },
                { step: 3, icon: LucideUtensils, label: 'Ready', color: 'bg-emerald-500' },
                { step: 4, icon: LucideCheckCircle, label: 'Served', color: 'bg-neutral-900' },
            ]
        };
    };

    const getStatusMessage = () => {
        if (!order) return null;
        if (isDelivery) {
            const da = order.delivery_assignment;
            if (da?.status === 'DELIVERED' || order.status === 'served') {
                return <p className="text-emerald-600 font-black">Order Delivered! Enjoy your meal! 😋</p>;
            }
            if (da?.status === 'OUT_FOR_DELIVERY') {
                return <p className="text-orange-600 font-bold animate-pulse">Delivery Partner is on the way to your doorstep! 🛵</p>;
            }
            if (da?.status === 'PICKED_UP') {
                return <p className="text-orange-600 font-bold">Food picked up from restaurant and heading to you!</p>;
            }
            if (da?.status === 'ACCEPTED' || da?.status === 'ASSIGNED') {
                return <p className="text-blue-600 font-bold">Delivery partner assigned ({da.delivery_boy?.name || 'Partner'}). Preparing to pick up!</p>;
            }
            if (order.status === 'ready') {
                return <p className="text-amber-600 font-bold">Food is prepared! Waiting for delivery partner assignment.</p>;
            }
            if (order.status === 'preparing') {
                return <p className="text-orange-600 font-bold animate-pulse">Chefs are preparing your meal in the kitchen!</p>;
            }
            return <p className="text-neutral-700 font-medium animate-pulse">Order placed! Waiting for kitchen confirmation...</p>;
        }

        if (isTakeaway) {
            if (order.status === 'served' || order.is_completed) {
                return <p className="text-emerald-600 font-black">Order Collected! Enjoy your food! 😋</p>;
            }
            if (order.status === 'paid') {
                return <p className="text-emerald-600 font-black text-base animate-pulse">✓ Payment Received via {order.paid_by || 'Verified'}! Handing over your package at the counter.</p>;
            }
            if (order.status === 'ready') {
                return <p className="text-emerald-600 font-black text-base animate-pulse">🎉 Order is READY for Pickup! Show Order #{order.order_number || order.id.slice(0, 6)} at the counter.</p>;
            }
            if (order.status === 'preparing') {
                return <p className="text-orange-600 font-bold animate-pulse">Chefs are preparing your takeaway meal!</p>;
            }
            return <p className="text-neutral-700 font-medium animate-pulse">Takeaway order received! Preparing shortly...</p>;
        }

        // DINE IN
        if (order.status === 'served') return <p className="text-neutral-900 font-bold">Enjoy your meal! 😋</p>;
        if (order.status === 'ready') return <p className="text-emerald-600 font-bold">Your food is ready and being served to your table!</p>;
        if (order.status === 'preparing') return <p className="text-orange-600 font-bold animate-pulse">Chefs are preparing your meal!</p>;
        if (order.status === 'paid') return <p className="text-blue-600 font-bold">Payment Received by {order.paid_by || 'Staff'}. Thank you! 🙏</p>;
        return <p className="text-neutral-700 font-medium animate-pulse">Waiting for kitchen confirmation...</p>;
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

    const stepConfig = getStepsConfig();

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white p-4 items-center flex justify-between border-b border-gray-100 sticky top-0 z-20">
                <button onClick={() => router.push(`/${urlRestaurantId}/customer/menu/${tableNumber}`)} className="flex items-center gap-1 text-sm font-bold text-black hover:text-orange-500 transition-colors">
                    <LucideChevronLeft size={18} />
                    Menu
                </button>
                <div className="text-right">
                    <h1 className="text-sm font-black text-black uppercase tracking-wide">Order #{order.order_number || order.id.slice(0, 6)}</h1>
                    <p className="text-xs text-black font-semibold">
                        {isDelivery ? '🛵 Home Delivery' : isTakeaway ? '🛍️ Takeaway Pickup' : (() => {
                            const raw = order?.table_name || order?.table_number || tableNumber || '';
                            return raw.toLowerCase().startsWith('table') ? raw : `Table ${raw}`;
                        })()}
                    </p>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-36">

                {/* UNDO / QUEUED BANNER */}
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

                {/* Status Tracker */}
                {order.status !== 'queued' && (
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-6 relative">
                            {/* Connecting Line */}
                            <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -z-10 rounded-full"></div>
                            <div
                                className="absolute top-1/2 left-0 h-1 bg-gradient-to-r from-orange-500 to-emerald-500 -z-10 transition-all duration-500 rounded-full"
                                style={{ width: `${((stepConfig.currentStep - 1) / Math.max(1, stepConfig.totalSteps - 1)) * 100}%` }}
                            ></div>

                            {/* Steps */}
                            {stepConfig.steps.map((s, idx) => {
                                const isActive = stepConfig.currentStep >= s.step;
                                const isCurrent = stepConfig.currentStep === s.step;
                                return (
                                    <div key={idx} className="flex flex-col items-center gap-2 bg-white px-1">
                                        <div className={`size-10 rounded-full flex items-center justify-center transition-all duration-300 border-4 border-white shadow-sm ${
                                            isActive 
                                                ? s.color + ' text-white ' + (isCurrent ? 'scale-110 ring-2 ring-orange-400/40' : '') 
                                                : 'bg-gray-200 text-neutral-400'
                                        }`}>
                                            <s.icon size={16} />
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider text-center max-w-[65px] ${
                                            isActive ? 'text-black' : 'text-neutral-400'
                                        }`}>
                                            {s.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="text-center p-4 bg-gray-50 rounded-xl">
                            {getStatusMessage()}
                        </div>
                    </div>
                )}

                {/* Takeaway Pickup Info Card */}
                {isTakeaway && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-amber-100 relative overflow-hidden">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                                <LucideShoppingBag size={16} />
                                <span>Takeaway Counter Pickup</span>
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                Self Pickup
                            </span>
                        </div>
                        <div className="pt-3 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-neutral-500 font-medium">Pickup Token:</span>
                                <span className="text-sm font-black text-neutral-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                                    Order #{order.order_number || order.id.slice(0, 6)}
                                </span>
                            </div>
                            {(order as any).delivery_phone && (
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-neutral-500">Customer Contact:</span>
                                    <span className="font-semibold text-neutral-800">{(order as any).customer_name ? `${(order as any).customer_name} • ` : ''}{(order as any).delivery_phone}</span>
                                </div>
                            )}
                            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/60 text-xs text-amber-900 font-medium">
                                💡 Please present your Order # at the restaurant pickup counter when status shows <strong>Pickup Ready</strong>.
                            </div>
                        </div>
                    </div>
                )}

                {/* Delivery Info / Partner Card */}
                {isDelivery && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100 relative overflow-hidden">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-orange-600">
                                <LucideBike size={16} />
                                <span>Home Delivery</span>
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                                order.delivery_assignment?.status === 'DELIVERED'
                                    ? 'bg-green-100 text-green-700'
                                    : ['OUT_FOR_DELIVERY', 'PICKED_UP'].includes(order.delivery_assignment?.status || '')
                                    ? 'bg-emerald-500 text-white animate-pulse'
                                    : order.delivery_assignment?.status
                                    ? 'bg-orange-100 text-orange-700'
                                    : 'bg-neutral-100 text-neutral-600'
                            }`}>
                                {order.delivery_assignment?.status === 'OUT_FOR_DELIVERY' ? 'On The Way' :
                                 order.delivery_assignment?.status === 'PICKED_UP' ? 'Picked Up' :
                                 order.delivery_assignment?.status === 'DELIVERED' ? 'Delivered' :
                                 order.delivery_assignment?.status === 'ACCEPTED' ? 'Partner Assigned' :
                                 order.delivery_assignment?.status || 'Finding Partner'}
                            </span>
                        </div>

                        {order.delivery_assignment?.delivery_boy ? (
                            <div className="flex items-center justify-between pt-3">
                                <div className="flex items-center gap-3">
                                    <div className="relative size-12 rounded-full bg-neutral-100 border-2 border-orange-200 overflow-hidden flex-shrink-0 flex items-center justify-center font-black text-base text-neutral-700 shadow-sm">
                                        {order.delivery_assignment.delivery_boy.avatar_url ? (
                                            <img
                                                src={order.delivery_assignment.delivery_boy.avatar_url}
                                                alt={order.delivery_assignment.delivery_boy.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <span>{order.delivery_assignment.delivery_boy.name?.charAt(0)?.toUpperCase() || 'D'}</span>
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-neutral-900 leading-tight">
                                            {order.delivery_assignment.delivery_boy.name}
                                        </h4>
                                        <p className="text-xs text-neutral-500 font-medium mt-0.5">
                                            {order.delivery_assignment.delivery_boy.vehicle_type ? (
                                                <span className="capitalize">{order.delivery_assignment.delivery_boy.vehicle_type}</span>
                                            ) : 'Delivery Partner'}
                                            {order.delivery_assignment.delivery_boy.vehicle_number ? ` • ${order.delivery_assignment.delivery_boy.vehicle_number}` : ''}
                                        </p>
                                    </div>
                                </div>

                                {order.delivery_assignment.delivery_boy.mobile && (
                                    <a
                                        href={`tel:${order.delivery_assignment.delivery_boy.mobile}`}
                                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
                                    >
                                        <LucidePhone size={14} />
                                        <span>Call</span>
                                    </a>
                                )}
                            </div>
                        ) : (
                            <div className="pt-3">
                                <p className="text-xs text-neutral-600">
                                    Your food is being prepared. A delivery partner will be assigned once your meal is ready for packing.
                                </p>
                            </div>
                        )}

                        {order.delivery_address && (
                            <div className="mt-3 pt-2.5 border-t border-dashed border-gray-100">
                                <div className="flex items-start gap-1.5 text-xs text-neutral-600 font-medium">
                                    <LucideMapPin size={13} className="text-orange-500 flex-shrink-0 mt-0.5" />
                                    <span className="line-clamp-2">{formatAddress(order.delivery_address)}</span>
                                </div>
                                <a
                                    href={(order as any).delivery_lat && (order as any).delivery_lng
                                        ? `https://www.google.com/maps?q=${(order as any).delivery_lat},${(order as any).delivery_lng}`
                                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddress(order.delivery_address))}`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 underline mt-1.5 ml-4"
                                >
                                    <LucideNavigation size={11} />
                                    <span>View on Google Maps</span>
                                    <LucideExternalLink size={10} />
                                </a>
                            </div>
                        )}
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
                {(() => {
                    const ceil2 = (num: number) => {
                        const n = Number(num || 0);
                        const clean = Math.round(n * 1e8) / 1e8;
                        return Math.ceil(clean * 100) / 100;
                    };
                    const round2 = ceil2;
                    const formatAmount = (num: number) => ceil2(num).toFixed(2);

                    const calculatedCgst = (order.items || []).reduce((sum, item) => {
                        const rate = (item as any).cgst_percent ?? (item as any).cgst_percentage ?? (((item as any).tax_percent ?? (item as any).gst_percentage ?? 5) / 2);
                        return sum + ((Number(item.price) || Number((item as any).price_at_time) || 0) * (Number(item.quantity) || 1) * (rate / 100));
                    }, 0);
                    const calculatedSgst = (order.items || []).reduce((sum, item) => {
                        const rate = (item as any).sgst_percent ?? (item as any).sgst_percentage ?? (((item as any).tax_percent ?? (item as any).gst_percentage ?? 5) / 2);
                        return sum + ((Number(item.price) || Number((item as any).price_at_time) || 0) * (Number(item.quantity) || 1) * (rate / 100));
                    }, 0);

                    const cgstAmount = (order as any).cgst_amount != null && Number((order as any).cgst_amount) > 0
                        ? round2(Number((order as any).cgst_amount))
                        : round2(calculatedCgst);
                    const sgstAmount = (order as any).sgst_amount != null && Number((order as any).sgst_amount) > 0
                        ? round2(Number((order as any).sgst_amount))
                        : round2(calculatedSgst);

                    const sumCgstSgst = round2(cgstAmount + sgstAmount);
                    const gstAmount = sumCgstSgst > 0
                        ? sumCgstSgst
                        : ((order as any).gst_amount != null && Number((order as any).gst_amount) > 0
                            ? round2(Number((order as any).gst_amount))
                            : round2(calculatedCgst + calculatedSgst));

                    const deliveryFee = round2(Number(order.delivery_fee || 0));
                    const discountAmount = round2(Number(order.discount_amount || 0));

                    const itemSubtotal = round2(
                        order.items && order.items.length > 0
                            ? order.items.reduce((sum, item) => sum + ((Number(item.price) || Number((item as any).price_at_time) || 0) * (Number(item.quantity) || 1)), 0)
                            : Math.max(0, (Number(order.total_amount) || 0) - gstAmount - deliveryFee + discountAmount)
                    );

                    const finalTotal = round2(
                        order.total_amount != null && Number(order.total_amount) > 0
                            ? Number(order.total_amount) - discountAmount
                            : (itemSubtotal + gstAmount + deliveryFee - discountAmount)
                    );

                    const amountPaid = round2(Number(order.amount_paid || 0));
                    const balanceDue = round2(Math.max(0, finalTotal - amountPaid));

                    return (
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-2">
                            <div className="flex justify-between items-center text-sm font-medium text-black">
                                <span>Item Total</span>
                                <span>₹{formatAmount(itemSubtotal)}</span>
                            </div>

                            <div className="flex justify-between items-center text-sm font-medium text-black">
                                <span>GST / Taxes</span>
                                <span>₹{formatAmount(gstAmount)}</span>
                            </div>

                            {cgstAmount > 0 && sgstAmount > 0 && (
                                <div className="flex justify-between items-center text-[11px] text-gray-500 pl-2">
                                    <span>CGST + SGST</span>
                                    <span>₹{formatAmount(cgstAmount)} + ₹{formatAmount(sgstAmount)}</span>
                                </div>
                            )}

                            {deliveryFee > 0 && (
                                <div className="flex justify-between items-center text-sm font-medium text-black">
                                    <span>Delivery Fee</span>
                                    <span>₹{formatAmount(deliveryFee)}</span>
                                </div>
                            )}

                            {discountAmount > 0 && (
                                <div className="flex justify-between items-center text-green-600 font-bold text-sm">
                                    <span>🎫 Coupon Discount {order.coupon_code ? `(${order.coupon_code})` : ''}</span>
                                    <span>- ₹{formatAmount(discountAmount)}</span>
                                </div>
                            )}

                            <div className="flex justify-between items-center border-t border-gray-50 pt-2 mt-1">
                                <span className="font-bold text-black">Total</span>
                                <span className="font-black text-xl text-black">
                                    ₹{formatAmount(finalTotal)}
                                </span>
                            </div>

                            {amountPaid > 0 && (
                                <div className="flex justify-between items-center text-green-600">
                                    <span className="font-bold text-sm">Paid</span>
                                    <span className="font-black text-lg">- ₹{formatAmount(amountPaid)}</span>
                                </div>
                            )}

                            {amountPaid > 0 && balanceDue > 0 && (
                                <div className="flex justify-between items-center text-orange-600 pt-2 border-t border-gray-50">
                                    <span className="font-bold text-sm">Balance Due</span>
                                    <span className="font-black text-2xl">
                                        ₹{formatAmount(balanceDue)}
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })()}
        </main>

            {/* Actions - Floating above Bottom Nav */}
            <div 
                className="fixed left-0 w-full flex justify-center z-40 pointer-events-none"
                style={{ bottom: 'calc(4.85rem + env(safe-area-inset-bottom, 0px))' }}
            >
                <div className="w-full max-w-xs px-4 flex gap-3">
                    {hasQueuedItems ? (
                        <div className="flex gap-3 w-full pointer-events-auto">
                            <button
                                onClick={handleCancelQueuedItems}
                                className="flex-1 py-2.5 bg-red-100 text-red-600 font-bold rounded-xl hover:bg-red-200 active:scale-95 transition-all text-xs shadow-sm cursor-pointer"
                            >
                                Undo
                            </button>
                            <button
                                onClick={() => {
                                    OrderService.updateOrderStatus(orderId, urlRestaurantId, 'placed')
                                        .then(() => loadOrder())
                                        .catch(e => console.error('Failed to confirm', e));
                                }}
                                className="flex-1 py-2.5 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 active:scale-95 transition-all text-xs shadow-md shadow-green-500/20 cursor-pointer"
                            >
                                Confirm Now ({timeLeft}s)
                            </button>
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={() => router.push(`/${urlRestaurantId}/customer/menu/${tableNumber}`)}
                                className="flex-1 py-2.5 bg-white border border-neutral-200 text-black font-bold rounded-xl active:scale-95 transition-transform text-xs pointer-events-auto shadow-md cursor-pointer"
                            >
                                Add More Items
                            </button>
                            {isDineIn ? (
                                <button
                                    onClick={() => {
                                        setConfirmationModal({
                                            isOpen: true,
                                            title: 'Confirm Bill Request',
                                            message: `Are you sure you want to request the bill for Table ${tableNumber}? A waiter will bring your bill.`,
                                            confirmText: 'Request Bill',
                                            onConfirm: async () => {
                                                try {
                                                    if (tableNumber && orderRestaurantId) {
                                                        await OrderService.setTableAlert(tableNumber, 'bill_requested', orderRestaurantId);
                                                    }
                                                    closeConfirmationModal();
                                                    setIsBillRequested(true);
                                                } catch (e) {
                                                    console.error(e);
                                                    closeConfirmationModal();
                                                    toast.error('Failed to request bill');
                                                }
                                            }
                                        });
                                    }}
                                    className="flex-1 py-2.5 bg-neutral-900 text-white font-bold rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-1.5 text-xs pointer-events-auto shadow-md cursor-pointer"
                                >
                                    <span>Request Bill</span>
                                    <LucideReceipt size={14} className="text-white" />
                                </button>
                            ) : isDelivery && order.delivery_assignment?.delivery_boy?.mobile ? (
                                <a
                                    href={`tel:${order.delivery_assignment.delivery_boy.mobile}`}
                                    className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-1.5 text-xs pointer-events-auto shadow-md shadow-orange-500/20 cursor-pointer text-center"
                                >
                                    <LucidePhone size={14} />
                                    <span>Call Partner</span>
                                </a>
                            ) : null}
                        </>
                    )}
                </div>
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
