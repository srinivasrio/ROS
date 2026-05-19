'use client';

import { useState, useEffect } from 'react';
import { UserPlus as LucideUserPlus, Edit as LucideEdit, Trash2 as LucideTrash2, Check as LucideCheck, X as LucideX } from 'lucide-react';
import { PayrollService, Employee, Branch } from '@/app/services/payroll';
import EmployeeModal from './EmployeeModal';

interface EmployeesTabProps {
    restaurantId: string;
}

export default function EmployeesTab({ restaurantId }: EmployeesTabProps) {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | undefined>();

    const loadData = async () => {
        setLoading(true);
        try {
            const [empList, branchList] = await Promise.all([
                PayrollService.fetchEmployees(restaurantId),
                PayrollService.fetchBranches(restaurantId)
            ]);
            setEmployees(empList);
            setBranches(branchList);
        } catch (error) {
            console.error('Failed to load employee tab data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (restaurantId) {
            loadData();
        }
    }, [restaurantId]);

    const handleAdd = () => {
        setSelectedEmployee(undefined);
        setIsModalOpen(true);
    };

    const handleEdit = (employee: Employee) => {
        setSelectedEmployee(employee);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this employee?')) return;
        try {
            await PayrollService.deleteEmployee(id);
            loadData();
        } catch (error) {
            alert('Failed to delete employee.');
        }
    };

    const toggleStatus = async (employee: Employee) => {
        const nextStatus = employee.status === 'active' ? 'inactive' : 'active';
        try {
            await PayrollService.updateEmployee(employee.id, { status: nextStatus });
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
                    <h3 className="text-lg font-bold text-black">Employee Directory</h3>
                    <p className="text-xs text-neutral-500">Manage employee base pay rates, overtime hourly rates, and assigned branches.</p>
                </div>
                <button
                    onClick={handleAdd}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-600/10 gap-2"
                >
                    <LucideUserPlus size={16} />
                    Add Employee
                </button>
            </div>

            <div className="bg-white rounded-[2rem] border border-neutral-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0 mx-6 mb-6">
                <div className="overflow-y-auto no-scrollbar flex-1">
                    <table className="w-full text-left text-sm text-black">
                        <thead className="bg-neutral-50 text-black font-medium border-b border-neutral-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4">Emp ID</th>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Phone</th>
                                <th className="px-6 py-4">Branch</th>
                                <th className="px-6 py-4">Monthly Salary</th>
                                <th className="px-6 py-4">Per Day Salary</th>
                                <th className="px-6 py-4">Overtime Rate</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                            {employees.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-6 py-12 text-center text-neutral-500 font-medium">
                                        No employees found. Add one to get started!
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
                                        <td className="px-6 py-4 capitalize text-xs font-medium text-neutral-700">{emp.role}</td>
                                        <td className="px-6 py-4 text-neutral-600 font-mono text-xs">{emp.phone}</td>
                                        <td className="px-6 py-4 text-neutral-600">{emp.branch?.name || '-'}</td>
                                        <td className="px-6 py-4 font-semibold text-black">₹{emp.monthly_salary.toLocaleString('en-IN')}</td>
                                        <td className="px-6 py-4 text-neutral-600">₹{emp.per_day_salary ? emp.per_day_salary.toLocaleString('en-IN') : '-'}</td>
                                        <td className="px-6 py-4 text-neutral-600">
                                            {emp.overtime_per_hour ? `₹${emp.overtime_per_hour}/hr` : '-'}
                                        </td>
                                        <td className="px-6 py-4">
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
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(emp)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                >
                                                    <LucideEdit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(emp.id)}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                >
                                                    <LucideTrash2 size={16} />
                                                </button>
                                            </div>
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
        </div>
    );
}
