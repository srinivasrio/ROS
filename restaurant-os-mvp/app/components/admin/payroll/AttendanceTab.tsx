'use client';

import { useState, useEffect } from 'react';
import { CheckSquare as LucideCheckSquare, Save as LucideSave, Calendar as LucideCalendar, Check as LucideCheck } from 'lucide-react';
import { PayrollService, Employee, Attendance } from '@/app/services/payroll';

interface AttendanceTabProps {
    restaurantId: string;
}

type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave';

export default function AttendanceTab({ restaurantId }: AttendanceTabProps) {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedSuccessfully, setSavedSuccessfully] = useState(false);

    const loadData = async () => {
        setLoading(true);
        setSavedSuccessfully(false);
        try {
            // Fetch all employees and current date's attendance
            const [empList, attList] = await Promise.all([
                PayrollService.fetchEmployees(restaurantId),
                PayrollService.fetchAttendance(restaurantId, selectedDate)
            ]);

            // Filter active employees for attendance marking
            const activeEmps = empList.filter(e => e.status === 'active');
            setEmployees(activeEmps);

            // Populate attendance map
            const map: Record<string, AttendanceStatus> = {};
            // Default all active employees to 'present' initially or leave empty so they must be marked
            // Let's default them to 'present' for easy marking, but if there's already saved data, use that.
            activeEmps.forEach(e => {
                map[e.id] = 'present'; // Default
            });

            attList.forEach(a => {
                map[a.employee_id] = a.status;
            });

            setAttendanceMap(map);
        } catch (error) {
            console.error('Failed to load attendance:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (restaurantId && selectedDate) {
            loadData();
        }
    }, [restaurantId, selectedDate]);

    const handleStatusChange = (employeeId: string, status: AttendanceStatus) => {
        setAttendanceMap(prev => ({
            ...prev,
            [employeeId]: status
        }));
        setSavedSuccessfully(false);
    };

    const handleBulkPresent = () => {
        const nextMap = { ...attendanceMap };
        employees.forEach(e => {
            nextMap[e.id] = 'present';
        });
        setAttendanceMap(nextMap);
        setSavedSuccessfully(false);
    };

    const handleSave = async () => {
        setSaving(true);
        setSavedSuccessfully(false);
        try {
            const records = Object.entries(attendanceMap).map(([empId, status]) => ({
                employee_id: empId,
                status
            }));
            await PayrollService.saveAttendance(restaurantId, selectedDate, records);
            setSavedSuccessfully(true);
            // Hide success checkmark after 3 seconds
            setTimeout(() => setSavedSuccessfully(false), 3000);
        } catch (error) {
            console.error(error);
            alert('Failed to save attendance logs');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-neutral-500 font-medium">
                Loading attendance register...
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-6 pt-6 gap-4 shrink-0">
                <div>
                    <h3 className="text-lg font-bold text-black">Daily Attendance</h3>
                    <p className="text-xs text-neutral-500">Record daily staff presence. These logs directly calculate payroll deductions.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center bg-neutral-100 border border-neutral-200 rounded-lg px-3 py-1.5 gap-2 text-sm text-black">
                        <LucideCalendar size={16} className="text-neutral-500" />
                        <input
                            type="date"
                            className="bg-transparent focus:outline-none font-medium cursor-pointer"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                        />
                    </div>
                    
                    <button
                        onClick={handleBulkPresent}
                        className="flex items-center px-3.5 py-2 border border-neutral-300 text-black hover:bg-neutral-50 text-xs font-bold rounded-lg transition-all gap-1.5"
                    >
                        <LucideCheckSquare size={15} />
                        Bulk Mark Present
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`flex items-center px-4 py-2 text-white text-xs font-bold rounded-lg transition-all gap-1.5 shadow-md ${
                            savedSuccessfully 
                                ? 'bg-green-600 shadow-green-600/10' 
                                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/10'
                        }`}
                    >
                        {saving ? (
                            'Saving...'
                        ) : savedSuccessfully ? (
                            <>
                                <LucideCheck size={15} />
                                Saved!
                            </>
                        ) : (
                            <>
                                <LucideSave size={15} />
                                Save Attendance
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-neutral-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0 mx-6 mb-6">
                <div className="overflow-y-auto no-scrollbar flex-1">
                    <table className="w-full text-left text-sm text-black">
                        <thead className="bg-neutral-50 text-black font-medium border-b border-neutral-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4">Employee Name</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Branch</th>
                                <th className="px-6 py-4 text-center">Attendance Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                            {employees.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-neutral-500 font-medium">
                                        No active employees found. Activate employees in the directory first.
                                    </td>
                                </tr>
                            ) : (
                                employees.map((emp) => {
                                    const currentStatus = attendanceMap[emp.id] || 'present';
                                    return (
                                        <tr key={emp.id} className="hover:bg-neutral-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-black">
                                                {emp.name}
                                            </td>
                                            <td className="px-6 py-4 capitalize text-xs text-neutral-600">{emp.role}</td>
                                            <td className="px-6 py-4 text-neutral-600">{emp.branch?.name || '-'}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center items-center gap-2">
                                                    <button
                                                        onClick={() => handleStatusChange(emp.id, 'present')}
                                                        className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border ${
                                                            currentStatus === 'present'
                                                                ? 'bg-green-100 text-green-800 border-green-300 shadow-sm'
                                                                : 'bg-neutral-50 text-neutral-400 border-neutral-200 hover:bg-neutral-100'
                                                        }`}
                                                    >
                                                        Present
                                                    </button>
                                                    <button
                                                        onClick={() => handleStatusChange(emp.id, 'half_day')}
                                                        className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border ${
                                                            currentStatus === 'half_day'
                                                                ? 'bg-amber-100 text-amber-800 border-amber-300 shadow-sm'
                                                                : 'bg-neutral-50 text-neutral-400 border-neutral-200 hover:bg-neutral-100'
                                                        }`}
                                                    >
                                                        Half Day
                                                    </button>
                                                    <button
                                                        onClick={() => handleStatusChange(emp.id, 'absent')}
                                                        className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border ${
                                                            currentStatus === 'absent'
                                                                ? 'bg-red-100 text-red-800 border-red-300 shadow-sm'
                                                                : 'bg-neutral-50 text-neutral-400 border-neutral-200 hover:bg-neutral-100'
                                                        }`}
                                                    >
                                                        Absent
                                                    </button>
                                                    <button
                                                        onClick={() => handleStatusChange(emp.id, 'leave')}
                                                        className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border ${
                                                            currentStatus === 'leave'
                                                                ? 'bg-blue-100 text-blue-800 border-blue-300 shadow-sm'
                                                                : 'bg-neutral-50 text-neutral-400 border-neutral-200 hover:bg-neutral-100'
                                                        }`}
                                                    >
                                                        Leave
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
