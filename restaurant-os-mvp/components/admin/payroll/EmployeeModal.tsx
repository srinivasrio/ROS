'use client';

import { useState, useEffect } from 'react';
import { X as LucideX, Loader2 as LucideLoader2, Bike as LucideBike } from 'lucide-react';
import { Employee, Branch } from '@/services/payroll.service';
import { StaffService } from '@/services/staff.service';
import { useRestaurantId } from '@/hooks/useRestaurantId';
import { createClient } from '@/lib/supabase';
import { toast } from 'sonner';

interface EmployeeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    employee?: Employee;
    branches: Branch[];
    isOwner?: boolean;
}

const WEEKDAYS = [
    { value: 'sunday', label: 'Sunday' },
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'none', label: 'None (No weekly off)' }
];

function formatNumberOrEmpty(val: string | number | null | undefined): string {
    if (val === null || val === undefined || val === '') return '';
    const num = Number(val);
    if (isNaN(num) || num <= 0) return '';
    return String(val);
}

export default function EmployeeModal({ isOpen, onClose, onSuccess, employee, branches, isOwner }: EmployeeModalProps) {
    const { restaurantId } = useRestaurantId();
    const [loading, setLoading] = useState(false);
    const [currentUserIsOwner, setCurrentUserIsOwner] = useState<boolean>(isOwner ?? false);

    useEffect(() => {
        if (typeof isOwner === 'boolean') {
            setCurrentUserIsOwner(isOwner);
            return;
        }
        fetch('/api/auth/session')
            .then(res => res.json())
            .then(data => {
                const role = (data?.user?.role || '').toLowerCase();
                const ownerRoles = ['owner', 'restaurant_owner', 'super_admin', 'superadmin'];
                setCurrentUserIsOwner(ownerRoles.includes(role));
            })
            .catch(() => setCurrentUserIsOwner(false));
    }, [isOwner]);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        role: '',
        branch_id: '' as string,
        salary_type: 'monthly' as 'monthly' | 'daily',
        weekly_off: '',
        monthly_salary: '',
        per_day_salary: '',
        overtime_per_hour: '',
        joining_date: '',
        status: 'active' as 'active' | 'inactive',
        vehicle_type: '',
        vehicle_number: ''
    });

    useEffect(() => {
        if (employee) {
            setFormData({
                name: employee.name || '',
                email: (employee as any).email || '',
                phone: employee.phone || '',
                role: employee.role || '',
                branch_id: (() => {
                    const match = branches.find(b => b.id === employee.branch_id || (b as any).internal_id === employee.branch_id);
                    return match ? match.id : (employee.branch_id || '');
                })(),
                salary_type: employee.salary_type || 'monthly',
                weekly_off: employee.weekly_off && employee.weekly_off !== 'none' ? employee.weekly_off : '',
                monthly_salary: formatNumberOrEmpty(employee.monthly_salary),
                per_day_salary: formatNumberOrEmpty(employee.per_day_salary),
                overtime_per_hour: formatNumberOrEmpty(employee.overtime_per_hour),
                joining_date: employee.joining_date ? employee.joining_date.split('T')[0] : '',
                status: employee.status || 'active',
                vehicle_type: (employee as any).vehicle_type || '',
                vehicle_number: (employee as any).vehicle_number || ''
            });

            // Fetch delivery boy vehicle details if role is delivery_boy
            if (employee.role === 'delivery_boy') {
                const supabase = createClient();
                supabase
                    .from('delivery_boys')
                    .select('vehicle_type, vehicle_number')
                    .eq('employee_id', employee.id)
                    .maybeSingle()
                    .then(({ data }) => {
                        if (data) {
                            setFormData(prev => ({
                                ...prev,
                                vehicle_type: data.vehicle_type || '',
                                vehicle_number: data.vehicle_number || ''
                            }));
                        }
                    });
            }
        } else {
            setFormData({
                name: '',
                email: '',
                phone: '',
                role: '',
                branch_id: '',
                salary_type: 'monthly',
                weekly_off: '',
                monthly_salary: '',
                per_day_salary: '',
                overtime_per_hour: '',
                joining_date: '',
                status: 'active',
                vehicle_type: '',
                vehicle_number: ''
            });
        }
    }, [employee, isOpen]);

    const handleMonthlySalaryChange = (val: string | number) => {
        const strVal = String(val);
        if (strVal === '' || strVal === '0' || Number(strVal) <= 0) {
            setFormData(prev => ({
                ...prev,
                monthly_salary: '',
                per_day_salary: ''
            }));
            return;
        }
        const num = Number(strVal);
        const perDay = num > 0 ? String(Number((num / 30).toFixed(2))) : '';
        setFormData(prev => ({
            ...prev,
            monthly_salary: strVal,
            per_day_salary: prev.per_day_salary === '' || prev.per_day_salary === String(Number((Number(prev.monthly_salary || 0) / 30).toFixed(2))) ? perDay : prev.per_day_salary
        }));
    };

    const handlePerDaySalaryChange = (val: string | number) => {
        const strVal = String(val);
        if (strVal === '' || strVal === '0' || Number(strVal) <= 0) {
            setFormData(prev => ({
                ...prev,
                per_day_salary: '',
                monthly_salary: prev.salary_type === 'daily' ? '' : prev.monthly_salary
            }));
            return;
        }
        const numVal = Number(strVal) || 0;
        setFormData(prev => ({
            ...prev,
            per_day_salary: strVal,
            monthly_salary: prev.salary_type === 'daily' ? (numVal > 0 ? String(Math.round(numVal * 30)) : '') : prev.monthly_salary
        }));
    };

    const handleOvertimeChange = (val: string | number) => {
        const strVal = String(val);
        if (strVal === '' || strVal === '0' || Number(strVal) <= 0) {
            setFormData(prev => ({
                ...prev,
                overtime_per_hour: ''
            }));
            return;
        }
        setFormData(prev => ({
            ...prev,
            overtime_per_hour: strVal
        }));
    };

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!restaurantId) {
            toast.error('Restaurant context not found.');
            return;
        }

        if (['admin', 'restaurant_admin'].includes(formData.role) && !currentUserIsOwner) {
            toast.error('Only restaurant owners can create or assign administrator accounts.');
            return;
        }

        setLoading(true);
        try {
            const cleanEmail = formData.email?.trim() ? formData.email.toLowerCase().trim() : null;
            const cleanMonthly = formData.monthly_salary !== '' && Number(formData.monthly_salary) > 0 ? Number(formData.monthly_salary) : 0;
            const cleanPerDay = formData.per_day_salary !== '' && Number(formData.per_day_salary) > 0 ? Number(formData.per_day_salary) : null;
            const cleanOvertime = formData.overtime_per_hour !== '' && Number(formData.overtime_per_hour) > 0 ? Number(formData.overtime_per_hour) : null;

            const payload = {
                restaurant_id: restaurantId,
                name: formData.name.trim(),
                email: cleanEmail,
                mobile: formData.phone || null,
                role: formData.role || 'waiter',
                branch_id: formData.branch_id || null,
                monthly_salary: cleanMonthly,
                per_day_salary: cleanPerDay,
                overtime_per_hour: cleanOvertime,
                joining_date: formData.joining_date || new Date().toISOString().split('T')[0],
                status: formData.status || 'active',
                weekly_off: formData.weekly_off || 'none',
                salary_type: formData.salary_type || 'monthly',
                vehicle_type: formData.role === 'delivery_boy' ? (formData.vehicle_type || 'Motorcycle') : null,
                vehicle_number: formData.role === 'delivery_boy' ? (formData.vehicle_number || null) : null,
            };

            if (employee) {
                // Preserve existing valid branch_id unless explicitly reassigned
                const branchToSubmit = formData.branch_id && formData.branch_id !== employee.branch_id
                    ? formData.branch_id
                    : undefined;

                await StaffService.updateStaff(employee.id, restaurantId, {
                    name: payload.name,
                    email: payload.email,
                    mobile: payload.mobile || undefined,
                    role: payload.role,
                    ...(branchToSubmit ? { branch_id: branchToSubmit } : {}),
                    monthly_salary: payload.monthly_salary,
                    per_day_salary: payload.per_day_salary || undefined,
                    overtime_per_hour: payload.overtime_per_hour || undefined,
                    joining_date: payload.joining_date,
                    status: payload.status as any,
                    weekly_off: payload.weekly_off,
                    salary_type: payload.salary_type,
                    vehicle_type: payload.vehicle_type || undefined,
                    vehicle_number: payload.vehicle_number || undefined,
                } as any);
                toast.success('Employee updated successfully');
                onSuccess();
                onClose();
            } else {
                await StaffService.createStaff(payload as any);
                toast.success('Employee created successfully');
                onSuccess();
                onClose();
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || `Failed to ${employee ? 'update' : 'add'} employee`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-neutral-200">
                <div className="flex justify-between items-center p-5 border-b border-neutral-100">
                    <div>
                        <h3 className="text-lg font-bold text-black">{employee ? 'Edit Employee Profile' : 'Add New Employee'}</h3>
                        {employee && (
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="font-mono text-xs font-semibold text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded">
                                    {employee.employee_code || employee.employee_id || 'ID Pending'}
                                </span>
                                {employee.internal_id && (
                                    <span className="font-mono text-[10px] text-neutral-400" title={`Internal ID: ${employee.internal_id}`}>
                                        ({employee.internal_id.slice(0, 12)}...)
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} className="text-neutral-400 hover:text-black">
                        <LucideX size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto no-scrollbar">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">Full Name *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Rahul Sharma"
                                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500 text-black text-sm"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">Email Address</label>
                                <input
                                    type="email"
                                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500 text-black text-sm"
                                    placeholder="employee@dineinone.com"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">Phone Number</label>
                                <input
                                    type="tel"
                                    placeholder="10 digit mobile"
                                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500 text-black text-sm"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">Role *</label>
                                <select
                                    required
                                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500 text-black text-sm bg-white capitalize"
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="">Select Role</option>
                                    <option value="waiter">Waiter</option>
                                    <option value="chef">Chef</option>
                                    <option value="supervisor">Supervisor</option>
                                    <option value="manager">Manager</option>
                                    <option value="cleaner">Cleaner</option>
                                    <option value="kitchen">Kitchen Staff</option>
                                    <option value="cashier">Cashier</option>
                                    <option value="delivery_boy">Delivery Boy</option>
                                    {currentUserIsOwner ? (
                                        <>
                                            <option value="restaurant_admin">Restaurant Admin</option>
                                            <option value="admin">Admin</option>
                                        </>
                                    ) : (formData.role === 'restaurant_admin' || formData.role === 'admin') ? (
                                        <option value={formData.role} disabled>
                                            {formData.role === 'restaurant_admin' ? 'Restaurant Admin' : 'Admin'} (Owner only)
                                        </option>
                                    ) : null}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">Branch</label>
                                <select
                                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500 text-black text-sm bg-white"
                                    value={formData.branch_id}
                                    onChange={e => setFormData({ ...formData, branch_id: e.target.value })}
                                >
                                    <option value="">Select Branch</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Weekly Off and Salary Type */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">Weekly Off Day</label>
                                <select
                                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500 text-black text-sm bg-white"
                                    value={formData.weekly_off}
                                    onChange={e => setFormData({ ...formData, weekly_off: e.target.value })}
                                >
                                    <option value="">Select Weekly Off Day</option>
                                    {WEEKDAYS.map(w => (
                                        <option key={w.value} value={w.value}>{w.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">Salary Type</label>
                                <select
                                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500 text-black text-sm bg-white capitalize"
                                    value={formData.salary_type}
                                    onChange={e => setFormData({ ...formData, salary_type: e.target.value as 'monthly' | 'daily' })}
                                >
                                    <option value="monthly">Monthly Fixed</option>
                                    <option value="daily">Daily Wage</option>
                                </select>
                            </div>

                            {formData.role === 'delivery_boy' && (
                                <div className="col-span-2 p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-3">
                                    <div className="flex items-center gap-2 text-amber-900 text-xs font-bold">
                                        <LucideBike size={16} className="text-amber-600" />
                                        <span>Delivery Vehicle Details</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-neutral-600 mb-1">Vehicle Type</label>
                                            <select
                                                className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:border-amber-500 text-black text-xs bg-white"
                                                value={formData.vehicle_type}
                                                onChange={e => setFormData({ ...formData, vehicle_type: e.target.value })}
                                            >
                                                <option value="">Select Vehicle Type</option>
                                                <option value="Motorcycle">Motorcycle</option>
                                                <option value="Scooter">Scooter</option>
                                                <option value="EV Scooter">EV Scooter</option>
                                                <option value="Bicycle">Bicycle</option>
                                                <option value="Car">Car</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-neutral-600 mb-1">Vehicle Plate / Registration</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. MH 02 AB 1234"
                                                className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:border-amber-500 text-black text-xs uppercase"
                                                value={formData.vehicle_number}
                                                onChange={e => setFormData({ ...formData, vehicle_number: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">
                                    {formData.salary_type === 'daily' ? 'Monthly Equivalent (Approx)' : 'Monthly Salary'}
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    placeholder="e.g. 20000"
                                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500 text-black text-sm"
                                    value={formatNumberOrEmpty(formData.monthly_salary)}
                                    onChange={e => handleMonthlySalaryChange(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">
                                    {formData.salary_type === 'daily' ? 'Per Day Wage' : 'Per Day Salary'}
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    placeholder="Auto-calculated"
                                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500 text-black text-sm"
                                    value={formatNumberOrEmpty(formData.per_day_salary)}
                                    onChange={e => handlePerDaySalaryChange(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">Overtime Per Hour</label>
                                <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    placeholder="e.g. 150"
                                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500 text-black text-sm"
                                    value={formatNumberOrEmpty(formData.overtime_per_hour)}
                                    onChange={e => handleOvertimeChange(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">Joining Date *</label>
                                <input
                                    type="date"
                                    required
                                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500 text-black text-sm"
                                    value={formData.joining_date}
                                    onChange={e => setFormData({ ...formData, joining_date: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-3 border border-neutral-200 text-neutral-700 font-bold rounded-xl hover:bg-neutral-50 text-sm transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl disabled:opacity-50 flex justify-center items-center text-sm transition-colors shadow-md shadow-blue-600/10"
                            >
                                {loading ? <LucideLoader2 className="animate-spin" size={18} /> : (employee ? 'Update Employee' : 'Create Employee')}
                            </button>
                        </div>
                    </form>
            </div>
        </div>
    );
}
