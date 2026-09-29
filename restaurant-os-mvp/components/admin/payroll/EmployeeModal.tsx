'use client';

import { useState, useEffect } from 'react';
import { X as LucideX, Loader2 as LucideLoader2, Clipboard, Check, Bike as LucideBike } from 'lucide-react';
import { PayrollService, Employee, Branch } from '@/services/payroll.service';
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
}

export default function EmployeeModal({ isOpen, onClose, onSuccess, employee, branches }: EmployeeModalProps) {
    const { restaurantId } = useRestaurantId();
    const [loading, setLoading] = useState(false);
    const [activationLink, setActivationLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        role: 'waiter',
        branch_id: '' as string,
        monthly_salary: 0,
        per_day_salary: '' as string | number,
        overtime_per_hour: '' as string | number,
        joining_date: new Date().toISOString().split('T')[0],
        status: 'active' as 'active' | 'inactive',
        vehicle_type: 'Motorcycle',
        vehicle_number: ''
    });

    useEffect(() => {
        setActivationLink(null);
        setCopied(false);
        if (employee) {
            setFormData({
                name: employee.name,
                email: (employee as any).email || '',
                phone: employee.phone,
                role: employee.role,
                branch_id: employee.branch_id || '',
                monthly_salary: employee.monthly_salary,
                per_day_salary: employee.per_day_salary !== null ? employee.per_day_salary : '',
                overtime_per_hour: employee.overtime_per_hour !== null ? employee.overtime_per_hour : '',
                joining_date: employee.joining_date ? employee.joining_date.split('T')[0] : new Date().toISOString().split('T')[0],
                status: employee.status,
                vehicle_type: (employee as any).vehicle_type || 'Motorcycle',
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
                                vehicle_type: data.vehicle_type || 'Motorcycle',
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
                role: 'waiter',
                branch_id: '',
                monthly_salary: 0,
                per_day_salary: '',
                overtime_per_hour: '',
                joining_date: new Date().toISOString().split('T')[0],
                status: 'active',
                vehicle_type: 'Motorcycle',
                vehicle_number: ''
            });
        }
    }, [employee, isOpen]);

    const handleMonthlySalaryChange = (val: number) => {
        const perDay = val > 0 ? Number((val / 30).toFixed(2)) : 0;
        setFormData(prev => ({
            ...prev,
            monthly_salary: val,
            per_day_salary: prev.per_day_salary === '' || prev.per_day_salary === Number((prev.monthly_salary / 30).toFixed(2)) ? perDay : prev.per_day_salary
        }));
    };

    if (!isOpen) return null;

    const copyToClipboard = () => {
        if (!activationLink) return;
        const fullLink = `${window.location.origin}${activationLink}`;
        navigator.clipboard.writeText(fullLink);
        setCopied(true);
        toast.success('Activation link copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!restaurantId) {
            toast.error('Restaurant context not found.');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                restaurant_id: restaurantId,
                name: formData.name,
                email: formData.email || null,
                mobile: formData.phone || null,
                role: formData.role,
                branch_id: formData.branch_id || null,
                monthly_salary: Number(formData.monthly_salary),
                per_day_salary: formData.per_day_salary !== '' ? Number(formData.per_day_salary) : null,
                overtime_per_hour: formData.overtime_per_hour !== '' ? Number(formData.overtime_per_hour) : null,
                joining_date: formData.joining_date,
                status: formData.status,
                vehicle_type: formData.role === 'delivery_boy' ? formData.vehicle_type : null,
                vehicle_number: formData.role === 'delivery_boy' ? formData.vehicle_number : null,
            };

            if (employee) {
                await StaffService.updateStaff(employee.id, restaurantId, {
                    name: payload.name,
                    email: payload.email || undefined,
                    mobile: payload.mobile || undefined,
                    role: payload.role,
                    branch_id: payload.branch_id || undefined,
                    monthly_salary: payload.monthly_salary,
                    per_day_salary: payload.per_day_salary || undefined,
                    overtime_per_hour: payload.overtime_per_hour || undefined,
                    joining_date: payload.joining_date,
                    status: payload.status as any,
                    vehicle_type: payload.vehicle_type || undefined,
                    vehicle_number: payload.vehicle_number || undefined,
                } as any);
                toast.success('Employee updated successfully');
                onSuccess();
                onClose();
            } else {
                const res = await StaffService.createStaff(payload as any);
                if (res.activationLink) {
                    setActivationLink(res.activationLink);
                    toast.success('Employee created! Please copy the activation link.');
                } else {
                    toast.success('Employee created successfully');
                    onSuccess();
                    onClose();
                }
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
                    <h3 className="text-lg font-bold text-black">{employee ? 'Edit Employee Profile' : 'Add New Employee'}</h3>
                    <button onClick={onClose} className="text-neutral-400 hover:text-black">
                        <LucideX size={20} />
                    </button>
                </div>

                {activationLink ? (
                    <div className="p-6 space-y-6 text-center">
                        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto text-green-500">
                            <Check size={32} />
                        </div>
                        <div>
                            <h4 className="text-lg font-black text-black">Activation Link Generated</h4>
                            <p className="text-neutral-500 text-xs mt-1.5 px-4">
                                Copy the link below and send it to the employee. They will use this link to set their password and configure TOTP MFA.
                            </p>
                        </div>

                        <div className="flex gap-2 bg-neutral-50 border border-neutral-200 rounded-xl p-3 items-center">
                            <input 
                                readOnly
                                className="bg-transparent flex-1 text-xs text-neutral-600 font-mono focus:outline-none select-all"
                                value={`${window.location.origin}${activationLink}`}
                            />
                            <button
                                onClick={copyToClipboard}
                                className="p-2 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-500 hover:text-black transition-colors"
                            >
                                {copied ? <Check size={16} className="text-green-500" /> : <Clipboard size={16} />}
                            </button>
                        </div>

                        <button
                            onClick={() => {
                                onSuccess();
                                onClose();
                            }}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors shadow-md"
                        >
                            Done & Close
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto no-scrollbar">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">Full Name *</label>
                                <input
                                    type="text"
                                    required
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
                                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500 text-black text-sm bg-white"
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="waiter">Waiter</option>
                                    <option value="chef">Chef</option>
                                    <option value="supervisor">Supervisor</option>
                                    <option value="delivery_boy">Delivery Boy</option>
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
                                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">Monthly Salary *</label>
                                <input
                                    type="number"
                                    required
                                    min={0}
                                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500 text-black text-sm"
                                    value={formData.monthly_salary}
                                    onChange={e => handleMonthlySalaryChange(Number(e.target.value))}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">Per Day Salary</label>
                                <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    placeholder="Auto-calculated"
                                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500 text-black text-sm"
                                    value={formData.per_day_salary}
                                    onChange={e => setFormData({ ...formData, per_day_salary: e.target.value })}
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
                                    value={formData.overtime_per_hour}
                                    onChange={e => setFormData({ ...formData, overtime_per_hour: e.target.value })}
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
                )}
            </div>
        </div>
    );
}
