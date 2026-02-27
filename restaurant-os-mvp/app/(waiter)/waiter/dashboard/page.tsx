'use client';

import { useState, useEffect } from 'react';
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { OrderService, type Order, type TableMergeGroup } from '@/app/services/orders';

type TableViewStatus = 'ready' | 'cooking' | 'eating' | 'empty' | 'alert';

interface Table {
    id: number;
    table_number: string;
    status: string; // 'free' | 'occupied' | ... from DB
    capacity: number;
    alert_status?: 'call_waiter' | 'bill_requested' | null;
}

import { LucideBell, LucideReceipt, LucideGlassWater, LucideUtensils, LucidePipette, LucideDisc, LucideSoup, LucideGripHorizontal, LucideWind, LucideDroplet, LucideHandPlatter } from 'lucide-react';

export default function WaiterDashboard() {
    const [tables, setTables] = useState<Table[]>([]);
    const [mergeGroups, setMergeGroups] = useState<TableMergeGroup[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [activeTab, setActiveTab] = useState<'all' | TableViewStatus>('eating');
    const [loading, setLoading] = useState(true);

    // Merge State
    const [isMergeMode, setIsMergeMode] = useState(false);
    const [selectedForMerge, setSelectedForMerge] = useState<number[]>([]);
    const [isMerging, setIsMerging] = useState(false);

    const router = useRouter();

    // Fetch Data & Subscribe
    useEffect(() => {
        const loadData = async () => {
            try {
                const [fetchedTables, fetchedOrders, fetchedMergeGroups] = await Promise.all([
                    OrderService.fetchTables(),
                    OrderService.fetchActiveOrders(),
                    OrderService.fetchMergeGroups()
                ]);
                setTables(fetchedTables || []);
                setOrders(fetchedOrders || []);
                setMergeGroups(fetchedMergeGroups || []);
            } catch (err) {
                console.error('Failed to load dashboard data', err);
            } finally {
                setLoading(false);
            }
        };

        loadData();

        // Subscriptions
        const orderSub = OrderService.subscribeToOrders((payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
                // Refresh all for simplicity to handle status changes affecting table colors
                loadData();
            }
        });

        const tableSub = OrderService.subscribeToTables((payload) => {
            // Refresh tables if status changes directly (e.g. marked free)
            loadData();
        });

        const itemSub = OrderService.subscribeToOrderItems((payload) => {
            loadData();
        });

        const mergeSub = OrderService.subscribeToMergeGroups((payload) => {
            loadData();
        });

        return () => {
            orderSub.unsubscribe();
            tableSub.unsubscribe();
            itemSub.unsubscribe();
            mergeSub.unsubscribe();
        };
    }, []);

    // Helper: Compute Table Display Status based on Orders
    const getComputedStatus = (tableId: number, dbStatus: string): TableViewStatus => {
        // Find active orders for this table
        // We look at all active orders (including served/paid) to show them in the dashboard.
        const tableOrders = orders.filter(o => o.table_id === tableId);

        // Check for READY items specificially (more robust than order status)
        const hasReadyItems = tableOrders.some(o =>
            o.status === 'ready' ||
            (o.items && o.items.some((i: any) => i.status === 'ready'))
        );
        if (hasReadyItems) return 'ready';

        // Check for COOKING (Preparing or Placed)
        // Treat 'placed' as cooking so it shows up in that tab immediately
        const hasCookingItems = tableOrders.some(o =>
            ['preparing'].includes(o.status) ||
            (o.items && o.items.some((i: any) => ['preparing'].includes(i.status)))
        );
        if (hasCookingItems) return 'cooking';

        // If table is explicitly free (cleared by waiter), show as empty even if it has past orders
        // This handles "Move table to empty only if bill paid (Waiter check)"
        // The waiter checks, clears table -> status becomes free -> dashboard shows empty.
        // Note: We need to find the table object to check its status, but we only have ID here.
        // However, this helper is called within map where we have table object, OR we need to pass it.
        // Actually this helper 'getComputedStatus' uses 'dbStatus' argument.
        if (dbStatus === 'free') return 'empty';

        // If we have any active orders (placed, cooking, ready, served, paid) -> Eating
        if (tableOrders.length > 0) return 'eating';

        return 'empty';
    };

    const getMockMeta = (status: TableViewStatus) => {
        if (status === 'empty') return { guests: 0, time: '' };
        return { guests: Math.floor(Math.random() * 4) + 1, time: 'Now' }; // Placeholder
    };

    const getAlertDetails = (type: string | undefined | null) => {
        switch (type) {
            case 'bill_requested': return { label: 'Service Requested', icon: LucideReceipt, color: 'text-purple-600', bg: 'bg-purple-100' };
            case 'call_waiter': return { label: 'Waiter Called', icon: LucideHandPlatter, color: 'text-orange-600', bg: 'bg-orange-100' };
            case 'water_requested': return { label: 'Water', icon: LucideGlassWater, color: 'text-blue-600', bg: 'bg-blue-100' };
            case 'glass_requested': return { label: 'Extra Glass', icon: LucideGlassWater, color: 'text-sky-600', bg: 'bg-sky-100' };
            case 'cutlery_requested': return { label: 'Cutlery', icon: LucideUtensils, color: 'text-gray-600', bg: 'bg-gray-100' };
            case 'straw_requested': return { label: 'Straw', icon: LucidePipette, color: 'text-yellow-600', bg: 'bg-yellow-100' };
            case 'plate_requested': return { label: 'Extra Plate', icon: LucideDisc, color: 'text-zinc-600', bg: 'bg-zinc-100' };
            case 'bowl_requested': return { label: 'Finger Bowl', icon: LucideSoup, color: 'text-teal-600', bg: 'bg-teal-100' };
            case 'salt_requested': return { label: 'Salt', icon: LucideGripHorizontal, color: 'text-stone-600', bg: 'bg-stone-100' };
            case 'pepper_requested': return { label: 'Pepper', icon: LucideWind, color: 'text-stone-600', bg: 'bg-stone-100' };
            case 'sauce_requested': return { label: 'Ketchup', icon: LucideDroplet, color: 'text-red-600', bg: 'bg-red-100' };
            default: return { label: 'Alert', icon: LucideBell, color: 'text-red-600', bg: 'bg-red-100' };
        }
    };

    // Create merged groupings
    const displayEntities: any[] = [];
    const mergedGroupIdsRendered = new Set<string>();

    tables.forEach(table => {
        if ((table as any).is_merged && (table as any).merged_group_id) {
            if (!mergedGroupIdsRendered.has((table as any).merged_group_id)) {
                mergedGroupIdsRendered.add((table as any).merged_group_id);
                const group = mergeGroups.find(g => g.id === (table as any).merged_group_id);
                if (group) {
                    displayEntities.push({
                        ...group,
                        is_group: true,
                        table_number: group.display_name,
                        capacity: group.total_capacity
                    });
                }
            }
        } else {
            displayEntities.push({ ...table, is_group: false });
        }
    });

    const filteredTables = displayEntities.map(table => {
        // Active orders (including served/paid)
        const tableOrders = table.is_group
            ? orders.filter(o => o.merge_group_id === table.id)
            : orders.filter(o => o.table_id === table.id);

        // 1. Check for READY (Strictly check items to avoid false positives from stale parent status)
        const isReady = tableOrders.some(o =>
            o.items && o.items.some((i: any) => i.status === 'ready')
        );

        // 2. Check for COOKING (Preparing or Placed)
        const isCooking = tableOrders.some(o =>
            // Check items specifically (include 'placed' so new orders show as Cooking/Active immediately)
            (o.items && o.items.some((i: any) => ['preparing', 'placed'].includes(i.status))) ||
            // Fallback for orders without active items (shouldn't happen often) or if items logic fails
            ((!o.items || o.items.length === 0) && ['preparing', 'placed'].includes(o.status))
        );

        // 3. Eating (Any active order) - Valid for Served/Paid too
        // BUT: if table is free, it should be empty (handled in filter below or computed status)
        const isEating = tableOrders.length > 0;

        // Determine Visual Priority
        let computedStatus: TableViewStatus = 'empty';

        // Priority: Ready > Cooking > Eating (Served/Paid)
        if (isReady) computedStatus = 'ready';
        else if (isCooking) computedStatus = 'cooking';
        else if (isEating) computedStatus = 'eating';

        // Override if table is free (Cleared), but ONLY if there are no critical active orders.
        // If there are 'placed', 'preparing', or 'ready' orders, the table MUST be occupied.
        // We only allow 'free' status to hide orders if they are fully served/paid (waiting for clearance).
        const hasCriticalOrders = tableOrders.some(o => ['placed', 'preparing', 'ready'].includes(o.status));

        if (table.status === 'free' && !hasCriticalOrders && tableOrders.length === 0) {
            computedStatus = 'empty';
        }

        // Active orders for display
        return { ...table, computedStatus, isReady, isCooking, isEating: isEating && (table.status !== 'free' || hasCriticalOrders || isEating), activeOrders: tableOrders, ...getMockMeta(computedStatus) };
    }).filter(table => {
        if (activeTab === 'all') return true;

        // Multi-status filtering: Allow table to appear in multiple tabs if applicable
        if (activeTab === 'ready') return table.isReady;
        if (activeTab === 'cooking') return table.isCooking;
        if (activeTab === 'eating') return table.isEating; // Show all active tables
        if (activeTab === 'empty') return table.computedStatus === 'empty';
        if (activeTab === 'alert') return !!table.alert_status;

        return false;
    });

    const handleTableClick = (tableId: number | string, isGroup: boolean, computedStatus: TableViewStatus) => {
        if (isMergeMode) {
            if (isGroup) return; // Can't merge a merged group
            if (computedStatus !== 'empty') return; // Can only merge empty tables
            const numId = Number(tableId);
            setSelectedForMerge(prev =>
                prev.includes(numId) ? prev.filter(id => id !== numId) : [...prev, numId]
            );
            return;
        }
        router.push(`/waiter/order/${tableId}`);
    };

    const handleConfirmMerge = async () => {
        if (selectedForMerge.length < 2) return;
        setIsMerging(true);
        try {
            await OrderService.mergeTables(selectedForMerge);
            setIsMergeMode(false);
            setSelectedForMerge([]);
        } catch (error) {
            console.error('Failed to merge tables:', error);
            alert('Failed to merge tables.');
        } finally {
            setIsMerging(false);
        }
    };

    const handleDismissAlert = async (e: React.MouseEvent, tableId: number) => {
        e.stopPropagation(); // Prevent card click
        try {
            await OrderService.dismissTableAlert(tableId);
        } catch (error) {
            console.error('Failed to dismiss alert', error);
        }
    };

    const RenderTableCard = ({ table }: { table: any }) => {
        let statusColor = '';
        let statusText = '';
        let icon = '';
        let cardBg = 'bg-white';
        let borderColor = 'border-divider';

        // Determine Visual Status based on Active Tab context
        const displayStatus = activeTab === 'all' ? table.computedStatus : activeTab;

        switch (displayStatus) {
            case 'ready':
                statusColor = 'green';
                statusText = 'Ready';
                icon = 'table_restaurant';
                cardBg = 'bg-green-500';
                borderColor = 'border-green-600';
                break;
            case 'cooking':
                statusColor = 'orange';
                statusText = 'Cooking';
                icon = 'skillet';
                cardBg = 'bg-orange-500';
                borderColor = 'border-orange-600';
                break;
            case 'eating':
                statusColor = 'blue'; // Changed to Blue as requested
                statusText = 'Eating';
                icon = 'restaurant';
                cardBg = 'bg-blue-500';
                borderColor = 'border-blue-600';
                break;
            case 'empty':
                statusColor = 'gray';
                statusText = 'Empty';
                icon = 'event_seat';
                cardBg = 'bg-white';
                borderColor = 'border-gray-200';
                break;
        }

        const isDark = ['ready', 'cooking', 'eating'].includes(displayStatus);
        const textColor = isDark ? 'text-white' : 'text-charcoal';
        const subTextColor = isDark ? 'text-green-50' : 'text-gray-500';
        const iconColor = isDark ? 'text-white' : `text-${statusColor}-600`;
        const badgeBg = isDark ? 'bg-white/20' : `bg-${statusColor}-100`;
        const badgeText = isDark ? 'text-white' : `text-${statusColor}-700`;

        // Extract and flatten items, handling potential duplicates if needed
        const allItems = table.activeOrders?.flatMap((o: Order) => o.items || []) || [];
        const displayItems = allItems.slice(0, 3);
        const remainingCount = allItems.length - 3;

        const isSelectedForMerge = selectedForMerge.includes(table.id);

        return (
            <div
                key={table.id}
                onClick={() => handleTableClick(table.id, table.is_group, displayStatus)}
                className={`flex flex-col p-4 rounded-2xl border ${isMergeMode && isSelectedForMerge ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-500 shadow-md' : borderColor} ${isMergeMode && isSelectedForMerge ? '' : cardBg} ${isMergeMode && (table.is_group || displayStatus !== 'empty') ? 'opacity-50 grayscale cursor-not-allowed' : 'shadow-sm active:scale-95 transition-transform cursor-pointer'} relative overflow-hidden min-h-[140px]`}
            >
                <div className="flex justify-between items-start mb-2">
                    <span className={`material-icons-outlined ${iconColor} text-3xl`}>{icon}</span>
                    <span className={`px-2 py-1 rounded-lg ${badgeBg} ${badgeText} text-[10px] font-black uppercase tracking-wide backdrop-blur-sm`}>{statusText}</span>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <h3 className={`${textColor} md:text-xl text-lg font-bold leading-tight flex items-center gap-1`}>
                        {table.is_group ? table.display_name : `Table-${table.id}`}
                    </h3>
                    {table.is_group && (
                        <span className={`px-2 py-0.5 rounded-full ${badgeBg} ${badgeText} text-[10px] font-bold uppercase tracking-wider mb-1`}>Merged</span>
                    )}
                    <p className={`${subTextColor} text-xs font-medium mb-3`}>
                        {table.computedStatus !== 'empty' ? 'Eating' : `Capacity: ${table.capacity || 4}`}
                    </p>
                </div>

                {/* Visual Indicator Strip (Only for empty tables now, or removed for dark ones) */}
                {!isDark && <div className={`absolute bottom-0 left-0 w-full h-1 bg-${statusColor}-400`}></div>}

                {/* ACTIVE ALERT OVERLAY */}
                {table.alert_status && (
                    <div className="absolute top-0 right-0 p-2 z-20 flex gap-2">
                        <button
                            onClick={(e) => handleDismissAlert(e, table.id)}
                            className={`p-2 rounded-full shadow-lg animate-bounce transition-colors flex items-center gap-2 px-3 ${getAlertDetails(table.alert_status).bg
                                } ${getAlertDetails(table.alert_status).color}`}
                        >
                            {/* Render Icon Dynamically */}
                            {(() => {
                                const Icon = getAlertDetails(table.alert_status).icon;
                                return <Icon size={18} />;
                            })()}
                            <span className="text-xs font-bold leading-none">{getAlertDetails(table.alert_status).label}</span>
                        </button>
                    </div>
                )}

                {table.alert_status && (
                    <div className="absolute inset-x-0 top-0 bg-red-500/10 h-full w-full pointer-events-none border-2 border-red-500 rounded-2xl animate-pulse"></div>
                )}
            </div>
        );
    };



    return (
        <div className="flex flex-col h-full bg-white relative overflow-hidden">
            {/* Header */}
            <header className="flex items-center bg-white p-4 pb-2 justify-between sticky top-0 z-10 border-b border-divider shrink-0">
                <div className="text-primary flex size-10 shrink-0 items-center justify-center">
                    <span className="material-icons-outlined text-2xl font-bold">grid_view</span>
                </div>
                <h2 className="text-charcoal text-lg font-bold leading-tight tracking-tight flex-1 text-center">Tables</h2>
                <div className="flex w-auto items-center justify-end">
                    <button
                        onClick={() => {
                            setIsMergeMode(!isMergeMode);
                            setSelectedForMerge([]);
                        }}
                        className={`flex cursor-pointer items-center justify-center rounded-lg h-9 px-3 transition-colors shrink-0 ${isMergeMode ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-charcoal border border-gray-200 shadow-sm hover:bg-gray-200'}`}
                    >
                        <span className="text-[11px] font-black uppercase tracking-wider">{isMergeMode ? 'Cancel' : 'Merge Tables'}</span>
                    </button>
                </div>
            </header>

            {/* Filter Tabs */}
            <div className="flex gap-3 p-4 overflow-x-auto no-scrollbar bg-white/80 backdrop-blur-md border-b border-gray-100/50 shrink-0 sticky top-[73px] z-20">
                <LayoutGroup>
                    {['eating', 'ready', 'cooking', 'empty'].map(tab => {
                        const isActive = activeTab === tab;

                        let activeColorClass = '';
                        switch (tab) {
                            case 'eating': activeColorClass = 'bg-gradient-to-r from-blue-600 to-blue-500 shadow-lg shadow-blue-500/40 ring-1 ring-blue-500/50'; break;
                            case 'ready': activeColorClass = 'bg-gradient-to-r from-emerald-500 to-green-600 shadow-lg shadow-green-500/40 ring-1 ring-green-500/50'; break;
                            case 'cooking': activeColorClass = 'bg-gradient-to-r from-orange-500 to-amber-600 shadow-lg shadow-orange-500/40 ring-1 ring-orange-500/50'; break;
                            case 'empty': activeColorClass = 'bg-gradient-to-r from-neutral-700 to-neutral-800 shadow-lg shadow-gray-500/40 ring-1 ring-neutral-700/50'; break;
                        }

                        return (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`relative flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full px-4 transition-all duration-500 active:scale-95 ${isActive
                                    ? 'text-white'
                                    : 'bg-white text-gray-400 font-bold border border-gray-100 shadow-sm hover:border-gray-300 hover:text-gray-600 hover:shadow-md hover:-translate-y-0.5'
                                    }`}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="dashboardActiveTab"
                                        className={`absolute inset-0 rounded-full z-0 ${activeColorClass}`}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                    />
                                )}
                                <span className={`relative z-10 text-[11px] font-black uppercase tracking-wider ${isActive ? 'drop-shadow-sm' : ''}`}>
                                    {tab}
                                </span>
                            </button>
                        );
                    })}
                </LayoutGroup>
            </div>

            {/* Main Grid */}
            <main className="flex-1 overflow-y-auto bg-gray-50/50 p-4 pb-6">
                {loading ? (
                    <div className="flex items-center justify-center h-64 text-gray-400">Loading tables...</div>
                ) : filteredTables.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                        {filteredTables.map(table => <RenderTableCard key={table.id} table={table} />)}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <span className="material-icons-outlined text-4xl mb-2 opacity-50">table_restaurant</span>
                        <p className="text-sm">No tables found.</p>
                    </div>
                )}
            </main>

            {/* Merge Action Floating Button */}
            <AnimatePresence>
                {isMergeMode && selectedForMerge.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="fixed bottom-[100px] left-0 right-0 z-40 flex justify-center px-4"
                    >
                        <div className="bg-neutral-900 text-white rounded-2xl p-4 shadow-2xl flex items-center justify-between w-full max-w-sm border border-neutral-700 backdrop-blur-xl bg-opacity-95">
                            <div>
                                <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">{selectedForMerge.length} Selected</p>
                                <p className="text-sm font-black text-white">Merge Tables</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setIsMergeMode(false);
                                        setSelectedForMerge([]);
                                    }}
                                    className="px-4 py-3 bg-neutral-800 text-neutral-300 font-bold rounded-xl active:scale-95 transition-transform"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmMerge}
                                    disabled={selectedForMerge.length < 2 || isMerging}
                                    className={`px-5 py-3 ${selectedForMerge.length < 2 ? 'bg-neutral-700 text-neutral-500' : 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 active:scale-95'} font-bold rounded-xl flex items-center gap-2 transition-all`}
                                >
                                    {isMerging ? (
                                        <div className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                                    ) : (
                                        <LucideGripHorizontal size={18} />
                                    )}
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div >
    );
}
