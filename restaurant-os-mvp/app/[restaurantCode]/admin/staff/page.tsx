'use client';

import { useState, useEffect } from 'react';
import { useRestaurantId } from '@/app/hooks/useRestaurantId';
import { LoadingState } from '@/components/ui/LoadingState';

// Lucide Icons
import { 
    Users as LucideUsers, 
    CheckSquare as LucideCheckSquare, 
    CreditCard as LucideCreditCard, 
    FileBarChart as LucideReports, 
    Key as LucideKey,
    UserPlus as LucideUserPlus, 
    Edit as LucideEdit, 
    Trash2 as LucideTrash2, 
    Shield as LucideShield 
} from 'lucide-react';

// Payroll Sub-tabs
import EmployeesTab from '@/app/components/admin/payroll/EmployeesTab';
import AttendanceTab from '@/app/components/admin/payroll/AttendanceTab';
import PayrollTab from '@/app/components/admin/payroll/PayrollTab';
import ReportsTab from '@/app/components/admin/payroll/ReportsTab';

// Original Staff PIN Logic imports
import { StaffService, Staff } from '@/app/services/staff';
import StaffModal from '@/app/components/admin/AddStaffModal';
import { getCached, setCache } from '@/app/lib/data-cache';

type TabId = 'employees' | 'attendance' | 'payroll' | 'reports' | 'logins';

export default function StaffManagement() {
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const [activeTab, setActiveTab] = useState<TabId>('employees');

    // Legacy Staff Login States
    const cacheKey = `staff-${restaurantId}`;
    const cached = getCached<Staff[]>(cacheKey);
    const [staffList, setStaffList] = useState<Staff[]>(cached || []);
    const [loadingLogins, setLoadingLogins] = useState(!cached);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<Staff | undefined>();

    useEffect(() => {
        if (!restaurantLoading && restaurantId && activeTab === 'logins') {
            loadStaffLogins();
        }
    }, [restaurantId, restaurantLoading, activeTab]);

    const loadStaffLogins = async () => {
        if (!restaurantId) return;
        try {
            const data = await StaffService.fetchStaff(restaurantId);
            setStaffList(data);
            setCache(cacheKey, data);
        } catch (error) {
            console.error('Failed to load staff logins:', error);
        } finally {
            setLoadingLogins(false);
        }
    };

    if (restaurantLoading) {
        return <LoadingState message="Connecting server..." fullScreen />;
    }

    if (!restaurantId) {
        return (
            <div className="p-8 text-center text-neutral-500 font-bold">
                Restaurant context not found. Please log in or select a restaurant.
            </div>
        );
    }

    const handleAddStaffLogin = () => {
        setSelectedStaff(undefined);
        setIsLoginModalOpen(true);
    };

    const handleEditStaffLogin = (staff: Staff) => {
        setSelectedStaff(staff);
        setIsLoginModalOpen(true);
    };

    const handleDeleteStaffLogin = async (id: string) => {
        if (!confirm('Are you sure you want to delete this staff login login credentials?')) return;
        try {
            await StaffService.deleteStaff(id, restaurantId);
            loadStaffLogins();
        } catch (error) {
            alert('Failed to delete staff login details.');
        }
    };

    const tabConfig = [
        { id: 'employees' as TabId, label: 'Employees', icon: LucideUsers },
        { id: 'attendance' as TabId, label: 'Attendance', icon: LucideCheckSquare },
        { id: 'payroll' as TabId, label: 'Payroll', icon: LucideCreditCard },
        { id: 'reports' as TabId, label: 'Reports', icon: LucideReports },
        { id: 'logins' as TabId, label: 'Staff PINs & Logins', icon: LucideKey },
    ];

    return (
        <div className="p-8 flex flex-col h-screen space-y-6 overflow-hidden">
            {/* Header section */}
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-2xl font-black text-black tracking-tight">Staff & Payroll Workspace</h2>
                    <p className="text-sm font-medium text-neutral-500 mt-1">
                        Track employee data, record daily attendance, calculate monthly payroll run sheets, and manage waiter login PINs.
                    </p>
                </div>
            </div>

            {/* Navigation Tabs Bar */}
            <div className="flex border-b border-neutral-200 shrink-0 gap-1 overflow-x-auto no-scrollbar">
                {tabConfig.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${
                                isActive
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-neutral-500 hover:text-black hover:border-neutral-300'
                            }`}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Contents */}
            <div className="flex-1 flex flex-col min-h-0 bg-neutral-50 rounded-[2.5rem] border border-neutral-200 overflow-hidden">
                {activeTab === 'employees' && <EmployeesTab restaurantId={restaurantId} />}
                
                {activeTab === 'attendance' && <AttendanceTab restaurantId={restaurantId} />}
                
                {activeTab === 'payroll' && <PayrollTab restaurantId={restaurantId} />}
                
                {activeTab === 'reports' && <ReportsTab restaurantId={restaurantId} />}
                
                {activeTab === 'logins' && (
                    <div className="flex-1 flex flex-col min-h-0 space-y-4">
                        <div className="flex justify-between items-center px-6 pt-6 shrink-0">
                            <div>
                                <h3 className="text-lg font-bold text-black">Waiter PINs & Login Logins</h3>
                                <p className="text-xs text-neutral-500">Provide waitstaff and chefs local login permissions and pins.</p>
                            </div>
                            <button
                                onClick={handleAddStaffLogin}
                                className="flex items-center px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-600/10 gap-2"
                            >
                                <LucideUserPlus size={16} />
                                Add Staff PIN Login
                            </button>
                        </div>

                        <div className="bg-white rounded-[2rem] border border-neutral-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0 mx-6 mb-6">
                            <div className="overflow-y-auto no-scrollbar flex-1">
                                {loadingLogins ? (
                                    <div className="flex justify-center items-center py-20 font-medium text-neutral-500">
                                        Loading staff logins...
                                    </div>
                                ) : (
                                    <table className="w-full text-left text-sm text-black">
                                        <thead className="bg-neutral-50 text-black font-medium border-b border-neutral-200 sticky top-0 z-10">
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
                                            {staffList.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-10 text-center text-neutral-500">
                                                        No logins configured yet.
                                                    </td>
                                                </tr>
                                            ) : (
                                                staffList.map((member) => (
                                                    <tr key={member.id} className="hover:bg-neutral-50 transition-colors">
                                                        <td className="px-6 py-4 font-medium text-black flex items-center">
                                                            <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-bold mr-3 text-black">
                                                                {member.name.charAt(0)}
                                                            </div>
                                                            {member.name}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <RoleBadge role={member.role} />
                                                        </td>
                                                        <td className="px-6 py-4 font-mono text-xs text-neutral-600">{member.mobile}</td>
                                                        <td className="px-6 py-4">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize ${
                                                                member.status === 'active' ? 'text-green-700 bg-green-50' : 'text-neutral-500 bg-neutral-100'
                                                            }`}>
                                                                {member.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center font-mono text-black font-bold">
                                                            {member.pin ? member.pin : '-'}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <button 
                                                                    onClick={() => handleEditStaffLogin(member)}
                                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                                >
                                                                    <LucideEdit size={16} />
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleDeleteStaffLogin(member.id)} 
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
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Staff PIN Login Modal */}
            <StaffModal
                isOpen={isLoginModalOpen}
                onClose={() => setIsLoginModalOpen(false)}
                onSuccess={loadStaffLogins}
                staff={selectedStaff}
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
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${styles[role] || 'bg-gray-100 border-gray-200 text-neutral-600'}`}>
            {icons[role]}
            {role}
        </span>
    );
}
