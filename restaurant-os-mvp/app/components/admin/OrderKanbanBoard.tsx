'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { OrderService, type Order, type OrderStatus, type TableMergeGroup } from '@/app/services/orders';
import KitchenTicket from '@/app/kitchen/components/KitchenTicket';
import { LucideTable, LucideChevronDown, LucideChefHat, LucideCheckCircle, LucideUtensils, LucideClock } from 'lucide-react';

interface OrderKanbanBoardProps {
    isReadOnly?: boolean;
    title?: string;
    density?: 'compact' | 'comfortable';
}

export default function OrderKanbanBoard({ isReadOnly = false, title = 'Kitchen Display System', density = 'comfortable' }: OrderKanbanBoardProps) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [mergeGroups, setMergeGroups] = useState<TableMergeGroup[]>([]);
    const [loading, setLoading] = useState(true);

    // Initial Fetch & Real-time Subscription
    useEffect(() => {
        const loadOrders = async () => {
            try {
                const [data, groups] = await Promise.all([
                    OrderService.fetchActiveOrders(),
                    OrderService.fetchMergeGroups()
                ]);
                setOrders(data || []);
                setMergeGroups(groups || []);
            } catch (err) {
                console.error('Failed to load orders', err);
            } finally {
                setLoading(false);
            }
        };

        loadOrders();

        const subscription = OrderService.subscribeToOrders((payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
                loadOrders();
            }
        });

        const itemSubscription = OrderService.subscribeToOrderItems((payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
                loadOrders();
            }
        });

        return () => {
            subscription.unsubscribe();
            itemSubscription.unsubscribe();
        };
    }, []);


    const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
        if (isReadOnly) return;
        // Optimistic update
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        try {
            await OrderService.updateOrderStatus(orderId, newStatus);
        } catch (err) {
            console.error('Failed to update status', err);
        }
    };

    const handleItemStatusChange = async (itemId: string, newStatus: OrderStatus) => {
        if (isReadOnly) return;
        try {
            await OrderService.updateOrderItemStatus(itemId, newStatus);
        } catch (err) {
            console.error('Failed to update item status', err);
        }
    };

    const getOrdersByStatus = (status: OrderStatus) => orders.filter(o => o.status === status);

    const isCompact = density === 'compact';

    return (
        <div className="flex flex-col h-full overflow-hidden bg-white relative">
            <div className="flex-1 overflow-x-auto overflow-y-hidden">
                {/* Wrap in LayoutGroup to enable shared layout animations across columns */}
                <LayoutGroup>
                    <div className="flex flex-col md:flex-row h-full min-h-0 md:overflow-x-auto md:overflow-y-hidden overflow-y-auto custom-scrollbar">

                        {/* Column 1: Incoming (Placed) */}
                        <div className="flex-none w-full md:flex-1 md:w-auto md:min-w-[320px] xl:min-w-[350px] h-full">
                            <KDSColumn
                                title="Incoming"
                                icon={<LucideClock size={18} />}
                                color="blue"
                                orders={getOrdersByStatus('placed')}
                                mergeGroups={mergeGroups}
                                onStatusChange={handleStatusChange}
                                onItemStatusChange={handleItemStatusChange}
                                isReadOnly={isReadOnly}
                                density={density}
                                isFirst={true}
                            />
                        </div>

                        {/* Column 2: Preparing */}
                        <div className="flex-none w-full md:flex-1 md:w-auto md:min-w-[320px] xl:min-w-[350px] h-full">
                            <KDSColumn
                                title="Preparing"
                                icon={<LucideChefHat size={18} />}
                                color="orange"
                                orders={getOrdersByStatus('preparing')}
                                mergeGroups={mergeGroups}
                                onStatusChange={handleStatusChange}
                                onItemStatusChange={handleItemStatusChange}
                                isReadOnly={isReadOnly}
                                density={density}
                            />
                        </div>

                        {/* Column 3: Ready */}
                        <div className="flex-none w-full md:flex-1 md:w-auto md:min-w-[320px] xl:min-w-[350px] h-full">
                            <KDSColumn
                                title="Ready"
                                icon={<LucideCheckCircle size={18} />}
                                color="green"
                                orders={getOrdersByStatus('ready')}
                                mergeGroups={mergeGroups}
                                onStatusChange={handleStatusChange}
                                onItemStatusChange={handleItemStatusChange}
                                isReadOnly={isReadOnly}
                                density={density}
                            />
                        </div>

                        {/* Column 4: Dining */}
                        <div className="flex-none w-full md:flex-1 md:w-auto md:min-w-[320px] xl:min-w-[350px] h-full">
                            <KDSColumn
                                title="Dining"
                                icon={<LucideUtensils size={18} />}
                                color="gray"
                                orders={getOrdersByStatus('served')}
                                mergeGroups={mergeGroups}
                                onStatusChange={handleStatusChange}
                                onItemStatusChange={handleItemStatusChange}
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

function KDSColumn({ title, icon, color, orders, mergeGroups, onStatusChange, onItemStatusChange, isReadOnly, density, isFirst = false, isLast = false }: { title: string, icon: React.ReactNode, color: string, orders: Order[], mergeGroups: TableMergeGroup[], onStatusChange: (id: string, status: OrderStatus) => void, onItemStatusChange: (itemId: string, status: OrderStatus) => void, isReadOnly: boolean, density: 'compact' | 'comfortable', isFirst?: boolean, isLast?: boolean }) {
    const isCompact = density === 'compact';

    // Advanced Professional UI: Full height panels
    const columnStyles = {
        blue: 'bg-blue-50/30',
        orange: 'bg-orange-50/30',
        green: 'bg-green-50/30',
        gray: 'bg-neutral-50/30',
    };

    const headerStyles = {
        blue: 'bg-blue-100/50 text-blue-900 border-blue-100',
        orange: 'bg-orange-100/50 text-orange-900 border-orange-100',
        green: 'bg-green-100/50 text-green-900 border-green-100',
        gray: 'bg-neutral-100/50 text-neutral-900 border-neutral-100',
    };

    const iconStyles = {
        blue: 'bg-blue-500 text-white shadow-blue-200',
        orange: 'bg-orange-500 text-white shadow-orange-200',
        green: 'bg-green-500 text-white shadow-green-200',
        gray: 'bg-neutral-500 text-white shadow-neutral-200',
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
        const dateA = new Date(groupedOrders[a as any][0].created_at).getTime();
        const dateB = new Date(groupedOrders[b as any][0].created_at).getTime();
        return dateA - dateB; // FIFO
    });

    return (
        <div className={`flex flex-col h-full border-r-[3px] border-neutral-300/40 last:border-r-0 ${activeStyle} relative group/column shadow-[1px_0_0_0_rgba(0,0,0,0.05)]`}>
            {/* Header - More prominent */}
            <div className={`${isCompact ? 'p-2.5' : 'p-3.5'} flex justify-between items-center border-b-2 border-black/5 ${headerStyle} backdrop-blur-md sticky top-0 z-20 shadow-sm`}>
                <div className="flex items-center gap-2.5">
                    <h2 className={`font-black tracking-[0.1em] uppercase ${isCompact ? 'text-[11px]' : 'text-xs'} opacity-90`}>{title}</h2>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black bg-white/40 shadow-inner ring-1 ring-black/5 min-w-[24px] text-center`}>
                        {orders.length}
                    </span>
                </div>
            </div>

            {/* Table Group List */}
            <div className={`flex-1 overflow-y-auto ${isCompact ? 'p-3 space-y-3' : 'p-4 space-y-4'} custom-scrollbar bg-white/20`}>
                {orders.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-neutral-400 gap-3 opacity-40">
                        <div className="p-4 rounded-full bg-neutral-200/50 scale-110">
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
                            color={color}
                            isReadOnly={isReadOnly}
                            density={density}
                        />
                    ))}
                </AnimatePresence>
            </div>

            {/* Pronounced divider line for depth */}
            {!isLast && <div className="absolute top-0 right-0 w-[2px] h-full bg-black/10 pointer-events-none" />}
        </div>
    );
}

function KDSTableGroup({ tableId, orders, mergeGroups, onStatusChange, onItemStatusChange, color, isReadOnly, density }: { tableId: number | string, orders: Order[], mergeGroups: TableMergeGroup[], onStatusChange: (id: string, status: OrderStatus) => void, onItemStatusChange: (itemId: string, status: OrderStatus) => void, color: string, isReadOnly: boolean, density: 'compact' | 'comfortable' }) {
    const [isOpen, setIsOpen] = useState(true);
    const sortedOrders = [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const isCompact = density === 'compact';

    const tableName = typeof tableId === 'string' && isNaN(Number(tableId))
        ? mergeGroups.find(g => g.id === tableId)?.display_name || 'Merged'
        : `Table ${tableId}`;

    // Interactive Table Colors
    const groupStyles = {
        blue: 'border-blue-100 bg-white ring-blue-100 hover:ring-blue-300',
        orange: 'border-orange-100 bg-white ring-orange-100 hover:ring-orange-300',
        green: 'border-green-100 bg-white ring-green-100 hover:ring-green-300',
        gray: 'border-neutral-100 bg-white ring-neutral-100 hover:ring-neutral-300',
    }[color] || 'border-neutral-100 bg-white ring-neutral-100';

    const headerBg = {
        blue: isOpen ? 'bg-blue-600 text-white' : 'bg-white text-blue-600',
        orange: isOpen ? 'bg-orange-600 text-white' : 'bg-white text-orange-600',
        green: isOpen ? 'bg-green-600 text-white' : 'bg-white text-green-600',
        gray: isOpen ? 'bg-neutral-800 text-white' : 'bg-white text-neutral-800',
    }[color] || (isOpen ? 'bg-neutral-800 text-white' : 'bg-white text-neutral-800');

    const cardBorder = {
        blue: isOpen ? 'border-blue-200 ring-blue-100/50' : 'border-blue-100',
        orange: isOpen ? 'border-orange-200 ring-orange-100/50' : 'border-orange-100',
        green: isOpen ? 'border-green-200 ring-green-100/50' : 'border-green-100',
        gray: isOpen ? 'border-neutral-200 ring-neutral-100/50' : 'border-neutral-100',
    }[color] || (isOpen ? 'border-neutral-200 ring-neutral-100/50' : 'border-neutral-100');

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`rounded-xl border overflow-hidden shadow-sm transition-all duration-300 ${cardBorder} ${isOpen ? 'shadow-lg ring-2' : 'hover:border-neutral-300'}`}
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
                    className={`${isOpen ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-400'} p-1 rounded-full`}
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
