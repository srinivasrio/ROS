'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useOwner } from '@/context/OwnerContext';
import { Table2, Search, Grid3X3, Users, CheckCircle, Store, RefreshCw, AlertCircle } from 'lucide-react';

export default function TablesPage() {
    const { selectedRestaurantId, isAllRestaurants, currentRestaurant, restaurants, setSelectedRestaurant } = useOwner();
    const [tables, setTables] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'occupied'>('all');

    const fetchTables = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (!isAllRestaurants && selectedRestaurantId) {
                params.set('branch', selectedRestaurantId);
            }
            const res = await fetch(`/api/owner/tables?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setTables(data.tables || []);
            }
        } catch (err) {
            console.error('Failed to load tables:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedRestaurantId, isAllRestaurants]);

    useEffect(() => {
        fetchTables();
    }, [fetchTables]);

    const filteredTables = tables.filter(t => {
        const matchesSearch = !search || 
            `t-${t.table_number}`.toLowerCase().includes(search.toLowerCase()) ||
            t.table_number?.toString().includes(search) ||
            t.restaurant_name?.toLowerCase().includes(search.toLowerCase());
        
        const isOccupied = (t.status || '').toUpperCase() === 'OCCUPIED';
        if (statusFilter === 'available') return matchesSearch && !isOccupied;
        if (statusFilter === 'occupied') return matchesSearch && isOccupied;
        return matchesSearch;
    });

    const totalCount = tables.length;
    const occupiedCount = tables.filter(t => (t.status || '').toUpperCase() === 'OCCUPIED').length;
    const availableCount = totalCount - occupiedCount;

    return (
        <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight flex items-center gap-2.5">
                        <Table2 className="text-indigo-500" size={24} />
                        Table Seating & Layout
                    </h2>
                    <p className="text-sm text-neutral-400 mt-0.5">
                        {isAllRestaurants
                            ? 'Floor configuration across all restaurant outlets'
                            : `Table arrangement for ${currentRestaurant?.name || 'Selected Outlet'}`}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchTables()}
                        className="p-2.5 rounded-xl border border-neutral-200/60 dark:border-zinc-800 bg-white dark:bg-zinc-800/80 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-zinc-700 transition"
                        title="Refresh tables"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800/60 border border-neutral-200/60 dark:border-zinc-700/40 rounded-xl w-56 shadow-xs">
                        <Search size={14} className="text-neutral-400 shrink-0" />
                        <input
                            type="text"
                            placeholder="Filter table or outlet..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-transparent text-sm outline-none w-full text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400"
                        />
                    </div>
                </div>
            </div>



            {/* Stats Ribbon */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {[
                    { label: 'Total Tables Configured', value: loading ? '...' : totalCount, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
                    { label: 'Live Occupied Tables', value: loading ? '...' : occupiedCount, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/30' },
                    { label: 'Ready & Available', value: loading ? '...' : availableCount, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
                ].map((s, i) => (
                    <div key={i} className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-neutral-200/70 dark:border-zinc-800/80 shadow-xs flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">{s.label}</p>
                            <p className={`text-2xl font-black ${s.color} mt-1`}>{s.value}</p>
                        </div>
                        <div className={`p-3 rounded-xl ${s.bg}`}>
                            <Table2 size={20} className={s.color} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 border-b border-neutral-200/60 dark:border-zinc-800 pb-3">
                {[
                    { id: 'all', label: 'All Tables', count: totalCount },
                    { id: 'available', label: 'Available', count: availableCount },
                    { id: 'occupied', label: 'Occupied', count: occupiedCount }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setStatusFilter(tab.id as any)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                            statusFilter === tab.id
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-neutral-100 dark:bg-zinc-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-zinc-700'
                        }`}
                    >
                        <span>{tab.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            statusFilter === tab.id ? 'bg-indigo-700 text-white' : 'bg-neutral-200 dark:bg-zinc-700 text-neutral-500'
                        }`}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Tables Grid */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-neutral-200/70 dark:border-zinc-800/80 p-6 shadow-xs">
                {loading ? (
                    <div className="py-16 text-center text-xs text-neutral-400 flex flex-col items-center gap-2">
                        <RefreshCw size={24} className="animate-spin text-indigo-500" />
                        <span>Loading table arrangement...</span>
                    </div>
                ) : filteredTables.length === 0 ? (
                    <div className="py-16 text-center text-neutral-400 flex flex-col items-center">
                        <Grid3X3 size={40} className="mb-2 opacity-30 text-indigo-500" />
                        <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">No tables match your filter</p>
                        <p className="text-xs text-neutral-500 mt-1">Try selecting a different status or changing the restaurant filter.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {filteredTables.map(t => {
                            const isOccupied = (t.status || '').toUpperCase() === 'OCCUPIED';
                            return (
                                <motion.div
                                    key={t.id}
                                    whileHover={{ y: -2 }}
                                    className={`p-4 rounded-2xl border text-center transition-all flex flex-col justify-between ${
                                        isOccupied
                                            ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-900/40 text-rose-700'
                                            : 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/40 text-emerald-700'
                                    }`}
                                >
                                    <div>
                                        {isAllRestaurants && t.restaurant_name && (
                                            <p className="text-[9px] font-bold text-neutral-400 truncate mb-1">
                                                {t.restaurant_name}
                                            </p>
                                        )}
                                        <p className="text-xl font-black text-neutral-900 dark:text-white">
                                            T-{t.table_number}
                                        </p>
                                        <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-neutral-400 mt-1">
                                            <Users size={12} />
                                            <span>Cap: {t.capacity || 4}</span>
                                        </div>
                                    </div>

                                    <div className="mt-3">
                                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                            isOccupied 
                                                ? 'bg-rose-200/80 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200' 
                                                : 'bg-emerald-200/80 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200'
                                        }`}>
                                            {isOccupied ? 'Occupied' : 'Available'}
                                        </span>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
