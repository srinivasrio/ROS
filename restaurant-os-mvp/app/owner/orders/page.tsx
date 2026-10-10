'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOwner } from '@/context/OwnerContext';
import {
    ShoppingBag, Search, Filter, Calendar, ChevronDown, Eye, Clock,
    CheckCircle2, XCircle, Truck, CookingPot, Utensils, History,
    Store, DollarSign, ChevronRight, X, Phone, MapPin, Receipt,
    RefreshCw, Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { calculateOrderPricing } from '@/lib/pricing';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    queued: { label: 'Queued', color: 'bg-orange-50 text-orange-600 border-orange-200/60', icon: Clock },
    placed: { label: 'Placed', color: 'bg-amber-50 text-amber-600 border-amber-200/60', icon: Clock },
    pending: { label: 'Pending', color: 'bg-amber-50 text-amber-600 border-amber-200/60', icon: Clock },
    confirmed: { label: 'Confirmed', color: 'bg-blue-50 text-blue-600 border-blue-200/60', icon: CheckCircle2 },
    preparing: { label: 'Preparing', color: 'bg-orange-50 text-orange-600 border-orange-200/60', icon: CookingPot },
    ready: { label: 'Ready', color: 'bg-emerald-50 text-emerald-600 border-emerald-200/60', icon: CheckCircle2 },
    served: { label: 'Served', color: 'bg-teal-50 text-teal-700 border-teal-200/60', icon: CheckCircle2 },
    delivered: { label: 'Delivered', color: 'bg-green-50 text-green-600 border-green-200/60', icon: Truck },
    completed: { label: 'Completed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200/60', icon: CheckCircle2 },
    paid: { label: 'Paid', color: 'bg-emerald-50 text-emerald-700 border-emerald-200/60', icon: CheckCircle2 },
    cancelled: { label: 'Cancelled', color: 'bg-red-50 text-red-500 border-red-200/60', icon: XCircle },
};

