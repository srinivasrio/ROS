'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useOwner } from '@/context/OwnerContext';
import {
    Building2, Plus, Search, MapPin, Phone, Mail, Clock,
    MoreHorizontal, Edit, ToggleLeft, ToggleRight, Eye, EyeOff,
    Users, ShoppingBag, TrendingUp, ChevronRight, X, Check,
    ShieldCheck, AlertTriangle, UserCheck, Key, Sparkles, Trash2,
    Copy, ExternalLink, Shield, Star, IndianRupee, CreditCard, ArrowRight,
    CheckCircle2, FileText, Sliders, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { showWarningPopup } from '@/components/shared/WarningPopupCard';

interface BranchFormData {
    name: string;
    code: string;
    phone: string;
    email: string;
    address: string;
    planSlug: string;
    paymentMethod: string;
    paymentReference: string;
    // Admin details
    assignAdmin: boolean;
    adminId?: string;
    adminName: string;
    adminEmail: string;
    adminMobile: string;
    adminPassword: string;
    adminPin: string;
}

export default function BranchesPage() {
    const { branches, setBranches, restaurant, selectedRestaurantId, isAllRestaurants, setSelectedRestaurant } = useOwner();
    const [admins, setAdmins] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showPin, setShowPin] = useState(false);
    const [branchLimits, setBranchLimits] = useState<{
        planSlug?: string;
        planName?: string;
        planLimit?: number;
        customQuota?: number | null;
        effectiveLimit?: number;
        currentCount: number;
        remainingSlots: number;
        canCreate?: boolean;
        quotaSource?: string;
        status: string;
        maxAllowed?: number;
    } | null>(null);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [showLimitWarningModal, setShowLimitWarningModal] = useState(false);

    // Modal state for viewing admin credentials in a focused, clean modal
    const [credentialsModalBranch, setCredentialsModalBranch] = useState<any | null>(null);
    const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
    const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const togglePasswordMask = (branchId: string) => {
        setRevealedPasswords(prev => ({ ...prev, [branchId]: !prev[branchId] }));
    };

    const togglePinMask = (branchId: string) => {
        setRevealedPins(prev => ({ ...prev, [branchId]: !prev[branchId] }));
    };

    const copyText = (text: string, label: string, key?: string) => {
        if (!text) {
            toast.error(`No ${label} configured yet`);
            return;
        }
        navigator.clipboard.writeText(text);
        if (key) {
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(null), 2000);
        }
        toast.success(`${label} copied to clipboard!`);
    };

    const copyAllCredentials = (branch: any, admin: any) => {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const restId = branch.restaurant_id || branch.id;
        const text = `🍽️ RESTAURANT ADMIN CREDENTIALS
Restaurant: ${branch.name}
Restaurant ID: ${restId}
Branch Code: ${branch.code || branch.id}
Admin Name: ${admin?.name || 'Admin'}
Login Identifier (Email/Mobile): ${admin?.email || admin?.mobile || 'N/A'}
Password: ${admin?.adminPassword || admin?.password || '(Click Edit in Owner Panel to set)'}
Security PIN: ${admin?.adminPin || admin?.pin || '(Click Edit in Owner Panel to set)'}
Admin Login URL: ${origin}/admin/login
----------------------------------------
* Compulsory Requirements: Identifier + Password + Security PIN (all 3 required to log in)`;

        navigator.clipboard.writeText(text);
        toast.success('All credentials copied! Ready to share with restaurant manager.');
    };

    // Delete Branch State
    const [branchToDelete, setBranchToDelete] = useState<any | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const handleDeleteBranch = async () => {
        if (!branchToDelete) return;
        setDeleteLoading(true);
        try {
            const res = await fetch(`/api/owner/branches?id=${branchToDelete.id}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(data.message || 'Branch deleted successfully');
                setBranchToDelete(null);
                await fetchBranches();
            } else {
                toast.error(data.error || 'Failed to delete branch');
            }
        } catch (err: any) {
            toast.error(err.message || 'Network error deleting branch');
        } finally {
            setDeleteLoading(false);
        }
    };

    // Mark as Main Branch State & Handler
    const [settingMainId, setSettingMainId] = useState<string | null>(null);

    const handleSetMainBranch = async (branchId: string) => {
        try {
            setSettingMainId(branchId);
            const res = await fetch('/api/owner/branches', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: branchId })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to update main branch');
            }

            toast.success(data.message || 'Main branch updated successfully');

            // Optimistically update local branches state
            setBranches(branches.map(b => ({
                ...b,
                is_main_branch: b.id === branchId || b.restaurant_id === branchId
            })));

            await fetchBranches();
        } catch (err: any) {
            console.error('Error setting main branch:', err);
            toast.error(err.message || 'Network error setting main branch');
        } finally {
            setSettingMainId(null);
        }
    };

    const [formData, setFormData] = useState<BranchFormData>({
        name: '',
        code: '',
        phone: '',
        email: '',
        address: '',
        planSlug: 'standard',
        paymentMethod: 'UPI',
        paymentReference: '',
        assignAdmin: false,
        adminName: '',
        adminEmail: '',
        adminMobile: '',
        adminPassword: '',
        adminPin: ''
    });
    const [editingBranch, setEditingBranch] = useState<any>(null);

    // Dedicated Assign Admin Modal State for approved/active branches
    const [assigningAdminBranch, setAssigningAdminBranch] = useState<any | null>(null);
    const [assignAdminData, setAssignAdminData] = useState({
        adminName: '',
        adminEmail: '',
        adminMobile: '',
        adminPassword: '',
        adminPin: ''
    });
    const [assignAdminLoading, setAssignAdminLoading] = useState(false);
    const [showAssignPassword, setShowAssignPassword] = useState(false);
    const [showAssignPin, setShowAssignPin] = useState(false);

    const handleOpenAssignAdmin = (branch: any) => {
        const isActive = (branch.status || '').toLowerCase() === 'active';
        if (!isActive) {
            showWarningPopup({
                title: 'Admin Assignment Prohibited',
                message: 'Admin assignment is prohibited: Restaurant/Branch must be approved and ACTIVE by Super Admin before assigning staff.',
                type: 'restriction',
                dismissText: 'Dismiss'
            });
            return;
        }
        setAssigningAdminBranch(branch);
        setAssignAdminData({
            adminName: '',
            adminEmail: '',
            adminMobile: '',
            adminPassword: '',
            adminPin: ''
        });
    };

    const handleSaveAssignAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assigningAdminBranch) return;

        const isActive = (assigningAdminBranch.status || '').toLowerCase() === 'active';
        if (!isActive) {
            showWarningPopup({
                title: 'Admin Assignment Prohibited',
                message: 'Admin assignment is prohibited while branch status is PENDING_APPROVAL or REJECTED.',
                type: 'restriction',
                dismissText: 'Dismiss'
            });
            return;
        }

        if (!assignAdminData.adminName.trim()) {
            toast.error('Admin Full Name is required');
            return;
        }
        if (!assignAdminData.adminEmail.trim() && !assignAdminData.adminMobile.trim()) {
            toast.error('Admin Email or Mobile is required for login');
            return;
        }
        if (!assignAdminData.adminPassword.trim()) {
            toast.error('Password is required for Restaurant Admin login');
            return;
        }
        if (!assignAdminData.adminPin.trim() || assignAdminData.adminPin.trim().length < 4) {
            toast.error('Security PIN must be at least 4 digits');
            return;
        }

        setAssignAdminLoading(true);
        try {
            const res = await fetch('/api/owner/branches', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: assigningAdminBranch.id,
                    assignAdmin: true,
                    adminName: assignAdminData.adminName.trim(),
                    adminEmail: assignAdminData.adminEmail.trim(),
                    adminMobile: assignAdminData.adminMobile.trim(),
                    adminPassword: assignAdminData.adminPassword.trim(),
                    adminPin: assignAdminData.adminPin.trim()
                })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to assign restaurant admin');
            }

            toast.success('Restaurant Admin assigned successfully! Admin can now log in at /admin/login.');
            setAssigningAdminBranch(null);
            await fetchBranches();
        } catch (err: any) {
            toast.error(err.message || 'Failed to assign admin');
        } finally {
            setAssignAdminLoading(false);
        }
    };

    const fetchBranches = async () => {
        try {
            const res = await fetch('/api/owner/branches');
            if (res.ok) {
                const data = await res.json();
                if (data.branches) setBranches(data.branches);
                if (data.branchLimits) setBranchLimits(data.branchLimits);
                if (data.pendingRequests) setPendingRequests(data.pendingRequests);
                if (data.admins) setAdmins(data.admins);
            }
        } catch (err) {
            console.error('Failed to load branches:', err);
        }
    };

    useEffect(() => {
        fetchBranches();
    }, []);

    // Filter branches based on search and top bar selectedRestaurantId
    const filtered = branches.filter(b => {
        const matchesSearch = b.name?.toLowerCase().includes(search.toLowerCase()) ||
            (b.code && b.code.toLowerCase().includes(search.toLowerCase())) ||
            (b.id && b.id.toLowerCase().includes(search.toLowerCase()));

        if (!isAllRestaurants && selectedRestaurantId && selectedRestaurantId !== 'all') {
            const matchesSelected = b.id === selectedRestaurantId || b.restaurant_id === selectedRestaurantId;
            return matchesSearch && matchesSelected;
        }
        return matchesSearch;
    });

    const hasNoSubscription = branchLimits?.planSlug === 'none' || (!branchLimits?.planSlug && (branchLimits?.effectiveLimit || 0) === 0);
    const isLimitReached = branchLimits
        ? (!hasNoSubscription && (branchLimits.canCreate === false || branchLimits.remainingSlots <= 0))
        : false;
    const selectedBranchObj = !isAllRestaurants && selectedRestaurantId !== 'all'
        ? branches.find(b => b.id === selectedRestaurantId || b.restaurant_id === selectedRestaurantId)
        : null;

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error('Restaurant / Branch name is required');
            return;
        }

        // Only validate admin fields when editing an existing approved branch with admin assignment
        if (editingBranch) {
            const isEditingActive = (editingBranch.status || '').toLowerCase() === 'active';
            if (formData.assignAdmin && !isEditingActive) {
                showWarningPopup({
                    title: 'Admin Assignment Prohibited',
                    message: 'Admin assignment is prohibited: Branch must be approved and ACTIVE by Super Admin.',
                    type: 'restriction',
                    dismissText: 'Dismiss'
                });
                return;
            }

            if (formData.assignAdmin) {
                const hasExistingAdmin = Boolean(
                    formData.adminId ||
                    editingBranch?.adminId ||
                    editingBranch?.adminEmail ||
                    editingBranch?.adminMobile
                );
                if (!hasExistingAdmin) {
                    if (!formData.adminEmail?.trim() && !formData.adminMobile?.trim()) {
                        toast.error('Admin Email or Mobile is required to assign admin credentials');
                        return;
                    }
                    if (!formData.adminPassword?.trim()) {
                        toast.error('Password is required for Restaurant Admin login');
                        return;
                    }
                    if (!formData.adminPin?.trim()) {
                        toast.error('Security PIN (4-6 digits) is required for Restaurant Admin login');
                        return;
                    }
                }
                if (formData.adminPin?.trim() && formData.adminPin.trim().length < 4) {
                    toast.error('Security PIN must be at least 4 digits');
                    return;
                }
            }
        }

        setLoading(true);
        try {
            const payload: any = editingBranch
                ? {
                    ...formData,
                    id: editingBranch?.id,
                }
                : {
                    name: formData.name.trim(),
                    code: formData.code.trim(),
                    phone: formData.phone.trim(),
                    email: formData.email.trim(),
                    address: formData.address.trim(),
                    planSlug: formData.planSlug || 'standard',
                    assignAdmin: false
                };

            const res = await fetch('/api/owner/branches', {
                method: editingBranch ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.error && data.error.toLowerCase().includes('limit')) {
                    setShowAddModal(false);
                    setShowLimitWarningModal(true);
                    return;
                }
                throw new Error(data.error || 'Failed to submit registration request');
            }

            if (editingBranch) {
                toast.success('Branch details updated successfully!');
            } else {
                toast.success('Registration request submitted! Awaiting Super Admin review & activation.');
            }
            setShowAddModal(false);
            setEditingBranch(null);
            setFormData({
                name: '',
                code: '',
                phone: '',
                email: '',
                address: '',
                planSlug: 'standard',
                paymentMethod: 'UPI',
                paymentReference: '',
                assignAdmin: false,
                adminName: '',
                adminEmail: '',
                adminMobile: '',
                adminPassword: '',
                adminPin: ''
            });
            await fetchBranches();
        } catch (err: any) {
            toast.error(err.message || 'Operation failed');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (branch: any) => {
        setEditingBranch(branch);
        const existingAdmin = admins.find(a => 
            ['restaurant_admin', 'admin'].includes(String(a.role || '').toLowerCase()) &&
            (
                a.restaurant_id === (branch.restaurant_id || branch.id) ||
                a.branch_id === (branch.restaurant_id || branch.id) ||
                a.branch_id === branch.branch_id ||
                (branch.adminId && a.id === branch.adminId)
            )
        ) || (branch.is_main_branch || branches.length === 1 ? admins.find(a => ['restaurant_admin', 'admin'].includes(String(a.role || '').toLowerCase()) && !a.restaurant_id && !a.branch_id) : null);

        setFormData({
            name: branch.name || '',
            code: branch.code || '',
            phone: branch.phone || '',
            email: branch.email || '',
            address: typeof branch.address === 'object' ? JSON.stringify(branch.address) : (branch.address || ''),
            planSlug: branch.subscription_plan || 'standard',
            paymentMethod: 'UPI',
            paymentReference: '',
            assignAdmin: true,
            adminId: existingAdmin?.id || '',
            adminName: existingAdmin?.name || (branch.adminName && branch.adminName !== branch.name ? branch.adminName : ''),
            adminEmail: existingAdmin?.email || (branch.adminEmail && branch.adminEmail !== branch.email ? branch.adminEmail : ''),
            adminMobile: existingAdmin?.mobile || '',
            adminPassword: branch.adminPassword || existingAdmin?.adminPassword || existingAdmin?.raw_password || '',
            adminPin: existingAdmin?.raw_pin || branch.adminPin || ''
        });
        setShowAddModal(true);
    };

    const handleToggleStatus = async (branch: any) => {
        const newStatus = (branch.status || '').toLowerCase() === 'active' ? 'inactive' : 'active';
        try {
            const res = await fetch('/api/owner/branches', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: branch.id, status: newStatus }),
            });
            if (res.ok) {
                toast.success(`Branch ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
                setBranches(branches.map(b => b.id === branch.id ? { ...b, status: newStatus } : b));
            } else {
                const d = await res.json();
                toast.error(d.error || 'Status update failed');
            }
        } catch (err) {
            toast.error('Network error updating branch status');
        }
    };

    return (
        <div className="p-6 lg:p-8 space-y-6">
            {/* Header & Limit Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">Branches Management</h2>

                    <p className="text-sm text-neutral-500 mt-0.5 font-medium">
                        {branches.length} total outlets · {branches.filter(b => (b.status || '').toLowerCase() === 'active').length} active
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800/60 border border-neutral-200/60 dark:border-zinc-700/30 rounded-xl w-56 shadow-xs">
                        <Search size={14} className="text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search branches..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-transparent text-xs outline-none w-full text-neutral-700 dark:text-neutral-300 placeholder:text-neutral-400"
                        />
                    </div>
                    <button
                        onClick={() => fetchBranches()}
                        disabled={loading}
                        className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-neutral-200/60 dark:border-zinc-700/30 text-neutral-600 dark:text-neutral-300 hover:text-indigo-600 transition-colors cursor-pointer shadow-xs"
                        title="Refresh branches"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin text-indigo-500" : ""} />
                    </button>
                    <button
                        onClick={() => {
                            if (isLimitReached) {
                                setShowLimitWarningModal(true);
                                return;
                            }
                            setEditingBranch(null);
                            setFormData({
                                name: '',
                                code: '',
                                phone: '',
                                email: '',
                                address: '',
                                planSlug: 'standard',
                                paymentMethod: 'UPI',
                                paymentReference: '',
                                assignAdmin: true,
                                adminName: '',
                                adminEmail: '',
                                adminMobile: '',
                                adminPassword: '',
                                adminPin: ''
                            });
                            setShowAddModal(true);
                        }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
                            isLimitReached
                                ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/60 shadow-amber-500/5'
                                : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-indigo-600/20'
                        }`}
                        title={isLimitReached ? "Branch quota limit reached. Upgrade plan or contact Super Admin." : "Create new independent branch"}
                    >
                        {isLimitReached ? <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400" /> : <Plus size={15} />}
                        <span>Create Restaurant / Branch</span>
                        {isLimitReached && (
                            <span className="ml-1 px-1.5 py-0.5 rounded-md text-[9px] bg-amber-200/90 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-extrabold uppercase">
                                Limit
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Selected Branch Filter Banner */}
            {selectedBranchObj && (
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                            {selectedBranchObj.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <span className="text-xs text-neutral-500">Filtered by Restaurant:</span>
                            <h4 className="text-sm font-black text-indigo-700 dark:text-indigo-300">
                                {selectedBranchObj.name} <span className="font-mono text-xs font-semibold text-neutral-400">({selectedBranchObj.id})</span>
                            </h4>
                        </div>
                    </div>
                    <button
                        onClick={() => setSelectedRestaurant('all')}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 text-xs font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer shadow-2xs"
                    >
                        Show All Outlets ({branches.length})
                    </button>
                </div>
            )}

            {/* BRANCH LIMIT CONTROL CARD */}
            {branchLimits && (
                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-neutral-200/70 dark:border-zinc-800/70 shadow-xs flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                            isLimitReached
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                                : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
                        }`}>
                            <Building2 size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-500">
                                    Subscription Quota ({branchLimits.planName || (hasNoSubscription ? 'No Active Subscription' : 'Standard')})
                                </h3>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    hasNoSubscription
                                        ? 'bg-neutral-100 text-neutral-700 border border-neutral-200 dark:bg-zinc-800 dark:text-zinc-300'
                                        : isLimitReached
                                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}>
                                    {hasNoSubscription ? '0 / 0 Quota' : (isLimitReached ? 'Quota Reached' : `${branchLimits.remainingSlots} Slot${branchLimits.remainingSlots === 1 ? '' : 's'} Available`)}
                                </span>
                                {branchLimits.quotaSource === 'super_admin_override' && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200" title="Super Admin manual quota override">
                                        Super Admin Override: {branchLimits.customQuota}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs font-bold text-neutral-900 dark:text-white mt-0.5">
                                {hasNoSubscription ? (
                                    <span>Using <span className="text-neutral-500">0 of 0</span> authorized restaurant units <span className="text-neutral-400 font-normal ml-1">(Select a subscription plan below when creating your first restaurant)</span></span>
                                ) : (
                                    <>
                                        Using <span className="text-indigo-600 dark:text-indigo-400">{branchLimits.currentCount}</span> of <span className="text-neutral-900 dark:text-white">{branchLimits.effectiveLimit || branchLimits.maxAllowed}</span> authorized restaurant units
                                        <span className="text-neutral-400 font-normal ml-1">
                                            ({branchLimits.quotaSource === 'super_admin_override' ? `Super Admin override: ${branchLimits.customQuota}` : `Plan default: ${branchLimits.planLimit || 1}`})
                                        </span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    {isLimitReached ? (
                        <button
                            type="button"
                            onClick={() => setShowLimitWarningModal(true)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100/80 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 border border-amber-200 dark:border-amber-900/50 text-[11px] font-bold text-amber-800 dark:text-amber-300 transition-colors cursor-pointer"
                        >
                            <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                            <span>Quota reached ({branchLimits.currentCount}/{branchLimits.effectiveLimit || branchLimits.maxAllowed}) · Upgrade / Contact Super Admin</span>
                        </button>
                    ) : (
                        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                            <ShieldCheck size={14} className="text-emerald-500" />
                            <span>Subscription Quota Policy Active</span>
                        </div>
                    )}
                </div>
            )}

            {/* PENDING REGISTRATION REQUESTS SECTION */}
            {(() => {
                const activePending = (pendingRequests || []).filter((req: any) =>
                    ['PENDING_APPROVAL', 'PENDING_PAYMENT', 'PENDING'].includes((req.approval_status || '').toUpperCase())
                );
                if (activePending.length === 0) return null;
                return (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Clock size={16} className="text-amber-500" />
                                <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-wider">
                                    Pending Registration Requests ({activePending.length})
                                </h3>
                            </div>
                            <span className="text-[11px] text-neutral-500">Awaiting Super Admin Verification & Approval</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {activePending.map((req: any) => {
                            const isPendingPayment = req.approval_status === 'PENDING_PAYMENT' || req.payment_status === 'PENDING_PAYMENT';
                            const isPendingApproval = req.approval_status === 'PENDING_APPROVAL';
                            const isApproved = req.approval_status === 'ACTIVE' || req.approval_status === 'APPROVED';
                            const isRejected = req.approval_status === 'REJECTED';

                            return (
                                <div
                                    key={req.id}
                                    className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-amber-200/80 dark:border-amber-900/40 shadow-xs space-y-3"
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-neutral-100 dark:bg-zinc-800 text-neutral-600 dark:text-neutral-400">
                                                    {req.request_number || 'REQ'}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    isApproved
                                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                        : isRejected
                                                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                                        : isPendingPayment
                                                        ? 'bg-orange-100 text-orange-800 border border-orange-200'
                                                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                                                }`}>
                                                    {req.approval_status || 'PENDING'}
                                                </span>
                                            </div>
                                            <h4 className="text-sm font-black text-neutral-900 dark:text-white mt-1.5">
                                                {req.restaurant_name}
                                            </h4>
                                            <p className="text-[11px] font-mono text-neutral-400">
                                                ID: {req.restaurant_id}
                                            </p>
                                        </div>

                                        <div className="text-right">
                                            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                                                {req.plan_name || req.plan_slug}
                                            </span>
                                            <p className="text-xs font-black text-neutral-900 dark:text-white">
                                                ₹{(Number(req.amount_due) || 999).toLocaleString('en-IN')}/mo
                                            </p>
                                        </div>
                                    </div>

                                    <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-zinc-800/50 text-[11px] space-y-1">
                                        <div className="flex justify-between">
                                            <span className="text-neutral-400">Payment Ref / UTR:</span>
                                            <span className="font-mono font-bold text-neutral-700 dark:text-neutral-300">
                                                {req.payment_reference || 'Pending'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-neutral-400">Payment Status:</span>
                                            <span className="font-bold text-neutral-700 dark:text-neutral-300">
                                                {req.payment_status || 'PENDING'}
                                            </span>
                                        </div>
                                        {req.super_admin_notes && (
                                            <div className="pt-1 border-t border-neutral-200/60 dark:border-zinc-700/60 text-amber-700 dark:text-amber-400">
                                                <span className="font-bold">Admin Note: </span>
                                                {req.super_admin_notes}
                                            </div>
                                        )}
                                        {req.admin_password && (
                                            <div className="pt-1.5 border-t border-neutral-200/60 dark:border-zinc-700/60 flex items-center justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                                                        Admin Password:
                                                    </span>
                                                    <span className="font-mono text-xs font-bold text-neutral-800 dark:text-neutral-200 truncate mt-0.5 block">
                                                        {revealedPasswords[req.id] ? (
                                                            <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{req.admin_password}</span>
                                                        ) : (
                                                            <span className="tracking-widest text-neutral-400 select-none">••••••••••••</span>
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => togglePasswordMask(req.id)}
                                                        className="p-1 rounded-md bg-white dark:bg-zinc-700 text-neutral-600 dark:text-neutral-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                                                        title={revealedPasswords[req.id] ? "Hide password" : "Show password"}
                                                        aria-label={revealedPasswords[req.id] ? "Hide password" : "Show password"}
                                                    >
                                                        {revealedPasswords[req.id] ? <EyeOff size={12} className="text-indigo-600 dark:text-indigo-400" /> : <Eye size={12} />}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => copyText(req.admin_password, 'Password', `req-pass-${req.id}`)}
                                                        className="p-1 rounded-md bg-white dark:bg-zinc-700 text-neutral-600 dark:text-neutral-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                                                        title="Copy password"
                                                        aria-label="Copy password"
                                                    >
                                                        {copiedKey === `req-pass-${req.id}` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <p className="text-[11px] text-amber-700 dark:text-amber-300/90 leading-tight">
                                        {isApproved
                                            ? '✓ Approved and active. You can now manage this outlet.'
                                            : isPendingPayment
                                            ? '⚠️ Payment pending. Please transfer subscription fee and provide reference to Super Admin.'
                                            : '⏳ Awaiting Super Admin approval. Restaurant & Admin login will activate once verified.'}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
                );
            })()}

            {/* Branch Grid */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 px-6 bg-white dark:bg-zinc-900 rounded-3xl border border-neutral-200/50 dark:border-zinc-800/50 space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-xs">
                        <Building2 size={28} />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-neutral-800 dark:text-white">
                            {branches.length === 0 ? "No Restaurants Yet" : "No branches found"}
                        </h3>
                        <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1 leading-relaxed">
                            {branches.length === 0 
                                ? "Your owner account is approved and active! Create your first restaurant branch below to start configuring tables, menus, and staff."
                                : (selectedBranchObj ? "Try selecting 'All Restaurants' or creating a new branch." : "No branches match your current search query.")}
                        </p>
                    </div>
                    <div>
                        <button
                            type="button"
                            onClick={() => {
                                setEditingBranch(null);
                                setShowAddModal(true);
                            }}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                        >
                            <Plus size={16} />
                            <span>{branches.length === 0 ? "Create Your First Restaurant" : "Add Branch"}</span>
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filtered.map((branch, i) => {
                        const isActive = (branch.status || '').toLowerCase() === 'active';
                        const assignedAdmin = admins.find(a => 
                            ['restaurant_admin', 'admin'].includes(String(a.role || '').toLowerCase()) &&
                            (
                                a.restaurant_id === (branch.restaurant_id || branch.id) ||
                                a.branch_id === (branch.restaurant_id || branch.id) ||
                                a.branch_id === branch.branch_id ||
                                (branch.adminId && a.id === branch.adminId)
                            )
                        ) || (branch.is_main_branch || branches.length === 1 ? admins.find(a => ['restaurant_admin', 'admin'].includes(String(a.role || '').toLowerCase()) && !a.restaurant_id && !a.branch_id) : null);
                        const adminName = assignedAdmin?.name || (branch.adminName && branch.adminName !== branch.name ? branch.adminName : 'Admin');
                        const adminEmail = assignedAdmin?.email || (branch.adminEmail && branch.adminEmail !== branch.email ? branch.adminEmail : '');
                        const adminMobile = assignedAdmin?.mobile || (branch.adminMobile && branch.adminMobile !== branch.phone ? branch.adminMobile : '');
                        const adminPassword = assignedAdmin?.adminPassword || branch.adminPassword || '';
                        const adminPin = assignedAdmin?.adminPin || branch.adminPin || assignedAdmin?.pin || '';
                        const hasAdmin = Boolean(
                            assignedAdmin?.email || 
                            assignedAdmin?.mobile || 
                            (branch.adminEmail && branch.adminEmail !== branch.email) || 
                            (branch.adminMobile && branch.adminMobile !== branch.phone) ||
                            adminPassword
                        );
                        const isPasswordShown = Boolean(revealedPasswords[branch.id]);
                        const isPinShown = Boolean(revealedPins[branch.id]);

                        return (
                            <motion.div
                                key={branch.id}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="bg-white dark:bg-zinc-900 rounded-3xl border border-neutral-200/70 dark:border-zinc-800/70 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                            >
                                <div className="p-6 space-y-4">
                                    {/* Card Header: Avatar, Name, Code/ID, and Badges */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-black text-lg shrink-0 shadow-sm shadow-indigo-500/20">
                                                {branch.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-base font-black text-neutral-900 dark:text-white truncate">
                                                    {branch.name}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[11px] font-mono text-neutral-500">
                                                        Code: <span className="font-semibold text-neutral-700 dark:text-neutral-300">{branch.code || branch.id}</span>
                                                    </span>
                                                    <span className="text-neutral-300 dark:text-zinc-700">•</span>
                                                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50 text-[10px] font-mono font-bold">
                                                        <span>ID: {branch.restaurant_id || branch.id}</span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                copyText(String(branch.restaurant_id || branch.id), 'Restaurant ID', `rest-id-${branch.id}`);
                                                            }}
                                                            className="hover:text-indigo-900 dark:hover:text-white text-indigo-500 transition-colors cursor-pointer"
                                                            title="Copy Restaurant ID"
                                                        >
                                                            {copiedKey === `rest-id-${branch.id}` ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                                            {branch.is_main_branch && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 shadow-2xs">
                                                    <Star size={11} className="fill-amber-500 text-amber-500" />
                                                    Main Branch
                                                </span>
                                            )}
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                                                isActive
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                    : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
                                            }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                                                {isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Structured Branch Details Grid */}
                                    <div className="p-3 rounded-2xl bg-neutral-50/70 dark:bg-zinc-800/40 border border-neutral-100 dark:border-zinc-800 space-y-2 text-xs text-neutral-600 dark:text-neutral-300">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="flex items-center gap-2 text-neutral-400 shrink-0">
                                                <Phone size={13} />
                                                <span className="text-[11px] font-medium">Contact:</span>
                                            </span>
                                            <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                                                {branch.phone || 'Not provided'}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between gap-2">
                                            <span className="flex items-center gap-2 text-neutral-400 shrink-0">
                                                <Mail size={13} />
                                                <span className="text-[11px] font-medium">Email:</span>
                                            </span>
                                            <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate max-w-[200px]">
                                                {branch.email || 'Not provided'}
                                            </span>
                                        </div>

                                        <div className="flex items-start justify-between gap-2 pt-1 border-t border-neutral-200/50 dark:border-zinc-700/40">
                                            <span className="flex items-center gap-2 text-neutral-400 shrink-0 mt-0.5">
                                                <MapPin size={13} />
                                                <span className="text-[11px] font-medium">Address:</span>
                                            </span>
                                            <span className="text-right text-[11px] text-neutral-500 line-clamp-2 max-w-[220px]">
                                                {typeof branch.address === 'string' ? branch.address : (branch.address ? JSON.stringify(branch.address) : 'No address specified')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Admin Summary Section with Password and Revealing Eye Button */}
                                    {hasAdmin ? (
                                        <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/70 dark:border-indigo-900/30 space-y-2.5">
                                            {/* Top row: Admin info & modal/edit buttons */}
                                            <div className="flex items-center justify-between gap-2.5">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                                        <UserCheck size={15} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                                                                {adminName}
                                                            </span>
                                                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-indigo-100/80 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                                                                Admin
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-neutral-400 font-mono truncate">
                                                            {adminEmail || adminMobile || 'No login identifier'}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => setCredentialsModalBranch(branch)}
                                                        className="px-2 py-1.5 rounded-xl bg-white dark:bg-zinc-800 hover:bg-neutral-100 dark:hover:bg-zinc-700 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/50 text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1 shrink-0"
                                                        title="View all restaurant admin credentials and login link"
                                                    >
                                                        <Key size={12} />
                                                        <span>Credentials</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEdit(branch)}
                                                        className="p-1.5 rounded-xl bg-white dark:bg-zinc-800 hover:bg-neutral-100 dark:hover:bg-zinc-700 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-zinc-700 text-xs font-bold transition-all cursor-pointer"
                                                        title="Edit Admin Credentials"
                                                    >
                                                        <Edit size={12} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Password Display with Revealing Eye Button */}
                                            <div className="pt-2 border-t border-indigo-100/70 dark:border-indigo-900/40 space-y-1.5">
                                                <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-zinc-900 border border-indigo-100/80 dark:border-zinc-800 shadow-2xs">
                                                    <div className="min-w-0 flex-1">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                                                            <Key size={10} className="text-indigo-500 shrink-0" />
                                                            <span>Password</span>
                                                        </span>
                                                        <div className="text-xs font-mono font-bold text-neutral-900 dark:text-white truncate mt-0.5">
                                                            {adminPassword ? (
                                                                isPasswordShown ? (
                                                                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold tracking-normal">
                                                                        {adminPassword}
                                                                    </span>
                                                                ) : (
                                                                    <span className="tracking-widest text-neutral-400 select-none">••••••••••••</span>
                                                                )
                                                            ) : (
                                                                <span className="text-neutral-400 font-normal italic text-[11px]">
                                                                    (Not configured)
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1 shrink-0">
                                                        {adminPassword ? (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        togglePasswordMask(branch.id);
                                                                    }}
                                                                    className="p-1.5 rounded-lg bg-neutral-50 dark:bg-zinc-800 text-neutral-600 dark:text-neutral-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-zinc-700 border border-neutral-200/70 dark:border-zinc-700 transition-colors cursor-pointer"
                                                                    title={isPasswordShown ? "Hide password" : "Show password"}
                                                                    aria-label={isPasswordShown ? "Hide password" : "Show password"}
                                                                >
                                                                    {isPasswordShown ? (
                                                                        <EyeOff size={13} className="text-indigo-600 dark:text-indigo-400" />
                                                                    ) : (
                                                                        <Eye size={13} />
                                                                    )}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        copyText(adminPassword, 'Password', `card-pass-${branch.id}`);
                                                                    }}
                                                                    className="p-1.5 rounded-lg bg-neutral-50 dark:bg-zinc-800 text-neutral-600 dark:text-neutral-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-zinc-700 border border-neutral-200/70 dark:border-zinc-700 transition-colors cursor-pointer"
                                                                    title="Copy password"
                                                                    aria-label="Copy password"
                                                                >
                                                                    {copiedKey === `card-pass-${branch.id}` ? (
                                                                        <Check size={13} className="text-emerald-500" />
                                                                    ) : (
                                                                        <Copy size={13} />
                                                                    )}
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleEdit(branch)}
                                                                className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold border border-indigo-200/50 transition-colors cursor-pointer"
                                                            >
                                                                Set
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Security PIN Display if available */}
                                                {adminPin && (
                                                    <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl bg-white/60 dark:bg-zinc-900/60 border border-neutral-100 dark:border-zinc-800/80">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                                                Security PIN:
                                                            </span>
                                                            <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                                {isPinShown ? adminPin : '••••'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    togglePinMask(branch.id);
                                                                }}
                                                                className="p-1 rounded-md text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                                                                title={isPinShown ? "Hide PIN" : "Show PIN"}
                                                                aria-label={isPinShown ? "Hide PIN" : "Show PIN"}
                                                            >
                                                                {isPinShown ? <EyeOff size={12} className="text-indigo-600" /> : <Eye size={12} />}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    copyText(adminPin, 'Security PIN', `card-pin-${branch.id}`);
                                                                }}
                                                                className="p-1 rounded-md text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                                                                title="Copy Security PIN"
                                                                aria-label="Copy Security PIN"
                                                            >
                                                                {copiedKey === `card-pin-${branch.id}` ? (
                                                                    <Check size={12} className="text-emerald-500" />
                                                                ) : (
                                                                    <Copy size={12} />
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : isActive ? (
                                        <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 space-y-2.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold shrink-0">
                                                    <UserCheck size={16} />
                                                </div>
                                                <div>
                                                    <h5 className="text-xs font-black text-amber-900 dark:text-amber-200">
                                                        Activated · Assign Restaurant Admin
                                                    </h5>
                                                    <p className="text-[10px] text-amber-700 dark:text-amber-300">
                                                        Super Admin approved this outlet. Assign an admin to manage operations.
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenAssignAdmin(branch)}
                                                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                                            >
                                                <UserCheck size={14} />
                                                <span>Assign Restaurant Admin</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-zinc-800/40 border border-neutral-200/60 dark:border-zinc-700/40 flex items-center justify-between text-xs text-neutral-400">
                                            <span className="flex items-center gap-1.5 text-[11px]">
                                                <Clock size={13} className="text-amber-500" />
                                                <span>Awaiting Super Admin Approval</span>
                                            </span>
                                            <span className="text-[10px] font-bold text-neutral-400 bg-neutral-100 dark:bg-zinc-700 px-2 py-0.5 rounded">
                                                Admin Locked
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Structured Footer Actions */}
                                <div className="p-4 bg-neutral-50/80 dark:bg-zinc-800/40 border-t border-neutral-100 dark:border-zinc-800 flex items-center gap-2">
                                    {branch.is_main_branch ? (
                                        <div className="flex-1 py-2 px-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center justify-center gap-1.5 select-none shadow-2xs">
                                            <Star size={13} className="fill-amber-500 text-amber-500" /> Main Branch
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => handleSetMainBranch(branch.id)}
                                            disabled={settingMainId === branch.id}
                                            title="Mark this branch as the Main Branch for your account"
                                            className="flex-1 py-2 px-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:text-amber-700 dark:hover:text-amber-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                                        >
                                            <Star size={13} className={settingMainId === branch.id ? "animate-spin text-amber-500" : "text-neutral-400"} />
                                            {settingMainId === branch.id ? 'Setting...' : 'Set as Main'}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleEdit(branch)}
                                        className="py-2 px-3 rounded-xl bg-white dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                                        title="Edit branch details and admin credentials"
                                    >
                                        <Edit size={13} /> Edit
                                    </button>
                                    <button
                                        onClick={() => handleToggleStatus(branch)}
                                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${
                                            isActive
                                                ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                        }`}
                                        title={isActive ? "Deactivate branch" : "Activate branch"}
                                    >
                                        {isActive ? <><ToggleRight size={13} /> Deactivate</> : <><ToggleLeft size={13} /> Activate</>}
                                    </button>
                                    <button
                                        onClick={() => setBranchToDelete(branch)}
                                        disabled={branch.is_main_branch}
                                        title={branch.is_main_branch ? "Main branch cannot be deleted. Mark another branch as Main first." : "Delete branch outlet"}
                                        className="py-2 px-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-900/40 text-xs font-bold transition-colors flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* DEDICATED ADMIN CREDENTIALS MODAL */}
            <AnimatePresence>
                {credentialsModalBranch && (() => {
                    const branch = credentialsModalBranch;
                    const assignedAdmin = admins.find(a => 
                        ['restaurant_admin', 'admin'].includes(String(a.role || '').toLowerCase()) &&
                        (
                            a.restaurant_id === (branch.restaurant_id || branch.id) ||
                            a.branch_id === (branch.restaurant_id || branch.id) ||
                            a.branch_id === branch.branch_id ||
                            (branch.adminId && a.id === branch.adminId)
                        )
                    ) || (branch.is_main_branch || branches.length === 1 ? admins.find(a => ['restaurant_admin', 'admin'].includes(String(a.role || '').toLowerCase()) && !a.restaurant_id && !a.branch_id) : null);
                    const adminName = assignedAdmin?.name || (branch.adminName && branch.adminName !== branch.name ? branch.adminName : 'Admin');
                    const adminEmail = assignedAdmin?.email || (branch.adminEmail && branch.adminEmail !== branch.email ? branch.adminEmail : '');
                    const adminMobile = assignedAdmin?.mobile || (branch.adminMobile && branch.adminMobile !== branch.phone ? branch.adminMobile : '');
                    const adminPassword = assignedAdmin?.adminPassword || branch.adminPassword || '';
                    const adminPin = assignedAdmin?.adminPin || branch.adminPin || assignedAdmin?.pin || '';
                    const isPasswordShown = revealedPasswords[branch.id];
                    const isPinShown = revealedPins[branch.id];

                    return (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                                className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl border border-neutral-200/80 dark:border-zinc-800 shadow-2xl overflow-hidden"
                            >
                                <div className="p-6 border-b border-neutral-100 dark:border-zinc-800 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                                            <Shield size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-black text-neutral-900 dark:text-white">Admin Credentials</h3>
                                            <p className="text-xs text-neutral-400">{branch.name} · ID: {branch.restaurant_id || branch.id}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setCredentialsModalBranch(null)}
                                        className="w-8 h-8 rounded-xl bg-neutral-100 dark:bg-zinc-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-white flex items-center justify-center cursor-pointer"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                <div className="p-6 space-y-4">
                                    {/* Restaurant ID */}
                                    <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-zinc-800/40 border border-neutral-200/60 dark:border-zinc-700/40 flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Restaurant ID</p>
                                            <p className="text-sm font-mono font-bold text-neutral-800 dark:text-neutral-200">{branch.restaurant_id || branch.id}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => copyText(String(branch.restaurant_id || branch.id), 'Restaurant ID', 'modal-rest-id')}
                                            className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 text-neutral-600 dark:text-neutral-300 hover:text-indigo-600 text-xs font-bold border border-neutral-200 dark:border-zinc-700 flex items-center gap-1 cursor-pointer"
                                        >
                                            {copiedKey === 'modal-rest-id' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                            <span>Copy</span>
                                        </button>
                                    </div>

                                    {/* Login Identifier */}
                                    <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-zinc-800/40 border border-neutral-200/60 dark:border-zinc-700/40 flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Login Identifier (Email / Mobile)</p>
                                            <p className="text-sm font-mono font-bold text-neutral-800 dark:text-neutral-200">{adminEmail || adminMobile || 'N/A'}</p>
                                        </div>
                                        {(adminEmail || adminMobile) && (
                                            <button
                                                type="button"
                                                onClick={() => copyText(adminEmail || adminMobile, 'Identifier', 'modal-ident')}
                                                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 text-neutral-600 dark:text-neutral-300 hover:text-indigo-600 text-xs font-bold border border-neutral-200 dark:border-zinc-700 flex items-center gap-1 cursor-pointer"
                                            >
                                                {copiedKey === 'modal-ident' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                                <span>Copy</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Password */}
                                    <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-zinc-800/40 border border-neutral-200/60 dark:border-zinc-700/40 flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Password</p>
                                            <p className="text-sm font-mono font-bold text-neutral-900 dark:text-white">
                                                {adminPassword ? (isPasswordShown ? adminPassword : '••••••••••••') : '(Not configured)'}
                                            </p>
                                        </div>
                                        {adminPassword && (
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => togglePasswordMask(branch.id)}
                                                    className="p-1.5 rounded-xl bg-white dark:bg-zinc-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-white border border-neutral-200 dark:border-zinc-700 cursor-pointer"
                                                    title={isPasswordShown ? "Mask" : "Show"}
                                                >
                                                    {isPasswordShown ? <EyeOff size={13} /> : <Eye size={13} />}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => copyText(adminPassword, 'Password', 'modal-pass')}
                                                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 text-neutral-600 dark:text-neutral-300 hover:text-indigo-600 text-xs font-bold border border-neutral-200 dark:border-zinc-700 flex items-center gap-1 cursor-pointer"
                                                >
                                                    {copiedKey === 'modal-pass' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                                    <span>Copy</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Security PIN */}
                                    <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-zinc-800/40 border border-neutral-200/60 dark:border-zinc-700/40 flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                                                <span>Security PIN</span>
                                                <span className="text-rose-500">*Compulsory</span>
                                            </p>
                                            <p className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 tracking-widest">
                                                {adminPin ? (isPinShown ? adminPin : '••••••') : '(Not configured)'}
                                            </p>
                                        </div>
                                        {adminPin && (
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => togglePinMask(branch.id)}
                                                    className="p-1.5 rounded-xl bg-white dark:bg-zinc-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-white border border-neutral-200 dark:border-zinc-700 cursor-pointer"
                                                    title={isPinShown ? "Mask" : "Show"}
                                                >
                                                    {isPinShown ? <EyeOff size={13} /> : <Eye size={13} />}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => copyText(adminPin, 'Security PIN', 'modal-pin')}
                                                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 text-neutral-600 dark:text-neutral-300 hover:text-indigo-600 text-xs font-bold border border-neutral-200 dark:border-zinc-700 flex items-center gap-1 cursor-pointer"
                                                >
                                                    {copiedKey === 'modal-pin' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                                    <span>Copy</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Admin Login Link */}
                                    <div className="p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Direct Admin Login</p>
                                            <p className="text-xs font-mono font-semibold text-neutral-700 dark:text-neutral-300">/admin/login</p>
                                        </div>
                                        <a
                                            href="/admin/login"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                                        >
                                            <span>Open Portal</span>
                                            <ExternalLink size={12} />
                                        </a>
                                    </div>
                                </div>

                                <div className="p-6 bg-neutral-50 dark:bg-zinc-800/40 border-t border-neutral-100 dark:border-zinc-800 flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => copyAllCredentials(branch, { name: adminName, email: adminEmail, mobile: adminMobile, adminPassword, adminPin })}
                                        className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-indigo-600/20"
                                    >
                                        <Copy size={13} />
                                        <span>Copy All Credentials</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCredentialsModalBranch(null);
                                            handleEdit(branch);
                                        }}
                                        className="py-2.5 px-4 rounded-xl bg-white dark:bg-zinc-800 hover:bg-neutral-100 dark:hover:bg-zinc-700 text-neutral-700 dark:text-neutral-300 font-bold text-xs border border-neutral-200 dark:border-zinc-700 transition-colors cursor-pointer"
                                    >
                                        Edit Admin
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    );
                })()}
            </AnimatePresence>

            {/* CREATE / EDIT BRANCH MODAL WITH RESTAURANT ADMIN PROVISIONING */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-lg w-full border border-neutral-200 dark:border-zinc-800 shadow-2xl max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-zinc-800">
                                <div>
                                    <h3 className="text-base font-extrabold text-neutral-900 dark:text-white">
                                        {editingBranch ? 'Edit Branch & Admin Credentials' : 'Register New Restaurant / Branch'}
                                    </h3>
                                    {editingBranch ? (
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[11px] font-mono bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/40 px-2 py-0.5 rounded font-bold">
                                                Restaurant ID: {editingBranch.restaurant_id || editingBranch.id}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    copyText(String(editingBranch.restaurant_id || editingBranch.id), 'Restaurant ID');
                                                }}
                                                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-white transition-colors cursor-pointer"
                                                title="Copy Restaurant ID"
                                            >
                                                <Copy size={12} />
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-neutral-500 mt-0.5">
                                            Submit registration request with subscription plan & manual payment
                                        </p>
                                    )}
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 cursor-pointer">
                                    <X size={16} />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="space-y-4 pt-4">
                                {/* STEP 1: RESTAURANT / BRANCH DETAILS */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                                        <Building2 size={14} /> 1. Restaurant / Branch Details
                                    </h4>
                                    <div>
                                        <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Restaurant / Branch Name *</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="e.g. Hyderabad Hitech City Outlet"
                                            className="mt-1 w-full text-xs p-3 bg-neutral-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-indigo-600 font-medium"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Branch Code</label>
                                            <input
                                                type="text"
                                                value={formData.code}
                                                onChange={e => setFormData({ ...formData, code: e.target.value })}
                                                placeholder="e.g. HYD-01"
                                                className="mt-1 w-full text-xs p-3 bg-neutral-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-indigo-600 font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Branch Phone</label>
                                            <input
                                                type="text"
                                                value={formData.phone}
                                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                                placeholder="+91 98765 00000"
                                                className="mt-1 w-full text-xs p-3 bg-neutral-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-indigo-600 font-medium"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Branch Email</label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="branch@restaurant.com"
                                            className="mt-1 w-full text-xs p-3 bg-neutral-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-indigo-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Physical Address</label>
                                        <textarea
                                            value={formData.address}
                                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                                            placeholder="Street, City, Pin Code"
                                            rows={2}
                                            className="mt-1 w-full text-xs p-3 bg-neutral-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-indigo-600 resize-none font-medium"
                                        />
                                    </div>
                                </div>

                                {/* STEP 2: CHOOSE SUBSCRIPTION PLAN (For new registration requests) */}
                                {!editingBranch && (
                                    <div className="pt-3 border-t border-neutral-100 dark:border-zinc-800 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                                                <CreditCard size={14} /> 2. Choose Subscription Plan
                                            </h4>
                                            <span className="text-[10px] text-neutral-400">Monthly billing</span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                            {[
                                                {
                                                    slug: 'standard',
                                                    name: 'Standard',
                                                    price: '₹999',
                                                    limit: '1 Restaurant',
                                                    desc: 'Core POS, QR Dining & Staff',
                                                    popular: false
                                                },
                                                {
                                                    slug: 'growth',
                                                    name: 'Growth',
                                                    price: '₹1,499',
                                                    limit: '1 Restaurant',
                                                    desc: 'Delivery & Inventory Modules',
                                                    popular: true
                                                },
                                                {
                                                    slug: 'pro',
                                                    name: 'Pro',
                                                    price: '₹2,999',
                                                    limit: '2 Restaurants',
                                                    desc: 'Multi-branch (2 units) & Analytics',
                                                    popular: false
                                                }
                                            ].map(plan => {
                                                const isSelected = formData.planSlug === plan.slug;
                                                return (
                                                    <button
                                                        key={plan.slug}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, planSlug: plan.slug })}
                                                        className={`p-3 rounded-2xl border text-left transition-all relative ${
                                                            isSelected
                                                                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20 shadow-xs'
                                                                : 'border-neutral-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-neutral-300'
                                                        }`}
                                                    >
                                                        {plan.popular && (
                                                            <span className="absolute -top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-indigo-600 text-white uppercase tracking-wider">
                                                                Popular
                                                            </span>
                                                        )}
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-black text-neutral-900 dark:text-white">{plan.name}</span>
                                                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{plan.price}<span className="text-[10px] font-normal text-neutral-400">/mo</span></span>
                                                        </div>
                                                        <div className="mt-1 flex items-center gap-1">
                                                            <span className="text-[10px] font-bold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded">
                                                                {plan.limit}
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-neutral-500 mt-1 leading-tight">{plan.desc}</p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* STEP 2 (FOR EDITING APPROVED BRANCHES ONLY): RESTAURANT ADMIN CREDENTIALS */}
                                {editingBranch && (() => {
                                    const isEditingActive = (editingBranch.status || '').toLowerCase() === 'active';
                                    if (!isEditingActive) {
                                        return (
                                            <div className="pt-3 border-t border-neutral-100 dark:border-zinc-800">
                                                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                                                    <AlertTriangle size={15} className="shrink-0 text-amber-600" />
                                                    <span>
                                                        Restaurant admin credentials cannot be assigned while branch status is <strong>{editingBranch.status || 'PENDING'}</strong>. Super Admin approval is required first.
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="pt-3 border-t border-neutral-100 dark:border-zinc-800 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                                                    <UserCheck size={14} /> 2. Restaurant Admin Credentials
                                                </h4>
                                                <label className="flex items-center gap-1.5 text-xs font-bold text-neutral-600 dark:text-neutral-400 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.assignAdmin}
                                                        onChange={e => setFormData({ ...formData, assignAdmin: e.target.checked })}
                                                        className="rounded text-indigo-600"
                                                    />
                                                    <span>Update Admin</span>
                                                </label>
                                            </div>

                                            {formData.assignAdmin && (
                                                <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl space-y-3">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Admin Full Name</label>
                                                            <input
                                                                type="text"
                                                                value={formData.adminName}
                                                                onChange={e => setFormData({ ...formData, adminName: e.target.value })}
                                                                placeholder="e.g. Branch Manager"
                                                                className="mt-1 w-full text-xs p-2.5 bg-white dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-indigo-600"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Mobile (for POS login)</label>
                                                            <input
                                                                type="text"
                                                                value={formData.adminMobile}
                                                                onChange={e => setFormData({ ...formData, adminMobile: e.target.value })}
                                                                placeholder="9876543210"
                                                                className="mt-1 w-full text-xs p-2.5 bg-white dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-indigo-600 font-mono"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                                                            <span>Admin Login Email *</span>
                                                            <span className="text-[10px] text-neutral-400 font-normal">Used to sign in to Admin Panel</span>
                                                        </label>
                                                        <input
                                                            type="email"
                                                            value={formData.adminEmail}
                                                            onChange={e => setFormData({ ...formData, adminEmail: e.target.value })}
                                                            placeholder="admin@branch.com"
                                                            className="mt-1 w-full text-xs p-2.5 bg-white dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-indigo-600 font-medium"
                                                        />
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                                                                <span>Password</span>
                                                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">Leave blank to keep</span>
                                                            </label>
                                                            <div className="relative mt-1">
                                                                <input
                                                                    type={showPassword ? 'text' : 'password'}
                                                                    value={formData.adminPassword}
                                                                    onChange={e => setFormData({ ...formData, adminPassword: e.target.value })}
                                                                    placeholder="•••••••• (unchanged)"
                                                                    className="w-full text-xs p-2.5 pr-8 bg-white dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-indigo-600 font-mono"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowPassword(!showPassword)}
                                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                                                                >
                                                                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                                                                <span>Security PIN (4-6 digits)</span>
                                                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">Leave blank to keep</span>
                                                            </label>
                                                            <div className="relative mt-1">
                                                                <input
                                                                    type={showPin ? 'text' : 'password'}
                                                                    maxLength={6}
                                                                    value={formData.adminPin}
                                                                    onChange={e => setFormData({ ...formData, adminPin: e.target.value })}
                                                                    placeholder="•••• (unchanged)"
                                                                    className="w-full text-xs p-2.5 pr-8 bg-white dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-indigo-600 font-mono tracking-widest"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowPin(!showPin)}
                                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                                                                >
                                                                    {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* Workflow Information Banner for New Creations */}
                                {!editingBranch && (
                                    <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 text-[11px] text-indigo-800 dark:text-indigo-300 flex items-start gap-2">
                                        <Sparkles size={15} className="shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400" />
                                        <span>
                                            <strong>Approval Workflow:</strong> Once submitted, Super Admin will review your restaurant details and chosen plan. As soon as approved, your outlet will be activated and you can assign a Restaurant Admin with login credentials.
                                        </span>
                                    </div>
                                )}

                                <div className="pt-4 flex justify-end gap-3 border-t border-neutral-100 dark:border-zinc-800">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="px-4 py-2 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 rounded-xl cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                                    >
                                        {loading ? 'Processing...' : (editingBranch ? 'Save Changes' : 'Submit Registration Request')}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* DEDICATED ASSIGN RESTAURANT ADMIN MODAL (AFTER SUPER ADMIN APPROVAL) */}
            <AnimatePresence>
                {assigningAdminBranch && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full border border-neutral-200 dark:border-zinc-800 shadow-2xl space-y-4"
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-zinc-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                                        <UserCheck size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-extrabold text-neutral-900 dark:text-white">
                                            Assign Restaurant Admin
                                        </h3>
                                        <p className="text-xs text-neutral-400">
                                            {assigningAdminBranch.name} · ID: {assigningAdminBranch.restaurant_id || assigningAdminBranch.id}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setAssigningAdminBranch(null)}
                                    className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 cursor-pointer"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/40 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                                <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-600" />
                                <span>
                                    <strong>Outlet Activated!</strong> Create login credentials for this restaurant branch. The assigned admin will use these credentials to manage operations at <strong>/admin/login</strong>.
                                </span>
                            </div>

                            <form onSubmit={handleSaveAssignAdmin} className="space-y-3.5">
                                <div>
                                    <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                                        Admin Full Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={assignAdminData.adminName}
                                        onChange={e => setAssignAdminData({ ...assignAdminData, adminName: e.target.value })}
                                        placeholder="e.g. Ramesh Sharma"
                                        className="mt-1 w-full text-xs p-2.5 bg-neutral-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-indigo-600 font-medium"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                                            Admin Email *
                                        </label>
                                        <input
                                            type="email"
                                            required
                                            value={assignAdminData.adminEmail}
                                            onChange={e => setAssignAdminData({ ...assignAdminData, adminEmail: e.target.value })}
                                            placeholder="admin@outlet.com"
                                            className="mt-1 w-full text-xs p-2.5 bg-neutral-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-indigo-600 font-medium"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                                            Mobile Number *
                                        </label>
                                        <input
                                            type="tel"
                                            required
                                            value={assignAdminData.adminMobile}
                                            onChange={e => setAssignAdminData({ ...assignAdminData, adminMobile: e.target.value })}
                                            placeholder="9876543210"
                                            className="mt-1 w-full text-xs p-2.5 bg-neutral-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-indigo-600 font-mono"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                                            <span>Password *</span>
                                        </label>
                                        <div className="relative mt-1">
                                            <input
                                                type={showAssignPassword ? 'text' : 'password'}
                                                required
                                                value={assignAdminData.adminPassword}
                                                onChange={e => setAssignAdminData({ ...assignAdminData, adminPassword: e.target.value })}
                                                placeholder="AdminPass@123"
                                                className="w-full text-xs p-2.5 pr-8 bg-neutral-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-indigo-600 font-mono"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowAssignPassword(!showAssignPassword)}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                                            >
                                                {showAssignPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                                            <span>Security PIN *</span>
                                            <span className="text-[10px] text-neutral-400">4-6 digits</span>
                                        </label>
                                        <div className="relative mt-1">
                                            <input
                                                type={showAssignPin ? 'text' : 'password'}
                                                required
                                                maxLength={6}
                                                value={assignAdminData.adminPin}
                                                onChange={e => setAssignAdminData({ ...assignAdminData, adminPin: e.target.value })}
                                                placeholder="1234"
                                                className="w-full text-xs p-2.5 pr-8 bg-neutral-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-indigo-600 font-mono tracking-widest"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowAssignPin(!showAssignPin)}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                                            >
                                                {showAssignPin ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-3 flex justify-end gap-2.5 border-t border-neutral-100 dark:border-zinc-800">
                                    <button
                                        type="button"
                                        onClick={() => setAssigningAdminBranch(null)}
                                        className="px-4 py-2 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={assignAdminLoading}
                                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                                    >
                                        {assignAdminLoading ? 'Assigning...' : 'Assign & Activate Admin'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* DELETE BRANCH CONFIRMATION MODAL */}
            <AnimatePresence>
                {branchToDelete && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full border border-rose-200 dark:border-rose-900/40 shadow-2xl space-y-4"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
                                    <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center">
                                        <AlertTriangle size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-extrabold text-neutral-900 dark:text-white">
                                            Delete Branch Outlet
                                        </h3>
                                        <p className="text-xs text-neutral-500">Remove from active franchise network</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setBranchToDelete(null)}
                                    className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="p-4 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl space-y-1.5">
                                <p className="text-xs font-bold text-neutral-900 dark:text-white">
                                    Branch: {branchToDelete.name}
                                </p>
                                <p className="text-[11px] font-mono text-neutral-500">
                                    Code: {branchToDelete.code || branchToDelete.id}
                                </p>
                                {branchToDelete.address && (
                                    <p className="text-[11px] text-neutral-500">
                                        {typeof branchToDelete.address === 'string' ? branchToDelete.address : JSON.stringify(branchToDelete.address)}
                                    </p>
                                )}
                            </div>

                            <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                                Are you sure you want to delete this branch? It will be removed from your outlets and immediately <strong>free up 1 branch slot</strong> in your franchise quota ({branchLimits?.currentCount || 1}/{branchLimits?.effectiveLimit || 1}).
                            </p>

                            <div className="pt-2 flex justify-end gap-3 border-t border-neutral-100 dark:border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setBranchToDelete(null)}
                                    disabled={deleteLoading}
                                    className="px-4 py-2 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeleteBranch}
                                    disabled={deleteLoading}
                                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    {deleteLoading ? 'Deleting...' : 'Confirm Delete Branch'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* MAXIMUM BRANCHES REACHED WARNING POPUP MODAL */}
            <AnimatePresence>
                {showLimitWarningModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ duration: 0.2 }}
                            className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-7 max-w-md w-full border border-neutral-200/80 dark:border-zinc-800 shadow-2xl space-y-5"
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3.5">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-xs shrink-0">
                                        <AlertTriangle size={24} />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-100/80 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                            Quota Limit
                                        </span>
                                        <h3 className="text-lg font-black text-neutral-900 dark:text-white mt-1 tracking-tight">
                                            Maximum Branches Reached
                                        </h3>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowLimitWarningModal(false)}
                                    className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 rounded-xl hover:bg-neutral-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                                    title="Close"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Quota Status Card */}
                            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-zinc-800/40 border border-neutral-200/70 dark:border-zinc-700/50 space-y-3">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-neutral-500 dark:text-neutral-400">Owner Account Allocation</span>
                                    <span className="font-bold text-neutral-900 dark:text-white">
                                        {branchLimits?.currentCount || branches.length} of {branchLimits?.effectiveLimit || branches.length} Outlets Used
                                    </span>
                                </div>
                                <div className="w-full bg-neutral-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                                    <div className="bg-amber-500 h-full rounded-full w-full" />
                                </div>
                                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                                    Your account has reached the maximum authorized limit of <strong>{branchLimits?.effectiveLimit || branches.length} branches/restaurants</strong> across your entire Owner account.
                                </p>
                            </div>

                            {/* Contact Dine in One Box */}
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/80 to-violet-50/80 dark:from-indigo-950/30 dark:to-violet-950/30 border border-indigo-100 dark:border-indigo-900/40 space-y-2">
                                <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                                    <Building2 size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Contact Dine in One</span>
                                </div>
                                <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                                    To expand your branch capacity, upgrade your franchise quota, or add custom outlet allocations, please contact <strong>Dine in One</strong> support:
                                </p>
                                <div className="pt-1.5 flex flex-col sm:flex-row items-start sm:items-center gap-2.5 text-xs">
                                    <a
                                        href="mailto:support@dineinone.com?subject=Branch%20Quota%20Upgrade%20Request"
                                        className="inline-flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                                    >
                                        <Mail size={13} />
                                        support@dineinone.com
                                    </a>
                                    <span className="hidden sm:inline text-neutral-300 dark:text-zinc-600">•</span>
                                    <a
                                        href="tel:+919876543210"
                                        className="inline-flex items-center gap-1.5 font-bold text-neutral-700 dark:text-neutral-300 hover:underline font-mono text-[11px]"
                                    >
                                        <Phone size={13} />
                                        +91 98765 43210
                                    </a>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-neutral-100 dark:border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setShowLimitWarningModal(false)}
                                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                                >
                                    Close
                                </button>
                                <Link
                                    href="/owner/billing"
                                    onClick={() => setShowLimitWarningModal(false)}
                                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Sparkles size={14} />
                                    <span>Upgrade Plan</span>
                                </Link>
                                <a
                                    href="mailto:support@dineinone.com?subject=Branch%20Quota%20Upgrade%20Request"
                                    onClick={() => setShowLimitWarningModal(false)}
                                    className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-neutral-100 dark:bg-zinc-800 hover:bg-neutral-200 dark:hover:bg-zinc-700 text-neutral-700 dark:text-neutral-300 transition-all flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Mail size={14} />
                                    <span>Contact Sales</span>
                                </a>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
