'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { OrderService, type Order, type OrderStatus, type TableMergeGroup } from '@/services/orders.service';
import KitchenTicket from '@/components/kitchen/KitchenTicket';
import { Table as LucideTable, ChevronDown as LucideChevronDown, ChefHat as LucideChefHat, CheckCircle as LucideCheckCircle, Utensils as LucideUtensils, Clock as LucideClock } from 'lucide-react';
import { useParams } from 'next/navigation';
import { UserService } from '@/services/users.service';
import { useRestaurantId } from '@/hooks/useRestaurantId';
import { getCached, setCache } from '@/lib/data-cache';

interface OrderKanbanBoardProps {
    isReadOnly?: boolean;
    title?: string;
    density?: 'compact' | 'comfortable';
}

export default function OrderKanbanBoard({ isReadOnly = false, title = 'Kitchen Display System', density = 'comfortable' }: OrderKanbanBoardProps) {
    const params = useParams();
    const urlRestaurantCode = (params?.restaurantCode as string) || '';
    const { restaurantId, loading: profileLoading } = useRestaurantId();
    const activeResId = restaurantId || urlRestaurantCode;
    const cacheKey = `kds-${activeResId}`;
    const cached = getCached<any>(cacheKey) || (urlRestaurantCode ? getCached<any>(`kds-${urlRestaurantCode}`) : null);
    const [orders, setOrders] = useState<Order[]>(cached?.orders || []);
    const [mergeGroups, setMergeGroups] = useState<TableMergeGroup[]>(cached?.mergeGroups || []);
    const [loading, setLoading] = useState(!cached && orders.length === 0);
    const currentProfileRef = useRef<any>(null);

    useEffect(() => {
        if (restaurantId) {
            UserService.getCurrentProfile(restaurantId).then(p => {
                currentProfileRef.current = p;
            }).catch(console.error);
        }
    }, [restaurantId]);

    // Initial Fetch & Real-time Subscription
    useEffect(() => {
        if (profileLoading || !restaurantId) return;

        let isFetching = false;
        let pendingFetch = false;
        let debounceTimer: NodeJS.Timeout | null = null;

        const loadOrders = async () => {
            if (!restaurantId || isFetching) {
                if (isFetching) pendingFetch = true;
                return;
            }
            isFetching = true;
            try {
                const [ordersRes, groupsRes] = await Promise.allSettled([
                    OrderService.fetchActiveOrders(restaurantId),
                    OrderService.fetchMergeGroups(restaurantId)
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
                if (restaurantId && (ordersRes.status === 'fulfilled' || groupsRes.status === 'fulfilled')) {
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
        window.addEventListener('online', handleOnline);

        loadOrders();

        const subscription = OrderService.subscribeToOrders(restaurantId, (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
                debouncedLoadOrders();
            } else if (payload.eventType === 'UPDATE') {
                const updatedOrder = payload.new as any;
                if (!updatedOrder) return;
                setOrders(prev => {
                    if (updatedOrder.is_completed || !['placed', 'preparing', 'ready', 'served', 'paid'].includes(updatedOrder.status)) {
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

        const itemSubscription = OrderService.subscribeToOrderItems(restaurantId, (payload) => {
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
            window.removeEventListener('online', handleOnline);
            subscription.unsubscribe();
            itemSubscription.unsubscribe();
        };
    }, [profileLoading, restaurantId]);


    const getEffectiveOrderStatus = (order: Order): OrderStatus => {
        const activeItems = (order.items || []).filter(item => item.status !== 'cancelled');
        if (activeItems.length === 0) {
            return (order.status as OrderStatus) || 'placed';
        }

        const itemStatuses = activeItems.map(i => i.status?.toLowerCase());

        // 1. First priority: Even ONE item in incoming -> table should be in Incoming
        if (itemStatuses.some(s => s === 'placed' || s === 'queued' || s === 'incoming')) {
            return 'placed';
        }

        // 2. Second priority: If ANY item is preparing -> table should be in Preparing
        if (itemStatuses.some(s => s === 'preparing' || s === 'cooking')) {
            return 'preparing';
        }

        // 3. Third priority: If ANY item is ready -> table should be in Ready
        if (itemStatuses.some(s => s === 'ready')) {
            return 'ready';
        }

        // 4. Last priority: If ALL items are served (or paid) -> table should be in Served (Dining)
        if (itemStatuses.every(s => s === 'served' || s === 'paid')) {
            return 'served';
        }

        return (order.status as OrderStatus) || 'placed';
    };

    const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
        if (isReadOnly || !restaurantId) return;
        
        // Optimistic update
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        try {
            const staffId = currentProfileRef.current?.id;
            await OrderService.updateOrderStatus(orderId, restaurantId, newStatus, staffId);
        } catch (err) {
            console.error('Failed to update status', err);
        }
    };

    const handleItemStatusChange = async (itemId: string, newStatus: OrderStatus) => {
        if (isReadOnly || !restaurantId) return;

        // Optimistically update the specific item and recalculate effective order status
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
        } catch (err) {
            console.error('Failed to update item status', err);
        }
    };

    const handleExtendTimer = async (itemId: string, minutes: number) => {
        if (isReadOnly) return;
        try {
            await OrderService.extendOrderItemTimer(itemId, minutes);
        } catch (err) {
            console.error('Failed to extend timer:', err);
        }
    };

    const getOrdersByStatus = (status: OrderStatus) => orders.filter(o => getEffectiveOrderStatus(o) === status);

    return (
        <div className="flex flex-col h-full overflow-hidden bg-neutral-50 relative">
            <div className="flex-1 overflow-x-auto overflow-y-hidden">
                {/* Wrap in LayoutGroup to enable shared layout animations across columns */}
                <LayoutGroup>
                    <div className="flex flex-col md:flex-row h-full min-h-0 md:overflow-x-auto md:overflow-y-hidden overflow-y-auto premium-scrollbar">

                        {/* Column 1: Incoming (Placed) */}
                        <div className="flex-none w-full md:flex-1 md:w-auto md:min-w-[240px] xl:min-w-[280px] h-full">
                            <KDSColumn
                                title="Incoming"
                                icon={<LucideClock size={18} />}
                                color="blue"
                                orders={getOrdersByStatus('placed')}
                                mergeGroups={mergeGroups}
                                onStatusChange={handleStatusChange}
                                onItemStatusChange={handleItemStatusChange}
                                onExtendTimer={handleExtendTimer}
                                isReadOnly={isReadOnly}
                                density={density}
                                isFirst={true}
                            />
                        </div>

                        {/* Column 2: Preparing */}
                        <div className="flex-none w-full md:flex-1 md:w-auto md:min-w-[240px] xl:min-w-[280px] h-full">
                            <KDSColumn
                                title="Preparing"
                                icon={<LucideChefHat size={18} />}
                                color="orange"
                                orders={getOrdersByStatus('preparing')}
                                mergeGroups={mergeGroups}
                                onStatusChange={handleStatusChange}
                                onItemStatusChange={handleItemStatusChange}
                                onExtendTimer={handleExtendTimer}
                                isReadOnly={isReadOnly}
                                density={density}
                            />
                        </div>

                        {/* Column 3: Ready */}
                        <div className="flex-none w-full md:flex-1 md:w-auto md:min-w-[240px] xl:min-w-[280px] h-full">
                            <KDSColumn
                                title="Ready"
                                icon={<LucideCheckCircle size={18} />}
                                color="green"
                                orders={getOrdersByStatus('ready')}
                                mergeGroups={mergeGroups}
                                onStatusChange={handleStatusChange}
                                onItemStatusChange={handleItemStatusChange}
                                onExtendTimer={handleExtendTimer}
                                isReadOnly={isReadOnly}
                                density={density}
                            />
                        </div>

                        {/* Column 4: Dining (half width) */}
                        <div className="w-full md:w-[200px] md:flex-none h-full">
                            <KDSColumn
                                title="Dining"
                                icon={<LucideUtensils size={18} />}
                                color="gray"
                                orders={getOrdersByStatus('served')}
                                mergeGroups={mergeGroups}
                                onStatusChange={handleStatusChange}
                                onItemStatusChange={handleItemStatusChange}
                                onExtendTimer={handleExtendTimer}
                                isReadOnly={isReadOnly}
                                density={density}
                                isLast={true}
                            />
                        </div>

                    </div>
                </LayoutGroup>
            </div>
        </div>
    );
}

function KDSColumn({ title, icon, color, orders, mergeGroups, onStatusChange, onItemStatusChange, onExtendTimer, isReadOnly, density, isFirst = false, isLast = false }: { title: string, icon: React.ReactNode, color: string, orders: Order[], mergeGroups: TableMergeGroup[], onStatusChange: (id: string, status: OrderStatus) => void, onItemStatusChange: (itemId: string, status: OrderStatus) => void, onExtendTimer: (itemId: string, minutes: number) => void, isReadOnly: boolean, density: 'compact' | 'comfortable', isFirst?: boolean, isLast?: boolean }) {
    const isCompact = density === 'compact';

    // Advanced Professional UI: Full height panels in KDS
    const columnStyles = {
        blue: 'bg-blue-50/50',
        orange: 'bg-orange-50/50',
        green: 'bg-green-50/50',
        gray: 'bg-neutral-100/50',
    };

    const headerStyles = {
        blue: 'bg-blue-100/40 text-blue-700 border-blue-200/50',
        orange: 'bg-orange-100/40 text-orange-700 border-orange-200/50',
        green: 'bg-green-100/40 text-green-700 border-green-200/50',
        gray: 'bg-neutral-200/40 text-neutral-700 border-neutral-300/50',
    };

    const iconStyles = {
        blue: 'bg-blue-500 text-white shadow-blue-550/20',
        orange: 'bg-orange-500 text-white shadow-orange-550/20',
        green: 'bg-green-500 text-white shadow-green-550/20',
        gray: 'bg-zinc-650 text-white shadow-zinc-650/20',
    };

    const activeStyle = columnStyles[color as keyof typeof columnStyles];
    const headerStyle = headerStyles[color as keyof typeof headerStyles];
    const iconStyle = iconStyles[color as keyof typeof iconStyles];

    // Group orders by Table ID
    const groupedOrders = orders.reduce((groups, order) => {
        const tableId = order.table_id || order.merge_group_id || 'unknown';
        if (!groups[tableId as any]) {
            groups[tableId as any] = [];
        }
        groups[tableId as any].push(order);
        return groups;
    }, {} as Record<string | number, Order[]>);

    const sortedTableIds = Object.keys(groupedOrders).sort((a, b) => {
        // Resolve display names for numeric sorting
        const nameA = (typeof a === 'string' && isNaN(Number(a))
            ? mergeGroups.find(g => g.id === a)?.display_name || 'Merged'
            : a).toString();
        const nameB = (typeof b === 'string' && isNaN(Number(b))
            ? mergeGroups.find(g => g.id === b)?.display_name || 'Merged'
            : b).toString();

        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });

    return (
        <div className={`flex flex-col h-full border-r border-neutral-200 last:border-r-0 ${activeStyle} relative group/column shadow-[1px_0_0_0_rgba(0,0,0,0.05)]`}>
            {/* Header - More prominent */}
            <div className={`${isCompact ? 'p-2.5' : 'p-3.5'} flex justify-between items-center border-b border-neutral-200/80 ${headerStyle} backdrop-blur-md sticky top-0 z-20 shadow-sm`}>
                <div className="flex items-center gap-2.5">
                    <span className="text-neutral-500">{icon}</span>
                    <h2 className={`font-black tracking-[0.1em] uppercase ${isCompact ? 'text-[11px]' : 'text-xs'} opacity-90`}>{title}</h2>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black bg-white text-neutral-700 shadow-sm ring-1 ring-neutral-200 min-w-[24px] text-center`}>
                        {orders.length}
                    </span>
                </div>
            </div>

            {/* Table Group List */}
            <div className={`flex-1 overflow-y-auto ${isCompact ? 'p-3 space-y-3' : 'p-4 space-y-4'} premium-scrollbar bg-neutral-50/50`}>
                {orders.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-neutral-400 gap-3 opacity-60">
                        <div className="p-4 rounded-full bg-neutral-100 scale-110 shadow-inner">
                            {icon}
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">Empty</p>
                    </div>
                )}

                <AnimatePresence mode='popLayout'>
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
            </div>

            {/* Pronounced divider line for depth */}
            {!isLast && <div className="absolute top-0 right-0 w-[1px] h-full bg-neutral-200/50 pointer-events-none" />}
        </div>
    );
}

function KDSTableGroup({ tableId, orders, mergeGroups, onStatusChange, onItemStatusChange, onExtendTimer, color, isReadOnly, density }: { tableId: number | string, orders: Order[], mergeGroups: TableMergeGroup[], onStatusChange: (id: string, status: OrderStatus) => void, onItemStatusChange: (itemId: string, status: OrderStatus) => void, onExtendTimer: (itemId: string, minutes: number) => void, color: string, isReadOnly: boolean, density: 'compact' | 'comfortable' }) {
    const [isOpen, setIsOpen] = useState(true);
    const sortedOrders = [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const isCompact = density === 'compact';

    const tableName = typeof tableId === 'string' && isNaN(Number(tableId))
        ? mergeGroups.find(g => g.id === tableId)?.display_name || 'Merged'
        : orders[0]?.table_number ? `Table ${orders[0].table_number}` : `Table ${tableId}`;

    // Interactive Table Colors
    const headerBg = {
        blue: isOpen ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-blue-700 border border-blue-200',
        orange: isOpen ? 'bg-orange-500 text-white shadow-sm' : 'bg-white text-orange-700 border border-orange-200',
        green: isOpen ? 'bg-green-600 text-white shadow-sm' : 'bg-white text-green-700 border border-green-200',
        gray: isOpen ? 'bg-neutral-700 text-white shadow-sm' : 'bg-white text-neutral-600 border border-neutral-200',
    }[color] || (isOpen ? 'bg-neutral-800 text-white' : 'bg-white text-neutral-700');

    const cardBorder = {
        blue: isOpen ? 'border-blue-200 ring-blue-500/10' : 'border-neutral-200',
        orange: isOpen ? 'border-orange-200 ring-orange-500/10' : 'border-neutral-200',
        green: isOpen ? 'border-green-200 ring-green-500/10' : 'border-neutral-200',
        gray: isOpen ? 'border-neutral-300 ring-neutral-400/10' : 'border-neutral-200',
    }[color] || (isOpen ? 'border-neutral-300 ring-neutral-400/10' : 'border-neutral-200');

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`rounded-xl border overflow-hidden shadow-sm bg-white transition-all duration-300 ${cardBorder} ${isOpen ? 'shadow-md ring-2' : 'hover:border-neutral-300'}`}
        >
            {/* Table Group Header - More vibrant and weighted */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between ${isCompact ? 'p-2' : 'p-3'} transition-all duration-300 border-b border-transparent ${isOpen ? 'border-black/5' : ''} ${headerBg}`}
            >
                <div className="flex items-center gap-2.5">
                    <div className={`${isOpen ? 'bg-white/20' : 'bg-neutral-100'} size-8 rounded-lg flex items-center justify-center font-black shadow-inner`}>
                        <LucideTable size={16} />
                    </div>
                    <div className="text-left">
                        <p className={`${isCompact ? 'text-[11px]' : 'text-sm'} font-black uppercase tracking-tight`}>{tableName}</p>
                        <p className={`text-[9px] font-bold uppercase tracking-wider opacity-80`}>{orders.length} Ticket{orders.length > 1 ? 's' : ''}</p>
                    </div>
                </div>
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className={`${isOpen ? 'bg-white/20 text-white' : 'bg-neutral-100 text-black'} p-1 rounded-full`}
                >
                    <LucideChevronDown size={14} />
                </motion.div>
            </button>

            {/* Expanded List - Smooth Height Animation */}
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                            duration: 0.4,
                            ease: [0.4, 0, 0.2, 1]
                        }}
                        className="overflow-hidden"
                    >
                        <div className={`${isCompact ? 'p-2.5 space-y-2.5' : 'p-3.5 space-y-3.5'} bg-neutral-900/[0.02] shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]`}>
                            {sortedOrders.map(order => (
                                <KitchenTicket
                                    key={order.id}
                                    order={order}
                                    onStatusChange={onStatusChange}
                                    onItemStatusChange={onItemStatusChange}
                                    onExtendTimer={onExtendTimer}
                                    isReadOnly={isReadOnly}
                                    density={density}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
