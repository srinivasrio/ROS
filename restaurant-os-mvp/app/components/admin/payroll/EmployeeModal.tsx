'use client';

import { useState, useEffect } from 'react';
import { X as LucideX, Loader2 as LucideLoader2 } from 'lucide-react';
import { PayrollService, Employee, Branch } from '@/app/services/payroll';
import { useRestaurantId } from '@/app/hooks/useRestaurantId';

interface EmployeeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    employee?: Employee;
    branches: Branch[];
}

export default function EmployeeModal({ isOpen, onClose, onSuccess, employee, branches }: EmployeeModalProps) {
    const { restaurantId } = useRestaurantId();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        employee_id: '',
        name: '',
        phone: '',
        role: 'waiter',
        branch_id: '' as string,
        monthly_salary: 0,
        per_day_salary: '' as string | number,
        overtime_per_hour: '' as string | number,
        joining_date: new Date().toISOString().split('T')[0],
        status: 'active' as 'active' | 'inactive'
    });

    useEffect(() => {
        if (employee) {
            setFormData({
                employee_id: employee.employee_id || '',
                name: employee.name,
                phone: employee.phone,
                role: employee.role,
                branch_id: employee.branch_id || '',
                monthly_salary: employee.monthly_salary,
                per_day_salary: employee.per_day_salary !== null ? employee.per_day_salary : '',
                overtime_per_hour: employee.overtime_per_hour !== null ? employee.overtime_per_hour : '',
                joining_date: employee.joining_date ? employee.joining_date.split('T')[0] : new Date().toISOString().split('T')[0],
                status: employee.status
            });
        } else {
            setFormData({
                employee_id: '',
                name: '',
                phone: '',
                role: 'waiter',
                branch_id: '',
                monthly_salary: 0,
                per_day_salary: '',
                overtime_per_hour: '',
                joining_date: new Date().toISOString().split('T')[0],
                status: 'active'
            });
        }
    }, [employee, isOpen]);

    // Automatically calculate per day salary as monthly_salary / 30 when monthly_salary changes (if per_day_salary is not manually filled)
    const handleMonthlySalaryChange = (val: number) => {
        const perDay = val > 0 ? Number((val / 30).toFixed(2)) : 0;
        setFormData(prev => ({
            ...prev,
            monthly_salary: val,
            per_day_salary: prev.per_day_salary === '' || prev.per_day_salary === Number((prev.monthly_salary / 30).toFixed(2)) ? perDay : prev.per_day_salary
        }));
    };

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!restaurantId) {
            alert('Restaurant context not found.');
            return;
        }
        if (!formData.employee_id.trim()) {
            alert('Employee ID is required.');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                restaurant_id: restaurantId,
                name: formData.name,
                phone: formData.phone,
                role: formData.role,
                branch_id: formData.branch_id || null,
                monthly_salary: Number(formData.monthly_salary),
                per_day_salary: formData.per_day_salary !== '' ? Number(formData.per_day_salary) : null,
                overtime_per_hour: formData.overtime_per_hour !== '' ? Number(formData.overtime_per_hour) : null,
                joining_date: formData.joining_date,
                status: formData.status,
                employee_id: formData.employee_id.trim()
            };

            if (employee) {
                await PayrollService.updateEmployee(employee.id, payload);
            } else {
                await PayrollService.createEmployee(payload);
            }
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            alert(`Failed to ${employee ? 'update' : 'add'} employee`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b border-neutral-100">
                    <h3 className="text-lg font-bold text-black">{employee ? 'Edit Employee Profile' : 'Add New Employee'}</h3>
                    <button onClick={onClose} className="text-black hover:text-black">
                        <LucideX size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[80vh] overflow-y-auto no-scrollbar">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-black mb-1">Full Name *</label>
                            <input
                                type="text"
                                required
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-black mb-1">Employee ID *</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. EMP001"
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm"
                                value={formData.employee_id}
                                onChange={e => setFormData({ ...formData, employee_id: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-black mb-1">Phone Number *</label>
                            <input
                                type="tel"
                                required
                                placeholder="10 digit mobile"
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-black mb-1">Role *</label>
                            <select
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm"
                                value={formData.role}
                                onChange={e => setFormData({ ...formData, role: e.target.value })}
                            >
                                <option value="waiter">Waiter</option>
                                <option value="chef">Chef</option>
                                <option value="manager">Manager</option>
                                <option value="cashier">Cashier</option>
                                <option value="cleaner">Cleaner</option>
                                <option value="security">Security</option>
                                <option value="other">Other</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-black mb-1">Branch</label>
                            <select
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm"
                                value={formData.branch_id}
                                onChange={e => setFormData({ ...formData, branch_id: e.target.value })}
                            >
                                <option value="">Select Branch</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-black mb-1">Status</label>
                            <select
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm"
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-black mb-1">Monthly Salary *</label>
                            <input
                                type="number"
                                required
                                min={0}
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm"
                                value={formData.monthly_salary}
                                onChange={e => handleMonthlySalaryChange(Number(e.target.value))}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-black mb-1">Per Day Salary (optional)</label>
                            <input
                                type="number"
                                min={0}
                                step="0.01"
                                placeholder="Auto calculated if empty"
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm"
                                value={formData.per_day_salary}
                                onChange={e => setFormData({ ...formData, per_day_salary: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-black mb-1">Overtime Per Hour (optional)</label>
                            <input
                                type="number"
                                min={0}
                                step="0.01"
                                placeholder="e.g. 150"
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm"
                                value={formData.overtime_per_hour}
                                onChange={e => setFormData({ ...formData, overtime_per_hour: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-black mb-1">Joining Date *</label>
                            <input
                                type="date"
                                required
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm"
                                value={formData.joining_date}
                                onChange={e => setFormData({ ...formData, joining_date: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-neutral-300 text-black font-medium rounded-lg hover:bg-neutral-50 text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center text-sm"
                        >
                            {loading ? <LucideLoader2 className="animate-spin" size={18} /> : (employee ? 'Update Employee' : 'Create Employee')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
