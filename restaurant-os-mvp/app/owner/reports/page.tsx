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
    Flame,
    Zap,
    Filter,
    LayoutGrid,
    IndianRupee
} from 'lucide-react';
import { AnalyticsService, AnalyticsMetrics, TimeRange, OrderLogEntry } from '@/services/analytics.service';
import { TimeFilter } from '@/components/admin/analytics/TimeFilter';
import { LineChart, BarChart, DonutChart } from '@/components/admin/analytics/ProfessionalCharts';
import { DetailedTable } from '@/components/admin/analytics/DetailedTable';
import { formatCurrency } from '@/lib/utils';

export default function ReportsPage() {
    const { selectedRestaurantId, isAllRestaurants, currentRestaurant, restaurants } = useOwner();
    const [range, setRange] = useState<TimeRange>('7d');
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
    const [revenueTrend, setRevenueTrend] = useState<any[]>([]);
    const [statusBreakdown, setStatusBreakdown] = useState<any[]>([]);
    const [categoryRevenue, setCategoryRevenue] = useState<any[]>([]);
    const [paymentSplit, setPaymentSplit] = useState<any[]>([]);
    const [topDishes, setTopDishes] = useState<any[]>([]);
    const [slowDishes, setSlowDishes] = useState<any[]>([]);
    const [orderLog, setOrderLog] = useState<OrderLogEntry[]>([]);
    const [branchData, setBranchData] = useState<any[]>([]);

    // Target restaurant ID for analytics
    const targetRestaurantId = (!isAllRestaurants && selectedRestaurantId) 
        ? selectedRestaurantId 
        : (restaurants[0]?.id || '');

    const fetchAnalytics = useCallback(async () => {
        setLoading(true);
        try {
            if (targetRestaurantId) {
                const [
                    kpis, 
                    trends, 
                    status, 
                    cats, 
                    payments, 
                    top, 
                    slow, 
                    log
                ] = await Promise.all([
                    AnalyticsService.fetchKPIMetrics(targetRestaurantId, range),
                    AnalyticsService.fetchRevenueTrends(targetRestaurantId, range),
                    AnalyticsService.fetchOrderStatusBreakdown(targetRestaurantId, range),
                    AnalyticsService.fetchCategoryRevenue(targetRestaurantId, range),
                    AnalyticsService.fetchPaymentMethodSplit(targetRestaurantId, range),
                    AnalyticsService.fetchTopSellingItems(targetRestaurantId, range, 10),
                    AnalyticsService.fetchTopSellingItems(targetRestaurantId, range, 10, true),
                    AnalyticsService.fetchOrderLog(targetRestaurantId, range)
                ]);

                setMetrics(kpis);
                setRevenueTrend(trends || []);
                setStatusBreakdown(status || []);
                setCategoryRevenue(cats || []);
                setPaymentSplit(payments || []);
                setTopDishes(top || []);
                setSlowDishes(slow || []);
                setOrderLog(log || []);
            }

            // Also load aggregate branch breakdown
            const res = await fetch(`/api/owner/reports?period=all`);
            if (res.ok) {
                const data = await res.json();
                setBranchData(data?.branchBreakdown || []);
            }
        } catch (err) {
            console.error('Failed to load reports & analytics:', err);
        } finally {
            setLoading(false);
        }
    }, [targetRestaurantId, range]);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    const activeOutletName = (!isAllRestaurants && currentRestaurant) 
        ? currentRestaurant.name 
        : (restaurants.find(r => r.id === targetRestaurantId)?.name || 'All Outlets');

    return (
        <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight flex items-center gap-2.5">
                        <BarChart3 className="text-emerald-500" size={24} />
                        Executive Restaurant Analytics
                    </h2>
                    <p className="text-sm text-neutral-400 mt-0.5">
                        Real-time analytics and financial intelligence for <strong className="text-neutral-700 dark:text-neutral-200">{activeOutletName}</strong>
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchAnalytics()}
                        disabled={loading}
                        className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-neutral-200/60 dark:border-zinc-700/30 text-neutral-600 dark:text-neutral-300 hover:text-emerald-600 transition-colors cursor-pointer shadow-xs"
                        title="Refresh Analytics"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin text-emerald-500' : ''} />
                    </button>
                    <TimeFilter value={range} onChange={setRange} />
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <AnalyticsStatCard 
                    title="Total Realized Revenue" 
                    value={loading ? '...' : formatCurrency(metrics?.totalRevenue || 0)} 
                    icon={TrendingUp} 
                    color="emerald" 
                />
                <AnalyticsStatCard 
                    title="Total Orders Count" 
                    value={loading ? '...' : (metrics?.totalOrders || 0)} 
                    icon={ShoppingBag} 
                    color="orange" 
                />
                <AnalyticsStatCard 
                    title="Average Order Value" 
                    value={loading ? '...' : formatCurrency(metrics?.avgOrderValue || 0)} 
                    icon={Zap} 
                    color="blue" 
                />
                <AnalyticsStatCard 
                    title="Cancellation Rate" 
                    value={loading ? '...' : `${metrics?.cancellationRate || 0}%`} 
                    icon={Filter} 
                    color="red" 
                />
            </div>

            {/* Operations Row */}
            <div className="space-y-4">
                <h3 className="text-xs font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                    <LayoutGrid size={14} /> Operations & Demand Velocity
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <ChartContainer title="Revenue Over Time" subtitle="Trend analysis">
                        <LineChart data={revenueTrend} />
                    </ChartContainer>
                    <ChartContainer title="Order Volume" subtitle="Fulfillment peaks">
                        <BarChart data={revenueTrend} color="#8B5CF6" />
                    </ChartContainer>
                    <ChartContainer title="Order Status Breakdown" subtitle="Kitchen & delivery state">
                        <DonutChart data={statusBreakdown} />
                    </ChartContainer>
                </div>
            </div>

            {/* Revenue Breakdown Row */}
            <div className="space-y-4">
                <h3 className="text-xs font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                    <IndianRupee size={14} /> Settlement & Category Revenue
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <ChartContainer title="Revenue by Category" subtitle="Top performing menu sections">
                        <DonutChart data={categoryRevenue} />
                    </ChartContainer>
                    <ChartContainer title="Payment Settlement Methods" subtitle="UPI vs Cash vs Card">
                        <DonutChart data={paymentSplit} />
                    </ChartContainer>
                    <ChartContainer title="Average Order Value Trend" subtitle="Ticket size evolution">
                        <LineChart data={revenueTrend} color="#3B82F6" />
                    </ChartContainer>
                </div>
            </div>

            {/* Menu Performance Row */}
            <div className="space-y-4">
                <h3 className="text-xs font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                    <Utensils size={14} /> Menu Item Velocity
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ChartContainer title="Top 10 Selling Dishes" subtitle="By total quantity sold">
                        <BarChart data={topDishes} horizontal color="#10B981" />
                    </ChartContainer>
                    <ChartContainer title="Slow Moving Menu Items" subtitle="Low velocity items">
                        <BarChart data={slowDishes} horizontal color="#EF4444" />
                    </ChartContainer>
                </div>
            </div>

            {/* Tables: Recent Orders & Item Performance */}
            <div className="space-y-6">
                <DetailedTable 
                    title="Recent Order Log" 
                    data={orderLog}
                    columns={[
                        { key: 'order_number', label: 'Order #' },
                        { 
                            key: 'created_at', 
                            label: 'Time', 
                            render: (val: any) => val ? new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—' 
                        },
                        { key: 'table_number', label: 'Table' },
                        { key: 'items', label: 'Items' },
                        { key: 'total_amount', label: 'Amount', render: (val: any) => formatCurrency(val) },
                        { key: 'payment_method', label: 'Payment' },
                        { 
                            key: 'status', 
                            label: 'Status', 
                            render: (val: any) => (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    val === 'paid' || val === 'completed' || val === 'served'
                                        ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' 
                                        : 'bg-neutral-100 dark:bg-zinc-800 text-neutral-700 dark:text-neutral-300'
                                }`}>{val}</span>
                            )
                        }
                    ]}
                />

                <DetailedTable 
                    title="Menu Item Sales Breakdown" 
                    data={topDishes}
                    columns={[
                        { key: 'name', label: 'Dish Name' },
                        { key: 'category', label: 'Category' },
                        { key: 'quantity', label: 'Quantity Sold' },
                        { key: 'revenue', label: 'Gross Revenue', render: (val: any) => formatCurrency(val) }
                    ]}
                />
            </div>

            {/* Franchise Multi-Branch Breakdown Table */}
            {branchData.length > 0 && (
                <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-neutral-200/70 dark:border-zinc-800/80 p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-100 dark:border-zinc-800 pb-3">
                        <div className="flex items-center gap-2">
                            <Building2 size={16} className="text-amber-500" />
                            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                                Restaurant Branch Revenue & Orders Breakdown
                            </h3>
                        </div>
                        <span className="text-[10px] text-neutral-400 font-bold">
                            {branchData.length} Outlets Configured
                        </span>
                    </div>

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
                                {branchData.map((b: any, idx: number) => (
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
                                                ₹{parseFloat(b.revenue || 0).toFixed(2)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

function AnalyticsStatCard({ title, value, icon: Icon, color }: any) {
    const colorMap: any = {
        emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500',
        orange: 'bg-orange-50 dark:bg-orange-500/10 text-orange-500',
        blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-500',
        red: 'bg-red-50 dark:bg-red-500/10 text-red-500'
    };

    return (
        <div className="bg-white dark:bg-zinc-900 border border-neutral-200/70 dark:border-zinc-800 p-6 rounded-2xl shadow-xs hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${colorMap[color]} group-hover:scale-110 transition-transform`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            <div>
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{title}</p>
                <h3 className="text-2xl font-black text-neutral-900 dark:text-white mt-1">{value}</h3>
            </div>
        </div>
    );
}

function ChartContainer({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
    return (
        <div className="bg-white dark:bg-zinc-900 border border-neutral-200/70 dark:border-zinc-800 p-6 rounded-3xl shadow-xs space-y-4">
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="text-base font-bold text-neutral-900 dark:text-white">{title}</h4>
                    <p className="text-xs font-medium text-neutral-400">{subtitle}</p>
                </div>
            </div>
            <div className="w-full">
                {children}
            </div>
        </div>
    );
}
