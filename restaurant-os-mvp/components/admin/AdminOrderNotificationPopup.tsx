'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
    ShoppingBag, 
    Truck, 
    X, 
    Minimize2, 
    ArrowRight, 
    Clock, 
    MapPin, 
    User, 
    Phone, 
    ChevronLeft, 
    ChevronRight, 
    Maximize2,
    BellRing,
    Sparkles
} from 'lucide-react';
import { OrderService } from '@/services/orders.service';
import { RestaurantService } from '@/services/restaurant.service';
import { formatCurrency, formatAddress } from '@/lib/utils';

export interface OrderNotificationItem {
    id: string;
    order_number?: number;
    order_type: 'TAKEAWAY' | 'DELIVERY';
    total_amount: number;
    created_at: string;
    customer_name?: string | null;
    customer_phone?: string | null;
    delivery_address?: string | null;
    status: string;
}

interface AdminOrderNotificationPopupProps {
    restaurantCode: string;
}

/**
 * Synthetic double-chime fallback using Web Audio API in case audio file loading
 * is blocked by browser autoplay policies or missing assets.
 */
function playSyntheticChime() {
    try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;
        // Tone 1: 587.33 Hz (D5)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now);
        gain1.gain.setValueAtTime(0.2, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.35);

        // Tone 2: 880 Hz (A5) slightly delayed
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, now + 0.12);
        gain2.gain.setValueAtTime(0.25, now + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.12);
        osc2.stop(now + 0.55);
    } catch (_) {
        // Audio playback failures should never interrupt application flow
    }
}

function playNotificationSound() {
    try {
        const audio = new Audio('/sounds/alert.mp3');
        audio.volume = 0.85;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {
                playSyntheticChime();
            });
        }
    } catch (_) {
        playSyntheticChime();
    }
}

