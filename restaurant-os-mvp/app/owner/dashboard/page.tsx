'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useOwner } from '@/context/OwnerContext';
import {
    TrendingUp, ShoppingBag, Building2, Users, UserCircle, Clock,
    ArrowUpRight, ArrowDownRight, DollarSign, Activity, Zap,
    BarChart3, PieChart, Star, ChevronRight, Plus, RefreshCw, ArrowRight,
    Sparkles
} from 'lucide-react';
import FeatureLockedGate from '@/components/FeatureLockedGate';

// ─── Animated counter ───────────────────────────────────────
function AnimatedNumber({ value = 0, prefix = '', suffix = '', decimals = 0 }: { value?: number; prefix?: string; suffix?: string; decimals?: number }) {
    const target = typeof value === 'number' && !isNaN(value) ? value : 0;
    const [display, setDisplay] = useState(0);

    useEffect(() => {
        const duration = 800;
        const startTime = Date.now();
        const startVal = display;

        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            setDisplay(startVal + (target - startVal) * eased);
            if (progress < 1) requestAnimationFrame(animate);
        }

        requestAnimationFrame(animate);
    }, [target]);

    const formatted = decimals > 0 
        ? display.toFixed(decimals)
        : Math.round(display).toLocaleString('en-IN');

    return <span className="tabular-nums">{prefix}{formatted}{suffix}</span>;
}

// ─── Skeleton loader ────────────────────────────────────────
function CardSkeleton() {
    return (
        <div className="premium-glass-card p-6 rounded-3xl border border-neutral-200/40 dark:border-zinc-800/40 animate-pulse">
            <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-2xl bg-neutral-200/60 dark:bg-zinc-800" />
                <div className="w-16 h-5 rounded-full bg-neutral-200/60 dark:bg-zinc-800" />
            </div>
            <div className="w-20 h-3 rounded bg-neutral-200/60 dark:bg-zinc-800 mb-2" />
            <div className="w-28 h-8 rounded bg-neutral-200/60 dark:bg-zinc-800" />
        </div>
    );
}

// ─── KPI Card ───────────────────────────────────────────────
function KPICard({ label, value, prefix, suffix, icon: Icon, color, bgColor, trend, trendValue, index = 0, pulse = false }: {
    label: string; value: number; prefix?: string; suffix?: string;
    icon: any; color: string; bgColor: string;
    trend?: 'up' | 'down' | 'neutral'; trendValue?: string;
    index?: number; pulse?: boolean;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="premium-glass-card p-6 rounded-3xl premium-shadow-soft relative overflow-hidden group border border-neutral-200/40 dark:border-zinc-800/40 cursor-default"
        >
            {/* Subtle hover glow */}
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${bgColor} blur-3xl -z-10`} style={{ transform: 'scale(0.5)' }} />

            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl ${bgColor} ${color} transition-transform duration-300 group-hover:scale-110 shadow-sm`}>
                    <Icon size={20} strokeWidth={2.2} />
                </div>
                {pulse && (
                    <span className="flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-indigo-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500 border-2 border-white dark:border-zinc-900 shadow-sm" />
                    </span>
                )}
                {trend && trendValue && (
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold ${
                        trend === 'up' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600' :
                        trend === 'down' ? 'bg-red-50 dark:bg-red-950/30 text-red-500' :
                        'bg-neutral-100 dark:bg-zinc-800 text-neutral-500'
                    }`}>
                        {trend === 'up' ? <ArrowUpRight size={12} /> : trend === 'down' ? <ArrowDownRight size={12} /> : null}
                        {trendValue}
                    </div>
                )}
            </div>

            <div>
                <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.12em] mb-1">{label}</p>
                <h3 className="text-3xl font-black text-neutral-800 dark:text-white tracking-tight">
                    <AnimatedNumber value={value} prefix={prefix} suffix={suffix} />
                </h3>
            </div>
        </motion.div>
    );
}

// ─── Mini chart placeholder ─────────────────────────────────
function MiniBarChart({ data, color }: { data: number[]; color: string }) {
    const max = Math.max(...data, 1);
    return (
        <div className="flex items-end gap-1 h-16">
            {data.map((val, i) => (
                <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${(val / max) * 100}%` }}
                    transition={{ duration: 0.5, delay: i * 0.05, ease: [0.2, 0.8, 0.2, 1] }}
                    className={`flex-1 rounded-t-sm ${color} min-h-[3px]`}
                    style={{ opacity: 0.5 + (val / max) * 0.5 }}
                />
            ))}
        </div>
    );
}

