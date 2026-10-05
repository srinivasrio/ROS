'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Monitor, Building2, Clock, ChefHat, CheckCircle2,
    ArrowLeft, Flame, RefreshCw, Play, Check,
    UtensilsCrossed, AlertCircle, ChevronRight, Star,
    Layers, Store, Utensils
} from 'lucide-react';
import { toast } from 'sonner';
import { useOwner } from '@/context/OwnerContext';
import { OrderService } from '@/services/orders.service';

interface BranchKDSInfo {
    id: string;
    restaurant_id: string;
    name: string;
    branch_id?: string;
    code?: string;
    is_main_branch: boolean;
    address?: string;
    phone?: string;
    active_orders_count: number;
    placed_count: number;
    preparing_count: number;
    ready_count: number;
}

interface OrderItem {
    id: string | number;
    quantity: number;
    notes?: string;
    status?: string;
    combo_name?: string;
    combo_id?: string;
    item_type?: string;
    menu_items?: {
        id?: string;
        name?: string;
    };
}

interface KitchenOrder {
    id: string;
    order_number: number;
    status: 'queued' | 'placed' | 'preparing' | 'ready' | 'served';
    created_at: string;
    order_type?: string;
    table_id?: number | string;
    restaurant_id: string;
    branch_id?: string;
    tables?: {
        id: number | string;
        table_number: string;
    };
    order_items?: OrderItem[];
}

