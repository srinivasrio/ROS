'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRestaurantId } from '@/hooks/useRestaurantId';
import { useParams } from 'next/navigation';
import {
    Search, Phone, Mail, Calendar, Users, UserPlus, UserCheck,
    ChevronLeft, ChevronRight, ArrowUpDown, X, ShoppingBag,
    Clock, Hash, TrendingUp, Eye
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { getCached, setCache } from '@/lib/data-cache';
import { SyncIndicator } from '@/components/admin/SyncIndicator';

interface Customer {
    id: string;
    restaurant_id: string;
    name?: string | null;
    mobile: string | null;
    email: string | null;
    date_of_birth: string | null;
    first_visit: string;
    last_visit: string;
    visit_count: number;
    order_count: number;
    total_spend: number;
    created_at: string;
    updated_at: string;
}

interface Stats {
    total: number;
    newThisWeek: number;
    returning: number;
}

interface CustomerProfile {
    customer: Customer;
    orders: Array<{
        id: string;
        order_number: string;
        status: string;
        total: number;
        created_at: string;
        table_number: string;
        items: any;
    }>;
}

export default function CustomersPage() {
    const { restaurantId } = useRestaurantId();
    const params = useParams();
    const restaurantCode = (params?.restaurantCode as string) || '';
    const cacheKey = `customers-${restaurantCode}`;
    const cached = getCached<any>(cacheKey) || (restaurantId ? getCached<any>(`customers-${restaurantId}`) : null);

    const [customers, setCustomers] = useState<Customer[]>(cached?.customers || []);
    const customersRef = useRef<Customer[]>(customers);
    customersRef.current = customers;
    const [stats, setStats] = useState<Stats>(cached?.stats || { total: 0, newThisWeek: 0, returning: 0 });
    const [loading, setLoading] = useState(!cached && customers.length === 0);
    const [isRevalidating, setIsRevalidating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filters & Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(cached?.totalPages || 1);
    const [searchTerm, setSearchTerm] = useState('');
    const [total, setTotal] = useState(cached?.total || 0);
    const [sortBy, setSortBy] = useState('last_visit');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [limit] = useState(15);

    // Profile modal state
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);

    const loadCustomers = useCallback(async (showLoader = true) => {
        if (!restaurantCode) return;
        if (showLoader && !cached && customersRef.current.length === 0) setLoading(true);
        setIsRevalidating(true);
        setError(null);
        try {
            const queryParams = new URLSearchParams({
                page: String(page),
                limit: String(limit),
                sortBy,
                sortOrder,
            });
            if (searchTerm) queryParams.set('search', searchTerm);

            const res = await fetch(`/api/restaurant/${restaurantCode}/customers?${queryParams}`);
            if (!res.ok) {
                const errJson = await res.json().catch(() => null);
                throw new Error(errJson?.error || `Failed to fetch (${res.status})`);
            }
            const data = await res.json();

            setCustomers(data.customers || []);
            setTotal(data.total || 0);
            setTotalPages(data.totalPages || 1);
            if (data.stats) setStats(data.stats);
            setCache(cacheKey, data);
            setCache('customers-cache', data);
        } catch (err: any) {
            console.error('Failed to load customers:', err);
            setError(err.message || 'Failed to load customers');
        } finally {
            setLoading(false);
            setIsRevalidating(false);
        }
    }, [restaurantCode, page, limit, sortBy, sortOrder, searchTerm, cacheKey, cached]);

    useEffect(() => {
        // Load from cache first
        if (cached) {
            setCustomers(cached.customers || []);
            setTotal(cached.total || 0);
            setTotalPages(cached.totalPages || 1);
            if (cached.stats) setStats(cached.stats);
            setLoading(false);
        }
        loadCustomers(!cached);
    }, [loadCustomers]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            loadCustomers(true);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const openProfile = async (customerId: string) => {
        setProfileLoading(true);
        setSelectedCustomer(null);
        try {
            const res = await fetch(`/api/restaurant/${restaurantCode}/customers/${customerId}`);
            if (!res.ok) {
                const errJson = await res.json().catch(() => null);
                throw new Error(errJson?.error || `Failed to fetch profile (${res.status})`);
            }
            const data = await res.json();
            setSelectedCustomer(data);
        } catch (err: any) {
            console.error('Failed to load customer profile:', err);
            alert(err.message || 'Failed to load customer profile');
        } finally {
            setProfileLoading(false);
        }
    };

    const toggleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
        setPage(1);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const formatDOB = (dateStr: string | null) => {
        if (!dateStr) return '—';
        return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <div className="p-8 flex flex-col h-screen space-y-6 overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-start shrink-0">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-black text-black tracking-tight">Customers</h2>
                        <SyncIndicator isRevalidating={isRevalidating} />
                    </div>
                    <p className="text-sm font-medium text-neutral-500 mt-1">
                        Track your diners, visit history, and loyalty insights.
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4 shrink-0">
                <div className="bg-white rounded-2xl border border-neutral-200/60 p-4 flex items-center gap-3 shadow-sm">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                        <Users size={18} className="text-blue-600" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Total</p>
                        <p className="text-xl font-black text-black">{stats.total}</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-neutral-200/60 p-4 flex items-center gap-3 shadow-sm">
                    <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                        <UserPlus size={18} className="text-green-600" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">New This Week</p>
                        <p className="text-xl font-black text-black">{stats.newThisWeek}</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-neutral-200/60 p-4 flex items-center gap-3 shadow-sm">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                        <UserCheck size={18} className="text-orange-600" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Returning</p>
                        <p className="text-xl font-black text-black">{stats.returning}</p>
                    </div>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between text-sm shrink-0">
                    <span className="font-medium">{error}</span>
                    <button
                        onClick={() => loadCustomers(true)}
                        className="text-xs font-bold bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1.5 rounded-lg transition-colors ml-4"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Search */}
            <div className="relative shrink-0">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                <input
                    type="text"
                    placeholder="Search by mobile or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full md:w-80 pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder:text-neutral-400 transition-all shadow-sm"
                />
                {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-neutral-200/60 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
                <div className="overflow-y-auto no-scrollbar flex-1">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-neutral-50/80 text-neutral-500 font-semibold border-b border-neutral-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-5 py-3.5">Customer</th>
                                <th className="px-5 py-3.5">Email</th>
                                <th className="px-5 py-3.5">DOB</th>
                                <th className="px-5 py-3.5 cursor-pointer select-none" onClick={() => toggleSort('visit_count')}>
                                    <span className="flex items-center gap-1">Visits <ArrowUpDown size={12} className="opacity-40" /></span>
                                </th>
                                <th className="px-5 py-3.5 cursor-pointer select-none" onClick={() => toggleSort('order_count')}>
                                    <span className="flex items-center gap-1">Orders <ArrowUpDown size={12} className="opacity-40" /></span>
                                </th>
                                <th className="px-5 py-3.5 cursor-pointer select-none" onClick={() => toggleSort('total_spend')}>
                                    <span className="flex items-center gap-1">Spend <ArrowUpDown size={12} className="opacity-40" /></span>
                                </th>
                                <th className="px-5 py-3.5 cursor-pointer select-none" onClick={() => toggleSort('first_visit')}>
                                    <span className="flex items-center gap-1">First Visit <ArrowUpDown size={12} className="opacity-40" /></span>
                                </th>
                                <th className="px-5 py-3.5 cursor-pointer select-none" onClick={() => toggleSort('last_visit')}>
                                    <span className="flex items-center gap-1">Last Visit <ArrowUpDown size={12} className="opacity-40" /></span>
                                </th>
                                <th className="px-5 py-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {loading && customers.length === 0 ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}>
                                        {Array.from({ length: 9 }).map((_, j) => (
                                            <td key={j} className="px-5 py-4">
                                                <div className="h-4 bg-neutral-100 rounded-md animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : customers.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-5 py-16 text-center">
                                        <Users size={40} className="mx-auto text-neutral-300 mb-3" />
                                        <p className="text-neutral-500 font-semibold">No customers found</p>
                                        <p className="text-neutral-400 text-xs mt-1">Customers will appear here after they scan a QR code and share their details.</p>
                                    </td>
                                </tr>
                            ) : (
                                customers.map((c) => (
                                    <tr key={c.id} className="hover:bg-neutral-50/50 transition-colors group">
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                                                    {(c.name || c.mobile || c.email || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-neutral-900 truncate">
                                                        {c.name || 'Guest Diner'}
                                                    </p>
                                                    <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                                                        <Phone size={11} className="text-neutral-400 flex-shrink-0" />
                                                        <span className="truncate">{c.mobile || '—'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-xs text-neutral-600 truncate max-w-[180px]">
                                            {c.email || '—'}
                                        </td>
                                        <td className="px-5 py-3.5 text-xs text-neutral-600">
                                            {formatDOB(c.date_of_birth)}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold ${
                                                c.visit_count > 3 ? 'bg-green-50 text-green-700' : 'bg-neutral-100 text-neutral-600'
                                            }`}>
                                                {c.visit_count}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-sm font-medium text-black">{c.order_count}</td>
                                        <td className="px-5 py-3.5 text-sm font-semibold text-black">{formatCurrency(c.total_spend)}</td>
                                        <td className="px-5 py-3.5 text-xs text-neutral-500">{formatDate(c.first_visit)}</td>
                                        <td className="px-5 py-3.5 text-xs text-neutral-500">{formatDate(c.last_visit)}</td>
                                        <td className="px-5 py-3.5 text-right">
                                            <button
                                                onClick={() => openProfile(c.id)}
                                                className="text-blue-600 hover:text-blue-800 text-xs font-semibold hover:underline opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-auto"
                                            >
                                                <Eye size={13} /> Profile
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-5 py-3 border-t border-neutral-100 flex items-center justify-between bg-neutral-50/50 shrink-0">
                        <p className="text-xs text-neutral-500 font-medium">
                            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
                        </p>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setPage(Math.max(1, page - 1))}
                                disabled={page <= 1}
                                className="p-1.5 rounded-lg hover:bg-neutral-200/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum: number;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (page <= 3) {
                                    pageNum = i + 1;
                                } else if (page >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = page - 2 + i;
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setPage(pageNum)}
                                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                                            page === pageNum
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'hover:bg-neutral-200/60 text-neutral-600'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setPage(Math.min(totalPages, page + 1))}
                                disabled={page >= totalPages}
                                className="p-1.5 rounded-lg hover:bg-neutral-200/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Customer Profile Modal */}
            {(selectedCustomer || profileLoading) && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-end" onClick={() => { setSelectedCustomer(null); setProfileLoading(false); }}>
                    <div
                        className="w-full max-w-lg h-full bg-white shadow-2xl overflow-y-auto animate-in slide-in-from-right"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <div className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                            <h3 className="text-lg font-black text-black">Customer Profile</h3>
                            <button
                                onClick={() => { setSelectedCustomer(null); setProfileLoading(false); }}
                                className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {profileLoading ? (
                            <div className="p-6 space-y-4">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="h-8 bg-neutral-100 rounded-xl animate-pulse" />
                                ))}
                            </div>
                        ) : selectedCustomer?.customer ? (
                            <div className="p-6 space-y-6">
                                {/* Customer Info */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-black">
                                            {(selectedCustomer.customer.name || selectedCustomer.customer.mobile || selectedCustomer.customer.email || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h4 className="text-base font-black text-slate-900">
                                                {selectedCustomer.customer.name || 'Guest Diner'}
                                            </h4>
                                            <p className="font-semibold text-slate-700 text-sm flex items-center gap-1.5 mt-0.5">
                                                <Phone size={13} className="text-neutral-400" />
                                                {selectedCustomer.customer.mobile || 'No mobile'}
                                            </p>
                                            {selectedCustomer.customer.email && (
                                                <p className="text-xs text-neutral-500 flex items-center gap-1.5 mt-0.5">
                                                    <Mail size={12} className="text-neutral-400" />
                                                    {selectedCustomer.customer.email}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {selectedCustomer.customer.date_of_birth && (
                                        <div className="flex items-center gap-2 text-sm text-neutral-600 pl-1">
                                            <Calendar size={14} className="text-neutral-400" />
                                            Birthday: {formatDate(selectedCustomer.customer.date_of_birth)}
                                        </div>
                                    )}
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-blue-50/50 rounded-xl p-3.5 border border-blue-100/50">
                                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Total Visits</p>
                                        <p className="text-2xl font-black text-blue-700 mt-0.5">{selectedCustomer.customer.visit_count}</p>
                                    </div>
                                    <div className="bg-green-50/50 rounded-xl p-3.5 border border-green-100/50">
                                        <p className="text-[10px] font-bold text-green-500 uppercase tracking-wider">Total Orders</p>
                                        <p className="text-2xl font-black text-green-700 mt-0.5">{selectedCustomer.customer.order_count}</p>
                                    </div>
                                    <div className="bg-orange-50/50 rounded-xl p-3.5 border border-orange-100/50">
                                        <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">Total Spend</p>
                                        <p className="text-2xl font-black text-orange-700 mt-0.5">{formatCurrency(selectedCustomer.customer.total_spend)}</p>
                                    </div>
                                    <div className="bg-purple-50/50 rounded-xl p-3.5 border border-purple-100/50">
                                        <p className="text-[10px] font-bold text-purple-500 uppercase tracking-wider">Avg / Visit</p>
                                        <p className="text-2xl font-black text-purple-700 mt-0.5">
                                            {selectedCustomer.customer.order_count > 0
                                                ? formatCurrency(selectedCustomer.customer.total_spend / selectedCustomer.customer.order_count)
                                                : '₹0'}
                                        </p>
                                    </div>
                                </div>

                                {/* Visit Timeline */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-black text-black">Visit History</h4>
                                    </div>
                                    <div className="space-y-2.5 text-xs">
                                        <div className="flex items-center gap-3 bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                                            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                                                <TrendingUp size={14} className="text-green-600" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-black">First Visit</p>
                                                <p className="text-neutral-500">{formatDate(selectedCustomer.customer.first_visit)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                                <Clock size={14} className="text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-black">Last Visit</p>
                                                <p className="text-neutral-500">{formatDate(selectedCustomer.customer.last_visit)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Order History */}
                                <div>
                                    <h4 className="text-sm font-black text-black mb-3">Order History</h4>
                                    {selectedCustomer.orders.length === 0 ? (
                                        <div className="bg-neutral-50 rounded-xl p-6 text-center border border-neutral-100">
                                            <ShoppingBag size={24} className="mx-auto text-neutral-300 mb-2" />
                                            <p className="text-xs text-neutral-500 font-medium">No linked orders yet</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {selectedCustomer.orders.map((order) => (
                                                <div key={order.id} className="bg-neutral-50 rounded-xl p-3.5 border border-neutral-100 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                                                            <Hash size={14} className="text-orange-600" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-black">#{order.order_number}</p>
                                                            <p className="text-[10px] text-neutral-500">Table {order.table_number} · {formatDate(order.created_at)}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-bold text-black">{formatCurrency(order.total)}</p>
                                                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                                            order.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                            order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                                            'bg-yellow-100 text-yellow-700'
                                                        }`}>
                                                            {order.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 text-center text-neutral-500 font-medium">
                                Customer not found.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