// ─── Activity item ──────────────────────────────────────────
function ActivityItem({ action, detail, time, icon: Icon, color }: {
    action: string; detail: string; time: string; icon: any; color: string;
}) {
    return (
        <div className="flex items-start gap-3 py-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon size={14} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{action}</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 truncate">{detail}</p>
            </div>
            <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 whitespace-nowrap">{time}</span>
        </div>
    );
}

// ─── Branch performance row ─────────────────────────────────
function BranchPerformanceRow({ name, revenue, orders, index }: {
    name: string; revenue: number; orders: number; index: number;
}) {
    const safeName = name || 'Restaurant';
    const safeRev = typeof revenue === 'number' && !isNaN(revenue) ? revenue : 0;
    const safeOrders = typeof orders === 'number' && !isNaN(orders) ? orders : 0;
    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08 }}
            className="flex items-center gap-4 py-3 group"
        >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-950/30 dark:to-violet-950/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-black flex-shrink-0 group-hover:scale-110 transition-transform">
                {safeName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300 truncate">{safeName}</p>
                <p className="text-[11px] text-neutral-400">{safeOrders} orders</p>
            </div>
            <p className="text-sm font-black text-neutral-800 dark:text-white tabular-nums">₹{safeRev.toLocaleString('en-IN')}</p>
        </motion.div>
    );
}

