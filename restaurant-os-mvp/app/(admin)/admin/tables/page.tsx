'use client';

import { LucideQrCode, LucideDownload, LucidePlus, LucideEdit, LucidePrinter, LucideTrash2, LucideCreditCard, LucideX, LucideCheckCircle, LucideAlertCircle, LucideChefHat, LucideUtensils } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';
import { OrderService, Order, TableMergeGroup } from '@/app/services/orders';
import QRCode from 'react-qr-code';
import { formatCurrency } from '@/app/lib/utils';
import { toast } from 'sonner';

export default function TableManagement() {
    const [tables, setTables] = useState<any[]>([]);
    const [mergeGroups, setMergeGroups] = useState<TableMergeGroup[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

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
        const loadData = async () => {
            try {
                const [allTables, activeOrders, allMergeGroups] = await Promise.all([
                    OrderService.fetchTables(),
                    OrderService.fetchActiveOrders(),
                    OrderService.fetchMergeGroups()
                ]);
                setTables(allTables || []);
                setOrders(activeOrders || []);
                setMergeGroups(allMergeGroups || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        loadData();

        const sub1 = OrderService.subscribeToTables(() => loadData());
        const sub2 = OrderService.subscribeToOrders(() => loadData());
        const sub3 = OrderService.subscribeToOrderItems(() => loadData());
        const sub4 = OrderService.subscribeToMergeGroups(() => loadData());

        return () => {
            sub1.unsubscribe();
            sub2.unsubscribe();
            sub3.unsubscribe();
            sub4.unsubscribe();
        }
    }, []);

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
        return entities;
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

        if (table.status === 'free') return 'EMPTY';
        if (!order) return 'EMPTY';

        if (order.status === 'served' || order.status === 'paid') return 'EATING';

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
        setIsMerging(true);
        try {
            await OrderService.mergeTables(selectedForMerge);
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
                await OrderService.settleBill(selectedTable.order.id, total, 'Admin');
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
                await OrderService.clearTable(selectedTable.id);
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
                await OrderService.unmergeTables(selectedTable.id);
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
        setIsAddingTable(true);
        try {
            await OrderService.addTable(newTableNumber, newTableCapacity);
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

    return (
        <div className="space-y-6 px-1">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-black text-neutral-900 tracking-tight">Tables</h2>
                    <p className="text-sm font-medium text-neutral-500 mt-1">Real-time floor status & management</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {filters.map(f => {
                        const isActive = filter === f.value;
                        return (
                            <button
                                key={f.value}
                                onClick={() => setFilter(filter === f.value ? 'ALL' : f.value)}
                                className={`relative px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 ${isActive ? 'text-white scale-105' : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300'}`}
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

                    <div className="h-8 w-px bg-neutral-200 mx-1 hidden sm:block"></div>

                    {isMergeMode ? (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => { setIsMergeMode(false); setSelectedForMerge([]); }}
                                className="px-4 py-2.5 bg-neutral-100 text-neutral-600 text-sm font-bold rounded-xl hover:bg-neutral-200 transition-all active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmMerge}
                                disabled={selectedForMerge.length < 2 || isMerging}
                                className={`flex items-center px-5 py-2.5 text-sm font-bold rounded-xl transition-all shadow-lg active:scale-95 ${selectedForMerge.length < 2 || isMerging ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed shadow-none' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20'}`}
                            >
                                {isMerging ? 'Merging...' : `Confirm Merge (${selectedForMerge.length})`}
                            </button>
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={() => setIsMergeMode(true)}
                                className="px-5 py-2.5 bg-white border border-neutral-200 text-neutral-700 text-sm font-bold rounded-xl hover:bg-neutral-50 hover:border-neutral-300 transition-all active:scale-95"
                            >
                                Merge Tables
                            </button>
                            <button
                                onClick={() => setIsAddTableOpen(true)}
                                className="flex items-center px-5 py-2.5 bg-neutral-900 text-white text-sm font-bold rounded-xl hover:bg-black transition-all shadow-lg shadow-neutral-900/20 active:scale-95 group"
                            >
                                <LucidePlus size={18} className="mr-2 group-hover:rotate-90 transition-transform duration-300" />
                                Add Table
                            </button>
                        </>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900 mb-4"></div>
                    <p className="text-neutral-500 font-medium animate-pulse">Loading floor status...</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {filteredEntities.map((table, idx) => {
                        const activeOrder = getDisplayOrder(table.id, table.is_group);
                        const phase = getTablePhase(table, activeOrder);

                        // Waiter App Style Match
                        // Default (Empty)
                        let cardStyle = 'bg-white border-neutral-200 hover:border-neutral-400 shadow-sm hover:shadow-xl';
                        let badgeStyle = 'bg-neutral-100 text-neutral-600 border border-neutral-200';
                        let textColor = 'text-neutral-900';
                        let subTextColor = 'text-neutral-500';
                        let indicatorColor = 'bg-neutral-300';
                        let iconColor = 'text-neutral-400';

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

                                {/* Top: Table Number */}
                                <div>
                                    <span className={`text-3xl font-black ${textColor} tracking-tighter`}>
                                        {table.table_number || table.id}
                                    </span>
                                </div>

                                {/* Bottom: Info & QR */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-end">
                                        <div className={`
                                            inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest
                                            ${badgeStyle}
                                        `}>
                                            {phase}
                                        </div>

                                        {/* QR Button */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setSelectedQrTable(table); }}
                                            className={`${iconColor} hover:text-white hover:bg-white/20 rounded-full p-1 transition-colors opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 duration-200`}
                                        >
                                            <LucideQrCode size={18} />
                                        </button>
                                    </div>

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
                                                    {formatCurrency(activeOrder.total_amount * 1.05)}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="pt-3 border-t border-transparent">
                                            <span className={`text-xs ${subTextColor} font-medium`}>Available</span>
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
                                        <h3 className="text-2xl font-black text-neutral-900">
                                            {selectedTable.is_group ? selectedTable.display_name : `Table ${selectedTable.table_number}`}
                                        </h3>
                                        {selectedTable.is_group && (
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase rounded-full tracking-wider">Merged</span>
                                        )}
                                    </div>
                                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mt-1">Order #{selectedTable.order?.id.slice(0, 8)}</p>
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
                                            <span className="flex items-center justify-center size-7 bg-neutral-100 rounded-lg text-sm font-bold text-neutral-700">
                                                {item.quantity}
                                            </span>
                                            <div>
                                                <p className="text-sm font-bold text-neutral-800 leading-tight">{item.name}</p>
                                                <p className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${item.status === 'ready' ? 'text-green-600' :
                                                    item.status === 'served' ? 'text-neutral-400' :
                                                        item.status === 'paid' ? 'text-green-600' : 'text-orange-500'
                                                    }`}>
                                                    {item.status === 'preparing' ? 'COOKING' : item.status}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-sm font-medium text-neutral-900">
                                            {formatCurrency(item.price * item.quantity)}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Actions Footer */}
                            <div className="p-5 border-t border-neutral-100 bg-neutral-50 space-y-5">
                                <div className="flex justify-between items-center px-1">
                                    <div className="flex flex-col">
                                        <span className="text-neutral-500 font-medium text-sm">Total Amount</span>
                                        {(selectedTable.order?.amount_paid || 0) > 0 && (
                                            <div className="flex flex-col">
                                                <span className="text-green-600 font-bold text-xs">Paid: {formatCurrency(selectedTable.order?.amount_paid)}</span>
                                                {selectedTable.order?.paid_by && (
                                                    <span className="text-[10px] text-neutral-400 font-medium">via {selectedTable.order?.paid_by}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <span className="text-3xl font-black text-neutral-900 tracking-tight">
                                            {formatCurrency((selectedTable.order?.total_amount || 0))}
                                        </span>
                                        {/* Show Taxes if needed, currently raw total_amount is used */}
                                        {(selectedTable.order?.amount_paid || 0) > 0 && (
                                            <p className="text-orange-600 font-bold text-sm">
                                                Due: {formatCurrency((selectedTable.order?.total_amount || 0) - (selectedTable.order?.amount_paid || 0))}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={handlePrintBill}
                                        className="flex items-center justify-center gap-2 py-3.5 bg-white border border-neutral-200 text-neutral-700 font-bold rounded-xl hover:bg-neutral-50 hover:border-neutral-300 transition-all active:scale-95"
                                    >
                                        <LucidePrinter size={18} />
                                        Print Bill
                                    </button>

                                    {selectedTable.order?.status === 'paid' && selectedTable.order?.total_amount === selectedTable.order?.amount_paid ? (
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
                                    className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-neutral-400 hover:text-neutral-600"
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
                                <h3 className="text-lg font-bold text-neutral-900">{confirmAction.title}</h3>
                                <p className="mt-2 text-sm text-neutral-500">
                                    {confirmAction.message}
                                </p>
                            </div>
                            <div className="mt-6 grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setConfirmAction({ ...confirmAction, isOpen: false })}
                                    className="inline-flex justify-center rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-700 shadow-sm hover:bg-neutral-50"
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
                                <h3 className="text-xl font-bold text-neutral-900">QR Code: Table {selectedQrTable.table_number}</h3>
                                <button
                                    onClick={() => setSelectedQrTable(null)}
                                    className="text-neutral-400 hover:text-neutral-900"
                                >
                                    <LucideX size={20} />
                                </button>
                            </div>
                            <div className="p-10 flex flex-col items-center justify-center bg-neutral-50">
                                <div className="bg-white p-4 rounded-xl shadow-lg border border-neutral-100 transform hover:scale-105 transition-transform duration-300">
                                    <QRCode
                                        value={`https://restaurant-os.app/menu/${selectedQrTable.id}`}
                                        size={200}
                                        className="h-auto w-full max-w-[200px]"
                                    />
                                </div>
                                <p className="mt-6 text-sm text-neutral-500 text-center">
                                    Scan to access menu for Table {selectedQrTable.table_number}.
                                    <br />
                                    <span className="text-xs font-mono bg-neutral-200 text-neutral-600 px-2 py-1 rounded mt-2 inline-block">
                                        restaurant-os.app/menu/{selectedQrTable.id}
                                    </span>
                                </p>
                            </div>
                            <div className="p-6 border-t border-neutral-100 flex gap-4">
                                <button className="flex-1 flex items-center justify-center py-3 bg-white border border-neutral-200 text-neutral-700 font-bold rounded-xl hover:bg-neutral-50 transition-colors">
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
                                <h3 className="text-xl font-bold text-neutral-900">Add New Table</h3>
                                <button
                                    onClick={() => setIsAddTableOpen(false)}
                                    className="text-neutral-400 hover:text-neutral-900 p-1 rounded-full hover:bg-neutral-100 transition-colors"
                                >
                                    <LucideX size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
                                        Table Number / Name
                                    </label>
                                    <input
                                        type="text"
                                        value={newTableNumber}
                                        onChange={(e) => setNewTableNumber(e.target.value)}
                                        placeholder="e.g. 5, T-12, Patio-1"
                                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-bold placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
                                        Capacity (Guests)
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setNewTableCapacity(Math.max(1, newTableCapacity - 1))}
                                            className="size-10 rounded-xl border border-neutral-200 flex items-center justify-center text-neutral-600 hover:bg-neutral-50 active:scale-95 transition-transform"
                                        >
                                            <span className="text-xl font-bold">-</span>
                                        </button>
                                        <span className="flex-1 text-center font-black text-xl text-neutral-900 font-mono bg-neutral-50 py-2 rounded-xl border border-neutral-100">
                                            {newTableCapacity}
                                        </span>
                                        <button
                                            onClick={() => setNewTableCapacity(newTableCapacity + 1)}
                                            className="size-10 rounded-xl border border-neutral-200 flex items-center justify-center text-neutral-600 hover:bg-neutral-50 active:scale-95 transition-transform"
                                        >
                                            <span className="text-xl font-bold">+</span>
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleAddTable}
                                    disabled={!newTableNumber || isAddingTable}
                                    className={`w-full py-3.5 mt-4 ${!newTableNumber || isAddingTable ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed' : 'bg-neutral-900 text-white shadow-lg shadow-neutral-900/20 hover:bg-black active:scale-95'} rounded-xl font-bold transition-all flex items-center justify-center gap-2`}
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
