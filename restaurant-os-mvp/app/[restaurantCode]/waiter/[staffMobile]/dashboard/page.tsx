'use client';

import { useState, useEffect, memo, useMemo, useCallback } from 'react';
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion';
import { useRouter, useParams } from 'next/navigation';
import { OrderService, type Order, type TableMergeGroup } from '@/app/services/orders';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase';
import { useRestaurantId } from '@/app/hooks/useRestaurantId';
import { Bell as LucideBell, Receipt as LucideReceipt, GlassWater as LucideGlassWater, Utensils as LucideUtensils, Pipette as LucidePipette, Disc as LucideDisc, Soup as LucideSoup, GripHorizontal as LucideGripHorizontal, Wind as LucideWind, Droplet as LucideDroplet, HandPlatter as LucideHandPlatter, Users as LucideUsers, Search as LucideSearch, Clock as LucideClock, Filter as LucideFilter, AlertCircle as LucideAlertCircle, CheckCircle2 as LucideCheckCircle2, ChevronRight as LucideChevronRight, User as LucideUser, Coffee as LucideCoffee, Check as LucideCheck } from 'lucide-react';

const supabase = createClient();

type TableViewStatus = 'ready' | 'cooking' | 'eating' | 'empty' | 'alert' | 'customer_present' | 'ordering' | 'billing' | 'cleaning' | 'reserved';

interface Table {
    id: number;
    table_number: string;
    status: string;
    capacity: number;
    alert_status?: 'call_waiter' | 'bill_requested' | null;
}

// Helper: Determine Visual Priority Outside
const getComputedStatus = (table: any, orders: Order[]): TableViewStatus => {
    const tableOrders = table.is_group
        ? orders.filter(o => String(o.merge_group_id) === String(table.id))
        : orders.filter(o => String(o.table_id) === String(table.id));

    const isReady = tableOrders.some(o =>
        o.items && o.items.some((i: any) => i.status === 'ready')
    );
    if (isReady) return 'ready';

    const isCooking = tableOrders.some(o =>
        (o.items && o.items.some((i: any) => i.status === 'preparing')) ||
        ((!o.items || o.items.length === 0) && o.status === 'preparing')
    );
    if (isCooking) return 'cooking';

    if (table.status === 'billing') return 'billing';
    if (table.status === 'cleaning') return 'cleaning';
    if (table.status === 'ordering') return 'ordering';
    if (table.status === 'customer_present') return 'customer_present';
    if (table.status === 'reserved') return 'reserved';
    if (table.status === 'eating') return 'eating';

    const isEating = tableOrders.length > 0 || (table.status !== 'free' && table.status !== 'empty');
    if (isEating) return 'eating';

    return 'empty';
};

const getAlertDetails = (type: string | undefined | null) => {
    switch (type) {
        case 'bill_requested': return { label: 'Service Requested', icon: LucideReceipt, color: 'text-purple-600', bg: 'bg-purple-100' };
        case 'call_waiter': return { label: 'Waiter Called', icon: LucideHandPlatter, color: 'text-orange-600', bg: 'bg-orange-100' };
        case 'water_requested': return { label: 'Water', icon: LucideGlassWater, color: 'text-blue-600', bg: 'bg-blue-100' };
        case 'glass_requested': return { label: 'Extra Glass', icon: LucideGlassWater, color: 'text-sky-600', bg: 'bg-sky-100' };
        case 'cutlery_requested': return { label: 'Cutlery', icon: LucideUtensils, color: 'text-black', bg: 'bg-gray-100' };
        case 'straw_requested': return { label: 'Straw', icon: LucidePipette, color: 'text-yellow-600', bg: 'bg-yellow-100' };
        case 'plate_requested': return { label: 'Extra Plate', icon: LucideDisc, color: 'text-black', bg: 'bg-zinc-100' };
        case 'bowl_requested': return { label: 'Finger Bowl', icon: LucideSoup, color: 'text-teal-600', bg: 'bg-teal-100' };
        case 'salt_requested': return { label: 'Salt', icon: LucideGripHorizontal, color: 'text-black', bg: 'bg-stone-100' };
        case 'pepper_requested': return { label: 'Pepper', icon: LucideWind, color: 'text-black', bg: 'bg-stone-100' };
        case 'sauce_requested': return { label: 'Ketchup', icon: LucideDroplet, color: 'text-red-600', bg: 'bg-red-100' };
        default: return { label: 'Alert', icon: LucideBell, color: 'text-red-600', bg: 'bg-red-100' };
    }
};

const getWorkloadCategory = (score: number = 0) => {
    if (score <= 3) return 'low';
    if (score <= 7) return 'medium';
    return 'high';
};


