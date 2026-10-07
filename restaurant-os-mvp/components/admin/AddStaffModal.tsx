'use client';

import { useState, useEffect } from 'react';
import { X as LucideX, Loader2 as LucideLoader2, Bike as LucideBike, Eye as LucideEye, EyeOff as LucideEyeOff } from 'lucide-react';
import { StaffService, Staff } from '@/services/staff.service';
import { useRestaurantId } from '@/hooks/useRestaurantId';
import { createClient } from '@/lib/supabase';

interface StaffModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    staff?: Staff;
    isOwner?: boolean;
}

export default function StaffModal({ isOpen, onClose, onSuccess, staff, isOwner }: StaffModalProps) {
    const { restaurantId } = useRestaurantId();
    const [loading, setLoading] = useState(false);
    const [showPin, setShowPin] = useState(false);
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
        name: staff?.name || '',
        email: staff?.email || '',
        role: staff?.role || '',
        mobile: staff?.mobile || '',
        pin: staff?.pin || '',
        status: staff?.status || 'active',
        address: staff?.address || '',
        aadhaar_id: staff?.aadhaar_id || '',
        vehicle_type: staff?.vehicle_type || '',
        vehicle_number: staff?.vehicle_number || '',
    });

    // Reset form when staff prop changes
    useEffect(() => {
        if (staff) {
            setFormData({
                name: staff.name,
                email: staff.email || '',
                role: staff.role || '',
                mobile: staff.mobile || '',
                pin: '', // Never load hashed PIN into input
                status: staff.status || 'active',
                address: staff.address || '',
                aadhaar_id: staff.aadhaar_id || '',
                vehicle_type: staff.vehicle_type || '',
                vehicle_number: staff.vehicle_number || '',
            });

            if (staff.role === 'delivery_boy') {
                const supabase = createClient();
                supabase
                    .from('delivery_boys')
                    .select('vehicle_type, vehicle_number')
                    .eq('employee_id', staff.id)
                    .maybeSingle()
                    .then(({ data }) => {
                        if (data) {
                            setFormData(prev => ({
                                ...prev,
                                vehicle_type: data.vehicle_type || '',
                                vehicle_number: data.vehicle_number || '',
                            }));
                        }
                    });
            }
        } else {
            setFormData({
                name: '',
                email: '',
                role: '',
                mobile: '',
                pin: '',
                status: 'active',
                address: '',
                aadhaar_id: '',
                vehicle_type: '',
                vehicle_number: '',
            });
        }
    }, [staff]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!restaurantId) {
            alert('Restaurant ID not found. Please try again.');
            return;
        }

        if (['admin', 'restaurant_admin'].includes(formData.role) && !currentUserIsOwner) {
            alert('Only restaurant owners can create or assign administrator accounts.');
            return;
        }

        setLoading(true);
        try {
            const cleanPin = formData.pin.trim();
            if (cleanPin && !/^\d{4,6}$/.test(cleanPin)) {
                alert('Security PIN must be a 4 to 6 digit numeric code.');
                setLoading(false);
                return;
            }

            const submitData: any = {
                ...formData,
                email: formData.email?.trim() ? formData.email.toLowerCase().trim() : null,
                vehicle_type: formData.role === 'delivery_boy' ? formData.vehicle_type : null,
                vehicle_number: formData.role === 'delivery_boy' ? formData.vehicle_number : null,
            };

            // If editing and no new PIN entered, do not overwrite existing PIN
            if (staff && !cleanPin) {
                delete submitData.pin;
            } else if (cleanPin) {
                submitData.pin = cleanPin;
            }

            if (staff) {
                await StaffService.updateStaff(staff.id, restaurantId, submitData);
            } else {
                await StaffService.createStaff({
                    ...submitData,
                    pin: cleanPin || '1234',
                    restaurant_id: restaurantId
                });
            }
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            alert(`Failed to ${staff ? 'update' : 'add'} staff member`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b border-neutral-100">
                    <div>
                        <h3 className="text-lg font-bold text-black">{staff ? 'Edit Staff Profile' : 'Add New Staff'}</h3>
                        {staff && (
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="font-mono text-xs font-semibold text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded">
                                    {staff.employee_code || staff.employee_id || 'ID Pending'}
                                </span>
                                {staff.internal_id && (
                                    <span className="font-mono text-[10px] text-neutral-400" title={`Internal ID: ${staff.internal_id}`}>
                                        ({staff.internal_id.slice(0, 12)}...)
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} className="text-black hover:text-black">
                        <LucideX size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[80vh] overflow-y-auto no-scrollbar">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-black mb-1">Full Name</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Rahul Sharma"
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-black mb-1">Role</label>
                            <select
                                required
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                value={formData.role ? (['waiter', 'chef', 'admin', 'restaurant_admin', 'supervisor', 'delivery_boy'].includes(formData.role) ? formData.role : 'other') : ''}
                                onChange={e => {
                                    const val = e.target.value;
                                    setFormData({ ...formData, role: val === 'other' ? '' : val });
                                }}
                            >
                                <option value="">Select Role</option>
                                <option value="waiter">Waiter</option>
                                <option value="chef">Chef</option>
                                {currentUserIsOwner ? (
                                    <>
                                        <option value="admin">Admin</option>
                                        <option value="restaurant_admin">Restaurant Admin</option>
                                    </>
                                ) : (formData.role === 'admin' || formData.role === 'restaurant_admin') ? (
                                    <option value={formData.role} disabled>
                                        {formData.role === 'restaurant_admin' ? 'Restaurant Admin' : 'Admin'} (Owner only)
                                    </option>
                                ) : null}
                                <option value="supervisor">Supervisor</option>
                                <option value="delivery_boy">Delivery Boy</option>
                                <option value="other">Other / Custom</option>
                            </select>
                        </div>

                        {Boolean(formData.role) && !['waiter', 'chef', 'admin', 'restaurant_admin', 'supervisor', 'delivery_boy'].includes(formData.role) && (
                            <div>
                                <label className="block text-sm font-medium text-black mb-1">Custom Role Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Captain, Cleaner"
                                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                />
                            </div>
                        )}

                        {formData.role === 'delivery_boy' && (
                            <div className="col-span-2 p-3 bg-amber-50/80 border border-amber-200 rounded-lg space-y-2">
                                <div className="flex items-center gap-1.5 text-amber-900 text-xs font-bold">
                                    <LucideBike size={14} className="text-amber-600" />
                                    <span>Delivery Vehicle Information</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-neutral-600 mb-1">Vehicle Type</label>
                                        <select
                                            className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs text-black bg-white"
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
                                        <label className="block text-xs font-medium text-neutral-600 mb-1">Vehicle Number</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. MH 02 AB 1234"
                                            className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs text-black uppercase"
                                            value={formData.vehicle_number}
                                            onChange={e => setFormData({ ...formData, vehicle_number: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-black mb-1">Status</label>
                            <select
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value as Staff['status'] })}
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-black mb-1">Email Address</label>
                            <input
                                type="email"
                                placeholder="employee@dineinone.com"
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-black mb-1">Mobile Number</label>
                            <input
                                type="tel"
                                required
                                pattern="[0-9]{10}"
                                placeholder="10 digit mobile number"
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.mobile}
                                onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-black mb-1">
                                Security PIN {staff ? '(Leave blank to keep current)' : '(4-6 digits)'}
                            </label>
                            <div className="relative">
                                <input
                                    type={showPin ? "text" : "password"}
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    placeholder={staff?.pin ? (showPin ? `Current: ${staff.pin}` : '•••• (Unchanged)') : 'Enter 4-6 digit PIN'}
                                    className="w-full px-3 py-2 pr-10 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                    value={formData.pin}
                                    onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/[^0-9]/g, '') })}
                                    required={!staff}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPin(!showPin)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 transition-colors p-0.5"
                                    title={showPin ? "Hide PIN" : "Show PIN"}
                                >
                                    {showPin ? <LucideEyeOff size={16} /> : <LucideEye size={16} />}
                                </button>
                            </div>
                            <p className="text-[10px] text-neutral-500 mt-1">
                                {staff ? (staff.pin ? `Current PIN: ${showPin ? staff.pin : '••••'}. Enter new PIN only to change.` : 'Enter a new 4-6 digit numeric PIN.') : 'Employee uses this PIN to log into their panel.'}
                            </p>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-black mb-1">Aadhaar / ID Number</label>
                            <input
                                type="text"
                                placeholder="12 digit Aadhaar or ID"
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.aadhaar_id}
                                onChange={e => setFormData({ ...formData, aadhaar_id: e.target.value })}
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-black mb-1">Residential Address</label>
                            <textarea
                                rows={3}
                                placeholder="Residential address"
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                value={formData.address}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-neutral-300 text-black font-medium rounded-lg hover:bg-neutral-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center"
                        >
                            {loading ? <LucideLoader2 className="animate-spin" size={18} /> : (staff ? 'Update Profile' : 'Create Staff')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
