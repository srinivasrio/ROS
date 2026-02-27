'use client';

import {
    LucideSearch,
    LucideMoreHorizontal,
    LucideHelpCircle,
    LucideBell,
    LucideSettings,
    LucidePlus,
    LucideChevronDown,
    LucideInfo,
    LucideUsers,
    LucideTrendingUp,
    LucideClock
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AnalyticsService, AnalyticsMetrics, TopItem } from '@/app/services/analytics';
import { OrderService, type Order } from '@/app/services/orders';
import { formatCurrency } from '@/app/lib/utils';

export default function AdminDashboard() {
    const [metrics, setMetrics] = useState<AnalyticsMetrics>({ totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 });
    const [activeOrders, setActiveOrders] = useState<Order[]>([]);
    const [occupancy, setOccupancy] = useState(0);
    const [topItems, setTopItems] = useState<TopItem[]>([]);
    const [peakHours, setPeakHours] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadDashboardData = async () => {
            try {
                const [kpiData, ordersData, tablesData, topItemsData, peakHoursData] = await Promise.all([
                    AnalyticsService.fetchKPIMetrics(),
                    OrderService.fetchActiveOrders(),
                    OrderService.fetchTables(),
                    AnalyticsService.fetchTopSellingItems(),
                    AnalyticsService.fetchPeakHours()
                ]);

                setMetrics(kpiData);
                setActiveOrders(ordersData || []);
                setTopItems(topItemsData || []);
                setPeakHours(peakHoursData || []);

                if (tablesData && tablesData.length > 0) {
                    // Fix: Calculate occupancy based on Active Orders (source of truth) rather than table status (which can be stale)
                    const uniqueOccupiedTables = new Set(ordersData?.map(o => o.table_id) || []);
                    const occupiedCount = uniqueOccupiedTables.size;
                    setOccupancy(Math.round((occupiedCount / tablesData.length) * 100));
                } else {
                    setOccupancy(0);
                }

            } catch (error) {
                console.error('Failed to load dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadDashboardData();

        const subDocs = [
            OrderService.subscribeToOrders(() => loadDashboardData()),
            OrderService.subscribeToOrderItems(() => loadDashboardData()),
            OrderService.subscribeToTables(() => loadDashboardData())
        ];

        return () => {
            subDocs.forEach(sub => sub.unsubscribe());
        };

    }, []);



    return (
        <div className="max-w-[1200px] mx-auto space-y-6 pb-8">
            {/* Header Toolbar (Compact) */}
            <div className="flex justify-between items-center py-2">
                <div className="relative">
                    <LucideSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search"
                        className="pl-9 pr-4 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/10 placeholder:text-neutral-400"
                    />
                </div>
                <div className="flex items-center gap-3 text-neutral-500">
                    <LucideHelpCircle size={18} className="hover:text-neutral-900 cursor-pointer" />
                    <LucideBell size={18} className="hover:text-neutral-900 cursor-pointer" />
                    <button className="bg-blue-600 text-white p-1 rounded-full hover:bg-blue-700 transition-colors">
                        <LucidePlus size={16} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="h-64 flex items-center justify-center text-neutral-300">Loading data...</div>
            ) : (
                <>
                    {/* Today Section (Ultra Compact) */}
                    <div>
                        <h2 className="text-xl font-bold text-neutral-900 mb-3">Today</h2>
                        <div className="border border-neutral-100 rounded-xl p-6 flex bg-white shadow-sm">
                            {/* Left: Gross Volume & Chart */}
                            <div className="flex-1 pr-8 border-r border-neutral-100">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-medium text-neutral-500">Gross volume</span>
                                        </div>
                                        <div className="text-3xl font-medium text-neutral-900">{formatCurrency(metrics.totalRevenue)}</div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-sm font-medium text-neutral-500">Yesterday</span>
                                        <div className="text-lg font-medium text-neutral-400">{formatCurrency(metrics.totalRevenue * 0.85)}</div>
                                    </div>
                                </div>
                                <div className="h-20 w-full">
                                    <SimpleLineChart height={80} data={[10, 25, 20, 45, 40, 60, 55, 65, 50, 40, 60]} color="#6366f1" />
                                </div>
                            </div>

                            {/* Right: Key Metrics */}
                            <div className="w-72 pl-8 flex flex-col justify-between">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-medium text-neutral-500">Active Orders</span>
                                    <div className="text-xl font-medium text-neutral-900">{activeOrders.length}</div>
                                </div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-medium text-neutral-500">Occupancy</span>
                                    <div className="text-xl font-medium text-neutral-900">{occupancy}%</div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-neutral-500">Avg Order Value</span>
                                    <div className="text-xl font-medium text-neutral-900">{formatCurrency(metrics.avgOrderValue)}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Analytics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Top Selling Items */}
                        <div className="bg-white p-6 rounded-xl border border-neutral-100 shadow-sm">
                            <div className="flex items-center gap-2 mb-6">
                                <LucideTrendingUp size={18} className="text-blue-600" />
                                <h3 className="font-bold text-neutral-900">Top Selling Items</h3>
                            </div>
                            <div className="space-y-4">
                                {topItems.length === 0 ? (
                                    <div className="text-center text-neutral-400 text-sm py-4">No sales data yet.</div>
                                ) : (
                                    topItems.map((item, i) => (
                                        <div key={item.id} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="size-6 rounded bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-500">
                                                    {i + 1}
                                                </div>
                                                <span className="text-sm font-medium text-neutral-700">{item.name}</span>
                                            </div>
                                            <div className="text-sm font-bold text-neutral-900">{item.count} sold</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Peak Business Hours */}
                        <div className="bg-white p-6 rounded-xl border border-neutral-100 shadow-sm">
                            <div className="flex items-center gap-2 mb-6">
                                <LucideClock size={18} className="text-orange-500" />
                                <h3 className="font-bold text-neutral-900">Peak Business Hours</h3>
                            </div>
                            <div className="h-48 flex items-end gap-1">
                                {peakHours.map((count, hour) => {
                                    const max = Math.max(...peakHours, 1);
                                    const heightPercent = (count / max) * 100;
                                    const isPeak = count === max && count > 0;

                                    // Simplify: Show label every 6 hours
                                    const showLabel = hour % 6 === 0;

                                    return (
                                        <div key={hour} className="flex-1 flex flex-col items-center gap-1 group relative">
                                            {/* Tooltip */}
                                            <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-black text-white text-[10px] px-2 py-1 rounded transition-opacity pointer-events-none whitespace-nowrap z-10">
                                                {hour}:00 - {count} orders
                                            </div>

                                            <div
                                                style={{ height: `${heightPercent || 2}%` }}
                                                className={`w-full rounded-t-sm transition-all ${isPeak ? 'bg-orange-500' : 'bg-neutral-200 hover:bg-orange-200'}`}
                                            />
                                            {showLabel && (
                                                <span className="text-[10px] text-neutral-400 absolute -bottom-4">{hour}h</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>


                </>
            )}
        </div>
    );
}

function SimpleLineChart({ height, data, color }: { height: number, data: number[], color: string }) {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((d - min) / range) * 100;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible" preserveAspectRatio="none">
            {/* Gradient Definition */}
            <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={color} stopOpacity="0.1" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>

            {/* Area under curve */}
            <path
                d={`M 0,100 L 0,${100 - ((data[0] - min) / range) * 100} ${points.split(' ').map((p, i) => `L ${p}`).join(' ')} L 100,100 Z`}
                fill="url(#gradient)"
                stroke="none"
            />
            {/* The Line */}
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                points={points}
                vectorEffect="non-scaling-stroke"
            />
            {/* End Dot */}
            <circle
                cx="100"
                cy={100 - ((data[data.length - 1] - min) / range) * 100}
                r="3"
                fill={color}
                stroke="white"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
}