const RenderTableCard = memo(({ 
    table, 
    activeTab, 
    isMergeMode, 
    isSelectedForMerge, 
    handleTableClick, 
    handleDismissAlert,
    handleAssignClick,
    pendingRequests,
    currentWaiterId 
}: { 
    table: any; 
    activeTab: string;
    isMergeMode: boolean;
    isSelectedForMerge: boolean;
    handleTableClick: any;
    handleDismissAlert: any;
    handleAssignClick: (e: React.MouseEvent, table: any) => void;
    pendingRequests: any[];
    currentWaiterId?: string;
}) => {
    let statusColor = '';
    let statusText = '';
    let icon = '';
    let cardBg = 'bg-white';
    let borderColor = 'border-divider';

    // Show the actual computed status of the table to preserve accurate visual states
    const displayStatus = table.computedStatus;
    const isAssignedToMe = table.assigned_waiter_id === currentWaiterId;
    const assignedWaiterName = table.activeOrders?.[0]?.waiter_name; // Fallback to order's waiter if table not explicitly assigned

    switch (displayStatus) {
        case 'ready':
            statusColor = 'green'; statusText = 'Ready'; icon = 'table_restaurant'; cardBg = 'bg-emerald-500'; borderColor = 'border-emerald-600'; break;
        case 'cooking':
            statusColor = 'orange'; statusText = 'Cooking'; icon = 'skillet'; cardBg = 'bg-orange-500'; borderColor = 'border-orange-600'; break;
        case 'eating':
            statusColor = 'blue'; statusText = 'Eating'; icon = 'restaurant'; cardBg = 'bg-blue-500'; borderColor = 'border-blue-600'; break;
        case 'customer_present':
            statusColor = 'sky'; statusText = 'Present'; icon = 'person_pin'; cardBg = 'bg-sky-500'; borderColor = 'border-sky-600'; break;
        case 'ordering':
            statusColor = 'yellow'; statusText = 'Ordering'; icon = 'menu_book'; cardBg = 'bg-yellow-500'; borderColor = 'border-yellow-600'; break;
        case 'billing':
            statusColor = 'purple'; statusText = 'Billing'; icon = 'receipt'; cardBg = 'bg-purple-500'; borderColor = 'border-purple-600'; break;
        case 'cleaning':
            statusColor = 'teal'; statusText = 'Cleaning'; icon = 'cleaning_services'; cardBg = 'bg-teal-500'; borderColor = 'border-teal-600'; break;
        case 'reserved':
            statusColor = 'indigo'; statusText = 'Reserved'; icon = 'bookmark'; cardBg = 'bg-indigo-500'; borderColor = 'border-indigo-600'; break;
        case 'empty':
            statusColor = 'gray'; statusText = 'Empty'; icon = 'event_seat'; cardBg = 'bg-white'; borderColor = 'border-gray-200'; break;
    }

    const isDark = ['ready', 'cooking', 'eating', 'customer_present', 'ordering', 'billing', 'cleaning', 'reserved'].includes(displayStatus);
    const textColor = isDark ? 'text-white' : 'text-charcoal';
    const subTextColor = isDark ? 'text-green-50' : 'text-black';
    const iconColor = isDark ? 'text-white' : `text-${statusColor}-600`;
    const badgeBg = isDark ? 'bg-white/20' : `bg-${statusColor}-100`;
    const badgeText = isDark ? 'text-white' : `text-${statusColor}-700`;

    return (
        <div
            onClick={() => handleTableClick(table, displayStatus)}
            className={`flex flex-col p-4 rounded-2xl border ${isMergeMode && isSelectedForMerge ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-500 shadow-md' : borderColor} ${isMergeMode && isSelectedForMerge ? '' : cardBg} ${isMergeMode && (table.is_group || displayStatus !== 'empty') ? 'opacity-50 grayscale cursor-not-allowed' : 'shadow-sm active:scale-95 transition-transform cursor-pointer'} relative overflow-hidden min-h-[120px]`}
        >
            <div className="flex justify-between items-start mb-2">
                <span className={`material-icons-outlined ${iconColor} text-3xl`}>{icon}</span>
                <div className="flex flex-col items-end gap-1">
                    <span className={`px-2 py-1 rounded-lg ${badgeBg} ${badgeText} text-[10px] font-black uppercase tracking-wide backdrop-blur-sm`}>{statusText}</span>
                    {!isMergeMode && (
                        <button 
                            onClick={(e) => handleAssignClick(e, table)}
                            className={`p-1.5 rounded-full ${isDark ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-gray-100 text-black hover:bg-gray-200'} transition-colors`}
                        >
                            <LucideUsers size={14} />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-center mt-1">
                <h3 className={`${textColor} md:text-xl text-lg font-bold leading-none flex items-center gap-1`}>
                    {table.is_group ? table.display_name : `Table ${table.table_number || table.id}`}
                </h3>
                <div className={`${subTextColor} text-[11px] font-bold mt-1 mb-1 flex items-center gap-1 justify-center opacity-80`}>
                    <LucideUsers size={12} />
                    {table.capacity || 4} Seater
                </div>
                {displayStatus !== 'empty' && (
                    <div className={`text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 ${isDark ? 'text-white/80' : 'text-black'}`}>
                        {isAssignedToMe ? (
                            <span className="bg-white/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <LucideCheck size={10} /> My Table
                            </span>
                        ) : table.assigned_waiter_id ? (
                            <span className="flex items-center gap-1">
                                <LucideUser size={10} /> {assignedWaiterName || 'Other'}
                            </span>
                        ) : (
                            <span className="text-amber-500 font-black animate-pulse">Unassigned</span>
                        )}
                    </div>
                )}
            </div>

            {!isDark && <div className={`absolute bottom-0 left-0 w-full h-1 bg-${statusColor}-400`}></div>}

            {table.alert_status && (table.is_group ? (table.table_ids || []).some((tid: number) => pendingRequests.some(r => r.table_id === tid)) : pendingRequests.some(r => r.table_id === table.id)) && (
                <div className="absolute top-0 right-0 p-2 z-20 flex gap-2">
                    <button
                        onClick={(e) => handleDismissAlert(e, table.id)}
                        className={`p-2 rounded-full shadow-lg animate-bounce transition-colors flex items-center gap-2 px-3 ${getAlertDetails(table.alert_status).bg} ${getAlertDetails(table.alert_status).color}`}
                    >
                        {(() => {
                            const Icon = getAlertDetails(table.alert_status).icon;
                            return <Icon size={18} />;
                        })()}
                        <span className="text-xs font-bold leading-none">{getAlertDetails(table.alert_status).label}</span>
                    </button>
                </div>
            )}

            {table.alert_status && (table.is_group ? (table.table_ids || []).some((tid: number) => pendingRequests.some(r => r.table_id === tid)) : pendingRequests.some(r => r.table_id === table.id)) && (
                <div className="absolute inset-x-0 top-0 bg-red-500/10 h-full w-full pointer-events-none border-2 border-red-500 rounded-2xl animate-pulse"></div>
            )}
        </div>
    );
});

RenderTableCard.displayName = 'RenderTableCard';

export default function WaiterDashboard() {
    const [tables, setTables] = useState<any[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('eating');
    const [mergeGroups, setMergeGroups] = useState<TableMergeGroup[]>([]);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);

    const [isMergeMode, setIsMergeMode] = useState(false);
    const [selectedForMerge, setSelectedForMerge] = useState<number[]>([]);
    const [isMerging, setIsMerging] = useState(false);

    const [waiterRecord, setWaiterRecord] = useState<any>(null);
    const [staffList, setStaffList] = useState<any[]>([]);
    const [offloadModalOpen, setOffloadModalOpen] = useState(false);
    const [offloading, setOffloading] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    const router = useRouter();
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const params = useParams();
    const staffMobile = params.staffMobile as string;

    useEffect(() => {
        let active = true;
        const fetchWaiter = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (active && user && restaurantId) {
                try {
                    const record = await OrderService.getWaiterRecord(restaurantId, user.id);
                    if (active) setWaiterRecord(record);
                } catch (err) {
                    console.error('Error fetching waiter record:', err);
                }
            }
        };
        if (restaurantId && !restaurantLoading) fetchWaiter();
        return () => { active = false; };
    }, [restaurantId, restaurantLoading]);

    const handleStatusToggle = async (newStatus: 'available' | 'busy' | 'break') => {
        if (!waiterRecord || isUpdatingStatus) return;
        setIsUpdatingStatus(true);
        try {
            await OrderService.updateWaiterStatus(waiterRecord.id, newStatus);
            setWaiterRecord({ ...waiterRecord, availability_status: newStatus });
        } catch (err) {
            console.error('Failed to update status:', err);
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const loadStaff = useCallback(async () => {
        if (!restaurantId) return;
        try {
            const staff = await OrderService.fetchStaffWithWorkload(restaurantId);
            setStaffList(staff.filter(s => s.mobile !== staffMobile));
        } catch (error) {
            console.error('Failed to load staff:', error);
        }
    }, [restaurantId, staffMobile]);

    useEffect(() => {
        if (restaurantId && staffMobile) {
            loadStaff();
        }
    }, [restaurantId, staffMobile, loadStaff]);

    const loadData = useCallback(async (isBackground = false) => {
        if (!restaurantId) return;
        if (!isBackground) setLoading(true);
        setIsRefreshing(true);
        
        try {
            // Re-fetch waiter record to get latest workload
            const { data: { user } } = await supabase.auth.getUser();
            let currentWaiter = waiterRecord;
            if (user) {
                currentWaiter = await OrderService.getWaiterRecord(restaurantId, user.id);
                setWaiterRecord(currentWaiter);
            }

            if (!currentWaiter?.id) {
                if (!isBackground) setLoading(false);
                setIsRefreshing(false);
                return;
            }

            const [fetchedTables, fetchedOrders, fetchedMergeGroups, requests] = await Promise.all([
                OrderService.fetchTables(restaurantId, currentWaiter.id),
                OrderService.fetchActiveOrders(restaurantId, currentWaiter.id),
                OrderService.fetchMergeGroups(restaurantId, currentWaiter.id),
                OrderService.fetchActiveServiceRequests(restaurantId, currentWaiter.id)
            ]);
            
            // Batch state updates
            setTables(fetchedTables || []);
            setOrders(fetchedOrders || []);
            setMergeGroups(fetchedMergeGroups || []);
            setPendingRequests(requests || []);
        } catch (err) {
            console.error('Failed to load dashboard data', err);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [restaurantId, waiterRecord?.id]);

    useEffect(() => {
        let active = true;
        if (restaurantLoading || !restaurantId) return;
        
        const loadInitialData = async () => {
            await loadData();
        };
        
        loadInitialData();

        let refreshTimer: NodeJS.Timeout;
        const debouncedRefresh = () => {
            clearTimeout(refreshTimer);
            refreshTimer = setTimeout(() => {
                if (active) loadData(true);
            }, 1000);
        };

        const orderSub = OrderService.subscribeToOrders(restaurantId, (payload: any) => {
            if (['INSERT', 'UPDATE', 'DELETE'].includes(payload.eventType)) debouncedRefresh();
        }, waiterRecord?.id);

        const tableSub = OrderService.subscribeToTables(restaurantId, () => debouncedRefresh());
        const itemSub = OrderService.subscribeToOrderItems(restaurantId, () => debouncedRefresh());
        const mergeSub = OrderService.subscribeToMergeGroups(restaurantId, () => debouncedRefresh());
        
        let serviceSub: { unsubscribe: () => void } | null = null;
        if (waiterRecord?.id) {
            serviceSub = OrderService.subscribeToServiceRequests(restaurantId, () => debouncedRefresh(), waiterRecord.id);
        }

        return () => {
            active = false;
            orderSub.unsubscribe();
            tableSub.unsubscribe();
            itemSub.unsubscribe();
            mergeSub.unsubscribe();
            if (serviceSub) serviceSub.unsubscribe();
            clearTimeout(refreshTimer);
        };
    }, [restaurantLoading, restaurantId, loadData, waiterRecord?.id]);

    const displayEntities = useMemo(() => {
        const entities: any[] = [];
        const mergedGroupIdsRendered = new Set<string>();

        tables.forEach(table => {
            if ((table as any).is_merged && (table as any).merged_group_id) {
                if (!mergedGroupIdsRendered.has((table as any).merged_group_id)) {
                    const groupId = (table as any).merged_group_id;
                    mergedGroupIdsRendered.add(groupId);
                    const group = mergeGroups.find(g => g.id === groupId);
                    
                    if (group) {
                        // Find if any table in this group has an alert
                        const tablesInGroup = tables.filter(t => (t as any).merged_group_id === groupId);
                        const alertingTable = tablesInGroup.find(t => t.alert_status && pendingRequests.some(r => r.table_id === t.id));
                        
                        entities.push({
                            ...group,
                            is_group: true,
                            table_number: group.display_name,
                            capacity: group.total_capacity,
                            alert_status: alertingTable ? alertingTable.alert_status : null,
                            // Store IDs of tables in group for alert dismissal logic
                            table_ids: tablesInGroup.map(t => t.id)
                        });
                    }
                }
            } else {
                entities.push({ ...table, is_group: false });
            }
        });
        return entities;
    }, [tables, mergeGroups, pendingRequests]);

    const filteredTables = useMemo(() => {
        return displayEntities.map(table => {
            const tableOrders = table.is_group
                ? orders.filter(o => String(o.merge_group_id) === String(table.id))
                : orders.filter(o => String(o.table_id) === String(table.id));

            const isReadyCheck = tableOrders.some(o => o.items && o.items.some((i: any) => i.status === 'ready'));
            const isCookingCheck = tableOrders.some(o =>
                (o.items && o.items.some((i: any) => i.status === 'preparing')) ||
                ((!o.items || o.items.length === 0) && o.status === 'preparing')
            );
            const isEatingCheck = tableOrders.length > 0 || (table.status !== 'free' && table.status !== 'empty');

            const computedStatus = getComputedStatus(table, orders);

            return { 
                ...table, 
                computedStatus, 
                isReady: isReadyCheck, 
                isCooking: isCookingCheck, 
                isEating: isEatingCheck, 
                activeOrders: tableOrders, 
                guests: ((table.id % 4) + 1) // Stable guest count based on ID
            };
        }).filter(table => {
            if (activeTab === 'all') return true;
            if (activeTab === 'ready') return table.isReady;
            if (activeTab === 'cooking') return table.isCooking;
            if (activeTab === 'eating') return table.isEating;
            if (activeTab === 'empty') return table.computedStatus === 'empty';
            if (activeTab === 'alert') return !!table.alert_status;
            return false;
        }).sort((a, b) => {
            // Show merged tables at top
            if (a.is_group && !b.is_group) return -1;
            if (!a.is_group && b.is_group) return 1;

            // Sort active tables to the top
            const aActive = a.computedStatus !== 'empty';
            const bActive = b.computedStatus !== 'empty';
            if (aActive && !bActive) return -1;
            if (!aActive && bActive) return 1;

            // Sort by table number within active/empty groups
            const aNum = parseInt(String(a.table_number).match(/\d+/)?.[0] || '0');
            const bNum = parseInt(String(b.table_number).match(/\d+/)?.[0] || '0');
            return aNum - bNum;
        });
    }, [displayEntities, orders, activeTab]);

    const handleTableClick = useCallback((table: any, computedStatus: TableViewStatus) => {
        if (isMergeMode) {
            if (table.is_group || computedStatus !== 'empty') return;
            const numId = Number(table.id);
            setSelectedForMerge(prev =>
                prev.includes(numId) ? prev.filter(id => id !== numId) : [...prev, numId]
            );
            return;
        }
        const routeId = table.is_group ? encodeURIComponent(table.display_name) : (table.table_number || table.id);
        router.push(`/${restaurantId}/waiter/${staffMobile}/order/${routeId}`);
    }, [isMergeMode, restaurantId, router, staffMobile]);

    const handleConfirmMerge = async () => {
        if (selectedForMerge.length < 2 || !restaurantId) return;
        setIsMerging(true);
        try {
            await OrderService.mergeTables(selectedForMerge, restaurantId);
            setIsMergeMode(false);
            setSelectedForMerge([]);
        } catch (error) {
            console.error('Failed to merge tables:', error);
        } finally {
            setIsMerging(false);
        }
    };

    const handleOffloadWorkload = async (targetStaffId: string) => {
        if (!waiterRecord?.id || !restaurantId) return;
        
        try {
            setOffloading(true);
            const result = await OrderService.transferEntireWorkload(waiterRecord.id, targetStaffId, restaurantId);
            if (result.success) {
                toast.success('Workload transferred successfully');
                setOffloadModalOpen(false);
                loadData(); // Refresh everything
            } else {
                toast.error('Failed to transfer workload');
            }
        } catch (error) {
            console.error(error);
            toast.error('An error occurred during transfer');
        } finally {
            setOffloading(false);
        }
    };

    const handleDismissAlert = useCallback(async (e: React.MouseEvent, tableId: number | string) => {
        e.stopPropagation();
        if (!restaurantId) return;
        try {
            await OrderService.dismissTableAlert(tableId, restaurantId);
        } catch (error) {
            console.error('Failed to dismiss alert', error);
        }
    }, [restaurantId]);

    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedTableForAssign, setSelectedTableForAssign] = useState<any>(null);
    const [allStaff, setAllStaff] = useState<any[]>([]);
    const [isAssigning, setIsAssigning] = useState(false);

    const handleAssignClick = useCallback((e: React.MouseEvent, table: any) => {
        e.stopPropagation();
        if (!restaurantId) return;
        setSelectedTableForAssign(table);
        setIsAssignModalOpen(true);
        // Fetch staff list
        OrderService.fetchStaffWithWorkload(restaurantId).then(setAllStaff);
    }, [restaurantId]);

    const handleConfirmAssignment = async (waiterId: string | null) => {
        if (!selectedTableForAssign || !restaurantId) return;
        setIsAssigning(true);
        try {
            if (selectedTableForAssign.is_group) {
                await OrderService.assignWaiterToMergeGroup(selectedTableForAssign.id, waiterId, restaurantId);
            } else {
                await OrderService.assignWaiterToTable(selectedTableForAssign.id, waiterId, restaurantId);
            }
            setIsAssignModalOpen(false);
            setSelectedTableForAssign(null);
            loadData(true);
        } catch (error) {
            console.error('Failed to assign waiter:', error);
        } finally {
            setIsAssigning(false);
        }
    };

    const workloadColor = (category: string) => {
        switch (category?.toLowerCase()) {
            case 'low': return 'bg-emerald-500';
            case 'medium': return 'bg-amber-500';
            case 'high': return 'bg-rose-500';
            default: return 'bg-blue-500';
        }
    };


    return (
        <div className="flex flex-col h-full bg-white relative overflow-hidden">
            {isRefreshing && !loading && (
                <div className="absolute top-0 left-0 w-full h-1 z-50 overflow-hidden bg-transparent">
                    <motion.div 
                        initial={{ x: '-100%' }}
                        animate={{ x: '100%' }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                        className="w-1/2 h-full bg-blue-500/50 blur-sm"
                    />
                </div>
            )}

            <header className="bg-white sticky top-0 z-30 border-b border-divider shrink-0 shadow-sm">
                <div className="p-4 pb-2">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-50 text-blue-600 flex size-10 shrink-0 items-center justify-center rounded-xl">
                                <span className="material-icons-outlined text-2xl font-bold">grid_view</span>
                            </div>
                            <div className="flex flex-col">
                                <h2 className="text-charcoal text-xl font-black leading-tight tracking-tight">Tables</h2>
                                <p className="text-[10px] text-black font-bold uppercase tracking-widest">Waiter Dashboard</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setOffloadModalOpen(true)}
                                className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-black transition-all active:scale-95 flex items-center gap-2"
                                title="Offload Workload"
                            >
                                <LucideHandPlatter size={20} />
                                <span className="text-[10px] font-bold hidden sm:inline uppercase tracking-wider">Offload</span>
                            </button>
                            {waiterRecord && (
                                <div className="flex p-1 bg-gray-100 rounded-xl border border-gray-200">
                                    {[
                                        { id: 'available', icon: LucideCheck, color: 'text-emerald-600', activeBg: 'bg-emerald-500' },
                                        { id: 'busy', icon: LucideUser, color: 'text-orange-600', activeBg: 'bg-orange-500' },
                                        { id: 'break', icon: LucideCoffee, color: 'text-black', activeBg: 'bg-neutral-800' }
                                    ].map(status => (
                                        <button
                                            key={status.id}
                                            onClick={() => handleStatusToggle(status.id as any)}
                                            className={`p-1.5 rounded-lg transition-all ${waiterRecord.availability_status === status.id ? `${status.activeBg} text-white shadow-sm` : `text-black hover:text-black`}`}
                                        >
                                            <status.icon size={16} />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex-1 mr-4">
                            {waiterRecord && (
                                <div className="flex flex-col gap-1">
                                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-black">
                                        <span>Workload: {getWorkloadCategory(waiterRecord.active_workload)}</span>
                                        <span>{Math.min(100, (waiterRecord.active_workload || 0) * 10)}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(100, (waiterRecord.active_workload || 0) * 10)}%` }}
                                            className={`h-full ${workloadColor(getWorkloadCategory(waiterRecord.active_workload))}`}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => {
                                setIsMergeMode(!isMergeMode);
                                setSelectedForMerge([]);
                            }}
                            className={`flex cursor-pointer items-center justify-center rounded-xl h-9 px-4 transition-all duration-300 shrink-0 font-bold text-[10px] uppercase tracking-wider ${isMergeMode ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-50 text-black border'}`}
                        >
                            {isMergeMode ? 'Cancel' : 'Merge Tables'}
                        </button>
                    </div>
                </div>

                <div className="w-full overflow-x-auto no-scrollbar scroll-smooth">
                    <div className="flex flex-nowrap gap-[12px] px-4 pt-2 pb-2 ml-auto min-w-max">
                        <LayoutGroup>
                            {['eating', 'ready', 'cooking', 'empty'].map(tab => {
                                const isActive = activeTab === tab;
                                let activeColorClass = '';
                                switch (tab) {
                                    case 'eating': activeColorClass = 'bg-blue-600 shadow-lg shadow-blue-500/30'; break;
                                    case 'ready': activeColorClass = 'bg-emerald-500 shadow-lg shadow-emerald-500/30'; break;
                                    case 'cooking': activeColorClass = 'bg-orange-500 shadow-lg shadow-orange-500/30'; break;
                                    case 'empty': activeColorClass = 'bg-neutral-800 shadow-lg shadow-neutral-500/30'; break;
                                }
                                return (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab as any)}
                                        id={`filter-btn-${tab}`}
                                        className={`relative flex w-[95px] h-[45px] shrink-0 items-center justify-center rounded-xl transition-all duration-300 active:scale-95 group ${isActive ? 'text-white' : 'bg-white text-black border border-gray-100 shadow-sm hover:border-gray-300 hover:text-black hover:shadow-md'}`}
                                    >
                                        {isActive && (
                                            <motion.div
                                                layoutId="dashboardActiveTab"
                                                className={`absolute inset-0 rounded-xl z-0 ${activeColorClass}`}
                                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                            />
                                        )}
                                        <span className={`relative z-10 text-[11px] font-bold uppercase tracking-wider text-center px-2 ${isActive ? 'text-white drop-shadow-sm' : ''}`}>
                                            {tab}
                                        </span>
                                    </button>
                                );
                            })}
                        </LayoutGroup>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto bg-gray-50/50 p-4 pb-32">
                {(loading || restaurantLoading) ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <div className="size-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                        <p className="text-black font-bold text-xs uppercase tracking-widest">Loading Tables...</p>
                    </div>
                ) : filteredTables.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 min-h-[400px] content-start">
                        {filteredTables.map(table => (
                            <RenderTableCard 
                                key={table.id} 
                                table={table} 
                                activeTab={activeTab}
                                isMergeMode={isMergeMode}
                                isSelectedForMerge={selectedForMerge.includes(table.id)}
                                handleTableClick={handleTableClick}
                                handleDismissAlert={handleDismissAlert}
                                handleAssignClick={handleAssignClick}
                                pendingRequests={pendingRequests}
                                currentWaiterId={waiterRecord?.id}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-black">
                        <span className="material-icons-outlined text-4xl mb-2 opacity-50">table_restaurant</span>
                        <p className="text-sm">No tables found.</p>
                    </div>
                )}
            </main>
            
            <AnimatePresence>
                {/* Assignment Modal */}
                {isAssignModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-gray-100"
                        >
                            <div className="p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h3 className="text-xl font-black text-charcoal">Assign Waiter</h3>
                                        <p className="text-xs text-black font-bold uppercase tracking-wider">
                                            {selectedTableForAssign?.is_group ? selectedTableForAssign?.display_name : `Table ${selectedTableForAssign?.table_number}`}
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => setIsAssignModalOpen(false)}
                                        className="size-10 flex items-center justify-center rounded-full bg-gray-50 text-black hover:bg-gray-100"
                                    >
                                        <LucideCheck size={20} className="rotate-45" />
                                    </button>
                                </div>

                                <div className="space-y-3 max-h-[400px] overflow-y-auto no-scrollbar pb-4">
                                    {/* Self Assignment */}
                                    <button
                                        onClick={() => handleConfirmAssignment(waiterRecord?.id)}
                                        disabled={isAssigning}
                                        className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${selectedTableForAssign?.assigned_waiter_id === waiterRecord?.id ? 'border-blue-600 bg-blue-50' : 'border-gray-100 hover:border-blue-300'}`}
                                    >
                                        <div className="flex items-center gap-3 text-left">
                                            <div className="size-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-black">Me</div>
                                            <div>
                                                <p className="font-bold text-sm text-charcoal">Assign to Me</p>
                                                <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">My Load: {waiterRecord?.active_workload || 0}</p>
                                            </div>
                                        </div>
                                        {selectedTableForAssign?.assigned_waiter_id === waiterRecord?.id && <LucideCheckCircle2 className="text-blue-600" size={20} />}
                                    </button>

                                    <div className="py-2 flex items-center gap-3">
                                        <div className="h-px flex-1 bg-gray-100" />
                                        <span className="text-[10px] font-black text-black uppercase tracking-widest">Recommend Staff</span>
                                        <div className="h-px flex-1 bg-gray-100" />
                                    </div>

                                    {/* Other Staff */}
                                    {allStaff.filter(s => s.id !== waiterRecord?.id).map(staff => (
                                        <button
                                            key={staff.id}
                                            onClick={() => handleConfirmAssignment(staff.id)}
                                            disabled={isAssigning}
                                            className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${selectedTableForAssign?.assigned_waiter_id === staff.id ? 'border-blue-600 bg-blue-50' : 'border-gray-100 hover:border-blue-300'}`}
                                        >
                                            <div className="flex items-center gap-3 text-left">
                                                <div className="size-10 rounded-full bg-gray-100 flex items-center justify-center text-black font-black">
                                                    {staff.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-charcoal">{staff.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <div className={`h-1.5 w-12 rounded-full bg-gray-100 overflow-hidden`}>
                                                            <div 
                                                                className={`h-full ${workloadColor(getWorkloadCategory(staff.active_workload))}`} 
                                                                style={{ width: `${Math.min(100, (staff.active_workload || 0) * 10)}%` }} 
                                                            />
                                                        </div>
                                                        <span className="text-[9px] text-black font-bold uppercase tracking-wider">{getWorkloadCategory(staff.active_workload)}</span>
                                                    </div>

                                                </div>
                                            </div>
                                            {selectedTableForAssign?.assigned_waiter_id === staff.id && <LucideCheckCircle2 className="text-blue-600" size={20} />}
                                        </button>
                                    ))}

                                    {/* Unassign */}
                                    <button
                                        onClick={() => handleConfirmAssignment(null)}
                                        disabled={isAssigning}
                                        className="w-full p-4 rounded-2xl border-2 border-dashed border-gray-200 text-black font-bold text-sm hover:border-gray-300 hover:text-black transition-all mt-4"
                                    >
                                        Unassign Table
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {isMergeMode && selectedForMerge.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="absolute bottom-0 left-0 right-0 z-40 p-4 pb-4"
                    >
                        <div className="bg-neutral-900 text-white rounded-2xl p-4 shadow-2xl flex items-center justify-between w-full max-w-sm mx-auto border border-neutral-700">
                            <div>
                                <p className="text-[10px] font-bold text-black uppercase tracking-widest">{selectedForMerge.length} Selected</p>
                                <p className="text-sm font-black text-white">Merge Tables</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setIsMergeMode(false);
                                        setSelectedForMerge([]);
                                    }}
                                    className="px-4 py-3 bg-neutral-800 text-black font-bold rounded-xl text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmMerge}
                                    disabled={selectedForMerge.length < 2 || isMerging}
                                    className={`px-5 py-3 ${selectedForMerge.length < 2 ? 'bg-neutral-700 text-black' : 'bg-blue-600 text-white'} font-bold rounded-xl flex items-center gap-2 text-xs`}
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
                {/* Offload Modal */}
                {offloadModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-gray-100 relative"
                        >
                            <div className="p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h3 className="text-xl font-black text-charcoal">Offload Workload</h3>
                                        <p className="text-xs text-black font-bold uppercase tracking-wider">Transfer all assignments</p>
                                    </div>
                                    <button 
                                        onClick={() => setOffloadModalOpen(false)}
                                        className="size-10 flex items-center justify-center rounded-full bg-gray-50 text-black hover:bg-gray-100"
                                    >
                                        <LucideCheck size={20} className="rotate-45" />
                                    </button>
                                </div>

                                <div className="space-y-3 max-h-[400px] overflow-y-auto no-scrollbar pb-4">
                                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl mb-4">
                                        <div className="flex items-start gap-3">
                                            <LucideAlertCircle className="text-amber-600 shrink-0" size={18} />
                                            <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                                                This will transfer all your current table assignments and active orders to the selected staff member.
                                            </p>
                                        </div>
                                    </div>

                                    <p className="text-[10px] font-black text-black uppercase tracking-widest mb-2 px-1">Available Staff</p>
                                    
                                    {staffList.length > 0 ? (
                                        staffList.map(staff => (
                                            <button
                                                key={staff.id}
                                                onClick={() => handleOffloadWorkload(staff.id)}
                                                disabled={offloading}
                                                className="w-full p-4 rounded-2xl border-2 border-gray-100 hover:border-blue-300 flex items-center justify-between transition-all group"
                                            >
                                                <div className="flex items-center gap-3 text-left">
                                                    <div className="size-10 rounded-full bg-gray-100 flex items-center justify-center text-black font-black">
                                                        {staff.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm text-charcoal">{staff.name}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <div className={`h-1.5 w-12 rounded-full bg-gray-100 overflow-hidden`}>
                                                                <div 
                                                                    className={`h-full ${workloadColor(getWorkloadCategory(staff.active_workload))}`} 
                                                                    style={{ width: `${Math.min(100, (staff.active_workload || 0) * 10)}%` }} 
                                                                />
                                                            </div>
                                                            <span className="text-[9px] text-black font-bold uppercase tracking-wider">{getWorkloadCategory(staff.active_workload)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <LucideChevronRight className="text-black group-hover:text-blue-500 transition-colors" size={18} />
                                            </button>
                                        ))
                                    ) : (
                                        <div className="text-center py-8">
                                            <p className="text-black text-sm">No other staff available</p>
                                        </div>
                                    )}
                                </div>

                                {offloading && (
                                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center">
                                        <div className="size-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
                                        <p className="text-sm font-black text-charcoal uppercase tracking-widest">Transferring...</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
