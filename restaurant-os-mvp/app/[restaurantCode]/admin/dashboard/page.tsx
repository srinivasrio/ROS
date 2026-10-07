'use client';

import React, { useEffect, useState } from 'react';
import { TrendingUp as LucideTrendingUp, Utensils as LucideUtensils, Users as LucideUsers, ArrowUpRight as LucideArrowUpRight, Clock as LucideClock, AlertCircle as LucideAlertCircle, CheckCircle2 as LucideCheckCircle2, Timer as LucideTimer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnalyticsService, AnalyticsMetrics, TimeRange } from '@/services/analytics.service';
import { OrderService } from '@/services/orders.service';
import { useRestaurantId } from '@/hooks/useRestaurantId';
import { getCached, setCache, hasFreshCache } from '@/lib/data-cache';
import { formatCurrency } from '@/lib/utils';
import { LineChart, DonutChart, BarChart } from '@/components/admin/analytics/ProfessionalCharts';
import { LoadingState } from '@/components/ui/LoadingState';

import { useParams } from 'next/navigation';

import { SyncIndicator } from '@/components/admin/SyncIndicator';

export default function AdminDashboard() {
    const params = useParams();
    const urlRestaurantCode = (params?.restaurantCode as string) || '';
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const activeResId = restaurantId || urlRestaurantCode;
    const cacheKey = `dashboard-v2-${activeResId}`;
    const cached = getCached<any>(cacheKey) || (urlRestaurantCode ? getCached<any>(`dashboard-v2-${urlRestaurantCode}`) : null);

    const [metrics, setMetrics] = useState<AnalyticsMetrics>(cached?.metrics || { 
        totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, cancellationRate: 0, 
        activeTables: 0, pendingKitchenOrders: 0 
    });
    const safeMetrics = metrics || { 
        totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, cancellationRate: 0, 
        activeTables: 0, pendingKitchenOrders: 0 
    };
    const [revenueData, setRevenueData] = useState(cached?.revenueData || []);
    const [statusData, setStatusData] = useState(cached?.statusData || []);
    const [peakData, setPeakData] = useState(cached?.peakData || []);
    const [loading, setLoading] = useState(!cached);
    const [isRevalidating, setIsRevalidating] = useState(false);

    const loadData = async (force = false) => {
        const targetId = restaurantId || urlRestaurantCode;
        if (!targetId) return;
        const currentCacheKey = `dashboard-v2-${targetId}`;

        // If fresh cache exists and not forced by Realtime event, use cache and skip network queries
        if (!force && hasFreshCache(currentCacheKey)) {
            const cachedData = getCached<any>(currentCacheKey);
            if (cachedData) {
                if (cachedData.metrics) setMetrics(cachedData.metrics);
                if (cachedData.revenueData) {
                    setRevenueData(cachedData.revenueData);
                    setPeakData(cachedData.revenueData);
                }
                if (cachedData.statusData) setStatusData(cachedData.statusData);
                setLoading(false);
                return;
            }
        }

        setIsRevalidating(true);
        try {
            const [kpis, revenue, status] = await Promise.all([
                AnalyticsService.fetchKPIMetrics(targetId, 'today'),
                AnalyticsService.fetchRevenueTrends(targetId, 'today'),
                AnalyticsService.fetchOrderStatusBreakdown(targetId, 'today'),
            ]);

            if (kpis) setMetrics(kpis);
            if (revenue) {
                setRevenueData(revenue);
                setPeakData(revenue);
            }
            if (status) setStatusData(status);

            const payload = { metrics: kpis, revenueData: revenue, statusData: status, peakData: revenue };
            setCache(currentCacheKey, payload, { isRealtime: true });
            if (restaurantId && urlRestaurantCode && restaurantId !== urlRestaurantCode) {
                setCache(`dashboard-v2-${restaurantId}`, payload, { isRealtime: true });
                setCache(`dashboard-v2-${urlRestaurantCode}`, payload, { isRealtime: true });
            }
        } catch (error) {
            console.error('Dashboard load error:', error);
        } finally {
            setLoading(false);
            setIsRevalidating(false);
        }
    };

    useEffect(() => {
        if (!restaurantLoading && activeResId) {
            loadData(false);
            
            let debounceTimer: NodeJS.Timeout | null = null;
            const debouncedLoad = () => {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    loadData(true);
                }, 400);
            };

            // Subscriptions for realtime updates with debouncing
            const subOrders = OrderService.subscribeToOrders(activeResId, debouncedLoad);
            const subItems = OrderService.subscribeToOrderItems(activeResId, debouncedLoad);
            const subTables = OrderService.subscribeToTables(activeResId, debouncedLoad);

            return () => {
                if (debounceTimer) clearTimeout(debounceTimer);
                subOrders.unsubscribe();
                subItems.unsubscribe();
                subTables.unsubscribe();
            };
        }
    }, [activeResId, restaurantLoading]);

    if (loading && !cached) return <LoadingState message="Preparing your kitchen snapshot..." fullScreen />;

    return (
        <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="min-h-screen p-8 pt-6 space-y-8 overflow-y-auto premium-scrollbar"
        >
            {/* Header */}
            <header className="flex justify-end items-center gap-3">
                <SyncIndicator isRevalidating={isRevalidating} />
                <div className="bg-white/80 dark:bg-zinc-900/60 backdrop-blur-md border border-neutral-200/50 dark:border-zinc-800/40 px-4 py-2.5 rounded-2xl flex items-center gap-2.5 shadow-sm shadow-black/5">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-md shadow-emerald-500/50" />
                    <span className="text-[11px] font-black text-neutral-700 dark:text-neutral-300 uppercase tracking-widest">Live Sync</span>
                </div>
            </header>

            {/* KPI Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard 
                    label="Today's Revenue" 
                    value={formatCurrency(safeMetrics.totalRevenue || 0)} 
                    icon={LucideTrendingUp}
                    color="text-emerald-500"
                    bg="bg-emerald-500/10"
                    index={0}
                />
                <KPICard 
                    label="Orders Placed" 
                    value={(safeMetrics.totalOrders ?? 0).toString()} 
                    icon={LucideUtensils}
                    color="text-orange-500"
                    bg="bg-orange-500/10"
                    index={1}
                />
                <KPICard 
                    label="Active Tables" 
                    value={(safeMetrics.activeTables ?? 0).toString()} 
                    icon={LucideUtensils}
                    color="text-blue-500"
                    bg="bg-blue-500/10"
                    pulse
                    index={2}
                />
                <KPICard 
                    label="Kitchen Progress" 
                    value={(safeMetrics.pendingKitchenOrders ?? 0).toString()} 
                    icon={LucideTimer}
                    color="text-purple-500"
                    bg="bg-purple-500/10"
                    pulse
                    index={3}
                />
            </div>

            {/* KPI Row 2 - Efficiency */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <motion.div 
                    whileHover={{ y: -3 }}
                    className="premium-glass-card p-6 rounded-3xl flex items-center justify-between premium-shadow-soft relative overflow-hidden group border-neutral-200/40"
                >
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-3.5 bg-indigo-500/10 rounded-2xl text-indigo-500 transition-transform group-hover:scale-110">
                            <LucideArrowUpRight className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Avg Order Value</p>
                            <h3 className="text-2xl font-black text-neutral-800 dark:text-white mt-0.5">{formatCurrency(safeMetrics.avgOrderValue || 0)}</h3>
                        </div>
                    </div>
                </motion.div>
                <motion.div 
                    whileHover={{ y: -3 }}
                    className="premium-glass-card p-6 rounded-3xl flex items-center justify-between premium-shadow-soft relative overflow-hidden group border-neutral-200/40"
                >
                    <div className="flex items-center gap-4 relative z-10">
                        <div className={`p-3.5 rounded-2xl transition-transform group-hover:scale-110 ${(safeMetrics.cancellationRate || 0) > 10 ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                            {(safeMetrics.cancellationRate || 0) > 10 ? <LucideAlertCircle className="w-6 h-6" /> : <LucideCheckCircle2 className="w-6 h-6" />}
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Cancellation Rate</p>
                            <h3 className="text-2xl font-black text-neutral-800 dark:text-white mt-0.5">{safeMetrics.cancellationRate || 0}%</h3>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Revenue Streams */}
                <div className="lg:col-span-2 premium-glass-card p-8 rounded-[2rem] premium-shadow-soft space-y-6 border-neutral-200/40">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-black text-neutral-800 dark:text-white">Revenue Timeline</h2>
                            <p className="text-sm text-neutral-400 font-semibold">Hourly breakdown of sales today</p>
                        </div>
                    </div>
                    <div className="pt-2">
                        <LineChart data={revenueData} color="#F97316" />
                    </div>
                </div>

                {/* Order Status Breakdown */}
                <div className="premium-glass-card p-8 rounded-[2rem] premium-shadow-soft space-y-6 border-neutral-200/40">
                    <div>
                        <h2 className="text-xl font-black text-neutral-800 dark:text-white">Order Status</h2>
                        <p className="text-sm text-neutral-400 font-semibold">Total fulfillment state</p>
                    </div>
                    <div className="flex items-center justify-center pt-2">
                        <DonutChart data={statusData} />
                    </div>
                </div>
            </div>


        </motion.div>
    );
}

function KPICard({ label, value, icon: Icon, color, bg, pulse = false, index = 0 }: any) {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.08 }}
            whileHover={{ y: -4 }}
            className="premium-glass-card p-6 rounded-3xl premium-shadow-soft relative overflow-hidden group border-neutral-200/40"
        >
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3.5 rounded-2xl ${bg} ${color} transition-transform group-hover:scale-110 shadow-sm shadow-black/2`}>
                    <Icon className="w-5 h-5" strokeWidth={2.5} />
                </div>
                {pulse && (
                    <span className="flex h-3.5 w-3.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-orange-500 border-2.5 border-white dark:border-zinc-900 shadow-sm shadow-orange-500/50"></span>
                    </span>
                )}
            </div>
            <div>
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">{label}</p>
                <h3 className="text-3xl font-black text-neutral-800 dark:text-white tracking-tight">{value}</h3>
            </div>
        </motion.div>
    );
}
