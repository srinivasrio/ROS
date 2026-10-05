'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Users,
    Search,
    Plus,
    Building2,
    ShieldCheck,
    CheckCircle2,
    Calendar,
    Phone,
    Mail,
    Sparkles,
    Check,
    X,
    ExternalLink,
    AlertCircle,
    Copy,
    Sliders,
    Eye,
    ShieldAlert,
    Trash2,
    AlertTriangle,
    Clock,
    ChevronRight,
    ArrowUpDown,
    Filter,
    Layers,
    LayoutGrid,
    Table as TableIcon,
    ChevronLeft,
    Zap,
    Lock,
    Store
} from 'lucide-react';
import { toast } from 'sonner';

function OwnersContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const actionQuery = searchParams.get('action');
    const tabQuery = searchParams.get('tab');

    const [owners, setOwners] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [allRestaurants, setAllRestaurants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Tab State: 'all' | 'pending' | 'active' | 'inactive'
    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'active' | 'inactive'>(
        tabQuery === 'pending' || tabQuery === 'requests' ? 'pending' : 'all'
    );

    // Filter, Search, Sort, View, Pagination states
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [quotaFilter, setQuotaFilter] = useState('ALL');
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'quota_used' | 'locations'>('newest');
    const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
    const [page, setPage] = useState(1);
    const pageSize = 10;

    // Approve Registration Modal
    const [ownerToApprove, setOwnerToApprove] = useState<any | null>(null);
    const [approveQuota, setApproveQuota] = useState(0);
    const [approveLoading, setApproveLoading] = useState(false);

    // Reject Registration Modal
    const [ownerToReject, setOwnerToReject] = useState<any | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectLoading, setRejectLoading] = useState(false);

    // Dedicated Pending Branch Registration Requests
    const [pendingBranchRequests, setPendingBranchRequests] = useState<any[]>([]);

    // Approve Branch Modal
    const [branchToApprove, setBranchToApprove] = useState<any | null>(null);
    const [branchApprovePlan, setBranchApprovePlan] = useState('standard');
    const [branchApproveQuota, setBranchApproveQuota] = useState(1);
    const [branchApproveAmount, setBranchApproveAmount] = useState(999);
    const [branchApproveLoading, setBranchApproveLoading] = useState(false);

    // Reject Branch Modal
    const [branchToReject, setBranchToReject] = useState<any | null>(null);
    const [branchRejectReason, setBranchRejectReason] = useState('');
    const [branchRejectLoading, setBranchRejectLoading] = useState(false);

    // Create Owner Modal
    const [createModalOpen, setCreateModalOpen] = useState(actionQuery === 'new');
    const [newOwnerData, setNewOwnerData] = useState({ name: '', email: '', phone: '', restaurantId: '', maxBranches: 0, password: '' });
    const [inviteLinkCreated, setInviteLinkCreated] = useState<string | null>(null);
    const [createLoading, setCreateLoading] = useState(false);

    // Quick Quota Modal
    const [quotaModalData, setQuotaModalData] = useState<{ owner: any; quota: number } | null>(null);
    const [quotaUpdating, setQuotaUpdating] = useState(false);

    // Delete Confirmation Modal
    const [ownerToDelete, setOwnerToDelete] = useState<any | null>(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);

    const fetchOwners = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/owners');
            if (res.ok) {
                const data = await res.json();
                setOwners(data.owners || []);
                setSummary(data.summary || null);
                setAllRestaurants(data.allRestaurants || []);
                setPendingBranchRequests(data.pendingBranchRequests || []);
            } else {
                toast.error('Failed to load owners');
            }
        } catch (err) {
            console.error('Failed to fetch owners:', err);
            toast.error('Network error loading owners');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOwners();
    }, []);

    useEffect(() => {
        if (tabQuery === 'pending' || tabQuery === 'requests') {
            setActiveTab('pending');
        }
    }, [tabQuery]);

    // Approve Owner Handler
    const handleApproveOwner = async () => {
        if (!ownerToApprove) return;
        setApproveLoading(true);
        try {
            const res = await fetch('/api/admin/owners', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'approve_owner',
                    ownerId: ownerToApprove.id,
                    requestId: ownerToApprove.requestId,
                    email: ownerToApprove.email,
                    maxBranches: approveQuota || 0,
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(data.message || `Owner account for ${ownerToApprove.name} approved!`);
                setOwnerToApprove(null);
                await fetchOwners();
            } else {
                toast.error(data.error || 'Failed to approve owner');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error approving owner');
        } finally {
            setApproveLoading(false);
        }
    };

    // Reject Owner Handler
    const handleRejectOwner = async () => {
        if (!ownerToReject) return;
        setRejectLoading(true);
        try {
            const res = await fetch('/api/admin/owners', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'reject_owner',
                    ownerId: ownerToReject.id,
                    requestId: ownerToReject.requestId,
                    email: ownerToReject.email,
                    reason: rejectReason || 'Account registration rejected by Super Admin',
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(data.message || 'Owner registration rejected');
                setOwnerToReject(null);
                setRejectReason('');
                await fetchOwners();
            } else {
                toast.error(data.error || 'Failed to reject registration');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error rejecting owner');
        } finally {
            setRejectLoading(false);
        }
    };

    // Open Approve Branch Modal helper
    const openApproveBranchModal = (branch: any) => {
        setBranchToApprove(branch);
        setBranchApprovePlan(branch.planSlug || 'standard');
        setBranchApproveQuota(branch.customQuota || branch.planLimit || 1);
        setBranchApproveAmount(branch.amountDue || 999);
    };

    // Approve Branch Handler (Atomic Approval)
    const handleApproveBranch = async () => {
        if (!branchToApprove) return;
        setBranchApproveLoading(true);
        try {
            const res = await fetch('/api/admin/owners', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'approve_branch',
                    requestId: branchToApprove.id || branchToApprove.requestId,
                    restaurantId: branchToApprove.restaurantId,
                    planSlug: branchApprovePlan,
                    customQuota: Number(branchApproveQuota) || null,
                    amountDue: Number(branchApproveAmount) || 0,
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(data.message || `Branch "${branchToApprove.restaurantName || 'Restaurant'}" approved successfully!`);
                setBranchToApprove(null);
                await fetchOwners();
            } else {
                toast.error(data.error || 'Failed to approve branch');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error approving branch');
        } finally {
            setBranchApproveLoading(false);
        }
    };

    // Reject Branch Handler
    const handleRejectBranch = async () => {
        if (!branchToReject) return;
        setBranchRejectLoading(true);
        try {
            const res = await fetch('/api/admin/owners', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'reject_branch',
                    requestId: branchToReject.id || branchToReject.requestId,
                    restaurantId: branchToReject.restaurantId,
                    reason: branchRejectReason || 'Branch registration rejected by Super Admin',
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(data.message || 'Branch registration rejected');
                setBranchToReject(null);
                setBranchRejectReason('');
                await fetchOwners();
            } else {
                toast.error(data.error || 'Failed to reject branch');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error rejecting branch');
        } finally {
            setBranchRejectLoading(false);
        }
    };

    // Create Owner Handler
    const handleCreateOwner = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateLoading(true);
        try {
            const res = await fetch('/api/admin/owners', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newOwnerData),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success('Owner account created! Generated secure onboarding link.');
                setInviteLinkCreated(data.onboardingLink);
                await fetchOwners();
            } else {
                toast.error(data.error || 'Failed to provision owner');
            }
        } catch (err: any) {
            toast.error(err.message || 'Operation failed');
        } finally {
            setCreateLoading(false);
        }
    };

    // Update Quota Handler
    const handleUpdateQuota = async () => {
        if (!quotaModalData) return;
        setQuotaUpdating(true);
        try {
            const res = await fetch('/api/admin/owners', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_quota',
                    ownerId: quotaModalData.owner.id,
                    maxBranches: quotaModalData.quota,
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(data.message || 'Owner quota updated');
                setQuotaModalData(null);
                await fetchOwners();
            } else {
                toast.error(data.error || 'Failed to update quota');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error updating quota');
        } finally {
            setQuotaUpdating(false);
        }
    };

    // Toggle Status Handler
    const handleToggleStatus = async (owner: any) => {
        const newStatus = owner.status === 'ACTIVE' ? 'inactive' : 'active';
        try {
            const res = await fetch('/api/admin/owners', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'toggle_status',
                    ownerId: owner.id,
                    status: newStatus,
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(data.message || `Owner set to ${newStatus}`);
                await fetchOwners();
            } else {
                toast.error(data.error || 'Failed to toggle status');
            }
        } catch (err) {
            toast.error('Network error toggling status');
        }
    };

    // Delete Owner Handler
    const handleDeleteOwner = async () => {
        if (!ownerToDelete) return;
        setDeleteLoading(true);
        try {
            const params = new URLSearchParams();
            if (ownerToDelete.id) params.set('id', ownerToDelete.id);
            if (ownerToDelete.email) params.set('email', ownerToDelete.email);
            if (ownerToDelete.requestId) params.set('requestId', ownerToDelete.requestId);

            const res = await fetch(`/api/admin/owners?${params.toString()}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(data.message || 'Owner account deleted successfully');
                setOwnerToDelete(null);
                setDeleteConfirmText('');
                await fetchOwners();
            } else {
                toast.error(data.error || 'Failed to delete owner account');
            }
        } catch (err: any) {
            toast.error(err.message || 'Network error deleting owner');
        } finally {
            setDeleteLoading(false);
        }
    };

    // Filtered & Sorted Owners
    const processedOwners = useMemo(() => {
        return owners
            .filter((o) => {
                const matchSearch =
                    !search ||
                    o.name?.toLowerCase().includes(search.toLowerCase()) ||
                    o.email?.toLowerCase().includes(search.toLowerCase()) ||
                    o.phone?.includes(search) ||
                    o.id?.toLowerCase().includes(search.toLowerCase()) ||
                    o.requestNumber?.toLowerCase().includes(search.toLowerCase());

                const matchTab =
                    activeTab === 'all'
                        ? (statusFilter === 'ALL' || o.status?.toUpperCase() === statusFilter.toUpperCase())
                        : activeTab === 'pending'
                        ? (o.status === 'PENDING' || o.isPendingApproval)
                        : activeTab === 'active'
                        ? (o.status === 'ACTIVE')
                        : (o.status === 'INACTIVE' || o.status === 'SUSPENDED' || o.status === 'REJECTED');

                const matchQuota =
                    quotaFilter === 'ALL' || o.quotaStatus === quotaFilter;

                return matchSearch && matchTab && matchQuota;
            })
            .sort((a, b) => {
                if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
                if (sortBy === 'oldest') return new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime();
                if (sortBy === 'quota_used') return b.usedQuota - a.usedQuota;
                if (sortBy === 'locations') return b.totalLocations - a.totalLocations;
                // Default 'newest'
                return new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime();
            });
    }, [owners, search, activeTab, statusFilter, quotaFilter, sortBy]);

    // Dedicated Pending Owner Requests Queue
    const pendingOwnerRequests = useMemo(() => {
        return owners.filter((o) => o.status === 'PENDING' || o.isPendingApproval);
    }, [owners]);

    // Total Pending Queue (Owners + Branches)
    const totalPendingCount = useMemo(() => {
        return (summary?.totalPendingQueue ?? (pendingOwnerRequests.length + pendingBranchRequests.length));
    }, [summary, pendingOwnerRequests, pendingBranchRequests]);

    // Paginated
    const totalPages = Math.max(1, Math.ceil(processedOwners.length / pageSize));
    const paginatedOwners = processedOwners.slice((page - 1) * pageSize, page * pageSize);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-md">
                            Parent Management Entity
                        </span>
                    </div>
                    <h1 className="text-2xl font-black tracking-tight text-[#172033]">
                        Owners Administration
                    </h1>
                    <p className="text-xs text-[#667085] mt-0.5 font-medium">
                        Centrally manage restaurant franchise owners, account approvals, independent location boundaries, and branch quotas.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            setNewOwnerData({ name: '', email: '', phone: '', restaurantId: '', maxBranches: 5, password: '' });
                            setInviteLinkCreated(null);
                            setCreateModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                    >
                        <Plus size={15} />
                        <span>Provision Owner Account</span>
                    </button>
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div
                    onClick={() => { setActiveTab('all'); setPage(1); }}
                    className={`p-4 rounded-2xl bg-white border transition-all cursor-pointer shadow-2xs ${
                        activeTab === 'all' ? 'border-indigo-600 ring-2 ring-indigo-600/10' : 'border-[#E4E7EC] hover:border-neutral-300'
                    }`}
                >
                    <div className="flex items-center justify-between text-neutral-400 mb-2">
                        <span className="text-[11px] font-bold text-[#667085] uppercase tracking-wider">Total Owners</span>
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <Users size={16} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-[#172033] tracking-tight">
                        {summary?.totalOwners ?? owners.length}
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-1">Registered franchise & brand owners</p>
                </div>

                <div
                    onClick={() => { setActiveTab('pending'); setPage(1); }}
                    className={`p-4 rounded-2xl transition-all cursor-pointer shadow-2xs border ${
                        activeTab === 'pending'
                            ? 'bg-amber-50/70 border-amber-500 ring-2 ring-amber-500/15'
                            : totalPendingCount > 0
                            ? 'bg-amber-50/30 border-amber-200 hover:border-amber-300'
                            : 'bg-white border-[#E4E7EC] hover:border-neutral-300'
                    }`}
                >
                    <div className="flex items-center justify-between text-neutral-400 mb-2">
                        <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Pending Approval</span>
                        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                            <Clock size={16} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-amber-800 tracking-tight flex items-center gap-2">
                        <span>{totalPendingCount}</span>
                        {totalPendingCount > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 animate-pulse">
                                Review Queue
                            </span>
                        )}
                    </div>
                    <p className="text-[11px] text-amber-700/80 mt-1">
                        {pendingBranchRequests.length > 0 && pendingOwnerRequests.length > 0
                            ? `${pendingBranchRequests.length} branch(es) · ${pendingOwnerRequests.length} owner(s)`
                            : pendingBranchRequests.length > 0
                            ? `${pendingBranchRequests.length} branch(es) awaiting approval`
                            : 'Website registrations awaiting approval'}
                    </p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E4E7EC] shadow-2xs">
                    <div className="flex items-center justify-between text-neutral-400 mb-2">
                        <span className="text-[11px] font-bold text-[#667085] uppercase tracking-wider">Active Locations</span>
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <Store size={16} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-[#172033] tracking-tight">
                        {summary?.activeLocations ?? 0}
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-1">
                        Across {summary?.totalLocations ?? 0} total restaurant tenants
                    </p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E4E7EC] shadow-2xs">
                    <div className="flex items-center justify-between text-neutral-400 mb-2">
                        <span className="text-[11px] font-bold text-[#667085] uppercase tracking-wider">Quota Allocation</span>
                        <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                            <Sliders size={16} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-[#172033] tracking-tight">
                        {summary?.usedQuota ?? 0} <span className="text-sm font-medium text-neutral-400">/ {summary?.totalQuota ?? 0}</span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-1">Total authorized branch slots</p>
                </div>
            </div>

            {/* Top Level Section Tabs: All Owners | Pending Approval | Active | Inactive */}
            <div className="flex items-center gap-2 border-b border-[#E4E7EC] pb-2 overflow-x-auto">
                <button
                    onClick={() => { setActiveTab('all'); setPage(1); }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === 'all'
                            ? 'bg-[#172033] text-white shadow-xs'
                            : 'text-[#667085] hover:text-[#172033] hover:bg-[#F5F7FC]'
                    }`}
                >
                    <Users size={14} />
                    <span>All Owners</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-neutral-100/30 text-current font-mono">
                        {summary?.totalOwners ?? owners.length}
                    </span>
                </button>

                <button
                    onClick={() => { setActiveTab('pending'); setPage(1); }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === 'pending'
                            ? 'bg-amber-600 text-white shadow-xs shadow-amber-600/20'
                            : 'text-amber-800 hover:text-amber-900 hover:bg-amber-50'
                    }`}
                >
                    <Clock size={14} />
                    <span>Pending Requests</span>
                    {totalPendingCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-amber-950 font-mono animate-pulse">
                            {totalPendingCount} Pending
                        </span>
                    ) : (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-neutral-100 text-neutral-600 font-mono">
                            0
                        </span>
                    )}
                </button>

                <button
                    onClick={() => { setActiveTab('active'); setPage(1); }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === 'active'
                            ? 'bg-[#172033] text-white shadow-xs'
                            : 'text-[#667085] hover:text-[#172033] hover:bg-[#F5F7FC]'
                    }`}
                >
                    <CheckCircle2 size={14} />
                    <span>Active Accounts</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-neutral-100/30 text-current font-mono">
                        {summary?.activeOwners ?? owners.filter(o => o.status === 'ACTIVE' && !o.isPendingApproval).length}
                    </span>
                </button>

                <button
                    onClick={() => { setActiveTab('inactive'); setPage(1); }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === 'inactive'
                            ? 'bg-[#172033] text-white shadow-xs'
                            : 'text-[#667085] hover:text-[#172033] hover:bg-[#F5F7FC]'
                    }`}
                >
                    <ShieldAlert size={14} />
                    <span>Inactive / Suspended</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-neutral-100/30 text-current font-mono">
                        {summary?.inactiveOwners ?? 0}
                    </span>
                </button>
            </div>

            {/* Dedicated Pending Branch Approvals Area */}
            {pendingBranchRequests.length > 0 && activeTab !== 'inactive' && (
                <div className="bg-emerald-50/70 border-2 border-emerald-300/80 rounded-3xl p-5 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-sm shadow-emerald-600/30 shrink-0 mt-0.5">
                                <Store size={20} className="animate-pulse" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base font-black text-emerald-950">Pending Branch & Restaurant Approvals</h2>
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-200 text-emerald-900 font-mono">
                                        {pendingBranchRequests.length} in Queue
                                    </span>
                                </div>
                                <p className="text-xs text-emerald-800/90 mt-0.5 leading-relaxed">
                                    New restaurant branches created by owners awaiting Super Admin approval. Approving atomically activates the restaurant and branch, binds the subscription quota, and unlocks Restaurant Admin login.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                        {pendingBranchRequests.map((bReq) => (
                            <div key={bReq.id} className="bg-white rounded-2xl border border-emerald-200 p-4 shadow-2xs space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <h3 className="font-extrabold text-sm text-[#172033] flex items-center gap-1.5">
                                            <span>{bReq.restaurantName}</span>
                                        </h3>
                                        <div className="flex items-center gap-1 text-[11px] text-[#667085] truncate">
                                            <span className="font-semibold text-neutral-800">Owner:</span>
                                            {bReq.ownerId ? (
                                                <Link
                                                    href={`/admin/owners/${bReq.ownerId}?tab=locations`}
                                                    className="text-indigo-600 hover:underline truncate"
                                                >
                                                    {bReq.ownerName}
                                                </Link>
                                            ) : (
                                                <span className="truncate">{bReq.ownerName}</span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                                        Awaiting Approval
                                    </span>
                                </div>

                                <div className="space-y-1.5 text-xs text-[#667085] bg-neutral-50/70 p-2.5 rounded-xl border border-neutral-100">
                                    <div className="flex items-center justify-between text-[11px]">
                                        <span className="text-neutral-500">Plan & Quota:</span>
                                        <span className="font-bold text-[#172033] capitalize">
                                            {bReq.planName || 'Standard'} ({bReq.planLimit || 1} Loc)
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px]">
                                        <span className="text-neutral-500">Amount Due:</span>
                                        <span className="font-bold text-emerald-700">₹{bReq.amountDue}</span>
                                    </div>
                                    {bReq.paymentReference && (
                                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-neutral-200/60 font-mono">
                                            <span className="text-neutral-500 font-sans">UTR / Ref:</span>
                                            <span className="text-neutral-900 font-bold">{bReq.paymentReference}</span>
                                        </div>
                                    )}
                                    {bReq.requestNumber && (
                                        <div className="flex items-center justify-between text-[11px] font-mono">
                                            <span className="text-neutral-500 font-sans">Request Ref:</span>
                                            <span className="text-neutral-700">{bReq.requestNumber}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-2 border-t border-emerald-100 flex items-center gap-2">
                                    <button
                                        onClick={() => openApproveBranchModal(bReq)}
                                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                        <CheckCircle2 size={13} />
                                        <span>Approve Branch</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setBranchToReject(bReq);
                                            setBranchRejectReason('');
                                        }}
                                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                    >
                                        <X size={13} />
                                        <span>Reject</span>
                                    </button>
                                    {bReq.ownerId && (
                                        <Link
                                            href={`/admin/owners/${bReq.ownerId}?tab=locations`}
                                            className="p-1.5 text-neutral-400 hover:text-indigo-600 rounded-xl hover:bg-neutral-100 transition-colors"
                                            title="View in Owner Workspace"
                                        >
                                            <ExternalLink size={14} />
                                        </Link>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Dedicated Pending Owner Requests Area */}
            {pendingOwnerRequests.length > 0 && activeTab !== 'inactive' && (
                <div className="bg-amber-50/70 border-2 border-amber-300/80 rounded-3xl p-5 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black shadow-sm shadow-amber-500/30 shrink-0 mt-0.5">
                                <Clock size={20} className="animate-pulse" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base font-black text-amber-950">Pending Owner Registration Requests</h2>
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900 font-mono">
                                        {pendingOwnerRequests.length} in Queue
                                    </span>
                                </div>
                                <p className="text-xs text-amber-800/90 mt-0.5 leading-relaxed">
                                    Prospective owners who signed up from the public website and verified their email via OTP. Approving activates their login access so they can create and manage their restaurants and branches.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                        {pendingOwnerRequests.map((req) => (
                            <div key={req.id} className="bg-white rounded-2xl border border-amber-200 p-4 shadow-2xs space-y-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="font-extrabold text-sm text-[#172033]">{req.name}</h3>
                                        <p className="text-[11px] text-[#667085] truncate max-w-[180px]">{req.email}</p>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                        Pending Review
                                    </span>
                                </div>

                                <div className="space-y-1 text-xs text-[#667085]">
                                    <div className="flex items-center gap-1.5">
                                        <Phone size={12} className="text-neutral-400" />
                                        <span className="font-medium text-[#172033]">{req.phone || '—'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Calendar size={12} className="text-neutral-400" />
                                        <span>Registered: {new Date(req.registrationDate || req.createdDate).toLocaleDateString()}</span>
                                    </div>
                                    {req.emailVerified && (
                                        <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold pt-0.5">
                                            <CheckCircle2 size={12} />
                                            <span>Email Verified via OTP</span>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-2 border-t border-amber-100 flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            setOwnerToApprove(req);
                                            setApproveQuota(req.quota ?? 0);
                                        }}
                                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                        <Check size={13} />
                                        <span>Approve</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setOwnerToReject(req);
                                            setRejectReason('');
                                        }}
                                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                    >
                                        <X size={13} />
                                        <span>Reject</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State for Pending Tab */}
            {activeTab === 'pending' && totalPendingCount === 0 && (
                <div className="p-8 rounded-3xl bg-amber-50/40 border border-amber-200 text-center space-y-2">
                    <CheckCircle2 size={32} className="mx-auto text-emerald-600" />
                    <h3 className="text-sm font-extrabold text-amber-950">No Pending Requests</h3>
                    <p className="text-xs text-amber-800/80 max-w-md mx-auto">
                        All owner registrations and restaurant branches have been reviewed and approved.
                    </p>
                </div>
            )}

            {/* Filter & Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-[#E4E7EC] shadow-2xs space-y-3">
                <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                    {/* Search */}
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={15} />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                            placeholder="Search owners by name, email, phone, or owner ID..."
                            className="w-full pl-10 pr-4 py-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs text-[#172033] placeholder-neutral-400 focus:outline-none focus:border-indigo-600 focus:bg-white font-medium"
                        />
                    </div>

                    {/* Filter: Status */}
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setPage(1);
                            }}
                            className="px-3 py-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs font-semibold text-[#172033] focus:outline-none focus:border-indigo-600 cursor-pointer"
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="ACTIVE">Active</option>
                            <option value="INACTIVE">Inactive</option>
                            <option value="SUSPENDED">Suspended</option>
                        </select>

                        {/* Filter: Quota Status */}
                        <select
                            value={quotaFilter}
                            onChange={(e) => {
                                setQuotaFilter(e.target.value);
                                setPage(1);
                            }}
                            className="px-3 py-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs font-semibold text-[#172033] focus:outline-none focus:border-indigo-600 cursor-pointer"
                        >
                            <option value="ALL">All Quota Statuses</option>
                            <option value="available">Quota Available</option>
                            <option value="near_limit">Near Limit (1 Left)</option>
                            <option value="limit_reached">Limit Reached</option>
                        </select>

                        {/* Sort */}
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="px-3 py-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs font-semibold text-[#172033] focus:outline-none focus:border-indigo-600 cursor-pointer"
                        >
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="name">Name (A-Z)</option>
                            <option value="quota_used">Quota Used (High to Low)</option>
                            <option value="locations">Locations Count</option>
                        </select>

                        {/* View toggle */}
                        <div className="hidden sm:flex items-center border border-[#E4E7EC] rounded-xl p-0.5 bg-[#F5F7FC]">
                            <button
                                onClick={() => setViewMode('table')}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    viewMode === 'table' ? 'bg-white text-indigo-600 shadow-2xs font-bold' : 'text-neutral-400 hover:text-neutral-700'
                                }`}
                                title="Table View"
                            >
                                <TableIcon size={14} />
                            </button>
                            <button
                                onClick={() => setViewMode('cards')}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    viewMode === 'cards' ? 'bg-white text-indigo-600 shadow-2xs font-bold' : 'text-neutral-400 hover:text-neutral-700'
                                }`}
                                title="Cards View"
                            >
                                <LayoutGrid size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* OWNERS DISPLAY */}
            {loading ? (
                <div className="bg-white rounded-2xl border border-[#E4E7EC] p-12 text-center">
                    <div className="inline-block h-8 w-8 rounded-full border-3 border-indigo-600 border-t-transparent animate-spin mb-3" />
                    <p className="font-bold text-xs text-[#172033]">Loading owner accounts & live quotas...</p>
                </div>
            ) : processedOwners.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#E4E7EC] p-12 text-center space-y-3">
                    <Users size={36} className="mx-auto text-neutral-300" />
                    <p className="font-extrabold text-sm text-[#172033]">No owner accounts match criteria</p>
                    <p className="text-xs text-[#667085]">Try clearing your search query or status filter.</p>
                </div>
            ) : viewMode === 'table' ? (
                /* TABLE VIEW */
                <div className="bg-white rounded-2xl border border-[#E4E7EC] shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-[#F5F7FC] border-b border-[#E4E7EC] text-[11px] font-black uppercase tracking-wider text-[#667085]">
                                    <th className="p-4">Owner Profile</th>
                                    <th className="p-4">Contact & ID</th>
                                    <th className="p-4">Restaurants / Locations</th>
                                    <th className="p-4">Branch Quota & Limits</th>
                                    <th className="p-4">Subscription</th>
                                    <th className="p-4">Status & Activity</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E4E7EC]">
                                {paginatedOwners.map((owner) => {
                                    const isOwnerActive = owner.status === 'ACTIVE';
                                    const isSuspended = owner.status === 'SUSPENDED';
                                    const quota = owner.quota ?? 0;
                                    const used = owner.usedQuota || 0;
                                    const remaining = owner.remainingQuota ?? Math.max(0, quota - used);
                                    const hasSub = owner.hasSubscription && quota > 0;
                                    const isLimitReached = hasSub && remaining === 0;

                                    return (
                                        <tr key={owner.id} className="hover:bg-[#F5F7FC]/70 transition-colors">
                                            {/* Profile */}
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm shadow-indigo-600/20">
                                                        {owner.name?.charAt(0) || 'O'}
                                                    </div>
                                                    <div>
                                                        <Link
                                                            href={`/admin/owners/${owner.id}`}
                                                            className="font-bold text-[#172033] hover:text-indigo-600 transition-colors flex items-center gap-1 group"
                                                        >
                                                            <span>{owner.name}</span>
                                                            <ChevronRight size={13} className="text-neutral-400 group-hover:text-indigo-600 transition-colors" />
                                                        </Link>
                                                        {owner.pendingBranchesCount > 0 && (
                                                            <div className="pt-0.5">
                                                                <Link
                                                                    href={`/admin/owners/${owner.id}?tab=locations`}
                                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200"
                                                                >
                                                                    <Clock size={9} className="animate-spin" />
                                                                    <span>{owner.pendingBranchesCount} Branch Awaiting Approval</span>
                                                                </Link>
                                                            </div>
                                                        )}
                                                        <p className="text-[10px] text-neutral-400">
                                                            Registered: {new Date(owner.registrationDate || owner.createdDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Contact & ID */}
                                            <td className="p-4">
                                                <p className="font-medium text-[#172033]">{owner.email}</p>
                                                <p className="text-[11px] text-[#667085]">{owner.phone}</p>
                                                <div className="flex items-center gap-1 mt-1 font-mono text-[10px] text-neutral-400">
                                                    <span>ID: {owner.id.slice(0, 8)}...</span>
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(owner.id);
                                                            toast.success('Owner ID copied!');
                                                        }}
                                                        className="hover:text-indigo-600 cursor-pointer"
                                                        title="Copy Owner ID"
                                                    >
                                                        <Copy size={11} />
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Restaurants / Locations */}
                                            <td className="p-4">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-extrabold text-[#172033]">
                                                            {owner.totalRestaurants ?? owner.totalLocations} {(owner.totalRestaurants ?? owner.totalLocations) === 1 ? 'Restaurant' : 'Restaurants'}
                                                        </span>
                                                        <span className="text-neutral-300">•</span>
                                                        <span className="font-bold text-[#667085]">
                                                            {owner.totalBranches ?? owner.totalLocations} {(owner.totalBranches ?? owner.totalLocations) === 1 ? 'Branch' : 'Branches'}
                                                        </span>
                                                    </div>
                                                    {owner.locations && owner.locations.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1 max-w-xs">
                                                            {owner.locations.slice(0, 3).map((loc: any) => (
                                                                <span
                                                                    key={loc.id}
                                                                    className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-700 truncate max-w-[120px]"
                                                                >
                                                                    {loc.name}
                                                                </span>
                                                            ))}
                                                            {owner.locations.length > 3 && (
                                                                <span className="px-1.5 py-0.5 rounded-md bg-neutral-100 text-[10px] font-bold text-neutral-600">
                                                                    +{owner.locations.length - 3} more
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[11px] text-neutral-400 italic">No locations provisioned</span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Branch Quota & Limits */}
                                            <td className="p-4">
                                                <div className="space-y-1.5 min-w-[140px]">
                                                    <div className="flex items-center justify-between text-[11px]">
                                                        <span className="font-bold text-[#172033]">{used} / {quota} Quota</span>
                                                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold ${
                                                            !hasSub
                                                                ? 'bg-neutral-100 text-neutral-600'
                                                                : isLimitReached
                                                                ? 'bg-amber-100 text-amber-800'
                                                                : 'bg-emerald-100 text-emerald-800'
                                                        }`}>
                                                            {!hasSub ? 'No Sub' : isLimitReached ? 'Maxed' : `${remaining} left`}
                                                        </span>
                                                    </div>

                                                    {/* Visual progress bar */}
                                                    <div className="w-full h-1.5 bg-[#E4E7EC] rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${
                                                                !hasSub ? 'bg-neutral-300' : isLimitReached ? 'bg-amber-500' : 'bg-indigo-600'
                                                            }`}
                                                            style={{ width: quota > 0 ? `${Math.min(100, (used / quota) * 100)}%` : '0%' }}
                                                        />
                                                    </div>

                                                    <button
                                                        onClick={() => setQuotaModalData({ owner, quota })}
                                                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline flex items-center gap-1"
                                                    >
                                                        <Sliders size={10} />
                                                        <span>Manage Quota</span>
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Subscription */}
                                            <td className="p-4">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-neutral-100 text-neutral-700 border border-neutral-200">
                                                    <Zap size={11} className="text-amber-500" />
                                                    {owner.subscription || 'No Active Subscription'}
                                                </span>
                                            </td>

                                            {/* Account Status & Activity */}
                                            <td className="p-4">
                                                <div className="space-y-1">
                                                    {owner.isPendingApproval || owner.status === 'PENDING' ? (
                                                        <>
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-300">
                                                                <Clock size={11} className="text-amber-600 animate-spin" />
                                                                <span>Pending Approval</span>
                                                            </span>
                                                            {owner.emailVerified && (
                                                                <p className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                                                                    <CheckCircle2 size={11} /> Verified via SES OTP
                                                                </p>
                                                            )}
                                                            {owner.requestNumber && (
                                                                <p className="text-[10px] font-mono text-neutral-400">
                                                                    Ref: {owner.requestNumber}
                                                                </p>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => handleToggleStatus(owner)}
                                                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                                                                    isOwnerActive
                                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                                        : isSuspended
                                                                        ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                                                        : 'bg-neutral-100 text-neutral-500 border-neutral-200 hover:bg-neutral-200'
                                                                }`}
                                                            >
                                                                {isOwnerActive ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
                                                                <span>{owner.status}</span>
                                                            </button>
                                                            <p className="text-[10px] text-neutral-400">
                                                                Activity: {new Date(owner.lastActivity).toLocaleDateString()}
                                                            </p>
                                                        </>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Actions */}
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {owner.isPendingApproval || owner.status === 'PENDING' ? (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    setOwnerToApprove(owner);
                                                                    setApproveQuota(owner.quota ?? 0);
                                                                }}
                                                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-sm shadow-emerald-600/20 transition-all flex items-center gap-1 cursor-pointer"
                                                            >
                                                                <Check size={12} />
                                                                <span>Approve</span>
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setOwnerToReject(owner);
                                                                    setRejectReason('');
                                                                }}
                                                                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                                                            >
                                                                <X size={12} />
                                                                <span>Reject</span>
                                                            </button>
                                                            <button
                                                                onClick={() => setQuotaModalData({ owner, quota })}
                                                                title="Configure Quota"
                                                                className="p-1.5 rounded-xl bg-[#F5F7FC] hover:bg-[#EEF2FF] text-neutral-600 hover:text-indigo-600 border border-[#E4E7EC] transition-colors cursor-pointer"
                                                            >
                                                                <Sliders size={13} />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setOwnerToDelete(owner);
                                                                    setDeleteConfirmText('');
                                                                }}
                                                                title="Delete Owner Registration"
                                                                className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Link
                                                                href={`/admin/owners/${owner.id}`}
                                                                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] shadow-sm shadow-indigo-600/20 transition-all flex items-center gap-1"
                                                            >
                                                                <Eye size={12} />
                                                                <span>View Details</span>
                                                            </Link>
                                                            <button
                                                                onClick={() => setQuotaModalData({ owner, quota })}
                                                                title="Manage Quota"
                                                                className="p-1.5 rounded-xl bg-[#F5F7FC] hover:bg-[#EEF2FF] text-neutral-600 hover:text-indigo-600 border border-[#E4E7EC] transition-colors cursor-pointer"
                                                            >
                                                                <Sliders size={13} />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setOwnerToDelete(owner);
                                                                    setDeleteConfirmText('');
                                                                }}
                                                                title="Delete Owner"
                                                                className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 transition-colors cursor-pointer"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* CARDS VIEW */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {paginatedOwners.map((owner) => {
                        const isOwnerActive = owner.status === 'ACTIVE';
                        const isSuspended = owner.status === 'SUSPENDED';
                        const isPending = owner.isPendingApproval || owner.status === 'PENDING';
                        const isApproved = owner.approvalStatus === 'APPROVED' || (!isPending && owner.status === 'ACTIVE');
                        const quota = owner.quota ?? 0;
                        const used = owner.usedQuota || 0;
                        const remaining = owner.remainingQuota ?? Math.max(0, quota - used);
                        const hasSub = owner.hasSubscription && quota > 0;
                        const isLimitReached = hasSub && remaining === 0;

                        const totalRest = owner.totalRestaurants ?? owner.totalLocations ?? (owner.restaurants?.length || 0);
                        const totalBr = owner.totalBranches ?? (owner.restaurants?.reduce((acc: number, r: any) => acc + (r.branchesCount || 1), 0) || totalRest);

                        return (
                            <div
                                key={owner.id}
                                className={`rounded-3xl border p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 ${
                                    isPending ? 'bg-amber-50/25 border-amber-300/80 ring-1 ring-amber-300/30' : 'bg-white border-[#E4E7EC]'
                                }`}
                            >
                                <div className="space-y-4">
                                    {/* Card Header: Avatar, Name, Email & Badges */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base shadow-sm shrink-0 ${
                                                isPending
                                                    ? 'bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-amber-500/25'
                                                    : 'bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-indigo-600/25'
                                            }`}>
                                                {owner.name?.charAt(0) || 'O'}
                                            </div>
                                            <div className="min-w-0">
                                                <Link
                                                    href={`/admin/owners/${owner.id}`}
                                                    className="font-extrabold text-sm text-[#172033] hover:text-indigo-600 transition-colors truncate block"
                                                    title={owner.name}
                                                >
                                                    {owner.name}
                                                </Link>
                                                <div className="flex items-center gap-1 text-[11px] text-[#667085] truncate pt-0.5">
                                                    <Mail size={12} className="text-neutral-400 shrink-0" />
                                                    <span className="truncate">{owner.email}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                            {/* Account Status Badge */}
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                                    isPending
                                                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                                                        : isOwnerActive
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : isSuspended
                                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                        : 'bg-neutral-100 text-neutral-500 border-neutral-200'
                                                }`}
                                            >
                                                {owner.status}
                                            </span>

                                            {/* Approval Status Badge */}
                                            {isApproved ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    <CheckCircle2 size={10} />
                                                    <span>Approved</span>
                                                </span>
                                            ) : isPending ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                                                    <Clock size={10} className="animate-spin" />
                                                    <span>Pending Review</span>
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                                                    <X size={10} />
                                                    <span>{owner.approvalStatus || 'Rejected'}</span>
                                                </span>
                                            )}

                                            {owner.pendingBranchesCount > 0 && (
                                                <Link
                                                    href={`/admin/owners/${owner.id}?tab=locations`}
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500 text-white animate-pulse shadow-2xs hover:bg-amber-600 transition-colors"
                                                >
                                                    <Clock size={10} />
                                                    <span>{owner.pendingBranchesCount} Branch Awaiting Approval</span>
                                                </Link>
                                            )}
                                        </div>
                                    </div>

                                    {/* Contact & Registration Meta */}
                                    <div className="p-3 bg-[#F5F7FC] rounded-2xl border border-[#E4E7EC] text-xs space-y-1.5 text-[#667085]">
                                        <div className="flex items-center justify-between">
                                            <span className="flex items-center gap-1.5 text-[#667085]">
                                                <Phone size={12} className="text-neutral-400" />
                                                <span>Phone:</span>
                                            </span>
                                            <span className="font-semibold text-[#172033]">{owner.phone || '—'}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="flex items-center gap-1.5 text-[#667085]">
                                                <Calendar size={12} className="text-neutral-400" />
                                                <span>Registration Date:</span>
                                            </span>
                                            <span className="font-semibold text-[#172033]">
                                                {new Date(owner.registrationDate || owner.createdDate).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between pt-0.5">
                                            <span className="text-[10px] text-neutral-400 font-mono">
                                                ID: {owner.id.slice(0, 10)}...
                                            </span>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(owner.id);
                                                    toast.success('Owner ID copied!');
                                                }}
                                                className="text-[10px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-semibold cursor-pointer"
                                                title="Copy full UUID"
                                            >
                                                <Copy size={10} />
                                                <span>Copy ID</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Number of Restaurants & Branches Section */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-1.5">
                                                <Store size={14} className="text-indigo-600" />
                                                <span className="font-black text-[#172033]">
                                                    {totalRest} {totalRest === 1 ? 'Restaurant' : 'Restaurants'}
                                                </span>
                                                <span className="text-neutral-300">•</span>
                                                <span className="font-bold text-[#667085]">
                                                    {totalBr} {totalBr === 1 ? 'Branch' : 'Branches'}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                                                {owner.subscription || 'Growth'} Plan
                                            </span>
                                        </div>

                                        {/* Restaurants List Pills */}
                                        {(owner.restaurants || owner.locations)?.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5">
                                                {(owner.restaurants || owner.locations).map((r: any) => (
                                                    <span
                                                        key={r.id}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#E4E7EC] text-[11px] font-bold text-[#172033] shadow-2xs"
                                                        title={`${r.name} (${r.branchesCount || 1} branches)`}
                                                    >
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                        <span className="truncate max-w-[140px]">{r.name}</span>
                                                        {(r.branchesCount || 0) > 1 && (
                                                            <span className="text-[10px] text-neutral-400 font-normal">
                                                                ({r.branchesCount} br)
                                                            </span>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-2.5 rounded-xl bg-[#F5F7FC] border border-dashed border-[#E4E7EC] text-center">
                                                <p className="text-[11px] text-neutral-400 font-medium">
                                                    No restaurants or branches provisioned yet
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Quota Progress Bar */}
                                    <div className="p-3 bg-[#F5F7FC] rounded-2xl space-y-2 border border-[#E4E7EC]">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-[#667085] font-semibold">Location Quota:</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-extrabold text-[#172033]">
                                                    {used} / {quota} Allocated
                                                </span>
                                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold ${
                                                    !hasSub
                                                        ? 'bg-neutral-100 text-neutral-600'
                                                        : isLimitReached
                                                        ? 'bg-amber-100 text-amber-800'
                                                        : 'bg-emerald-100 text-emerald-800'
                                                }`}>
                                                    {!hasSub ? 'No Sub' : isLimitReached ? 'Maxed' : `${remaining} left`}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="w-full h-1.5 bg-[#E4E7EC] rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${
                                                    !hasSub ? 'bg-neutral-300' : isLimitReached ? 'bg-amber-500' : 'bg-indigo-600'
                                                }`}
                                                style={{ width: quota > 0 ? `${Math.min(100, (used / quota) * 100)}%` : '0%' }}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] pt-0.5">
                                            <span className="text-neutral-400">Available Slots:</span>
                                            <span className="font-bold text-indigo-700">
                                                {!hasSub ? '0 slots (No Sub)' : `${remaining} slots available`}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Card Footer: Actions */}
                                <div className="pt-3 border-t border-[#E4E7EC] flex items-center justify-between gap-2">
                                    {isPending ? (
                                        <>
                                            <button
                                                onClick={() => {
                                                    setOwnerToApprove(owner);
                                                    setApproveQuota(owner.quota ?? 0);
                                                }}
                                                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                            >
                                                <Check size={13} />
                                                <span>Approve Owner</span>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setOwnerToReject(owner);
                                                    setRejectReason('');
                                                }}
                                                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                            >
                                                <X size={13} />
                                                <span>Reject</span>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setOwnerToDelete(owner);
                                                    setDeleteConfirmText('');
                                                }}
                                                title="Delete Owner Registration"
                                                className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setQuotaModalData({ owner, quota })}
                                                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                                                    title="Adjust Location Quota"
                                                >
                                                    <Sliders size={12} />
                                                    <span>Quota</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setOwnerToDelete(owner);
                                                        setDeleteConfirmText('');
                                                    }}
                                                    title="Delete Owner Account"
                                                    className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                            <Link
                                                href={`/admin/owners/${owner.id}`}
                                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 group cursor-pointer"
                                            >
                                                <Eye size={13} />
                                                <span>View Details</span>
                                                <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                                            </Link>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-[#667085]">
                        Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, processedOwners.length)} of{' '}
                        {processedOwners.length} owners
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-2 rounded-xl bg-white border border-[#E4E7EC] text-neutral-600 hover:bg-[#F5F7FC] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <span className="text-xs font-bold text-[#172033] px-2">
                            {page} / {totalPages}
                        </span>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="p-2 rounded-xl bg-white border border-[#E4E7EC] text-neutral-600 hover:bg-[#F5F7FC] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* QUICK QUOTA MODAL */}
            {quotaModalData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-[#E4E7EC] shadow-2xl space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-extrabold text-[#172033]">
                                    Adjust Owner Location Quota
                                </h3>
                                <p className="text-xs text-[#667085] mt-0.5">
                                    Owner: <strong>{quotaModalData.owner.name}</strong>
                                </p>
                            </div>
                            <button
                                onClick={() => setQuotaModalData(null)}
                                className="p-1 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <p className="text-xs text-[#667085] leading-relaxed">
                            Branch/location quota belongs to the Owner account, not an individual restaurant. All restaurants/locations owned by this Owner count toward this quota.
                        </p>

                        <div className="p-4 bg-[#F5F7FC] border border-[#E4E7EC] rounded-2xl space-y-3">
                            <label className="text-xs font-bold text-[#172033] block">Max Locations Quota</label>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() =>
                                        setQuotaModalData({
                                            ...quotaModalData,
                                            quota: Math.max(1, quotaModalData.quota - 1),
                                        })
                                    }
                                    className="w-10 h-10 rounded-xl bg-white border border-[#E4E7EC] font-bold text-sm text-[#172033] hover:bg-neutral-100 flex items-center justify-center cursor-pointer shadow-xs"
                                >
                                    -
                                </button>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={quotaModalData.quota}
                                    onChange={(e) =>
                                        setQuotaModalData({
                                            ...quotaModalData,
                                            quota: Math.max(1, parseInt(e.target.value) || 1),
                                        })
                                    }
                                    className="w-24 text-center font-black text-lg py-2 bg-white border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600"
                                />
                                <button
                                    onClick={() =>
                                        setQuotaModalData({
                                            ...quotaModalData,
                                            quota: quotaModalData.quota + 1,
                                        })
                                    }
                                    className="w-10 h-10 rounded-xl bg-white border border-[#E4E7EC] font-bold text-sm text-[#172033] hover:bg-neutral-100 flex items-center justify-center cursor-pointer shadow-xs"
                                >
                                    +
                                </button>
                            </div>
                            <p className="text-[11px] text-neutral-500">
                                Currently using <strong>{quotaModalData.owner.usedQuota || 0}</strong> of{' '}
                                <strong>{quotaModalData.quota}</strong> authorized outlets.
                            </p>
                        </div>

                        <div className="pt-2 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setQuotaModalData(null)}
                                className="px-4 py-2 text-xs font-bold text-[#667085] hover:bg-[#F5F7FC] rounded-xl cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateQuota}
                                disabled={quotaUpdating}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm"
                            >
                                {quotaUpdating ? 'Saving...' : 'Apply Quota Change'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CREATE OWNER MODAL */}
            {createModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-[#E4E7EC] shadow-2xl space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-extrabold text-[#172033]">
                                Provision Franchise Owner Account
                            </h3>
                            <button
                                onClick={() => setCreateModalOpen(false)}
                                className="p-1 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <p className="text-xs text-[#667085] leading-relaxed">
                            Owner accounts are provisioned securely without storing raw passwords. The system generates an encrypted 1-time setup invitation link.
                        </p>

                        {!inviteLinkCreated ? (
                            <form onSubmit={handleCreateOwner} className="space-y-3 pt-2">
                                <div>
                                    <label className="text-xs font-bold text-[#172033]">Owner Full Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={newOwnerData.name}
                                        onChange={(e) => setNewOwnerData({ ...newOwnerData, name: e.target.value })}
                                        placeholder="e.g. Ramesh Varma"
                                        className="mt-1 w-full text-xs p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-[#172033]">Email Address *</label>
                                    <input
                                        type="email"
                                        required
                                        value={newOwnerData.email}
                                        onChange={(e) => setNewOwnerData({ ...newOwnerData, email: e.target.value })}
                                        placeholder="ramesh@restaurantgroup.in"
                                        className="mt-1 w-full text-xs p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-[#172033]">Mobile Number</label>
                                        <input
                                            type="text"
                                            value={newOwnerData.phone}
                                            onChange={(e) => setNewOwnerData({ ...newOwnerData, phone: e.target.value })}
                                            placeholder="+91 98765 12345"
                                            className="mt-1 w-full text-xs p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600 font-medium"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-[#172033]">Location Quota</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="50"
                                            value={newOwnerData.maxBranches}
                                            onChange={(e) =>
                                                setNewOwnerData({ ...newOwnerData, maxBranches: parseInt(e.target.value) || 0 })
                                            }
                                            className="mt-1 w-full text-xs p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600 font-medium"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-[#172033]">Associate Restaurant (Optional)</label>
                                    <select
                                        value={newOwnerData.restaurantId}
                                        onChange={(e) => setNewOwnerData({ ...newOwnerData, restaurantId: e.target.value })}
                                        className="mt-1 w-full text-xs p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600 font-medium cursor-pointer"
                                    >
                                        <option value="">-- No restaurant (Assign later) --</option>
                                        {allRestaurants.map((r: any) => (
                                            <option key={r.id} value={r.id}>
                                                {r.name} ({r.id})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-[#172033]">Initial Password</label>
                                    <input
                                        type="text"
                                        required
                                        value={newOwnerData.password}
                                        onChange={(e) => setNewOwnerData({ ...newOwnerData, password: e.target.value })}
                                        placeholder="e.g. Owner@123"
                                        className="mt-1 w-full text-xs p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600 font-mono"
                                    />
                                    <p className="text-[10px] text-neutral-400 mt-1">Default password provided to owner for logging in.</p>
                                </div>

                                <div className="pt-3 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setCreateModalOpen(false)}
                                        className="px-4 py-2 text-xs font-bold text-[#667085] hover:bg-[#F5F7FC] rounded-xl cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={createLoading}
                                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                                    >
                                        {createLoading ? 'Provisioning...' : 'Generate Onboarding Invitation'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="space-y-4 pt-2">
                                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                                    <div className="flex items-center gap-2 font-bold mb-1">
                                        <CheckCircle2 size={15} className="text-emerald-600" />
                                        <span>Owner Account Successfully Provisioned!</span>
                                    </div>
                                    <p className="text-[11px] text-emerald-800">
                                        Share the secure onboarding link below with the owner to initialize their credentials.
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-mono text-[11px] text-[#172033] break-all">
                                    <span className="truncate">{inviteLinkCreated}</span>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(inviteLinkCreated);
                                            toast.success('Invitation link copied to clipboard!');
                                        }}
                                        className="p-1.5 text-indigo-600 hover:bg-white rounded-lg transition-all shrink-0 cursor-pointer"
                                    >
                                        <Copy size={14} />
                                    </button>
                                </div>

                                <button
                                    onClick={() => setCreateModalOpen(false)}
                                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                                >
                                    Done
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* APPROVE OWNER REGISTRATION MODAL */}
            {ownerToApprove && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-6 max-w-lg w-full border border-emerald-100 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5 text-emerald-700">
                                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                                    <CheckCircle2 size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-extrabold text-[#172033]">
                                        Approve Owner Account
                                    </h3>
                                    <p className="text-[11px] text-neutral-500">
                                        Activate account access without auto-billing
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setOwnerToApprove(null)}
                                className="p-1 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Owner Summary Card */}
                        <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/60 space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-neutral-500 font-medium">Owner Name:</span>
                                <span className="font-bold text-neutral-900">{ownerToApprove.name}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-neutral-500 font-medium">Registered Email:</span>
                                <span className="font-bold text-neutral-900 font-mono text-[11px]">{ownerToApprove.email}</span>
                            </div>
                            {ownerToApprove.phone && ownerToApprove.phone !== '—' && (
                                <div className="flex items-center justify-between">
                                    <span className="text-neutral-500 font-medium">Mobile Phone:</span>
                                    <span className="font-semibold text-neutral-800">{ownerToApprove.phone}</span>
                                </div>
                            )}
                            {ownerToApprove.requestNumber && (
                                <div className="flex items-center justify-between">
                                    <span className="text-neutral-500 font-medium">Registration Ref:</span>
                                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-mono font-bold text-[10px]">
                                        {ownerToApprove.requestNumber}
                                    </span>
                                </div>
                            )}
                            <div className="flex items-center justify-between pt-1 border-t border-neutral-200/50">
                                <span className="text-neutral-500 font-medium">Email Verification:</span>
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    <Check size={11} /> Amazon SES OTP Verified
                                </span>
                            </div>
                        </div>

                        {/* Domain policy notice */}
                        <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-[11px] text-amber-900 leading-relaxed space-y-1">
                            <p className="font-bold flex items-center gap-1.5 text-amber-950">
                                <Sparkles size={12} className="text-amber-600" />
                                Zero-Subscription Account Approval
                            </p>
                            <p>
                                Approving this account activates login access so the owner can create and manage their restaurant and branches. <strong>No subscription or billing charges are created</strong> for registering.
                            </p>
                        </div>

                        {/* Quota Setting */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-neutral-700 block">
                                Initial Branch Quota
                            </label>
                            <p className="text-[11px] text-neutral-500">
                                Default is 0/0. When the owner creates their first restaurant and selects a plan, their quota will automatically update.
                            </p>
                            <div className="flex items-center gap-2 pt-1">
                                {[0, 1, 3, 5, 10].map((q) => (
                                    <button
                                        key={q}
                                        type="button"
                                        onClick={() => setApproveQuota(q)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                            approveQuota === q
                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                                        }`}
                                    >
                                        {q === 0 ? '0 (Default)' : `${q} ${q === 1 ? 'Location' : 'Locations'}`}
                                    </button>
                                ))}
                                <input
                                    type="number"
                                    min="0"
                                    max="50"
                                    value={approveQuota}
                                    onChange={(e) => setApproveQuota(Math.max(0, parseInt(e.target.value) || 0))}
                                    className="w-16 px-2.5 py-1.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs font-bold text-center text-neutral-900 focus:outline-none focus:border-emerald-600"
                                />
                            </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="pt-2 flex justify-end gap-3 border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={() => setOwnerToApprove(null)}
                                className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-xl cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleApproveOwner}
                                disabled={approveLoading}
                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {approveLoading ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Approving Account...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={14} />
                                        <span>Confirm & Approve Account</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* REJECT OWNER REGISTRATION MODAL */}
            {ownerToReject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-rose-100 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5 text-rose-600">
                                <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center">
                                    <AlertTriangle size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-extrabold text-[#172033]">
                                        Reject Registration
                                    </h3>
                                    <p className="text-[11px] text-neutral-500">
                                        Decline owner account activation
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setOwnerToReject(null)}
                                className="p-1 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <p className="text-xs text-[#667085] leading-relaxed">
                            Are you sure you want to reject the registration request for <strong>{ownerToReject.name}</strong> ({ownerToReject.email})?
                            The account will remain inactive and will not be able to log in or create restaurants.
                        </p>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-neutral-700 block">
                                Rejection Reason (Optional)
                            </label>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {['Incomplete restaurant details', 'Duplicate registration', 'Unverifiable contact', 'Other reason'].map((reason) => (
                                    <button
                                        key={reason}
                                        type="button"
                                        onClick={() => setRejectReason(reason)}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                                            rejectReason === reason
                                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                                        }`}
                                    >
                                        {reason}
                                    </button>
                                ))}
                            </div>
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="State reason for rejecting this registration application..."
                                rows={3}
                                className="w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs text-neutral-900 focus:outline-none focus:border-rose-500"
                            />
                        </div>

                        <div className="pt-2 flex justify-end gap-3 border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={() => setOwnerToReject(null)}
                                className="px-4 py-2 text-xs font-bold text-[#667085] hover:bg-[#F5F7FC] rounded-xl cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleRejectOwner}
                                disabled={rejectLoading}
                                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {rejectLoading ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Rejecting...</span>
                                    </>
                                ) : (
                                    <>
                                        <AlertTriangle size={14} />
                                        <span>Confirm Rejection</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* APPROVE BRANCH MODAL */}
            {branchToApprove && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-6 max-w-lg w-full border border-emerald-200 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
                        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                                    <CheckCircle2 size={22} />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-[#172033] text-base">Approve Restaurant Branch</h3>
                                    <p className="text-xs text-[#667085]">Activate outlet & enable Restaurant Admin access</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setBranchToApprove(null)}
                                className="p-1 text-neutral-400 hover:text-neutral-600 rounded-lg cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Branch & Owner Summary Card */}
                        <div className="p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-200/60 space-y-2 text-xs">
                            <div className="flex justify-between items-center">
                                <span className="text-[#667085]">Restaurant Name:</span>
                                <span className="font-bold text-[#172033]">{branchToApprove.restaurantName}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[#667085]">Owner:</span>
                                <span className="font-medium text-[#172033]">{branchToApprove.ownerName} ({branchToApprove.ownerEmail})</span>
                            </div>
                            {branchToApprove.requestNumber && (
                                <div className="flex justify-between items-center">
                                    <span className="text-[#667085]">Request Number:</span>
                                    <span className="font-mono font-bold text-emerald-800">{branchToApprove.requestNumber}</span>
                                </div>
                            )}
                            {branchToApprove.paymentReference && (
                                <div className="flex justify-between items-center pt-1 border-t border-emerald-200/40">
                                    <span className="text-[#667085]">Payment Ref / UTR:</span>
                                    <span className="font-mono font-bold text-neutral-800">{branchToApprove.paymentReference}</span>
                                </div>
                            )}
                        </div>

                        {/* Plan Selection */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-[#172033] block">
                                Subscription Plan
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {['standard', 'growth', 'pro', 'enterprise'].map((p) => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setBranchApprovePlan(p)}
                                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer capitalize text-center ${
                                            branchApprovePlan === p
                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                                : 'bg-[#F5F7FC] text-[#667085] border-[#E4E7EC] hover:bg-neutral-100'
                                        }`}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Owner Location Quota */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-[#172033] block">
                                Authorized Location Quota for Owner
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={50}
                                value={branchApproveQuota}
                                onChange={(e) => setBranchApproveQuota(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full px-3 py-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs font-bold text-[#172033] focus:outline-none focus:border-emerald-600"
                            />
                            <p className="text-[11px] text-neutral-400">
                                Number of authorized branches allowed under this owner account.
                            </p>
                        </div>

                        {/* Subscription Fee Due */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-[#172033] block">
                                Fee Collected / Agreed (₹)
                            </label>
                            <input
                                type="number"
                                min={0}
                                value={branchApproveAmount}
                                onChange={(e) => setBranchApproveAmount(Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-full px-3 py-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs font-bold text-[#172033] focus:outline-none focus:border-emerald-600"
                            />
                        </div>

                        <div className="pt-2 flex justify-end gap-2 border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={() => setBranchToApprove(null)}
                                className="px-4 py-2 text-xs font-bold text-[#667085] hover:text-[#172033] cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleApproveBranch}
                                disabled={branchApproveLoading}
                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                {branchApproveLoading ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Approving Branch...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={14} />
                                        <span>Confirm & Approve Branch</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* REJECT BRANCH MODAL */}
            {branchToReject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-rose-100 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5 text-rose-600">
                                <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center">
                                    <AlertTriangle size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-extrabold text-[#172033]">
                                        Reject Branch Registration
                                    </h3>
                                    <p className="text-[11px] text-neutral-500">
                                        Decline restaurant branch activation
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setBranchToReject(null)}
                                className="p-1 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <p className="text-xs text-[#667085] leading-relaxed">
                            Are you sure you want to reject the registration request for <strong>{branchToReject.restaurantName}</strong> (Owner: {branchToReject.ownerName})?
                            The restaurant branch will remain inactive.
                        </p>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-neutral-700 block">
                                Rejection Reason (Optional)
                            </label>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {['Payment verification failed', 'Duplicate branch request', 'Location quota exceeded', 'Other reason'].map((reason) => (
                                    <button
                                        key={reason}
                                        type="button"
                                        onClick={() => setBranchRejectReason(reason)}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                                            branchRejectReason === reason
                                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                                        }`}
                                    >
                                        {reason}
                                    </button>
                                ))}
                            </div>
                            <textarea
                                value={branchRejectReason}
                                onChange={(e) => setBranchRejectReason(e.target.value)}
                                placeholder="State reason for rejecting this branch registration..."
                                rows={3}
                                className="w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs text-neutral-900 focus:outline-none focus:border-rose-500"
                            />
                        </div>

                        <div className="pt-2 flex justify-end gap-3 border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={() => setBranchToReject(null)}
                                className="px-4 py-2 text-xs font-bold text-[#667085] hover:bg-[#F5F7FC] rounded-xl cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleRejectBranch}
                                disabled={branchRejectLoading}
                                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {branchRejectLoading ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Rejecting...</span>
                                    </>
                                ) : (
                                    <>
                                        <AlertTriangle size={14} />
                                        <span>Confirm Rejection</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE OWNER CONFIRMATION MODAL */}
            {ownerToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white rounded-3xl p-6 max-w-lg w-full border border-rose-100 shadow-2xl space-y-4">
                        {/* Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                                    <Trash2 size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-extrabold text-[#172033]">
                                        Delete Owner Account
                                    </h3>
                                    <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                                        <AlertTriangle size={12} />
                                        Permanent & Irreversible Action
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setOwnerToDelete(null);
                                    setDeleteConfirmText('');
                                }}
                                className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Owner Details Card */}
                        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-[#172033]">{ownerToDelete.name || 'Unnamed Owner'}</span>
                                    {ownerToDelete.isPendingApproval || ownerToDelete.status === 'PENDING' ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                            Pending Approval
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                            {ownerToDelete.status || 'Active'}
                                        </span>
                                    )}
                                </div>
                                {ownerToDelete.requestNumber && (
                                    <span className="text-[10px] font-mono text-neutral-500 font-medium">
                                        Ref: {ownerToDelete.requestNumber}
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs text-[#667085]">
                                <div className="flex items-center gap-1.5 truncate">
                                    <Mail size={13} className="shrink-0 text-neutral-400" />
                                    <span className="truncate">{ownerToDelete.email || '—'}</span>
                                </div>
                                <div className="flex items-center gap-1.5 truncate">
                                    <Phone size={13} className="shrink-0 text-neutral-400" />
                                    <span className="truncate">{ownerToDelete.phone || '—'}</span>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-[11px]">
                                <span className="text-[#667085]">Linked Restaurants:</span>
                                <span className="font-bold text-[#172033]">
                                    {ownerToDelete.totalLocations > 0 ? `${ownerToDelete.totalLocations} Location(s)` : '0 Locations'}
                                </span>
                            </div>
                        </div>

                        {/* Destructive Warning */}
                        <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800 leading-relaxed">
                            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                            <div>
                                This will permanently purge the account credentials, registration requests, active sessions, and unlink any associated restaurant branches.
                            </div>
                        </div>

                        {/* Confirmation Input */}
                        <div className="space-y-1.5 pt-1">
                            <label className="block text-xs font-semibold text-[#344054]">
                                Type <span className="font-mono font-bold text-rose-600">DELETE</span> to confirm:
                            </label>
                            <input
                                type="text"
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                placeholder='Type "DELETE" to confirm'
                                className="w-full px-3.5 py-2.5 bg-[#F5F7FC] border border-rose-200 focus:border-rose-500 focus:bg-white rounded-xl text-xs font-mono font-medium outline-hidden transition-all placeholder:text-neutral-400"
                                autoFocus
                            />
                        </div>

                        {/* Actions */}
                        <div className="pt-2 flex items-center justify-end gap-3 border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={() => {
                                    setOwnerToDelete(null);
                                    setDeleteConfirmText('');
                                }}
                                disabled={deleteLoading}
                                className="px-4 py-2.5 text-xs font-bold text-[#667085] hover:bg-[#F5F7FC] rounded-xl transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteOwner}
                                disabled={deleteLoading || deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
                                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-sm shadow-rose-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                {deleteLoading ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Deleting Account...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={13} />
                                        <span>Delete Account Permanently</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function OwnersPage() {
    return (
        <Suspense fallback={
            <div className="p-8 text-center text-xs text-neutral-400">
                <div className="inline-block h-6 w-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-2" />
                <p>Loading Owners Hub...</p>
            </div>
        }>
            <OwnersContent />
        </Suspense>
    );
}
