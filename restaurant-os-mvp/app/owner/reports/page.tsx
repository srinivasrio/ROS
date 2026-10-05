'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useOwner } from '@/context/OwnerContext';
import {
    BarChart3,
    TrendingUp,
    DollarSign,
    ShoppingBag,
    Users,
    Download,
    Calendar,
    Building2,
    CreditCard,
    Utensils,
    PackageCheck,
    Truck,
    RefreshCw,
    Percent,
    PieChart,
    Receipt,
    Store,
    Flame
} from 'lucide-react';

export default function ReportsPage() {
    const { selectedRestaurantId, isAllRestaurants, currentRestaurant, restaurants, setSelectedRestaurant } = useOwner();
    const [period, setPeriod] = useState('all');
    const [reportData, setReportData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchReports = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('period', period);
            if (!isAllRestaurants && selectedRestaurantId) {
                params.set('branch', selectedRestaurantId);
            }

            const res = await fetch(`/api/owner/reports?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setReportData(data);
            }
        } catch (err) {
            console.error('Failed to load reports:', err);
        } finally {
            setLoading(false);
        }
    }, [period, selectedRestaurantId, isAllRestaurants]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    const rev = reportData?.totalRevenue || 0;
    const ordersCount = reportData?.totalOrders || 0;
    const aov = reportData?.averageOrderValue || 0;
    const gst = reportData?.totalGst || 0;
    const orderTypes = reportData?.orderTypeStats || {
        dineIn: { count: 0, revenue: 0 },
        takeaway: { count: 0, revenue: 0 },
        delivery: { count: 0, revenue: 0 }
    };

    const dineInPct = rev > 0 ? Math.round((orderTypes.dineIn.revenue / rev) * 100) : 0;
    const takeawayPct = rev > 0 ? Math.round((orderTypes.takeaway.revenue / rev) * 100) : 0;
    const deliveryPct = rev > 0 ? Math.round((orderTypes.delivery.revenue / rev) * 100) : 0;

    return (
        <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight flex items-center gap-2.5">
                        <BarChart3 className="text-emerald-500" size={24} />
                        Executive Intelligence & Reports
                    </h2>
                    <p className="text-sm text-neutral-400 mt-0.5">
                        {isAllRestaurants
                            ? 'Franchise-wide operational metrics & audit breakdown'
                            : `Consolidated performance metrics for ${currentRestaurant?.name || 'Selected Outlet'}`}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchReports()}
                        className="p-2.5 rounded-xl border border-neutral-200/60 dark:border-zinc-800 bg-white dark:bg-zinc-800/80 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-zinc-700 transition"
                        title="Refresh report data"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <div className="flex items-center bg-white dark:bg-zinc-900 border border-neutral-200/60 dark:border-zinc-800 rounded-xl p-1 shadow-xs">
                        {[
                            { id: 'today', label: 'Today' },
                            { id: 'week', label: '7D' },
                            { id: 'month', label: '30D' },
                            { id: 'quarter', label: '90D' },
                            { id: 'all', label: 'All Time' }
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setPeriod(t.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                    period === t.id
                                        ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-xs'
                                        : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Active Outlet Banner if isolated */}
            {!isAllRestaurants && currentRestaurant && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 px-4 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                    <div className="flex items-center gap-2">
                        <Store size={15} />
                        <span>Isolating revenue and orders for <strong>{currentRestaurant.name}</strong></span>
                    </div>
                    <button
                        onClick={() => setSelectedRestaurant('all')}
                        className="font-bold underline hover:opacity-80 transition"
                    >
                        Switch to Franchise-Wide
                    </button>
                </div>
            )}

            {/* Core Financial Ribbon */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    {
                        label: 'Total Realized Revenue',
                        value: loading ? '...' : `₹${rev.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                        desc: 'Net settled sales volume',
                        icon: DollarSign,
                        color: 'text-emerald-500',
                        bg: 'bg-emerald-50 dark:bg-emerald-950/30'
                    },
                    {
                        label: 'Total Orders Completed',
                        value: loading ? '...' : ordersCount,
                        desc: `${orderTypes.dineIn.count} dine-in · ${orderTypes.takeaway.count} takeaway`,
                        icon: ShoppingBag,
                        color: 'text-orange-500',
                        bg: 'bg-orange-50 dark:bg-orange-950/30'
                    },
                    {
                        label: 'Average Order Value (AOV)',
                        value: loading ? '...' : `₹${Math.round(aov).toLocaleString('en-IN')}`,
                        desc: 'Average bill size per ticket',
                        icon: TrendingUp,
                        color: 'text-indigo-500',
                        bg: 'bg-indigo-50 dark:bg-indigo-950/30'
                    },
                    {
                        label: 'Taxes Collected (GST)',
                        value: loading ? '...' : `₹${gst.toFixed(2)}`,
                        desc: 'CGST + SGST audit liability',
                        icon: Receipt,
                        color: 'text-blue-500',
                        bg: 'bg-blue-50 dark:bg-blue-950/30'
                    },
                ].map((stat, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-neutral-200/70 dark:border-zinc-800/80 shadow-xs flex items-center gap-4"
                    >
                        <div className={`p-3 rounded-xl shrink-0 ${stat.bg} ${stat.color}`}>
                            <stat.icon size={20} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider truncate">{stat.label}</p>
                            <p className="text-xl font-black text-neutral-900 dark:text-white truncate">{stat.value}</p>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">{stat.desc}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Channel Performance: Dine In vs Takeaway vs Delivery */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {[
                    {
                        title: 'Dine-In Operations',
                        count: orderTypes.dineIn.count,
                        revenue: orderTypes.dineIn.revenue,
                        pct: dineInPct,
                        icon: Utensils,
                        color: 'from-amber-500 to-orange-500',
                        badgeBg: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    },
                    {
                        title: 'Takeaway Counters',
                        count: orderTypes.takeaway.count,
                        revenue: orderTypes.takeaway.revenue,
                        pct: takeawayPct,
                        icon: PackageCheck,
                        color: 'from-blue-500 to-indigo-500',
                        badgeBg: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-500/20'
                    },
                    {
                        title: 'Direct Delivery',
                        count: orderTypes.delivery.count,
                        revenue: orderTypes.delivery.revenue,
                        pct: deliveryPct,
                        icon: Truck,
                        color: 'from-emerald-500 to-teal-500',
                        badgeBg: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    }
                ].map((channel, i) => (
                    <div
                        key={i}
                        className="bg-white dark:bg-zinc-900 rounded-2xl border border-neutral-200/70 dark:border-zinc-800/80 p-5 shadow-xs space-y-4"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className={`p-2 rounded-xl border ${channel.badgeBg}`}>
                                    <channel.icon size={18} />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-neutral-900 dark:text-white">{channel.title}</h4>
                                    <p className="text-[10px] text-neutral-400">{channel.count} orders recorded</p>
                                </div>
                            </div>
                            <span className="text-xs font-black text-neutral-900 dark:text-white">
                                {channel.pct}%
                            </span>
                        </div>

                        <div>
                            <div className="flex justify-between items-baseline mb-1">
                                <span className="text-[10px] uppercase font-bold text-neutral-400">Channel Revenue</span>
                                <span className="font-mono font-black text-sm text-neutral-900 dark:text-white">
                                    ₹{channel.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="w-full h-2 bg-neutral-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full bg-gradient-to-r ${channel.color} rounded-full transition-all duration-500`}
                                    style={{ width: `${Math.max(channel.pct, 0)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Split Row: Top Selling Dishes + Payment Method Split */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Selling Items */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-neutral-200/70 dark:border-zinc-800/80 p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-100 dark:border-zinc-800 pb-3">
                        <div className="flex items-center gap-2">
                            <Flame size={16} className="text-rose-500" />
                            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                                Top Selling Dishes
                            </h3>
                        </div>
                        <span className="text-[10px] font-bold text-neutral-400">By Sales Quantity</span>
                    </div>

                    {loading ? (
                        <div className="py-12 text-center text-xs text-neutral-400">Loading top menu items...</div>
                    ) : (reportData?.topItems || []).length === 0 ? (
                        <div className="py-12 text-center text-xs text-neutral-400">No item line-items recorded yet.</div>
                    ) : (
                        <div className="divide-y divide-neutral-100 dark:divide-zinc-800">
                            {reportData.topItems.map((item: any, idx: number) => (
                                <div key={idx} className="py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-md bg-neutral-100 dark:bg-zinc-800 text-neutral-600 dark:text-neutral-400 font-black text-xs flex items-center justify-center shrink-0">
                                            #{idx + 1}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {/* FSSAI Veg / Non-Veg Indicator */}
                                            <span
                                                className={`w-3 h-3 rounded-xs border flex items-center justify-center p-0.5 shrink-0 ${
                                                    item.is_veg
                                                        ? 'border-emerald-600 dark:border-emerald-500'
                                                        : 'border-rose-600 dark:border-rose-500'
                                                }`}
                                            >
                                                <span
                                                    className={`w-1.5 h-1.5 rounded-full ${
                                                        item.is_veg ? 'bg-emerald-600' : 'bg-rose-600'
                                                    }`}
                                                />
                                            </span>
                                            <span className="text-xs font-bold text-neutral-900 dark:text-white">
                                                {item.name}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-right">
                                        <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
                                            {item.quantity} sold
                                        </span>
                                        <span className="font-mono font-bold text-xs text-neutral-900 dark:text-white">
                                            ₹{item.revenue.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Payment Methods & Settle Breakdown */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-neutral-200/70 dark:border-zinc-800/80 p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-100 dark:border-zinc-800 pb-3">
                        <div className="flex items-center gap-2">
                            <CreditCard size={16} className="text-indigo-500" />
                            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                                Payment Settlement Modes
                            </h3>
                        </div>
                        <span className="text-[10px] font-bold text-neutral-400">Gross Settlement</span>
                    </div>

                    {loading ? (
                        <div className="py-12 text-center text-xs text-neutral-400">Loading settlement methods...</div>
                    ) : !reportData?.paymentBreakdown || Object.keys(reportData.paymentBreakdown).length === 0 ? (
                        <div className="py-12 text-center text-xs text-neutral-400">No payment data recorded.</div>
                    ) : (
                        <div className="divide-y divide-neutral-100 dark:divide-zinc-800">
                            {Object.entries(reportData.paymentBreakdown).map(([method, data]: [string, any], idx) => {
                                const methodPct = rev > 0 ? Math.round((data.amount / rev) * 100) : 0;
                                return (
                                    <div key={idx} className="py-3 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center font-bold text-xs">
                                                <CreditCard size={14} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                                                    {method || 'CASH'}
                                                </p>
                                                <p className="text-[10px] text-neutral-400">{data.count} transactions</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-mono font-bold text-xs text-neutral-900 dark:text-white">
                                                ₹{data.amount.toFixed(2)}
                                            </p>
                                            <p className="text-[10px] font-semibold text-neutral-400">
                                                {methodPct}% share
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Franchise Multi-Branch Breakdown Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-neutral-200/70 dark:border-zinc-800/80 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-100 dark:border-zinc-800 pb-3">
                    <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-amber-500" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                            Restaurant Branch Revenue & Fulfillment Split
                        </h3>
                    </div>
                    <span className="text-[10px] text-neutral-400 font-bold">
                        {reportData?.branchBreakdown?.length || 0} Outlets Configured
                    </span>
                </div>

                {loading ? (
                    <div className="py-8 text-center text-xs text-neutral-400">Loading branch metrics...</div>
                ) : (reportData?.branchBreakdown || []).length === 0 ? (
                    <div className="py-8 text-center text-xs text-neutral-400">No branch transaction data found for this period.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-neutral-50 dark:bg-zinc-800/50 text-[10px] uppercase font-black text-neutral-500">
                                <tr>
                                    <th className="p-3">Restaurant Branch</th>
                                    <th className="p-3 text-center">Orders</th>
                                    <th className="p-3 text-center">Dine-In</th>
                                    <th className="p-3 text-center">Takeaway</th>
                                    <th className="p-3 text-center">Delivery</th>
                                    <th className="p-3 text-right">Realized Revenue</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 dark:divide-zinc-800">
                                {reportData.branchBreakdown.map((b: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-neutral-50/50 dark:hover:bg-zinc-800/30 transition">
                                        <td className="p-3">
                                            <div className="flex items-center gap-2.5">
                                                <Store size={14} className="text-amber-500" />
                                                <span className="font-bold text-neutral-900 dark:text-white">
                                                    {b.name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-center font-bold text-neutral-700 dark:text-neutral-300">
                                            {b.orders}
                                        </td>
                                        <td className="p-3 text-center text-neutral-500">
                                            {b.dineIn || 0}
                                        </td>
                                        <td className="p-3 text-center text-neutral-500">
                                            {b.takeaway || 0}
                                        </td>
                                        <td className="p-3 text-center text-neutral-500">
                                            {b.delivery || 0}
                                        </td>
                                        <td className="p-3 text-right">
                                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                ₹{b.revenue.toFixed(2)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
