'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useOwner } from '@/context/OwnerContext';
import {
    UserCircle,
    Search,
    Star,
    ShoppingBag,
    Phone,
    Mail,
    Store,
    Calendar,
    Sparkles,
    CreditCard,
    ArrowUpRight,
    RefreshCw,
    ShieldCheck
} from 'lucide-react';

export default function CustomersPage() {
    const { selectedRestaurantId, isAllRestaurants, currentRestaurant, restaurants, setSelectedRestaurant } = useOwner();
    const [customers, setCustomers] = useState<any[]>([]);
    const [stats, setStats] = useState({
        total: 0,
        repeat: 0,
        totalRevenue: 0,
        avgSpend: 0
    });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [segmentFilter, setSegmentFilter] = useState<'all' | 'repeat' | 'vip'>('all');

    const fetchCustomers = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (!isAllRestaurants && selectedRestaurantId) {
                params.set('branch', selectedRestaurantId);
            }
            if (segmentFilter !== 'all') {
                params.set('type', segmentFilter);
            }
            if (search.trim()) {
                params.set('search', search.trim());
            }

            const res = await fetch(`/api/owner/customers?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setCustomers(data.customers || []);
                setStats({
                    total: data.totalCustomers || 0,
                    repeat: data.repeatCustomers || 0,
                    totalRevenue: data.totalRevenue || 0,
                    avgSpend: data.avgSpend || 0
                });
            }
        } catch (err) {
            console.error('Failed to load customers:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedRestaurantId, isAllRestaurants, segmentFilter, search]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchCustomers();
        }, 200);
        return () => clearTimeout(timeout);
    }, [fetchCustomers]);

    return (
        <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
            {/* Header & Filter context */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight flex items-center gap-2.5">
                        <UserCircle className="text-amber-500" size={24} />
                        Customer Database
                    </h2>
                    <p className="text-sm text-neutral-400 mt-0.5">
                        {isAllRestaurants
                            ? 'Consolidated guest directory across all restaurant branches'
                            : `Filtered guests for ${currentRestaurant?.name || 'Selected Branch'}`}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchCustomers()}
                        className="p-2.5 rounded-xl border border-neutral-200/60 dark:border-zinc-800 bg-white dark:bg-zinc-800/80 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-zinc-700 transition"
                        title="Refresh customers"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800/60 border border-neutral-200/60 dark:border-zinc-700/40 rounded-xl w-64 shadow-xs">
                        <Search size={14} className="text-neutral-400 shrink-0" />
                        <input
                            type="text"
                            placeholder="Search name, phone, email..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-transparent text-sm outline-none w-full text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400"
                        />
                    </div>
                </div>
            </div>

            {/* Active Outlet Banner if isolated */}
            {!isAllRestaurants && currentRestaurant && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 px-4 flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
                    <div className="flex items-center gap-2">
                        <Store size={15} />
                        <span>Viewing guests exclusively for <strong>{currentRestaurant.name}</strong></span>
                    </div>
                    <button
                        onClick={() => setSelectedRestaurant('all')}
                        className="font-bold underline hover:opacity-80 transition"
                    >
                        Show All Outlets
                    </button>
                </div>
            )}

            {/* KPI Metrics Ribbon */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    {
                        label: 'Total Diners',
                        value: loading ? '...' : stats.total,
                        desc: 'Registered guest profiles',
                        icon: UserCircle,
                        color: 'text-indigo-500',
                        bg: 'bg-indigo-50 dark:bg-indigo-950/30'
                    },
                    {
                        label: 'Repeat Guests',
                        value: loading ? '...' : stats.repeat,
                        desc: stats.total > 0 ? `${Math.round((stats.repeat / stats.total) * 100)}% retention rate` : '0% retention',
                        icon: Star,
                        color: 'text-amber-500',
                        bg: 'bg-amber-50 dark:bg-amber-950/30'
                    },
                    {
                        label: 'Lifetime Spend',
                        value: loading ? '...' : `₹${stats.totalRevenue.toLocaleString('en-IN')}`,
                        desc: 'Combined diner spend',
                        icon: CreditCard,
                        color: 'text-emerald-500',
                        bg: 'bg-emerald-50 dark:bg-emerald-950/30'
                    },
                    {
                        label: 'Avg Spend / Guest',
                        value: loading ? '...' : `₹${stats.avgSpend.toLocaleString('en-IN')}`,
                        desc: 'Average ticket value',
                        icon: ShoppingBag,
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

            {/* Segment Filter Tabs */}
            <div className="flex items-center gap-2 border-b border-neutral-200/60 dark:border-zinc-800 pb-3">
                {[
                    { id: 'all', label: 'All Diners', count: stats.total },
                    { id: 'repeat', label: 'Repeat Guests', count: stats.repeat },
                    { id: 'vip', label: 'VIP Guests (₹1,000+)', count: customers.filter(c => (c.total_spend || 0) >= 1000).length }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setSegmentFilter(tab.id as any)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                            segmentFilter === tab.id
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'bg-neutral-100 dark:bg-zinc-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-zinc-700'
                        }`}
                    >
                        <span>{tab.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            segmentFilter === tab.id ? 'bg-amber-600 text-white' : 'bg-neutral-200 dark:bg-zinc-700 text-neutral-500 dark:text-neutral-400'
                        }`}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Customers Table / Grid */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-neutral-200/70 dark:border-zinc-800/80 overflow-hidden shadow-xs">
                <div className="p-4 px-6 border-b border-neutral-100 dark:border-zinc-800 flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-wider text-neutral-500">
                        Guest Profiles ({customers.length})
                    </h3>
                    <span className="text-xs text-neutral-400">
                        {isAllRestaurants ? 'All Outlets' : currentRestaurant?.name}
                    </span>
                </div>

                {loading ? (
                    <div className="py-16 text-center text-xs text-neutral-400 flex flex-col items-center gap-2">
                        <RefreshCw size={24} className="animate-spin text-amber-500" />
                        <span>Loading customer records...</span>
                    </div>
                ) : customers.length === 0 ? (
                    <div className="py-16 text-center text-neutral-400 flex flex-col items-center">
                        <UserCircle size={40} className="mb-2 opacity-30 text-amber-500" />
                        <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">No diners found</p>
                        <p className="text-xs text-neutral-500 max-w-sm mt-1">
                            {search
                                ? 'No customer matches your search filter.'
                                : 'No guest records found for the selected outlet.'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-neutral-50 dark:bg-zinc-800/50 text-[10px] uppercase font-black text-neutral-500">
                                <tr>
                                    <th className="p-4">Customer</th>
                                    <th className="p-4">Contact</th>
                                    <th className="p-4">Outlet Visited</th>
                                    <th className="p-4">Segment</th>
                                    <th className="p-4 text-center">Orders</th>
                                    <th className="p-4">Lifetime Spend</th>
                                    <th className="p-4">Last Activity</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 dark:divide-zinc-800">
                                {customers.map(c => {
                                    const spend = parseFloat(c.total_spend || 0);
                                    const ordersCount = c.order_count || c.visit_count || 1;
                                    const isVip = spend >= 1000;
                                    const isRepeat = ordersCount > 1;

                                    return (
                                        <tr key={c.id} className="hover:bg-neutral-50/60 dark:hover:bg-zinc-800/40 transition">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 text-white font-black flex items-center justify-center text-xs shrink-0 shadow-xs">
                                                        {(c.name || 'G')[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-neutral-900 dark:text-white">
                                                            {c.name || 'Guest Diner'}
                                                        </p>
                                                        <p className="text-[10px] text-neutral-400 font-mono">
                                                            ID: {c.id.slice(0, 8)}...
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="space-y-0.5">
                                                    {c.mobile && (
                                                        <div className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300 font-mono">
                                                            <Phone size={11} className="text-neutral-400" />
                                                            <span>{c.mobile}</span>
                                                        </div>
                                                    )}
                                                    {c.email && (
                                                        <div className="flex items-center gap-1.5 text-neutral-500 text-[11px]">
                                                            <Mail size={11} className="text-neutral-400" />
                                                            <span>{c.email}</span>
                                                        </div>
                                                    )}
                                                    {!c.mobile && !c.email && (
                                                        <span className="text-neutral-400 italic">No contact provided</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300 font-medium">
                                                    <Store size={12} className="text-neutral-400 shrink-0" />
                                                    <span className="truncate max-w-[140px]">{c.restaurant_name}</span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {isVip ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                        <Sparkles size={10} /> VIP Spender
                                                    </span>
                                                ) : isRepeat ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                                        <Star size={10} /> Repeat Guest
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-neutral-100 dark:bg-zinc-800 text-neutral-500">
                                                        New Guest
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center font-bold text-neutral-900 dark:text-white">
                                                {ordersCount}
                                            </td>
                                            <td className="p-4">
                                                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                    ₹{spend.toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="p-4 text-neutral-400 text-[11px]">
                                                {c.last_visit ? (
                                                    <div className="flex items-center gap-1">
                                                        <Calendar size={11} className="text-neutral-400" />
                                                        <span>{new Date(c.last_visit).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                    </div>
                                                ) : 'Recent'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
