'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOwner } from '@/context/OwnerContext';
import {
    Users, Plus, Search, Phone, Mail, Building2, Shield,
    ToggleLeft, ToggleRight, X, Check, UserPlus, Edit, Eye,
    EyeOff, Key, ShieldCheck, Loader2, KeyRound
} from 'lucide-react';
import { toast } from 'sonner';

interface Employee {
    id: string;
    internal_id?: string;
    name: string;
    email?: string;
    mobile?: string;
    phone_normalized?: string;
    role: string;
    status: string;
    employee_code?: string;
    legacy_reference?: string;
    branch_id?: string;
    branch_internal_id?: string;
    branch_name?: string;
    profile_image_url?: string;
    created_at?: string;
    branch_access?: string[];
}

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    restaurant_admin: { bg: 'bg-indigo-50 dark:bg-indigo-950/30', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200/60 dark:border-indigo-800/30' },
    owner: { bg: 'bg-violet-50 dark:bg-violet-950/30', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200/60 dark:border-violet-800/30' },
    waiter: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200/60 dark:border-blue-800/30' },
    chef: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200/60 dark:border-amber-800/30' },
    kitchen: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200/60 dark:border-amber-800/30' },
    cashier: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200/60 dark:border-emerald-800/30' },
    delivery_boy: { bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200/60 dark:border-orange-800/30' },
    supervisor: { bg: 'bg-purple-50 dark:bg-purple-950/30', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200/60 dark:border-purple-800/30' },
    manager: { bg: 'bg-teal-50 dark:bg-teal-950/30', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200/60 dark:border-teal-800/30' },
    admin: { bg: 'bg-indigo-50 dark:bg-indigo-950/30', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200/60 dark:border-indigo-800/30' },
};

const AVAILABLE_ROLES = [
    { value: 'restaurant_admin', label: 'Restaurant Admin' },
    { value: 'waiter', label: 'Waiter' },
    { value: 'chef', label: 'Chef' },
    { value: 'cashier', label: 'Cashier' },
    { value: 'delivery_boy', label: 'Delivery Boy' },
    { value: 'supervisor', label: 'Supervisor' },
    { value: 'manager', label: 'Manager' },
];

function getRoleStyle(role: string) {
    return ROLE_COLORS[role.toLowerCase()] || { bg: 'bg-neutral-100 dark:bg-zinc-800', text: 'text-neutral-600', border: 'border-neutral-200/60' };
}

function formatRole(role: string) {
    return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export default function EmployeesPage() {
    const { branches, selectedBranchId, isAllBranches } = useOwner();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    
    // Modal & Form State
    const [showModal, setShowModal] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showPin, setShowPin] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        mobile: '',
        role: 'restaurant_admin',
        branch_id: '',
        status: 'active',
        password: '',
        pin: ''
    });

    const loadEmployees = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (!isAllBranches && selectedBranchId) params.set('branch', selectedBranchId);
            params.set('limit', '200');

            const res = await fetch(`/api/owner/employees?${params}`);
            if (res.ok) {
                const data = await res.json();
                setEmployees(data.employees || []);
            }
        } catch (err) {
            console.error('Load employees error:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId, isAllBranches]);

    useEffect(() => { loadEmployees(); }, [loadEmployees]);

    const handleOpenAdd = () => {
        setEditingEmployee(null);
        const firstBranch = branches[0];
        const defaultBranchId = firstBranch ? (firstBranch.internal_id || firstBranch.branch_id || firstBranch.id) : '';
        setFormData({
            name: '',
            email: '',
            mobile: '',
            role: 'restaurant_admin',
            branch_id: defaultBranchId,
            status: 'active',
            password: '',
            pin: '1234'
        });
        setShowModal(true);
    };

    const handleOpenEdit = (emp: Employee) => {
        setEditingEmployee(emp);
        const matchingBranch = branches.find(b =>
            b.id === emp.branch_id ||
            b.branch_id === emp.branch_id ||
            b.internal_id === emp.branch_id ||
            (emp.branch_internal_id && b.internal_id === emp.branch_internal_id)
        );
        const branchVal = matchingBranch ? (matchingBranch.internal_id || matchingBranch.branch_id || matchingBranch.id) : (emp.branch_internal_id || emp.branch_id || '');
        setFormData({
            name: emp.name || '',
            email: emp.email || '',
            mobile: emp.mobile || '',
            role: emp.role || 'restaurant_admin',
            branch_id: branchVal,
            status: emp.status || 'active',
            password: '',
            pin: ''
        });
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error('Employee name is required');
            return;
        }

        if (formData.role === 'restaurant_admin' && !formData.email.trim() && !formData.mobile.trim()) {
            toast.error('Mobile number or Email is required for Restaurant Admin');
            return;
        }

        setSubmitting(true);
        try {
            const payload: any = {
                name: formData.name.trim(),
                email: formData.email.trim() || null,
                mobile: formData.mobile.trim() || null,
                role: formData.role,
                branch_id: formData.branch_id || null,
                status: formData.status
            };

            if (formData.password?.trim()) payload.password = formData.password.trim();
            if (formData.pin?.trim()) payload.pin = formData.pin.trim();

            let res;
            if (editingEmployee) {
                payload.id = editingEmployee.id;
                res = await fetch('/api/owner/employees', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                res = await fetch('/api/owner/employees', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to save employee');
            }

            toast.success(editingEmployee ? 'Employee credentials & profile updated!' : 'Employee created successfully!');
            setShowModal(false);
            setEditingEmployee(null);
            await loadEmployees();
        } catch (err: any) {
            toast.error(err.message || 'Operation failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleStatus = async (emp: Employee) => {
        const newStatus = emp.status === 'active' ? 'inactive' : 'active';
        try {
            const res = await fetch('/api/owner/employees', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: emp.id, status: newStatus })
            });
            if (res.ok) {
                toast.success(`Employee ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
                setEmployees(employees.map(e => e.id === emp.id ? { ...e, status: newStatus } : e));
            } else {
                const d = await res.json();
                toast.error(d.error || 'Status update failed');
            }
        } catch (err) {
            toast.error('Network error updating employee status');
        }
    };

    const filtered = employees.filter(e => {
        const cleanSearch = search.replace(/[^0-9]/g, '');
        const matchesSearch = !search.trim() || (
            (e.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (e.email || '').toLowerCase().includes(search.toLowerCase()) ||
            (e.mobile || '').includes(search) ||
            (cleanSearch.length > 0 && (e.mobile || '').replace(/[^0-9]/g, '').includes(cleanSearch)) ||
            (e.phone_normalized || '').includes(search) ||
            (e.employee_code || '').toLowerCase().includes(search.toLowerCase()) ||
            (e.legacy_reference || '').toLowerCase().includes(search.toLowerCase()) ||
            (e.internal_id || '').toLowerCase().includes(search.toLowerCase())
        );

        const matchesRole = roleFilter === 'all' || (e.role || '').toLowerCase().trim() === roleFilter.toLowerCase().trim();
        const matchesStatus = statusFilter === 'all' || (e.status || '').toLowerCase().trim() === statusFilter.toLowerCase().trim();

        return matchesSearch && matchesRole && matchesStatus;
    });

    const filterRoleOptions = React.useMemo(() => {
        const roleMap = new Map<string, string>();
        AVAILABLE_ROLES.forEach(r => roleMap.set(r.value.toLowerCase(), r.label));

        employees.forEach(e => {
            if (e.role) {
                const key = e.role.toLowerCase().trim();
                if (!roleMap.has(key)) {
                    roleMap.set(key, formatRole(key));
                }
            }
        });

        return Array.from(roleMap.entries()).map(([value, label]) => ({ value, label }));
    }, [employees]);

    return (
        <div className="p-6 lg:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">Staff & Restaurant Admins</h2>
                    <p className="text-sm text-neutral-400 mt-0.5">
                        {filtered.length !== employees.length
                            ? `${filtered.length} of ${employees.length} staff · ${filtered.filter(e => e.status === 'active').length} active`
                            : `${employees.length} total · ${employees.filter(e => e.status === 'active').length} active`
                        }
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800/60 border border-neutral-200/40 dark:border-zinc-700/30 rounded-xl w-48 shadow-xs">
                        <Search size={14} className="text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search staff..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-transparent text-xs outline-none w-full text-neutral-700 dark:text-neutral-300 placeholder:text-neutral-400"
                        />
                    </div>
                    <select
                        value={roleFilter}
                        onChange={e => setRoleFilter(e.target.value)}
                        className="px-3 py-2 bg-white dark:bg-zinc-800/60 border border-neutral-200/40 dark:border-zinc-700/30 rounded-xl text-xs text-neutral-700 dark:text-neutral-300 outline-none cursor-pointer"
                    >
                        <option value="all">All Roles</option>
                        {filterRoleOptions.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-white dark:bg-zinc-800/60 border border-neutral-200/40 dark:border-zinc-700/30 rounded-xl text-xs text-neutral-700 dark:text-neutral-300 outline-none cursor-pointer"
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                    <button
                        onClick={handleOpenAdd}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 hover:shadow-lg transition-all cursor-pointer"
                    >
                        <UserPlus size={15} /> <span>Add Staff / Admin</span>
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="premium-glass-card rounded-3xl border border-neutral-200/40 dark:border-zinc-800/40 overflow-hidden shadow-xs">
                {loading ? (
                    <div className="p-8 space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 animate-pulse">
                                <div className="w-10 h-10 rounded-xl bg-neutral-200/60 dark:bg-zinc-800" />
                                <div className="flex-1 space-y-2">
                                    <div className="w-32 h-3 bg-neutral-200/60 dark:bg-zinc-800 rounded" />
                                    <div className="w-20 h-2 bg-neutral-100/60 dark:bg-zinc-800/60 rounded" />
                                </div>
                                <div className="w-16 h-6 bg-neutral-200/60 dark:bg-zinc-800 rounded-full" />
                            </div>
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16">
                        <Users size={32} className="text-neutral-300 mx-auto mb-3" />
                        <p className="text-sm text-neutral-500 font-semibold">No employees found</p>
                        <p className="text-xs text-neutral-400 mt-1">Try adjusting your search or filters</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-neutral-100 dark:border-zinc-800/60 bg-neutral-50/50 dark:bg-zinc-900/40">
                                    <th className="text-left px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-wider">Employee / Admin</th>
                                    <th className="text-left px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-wider">Role</th>
                                    <th className="text-left px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-wider hidden md:table-cell">Contact</th>
                                    <th className="text-left px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-wider hidden lg:table-cell">Assigned Branch</th>
                                    <th className="text-left px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-wider">Status</th>
                                    <th className="text-right px-6 py-4 text-[10px] font-black text-neutral-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100/60 dark:divide-zinc-800/40">
                                {filtered.map((emp, i) => {
                                    const isActive = emp.status === 'active';
                                    const roleStyle = getRoleStyle(emp.role);
                                    const assignedBranch = branches.find(b => 
                                        b.id === emp.branch_id || 
                                        b.branch_id === emp.branch_id || 
                                        b.internal_id === emp.branch_id ||
                                        (emp.branch_internal_id && b.internal_id === emp.branch_internal_id)
                                    );
                                    return (
                                        <motion.tr
                                            key={emp.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: i * 0.02 }}
                                            className="hover:bg-neutral-50/50 dark:hover:bg-zinc-800/30 transition-colors group"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-950/30 dark:to-violet-950/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-sm font-black flex-shrink-0 group-hover:scale-105 transition-transform">
                                                        {emp.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-neutral-800 dark:text-white">{emp.name}</p>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className="text-[10px] font-mono font-semibold text-neutral-500 bg-neutral-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                                                {emp.employee_code || 'EMP-0000'}
                                                            </span>
                                                            {emp.internal_id && (
                                                                <span className="text-[9px] font-mono text-neutral-400" title={`Internal ID: ${emp.internal_id}`}>
                                                                    ({emp.internal_id.slice(0, 10)}...)
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}>
                                                    {formatRole(emp.role)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 hidden md:table-cell">
                                                <div className="space-y-1">
                                                    {emp.mobile && <p className="text-xs text-neutral-500 flex items-center gap-1.5"><Phone size={11} className="text-neutral-400" />{emp.mobile}</p>}
                                                    {emp.email && <p className="text-xs text-neutral-500 flex items-center gap-1.5"><Mail size={11} className="text-neutral-400" />{emp.email}</p>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 hidden lg:table-cell">
                                                {assignedBranch ? (
                                                    <span className="inline-flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300 font-medium">
                                                        <Building2 size={12} className="text-indigo-500" />
                                                        {assignedBranch.name}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-neutral-400">All branches</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                    isActive 
                                                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border border-emerald-200/60 dark:border-emerald-800/30' 
                                                        : 'bg-neutral-100 dark:bg-zinc-800 text-neutral-500 border border-neutral-200/60 dark:border-zinc-700/40'
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                                                    {isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => handleOpenEdit(emp)}
                                                        className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-neutral-700 dark:text-neutral-300 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                                                    >
                                                        <Edit size={12} /> Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleStatus(emp)}
                                                        className={`p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                                            isActive
                                                                ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                                                                : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                                                        }`}
                                                        title={isActive ? 'Deactivate' : 'Activate'}
                                                    >
                                                        {isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ADD / EDIT EMPLOYEE MODAL */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full border border-neutral-200 dark:border-zinc-800 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4"
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-zinc-800">
                                <h3 className="text-base font-extrabold text-neutral-900 dark:text-white flex items-center gap-2">
                                    <Shield size={18} className="text-indigo-600" />
                                    {editingEmployee ? 'Edit Staff / Admin Credentials' : 'Add New Staff / Admin'}
                                </h3>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="space-y-3.5">
                                {/* Name */}
                                <div>
                                    <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Full Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. Ramesh Varma"
                                        className="mt-1 w-full text-xs p-3 bg-neutral-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-indigo-600 font-medium"
                                    />
                                </div>

                                {/* Role and Branch */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Role</label>
                                        <select
                                            value={formData.role}
                                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                                            className="mt-1 w-full text-xs p-3 bg-neutral-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-indigo-600 font-medium"
                                        >
                                            {AVAILABLE_ROLES.map(r => (
                                                <option key={r.value} value={r.value}>{r.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Branch</label>
                                        <select
                                            value={formData.branch_id}
                                            onChange={e => setFormData({ ...formData, branch_id: e.target.value })}
                                            className="mt-1 w-full text-xs p-3 bg-neutral-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-indigo-600 font-medium"
                                        >
                                            <option value="">All Branches</option>
                                            {branches.map(b => {
                                                const branchVal = b.internal_id || b.branch_id || b.id;
                                                return (
                                                    <option key={branchVal} value={branchVal}>{b.name}</option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                </div>

                                {/* Mobile and Email */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                                            Mobile {formData.role === 'restaurant_admin' ? '*' : ''}
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.mobile}
                                            onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                                            placeholder="9876543210"
                                            className="mt-1 w-full text-xs p-3 bg-neutral-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-indigo-600 font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                                            Email {formData.role === 'restaurant_admin' ? '*' : ''}
                                        </label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="admin@branch.com"
                                            className="mt-1 w-full text-xs p-3 bg-neutral-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-indigo-600"
                                        />
                                    </div>
                                </div>

                                {/* Security Credentials Box */}
                                <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl space-y-3">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                                        <Key size={13} /> Authentication Credentials
                                    </h4>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                                                <span>Password</span>
                                                {editingEmployee && <span className="text-[10px] text-amber-600 font-normal">Leave blank to keep</span>}
                                            </label>
                                            <div className="relative mt-1">
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    value={formData.password}
                                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                                    placeholder={editingEmployee ? '••••••••' : 'Password123!'}
                                                    className="w-full text-xs p-2.5 pr-8 bg-white dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-indigo-600 font-mono"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                                                >
                                                    {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                                                <span>Security PIN</span>
                                                {editingEmployee && <span className="text-[10px] text-amber-600 font-normal">Leave blank to keep</span>}
                                            </label>
                                            <div className="relative mt-1">
                                                <input
                                                    type={showPin ? 'text' : 'password'}
                                                    maxLength={6}
                                                    value={formData.pin}
                                                    onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/[^0-9]/g, '') })}
                                                    placeholder={editingEmployee ? '••••' : '1234'}
                                                    className="w-full text-xs p-2.5 pr-8 bg-white dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-indigo-600 font-mono tracking-widest"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPin(!showPin)}
                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                                                >
                                                    {showPin ? <EyeOff size={13} /> : <Eye size={13} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {formData.role === 'restaurant_admin' && (
                                        <p className="text-[11px] text-indigo-800 dark:text-indigo-300 bg-white/60 dark:bg-zinc-900/60 p-2 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                                            ℹ️ Restaurant Admin must enter <strong>Mobile number or Email</strong>, <strong>Password</strong>, and <strong>Security PIN</strong> (all 3 compulsory) to log in.
                                        </p>
                                    )}
                                </div>

                                <div className="pt-3 flex justify-end gap-3 border-t border-neutral-100 dark:border-zinc-800">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="px-4 py-2 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                                    >
                                        {submitting ? (
                                            <><Loader2 size={13} className="animate-spin" /> Saving...</>
                                        ) : (
                                            editingEmployee ? 'Save Changes' : 'Create Staff'
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
