'use client';

import { Calendar as LucideCalendar, Download as LucideDownload, Search as LucideSearch } from 'lucide-react';
import { useEffect, useState } from 'react';
import { OrderService, Order } from '@/app/services/orders';
import OrderDetailsModal from '@/app/components/admin/OrderDetailsModal';
import Timer from '@/app/components/Timer';
import { formatCurrency } from '@/app/lib/utils';
import { useRestaurantId } from '@/app/hooks/useRestaurantId';
import { getCached, setCache } from '@/app/lib/data-cache';

export default function OrderHistory() {
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const cached = getCached<Order[]>(`history-${restaurantId}`);
    const [orders, setOrders] = useState<Order[]>(cached || []);
    const [loading, setLoading] = useState(!cached);

    useEffect(() => {
        if (!restaurantLoading && restaurantId) {
            const loadHistory = () => {
                OrderService.fetchHistoryOrders(restaurantId)
                    .then(data => {
                        setOrders(data);
                        setCache(`history-${restaurantId}`, data);
                    })
                    .catch(console.error)
                    .finally(() => setLoading(false));
            };

            loadHistory();

            // Optional: Subscribe to see new history items appear (e.g. when order is marked served)
            const sub = OrderService.subscribeToOrders(restaurantId, () => {
                OrderService.fetchHistoryOrders(restaurantId).then(setOrders);
            });
            return () => { sub.unsubscribe(); };
        }
    }, [restaurantId, restaurantLoading]);



    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    return (
        <div className="p-8 flex flex-col h-screen space-y-7 overflow-hidden">
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-2xl font-black text-black tracking-tight">Order History</h2>
                    <p className="text-sm font-medium text-black mt-1">View and export past transactions (Served/Paid).</p>
                </div>
                <button className="flex items-center px-5 py-2.5 bg-white border border-neutral-200 text-black text-xs font-bold rounded-lg hover:bg-neutral-50 transition-all shadow-sm">
                    <LucideDownload size={16} className="mr-2" />
                    Export to CSV
                </button>
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
                                <th className="px-6 py-4">Table</th>
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
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-10 text-center text-black">No history found.</td>
                                </tr>
                            ) : (
                                orders.map((order) => (
                                    <tr
                                        key={order.id}
                                        className="hover:bg-neutral-50 transition-colors cursor-pointer group"
                                        onClick={() => setSelectedOrder(order)}
                                    >
                                        <td className="px-6 py-4 font-mono font-medium text-blue-600 group-hover:underline">#{order.order_number}</td>
                                        <td className="px-6 py-4 text-black">
                                            {new Date(order.created_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-6 py-4 text-black font-medium">Table {order.table_number || order.table_id}</td>
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
