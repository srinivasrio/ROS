'use client';

import React, { useState, useEffect, useMemo, use } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Users,
    Building2,
    Store,
    Sliders,
    Zap,
    Receipt,
    Activity,
    Shield,
    Flame,
    ArrowLeft,
    Plus,
    ExternalLink,
    Copy,
    Check,
    CheckCircle2,
    ShieldAlert,
    ShieldCheck,
    AlertTriangle,
    Eye,
    Edit3,
    Trash2,
    RotateCcw,
    Lock,
    LogOut,
    KeyRound,
    Calendar,
    Phone,
    Mail,
    MapPin,
    Clock,
    Search,
    ChevronRight,
    ChevronDown,
    Filter,
    RefreshCw,
    X,
    UtensilsCrossed,
    DollarSign,
    Sparkles,
    UserCheck,
    AlertCircle,
    UserPlus,
    CornerDownRight
} from 'lucide-react';
import { toast } from 'sonner';
import { formatAuditAction, formatAuditDetails, extractAuditBadges, getActionBadgeStyle } from '@/lib/audit-formatters';

type TabType =
    | 'overview'
    | 'locations'
    | 'users'
    | 'quota'
    | 'subscription'
    | 'billing'
    | 'activity'
    | 'security'
    | 'controls';

const formatRevenue = (val: number | string | null | undefined): string => {
    const num = typeof val === 'number' ? val : parseFloat(String(val || 0));
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

export default function OwnerManagementWorkspace({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialTab = (searchParams.get('tab') as TabType) || 'overview';

    // Unpack route param
    const resolvedParams = use(params);
    const ownerId = resolvedParams.id;

    const [activeTab, setActiveTab] = useState<TabType>(initialTab);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Overview location filter
    const [overviewLocationFilter, setOverviewLocationFilter] = useState('ALL');

    // Create Location Modal State
    const [createLocOpen, setCreateLocOpen] = useState(false);
    const [createLocData, setCreateLocData] = useState({
        name: '',
        code: '',
        phone: '',
        email: '',
        address: '',
        adminName: '',
        adminEmail: '',
        adminMobile: '',
        adminPassword: '',
        adminPin: '1234'
    });
    const [createLocLoading, setCreateLocLoading] = useState(false);

    // Edit Location Modal State
    const [editLocData, setEditLocData] = useState<any | null>(null);
    const [editLocLoading, setEditLocLoading] = useState(false);

    // Manage Admin Modal State
    const [manageAdminData, setManageAdminData] = useState<any | null>(null);
    const [manageAdminLoading, setManageAdminLoading] = useState(false);

    // View Location Rich Detail Modal
    const [viewLocDetail, setViewLocDetail] = useState<any | null>(null);
    const [viewLocLoading, setViewLocLoading] = useState(false);

    // Create User Modal State
    const [createUserOpen, setCreateUserOpen] = useState(false);
    const [newUserData, setNewUserData] = useState({
        restaurantId: '',
        name: '',
        email: '',
        mobile: '',
        role: 'waiter',
        pin: '1234',
        password: ''
    });
    const [createUserLoading, setCreateUserLoading] = useState(false);

    // Edit User Modal State
    const [editUserData, setEditUserData] = useState<any | null>(null);
    const [editUserLoading, setEditUserLoading] = useState(false);

    // Quota Slider State
    const [targetQuota, setTargetQuota] = useState(5);
    const [quotaLoading, setQuotaLoading] = useState(false);

    // Founder Controls State
    const [suspendModalOpen, setSuspendModalOpen] = useState(false);
    const [suspendReason, setSuspendReason] = useState('');
    const [suspendLoading, setSuspendLoading] = useState(false);

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);

    const [forceLogoutLoading, setForceLogoutLoading] = useState(false);

    // Subscription Override State
    const [subOverridePlan, setSubOverridePlan] = useState('Growth');
    const [subOverrideStatus, setSubOverrideStatus] = useState('active');
    const [subOverrideLoading, setSubOverrideLoading] = useState(false);

    // Approve Branch Modal State
    const [branchToApprove, setBranchToApprove] = useState<any | null>(null);
    const [branchApprovePlan, setBranchApprovePlan] = useState('standard');
    const [branchApproveQuota, setBranchApproveQuota] = useState(1);
    const [branchApproveLoading, setBranchApproveLoading] = useState(false);

    // Reject Branch Modal State
    const [branchToReject, setBranchToReject] = useState<any | null>(null);
    const [branchRejectReason, setBranchRejectReason] = useState('');
    const [branchRejectLoading, setBranchRejectLoading] = useState(false);

    // Fetch Full Workspace Data
    const fetchWorkspace = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/owners/${ownerId}`);
            if (res.ok) {
                const json = await res.json();
                setData(json);
                if (json.owner?.quota) {
                    setTargetQuota(json.owner.quota);
                }
                if (json.overview?.subscriptionStatus?.planName) {
                    setSubOverridePlan(json.overview.subscriptionStatus.planName);
                }
            } else {
                toast.error('Failed to load owner workspace');
            }
        } catch (err) {
            console.error('Error loading owner workspace:', err);
            toast.error('Network error loading owner data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (ownerId) fetchWorkspace();
    }, [ownerId]);

    // Handle Location Creation
    const handleCreateLocation = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateLocLoading(true);
        try {
            const res = await fetch(`/api/admin/owners/${ownerId}/locations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(createLocData)
            });
            const json = await res.json();
            if (res.ok && json.success) {
                toast.success(json.message || 'New location successfully created!');
                setCreateLocOpen(false);
                setCreateLocData({
                    name: '',
                    code: '',
                    phone: '',
                    email: '',
                    address: '',
                    adminName: '',
                    adminEmail: '',
                    adminMobile: '',
                    adminPassword: '',
                    adminPin: '1234'
                });
                await fetchWorkspace();
            } else {
                toast.error(json.error || 'Failed to create location');
            }
        } catch (err: any) {
            toast.error(err.message || 'Operation failed');
        } finally {
            setCreateLocLoading(false);
        }
    };

    // Location Lifecycle Actions (Activate, Deactivate, Suspend, Restore, Delete, Set Main)
    const handleLocationAction = async (locationId: string, action: string, extra: any = {}) => {
        try {
            const res = await fetch(`/api/admin/owners/${ownerId}/locations`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locationId, action, ...extra })
            });
            const json = await res.json();
            if (res.ok && json.success) {
                toast.success(json.message || `Location ${action}d successfully`);
                await fetchWorkspace();
            } else {
                toast.error(json.error || `Failed to ${action} location`);
            }
        } catch (err) {
            toast.error('Network error executing location action');
        }
    };

    // Approve Branch Handler (Atomic Lifecycle Activation)
    const handleConfirmApproveBranch = async () => {
        if (!branchToApprove) return;
        setBranchApproveLoading(true);
        try {
            const res = await fetch(`/api/admin/owners/${ownerId}/locations`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    locationId: branchToApprove.id,
                    action: 'approve',
                    planSlug: branchApprovePlan,
                    customQuota: branchApproveQuota
                })
            });
            const json = await res.json();
            if (res.ok && json.success) {
                toast.success(json.message || `Branch "${branchToApprove.name}" approved successfully!`);
                setBranchToApprove(null);
                await fetchWorkspace();
            } else {
                toast.error(json.error || 'Failed to approve branch');
            }
        } catch (err) {
            toast.error('Network error approving branch');
        } finally {
            setBranchApproveLoading(false);
        }
    };

    // Reject Branch Handler
    const handleConfirmRejectBranch = async () => {
        if (!branchToReject) return;
        setBranchRejectLoading(true);
        try {
            const res = await fetch(`/api/admin/owners/${ownerId}/locations`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    locationId: branchToReject.id,
                    action: 'reject',
                    reason: branchRejectReason
                })
            });
            const json = await res.json();
            if (res.ok && json.success) {
                toast.success(json.message || `Branch "${branchToReject.name}" rejected.`);
                setBranchToReject(null);
                await fetchWorkspace();
            } else {
                toast.error(json.error || 'Failed to reject branch');
            }
        } catch (err) {
            toast.error('Network error rejecting branch');
        } finally {
            setBranchRejectLoading(false);
        }
    };

    // View Location Rich Detail Drawer
    const handleOpenLocationDetail = async (locationId: string) => {
        setViewLocLoading(true);
        try {
            const res = await fetch(`/api/admin/owners/${ownerId}/locations?locationId=${locationId}`);
            if (res.ok) {
                const json = await res.json();
                setViewLocDetail(json);
            } else {
                toast.error('Failed to load location details');
            }
        } catch (err) {
            toast.error('Network error loading location detail');
        } finally {
            setViewLocLoading(false);
        }
    };

    // Quota Update Handler
    const handleSaveQuota = async () => {
        setQuotaLoading(true);
        try {
            const res = await fetch(`/api/admin/owners/${ownerId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_quota', quota: targetQuota })
            });
            const json = await res.json();
            if (res.ok && json.success) {
                toast.success(json.message || 'Quota successfully updated!');
                await fetchWorkspace();
            } else {
                toast.error(json.error || 'Failed to update quota');
            }
        } catch (err) {
            toast.error('Network error updating quota');
        } finally {
            setQuotaLoading(false);
        }
    };

    // Toggle Status / Suspend Owner Handler
    const handleUpdateOwnerStatus = async (status: string, reason?: string) => {
        setSuspendLoading(true);
        try {
            const res = await fetch(`/api/admin/owners/${ownerId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_status', status, reason })
            });
            const json = await res.json();
            if (res.ok && json.success) {
                toast.success(json.message || `Owner set to ${status}`);
                setSuspendModalOpen(false);
                await fetchWorkspace();
            } else {
                toast.error(json.error || 'Status update failed');
            }
        } catch (err) {
            toast.error('Network error updating status');
        } finally {
            setSuspendLoading(false);
        }
    };

    // Force Logout Handler
    const handleForceLogout = async () => {
        setForceLogoutLoading(true);
        try {
            const res = await fetch(`/api/admin/owners/${ownerId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'force_logout' })
            });
            const json = await res.json();
            if (res.ok && json.success) {
                toast.success(json.message || 'All sessions revoked');
                await fetchWorkspace();
            } else {
                toast.error(json.error || 'Failed to force logout');
            }
        } catch (err) {
            toast.error('Network error forcing logout');
        } finally {
            setForceLogoutLoading(false);
        }
    };

    // Delete Owner Handler
    const handleDeleteOwnerPermanent = async () => {
        if (!data?.owner?.email) return;
        setDeleteLoading(true);
        try {
            const res = await fetch(`/api/admin/owners/${ownerId}`, { method: 'DELETE' });
            const json = await res.json();
            if (res.ok && json.success) {
                toast.success('Owner account successfully deleted');
                router.replace('/admin/owners');
            } else {
                toast.error(json.error || 'Failed to delete owner account');
            }
        } catch (err) {
            toast.error('Network error deleting owner');
        } finally {
            setDeleteLoading(false);
        }
    };

    // Save Subscription Override
    const handleSaveSubOverride = async () => {
        setSubOverrideLoading(true);
        try {
            const res = await fetch(`/api/admin/owners/${ownerId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_subscription',
                    planName: subOverridePlan,
                    status: subOverrideStatus
                })
            });
            const json = await res.json();
            if (res.ok && json.success) {
                toast.success(json.message || 'Subscription overridden');
                await fetchWorkspace();
            } else {
                toast.error(json.error || 'Subscription update failed');
            }
        } catch (err) {
            toast.error('Network error updating subscription');
        } finally {
            setSubOverrideLoading(false);
        }
    };

    // Add Staff Handler
    const handleAddStaff = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateUserLoading(true);
        try {
            const res = await fetch(`/api/admin/owners/${ownerId}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUserData)
            });
            const json = await res.json();
            if (res.ok && json.success) {
                toast.success(json.message || 'Staff member added');
                setCreateUserOpen(false);
                setNewUserData({
                    restaurantId: '',
                    name: '',
                    email: '',
                    mobile: '',
                    role: 'waiter',
                    pin: '1234',
                    password: ''
                });
                await fetchWorkspace();
            } else {
                toast.error(json.error || 'Failed to add staff');
            }
        } catch (err) {
            toast.error('Network error adding staff');
        } finally {
            setCreateUserLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <div className="inline-block h-10 w-10 rounded-full border-3 border-indigo-600 border-t-transparent animate-spin" />
                <p className="font-extrabold text-sm text-[#172033]">
                    Initializing Owner Management Workspace...
                </p>
                <p className="text-xs text-[#667085]">
                    Aggregating multi-location telemetry, quotas, and security boundaries.
                </p>
            </div>
        );
    }

    if (!data || !data.owner) {
        return (
            <div className="p-8 text-center bg-white rounded-3xl border border-[#E4E7EC] space-y-4 max-w-md mx-auto my-12">
                <AlertTriangle size={36} className="mx-auto text-amber-500" />
                <h2 className="text-lg font-black text-[#172033]">Owner Account Not Found</h2>
                <p className="text-xs text-[#667085]">
                    The requested Owner ID does not exist or has been permanently removed.
                </p>
                <Link
                    href="/admin/owners"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
                >
                    <ArrowLeft size={14} />
                    <span>Return to Owners Hub</span>
                </Link>
            </div>
        );
    }

    const { owner, overview, locations, usersByLocation, billing, activity, security } = data;
    const isOwnerActive = owner.status === 'ACTIVE';
    const isSuspended = owner.status === 'SUSPENDED';

    return (
        <div className="space-y-6">
            {/* Top Navigation & Breadcrumb */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                    <Link
                        href="/admin/owners"
                        className="font-bold text-[#667085] hover:text-indigo-600 transition-colors flex items-center gap-1.5"
                    >
                        <ArrowLeft size={14} />
                        <span>All Owners</span>
                    </Link>
                    <span className="text-neutral-300">/</span>
                    <span className="font-extrabold text-[#172033]">{owner.name}</span>
                </div>

                <div className="flex items-center gap-2">
                    {/* Launch Owner Panel Impersonation */}
                    <a
                        href={`http://localhost:3000/api/auth/owner/quick-access?restaurantId=${locations[0]?.id || '202603180001'}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 rounded-xl text-xs font-black shadow-sm shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500 transition-all cursor-pointer"
                    >
                        <Zap size={13} className="fill-slate-950" />
                        <span>Launch Owner Panel</span>
                        <ExternalLink size={12} />
                    </a>

                    <button
                        onClick={() => {
                            if (locations.length >= owner.quota) {
                                toast.error(`Owner quota limit reached (${locations.length}/${owner.quota}). Increase quota first.`);
                                setActiveTab('quota');
                            } else {
                                setCreateLocOpen(true);
                            }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-indigo-600/20 transition-all cursor-pointer"
                    >
                        <Plus size={14} />
                        <span>Add Location</span>
                    </button>
                </div>
            </div>

            {/* Master Owner Profile Card */}
            <div className="bg-white rounded-3xl border border-[#E4E7EC] p-6 shadow-xs space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center font-black text-xl shadow-md shadow-indigo-600/25 shrink-0">
                            {owner.name?.charAt(0) || 'O'}
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h1 className="text-xl font-black text-[#172033] tracking-tight">{owner.name}</h1>
                                <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                                        isOwnerActive
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : isSuspended
                                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                                            : 'bg-neutral-100 text-neutral-600 border-neutral-200'
                                    }`}
                                >
                                    {isOwnerActive ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
                                    <span>{owner.status}</span>
                                </span>
                                {owner.approvalStatus === 'APPROVED' ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        <CheckCircle2 size={11} />
                                        <span>Approved</span>
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-300">
                                        <Clock size={11} className="animate-spin" />
                                        <span>Pending Approval</span>
                                    </span>
                                )}
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                                    {overview?.subscriptionStatus?.planName || 'Growth'} Plan
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-violet-50 text-violet-700 border border-violet-200/60 flex items-center gap-1">
                                    <Store size={11} />
                                    <span>{owner.totalRestaurants || locations.length} Restaurants • {owner.totalBranches || locations.reduce((acc: number, l: any) => acc + (l.branchesCount || 1), 0)} Branches</span>
                                </span>
                            </div>

                            <div className="flex items-center gap-4 text-xs text-[#667085] flex-wrap pt-0.5">
                                <span className="flex items-center gap-1 text-[#172033] font-medium">
                                    <Mail size={12} className="text-neutral-400" />
                                    {owner.email}
                                </span>
                                <span className="flex items-center gap-1 text-[#172033] font-medium">
                                    <Phone size={12} className="text-neutral-400" />
                                    {owner.phone}
                                </span>
                                <span className="flex items-center gap-1 text-[#667085] font-medium">
                                    <Calendar size={12} className="text-neutral-400" />
                                    <span>Registered on {new Date(owner.registrationDate || owner.createdDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                </span>
                                <span className="flex items-center gap-1 font-mono text-[11px] text-neutral-400">
                                    Owner ID: {owner.id.slice(0, 12)}...
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(owner.id);
                                            toast.success('Owner ID copied!');
                                        }}
                                        className="hover:text-indigo-600 cursor-pointer"
                                        title="Copy full UUID"
                                    >
                                        <Copy size={11} />
                                    </button>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Quota Gauge Pill */}
                    <div className="flex items-center gap-3 p-3 bg-[#F5F7FC] rounded-2xl border border-[#E4E7EC] min-w-[240px]">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs shrink-0">
                            {owner.usedQuota}/{owner.quota}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between text-xs font-bold text-[#172033] mb-1">
                                <span>Location Quota</span>
                                <span className="text-indigo-600">{owner.remainingQuota} remaining</span>
                            </div>
                            <div className="w-full h-1.5 bg-[#E4E7EC] rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${
                                        owner.remainingQuota === 0 ? 'bg-amber-500' : 'bg-indigo-600'
                                    }`}
                                    style={{ width: `${Math.min(100, (owner.usedQuota / owner.quota) * 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Key Metric Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-[#E4E7EC]">
                    <div className="p-3 bg-[#F5F7FC]/70 rounded-2xl border border-[#E4E7EC]/60">
                        <span className="text-[10px] font-bold text-[#667085] uppercase">Total Locations</span>
                        <p className="text-lg font-black text-[#172033] mt-0.5">{overview.totalLocations}</p>
                    </div>
                    <div className="p-3 bg-[#F5F7FC]/70 rounded-2xl border border-[#E4E7EC]/60">
                        <span className="text-[10px] font-bold text-[#667085] uppercase">Active Locations</span>
                        <p className="text-lg font-black text-emerald-600 mt-0.5">{overview.activeLocations}</p>
                    </div>
                    <div className="p-3 bg-[#F5F7FC]/70 rounded-2xl border border-[#E4E7EC]/60">
                        <span className="text-[10px] font-bold text-[#667085] uppercase">Restaurant Admins</span>
                        <p className="text-lg font-black text-[#172033] mt-0.5">{overview.totalAdmins}</p>
                    </div>
                    <div className="p-3 bg-[#F5F7FC]/70 rounded-2xl border border-[#E4E7EC]/60">
                        <span className="text-[10px] font-bold text-[#667085] uppercase">Total Employees</span>
                        <p className="text-lg font-black text-[#172033] mt-0.5">{overview.totalEmployees}</p>
                    </div>
                    <div className="p-3 bg-[#F5F7FC]/70 rounded-2xl border border-[#E4E7EC]/60">
                        <span className="text-[10px] font-bold text-[#667085] uppercase">Total Orders</span>
                        <p className="text-lg font-black text-[#172033] mt-0.5">{overview.totalOrders}</p>
                    </div>
                    <div className="p-3 bg-[#F5F7FC]/70 rounded-2xl border border-[#E4E7EC]/60">
                        <span className="text-[10px] font-bold text-[#667085] uppercase">Total Revenue</span>
                        <p className="text-lg font-black text-indigo-700 mt-0.5">
                            ₹{formatRevenue(overview.totalRevenue)}
                        </p>
                    </div>
                </div>
            </div>

            {/* TAB NAVIGATION */}
            <div className="flex items-center gap-1.5 border-b border-[#E4E7EC] pb-1 overflow-x-auto custom-scrollbar">
                {[
                    { id: 'overview', label: 'Overview', icon: Building2 },
                    {
                        id: 'locations',
                        label: locations.filter((l: any) => l.isPendingApproval).length > 0
                            ? `Locations (${locations.length}) • ${locations.filter((l: any) => l.isPendingApproval).length} Pending`
                            : `Locations (${locations.length})`,
                        icon: Store
                    },
                    { id: 'users', label: `Users (${overview.totalEmployees})`, icon: Users },
                    { id: 'quota', label: `Quota & Limits (${owner.usedQuota}/${owner.quota})`, icon: Sliders },
                    { id: 'subscription', label: 'Subscription', icon: Zap },
                    { id: 'billing', label: 'Billing', icon: Receipt },
                    { id: 'activity', label: 'Activity', icon: Activity },
                    { id: 'security', label: 'Security', icon: Shield },
                    { id: 'controls', label: 'Founder Controls', icon: Flame },
                ].map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                isActive
                                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                                    : 'text-[#667085] hover:text-[#172033] hover:bg-white'
                            }`}
                        >
                            <Icon size={14} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    {/* Pending Approvals Warning Banner */}
                    {locations.some((l: any) => l.isPendingApproval) && (
                        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                                    <Clock size={20} className="animate-spin text-amber-600" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider">
                                        {locations.filter((l: any) => l.isPendingApproval).length} Branch(es) Awaiting Super Admin Approval
                                    </h4>
                                    <p className="text-[11px] text-amber-900/80 mt-0.5">
                                        Owner created new branch locations that require Super Admin verification. Restaurant admin access remains blocked until approved.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setActiveTab('locations')}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 flex items-center gap-1.5 cursor-pointer"
                            >
                                <Check size={14} />
                                <span>Review & Approve Branches</span>
                            </button>
                        </div>
                    )}

                    {/* Location Scope Filter */}
                    <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-[#E4E7EC]">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#172033]">
                            <Filter size={14} className="text-neutral-400" />
                            <span>Telemetry Scope:</span>
                            <select
                                value={overviewLocationFilter}
                                onChange={(e) => setOverviewLocationFilter(e.target.value)}
                                className="px-3 py-1.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs font-semibold text-[#172033] focus:outline-none focus:border-indigo-600 cursor-pointer"
                            >
                                <option value="ALL">All Locations Consolidated ({locations.length})</option>
                                {locations.map((loc: any) => (
                                    <option key={loc.id} value={loc.id}>
                                        {loc.name} ({loc.id})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <span className="text-[11px] text-neutral-400">
                            Real-time Supabase aggregate data
                        </span>
                    </div>

                    {/* Consolidated Metrics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {/* Locations Health Card */}
                        <div className="bg-white p-5 rounded-3xl border border-[#E4E7EC] shadow-2xs space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-[#667085] uppercase">Location Health</span>
                                <Store size={18} className="text-indigo-600" />
                            </div>
                            <div className="text-3xl font-black text-[#172033]">
                                {locations.filter((l: any) => overviewLocationFilter === 'ALL' || l.id === overviewLocationFilter).length}
                            </div>
                            <div className="divide-y divide-[#E4E7EC]/60 text-xs">
                                <div className="py-1.5 flex justify-between">
                                    <span className="text-[#667085]">Active Outlets</span>
                                    <span className="font-extrabold text-emerald-600">
                                        {locations.filter((l: any) => (overviewLocationFilter === 'ALL' || l.id === overviewLocationFilter) && l.status === 'ACTIVE').length}
                                    </span>
                                </div>
                                <div className="py-1.5 flex justify-between">
                                    <span className="text-[#667085]">Suspended / Deactivated</span>
                                    <span className="font-extrabold text-amber-600">
                                        {locations.filter((l: any) => (overviewLocationFilter === 'ALL' || l.id === overviewLocationFilter) && l.status !== 'ACTIVE').length}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Order & Sales Pulse */}
                        <div className="bg-white p-5 rounded-3xl border border-[#E4E7EC] shadow-2xs space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-[#667085] uppercase">Revenue & Volume</span>
                                <DollarSign size={18} className="text-emerald-600" />
                            </div>
                            <div className="text-3xl font-black text-indigo-700">
                                ₹{formatRevenue(
                                    locations
                                        .filter((l: any) => overviewLocationFilter === 'ALL' || l.id === overviewLocationFilter)
                                        .reduce((acc: number, l: any) => acc + (Number(l.revenue) || 0), 0)
                                )}
                            </div>
                            <div className="divide-y divide-[#E4E7EC]/60 text-xs">
                                <div className="py-1.5 flex justify-between">
                                    <span className="text-[#667085]">Total Processed Orders</span>
                                    <span className="font-extrabold text-[#172033]">
                                        {locations
                                            .filter((l: any) => overviewLocationFilter === 'ALL' || l.id === overviewLocationFilter)
                                            .reduce((acc: number, l: any) => acc + (l.orderCount || 0), 0)}
                                    </span>
                                </div>
                                <div className="py-1.5 flex justify-between">
                                    <span className="text-[#667085]">Active Tables Scoped</span>
                                    <span className="font-extrabold text-[#172033]">
                                        {locations
                                            .filter((l: any) => overviewLocationFilter === 'ALL' || l.id === overviewLocationFilter)
                                            .reduce((acc: number, l: any) => acc + (l.tablesCount || 0), 0)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Quota & Limits Card */}
                        <div className="bg-white p-5 rounded-3xl border border-[#E4E7EC] shadow-2xs space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-[#667085] uppercase">Quota Allocation</span>
                                <Sliders size={18} className="text-violet-600" />
                            </div>
                            <div className="text-3xl font-black text-[#172033]">
                                {owner.usedQuota} <span className="text-sm font-medium text-neutral-400">/ {owner.quota}</span>
                            </div>
                            <div className="space-y-2 text-xs">
                                <div className="w-full h-2 bg-[#E4E7EC] rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-indigo-600"
                                        style={{ width: `${Math.min(100, (owner.usedQuota / owner.quota) * 100)}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-[11px]">
                                    <span className="text-[#667085]">Available Slots:</span>
                                    <span className="font-bold text-indigo-700">{owner.remainingQuota} remaining</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Locations Quick Overview Table */}
                    <div className="bg-white rounded-3xl border border-[#E4E7EC] p-6 shadow-2xs space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-extrabold text-[#172033]">Owner Restaurant Locations</h3>
                            <button
                                onClick={() => setActiveTab('locations')}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                            >
                                <span>Manage All Locations</span>
                                <ChevronRight size={13} />
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-[#F5F7FC] border-b border-[#E4E7EC] text-[10px] font-black uppercase text-[#667085]">
                                        <th className="p-3">Restaurant Name</th>
                                        <th className="p-3">Restaurant ID</th>
                                        <th className="p-3">Restaurant Admin</th>
                                        <th className="p-3">Staff</th>
                                        <th className="p-3">Orders</th>
                                        <th className="p-3">Revenue</th>
                                        <th className="p-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#E4E7EC]">
                                    {locations.map((loc: any) => (
                                        <tr key={loc.id} className="hover:bg-[#F5F7FC]/70">
                                            <td className="p-3 font-bold text-[#172033] flex items-center gap-2">
                                                <span>{loc.name}</span>
                                                {loc.is_main_branch && (
                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                        Main
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 font-mono text-[11px] text-neutral-500">{loc.id}</td>
                                            <td className="p-3">
                                                {loc.admin ? (
                                                    <div>
                                                        <p className="font-bold text-[#172033]">{loc.admin.name}</p>
                                                        <p className="text-[10px] text-neutral-400">{loc.admin.email || loc.admin.mobile}</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-neutral-400 italic">No admin assigned</span>
                                                )}
                                            </td>
                                            <td className="p-3 font-medium text-[#172033]">{loc.employeeCount} staff</td>
                                            <td className="p-3 font-medium text-[#172033]">{loc.orderCount} orders</td>
                                            <td className="p-3 font-bold text-indigo-700">₹{formatRevenue(loc.revenue)}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    loc.status === 'ACTIVE'
                                                        ? 'bg-emerald-50 text-emerald-700'
                                                        : 'bg-amber-50 text-amber-700'
                                                }`}>
                                                    {loc.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Recent Activity Feed */}
                    <div className="bg-white rounded-3xl border border-[#E4E7EC] p-6 shadow-2xs space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-extrabold text-[#172033]">Recent Account Activity</h3>
                            <button
                                onClick={() => setActiveTab('activity')}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                            >
                                <span>View Full Audit Trail</span>
                                <ChevronRight size={13} />
                            </button>
                        </div>

                        <div className="divide-y divide-[#E4E7EC]">
                            {overview.recentActivity && overview.recentActivity.length > 0 ? (
                                overview.recentActivity.slice(0, 6).map((log: any) => {
                                    const badgeStyle = getActionBadgeStyle(log.action);
                                    const actionTitle = log.actionTitle || formatAuditAction(log.action);
                                    const desc = log.description || formatAuditDetails(log.action, log.details, log);
                                    const badges = log.badges || extractAuditBadges(log);

                                    return (
                                        <div key={log.id} className="py-3 flex items-start justify-between text-xs gap-3">
                                            <div className="space-y-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                                                        {actionTitle}
                                                    </span>
                                                    {log.restaurant_id && (
                                                        <span className="text-[10px] text-neutral-400 font-mono">
                                                            Rest: {log.restaurant_id}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs font-medium text-[#172033] leading-relaxed">
                                                    {desc}
                                                </p>
                                                {badges.length > 0 && (
                                                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                                        {badges.map((b: any, idx: number) => (
                                                            <span key={idx} className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-600 font-mono">
                                                                <strong className="text-neutral-400 font-normal">{b.label}:</strong> {b.value}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-neutral-400 font-mono shrink-0 whitespace-nowrap">
                                                {new Date(log.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-xs text-neutral-400 py-4">No recent activity recorded.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: LOCATIONS */}
            {activeTab === 'locations' && (
                <div className="space-y-6">
                    {/* Architecture Notice */}
                    <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/60 flex items-start gap-3 text-xs text-indigo-950">
                        <Building2 size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold">Independent Restaurant Architecture</p>
                            <p className="text-[11px] text-indigo-800/90 mt-0.5 leading-relaxed">
                                Every location created under this Owner is an independent restaurant tenant with its own unique 12-digit <code>restaurant_id</code>, isolated database scope, separate menu, table QR codes, and assigned Restaurant Admin. Quotas are enforced strictly at the Owner level.
                            </p>
                        </div>
                    </div>

                    {/* Locations Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {locations.map((loc: any) => {
                            const isLocActive = loc.status === 'ACTIVE';
                            const isLocSuspended = loc.status === 'SUSPENDED';
                            const isPending = loc.isPendingApproval || loc.status === 'PENDING_APPROVAL' || loc.status === 'PENDING';

                            return (
                                <div
                                    key={loc.id}
                                    className={`bg-white rounded-3xl border ${
                                        isPending ? 'border-amber-300 ring-2 ring-amber-400/20 shadow-amber-100/50' : 'border-[#E4E7EC]'
                                    } p-6 shadow-2xs hover:shadow-md transition-all space-y-4`}
                                >
                                    {/* Location Header */}
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-base font-extrabold text-[#172033]">{loc.name}</h3>
                                                {loc.is_main_branch && (
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                        Main Branch
                                                    </span>
                                                )}
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                                                        isPending
                                                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                                                            : isLocActive
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : isLocSuspended
                                                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                            : 'bg-neutral-100 text-neutral-500 border-neutral-200'
                                                    }`}
                                                >
                                                    {isPending && <Clock size={10} className="animate-spin text-amber-600" />}
                                                    <span>{isPending ? 'PENDING APPROVAL' : loc.status}</span>
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 font-mono text-[11px] text-neutral-400">
                                                <span>Restaurant ID: <strong>{loc.id}</strong></span>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(loc.id);
                                                        toast.success('Restaurant ID copied!');
                                                    }}
                                                    className="hover:text-indigo-600 cursor-pointer"
                                                >
                                                    <Copy size={11} />
                                                </button>
                                            </div>
                                        </div>

                                        <span className="px-2.5 py-1 bg-[#F5F7FC] rounded-xl text-[10px] font-bold text-neutral-600 border border-[#E4E7EC]">
                                            {loc.subscriptionPlan}
                                        </span>
                                    </div>

                                    {/* Pending Verification Banner inside Card */}
                                    {isPending && (
                                        <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                                                    <Clock size={12} className="text-amber-600" />
                                                    Awaiting Super Admin Approval
                                                </span>
                                                {loc.registrationRequest?.requestNumber && (
                                                    <span className="font-mono font-bold text-amber-800 text-[10px] bg-white px-2 py-0.5 rounded-md border border-amber-200">
                                                        {loc.registrationRequest.requestNumber}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-[11px] text-amber-950/80 pt-1.5 border-t border-amber-200/60">
                                                <div>
                                                    <span className="text-neutral-500">Plan: </span>
                                                    <span className="font-bold">{loc.registrationRequest?.planName || loc.subscriptionPlan || 'Standard'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-neutral-500">Fee: </span>
                                                    <span className="font-bold">₹{loc.registrationRequest?.amountDue || 999}/mo</span>
                                                </div>
                                                <div>
                                                    <span className="text-neutral-500">Payment Ref: </span>
                                                    <span className="font-mono font-bold">{loc.registrationRequest?.paymentReference || 'Pending UTR'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-neutral-500">Payment Status: </span>
                                                    <span className="font-bold">{loc.registrationRequest?.paymentStatus || 'PENDING'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Contact & Address */}
                                    <div className="p-3 bg-[#F5F7FC] rounded-2xl border border-[#E4E7EC] text-xs space-y-1.5 text-[#667085]">
                                        <div className="flex items-center justify-between">
                                            <span>Phone:</span>
                                            <span className="font-semibold text-[#172033]">{loc.phone}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span>Email:</span>
                                            <span className="font-semibold text-[#172033]">{loc.email}</span>
                                        </div>
                                        <div className="flex items-start justify-between">
                                            <span>Address:</span>
                                            <span className="font-semibold text-[#172033] text-right truncate max-w-[200px]">
                                                {loc.address}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Assigned Restaurant Admin */}
                                    <div className="p-3 rounded-2xl bg-amber-50/50 border border-amber-200/60 text-xs space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-900">
                                                Restaurant Administrator
                                            </span>
                                            <button
                                                onClick={() => setManageAdminData({ locationId: loc.id, admin: loc.admin })}
                                                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                                            >
                                                {loc.admin ? 'Edit Admin' : 'Assign Admin'}
                                            </button>
                                        </div>

                                        {loc.admin ? (
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-bold text-[#172033]">{loc.admin.name}</p>
                                                    <p className="text-[10px] text-neutral-500 font-medium">
                                                        {loc.admin.email || loc.admin.mobile}
                                                    </p>
                                                </div>
                                                <div className="text-right font-mono text-[10px] text-neutral-600">
                                                    <span className="bg-white px-2 py-0.5 rounded border border-amber-200">
                                                        PIN: {loc.admin.hasPin ? 'Configured' : 'Not configured'}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-[11px] text-neutral-500 italic">
                                                No dedicated restaurant admin provisioned.
                                            </p>
                                        )}
                                    </div>

                                    {/* Metrics Bar */}
                                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                                        <div className="p-2 rounded-xl bg-[#F5F7FC] border border-[#E4E7EC]">
                                            <span className="text-[10px] text-neutral-400 block font-bold">STAFF</span>
                                            <span className="font-black text-[#172033]">{loc.employeeCount}</span>
                                        </div>
                                        <div className="p-2 rounded-xl bg-[#F5F7FC] border border-[#E4E7EC]">
                                            <span className="text-[10px] text-neutral-400 block font-bold">ORDERS</span>
                                            <span className="font-black text-[#172033]">{loc.orderCount}</span>
                                        </div>
                                        <div className="p-2 rounded-xl bg-[#F5F7FC] border border-[#E4E7EC]">
                                            <span className="text-[10px] text-neutral-400 block font-bold">TABLES</span>
                                            <span className="font-black text-[#172033]">{loc.tablesCount}</span>
                                        </div>
                                        <div className="p-2 rounded-xl bg-[#F5F7FC] border border-[#E4E7EC]">
                                            <span className="text-[10px] text-neutral-400 block font-bold">REVENUE</span>
                                            <span className="font-black text-indigo-700">₹{formatRevenue(loc.revenue)}</span>
                                        </div>
                                    </div>

                                    {/* Branches Cards Portfolio */}
                                    <div className="p-3.5 rounded-2xl bg-[#F5F7FC] border border-[#E4E7EC] space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <Building2 size={14} className="text-indigo-600" />
                                                <span className="text-xs font-extrabold text-[#172033]">
                                                    Branches ({loc.branches?.length || loc.branchesCount || 1})
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-neutral-400 font-medium">
                                                Multi-branch outlet hierarchy
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {loc.branches && loc.branches.length > 0 ? (
                                                loc.branches.map((br: any) => (
                                                    <div
                                                        key={br.id}
                                                        className="p-3 rounded-xl bg-white border border-[#E4E7EC] shadow-2xs space-y-1.5"
                                                    >
                                                        <div className="flex items-start justify-between gap-1">
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="font-extrabold text-xs text-[#172033] truncate">{br.name}</span>
                                                                    {br.is_main_branch && (
                                                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                                            Main
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-[10px] font-mono text-neutral-400">Code: {br.code}</p>
                                                            </div>
                                                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 ${
                                                                br.status === 'ACTIVE'
                                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                    : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                                                            }`}>
                                                                {br.status}
                                                            </span>
                                                        </div>

                                                        {(br.phone || br.address) && (
                                                            <div className="text-[10px] text-[#667085] space-y-0.5 pt-1 border-t border-[#E4E7EC]/60">
                                                                {br.phone && (
                                                                    <p className="flex items-center gap-1 truncate">
                                                                        <Phone size={10} className="text-neutral-400 shrink-0" />
                                                                        <span>{br.phone}</span>
                                                                    </p>
                                                                )}
                                                                {br.address && (
                                                                    <p className="flex items-center gap-1 truncate">
                                                                        <MapPin size={10} className="text-neutral-400 shrink-0" />
                                                                        <span className="truncate">{br.address}</span>
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-3 rounded-xl bg-white border border-dashed border-[#E4E7EC] text-center col-span-2">
                                                    <span className="text-[11px] text-neutral-400 italic">Primary branch inherits restaurant profile</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions Bar */}
                                    <div className="pt-2 border-t border-[#E4E7EC] flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => handleOpenLocationDetail(loc.id)}
                                                className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                                            >
                                                <Eye size={12} />
                                                <span>View Details</span>
                                            </button>

                                            <button
                                                onClick={() => setEditLocData(loc)}
                                                className="px-2.5 py-1.5 rounded-xl bg-[#F5F7FC] hover:bg-neutral-200 text-neutral-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                                            >
                                                <Edit3 size={12} />
                                                <span>Edit</span>
                                            </button>

                                            {!loc.is_main_branch && (
                                                <button
                                                    onClick={() => handleLocationAction(loc.id, 'set_main')}
                                                    className="px-2 py-1.5 text-[11px] font-bold text-neutral-500 hover:text-indigo-600 underline cursor-pointer"
                                                >
                                                    Set Main
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            {isPending ? (
                                                <>
                                                    <button
                                                        onClick={() => {
                                                            setBranchToApprove(loc);
                                                            setBranchApprovePlan(loc.registrationRequest?.planSlug || 'standard');
                                                            setBranchApproveQuota(owner.quota || 1);
                                                        }}
                                                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                                                        title="Approve Branch & Activate Restaurant"
                                                    >
                                                        <Check size={14} />
                                                        <span>Approve Branch</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setBranchToReject(loc);
                                                            setBranchRejectReason('');
                                                        }}
                                                        className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all border border-rose-200 flex items-center gap-1 cursor-pointer"
                                                        title="Reject Branch"
                                                    >
                                                        <X size={13} />
                                                        <span>Reject</span>
                                                    </button>
                                                </>
                                            ) : isLocActive ? (
                                                <button
                                                    onClick={() => handleLocationAction(loc.id, 'suspend')}
                                                    className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold cursor-pointer transition-colors"
                                                >
                                                    Suspend
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleLocationAction(loc.id, 'restore')}
                                                    className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold cursor-pointer transition-colors"
                                                >
                                                    Restore
                                                </button>
                                            )}

                                            <button
                                                onClick={() => {
                                                    if (confirm(`Are you sure you want to soft-delete location "${loc.name}" (${loc.id})?`)) {
                                                        handleLocationAction(loc.id, 'delete');
                                                    }
                                                }}
                                                className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer transition-colors"
                                                title="Delete Location"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB 3: USERS (Grouped by Location) */}
            {activeTab === 'users' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-[#E4E7EC]">
                        <div>
                            <h3 className="text-sm font-extrabold text-[#172033]">Location Staff & Admins</h3>
                            <p className="text-xs text-[#667085] mt-0.5">
                                Every employee is strictly assigned to their independent restaurant location.
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                setNewUserData({
                                    restaurantId: locations[0]?.id || '',
                                    name: '',
                                    email: '',
                                    mobile: '',
                                    role: 'waiter',
                                    pin: '1234',
                                    password: ''
                                });
                                setCreateUserOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                        >
                            <UserPlus size={14} />
                            <span>Add Staff to Location</span>
                        </button>
                    </div>

                    {usersByLocation.map((locGroup: any) => (
                        <div
                            key={locGroup.locationId}
                            className="bg-white rounded-3xl border border-[#E4E7EC] p-6 shadow-2xs space-y-4"
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-[#E4E7EC]">
                                <div className="flex items-center gap-2">
                                    <Store size={18} className="text-indigo-600" />
                                    <h4 className="text-base font-black text-[#172033]">{locGroup.locationName}</h4>
                                    <span className="font-mono text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-md">
                                        ID: {locGroup.locationId}
                                    </span>
                                </div>
                                <span className="text-xs font-bold text-[#667085]">
                                    {(locGroup.employees?.length || 0) + (locGroup.admin ? 1 : 0)} Staff Members
                                </span>
                            </div>

                            {/* Location Admin Card */}
                            {locGroup.admin && (
                                <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200/60 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                                            ADM
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-xs text-[#172033]">{locGroup.admin.name}</p>
                                                <span className="px-2 py-0.2 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase">
                                                    Restaurant Admin
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-[#667085] mt-0.5">
                                                {locGroup.admin.email} • {locGroup.admin.mobile || 'No mobile'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="font-mono text-xs text-neutral-600 bg-white px-2.5 py-1 rounded-xl border border-indigo-200">
                                            PIN: <strong>{locGroup.admin.hasPin ? 'Configured' : 'Not configured'}</strong>
                                        </div>
                                        <button
                                            onClick={() => setEditUserData({ ...locGroup.admin, locationId: locGroup.locationId })}
                                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                                        >
                                            Edit Credentials
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Staff List Table */}
                            {locGroup.employees && locGroup.employees.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-[#F5F7FC] border-b border-[#E4E7EC] text-[10px] font-black uppercase text-[#667085]">
                                                <th className="p-3">Staff Name</th>
                                                <th className="p-3">Role</th>
                                                <th className="p-3">Contact</th>
                                                <th className="p-3">Security PIN</th>
                                                <th className="p-3">Status</th>
                                                <th className="p-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#E4E7EC]">
                                            {locGroup.employees.map((emp: any) => (
                                                <tr key={emp.id} className="hover:bg-[#F5F7FC]/70">
                                                    <td className="p-3 font-bold text-[#172033]">{emp.name}</td>
                                                    <td className="p-3">
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-700 capitalize">
                                                            {emp.role?.replace(/_/g, ' ')}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-neutral-600">{emp.mobile || emp.email || '—'}</td>
                                                    <td className="p-3 font-mono font-bold text-neutral-700">{emp.hasPin ? 'Configured' : 'Not configured'}</td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                            emp.status === 'ACTIVE'
                                                                ? 'bg-emerald-50 text-emerald-700'
                                                                : 'bg-neutral-100 text-neutral-500'
                                                        }`}>
                                                            {emp.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => setEditUserData({ ...emp, locationId: locGroup.locationId })}
                                                                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    if (confirm(`Deactivate staff member "${emp.name}"?`)) {
                                                                        await fetch(`/api/admin/owners/${ownerId}/users?userId=${emp.id}`, { method: 'DELETE' });
                                                                        toast.success('Staff member deactivated');
                                                                        await fetchWorkspace();
                                                                    }
                                                                }}
                                                                className="text-[11px] font-bold text-rose-600 hover:text-rose-800 cursor-pointer"
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-xs text-neutral-400 italic py-2">
                                    No additional staff members provisioned in this location.
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* TAB 4: QUOTA & LIMITS */}
            {activeTab === 'quota' && (
                <div className="space-y-6">
                    <div className="bg-white rounded-3xl border border-[#E4E7EC] p-6 shadow-2xs space-y-5 max-w-2xl">
                        <div>
                            <h3 className="text-base font-extrabold text-[#172033]">
                                Owner-Level Branch & Location Quota
                            </h3>
                            <p className="text-xs text-[#667085] mt-1 leading-relaxed">
                                Branch/location quotas belong to the Owner account, not an individual restaurant. All restaurants/locations owned by this Owner count toward the same quota. Only the Owner (or Super Admin) can create new locations, subject to this limit.
                            </p>
                        </div>

                        {/* Interactive Quota Box */}
                        <div className="p-5 bg-[#F5F7FC] rounded-2xl border border-[#E4E7EC] space-y-4">
                            <label className="text-xs font-black text-[#172033] uppercase tracking-wider block">
                                Account Authorized Quota
                            </label>

                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setTargetQuota((q) => Math.max(1, q - 1))}
                                    className="w-12 h-12 rounded-2xl bg-white border border-[#E4E7EC] font-black text-lg text-[#172033] hover:bg-neutral-100 flex items-center justify-center cursor-pointer shadow-xs"
                                >
                                    -
                                </button>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={targetQuota}
                                    onChange={(e) => setTargetQuota(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-28 text-center font-black text-2xl py-2 bg-white border border-[#E4E7EC] rounded-2xl focus:outline-none focus:border-indigo-600"
                                />
                                <button
                                    onClick={() => setTargetQuota((q) => q + 1)}
                                    className="w-12 h-12 rounded-2xl bg-white border border-[#E4E7EC] font-black text-lg text-[#172033] hover:bg-neutral-100 flex items-center justify-center cursor-pointer shadow-xs"
                                >
                                    +
                                </button>
                                <button
                                    onClick={handleSaveQuota}
                                    disabled={quotaLoading || targetQuota === owner.quota}
                                    className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                                >
                                    {quotaLoading ? 'Updating...' : 'Save New Quota'}
                                </button>
                            </div>

                            <div className="space-y-1.5 pt-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-[#667085]">Current Quota Usage:</span>
                                    <span className="font-extrabold text-[#172033]">
                                        {owner.usedQuota} / {targetQuota} Outlets
                                    </span>
                                </div>
                                <div className="w-full h-2 bg-[#E4E7EC] rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${
                                            owner.usedQuota >= targetQuota ? 'bg-amber-500' : 'bg-indigo-600'
                                        }`}
                                        style={{ width: `${Math.min(100, (owner.usedQuota / targetQuota) * 100)}%` }}
                                    />
                                </div>
                                <p className="text-[11px] text-neutral-500 pt-1">
                                    Remaining creation allowance: <strong>{Math.max(0, targetQuota - owner.usedQuota)}</strong> locations.
                                </p>
                            </div>
                        </div>

                        {/* Location Quota Slot Consumers */}
                        <div className="space-y-3 pt-2">
                            <h4 className="text-xs font-black uppercase text-[#667085] tracking-wider">
                                Current Quota Consumers ({locations.length})
                            </h4>
                            <div className="divide-y divide-[#E4E7EC] border border-[#E4E7EC] rounded-2xl overflow-hidden">
                                {locations.map((loc: any, idx: number) => (
                                    <div key={loc.id} className="p-3.5 flex items-center justify-between bg-white text-xs">
                                        <div className="flex items-center gap-3">
                                            <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center">
                                                {idx + 1}
                                            </span>
                                            <div>
                                                <p className="font-bold text-[#172033]">{loc.name}</p>
                                                <p className="font-mono text-[10px] text-neutral-400">ID: {loc.id}</p>
                                            </div>
                                        </div>
                                        <span className="text-[11px] text-neutral-500">
                                            Created {new Date(loc.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 5: SUBSCRIPTION */}
            {activeTab === 'subscription' && (
                <div className="space-y-6 max-w-3xl">
                    <div className="bg-white rounded-3xl border border-[#E4E7EC] p-6 shadow-2xs space-y-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-base font-extrabold text-[#172033]">
                                    Subscription & Franchise License Tier
                                </h3>
                                <p className="text-xs text-[#667085] mt-0.5">
                                    Platform tier dictates branch ceiling, feature entitlements, and billing cycles.
                                </p>
                            </div>
                            <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full text-xs font-black uppercase">
                                {overview.subscriptionStatus?.planName}
                            </span>
                        </div>

                        {/* Plan Details Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-[#F5F7FC] rounded-2xl border border-[#E4E7EC] text-xs">
                            <div>
                                <span className="text-[#667085] font-semibold block">Plan Tier:</span>
                                <span className="font-black text-sm text-[#172033]">
                                    {overview.subscriptionStatus?.planName}
                                </span>
                            </div>
                            <div>
                                <span className="text-[#667085] font-semibold block">License Status:</span>
                                <span className="font-black text-sm text-emerald-600 capitalize">
                                    {overview.subscriptionStatus?.status}
                                </span>
                            </div>
                            <div>
                                <span className="text-[#667085] font-semibold block">Recurring Fee:</span>
                                <span className="font-black text-sm text-[#172033]">
                                    ₹{overview.subscriptionStatus?.amount || 4999} / mo
                                </span>
                            </div>
                            <div>
                                <span className="text-[#667085] font-semibold block">Renewal / Period End:</span>
                                <span className="font-black text-sm text-[#172033]">
                                    {overview.subscriptionStatus?.periodEnd
                                        ? new Date(overview.subscriptionStatus.periodEnd).toLocaleDateString()
                                        : 'Ongoing (Active)'}
                                </span>
                            </div>
                        </div>

                        {/* Super Admin Plan Override Controls */}
                        <div className="space-y-3 pt-2">
                            <h4 className="text-xs font-black uppercase tracking-wider text-[#172033]">
                                Super Admin License Override
                            </h4>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-[#172033]">Override Plan Tier</label>
                                    <select
                                        value={subOverridePlan}
                                        onChange={(e) => setSubOverridePlan(e.target.value)}
                                        className="mt-1 w-full text-xs p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600 font-semibold cursor-pointer"
                                    >
                                        <option value="Starter Trial">Starter Trial (Up to 3 Branches)</option>
                                        <option value="Growth">Growth Monthly (Up to 5 Branches)</option>
                                        <option value="Enterprise">Enterprise (Up to 25 Branches)</option>
                                        <option value="Custom Unlimited">Custom Unlimited</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-[#172033]">Subscription Status</label>
                                    <select
                                        value={subOverrideStatus}
                                        onChange={(e) => setSubOverrideStatus(e.target.value)}
                                        className="mt-1 w-full text-xs p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600 font-semibold cursor-pointer"
                                    >
                                        <option value="active">Active</option>
                                        <option value="trialing">Trialing</option>
                                        <option value="past_due">Past Due</option>
                                        <option value="canceled">Canceled</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-2 flex justify-end">
                                <button
                                    onClick={handleSaveSubOverride}
                                    disabled={subOverrideLoading}
                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                                >
                                    {subOverrideLoading ? 'Saving...' : 'Apply Subscription Override'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 6: BILLING */}
            {activeTab === 'billing' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-5 rounded-3xl border border-[#E4E7EC] shadow-2xs">
                            <span className="text-[11px] font-bold text-[#667085] uppercase">Total Billed</span>
                            <div className="text-2xl font-black text-[#172033] mt-1">
                                ₹{formatRevenue(billing.totalBilled)}
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-3xl border border-[#E4E7EC] shadow-2xs">
                            <span className="text-[11px] font-bold text-[#667085] uppercase">Total Settled</span>
                            <div className="text-2xl font-black text-emerald-600 mt-1">
                                ₹{formatRevenue(billing.totalPaid)}
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-3xl border border-[#E4E7EC] shadow-2xs">
                            <span className="text-[11px] font-bold text-[#667085] uppercase">Invoices Count</span>
                            <div className="text-2xl font-black text-[#172033] mt-1">
                                {billing.invoices?.length || 0}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-[#E4E7EC] p-6 shadow-2xs space-y-4">
                        <h3 className="text-base font-extrabold text-[#172033]">Consolidated Invoices</h3>

                        {billing.invoices && billing.invoices.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-[#F5F7FC] border-b border-[#E4E7EC] text-[10px] font-black uppercase text-[#667085]">
                                            <th className="p-3">Invoice Number</th>
                                            <th className="p-3">Restaurant ID</th>
                                            <th className="p-3">Date</th>
                                            <th className="p-3">Subtotal</th>
                                            <th className="p-3">Tax / GST</th>
                                            <th className="p-3">Total Amount</th>
                                            <th className="p-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#E4E7EC]">
                                        {billing.invoices.map((inv: any) => (
                                            <tr key={inv.id} className="hover:bg-[#F5F7FC]/70">
                                                <td className="p-3 font-bold text-indigo-700">{inv.invoice_number}</td>
                                                <td className="p-3 font-mono text-[11px] text-neutral-500">{inv.restaurant_id}</td>
                                                <td className="p-3 text-neutral-600">{new Date(inv.created_at).toLocaleDateString()}</td>
                                                <td className="p-3">₹{formatRevenue(inv.subtotal)}</td>
                                                <td className="p-3">₹{formatRevenue(inv.tax_amount)}</td>
                                                <td className="p-3 font-black text-[#172033]">₹{formatRevenue(inv.total)}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                                                        inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                                                    }`}>
                                                        {inv.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-xs text-neutral-400 py-4 italic">No invoices issued for this Owner yet.</p>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 7: ACTIVITY */}
            {activeTab === 'activity' && (
                <div className="bg-white rounded-3xl border border-[#E4E7EC] p-6 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-extrabold text-[#172033]">Account Audit Trail</h3>
                            <p className="text-xs text-[#667085] mt-0.5">
                                Granular ledger of all administrative, staff, quota, and location changes.
                            </p>
                        </div>
                        <span className="text-xs font-mono text-neutral-400">{activity.length} entries</span>
                    </div>

                    <div className="divide-y divide-[#E4E7EC]">
                        {activity && activity.length > 0 ? (
                            activity.map((log: any) => {
                                const badgeStyle = getActionBadgeStyle(log.action);
                                const actionTitle = log.actionTitle || formatAuditAction(log.action);
                                const desc = log.description || formatAuditDetails(log.action, log.details, log);
                                const badges = log.badges || extractAuditBadges(log);

                                return (
                                    <div key={log.id} className="py-3.5 flex items-start justify-between text-xs gap-4">
                                        <div className="space-y-1.5 flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                                                    {actionTitle}
                                                </span>
                                                {log.restaurant_id && (
                                                    <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-md font-mono font-medium">
                                                        Restaurant: {log.restaurant_id}
                                                    </span>
                                                )}
                                                {log.ip_address && (
                                                    <span className="text-[10px] text-neutral-500 font-mono bg-neutral-100 px-1.5 py-0.5 rounded">
                                                        IP: {log.ip_address}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs font-semibold text-[#172033] leading-relaxed">
                                                {desc}
                                            </p>
                                            {badges.length > 0 && (
                                                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                                    {badges.map((b: any, idx: number) => (
                                                        <span
                                                            key={idx}
                                                            className="text-[10px] px-2 py-0.5 rounded-md bg-[#F5F7FC] border border-[#E4E7EC] text-neutral-600 font-mono"
                                                        >
                                                            <strong className="text-neutral-400 font-normal">{b.label}:</strong> {b.value}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="font-semibold text-[#172033] text-[11px]">
                                                {new Date(log.created_at).toLocaleDateString()}
                                            </p>
                                            <p className="text-[10px] text-neutral-400 font-mono">
                                                {new Date(log.created_at).toLocaleTimeString()}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-xs text-neutral-400 py-4 italic">No audit records found.</p>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 8: SECURITY */}
            {activeTab === 'security' && (
                <div className="space-y-6">
                    {/* Active Sessions & Security Controls */}
                    <div className="bg-white rounded-3xl border border-[#E4E7EC] p-6 shadow-2xs space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-extrabold text-[#172033]">Active Login Sessions</h3>
                                <p className="text-xs text-[#667085] mt-0.5">
                                    Live authenticated sessions for this Owner and their authorized restaurant staff.
                                </p>
                            </div>
                            <button
                                onClick={handleForceLogout}
                                disabled={forceLogoutLoading}
                                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                            >
                                <LogOut size={13} />
                                <span>{forceLogoutLoading ? 'Terminating...' : 'Force Logout All Sessions'}</span>
                            </button>
                        </div>

                        {security.sessions && security.sessions.length > 0 ? (
                            <div className="divide-y divide-[#E4E7EC] border border-[#E4E7EC] rounded-2xl overflow-hidden text-xs">
                                {security.sessions.map((sess: any) => (
                                    <div key={sess.id} className="p-3.5 flex items-center justify-between bg-white">
                                        <div className="space-y-0.5">
                                            <p className="font-bold text-[#172033]">{sess.device_info || 'Browser Session'}</p>
                                            <p className="text-[11px] text-neutral-400 font-mono">IP: {sess.ip_address || '127.0.0.1'}</p>
                                        </div>
                                        <span className="text-[11px] text-neutral-500">
                                            Last Active: {new Date(sess.last_activity || sess.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-neutral-400 italic py-2">No active sessions in dine_sessions.</p>
                        )}
                    </div>

                    {/* Security Events */}
                    <div className="bg-white rounded-3xl border border-[#E4E7EC] p-6 shadow-2xs space-y-4">
                        <h3 className="text-base font-extrabold text-[#172033]">Threat & Security Events</h3>
                        {security.events && security.events.length > 0 ? (
                            <div className="divide-y divide-[#E4E7EC] text-xs">
                                {security.events.map((evt: any) => (
                                    <div key={evt.id} className="py-3 flex items-start justify-between">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                                                    evt.severity === 'critical' || evt.severity === 'high'
                                                        ? 'bg-rose-100 text-rose-800'
                                                        : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                    {evt.event_type}
                                                </span>
                                                <span className="text-[11px] text-neutral-500 font-mono">{evt.ip_address}</span>
                                            </div>
                                            <p className="text-xs font-semibold text-[#172033] leading-relaxed mt-0.5">
                                                {evt.description || formatAuditDetails(evt.event_type, evt.details, evt)}
                                            </p>
                                        </div>
                                        <span className="text-[10px] text-neutral-400 font-mono">
                                            {new Date(evt.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-neutral-400 py-2 italic">No security incidents detected.</p>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 9: FOUNDER CONTROLS */}
            {activeTab === 'controls' && (
                <div className="space-y-6 max-w-3xl">
                    <div className="bg-white rounded-3xl border border-[#E4E7EC] p-6 shadow-2xs space-y-6">
                        <div>
                            <h3 className="text-base font-extrabold text-[#172033]">
                                Founder Executive Controls
                            </h3>
                            <p className="text-xs text-[#667085] mt-0.5">
                                Privileged Founder actions with platform-wide cascading impact.
                            </p>
                        </div>

                        {/* Account Lifecycle Control */}
                        <div className="p-4 bg-[#F5F7FC] rounded-2xl border border-[#E4E7EC] flex items-center justify-between">
                            <div>
                                <h4 className="text-xs font-black text-[#172033]">Owner Account Status</h4>
                                <p className="text-[11px] text-[#667085] mt-0.5">
                                    Current state: <strong>{owner.status}</strong>
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {isOwnerActive ? (
                                    <button
                                        onClick={() => setSuspendModalOpen(true)}
                                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                                    >
                                        Suspend Owner
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleUpdateOwnerStatus('active')}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                                    >
                                        Restore Owner
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Impersonation Gateway */}
                        <div className="p-4 bg-[#F5F7FC] rounded-2xl border border-[#E4E7EC] flex items-center justify-between">
                            <div>
                                <h4 className="text-xs font-black text-[#172033]">Launch Owner Session (Impersonation)</h4>
                                <p className="text-[11px] text-[#667085] mt-0.5">
                                    Access the multi-branch Owner Panel without asking for owner credentials.
                                </p>
                            </div>
                            <a
                                href={`http://localhost:3000/api/auth/owner/quick-access?restaurantId=${locations[0]?.id || '202603180001'}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                            >
                                <ExternalLink size={13} />
                                <span>Launch Panel</span>
                            </a>
                        </div>

                        {/* Session Revocation */}
                        <div className="p-4 bg-[#F5F7FC] rounded-2xl border border-[#E4E7EC] flex items-center justify-between">
                            <div>
                                <h4 className="text-xs font-black text-[#172033]">Force Invalidate Sessions</h4>
                                <p className="text-[11px] text-[#667085] mt-0.5">
                                    Instantly disconnect this Owner and all their restaurant staff from all devices.
                                </p>
                            </div>
                            <button
                                onClick={handleForceLogout}
                                disabled={forceLogoutLoading}
                                className="px-4 py-2 bg-neutral-800 hover:bg-black text-white rounded-xl text-xs font-bold cursor-pointer"
                            >
                                {forceLogoutLoading ? 'Terminating...' : 'Force Logout'}
                            </button>
                        </div>

                        {/* Destructive Zone */}
                        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 space-y-3">
                            <div className="flex items-center gap-2 text-rose-700 font-extrabold text-xs">
                                <AlertTriangle size={16} />
                                <span>Destructive Action: Delete Owner Account</span>
                            </div>
                            <p className="text-[11px] text-rose-900 leading-relaxed">
                                Deleting this Owner unlinks their {locations.length} restaurant location(s), revokes all active auth sessions, and archives owner records.
                            </p>
                            <button
                                onClick={() => {
                                    setDeleteConfirmText('');
                                    setDeleteModalOpen(true);
                                }}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                            >
                                Delete Owner Permanently
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CREATE LOCATION MODAL */}
            {createLocOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-6 max-w-lg w-full border border-[#E4E7EC] shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-2 border-b border-[#E4E7EC]">
                            <div>
                                <h3 className="text-base font-extrabold text-[#172033]">
                                    Create Independent Restaurant Location
                                </h3>
                                <p className="text-xs text-[#667085] mt-0.5">
                                    Owner Quota: <strong>{owner.usedQuota} / {owner.quota}</strong> used
                                </p>
                            </div>
                            <button
                                onClick={() => setCreateLocOpen(false)}
                                className="p-1 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateLocation} className="space-y-3 text-xs">
                            <div>
                                <label className="font-bold text-[#172033]">Restaurant / Outlet Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={createLocData.name}
                                    onChange={(e) => setCreateLocData({ ...createLocData, name: e.target.value })}
                                    placeholder="e.g. Srinivas In - Airport Terminal"
                                    className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-bold text-[#172033]">Branch Code (Optional)</label>
                                    <input
                                        type="text"
                                        value={createLocData.code}
                                        onChange={(e) => setCreateLocData({ ...createLocData, code: e.target.value })}
                                        placeholder="e.g. SRNVS-T2"
                                        className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-[#172033]">Contact Phone</label>
                                    <input
                                        type="text"
                                        value={createLocData.phone}
                                        onChange={(e) => setCreateLocData({ ...createLocData, phone: e.target.value })}
                                        placeholder="+91 98765 12345"
                                        className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="font-bold text-[#172033]">Physical Address</label>
                                <input
                                    type="text"
                                    value={createLocData.address}
                                    onChange={(e) => setCreateLocData({ ...createLocData, address: e.target.value })}
                                    placeholder="Terminal 2, Departure Level, Nellore"
                                    className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600"
                                />
                            </div>

                            {/* Optional Initial Restaurant Admin */}
                            <div className="p-3.5 bg-amber-50/50 rounded-2xl border border-amber-200 space-y-2.5 mt-2">
                                <span className="font-black text-amber-900 text-[11px] uppercase tracking-wider block">
                                    Assign Initial Restaurant Admin (Optional)
                                </span>
                                <div>
                                    <label className="font-bold text-[#172033]">Admin Name</label>
                                    <input
                                        type="text"
                                        value={createLocData.adminName}
                                        onChange={(e) => setCreateLocData({ ...createLocData, adminName: e.target.value })}
                                        placeholder="Branch Manager Name"
                                        className="mt-1 w-full p-2 bg-white border border-amber-200 rounded-xl focus:outline-none focus:border-indigo-600"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="font-bold text-[#172033]">Admin Email</label>
                                        <input
                                            type="email"
                                            value={createLocData.adminEmail}
                                            onChange={(e) => setCreateLocData({ ...createLocData, adminEmail: e.target.value })}
                                            placeholder="manager@branch.com"
                                            className="mt-1 w-full p-2 bg-white border border-amber-200 rounded-xl focus:outline-none focus:border-indigo-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="font-bold text-[#172033]">Admin Mobile</label>
                                        <input
                                            type="text"
                                            value={createLocData.adminMobile}
                                            onChange={(e) => setCreateLocData({ ...createLocData, adminMobile: e.target.value })}
                                            placeholder="9876543210"
                                            className="mt-1 w-full p-2 bg-white border border-amber-200 rounded-xl focus:outline-none focus:border-indigo-600"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="font-bold text-[#172033]">Login Password</label>
                                        <input
                                            type="text"
                                            value={createLocData.adminPassword}
                                            onChange={(e) => setCreateLocData({ ...createLocData, adminPassword: e.target.value })}
                                            placeholder="TempPassword@123"
                                            className="mt-1 w-full p-2 bg-white border border-amber-200 rounded-xl focus:outline-none focus:border-indigo-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="font-bold text-[#172033]">Quick PIN (4 digits)</label>
                                        <input
                                            type="text"
                                            maxLength={4}
                                            value={createLocData.adminPin}
                                            onChange={(e) => setCreateLocData({ ...createLocData, adminPin: e.target.value })}
                                            placeholder="1234"
                                            className="mt-1 w-full p-2 bg-white border border-amber-200 rounded-xl focus:outline-none focus:border-indigo-600 font-mono"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-3 flex justify-end gap-3 border-t border-[#E4E7EC]">
                                <button
                                    type="button"
                                    onClick={() => setCreateLocOpen(false)}
                                    className="px-4 py-2 font-bold text-[#667085] hover:bg-[#F5F7FC] rounded-xl cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={createLocLoading}
                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer shadow-sm"
                                >
                                    {createLocLoading ? 'Provisioning Location...' : 'Provision Independent Location'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* EDIT LOCATION MODAL */}
            {editLocData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-[#E4E7EC] shadow-2xl space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-[#E4E7EC]">
                            <h3 className="text-base font-extrabold text-[#172033]">Edit Location Details</h3>
                            <button onClick={() => setEditLocData(null)} className="p-1 text-neutral-400">
                                <X size={16} />
                            </button>
                        </div>

                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                setEditLocLoading(true);
                                await handleLocationAction(editLocData.id, 'edit', {
                                    name: editLocData.name,
                                    phone: editLocData.phone,
                                    email: editLocData.email,
                                    address: editLocData.address
                                });
                                setEditLocLoading(false);
                                setEditLocData(null);
                            }}
                            className="space-y-3 text-xs"
                        >
                            <div>
                                <label className="font-bold text-[#172033]">Restaurant Name</label>
                                <input
                                    type="text"
                                    required
                                    value={editLocData.name}
                                    onChange={(e) => setEditLocData({ ...editLocData, name: e.target.value })}
                                    className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-[#172033]">Phone Number</label>
                                <input
                                    type="text"
                                    value={editLocData.phone}
                                    onChange={(e) => setEditLocData({ ...editLocData, phone: e.target.value })}
                                    className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-[#172033]">Email</label>
                                <input
                                    type="email"
                                    value={editLocData.email}
                                    onChange={(e) => setEditLocData({ ...editLocData, email: e.target.value })}
                                    className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-[#172033]">Address</label>
                                <input
                                    type="text"
                                    value={editLocData.address}
                                    onChange={(e) => setEditLocData({ ...editLocData, address: e.target.value })}
                                    className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl"
                                />
                            </div>

                            <div className="pt-2 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setEditLocData(null)}
                                    className="px-4 py-2 font-bold text-[#667085]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={editLocLoading}
                                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold"
                                >
                                    {editLocLoading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MANAGE ADMIN MODAL */}
            {manageAdminData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-[#E4E7EC] shadow-2xl space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-[#E4E7EC]">
                            <h3 className="text-base font-extrabold text-[#172033]">Manage Restaurant Admin</h3>
                            <button onClick={() => setManageAdminData(null)} className="p-1 text-neutral-400">
                                <X size={16} />
                            </button>
                        </div>

                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                setManageAdminLoading(true);
                                await handleLocationAction(manageAdminData.locationId, 'manage_admin', {
                                    adminId: manageAdminData.admin?.id,
                                    adminName: manageAdminData.admin?.name,
                                    adminEmail: manageAdminData.admin?.email,
                                    adminMobile: manageAdminData.admin?.mobile,
                                    adminPassword: manageAdminData.admin?.raw_password,
                                    adminPin: manageAdminData.admin?.raw_pin
                                });
                                setManageAdminLoading(false);
                                setManageAdminData(null);
                            }}
                            className="space-y-3 text-xs"
                        >
                            <div>
                                <label className="font-bold text-[#172033]">Admin Name</label>
                                <input
                                    type="text"
                                    required
                                    value={manageAdminData.admin?.name || ''}
                                    onChange={(e) =>
                                        setManageAdminData({
                                            ...manageAdminData,
                                            admin: { ...manageAdminData.admin, name: e.target.value }
                                        })
                                    }
                                    className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-bold text-[#172033]">Email</label>
                                    <input
                                        type="email"
                                        value={manageAdminData.admin?.email || ''}
                                        onChange={(e) =>
                                            setManageAdminData({
                                                ...manageAdminData,
                                                admin: { ...manageAdminData.admin, email: e.target.value }
                                            })
                                        }
                                        className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-[#172033]">Mobile</label>
                                    <input
                                        type="text"
                                        value={manageAdminData.admin?.mobile || ''}
                                        onChange={(e) =>
                                            setManageAdminData({
                                                ...manageAdminData,
                                                admin: { ...manageAdminData.admin, mobile: e.target.value }
                                            })
                                        }
                                        className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-bold text-[#172033]">Password</label>
                                    <input
                                        type="text"
                                        value={manageAdminData.admin?.raw_password || ''}
                                        onChange={(e) =>
                                            setManageAdminData({
                                                ...manageAdminData,
                                                admin: { ...manageAdminData.admin, raw_password: e.target.value }
                                            })
                                        }
                                        placeholder="Set password"
                                        className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-[#172033]">Security PIN</label>
                                    <input
                                        type="text"
                                        maxLength={4}
                                        value={manageAdminData.admin?.raw_pin || ''}
                                        onChange={(e) =>
                                            setManageAdminData({
                                                ...manageAdminData,
                                                admin: { ...manageAdminData.admin, raw_pin: e.target.value }
                                            })
                                        }
                                        className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-mono"
                                    />
                                </div>
                            </div>

                            <div className="pt-2 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setManageAdminData(null)}
                                    className="px-4 py-2 font-bold text-[#667085]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={manageAdminLoading}
                                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold"
                                >
                                    {manageAdminLoading ? 'Saving...' : 'Save Admin'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* VIEW LOCATION DETAIL MODAL */}
            {viewLocDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-6 max-w-2xl w-full border border-[#E4E7EC] shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-3 border-b border-[#E4E7EC]">
                            <div>
                                <h3 className="text-base font-extrabold text-[#172033]">
                                    {viewLocDetail.location?.name}
                                </h3>
                                <p className="font-mono text-xs text-neutral-400">
                                    Restaurant ID: {viewLocDetail.location?.id}
                                </p>
                            </div>
                            <button onClick={() => setViewLocDetail(null)} className="p-1 text-neutral-400">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Recent Orders */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-black uppercase tracking-wider text-[#667085]">
                                Recent Orders ({viewLocDetail.orders?.length || 0})
                            </h4>
                            {viewLocDetail.orders && viewLocDetail.orders.length > 0 ? (
                                <div className="divide-y divide-[#E4E7EC] border border-[#E4E7EC] rounded-2xl max-h-40 overflow-y-auto text-xs">
                                    {viewLocDetail.orders.map((o: any) => (
                                        <div key={o.id} className="p-2.5 flex items-center justify-between">
                                            <span className="font-mono text-neutral-600">#{o.id.slice(-6)}</span>
                                            <span className="font-bold text-[#172033]">₹{formatRevenue(o.total_amount)}</span>
                                            <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-neutral-100 uppercase">
                                                {o.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-neutral-400 italic">No orders placed yet.</p>
                            )}
                        </div>

                        {/* Menu & Categories */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="p-3 bg-[#F5F7FC] rounded-2xl border border-[#E4E7EC]">
                                <span className="text-[#667085] font-bold block">Menu Categories:</span>
                                <span className="font-black text-sm text-[#172033]">
                                    {viewLocDetail.categories?.length || 0} Categories
                                </span>
                            </div>
                            <div className="p-3 bg-[#F5F7FC] rounded-2xl border border-[#E4E7EC]">
                                <span className="text-[#667085] font-bold block">Active Services:</span>
                                <span className="font-black text-sm text-[#172033]">
                                    {viewLocDetail.services?.length || 0} Services Configured
                                </span>
                            </div>
                        </div>

                        <div className="pt-2 flex justify-end">
                            <button
                                onClick={() => setViewLocDetail(null)}
                                className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ADD USER MODAL */}
            {createUserOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-[#E4E7EC] shadow-2xl space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-[#E4E7EC]">
                            <h3 className="text-base font-extrabold text-[#172033]">Add Staff to Location</h3>
                            <button onClick={() => setCreateUserOpen(false)} className="p-1 text-neutral-400">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleAddStaff} className="space-y-3 text-xs">
                            <div>
                                <label className="font-bold text-[#172033]">Assign to Location *</label>
                                <select
                                    required
                                    value={newUserData.restaurantId}
                                    onChange={(e) => setNewUserData({ ...newUserData, restaurantId: e.target.value })}
                                    className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-semibold"
                                >
                                    {locations.map((loc: any) => (
                                        <option key={loc.id} value={loc.id}>
                                            {loc.name} ({loc.id})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="font-bold text-[#172033]">Full Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={newUserData.name}
                                    onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                                    placeholder="Employee Name"
                                    className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-bold text-[#172033]">Role</label>
                                    <select
                                        value={newUserData.role}
                                        onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                                        className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-semibold"
                                    >
                                        <option value="waiter">Waiter</option>
                                        <option value="chef">Chef</option>
                                        <option value="cashier">Cashier</option>
                                        <option value="delivery_boy">Delivery</option>
                                        <option value="supervisor">Supervisor</option>
                                        <option value="restaurant_admin">Restaurant Admin</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="font-bold text-[#172033]">Mobile</label>
                                    <input
                                        type="text"
                                        value={newUserData.mobile}
                                        onChange={(e) => setNewUserData({ ...newUserData, mobile: e.target.value })}
                                        placeholder="Mobile number"
                                        className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-bold text-[#172033]">Security PIN</label>
                                    <input
                                        type="text"
                                        maxLength={4}
                                        value={newUserData.pin}
                                        onChange={(e) => setNewUserData({ ...newUserData, pin: e.target.value })}
                                        className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-[#172033]">Email (Optional)</label>
                                    <input
                                        type="email"
                                        value={newUserData.email}
                                        onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                                        placeholder="staff@dineinone.com"
                                        className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl"
                                    />
                                </div>
                            </div>

                            <div className="pt-2 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setCreateUserOpen(false)}
                                    className="px-4 py-2 font-bold text-[#667085]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={createUserLoading}
                                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold"
                                >
                                    {createUserLoading ? 'Adding...' : 'Add Staff Member'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* EDIT USER MODAL (Including Reassigning Location) */}
            {editUserData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-[#E4E7EC] shadow-2xl space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-[#E4E7EC]">
                            <h3 className="text-base font-extrabold text-[#172033]">Edit Staff Member</h3>
                            <button onClick={() => setEditUserData(null)} className="p-1 text-neutral-400">
                                <X size={16} />
                            </button>
                        </div>

                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                setEditUserLoading(true);
                                try {
                                    const res = await fetch(`/api/admin/owners/${ownerId}/users`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            userId: editUserData.id,
                                            name: editUserData.name,
                                            email: editUserData.email,
                                            mobile: editUserData.mobile,
                                            role: editUserData.role,
                                            status: editUserData.status,
                                            pin: editUserData.raw_pin,
                                            password: editUserData.raw_password,
                                            targetRestaurantId: editUserData.targetRestaurantId
                                        })
                                    });
                                    if (res.ok) {
                                        toast.success('Staff member updated successfully');
                                        setEditUserData(null);
                                        await fetchWorkspace();
                                    } else {
                                        toast.error('Failed to update staff member');
                                    }
                                } catch (_) {
                                    toast.error('Network error updating staff member');
                                } finally {
                                    setEditUserLoading(false);
                                }
                            }}
                            className="space-y-3 text-xs"
                        >
                            <div>
                                <label className="font-bold text-[#172033]">Staff Name</label>
                                <input
                                    type="text"
                                    required
                                    value={editUserData.name}
                                    onChange={(e) => setEditUserData({ ...editUserData, name: e.target.value })}
                                    className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-bold text-[#172033]">Role</label>
                                    <select
                                        value={editUserData.role}
                                        onChange={(e) => setEditUserData({ ...editUserData, role: e.target.value })}
                                        className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-semibold capitalize"
                                    >
                                        <option value="waiter">Waiter</option>
                                        <option value="chef">Chef</option>
                                        <option value="cashier">Cashier</option>
                                        <option value="delivery_boy">Delivery</option>
                                        <option value="supervisor">Supervisor</option>
                                        <option value="restaurant_admin">Restaurant Admin</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="font-bold text-[#172033]">Status</label>
                                    <select
                                        value={editUserData.status?.toLowerCase() || 'active'}
                                        onChange={(e) => setEditUserData({ ...editUserData, status: e.target.value })}
                                        className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-semibold"
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            {/* Location Reassignment */}
                            <div>
                                <label className="font-bold text-[#172033]">Location Assignment</label>
                                <select
                                    value={editUserData.targetRestaurantId || editUserData.locationId || ''}
                                    onChange={(e) => setEditUserData({ ...editUserData, targetRestaurantId: e.target.value })}
                                    className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-semibold"
                                >
                                    {locations.map((loc: any) => (
                                        <option key={loc.id} value={loc.id}>
                                            {loc.name} ({loc.id})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-bold text-[#172033]">Mobile</label>
                                    <input
                                        type="text"
                                        value={editUserData.mobile || ''}
                                        onChange={(e) => setEditUserData({ ...editUserData, mobile: e.target.value })}
                                        className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-[#172033]">Security PIN</label>
                                    <input
                                        type="text"
                                        maxLength={4}
                                         value={editUserData.raw_pin || ''}
                                        onChange={(e) => setEditUserData({ ...editUserData, raw_pin: e.target.value })}
                                        className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-mono"
                                    />
                                </div>
                            </div>

                            <div className="pt-2 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setEditUserData(null)}
                                    className="px-4 py-2 font-bold text-[#667085]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={editUserLoading}
                                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold"
                                >
                                    {editUserLoading ? 'Saving...' : 'Update Staff Member'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* SUSPEND OWNER MODAL */}
            {suspendModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-amber-200 shadow-2xl space-y-4">
                        <div className="flex items-center gap-2.5 text-amber-600">
                            <AlertTriangle size={18} />
                            <h3 className="text-base font-extrabold text-[#172033]">Suspend Owner Account</h3>
                        </div>

                        <p className="text-xs text-[#667085] leading-relaxed">
                            Suspending Owner <strong>{owner.name}</strong> will temporarily disable customer ordering and staff access across all {locations.length} of their locations.
                        </p>

                        <div>
                            <label className="text-xs font-bold text-[#172033]">Suspension Reason *</label>
                            <input
                                type="text"
                                required
                                value={suspendReason}
                                onChange={(e) => setSuspendReason(e.target.value)}
                                placeholder="e.g. Unpaid billing, Compliance review"
                                className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs"
                            />
                        </div>

                        <div className="pt-2 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setSuspendModalOpen(false)}
                                className="px-4 py-2 text-xs font-bold text-[#667085]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleUpdateOwnerStatus('suspended', suspendReason)}
                                disabled={suspendLoading}
                                className="px-5 py-2.5 bg-amber-600 text-white rounded-xl text-xs font-bold"
                            >
                                {suspendLoading ? 'Suspending...' : 'Confirm Suspension'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE OWNER CONFIRMATION MODAL */}
            {deleteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-rose-200 shadow-2xl space-y-4">
                        <div className="flex items-center gap-2.5 text-rose-600">
                            <AlertTriangle size={20} />
                            <h3 className="text-base font-extrabold text-[#172033]">Delete Owner Account</h3>
                        </div>

                        <p className="text-xs text-[#667085] leading-relaxed">
                            This action is destructive and irreversible. To confirm deletion, type the owner email <strong>{owner.email}</strong> below:
                        </p>

                        <input
                            type="text"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder={owner.email}
                            className="w-full p-2.5 bg-[#F5F7FC] border border-rose-200 rounded-xl text-xs font-mono"
                        />

                        <div className="pt-2 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setDeleteModalOpen(false)}
                                className="px-4 py-2 text-xs font-bold text-[#667085]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteOwnerPermanent}
                                disabled={deleteLoading || deleteConfirmText.trim() !== owner.email.trim()}
                                className="px-5 py-2.5 bg-rose-600 disabled:opacity-40 text-white rounded-xl text-xs font-bold"
                            >
                                {deleteLoading ? 'Deleting...' : 'Delete Account Permanently'}
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
                                <span className="font-bold text-[#172033]">{branchToApprove.name}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[#667085]">Restaurant ID:</span>
                                <span className="font-mono font-bold text-neutral-700">{branchToApprove.id}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[#667085]">Owner:</span>
                                <span className="font-medium text-[#172033]">{owner.name} ({owner.email})</span>
                            </div>
                            {branchToApprove.registrationRequest?.requestNumber && (
                                <div className="flex justify-between items-center">
                                    <span className="text-[#667085]">Request Number:</span>
                                    <span className="font-mono font-bold text-emerald-800">{branchToApprove.registrationRequest.requestNumber}</span>
                                </div>
                            )}
                            {branchToApprove.registrationRequest?.paymentReference && (
                                <div className="flex justify-between items-center pt-1 border-t border-emerald-200/40">
                                    <span className="text-[#667085]">Payment Ref / UTR:</span>
                                    <span className="font-mono font-bold text-neutral-800">{branchToApprove.registrationRequest.paymentReference}</span>
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
                                onClick={handleConfirmApproveBranch}
                                disabled={branchApproveLoading}
                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                {branchApproveLoading ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Approving Branch...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check size={14} />
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-rose-200 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
                        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                            <div className="flex items-center gap-2.5 text-rose-600">
                                <X size={20} />
                                <h3 className="font-extrabold text-[#172033] text-base">Reject Branch Request</h3>
                            </div>
                            <button
                                onClick={() => setBranchToReject(null)}
                                className="p-1 text-neutral-400 hover:text-neutral-600 rounded-lg cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <p className="text-xs text-[#667085]">
                            Are you sure you want to reject the branch registration for <strong>{branchToReject.name}</strong>? Restaurant admin access will remain disabled.
                        </p>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-[#172033] block">
                                Reason for Rejection
                            </label>
                            <textarea
                                value={branchRejectReason}
                                onChange={(e) => setBranchRejectReason(e.target.value)}
                                placeholder="e.g. Invalid payment reference, duplicate registration request..."
                                rows={3}
                                className="w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-rose-600"
                            />
                        </div>

                        <div className="pt-2 flex justify-end gap-2 border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={() => setBranchToReject(null)}
                                className="px-4 py-2 text-xs font-bold text-[#667085] hover:text-[#172033] cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmRejectBranch}
                                disabled={branchRejectLoading}
                                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                {branchRejectLoading ? 'Rejecting...' : 'Confirm Rejection'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
