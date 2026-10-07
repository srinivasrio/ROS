'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
    UserPlus as LucideUserPlus, 
    Edit as LucideEdit, 
    Trash2 as LucideTrash2, 
    Check as LucideCheck, 
    X as LucideX, 
    Search as LucideSearch,
    Filter as LucideFilter,
    Mail as LucideMail,
    Phone as LucidePhone,
    Eye as LucideEye,
    EyeOff as LucideEyeOff
} from 'lucide-react';
import { PayrollService, Employee, Branch } from '@/services/payroll.service';
import { StaffService } from '@/services/staff.service';
import { createClient } from '@/lib/supabase';
import { getCached, setCache, hasFreshCache, clearCache } from '@/lib/data-cache';
import { requestManager } from '@/lib/cache/request-manager';
import { SyncIndicator } from '@/components/admin/SyncIndicator';
import EmployeeModal from './EmployeeModal';
import DeleteStaffModal from './DeleteStaffModal';

interface EmployeesTabProps {
    restaurantId: string;
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'none'];

function formatWeekday(day: string) {
    if (!day || day === 'none') return '—';
    return day.charAt(0).toUpperCase() + day.slice(1, 3);
}

export default function EmployeesTab({ restaurantId }: EmployeesTabProps) {
    const cacheKey = `employees-${restaurantId}`;
    const cached = getCached<any>(cacheKey);
    const [employees, setEmployees] = useState<Employee[]>(cached?.employees || []);
    const [branches, setBranches] = useState<Branch[]>(cached?.branches || []);
    const [loading, setLoading] = useState(!cached && employees.length === 0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSync, setLastSync] = useState<Date | null>(cached ? new Date() : null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | undefined>();
    const [showDeleted, setShowDeleted] = useState(false);
    const [isOwner, setIsOwner] = useState(false);

    useEffect(() => {
        fetch('/api/auth/session')
            .then(res => res.json())
            .then(data => {
                const role = (data?.user?.role || '').toLowerCase();
                const ownerRoles = ['owner', 'restaurant_owner', 'super_admin', 'superadmin'];
                setIsOwner(ownerRoles.includes(role));
            })
            .catch(() => setIsOwner(false));
    }, []);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [branchFilter, setBranchFilter] = useState('all');
    const [revealedPins, setRevealedPins] = useState<Set<string>>(new Set());
    const [showAllPins, setShowAllPins] = useState(false);

    const toggleRevealPin = (id: string) => {
        setRevealedPins(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const toggleRevealAllPins = () => {
        if (showAllPins) {
            setRevealedPins(new Set());
            setShowAllPins(false);
        } else {
            const allIds = new Set(employees.map(e => e.id));
            setRevealedPins(allIds);
            setShowAllPins(true);
        }
    };

    // Delete Modal
    const [deleteModal, setDeleteModal] = useState<{
        isOpen: boolean;
        employee?: Employee;
        isPermanent: boolean;
        isLoading: boolean;
    }>({
        isOpen: false,
        isPermanent: false,
        isLoading: false
    });

    const loadData = useCallback(async (force = false) => {
        if (!restaurantId) return;

        if (force) {
            clearCache(cacheKey);
        }

        const currentCached = getCached<any>(cacheKey);
        if (currentCached && employees.length === 0 && !showDeleted) {
            setEmployees((currentCached.employees || []).filter((e: any) => !['owner', 'restaurant_owner'].includes(String(e.role || '').toLowerCase())));
            setBranches(currentCached.branches || []);
            setLoading(false);
        }

        if (!force && !showDeleted && hasFreshCache(cacheKey)) {
            setLoading(false);
            return;
        }

        if (!cached && employees.length === 0) {
            setLoading(true);
        } else {
            setIsSyncing(true);
        }

        try {
            if (showDeleted) {
                const [branchList, deletedList] = await Promise.all([
                    PayrollService.fetchBranches(restaurantId),
                    StaffService.fetchDeletedStaff(restaurantId)
                ]);
                setBranches(branchList);
                const mappedList: Employee[] = deletedList
                    .filter(s => !['owner', 'restaurant_owner'].includes(String(s.role || '').toLowerCase()))
                    .map(s => ({
                    id: s.id,
                    restaurant_id: restaurantId,
                    name: s.name,
                    email: s.email || null,
                    phone: s.mobile || '',
                    role: s.role,
                    branch_id: s.branch_id || null,
                    monthly_salary: s.monthly_salary || 0,
                    per_day_salary: s.per_day_salary || null,
                    overtime_per_hour: s.overtime_per_hour || null,
                    joining_date: s.joining_date || '',
                    status: s.status === 'active' ? 'active' : 'inactive',
                    employee_id: s.employee_id || null,
                    weekly_off: (s as any).weekly_off || 'sunday',
                    salary_type: (s as any).salary_type || 'monthly'
                }));
                setEmployees(mappedList);
            } else {
                const data = await requestManager.coalesce(cacheKey, async () => {
                    const [branchList, empList] = await Promise.all([
                        PayrollService.fetchBranches(restaurantId),
                        PayrollService.fetchEmployees(restaurantId)
                    ]);
                    return { branches: branchList, employees: empList };
                }, 3);

                if (data) {
                    setBranches(data.branches);
                    const nonOwner = (data.employees || []).filter((e: any) => !['owner', 'restaurant_owner'].includes(String(e.role || '').toLowerCase()));
                    setEmployees(nonOwner);
                    setCache(cacheKey, { branches: data.branches, employees: nonOwner }, { ttlMs: 15 * 60 * 1000 });
                    setLastSync(new Date());
                }
            }
        } catch (error) {
            console.error('Failed to load employee tab data:', error);
        } finally {
            setLoading(false);
            setIsSyncing(false);
        }
    }, [restaurantId, showDeleted, cacheKey, employees.length, cached]);

    useEffect(() => {
        if (restaurantId) {
            loadData();

            const supabase = createClient();
            const channel = supabase
                .channel(`employees-status-live-${restaurantId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'employees',
                        filter: `restaurant_id=eq.${restaurantId}`
                    },
                    () => {
                        loadData(true);
                    }
                )
                .subscribe();

            return () => {
                channel.unsubscribe();
            };
        }
    }, [restaurantId, showDeleted]);

    const handleAdd = () => {
        setSelectedEmployee(undefined);
        setIsModalOpen(true);
    };

    const handleEdit = (employee: Employee) => {
        setSelectedEmployee(employee);
        setIsModalOpen(true);
    };

    const openDeleteModal = (employee: Employee, isPermanent: boolean = false) => {
        setDeleteModal({
            isOpen: true,
            employee,
            isPermanent,
            isLoading: false
        });
    };

    const handleConfirmDelete = async () => {
        if (!deleteModal.employee) return;
        setDeleteModal(prev => ({ ...prev, isLoading: true }));
        try {
            if (deleteModal.isPermanent) {
                await StaffService.permanentDeleteStaff(deleteModal.employee.id, restaurantId);
            } else {
                await StaffService.softDeleteStaff(deleteModal.employee.id, restaurantId);
            }
            setDeleteModal({ isOpen: false, isPermanent: false, isLoading: false });
            await loadData();
        } catch (error: any) {
            console.error('Error during deletion:', error);
            alert(error.message || 'Failed to delete employee.');
            setDeleteModal(prev => ({ ...prev, isLoading: false }));
        }
    };

    const handleRestore = async (id: string) => {
        try {
            await StaffService.restoreStaff(id, restaurantId);
            await loadData();
        } catch (error: any) {
            alert(error.message || 'Failed to restore employee');
        }
    };

    const toggleStatus = async (employee: Employee) => {
        const nextStatus = employee.status === 'active' ? 'inactive' : 'active';
        try {
            await PayrollService.updateEmployee(employee.id, { 
                status: nextStatus,
                ...(nextStatus === 'inactive' ? { is_online: false, availability_status: 'offline' } : {})
            });
            loadData();
        } catch (error) {
            alert('Failed to update employee status.');
        }
    };

    // Filter employees (exclude owner from directory and roles filter)
    const nonOwnerEmployees = employees.filter(e => !['owner', 'restaurant_owner'].includes(String(e.role || '').toLowerCase()));
    const uniqueRoles = [...new Set(nonOwnerEmployees.map(e => e.role))].sort();
    const filtered = nonOwnerEmployees.filter(emp => {
        if (searchQuery) {
            const q = searchQuery.toLowerCase().trim();
            const cleanQ = q.replace(/[^0-9]/g, '');
            const matchName = emp.name.toLowerCase().includes(q);
            const matchEmail = emp.email?.toLowerCase().includes(q);
            const matchPhone = emp.phone?.includes(q) || (cleanQ.length > 0 && emp.phone?.replace(/[^0-9]/g, '').includes(cleanQ));
            const matchCode = emp.employee_code?.toLowerCase().includes(q) || emp.employee_id?.toLowerCase().includes(q) || emp.legacy_reference?.toLowerCase().includes(q) || emp.internal_id?.toLowerCase().includes(q);
            if (!matchName && !matchEmail && !matchPhone && !matchCode) return false;
        }
        if (roleFilter !== 'all' && emp.role !== roleFilter) return false;
        if (branchFilter !== 'all' && emp.branch_id !== branchFilter) return false;
        return true;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-neutral-500 font-medium">
                Loading employees...
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-6 pt-5 pb-3 gap-3 shrink-0">
                <div>
                    <h3 className="text-base font-bold text-black">
                        {showDeleted ? 'Archived Staff' : 'Employee Directory'}
                    </h3>
                    <p className="text-xs text-neutral-500">
                        {showDeleted 
                            ? 'Soft-deleted employees. Restore to reactivate.' 
                            : `${employees.length} employees • Manage salary, role and branch assignments.`}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <SyncIndicator isSyncing={isSyncing} lastSync={lastSync} onRefresh={() => loadData(true)} />
                    <button
                        onClick={() => setShowDeleted(!showDeleted)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                            showDeleted 
                                ? 'bg-neutral-800 text-white border-neutral-800 hover:bg-neutral-900' 
                                : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                        }`}
                    >
                        {showDeleted ? 'Show Active' : 'Archived'}
                    </button>
                    {!showDeleted && (
                        <button
                            onClick={handleAdd}
                            className="flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all shadow-sm gap-1.5"
                        >
                            <LucideUserPlus size={14} />
                            Add Employee
                        </button>
                    )}
                </div>
            </div>

            {/* Filters Row */}
            {!showDeleted && (
                <div className="flex flex-wrap items-center gap-2 px-6 pb-3 shrink-0">
                    <div className="flex items-center bg-neutral-100 border border-neutral-200 rounded-lg px-2.5 py-1.5 gap-1.5 flex-1 min-w-[180px] max-w-[280px]">
                        <LucideSearch size={14} className="text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search name, email, or phone…"
                            className="bg-transparent text-xs focus:outline-none w-full text-black placeholder:text-neutral-400"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <select
                        value={roleFilter}
                        onChange={e => setRoleFilter(e.target.value)}
                        className="bg-neutral-100 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-black focus:outline-none cursor-pointer"
                    >
                        <option value="all">All Roles</option>
                        {uniqueRoles.map(r => (
                            <option key={r} value={r}>{r === 'delivery_boy' ? 'Delivery Boy' : r === 'restaurant_admin' ? 'Restaurant Admin' : r.charAt(0).toUpperCase() + r.slice(1)}</option>
                        ))}
                    </select>
                    {branches.length > 0 && (
                        <select
                            value={branchFilter}
                            onChange={e => setBranchFilter(e.target.value)}
                            className="bg-neutral-100 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-black focus:outline-none cursor-pointer"
                        >
                            <option value="all">All Branches</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    )}
                </div>
            )}

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0 mx-6 mb-5">
                <div className="overflow-y-auto no-scrollbar flex-1">
                    <table className="w-full text-left text-xs text-black">
                        <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200 sticky top-0 z-10 uppercase text-[10px] tracking-wider">
                            <tr>
                                <th className="px-4 py-3">ID</th>
                                <th className="px-4 py-3">Employee</th>
                                <th className="px-4 py-3">Role</th>
                                <th className="px-4 py-3">Contact</th>
                                <th className="px-4 py-3 text-center">
                                    <div className="inline-flex items-center justify-center gap-1">
                                        <span>PIN</span>
                                        <button
                                            type="button"
                                            onClick={toggleRevealAllPins}
                                            className="p-0.5 rounded hover:bg-neutral-200 text-neutral-500 hover:text-black transition-colors"
                                            title={showAllPins ? "Hide all staff PINs" : "Reveal all staff PINs"}
                                        >
                                            {showAllPins ? <LucideEyeOff size={13} className="text-blue-600" /> : <LucideEye size={13} />}
                                        </button>
                                    </div>
                                </th>
                                <th className="px-4 py-3">Branch</th>
                                <th className="px-4 py-3 text-right">Salary</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Weekly Off</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="px-4 py-10 text-center text-neutral-400 font-medium text-sm">
                                        {showDeleted ? 'No archived employees.' : searchQuery || roleFilter !== 'all' ? 'No employees match your filters.' : 'No employees found. Add one to get started!'}
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((emp) => (
                                    <tr key={emp.id} className="hover:bg-neutral-50/60 transition-colors">
                                        <td className="px-4 py-2.5 font-mono text-[10px] font-semibold text-neutral-400">
                                            {emp.employee_code || emp.employee_id || '—'}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-[11px] font-bold text-neutral-700 shrink-0">
                                                    {emp.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-semibold text-black truncate max-w-[160px]">{emp.name}</span>
                                                    {emp.email ? (
                                                        <span className="text-[11px] text-neutral-500 truncate max-w-[160px] flex items-center gap-1" title={emp.email}>
                                                            <LucideMail size={11} className="shrink-0 text-neutral-400" />
                                                            {emp.email}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-neutral-400 italic">No email</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <RoleBadge role={emp.role} />
                                        </td>
                                        <td className="px-4 py-2.5 text-neutral-600 text-[11px]">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-mono flex items-center gap-1 text-neutral-700">
                                                    <LucidePhone size={11} className="shrink-0 text-neutral-400" />
                                                    {emp.phone || '—'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            {emp.pin ? (
                                                <div className="inline-flex items-center justify-center gap-1.5">
                                                    <span className="font-mono text-[11px] font-bold text-neutral-800 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200 tracking-wider">
                                                        {revealedPins.has(emp.id) || showAllPins ? emp.pin : '••••'}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleRevealPin(emp.id)}
                                                        className="p-1 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                                                        title={revealedPins.has(emp.id) || showAllPins ? "Hide PIN" : "Reveal PIN"}
                                                    >
                                                        {revealedPins.has(emp.id) || showAllPins ? <LucideEyeOff size={13} /> : <LucideEye size={13} />}
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-neutral-300 font-mono text-[11px]">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-neutral-500">{emp.branch?.name || '—'}</td>
                                        <td className="px-4 py-2.5 text-right font-semibold text-black tabular-nums">
                                            {emp.monthly_salary && Number(emp.monthly_salary) > 0 ? `₹${Number(emp.monthly_salary).toLocaleString('en-IN')}` : '—'}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                emp.salary_type === 'daily' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                                            }`}>
                                                {emp.salary_type === 'daily' ? 'Daily' : 'Monthly'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-neutral-600 font-medium">{formatWeekday(emp.weekly_off)}</td>
                                        <td className="px-4 py-2.5">
                                            {showDeleted ? (
                                                <span className="text-[10px] text-red-500 font-bold uppercase">Deleted</span>
                                            ) : (
                                                <button
                                                    onClick={() => toggleStatus(emp)}
                                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                                                        emp.status === 'active'
                                                            ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                                            : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                                                    }`}
                                                >
                                                    {emp.status === 'active' ? <><LucideCheck size={10} /> Active</> : <><LucideX size={10} /> Inactive</>}
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            {showDeleted ? (
                                                <div className="flex justify-end gap-1">
                                                    <button
                                                        onClick={() => handleRestore(emp.id)}
                                                        className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold rounded transition-colors cursor-pointer"
                                                    >
                                                        Restore
                                                    </button>
                                                    <button
                                                        onClick={() => openDeleteModal(emp, true)}
                                                        className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded transition-colors cursor-pointer"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex justify-end gap-1">
                                                    <button
                                                        onClick={() => handleEdit(emp)}
                                                        className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                                                        title="Edit"
                                                    >
                                                        <LucideEdit size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => openDeleteModal(emp, false)}
                                                        className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                                        title="Delete"
                                                    >
                                                        <LucideTrash2 size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <EmployeeModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => loadData(true)}
                employee={selectedEmployee}
                branches={branches}
                isOwner={isOwner}
            />

            <DeleteStaffModal
                isOpen={deleteModal.isOpen}
                onClose={() => !deleteModal.isLoading && setDeleteModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={handleConfirmDelete}
                staffName={deleteModal.employee?.name || ''}
                staffRole={deleteModal.employee?.role}
                staffPhone={deleteModal.employee?.phone}
                employeeId={deleteModal.employee?.employee_id}
                isPermanent={deleteModal.isPermanent}
                isLoading={deleteModal.isLoading}
            />
        </div>
    );
}

function RoleBadge({ role }: { role: string }) {
    const styles: Record<string, string> = {
        restaurant_admin: 'bg-orange-50 text-orange-700 border-orange-200',
        waiter: 'bg-blue-50 text-blue-700 border-blue-200',
        chef: 'bg-purple-50 text-purple-700 border-purple-200',
        supervisor: 'bg-teal-50 text-teal-700 border-teal-200',
        delivery_boy: 'bg-amber-50 text-amber-700 border-amber-200',
    };
    const label = role === 'delivery_boy' ? 'Delivery' : role === 'restaurant_admin' ? 'Admin' : role;
    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border capitalize ${styles[role] || 'bg-neutral-50 border-neutral-200 text-neutral-600'}`}>
            {label}
        </span>
    );
}
