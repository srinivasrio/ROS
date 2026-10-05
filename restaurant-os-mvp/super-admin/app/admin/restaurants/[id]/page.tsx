'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
    UtensilsCrossed,
    ArrowLeft,
    GitBranch,
    Users,
    CreditCard,
    Receipt,
    ShieldAlert,
    Settings,
    CheckCircle2,
    Ban,
    Trash2,
    RotateCcw,
    ExternalLink,
    Plus,
    Headset,
    Calendar,
    Phone,
    Mail,
    MapPin,
    Sparkles,
    AlertTriangle,
    Eye,
    Save,
    Edit3,
    X,
    FileText,
    DollarSign,
    Check
} from 'lucide-react';
import { toast } from 'sonner';
import { formatAuditAction, formatAuditDetails, extractAuditBadges, getActionBadgeStyle } from '@/lib/audit-formatters';

export default function RestaurantDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'branches' | 'employees' | 'subscription' | 'billing' | 'activity' | 'settings'>('overview');

    // Lifecycle action loading
    const [actionLoading, setActionLoading] = useState(false);

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '',
        ownerName: '',
        phone: '',
        email: '',
        address: ''
    });

    // Confirmation Modals State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        type: 'suspend' | 'activate' | 'soft_delete' | 'permanent_delete' | 'restore' | null;
        title: string;
        message: string;
        confirmText: string;
        confirmVariant: 'danger' | 'warning' | 'primary';
    }>({
        isOpen: false,
        type: null,
        title: '',
        message: '',
        confirmText: '',
        confirmVariant: 'primary'
    });

    // KYC Settings Form State
    const [kycForm, setKycForm] = useState({
        legalBusinessName: '',
        businessType: 'Restaurant',
        businessConstitution: 'Private Limited',
        gstNumber: '',
        fssaiNumber: '',
        panNumber: '',
        shopLicense: ''
    });
    const [savingKyc, setSavingKyc] = useState(false);

    const fetchDetail = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/restaurants/${id}`);
            if (res.ok) {
                const json = await res.json();
                setData(json);
                if (json.restaurant) {
                    setEditForm({
                        name: json.restaurant.name || '',
                        ownerName: json.restaurant.ownerName || '',
                        phone: json.restaurant.phone || '',
                        email: json.restaurant.email || '',
                        address: json.restaurant.address || ''
                    });
                }
                if (json.legal) {
                    setKycForm({
                        legalBusinessName: json.legal.business_name || '',
                        businessType: json.legal.business_type || 'Restaurant',
                        businessConstitution: json.legal.business_constitution || 'Private Limited',
                        gstNumber: json.legal.gst_number || '',
                        fssaiNumber: json.legal.fssai_number || '',
                        panNumber: json.legal.pan_number || '',
                        shopLicense: json.legal.shop_establishment_license || ''
                    });
                }
            } else {
                toast.error('Failed to load restaurant details');
            }
        } catch (err) {
            console.error('Error loading restaurant detail:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) fetchDetail();
    }, [id]);

    const handleStatusTransition = async (newStatus: string) => {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/restaurants/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                toast.success(`Restaurant status updated to ${newStatus.toUpperCase()}`);
                await fetchDetail();
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            } else {
                const err = await res.json();
                toast.error(err.error || 'Status transition failed');
            }
        } catch (err: any) {
            toast.error(err.message || 'Operation failed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSoftDelete = async () => {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/restaurants/${id}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                toast.success('Restaurant moved to soft-deleted retention pool');
                await fetchDetail();
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            } else {
                toast.error('Soft delete failed');
            }
        } catch (err: any) {
            toast.error(err.message || 'Operation failed');
        } finally {
            setActionLoading(false);
        }
    };

    const handlePermanentDelete = async () => {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/restaurants/${id}?permanent=true`, {
                method: 'DELETE',
            });
            if (res.ok) {
                toast.success('Restaurant and associated records permanently purged');
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                router.push('/admin/restaurants');
            } else {
                const err = await res.json();
                toast.error(err.error || 'Permanent delete failed');
            }
        } catch (err: any) {
            toast.error(err.message || 'Operation failed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            const res = await fetch(`/api/restaurants/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm),
            });
            if (res.ok) {
                toast.success('Restaurant details saved successfully');
                setIsEditModalOpen(false);
                await fetchDetail();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Update failed');
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to update details');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSaveKyc = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingKyc(true);
        try {
            const res = await fetch(`/api/restaurants/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(kycForm),
            });
            if (res.ok) {
                toast.success('KYC and statutory legal parameters saved');
                await fetchDetail();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Failed to save KYC');
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to save KYC parameters');
        } finally {
            setSavingKyc(false);
        }
    };

    const handleExtendTrial = async () => {
        setActionLoading(true);
        try {
            const res = await fetch('/api/admin/subscriptions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurantId: id,
                    action: 'extend_trial',
                    days: 14
                })
            });
            if (res.ok) {
                toast.success('Subscription trial successfully extended by 14 days');
                await fetchDetail();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Trial extension failed');
            }
        } catch (err: any) {
            toast.error(err.message || 'Trial extension request failed');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="py-24 text-center">
                <div className="inline-block h-8 w-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-3" />
                <p className="text-xs font-bold text-[#667085]">Loading restaurant organization...</p>
            </div>
        );
    }

    const rest = data?.restaurant;
    const branches = data?.branches || [];
    const employees = data?.employees || [];
    const invoices = data?.invoices || [];
    const subscription = data?.subscription;
    const legal = data?.legal || {};
    const auditLogs = data?.auditLogs || [];
    const isSoftDeleted = rest?.status === 'SOFT_DELETED' || !!rest?.deletedAt;

    return (
        <div className="space-y-6">
            {/* Back link */}
            <div>
                <Link
                    href="/admin/restaurants"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#667085] hover:text-[#172033] transition-colors"
                >
                    <ArrowLeft size={14} />
                    <span>Back to Restaurants</span>
                </Link>
            </div>

            {/* Restaurant Detail Hero Header */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E4E7EC] shadow-xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-black text-2xl shrink-0 shadow-2xs">
                            {rest?.name?.charAt(0) || 'R'}
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h1 className="text-xl sm:text-2xl font-black text-[#172033] tracking-tight">
                                    {rest?.name}
                                </h1>
                                <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                        isSoftDeleted
                                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                            : rest?.status === 'ACTIVE'
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            : rest?.status === 'SUSPENDED'
                                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                            : 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                                    }`}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                    {isSoftDeleted ? 'SOFT DELETED' : rest?.status}
                                </span>
                            </div>

                            <p className="text-xs text-[#667085] mt-1 font-medium flex items-center gap-3">
                                <span>Owner: <strong className="text-[#172033]">{rest?.ownerName || 'Unassigned'}</strong></span>
                                <span>•</span>
                                <span className="font-mono text-neutral-400">{rest?.id}</span>
                            </p>
                        </div>
                    </div>

                    {/* Operational Action Buttons */}
                    <div className="flex items-center flex-wrap gap-2.5">
                        <button
                            onClick={() => setIsEditModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-neutral-50 text-[#172033] rounded-xl text-xs font-bold transition-all border border-[#E4E7EC] cursor-pointer shadow-2xs"
                        >
                            <Edit3 size={14} />
                            <span>Edit Details</span>
                        </button>
                        <Link
                            href="/admin/branches?action=new"
                            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100/70 text-indigo-700 rounded-xl text-xs font-bold transition-all border border-indigo-200"
                        >
                            <Plus size={14} />
                            <span>Add Branch</span>
                        </Link>
                        <Link
                            href="/admin/support"
                            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-neutral-50 text-[#172033] rounded-xl text-xs font-bold transition-all border border-[#E4E7EC]"
                        >
                            <Headset size={14} />
                            <span>Support</span>
                        </Link>

                        {/* Status Transition Action Buttons */}
                        {isSoftDeleted ? (
                            <>
                                <button
                                    onClick={() => setConfirmModal({
                                        isOpen: true,
                                        type: 'restore',
                                        title: 'Restore Restaurant',
                                        message: `Are you sure you want to restore ${rest?.name}? It will return to ACTIVE status and reappear in live operational searches.`,
                                        confirmText: 'Restore to Active',
                                        confirmVariant: 'primary'
                                    })}
                                    disabled={actionLoading}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition-all border border-emerald-200 cursor-pointer"
                                >
                                    <RotateCcw size={14} />
                                    <span>Restore Restaurant</span>
                                </button>
                                <button
                                    onClick={() => setConfirmModal({
                                        isOpen: true,
                                        type: 'permanent_delete',
                                        title: 'Permanently Purge Restaurant',
                                        message: `WARNING: This will permanently delete ${rest?.name} and all linked branches, staff records, orders, subscriptions, and legal entities. This action CANNOT be undone!`,
                                        confirmText: 'Permanently Purge',
                                        confirmVariant: 'danger'
                                    })}
                                    disabled={actionLoading}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all border border-rose-200 cursor-pointer"
                                >
                                    <Trash2 size={14} />
                                    <span>Purge Permanently</span>
                                </button>
                            </>
                        ) : (
                            <>
                                {rest?.status === 'ACTIVE' ? (
                                    <button
                                        onClick={() => setConfirmModal({
                                            isOpen: true,
                                            type: 'suspend',
                                            title: 'Suspend Restaurant Access',
                                            message: `Suspending ${rest?.name} will temporarily block portal access and POS transactions for all branch managers and employees.`,
                                            confirmText: 'Confirm Suspension',
                                            confirmVariant: 'warning'
                                        })}
                                        disabled={actionLoading}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition-all border border-amber-200 cursor-pointer"
                                    >
                                        <Ban size={14} />
                                        <span>Suspend</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setConfirmModal({
                                            isOpen: true,
                                            type: 'activate',
                                            title: 'Activate Restaurant Organization',
                                            message: `Activate ${rest?.name} to re-enable portal access, live online ordering, and branch POS operations.`,
                                            confirmText: 'Activate Now',
                                            confirmVariant: 'primary'
                                        })}
                                        disabled={actionLoading}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition-all border border-emerald-200 cursor-pointer"
                                    >
                                        <CheckCircle2 size={14} />
                                        <span>Activate</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => setConfirmModal({
                                        isOpen: true,
                                        type: 'soft_delete',
                                        title: 'Soft Delete Restaurant',
                                        message: `Are you sure you want to soft-delete ${rest?.name}? The restaurant will be hidden from operational views but preserved for retention audit purposes.`,
                                        confirmText: 'Soft Delete',
                                        confirmVariant: 'danger'
                                    })}
                                    disabled={actionLoading}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all border border-rose-200 cursor-pointer"
                                >
                                    <Trash2 size={14} />
                                    <span>Soft Delete</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Sub-Navigation Tabs */}
                <div className="flex items-center gap-2 border-t border-[#E4E7EC] mt-6 pt-4 overflow-x-auto">
                    {[
                        { id: 'overview', label: 'Overview' },
                        { id: 'branches', label: `Branches (${branches.length})` },
                        { id: 'employees', label: `Employees (${employees.length})` },
                        { id: 'subscription', label: 'Subscription' },
                        { id: 'billing', label: `Billing & Invoices (${invoices.length})` },
                        { id: 'activity', label: 'Audit Activity' },
                        { id: 'settings', label: 'Settings & KYC' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-[#667085] hover:text-[#172033] hover:bg-[#F5F7FC]'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* TAB CONTENT: Overview */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Primary Overview Cards */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="p-4 rounded-2xl bg-white border border-[#E4E7EC]">
                                <span className="text-[11px] font-bold text-[#667085] uppercase">Total Outlets</span>
                                <p className="text-2xl font-black text-[#172033] mt-1">{branches.length}</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-white border border-[#E4E7EC]">
                                <span className="text-[11px] font-bold text-[#667085] uppercase">Staff Members</span>
                                <p className="text-2xl font-black text-[#172033] mt-1">{employees.length} Staff</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-white border border-[#E4E7EC]">
                                <span className="text-[11px] font-bold text-[#667085] uppercase">Order Volume</span>
                                <p className="text-2xl font-black text-[#172033] mt-1">{data?.orderCount || 0}</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-white border border-[#E4E7EC]">
                                <span className="text-[11px] font-bold text-[#667085] uppercase">Active Plan</span>
                                <p className="text-sm font-black text-indigo-700 mt-2 truncate uppercase">
                                    {subscription?.plan_name || rest?.subscriptionPlan || 'Growth'}
                                </p>
                            </div>
                        </div>

                        {/* Organization Profile Details */}
                        <div className="bg-white rounded-2xl p-6 border border-[#E4E7EC] space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-extrabold text-[#172033]">Organization Details</h3>
                                <button
                                    onClick={() => setIsEditModalOpen(true)}
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                                >
                                    <Edit3 size={12} />
                                    <span>Edit</span>
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                <div>
                                    <span className="font-bold text-[#667085]">Email Address:</span>
                                    <p className="font-medium text-[#172033] mt-0.5">{rest?.email || 'None'}</p>
                                </div>
                                <div>
                                    <span className="font-bold text-[#667085]">Official Phone:</span>
                                    <p className="font-medium text-[#172033] mt-0.5">{rest?.phone || 'None'}</p>
                                </div>
                                <div className="sm:col-span-2">
                                    <span className="font-bold text-[#667085]">Registered Address:</span>
                                    <p className="font-medium text-[#172033] mt-0.5">{rest?.address || 'Not specified'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Quick Compliance & Status */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl p-6 border border-[#E4E7EC] space-y-4">
                            <h3 className="text-sm font-extrabold text-[#172033]">Compliance Status</h3>
                            <div className="space-y-2.5 text-xs">
                                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F5F7FC]">
                                    <span className="font-medium text-[#667085]">GST Registration</span>
                                    <span className="font-bold text-[#172033]">{legal?.gst_number || 'Not Registered'}</span>
                                </div>
                                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F5F7FC]">
                                    <span className="font-medium text-[#667085]">FSSAI License</span>
                                    <span className="font-bold text-[#172033]">{legal?.fssai_number || 'Pending Entry'}</span>
                                </div>
                                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F5F7FC]">
                                    <span className="font-medium text-[#667085]">PAN Number</span>
                                    <span className="font-bold text-[#172033]">{legal?.pan_number || 'Pending'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: Branches */}
            {activeTab === 'branches' && (
                <div className="bg-white rounded-2xl border border-[#E4E7EC] overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-[#F5F7FC] border-b border-[#E4E7EC] text-[11px] font-black uppercase text-[#667085]">
                                <th className="p-4">Branch Name</th>
                                <th className="p-4">Branch Code</th>
                                <th className="p-4">Address</th>
                                <th className="p-4">Phone</th>
                                <th className="p-4">Type</th>
                                <th className="p-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E4E7EC]">
                            {branches.length > 0 ? (
                                branches.map((b: any) => (
                                    <tr key={b.id} className="hover:bg-neutral-50">
                                        <td className="p-4 font-bold text-[#172033]">{b.name}</td>
                                        <td className="p-4 font-mono text-[#667085]">{b.code || b.id}</td>
                                        <td className="p-4 text-[#667085]">{b.address || '—'}</td>
                                        <td className="p-4 text-[#667085]">{b.phone || '—'}</td>
                                        <td className="p-4">
                                            {b.is_main_branch ? (
                                                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                                                    HQ Main
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 font-bold text-[10px]">
                                                    Outlet
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                b.status === 'active' || !b.status
                                                    ? 'bg-emerald-50 text-emerald-700'
                                                    : 'bg-neutral-100 text-neutral-600'
                                            }`}>
                                                {b.status || 'active'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-xs text-[#667085]">
                                        No branches registered under this restaurant yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* TAB CONTENT: Employees */}
            {activeTab === 'employees' && (
                <div className="bg-white rounded-2xl border border-[#E4E7EC] overflow-hidden">
                    <div className="p-4 border-b border-[#E4E7EC] flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-extrabold text-[#172033]">Organization Staff</h3>
                            <p className="text-xs text-[#667085]">All verified employees, managers, and assigned branch operators.</p>
                        </div>
                    </div>
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-[#F5F7FC] border-b border-[#E4E7EC] text-[11px] font-black uppercase text-[#667085]">
                                <th className="p-4">Employee</th>
                                <th className="p-4">Role</th>
                                <th className="p-4">Contact</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Approval</th>
                                <th className="p-4">Joined</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E4E7EC]">
                            {employees.length > 0 ? (
                                employees.map((emp: any) => (
                                    <tr key={emp.id} className="hover:bg-neutral-50">
                                        <td className="p-4">
                                            <p className="font-bold text-[#172033]">{emp.name || 'Unnamed Employee'}</p>
                                            <p className="text-[11px] font-mono text-[#667085]">{emp.id}</p>
                                        </td>
                                        <td className="p-4">
                                            <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[10px] uppercase">
                                                {emp.role || 'Staff'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-[#667085]">
                                            <p>{emp.email || '—'}</p>
                                            <p className="text-[11px] text-neutral-400">{emp.mobile || '—'}</p>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                emp.status === 'active' || !emp.status
                                                    ? 'bg-emerald-50 text-emerald-700'
                                                    : 'bg-rose-50 text-rose-700'
                                            }`}>
                                                {emp.status || 'active'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-600">
                                                {emp.approval_status || 'approved'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-[#667085]">
                                            {emp.created_at ? new Date(emp.created_at).toLocaleDateString() : '—'}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-xs text-[#667085]">
                                        No employees found for this restaurant organization.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* TAB CONTENT: Subscription */}
            {activeTab === 'subscription' && (
                <div className="bg-white rounded-2xl p-6 border border-[#E4E7EC] space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-sm font-extrabold text-[#172033]">Active SaaS Subscription</h3>
                            <p className="text-xs text-[#667085]">Managed platform tier and licensing lifecycle.</p>
                        </div>
                        <button
                            onClick={handleExtendTrial}
                            disabled={actionLoading}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
                        >
                            Extend Trial +14 Days
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 rounded-xl bg-[#F5F7FC] border border-[#E4E7EC]">
                            <span className="text-[11px] font-bold text-[#667085] uppercase">Plan Tier</span>
                            <p className="text-lg font-black text-indigo-700 mt-1 uppercase">
                                {subscription?.plan_name || rest?.subscriptionPlan || 'Growth'}
                            </p>
                            <p className="text-xs text-[#667085] mt-1 capitalize">Billing: {subscription?.plan_type || 'Monthly'}</p>
                        </div>

                        <div className="p-4 rounded-xl bg-[#F5F7FC] border border-[#E4E7EC]">
                            <span className="text-[11px] font-bold text-[#667085] uppercase">Status</span>
                            <div className="mt-1">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                    subscription?.status === 'active' || rest?.status === 'ACTIVE'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                    {(subscription?.status || 'active').toUpperCase()}
                                </span>
                            </div>
                            <p className="text-xs text-[#667085] mt-1">₹{subscription?.price || '3,999'} / month</p>
                        </div>

                        <div className="p-4 rounded-xl bg-[#F5F7FC] border border-[#E4E7EC]">
                            <span className="text-[11px] font-bold text-[#667085] uppercase">Renewal / Period End</span>
                            <p className="text-sm font-black text-[#172033] mt-1">
                                {subscription?.trial_ends_at
                                    ? `Trial Ends: ${new Date(subscription.trial_ends_at).toLocaleDateString()}`
                                    : subscription?.current_period_ends_at
                                    ? `Renews: ${new Date(subscription.current_period_ends_at).toLocaleDateString()}`
                                    : 'Auto-renews at cycle end'}
                            </p>
                            <p className="text-xs text-neutral-400 mt-1 font-mono">
                                Sub ID: {subscription?.id ? String(subscription.id).slice(0, 10) + '...' : 'System default'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: Billing & Invoices */}
            {activeTab === 'billing' && (
                <div className="bg-white rounded-2xl border border-[#E4E7EC] overflow-hidden">
                    <div className="p-4 border-b border-[#E4E7EC]">
                        <h3 className="text-sm font-extrabold text-[#172033]">Invoices & Billing History</h3>
                        <p className="text-xs text-[#667085]">Official tax invoices and platform SaaS payments.</p>
                    </div>
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-[#F5F7FC] border-b border-[#E4E7EC] text-[11px] font-black uppercase text-[#667085]">
                                <th className="p-4">Invoice #</th>
                                <th className="p-4">Date</th>
                                <th className="p-4">Amount</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Due Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E4E7EC]">
                            {invoices.length > 0 ? (
                                invoices.map((inv: any) => (
                                    <tr key={inv.id} className="hover:bg-neutral-50">
                                        <td className="p-4 font-bold font-mono text-[#172033]">{inv.invoice_number}</td>
                                        <td className="p-4 text-[#667085]">{new Date(inv.created_at).toLocaleDateString()}</td>
                                        <td className="p-4 font-black text-[#172033]">₹{inv.amount?.toLocaleString()}</td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                                inv.status === 'paid'
                                                    ? 'bg-emerald-50 text-emerald-700'
                                                    : inv.status === 'overdue'
                                                    ? 'bg-rose-50 text-rose-700'
                                                    : 'bg-amber-50 text-amber-700'
                                            }`}>
                                                {inv.status?.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="p-4 text-[#667085]">
                                            {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-xs text-[#667085]">
                                        No invoices recorded for this restaurant yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* TAB CONTENT: Activity */}
            {activeTab === 'activity' && (
                <div className="bg-white rounded-2xl p-6 border border-[#E4E7EC] shadow-2xs space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-extrabold text-[#172033]">Organization Audit Stream</h3>
                            <p className="text-xs text-[#667085] mt-0.5">
                                Granular activity ledger for this restaurant location and staff.
                            </p>
                        </div>
                        <span className="text-xs font-mono text-neutral-400">{auditLogs.length} events</span>
                    </div>

                    <div className="divide-y divide-[#E4E7EC]">
                        {auditLogs.length > 0 ? (
                            auditLogs.map((log: any) => {
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
                            <p className="py-8 text-center text-xs text-[#667085] italic">No logged events yet.</p>
                        )}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: Settings & KYC */}
            {activeTab === 'settings' && (
                <div className="bg-white rounded-2xl p-6 border border-[#E4E7EC] space-y-6">
                    <div>
                        <h3 className="text-sm font-extrabold text-[#172033]">Settings & KYC Information</h3>
                        <p className="text-xs text-[#667085]">
                            Founder override for statutory KYC credentials and compliance parameters.
                        </p>
                    </div>

                    <form onSubmit={handleSaveKyc} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div>
                                <label className="font-bold text-[#667085]">Legal Entity Business Name</label>
                                <input
                                    type="text"
                                    value={kycForm.legalBusinessName}
                                    onChange={(e) => setKycForm(prev => ({ ...prev, legalBusinessName: e.target.value }))}
                                    className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-[#172033] font-medium"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-[#667085]">Business Constitution</label>
                                <select
                                    value={kycForm.businessConstitution}
                                    onChange={(e) => setKycForm(prev => ({ ...prev, businessConstitution: e.target.value }))}
                                    className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-[#172033] font-medium"
                                >
                                    <option value="Private Limited">Private Limited</option>
                                    <option value="Partnership">Partnership</option>
                                    <option value="Sole Proprietorship">Sole Proprietorship</option>
                                    <option value="LLP">LLP</option>
                                </select>
                            </div>
                            <div>
                                <label className="font-bold text-[#667085]">GST Number</label>
                                <input
                                    type="text"
                                    value={kycForm.gstNumber}
                                    onChange={(e) => setKycForm(prev => ({ ...prev, gstNumber: e.target.value }))}
                                    className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-[#172033] font-medium font-mono"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-[#667085]">FSSAI License Number</label>
                                <input
                                    type="text"
                                    value={kycForm.fssaiNumber}
                                    onChange={(e) => setKycForm(prev => ({ ...prev, fssaiNumber: e.target.value }))}
                                    className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-[#172033] font-medium font-mono"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-[#667085]">PAN Number</label>
                                <input
                                    type="text"
                                    value={kycForm.panNumber}
                                    onChange={(e) => setKycForm(prev => ({ ...prev, panNumber: e.target.value }))}
                                    className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-[#172033] font-medium font-mono"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-[#667085]">Shop & Establishment License</label>
                                <input
                                    type="text"
                                    value={kycForm.shopLicense}
                                    onChange={(e) => setKycForm(prev => ({ ...prev, shopLicense: e.target.value }))}
                                    className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-[#172033] font-medium"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                type="submit"
                                disabled={savingKyc}
                                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
                            >
                                <Save size={14} />
                                <span>{savingKyc ? 'Saving...' : 'Save KYC & Statutory Settings'}</span>
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* EDIT RESTAURANT DETAILS MODAL */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-[#E4E7EC] shadow-2xl space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                                    <Edit3 size={18} />
                                </div>
                                <h2 className="text-base font-black text-[#172033]">Edit Restaurant Details</h2>
                            </div>
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100 cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
                            <div>
                                <label className="font-bold text-[#667085]">Brand / Restaurant Name</label>
                                <input
                                    type="text"
                                    required
                                    value={editForm.name}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                    className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-[#172033] font-medium"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-[#667085]">Owner Contact Name</label>
                                <input
                                    type="text"
                                    value={editForm.ownerName}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, ownerName: e.target.value }))}
                                    className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-[#172033] font-medium"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-bold text-[#667085]">Official Phone</label>
                                    <input
                                        type="tel"
                                        value={editForm.phone}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                                        className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-[#172033] font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-[#667085]">Official Email</label>
                                    <input
                                        type="email"
                                        value={editForm.email}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                                        className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-[#172033] font-medium"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="font-bold text-[#667085]">Registered Office Address</label>
                                <textarea
                                    rows={3}
                                    value={editForm.address}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                                    className="mt-1 w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-[#172033] font-medium"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E4E7EC]">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="px-4 py-2 border border-[#E4E7EC] rounded-xl font-bold text-[#667085] hover:bg-neutral-50 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer shadow-xs disabled:opacity-50"
                                >
                                    {actionLoading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CONFIRMATION MODAL */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-[#E4E7EC] shadow-2xl space-y-5">
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-2xl ${
                                confirmModal.confirmVariant === 'danger'
                                    ? 'bg-rose-50 text-rose-600'
                                    : confirmModal.confirmVariant === 'warning'
                                    ? 'bg-amber-50 text-amber-600'
                                    : 'bg-indigo-50 text-indigo-600'
                            }`}>
                                <AlertTriangle size={20} />
                            </div>
                            <h3 className="text-base font-black text-[#172033]">{confirmModal.title}</h3>
                        </div>

                        <p className="text-xs text-[#667085] leading-relaxed">
                            {confirmModal.message}
                        </p>

                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E4E7EC]">
                            <button
                                type="button"
                                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                                className="px-4 py-2 border border-[#E4E7EC] rounded-xl text-xs font-bold text-[#667085] hover:bg-neutral-50 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => {
                                    if (confirmModal.type === 'suspend') handleStatusTransition('SUSPENDED');
                                    else if (confirmModal.type === 'activate') handleStatusTransition('ACTIVE');
                                    else if (confirmModal.type === 'restore') handleStatusTransition('ACTIVE');
                                    else if (confirmModal.type === 'soft_delete') handleSoftDelete();
                                    else if (confirmModal.type === 'permanent_delete') handlePermanentDelete();
                                }}
                                className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer shadow-xs disabled:opacity-50 text-white ${
                                    confirmModal.confirmVariant === 'danger'
                                        ? 'bg-rose-600 hover:bg-rose-700'
                                        : confirmModal.confirmVariant === 'warning'
                                        ? 'bg-amber-600 hover:bg-amber-700'
                                        : 'bg-indigo-600 hover:bg-indigo-700'
                                }`}
                            >
                                {actionLoading ? 'Processing...' : confirmModal.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
