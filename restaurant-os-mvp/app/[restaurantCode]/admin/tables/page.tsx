'use client';

import { QrCode as LucideQrCode, Download as LucideDownload, Plus as LucidePlus, Edit as LucideEdit, Edit2 as LucideEdit2, Printer as LucidePrinter, Trash2 as LucideTrash2, CreditCard as LucideCreditCard, X as LucideX, CheckCircle as LucideCheckCircle, AlertCircle as LucideAlertCircle, ChefHat as LucideChefHat, Utensils as LucideUtensils, Users as LucideUsers, Table as LucideTable, Link2 as LucideLink2, Unlink as LucideUnlink, ChevronDown as LucideChevronDown, Sparkles as LucideSparkles, Layers as LucideLayers, Box as LucideBox } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { OrderService, Order, TableMergeGroup, RestaurantArea } from '@/services/orders.service';
import QRCode from 'react-qr-code';
import { formatCurrency, getCategoryMenuItemImage } from '@/lib/utils';
import { isComboItem, parseComboSubItems } from '@/lib/combo-utils';
import { toast } from 'sonner';

import { useRestaurantId } from '@/hooks/useRestaurantId';
import { getCached, setCache, hasFreshCache, adminCacheManager } from '@/lib/data-cache';
import { LoadingState } from '@/components/ui/LoadingState';
import { useParams } from 'next/navigation';
import { SyncIndicator } from '@/components/admin/SyncIndicator';

