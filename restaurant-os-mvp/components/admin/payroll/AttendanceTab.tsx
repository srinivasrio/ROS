'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    Calendar as LucideCalendar, 
    CheckSquare as LucideCheckSquare, 
    Save as LucideSave, 
    Check as LucideCheck, 
    Filter as LucideFilter,
    CalendarDays as LucideCalendarDays,
    ListFilter as LucideListFilter,
    Coffee as LucideCoffee
} from 'lucide-react';
import { PayrollService, Employee, Attendance, Branch } from '@/services/payroll.service';
import { toast } from 'sonner';

interface AttendanceTabProps {
    restaurantId: string;
}

type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave' | 'weekly_off';

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; short: string; bg: string; text: string; border: string }> = {
    present: { label: 'Present', short: 'P', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' },
    half_day: { label: 'Half Day', short: 'H', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' },
    absent: { label: 'Absent', short: 'A', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-300' },
    leave: { label: 'Leave', short: 'L', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-300' },
    weekly_off: { label: 'Weekly Off', short: 'WO', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300' },
};

const MONTHS = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
];

function getWeekdayName(dateString: string): string {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const d = new Date(dateString + 'T00:00:00');
    return days[d.getDay()];
}

export default function AttendanceTab({ restaurantId }: AttendanceTabProps) {
    const today = new Date();
    const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
    const [selectedDate, setSelectedDate] = useState<string>(today.toISOString().split('T')[0]);
    const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [branchFilter, setBranchFilter] = useState('all');
    const [roleFilter, setRoleFilter] = useState('all');

    // Daily attendance state
    const [dailyAttendanceMap, setDailyAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
    // Monthly attendance state: map of `${employee_id}_${date}` -> status
    const [monthlyAttendanceMap, setMonthlyAttendanceMap] = useState<Record<string, AttendanceStatus>>({});

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedSuccessfully, setSavedSuccessfully] = useState(false);

    // Load initial directory data
    const loadEmployeesAndBranches = useCallback(async () => {
        if (!restaurantId) return;
        try {
            const [empList, branchList] = await Promise.all([
                PayrollService.fetchEmployees(restaurantId),
                PayrollService.fetchBranches(restaurantId)
            ]);
            setEmployees(empList.filter(e => e.status === 'active'));
            setBranches(branchList);
        } catch (err) {
            console.error('Failed to load employee list:', err);
        }
    }, [restaurantId]);

    // Load Daily Attendance
    const loadDailyAttendance = useCallback(async () => {
        if (!restaurantId || !selectedDate) return;
        setLoading(true);
        setSavedSuccessfully(false);
        try {
            const attList = await PayrollService.fetchAttendance(restaurantId, selectedDate);
            const dateWeekday = getWeekdayName(selectedDate);

            const map: Record<string, AttendanceStatus> = {};
            // For each employee, if an attendance record exists, use it.
            // Otherwise, default to 'weekly_off' if today matches employee's weekly_off, else 'present'.
            employees.forEach(emp => {
                const isEmpWeeklyOff = emp.weekly_off && emp.weekly_off.toLowerCase() === dateWeekday;
                map[emp.id] = isEmpWeeklyOff ? 'weekly_off' : 'present';
            });

            attList.forEach(a => {
                map[a.employee_id] = a.status;
            });

            setDailyAttendanceMap(map);
        } catch (error) {
            console.error('Failed to load daily attendance:', error);
            toast.error('Failed to fetch attendance logs');
        } finally {
            setLoading(false);
        }
    }, [restaurantId, selectedDate, employees]);

    // Load Monthly Attendance
    const loadMonthlyAttendance = useCallback(async () => {
        if (!restaurantId) return;
        setLoading(true);
        try {
            const attList = await PayrollService.fetchMonthlyAttendance(restaurantId, selectedMonth, selectedYear);
            const map: Record<string, AttendanceStatus> = {};
            attList.forEach(a => {
                map[`${a.employee_id}_${a.date}`] = a.status;
            });
            setMonthlyAttendanceMap(map);
        } catch (error) {
            console.error('Failed to load monthly attendance:', error);
            toast.error('Failed to fetch monthly attendance');
        } finally {
            setLoading(false);
        }
    }, [restaurantId, selectedMonth, selectedYear]);

    useEffect(() => {
        loadEmployeesAndBranches();
    }, [loadEmployeesAndBranches]);

    useEffect(() => {
        if (employees.length > 0) {
            if (viewMode === 'daily') {
                loadDailyAttendance();
            } else {
                loadMonthlyAttendance();
            }
        }
    }, [viewMode, selectedDate, selectedMonth, selectedYear, employees.length, loadDailyAttendance, loadMonthlyAttendance]);

    // Filter employees by branch and role
    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => {
            const matchesBranch = branchFilter === 'all' || emp.branch_id === branchFilter;
            const matchesRole = roleFilter === 'all' || emp.role.toLowerCase() === roleFilter.toLowerCase();
            return matchesBranch && matchesRole;
        });
    }, [employees, branchFilter, roleFilter]);

    // Available unique roles for filter
    const availableRoles = useMemo(() => {
        const roles = new Set(employees.map(e => e.role));
        return Array.from(roles);
    }, [employees]);

    // Days in current selected month for monthly view
    const daysInMonth = useMemo(() => {
        const total = new Date(selectedYear, selectedMonth, 0).getDate();
        const list: { day: number; dateStr: string; weekday: string }[] = [];
        const shortDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

        for (let i = 1; i <= total; i++) {
            const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const d = new Date(dateStr + 'T00:00:00');
            list.push({
                day: i,
                dateStr,
                weekday: shortDays[d.getDay()]
            });
        }
        return list;
    }, [selectedMonth, selectedYear]);

    // Daily actions
    const handleDailyStatusChange = (employeeId: string, status: AttendanceStatus) => {
        setDailyAttendanceMap(prev => ({
            ...prev,
            [employeeId]: status
        }));
        setSavedSuccessfully(false);
    };

    const handleBulkPresent = () => {
        const nextMap = { ...dailyAttendanceMap };
        const dateWeekday = getWeekdayName(selectedDate);

        filteredEmployees.forEach(e => {
            const isEmpWeeklyOff = e.weekly_off && e.weekly_off.toLowerCase() === dateWeekday;
            nextMap[e.id] = isEmpWeeklyOff ? 'weekly_off' : 'present';
        });
        setDailyAttendanceMap(nextMap);
        setSavedSuccessfully(false);
        toast.info('Applied bulk present (weekly off days preserved)');
    };

    const handleAutoWeeklyOff = () => {
        const nextMap = { ...dailyAttendanceMap };
        const dateWeekday = getWeekdayName(selectedDate);
        let count = 0;

        filteredEmployees.forEach(e => {
            if (e.weekly_off && e.weekly_off.toLowerCase() === dateWeekday) {
                nextMap[e.id] = 'weekly_off';
                count++;
            }
        });
        setDailyAttendanceMap(nextMap);
        setSavedSuccessfully(false);
        toast.success(`Marked ${count} staff with ${dateWeekday} as Weekly Off`);
    };

    const handleSaveDaily = async () => {
        setSaving(true);
        setSavedSuccessfully(false);
        try {
            const records = Object.entries(dailyAttendanceMap).map(([empId, status]) => ({
                employee_id: empId,
                status
            }));
            await PayrollService.saveAttendance(restaurantId, selectedDate, records);
            setSavedSuccessfully(true);
            toast.success('Attendance saved successfully');
            setTimeout(() => setSavedSuccessfully(false), 3000);
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Failed to save attendance logs');
        } finally {
            setSaving(false);
        }
    };

    // Calculate monthly summary per employee
    const getMonthlyEmployeeSummary = (employeeId: string) => {
        let p = 0, a = 0, h = 0, l = 0, wo = 0;
        daysInMonth.forEach(d => {
            const status = monthlyAttendanceMap[`${employeeId}_${d.dateStr}`];
            if (status === 'present') p++;
            else if (status === 'absent') a++;
            else if (status === 'half_day') h++;
            else if (status === 'leave') l++;
            else if (status === 'weekly_off') wo++;
        });
        const totalWorked = p + (h * 0.5);
        const totalLogged = p + a + h + l + wo;
        const rate = totalLogged > 0 ? Math.round(((totalWorked + wo + l) / totalLogged) * 100) : 0;
        return { p, a, h, l, wo, rate };
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 space-y-4">
            {/* Header with View Toggle & Filters */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center px-6 pt-6 gap-4 shrink-0">
                <div>
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold text-black">Staff Attendance Register</h3>
                        <div className="flex bg-neutral-100 p-0.5 rounded-lg border border-neutral-200">
                            <button
                                onClick={() => setViewMode('daily')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                                    viewMode === 'daily'
                                        ? 'bg-white text-black shadow-sm'
                                        : 'text-neutral-500 hover:text-black'
                                }`}
                            >
                                <LucideCalendar size={13} />
                                Daily View
                            </button>
                            <button
                                onClick={() => setViewMode('monthly')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                                    viewMode === 'monthly'
                                        ? 'bg-white text-black shadow-sm'
                                        : 'text-neutral-500 hover:text-black'
                                }`}
                            >
                                <LucideCalendarDays size={13} />
                                Monthly Matrix
                            </button>
                        </div>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                        {viewMode === 'daily' 
                            ? 'Mark daily attendance (Present, Half Day, Absent, Leave, Weekly Off) to drive payroll deductions.' 
                            : 'Full calendar matrix of employee attendance records across the selected month.'}
                    </p>
                </div>

                {/* Controls Bar */}
                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Role Filter */}
                    <div className="flex items-center bg-neutral-100 border border-neutral-200 rounded-lg px-2.5 py-1.5 gap-1.5 text-xs text-black">
                        <LucideListFilter size={14} className="text-neutral-500" />
                        <select
                            value={roleFilter}
                            onChange={e => setRoleFilter(e.target.value)}
                            className="bg-transparent focus:outline-none font-medium capitalize"
                        >
                            <option value="all">All Roles</option>
                            {availableRoles.map(r => (
                                <option key={r} value={r} className="capitalize">{r === 'delivery_boy' ? 'Delivery Boy' : r}</option>
                            ))}
                        </select>
                    </div>

                    {/* Branch Filter */}
                    {branches.length > 0 && (
                        <div className="flex items-center bg-neutral-100 border border-neutral-200 rounded-lg px-2.5 py-1.5 gap-1.5 text-xs text-black">
                            <LucideFilter size={14} className="text-neutral-500" />
                            <select
                                value={branchFilter}
                                onChange={e => setBranchFilter(e.target.value)}
                                className="bg-transparent focus:outline-none font-medium"
                            >
                                <option value="all">All Branches</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {viewMode === 'daily' ? (
                        <>
                            {/* Date Picker */}
                            <div className="flex items-center bg-neutral-100 border border-neutral-200 rounded-lg px-3 py-1.5 gap-2 text-xs font-semibold text-black">
                                <LucideCalendar size={15} className="text-neutral-500" />
                                <input
                                    type="date"
                                    className="bg-transparent focus:outline-none font-medium cursor-pointer"
                                    value={selectedDate}
                                    onChange={e => setSelectedDate(e.target.value)}
                                />
                                <span className="text-[10px] uppercase font-bold text-neutral-400 border-l pl-2 border-neutral-300">
                                    {getWeekdayName(selectedDate).slice(0, 3)}
                                </span>
                            </div>

                            <button
                                onClick={handleBulkPresent}
                                className="flex items-center px-3 py-1.5 border border-neutral-300 text-black hover:bg-neutral-50 text-xs font-bold rounded-lg transition-all gap-1.5"
                                title="Set all to Present (maintains weekly off days)"
                            >
                                <LucideCheckSquare size={14} />
                                Bulk Present
                            </button>

                            <button
                                onClick={handleAutoWeeklyOff}
                                className="flex items-center px-3 py-1.5 border border-purple-200 text-purple-700 bg-purple-50/60 hover:bg-purple-100 text-xs font-bold rounded-lg transition-all gap-1.5"
                                title="Mark employees whose configured weekly off day is today"
                            >
                                <LucideCoffee size={14} />
                                Auto Weekly Off
                            </button>

                            <button
                                onClick={handleSaveDaily}
                                disabled={saving}
                                className={`flex items-center px-4 py-1.5 text-white text-xs font-bold rounded-lg transition-all gap-1.5 shadow-md ${
                                    savedSuccessfully 
                                        ? 'bg-emerald-600 shadow-emerald-600/10' 
                                        : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/10'
                                }`}
                            >
                                {saving ? (
                                    'Saving...'
                                ) : savedSuccessfully ? (
                                    <>
                                        <LucideCheck size={14} />
                                        Saved!
                                    </>
                                ) : (
                                    <>
                                        <LucideSave size={14} />
                                        Save Attendance
                                    </>
                                )}
                            </button>
                        </>
                    ) : (
                        <>
                            {/* Month & Year Selectors */}
                            <div className="flex items-center bg-neutral-100 border border-neutral-200 rounded-lg px-2 py-1.5 gap-2 text-xs text-black">
                                <LucideCalendar size={15} className="text-neutral-500" />
                                <select
                                    value={selectedMonth}
                                    onChange={e => setSelectedMonth(Number(e.target.value))}
                                    className="bg-transparent focus:outline-none font-bold text-xs"
                                >
                                    {MONTHS.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                                <select
                                    value={selectedYear}
                                    onChange={e => setSelectedYear(Number(e.target.value))}
                                    className="bg-transparent focus:outline-none font-bold text-xs border-l pl-2 border-neutral-300"
                                >
                                    {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            {viewMode === 'daily' ? (
                <div className="bg-white rounded-[2rem] border border-neutral-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0 mx-6 mb-6">
                    <div className="overflow-y-auto no-scrollbar flex-1">
                        <table className="w-full text-left text-xs text-black">
                            <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200 sticky top-0 z-10">
                                <tr>
                                    <th className="px-5 py-3">Employee</th>
                                    <th className="px-4 py-3">Role</th>
                                    <th className="px-4 py-3">Branch</th>
                                    <th className="px-4 py-3 text-center">Configured Off</th>
                                    <th className="px-6 py-3 text-center">Mark Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-neutral-500 font-medium">
                                            Loading daily attendance...
                                        </td>
                                    </tr>
                                ) : filteredEmployees.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-neutral-500 font-medium">
                                            No active employees match the selected filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredEmployees.map((emp) => {
                                        const currentStatus = dailyAttendanceMap[emp.id] || 'present';
                                        return (
                                            <tr key={emp.id} className="hover:bg-neutral-50/80 transition-colors">
                                                <td className="px-5 py-3.5">
                                                    <div className="font-bold text-black text-sm">{emp.name}</div>
                                                    <div className="text-[11px] text-neutral-400 font-mono">
                                                        {emp.employee_code || emp.employee_id || emp.id.slice(0, 8)}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 capitalize text-neutral-600 font-medium">
                                                    {emp.role === 'delivery_boy' ? 'Delivery Boy' : emp.role}
                                                </td>
                                                <td className="px-4 py-3.5 text-neutral-600">
                                                    {emp.branch?.name || '—'}
                                                </td>
                                                <td className="px-4 py-3.5 text-center">
                                                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold capitalize bg-neutral-100 text-neutral-600 border border-neutral-200">
                                                        {emp.weekly_off || 'Sunday'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3.5">
                                                    <div className="flex justify-center items-center gap-1.5">
                                                        {(['present', 'half_day', 'absent', 'leave', 'weekly_off'] as AttendanceStatus[]).map(status => {
                                                            const isSelected = currentStatus === status;
                                                            const conf = STATUS_CONFIG[status];
                                                            return (
                                                                <button
                                                                    key={status}
                                                                    onClick={() => handleDailyStatusChange(emp.id, status)}
                                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                                                        isSelected
                                                                            ? `${conf.bg} ${conf.text} ${conf.border} shadow-sm ring-1 ring-offset-0 ${
                                                                                status === 'present' ? 'ring-emerald-400' :
                                                                                status === 'half_day' ? 'ring-amber-400' :
                                                                                status === 'absent' ? 'ring-rose-400' :
                                                                                status === 'leave' ? 'ring-sky-400' :
                                                                                'ring-purple-400'
                                                                            }`
                                                                            : 'bg-white text-neutral-400 border-neutral-200 hover:text-black hover:bg-neutral-50'
                                                                    }`}
                                                                >
                                                                    {conf.label}
                                                                </button>
                                                            );
                                                        })}
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
            ) : (
                /* Monthly Calendar Matrix */
                <div className="bg-white rounded-[2rem] border border-neutral-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0 mx-6 mb-6">
                    {/* Legend */}
                    <div className="flex flex-wrap items-center justify-between px-6 py-3 bg-neutral-50/70 border-b border-neutral-200 text-xs">
                        <div className="flex items-center gap-4">
                            <span className="font-bold text-neutral-600 text-[11px] uppercase tracking-wider">Status Legend:</span>
                            <div className="flex items-center gap-3">
                                {Object.entries(STATUS_CONFIG).map(([st, c]) => (
                                    <div key={st} className="flex items-center gap-1.5">
                                        <span className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[10px] ${c.bg} ${c.text} border ${c.border}`}>
                                            {c.short}
                                        </span>
                                        <span className="text-[11px] text-neutral-600">{c.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="text-[11px] text-neutral-500">
                            Month of <span className="font-bold text-black">{MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}</span> ({daysInMonth.length} days)
                        </div>
                    </div>

                    <div className="overflow-x-auto overflow-y-auto no-scrollbar flex-1">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-neutral-50 text-neutral-700 font-semibold border-b border-neutral-200 sticky top-0 z-20">
                                <tr>
                                    <th className="px-4 py-3 sticky left-0 bg-neutral-50 z-30 shadow-[1px_0_0_0_#e5e7eb] min-w-[160px]">
                                        Employee
                                    </th>
                                    <th className="px-3 py-3 min-w-[90px]">Role</th>
                                    {daysInMonth.map(d => (
                                        <th key={d.day} className="px-1.5 py-2 text-center min-w-[34px] border-r border-neutral-100">
                                            <div className="text-[10px] text-neutral-400 font-mono">{d.weekday}</div>
                                            <div className="font-bold text-black">{d.day}</div>
                                        </th>
                                    ))}
                                    <th className="px-2 py-3 text-center bg-emerald-50 text-emerald-800 font-bold min-w-[40px]" title="Present Days">P</th>
                                    <th className="px-2 py-3 text-center bg-amber-50 text-amber-800 font-bold min-w-[40px]" title="Half Days">H</th>
                                    <th className="px-2 py-3 text-center bg-rose-50 text-rose-800 font-bold min-w-[40px]" title="Absent Days">A</th>
                                    <th className="px-2 py-3 text-center bg-sky-50 text-sky-800 font-bold min-w-[40px]" title="Leave Days">L</th>
                                    <th className="px-2 py-3 text-center bg-purple-50 text-purple-800 font-bold min-w-[40px]" title="Weekly Off Days">WO</th>
                                    <th className="px-3 py-3 text-center bg-neutral-100 text-black font-black min-w-[55px]" title="Attendance Rate">Rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={daysInMonth.length + 8} className="px-6 py-12 text-center text-neutral-500 font-medium">
                                            Loading monthly attendance sheet...
                                        </td>
                                    </tr>
                                ) : filteredEmployees.length === 0 ? (
                                    <tr>
                                        <td colSpan={daysInMonth.length + 8} className="px-6 py-12 text-center text-neutral-500 font-medium">
                                            No employees found for this filter.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredEmployees.map(emp => {
                                        const summary = getMonthlyEmployeeSummary(emp.id);
                                        return (
                                            <tr key={emp.id} className="hover:bg-neutral-50/70 transition-colors">
                                                <td className="px-4 py-2.5 font-bold text-black sticky left-0 bg-white z-10 shadow-[1px_0_0_0_#e5e7eb] truncate max-w-[180px]">
                                                    <div>{emp.name}</div>
                                                    <div className="text-[10px] text-neutral-400 font-mono font-normal">
                                                        {emp.employee_code || emp.employee_id || emp.id.slice(0, 6)}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5 capitalize text-neutral-600 text-[11px] truncate max-w-[100px]">
                                                    {emp.role === 'delivery_boy' ? 'Delivery' : emp.role}
                                                </td>

                                                {daysInMonth.map(d => {
                                                    const status = monthlyAttendanceMap[`${emp.id}_${d.dateStr}`];
                                                    const conf = status ? STATUS_CONFIG[status] : null;

                                                    return (
                                                        <td 
                                                            key={d.day} 
                                                            className="p-1 text-center border-r border-neutral-100 cursor-pointer hover:bg-neutral-100"
                                                            title={`${emp.name} - ${d.dateStr}: ${status || 'Unmarked'}`}
                                                            onClick={() => {
                                                                setSelectedDate(d.dateStr);
                                                                setViewMode('daily');
                                                            }}
                                                        >
                                                            {conf ? (
                                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold ${conf.bg} ${conf.text} border ${conf.border}`}>
                                                                    {conf.short}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center justify-center w-6 h-6 text-neutral-300 text-xs">
                                                                    —
                                                                </span>
                                                            )}
                                                        </td>
                                                    );
                                                })}

                                                {/* Counts */}
                                                <td className="px-2 py-2 text-center font-bold text-emerald-700 bg-emerald-50/40">{summary.p}</td>
                                                <td className="px-2 py-2 text-center font-bold text-amber-700 bg-amber-50/40">{summary.h}</td>
                                                <td className="px-2 py-2 text-center font-bold text-rose-700 bg-rose-50/40">{summary.a}</td>
                                                <td className="px-2 py-2 text-center font-bold text-sky-700 bg-sky-50/40">{summary.l}</td>
                                                <td className="px-2 py-2 text-center font-bold text-purple-700 bg-purple-50/40">{summary.wo}</td>
                                                <td className="px-3 py-2 text-center font-mono font-bold text-black bg-neutral-50/60">
                                                    {summary.rate}%
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