export default function KDSPage() {
    const { selectedRestaurantId, isAllRestaurants, setSelectedRestaurant } = useOwner();
    const [branches, setBranches] = useState<BranchKDSInfo[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<BranchKDSInfo | null>(null);
    const [isConsolidated, setIsConsolidated] = useState(false);
    const [orders, setOrders] = useState<KitchenOrder[]>([]);
    const [loadingBranches, setLoadingBranches] = useState(true);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [statusFilter, setStatusFilter] = useState<'all' | 'placed' | 'preparing' | 'ready'>('all');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState<string>('');
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const isFirstLoad = useRef(true);

    // Sync with top bar BranchSelector
    useEffect(() => {
        if (!loadingBranches && branches.length > 0) {
            if (!isAllRestaurants && selectedRestaurantId) {
                const found = branches.find(b => b.id === selectedRestaurantId || b.restaurant_id === selectedRestaurantId);
                if (found && selectedBranch?.id !== found.id) {
                    setSelectedBranch(found);
                    setIsConsolidated(false);
                }
            } else if (isAllRestaurants && selectedBranch) {
                setSelectedBranch(null);
                setIsConsolidated(false);
            }
        }
    }, [selectedRestaurantId, isAllRestaurants, loadingBranches, branches]);

    // Live Clock
    useEffect(() => {
        const updateClock = () => {
            setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        };
        updateClock();
        const timer = setInterval(updateClock, 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch branches and overview
    const fetchBranchesOverview = useCallback(async () => {
        try {
            const res = await fetch('/api/owner/kds');
            if (res.ok) {
                const data = await res.json();
                setBranches(data.branches || []);
            }
        } catch (err) {
            console.error('Failed to load branches overview:', err);
        } finally {
            setLoadingBranches(false);
        }
    }, []);

    // Fetch orders for active view
    const fetchKitchenOrders = useCallback(async (silent = false) => {
        if (!silent) setLoadingOrders(true);
        try {
            let url = '/api/owner/kds';
            if (selectedBranch && !isConsolidated) {
                url += `?branch=${selectedBranch.id}`;
            }

            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setOrders(data.activeKitchenOrders || []);
                if (data.branches) setBranches(data.branches);
                setLastUpdated(new Date());
            }
        } catch (err) {
            console.error('Failed to load KDS orders:', err);
        } finally {
            if (!silent) setLoadingOrders(false);
        }
    }, [selectedBranch, isConsolidated]);

    // Initial load
    useEffect(() => {
        fetchBranchesOverview();
    }, [fetchBranchesOverview]);

    // When branch selection changes, load orders
    useEffect(() => {
        if (selectedBranch || isConsolidated) {
            fetchKitchenOrders(isFirstLoad.current ? false : true);
            isFirstLoad.current = false;
        }
    }, [selectedBranch, isConsolidated, fetchKitchenOrders]);

    // Realtime-First KDS Subscriptions with Visibility & Network Recovery (P2-01 Fix)
    useEffect(() => {
        if (!selectedBranch && !isConsolidated) return;

        let debounceTimer: NodeJS.Timeout | null = null;
        const debouncedFetchOrders = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fetchKitchenOrders(true);
            }, 1000);
        };

        // 1. Visibility recovery: sync fresh orders when tab/screen wakes up
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                debouncedFetchOrders();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // 2. Network recovery: sync fresh orders after reconnecting
        const handleOnline = () => {
            debouncedFetchOrders();
        };
        window.addEventListener('online', handleOnline);

        // 3. Supabase Realtime subscriptions to relevant restaurant order data
        const targetRestaurantIds = isConsolidated
            ? Array.from(new Set(branches.map(b => b.restaurant_id || b.id).filter(Boolean)))
            : (selectedBranch?.restaurant_id || selectedBranch?.id ? [selectedBranch.restaurant_id || selectedBranch.id] : []);

        const subscriptions: { unsubscribe: () => void }[] = [];

        targetRestaurantIds.forEach(targetId => {
            const sub = OrderService.subscribeToOrders(targetId, (payload) => {
                if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
                    debouncedFetchOrders();
                } else if (payload.eventType === 'UPDATE') {
                    const updatedOrder = payload.new as any;
                    if (!updatedOrder) return;

                    // Branch filter check
                    if (selectedBranch && !isConsolidated) {
                        const targetBranchId = selectedBranch.branch_id || selectedBranch.id;
                        if (updatedOrder.branch_id && updatedOrder.branch_id !== targetBranchId) {
                            setOrders(prev => prev.filter(o => o.id !== updatedOrder.id));
                            return;
                        }
                    }

                    // Idempotent order state update
                    setOrders(prev => {
                        const activeStatuses = ['queued', 'placed', 'preparing', 'ready'];
                        if (updatedOrder.is_completed || !activeStatuses.includes(updatedOrder.status)) {
                            return prev.filter(o => o.id !== updatedOrder.id);
                        }
                        const exists = prev.some(o => o.id === updatedOrder.id);
                        if (!exists) {
                            debouncedFetchOrders();
                            return prev;
                        }
                        return prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o);
                    });
                }
            });
            subscriptions.push(sub);
        });

        // 4. Conservative 90-second safety fallback heartbeat (replaces aggressive 8s polling)
        const safetyInterval = setInterval(() => {
            fetchKitchenOrders(true);
        }, 90000);

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            clearInterval(safetyInterval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('online', handleOnline);
            subscriptions.forEach(s => s.unsubscribe());
        };
    }, [selectedBranch, isConsolidated, branches, fetchKitchenOrders]);

    // Handle status transition (placed -> preparing -> ready -> served)
    const handleUpdateStatus = async (orderId: string, nextStatus: 'preparing' | 'ready' | 'served') => {
        setActionLoading(orderId);
        // Optimistic update
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: nextStatus } : o));

        try {
            const res = await fetch('/api/owner/kds', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, status: nextStatus })
            });

            if (res.ok) {
                const statusNames = {
                    preparing: 'Cooking / In Preparation',
                    ready: 'Ready for Pickup / Serving',
                    served: 'Served / Completed'
                };
                toast.success(`Order marked as ${statusNames[nextStatus]}`);
                // Refresh list to sync properly
                await fetchKitchenOrders(true);
            } else {
                const err = await res.json();
                toast.error(err.error || 'Failed to update order status');
                // Revert by re-fetching
                await fetchKitchenOrders(true);
            }
        } catch (err) {
            toast.error('Network error updating order');
            await fetchKitchenOrders(true);
        } finally {
            setActionLoading(null);
        }
    };

    // Filter orders based on status tab
    const filteredOrders = orders.filter(o => {
        if (statusFilter === 'all') return true;
        return o.status === statusFilter;
    });

    const counts = {
        all: orders.length,
        placed: orders.filter(o => o.status === 'placed').length,
        preparing: orders.filter(o => o.status === 'preparing').length,
        ready: orders.filter(o => o.status === 'ready').length,
    };

    const totalActiveAcrossAll = branches.reduce((sum, b) => sum + (b.active_orders_count || 0), 0);

    // =========================================================================
    // VIEW 1: BRANCH SELECTION SCREEN (When Owner clicks KDS)
    // =========================================================================
    if (!selectedBranch && !isConsolidated) {
        return (
            <div className="p-6 lg:p-8 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl text-white shadow-md shadow-indigo-500/20">
                                <Monitor size={20} />
                            </div>
                            <h2 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">Kitchen Display System (KDS)</h2>
                        </div>
                        <p className="text-sm text-neutral-400 mt-1">
                            Select any restaurant branch to launch and monitor its real-time kitchen display.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                setIsConsolidated(true);
                                setSelectedBranch(null);
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-neutral-800 dark:text-neutral-200 rounded-xl text-xs font-bold transition-all cursor-pointer border border-neutral-200/60 dark:border-zinc-700/60 shadow-xs"
                        >
                            <Layers size={14} className="text-indigo-600 dark:text-indigo-400" />
                            <span>All Outlets Consolidated</span>
                        </button>
                        <button
                            onClick={() => fetchBranchesOverview()}
                            className="p-2.5 bg-white dark:bg-zinc-800 border border-neutral-200/60 dark:border-zinc-700/60 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 transition-colors cursor-pointer shadow-xs"
                            title="Refresh Outlets"
                        >
                            <RefreshCw size={14} className={loadingBranches ? 'animate-spin text-indigo-600' : ''} />
                        </button>
                    </div>
                </div>

                {/* Total Stats Banner */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-neutral-200/60 dark:border-zinc-800/60 shadow-xs flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Total Outlets</p>
                            <p className="text-2xl font-black text-neutral-900 dark:text-white mt-0.5">{branches.length}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center">
                            <Store size={20} />
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-neutral-200/60 dark:border-zinc-800/60 shadow-xs flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Active Kitchen Tickets</p>
                            <p className="text-2xl font-black text-neutral-900 dark:text-white mt-0.5">{totalActiveAcrossAll}</p>
                        </div>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${totalActiveAcrossAll > 0 ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'}`}>
                            <Flame size={20} />
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-neutral-200/60 dark:border-zinc-800/60 shadow-xs flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Kitchen Status</p>
                            <p className="text-sm font-black text-neutral-800 dark:text-white mt-1 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                {totalActiveAcrossAll > 0 ? `${totalActiveAcrossAll} Orders in Progress` : 'All Kitchens Caught Up'}
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-neutral-50 dark:bg-zinc-800 text-neutral-400 flex items-center justify-center">
                            <Clock size={20} />
                        </div>
                    </div>
                </div>

                {/* Branches Grid */}
                {loadingBranches ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-neutral-200/60 dark:border-zinc-800/60 animate-pulse space-y-4">
                                <div className="w-12 h-12 rounded-2xl bg-neutral-200 dark:bg-zinc-800" />
                                <div className="w-40 h-4 bg-neutral-200 dark:bg-zinc-800 rounded" />
                                <div className="w-24 h-3 bg-neutral-100 dark:bg-zinc-800 rounded" />
                            </div>
                        ))}
                    </div>
                ) : branches.length === 0 ? (
                    <div className="p-16 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-neutral-200/60 dark:border-zinc-800/60">
                        <Store size={40} className="text-neutral-300 dark:text-zinc-600 mx-auto mb-3" />
                        <h3 className="text-base font-black text-neutral-800 dark:text-white">No Branches Found</h3>
                        <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                            You have not created any restaurant branches yet. Visit the Branches section to create your outlets.
                        </p>
                    </div>
                ) : (
                    <div>
                        <h3 className="text-xs font-black text-neutral-400 uppercase tracking-wider mb-4">Restaurant Outlets</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {branches.map(branch => {
                                const hasActive = branch.active_orders_count > 0;
                                return (
                                    <motion.div
                                        key={branch.id}
                                        whileHover={{ y: -3, transition: { duration: 0.15 } }}
                                        onClick={() => {
                                            setSelectedBranch(branch);
                                            setIsConsolidated(false);
                                            setSelectedRestaurant(branch.id);
                                        }}
                                        className="group p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-neutral-200/70 dark:border-zinc-800/70 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 shadow-xs hover:shadow-xl hover:shadow-indigo-500/5 transition-all cursor-pointer flex flex-col justify-between space-y-5"
                                    >
                                        <div className="space-y-3">
                                            {/* Top row badges */}
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/40 border border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-base shadow-xs group-hover:scale-105 transition-transform">
                                                    <ChefHat size={22} />
                                                </div>

                                                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                                    {branch.is_main_branch && (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-xs">
                                                            <Star size={10} className="fill-white" /> Main Branch
                                                        </span>
                                                    )}
                                                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-neutral-100 dark:bg-zinc-800 text-neutral-500">
                                                        {branch.code || branch.id}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Branch Name & Address */}
                                            <div>
                                                <h4 className="text-base font-black text-neutral-900 dark:text-white tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                    {branch.name}
                                                </h4>
                                                {branch.address && (
                                                    <p className="text-xs text-neutral-400 line-clamp-1 mt-0.5">
                                                        {branch.address}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Kitchen Load Indicator */}
                                        <div className="pt-3 border-t border-neutral-100 dark:border-zinc-800/80 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-neutral-500 flex items-center gap-1.5">
                                                    <Flame size={14} className={hasActive ? 'text-amber-500 animate-pulse' : 'text-neutral-300'} />
                                                    Active Orders
                                                </span>
                                                <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                                                    hasActive 
                                                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                                }`}>
                                                    {hasActive ? `${branch.active_orders_count} Live` : 'Idle · 0 active'}
                                                </span>
                                            </div>

                                            {hasActive && (
                                                <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                                                    <div className="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 p-1.5 rounded-xl">
                                                        <span className="block font-black text-xs">{branch.placed_count}</span>
                                                        <span>Placed</span>
                                                    </div>
                                                    <div className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 p-1.5 rounded-xl">
                                                        <span className="block font-black text-xs">{branch.preparing_count}</span>
                                                        <span>Cooking</span>
                                                    </div>
                                                    <div className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 p-1.5 rounded-xl">
                                                        <span className="block font-black text-xs">{branch.ready_count}</span>
                                                        <span>Ready</span>
                                                    </div>
                                                </div>
                                            )}

                                            <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-900 rounded-xl text-xs font-bold transition-all shadow-xs group-hover:bg-indigo-600 dark:group-hover:bg-indigo-600 dark:group-hover:text-white">
                                                <span>Launch Live KDS</span>
                                                <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // =========================================================================
    // VIEW 2: LIVE KDS FOR SELECTED BRANCH (or Consolidated)
    // =========================================================================
    return (
        <div className="p-6 lg:p-8 space-y-6">
            {/* Top Navigation Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200/60 dark:border-zinc-800">
                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        onClick={() => {
                            setSelectedBranch(null);
                            setIsConsolidated(false);
                            setSelectedRestaurant('all');
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer shadow-xs"
                    >
                        <ArrowLeft size={14} />
                        <span>All Branches</span>
                    </button>

                    <div className="h-5 w-px bg-neutral-200 dark:bg-zinc-800" />

                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black text-neutral-900 dark:text-white tracking-tight flex items-center gap-2">
                                {isConsolidated ? 'Consolidated Kitchens (All Outlets)' : selectedBranch?.name}
                            </h2>
                            {selectedBranch?.is_main_branch && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500 text-white">
                                    <Star size={9} className="fill-white" /> Main Branch
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5">
                            {isConsolidated 
                                ? 'Real-time monitoring across all branch kitchens'
                                : `Live Kitchen Display · Outlet ID: ${selectedBranch?.code || selectedBranch?.id}`
                            }
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Branch Switcher Dropdown */}
                    {!isConsolidated && branches.length > 1 && (
                        <select
                            value={selectedBranch?.id || ''}
                            onChange={(e) => {
                                const b = branches.find(item => item.id === e.target.value);
                                if (b) {
                                    setSelectedBranch(b);
                                    setSelectedRestaurant(b.id);
                                }
                            }}
                            className="px-3 py-2 bg-white dark:bg-zinc-800 border border-neutral-200/60 dark:border-zinc-700/60 rounded-xl text-xs text-neutral-700 dark:text-neutral-300 font-bold outline-none cursor-pointer shadow-xs"
                        >
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>
                                    {b.name} {b.is_main_branch ? '★' : ''} ({b.active_orders_count} active)
                                </option>
                            ))}
                        </select>
                    )}

                    {/* Clock */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-neutral-900 dark:bg-zinc-800 text-white rounded-xl shadow-xs">
                        <Clock size={13} className="text-amber-400" />
                        <span className="text-xs font-mono font-black tracking-wider text-amber-400">
                            {currentTime || '00:00:00'}
                        </span>
                    </div>

                    {/* Live Indicator & Manual Refresh */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                            LIVE
                        </span>
                    </div>

                    <button
                        onClick={() => fetchKitchenOrders(false)}
                        className="p-2 bg-white dark:bg-zinc-800 border border-neutral-200/60 dark:border-zinc-700/60 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 transition-colors cursor-pointer shadow-xs"
                        title="Force Refresh"
                    >
                        <RefreshCw size={14} className={loadingOrders ? 'animate-spin text-indigo-600' : ''} />
                    </button>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        statusFilter === 'all'
                            ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                            : 'bg-white dark:bg-zinc-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200/60 dark:border-zinc-700/60 hover:bg-neutral-50'
                    }`}
                >
                    All Active ({counts.all})
                </button>
                <button
                    onClick={() => setStatusFilter('placed')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                        statusFilter === 'placed'
                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                            : 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40 hover:bg-indigo-50/50'
                    }`}
                >
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    Incoming / Placed ({counts.placed})
                </button>
                <button
                    onClick={() => setStatusFilter('preparing')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                        statusFilter === 'preparing'
                            ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/20'
                            : 'bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40 hover:bg-amber-50/50'
                    }`}
                >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Cooking / Preparing ({counts.preparing})
                </button>
                <button
                    onClick={() => setStatusFilter('ready')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                        statusFilter === 'ready'
                            ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                            : 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 hover:bg-emerald-50/50'
                    }`}
                >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Ready to Serve ({counts.ready})
                </button>
            </div>

            {/* Orders Kanban Grid */}
            {loadingOrders && orders.length === 0 ? (
                <div className="p-16 text-center text-xs text-neutral-400 bg-white dark:bg-zinc-900 rounded-3xl border border-neutral-200/60 dark:border-zinc-800/60 space-y-2">
                    <RefreshCw size={24} className="animate-spin text-indigo-600 mx-auto" />
                    <p className="font-bold">Syncing live kitchen orders...</p>
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-neutral-200/60 dark:border-zinc-800/60 p-16 text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 flex items-center justify-center mx-auto">
                        <CheckCircle2 size={30} />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-neutral-800 dark:text-white">Kitchen is All Caught Up!</h3>
                        <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1">
                            {statusFilter === 'all'
                                ? `No active pending or cooking orders for ${isConsolidated ? 'any outlet' : selectedBranch?.name}.`
                                : `No orders currently matching the '${statusFilter}' filter.`}
                        </p>
                    </div>
                    {statusFilter !== 'all' && (
                        <button
                            onClick={() => setStatusFilter('all')}
                            className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold cursor-pointer"
                        >
                            View All Active ({counts.all})
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    <AnimatePresence>
                        {filteredOrders.map(order => {
                            const items = order.order_items || [];
                            const elapsedMins = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
                            const isDelayed = elapsedMins >= 20;
                            const isWarning = elapsedMins >= 10 && elapsedMins < 20;
                            const isActionBusy = actionLoading === order.id;

                            // Status badge colors
                            const statusConfig = {
                                queued: { label: 'Queued', bg: 'bg-orange-50 dark:bg-orange-950/40', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
                                placed: { label: 'Placed / New', bg: 'bg-indigo-50 dark:bg-indigo-950/40', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800' },
                                preparing: { label: 'Cooking', bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
                                ready: { label: 'Ready', bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
                                served: { label: 'Served', bg: 'bg-neutral-50 dark:bg-zinc-800', text: 'text-neutral-500', border: 'border-neutral-200' }
                            }[order.status] || { label: order.status, bg: 'bg-neutral-100', text: 'text-neutral-600', border: 'border-neutral-200' };

                            const tableName = order.tables?.table_number 
                                ? `Table ${order.tables.table_number}` 
                                : (order.order_type === 'takeaway' ? 'Takeaway' : (order.order_type === 'delivery' ? 'Delivery' : `Table #${order.table_id || 'Quick'}`));

                            return (
                                <motion.div
                                    key={order.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.96 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className={`p-5 rounded-3xl bg-white dark:bg-zinc-900 border flex flex-col justify-between space-y-4 shadow-sm transition-all ${
                                        isDelayed
                                            ? 'border-rose-400/80 dark:border-rose-800/80 shadow-rose-500/5'
                                            : order.status === 'ready'
                                            ? 'border-emerald-400/70 dark:border-emerald-800/70 shadow-emerald-500/5'
                                            : 'border-neutral-200/70 dark:border-zinc-800/70'
                                    }`}
                                >
                                    <div className="space-y-3.5">
                                        {/* Ticket Header */}
                                        <div className="flex items-start justify-between gap-2 border-b border-neutral-100 dark:border-zinc-800 pb-3">
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-sm font-black text-neutral-900 dark:text-white">
                                                        #{order.order_number || order.id.slice(0, 6)}
                                                    </span>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-zinc-800 text-neutral-600 dark:text-neutral-300">
                                                        {tableName}
                                                    </span>
                                                </div>
                                                {isConsolidated && (
                                                    <p className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 mt-0.5">
                                                        {branches.find(b => b.id === order.restaurant_id)?.name || order.restaurant_id}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="text-right flex flex-col items-end gap-1">
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${
                                                    isDelayed 
                                                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200' 
                                                        : isWarning 
                                                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200'
                                                        : 'bg-neutral-100 text-neutral-600 dark:bg-zinc-800 dark:text-neutral-300'
                                                }`}>
                                                    <Clock size={10} /> {elapsedMins}m {isDelayed ? '⚠️ DELAYED' : 'ago'}
                                                </span>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
                                                    {statusConfig.label}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Items List */}
                                        <div className="space-y-2">
                                            {items.map((item, idx) => (
                                                <div key={item.id || idx} className="flex items-start justify-between gap-2 text-xs py-1 border-b border-neutral-50 dark:border-zinc-800/40 last:border-0">
                                                    <div className="flex items-start gap-2">
                                                        <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-black text-[11px] rounded-md">
                                                            {item.quantity}x
                                                        </span>
                                                        <div>
                                                            <p className="font-bold text-neutral-800 dark:text-neutral-200 leading-tight">
                                                                {item.combo_name || item.menu_items?.name || 'Item'}
                                                            </p>
                                                            {item.notes && (
                                                                <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400 mt-0.5 italic">
                                                                    Note: {item.notes}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="pt-2 border-t border-neutral-100 dark:border-zinc-800">
                                        {(order.status === 'placed' || order.status === 'queued') && (
                                            <button
                                                disabled={isActionBusy}
                                                onClick={() => handleUpdateStatus(order.id, 'preparing')}
                                                className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-sm shadow-amber-500/20 cursor-pointer disabled:opacity-50 transition-all"
                                            >
                                                <Play size={12} className="fill-white" />
                                                <span>{isActionBusy ? 'Updating...' : 'Start Cooking'}</span>
                                            </button>
                                        )}

                                        {order.status === 'preparing' && (
                                            <button
                                                disabled={isActionBusy}
                                                onClick={() => handleUpdateStatus(order.id, 'ready')}
                                                className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm shadow-emerald-600/20 cursor-pointer disabled:opacity-50 transition-all"
                                            >
                                                <Check size={14} />
                                                <span>{isActionBusy ? 'Updating...' : 'Mark Ready'}</span>
                                            </button>
                                        )}

                                        {order.status === 'ready' && (
                                            <button
                                                disabled={isActionBusy}
                                                onClick={() => handleUpdateStatus(order.id, 'served')}
                                                className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 rounded-xl text-xs font-black shadow-sm cursor-pointer disabled:opacity-50 transition-all"
                                            >
                                                <CheckCircle2 size={13} />
                                                <span>{isActionBusy ? 'Updating...' : 'Complete & Serve'}</span>
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