export default function OrdersPage() {
    const { selectedRestaurantId, isAllRestaurants, currentRestaurant, restaurants, setSelectedRestaurant } = useOwner();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [orderTypeFilter, setOrderTypeFilter] = useState<'all' | 'dine_in' | 'takeaway' | 'delivery'>('all');
    const [dateFilter, setDateFilter] = useState('all');
    const [isHistoryView, setIsHistoryView] = useState(false);
    const [summary, setSummary] = useState({
        total: 0,
        dineIn: 0,
        takeaway: 0,
        delivery: 0,
        totalRevenue: 0
    });

    // Detail Modal State
    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

    const loadOrders = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (!isAllRestaurants && selectedRestaurantId && selectedRestaurantId !== 'all') {
                params.set('branch', selectedRestaurantId);
            }
            if (statusFilter !== 'all') params.set('status', statusFilter);
            if (orderTypeFilter !== 'all') params.set('order_type', orderTypeFilter);
            params.set('date', isHistoryView ? (dateFilter || 'all') : dateFilter);
            params.set('mode', isHistoryView ? 'history' : 'live');

            const res = await fetch(`/api/owner/orders?${params}`);
            if (res.ok) {
                const data = await res.json();
                setOrders(data.orders || []);
                if (data.summary) {
                    setSummary(data.summary);
                }
            }
        } catch {
            toast.error('Failed to load orders');
        } finally {
            setLoading(false);
        }
    }, [selectedRestaurantId, isAllRestaurants, statusFilter, orderTypeFilter, dateFilter, isHistoryView]);

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    // Live realtime updates for owner orders
    useEffect(() => {
        if (isHistoryView) return;
        const channel = supabase
            .channel('owner-live-orders-channel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'orders' },
                () => {
                    loadOrders();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isHistoryView, loadOrders]);

    // Keep selectedOrder in sync with live updates
    useEffect(() => {
        if (!selectedOrder) return;
        const updated = orders.find(o => o.id === selectedOrder.id);
        if (updated) {
            setSelectedOrder(updated);
        }
    }, [orders]);

    const filtered = orders.filter(o => {
        const query = search.toLowerCase();
        return (
            String(o.order_number || '').toLowerCase().includes(query) ||
            (o.id || '').toLowerCase().includes(query) ||
            (o.transaction_id || '').toLowerCase().includes(query) ||
            (o.customer_phone || '').includes(query)
        );
    });

    return (
        <div className="p-6 lg:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
                        {isHistoryView ? 'Order History & Archive' : 'Live & Operational Orders'}
                    </h2>
                    <p className="text-sm text-neutral-500 mt-0.5 font-medium">
                        {isAllRestaurants
                            ? 'Consolidated view across all restaurant branches'
                            : `${currentRestaurant?.name || 'Selected Restaurant'} orders`}
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Search */}
                    <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800/60 border border-neutral-200/60 dark:border-zinc-700/30 rounded-xl w-56 shadow-xs">
                        <Search size={14} className="text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search order #, phone..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-transparent text-xs outline-none w-full text-neutral-700 dark:text-neutral-300 placeholder:text-neutral-400"
                        />
                    </div>

                    {/* Order History Toggle Button */}
                    <button
                        onClick={() => setIsHistoryView(!isHistoryView)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                            isHistoryView
                                ? 'bg-indigo-600 text-white shadow-indigo-600/20'
                                : 'bg-white dark:bg-zinc-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200/70 dark:border-zinc-700/50 hover:bg-neutral-50'
                        }`}
                    >
                        <History size={14} />
                        <span>{isHistoryView ? 'History Mode (Active)' : 'Order History'}</span>
                    </button>

                    <button
                        onClick={() => loadOrders()}
                        disabled={loading}
                        className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-neutral-200/60 dark:border-zinc-700/30 text-neutral-600 dark:text-neutral-300 hover:text-indigo-600 transition-colors cursor-pointer shadow-xs"
                        title="Refresh orders"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin text-indigo-500" : ""} />
                    </button>
                </div>
            </div>



            {/* Order Type Tabs Toolbar */}
            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-neutral-200/60 dark:border-zinc-800/60 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Order Type Tabs: All, Dine In, Takeaway, Delivery */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 premium-scrollbar">
                        <button
                            onClick={() => setOrderTypeFilter('all')}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                orderTypeFilter === 'all'
                                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                                    : 'bg-neutral-100 dark:bg-zinc-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-zinc-700'
                            }`}
                        >
                            <ShoppingBag size={14} />
                            <span>All Orders</span>
                            <span className="ml-1 px-1.5 py-0.2 rounded-md bg-white/20 text-[10px] font-black">{summary.total}</span>
                        </button>

                        <button
                            onClick={() => setOrderTypeFilter('dine_in')}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                orderTypeFilter === 'dine_in'
                                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                                    : 'bg-neutral-100 dark:bg-zinc-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-zinc-700'
                            }`}
                        >
                            <Utensils size={14} />
                            <span>Dine In</span>
                            <span className="ml-1 px-1.5 py-0.2 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-black">
                                {summary.dineIn}
                            </span>
                        </button>

                        <button
                            onClick={() => setOrderTypeFilter('takeaway')}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                orderTypeFilter === 'takeaway'
                                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                                    : 'bg-neutral-100 dark:bg-zinc-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-zinc-700'
                            }`}
                        >
                            <ShoppingBag size={14} />
                            <span>Takeaway</span>
                            <span className="ml-1 px-1.5 py-0.2 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 text-[10px] font-black">
                                {summary.takeaway}
                            </span>
                        </button>

                        <button
                            onClick={() => setOrderTypeFilter('delivery')}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                orderTypeFilter === 'delivery'
                                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                                    : 'bg-neutral-100 dark:bg-zinc-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-zinc-700'
                            }`}
                        >
                            <Truck size={14} />
                            <span>Delivery</span>
                            <span className="ml-1 px-1.5 py-0.2 rounded-md bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 text-[10px] font-black">
                                {summary.delivery}
                            </span>
                        </button>
                    </div>

                    {/* Secondary Filters: Status & Date */}
                    <div className="flex items-center gap-2">
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            className="px-3 py-1.5 bg-neutral-50 dark:bg-zinc-800 border border-neutral-200/70 dark:border-zinc-700/50 rounded-xl text-xs font-bold outline-none cursor-pointer"
                        >
                            <option value="all">All Statuses</option>
                            <option value="placed">Placed</option>
                            <option value="preparing">Preparing</option>
                            <option value="ready">Ready</option>
                            <option value="served">Served</option>
                            <option value="paid">Paid</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>

                        <select
                            value={dateFilter}
                            onChange={e => setDateFilter(e.target.value)}
                            className="px-3 py-1.5 bg-neutral-50 dark:bg-zinc-800 border border-neutral-200/70 dark:border-zinc-700/50 rounded-xl text-xs font-bold outline-none cursor-pointer"
                        >
                            <option value="all">All Time</option>
                            <option value="today">Today</option>
                            <option value="week">Past 7 Days</option>
                            <option value="month">Past 30 Days</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Orders Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-neutral-200/70 dark:border-zinc-800/70 overflow-hidden shadow-xs">
                {loading ? (
                    <div className="p-8 space-y-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-16 bg-neutral-100/60 dark:bg-zinc-800/40 rounded-2xl animate-pulse" />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20">
                        <ShoppingBag size={36} className="text-neutral-300 mx-auto mb-3" />
                        <h3 className="text-sm font-black text-neutral-800 dark:text-white">No matching orders found</h3>
                        <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                            {isHistoryView 
                                ? 'No archived orders matching your current criteria' 
                                : 'No active orders in progress right now.'}
                        </p>
                        {!isHistoryView && (
                            <button
                                onClick={() => setIsHistoryView(true)}
                                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                            >
                                <History size={14} />
                                <span>View Past Order History</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-neutral-50 dark:bg-zinc-800/50 text-[10px] uppercase font-black text-neutral-500 border-b border-neutral-100 dark:border-zinc-800">
                                <tr>
                                    <th className="px-6 py-3.5">Order Info</th>
                                    <th className="px-6 py-3.5">Type & Outlet</th>
                                    <th className="px-6 py-3.5">Status</th>
                                    <th className="px-6 py-3.5">Dishes Summary</th>
                                    <th className="px-6 py-3.5 text-right">Amount</th>
                                    <th className="px-6 py-3.5 text-right">Time</th>
                                    <th className="px-6 py-3.5 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 dark:divide-zinc-800">
                                {filtered.map(order => {
                                    const cfg = STATUS_CONFIG[(order.status || '').toLowerCase()] || STATUS_CONFIG.placed;
                                    const StatusIcon = cfg.icon;
                                    const orderType = (order.order_type || 'DINE_IN').toUpperCase();

                                    return (
                                        <tr
                                            key={order.id}
                                            onClick={() => setSelectedOrder(order)}
                                            className="hover:bg-neutral-50/70 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                                        >
                                            <td className="px-6 py-4">
                                                <p className="font-mono font-black text-sm text-neutral-900 dark:text-white">
                                                    #{order.order_number || (order.id || '').slice(0, 6)}
                                                </p>
                                                {order.customer_phone && (
                                                    <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
                                                        Ph: {order.customer_phone}
                                                    </p>
                                                )}
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                                                        orderType === 'DINE_IN'
                                                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/50'
                                                            : orderType === 'TAKEAWAY'
                                                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/50'
                                                            : 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-200/50'
                                                    }`}>
                                                        {orderType === 'DINE_IN' && order.table_number ? `Dine In • T-${order.table_number}` : orderType.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-neutral-500 font-medium mt-1 truncate max-w-[150px]">
                                                    {order.restaurant_name}
                                                </p>
                                            </td>

                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cfg.color}`}>
                                                    <StatusIcon size={11} /> {cfg.label}
                                                </span>
                                            </td>

                                            <td className="px-6 py-4">
                                                <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 line-clamp-1">
                                                    {order.items && order.items.length > 0
                                                        ? order.items.map((it: any) => `${it.quantity}x ${it.name}`).join(', ')
                                                        : `${order.item_count || 1} Item(s)`}
                                                </p>
                                                <p className="text-[10px] text-neutral-400 mt-0.5">
                                                    {order.items?.length || 1} item line(s)
                                                </p>
                                            </td>

                                            <td className="px-6 py-4 text-right">
                                                {(() => {
                                                    const rowPricing = calculateOrderPricing(order);
                                                    return (
                                                        <>
                                                            <p className="font-mono font-black text-sm text-neutral-900 dark:text-white">
                                                                ₹{rowPricing.finalTotal.toFixed(2)}
                                                            </p>
                                                            {rowPricing.discountAmount > 0 && (
                                                                <span className="block text-[10px] font-bold text-emerald-600">
                                                                    Coupon {rowPricing.couponCode ? `(${rowPricing.couponCode})` : ''} -₹{rowPricing.discountAmount.toFixed(2)}
                                                                </span>
                                                            )}
                                                            <span className="text-[10px] text-neutral-400 uppercase font-bold">
                                                                {order.payment_method || 'Cash / Counter'}
                                                            </span>
                                                        </>
                                                    );
                                                })()}
                                            </td>

                                            <td className="px-6 py-4 text-right text-xs text-neutral-400 whitespace-nowrap">
                                                {order.created_at
                                                    ? new Date(order.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
                                                      new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                    : '—'}
                                            </td>

                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedOrder(order);
                                                    }}
                                                    className="p-1.5 rounded-xl bg-neutral-100 dark:bg-zinc-800 text-neutral-500 hover:text-indigo-600 transition-colors cursor-pointer"
                                                    title="View order details"
                                                >
                                                    <ChevronRight size={15} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ORDER DETAILS POPUP MODAL */}
            <AnimatePresence>
                {selectedOrder && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl border border-neutral-200 dark:border-zinc-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col justify-between"
                        >
                            {/* Modal Header */}
                            <div className="p-6 border-b border-neutral-100 dark:border-zinc-800 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                                        <Receipt size={20} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base font-black text-neutral-900 dark:text-white">
                                                Order #{selectedOrder.order_number || selectedOrder.id.slice(0, 6)}
                                            </h3>
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 uppercase">
                                                {selectedOrder.order_type || 'DINE_IN'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-neutral-400">
                                            {selectedOrder.restaurant_name} · {selectedOrder.branch_name}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedOrder(null)}
                                    className="w-8 h-8 rounded-xl bg-neutral-100 dark:bg-zinc-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-white flex items-center justify-center cursor-pointer"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Modal Body / Items */}
                            <div className="p-6 overflow-y-auto space-y-4 premium-scrollbar">
                                {/* Context Grid: Table, Phone, Address */}
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    {selectedOrder.table_number && (
                                        <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-zinc-800/40 border border-neutral-200/50 dark:border-zinc-700/40">
                                            <p className="text-[10px] font-bold text-neutral-400 uppercase">Table Number</p>
                                            <p className="text-sm font-black text-neutral-900 dark:text-white mt-0.5">Table {selectedOrder.table_number}</p>
                                        </div>
                                    )}
                                    {selectedOrder.customer_phone && (
                                        <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-zinc-800/40 border border-neutral-200/50 dark:border-zinc-700/40">
                                            <p className="text-[10px] font-bold text-neutral-400 uppercase">Customer Phone</p>
                                            <p className="text-sm font-mono font-bold text-neutral-900 dark:text-white mt-0.5">{selectedOrder.customer_phone}</p>
                                        </div>
                                    )}
                                    <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-zinc-800/40 border border-neutral-200/50 dark:border-zinc-700/40">
                                        <p className="text-[10px] font-bold text-neutral-400 uppercase">Order Status</p>
                                        <p className="text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase mt-0.5">{selectedOrder.status}</p>
                                    </div>
                                    <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-zinc-800/40 border border-neutral-200/50 dark:border-zinc-700/40">
                                        <p className="text-[10px] font-bold text-neutral-400 uppercase">Payment Method</p>
                                        <p className="text-sm font-bold text-neutral-900 dark:text-white uppercase mt-0.5">{selectedOrder.payment_method || 'CASH / COUNTER'}</p>
                                    </div>
                                </div>

                                {/* Items List */}
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Order Items Breakdown</p>
                                    {selectedOrder.items && selectedOrder.items.length > 0 ? (
                                        <div className="divide-y divide-neutral-100 dark:divide-zinc-800 border border-neutral-200/60 dark:border-zinc-800 rounded-2xl overflow-hidden">
                                            {selectedOrder.items.map((it: any, idx: number) => (
                                                <div key={idx} className="p-3 flex items-center justify-between text-xs bg-white dark:bg-zinc-900">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-3.5 h-3.5 border-2 ${it.is_veg ? 'border-emerald-600' : 'border-rose-600'} rounded-xs flex items-center justify-center p-0.5`}>
                                                            <span className={`w-1.5 h-1.5 ${it.is_veg ? 'bg-emerald-600 rounded-full' : 'bg-rose-600 rounded-xs'}`} />
                                                        </div>
                                                        <span className="font-bold text-neutral-900 dark:text-white">
                                                            {it.quantity}x {it.name}
                                                        </span>
                                                        {it.notes && (
                                                            <span className="text-[10px] text-neutral-400 italic">({it.notes})</span>
                                                        )}
                                                    </div>
                                                    <span className="font-mono font-bold text-neutral-900 dark:text-white">
                                                        ₹{(parseFloat(it.price || 0) * (it.quantity || 1)).toFixed(2)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-neutral-400 italic">No item details recorded for this order</p>
                                    )}
                                </div>

                                {/* Financial Summary */}
                                {(() => {
                                    const modalPricing = calculateOrderPricing(selectedOrder);
                                    return (
                                        <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-zinc-800/40 border border-neutral-200/60 dark:border-zinc-700/40 space-y-1.5 text-xs">
                                            <div className="flex justify-between text-neutral-500">
                                                <span>Items Subtotal:</span>
                                                <span className="font-mono">₹{modalPricing.itemsSubtotal.toFixed(2)}</span>
                                            </div>
                                            {modalPricing.cgstAmount > 0 && (
                                                <div className="flex justify-between text-neutral-500">
                                                    <span>CGST:</span>
                                                    <span className="font-mono">₹{modalPricing.cgstAmount.toFixed(2)}</span>
                                                </div>
                                            )}
                                            {modalPricing.sgstAmount > 0 && (
                                                <div className="flex justify-between text-neutral-500">
                                                    <span>SGST:</span>
                                                    <span className="font-mono">₹{modalPricing.sgstAmount.toFixed(2)}</span>
                                                </div>
                                            )}
                                            {modalPricing.gstAmount > 0 && (
                                                <div className="flex justify-between text-neutral-600 font-medium">
                                                    <span>Total GST:</span>
                                                    <span className="font-mono">₹{modalPricing.gstAmount.toFixed(2)}</span>
                                                </div>
                                            )}
                                            {modalPricing.deliveryFee > 0 && (
                                                <div className="flex justify-between text-blue-600 font-medium">
                                                    <span>Delivery Fee:</span>
                                                    <span className="font-mono">₹{modalPricing.deliveryFee.toFixed(2)}</span>
                                                </div>
                                            )}
                                            {modalPricing.discountAmount > 0 && (
                                                <div className="flex justify-between text-emerald-600 font-semibold">
                                                    <span>Coupon Discount {modalPricing.couponCode ? `(${modalPricing.couponCode})` : ''}:</span>
                                                    <span className="font-mono">-₹{modalPricing.discountAmount.toFixed(2)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between pt-2 border-t border-neutral-200/60 dark:border-zinc-700/40 text-sm font-black text-neutral-900 dark:text-white">
                                                <span>Total Payable:</span>
                                                <span className="font-mono text-indigo-600 dark:text-indigo-400">
                                                    ₹{modalPricing.finalTotal.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 bg-neutral-50 dark:bg-zinc-800/40 border-t border-neutral-100 dark:border-zinc-800 flex justify-end">
                                <button
                                    onClick={() => setSelectedOrder(null)}
                                    className="px-4 py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold transition-all cursor-pointer"
                                >
                                    Close Details
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
