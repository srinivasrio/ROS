'use client';

import { useState, useEffect, useRef, Component, type ErrorInfo, type ReactNode } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { OrderService, type Order, type OrderStatus, type TableMergeGroup } from '@/services/orders.service';
import KitchenTicket from '@/components/kitchen/KitchenTicket';
import { 
    Table as LucideTable, 
    ChevronDown as LucideChevronDown, 
    ChefHat as LucideChefHat, 
    CheckCircle as LucideCheckCircle, 
    Utensils as LucideUtensils, 
    Clock as LucideClock,
    Volume2,
    VolumeX,
    Sparkles,
    AlertCircle
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { UserService } from '@/services/users.service';
import { useRestaurantId } from '@/hooks/useRestaurantId';
import { getCached, setCache } from '@/lib/data-cache';
import { toast } from 'sonner';
import { showWarningPopup } from '@/components/shared/WarningPopupCard';

interface OrderKanbanBoardProps {
    isReadOnly?: boolean;
    title?: string;
    density?: 'compact' | 'comfortable';
}

export default function OrderKanbanBoard({ 
    isReadOnly = false, 
    title = 'Kitchen Display System', 
    density = 'comfortable' 
}: OrderKanbanBoardProps) {
    const params = useParams();
    const urlRestaurantCode = (params?.restaurantCode as string) || '';
    const { restaurantId, loading: profileLoading, branchId } = useRestaurantId();
    const activeResId = restaurantId || urlRestaurantCode;
    const cacheKey = `kds-${activeResId}${branchId ? `-${branchId}` : ''}`;
    
    const [orders, setOrders] = useState<Order[]>([]);
    const [mergeGroups, setMergeGroups] = useState<TableMergeGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [audioBlocked, setAudioBlocked] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Hydrate from client cache safely after mount to prevent hydration mismatch crashes
        try {
            const cached = getCached<any>(cacheKey) || (urlRestaurantCode ? getCached<any>(`kds-${urlRestaurantCode}`) : null);
            if (cached) {
                if (Array.isArray(cached.orders)) setOrders(cached.orders);
                if (Array.isArray(cached.mergeGroups)) setMergeGroups(cached.mergeGroups);
                setLoading(false);
            }
        } catch (err) {
            console.warn('[KDS Cache Rehydration Warning]:', err);
        }
    }, [cacheKey, urlRestaurantCode]);
    
    const currentProfileRef = useRef<any>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const alertedOrderIds = useRef<Set<string>>(new Set());
    const isInitialLoad = useRef(true);

    useEffect(() => {
        if (restaurantId) {
            UserService.getCurrentProfile(restaurantId).then(p => {
                currentProfileRef.current = p;
            }).catch(console.error);
        }
    }, [restaurantId]);

    // Audio Playback Handler
    const playAlertSound = () => {
        try {
            if (!audioRef.current) {
                audioRef.current = new Audio('/sounds/alert.mp3');
            }
            audioRef.current.currentTime = 0;
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    setAudioBlocked(true);
                });
            }
        } catch {
            setAudioBlocked(true);
        }
    };

    const enableAudio = () => {
        try {
            if (!audioRef.current) {
                audioRef.current = new Audio('/sounds/alert.mp3');
            }
            audioRef.current.play().then(() => {
                audioRef.current?.pause();
                if (audioRef.current) audioRef.current.currentTime = 0;
                setAudioBlocked(false);
                toast.success('Audio alerts active for new incoming tickets');
            }).catch(() => {
                setAudioBlocked(true);
            });
        } catch {
            setAudioBlocked(true);
        }
    };

    // Track incoming orders and trigger audio alerts
    useEffect(() => {
        if (loading || !mounted) return;

        const safeOrders = Array.isArray(orders) ? orders.filter(Boolean) : [];

        if (isInitialLoad.current) {
            safeOrders.forEach(o => {
                if (o?.id) alertedOrderIds.current.add(String(o.id));
            });
            isInitialLoad.current = false;
            return;
        }

        const incomingOrders = safeOrders.filter(o => o && (o.status === 'placed' || o.status === 'queued'));
        let hasNew = false;
        incomingOrders.forEach(o => {
            const idStr = String(o?.id || '');
            if (idStr && !alertedOrderIds.current.has(idStr)) {
                alertedOrderIds.current.add(idStr);
                hasNew = true;
            }
        });

        if (hasNew) {
            playAlertSound();
            toast.info('New incoming order ticket received!', {
                icon: '🔔',
                duration: 4000
            });
        }
    }, [orders, loading, mounted]);

    // Initial Fetch & Real-time Subscription
    useEffect(() => {
        const effectiveRestaurantId = restaurantId || urlRestaurantCode;
        if (!effectiveRestaurantId) return;

        let isFetching = false;
        let pendingFetch = false;
        let debounceTimer: NodeJS.Timeout | null = null;

        const loadOrders = async () => {
            if (!effectiveRestaurantId || isFetching) {
                if (isFetching) pendingFetch = true;
                return;
            }
            isFetching = true;
            try {
                const [ordersRes, groupsRes] = await Promise.allSettled([
                    OrderService.fetchActiveOrders(effectiveRestaurantId, undefined, branchId || undefined),
                    OrderService.fetchMergeGroups(effectiveRestaurantId, undefined, branchId || undefined)
                ]);
                const finalOrders = ordersRes.status === 'fulfilled' ? (ordersRes.value || []) : [];
                const finalGroups = groupsRes.status === 'fulfilled' ? (groupsRes.value || []) : [];

                if (ordersRes.status === 'fulfilled') {
                    setOrders(finalOrders);
                } else {
                    const msg = ordersRes.reason?.message || ordersRes.reason?.details || String(ordersRes.reason);
                    console.error('Failed to load orders:', msg);
                }
                if (groupsRes.status === 'fulfilled') {
                    setMergeGroups(finalGroups);
                } else {
                    const msg = groupsRes.reason?.message || groupsRes.reason?.details || String(groupsRes.reason);
                    console.error('Failed to load merge groups:', msg);
                }
                if (effectiveRestaurantId && (ordersRes.status === 'fulfilled' || groupsRes.status === 'fulfilled')) {
                    setCache(cacheKey, { orders: finalOrders, mergeGroups: finalGroups });
                }
            } catch (err: any) {
                console.error('Failed to load orders:', err?.message || err?.details || String(err));
            } finally {
                setLoading(false);
                isFetching = false;
                if (pendingFetch) {
                    pendingFetch = false;
                    debouncedLoadOrders();
                }
            }
        };

        const debouncedLoadOrders = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                loadOrders();
            }, 1000);
        };

        const handleOnline = () => {
            debouncedLoadOrders();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                debouncedLoadOrders();
            }
        };

        window.addEventListener('online', handleOnline);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        loadOrders();

        // Safety fallback heartbeat (ensures KDS tablet receives orders even across network hiccups)
        const safetyInterval = setInterval(() => {
            debouncedLoadOrders();
        }, 8000);

        const subscription = OrderService.subscribeToOrders(effectiveRestaurantId, (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
                debouncedLoadOrders();
            } else if (payload.eventType === 'UPDATE') {
                const updatedOrder = payload.new as any;
                if (!updatedOrder) return;
                if (branchId && updatedOrder.branch_id && updatedOrder.branch_id !== branchId) {
                    setOrders(prev => prev.filter(o => o.id !== updatedOrder.id));
                    return;
                }
                setOrders(prev => {
                    if (updatedOrder.is_completed || !['queued', 'placed', 'preparing', 'ready', 'served', 'paid'].includes(updatedOrder.status)) {
                        return prev.filter(o => o.id !== updatedOrder.id);
                    }
                    const exists = prev.some(o => o.id === updatedOrder.id);
                    if (!exists) {
                        debouncedLoadOrders();
                        return prev;
                    }
                    return prev.map(o => {
                        if (o.id === updatedOrder.id) {
                            return {
                                ...o,
                                ...updatedOrder,
                                waiter_name: o.waiter_name,
                                table_number: o.table_number,
                                items: o.items
                            };
                        }
                        return o;
                    });
                });
            }
        });

        const itemSubscription = OrderService.subscribeToOrderItems(effectiveRestaurantId, (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
                debouncedLoadOrders();
            } else if (payload.eventType === 'UPDATE') {
                const updatedItem = payload.new as any;
                if (!updatedItem) return;
                setOrders(prev => {
                    const hasItem = prev.some(o => o.id === updatedItem.order_id && o.items?.some(item => item.id === String(updatedItem.id)));
                    if (!hasItem) {
                        debouncedLoadOrders();
                        return prev;
                    }
                    return prev.map(o => {
                        if (o.id === updatedItem.order_id) {
                            const updatedItems = (o.items || []).map(item => {
                                if (item.id === String(updatedItem.id)) {
                                    return {
                                        ...item,
                                        ...updatedItem,
                                        id: String(updatedItem.id),
                                        name: item.name,
                                        image_url: item.image_url
                                    };
                                }
                                return item;
                            });
                            return {
                                ...o,
                                items: updatedItems
                            };
                        }
                        return o;
                    });
                });
            }
        });

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            clearInterval(safetyInterval);
            window.removeEventListener('online', handleOnline);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            subscription.unsubscribe();
            itemSubscription.unsubscribe();
        };
    }, [restaurantId, urlRestaurantCode, branchId]);

    const getEffectiveOrderStatus = (order: Order): OrderStatus => {
        if (!order) return 'placed';
        const activeItems = (order.items || []).filter(item => item && item.status !== 'cancelled');
        if (activeItems.length === 0) {
            return (order.status === 'queued' ? 'placed' : (order.status as OrderStatus)) || 'placed';
        }

        const itemStatuses = activeItems.map(i => (i?.status ? String(i.status).toLowerCase() : ''));

        // 1. First priority: Even ONE item in incoming -> order belongs in Incoming
        if (itemStatuses.some(s => s === 'placed' || s === 'queued' || s === 'incoming')) {
            return 'placed';
        }

        // 2. Second priority: If ANY item is preparing -> order belongs in Preparing
        if (itemStatuses.some(s => s === 'preparing' || s === 'cooking')) {
            return 'preparing';
        }

        // 3. Third priority: If ANY item is ready -> order belongs in Ready
        if (itemStatuses.some(s => s === 'ready')) {
            return 'ready';
        }

        // 4. Last priority: If ALL items are served (or paid) -> order belongs in Served
        if (itemStatuses.every(s => s === 'served' || s === 'paid')) {
            return 'served';
        }

        if (order.status === 'queued') return 'placed';
        return (order.status as OrderStatus) || 'placed';
    };

    const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
        if (isReadOnly || !restaurantId) return;
        
        // Chef in KDS cannot mark served - only waiter can mark served
        if (newStatus === 'served') {
            showWarningPopup({
                title: 'Action Restricted',
                message: 'Only waiters can mark orders as served after delivering to the customer.',
                type: 'restriction',
                dismissText: 'Dismiss'
            });
            return;
        }

        // Optimistic update with state snapshot for rollback
        const prevOrders = [...orders];
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        
        try {
            const staffId = currentProfileRef.current?.id;
            await OrderService.updateOrderStatus(orderId, restaurantId, newStatus, staffId);
        } catch (err: any) {
            setOrders(prevOrders);
            showWarningPopup({
                title: 'Order Status Update Failed',
                message: err?.message || 'Failed to update order status. Rolling back changes.',
                type: 'error',
                dismissText: 'Dismiss'
            });
        }
    };

    const handleItemStatusChange = async (itemId: string, newStatus: OrderStatus) => {
        if (isReadOnly || !restaurantId) return;

        // Chef in KDS cannot mark served - only waiter can mark served
        if (newStatus === 'served') {
            showWarningPopup({
                title: 'Action Restricted',
                message: 'Only waiters can mark items as served after delivering to the customer.',
                type: 'restriction',
                dismissText: 'Dismiss'
            });
            return;
        }

        // Optimistically update the specific item and recalculate effective order status
        const prevOrders = [...orders];
        setOrders(prev => prev.map(o => {
            const hasItem = o.items?.some(i => i.id === itemId);
            if (!hasItem) return o;

            const updatedItems = (o.items || []).map(i => i.id === itemId ? { ...i, status: newStatus } : i);
            const tempOrder = { ...o, items: updatedItems };
            return {
                ...tempOrder,
                status: getEffectiveOrderStatus(tempOrder)
            };
        }));

        try {
            const staffId = currentProfileRef.current?.id;
            await OrderService.updateOrderItemStatus(itemId, restaurantId, newStatus, staffId);
        } catch (err: any) {
            setOrders(prevOrders);
            showWarningPopup({
                title: 'Item Status Update Failed',
                message: err?.message || 'Failed to update item status. Rolling back changes.',
                type: 'error',
                dismissText: 'Dismiss'
            });
        }
    };

    const handleExtendTimer = async (itemId: string, minutes: number) => {
        if (isReadOnly) return;
        try {
            await OrderService.extendOrderItemTimer(itemId, minutes);
            toast.success(`Extended timer by ${minutes}m`);
        } catch (err) {
            console.error('Failed to extend timer:', err);
            toast.error('Failed to extend timer');
        }
    };

    const getOrdersByStatus = (status: OrderStatus) => (Array.isArray(orders) ? orders.filter(Boolean) : []).filter(o => getEffectiveOrderStatus(o) === status);

    const isBoardLoading = !mounted || loading;

    return (
        <div className="flex flex-col h-full overflow-hidden bg-neutral-100/70 relative">
            {/* Audio Autoplay Gate Banner */}
            {audioBlocked && (
                <div 
                    onClick={enableAudio}
                    className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 text-xs font-black flex items-center justify-between cursor-pointer transition-all shadow-md shrink-0 z-30 select-none animate-pulse"
                >
                    <div className="flex items-center gap-2">
                        <VolumeX size={15} />
                        <span>Kitchen audio alerts are paused by browser policy. Click here to enable live sound alerts!</span>
                    </div>
                    <span className="underline uppercase tracking-wider text-[11px] bg-black/20 px-2 py-0.5 rounded">
                        Enable Sound
                    </span>
                </div>
            )}

            {/* 4 Equal-Width Columns Container */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden p-3 md:p-4">
                <LayoutGroup>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4 h-full min-h-0 w-full min-w-[320px] md:min-w-0">
                        {/* Column 1: Incoming */}
                        <KDSColumn
                            title="Incoming"
                            subtitle="New Orders"
                            icon={<LucideClock size={16} />}
                            color="blue"
                            orders={getOrdersByStatus('placed')}
                            mergeGroups={mergeGroups}
                            onStatusChange={handleStatusChange}
                            onItemStatusChange={handleItemStatusChange}
                            onExtendTimer={handleExtendTimer}
                            isReadOnly={isReadOnly}
                            density={density}
                            loading={isBoardLoading}
                            emptyMessage="No incoming orders"
                            emptySubMessage="New orders will appear here automatically"
                        />

                        {/* Column 2: Preparing */}
                        <KDSColumn
                            title="Preparing"
                            subtitle="In The Kitchen"
                            icon={<LucideChefHat size={16} />}
                            color="orange"
                            orders={getOrdersByStatus('preparing')}
                            mergeGroups={mergeGroups}
                            onStatusChange={handleStatusChange}
                            onItemStatusChange={handleItemStatusChange}
                            onExtendTimer={handleExtendTimer}
                            isReadOnly={isReadOnly}
                            density={density}
                            loading={isBoardLoading}
                            emptyMessage="Kitchen is clear"
                            emptySubMessage="Start orders from Incoming to begin prep"
                        />

                        {/* Column 3: Ready */}
                        <KDSColumn
                            title="Ready"
                            subtitle="Ready For Pickup"
                            icon={<LucideCheckCircle size={16} />}
                            color="green"
                            orders={getOrdersByStatus('ready')}
                            mergeGroups={mergeGroups}
                            onStatusChange={handleStatusChange}
                            onItemStatusChange={handleItemStatusChange}
                            onExtendTimer={handleExtendTimer}
                            isReadOnly={isReadOnly}
                            density={density}
                            loading={isBoardLoading}
                            emptyMessage="No ready tickets"
                            emptySubMessage="Finished orders wait here for waiters or pickup"
                        />

                        {/* Column 4: Served (Equal Width) */}
                        <KDSColumn
                            title="Served"
                            subtitle="Dining / Dispatched"
                            icon={<LucideUtensils size={16} />}
                            color="gray"
                            orders={getOrdersByStatus('served')}
                            mergeGroups={mergeGroups}
                            onStatusChange={handleStatusChange}
                            onItemStatusChange={handleItemStatusChange}
                            onExtendTimer={handleExtendTimer}
                            isReadOnly={isReadOnly}
                            density={density}
                            loading={isBoardLoading}
                            emptyMessage="No served orders yet"
                            emptySubMessage="Orders handed over during this shift"
                        />
                    </div>
                </LayoutGroup>
            </div>
        </div>
    );

}

