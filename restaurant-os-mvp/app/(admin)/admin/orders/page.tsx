'use client';

import { LucideClock, LucideFilter, LucideSearch } from 'lucide-react';
import { useEffect, useState } from 'react';
import { OrderService, Order, OrderStatus } from '@/app/services/orders';
import OrderDetailsModal from '@/app/components/admin/OrderDetailsModal';
import { formatCurrency, formatTimeElapsed } from '@/app/lib/utils';

type FilterType = 'occupied' | 'ready' | 'cooking' | 'new';

export default function LiveOrders() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [filter, setFilter] = useState<FilterType>('occupied');
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const loadData = async () => {
            try {
                const activeOrders = await OrderService.fetchActiveOrders();
                setOrders(activeOrders.filter(o => o.status !== 'served'));
            } catch (err) {
                console.error(err);
            }
        };

        loadData();

        // Subscribe to Real-time Updates
        const subscription = OrderService.subscribeToOrders((payload) => {
            console.log('Admin Realtime Update:', payload);
            loadData();
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);



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

    const displayData = getFilteredData();

    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
            {/* Header & Filters */}
            <div className="p-6 border-b border-neutral-200 flex flex-col gap-4 bg-white sticky top-0 z-10">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-neutral-900">Live Orders</h2>
                        <p className="text-sm text-neutral-500">Real-time order tracking.</p>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilter('occupied')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors ${filter === 'occupied'
                            ? 'bg-neutral-900 text-white'
                            : 'bg-white border border-neutral-200 text-neutral-500 hover:bg-neutral-50'
                            }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter('new')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors ${filter === 'new'
                            ? 'bg-neutral-900 text-white'
                            : 'bg-white border border-neutral-200 text-neutral-500 hover:bg-neutral-50'
                            }`}
                    >
                        New
                    </button>
                    <button
                        onClick={() => setFilter('cooking')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors ${filter === 'cooking'
                            ? 'bg-neutral-900 text-white'
                            : 'bg-white border border-neutral-200 text-neutral-500 hover:bg-neutral-50'
                            }`}
                    >
                        Cooking
                    </button>
                    <button
                        onClick={() => setFilter('ready')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors ${filter === 'ready'
                            ? 'bg-neutral-900 text-white'
                            : 'bg-white border border-neutral-200 text-neutral-500 hover:bg-neutral-50'
                            }`}
                    >
                        Ready
                    </button>
                </div>
            </div>

            {/* Orders Table */}
            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left text-sm text-neutral-600">
                    <thead className="bg-neutral-50 text-neutral-900 font-medium border-b border-neutral-200 sticky top-0">
                        <tr>
                            <th className="px-6 py-4">Order ID</th>
                            <th className="px-6 py-4">Table</th>
                            <th className="px-6 py-4 w-1/3">Items</th>
                            <th className="px-6 py-4">Elapsed Time</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Total Amount</th>
                            <th className="px-6 py-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                        {displayData.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-10 text-center text-neutral-400">
                                    No {filter} orders.
                                </td>
                            </tr>
                        ) : (
                            displayData.map((item) => (
                                <tr key={item.id} className="hover:bg-neutral-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-neutral-900">#{item.id.slice(0, 8)}</td>
                                    <td className="px-6 py-4">Table {item.table_id}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            {item.items?.map((subItem: any, idx: number) => (
                                                <span key={idx} className="block text-xs bg-neutral-100 px-2 py-1 rounded w-fit text-neutral-700">
                                                    {subItem.quantity}x {subItem.name}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 flex items-center text-neutral-500">
                                        <LucideClock size={16} className="mr-2" />
                                        {getTimeElapsed(item.created_at)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusBadge status={item.status} />
                                    </td>
                                    <td className="px-6 py-4 font-bold text-neutral-900 text-right">{formatCurrency(item.total_amount * 1.05)}</td>
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
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border uppercase tracking-wide ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
            {status === 'preparing' ? 'Cooking' : status}
        </span>
    );
}
