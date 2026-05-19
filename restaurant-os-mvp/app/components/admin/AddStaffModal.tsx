'use client';

import { useState, useEffect } from 'react';
import { X as LucideX, Loader2 as LucideLoader2 } from 'lucide-react';
import { StaffService, Staff } from '@/app/services/staff';
import { useRestaurantId } from '@/app/hooks/useRestaurantId';

interface StaffModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    staff?: Staff;
}

export default function StaffModal({ isOpen, onClose, onSuccess, staff }: StaffModalProps) {
    const { restaurantId } = useRestaurantId();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: staff?.name || '',
        role: staff?.role || 'waiter',
        mobile: staff?.mobile || '',
        pin: staff?.pin || '',
        status: staff?.status || 'active',
        address: staff?.address || '',
        aadhaar_id: staff?.aadhaar_id || '',
    });

    // Reset form when staff prop changes
    useEffect(() => {
        if (staff) {
            setFormData({
                name: staff.name,
                role: staff.role,
                mobile: staff.mobile,
                pin: staff.pin || '',
                status: staff.status,
                address: staff.address || '',
                aadhaar_id: staff.aadhaar_id || '',
            });
        } else {
            setFormData({
                name: '',
                role: 'waiter',
                mobile: '',
                pin: '',
                status: 'active',
                address: '',
                aadhaar_id: '',
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

        setLoading(true);
        try {
            if (staff) {
                await StaffService.updateStaff(staff.id, restaurantId, formData);
            } else {
                await StaffService.createStaff({
                    ...formData,
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
                    <h3 className="text-lg font-bold text-black">{staff ? 'Edit Staff Profile' : 'Add New Staff'}</h3>
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
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-black mb-1">Role</label>
                            <select
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={['waiter', 'chef', 'admin', 'manager'].includes(formData.role) ? formData.role : 'other'}
                                onChange={e => {
                                    const val = e.target.value;
                                    setFormData({ ...formData, role: val === 'other' ? '' : val });
                                }}
                            >
                                <option value="waiter">Waiter</option>
                                <option value="chef">Chef</option>
                                <option value="admin">Admin</option>
                                <option value="manager">Manager</option>
                                <option value="other">Other / Custom</option>
                            </select>
                        </div>

                        {!['waiter', 'chef', 'admin', 'manager'].includes(formData.role) && (
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
                            <label className="block text-sm font-medium text-black mb-1">Security PIN</label>
                            <input
                                type="text"
                                pattern="[0-9]*"
                                minLength={4}
                                maxLength={6}
                                placeholder="4-6 digit PIN"
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.pin}
                                onChange={e => setFormData({ ...formData, pin: e.target.value })}
                            />
                            <p className="text-[10px] text-black mt-1">Staff uses this PIN to log in locally.</p>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-black mb-1">Aadhaar / ID Number</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.aadhaar_id}
                                onChange={e => setFormData({ ...formData, aadhaar_id: e.target.value })}
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-black mb-1">Residential Address</label>
                            <textarea
                                rows={3}
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
