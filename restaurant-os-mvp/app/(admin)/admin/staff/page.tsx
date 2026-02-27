'use client';

import { LucideUserPlus, LucideEdit, LucideTrash2, LucideShield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { StaffService, Staff } from '@/app/services/staff';
import AddStaffModal from '@/app/components/admin/AddStaffModal';

export default function StaffManagement() {
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    useEffect(() => {
        loadStaff();
    }, []);

    const loadStaff = async () => {
        try {
            const data = await StaffService.fetchStaff();
            setStaffList(data);
        } catch (error) {
            console.error('Failed to load staff:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this staff member?')) return;
        try {
            await StaffService.deleteStaff(id);
            loadStaff();
        } catch (error) {
            alert('Failed to delete staff');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-neutral-900">Staff Management</h2>
                    <p className="text-neutral-500">Manage employees and access roles.</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                    <LucideUserPlus size={18} className="mr-2" />
                    Add New Staff
                </button>
            </div>

            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm text-neutral-600">
                    <thead className="bg-neutral-50 text-neutral-900 font-medium border-b border-neutral-200">
                        <tr>
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Role</th>
                            <th className="px-6 py-4">Mobile Number</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-center">PIN</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                        {loading ? (
                            <tr><td colSpan={6} className="px-6 py-10 text-center text-neutral-400">Loading staff...</td></tr>
                        ) : staffList.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-10 text-center text-neutral-400">No staff members found.</td></tr>
                        ) : (
                            staffList.map((member) => (
                                <tr key={member.id} className="hover:bg-neutral-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-neutral-900 flex items-center">
                                        <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-bold mr-3 text-neutral-600">
                                            {member.name.charAt(0)}
                                        </div>
                                        {member.name}
                                    </td>
                                    <td className="px-6 py-4">
                                        <RoleBadge role={member.role} />
                                    </td>
                                    <td className="px-6 py-4">{member.mobile}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${member.status === 'active' ? 'text-green-700 bg-green-50' : 'text-neutral-500 bg-neutral-100'
                                            }`}>
                                            {member.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center font-mono text-neutral-400">
                                        {member.pin ? '****' : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"><LucideEdit size={16} /></button>
                                            <button onClick={() => handleDelete(member.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"><LucideTrash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <AddStaffModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={loadStaff}
            />
        </div>
    );
}

function RoleBadge({ role }: { role: string }) {
    const styles: Record<string, string> = {
        admin: 'bg-orange-100 text-orange-800 border-orange-200',
        waiter: 'bg-blue-100 text-blue-800 border-blue-200',
        chef: 'bg-purple-100 text-purple-800 border-purple-200',
        manager: 'bg-teal-100 text-teal-800 border-teal-200',
    };

    const icons: Record<string, React.ReactNode> = {
        admin: <LucideShield size={12} className="mr-1" />,
    };

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${styles[role] || 'bg-gray-100'}`}>
            {icons[role]}
            {role}
        </span>
    );
}
