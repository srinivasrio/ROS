'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { TrendingUp as LucideTrendingUp, PieChart as LucidePieChart, Zap as LucideZap, ShoppingBag as LucideShoppingBag, Download as LucideDownload, Filter as LucideFilter, LayoutGrid as LucideLayoutGrid, IndianRupee as LucideIndianRupee, Utensils as LucideUtensils } from 'lucide-react';
import { AnalyticsService, AnalyticsMetrics, TimeRange, OrderLogEntry } from '@/app/services/analytics';
import { useRestaurantId } from '@/app/hooks/useRestaurantId';
import { formatCurrency } from '@/app/lib/utils';
import { TimeFilter } from '@/components/admin/analytics/TimeFilter';
import { LineChart, BarChart, DonutChart } from '@/components/admin/analytics/ProfessionalCharts';
import { DetailedTable } from '@/components/admin/analytics/DetailedTable';
import { LoadingState } from '@/components/ui/LoadingState';

export default function AnalyticsPage() {
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    
    // State
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

    const loadData = useCallback(async () => {
        if (!restaurantId) return;
        setLoading(true);
        try {
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
                AnalyticsService.fetchKPIMetrics(restaurantId, range),
                AnalyticsService.fetchRevenueTrends(restaurantId, range),
                AnalyticsService.fetchOrderStatusBreakdown(restaurantId, range),
                AnalyticsService.fetchCategoryRevenue(restaurantId, range),
                AnalyticsService.fetchPaymentMethodSplit(restaurantId, range),
                AnalyticsService.fetchTopSellingItems(restaurantId, range, 10),
                AnalyticsService.fetchTopSellingItems(restaurantId, range, 10, true),
                AnalyticsService.fetchOrderLog(restaurantId, range)
            ]);

            setMetrics(kpis);
            setRevenueTrend(trends);
            setStatusBreakdown(status);
            setCategoryRevenue(cats);
            setPaymentSplit(payments);
            setTopDishes(top);
            setSlowDishes(slow);
            setOrderLog(log);
        } catch (error) {
            console.error('Analytics load error:', error);
        } finally {
            setLoading(false);
        }
    }, [restaurantId, range]);

    useEffect(() => {
        if (!restaurantLoading && restaurantId) {
            loadData();
        }
    }, [restaurantId, restaurantLoading, range, loadData]);

    return (
        <div className="min-h-screen bg-[#FDFCFD] dark:bg-zinc-950 p-8 pt-6 space-y-10 overflow-y-auto no-scrollbar">
            {/* Header Area */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-black dark:text-white tracking-tight flex items-center gap-3">
                        <LucidePieChart className="w-8 h-8 text-orange-500" />
                        Analytics <span className="text-black font-medium">Deep Dive</span>
                    </h1>
                    <p className="text-black font-medium mt-1 italic">
                        Comprehensive performance analysis for your restaurant.
                    </p>
                </div>
                <TimeFilter value={range} onChange={setRange} />
            </header>

            {loading ? (
                <LoadingState message="Processing Data..." />
            ) : (
                <div className="space-y-12 pb-20">
                    {/* KPI Summary */}
                    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <AnalyticsStatCard title="Total Revenue" value={formatCurrency(metrics?.totalRevenue || 0)} icon={LucideTrendingUp} color="emerald" />
                        <AnalyticsStatCard title="Orders Count" value={metrics?.totalOrders || 0} icon={LucideShoppingBag} color="orange" />
                        <AnalyticsStatCard title="Avg. Order Value" value={formatCurrency(metrics?.avgOrderValue || 0)} icon={LucideZap} color="blue" />
                        <AnalyticsStatCard title="Cancellation Rate" value={`${metrics?.cancellationRate}%`} icon={LucideFilter} color="red" />
                    </section>

                    {/* Operations Row */}
                    <section className="space-y-6">
                        <h3 className="text-sm font-black text-black uppercase tracking-[0.2em] flex items-center gap-2">
                            <LucideLayoutGrid className="w-4 h-4" />
                            Operations Row
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <ChartContainer title="Revenue Over Time" subtitle="Trend analysis">
                                <LineChart data={revenueTrend} />
                            </ChartContainer>
                            <ChartContainer title="Order Volume" subtitle="Peak activity">
                                <BarChart data={revenueTrend} color="#8B5CF6" />
                            </ChartContainer>
                            <ChartContainer title="Order Status" subtitle="Breakdown">
                                <DonutChart data={statusBreakdown} />
                            </ChartContainer>
                        </div>
                    </section>

                    {/* Revenue Row */}
                    <section className="space-y-6">
                        <h3 className="text-sm font-black text-black uppercase tracking-[0.2em] flex items-center gap-2">
                            <LucideIndianRupee className="w-4 h-4" />
                            Revenue Row
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <ChartContainer title="Revenue by Category" subtitle="Mains vs Starters">
                                <DonutChart data={categoryRevenue} />
                            </ChartContainer>
                            <ChartContainer title="Payment Methods" subtitle="UPI vs Cash">
                                <DonutChart data={paymentSplit} />
                            </ChartContainer>
                            <ChartContainer title="AOV Trend" subtitle="Ticket size evolution">
                                <LineChart data={revenueTrend} color="#3B82F6" />
                            </ChartContainer>
                        </div>
                    </section>

                    {/* Menu Row */}
                    <section className="space-y-6">
                        <h3 className="text-sm font-black text-black uppercase tracking-[0.2em] flex items-center gap-2">
                            <LucideUtensils className="w-4 h-4" />
                            Menu Row
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <ChartContainer title="Top 10 Dishes" subtitle="By quantity sold">
                                <BarChart data={topDishes} horizontal color="#10B981" />
                            </ChartContainer>
                            <ChartContainer title="Slow Moving" subtitle="Opportunity areas">
                                <BarChart data={slowDishes} horizontal color="#EF4444" />
                            </ChartContainer>
                        </div>
                    </section>

                    {/* Data Tables */}
                    <section className="space-y-8">
                        <DetailedTable 
                            title="Recent Order Log" 
                            data={orderLog}
                            columns={[
                                { key: 'order_number', label: 'Order #' },
                                { key: 'created_at', label: 'Time', render: (val) => new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
                                { key: 'table_number', label: 'Table' },
                                { key: 'items', label: 'Items' },
                                { key: 'total_amount', label: 'Amount', render: (val) => formatCurrency(val) },
                                { key: 'payment_method', label: 'Payment' },
                                { key: 'status', label: 'Status', render: (val) => (
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                        val === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-black'
                                    }`}>{val}</span>
                                )}
                            ]}
                        />

                        <DetailedTable 
                            title="Item Performance" 
                            data={topDishes}
                            columns={[
                                { key: 'name', label: 'Dish Name' },
                                { key: 'category', label: 'Category' },
                                { key: 'quantity', label: 'Sold Count' },
                                { key: 'revenue', label: 'Gross Revenue', render: (val) => formatCurrency(val) }
                            ]}
                        />
                    </section>
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
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${colorMap[color]} group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
            <div>
                <p className="text-[10px] font-black text-black uppercase tracking-widest">{title}</p>
                <h3 className="text-2xl font-black text-black dark:text-white mt-1">{value}</h3>
            </div>
        </div>
    );
}

function ChartContainer({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl shadow-sm space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="text-lg font-bold text-black dark:text-white">{title}</h4>
                    <p className="text-xs font-medium text-black">{subtitle}</p>
                </div>
            </div>
            <div className="w-full">
                {children}
            </div>
        </div>
    );
}
