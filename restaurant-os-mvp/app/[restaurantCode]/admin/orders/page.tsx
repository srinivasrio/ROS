'use client';

import { 
    Clock as LucideClock, 
    Filter as LucideFilter, 
    Search as LucideSearch, 
    Printer, 
    Download, 
    Truck as LucideTruck,
    CheckCircle2 as LucideCheckCircle2,
    Eye as LucideEye,
    ChefHat as LucideChefHat,
    ShoppingBag as LucideShoppingBag,
    Check as LucideCheck,
    X as LucideX,
    Loader2 as LucideLoader2,
    Lock as LucideLock
} from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useAdminUpgradeModal } from '@/context/AdminUpgradeModalContext';
import { OrderService, Order, OrderStatus } from '@/services/orders.service';
import OrderDetailsModal from '@/components/admin/OrderDetailsModal';
import TakeawayHandoverModal from '@/components/admin/TakeawayHandoverModal';
import SharedComboCard from '@/components/shared/SharedComboCard';
import { isComboItem, parseComboSubItems } from '@/lib/combo-utils';
import { formatCurrency, formatTimeElapsed, formatAddress } from '@/lib/utils';
import { useRestaurantId } from '@/hooks/useRestaurantId';
import { getCached, setCache } from '@/lib/data-cache';
import { requestManager } from '@/lib/cache/request-manager';
import { SyncIndicator } from '@/components/admin/SyncIndicator';

type StatusFilterType = 'all' | 'new' | 'cooking' | 'ready';
type OrderTypeFilter = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';

