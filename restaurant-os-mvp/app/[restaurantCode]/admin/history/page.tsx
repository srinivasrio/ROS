'use client';

import { Calendar as LucideCalendar, Download as LucideDownload, Search as LucideSearch, UtensilsCrossed, ShoppingBag, Truck, LayoutGrid } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { OrderService, Order } from '@/services/orders.service';
import OrderDetailsModal from '@/components/admin/OrderDetailsModal';
import Timer from '@/components/Timer';
import { formatCurrency } from '@/lib/utils';
import { useRestaurantId } from '@/hooks/useRestaurantId';
import { getCached, setCache, hasFreshCache } from '@/lib/data-cache';
import { useParams } from 'next/navigation';
import { SyncIndicator } from '@/components/admin/SyncIndicator';

type OrderCategory = 'ALL' | 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';

export default function OrderHistory() {
    const params = useParams();
    const urlRestaurantCode = (params?.restaurantCode as string) || '';
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const activeResId = restaurantId || urlRestaurantCode;
    const cacheKey = `history-${activeResId}`;
    const cached = getCached<Order[]>(cacheKey) || (urlRestaurantCode ? getCached<Order[]>(`history-${urlRestaurantCode}`) : null);
    const [orders, setOrders] = useState<Order[]>(cached || []);
    const [loading, setLoading] = useState(!cached && orders.length === 0);
    const [isRevalidating, setIsRevalidating] = useState(false);
    const [activeCategory, setActiveCategory] = useState<OrderCategory>('ALL');

    useEffect(() => {
        if (!restaurantLoading && activeResId) {
            const loadHistory = (force = false) => {
                const targetKey = `history-${activeResId}`;
                if (!force && hasFreshCache(targetKey)) {
                    const freshCached = getCached<Order[]>(targetKey);
                    if (freshCached) {
                        setOrders(freshCached);
                        setLoading(false);
                        return;
                    }
                }

                setIsRevalidating(true);
                OrderService.fetchHistoryOrders(activeResId)
                    .then(data => {
                        const bounded = Array.isArray(data) ? data.slice(0, 100) : [];
                        setOrders(bounded);
                        setCache(targetKey, bounded);
                        if (restaurantId && urlRestaurantCode && restaurantId !== urlRestaurantCode) {
                            setCache(`history-${restaurantId}`, bounded);
                            setCache(`history-${urlRestaurantCode}`, bounded);
                        }
                    })
                    .catch(console.error)
                    .finally(() => {
                        setLoading(false);
                        setIsRevalidating(false);
                    });
            };

            loadHistory(false);

            let debounceTimer: NodeJS.Timeout | null = null;
            const sub = OrderService.subscribeToOrders(activeResId, () => {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    loadHistory(true);
                }, 1000);
            });
            return () => { 
                if (debounceTimer) clearTimeout(debounceTimer);
                sub.unsubscribe(); 
            };
        }
    }, [activeResId, restaurantId, urlRestaurantCode, restaurantLoading]);

    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    // Counts per category
    const categoryCounts = useMemo(() => {
        const counts = { ALL: 0, DINE_IN: 0, TAKEAWAY: 0, DELIVERY: 0 };
        orders.forEach(o => {
            counts.ALL++;
            const type = (o.order_type || 'DINE_IN').toUpperCase();
            if (type === 'TAKEAWAY') counts.TAKEAWAY++;
            else if (type === 'DELIVERY') counts.DELIVERY++;
            else counts.DINE_IN++;
        });
        return counts;
    }, [orders]);

    // Filtered orders based on selected category
    const filteredOrders = useMemo(() => {
        if (activeCategory === 'ALL') return orders;
        return orders.filter(o => {
            const type = (o.order_type || 'DINE_IN').toUpperCase();
            if (activeCategory === 'DINE_IN') return type !== 'TAKEAWAY' && type !== 'DELIVERY';
            return type === activeCategory;
        });
    }, [orders, activeCategory]);

    const categoryButtons: { key: OrderCategory; label: string; icon: React.ReactNode; color: string; activeColor: string }[] = [
        { key: 'ALL', label: 'All Orders', icon: <LayoutGrid size={15} />, color: 'text-neutral-600', activeColor: 'bg-neutral-900 text-white shadow-sm' },
        { key: 'DINE_IN', label: 'Dine In', icon: <UtensilsCrossed size={15} />, color: 'text-amber-700', activeColor: 'bg-amber-600 text-white shadow-sm' },
        { key: 'TAKEAWAY', label: 'Take Away', icon: <ShoppingBag size={15} />, color: 'text-emerald-700', activeColor: 'bg-emerald-600 text-white shadow-sm' },
        { key: 'DELIVERY', label: 'Delivery', icon: <Truck size={15} />, color: 'text-blue-700', activeColor: 'bg-blue-600 text-white shadow-sm' },
    ];

    return (
        <div className="p-8 flex flex-col h-screen space-y-7 overflow-hidden">
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-black text-black tracking-tight">Order History</h2>
                        <SyncIndicator isRevalidating={isRevalidating} />
                    </div>
                    <p className="text-sm font-medium text-black mt-1">View and export past transactions (Served/Paid).</p>
                </div>
                <button className="flex items-center px-5 py-2.5 bg-white border border-neutral-200 text-black text-xs font-bold rounded-lg hover:bg-neutral-50 transition-all shadow-sm">
                    <LucideDownload size={16} className="mr-2" />
                    Export to CSV
                </button>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-2 shrink-0">
                {categoryButtons.map(cat => {
                    const isActive = activeCategory === cat.key;
                    const count = categoryCounts[cat.key];
                    return (
                        <button
                            key={cat.key}
                            type="button"
                            onClick={() => setActiveCategory(cat.key)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                                isActive
                                    ? `${cat.activeColor} border-transparent`
                                    : `bg-white ${cat.color} border-neutral-200 hover:border-neutral-300 hover:shadow-sm`
                            }`}
                        >
                            {cat.icon}
                            <span>{cat.label}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                                isActive ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-500'
                            }`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">


                {/* Filters */}
                <div className="p-4 border-b border-neutral-200 flex gap-4 bg-neutral-50 shrink-0">
                    <div className="flex items-center bg-white border border-neutral-300 rounded-lg px-3 py-2 w-64">
                        <LucideSearch size={18} className="text-black mr-2" />
                        <input type="text" placeholder="Search Order ID..." className="text-sm outline-none w-full" />
                    </div>
                    <div className="flex items-center bg-white border border-neutral-300 rounded-lg px-3 py-2">
                        <LucideCalendar size={18} className="text-black mr-2" />
                        <span className="text-sm text-black">Last 7 Days</span>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left text-sm text-black">
                        <thead className="bg-white text-black font-bold border-b border-neutral-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4">Order ID</th>
                                <th className="px-6 py-4">Date & Time</th>
                                <th className="px-6 py-4">Type / Table</th>
                                <th className="px-6 py-4">Duration</th>
                                <th className="px-6 py-4">Items Count</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Grand Total</th>
                                <th className="px-6 py-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-10 text-center text-black">Loading history...</td>
                                </tr>
                            ) : filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-10 text-center text-black">
                                        {activeCategory === 'ALL' ? 'No history found.' : `No ${activeCategory === 'DINE_IN' ? 'Dine In' : activeCategory === 'TAKEAWAY' ? 'Take Away' : 'Delivery'} orders found.`}
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map((order) => (
                                    <tr
                                        key={order.id}
                                        className="hover:bg-neutral-50 transition-colors cursor-pointer group"
                                        onClick={() => setSelectedOrder(order)}
                                    >
                                        <td className="px-6 py-4 font-mono font-medium text-blue-600 group-hover:underline">#{order.order_number}</td>
                                        <td className="px-6 py-4 text-black">
                                            {new Date(order.created_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-6 py-4 text-black font-medium">
                                            {order.order_type === 'TAKEAWAY' ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                                    🛍️ Takeaway
                                                </span>
                                            ) : order.order_type === 'DELIVERY' ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                                                    🛵 Delivery
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                                                    🍽️ Table {order.table_number || order.table_id}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-black">
                                            {order.completed_at ? (
                                                <Timer
                                                    startTime={order.created_at}
                                                    endTime={order.completed_at}
                                                    className="font-mono text-xs"
                                                />
                                            ) : (
                                                <span className="text-black">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0} items
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${order.status === 'paid' ? 'bg-green-100 text-green-700 border-green-200' :
                                                order.status === 'served' ? 'bg-gray-100 text-black border-gray-200' :
                                                    'bg-red-100 text-red-700 border-red-200'
                                                }`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-black text-right">{formatCurrency(order.total_amount)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}
                                                className="text-blue-600 hover:text-blue-800 text-xs font-bold border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Details Modal */}
            <OrderDetailsModal
                order={selectedOrder}
                onClose={() => setSelectedOrder(null)}
            />
        </div>
    );
}
