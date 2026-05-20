'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { OrderService, Order } from '@/app/services/orders';
import { ChefHat as LucideChefHat, Clock as LucideClock, CheckCircle2 as LucideCheckCircle2, ArrowRight as LucideArrowRight, X as LucideX } from 'lucide-react';
import Image from 'next/image';
import { getServiceRequestDetails, preloadServiceOptions, subscribeServiceOptionsCache } from '@/app/lib/service-utils';
import Timer from '@/app/components/Timer';
import { useRestaurantId } from '@/app/hooks/useRestaurantId';

// Standard "Ding" sound for notifications
const ALERT_SOUND_URL = '/sounds/alert.mp3';

interface ServiceRequest {
    id: number;
    table_id: number;
    tables: { table_number: string };
    request_type: string;
    request_status: string;
    created_at: string;
    quantity?: number;
    assigned_waiter_id?: string;
}



// --- Kitchen Ready Alert Component ---
const KitchenReadyAlert = ({ request, restaurantId, onAccept, onDismiss }: { request: ServiceRequest, restaurantId: string, onAccept: (id: number) => void, onDismiss: (id: number) => void }) => {
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const activeRef = useRef(true);
    const lastResolvedTableId = useRef<number | null>(null);

    useEffect(() => {
        console.log(`[KitchenReadyAlert] Effect running for request ${request.id}, table ${request.table_id}`);
        activeRef.current = true;
        
        // Only set loading if the table changed or we have no data
        if (lastResolvedTableId.current !== request.table_id || !order) {
            setLoading(true);
            setError(false);
        }

        const timer = setTimeout(() => {
            if (activeRef.current && loading) {
                console.warn("[KitchenReadyAlert] Loading timed out for request:", request.id);
                setLoading(false);
                setError(true);
            }
        }, 10000);

        OrderService.getActiveOrderForTable(request.table_id, restaurantId)
            .then((data) => {
                if (activeRef.current) {
                    console.log(`[KitchenReadyAlert] Order loaded for table ${request.table_id}`);
                    setOrder(data);
                    setLoading(false);
                    setError(false);
                    lastResolvedTableId.current = request.table_id;
                    clearTimeout(timer);
                }
            })
            .catch(err => {
                console.error("Failed to load order for alert:", err);
                if (activeRef.current) {
                    setLoading(false);
                    setError(true);
                    clearTimeout(timer);
                }
            });

        return () => { 
            console.log(`[KitchenReadyAlert] Cleanup for request ${request.id}`);
            activeRef.current = false;
            clearTimeout(timer);
        };
    }, [request.table_id, restaurantId]);

    const readyItems = order?.items?.filter((i: any) => i.status === 'ready') || [];
    const preparingItems = order?.items?.filter((i: any) => ['placed', 'preparing'].includes(i.status)) || [];

    // Loading State
    if (loading) {
        return (
            <motion.div
                layout
                initial={{ opacity: 0, scale: 0.8, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 50 }}
                className="md:max-w-sm w-full max-w-[90vw] bg-white text-black rounded-[2rem] shadow-2xl p-10 flex flex-col items-center justify-center font-sans mb-auto min-h-[250px] relative"
            >
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500 mb-4"></div>
                <p className="text-sm font-bold text-black uppercase tracking-widest animate-pulse">Syncing...</p>
                <button 
                    onClick={() => onDismiss(request.id)}
                    className="mt-8 text-[10px] font-bold text-black uppercase tracking-widest hover:text-black transition-colors"
                >
                    Dismiss if stuck
                </button>
            </motion.div>
        );
    }

    // No Order Found State (Fallback)
    if (!order) {
        return (
            <motion.div
                layout
                initial={{ opacity: 0, scale: 0.8, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 50 }}
                className="md:max-w-sm w-full max-w-[90vw] bg-white text-black rounded-[2rem] shadow-2xl p-8 flex flex-col items-center justify-center font-sans mb-auto text-center"
            >
                <div className="size-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4 text-black">
                    <LucideX size={32} />
                </div>
                <h3 className="text-xl font-bold mb-2">Order Not Found</h3>
                <p className="text-black text-sm mb-6">The kitchen update is ready but the order details couldn't be loaded.</p>
                <button
                    onClick={() => onDismiss(request.id)}
                    className="w-full py-3 bg-neutral-900 text-white font-bold rounded-xl active:scale-95 transition-all"
                >
                    Close Alert
                </button>
            </motion.div>
        );
    }

    if (readyItems.length === 0 && preparingItems.length === 0) {
        return (
            <motion.div
                layout
                initial={{ opacity: 0, scale: 0.8, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 50 }}
                className="md:max-w-sm w-full max-w-[90vw] bg-white text-black rounded-[2rem] shadow-2xl p-8 flex flex-col items-center justify-center font-sans mb-auto text-center"
            >
                <LucideCheckCircle2 size={48} className="text-green-500 mb-4" />
                <h3 className="text-2xl font-black mb-1">Items Served</h3>
                <p className="text-black font-medium mb-6 text-sm">System is cleaning up...</p>
                <button
                    onClick={() => onDismiss(request.id)}
                    className="w-full py-3 bg-neutral-100 hover:bg-neutral-200 active:scale-95 text-black font-bold rounded-xl transition-all"
                >
                    Close
                </button>
            </motion.div>
        );
    }

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            className="md:max-w-sm w-full max-w-[90vw] bg-white text-black rounded-[2rem] shadow-2xl overflow-hidden flex flex-col font-sans mb-auto"
        >
            {/* Header */}
            <div className="bg-green-500 p-6 flex justify-between items-start text-white relative overflow-hidden">
                <div className="absolute -right-4 -top-4 text-green-400 opacity-20 transform rotate-12">
                    <LucideChefHat size={120} />
                </div>
                <div className="relative z-10 text-left">
                    <div className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Kitchen Update</div>
                    <h3 className="text-3xl font-black leading-none">Order Ready</h3>
                </div>
                <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap z-10">
                    Table {request.tables?.table_number}
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6 max-h-[70vh]">
                {/* Ready Items */}
                {readyItems.length > 0 && (
                    <div className="space-y-3">
                        <div className="text-xs font-bold text-green-600 uppercase tracking-wider flex items-center gap-2">
                            <LucideCheckCircle2 size={16} />
                            Ready to Serve
                        </div>
                        {readyItems.map((item: any) => (
                            <div key={item.id} className="flex items-center gap-3 bg-green-50 p-2 rounded-xl border border-green-100">
                                <div className="relative size-12 rounded-lg overflow-hidden shrink-0 border border-green-200">
                                    {item.image_url ? (
                                        <Image
                                            src={item.image_url}
                                            alt={item.name}
                                            fill
                                            className="object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-green-200 flex items-center justify-center">
                                            <LucideChefHat size={20} className="text-green-700 opacity-50" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-black text-left text-sm leading-tight line-clamp-2">{item.name}</div>
                                </div>
                                <div className="bg-green-200 text-green-800 text-xs font-bold px-2 py-1 rounded-md shrink-0">x{item.quantity}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Preparing Items */}
                {preparingItems.length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-dashed border-gray-200">
                        <div className="text-xs font-bold text-orange-500 uppercase tracking-wider flex items-center gap-2">
                            <LucideClock size={16} />
                            Still Cooking
                        </div>
                        {preparingItems.map((item: any) => {
                            const prepTime = item.menu_items?.preparation_time || 15;
                            const created = new Date(item.created_at || order?.created_at || Date.now());
                            const target = new Date(created.getTime() + prepTime * 60000);
                            const diff = Math.max(0, Math.ceil((target.getTime() - Date.now()) / 60000));

                            return (
                                <div key={item.id} className="flex items-center gap-3 bg-orange-50 p-2 rounded-xl border border-orange-100 opacity-80">
                                    <div className="relative size-12 rounded-lg overflow-hidden shrink-0 border border-orange-200">
                                        {item.image_url ? (
                                            <Image
                                                src={item.image_url}
                                                alt={item.name}
                                                fill
                                                className="object-cover grayscale"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-orange-200 flex items-center justify-center">
                                                <LucideChefHat size={20} className="text-orange-700 opacity-50" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-black text-left text-sm leading-tight line-clamp-2">{item.name}</div>
                                    </div>
                                    <div className="text-xs font-mono font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded shrink-0">{diff}m left</div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="p-4 bg-gray-50 flex gap-3 border-t border-gray-100">
                <button
                    onClick={() => onDismiss(request.id)}
                    className="p-4 rounded-xl font-bold bg-white border border-gray-200 text-black hover:text-black transition-colors shadow-sm"
                >
                    <LucideX size={20} />
                </button>
                <button
                    onClick={() => onAccept(request.id)}
                    className="flex-1 py-4 bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-600/20 hover:bg-green-700 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                    <span>Pickup Now</span>
                    <LucideArrowRight size={18} />
                </button>
            </div>
        </motion.div>
    );
};

export default function WaiterAlertSystem() {
    const pathname = usePathname();
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const router = useRouter();
    const [alerts, setAlerts] = useState<ServiceRequest[]>([]);
    const [hiddenRequests, setHiddenRequests] = useState<Set<number>>(new Set());
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const prevCountRef = useRef(0);
    const isFirstLoad = useRef(true);
    const params = useParams();
    const staffMobile = params?.staffMobile as string;
    const [currentWaiter, setCurrentWaiter] = useState<any>(null);

    // Fetch logged-in waiter profile
    useEffect(() => {
        const fetchWaiter = async () => {
            if (restaurantId && staffMobile) {
                try {
                    const waiter = await OrderService.getStaffByMobile(staffMobile, restaurantId);
                    setCurrentWaiter(waiter);
                } catch (err) {
                    console.error('[WaiterAlertSystem] Failed to fetch waiter profile:', err);
                }
            }
        };
        fetchWaiter();
    }, [restaurantId, staffMobile]);

    // Initialize Audio
    useEffect(() => {
        audioRef.current = new Audio(ALERT_SOUND_URL);
        audioRef.current.load();
    }, []);

    // Preload service options from DB (for dynamic services)
    useEffect(() => {
        preloadServiceOptions();
        const sub = subscribeServiceOptionsCache();
        return () => { sub.unsubscribe(); };
    }, []);

    // Play sound on new alert (Check if any NEW ID exists that wasn't there before)
    const prevAlertIds = useRef<Set<number>>(new Set());

    useEffect(() => {
        const currentIds = new Set(alerts.map(a => a.id));

        // Find if any current ID is NOT in previous set
        const hasNewAlert = alerts.some(a => !prevAlertIds.current.has(a.id));

        if (hasNewAlert) {
            if (!isFirstLoad.current) {
                const playPromise = audioRef.current?.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.warn('Audio playback failed:', error);
                    });
                }
            }
        }

        // Update ref
        prevAlertIds.current = currentIds;
        prevCountRef.current = alerts.length; // Keep for fallback if needed

        if (alerts.length > 0) {
            isFirstLoad.current = false;
        }
    }, [alerts]);

    useEffect(() => {
        let active = true;
        let debounceTimer: NodeJS.Timeout;

        const fetchAlerts = async () => {
            if (!restaurantId || !active) return;
            try {
                const activeRequests = await OrderService.fetchActiveServiceRequests(restaurantId, currentWaiter?.id);
                if (active && activeRequests) {
                    setAlerts(activeRequests);
                }
            } catch (err) {
                console.error("[WaiterAlertSystem] Failed to fetch alerts:", err);
            }
        };

        const debouncedRefresh = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                if (active) fetchAlerts();
            }, 500);
        };

        if (!restaurantLoading) {
            fetchAlerts();
        }

        if (!restaurantId) return;

        let sub: { unsubscribe: () => void } | null = null;
        if (currentWaiter?.id) {
            console.log("[WaiterAlertSystem] Setting up subscriptions for:", restaurantId, "waiter:", currentWaiter.id);

            // 1. Subscribe to service_requests changes specific to this waiter
            sub = OrderService.subscribeToServiceRequests(restaurantId, (payload) => {
                console.log("[WaiterAlertSystem] Service Request Change:", payload.eventType);
                isFirstLoad.current = false;
                debouncedRefresh();
            }, currentWaiter.id);
        }

        // 2. Kitchen Ready: Subscribe to order_items status changes to auto-generate alerts
        const notifiedItemIds = new Set<string>();
        const itemSub = OrderService.subscribeToOrderItems(restaurantId, async (payload) => {
            if (!active) return;
            if (payload.eventType !== 'UPDATE' && payload.eventType !== 'INSERT') return;
            
            const newItem = payload.new as any;
            if (newItem?.status !== 'ready') return;

            const itemKey = String(newItem.id);
            if (notifiedItemIds.has(itemKey)) return;
            notifiedItemIds.add(itemKey);

            console.log("[WaiterAlertSystem] Order item ready, checking if we need to upsert alert:", newItem.id);

            // Fetch the parent order to get table_id
            const fullOrder = await OrderService.getOrderDetails(newItem.order_id, restaurantId).catch(() => null);
            if (!fullOrder || !active) return;

            const tableId = fullOrder.table_id;
            if (!tableId) return;

            // Submit an order_ready service request for this table
            // This ensures that even if the itemSub triggers multiple times, we only have one 'pending' alert per table
            try {
                await OrderService.submitServiceRequest(tableId, 'order_ready', restaurantId);
            } catch (err) {
                console.error("[WaiterAlertSystem] Failed to upsert order_ready alert:", err);
            }
        });

        return () => {
            console.log("[WaiterAlertSystem] Cleaning up subscriptions");
            active = false;
            clearTimeout(debounceTimer);
            if (sub) sub.unsubscribe();
            itemSub.unsubscribe();
        };
    }, [restaurantId, restaurantLoading, currentWaiter?.id]);

    const handleDismissGroup = async (requestIds: number[]) => {
        // Only Hide locally. Do NOT resolve in DB.
        setHiddenRequests(prev => {
            const next = new Set(prev);
            requestIds.forEach(id => next.add(id));
            return next;
        });
    };

    const handleAcceptGroup = async (requestIds: number[]) => {
        if (!restaurantId || !currentWaiter?.id) return;
        try {
            await Promise.all(requestIds.map(id => OrderService.acceptServiceRequest(id, restaurantId, currentWaiter.id)));
        } catch (err: any) {
            console.error("Failed to accept some requests:", err);
            alert(err.message || "Failed to accept service request.");
        }
    };

    const handleServedGroup = async (requestIds: number[]) => {
        if (!restaurantId) return;
        // 1. Mark as Delivered (DB)
        requestIds.forEach(id => OrderService.markRequestDelivered(id, restaurantId));

        // 2. Hide locally effectively immediately for UI feedback (optional, but good for "Done" feel)
        // OR rely on status change if we want to show "Checked" state?
        // User said: "after 2 seconds of delivery delete".
        // Let's keep it visible but maybe show "Completed" state for 2 seconds?
        // If we update status to 'delivered', the card will re-render with 'delivered' status?
        // If fetched alerts include 'delivered', yes.
        // Assuming fetchActiveServiceRequests includes 'delivered' (or we update local state optimistically).

        // 3. Auto Delete after 2 seconds
        setTimeout(() => {
            if (!restaurantId) return;
            requestIds.forEach(id => OrderService.completeServiceRequest(id, restaurantId));
        }, 2000);
    };

    const visibleAlerts = alerts.filter(req => {
        if (hiddenRequests.has(req.id)) return false;

        // Hide Order Ready alerts specifically on the order details page to avoid redundancy
        if (pathname.includes('/waiter/order/') && req.request_type === 'order_ready') {
            return false;
        }

        return true;
    });

    // Grouping Logic: Now includes STATUS
    const groupedAlerts = Object.values(
        visibleAlerts.reduce((acc, alert) => {
            // Group by Table + Type + Status
            // This splits "Pending" and "Accepted" requests into separate cards
            const key = `${alert.table_id}-${alert.request_type}-${alert.request_status}`;
            if (!acc[key]) {
                acc[key] = { ...alert, count: 0, ids: [] };
            }
            acc[key].count += (alert.quantity || 1);
            acc[key].ids.push(alert.id);
            return acc;
        }, {} as Record<string, ServiceRequest & { count: number; ids: number[] }>)
    );

    return (
        <AnimatePresence>
            {groupedAlerts.length > 0 && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none p-4 bg-black/80 backdrop-blur-xl">
                    <div className="w-full h-full flex items-center justify-center pointer-events-auto">
                        {groupedAlerts.map((request, index) => {
                            if (!restaurantId) return null;
                            // Show only the last one (stack effect) or loop?
                            // Code logic: `if (index !== groupedAlerts.length - 1) return null;`
                            // We should probably show specific one.
                            if (index !== groupedAlerts.length - 1) return null;

                            if (request.request_type === 'order_ready') {
                                return (
                                    <KitchenReadyAlert
                                        key={request.id}
                                        request={request}
                                        restaurantId={restaurantId}
                                        onAccept={() => {
                                            // Delete the service request from DB so it doesn't re-appear
                                            request.ids.forEach((id: number) => OrderService.completeServiceRequest(id, restaurantId));
                                            handleDismissGroup(request.ids);
                                            router.push(`/${restaurantId}/waiter/${staffMobile}/order/${request.table_id}`);
                                        }}
                                        onDismiss={() => {
                                            // Delete from DB so the popup doesn't re-appear on next fetch
                                            request.ids.forEach((id: number) => OrderService.completeServiceRequest(id, restaurantId));
                                            handleDismissGroup(request.ids);
                                        }}
                                    />
                                );
                            }

                            const details = getServiceRequestDetails(request.request_type);
                            const isAccepted = request.request_status === 'accepted';
                            const isDelivered = request.request_status === 'completed';

                            return (
                                <motion.div
                                    key={request.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.8, y: 100 }}
                                    animate={{
                                        opacity: 1,
                                        scale: 1,
                                        y: 0,
                                        transition: { type: "spring", stiffness: 300, damping: 25 },
                                        borderColor: isAccepted ? 'rgba(34, 197, 94, 0.5)' : 'rgba(255, 255, 255, 0.1)', // Green border if accepted
                                        backgroundColor: isDelivered ? '#10b981' : '#000000' // Green bg if delivered
                                    }}
                                    exit={{ opacity: 0, scale: 0.9, y: -20 }}
                                    className="relative w-[90vw] max-w-sm aspect-[4/5] bg-neutral-900 rounded-[2.5rem] p-6 shadow-2xl border border-white/10 overflow-hidden flex flex-col justify-between"
                                >
                                    {/* Animated Background Mesh */}
                                    <div className="absolute inset-0 overflow-hidden">
                                        <div className={`absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-30 ${details.color}`} />
                                        <div className={`absolute -bottom-20 -left-20 w-64 h-64 rounded-full blur-3xl opacity-20 ${details.color} animate-pulse`} />
                                    </div>

                                    {/* Header: Timer & Dismiss */}
                                    <div className="relative z-10 flex justify-between items-center w-full">
                                        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5">
                                            <LucideClock size={14} className="text-white/60" />
                                            <span className="text-xs font-bold text-white font-mono tracking-wider">
                                                <Timer startTime={request.created_at} variant="digital" />
                                            </span>
                                        </div>
                                        {/* Only show dismiss if not delivered/accepted? Or allow dismiss always? */}
                                        <button
                                            onClick={() => handleDismissGroup(request.ids)}
                                            className="size-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/20 text-white/40 hover:text-white transition-all active:scale-90"
                                        >
                                            <LucideX size={16} />
                                        </button>
                                    </div>

                                    {/* Center Content */}
                                    <div className="relative z-10 flex-grow flex flex-col items-center justify-center gap-6 py-4">

                                        {/* Image Container with Glow */}
                                        <div className="relative">
                                            <div className={`absolute inset-0 rounded-full blur-2xl opacity-40 ${details.color}`} />
                                            <div className="relative size-32 bg-white rounded-3xl overflow-hidden shadow-2xl ring-4 ring-white/10">
                                                {details.image ? (
                                                    <Image
                                                        src={details.image}
                                                        alt={details.label}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex items-center justify-center w-full h-full text-black">
                                                        <details.icon size={48} />
                                                    </div>
                                                )}
                                                {isDelivered && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-green-500/80 backdrop-blur-sm text-white">
                                                        <LucideCheckCircle2 size={48} className="animate-bounce" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Enhanced Quantity Badge */}
                                            {request.count > 1 && (
                                                <motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="absolute -top-2 -right-3 bg-white text-black font-black text-lg px-3 py-1 rounded-full shadow-xl shadow-black/20 border-2 border-neutral-900 z-20 flex items-center gap-0.5"
                                                >
                                                    <span className="text-xs opacity-50">x</span>
                                                    {request.count}
                                                </motion.div>
                                            )}
                                        </div>

                                        {/* Text Content */}
                                        <div className="text-center space-y-1">
                                            <h3 className="text-lg font-bold text-white/50 tracking-widest uppercase mb-1">Table {request.tables?.table_number || '?'}</h3>
                                            <h2 className={`text-4xl font-black text-white leading-none ${details.label.length > 10 ? 'text-3xl' : ''}`}>
                                                {details.label}
                                            </h2>
                                            {isAccepted && !isDelivered && (
                                                <p className="text-green-400 font-bold tracking-wider text-sm mt-2">ACCEPTED</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    <div className="relative z-10 w-full mt-auto">
                                        {!isDelivered ? (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        if (isAccepted) {
                                                            handleServedGroup(request.ids);
                                                        } else {
                                                            handleAcceptGroup(request.ids);
                                                        }
                                                    }}
                                                    className={`group relative w-full py-4 rounded-2xl ${isAccepted ? 'bg-green-500 text-white' : 'bg-white text-black'} font-black text-lg uppercase tracking-widest overflow-hidden shadow-lg shadow-white/10 active:scale-[0.98] transition-transform`}
                                                >
                                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" />
                                                    <span className="relative z-10 flex items-center justify-center gap-2">
                                                        {isAccepted ? 'Mark as Served' : 'Accept Request'}
                                                        {!isAccepted && <LucideArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />}
                                                        {isAccepted && <LucideCheckCircle2 size={20} />}
                                                    </span>
                                                </button>
                                                {!isAccepted && (
                                                    <button
                                                        onClick={() => handleDismissGroup(request.ids)}
                                                        className="w-full mt-3 py-2 text-xs font-bold text-white/20 hover:text-white/50 transition-colors uppercase tracking-widest"
                                                    >
                                                        Dismiss for now
                                                    </button>
                                                )}
                                            </>
                                        ) : (
                                            <button className="w-full py-4 rounded-2xl bg-white/20 text-white font-black text-lg uppercase tracking-widest cursor-default">
                                                Completed
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}

                        {groupedAlerts.length > 1 && (
                            <div className="absolute bottom-10 text-white/50 text-sm font-bold uppercase tracking-widest bg-black/50 px-4 py-2 rounded-full backdrop-blur">
                                {groupedAlerts.length - 1} more types of alerts...
                            </div>
                        )}
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
}
