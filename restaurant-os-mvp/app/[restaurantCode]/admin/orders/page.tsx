'use client';

import { Clock as LucideClock, Filter as LucideFilter, Search as LucideSearch, Printer, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { OrderService, Order, OrderStatus } from '@/app/services/orders';
import OrderDetailsModal from '@/app/components/admin/OrderDetailsModal';
import SharedComboCard from '@/app/components/shared/SharedComboCard';
import { formatCurrency, formatTimeElapsed } from '@/app/lib/utils';
import { useRestaurantId } from '@/app/hooks/useRestaurantId';
import { getCached, setCache } from '@/app/lib/data-cache';

type FilterType = 'occupied' | 'ready' | 'cooking' | 'new';

export default function LiveOrders() {
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const cached = getCached<Order[]>(`orders-${restaurantId}`);
    const [orders, setOrders] = useState<Order[]>(cached || []);
    const [filter, setFilter] = useState<FilterType>('occupied');
    const [now, setNow] = useState(Date.now());
    const [waiters, setWaiters] = useState<any[]>([]);
    const [isReassigning, setIsReassigning] = useState<string | null>(null);

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        let active = true;
        if (!restaurantLoading && restaurantId) {
            const loadData = async () => {
                try {
                    const activeOrders = await OrderService.fetchActiveOrders(restaurantId);
                    const filtered = activeOrders.filter(o => o.status !== 'served');
                    if (active) {
                        setOrders(filtered);
                        setCache(`orders-${restaurantId}`, filtered);
                    }
                } catch (err) {
                    console.error(err);
                }
            };

            const loadWaiters = async () => {
                try {
                    const staff = await OrderService.fetchStaff(restaurantId);
                    if (active) {
                        setWaiters(staff.filter((s: any) => s.role === 'waiter'));
                    }
                } catch (err) {
                    console.error('Failed to load waiters:', err);
                }
            };

            loadData();
            loadWaiters();

            // Subscribe to Real-time Updates
            const subscription = OrderService.subscribeToOrders(restaurantId, (payload) => {
                console.log('Admin Realtime Update:', payload);
                if (active) loadData();
            });

            return () => {
                active = false;
                subscription.unsubscribe();
            };
        }
        return () => { active = false; };
    }, [restaurantId, restaurantLoading]);

    const handleReassign = async (orderId: string, waiterId: string) => {
        if (!restaurantId) return;
        setIsReassigning(orderId);
        try {
            await OrderService.reassignWaiter(orderId, restaurantId, waiterId);
            // Local update for responsiveness
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, waiter_id: waiterId } : o));
        } catch (err) {
            console.error('Failed to reassign:', err);
        } finally {
            setIsReassigning(null);
        }
    };



    const getTimeElapsed = (dateStr: string) => {
        return formatTimeElapsed(dateStr);
    };

    // Filter Logic
    const getFilteredData = () => {
        switch (filter) {
            case 'ready':
                return orders.filter(o => o.status === 'ready');
            case 'cooking':
                return orders.filter(o => o.status === 'preparing');
            case 'new':
                return orders.filter(o => o.status === 'placed');
            case 'occupied':
            default:
                return orders; // All active
        }
    };

    const displayData = [...getFilteredData()].sort((a, b) => {
        const tableA = (a.table_id || a.merge_group_id || '').toString();
        const tableB = (b.table_id || b.merge_group_id || '').toString();
        return tableA.localeCompare(tableB, undefined, { numeric: true, sensitivity: 'base' });
    });

    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    return (
        <div className="p-8 flex flex-col h-screen space-y-7 overflow-hidden">
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-2xl font-black text-black tracking-tight">Live Orders</h2>
                    <p className="text-sm font-medium text-black mt-1">Real-time order tracking.</p>
                </div>
            </div>
            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
                {/* Header & Filters */}
                <div className="p-6 border-b border-neutral-200 flex flex-col gap-4 bg-white sticky top-0 z-10 shrink-0">
                {/* Filter Tabs */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilter('occupied')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors ${filter === 'occupied'
                            ? 'bg-neutral-900 text-white'
                            : 'bg-white border border-neutral-200 text-black hover:bg-neutral-50'
                            }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter('new')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors ${filter === 'new'
                            ? 'bg-neutral-900 text-white'
                            : 'bg-white border border-neutral-200 text-black hover:bg-neutral-50'
                            }`}
                    >
                        New
                    </button>
                    <button
                        onClick={() => setFilter('cooking')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors ${filter === 'cooking'
                            ? 'bg-neutral-900 text-white'
                            : 'bg-white border border-neutral-200 text-black hover:bg-neutral-50'
                            }`}
                    >
                        Cooking
                    </button>
                    <button
                        onClick={() => setFilter('ready')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors ${filter === 'ready'
                            ? 'bg-neutral-900 text-white'
                            : 'bg-white border border-neutral-200 text-black hover:bg-neutral-50'
                            }`}
                    >
                        Ready
                    </button>
                </div>
            </div>

            {/* Orders Table */}
            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left text-sm text-black">
                    <thead className="bg-neutral-50 text-black font-medium border-b border-neutral-200 sticky top-0">
                        <tr>
                            <th className="px-6 py-4">Order ID</th>
                            <th className="px-6 py-4">Table</th>
                            <th className="px-6 py-4 w-1/3">Items</th>
                            <th className="px-6 py-4">Elapsed Time</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Waiter</th>
                            <th className="px-6 py-4 text-right">Total Amount</th>
                            <th className="px-6 py-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                        {displayData.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-10 text-center text-black">
                                    No {filter} orders.
                                </td>
                            </tr>
                        ) : (
                            displayData.map((item) => (
                                <tr key={item.id} className="hover:bg-neutral-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-black">#{item.id.slice(0, 8)}</td>
                                    <td className="px-6 py-4">Table {item.table_number || item.table_id}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            {item.items?.map((subItem: any, idx: number) => {
                                                if (subItem.item_type?.toLowerCase() === 'combo') {
                                                    return (
                                                        <div key={idx} className="max-w-[250px]">
                                                            <SharedComboCard
                                                                name={subItem.name}
                                                                image_url={subItem.image_url}
                                                                price={subItem.price}
                                                                quantity={subItem.quantity}
                                                                items={subItem.combo_items || []}
                                                                notes={subItem.notes}
                                                                readOnly={true}
                                                            />
                                                        </div>
                                                    );
                                                }
                                                return (
                                                <span key={idx} className="block text-xs bg-neutral-100 px-2 py-1 rounded w-fit text-black">
                                                    {subItem.quantity}x {subItem.name}
                                                </span>
                                            )})}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 flex items-center text-black">
                                        <LucideClock size={16} className="mr-2" />
                                        {getTimeElapsed(item.created_at)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusBadge status={item.status} />
                                    </td>
                                    <td className="px-6 py-4">
                                        <select
                                            disabled={isReassigning === item.id}
                                            value={item.waiter_id || ''}
                                            onChange={(e) => handleReassign(item.id, e.target.value)}
                                            className="text-xs bg-white border border-neutral-200 rounded px-2 py-1 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                                        >
                                            <option value="" disabled>Auto-Assigning...</option>
                                            {waiters.map(w => (
                                                <option key={w.id} value={w.id}>{w.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-black text-right">{formatCurrency(item.total_amount * 1.05)}</td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => setSelectedOrder(item)}
                                            className="text-blue-600 hover:text-blue-800 text-xs font-medium border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                                        >
                                            View Details
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Details Modal */}
            <OrderDetailsModal
                order={selectedOrder}
                onClose={() => setSelectedOrder(null)}
            />
        </div>
    </div>
);
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        placed: 'bg-blue-100 text-blue-700 border-blue-200',
        preparing: 'bg-orange-100 text-orange-700 border-orange-200',
        ready: 'bg-purple-100 text-purple-700 border-purple-200',
        served: 'bg-green-100 text-green-700 border-green-200',
    };

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border uppercase tracking-wide ${styles[status] || 'bg-gray-100 text-black'}`}>
            {status === 'preparing' ? 'Cooking' : status}
        </span>
    );
}
