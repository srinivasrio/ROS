'use client';

import React, { useEffect, useState } from 'react';
import { TrendingUp as LucideTrendingUp, Utensils as LucideUtensils, Users as LucideUsers, ArrowUpRight as LucideArrowUpRight, Clock as LucideClock, AlertCircle as LucideAlertCircle, CheckCircle2 as LucideCheckCircle2, Timer as LucideTimer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnalyticsService, AnalyticsMetrics, TimeRange } from '@/app/services/analytics';
import { OrderService } from '@/app/services/orders';
import { useRestaurantId } from '@/app/hooks/useRestaurantId';
import { getCached, setCache } from '@/app/lib/data-cache';
import { formatCurrency } from '@/app/lib/utils';
import { LineChart, DonutChart, BarChart } from '@/components/admin/analytics/ProfessionalCharts';
import { LoadingState } from '@/components/ui/LoadingState';

export default function AdminDashboard() {
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const cacheKey = `dashboard-v2-${restaurantId}`;
    const cached = getCached<any>(cacheKey);

    const [metrics, setMetrics] = useState<AnalyticsMetrics>(cached?.metrics || { 
        totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, cancellationRate: 0, 
        activeTables: 0, pendingKitchenOrders: 0 
    });
    const [revenueData, setRevenueData] = useState(cached?.revenueData || []);
    const [statusData, setStatusData] = useState(cached?.statusData || []);
    const [peakData, setPeakData] = useState(cached?.peakData || []);
    const [loading, setLoading] = useState(!cached);

    const loadData = async () => {
        if (!restaurantId) return;
        try {
            const [kpis, revenue, status, top] = await Promise.all([
                AnalyticsService.fetchKPIMetrics(restaurantId, 'today'),
                AnalyticsService.fetchRevenueTrends(restaurantId, 'today'),
                AnalyticsService.fetchOrderStatusBreakdown(restaurantId, 'today'),
                AnalyticsService.fetchTopSellingItems(restaurantId, 'today', 24) // Using for peak hours feel
            ]);

            setMetrics(kpis);
            setRevenueData(revenue);
            setStatusData(status);
            
            // Re-mapping revenue to peak hours format if needed, 
            // but let's use revenue data for the chart directly
            setPeakData(revenue); 

            setCache(cacheKey, { metrics: kpis, revenueData: revenue, statusData: status });
        } catch (error) {
            console.error('Dashboard load error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!restaurantLoading && restaurantId) {
            loadData();
            
            // Subscriptions for realtime updates
            const subOrders = OrderService.subscribeToOrders(restaurantId, () => loadData());
            const subItems = OrderService.subscribeToOrderItems(restaurantId, () => loadData());
            const subTables = OrderService.subscribeToTables(restaurantId, () => loadData());

            return () => {
                subOrders.unsubscribe();
                subItems.unsubscribe();
                subTables.unsubscribe();
            };
        }
    }, [restaurantId, restaurantLoading]);

    if (loading) return <LoadingState message="Preparing your kitchen snapshot..." fullScreen />;

    return (
        <div className="min-h-screen bg-[#FDFCFD] dark:bg-zinc-950 p-8 pt-6 space-y-8 overflow-y-auto no-scrollbar">
            {/* Header */}
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-black dark:text-white tracking-tight">
                        Today's <span className="text-orange-500">Live Snapshot</span> 🚀
                    </h1>
                    <p className="text-black font-medium mt-1">
                        Real-time tracking of your restaurant's performance.
                    </p>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-sm font-bold text-black dark:text-black uppercase tracking-wider">Live System Sync</span>
                </div>
            </header>

            {/* KPI Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard 
                    label="Today's Revenue" 
                    value={formatCurrency(metrics.totalRevenue)} 
                    icon={LucideTrendingUp}
                    color="text-emerald-500"
                    bg="bg-emerald-50 dark:bg-emerald-500/10"
                />
                <KPICard 
                    label="Orders Placed" 
                    value={(metrics.totalOrders ?? 0).toString()} 
                    icon={LucideUtensils}
                    color="text-orange-500"
                    bg="bg-orange-50 dark:bg-orange-500/10"
                />
                <KPICard 
                    label="Active Tables" 
                    value={(metrics.activeTables ?? 0).toString()} 
                    icon={LucideUsers}
                    color="text-blue-500"
                    bg="bg-blue-50 dark:bg-blue-500/10"
                    pulse
                />
                <KPICard 
                    label="Kitchen Progress" 
                    value={(metrics.pendingKitchenOrders ?? 0).toString()} 
                    icon={LucideTimer}
                    color="text-purple-500"
                    bg="bg-purple-50 dark:bg-purple-500/10"
                    pulse
                />
            </div>

            {/* KPI Row 2 - Efficiency */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-500">
                            <LucideArrowUpRight className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-black uppercase tracking-widest">Avg Order Value</p>
                            <h3 className="text-xl font-black text-black dark:text-white">{formatCurrency(metrics.avgOrderValue)}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${metrics.cancellationRate > 10 ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                            {metrics.cancellationRate > 10 ? <LucideAlertCircle className="w-6 h-6" /> : <LucideCheckCircle2 className="w-6 h-6" />}
                        </div>
                        <div>
                            <p className="text-xs font-bold text-black uppercase tracking-widest">Cancellation Rate</p>
                            <h3 className="text-xl font-black text-black dark:text-white">{metrics.cancellationRate}%</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Revenue Streams */}
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-bold text-black dark:text-white">Revenue Timeline</h2>
                            <p className="text-sm text-black font-medium">Hourly breakdown of sales today</p>
                        </div>
                    </div>
                    <LineChart data={revenueData} color="#F97316" />
                </div>

                {/* Order Status Breakdown */}
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
                    <h2 className="text-xl font-bold text-black dark:text-white">Order Status</h2>
                    <DonutChart data={statusData} />
                </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
                    <div className="flex items-center gap-2">
                        <LucideUsers className="w-5 h-5 text-orange-500" />
                        <h2 className="text-xl font-bold text-black dark:text-white">Customer Load By Hour</h2>
                    </div>
                    <BarChart data={peakData} color="#8B5CF6" />
                </div>

                <div className="bg-gradient-to-br from-orange-500 to-rose-600 p-8 rounded-3xl text-white shadow-xl shadow-orange-500/20 relative overflow-hidden">
                    <div className="relative z-10 space-y-4">
                        <h2 className="text-2xl font-black italic">CHEF'S INSIGHT 💡</h2>
                        <p className="text-lg font-medium opacity-90 leading-relaxed">
                            {metrics.activeTables > 5 
                                ? "Peak hours are starting! Ensure the kitchen is stocked and the floor team is ready." 
                                : "Steady pace today. A good time to refresh prep stations and check inventory levels."}
                        </p>
                        <button className="px-6 py-3 bg-white text-orange-600 font-bold rounded-xl shadow-lg hover:scale-105 transition-transform">
                            Optimize Operations
                        </button>
                    </div>
                    <LucideUtensils className="absolute -bottom-10 -right-10 w-64 h-64 opacity-10" />
                </div>
            </div>
        </div>
    );
}

function KPICard({ label, value, icon: Icon, color, bg, pulse = false }: any) {
    return (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative group hover:scale-[1.02] transition-all">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${bg} ${color} transition-transform group-hover:scale-110`}>
                    <Icon className="w-6 h-6" strokeWidth={2.5} />
                </div>
                {pulse && (
                    <span className="flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500 border-2 border-white"></span>
                    </span>
                )}
            </div>
            <div>
                <p className="text-xs font-bold text-black uppercase tracking-widest mb-1">{label}</p>
                <h3 className="text-2xl font-black text-black dark:text-white">{value}</h3>
            </div>
        </div>
    );
}