export default function LiveOrders() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const restaurantCode = params.restaurantCode as string;
    const { restaurantId, loading: restaurantLoading, branchId } = useRestaurantId();
    const activeResId = restaurantId || restaurantCode;
    const { hasFeature } = useEntitlements(restaurantCode);
    const { openUpgradeModal } = useAdminUpgradeModal();

    const cacheKey = `orders-${activeResId}${branchId ? `-${branchId}` : ''}`;
    const cached = getCached<Order[]>(cacheKey) || (restaurantId ? getCached<Order[]>(`orders-${restaurantId}`) : null);
    const [orders, setOrders] = useState<Order[]>(cached || []);
    const ordersRef = useRef<Order[]>(orders);
    ordersRef.current = orders;
    const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSync, setLastSync] = useState<Date | null>(null);
    const [statusFilter, setStatusFilter] = useState<StatusFilterType>('all');
    const [typeFilter, setTypeFilter] = useState<OrderTypeFilter>('DINE_IN');
    const [now, setNow] = useState(0);
    const [waiters, setWaiters] = useState<any[]>([]);
    const [deliveryBoys, setDeliveryBoys] = useState<any[]>([]);
    const [isReassigning, setIsReassigning] = useState<string | null>(null);
    const [isAssigningDelivery, setIsAssigningDelivery] = useState<string | null>(null);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [handoverModalOrder, setHandoverModalOrder] = useState<Order | null>(null);
    const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

    const handleInitiateTakeawayHandover = (order: Order) => {
        setSelectedOrder(null);
        setHandoverModalOrder(order);
    };

    const handleTakeawayPaymentSuccess = (updatedOrder: Order) => {
        setOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o));
        if (selectedOrder?.id === updatedOrder.id) {
            setSelectedOrder(prev => prev ? { ...prev, ...updatedOrder } : null);
        }
        if (handoverModalOrder?.id === updatedOrder.id) {
            setHandoverModalOrder(prev => prev ? { ...prev, ...updatedOrder } : null);
        }
    };

    const handleTakeawayHandoverComplete = (orderId: string) => {
        setOrders(prev => prev.filter(o => o.id !== orderId));
        if (selectedOrder?.id === orderId) {
            setSelectedOrder(null);
        }
        setHandoverModalOrder(null);
    };

    // Accept delivery order → move to 'preparing'
    const handleAcceptDelivery = async (orderId: string) => {
        setProcessingOrderId(orderId);
        try {
            await handleUpdateStatus(orderId, 'preparing');
        } finally {
            setProcessingOrderId(null);
        }
    };

    // Reject delivery order → move to 'cancelled'
    const handleRejectDelivery = async (orderId: string) => {
        if (!confirm('Are you sure you want to reject this delivery order? This action cannot be undone.')) return;
        setProcessingOrderId(orderId);
        try {
            await handleUpdateStatus(orderId, 'cancelled');
        } finally {
            setProcessingOrderId(null);
        }
    };

    const autoOpenedUrlOrderIdRef = useRef<string | null>(null);

    const handleCloseDetailsModal = useCallback(() => {
        setSelectedOrder(null);
        setHighlightedOrderId(null);
        // Clear orderId query parameter from the URL cleanly via router.replace
        if (typeof window !== 'undefined') {
            try {
                const currentUrl = new URL(window.location.href);
                if (currentUrl.searchParams.has('orderId')) {
                    currentUrl.searchParams.delete('orderId');
                    router.replace(currentUrl.pathname + (currentUrl.search ? currentUrl.search : ''), { scroll: false });
                }
            } catch (_) {}
        }
    }, [router]);

    // Initialize and react to channel & orderId from URL search params
    useEffect(() => {
        if (!searchParams) return;
        const urlChannel = searchParams.get('channel');
        const urlOrderId = searchParams.get('orderId');

        if (urlChannel?.toUpperCase() === 'TAKEAWAY') {
            setTypeFilter('TAKEAWAY');
        } else if (urlChannel?.toUpperCase() === 'DELIVERY') {
            if (hasFeature('delivery')) {
                setTypeFilter('DELIVERY');
            } else {
                setTypeFilter('DINE_IN');
            }
        } else if (urlChannel?.toUpperCase() === 'DINE_IN') {
            setTypeFilter('DINE_IN');
        }

        if (!urlOrderId) {
            autoOpenedUrlOrderIdRef.current = null;
        } else if (urlOrderId && autoOpenedUrlOrderIdRef.current !== urlOrderId) {
            autoOpenedUrlOrderIdRef.current = urlOrderId;
            setHighlightedOrderId(urlOrderId);
            // Check if already in orders list
            const found = ordersRef.current.find(o => o.id === urlOrderId);
            if (found) {
                setSelectedOrder(found);
            } else {
                const targetId = restaurantId || restaurantCode;
                if (targetId) {
                    OrderService.getOrderDetails(urlOrderId, targetId).then(details => {
                        if (details) {
                            setSelectedOrder(details as any);
                        }
                    }).catch(console.error);
                }
            }

            // Scroll highlighted order into view after DOM paint
            setTimeout(() => {
                const el = document.getElementById(`order-row-${urlOrderId}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);
        }
    }, [searchParams, restaurantId, restaurantCode]);

    // Keep selectedOrder synced if orders array loads after query param arrival (only once on load)
    useEffect(() => {
        if (highlightedOrderId && !selectedOrder && orders.length > 0 && autoOpenedUrlOrderIdRef.current !== highlightedOrderId) {
            const found = orders.find(o => o.id === highlightedOrderId);
            if (found) {
                autoOpenedUrlOrderIdRef.current = highlightedOrderId;
                setSelectedOrder(found);
            }
        }
    }, [orders, highlightedOrderId, selectedOrder]);

    useEffect(() => {
        setNow(Date.now());
        const interval = setInterval(() => setNow(Date.now()), 10000);
        return () => clearInterval(interval);
    }, []);

    const loadData = useCallback(async () => {
        const targetId = restaurantId || restaurantCode;
        if (!targetId) return;
        const key = `orders-${targetId}${branchId ? `-${branchId}` : ''}`;

        const currentCached = getCached<Order[]>(key);
        if (currentCached && ordersRef.current.length === 0) {
            setOrders(currentCached);
        }

        setIsSyncing(true);
        try {
            const activeOrders = await requestManager.coalesce(key, () => OrderService.fetchActiveOrders(restaurantId || targetId, undefined, branchId || undefined), 1);
            if (activeOrders) {
                const filtered = activeOrders.filter(o => o.status !== 'served' && o.status !== 'cancelled');
                setOrders(filtered);
                setCache(key, filtered, { ttlMs: 60 * 1000 });
                setLastSync(new Date());
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsSyncing(false);
        }
    }, [restaurantId, restaurantCode, branchId]);

    const loadWaiters = useCallback(async () => {
        const targetId = restaurantId || restaurantCode;
        if (!targetId) return;
        try {
            const staff = await OrderService.fetchStaff(restaurantId || targetId, branchId || undefined);
            setWaiters(staff.filter((s: any) => s.role === 'waiter'));
        } catch (err) {
            console.error('Failed to load waiters:', err);
        }
    }, [restaurantId, restaurantCode, branchId]);

    const loadDeliveryBoys = useCallback(async () => {
        const targetId = restaurantId || restaurantCode;
        if (!targetId || !hasFeature('delivery')) {
            setDeliveryBoys([]);
            return;
        }
        try {
            const res = await fetch(`/api/delivery/boys?restaurantId=${targetId}${branchId ? `&branchId=${branchId}` : ''}`);
            if (res.ok) {
                const d = await res.json();
                setDeliveryBoys(d.deliveryBoys || []);
            }
        } catch (err) {
            console.error('Failed to load delivery boys:', err);
        }
    }, [restaurantId, restaurantCode, branchId]);

    const handleAssignDeliveryBoy = async (orderId: string, deliveryBoyId: string) => {
        const targetId = restaurantId || restaurantCode;
        if (!targetId) return;
        setIsAssigningDelivery(orderId);
        try {
            const data = await OrderService.assignDeliveryBoy(orderId, targetId, deliveryBoyId);
            const assignedBoy = deliveryBoys.find(b => b.id === deliveryBoyId);
            setOrders(prev => prev.map(o => {
                if (o.id === orderId) {
                    const updated: Order = {
                        ...o,
                        status: o.status === 'placed' ? ('preparing' as OrderStatus) : o.status,
                        delivery_assignment: deliveryBoyId ? {
                            id: data.assignment?.id || o.delivery_assignment?.id || '',
                            status: data.assignment?.status || 'ASSIGNED',
                            delivery_boy_id: deliveryBoyId,
                            delivery_boy: assignedBoy ? {
                                id: assignedBoy.id,
                                name: assignedBoy.name,
                                mobile: assignedBoy.mobile,
                                vehicle_type: assignedBoy.vehicle_type,
                                vehicle_number: assignedBoy.vehicle_number,
                                avatar_url: assignedBoy.avatar_url,
                            } : undefined,
                        } : undefined,
                    };
                    if (selectedOrder?.id === orderId) {
                        setSelectedOrder(updated);
                    }
                    return updated;
                }
                return o;
            }));
            loadData();
        } catch (err: any) {
            console.error('Failed to assign delivery boy:', err);
            alert(err.message || 'Failed to assign delivery boy');
        } finally {
            setIsAssigningDelivery(null);
        }
    };

    const loadDataRef = useRef(loadData);
    const loadWaitersRef = useRef(loadWaiters);
    const loadDeliveryBoysRef = useRef(loadDeliveryBoys);

    useEffect(() => {
        loadDataRef.current = loadData;
        loadWaitersRef.current = loadWaiters;
        loadDeliveryBoysRef.current = loadDeliveryBoys;
    }, [loadData, loadWaiters, loadDeliveryBoys]);

    useEffect(() => {
        let active = true;
        let reloadTimer: NodeJS.Timeout | null = null;
        const targetId = restaurantId || restaurantCode;

        if (!restaurantLoading && targetId) {
            loadDataRef.current();
            loadWaitersRef.current();
            loadDeliveryBoysRef.current();

            const debouncedLoadData = () => {
                if (reloadTimer) clearTimeout(reloadTimer);
                reloadTimer = setTimeout(() => {
                    if (active) loadDataRef.current();
                }, 400);
            };

            const subscription = OrderService.subscribeToOrders(restaurantId || targetId, () => {
                debouncedLoadData();
            });

            return () => {
                active = false;
                if (reloadTimer) clearTimeout(reloadTimer);
                subscription.unsubscribe();
            };
        }
        return () => { active = false; };
    }, [restaurantId, restaurantCode, restaurantLoading]);

    const handleReassign = async (orderId: string, waiterId: string) => {
        if (!restaurantId) return;
        const targetWaiter = waiters.find(w => w.id === waiterId);
        const isAccountActive = (targetWaiter?.status || '').toLowerCase() === 'active';
        const isOnline = targetWaiter?.is_online === true &&
            !['offline', 'break'].includes((targetWaiter?.availability_status || '').toLowerCase());
        const canAssign = isAccountActive && isOnline;

        if (!canAssign) {
            alert(`Cannot reassign order to ${targetWaiter?.name || 'this waiter'}: Waiter must have an Active account AND be Online.`);
            return;
        }

        setIsReassigning(orderId);
        try {
            await OrderService.reassignWaiter(orderId, restaurantId, waiterId);
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, waiter_id: waiterId } : o));
        } catch (err: any) {
            console.error('Failed to reassign:', err);
            alert(err.message || 'Failed to reassign order');
        } finally {
            setIsReassigning(null);
        }
    };

    const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
        const targetId = restaurantId || restaurantCode;
        if (!targetId) return;
        try {
            await OrderService.updateOrderStatus(orderId, targetId, newStatus);
            if (newStatus === 'served' || newStatus === 'cancelled') {
                setOrders(prev => prev.filter(o => o.id !== orderId));
            } else {
                setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
            }
        } catch (err: any) {
            console.error('Failed to update status:', err);
            alert(err.message || 'Failed to update order status');
        }
    };

    const getTimeElapsed = (dateStr: string) => {
        return formatTimeElapsed(dateStr);
    };

    const ceil2 = (num: number) => {
        const n = Number(num || 0);
        const clean = Math.round(n * 1e8) / 1e8;
        return Math.ceil(clean * 100) / 100;
    };
    const round2 = ceil2;

    const calculateOrderTotal = (order: Order) => {
        if (order.total_amount != null && Number(order.total_amount) > 0) {
            return round2(Number(order.total_amount));
        }
        const itemsTotal = (order.items || []).reduce(
            (sum, it) => sum + ((Number(it.price) || Number((it as any).price_at_time) || 0) * (Number(it.quantity) || 1)), 
            0
        );
        const tax = Number(order.gst_amount || (Number(order.cgst_amount || 0) + Number(order.sgst_amount || 0)) || 0);
        const delivery = Number((order as any).delivery_fee || 0);
        const discount = Number(order.discount_amount || 0);
        return round2(Math.max(0, itemsTotal + tax + delivery - discount));
    };

    // Channel Counts
    const countTakeaway = orders.filter(o => o.order_type === 'TAKEAWAY').length;
    const countDelivery = orders.filter(o => o.order_type === 'DELIVERY').length;
    const countDineIn = orders.filter(o => !o.order_type || o.order_type === 'DINE_IN').length;

    // Filter by selected channel
    const currentChannelOrders = orders.filter(o => {
        if (typeFilter === 'TAKEAWAY') return o.order_type === 'TAKEAWAY';
        if (typeFilter === 'DELIVERY') return o.order_type === 'DELIVERY';
        return !o.order_type || o.order_type === 'DINE_IN';
    });

    // Counts for status buttons in current channel
    const countNew = currentChannelOrders.filter(o => o.status === 'placed' || o.status === 'queued').length;
    const countCooking = currentChannelOrders.filter(o => o.status === 'preparing').length;
    const countReady = currentChannelOrders.filter(o => o.status === 'ready' || (o.order_type === 'TAKEAWAY' && o.status === 'paid' && !o.is_completed)).length;

    // Filtered data applying status filter
    const getFilteredData = () => {
        let result = currentChannelOrders;
        if (statusFilter === 'new') {
            result = result.filter(o => o.status === 'placed' || o.status === 'queued');
        } else if (statusFilter === 'cooking') {
            result = result.filter(o => o.status === 'preparing');
        } else if (statusFilter === 'ready') {
            result = result.filter(o => o.status === 'ready' || (o.order_type === 'TAKEAWAY' && o.status === 'paid' && !o.is_completed));
        }
        return result;
    };

    const displayData = [...getFilteredData()].sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return timeB - timeA;
    });

    return (
        <div className="p-8 flex flex-col h-screen space-y-6 overflow-hidden">
            {/* Header: Title on Left, Channel Tabs + Sync on Top Right */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                <div>
                    <h2 className="text-2xl font-black text-black tracking-tight">Live Orders</h2>
                </div>

                {/* 1. Redesigned Dine In, Takeaway, Delivery in Top Right Corner */}
                <div className="flex items-center gap-3 self-end sm:self-auto">
                    <div className="flex p-1 bg-neutral-100 rounded-2xl border border-neutral-200/80 shadow-xs">
                        <button
                            onClick={() => setTypeFilter('DINE_IN')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                typeFilter === 'DINE_IN'
                                    ? 'bg-white text-neutral-900 shadow-sm'
                                    : 'text-neutral-500 hover:text-neutral-800'
                            }`}
                        >
                            <span>🍽️ Dine-In</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                typeFilter === 'DINE_IN' ? 'bg-orange-100 text-orange-600' : 'bg-neutral-200 text-neutral-600'
                            }`}>
                                {countDineIn}
                            </span>
                        </button>

                        <button
                            onClick={() => setTypeFilter('TAKEAWAY')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                typeFilter === 'TAKEAWAY'
                                    ? 'bg-white text-neutral-900 shadow-sm'
                                    : 'text-neutral-500 hover:text-neutral-800'
                            }`}
                        >
                            <span>🛍️ Takeaway</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                typeFilter === 'TAKEAWAY' ? 'bg-amber-100 text-amber-700' : 'bg-neutral-200 text-neutral-600'
                            }`}>
                                {countTakeaway}
                            </span>
                        </button>

                        <button
                            onClick={() => {
                                if (!hasFeature('delivery')) {
                                    openUpgradeModal('delivery');
                                    return;
                                }
                                setTypeFilter('DELIVERY');
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                typeFilter === 'DELIVERY'
                                    ? 'bg-white text-neutral-900 shadow-sm'
                                    : 'text-neutral-500 hover:text-neutral-800'
                            }`}
                        >
                            <span>🛵 Delivery</span>
                            {!hasFeature('delivery') && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/25 text-[9px] font-black uppercase">
                                    <LucideLock size={9} />
                                </span>
                            )}
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                typeFilter === 'DELIVERY' ? 'bg-blue-100 text-blue-700' : 'bg-neutral-200 text-neutral-600'
                            }`}>
                                {hasFeature('delivery') ? countDelivery : 0}
                            </span>
                        </button>
                    </div>

                    <SyncIndicator isSyncing={isSyncing} lastSync={lastSync} onRefresh={() => loadData()} />
                </div>
            </div>

            {/* Main Content Card */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
                {/* Sub-Header Toolbar: Status Filter Buttons (without All Status) + Manage Delivery button */}
                <div className="p-4 sm:p-5 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3 bg-white sticky top-0 z-10 shrink-0">
                    {/* Status Filter Buttons (All Status removed) */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setStatusFilter(prev => prev === 'new' ? 'all' : 'new')}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                                statusFilter === 'new'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                            }`}
                        >
                            <span>New</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'new' ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-600'}`}>
                                {countNew}
                            </span>
                        </button>

                        <button
                            onClick={() => setStatusFilter(prev => prev === 'cooking' ? 'all' : 'cooking')}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                                statusFilter === 'cooking'
                                    ? 'bg-amber-600 text-white shadow-sm'
                                    : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                            }`}
                        >
                            <span>Cooking</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'cooking' ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-600'}`}>
                                {countCooking}
                            </span>
                        </button>

                        <button
                            onClick={() => setStatusFilter(prev => prev === 'ready' ? 'all' : 'ready')}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                                statusFilter === 'ready'
                                    ? 'bg-purple-600 text-white shadow-sm'
                                    : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                            }`}
                        >
                            <span>Ready</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'ready' ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-600'}`}>
                                {countReady}
                            </span>
                        </button>
                    </div>

                    {/* 6. Manage Delivery Button inside Delivery section */}
                    {typeFilter === 'DELIVERY' && (
                        <button
                            type="button"
                            onClick={() => {
                                if (!hasFeature('delivery')) {
                                    openUpgradeModal('delivery');
                                } else {
                                    router.push(`/${restaurantCode}/admin/delivery`);
                                }
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-neutral-900 hover:bg-neutral-800 text-white shadow-sm transition-all duration-200 cursor-pointer ml-auto"
                        >
                            <LucideTruck size={14} className="text-orange-400" />
                            <span>Manage Delivery</span>
                        </button>
                    )}
                </div>

                {/* Orders Table Container */}
                <div className="flex-1 overflow-x-auto overflow-y-auto">
                    {typeFilter === 'TAKEAWAY' ? (
                        /* ════════════════════════════════════════════════════════════ */
                        /* 5. PERFECTLY ARRANGED TAKEAWAY TABLE (11 COLUMNS)            */
                        /* Flow: Order ID | Customer | Items | Order Time | Elapsed Time */
                        /*       | Pickup Time | Status | Payment | Staff | Total | Actions */
                        /* ════════════════════════════════════════════════════════════ */
                        <table className="w-full text-left text-sm text-black min-w-[1250px] border-collapse">
                            <thead className="bg-neutral-50 text-neutral-600 font-bold text-xs uppercase tracking-wider border-b border-neutral-200 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3.5 whitespace-nowrap">Order ID</th>
                                    <th className="px-4 py-3.5 whitespace-nowrap">Customer</th>
                                    <th className="px-4 py-3.5 whitespace-nowrap">Items</th>
                                    <th className="px-4 py-3.5 whitespace-nowrap">Order Time</th>
                                    <th className="px-4 py-3.5 whitespace-nowrap">Elapsed Time</th>
                                    <th className="px-4 py-3.5 whitespace-nowrap">Pickup Time</th>
                                    <th className="px-4 py-3.5 whitespace-nowrap">Status</th>
                                    <th className="px-4 py-3.5 whitespace-nowrap">Payment</th>
                                    <th className="px-4 py-3.5 whitespace-nowrap">Staff</th>
                                    <th className="px-4 py-3.5 whitespace-nowrap text-right">Total</th>
                                    <th className="px-4 py-3.5 whitespace-nowrap text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200">
                                {displayData.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="px-6 py-16 text-center text-neutral-400">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <LucideShoppingBag size={32} className="text-neutral-300" />
                                                <p className="font-semibold text-neutral-600">No takeaway orders found</p>
                                                <p className="text-xs text-neutral-400">Orders placed for takeaway pickup will appear here live</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    displayData.map((item) => (
                                        <tr 
                                            key={item.id} 
                                            id={`order-row-${item.id}`}
                                            className={`transition-all ${
                                                item.id === highlightedOrderId
                                                    ? 'bg-amber-100/70 border-l-4 border-amber-500 shadow-sm ring-2 ring-amber-400/40'
                                                    : 'hover:bg-neutral-50/80'
                                            }`}
                                        >
                                            {/* 1. Order ID */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="font-mono font-bold text-sm text-neutral-900">
                                                        #{item.order_number || item.id.slice(0, 8)}
                                                    </span>
                                                    <span className="text-[10px] text-neutral-400 font-mono">
                                                        ID: {item.id.slice(0, 6)}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* 2. Customer */}
                                            <td className="px-4 py-3 min-w-[160px]">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-bold text-xs text-neutral-900 truncate">
                                                        {item.customer_name || 'Takeaway Customer'}
                                                    </span>
                                                    {(item.customer_phone || item.delivery_phone) ? (
                                                        <a
                                                            href={`tel:${item.customer_phone || item.delivery_phone}`}
                                                            className="text-[11px] font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1 w-fit"
                                                        >
                                                            <span>📞 {item.customer_phone || item.delivery_phone}</span>
                                                        </a>
                                                    ) : (
                                                        <span className="text-[11px] text-neutral-400">No phone</span>
                                                    )}
                                                    {item.delivery_notes && (
                                                        <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded mt-0.5 truncate max-w-[180px]" title={item.delivery_notes}>
                                                            📝 {item.delivery_notes}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* 3. Items */}
                                            <td className="px-4 py-3 min-w-[200px] max-w-[280px]">
                                                <div className="flex flex-col gap-1 max-h-24 overflow-y-auto pr-1">
                                                    {item.items?.map((subItem: any, idx: number) => {
                                                        const isCombo = isComboItem(subItem);
                                                        const subItems = isCombo ? parseComboSubItems(subItem) : [];

                                                        if (isCombo && subItems.length > 0) {
                                                            return (
                                                                <div key={idx} className="max-w-[260px]">
                                                                    <SharedComboCard
                                                                        name={subItem.name || subItem.item_name}
                                                                        image_url={subItem.combo_image || subItem.image_url}
                                                                        price={subItem.price}
                                                                        quantity={subItem.quantity}
                                                                        items={subItems}
                                                                        notes={subItem.notes}
                                                                        readOnly={true}
                                                                    />
                                                                </div>
                                                            );
                                                        }
                                                        return (
                                                            <div key={idx} className="flex items-center justify-between text-xs bg-neutral-50 px-2 py-1 rounded border border-neutral-100">
                                                                <span className="font-medium text-neutral-800 truncate mr-2">
                                                                    <span className="font-bold text-neutral-900 mr-1">{subItem.quantity}x</span>
                                                                    {subItem.name || subItem.item_name}
                                                                </span>
                                                                <span className="text-neutral-500 font-semibold text-[11px] shrink-0">
                                                                    {formatCurrency((Number(subItem.price) || Number((subItem as any).price_at_time) || 0) * (subItem.quantity || 1))}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </td>

                                            {/* 4. Order Time */}
                                            <td className="px-4 py-3 whitespace-nowrap text-xs text-neutral-600 font-medium">
                                                {item.created_at ? new Date(item.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                            </td>

                                            {/* 5. Elapsed Time */}
                                            <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-neutral-800">
                                                <div className="flex items-center gap-1.5">
                                                    <LucideClock size={13} className="text-neutral-400 shrink-0" />
                                                    <span>{getTimeElapsed(item.created_at)}</span>
                                                </div>
                                            </td>

                                            {/* 6. Pickup Time */}
                                            <td className="px-4 py-3 whitespace-nowrap text-xs">
                                                {item.status === 'served' ? (
                                                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                                                        <LucideCheckCircle2 size={13} /> Collected
                                                    </span>
                                                ) : item.status === 'ready' ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 animate-pulse border border-emerald-200">
                                                        🟢 Ready Now
                                                    </span>
                                                ) : item.status === 'preparing' ? (
                                                    <span className="text-amber-800 font-semibold text-xs">
                                                        ~ {item.created_at ? new Date(new Date(item.created_at).getTime() + 20 * 60000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '15m'}
                                                    </span>
                                                ) : (
                                                    <span className="text-neutral-500 font-semibold text-xs">
                                                        ~ 20-25 min
                                                    </span>
                                                )}
                                            </td>

                                            {/* 7. Status */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <StatusBadge status={item.status} />
                                            </td>

                                            {/* 8. Payment */}
                                            <td className="px-4 py-3 whitespace-nowrap text-xs">
                                                {(item.paid_by || (item.amount_paid != null && item.amount_paid >= item.total_amount)) ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        ✓ Paid {item.paid_by ? `(${item.paid_by})` : ''}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                        Pay on Pickup
                                                    </span>
                                                )}
                                            </td>

                                            {/* 9. Staff */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
                                                    🛍️ Self Pickup
                                                </span>
                                            </td>

                                            {/* 10. Total */}
                                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                                <div className="font-black text-neutral-900 text-sm">
                                                    {formatCurrency(calculateOrderTotal(item))}
                                                </div>
                                                {item.discount_amount != null && Number(item.discount_amount) > 0 && (
                                                    <span className="text-[10px] text-emerald-600 block font-semibold">
                                                        (-{formatCurrency(item.discount_amount)} off)
                                                    </span>
                                                )}
                                            </td>

                                            {/* 11. Actions */}
                                            <td className="px-4 py-3 whitespace-nowrap text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    {(item.status === 'placed' || item.status === 'queued') && (
                                                        <button
                                                            onClick={() => handleUpdateStatus(item.id, 'preparing')}
                                                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-xs transition-all cursor-pointer flex items-center gap-1"
                                                            title="Send to kitchen for cooking"
                                                        >
                                                            <LucideChefHat size={12} />
                                                            <span>Accept</span>
                                                        </button>
                                                    )}
                                                    {item.status === 'preparing' && (
                                                        <button
                                                            onClick={() => handleUpdateStatus(item.id, 'ready')}
                                                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer flex items-center gap-1"
                                                            title="Mark ready for customer pickup"
                                                        >
                                                            <LucideCheckCircle2 size={12} />
                                                            <span>Ready</span>
                                                        </button>
                                                    )}
                                                    {(item.status === 'ready' || (item.order_type === 'TAKEAWAY' && item.status === 'paid' && !item.is_completed)) && (
                                                        <button
                                                            onClick={() => setHandoverModalOrder(item)}
                                                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer flex items-center gap-1"
                                                            title="Confirm payment & hand over order"
                                                        >
                                                            <LucideShoppingBag size={12} />
                                                            <span>Hand Over</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => setSelectedOrder(item)}
                                                        className="text-blue-600 hover:text-blue-800 text-xs font-semibold border border-blue-200 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer flex items-center gap-1"
                                                    >
                                                        <LucideEye size={12} />
                                                        <span>Details</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    ) : (
                        /* ════════════════════════════════════════════════════════════ */
                        /* DINE-IN AND DELIVERY TABLE                                   */
                        /* ════════════════════════════════════════════════════════════ */
                        <table className="w-full text-left text-sm text-black min-w-[950px] border-collapse">
                            <thead className="bg-neutral-50 text-neutral-600 font-bold text-xs uppercase tracking-wider border-b border-neutral-200 sticky top-0 z-10">
                                <tr>
                                    <th className="px-5 py-3.5 whitespace-nowrap">Order ID</th>
                                    <th className="px-5 py-3.5 whitespace-nowrap">
                                        {typeFilter === 'DELIVERY' ? 'Customer & Address' : 'Table'}
                                    </th>
                                    <th className="px-5 py-3.5 w-1/3">Items</th>
                                    <th className="px-5 py-3.5 whitespace-nowrap">Order Time</th>
                                    <th className="px-5 py-3.5 whitespace-nowrap">Elapsed Time</th>
                                    <th className="px-5 py-3.5 whitespace-nowrap">Status</th>
                                    <th className="px-5 py-3.5 whitespace-nowrap">
                                        {typeFilter === 'DELIVERY' ? 'Delivery Partner' : 'Waiter'}
                                    </th>
                                    <th className="px-5 py-3.5 whitespace-nowrap text-right">Total</th>
                                    <th className="px-5 py-3.5 whitespace-nowrap text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200">
                                {displayData.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-16 text-center text-neutral-400">
                                            No {typeFilter === 'DELIVERY' ? 'delivery' : 'dine-in'} orders.
                                        </td>
                                    </tr>
                                ) : (
                                    displayData.map((item) => (
                                        <tr 
                                            key={item.id} 
                                            id={`order-row-${item.id}`}
                                            className={`transition-all ${
                                                item.id === highlightedOrderId
                                                    ? (typeFilter === 'DELIVERY' 
                                                        ? 'bg-blue-100/70 border-l-4 border-blue-500 shadow-sm ring-2 ring-blue-400/40' 
                                                        : 'bg-orange-100/70 border-l-4 border-orange-500 shadow-sm ring-2 ring-orange-400/40')
                                                    : 'hover:bg-neutral-50/80'
                                            }`}
                                        >
                                            {/* Order ID */}
                                            <td className="px-5 py-3 whitespace-nowrap font-medium text-black">
                                                <div className="flex flex-col">
                                                    <span className="font-bold">#{item.order_number || item.id.slice(0, 8)}</span>
                                                    <span className="text-[10px] text-neutral-400 font-mono">ID: {item.id.slice(0, 6)}</span>
                                                </div>
                                            </td>

                                            {/* Table or Customer */}
                                            <td className="px-5 py-3">
                                                {typeFilter === 'DELIVERY' ? (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-bold text-xs text-neutral-900">
                                                            {item.customer_name || 'Delivery Customer'}
                                                        </span>
                                                        {item.delivery_phone && (
                                                            <a href={`tel:${item.delivery_phone}`} className="text-[11px] text-blue-600 font-semibold hover:underline">
                                                                📞 {item.delivery_phone}
                                                            </a>
                                                        )}
                                                        {item.delivery_address && (
                                                            <span className="text-[11px] text-neutral-500 truncate max-w-[200px]" title={formatAddress(item.delivery_address)}>
                                                                📍 {formatAddress(item.delivery_address)}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="font-bold text-neutral-900">
                                                        Table {item.table_number || item.table_id || '—'}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Items */}
                                            <td className="px-5 py-3">
                                                <div className="flex flex-col gap-1 max-h-24 overflow-y-auto pr-1">
                                                    {item.items?.map((subItem: any, idx: number) => {
                                                        const isCombo = isComboItem(subItem);
                                                        const subItems = isCombo ? parseComboSubItems(subItem) : [];

                                                        if (isCombo && subItems.length > 0) {
                                                            return (
                                                                <div key={idx} className="max-w-[280px]">
                                                                    <SharedComboCard
                                                                        name={subItem.name || subItem.item_name}
                                                                        image_url={subItem.combo_image || subItem.image_url}
                                                                        price={subItem.price}
                                                                        quantity={subItem.quantity}
                                                                        items={subItems}
                                                                        notes={subItem.notes}
                                                                        readOnly={true}
                                                                    />
                                                                </div>
                                                            );
                                                        }
                                                        return (
                                                            <div key={idx} className="flex items-center justify-between text-xs bg-neutral-50 px-2 py-1 rounded border border-neutral-100 max-w-[320px]">
                                                                <span className="font-medium text-neutral-800 truncate mr-2">
                                                                    <span className="font-bold text-neutral-900 mr-1">{subItem.quantity}x</span>
                                                                    {subItem.name || subItem.item_name}
                                                                </span>
                                                                <span className="text-neutral-500 font-semibold text-[11px] shrink-0">
                                                                    {formatCurrency((Number(subItem.price) || Number((subItem as any).price_at_time) || 0) * (subItem.quantity || 1))}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </td>

                                            {/* Order Time */}
                                            <td className="px-5 py-3 whitespace-nowrap text-xs text-neutral-600 font-medium">
                                                {item.created_at ? new Date(item.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                            </td>

                                            {/* Elapsed Time */}
                                            <td className="px-5 py-3 whitespace-nowrap text-xs font-semibold text-neutral-800">
                                                <div className="flex items-center gap-1.5">
                                                    <LucideClock size={14} className="text-neutral-400" />
                                                    <span>{getTimeElapsed(item.created_at)}</span>
                                                </div>
                                            </td>

                                            {/* Status */}
                                            <td className="px-5 py-3 whitespace-nowrap">
                                                <StatusBadge status={item.status} />
                                            </td>

                                            {/* Staff / Fulfillment */}
                                            <td className="px-5 py-3 whitespace-nowrap">
                                                {item.order_type === 'DELIVERY' || typeFilter === 'DELIVERY' ? (
                                                    (() => {
                                                        const assignmentStatus = item.delivery_assignment?.status;
                                                        const isPastPickup = ['PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(assignmentStatus || '');
                                                        if (isPastPickup) {
                                                            return (
                                                                <span className="text-xs text-purple-800 bg-purple-50 border border-purple-200 font-bold px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5">
                                                                    <span>🛵</span>
                                                                    <span>{item.delivery_assignment?.delivery_boy?.name || 'Delivery Partner'}</span>
                                                                    <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-purple-200/60 text-purple-900">
                                                                        {assignmentStatus === 'PICKED_UP' ? 'Picked Up' : assignmentStatus === 'OUT_FOR_DELIVERY' ? 'On the Way' : 'Delivered'}
                                                                    </span>
                                                                </span>
                                                            );
                                                        }

                                                        const isAssigned = Boolean(item.delivery_assignment?.delivery_boy_id || item.delivery_assignment?.delivery_boy);

                                                        return (
                                                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                                                <select
                                                                    disabled={isAssigningDelivery === item.id}
                                                                    value={item.delivery_assignment?.delivery_boy_id || item.delivery_assignment?.delivery_boy?.id || ''}
                                                                    onChange={(e) => handleAssignDeliveryBoy(item.id, e.target.value)}
                                                                    className={`text-xs border rounded-lg px-2.5 py-1.5 font-medium transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
                                                                        isAssigned
                                                                            ? 'bg-blue-50 border-blue-300 text-blue-900 font-semibold shadow-xs'
                                                                            : 'bg-amber-50/90 border-amber-300 text-amber-900 font-bold hover:bg-amber-100/80 shadow-xs'
                                                                    }`}
                                                                >
                                                                    <option value="">
                                                                        {deliveryBoys.length === 0 ? 'No Delivery Boys Registered' : '⚡ Assign Delivery Boy...'}
                                                                    </option>
                                                                    {deliveryBoys.map(b => {
                                                                        const isAvailable = b.status === 'active';
                                                                        const statusLabel = b.status === 'active' ? 'Available' : b.status === 'on_delivery' ? 'On Delivery' : 'Offline';
                                                                        const vehicle = b.vehicle_number ? `(${b.vehicle_number})` : b.vehicle_type ? `(${b.vehicle_type})` : '';

                                                                        return (
                                                                            <option 
                                                                                key={b.id} 
                                                                                value={b.id} 
                                                                                disabled={b.status === 'inactive'}
                                                                                className={b.status === 'inactive' ? 'text-neutral-400 bg-neutral-100' : 'text-neutral-900 font-semibold'}
                                                                            >
                                                                                {b.name} {vehicle} {isAvailable ? `🟢 [${statusLabel}]` : `🔴 [${statusLabel}]`}
                                                                            </option>
                                                                        );
                                                                    })}
                                                                </select>
                                                                {isAssigningDelivery === item.id && (
                                                                    <LucideLoader2 size={13} className="animate-spin text-blue-600 shrink-0" />
                                                                )}
                                                            </div>
                                                        );
                                                    })()
                                                ) : (
                                                    <select
                                                        disabled={isReassigning === item.id}
                                                        value={item.waiter_id || ''}
                                                        onChange={(e) => handleReassign(item.id, e.target.value)}
                                                        className="text-xs bg-white border border-neutral-200 rounded px-2 py-1 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                                                    >
                                                        <option value="" disabled>Auto-Assigning...</option>
                                                        {waiters.map(w => {
                                                            const isAccountActive = (w.status || '').toLowerCase() === 'active';
                                                            const isOnline = w.is_online === true &&
                                                                !['offline', 'break'].includes((w.availability_status || '').toLowerCase());
                                                            const canAssign = isAccountActive && isOnline;

                                                            let statusLabel = '';
                                                            if (!isAccountActive) {
                                                                statusLabel = 'Account: Inactive';
                                                            } else if (!isOnline) {
                                                                statusLabel = 'Account: Active | Offline';
                                                            } else {
                                                                statusLabel = `Account: Active | Online • ${w.active_workload || 0} active`;
                                                            }

                                                            return (
                                                                <option 
                                                                    key={w.id} 
                                                                    value={w.id} 
                                                                    disabled={!canAssign}
                                                                    className={!canAssign ? 'text-neutral-400 bg-neutral-100' : 'text-neutral-900 font-semibold'}
                                                                >
                                                                    {w.name} {canAssign ? `🟢 [${statusLabel}]` : `🔴 [${statusLabel}]`}
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                )}
                                            </td>

                                            {/* Total */}
                                            <td className="px-5 py-3 whitespace-nowrap text-right">
                                                <div className="font-black text-black text-sm">
                                                    {formatCurrency(calculateOrderTotal(item))}
                                                </div>
                                                {item.order_type === 'DELIVERY' && (item as any).delivery_fee != null && Number((item as any).delivery_fee) > 0 && (
                                                    <span className="text-[10px] text-blue-600 block font-semibold">
                                                        incl. {formatCurrency(Number((item as any).delivery_fee))} delivery
                                                    </span>
                                                )}
                                                {item.discount_amount != null && Number(item.discount_amount) > 0 && (
                                                    <span className="text-[10px] text-emerald-600 block font-semibold">
                                                        (-{formatCurrency(item.discount_amount)} off)
                                                    </span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-5 py-3 whitespace-nowrap text-center">
                                                {typeFilter === 'DELIVERY' && (item.status === 'placed' || item.status === 'queued') ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            disabled={processingOrderId === item.id}
                                                            onClick={(e) => { e.stopPropagation(); handleAcceptDelivery(item.id); }}
                                                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                                                            title="Accept this delivery order"
                                                        >
                                                            <LucideCheck size={14} />
                                                            <span>Accept</span>
                                                        </button>
                                                        <button
                                                            disabled={processingOrderId === item.id}
                                                            onClick={(e) => { e.stopPropagation(); handleRejectDelivery(item.id); }}
                                                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                                                            title="Reject this delivery order"
                                                        >
                                                            <LucideX size={14} />
                                                            <span>Reject</span>
                                                        </button>
                                                        <button
                                                            onClick={() => setSelectedOrder(item)}
                                                            className="text-neutral-500 hover:text-neutral-800 p-1.5 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
                                                            title="View order details"
                                                        >
                                                            <LucideEye size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setSelectedOrder(item)}
                                                        className="text-blue-600 hover:text-blue-800 text-xs font-semibold border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                                                    >
                                                        View Details
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Details Modal */}
                <OrderDetailsModal
                    order={selectedOrder}
                    onClose={handleCloseDetailsModal}
                    deliveryBoys={deliveryBoys}
                    onAssignDeliveryBoy={handleAssignDeliveryBoy}
                    onInitiateTakeawayHandover={handleInitiateTakeawayHandover}
                />

                {/* Takeaway Handover & Payment Modal */}
                <TakeawayHandoverModal
                    order={handoverModalOrder}
                    restaurantId={restaurantId || restaurantCode}
                    isOpen={!!handoverModalOrder}
                    onClose={() => setHandoverModalOrder(null)}
                    onPaymentSuccess={handleTakeawayPaymentSuccess}
                    onHandoverComplete={handleTakeawayHandoverComplete}
                />
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        queued: 'bg-orange-100 text-orange-700 border-orange-200',
        placed: 'bg-blue-100 text-blue-700 border-blue-200',
        preparing: 'bg-amber-100 text-amber-700 border-amber-200',
        ready: 'bg-purple-100 text-purple-700 border-purple-200',
        paid: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        served: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        cancelled: 'bg-red-100 text-red-700 border-red-200',
    };

    const labels: Record<string, string> = {
        queued: 'Queued',
        placed: 'New',
        preparing: 'Cooking',
        ready: 'Ready',
        paid: 'Paid',
        served: 'Served',
        cancelled: 'Cancelled',
    };

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider ${styles[status] || 'bg-gray-100 text-black'}`}>
            {labels[status] || status}
        </span>
    );
}