// ─── Main Dashboard ─────────────────────────────────────────
export default function OwnerDashboard() {
    const { restaurant, branches, isAllBranches, currentBranch, selectedBranchId } = useOwner();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Mock data — will be replaced with real API calls
    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalOrders: 0,
        activeBranches: 0,
        totalEmployees: 0,
        totalCustomers: 0,
        pendingOrders: 0,
    });
    const [branchPerformanceData, setBranchPerformanceData] = useState<any[]>([]);
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [weeklyRevenue, setWeeklyRevenue] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
    const [weeklyOrders, setWeeklyOrders] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
    const [trendDays, setTrendDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

    const loadDashboard = useCallback(async () => {
        setRefreshing(true);
        try {
            const res = await fetch(`/api/owner/dashboard?branch=${selectedBranchId}`);
            if (res.ok) {
                const data = await res.json();
                setStats({
                    totalRevenue: data.totalRevenue ?? 0,
                    totalOrders: data.totalOrders ?? 0,
                    activeBranches: data.activeBranches ?? (branches.filter(b => b.status === 'active').length || 0),
                    totalEmployees: data.totalEmployees ?? 0,
                    totalCustomers: data.totalCustomers ?? 0,
                    pendingOrders: data.pendingOrders ?? 0,
                });
                if (data.branchBreakdown && data.branchBreakdown.length > 0) {
                    setBranchPerformanceData(data.branchBreakdown);
                } else {
                    setBranchPerformanceData(branches.map(b => ({ name: b.name, revenue: 0, orders: 0 })));
                }
                if (data.weeklyRevenue) setWeeklyRevenue(data.weeklyRevenue);
                if (data.weeklyOrders) setWeeklyOrders(data.weeklyOrders);
                if (data.trendDays) setTrendDays(data.trendDays);
                if (data.recentActivity && data.recentActivity.length > 0) {
                    setRecentActivity(data.recentActivity.map((item: any) => ({
                        action: item.action,
                        detail: item.detail,
                        time: item.time,
                        icon: ShoppingBag,
                        color: 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600'
                    })));
                } else {
                    setRecentActivity([]);
                }
            } else {
                setStats({
                    totalRevenue: 0,
                    totalOrders: 0,
                    activeBranches: branches.filter(b => b.status === 'active').length || 0,
                    totalEmployees: 0,
                    totalCustomers: 0,
                    pendingOrders: 0,
                });
                setBranchPerformanceData(branches.map(b => ({ name: b.name, revenue: 0, orders: 0 })));
                setRecentActivity([]);
            }
        } catch {
            setStats({
                totalRevenue: 0,
                totalOrders: 0,
                activeBranches: branches.filter(b => b.status === 'active').length || 0,
                totalEmployees: 0,
                totalCustomers: 0,
                pendingOrders: 0,
            });
            setBranchPerformanceData(branches.map(b => ({ name: b.name, revenue: 0, orders: 0 })));
            setRecentActivity([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedBranchId, branches]);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    if (loading) {
        return (
            <div className="p-6 lg:p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
                    {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
                </div>
            </div>
        );
    }

    if (restaurant?.primaryEntitlement?.isSuspended) {
        return (
            <div className="p-6 lg:p-8">
                <FeatureLockedGate
                    feature="owner_panel"
                    restaurantCode={restaurant.id}
                    currentPlanName={restaurant.plan || 'Standard'}
                    isSuspended={true}
                />
            </div>
        );
    }

    if (restaurant?.primaryEntitlement?.isExpired) {
        return (
            <div className="p-6 lg:p-8">
                <FeatureLockedGate
                    feature="owner_panel"
                    restaurantCode={restaurant.id}
                    currentPlanName={restaurant.plan || 'Standard'}
                    isExpired={true}
                />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="p-6 lg:p-8 space-y-8"
        >
            {/* Quick Actions Row */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h2 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
                        {isAllBranches 
                            ? (branches.length > 1 ? 'All Branches Overview' : (currentBranch?.name || restaurant?.name || 'Restaurant Overview'))
                            : (currentBranch?.name || restaurant?.name || 'Branch Overview')}
                    </h2>
                    <p className="text-sm text-neutral-400 dark:text-neutral-500 font-medium mt-0.5">
                        {isAllBranches 
                            ? (branches.length > 1 ? `Aggregated across ${stats.activeBranches} branches` : 'Live operational and sales performance')
                            : 'Branch-specific performance metrics'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={loadDashboard}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-800/60 border border-neutral-200/60 dark:border-zinc-700/40 rounded-xl text-sm font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-zinc-800 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                    <Link
                        href="/owner/branches"
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 transition-all cursor-pointer"
                    >
                        <Building2 size={14} />
                        <span className="hidden sm:inline">Manage Branches</span>
                    </Link>
                </div>
            </div>

            {/* Welcome banner for newly approved owner with zero restaurants */}
            {branches.length === 0 && (
                <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-200/60 dark:border-indigo-800/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/20">
                            <Sparkles size={24} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-neutral-900 dark:text-white">
                                Welcome to Dine in One! Your Account is Approved
                            </h3>
                            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5 leading-relaxed">
                                Your owner credentials are active. You can now create your restaurant and branch locations to start configuring tables, menus, and staff.
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/owner/branches"
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer shrink-0"
                    >
                        <Building2 size={16} />
                        <span>Create Restaurant & Branches</span>
                        <ArrowRight size={14} />
                    </Link>
                </div>
            )}

            {/* Pro Multi-Restaurant Banner when applicable */}
            {isAllBranches && branches.length > 1 && !restaurant?.hasMultiRestaurant && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200/80 dark:border-amber-800/50 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                            <Building2 size={18} />
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">Multi-Restaurant Central Command is a Pro Feature</h4>
                            <p className="text-[11px] text-amber-700 dark:text-amber-300">Upgrade to Pro to unlock central menu synchronization, consolidated reporting, and cross-outlet performance.</p>
                        </div>
                    </div>
                    <Link
                        href="/owner/billing"
                        className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition-all"
                    >
                        Upgrade to Pro
                    </Link>
                </div>
            )}

            {/* KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
                <KPICard
                    label="Total Revenue"
                    value={stats.totalRevenue}
                    prefix="₹"
                    icon={DollarSign}
                    color="text-emerald-500"
                    bgColor="bg-emerald-50 dark:bg-emerald-950/30"
                    trend="up"
                    trendValue="+12.5%"
                    index={0}
                />
                <KPICard
                    label="Orders"
                    value={stats.totalOrders}
                    icon={ShoppingBag}
                    color="text-orange-500"
                    bgColor="bg-orange-50 dark:bg-orange-950/30"
                    trend="up"
                    trendValue="+8.2%"
                    index={1}
                />
                <KPICard
                    label="Active Branches"
                    value={stats.activeBranches}
                    icon={Building2}
                    color="text-indigo-500"
                    bgColor="bg-indigo-50 dark:bg-indigo-950/30"
                    index={2}
                />
                <KPICard
                    label="Employees"
                    value={stats.totalEmployees}
                    icon={Users}
                    color="text-blue-500"
                    bgColor="bg-blue-50 dark:bg-blue-950/30"
                    index={3}
                />
                <KPICard
                    label="Customers"
                    value={stats.totalCustomers}
                    icon={UserCircle}
                    color="text-purple-500"
                    bgColor="bg-purple-50 dark:bg-purple-950/30"
                    index={4}
                />
                <KPICard
                    label="Pending Orders"
                    value={stats.pendingOrders}
                    icon={Clock}
                    color="text-amber-500"
                    bgColor="bg-amber-50 dark:bg-amber-950/30"
                    pulse
                    index={5}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Trend */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="premium-glass-card p-6 rounded-3xl border border-neutral-200/40 dark:border-zinc-800/40 premium-shadow-soft"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-base font-black text-neutral-800 dark:text-white">Revenue Trend</h3>
                            <p className="text-xs text-neutral-400 mt-0.5">Last 7 days</p>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 text-[11px] font-bold">
                            <ArrowUpRight size={12} />
                            +18.3%
                        </div>
                    </div>
                    <MiniBarChart data={weeklyRevenue} color="bg-indigo-500" />
                    <div className="flex justify-between mt-3 text-[10px] font-semibold text-neutral-400">
                        {trendDays.map((d, i) => (
                            <span key={`${d}-${i}`}>{d}</span>
                        ))}
                    </div>
                </motion.div>

                {/* Orders Trend */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="premium-glass-card p-6 rounded-3xl border border-neutral-200/40 dark:border-zinc-800/40 premium-shadow-soft"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-base font-black text-neutral-800 dark:text-white">Orders Trend</h3>
                            <p className="text-xs text-neutral-400 mt-0.5">Last 7 days</p>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 text-[11px] font-bold">
                            <ArrowUpRight size={12} />
                            +12.1%
                        </div>
                    </div>
                    <MiniBarChart data={weeklyOrders} color="bg-violet-500" />
                    <div className="flex justify-between mt-3 text-[10px] font-semibold text-neutral-400">
                        {trendDays.map((d, i) => (
                            <span key={`${d}-${i}`}>{d}</span>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Bottom Row: Branch Performance + Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Branch Performance */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="lg:col-span-3 premium-glass-card p-6 rounded-3xl border border-neutral-200/40 dark:border-zinc-800/40 premium-shadow-soft"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-base font-black text-neutral-800 dark:text-white">Branch Performance</h3>
                            <p className="text-xs text-neutral-400 mt-0.5">Aggregated revenue by branch</p>
                        </div>
                    </div>
                    <div className="divide-y divide-neutral-100 dark:divide-zinc-800/60">
                        {branchPerformanceData.length > 0 ? (
                            branchPerformanceData.map((branch, i) => (
                                <BranchPerformanceRow key={branch.id || branch.name} {...branch} index={i} />
                            ))
                        ) : (
                            <div className="py-8 text-center text-xs text-neutral-400">
                                No branches found.
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Recent Activity */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    className="lg:col-span-2 premium-glass-card p-6 rounded-3xl border border-neutral-200/40 dark:border-zinc-800/40 premium-shadow-soft"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-base font-black text-neutral-800 dark:text-white">Recent Activity</h3>
                            <p className="text-xs text-neutral-400 mt-0.5">Latest operations</p>
                        </div>
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-sm shadow-emerald-500/50" />
                    </div>
                    <div className="divide-y divide-neutral-100 dark:divide-zinc-800/60">
                        {recentActivity.length > 0 ? (
                            recentActivity.map((item, i) => (
                                <ActivityItem key={i} {...item} />
                            ))
                        ) : (
                            <div className="py-8 text-center text-xs text-neutral-400">
                                No recent orders recorded.
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Subscription Banner */}
            <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 p-6 lg:p-8 shadow-lg shadow-indigo-500/20"
            >
                <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20" />
                <div className="absolute bottom-0 left-0 w-60 h-60 bg-white/5 rounded-full blur-3xl -ml-16 -mb-16" />
                <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h3 className="text-lg font-black text-white">Restaurant Subscriptions & Billing</h3>
                        <p className="text-sm text-white/70 mt-1">Manage restaurant plans, view invoices, and explore features.</p>
                    </div>
                    <Link
                        href="/owner/billing"
                        className="px-5 py-2.5 bg-white text-indigo-600 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all inline-flex items-center gap-2 cursor-pointer"
                    >
                        Manage Subscriptions
                        <ArrowRight size={14} />
                    </Link>
                </div>
            </motion.div>
        </motion.div>
    );
}