export default function TableManagement() {
    const params = useParams();
    const urlRestaurantCode = (params?.restaurantCode as string) || '';
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const activeResId = restaurantId || urlRestaurantCode;
    const cacheKey = `tables-${activeResId}`;
    const cached = getCached<any>(cacheKey) || (urlRestaurantCode ? getCached<any>(`tables-${urlRestaurantCode}`) : null);
    const [tables, setTables] = useState<any[]>(cached?.tables || []);
    const [mergeGroups, setMergeGroups] = useState<TableMergeGroup[]>(cached?.mergeGroups || []);
    const [orders, setOrders] = useState<Order[]>(cached?.orders || []);
    const [areas, setAreas] = useState<RestaurantArea[]>(cached?.areas || []);
    const [loading, setLoading] = useState(!cached && tables.length === 0);
    const [isRevalidating, setIsRevalidating] = useState(false);

    // Merge Mode State
    const [isMergeMode, setIsMergeMode] = useState(false);
    const [selectedForMerge, setSelectedForMerge] = useState<number[]>([]);
    const [isMerging, setIsMerging] = useState(false);

    // Modals State
    const [selectedQrTable, setSelectedQrTable] = useState<any | null>(null);
    const [selectedTable, setSelectedTable] = useState<any | null>(null);
    const [expandedCombos, setExpandedCombos] = useState<Record<string, boolean>>({});

    const toggleCombo = (key: string) => {
        setExpandedCombos(prev => ({ ...prev, [key]: !prev[key] }));
    };
    const [confirmAction, setConfirmAction] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        action: () => Promise<void>;
        type: 'danger' | 'info' | 'success';
    }>({ isOpen: false, title: '', message: '', action: async () => { }, type: 'info' });

    // Tab View State: 'tables' for Tables, 'areas' for Table Areas
    const [activeTab, setActiveTab] = useState<'tables' | 'areas'>('tables');

    // Check query params on mount for ?tab=areas
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const searchParams = new URLSearchParams(window.location.search);
            if (searchParams.get('tab') === 'areas') {
                setActiveTab('areas');
            }
        }
    }, []);

    // Area Management State
    const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);
    const [editAreaId, setEditAreaId] = useState<string | null>(null);
    const [areaName, setAreaName] = useState('');
    const [areaDisplayOrder, setAreaDisplayOrder] = useState(0);
    const [isSavingArea, setIsSavingArea] = useState(false);
    const [areaDeleteError, setAreaDeleteError] = useState<string | null>(null);

    const [filter, setFilter] = useState('ALL');
    const [selectedAreaId, setSelectedAreaId] = useState<string>('ALL');

    // Add/Edit Table State
    const [isAddingTable, setIsAddingTable] = useState(false);
    const [isEditTableOpen, setIsEditTableOpen] = useState(false);
    const [editTableId, setEditTableId] = useState<number | null>(null);
    const [editTableNumber, setEditTableNumber] = useState('');
    const [editTableCapacity, setEditTableCapacity] = useState(4);
    const [editTableAreaId, setEditTableAreaId] = useState<string>('');
    const [isEditingTable, setIsEditingTable] = useState(false);
    const [waiters, setWaiters] = useState<any[]>([]);

    const loadData = useCallback(async (force = false) => {
        const targetResId = restaurantId || urlRestaurantCode;
        if (!targetResId) return;
        const tablesKey = `tables-${targetResId}`;

        // If fresh cache exists and this is a standard navigation (not forced by Realtime), use cache immediately
        if (!force && hasFreshCache(tablesKey)) {
            const cachedData = getCached<any>(tablesKey);
            if (cachedData) {
                if (cachedData.tables) setTables(cachedData.tables);
                if (cachedData.orders) setOrders(cachedData.orders);
                if (cachedData.mergeGroups) setMergeGroups(cachedData.mergeGroups);
                if (cachedData.areas) setAreas(cachedData.areas);
                setLoading(false);
                return;
            }
        }

        setIsRevalidating(true);
        try {
            const [allTables, activeOrders, allMergeGroups, allAreas, allStaff] = await Promise.all([
                OrderService.fetchTables(targetResId),
                OrderService.fetchActiveOrders(targetResId),
                OrderService.fetchMergeGroups(targetResId),
                OrderService.fetchAreas(targetResId),
                OrderService.fetchStaff(targetResId).catch(() => [])
            ]);
            setTables(allTables || []);
            setOrders(activeOrders || []);
            setMergeGroups(allMergeGroups || []);
            setAreas(allAreas || []);
            setWaiters((allStaff || []).filter((s: any) => s.role === 'waiter'));

            const payload = {
                tables: allTables || [],
                orders: activeOrders || [],
                mergeGroups: allMergeGroups || [],
                areas: allAreas || []
            };
            setCache(tablesKey, payload, { isRealtime: true });
            if (restaurantId && urlRestaurantCode && restaurantId !== urlRestaurantCode) {
                setCache(`tables-${restaurantId}`, payload, { isRealtime: true });
                setCache(`tables-${urlRestaurantCode}`, payload, { isRealtime: true });
            }
        } catch (err) {
            console.error('Error loading tables data:', err);
        } finally {
            setLoading(false);
            setIsRevalidating(false);
        }
    }, [restaurantId, urlRestaurantCode]);

    useEffect(() => {
        if (!restaurantLoading && restaurantId) {
            loadData(false);

            let reloadTimer: NodeJS.Timeout | null = null;
            const debouncedLoadData = () => {
                if (reloadTimer) clearTimeout(reloadTimer);
                reloadTimer = setTimeout(() => {
                    loadData(true);
                }, 400);
            };

            const sub1 = OrderService.subscribeToTables(restaurantId, debouncedLoadData);
            const sub2 = OrderService.subscribeToOrders(restaurantId, debouncedLoadData);
            const sub3 = OrderService.subscribeToOrderItems(restaurantId, debouncedLoadData);
            const sub4 = OrderService.subscribeToMergeGroups(restaurantId, debouncedLoadData);
            const sub5 = OrderService.subscribeToAreas(restaurantId, debouncedLoadData);

            return () => {
                if (reloadTimer) clearTimeout(reloadTimer);
                sub1.unsubscribe();
                sub2.unsubscribe();
                sub3.unsubscribe();
                sub4.unsubscribe();
                sub5.unsubscribe();
            };
        }
    }, [restaurantId, restaurantLoading, loadData]);

    const displayEntities = useMemo(() => {
        const entities: any[] = [];
        const mergedGroupIdsRendered = new Set<string>();

        tables.forEach(table => {
            if (table.is_merged && table.merged_group_id) {
                if (!mergedGroupIdsRendered.has(table.merged_group_id)) {
                    mergedGroupIdsRendered.add(table.merged_group_id);
                    const group = mergeGroups.find(g => g.id === table.merged_group_id);
                    const constituentTables = tables.filter(t => t.merged_group_id === table.merged_group_id);
                    if (group) {
                        entities.push({
                            ...group,
                            is_group: true,
                            table_number: group.display_name,
                            capacity: group.total_capacity || constituentTables.reduce((acc, t) => acc + (t.capacity || 0), 0),
                            area_id: table.area_id,
                            constituent_tables: constituentTables
                        });
                    } else {
                        // Merge group record missing: synthesized group fallback so table remains visible & unmergeable
                        const synthName = constituentTables.map(t => t.table_number).join('+') || `Merged ${table.table_number}`;
                        entities.push({
                            id: table.merged_group_id,
                            merged_group_id: table.merged_group_id,
                            display_name: synthName,
                            table_number: synthName,
                            is_group: true,
                            capacity: constituentTables.reduce((acc, t) => acc + (t.capacity || 0), 0) || 4,
                            area_id: table.area_id,
                            constituent_tables: constituentTables
                        });
                    }
                }
            } else {
                entities.push({ ...table, is_group: false });
            }
        });

        // Safety: also catch any mergeGroups that exist without matching tables in state
        mergeGroups.forEach(group => {
            if (!mergedGroupIdsRendered.has(group.id)) {
                mergedGroupIdsRendered.add(group.id);
                const constituentTables = tables.filter(t => t.merged_group_id === group.id);
                entities.push({
                    ...group,
                    is_group: true,
                    table_number: group.display_name,
                    capacity: group.total_capacity || 4,
                    constituent_tables: constituentTables
                });
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
        const tableStatusLower = (table.status || '').toLowerCase();

        // 1. Table in cleaning / dirty state
        if (['cleaning', 'dirty', 'to_clean'].includes(tableStatusLower)) {
            return 'CLEANING';
        }

        // Critical Order Check: only active non-completed cooking/ready/new orders
        if (order && !order.is_completed && ['placed', 'preparing', 'ready'].includes(order.status)) {
            if (order.status === 'ready') return 'READY';
            if (order.status === 'preparing') return 'COOKING';
            if (order.status === 'placed') return 'NEW';
        }

        // Active non-completed served order is still eating
        if (order && !order.is_completed && order.status === 'served') return 'EATING';

        // Map occupied table statuses to EATING phase if table is not available/free/empty
        if (['billing', 'customer_present', 'ordering', 'eating', 'reserved', 'occupied', 'need_bill'].includes(tableStatusLower)) {
            return 'EATING';
        }

        if (table.status === 'free' || table.status === 'empty' || table.status === 'available') return 'EMPTY';
        return 'EMPTY';
    };

    const filters = [
        { label: 'ALL', value: 'ALL', color: 'bg-neutral-900 text-white shadow-neutral-400' },
        { label: 'NEW', value: 'NEW', color: 'bg-blue-600 text-white shadow-blue-200' },
        { label: 'COOKING', value: 'COOKING', color: 'bg-orange-600 text-white shadow-orange-200' },
        { label: 'READY', value: 'READY', color: 'bg-green-600 text-white shadow-green-200' },
        { label: 'EATING', value: 'EATING', color: 'bg-red-600 text-white shadow-red-200' },
        { label: 'CLEANING', value: 'CLEANING', color: 'bg-slate-700 text-white shadow-slate-300' },
        { label: 'EMPTY', value: 'EMPTY', color: 'bg-neutral-500 text-white shadow-neutral-300' },
    ];



    const filteredEntities = displayEntities.filter(entity => {
        if (selectedAreaId !== 'ALL' && !entity.is_group) {
            if (entity.area_id !== selectedAreaId) return false;
        }

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
            await loadData();
        } catch (error: any) {
            toast.error(error.message || 'Failed to merge tables.');
        } finally {
            setIsMerging(false);
        }
    };

    const handleTableClick = (entity: any) => {
        const order = getDisplayOrder(entity.id, entity.is_group);
        const phase = getTablePhase(entity, order);

        if (isMergeMode) {
            if (entity.is_group || entity.is_merged) {
                toast.warning('Cannot merge an already merged table.');
                return;
            }
            if (phase !== 'EMPTY' || order || (!['empty', 'free', 'available'].includes(entity.status) && entity.status)) {
                toast.warning('Only unoccupied tables can be merged.');
                return;
            }
            setSelectedForMerge(prev =>
                prev.includes(entity.id) ? prev.filter(id => id !== entity.id) : [...prev, entity.id]
            );
            return;
        }

        // Always allow opening modal if it is a merged table group (so admin can view details and unmerge),
        // or if it has an active order or is in an occupied phase
        if (entity.is_group || order || phase !== 'EMPTY') {
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
                const orderId = selectedTable.order.id;
                const targetTableId = selectedTable.id;
                const isGroup = selectedTable.is_group;

                // Optimistically update order state and table state to cleaning
                setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'paid' as any, is_completed: true } : o));
                setTables(prev => prev.map(t => {
                    if (isGroup && t.merged_group_id === targetTableId) {
                        return { ...t, status: 'cleaning' };
                    }
                    if (t.id === targetTableId) {
                        return { ...t, status: 'cleaning' };
                    }
                    return t;
                }));
                setSelectedTable(null);
                try {
                    await OrderService.settleBill(orderId, restaurantId, total, 'Admin');
                    toast.success('Bill settled successfully.');
                    loadData();
                } catch (err: any) {
                    console.error('Failed to settle bill:', err);
                    toast.error(err?.message || 'Failed to settle bill.');
                    loadData();
                }
            }
        });
    };

    const requestClearTable = () => {
        if (!selectedTable?.id) return;
        const targetId = selectedTable.id;
        const isGroup = selectedTable.is_group;

        setConfirmAction({
            isOpen: true,
            title: 'Clear Table?',
            message: 'This will free the table for new guests. Ensure table is clean.',
            type: 'danger',
            action: async () => {
                if (!restaurantId) return;
                // Optimistically mark table available immediately and clear assigned waiter
                setTables(prev => prev.map(t => {
                    if (isGroup && t.merged_group_id === targetId) {
                        return { ...t, status: 'available', assigned_waiter_id: null, assigned_waiter_name: null, is_merged: false, merged_group_id: null };
                    }
                    if (t.id === targetId) {
                        return { ...t, status: 'available', assigned_waiter_id: null, assigned_waiter_name: null };
                    }
                    return t;
                }));
                // Optimistically remove active order association
                setOrders(prev => prev.filter(o => isGroup ? o.merge_group_id !== targetId : o.table_id !== targetId));
                setSelectedTable(null);
                try {
                    await OrderService.clearTable(targetId, restaurantId);
                    toast.success('Table cleared successfully.');
                    loadData();
                } catch (err: any) {
                    console.error('Failed to clear table:', err);
                    toast.error(err?.message || 'Failed to clear table.');
                    loadData();
                }
            }
        });
    };

    const requestUnmerge = (groupOrTable?: any) => {
        const target = groupOrTable || selectedTable;
        if (!target) return;
        const groupId = target.is_group ? (target.id || target.merged_group_id) : (target.merged_group_id || target.id);
        if (!groupId) {
            toast.error('Could not identify table merge group.');
            return;
        }
        const displayName = target.display_name || target.table_number || 'Merged Tables';

        setConfirmAction({
            isOpen: true,
            title: 'Unmerge Tables?',
            message: `Are you sure you want to unmerge ${displayName}? All constituent tables will become individually available.`,
            type: 'info',
            action: async () => {
                if (!restaurantId) return;
                try {
                    await OrderService.unmergeTables(groupId, restaurantId);
                    setSelectedTable(null);
                    await loadData();
                    toast.success(`${displayName} unmerged successfully.`);
                } catch (err: any) {
                    console.error('Failed to unmerge:', err);
                    toast.error(err?.message || 'Failed to unmerge tables.');
                }
            }
        });
    };

    const handlePrintBill = () => {
        window.print();
    };

    const handleQuickAddTable = async () => {
        if (!restaurantId || isAddingTable) return;
        
        if (selectedAreaId === 'ALL') {
            let maxTableNum = 0;
            tables.forEach(t => {
                const num = parseInt(t.table_number);
                if (!isNaN(num) && num > maxTableNum) maxTableNum = num;
            });
            setEditTableId(null);
            setEditTableNumber((maxTableNum + 1).toString());
            setEditTableCapacity(4);
            setEditTableAreaId('');
            setIsEditTableOpen(true);
            return;
        }

        setIsAddingTable(true);
        try {
            const targetAreaId = selectedAreaId !== 'ALL' ? selectedAreaId : undefined;
            const areaTables = tables.filter(t => !targetAreaId || t.area_id === targetAreaId);
            
            let maxTableNum = 0;
            areaTables.forEach(t => {
                const num = parseInt(t.table_number);
                if (!isNaN(num) && num > maxTableNum) maxTableNum = num;
            });
            const nextTableNum = (maxTableNum + 1).toString();
            
            await OrderService.addTable(nextTableNum, 4, restaurantId, targetAreaId);
            toast.success(`Table ${nextTableNum} added!`);
            
            // Reload
            const [allTables, activeOrders, allMergeGroups, allAreas] = await Promise.all([
                OrderService.fetchTables(restaurantId),
                OrderService.fetchActiveOrders(restaurantId),
                OrderService.fetchMergeGroups(restaurantId),
                OrderService.fetchAreas(restaurantId)
            ]);
            setTables(allTables || []);
            setOrders(activeOrders || []);
            setMergeGroups(allMergeGroups || []);
            setAreas(allAreas || []);
            setCache(`tables-${restaurantId}`, {
                tables: allTables || [],
                orders: activeOrders || [],
                mergeGroups: allMergeGroups || [],
                areas: allAreas || []
            });
        } catch (error: any) {
            if (error.message && error.message.includes('already exists')) {
                toast.warning(`Table already exists in this area.`);
            } else {
                console.error('Failed to add table:', error);
                toast.error('Failed to add table. Please try again.');
            }
        } finally {
            setIsAddingTable(false);
        }
    };

    const handleUpdateTable = async () => {
        if (!editTableNumber || !restaurantId) return;
        if (areas.length > 0 && !editTableAreaId && editTableId === null) {
            toast.warning('Please select an area for the new table.');
            return;
        }
        setIsEditingTable(true);
        try {
            if (editTableId) {
                await OrderService.updateTable(editTableId, editTableNumber, editTableCapacity, restaurantId, editTableAreaId || undefined);
                toast.success(`Table updated to ${editTableNumber}!`);
            } else {
                await OrderService.addTable(editTableNumber, editTableCapacity, restaurantId, editTableAreaId || undefined);
                toast.success(`Table ${editTableNumber} added!`);
            }
            setIsEditTableOpen(false);
            setEditTableId(null);
            setEditTableNumber('');
            setEditTableCapacity(4);
            
            const [allTables, activeOrders, allMergeGroups, allAreas] = await Promise.all([
                OrderService.fetchTables(restaurantId),
                OrderService.fetchActiveOrders(restaurantId),
                OrderService.fetchMergeGroups(restaurantId),
                OrderService.fetchAreas(restaurantId)
            ]);
            setTables(allTables || []);
            setOrders(activeOrders || []);
            setMergeGroups(allMergeGroups || []);
            setAreas(allAreas || []);
            setCache(`tables-${restaurantId}`, {
                tables: allTables || [],
                orders: activeOrders || [],
                mergeGroups: allMergeGroups || [],
                areas: allAreas || []
            });
        } catch (error: any) {
            if (error.message && error.message.includes('already exists')) {
                toast.warning(`Table ${editTableNumber} already exists in this area.`);
            } else {
                console.error('Failed to update table:', error);
                toast.error('Failed to update table.');
            }
        } finally {
            setIsEditingTable(false);
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
                    // Optimistically remove table from UI immediately
                    setTables(prev => prev.filter(t => t.id !== tableId));
                    await OrderService.deleteTable(tableId, restaurantId);
                    toast.success(`Table ${tableNumber} deleted.`);
                    await loadData();
                } catch (error: any) {
                    toast.error(error.message || 'Failed to delete table.');
                    await loadData();
                }
            }
        });
    };

    const handleOpenAreaModal = (area?: RestaurantArea) => {
        if (area) {
            setEditAreaId(area.id);
            setAreaName(area.name);
            setAreaDisplayOrder(area.display_order ?? 0);
        } else {
            setEditAreaId(null);
            setAreaName('');
            setAreaDisplayOrder(areas.length * 10);
        }
        setIsAreaModalOpen(true);
    };

    const handleSaveArea = async () => {
        const targetResId = restaurantId || urlRestaurantCode;
        if (!targetResId || !areaName.trim()) return;
        setIsSavingArea(true);
        try {
            if (editAreaId) {
                await OrderService.updateArea(editAreaId, targetResId, {
                    name: areaName.trim(),
                    display_order: areaDisplayOrder
                });
                toast.success('Area updated successfully!');
            } else {
                await OrderService.createArea(targetResId, areaName.trim(), areaDisplayOrder);
                toast.success('Area created successfully!');
            }
            adminCacheManager.invalidate(`tables-${activeResId}`);
            adminCacheManager.invalidate(`areas-${activeResId}`);
            await loadData(true);
            setIsAreaModalOpen(false);
        } catch (error: any) {
            console.error('Failed to save area:', error);
            toast.error(error.message || 'Failed to save area.');
        } finally {
            setIsSavingArea(false);
        }
    };

    const handleDeleteArea = async (id: string, name: string) => {
        const targetResId = restaurantId || urlRestaurantCode;
        if (!targetResId) return;

        const assignedTables = tables.filter(t => t.area_id === id);
        if (assignedTables.length > 0) {
            setAreaDeleteError(`Cannot delete "${name}" because it contains ${assignedTables.length} table${assignedTables.length > 1 ? 's' : ''} (${assignedTables.map(t => t.table_number).join(', ')}). Please reassign or delete the tables in this area first.`);
            return;
        }

        if (!confirm(`Are you sure you want to delete the area "${name}"?`)) return;

        try {
            await OrderService.deleteArea(id, targetResId);
            toast.success(`Area "${name}" deleted successfully!`);
            adminCacheManager.invalidate(`tables-${activeResId}`);
            adminCacheManager.invalidate(`areas-${activeResId}`);
            await loadData(true);
        } catch (error: any) {
            console.error('Failed to delete area:', error);
            const msg = error.message?.toLowerCase() || '';
            if (msg.includes('foreign key') || msg.includes('tables')) {
                setAreaDeleteError(`Cannot delete "${name}" because tables are assigned to it.`);
            } else {
                toast.error(error.message || 'Failed to delete area.');
            }
        }
    };

    const handleAddTableToArea = (areaId: string) => {
        let maxTableNum = 0;
        const areaTables = tables.filter(t => t.area_id === areaId);
        areaTables.forEach(t => {
            const num = parseInt(t.table_number);
            if (!isNaN(num) && num > maxTableNum) maxTableNum = num;
        });
        if (maxTableNum === 0) {
            tables.forEach(t => {
                const num = parseInt(t.table_number);
                if (!isNaN(num) && num > maxTableNum) maxTableNum = num;
            });
        }
        setEditTableId(null);
        setEditTableNumber((maxTableNum + 1).toString());
        setEditTableCapacity(4);
        setEditTableAreaId(areaId);
        setIsEditTableOpen(true);
    };

    return (
        <div className="p-8 space-y-7">
            {/* Top Navigation & View Switcher Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-neutral-100">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-black text-black tracking-tight">Tables & Areas</h2>
                        <SyncIndicator isRevalidating={isRevalidating} />
                    </div>
                    <p className="text-sm font-medium text-neutral-500 mt-0.5">
                        Manage dining floor plan, live table statuses, QR codes, and seating areas
                    </p>
                </div>

                {/* View Switcher Tabs */}
                <div className="flex items-center bg-neutral-100 p-1 rounded-2xl border border-neutral-200/60 shadow-xs">
                    <button
                        type="button"
                        onClick={() => setActiveTab('tables')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            activeTab === 'tables'
                                ? 'bg-white text-black shadow-sm'
                                : 'text-neutral-500 hover:text-black'
                        }`}
                    >
                        <LucideTable size={15} />
                        <span>Tables</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                            activeTab === 'tables' ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-600'
                        }`}>
                            {tables.length}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('areas')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            activeTab === 'areas'
                                ? 'bg-white text-black shadow-sm'
                                : 'text-neutral-500 hover:text-black'
                        }`}
                    >
                        <LucideLayers size={15} />
                        <span>Table Areas</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                            activeTab === 'areas' ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-600'
                        }`}>
                            {areas.length}
                        </span>
                    </button>
                </div>
            </div>

            {activeTab === 'tables' ? (
                <>
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Area:</span>
                            <select
                                value={selectedAreaId}
                                onChange={(e) => setSelectedAreaId(e.target.value)}
                                className="bg-white border border-neutral-200 text-black text-xs font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-900 shadow-sm"
                            >
                                <option value="ALL">All Areas</option>
                                {areas.map(area => (
                                    <option key={area.id} value={area.id}>{area.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-start justify-end gap-x-6 gap-y-4 flex-1 flex-wrap">
                    <div className="flex flex-wrap items-center gap-3">
                        {filters.map(f => {
                            const isActive = filter === f.value;
                            return (
                                <button
                                    key={f.value}
                                    onClick={() => setFilter(filter === f.value ? 'ALL' : f.value)}
                                    className={`relative px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 transform hover:scale-105 ${isActive ? `text-white scale-105 ${f.color} shadow-lg` : 'bg-white text-black border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300'}`}
                                >
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
                                {(filter === 'ALL' || filter === 'EMPTY') && (
                                    <motion.button
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        onClick={handleQuickAddTable}
                                        disabled={isAddingTable}
                                        className="w-full flex items-center justify-center px-4 py-2 bg-neutral-900 text-white text-xs font-bold rounded-xl hover:bg-black transition-all shadow-md active:scale-95 group disabled:opacity-50"
                                    >
                                        <LucidePlus size={16} className="mr-1.5 group-hover:rotate-90 transition-transform duration-300" />
                                        {isAddingTable ? 'Adding...' : 'Add Table'}
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
                                onClick={handleQuickAddTable}
                                disabled={isAddingTable}
                                className="flex items-center px-4 py-2 bg-neutral-900 text-white text-xs font-bold rounded-xl hover:bg-black transition-all shadow-xl shadow-neutral-900/20 active:scale-95 hover:-translate-y-1 disabled:opacity-50"
                            >
                                <LucidePlus size={16} className="mr-1.5" />
                                {isAddingTable ? 'Adding...' : 'Add First Table'}
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
                        if (phase === 'CLEANING') {
                            cardStyle = 'bg-slate-700 border-slate-800 shadow-slate-200 hover:shadow-slate-300';
                            badgeStyle = 'bg-white/20 text-white border border-white/20 backdrop-blur-sm';
                            textColor = 'text-white';
                            subTextColor = 'text-slate-200';
                            indicatorColor = 'bg-slate-300';
                            iconColor = 'text-white';
                        } else if (phase === 'EATING') {
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
                                        <div className="flex items-center gap-2">
                                            <span className={`text-3xl font-black ${textColor} tracking-tighter leading-none`}>
                                                {table.table_number || table.id}
                                            </span>
                                            {table.is_group && (
                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                                    phase === 'EMPTY' ? 'bg-blue-100 text-blue-700' : 'bg-white/20 text-white backdrop-blur-sm'
                                                }`}>
                                                    <LucideLink2 size={10} /> Merged
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {table.capacity && (
                                        <div className={`mt-2 mb-1.5 text-[11px] font-bold flex items-center gap-1 ${phase === 'EMPTY' ? 'text-black' : 'text-white/90'}`}>
                                            <LucideUsers size={12} />
                                            {table.capacity} Seater
                                            {table.is_group && table.constituent_tables?.length > 0 && (
                                                <span className="text-[10px] opacity-80 ml-1">
                                                    ({table.constituent_tables.map((ct: any) => ct.table_number).join('+')})
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center mt-1">
                                        <div className={`
                                            inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest
                                            ${badgeStyle}
                                        `}>
                                            {phase === 'CLEANING' ? 'NEEDS CLEANING' : phase}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {table.is_group && !isMergeMode && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        requestUnmerge(table);
                                                    }}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-900/90 hover:bg-black text-white text-[10px] font-extrabold transition-all shadow-xs active:scale-95 z-10"
                                                    title="Unmerge tables"
                                                >
                                                    <LucideUnlink size={11} />
                                                    <span>Unmerge</span>
                                                </button>
                                            )}
                                            {/* QR Button inline with status */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setSelectedQrTable(table); }}
                                                className={`${iconColor} hover:text-white hover:bg-white/20 rounded-full p-1 transition-colors opacity-0 group-hover:opacity-100 duration-200`}
                                                title="QR Code"
                                            >
                                                <LucideQrCode size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom: Info */}
                                <div className="space-y-3">
                                    {/* The top half elements were moved out of here */}

                                    {isOccupied && (activeOrder || table.assigned_waiter_name) ? (
                                        <div className="pt-2 border-t border-white/20 flex flex-col gap-1">
                                            <div className="flex items-center justify-between">
                                                <span className={`text-[10px] font-bold ${subTextColor} uppercase tracking-wide`}>Host</span>
                                                <div className="flex items-center gap-1.5 max-w-[120px] justify-end">
                                                    {(activeOrder?.waiter_avatar || table.assigned_waiter_avatar) ? (
                                                        <img
                                                            src={activeOrder?.waiter_avatar || table.assigned_waiter_avatar}
                                                            alt=""
                                                            className="size-4.5 rounded-full object-cover border border-white/60 shadow-2xs shrink-0"
                                                        />
                                                    ) : (
                                                        <div className="size-4.5 rounded-full bg-white/25 flex items-center justify-center text-[9px] font-black text-white shrink-0">
                                                            {(activeOrder?.waiter_name || table.assigned_waiter_name || 'W').charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <span className={`text-[11px] font-bold ${textColor} tracking-tight truncate text-right`}>
                                                        {activeOrder?.waiter_name || table.assigned_waiter_name || 'Unassigned'}
                                                    </span>
                                                </div>
                                            </div>
                                            {activeOrder && (
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-[10px] font-bold ${subTextColor} uppercase tracking-wide`}>Bill</span>
                                                    <span className={`text-sm font-black ${textColor} tracking-tight`}>
                                                        {formatCurrency((activeOrder.total_amount || 0) - (activeOrder.discount_amount || 0))}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="pt-3 border-t border-transparent flex items-end justify-between">
                                            <span className={`text-xs ${subTextColor} font-medium`}>
                                                {table.is_group ? 'Merged Group' : 'Available'}
                                            </span>
                                            {table.is_group && !isMergeMode ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        requestUnmerge(table);
                                                    }}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 text-white text-xs font-bold hover:bg-black transition-all shadow-sm active:scale-95 z-10 cursor-pointer"
                                                    title="Unmerge table"
                                                >
                                                    <LucideUnlink size={13} />
                                                    <span>Unmerge</span>
                                                </button>
                                            ) : !table.is_group && !isMergeMode ? (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            setEditTableId(table.id);
                                                            setEditTableNumber(table.table_number);
                                                            setEditTableCapacity(table.capacity || 4);
                                                            setEditTableAreaId(table.area_id || '');
                                                            setIsEditTableOpen(true);
                                                        }}
                                                        className="text-black hover:text-blue-600 hover:bg-blue-50 rounded-lg p-1.5 transition-all opacity-0 group-hover:opacity-100 duration-200"
                                                        title="Customize table"
                                                    >
                                                        <LucideEdit size={14} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteTable(table.id, table.table_number || table.id); }}
                                                        className="text-black hover:text-red-500 hover:bg-red-50 rounded-lg p-1.5 transition-all opacity-0 group-hover:opacity-100 duration-200"
                                                        title="Delete table"
                                                    >
                                                        <LucideTrash2 size={14} />
                                                    </button>
                                                </div>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div >
            )}
                </>
            ) : (
                /* Table Areas Section */
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl shadow-xs border border-neutral-100">
                        <div>
                            <div className="flex items-center gap-3">
                                <h3 className="text-xl font-black text-black tracking-tight">Table Areas & Dining Sections</h3>
                                <span className="text-xs bg-neutral-100 text-neutral-700 font-bold px-2.5 py-1 rounded-full">
                                    {areas.length} {areas.length === 1 ? 'Area' : 'Areas'}
                                </span>
                            </div>
                            <p className="text-neutral-500 font-medium text-xs mt-1">
                                Organize your dining space into floors, halls, or outdoor zones (e.g. Ground Floor, Rooftop, Terrace, AC Dining).
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleOpenAreaModal()}
                            className="flex items-center gap-2 bg-neutral-900 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md hover:bg-black transition-all active:scale-95 shrink-0 cursor-pointer"
                        >
                            <LucidePlus size={16} />
                            <span>Create Table Area</span>
                        </button>
                    </div>

                    {areas.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-3xl border border-neutral-100 shadow-xs">
                            <div className="w-16 h-16 bg-neutral-50 rounded-2xl flex items-center justify-center mb-4 ring-8 ring-neutral-50/50">
                                <LucideLayers size={28} className="text-neutral-400" />
                            </div>
                            <h4 className="text-lg font-black text-black mb-1">No Dining Areas Created Yet</h4>
                            <p className="text-xs font-medium text-neutral-500 max-w-sm mb-6 leading-relaxed">
                                Divide your restaurant tables into designated sections like Main Dining, Rooftop, or Patio for easier floor management.
                            </p>
                            <button
                                type="button"
                                onClick={() => handleOpenAreaModal()}
                                className="flex items-center gap-2 bg-neutral-900 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md hover:bg-black transition-all active:scale-95 cursor-pointer"
                            >
                                <LucidePlus size={16} />
                                <span>Create Your First Area</span>
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {areas.map((area) => {
                                const areaTables = tables.filter(t => t.area_id === area.id);
                                const tableCount = areaTables.length;
                                const totalSeats = areaTables.reduce((acc, t) => acc + (t.capacity || 0), 0);
                                const sortedTables = [...areaTables].sort((a, b) => 
                                    String(a.table_number).localeCompare(String(b.table_number), undefined, { numeric: true })
                                );

                                return (
                                    <div 
                                        key={area.id}
                                        className="bg-white rounded-3xl border border-neutral-100 p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                                    >
                                        <div className="space-y-4">
                                            {/* Top info and actions */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-11 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-center text-neutral-800 group-hover:bg-neutral-900 group-hover:text-white transition-colors">
                                                        <LucideLayers size={20} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black text-lg text-black tracking-tight">{area.name}</h4>
                                                        <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                                                            Display Order: {area.display_order ?? 0}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenAreaModal(area)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                                                        title="Edit Area"
                                                    >
                                                        <LucideEdit2 size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteArea(area.id, area.name)}
                                                        className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                                                        title="Delete Area"
                                                    >
                                                        <LucideTrash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Summary badges */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold bg-neutral-100 text-neutral-800 px-3 py-1 rounded-lg">
                                                    {tableCount} {tableCount === 1 ? 'Table' : 'Tables'}
                                                </span>
                                                <span className="text-xs font-bold bg-neutral-50 text-neutral-600 border border-neutral-100 px-3 py-1 rounded-lg">
                                                    {totalSeats} Guest Capacity
                                                </span>
                                            </div>

                                            {/* Tables list chips */}
                                            <div className="pt-2 border-t border-neutral-100">
                                                <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                                                    Assigned Tables:
                                                </p>
                                                {tableCount === 0 ? (
                                                    <p className="text-xs text-neutral-400 italic">No tables assigned to this area yet.</p>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                                                        {sortedTables.map(t => (
                                                            <span
                                                                key={t.id}
                                                                className="text-xs font-bold bg-neutral-50 text-neutral-800 border border-neutral-200 px-2.5 py-0.5 rounded-md"
                                                            >
                                                                Table-{t.table_number} ({t.capacity || 4}p)
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Card footer CTA */}
                                        <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center justify-between">
                                            <button
                                                type="button"
                                                onClick={() => handleAddTableToArea(area.id)}
                                                className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-neutral-50 hover:bg-neutral-900 hover:text-white text-neutral-900 text-xs font-bold rounded-xl transition-all border border-neutral-200 hover:border-neutral-900 cursor-pointer"
                                            >
                                                <LucidePlus size={14} />
                                                <span>Add Table to this Area</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
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
                                    {selectedTable.order ? (
                                        <p className="text-xs font-bold text-black uppercase tracking-widest mt-1">Order #{selectedTable.order?.id.slice(0, 8)}</p>
                                    ) : (
                                        <p className="text-xs font-medium text-neutral-500 mt-1">
                                            {selectedTable.is_group ? 'Merged Table Group' : 'No Active Order'}
                                        </p>
                                    )}
                                </div>
                                <div className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${
                                    selectedTable.phase === 'CLEANING' ? 'bg-slate-200 text-slate-800' :
                                    selectedTable.phase === 'EATING' ? 'bg-blue-100 text-blue-700' :
                                    selectedTable.phase === 'READY' ? 'bg-green-100 text-green-700' :
                                    selectedTable.phase === 'COOKING' ? 'bg-orange-100 text-orange-700' : 'bg-neutral-100'
                                    }`}>
                                    {selectedTable.phase === 'CLEANING' ? 'NEEDS CLEANING' : selectedTable.phase}
                                </div>
                            </div>

                            {/* Merged Group Info Banner */}
                            {selectedTable.is_group && (
                                <div className="mx-6 mt-4 p-3 bg-blue-50/90 border border-blue-200/80 rounded-2xl flex items-center justify-between shadow-xs">
                                    <div className="flex items-center gap-2.5">
                                        <div className="size-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                                            <LucideLink2 size={15} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-blue-900">Merged Group: {selectedTable.display_name}</p>
                                            <p className="text-[11px] font-medium text-blue-700">
                                                {selectedTable.constituent_tables?.length > 0
                                                    ? `Includes: ${selectedTable.constituent_tables.map((t: any) => `Table ${t.table_number}`).join(', ')}`
                                                    : `Capacity: ${selectedTable.capacity || 4} Seater`
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => requestUnmerge(selectedTable)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-blue-200 text-blue-800 text-xs font-bold hover:bg-blue-100 transition-all shadow-xs active:scale-95 cursor-pointer"
                                        title="Unmerge this group"
                                    >
                                        <LucideUnlink size={13} />
                                        <span>Unmerge</span>
                                    </button>
                                </div>
                            )}

                            {/* Assigned Waiter Information Card for Admin */}
                            {(selectedTable.order?.waiter_name || selectedTable.assigned_waiter_name) && (() => {
                                const assignedWaiterId = selectedTable.order?.waiter_id || selectedTable.assigned_waiter_id;
                                const assignedWaiter = waiters.find(w => w.id === assignedWaiterId);
                                const isAssignedWaiterAccountActive = assignedWaiter ? (
                                    (assignedWaiter.status || '').toLowerCase() === 'active'
                                ) : true;
                                const isAssignedWaiterOnline = assignedWaiter ? (
                                    assignedWaiter.is_online === true &&
                                    !['offline', 'break'].includes((assignedWaiter.availability_status || '').toLowerCase())
                                ) : true;
                                const isFullyAvailable = isAssignedWaiterAccountActive && isAssignedWaiterOnline;

                                return (
                                    <div className={`mx-6 mt-4 p-3.5 rounded-2xl border flex flex-col gap-2 shadow-xs ${
                                        isFullyAvailable
                                            ? 'bg-gradient-to-r from-blue-50/90 to-indigo-50/90 border-blue-100/90'
                                            : 'bg-gradient-to-r from-amber-50/90 to-orange-50/90 border-amber-200'
                                    }`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                {(selectedTable.order?.waiter_avatar || selectedTable.assigned_waiter_avatar || assignedWaiter?.avatar_url) ? (
                                                    <img
                                                        src={selectedTable.order?.waiter_avatar || selectedTable.assigned_waiter_avatar || assignedWaiter?.avatar_url}
                                                        alt={selectedTable.order?.waiter_name || selectedTable.assigned_waiter_name}
                                                        className="size-11 rounded-xl object-cover border-2 border-white shadow-xs"
                                                    />
                                                ) : (
                                                    <div className={`size-11 rounded-xl text-white font-black text-sm flex items-center justify-center shadow-xs ${
                                                        isFullyAvailable ? 'bg-blue-600' : 'bg-amber-600'
                                                    }`}>
                                                        {(selectedTable.order?.waiter_name || selectedTable.assigned_waiter_name || 'W').charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <h4 className="text-sm font-extrabold text-slate-900">
                                                            {selectedTable.order?.waiter_name || selectedTable.assigned_waiter_name}
                                                        </h4>
                                                        <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-md ${
                                                            isFullyAvailable
                                                                ? 'bg-blue-600/10 text-blue-700'
                                                                : 'bg-amber-600/10 text-amber-800'
                                                        }`}>
                                                            {selectedTable.order?.waiter_role || 'Assigned Waiter'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2.5 mt-0.5 text-[11px] font-semibold text-slate-500">
                                                        {selectedTable.order?.waiter_employee_id && (
                                                            <span className="font-mono text-slate-600">ID: {selectedTable.order.waiter_employee_id}</span>
                                                        )}
                                                        {selectedTable.order?.waiter_mobile && (
                                                            <span className="flex items-center gap-1 font-mono text-slate-600">
                                                                📞 {selectedTable.order.waiter_mobile}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                                <div className="flex items-center gap-1 text-[11px] font-bold">
                                                    <span className="text-slate-500 text-[10px] uppercase font-semibold">Account:</span>
                                                    {isAssignedWaiterAccountActive ? (
                                                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                                                            Active
                                                        </span>
                                                    ) : (
                                                        <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-extrabold text-[10px]">
                                                            Inactive
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 text-[11px] font-bold">
                                                    <span className="text-slate-500 text-[10px] uppercase font-semibold">Availability:</span>
                                                    {isAssignedWaiterOnline ? (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-extrabold text-[10px]">
                                                            <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                                                            Online
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-700 font-extrabold text-[10px]">
                                                            <span className="size-1.5 rounded-full bg-neutral-500" />
                                                            Offline
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {!isFullyAvailable && (
                                            <div className="text-xs font-semibold text-amber-800 bg-amber-100/60 p-2 rounded-xl border border-amber-200/60">
                                                {!isAssignedWaiterAccountActive 
                                                    ? '⚠️ Waiter account is currently Inactive. New orders for this table will automatically be routed to an active online waiter.'
                                                    : '⚠️ Waiter is currently Offline. New orders for this table will automatically be routed to an active online waiter.'}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {selectedTable.order ? (
                                <>
                                    {/* Items List */}
                                    <div className="p-0 overflow-y-auto flex-1 bg-white divide-y divide-neutral-100">
                                        {selectedTable.order?.items?.map((item: any, idx: number) => {
                                            const isCombo = isComboItem(item);
                                            const subItems = isCombo ? parseComboSubItems(item) : [];
                                            const comboImage = item.combo_image || item.image_url || getCategoryMenuItemImage(item.name);

                                            if (isCombo && subItems.length > 0) {
                                                return (
                                                    <div key={item.id || idx} className="p-4 bg-orange-50/15 hover:bg-orange-50/30 transition-colors">
                                                        <div className="flex justify-between items-start gap-3">
                                                            <div className="flex items-start gap-3 min-w-0">
                                                                <div className="size-12 rounded-xl bg-neutral-100 border border-neutral-200/80 overflow-hidden shrink-0">
                                                                    <img
                                                                        src={comboImage}
                                                                        alt={item.name}
                                                                        className="size-full object-cover"
                                                                        onError={(e) => {
                                                                            const target = e.currentTarget;
                                                                            const fallback = getCategoryMenuItemImage(item.name);
                                                                            if (target.src !== fallback && !target.src.endsWith(fallback)) {
                                                                                target.src = fallback;
                                                                            }
                                                                        }}
                                                                    />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-orange-500 text-white font-black text-[9.5px] uppercase tracking-wider">
                                                                            COMBO
                                                                        </span>
                                                                        <p className="text-sm font-black text-black leading-tight truncate">
                                                                            {item.name}
                                                                        </p>
                                                                        <span className="text-xs font-black text-orange-600">
                                                                            ({item.quantity}x)
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <span className={`text-[10px] font-black uppercase tracking-wider ${
                                                                            item.status === 'ready' ? 'text-green-600' :
                                                                            item.status === 'served' ? 'text-neutral-600' :
                                                                            item.status === 'paid' ? 'text-green-600' : 'text-orange-500'
                                                                        }`}>
                                                                            {item.status === 'preparing' ? 'COOKING' : item.status}
                                                                        </span>
                                                                        {item.notes && (
                                                                            <span className="text-[11px] text-amber-800 italic">
                                                                                • {item.notes}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <span className="text-sm font-bold text-black shrink-0">
                                                                {formatCurrency(item.price * item.quantity)}
                                                            </span>
                                                        </div>

                                                        {/* Drop down button to see items inside combo */}
                                                        {(() => {
                                                            const comboKey = item.id ? String(item.id) : `combo-${idx}`;
                                                            const isExpanded = !!expandedCombos[comboKey];

                                                            return (
                                                                <>
                                                                    <div className="mt-2.5 pt-2 border-t border-orange-200/60">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => toggleCombo(comboKey)}
                                                                            className="w-full py-1.5 px-3 rounded-lg flex items-center justify-between text-xs font-bold bg-white border border-neutral-200 shadow-xs hover:bg-neutral-50 active:scale-[0.99] transition-all"
                                                                        >
                                                                            <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-neutral-700">
                                                                                <span className="size-2 rounded-full bg-orange-500" />
                                                                                {isExpanded ? 'Hide items inside combo' : 'See items inside combo'}
                                                                                <span className="text-[10px] font-medium text-neutral-500">
                                                                                    ({subItems.length} {subItems.length === 1 ? 'item' : 'items'})
                                                                                </span>
                                                                            </span>
                                                                            <div className="inline-flex items-center gap-1 text-neutral-500">
                                                                                <span className="text-[10px] font-bold text-orange-600">
                                                                                    {isExpanded ? 'Collapse' : 'View'}
                                                                                </span>
                                                                                <LucideChevronDown
                                                                                    size={14}
                                                                                    className={`transition-transform duration-200 ${
                                                                                        isExpanded ? 'rotate-180' : ''
                                                                                    }`}
                                                                                />
                                                                            </div>
                                                                        </button>
                                                                    </div>

                                                                    {/* Included Items Breakdown with Images */}
                                                                    <AnimatePresence initial={false}>
                                                                        {isExpanded && (
                                                                            <motion.div
                                                                                initial={{ opacity: 0, height: 0 }}
                                                                                animate={{ opacity: 1, height: 'auto' }}
                                                                                exit={{ opacity: 0, height: 0 }}
                                                                                transition={{ duration: 0.2, ease: 'easeInOut' }}
                                                                                className="overflow-hidden space-y-1.5 pt-2"
                                                                            >
                                                                                <div className="flex items-center justify-between text-[10.5px] font-black uppercase tracking-wider text-neutral-600 px-0.5">
                                                                                    <span>Includes ({subItems.length} items):</span>
                                                                                    <span className="text-[10px] font-bold text-neutral-500">
                                                                                        Total portions: {subItems.reduce((acc, s) => acc + (s.quantity * item.quantity), 0)}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="space-y-1.5 mt-1.5">
                                                                                    {subItems.map((sub, sIdx) => {
                                                                                        const subImg = sub.image_url || getCategoryMenuItemImage(sub.name);
                                                                                        const isVeg = sub.item_type?.toLowerCase() === 'veg';
                                                                                        return (
                                                                                            <div key={sIdx} className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-white border border-neutral-200/80 shadow-xs">
                                                                                                <div className="flex items-center gap-2.5 min-w-0">
                                                                                                    <div className="size-9 rounded-lg bg-neutral-100 border border-neutral-200 overflow-hidden shrink-0">
                                                                                                        <img
                                                                                                            src={subImg}
                                                                                                            alt={sub.name}
                                                                                                            className="size-full object-cover"
                                                                                                            onError={(e) => {
                                                                                                                const target = e.currentTarget;
                                                                                                                const fallback = getCategoryMenuItemImage(sub.name);
                                                                                                                if (target.src !== fallback && !target.src.endsWith(fallback)) {
                                                                                                                    target.src = fallback;
                                                                                                                }
                                                                                                            }}
                                                                                                        />
                                                                                                    </div>
                                                                                                    <div className="min-w-0">
                                                                                                        <div className="flex items-center gap-1.5">
                                                                                                            <span className={`size-2 rounded-full shrink-0 ${isVeg ? 'bg-green-500' : 'bg-red-500'}`} />
                                                                                                            <span className="text-xs font-bold text-neutral-800 truncate">
                                                                                                                {sub.name}
                                                                                                            </span>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <span className="shrink-0 px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-800 text-[11px] font-black border border-neutral-200/80">
                                                                                                    x{sub.quantity * item.quantity}
                                                                                                </span>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </motion.div>
                                                                        )}
                                                                    </AnimatePresence>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div key={item.id || idx} className="flex justify-between items-center p-4 hover:bg-neutral-50 transition-colors">
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
                                            );
                                        })}
                                    </div>

                                    {/* Actions Footer */}
                                    <div className="p-5 border-t border-neutral-100 bg-neutral-50 space-y-4">
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

                                        {selectedTable.is_group && (
                                            <button
                                                onClick={() => requestUnmerge(selectedTable)}
                                                className="w-full flex items-center justify-center gap-2 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl transition-all active:scale-95 border border-neutral-200 cursor-pointer"
                                            >
                                                <LucideUnlink size={14} />
                                                Unmerge Table Group
                                            </button>
                                        )}

                                        <button
                                            onClick={() => setSelectedTable(null)}
                                            className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-black hover:text-black"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </>
                            ) : selectedTable.phase === 'CLEANING' || ['cleaning', 'dirty', 'to_clean'].includes((selectedTable.status || '').toLowerCase()) ? (
                                <div className="p-8 flex flex-col items-center justify-center text-center space-y-5 my-auto">
                                    <div className="size-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 shadow-inner">
                                        <LucideSparkles size={32} />
                                    </div>
                                    <div>
                                        <h4 className="text-base font-black text-slate-800">
                                            {selectedTable.is_group ? `Merged Group ${selectedTable.display_name} Needs Cleaning` : `Table ${selectedTable.table_number} Needs Cleaning`}
                                        </h4>
                                        <p className="text-xs text-neutral-500 font-medium mt-1 max-w-xs leading-relaxed">
                                            Payment is settled. Clear the table once it is cleaned and sanitized to mark it available for new guests.
                                        </p>
                                    </div>
                                    <button
                                        onClick={requestClearTable}
                                        className="w-full max-w-xs flex items-center justify-center gap-2 py-3.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 active:scale-95 cursor-pointer"
                                    >
                                        <LucideTrash2 size={18} />
                                        Clear Table & Mark Available
                                    </button>
                                    {selectedTable.is_group && (
                                        <button
                                            onClick={() => requestUnmerge(selectedTable)}
                                            className="w-full max-w-xs flex items-center justify-center gap-2 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl transition-all active:scale-95 border border-neutral-200 cursor-pointer"
                                        >
                                            <LucideUnlink size={16} />
                                            Unmerge Table Group
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setSelectedTable(null)}
                                        className="w-full max-w-xs flex items-center justify-center py-2 text-sm font-medium text-neutral-500 hover:text-neutral-800"
                                    >
                                        Close
                                    </button>
                                </div>
                            ) : (
                                <div className="p-8 flex flex-col items-center justify-center text-center space-y-4 my-auto">
                                    <div className="size-16 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400">
                                        <LucideTable size={32} />
                                    </div>
                                    <div>
                                        <h4 className="text-base font-bold text-neutral-800">
                                            {selectedTable.is_group ? 'Merged Table Active' : 'No Active Order'}
                                        </h4>
                                        <p className="text-xs text-neutral-500 mt-1 max-w-xs leading-relaxed">
                                            {selectedTable.is_group
                                                ? 'This merged group is currently active on the floor. Unmerging will restore each individual table.'
                                                : 'There are currently no active orders on this table.'}
                                        </p>
                                    </div>
                                    {selectedTable.is_group && (
                                        <button
                                            onClick={() => requestUnmerge(selectedTable)}
                                            className="w-full max-w-xs flex items-center justify-center gap-2 py-3.5 bg-neutral-900 text-white font-bold rounded-xl hover:bg-black transition-all shadow-lg active:scale-95 cursor-pointer"
                                        >
                                            <LucideUnlink size={16} />
                                            Unmerge Tables Now
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setSelectedTable(null)}
                                        className="w-full max-w-xs flex items-center justify-center py-2 text-sm font-medium text-neutral-500 hover:text-neutral-800"
                                    >
                                        Close
                                    </button>
                                </div>
                            )}
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
                                        try {
                                            await confirmAction.action();
                                        } catch (err: any) {
                                            console.error('Confirmation action error:', err);
                                            toast.error(err?.message || 'Action failed.');
                                        } finally {
                                            setConfirmAction(prev => ({ ...prev, isOpen: false }));
                                        }
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
                                        id="table-qr-code-svg"
                                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/${restaurantId}/customer/table/${encodeURIComponent(selectedQrTable.is_group ? selectedQrTable.display_name : (selectedQrTable.table_number || selectedQrTable.id))}`}
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
                                <button
                                    onClick={() => {
                                        setEditTableId(selectedQrTable.id);
                                        setEditTableNumber(selectedQrTable.table_number || selectedQrTable.display_name || '');
                                        setEditTableCapacity(selectedQrTable.capacity || 4);
                                        setEditTableAreaId(selectedQrTable.area_id || '');
                                        setIsEditTableOpen(true);
                                        setSelectedQrTable(null);
                                    }}
                                    className="flex-1 flex items-center justify-center py-3 bg-white border border-neutral-200 text-black font-bold rounded-xl hover:bg-neutral-50 transition-colors cursor-pointer"
                                >
                                    <LucideEdit size={18} className="mr-2" />
                                    Edit
                                </button>
                                <button
                                    onClick={() => {
                                        const svg = document.getElementById('table-qr-code-svg');
                                        if (svg) {
                                            const svgData = new XMLSerializer().serializeToString(svg);
                                            const canvas = document.createElement('canvas');
                                            const ctx = canvas.getContext('2d');
                                            const img = new Image();
                                            img.onload = () => {
                                                canvas.width = img.width + 40;
                                                canvas.height = img.height + 40;
                                                if (ctx) {
                                                    ctx.fillStyle = '#FFFFFF';
                                                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                                                    ctx.drawImage(img, 20, 20);
                                                    const pngFile = canvas.toDataURL('image/png');
                                                    const downloadLink = document.createElement('a');
                                                    downloadLink.download = `table-${selectedQrTable.table_number || selectedQrTable.display_name || 'qr'}.png`;
                                                    downloadLink.href = pngFile;
                                                    downloadLink.click();
                                                }
                                            };
                                            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
                                        }
                                    }}
                                    className="flex-1 flex items-center justify-center py-3 bg-neutral-900 text-white font-bold rounded-xl hover:bg-black transition-colors shadow-lg shadow-neutral-900/20 cursor-pointer"
                                >
                                    <LucideDownload size={18} className="mr-2" />
                                    Download
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Edit Table Modal */}
            {
                isEditTableOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
                                <h3 className="text-xl font-bold text-black">{editTableId ? 'Edit Table' : 'Add Table'}</h3>
                                <button
                                    onClick={() => setIsEditTableOpen(false)}
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
                                        value={editTableNumber}
                                        onChange={(e) => setEditTableNumber(e.target.value)}
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
                                            onClick={() => setEditTableCapacity(Math.max(1, editTableCapacity - 1))}
                                            className="size-10 rounded-xl border border-neutral-200 flex items-center justify-center text-black hover:bg-neutral-50 active:scale-95 transition-transform"
                                        >
                                            <span className="text-xl font-bold">-</span>
                                        </button>
                                        <span className="flex-1 text-center font-black text-xl text-black font-mono bg-neutral-50 py-2 rounded-xl border border-neutral-100">
                                            {editTableCapacity}
                                        </span>
                                        <button
                                            onClick={() => setEditTableCapacity(editTableCapacity + 1)}
                                            className="size-10 rounded-xl border border-neutral-200 flex items-center justify-center text-black hover:bg-neutral-50 active:scale-95 transition-transform"
                                        >
                                            <span className="text-xl font-bold">+</span>
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-xs font-bold text-black uppercase tracking-wider">
                                            Area
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenAreaModal()}
                                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer"
                                        >
                                            <LucidePlus size={12} />
                                            <span>New Area</span>
                                        </button>
                                    </div>
                                    {areas.length > 0 ? (
                                        <select
                                            value={editTableAreaId}
                                            onChange={(e) => setEditTableAreaId(e.target.value)}
                                            className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-black font-bold focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
                                        >
                                            <option value="" disabled={editTableId === null}>
                                                {editTableId === null ? 'Select Area...' : 'Default Area'}
                                            </option>
                                            {areas.map(area => (
                                                <option key={area.id} value={area.id}>{area.name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-500 flex items-center justify-between">
                                            <span>No areas created yet</span>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenAreaModal()}
                                                className="text-xs font-bold text-neutral-900 underline cursor-pointer"
                                            >
                                                Create Area
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={handleUpdateTable}
                                    disabled={!editTableNumber || isEditingTable}
                                    className={`w-full py-3.5 mt-4 ${!editTableNumber || isEditingTable ? 'bg-neutral-200 text-black cursor-not-allowed' : 'bg-neutral-900 text-white shadow-lg shadow-neutral-900/20 hover:bg-black active:scale-95'} rounded-xl font-bold transition-all flex items-center justify-center gap-2`}
                                >
                                    {isEditingTable ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <LucideCheckCircle size={18} />
                                            <span>Save Changes</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Create/Edit Area Modal */}
            <AnimatePresence>
                {isAreaModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
                        >
                            <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
                                <h3 className="text-xl font-bold text-black">{editAreaId ? 'Edit Table Area' : 'Create Table Area'}</h3>
                                <button
                                    onClick={() => setIsAreaModalOpen(false)}
                                    className="text-neutral-400 hover:text-black p-1 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
                                >
                                    <LucideX size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-black uppercase tracking-wider mb-2">
                                        Area Name
                                    </label>
                                    <input
                                        type="text"
                                        value={areaName}
                                        onChange={(e) => setAreaName(e.target.value)}
                                        placeholder="e.g. Ground Floor, Rooftop, Patio"
                                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-black font-bold placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-black uppercase tracking-wider mb-2">
                                        Display Order
                                    </label>
                                    <input
                                        type="number"
                                        value={areaDisplayOrder}
                                        onChange={(e) => setAreaDisplayOrder(parseInt(e.target.value) || 0)}
                                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-black font-bold focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
                                    />
                                </div>

                                <button
                                    onClick={handleSaveArea}
                                    disabled={!areaName.trim() || isSavingArea}
                                    className={`w-full py-3.5 mt-4 ${!areaName.trim() || isSavingArea ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed' : 'bg-neutral-900 text-white shadow-lg hover:bg-black active:scale-95'} rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer`}
                                >
                                    {isSavingArea ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                                    ) : (
                                        <>
                                            <LucideCheckCircle size={18} />
                                            <span>{editAreaId ? 'Update Area' : 'Save Area'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Area Delete Error Modal */}
            <AnimatePresence>
                {areaDeleteError && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                    >
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center"
                        >
                            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
                                <LucideX size={32} strokeWidth={3} />
                            </div>
                            <h3 className="text-xl font-black text-black mb-2">Delete Failed</h3>
                            <p className="text-neutral-500 font-medium text-sm leading-relaxed mb-8">
                                {areaDeleteError}
                            </p>
                            <button
                                onClick={() => setAreaDeleteError(null)}
                                className="w-full py-3.5 bg-neutral-900 text-white rounded-xl font-bold hover:bg-black active:scale-95 transition-all shadow-md cursor-pointer"
                            >
                                Got it
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}
