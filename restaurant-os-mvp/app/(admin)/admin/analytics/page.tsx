'use client';

import { LucideTrendingUp, LucideArrowUpRight, LucideArrowDownRight, LucideIndianRupee } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AnalyticsService, AnalyticsMetrics, TopItem } from '@/app/services/analytics';
import { formatCurrency } from '@/app/lib/utils';

export default function Analytics() {
    const [metrics, setMetrics] = useState<AnalyticsMetrics>({ totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 });
    const [topItems, setTopItems] = useState<TopItem[]>([]);
    const [peakHours, setPeakHours] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadAnalytics = async () => {
            try {
                const [kpiData, itemsData, hoursData] = await Promise.all([
                    AnalyticsService.fetchKPIMetrics(),
                    AnalyticsService.fetchTopSellingItems(),
                    AnalyticsService.fetchPeakHours()
                ]);

                setMetrics(kpiData);
                setTopItems(itemsData);
                setPeakHours(hoursData);
            } catch (error) {
                console.error('Failed to load analytics:', error);
            } finally {
                setLoading(false);
            }
        };

        loadAnalytics();
    }, []);



    // Filter peak hours to showing meaningful range (e.g. 10 AM to 11 PM) for better chart visualization
    // Or just show standard lunch/dinner hours
    const chartHours = peakHours.slice(10, 24); // 10 AM to 11 PM
    const maxOrders = Math.max(...chartHours, 1); // Avoid dive by zero

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-neutral-900">Analytics</h2>
                <p className="text-neutral-500">Deep insights into your restaurant's performance.</p>
            </div>

            {loading ? (
                <div className="h-64 flex items-center justify-center text-neutral-400 animate-pulse">
                    Loading analytics...
                </div>
            ) : (
                <>
                    {/* Top 3 KPI */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <KPIBox
                            title="Total Revenue (All Time)"
                            value={formatCurrency(metrics.totalRevenue)}
                            change="Live"
                            isPositive={true}
                            icon={LucideIndianRupee}
                        />
                        <KPIBox
                            title="Total Orders"
                            value={metrics.totalOrders.toString()}
                            change="Live"
                            isPositive={true}
                            icon={LucideTrendingUp}
                        />
                        <KPIBox
                            title="Avg. Order Value"
                            value={formatCurrency(metrics.avgOrderValue)}
                            change="Live"
                            isPositive={true}
                            icon={LucideTrendingUp}
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Peak Hours Chart */}
                        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
                            <h3 className="text-lg font-bold text-neutral-900 mb-6">Peak Hours (Orders)</h3>
                            <div className="h-64 flex items-end justify-between gap-2 px-2">
                                {chartHours.map((count, i) => {
                                    const hour = i + 10; // offset index by start hour
                                    const heightPercent = maxOrders > 0 ? (count / maxOrders) * 100 : 0;

                                    return (
                                        <div key={i} className="w-full flex flex-col items-center gap-2 group">
                                            <div
                                                className="w-full bg-blue-100 rounded-t-sm group-hover:bg-blue-600 transition-colors relative min-h-[4px]"
                                                style={{ height: `${Math.max(heightPercent, 5)}%` }}
                                            >
                                                <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-neutral-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                                                    {count} orders
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-neutral-400">
                                                {hour > 12 ? hour - 12 : hour}{hour >= 12 ? 'pm' : 'am'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-4 text-center text-xs text-neutral-500">Time of Day (10 AM - 11 PM)</div>
                        </div>

                        {/* Top Selling Items */}
                        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
                            <h3 className="text-lg font-bold text-neutral-900 mb-4">Top Selling Items</h3>
                            <div className="space-y-4">
                                {topItems.length === 0 ? (
                                    <p className="text-neutral-400 text-sm text-center py-10">No sales data yet.</p>
                                ) : (
                                    topItems.map((item, index) => {
                                        const maxCount = topItems[0].count; // Highest count for scale
                                        const percent = (item.count / maxCount) * 100;

                                        return (
                                            <TopItemrank
                                                key={item.id}
                                                rank={index + 1}
                                                name={item.name}
                                                count={item.count}
                                                percent={percent}
                                            />
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function KPIBox({ title, value, change, isPositive, icon: Icon }: { title: string; value: string; change: string; isPositive: boolean, icon: any }) {
    return (
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
            <div className="flex justify-between items-start">
                <p className="text-sm font-medium text-neutral-500">{title}</p>
                <div className="p-2 bg-neutral-50 rounded-lg">
                    <Icon size={18} className="text-neutral-400" />
                </div>
            </div>
            <div className="flex items-baseline justify-between mt-2">
                <h3 className="text-2xl font-bold text-neutral-900">{value}</h3>
                <span className={`hidden items-center text-xs font-bold px-2 py-0.5 rounded-full ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {isPositive ? <LucideArrowUpRight size={14} className="mr-1" /> : <LucideArrowDownRight size={14} className="mr-1" />}
                    {change}
                </span>
            </div>
        </div>
    );
}

function TopItemrank({ rank, name, count, percent }: { rank: number; name: string; count: number; percent: number }) {
    return (
        <div className="flex items-center gap-4">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-100 text-neutral-600 flex items-center justify-center text-xs font-bold">
                #{rank}
            </span>
            <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-neutral-800">{name}</span>
                    <span className="text-neutral-500">{count} orders</span>
                </div>
                <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${percent}%` }}></div>
                </div>
            </div>
        </div>
    );
}
