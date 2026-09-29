'use client';

import { useState, useEffect } from 'react';
import { 
    Check as LucideCheck, 
    X as LucideX, 
    AlertTriangle as LucideAlert, 
    ShieldAlert as LucideShieldAlert, 
    Clock as LucideClock, 
    UserCheck as LucideUserCheck,
    Mail as LucideMail,
    Phone as LucidePhone
} from 'lucide-react';
import { StaffService, Staff } from '@/services/staff.service';

interface ApprovalsTabProps {
    restaurantId: string;
}

export default function ApprovalsTab({ restaurantId }: ApprovalsTabProps) {
    const [pendingStaff, setPendingStaff] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [actioningId, setActioningId] = useState<string | null>(null);

    const loadPendingStaff = async () => {
        setLoading(true);
        try {
            const data = await StaffService.fetchStaff(restaurantId);
            // Filter only verified employees who are awaiting admin approval
            const awaitingApproval = data.filter(
                (member) => 
                    member.status === 'verified' || 
                    member.approval_status === 'awaiting_admin_approval'
            );
            setPendingStaff(awaitingApproval);
        } catch (error) {
            console.error('Failed to load pending approvals:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (restaurantId) {
            loadPendingStaff();
        }
    }, [restaurantId]);

    const handleAction = async (id: string, action: 'approve' | 'reject' | 'suspend') => {
        const actionLabel = action === 'approve' ? 'approve' : action === 'reject' ? 'reject' : 'suspend';
        if (!confirm(`Are you sure you want to ${actionLabel} this employee?`)) return;

        setActioningId(id);
        try {
            if (action === 'approve') {
                await StaffService.approveStaff(id, restaurantId);
            } else if (action === 'reject') {
                await StaffService.rejectStaff(id, restaurantId);
            } else if (action === 'suspend') {
                await StaffService.suspendStaff(id, restaurantId);
            }
            alert(`Employee successfully ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'suspended'}.`);
            await loadPendingStaff();
        } catch (error: any) {
            alert(error.message || `Failed to ${actionLabel} employee.`);
        } finally {
            setActioningId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-neutral-500 font-medium">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>Loading staff approval requests...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 space-y-4">
            <div className="flex justify-between items-center px-6 pt-6 shrink-0">
                <div>
                    <h3 className="text-lg font-bold text-black flex items-center gap-2">
                        <LucideShieldAlert className="text-amber-500" size={20} />
                        Staff Verification & Approvals
                    </h3>
                    <p className="text-xs text-neutral-500">
                        Review employees who have set up their credentials. Approved employees receive access to their respective dashboards.
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-neutral-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0 mx-6 mb-6">
                <div className="overflow-y-auto no-scrollbar flex-1">
                    <table className="w-full text-left text-sm text-black">
                        <thead className="bg-neutral-50 text-black font-medium border-b border-neutral-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4">Employee ID</th>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Contact info</th>
                                <th className="px-6 py-4">Setup</th>
                                <th className="px-6 py-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                            {pendingStaff.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center text-neutral-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                                                <LucideUserCheck size={24} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-black text-sm">All caught up!</p>
                                                <p className="text-xs text-neutral-400 mt-1">No employee activation requests are awaiting admin approval.</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                pendingStaff.map((emp) => (
                                    <tr key={emp.id} className="hover:bg-neutral-50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-xs font-semibold text-blue-600">
                                            {emp.employee_id || '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold mr-3 text-blue-700">
                                                    {emp.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-black">{emp.name}</p>
                                                    <p className="text-[10px] text-neutral-400 capitalize">{emp.role === 'delivery_boy' ? 'Delivery Boy' : emp.role}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <RoleBadge role={emp.role} />
                                        </td>
                                        <td className="px-6 py-4 text-xs space-y-1">
                                            {emp.email && (
                                                <div className="flex items-center gap-1.5 text-neutral-600">
                                                    <LucideMail size={12} className="text-neutral-400" />
                                                    <span>{emp.email}</span>
                                                </div>
                                            )}
                                            {emp.mobile && (
                                                <div className="flex items-center gap-1.5 text-neutral-600">
                                                    <LucidePhone size={12} className="text-neutral-400" />
                                                    <span>{emp.mobile}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-600">
                                                    <LucideCheck size={12} /> Password Configured
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center items-center gap-2">
                                                <button
                                                    onClick={() => handleAction(emp.id, 'approve')}
                                                    disabled={actioningId !== null}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
                                                >
                                                    <LucideCheck size={14} />
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => handleAction(emp.id, 'reject')}
                                                    disabled={actioningId !== null}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
                                                >
                                                    <LucideX size={14} />
                                                    Reject
                                                </button>
                                                <button
                                                    onClick={() => handleAction(emp.id, 'suspend')}
                                                    disabled={actioningId !== null}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
                                                >
                                                    <LucideAlert size={14} />
                                                    Suspend
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

    const label = role === 'delivery_boy' ? 'Delivery Boy' : role === 'restaurant_admin' ? 'Restaurant Admin' : role;

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border capitalize ${styles[role] || 'bg-neutral-50 border-neutral-200 text-neutral-600'}`}>
            {label}
        </span>
    );
}
