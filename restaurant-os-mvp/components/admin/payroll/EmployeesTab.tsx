'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
    UserPlus as LucideUserPlus, 
    Edit as LucideEdit, 
    Trash2 as LucideTrash2, 
    Check as LucideCheck, 
    X as LucideX, 
    Key as LucideKey 
} from 'lucide-react';
import { PayrollService, Employee, Branch } from '@/services/payroll.service';
import { StaffService } from '@/services/staff.service';
import { createClient } from '@/lib/supabase';
import { getCached, setCache, hasFreshCache } from '@/lib/data-cache';
import { requestManager } from '@/lib/cache/request-manager';
import { SyncIndicator } from '@/components/admin/SyncIndicator';
import EmployeeModal from './EmployeeModal';
import DeleteStaffModal from './DeleteStaffModal';

interface EmployeesTabProps {
    restaurantId: string;
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

    // Custom Delete Confirmation Modal State
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

        const currentCached = getCached<any>(cacheKey);
        if (currentCached && employees.length === 0 && !showDeleted) {
            setEmployees(currentCached.employees || []);
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
                const mappedList: Employee[] = deletedList.map(s => ({
                    id: s.id,
                    restaurant_id: restaurantId,
                    name: s.name,
                    phone: s.mobile || '',
                    role: s.role,
                    branch_id: s.branch_id || null,
                    monthly_salary: s.monthly_salary || 0,
                    per_day_salary: s.per_day_salary || null,
                    overtime_per_hour: s.overtime_per_hour || null,
                    joining_date: s.joining_date || '',
                    status: s.status === 'active' ? 'active' : 'inactive',
                    employee_id: s.employee_id || null
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
                    setEmployees(data.employees);
                    setCache(cacheKey, data, { ttlMs: 15 * 60 * 1000 });
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
                        loadData();
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

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-neutral-500 font-medium">
                Loading employees...
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 space-y-4">
            <div className="flex justify-between items-center px-6 pt-6 shrink-0">
                <div>
                    <h3 className="text-lg font-bold text-black">
                        {showDeleted ? 'Archived / Soft-Deleted Staff' : 'Employee Directory'}
                    </h3>
                    <p className="text-xs text-neutral-500">
                        {showDeleted 
                            ? 'List of soft-deleted employees. You can restore them to reactivate their access.' 
                            : 'Manage employee base pay rates, overtime hourly rates, and assigned branches.'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <SyncIndicator isSyncing={isSyncing} lastSync={lastSync} onRefresh={() => loadData(true)} />
                    <button
                        onClick={() => setShowDeleted(!showDeleted)}
                        className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${
                            showDeleted 
                                ? 'bg-neutral-800 text-white border-neutral-800 hover:bg-neutral-900' 
                                : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                        }`}
                    >
                        {showDeleted ? 'Show Active Staff' : 'Show Deleted Staff'}
                    </button>
                    {!showDeleted && (
                        <button
                            onClick={handleAdd}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-600/10 gap-2"
                        >
                            <LucideUserPlus size={16} />
                            Add Employee
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-neutral-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0 mx-6 mb-6">
                <div className="overflow-y-auto no-scrollbar flex-1">
                    <table className="w-full text-left text-sm text-black">
                        <thead className="bg-neutral-50 text-black font-medium border-b border-neutral-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4">Emp ID</th>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Availability</th>
                                <th className="px-6 py-4">Current Workload</th>
                                <th className="px-6 py-4">Phone</th>
                                <th className="px-6 py-4">Branch</th>
                                <th className="px-6 py-4">Monthly Salary</th>
                                <th className="px-6 py-4">Per Day Salary</th>
                                <th className="px-6 py-4">Overtime Rate</th>
                                <th className="px-6 py-4">Account Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                            {employees.length === 0 ? (
                                <tr>
                                    <td colSpan={12} className="px-6 py-12 text-center text-neutral-500 font-medium">
                                        {showDeleted ? 'No soft-deleted employees found.' : 'No employees found. Add one to get started!'}
                                    </td>
                                </tr>
                            ) : (
                                employees.map((emp) => (
                                    <tr key={emp.id} className="hover:bg-neutral-50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-xs font-semibold text-neutral-600">
                                            {emp.employee_id || '-'}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-black">
                                            {emp.name}
                                        </td>
                                        <td className="px-6 py-4">
                                            {emp.role === 'delivery_boy' ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                                    Delivery Boy
                                                </span>
                                            ) : (
                                                <span className="capitalize text-xs font-medium text-neutral-700">
                                                    {emp.role}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {emp.is_online ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                    Online
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-500 border border-neutral-200">
                                                    <span className="w-2 h-2 rounded-full bg-neutral-400" />
                                                    Offline
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {emp.role === 'waiter' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-neutral-100 text-neutral-800 border border-neutral-200">
                                                    <span>{emp.active_tables_count || 0} Tables</span>
                                                    <span className="text-neutral-300">•</span>
                                                    <span>{emp.active_orders_count || 0} Orders</span>
                                                </span>
                                            ) : emp.role === 'delivery_boy' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                                    <span>Delivery Driver</span>
                                                </span>
                                            ) : (
                                                <span className="text-xs text-neutral-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-neutral-600 font-mono text-xs">{emp.phone}</td>
                                        <td className="px-6 py-4 text-neutral-600">{emp.branch?.name || '-'}</td>
                                        <td className="px-6 py-4 font-semibold text-black">₹{emp.monthly_salary.toLocaleString('en-IN')}</td>
                                        <td className="px-6 py-4 text-neutral-600">₹{emp.per_day_salary ? emp.per_day_salary.toLocaleString('en-IN') : '-'}</td>
                                        <td className="px-6 py-4 text-neutral-600">
                                            {emp.overtime_per_hour ? `₹${emp.overtime_per_hour}/hr` : '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {showDeleted ? (
                                                <span className="text-xs text-red-500 font-semibold uppercase">Deleted</span>
                                            ) : (
                                                <button
                                                    onClick={() => toggleStatus(emp)}
                                                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider transition-colors ${
                                                        emp.status === 'active'
                                                            ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                                            : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                                                    }`}
                                                >
                                                    {emp.status === 'active' ? (
                                                        <span className="flex items-center gap-1">
                                                            <LucideCheck size={12} /> Active
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1">
                                                            <LucideX size={12} /> Inactive
                                                        </span>
                                                    )}
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {showDeleted ? (
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleRestore(emp.id)}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
                                                        title="Restore Employee"
                                                    >
                                                        <LucideCheck size={13} />
                                                        Restore
                                                    </button>
                                                    <button
                                                        onClick={() => openDeleteModal(emp, true)}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
                                                        title="Permanently Delete Employee"
                                                    >
                                                        <LucideTrash2 size={13} />
                                                        Delete Forever
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEdit(emp)}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                                                        title="Edit Employee"
                                                    >
                                                        <LucideEdit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => openDeleteModal(emp, false)}
                                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                                        title="Delete Employee"
                                                    >
                                                        <LucideTrash2 size={16} />
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
                onSuccess={loadData}
                employee={selectedEmployee}
                branches={branches}
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
