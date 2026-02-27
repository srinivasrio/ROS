'use client';

import { LucideCalendar, LucideDownload, LucideSearch } from 'lucide-react';
import { useEffect, useState } from 'react';
import { OrderService, Order } from '@/app/services/orders';
import OrderDetailsModal from '@/app/components/admin/OrderDetailsModal';
import Timer from '@/app/components/Timer';
import { formatCurrency } from '@/app/lib/utils';

export default function OrderHistory() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        OrderService.fetchHistoryOrders()
            .then(setOrders)
            .catch(console.error)
            .finally(() => setLoading(false));

        // Optional: Subscribe to see new history items appear (e.g. when order is marked served)
        const sub = OrderService.subscribeToOrders(() => {
            OrderService.fetchHistoryOrders().then(setOrders);
        });
        return () => { sub.unsubscribe(); };
    }, []);



    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-neutral-900">Order History</h2>
                    <p className="text-neutral-500">View and export past transactions (Served/Paid).</p>
                </div>
                <button className="flex items-center px-4 py-2 bg-white border border-neutral-300 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors shadow-sm">
                    <LucideDownload size={18} className="mr-2" />
                    Export to CSV
                </button>
            </div>

            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden h-[calc(100vh-12rem)] flex flex-col">
                {/* Filters */}
                <div className="p-4 border-b border-neutral-200 flex gap-4 bg-neutral-50 shrink-0">
                    <div className="flex items-center bg-white border border-neutral-300 rounded-lg px-3 py-2 w-64">
                        <LucideSearch size={18} className="text-neutral-400 mr-2" />
                        <input type="text" placeholder="Search Order ID..." className="text-sm outline-none w-full" />
                    </div>
                    <div className="flex items-center bg-white border border-neutral-300 rounded-lg px-3 py-2">
                        <LucideCalendar size={18} className="text-neutral-400 mr-2" />
                        <span className="text-sm text-neutral-600">Last 7 Days</span>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left text-sm text-neutral-600">
                        <thead className="bg-white text-neutral-900 font-bold border-b border-neutral-200 sticky top-0 z-10">
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
                                    <td colSpan={8} className="px-6 py-10 text-center text-neutral-400">Loading history...</td>
                                </tr>
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-10 text-center text-neutral-400">No history found.</td>
                                </tr>
                            ) : (
                                orders.map((order) => (
                                    <tr
                                        key={order.id}
                                        className="hover:bg-neutral-50 transition-colors cursor-pointer group"
                                        onClick={() => setSelectedOrder(order)}
                                    >
                                        <td className="px-6 py-4 font-mono font-medium text-blue-600 group-hover:underline">#{order.order_number}</td>
                                        <td className="px-6 py-4 text-neutral-500">
                                            {new Date(order.created_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-6 py-4 text-neutral-900 font-medium">Table {order.table_id}</td>
                                        <td className="px-6 py-4 text-neutral-600">
                                            {order.completed_at ? (
                                                <Timer
                                                    startTime={order.created_at}
                                                    endTime={order.completed_at}
                                                    className="font-mono text-xs"
                                                />
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0} items
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${order.status === 'paid' ? 'bg-green-100 text-green-700 border-green-200' :
                                                order.status === 'served' ? 'bg-gray-100 text-gray-700 border-gray-200' :
                                                    'bg-red-100 text-red-700 border-red-200'
                                                }`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-neutral-900 text-right">{formatCurrency(order.total_amount)}</td>
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
