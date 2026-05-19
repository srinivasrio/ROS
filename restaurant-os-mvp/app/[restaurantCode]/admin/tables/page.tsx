'use client';

import { QrCode as LucideQrCode, Download as LucideDownload, Plus as LucidePlus, Edit as LucideEdit, Printer as LucidePrinter, Trash2 as LucideTrash2, CreditCard as LucideCreditCard, X as LucideX, CheckCircle as LucideCheckCircle, AlertCircle as LucideAlertCircle, ChefHat as LucideChefHat, Utensils as LucideUtensils, Users as LucideUsers, Table as LucideTable } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';
import { OrderService, Order, TableMergeGroup } from '@/app/services/orders';
import QRCode from 'react-qr-code';
import { formatCurrency } from '@/app/lib/utils';
import { toast } from 'sonner';

import { useRestaurantId } from '@/app/hooks/useRestaurantId';
import { getCached, setCache } from '@/app/lib/data-cache';
import { LoadingState } from '@/components/ui/LoadingState';

export default function TableManagement() {
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const cached = getCached<any>(`tables-${restaurantId}`);
    const [tables, setTables] = useState<any[]>(cached?.tables || []);
    const [mergeGroups, setMergeGroups] = useState<TableMergeGroup[]>(cached?.mergeGroups || []);
    const [orders, setOrders] = useState<Order[]>(cached?.orders || []);
    const [loading, setLoading] = useState(!cached);

    // Merge Mode State
    const [isMergeMode, setIsMergeMode] = useState(false);
    const [selectedForMerge, setSelectedForMerge] = useState<number[]>([]);
    const [isMerging, setIsMerging] = useState(false);

    // Modals State
    const [selectedQrTable, setSelectedQrTable] = useState<any | null>(null);
    const [selectedTable, setSelectedTable] = useState<any | null>(null);
    const [confirmAction, setConfirmAction] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        action: () => Promise<void>;
        type: 'danger' | 'info' | 'success';
    }>({ isOpen: false, title: '', message: '', action: async () => { }, type: 'info' });

    const [filter, setFilter] = useState('ALL');

    // Add Table State
    const [isAddTableOpen, setIsAddTableOpen] = useState(false);
    const [newTableNumber, setNewTableNumber] = useState('');
    const [newTableCapacity, setNewTableCapacity] = useState(4);
    const [isAddingTable, setIsAddingTable] = useState(false);

    useEffect(() => {
        if (!restaurantLoading && restaurantId) {
            const loadData = async () => {
                try {
                    const [allTables, activeOrders, allMergeGroups] = await Promise.all([
                        OrderService.fetchTables(restaurantId),
                        OrderService.fetchActiveOrders(restaurantId),
                        OrderService.fetchMergeGroups(restaurantId)
                    ]);
                    setTables(allTables || []);
                    setOrders(activeOrders || []);
                    setMergeGroups(allMergeGroups || []);
                    setCache(`tables-${restaurantId}`, {
                        tables: allTables || [],
                        orders: activeOrders || [],
                        mergeGroups: allMergeGroups || []
                    });
                } catch (err) {
                    console.error(err);
                } finally {
                    setLoading(false);
                }
            };

            loadData();

            const sub1 = OrderService.subscribeToTables(restaurantId, () => loadData());
            const sub2 = OrderService.subscribeToOrders(restaurantId, () => loadData());
            const sub3 = OrderService.subscribeToOrderItems(restaurantId, () => loadData());
            const sub4 = OrderService.subscribeToMergeGroups(restaurantId, () => loadData());

            return () => {
                sub1.unsubscribe();
                sub2.unsubscribe();
                sub3.unsubscribe();
                sub4.unsubscribe();
            }
        }
    }, [restaurantId, restaurantLoading]);

    const displayEntities = useMemo(() => {
        const entities: any[] = [];
        const mergedGroupIdsRendered = new Set<string>();

        tables.forEach(table => {
            if (table.is_merged && table.merged_group_id) {
                if (!mergedGroupIdsRendered.has(table.merged_group_id)) {
                    mergedGroupIdsRendered.add(table.merged_group_id);
                    const group = mergeGroups.find(g => g.id === table.merged_group_id);
                    if (group) {
                        entities.push({
                            ...group,
                            is_group: true,
                            table_number: group.display_name,
                            capacity: group.total_capacity
                        });
                    }
                }
            } else {
                entities.push({ ...table, is_group: false });
            }
        });

        // Numeric sort for table numbers (e.g. 1, 2, 10)
        return entities.sort((a, b) =>
            (a.table_number || '').toString().localeCompare((b.table_number || '').toString(), undefined, { numeric: true, sensitivity: 'base' })
        );
    }, [tables, mergeGroups]);

    // Helper: Find active order for an entity
    const getDisplayOrder = (entityId: number | string, isGroup: boolean = false) => {
        if (isGroup) {
            return orders.find(o => o.merge_group_id === entityId);
        }
        return orders.find(o => o.table_id === entityId);
    }

    const getTablePhase = (table: any, order: Order | undefined) => {
        // Critical Order Check
        if (order && ['placed', 'preparing', 'ready'].includes(order.status)) {
            if (order.status === 'ready') return 'READY';
            if (order.status === 'preparing') return 'COOKING';
            if (order.status === 'placed') return 'NEW';
        }

        // Even if table.status is free/empty, if there is a served/paid order, it's still eating/occupied until clearTable
        if (order && (order.status === 'served' || order.status === 'paid')) return 'EATING';

        // Map new table statuses to EATING (Occupied) phase
        if (table.status === 'billing' || table.status === 'cleaning' || table.status === 'customer_present' || table.status === 'ordering' || table.status === 'eating' || table.status === 'reserved') {
            return 'EATING';
        }

        if (table.status === 'free' || table.status === 'empty') return 'EMPTY';
        return 'EMPTY';
    };

    const filters = [
        { label: 'ALL', value: 'ALL', color: 'bg-neutral-900 text-white shadow-neutral-400' },
        { label: 'NEW', value: 'NEW', color: 'bg-blue-600 text-white shadow-blue-200' },
        { label: 'COOKING', value: 'COOKING', color: 'bg-orange-600 text-white shadow-orange-200' },
        { label: 'READY', value: 'READY', color: 'bg-green-600 text-white shadow-green-200' },
        { label: 'EATING', value: 'EATING', color: 'bg-red-600 text-white shadow-red-200' },
        { label: 'EMPTY', value: 'EMPTY', color: 'bg-neutral-500 text-white shadow-neutral-300' },
    ];



    const filteredEntities = displayEntities.filter(entity => {
        if (filter === 'ALL') return true;
        const order = getDisplayOrder(entity.id, entity.is_group);
        const phase = getTablePhase(entity, order);
        return phase === filter;
    });

    const handleConfirmMerge = async () => {
        if (selectedForMerge.length < 2) return;
        if (!restaurantId) return;
        setIsMerging(true);
        try {
            await OrderService.mergeTables(selectedForMerge, restaurantId);
            toast.success('Tables successfully merged!');
            setIsMergeMode(false);
            setSelectedForMerge([]);
        } catch (error: any) {
            toast.error(error.message || 'Failed to merge tables.');
        } finally {
            setIsMerging(false);
        }
    };

    const handleTableClick = (entity: any) => {
        if (isMergeMode) {
            if (entity.is_group || entity.is_merged) {
                toast.warning('Cannot merge an already merged table.');
                return;
            }
            if (entity.status !== 'free' && entity.status !== 'available') {
                toast.warning('Only unoccupied tables can be merged.');
                return;
            }
            setSelectedForMerge(prev =>
                prev.includes(entity.id) ? prev.filter(id => id !== entity.id) : [...prev, entity.id]
            );
            return;
        }

        const order = getDisplayOrder(entity.id, entity.is_group);
        const phase = getTablePhase(entity, order);

        // Allow opening modal if occupied OR if it's an empty merge group (so admin can unmerge)
        if ((phase !== 'EMPTY' && order) || (phase === 'EMPTY' && entity.is_group)) {
            setSelectedTable({ ...entity, order, phase });
        }
    };

    // --- Actions with Confirmation Modal ---

    const requestSettleBill = () => {
        if (!selectedTable?.order) return;
        const total = selectedTable.order.total_amount;
        const paid = selectedTable.order.amount_paid || 0;
        const toPay = total - paid;

        setConfirmAction({
            isOpen: true,
            title: paid > 0 ? 'Settle Balance?' : 'Settle Bill?',
            message: `Mark Order #${selectedTable.order.id.slice(0, 8)} as PAID? \n\nTotal: ${formatCurrency(total)}\nPaid: ${formatCurrency(paid)}\nTo Pay: ${formatCurrency(toPay)}`,
            type: 'info',
            action: async () => {
                if (!restaurantId) return;
                await OrderService.settleBill(selectedTable.order.id, restaurantId, total, 'Admin');
                setSelectedTable(null);
            }
        });
    };

    const requestClearTable = () => {
        if (!selectedTable?.id) return;
        setConfirmAction({
            isOpen: true,
            title: 'Clear Table?',
            message: 'This will free the table for new guests. Ensure table is clean.',
            type: 'danger',
            action: async () => {
                if (!restaurantId) return;
                await OrderService.clearTable(selectedTable.id, restaurantId);
                setSelectedTable(null);
            }
        });
    };

    const requestUnmerge = () => {
        if (!selectedTable?.is_group) return;
        setConfirmAction({
            isOpen: true,
            title: 'Unmerge Tables?',
            message: `Are you sure you want to unmerge ${selectedTable.display_name}? This will separate the tables.`,
            type: 'info',
            action: async () => {
                if (!restaurantId) return;
                await OrderService.unmergeTables(selectedTable.id, restaurantId);
                setSelectedTable(null);
                toast.success('Tables successfully unmerged.');
            }
        });
    };

    const handlePrintBill = () => {
        window.print();
    };

    const handleAddTable = async () => {
        if (!newTableNumber) return;
        if (!restaurantId) return;
        setIsAddingTable(true);
        try {
            await OrderService.addTable(newTableNumber, newTableCapacity, restaurantId);
            setIsAddTableOpen(false);
            setNewTableNumber('');
            setNewTableCapacity(4);
            // Data will refresh via subscription
        } catch (error: any) {
            console.error('Failed to add table:', error);
            if (error.message && error.message.includes('already exists')) {
                toast.warning(`Table ${newTableNumber} already exists. Please enter a new table number.`);
            } else {
                toast.error('Failed to add table. Please try again.');
            }
        } finally {
            setIsAddingTable(false);
        }
    };

    const handleDeleteTable = (tableId: number, tableNumber: string) => {
        setConfirmAction({
            isOpen: true,
            title: 'Delete Table?',
            message: `Are you sure you want to permanently delete Table ${tableNumber}? This cannot be undone.`,
            type: 'danger',
            action: async () => {
                if (!restaurantId) return;
                try {
                    await OrderService.deleteTable(tableId, restaurantId);
                    toast.success(`Table ${tableNumber} deleted.`);
                } catch (error: any) {
                    toast.error(error.message || 'Failed to delete table.');
                }
            }
        });
    };

    return (
        <div className="p-8 space-y-7">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
                <div>
                    <h2 className="text-2xl font-black text-black tracking-tight">Tables</h2>
                    <p className="text-sm font-medium text-black mt-1">Real-time floor status & management</p>
                </div>
                <div className="flex items-start justify-end gap-x-8 gap-y-4 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                        {filters.map(f => {
                            const isActive = filter === f.value;
                            return (
                                <button
                                    key={f.value}
                                    onClick={() => setFilter(filter === f.value ? 'ALL' : f.value)}
                                    className={`relative px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 ${isActive ? 'text-white scale-105' : 'bg-white text-black border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300'}`}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeFilter"
                                            className={`absolute inset-0 rounded-full ${f.color} shadow-lg -z-10`}
                                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                        />
                                    )}
                                    <span className="relative z-10">{f.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-start gap-6 -mt-2">
                        <div className="h-10 w-px bg-neutral-200 mx-1 hidden xl:block"></div>

                        {isMergeMode ? (
                            <motion.div 
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex flex-col gap-2 min-w-[140px]"
                            >
                                <button
                                    onClick={handleConfirmMerge}
                                    disabled={selectedForMerge.length < 2 || isMerging}
                                    className={`w-full flex items-center justify-center px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-lg active:scale-95 ${selectedForMerge.length < 2 || isMerging ? 'bg-neutral-200 text-black cursor-not-allowed shadow-none' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20'}`}
                                >
                                    {isMerging ? 'Merging...' : `Confirm (${selectedForMerge.length})`}
                                </button>
                                <button
                                    onClick={() => { setIsMergeMode(false); setSelectedForMerge([]); }}
                                    className="w-full px-4 py-2 bg-neutral-100 text-black text-xs font-bold rounded-xl hover:bg-neutral-200 transition-all active:scale-95"
                                >
                                    Cancel
                                </button>
                            </motion.div>
                        ) : (
                            <motion.div 
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex flex-col gap-2 min-w-[140px]"
                            >
                                <button
                                    onClick={() => setIsMergeMode(true)}
                                    className="w-full px-4 py-2 bg-white border border-neutral-200 text-black text-xs font-bold rounded-xl hover:bg-neutral-50 hover:border-neutral-300 transition-all active:scale-95 shadow-sm"
                                >
                                    Merge Tables
                                </button>
                                {filter === 'EMPTY' && (
                                    <motion.button
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        onClick={() => setIsAddTableOpen(true)}
                                        className="w-full flex items-center justify-center px-4 py-2 bg-neutral-900 text-white text-xs font-bold rounded-xl hover:bg-black transition-all shadow-md active:scale-95 group"
                                    >
                                        <LucidePlus size={16} className="mr-1.5 group-hover:rotate-90 transition-transform duration-300" />
                                        Add Table
                                    </motion.button>
                                )}
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>

            {loading ? <LoadingState message="Loading tables..." /> : filteredEntities.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-96 text-center bg-white rounded-3xl border border-neutral-100 shadow-sm animate-in fade-in duration-500">
                    <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center mb-6 ring-8 ring-neutral-50/50">
                        <LucideTable size={32} className="text-black" />
                    </div>
                    <h3 className="text-xl font-black text-black mb-2">No Tables Found</h3>
                    <div className="h-16 flex items-center justify-center">
                        <p className="text-sm font-medium text-black max-w-sm leading-relaxed">
                            {filter === 'ALL' || filter === 'EMPTY' 
                                ? "You haven't set up any tables yet. Add your floor plan to start managing your dining area and taking orders."
                                : `No tables currently in ${filter} phase.`
                            }
                        </p>
                    </div>
                    <div className="h-12 flex items-center justify-center mt-4">
                        {(filter === 'ALL' || filter === 'EMPTY') && (
                            <motion.button
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                onClick={() => setIsAddTableOpen(true)}
                                className="flex items-center px-4 py-2 bg-neutral-900 text-white text-xs font-bold rounded-xl hover:bg-black transition-all shadow-xl shadow-neutral-900/20 active:scale-95 hover:-translate-y-1"
                            >
                                <LucidePlus size={16} className="mr-1.5" />
                                Add First Table
                            </motion.button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {filteredEntities.map((table, idx) => {
                        const activeOrder = getDisplayOrder(table.id, table.is_group);
                        const phase = getTablePhase(table, activeOrder);

                        // Waiter App Style Match
                        // Default (Empty)
                        let cardStyle = 'bg-white border-neutral-200 hover:border-neutral-400 shadow-sm hover:shadow-xl';
                        let badgeStyle = 'bg-neutral-100 text-black border border-neutral-200';
                        let textColor = 'text-black';
                        let subTextColor = 'text-black';
                        let indicatorColor = 'bg-neutral-300';
                        let iconColor = 'text-black';

                        // Active States (Solid Colors)
                        if (phase === 'EATING') {
                            cardStyle = 'bg-red-500 border-red-600 shadow-red-200 hover:shadow-red-300';
                            badgeStyle = 'bg-white/20 text-white border border-white/20 backdrop-blur-sm';
                            textColor = 'text-white';
                            subTextColor = 'text-red-50';
                            indicatorColor = 'bg-white';
                            iconColor = 'text-white';
                        } else if (phase === 'READY') {
                            cardStyle = 'bg-green-500 border-green-600 shadow-green-200 hover:shadow-green-300';
                            badgeStyle = 'bg-white/20 text-white border border-white/20 backdrop-blur-sm';
                            textColor = 'text-white';
                            subTextColor = 'text-green-50';
                            indicatorColor = 'bg-white';
                            iconColor = 'text-white';
                        } else if (phase === 'COOKING') {
                            cardStyle = 'bg-orange-500 border-orange-600 shadow-orange-200 hover:shadow-orange-300';
                            badgeStyle = 'bg-white/20 text-white border border-white/20 backdrop-blur-sm';
                            textColor = 'text-white';
                            subTextColor = 'text-orange-50';
                            indicatorColor = 'bg-white';
                            iconColor = 'text-white';
                        } else if (phase === 'NEW') {
                            cardStyle = 'bg-blue-500 border-blue-600 shadow-blue-200 hover:shadow-blue-300';
                            badgeStyle = 'bg-white/20 text-white border border-white/20 backdrop-blur-sm';
                            textColor = 'text-white';
                            subTextColor = 'text-blue-50';
                            indicatorColor = 'bg-white';
                            iconColor = 'text-white';
                        }

                        const isOccupied = phase !== 'EMPTY';
                        const isSelectedForMerge = selectedForMerge.includes(table.id);

                        // Merge Mode Styling overrides
                        if (isMergeMode) {
                            if (table.is_group || table.is_merged) {
                                cardStyle = 'bg-neutral-100 border-neutral-200 opacity-50 cursor-not-allowed'; // Disabled
                            } else if (phase !== 'EMPTY') {
                                cardStyle = 'bg-neutral-100 border-neutral-200 opacity-50 cursor-not-allowed'; // Disabled
                            } else if (isSelectedForMerge) {
                                cardStyle = 'bg-blue-50 border-blue-500 shadow-blue-200 ring-2 ring-blue-500 ring-offset-2'; // Selected
                                textColor = 'text-blue-900';
                            } else {
                                cardStyle = 'bg-white border-neutral-200 hover:border-blue-300 hover:shadow-md'; // Selectable
                            }
                        }

                        return (
                            <div
                                key={table.id}
                                onClick={() => handleTableClick(table)}
                                style={{ animationDelay: `${idx * 50}ms` }}
                                className={`
                                    relative group rounded-2xl border p-5 h-40 flex flex-col justify-between
                                    cursor-pointer transition-all duration-300 ease-out hover:-translate-y-1.5
                                    animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards
                                    ${cardStyle}
                                `}
                            >
                                {isMergeMode && isSelectedForMerge && (
                                    <div className="absolute -top-2 -right-2 bg-blue-600 text-white rounded-full p-1 shadow-md z-10">
                                        <LucideCheckCircle size={16} />
                                    </div>
                                )}
                                {/* Status Indicator Dot */}
                                <div className={`absolute top-5 right-5 h-3 w-3 rounded-full ${indicatorColor} ${phase === 'COOKING' ? 'animate-pulse' : ''}`}>
                                    {phase === 'COOKING' && <div className="absolute inset-0 rounded-full bg-white animate-ping opacity-75"></div>}
                                </div>

                                {/* Top Section: Number, Capacity, Status, QR */}
                                <div>
                                    <div className="flex justify-between items-start">
                                        <span className={`text-3xl font-black ${textColor} tracking-tighter leading-none`}>
                                            {table.table_number || table.id}
                                        </span>
                                    </div>

                                    {table.capacity && (
                                        <div className={`mt-2 mb-1.5 text-[11px] font-bold flex items-center gap-1 ${phase === 'EMPTY' ? 'text-black' : 'text-white/90'}`}>
                                            <LucideUsers size={12} />
                                            {table.capacity} Seater
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center mt-1">
                                        <div className={`
                                            inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest
                                            ${badgeStyle}
                                        `}>
                                            {phase}
                                        </div>
                                        {/* QR Button inline with status */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setSelectedQrTable(table); }}
                                            className={`${iconColor} hover:text-white hover:bg-white/20 rounded-full p-1 transition-colors opacity-0 group-hover:opacity-100 duration-200`}
                                        >
                                            <LucideQrCode size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* Bottom: Info */}
                                <div className="space-y-3">
                                    {/* The top half elements were moved out of here */}

                                    {isOccupied && activeOrder ? (
                                        <div className="pt-2 border-t border-white/20 flex flex-col gap-1">
                                            <div className="flex items-center justify-between">
                                                <span className={`text-[10px] font-bold ${subTextColor} uppercase tracking-wide`}>Host</span>
                                                <span className={`text-[11px] font-bold ${textColor} tracking-tight truncate max-w-[90px] text-right`}>
                                                    {activeOrder.waiter_name || 'Unassigned'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className={`text-[10px] font-bold ${subTextColor} uppercase tracking-wide`}>Bill</span>
                                                <span className={`text-sm font-black ${textColor} tracking-tight`}>
                                                    {formatCurrency((activeOrder.total_amount * 1.05) - (activeOrder.discount_amount || 0))}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="pt-3 border-t border-transparent flex items-end justify-between">
                                            <span className={`text-xs ${subTextColor} font-medium`}>Available</span>
                                            {!table.is_group && !isMergeMode && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteTable(table.id, table.table_number || table.id); }}
                                                    className="text-black hover:text-red-500 hover:bg-red-50 rounded-lg p-1.5 transition-all opacity-0 group-hover:opacity-100 duration-200"
                                                    title="Delete table"
                                                >
                                                    <LucideTrash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div >
            )}

            {/* --- MODALS --- */}

            {/* Detail Modal */}
            {
                selectedTable && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-5 duration-300">
                            {/* Header */}
                            <div className="p-6 border-b border-neutral-100 bg-neutral-50/80 flex justify-between items-center backdrop-blur-md">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-2xl font-black text-black">
                                            {selectedTable.is_group ? selectedTable.display_name : `Table ${selectedTable.table_number}`}
                                        </h3>
                                        {selectedTable.is_group && (
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase rounded-full tracking-wider">Merged</span>
                                        )}
                                    </div>
                                    <p className="text-xs font-bold text-black uppercase tracking-widest mt-1">Order #{selectedTable.order?.id.slice(0, 8)}</p>
                                </div>
                                <div className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${selectedTable.phase === 'EATING' ? 'bg-blue-100 text-blue-700' :
                                    selectedTable.phase === 'READY' ? 'bg-green-100 text-green-700' :
                                        selectedTable.phase === 'COOKING' ? 'bg-orange-100 text-orange-700' : 'bg-neutral-100'
                                    }`}>
                                    {selectedTable.phase}
                                </div>
                            </div>

                            {/* Items List */}
                            <div className="p-0 overflow-y-auto flex-1 bg-white">
                                {selectedTable.order?.items?.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center p-4 border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                                        <div className="flex items-start gap-4">
                                            <span className="flex items-center justify-center size-7 bg-neutral-100 rounded-lg text-sm font-bold text-black">
                                                {item.quantity}
                                            </span>
                                            <div>
                                                <p className="text-sm font-bold text-black leading-tight">{item.name}</p>
                                                <p className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${item.status === 'ready' ? 'text-green-600' :
                                                    item.status === 'served' ? 'text-black' :
                                                        item.status === 'paid' ? 'text-green-600' : 'text-orange-500'
                                                    }`}>
                                                    {item.status === 'preparing' ? 'COOKING' : item.status}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-sm font-medium text-black">
                                            {formatCurrency(item.price * item.quantity)}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Actions Footer */}
                            <div className="p-5 border-t border-neutral-100 bg-neutral-50 space-y-5">
                                {/* Coupon Discount */}
                                {(selectedTable.order?.discount_amount || 0) > 0 && (
                                    <div className="flex items-center justify-between bg-green-50 rounded-xl px-4 py-2.5 border border-green-100">
                                        <div className="flex items-center gap-2">
                                            <span className="text-green-600 text-xs font-bold">🎫 Coupon: {selectedTable.order?.coupon_code}</span>
                                        </div>
                                        <span className="text-green-700 font-bold text-sm">-{formatCurrency(selectedTable.order?.discount_amount)}</span>
                                    </div>
                                )}

                                <div className="flex justify-between items-center px-1">
                                    <div className="flex flex-col">
                                        <span className="text-black font-medium text-sm">Total Amount</span>
                                        {(selectedTable.order?.amount_paid || 0) > 0 && (
                                            <div className="flex flex-col">
                                                <span className="text-green-600 font-bold text-xs">Paid: {formatCurrency(selectedTable.order?.amount_paid)}</span>
                                                {selectedTable.order?.paid_by && (
                                                    <span className="text-[10px] text-black font-medium">via {selectedTable.order?.paid_by}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <span className="text-3xl font-black text-black tracking-tight">
                                            {formatCurrency((selectedTable.order?.total_amount || 0) - (selectedTable.order?.discount_amount || 0))}
                                        </span>
                                        {(selectedTable.order?.discount_amount || 0) > 0 && (
                                            <p className="text-black text-xs line-through">
                                                {formatCurrency(selectedTable.order?.total_amount || 0)}
                                            </p>
                                        )}
                                        {/* Show Taxes if needed, currently raw total_amount is used */}
                                        {(selectedTable.order?.amount_paid || 0) > 0 && (
                                            <p className="text-orange-600 font-bold text-sm">
                                                Due: {formatCurrency((selectedTable.order?.total_amount || 0) - (selectedTable.order?.discount_amount || 0) - (selectedTable.order?.amount_paid || 0))}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={handlePrintBill}
                                        className="flex items-center justify-center gap-2 py-3.5 bg-white border border-neutral-200 text-black font-bold rounded-xl hover:bg-neutral-50 hover:border-neutral-300 transition-all active:scale-95"
                                    >
                                        <LucidePrinter size={18} />
                                        Print Bill
                                    </button>

                                    {selectedTable.order?.status === 'paid' && (selectedTable.order?.amount_paid || 0) >= ((selectedTable.order?.total_amount || 0) - (selectedTable.order?.discount_amount || 0)) ? (
                                        <button
                                            onClick={requestClearTable}
                                            className="flex items-center justify-center gap-2 py-3.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 active:scale-95"
                                        >
                                            <LucideTrash2 size={18} />
                                            Clear Table
                                        </button>
                                    ) : selectedTable.is_group && !selectedTable.order ? (
                                        <button
                                            onClick={requestUnmerge}
                                            className="flex items-center justify-center gap-2 py-3.5 bg-neutral-900 text-white font-bold rounded-xl hover:bg-black transition-all shadow-lg shadow-neutral-900/20 active:scale-95"
                                        >
                                            Unmerge Table
                                        </button>
                                    ) : (
                                        <button
                                            onClick={requestSettleBill}
                                            className="flex items-center justify-center gap-2 py-3.5 bg-neutral-900 text-white font-bold rounded-xl hover:bg-black transition-all shadow-lg shadow-neutral-900/20 active:scale-95"
                                        >
                                            <LucideCreditCard size={18} />
                                            {(selectedTable.order?.amount_paid || 0) > 0 ? 'Settle Balance' : 'Settle Bill'}
                                        </button>
                                    )}
                                </div>
                                <button
                                    onClick={() => setSelectedTable(null)}
                                    className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-black hover:text-black"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Custom Confirmation Modal */}
            {
                confirmAction.isOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 animate-in zoom-in-95 duration-200">
                            <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${confirmAction.type === 'danger' ? 'bg-red-100' : 'bg-blue-100'
                                } mb-4`}>
                                {confirmAction.type === 'danger' ? (
                                    <LucideAlertCircle className="h-6 w-6 text-red-600" />
                                ) : (
                                    <LucideCheckCircle className="h-6 w-6 text-blue-600" />
                                )}
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-black">{confirmAction.title}</h3>
                                <p className="mt-2 text-sm text-black">
                                    {confirmAction.message}
                                </p>
                            </div>
                            <div className="mt-6 grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setConfirmAction({ ...confirmAction, isOpen: false })}
                                    className="inline-flex justify-center rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-black shadow-sm hover:bg-neutral-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        await confirmAction.action();
                                        setConfirmAction({ ...confirmAction, isOpen: false });
                                    }}
                                    className={`inline-flex justify-center rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm ${confirmAction.type === 'danger'
                                        ? 'bg-red-600 hover:bg-red-700'
                                        : 'bg-blue-600 hover:bg-blue-700'
                                        }`}
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* QR Modal */}
            {
                selectedQrTable && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
                                <h3 className="text-xl font-bold text-black">QR Code: Table {selectedQrTable.is_group ? selectedQrTable.display_name : selectedQrTable.table_number}</h3>
                                <button
                                    onClick={() => setSelectedQrTable(null)}
                                    className="text-black hover:text-black"
                                >
                                    <LucideX size={20} />
                                </button>
                            </div>
                            <div className="p-10 flex flex-col items-center justify-center bg-neutral-50">
                                <div className="bg-white p-4 rounded-xl shadow-lg border border-neutral-100 transform hover:scale-105 transition-transform duration-300">
                                    <QRCode
                                        value={`${window.location.origin}/${restaurantId}/customer/home/${encodeURIComponent(selectedQrTable.is_group ? selectedQrTable.display_name : (selectedQrTable.table_number || selectedQrTable.id))}`}
                                        size={200}
                                        className="h-auto w-full max-w-[200px]"
                                    />
                                </div>
                                <p className="mt-6 text-sm text-black text-center">
                                    Scan to access menu for <span className="font-bold text-black">Table {selectedQrTable.is_group ? selectedQrTable.display_name : selectedQrTable.table_number}</span>.
                                    <br />
                                    <span className="text-[10px] font-mono bg-neutral-100 text-black px-2 py-1 rounded mt-3 inline-block">
                                        Scan Link ID: {selectedQrTable.id}
                                    </span>
                                </p>
                            </div>
                            <div className="p-6 border-t border-neutral-100 flex gap-4">
                                <button className="flex-1 flex items-center justify-center py-3 bg-white border border-neutral-200 text-black font-bold rounded-xl hover:bg-neutral-50 transition-colors">
                                    <LucideEdit size={18} className="mr-2" />
                                    Edit
                                </button>
                                <button className="flex-1 flex items-center justify-center py-3 bg-neutral-900 text-white font-bold rounded-xl hover:bg-black transition-colors shadow-lg shadow-neutral-900/20">
                                    <LucideDownload size={18} className="mr-2" />
                                    Download
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Add Table Modal */}
            {
                isAddTableOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
                                <h3 className="text-xl font-bold text-black">Add New Table</h3>
                                <button
                                    onClick={() => setIsAddTableOpen(false)}
                                    className="text-black hover:text-black p-1 rounded-full hover:bg-neutral-100 transition-colors"
                                >
                                    <LucideX size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-black uppercase tracking-wider mb-2">
                                        Table Number / Name
                                    </label>
                                    <input
                                        type="text"
                                        value={newTableNumber}
                                        onChange={(e) => setNewTableNumber(e.target.value)}
                                        placeholder="e.g. 5, T-12, Patio-1"
                                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-black font-bold placeholder-black focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-black uppercase tracking-wider mb-2">
                                        Capacity (Guests)
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setNewTableCapacity(Math.max(1, newTableCapacity - 1))}
                                            className="size-10 rounded-xl border border-neutral-200 flex items-center justify-center text-black hover:bg-neutral-50 active:scale-95 transition-transform"
                                        >
                                            <span className="text-xl font-bold">-</span>
                                        </button>
                                        <span className="flex-1 text-center font-black text-xl text-black font-mono bg-neutral-50 py-2 rounded-xl border border-neutral-100">
                                            {newTableCapacity}
                                        </span>
                                        <button
                                            onClick={() => setNewTableCapacity(newTableCapacity + 1)}
                                            className="size-10 rounded-xl border border-neutral-200 flex items-center justify-center text-black hover:bg-neutral-50 active:scale-95 transition-transform"
                                        >
                                            <span className="text-xl font-bold">+</span>
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleAddTable}
                                    disabled={!newTableNumber || isAddingTable}
                                    className={`w-full py-3.5 mt-4 ${!newTableNumber || isAddingTable ? 'bg-neutral-200 text-black cursor-not-allowed' : 'bg-neutral-900 text-white shadow-lg shadow-neutral-900/20 hover:bg-black active:scale-95'} rounded-xl font-bold transition-all flex items-center justify-center gap-2`}
                                >
                                    {isAddingTable ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                                            <span>Creating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <LucidePlus size={18} />
                                            <span>Create Table</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