export default function AdminOrderNotificationPopup({ restaurantCode }: AdminOrderNotificationPopupProps) {
    const router = useRouter();
    const [queue, setQueue] = useState<OrderNotificationItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isMinimized, setIsMinimized] = useState(false);

    // Refs for deduplication and lifetime tracking
    const seenIdsRef = useRef<Set<string>>(new Set());
    const mountTimeRef = useRef<number>(Date.now());
    const audioDebounceRef = useRef<number>(0);

    // Play chime with debounce to prevent ear-fatigue when multiple events fire rapidly
    const triggerAudioAlert = useCallback(() => {
        const now = Date.now();
        if (now - audioDebounceRef.current > 1500) {
            audioDebounceRef.current = now;
            playNotificationSound();
        }
    }, []);

    // Handle new incoming order from Realtime
    const handleIncomingOrder = useCallback((order: any) => {
        if (!order || !order.id) return;

        // Strict tenant guard: ensure order belongs to this restaurant
        // (OrderService.subscribeToOrders also isolates, but defense in depth)
        const orderId = String(order.id);
        if (seenIdsRef.current.has(orderId)) return;

        const rawType = String(order.order_type || '').toUpperCase();
        const isTakeaway = rawType === 'TAKEAWAY';
        const isDelivery = rawType === 'DELIVERY';

        if (!isTakeaway && !isDelivery) return;

        const status = String(order.status || '').toLowerCase();
        // Only trigger popup for active/new incoming orders
        if (['served', 'completed', 'cancelled', 'rejected'].includes(status)) {
            return;
        }

        // Avoid popups for historical orders that were placed long before this session
        const createdAt = order.created_at ? new Date(order.created_at).getTime() : Date.now();
        if (createdAt < mountTimeRef.current - 3 * 60 * 1000) {
            seenIdsRef.current.add(orderId);
            return;
        }

        // Mark as seen
        seenIdsRef.current.add(orderId);

        const notificationItem: OrderNotificationItem = {
            id: orderId,
            order_number: order.order_number != null ? Number(order.order_number) : undefined,
            order_type: isDelivery ? 'DELIVERY' : 'TAKEAWAY',
            total_amount: Number(order.total_amount || 0),
            created_at: order.created_at || new Date().toISOString(),
            customer_name: order.customer_name || null,
            customer_phone: order.customer_phone || order.delivery_phone || null,
            delivery_address: order.delivery_address || null,
            status: order.status || 'placed',
        };

        setQueue(prev => {
            if (prev.some(item => item.id === orderId)) return prev;
            return [notificationItem, ...prev];
        });

        // Always bring back popup to attention on brand new order arrival
        setIsMinimized(false);
        setCurrentIndex(0);

        // Sound alert
        triggerAudioAlert();
    }, [triggerAudioAlert]);

    // Setup Realtime listener across all Admin Panel sections
    useEffect(() => {
        if (!restaurantCode) return;
        let isMounted = true;
        let subHandle: { unsubscribe: () => void } | null = null;

        const initRealtime = async () => {
            try {
                const resolvedId = await RestaurantService.resolveRestaurantId(restaurantCode);
                if (!isMounted) return;
                const activeId = resolvedId || restaurantCode;

                subHandle = OrderService.subscribeToOrders(activeId, (payload) => {
                    if (!isMounted) return;
                    if (payload.eventType === 'INSERT') {
                        handleIncomingOrder(payload.new);
                    } else if (payload.eventType === 'UPDATE') {
                        const newRec = payload.new as any;
                        const oldRec = payload.old as any;
                        // Trigger if an order was updated into Takeaway/Delivery or became 'placed'
                        if (newRec && oldRec) {
                            const oldStatus = String(oldRec.status || '').toLowerCase();
                            const newStatus = String(newRec.status || '').toLowerCase();
                            const wasNotPlaced = oldStatus !== 'placed' && oldStatus !== 'queued';
                            const isNowPlaced = newStatus === 'placed' || newStatus === 'queued';
                            if (wasNotPlaced && isNowPlaced) {
                                handleIncomingOrder(newRec);
                            }
                        }
                    }
                });
            } catch (err) {
                console.warn('[AdminOrderNotificationPopup] Realtime subscription init warning:', err);
            }
        };

        initRealtime();

        return () => {
            isMounted = false;
            if (subHandle) {
                subHandle.unsubscribe();
            }
        };
    }, [restaurantCode, handleIncomingOrder]);

    // View Order Action
    const handleViewOrder = (order: OrderNotificationItem) => {
        // Remove from active queue
        setQueue(prev => prev.filter(item => item.id !== order.id));

        // Navigate to the appropriate section:
        // Takeaway -> Takeaway Orders with orderId to auto-open details
        // Delivery -> Delivery Orders with orderId to auto-open details
        const channelParam = order.order_type === 'DELIVERY' ? 'DELIVERY' : 'TAKEAWAY';
        const targetUrl = `/${restaurantCode}/admin/orders?channel=${channelParam}&orderId=${encodeURIComponent(order.id)}`;

        router.push(targetUrl);
    };

    // Dismiss current order from popup
    const handleDismissCurrent = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (queue.length === 0) return;
        const currentOrder = queue[currentIndex];
        if (!currentOrder) return;

        setQueue(prev => {
            const next = prev.filter(item => item.id !== currentOrder.id);
            if (currentIndex >= next.length && next.length > 0) {
                setCurrentIndex(next.length - 1);
            }
            return next;
        });
    };

    // Close all notifications
    const handleDismissAll = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setQueue([]);
        setCurrentIndex(0);
        setIsMinimized(false);
    };

    // Handle index bounds when queue changes
    useEffect(() => {
        if (currentIndex >= queue.length && queue.length > 0) {
            setCurrentIndex(queue.length - 1);
        }
    }, [queue.length, currentIndex]);

    if (queue.length === 0) return null;

    const currentOrder = queue[currentIndex] || queue[0];
    if (!currentOrder) return null;

    const isDelivery = currentOrder.order_type === 'DELIVERY';
    const orderNumberDisplay = currentOrder.order_number 
        ? `#${currentOrder.order_number}` 
        : `#${currentOrder.id.slice(0, 6).toUpperCase()}`;

    // Relative timestamp formatting
    const getFormattedTime = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
            if (diffSeconds < 60) return 'Just now';
            if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (_) {
            return 'Just now';
        }
    };

    return (
        <>
            {/* ══════════════════════════════════════════════════════════════════════════ */}
            {/* 1. PRIMARY VIEW: VERTICALLY CENTERED POPUP CARD                          */}
            {/* ══════════════════════════════════════════════════════════════════════════ */}
            <AnimatePresence>
                {!isMinimized && (
                    <div 
                        key="admin-order-modal-overlay"
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/55 backdrop-blur-md select-none"
                    >
                        <motion.div
                            key={`admin-order-modal-card-${currentOrder.id}`}
                            initial={{ opacity: 0, scale: 0.92, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.94, y: 12 }}
                            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                            className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] border border-neutral-200/80 dark:border-zinc-800 overflow-hidden text-neutral-900 dark:text-neutral-100"
                        >
                            {/* Decorative Top Accent Bar */}
                            <div 
                                className={`h-2 w-full ${
                                    isDelivery 
                                        ? 'bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500' 
                                        : 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500'
                                }`} 
                            />

                            {/* Header Section */}
                            <div className="px-6 pt-5 pb-3">
                                <div className="flex items-center justify-between gap-2">
                                    {/* Left: New Order Pulse + Order Type Pill */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-[11px] font-black tracking-wider uppercase">
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600" />
                                            </span>
                                            New Order
                                        </div>

                                        <div 
                                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-xs ${
                                                isDelivery
                                                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/80'
                                                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/80'
                                            }`}
                                        >
                                            {isDelivery ? <Truck size={14} className="stroke-[2.5]" /> : <ShoppingBag size={14} className="stroke-[2.5]" />}
                                            <span>{isDelivery ? 'Delivery' : 'Takeaway'}</span>
                                        </div>
                                    </div>

                                    {/* Right: Window Controls (Minimize & Dismiss) */}
                                    <div className="flex items-center gap-1">
                                        {/* Minimize Button */}
                                        <button
                                            type="button"
                                            onClick={() => setIsMinimized(true)}
                                            title="Minimize popup"
                                            className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                                        >
                                            <Minimize2 size={16} />
                                        </button>

                                        {/* Close Button */}
                                        <button
                                            type="button"
                                            onClick={handleDismissCurrent}
                                            title="Dismiss notification"
                                            className="p-1.5 rounded-xl text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                        >
                                            <X size={17} />
                                        </button>
                                    </div>
                                </div>

                                {/* Order ID and Timestamp Row */}
                                <div className="mt-4 flex items-baseline justify-between gap-3">
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Order Identifier</p>
                                        <h3 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">
                                            {orderNumberDisplay}
                                        </h3>
                                    </div>

                                    <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-zinc-800/80 px-2.5 py-1 rounded-xl">
                                        <Clock size={13} className="text-neutral-400" />
                                        <span>{getFormattedTime(currentOrder.created_at)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="h-px bg-neutral-100 dark:bg-zinc-800/80 mx-6" />

                            {/* Card Body: Compact Information (NO Full Menu Items!) */}
                            <div className="px-6 py-4 space-y-3.5">
                                {/* Bill Amount Card */}
                                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-neutral-50 dark:bg-zinc-800/40 border border-neutral-100 dark:border-zinc-800">
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Total Order Amount</p>
                                        <p className="text-xl font-black text-neutral-900 dark:text-white mt-0.5">
                                            {formatCurrency(currentOrder.total_amount)}
                                        </p>
                                    </div>
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                        isDelivery 
                                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' 
                                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                    }`}>
                                        <Sparkles size={20} />
                                    </div>
                                </div>

                                {/* Customer Details / Address Card */}
                                <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-zinc-800/40 border border-neutral-100 dark:border-zinc-800 space-y-2 text-xs">
                                    {currentOrder.customer_name || currentOrder.customer_phone ? (
                                        <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
                                            <User size={14} className="text-neutral-400 flex-shrink-0" />
                                            <span className="font-bold truncate">
                                                {currentOrder.customer_name || 'Guest Customer'}
                                            </span>
                                            {currentOrder.customer_phone && (
                                                <>
                                                    <span className="text-neutral-300 dark:text-neutral-600">•</span>
                                                    <span className="text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                                                        <Phone size={12} className="text-neutral-400" />
                                                        {currentOrder.customer_phone}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    ) : null}

                                    {isDelivery ? (
                                        <div className="flex items-start gap-2 text-neutral-600 dark:text-neutral-300">
                                            <MapPin size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
                                            <span className="line-clamp-2 leading-relaxed text-[11px]">
                                                {formatAddress(currentOrder.delivery_address) || 'Delivery address provided'}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
                                            <ShoppingBag size={14} className="text-amber-500 flex-shrink-0" />
                                            <span className="font-semibold text-[11px]">
                                                Direct pickup at takeaway counter
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Multiple Orders Queue Navigation (if > 1 in queue) */}
                            {queue.length > 1 && (
                                <div className="px-6 py-2 bg-neutral-100/60 dark:bg-zinc-800/40 border-t border-neutral-100 dark:border-zinc-800 flex items-center justify-between text-xs font-bold text-neutral-500">
                                    <span className="flex items-center gap-1.5">
                                        <BellRing size={13} className="text-orange-500" />
                                        <span>Order {currentIndex + 1} of {queue.length} pending</span>
                                    </span>

                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            disabled={currentIndex === 0}
                                            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                                            className="p-1 rounded-lg hover:bg-neutral-200 dark:hover:bg-zinc-700 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
                                            title="Previous order"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            disabled={currentIndex === queue.length - 1}
                                            onClick={() => setCurrentIndex(prev => Math.min(queue.length - 1, prev + 1))}
                                            className="p-1 rounded-lg hover:bg-neutral-200 dark:hover:bg-zinc-700 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
                                            title="Next order"
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Modal Actions */}
                            <div className="p-6 pt-3 pb-5 bg-neutral-50/50 dark:bg-zinc-900/50 border-t border-neutral-100 dark:border-zinc-800/80 flex items-center gap-3">
                                {/* Secondary: Minimize */}
                                <button
                                    type="button"
                                    onClick={() => setIsMinimized(true)}
                                    className="flex-1 py-3 px-4 rounded-2xl text-xs font-bold text-neutral-600 dark:text-neutral-300 bg-white dark:bg-zinc-800 hover:bg-neutral-100 dark:hover:bg-zinc-700 border border-neutral-200 dark:border-zinc-700 transition-all cursor-pointer shadow-xs"
                                >
                                    Minimize
                                </button>

                                {/* Primary: View Order */}
                                <button
                                    type="button"
                                    onClick={() => handleViewOrder(currentOrder)}
                                    className={`flex-[1.6] py-3 px-5 rounded-2xl text-xs font-black text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                                        isDelivery
                                            ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 shadow-blue-500/20 active:scale-[0.98]'
                                            : 'bg-gradient-to-r from-amber-500 via-orange-600 to-rose-600 hover:from-amber-600 hover:to-orange-700 shadow-orange-500/20 active:scale-[0.98]'
                                    }`}
                                >
                                    <span>View Order</span>
                                    <ArrowRight size={15} className="stroke-[2.5]" />
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ══════════════════════════════════════════════════════════════════════════ */}
            {/* 2. MINIMIZED FLOATING PILL (Docked in Bottom-Right Corner)                 */}
            {/* ══════════════════════════════════════════════════════════════════════════ */}
            <AnimatePresence>
                {isMinimized && (
                    <motion.div
                        key="admin-order-minimized-pill"
                        initial={{ opacity: 0, y: 30, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        transition={{ type: 'spring', damping: 24, stiffness: 300 }}
                        className="fixed bottom-6 right-6 z-[9990] max-w-sm"
                    >
                        <div 
                            onClick={() => setIsMinimized(false)}
                            className={`p-3.5 pr-4 rounded-2xl bg-white dark:bg-zinc-900 border shadow-xl flex items-center gap-3 cursor-pointer group hover:scale-[1.02] transition-all ${
                                isDelivery 
                                    ? 'border-blue-400/80 shadow-blue-500/15' 
                                    : 'border-orange-400/80 shadow-orange-500/15'
                            }`}
                        >
                            {/* Icon with pulsing indicator */}
                            <div className="relative">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-sm ${
                                    isDelivery 
                                        ? 'bg-gradient-to-br from-blue-500 to-indigo-600' 
                                        : 'bg-gradient-to-br from-amber-500 to-orange-600'
                                }`}>
                                    {isDelivery ? <Truck size={18} /> : <ShoppingBag size={18} />}
                                </div>
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 text-[8px] font-black text-white items-center justify-center">
                                        {queue.length}
                                    </span>
                                </span>
                            </div>

                            {/* Label */}
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-500">
                                        New {currentOrder.order_type === 'DELIVERY' ? 'Delivery' : 'Takeaway'}
                                    </span>
                                </div>
                                <p className="text-xs font-black text-neutral-900 dark:text-white truncate">
                                    {orderNumberDisplay} • {formatCurrency(currentOrder.total_amount)}
                                </p>
                            </div>

                            {/* Expand Control */}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsMinimized(false);
                                }}
                                className="p-2 rounded-xl bg-neutral-100 dark:bg-zinc-800 text-neutral-600 dark:text-neutral-300 group-hover:bg-orange-500 group-hover:text-white transition-colors"
                                title="Expand Order Notification"
                            >
                                <Maximize2 size={14} />
                            </button>

                            {/* Dismiss Control */}
                            <button
                                type="button"
                                onClick={handleDismissAll}
                                className="p-2 rounded-xl text-neutral-400 hover:text-rose-500 hover:bg-neutral-100 dark:hover:bg-zinc-800 transition-colors"
                                title="Dismiss all"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
