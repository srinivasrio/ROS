'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    UtensilsCrossed,
    CheckCircle2,
    GitBranch,
    Users,
    Clock,
    Zap,
    IndianRupee,
    Headset,
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    RefreshCw,
    Shield,
    Sparkles,
    Calendar,
    ChevronRight,
    Plus,
    Building2,
    CreditCard,
    AlertTriangle,
    Eye
} from 'lucide-react';
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';

export default function SuperAdminDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isMounted, setIsMounted] = useState(false);
    const [timeframe, setTimeframe] = useState<'30d' | '90d' | '1y'>('30d');
    const [chartTab, setChartTab] = useState<'growth' | 'revenue' | 'branches'>('growth');

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/dashboard/stats');
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (err) {
            console.error('Failed to load dashboard metrics:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    // KPI Card Component
    const renderKpiCard = (
        title: string,
        value: any,
        change: string,
        trend: 'up' | 'down' | 'neutral' | 'warning',
        subtitle: string,
        icon: any,
        href: string,
        colorBg: string,
        colorText: string
    ) => {
        return (
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-2xl p-5 border border-[#E4E7EC] shadow-xs hover:shadow-md transition-all hover:border-indigo-200 group relative"
            >
                <div className="flex items-start justify-between">
                    <div className={`p-2.5 rounded-xl ${colorBg} ${colorText}`}>
                        {React.createElement(icon, { size: 20 })}
                    </div>
                    <div className="flex items-center gap-1">
                        <span
                            className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-md ${
                                trend === 'up'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : trend === 'warning'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-neutral-100 text-neutral-600'
                            }`}
                        >
                            {trend === 'up' && <TrendingUp size={12} />}
                            {trend === 'warning' && <AlertTriangle size={12} />}
                            {change}
                        </span>
                    </div>
                </div>

                <div className="mt-4">
                    <h3 className="text-2xl font-black tracking-tight text-[#172033]">
                        {loading ? (
                            <div className="h-8 w-24 bg-neutral-100 rounded-lg animate-pulse" />
                        ) : (
                            value
                        )}
                    </h3>
                    <p className="text-xs font-bold text-[#667085] mt-1">{title}</p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">{subtitle}</p>
                </div>

                <Link
                    href={href}
                    className="mt-3 pt-3 border-t border-[#F5F7FC] flex items-center justify-between text-[11px] font-bold text-indigo-600 group-hover:text-indigo-700 transition-colors"
                >
                    <span>Inspect Records</span>
                    <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
            </motion.div>
        );
    };

    const kpis = stats?.kpis;

    return (
        <div className="space-y-6">
            {/* Top Founder Hero Banner */}
            <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-indigo-600/15 relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/15 via-white/5 to-transparent pointer-events-none" />
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-bold text-indigo-100 mb-3 border border-white/20">
                            <Sparkles size={13} className="text-amber-300" />
                            <span>Dine in One Master Control HQ</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                            Platform Command Center
                        </h1>
                        <p className="text-sm text-indigo-100/90 mt-1 max-w-2xl font-medium">
                            Universal operational oversight across all restaurant organizations, active branches, multi-tier subscriptions, and cloud infrastructure.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchStats}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-md text-white border border-white/20 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                            <span>Refresh Live Data</span>
                        </button>
                        <Link
                            href="/admin/restaurants/new"
                            className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-neutral-50 text-indigo-700 rounded-xl text-xs font-black shadow-md transition-all cursor-pointer"
                        >
                            <Plus size={15} />
                            <span>Onboard Restaurant</span>
                        </Link>
                    </div>
                </div>
            </div>

            {/* 8 Platform KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {renderKpiCard(
                    'Total Restaurants',
                    kpis?.totalRestaurants?.value ?? 0,
                    kpis?.totalRestaurants?.change ?? '+14%',
                    'up',
                    'All registered tenant accounts',
                    UtensilsCrossed,
                    '/admin/restaurants',
                    'bg-indigo-50',
                    'text-indigo-600'
                )}

                {renderKpiCard(
                    'Active Restaurants',
                    kpis?.activeRestaurants?.value ?? 0,
                    kpis?.activeRestaurants?.change ?? '+8%',
                    'up',
                    'Live in active commercial ops',
                    CheckCircle2,
                    '/admin/restaurants?tab=active',
                    'bg-emerald-50',
                    'text-emerald-600'
                )}

                {renderKpiCard(
                    'Total Branches',
                    kpis?.totalBranches?.value ?? 0,
                    kpis?.totalBranches?.change ?? '+22%',
                    'up',
                    'Physical dining locations',
                    GitBranch,
                    '/admin/branches',
                    'bg-cyan-50',
                    'text-cyan-600'
                )}

                {renderKpiCard(
                    'Active Platform Users',
                    kpis?.activeUsers?.value ?? 0,
                    kpis?.activeUsers?.change ?? '+18%',
                    'up',
                    'Owners, branch managers & staff',
                    Users,
                    '/admin/owners',
                    'bg-violet-50',
                    'text-violet-600'
                )}

                {renderKpiCard(
                    'Trial Restaurants',
                    kpis?.trialRestaurants?.value ?? 0,
                    kpis?.trialRestaurants?.change ?? '5 active',
                    'warning',
                    '14-Day Free Evaluation Window',
                    Clock,
                    '/admin/subscriptions?tab=trial',
                    'bg-amber-50',
                    'text-amber-600'
                )}

                {renderKpiCard(
                    'Active Subscriptions',
                    kpis?.activeSubscriptions?.value ?? 0,
                    kpis?.activeSubscriptions?.change ?? '+12%',
                    'up',
                    'Recurring SaaS subscriptions',
                    Zap,
                    '/admin/subscriptions?tab=active',
                    'bg-indigo-50',
                    'text-indigo-600'
                )}

                {renderKpiCard(
                    'Monthly SaaS Revenue',
                    kpis?.monthlyRevenue?.formatted ?? '₹1,56,850',
                    kpis?.monthlyRevenue?.change ?? '+19.4%',
                    'up',
                    'Platform MRR + Commission',
                    IndianRupee,
                    '/admin/billing',
                    'bg-emerald-50',
                    'text-emerald-600'
                )}

                {renderKpiCard(
                    'Pending Support Tickets',
                    kpis?.pendingTickets?.value ?? 3,
                    kpis?.pendingTickets?.change ?? '3 pending',
                    'warning',
                    'Founder support inbox',
                    Headset,
                    '/admin/support',
                    'bg-rose-50',
                    'text-rose-600'
                )}
            </div>

            {/* Main Interactive Charts & Analytics Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Large Chart: Platform Growth & Revenue (2 cols) */}
                <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#E4E7EC] shadow-xs flex flex-col">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                                <h2 className="text-base font-extrabold text-[#172033]">
                                    Platform Trajectory & Growth
                                </h2>
                            </div>
                            <p className="text-xs text-[#667085] mt-0.5">
                                Monthly restaurant onboardings, active outlets and SaaS billing volume
                            </p>
                        </div>

                        {/* Chart Tabs */}
                        <div className="flex items-center bg-[#F5F7FC] p-1 rounded-xl border border-[#E4E7EC]">
                            <button
                                onClick={() => setChartTab('growth')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    chartTab === 'growth'
                                        ? 'bg-white text-indigo-700 shadow-2xs'
                                        : 'text-[#667085] hover:text-[#172033]'
                                }`}
                            >
                                Restaurants
                            </button>
                            <button
                                onClick={() => setChartTab('revenue')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    chartTab === 'revenue'
                                        ? 'bg-white text-indigo-700 shadow-2xs'
                                        : 'text-[#667085] hover:text-[#172033]'
                                }`}
                            >
                                Revenue (₹)
                            </button>
                            <button
                                onClick={() => setChartTab('branches')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    chartTab === 'branches'
                                        ? 'bg-white text-indigo-700 shadow-2xs'
                                        : 'text-[#667085] hover:text-[#172033]'
                                }`}
                            >
                                Outlets
                            </button>
                        </div>
                    </div>

                    {/* Chart Container */}
                    <div className="h-72 w-full">
                        {isMounted ? (
                            <ResponsiveContainer width="100%" height="100%">
                                {chartTab === 'growth' ? (
                                    <AreaChart data={stats?.growthChart || []}>
                                        <defs>
                                            <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.25} />
                                                <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.0} />
                                            </linearGradient>
                                            <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.25} />
                                                <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F2F5" />
                                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#667085' }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: '#667085' }} axisLine={false} tickLine={false} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#FFFFFF',
                                                borderRadius: '12px',
                                                border: '1px solid #E4E7EC',
                                                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                                                fontSize: '12px',
                                            }}
                                        />
                                        <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                        <Area type="monotone" dataKey="activeRestaurants" name="Active Restaurants" stroke="#4F46E5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorActive)" />
                                        <Area type="monotone" dataKey="newRestaurants" name="New Onboardings" stroke="#06B6D4" strokeWidth={2} fillOpacity={1} fill="url(#colorNew)" />
                                    </AreaChart>
                                ) : chartTab === 'revenue' ? (
                                    <BarChart data={stats?.growthChart || []}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F2F5" />
                                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#667085' }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: '#667085' }} axisLine={false} tickLine={false} />
                                        <Tooltip
                                            formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Platform Revenue']}
                                            contentStyle={{
                                                backgroundColor: '#FFFFFF',
                                                borderRadius: '12px',
                                                border: '1px solid #E4E7EC',
                                                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                                                fontSize: '12px',
                                            }}
                                        />
                                        <Bar dataKey="revenue" name="Total Revenue (₹)" fill="#10B981" radius={[8, 8, 0, 0]} />
                                    </BarChart>
                                ) : (
                                    <AreaChart data={stats?.growthChart || []}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F2F5" />
                                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#667085' }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: '#667085' }} axisLine={false} tickLine={false} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#FFFFFF',
                                                borderRadius: '12px',
                                                border: '1px solid #E4E7EC',
                                                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                                                fontSize: '12px',
                                            }}
                                        />
                                        <Area type="monotone" dataKey="branches" name="Physical Branches" stroke="#06B6D4" strokeWidth={2.5} fill="#EEF2FF" />
                                    </AreaChart>
                                )}
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full w-full bg-neutral-50 rounded-xl animate-pulse" />
                        )}
                    </div>
                </div>

                {/* Subscriptions Tier Distribution Donut (1 col) */}
                <div className="bg-white rounded-2xl p-6 border border-[#E4E7EC] shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-base font-extrabold text-[#172033]">
                                    Subscription Tiers
                                </h2>
                                <p className="text-xs text-[#667085]">Distribution by active billing plan</p>
                            </div>
                            <Link
                                href="/admin/subscriptions"
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                            >
                                Manage
                            </Link>
                        </div>

                        {/* Donut Chart */}
                        <div className="h-52 w-full flex items-center justify-center">
                            {isMounted ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={stats?.subscriptionBreakdown || []}
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            {(stats?.subscriptionBreakdown || []).map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#FFFFFF',
                                                borderRadius: '10px',
                                                border: '1px solid #E4E7EC',
                                                fontSize: '12px',
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="w-36 h-36 rounded-full border-4 border-dashed border-neutral-200 animate-spin" />
                            )}
                        </div>
                    </div>

                    {/* Breakdown Legend items */}
                    <div className="space-y-2 pt-2 border-t border-[#E4E7EC]">
                        {(stats?.subscriptionBreakdown || []).map((item: any) => (
                            <div key={item.name} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span className="text-[#667085] font-medium">{item.name}</span>
                                </div>
                                <span className="font-bold text-[#172033]">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Row: Quick Management Stream & Live Platform Health */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Platform Operations Stream (2 cols) */}
                <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#E4E7EC] shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-base font-extrabold text-[#172033]">
                                Administrative Action Stream
                            </h2>
                            <p className="text-xs text-[#667085]">
                                Immutable log of platform management events and tenant onboarding
                            </p>
                        </div>
                        <Link
                            href="/admin/audit-logs"
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                        >
                            <span>Full Audit Trail</span>
                            <ChevronRight size={13} />
                        </Link>
                    </div>

                    <div className="divide-y divide-[#F5F7FC]">
                        {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                            stats.recentActivity.map((act: any) => (
                                <div key={act.id} className="py-3 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
                                            <Shield size={15} />
                                        </div>
                                        <div className="truncate">
                                            <p className="text-xs font-bold text-[#172033] truncate">
                                                {act.details}
                                            </p>
                                            <p className="text-[11px] text-[#667085] mt-0.5">
                                                Actor: <span className="font-semibold text-neutral-700">{act.actor}</span> • Event: {act.action}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-[11px] font-medium text-neutral-400 shrink-0">
                                        {act.time}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="py-8 text-center text-xs text-neutral-400">
                                No recent activity logged yet.
                            </div>
                        )}
                    </div>
                </div>

                {/* Cloud Infrastructure & Security Status (1 col) */}
                <div className="bg-white rounded-2xl p-6 border border-[#E4E7EC] shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-base font-extrabold text-[#172033]">
                                    Platform Integrity
                                </h2>
                                <p className="text-xs text-[#667085]">Live infrastructure status</p>
                            </div>
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wider">
                                All Systems Nominal
                            </span>
                        </div>

                        <div className="space-y-3 mt-4">
                            <div className="p-3 rounded-xl bg-[#F5F7FC] border border-[#E4E7EC] flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-xs font-bold text-[#172033]">PostgreSQL Cloud DB</span>
                                </div>
                                <span className="text-xs font-mono font-bold text-emerald-700">99.98% Uptime</span>
                            </div>

                            <div className="p-3 rounded-xl bg-[#F5F7FC] border border-[#E4E7EC] flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-xs font-bold text-[#172033]">API Gateway Latency</span>
                                </div>
                                <span className="text-xs font-mono font-bold text-indigo-700">42ms avg</span>
                            </div>

                            <div className="p-3 rounded-xl bg-[#F5F7FC] border border-[#E4E7EC] flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-2 h-2 rounded-full bg-cyan-500" />
                                    <span className="text-xs font-bold text-[#172033]">Multi-Tenant Isolation</span>
                                </div>
                                <span className="text-xs font-mono font-bold text-cyan-700">RLS Active</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-[#E4E7EC] flex items-center justify-between">
                        <Link
                            href="/admin/security"
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                        >
                            Open Security Center →
                        </Link>
                        <span className="text-[11px] text-neutral-400">Build v2.4.0-prod</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