interface KDSColumnProps {
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    color: 'blue' | 'orange' | 'green' | 'gray';
    orders: Order[];
    mergeGroups: TableMergeGroup[];
    onStatusChange: (id: string, status: OrderStatus) => void;
    onItemStatusChange: (itemId: string, status: OrderStatus) => void;
    onExtendTimer: (itemId: string, minutes: number) => void;
    isReadOnly: boolean;
    density: 'compact' | 'comfortable';
    loading: boolean;
    emptyMessage: string;
    emptySubMessage: string;
}

function KDSColumn({
    title,
    subtitle,
    icon,
    color,
    orders,
    mergeGroups,
    onStatusChange,
    onItemStatusChange,
    onExtendTimer,
    isReadOnly,
    density,
    loading,
    emptyMessage,
    emptySubMessage
}: KDSColumnProps) {
    const isCompact = density === 'compact';

    // Premium column themes
    const themeStyles = {
        blue: {
            bg: 'bg-slate-50/80',
            header: 'bg-white border-blue-200 text-blue-900',
            badge: 'bg-blue-600 text-white shadow-blue-500/20',
            iconContainer: 'bg-blue-50 text-blue-600 border border-blue-200',
            accent: 'border-blue-500',
        },
        orange: {
            bg: 'bg-amber-50/40',
            header: 'bg-white border-amber-200 text-amber-950',
            badge: 'bg-amber-500 text-white shadow-amber-500/20',
            iconContainer: 'bg-amber-50 text-amber-600 border border-amber-200',
            accent: 'border-amber-500',
        },
        green: {
            bg: 'bg-emerald-50/40',
            header: 'bg-white border-emerald-200 text-emerald-950',
            badge: 'bg-emerald-600 text-white shadow-emerald-500/20',
            iconContainer: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
            accent: 'border-emerald-500',
        },
        gray: {
            bg: 'bg-slate-50/80',
            header: 'bg-white border-slate-200 text-slate-800',
            badge: 'bg-slate-700 text-white shadow-slate-500/20',
            iconContainer: 'bg-slate-100 text-slate-600 border border-slate-200',
            accent: 'border-slate-400',
        },
    }[color];

    const safeOrders = Array.isArray(orders) ? orders.filter(Boolean) : [];
    const safeMergeGroups = Array.isArray(mergeGroups) ? mergeGroups.filter(Boolean) : [];

    // Group orders by Table ID or Merge Group
    const groupedOrders = safeOrders.reduce((groups, order) => {
        if (!order) return groups;
        const tableId = order.table_id || order.merge_group_id || (order.order_type === 'TAKEAWAY' ? 'takeaway' : order.order_type === 'DELIVERY' ? 'delivery' : 'other');
        if (!groups[tableId as any]) {
            groups[tableId as any] = [];
        }
        groups[tableId as any].push(order);
        return groups;
    }, {} as Record<string | number, Order[]>);

    const sortedTableIds = Object.keys(groupedOrders).sort((a, b) => {
        const nameA = String((typeof a === 'string' && isNaN(Number(a))
            ? safeMergeGroups.find(g => g && g.id === a)?.display_name || a
            : a) || '');
        const nameB = String((typeof b === 'string' && isNaN(Number(b))
            ? safeMergeGroups.find(g => g && g.id === b)?.display_name || b
            : b) || '');

        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });

    return (
        <div className={`flex flex-col h-full rounded-2xl border border-neutral-200/90 ${themeStyles.bg} overflow-hidden shadow-xs`}>
            {/* Column Header */}
            <div className={`p-3 md:p-3.5 border-b flex items-center justify-between ${themeStyles.header} backdrop-blur-md shrink-0`}>
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`size-8 rounded-xl flex items-center justify-center ${themeStyles.iconContainer}`}>
                        {icon}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <h2 className="font-black text-xs md:text-sm tracking-tight uppercase truncate">
                                {title}
                            </h2>
                        </div>
                        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider truncate">
                            {subtitle}
                        </p>
                    </div>
                </div>

                {/* Counter Badge */}
                <span 
                    suppressHydrationWarning 
                    className={`px-2.5 py-0.5 rounded-full text-xs font-black shadow-xs ${themeStyles.badge}`}
                >
                    {loading ? '—' : orders.length}
                </span>
            </div>

            {/* Column Content Scroll Area */}
            <div className={`flex-1 overflow-y-auto kds-scroll p-3 space-y-3`}>
                {loading ? (
                    // Skeleton Loading States
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="kds-skeleton h-36 w-full shadow-2xs" />
                        ))}
                    </div>
                ) : orders.length === 0 ? (
                    // Meaningful Empty State
                    <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-4">
                        <div className="p-3.5 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs text-neutral-300 mb-2.5">
                            {icon}
                        </div>
                        <p className="text-xs font-black text-neutral-700 tracking-tight">
                            {emptyMessage}
                        </p>
                        <p className="text-[11px] text-neutral-400 font-medium max-w-[200px] mt-1 leading-normal">
                            {emptySubMessage}
                        </p>
                    </div>
                ) : (
                    // Grouped Orders by Table / Group
                    <AnimatePresence mode="popLayout">
                        {sortedTableIds.map(tableId => (
                            <KDSTableGroup
                                key={tableId}
                                tableId={tableId as any}
                                orders={groupedOrders[tableId as any]}
                                mergeGroups={mergeGroups}
                                onStatusChange={onStatusChange}
                                onItemStatusChange={onItemStatusChange}
                                onExtendTimer={onExtendTimer}
                                color={color}
                                isReadOnly={isReadOnly}
                                density={density}
                            />
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}

class TicketErrorBoundary extends Component<{ children: ReactNode; fallbackId?: string }, { hasError: boolean }> {
    constructor(props: { children: ReactNode; fallbackId?: string }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.warn(`[KDS Ticket Error on Order #${this.props.fallbackId}]:`, error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-2.5 rounded-xl border border-rose-200 bg-rose-50/80 text-rose-800 text-[10px] flex items-center justify-between gap-2 shadow-2xs">
                    <span className="font-bold truncate">Ticket #{this.props.fallbackId || 'Unknown'} encountered display issue</span>
                    <button
                        type="button"
                        onClick={() => this.setState({ hasError: false })}
                        className="px-2 py-0.5 rounded bg-white border border-rose-300 text-rose-700 font-black text-[9px] uppercase tracking-wider shrink-0 hover:bg-rose-100"
                    >
                        Retry
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

function KDSTableGroup({ 
    tableId, 
    orders, 
    mergeGroups, 
    onStatusChange, 
    onItemStatusChange, 
    onExtendTimer, 
    color, 
    isReadOnly, 
    density 
}: { 
    tableId: number | string; 
    orders: Order[]; 
    mergeGroups: TableMergeGroup[]; 
    onStatusChange: (id: string, status: OrderStatus) => void; 
    onItemStatusChange: (itemId: string, status: OrderStatus) => void; 
    onExtendTimer: (itemId: string, minutes: number) => void; 
    color: string; 
    isReadOnly: boolean; 
    density: 'compact' | 'comfortable'; 
}) {
    const [isOpen, setIsOpen] = useState(true);
    const safeOrders = Array.isArray(orders) ? orders.filter(Boolean) : [];
    const safeMergeGroups = Array.isArray(mergeGroups) ? mergeGroups.filter(Boolean) : [];
    const sortedOrders = [...safeOrders].sort((a, b) => {
        const timeA = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b?.created_at ? new Date(b.created_at).getTime() : 0;
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });
    const isCompact = density === 'compact';

    let tableName = `Table ${tableId}`;
    let isTakeaway = false;
    let isDelivery = false;
    let isMerged = false;

    if (tableId === 'takeaway') {
        tableName = 'Takeaway';
        isTakeaway = true;
    } else if (tableId === 'delivery') {
        tableName = 'Delivery';
        isDelivery = true;
    } else if (typeof tableId === 'string' && isNaN(Number(tableId))) {
        tableName = safeMergeGroups.find(g => g && g.id === tableId)?.display_name || 'Merged Group';
        isMerged = true;
    } else if (safeOrders[0]?.table_number) {
        tableName = `Table ${safeOrders[0].table_number}`;
    }

    const totalItemsCount = safeOrders.reduce((sum, o) => {
        if (!o) return sum;
        const active = (o.items || []).filter(item => item && item.status !== 'cancelled');
        return sum + active.reduce((acc, it) => acc + (Number(it?.quantity) || 1), 0);
    }, 0);

    const hasLateOrder = safeOrders.some(o => {
        if (!o || o.status === 'served' || o.status === 'paid' || o.status === 'cancelled') return false;
        let timeStr = o.created_at;
        if (!timeStr) return false;
        if (!timeStr.endsWith('Z') && !timeStr.includes('+')) timeStr += 'Z';
        const parsedTime = new Date(timeStr).getTime();
        if (isNaN(parsedTime)) return false;
        return (Date.now() - parsedTime) >= 900000;
    });

    const headerTheme = {
        blue: {
            stripe: 'from-blue-500 via-indigo-500 to-sky-400',
            bg: isOpen ? 'bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-white text-slate-900 border-b border-blue-100' : 'bg-white text-slate-800 hover:bg-blue-50/30',
            icon: 'bg-white text-blue-600 border-blue-200/80 shadow-2xs',
            badge: 'bg-blue-100/90 text-blue-900 border-blue-200/80',
        },
        orange: {
            stripe: 'from-amber-500 via-orange-500 to-amber-600',
            bg: isOpen ? 'bg-gradient-to-r from-amber-50/90 via-orange-50/50 to-white text-slate-900 border-b border-amber-200/70' : 'bg-white text-slate-800 hover:bg-amber-50/30',
            icon: 'bg-white text-amber-600 border-amber-200/80 shadow-2xs',
            badge: 'bg-amber-100/90 text-amber-950 border-amber-200/80',
        },
        green: {
            stripe: 'from-emerald-500 via-teal-500 to-green-600',
            bg: isOpen ? 'bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-white text-slate-900 border-b border-emerald-200/70' : 'bg-white text-slate-800 hover:bg-emerald-50/30',
            icon: 'bg-white text-emerald-600 border-emerald-200/80 shadow-2xs',
            badge: 'bg-emerald-100/90 text-emerald-950 border-emerald-200/80',
        },
        gray: {
            stripe: 'from-slate-400 via-slate-500 to-zinc-400',
            bg: isOpen ? 'bg-gradient-to-r from-slate-100/90 via-slate-50 to-white text-slate-800 border-b border-slate-200' : 'bg-white text-slate-800 hover:bg-slate-50/50',
            icon: 'bg-white text-slate-600 border-slate-200/80 shadow-2xs',
            badge: 'bg-slate-200/90 text-slate-800 border-slate-300/80',
        },
    }[color] || {
        stripe: 'from-slate-400 to-slate-500',
        bg: isOpen ? 'bg-slate-50 text-slate-800 border-b border-slate-200' : 'bg-white text-slate-800',
        icon: 'bg-white text-slate-600 border-slate-200 shadow-2xs',
        badge: 'bg-slate-100 text-slate-800 border-slate-200',
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="rounded-xl border border-slate-200/90 overflow-hidden shadow-2xs hover:shadow-xs bg-white transition-all duration-200"
        >
            {/* Top Phase Accent Stripe */}
            <div className={`h-[2.5px] w-full bg-gradient-to-r ${headerTheme.stripe}`} />

            {/* Table Group Header Button - Compact & Structured */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 transition-colors ${headerTheme.bg}`}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <div className={`size-6 rounded-lg flex items-center justify-center font-black border text-xs ${headerTheme.icon}`}>
                        {isTakeaway ? (
                            <span>🛍️</span>
                        ) : isDelivery ? (
                            <span>🛵</span>
                        ) : (
                            <LucideTable size={13} />
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap text-left">
                        <p className="text-xs font-black uppercase tracking-tight text-slate-900 truncate">
                            {tableName}
                        </p>
                        {isMerged && (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-violet-100 text-violet-800 border border-violet-200">
                                Merged
                            </span>
                        )}
                        {hasLateOrder && (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-rose-600 text-white animate-pulse shadow-2xs">
                                LATE
                            </span>
                        )}
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100/90 border border-slate-200/80 px-1.5 py-0.2 rounded-md">
                            {totalItemsCount} item{totalItemsCount > 1 ? 's' : ''} • {orders.length} tkt{orders.length > 1 ? 's' : ''}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    <motion.div
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="size-5 rounded-md bg-white/90 border border-slate-200/60 shadow-2xs text-slate-700 flex items-center justify-center"
                    >
                        <LucideChevronDown size={12} />
                    </motion.div>
                </div>
            </button>

            {/* Expanded Tickets List */}
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden"
                    >
                        <div className="p-2 space-y-2 bg-slate-50/60 border-t border-slate-100">
                            {sortedOrders.map(order => (
                                <TicketErrorBoundary 
                                    key={order?.id || `fallback-${Math.random()}`}
                                    fallbackId={String(order?.order_number || order?.id || '')}
                                >
                                    <KitchenTicket
                                        order={order}
                                        onStatusChange={onStatusChange}
                                        onItemStatusChange={onItemStatusChange}
                                        onExtendTimer={onExtendTimer}
                                        isReadOnly={isReadOnly}
                                        density={density}
                                    />
                                </TicketErrorBoundary>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

