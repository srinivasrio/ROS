'use client';

import { useState } from 'react';
import { LucideX, LucideLoader2 } from 'lucide-react';
import { StaffService, Staff } from '@/app/services/staff';

interface AddStaffModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddStaffModal({ isOpen, onClose, onSuccess }: AddStaffModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        role: 'waiter' as Staff['role'],
        mobile: '',
        status: 'active' as Staff['status']
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await StaffService.createStaff(formData);
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to add staff member');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b border-neutral-100">
                    <h3 className="text-lg font-bold text-neutral-900">Add New Staff</h3>
                    <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
                        <LucideX size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Full Name</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Role</label>
                        <select
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.role}
                            onChange={e => setFormData({ ...formData, role: e.target.value as Staff['role'] })}
                        >
                            <option value="waiter">Waiter</option>
                            <option value="chef">Chef</option>
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Mobile Number</label>
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

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-neutral-300 text-neutral-700 font-medium rounded-lg hover:bg-neutral-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center"
                        >
                            {loading ? <LucideLoader2 className="animate-spin" size={18} /> : 'Create Staff'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
