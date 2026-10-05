'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
    Calendar as LucideCalendar, 
    FileText as LucideFile, 
    Download as LucideDownload, 
    Award as LucideAward, 
    AlertCircle as LucideAlert,
    Filter as LucideFilter,
    ListFilter as LucideListFilter
} from 'lucide-react';
import { PayrollService, PayrollRun, PayrollItem, Branch } from '@/services/payroll.service';

interface ReportsTabProps {
    restaurantId: string;
}

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

type ReportType = 'payroll' | 'attendance';

export default function ReportsTab({ restaurantId }: ReportsTabProps) {
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
    const [reportType, setReportType] = useState<ReportType>('payroll');

    const [payrollRun, setPayrollRun] = useState<PayrollRun | null>(null);
    const [payrollItems, setPayrollItems] = useState<PayrollItem[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [branchFilter, setBranchFilter] = useState('all');
    const [roleFilter, setRoleFilter] = useState('all');
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const [runs, branchList] = await Promise.all([
                PayrollService.fetchPayrollRuns(restaurantId),
                PayrollService.fetchBranches(restaurantId)
            ]);
            setBranches(branchList);
            const activeRun = runs.find(r => r.month === selectedMonth && r.year === selectedYear);

            if (activeRun) {
                setPayrollRun(activeRun);
                const items = await PayrollService.fetchPayrollItems(activeRun.id);
                setPayrollItems(items);
            } else {
                setPayrollRun(null);
                setPayrollItems([]);
            }
        } catch (error) {
            console.error('Failed to load report data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (restaurantId) {
            loadData();
        }
    }, [restaurantId, selectedMonth, selectedYear]);

    // Filter items
    const filteredItems = useMemo(() => {
        return payrollItems.filter(item => {
            const emp = item.employee;
            if (!emp) return true;
            const matchesRole = roleFilter === 'all' || emp.role.toLowerCase() === roleFilter.toLowerCase();
            const matchesBranch = branchFilter === 'all' || emp.branch_id === branchFilter;
            return matchesRole && matchesBranch;
        });
    }, [payrollItems, roleFilter, branchFilter]);

    // Unique roles
    const availableRoles = useMemo(() => {
        const roles = new Set(payrollItems.map(i => i.employee?.role).filter(Boolean));
        return Array.from(roles) as string[];
    }, [payrollItems]);

    // Totals
    const totalEmployees = filteredItems.length;
    const totalBaseSalary = filteredItems.reduce((acc, i) => acc + (i.gross_salary || i.monthly_salary), 0);
    const totalDeductions = filteredItems.reduce((acc, i) => acc + i.deductions, 0);
    const totalOvertime = filteredItems.reduce((acc, i) => acc + i.overtime_pay, 0);
    const totalNetSalary = filteredItems.reduce((acc, i) => acc + i.final_salary, 0);
    const paidCount = filteredItems.filter(i => i.payment_status === 'paid').length;

    // Attendance Totals
    const totalPresentDays = filteredItems.reduce((acc, i) => acc + i.present_days, 0);
    const totalHalfDays = filteredItems.reduce((acc, i) => acc + i.half_days, 0);
    const totalAbsentDays = filteredItems.reduce((acc, i) => acc + i.absent_days, 0);
    const totalLeaveDays = filteredItems.reduce((acc, i) => acc + (i.leave_days || 0), 0);
    const totalWeeklyOffDays = filteredItems.reduce((acc, i) => acc + (i.weekly_off_days || 0), 0);

    const handlePrintReport = () => {
        const monthName = MONTHS.find(m => m.value === selectedMonth)?.label;
        const reportTitle = `${reportType === 'payroll' ? 'Payroll Salary Statement' : 'Staff Attendance Summary'} - ${monthName} ${selectedYear}`;
        const printContent = document.getElementById('report-print-content');
        if (!printContent) return;

        const win = window.open('', '_blank');
        if (!win) {
            alert('Popup blocked. Please allow popups to download report PDFs.');
            return;
        }

        win.document.write(`
            <html>
                <head>
                    <title>${reportTitle}</title>
                    <style>
                        body { font-family: system-ui, -apple-system, sans-serif; padding: 30px; color: #111; }
                        h2 { margin: 0 0 4px 0; font-size: 20px; font-weight: 800; text-align: center; }
                        p { margin: 0; font-size: 12px; color: #555; text-align: center; }
                        .subtitle { margin-bottom: 20px; color: #666; text-transform: uppercase; font-weight: bold; font-size: 11px; letter-spacing: 0.05em; }
                        table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 11px; }
                        th { background-color: #f3f4f6; font-weight: 600; text-align: left; border-bottom: 2px solid #e5e7eb; }
                        th, td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
                        .text-right { text-align: right; }
                        .text-center { text-align: center; }
                        .font-bold { font-weight: bold; }
                        .font-mono { font-family: monospace; }
                        .badge { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
                        .badge-paid { background-color: #d1fae5; color: #065f46; }
                        .badge-pending { background-color: #fef3c7; color: #92400e; }
                        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
                        .summary-card { border: 1px solid #e5e7eb; padding: 10px; border-radius: 8px; background-color: #f9fafb; }
                        .summary-card span { font-size: 10px; text-transform: uppercase; color: #6b7280; font-weight: bold; }
                        .summary-card h4 { margin: 4px 0 0 0; font-size: 14px; font-weight: 800; }
                        @media print {
                            body { padding: 0; }
                        }
                    </style>
                </head>
                <body>
                    <h2>DINE IN ONE</h2>
                    <p className="subtitle">${reportTitle}</p>
                    ${printContent.innerHTML}
                    <script>
                        window.onload = function() {
                            window.print();
                            setTimeout(function() { window.close(); }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        win.document.close();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-neutral-500 font-medium">
                Generating report data...
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 space-y-4">
            {/* Header and Controls */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center px-6 pt-6 gap-4 shrink-0">
                <div>
                    <h3 className="text-lg font-bold text-black">Payroll & Attendance Analytics</h3>
                    <p className="text-xs text-neutral-500">Audit disbursed salary sheets and verify monthly attendance statistics.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Report Type Toggle */}
                    <div className="flex bg-neutral-100 p-0.5 rounded-lg border border-neutral-200">
                        <button
                            onClick={() => setReportType('payroll')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                                reportType === 'payroll'
                                    ? 'bg-white text-black shadow-sm'
                                    : 'text-neutral-500 hover:text-black'
                            }`}
                        >
                            <LucideFile size={13} />
                            Salary Sheet
                        </button>
                        <button
                            onClick={() => setReportType('attendance')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                                reportType === 'attendance'
                                    ? 'bg-white text-black shadow-sm'
                                    : 'text-neutral-500 hover:text-black'
                            }`}
                        >
                            <LucideAward size={13} />
                            Attendance Logs
                        </button>
                    </div>

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

                    {/* Month Picker */}
                    <div className="flex items-center bg-neutral-100 border border-neutral-200 rounded-lg px-2.5 py-1.5 gap-2 text-xs text-black">
                        <LucideCalendar size={14} className="text-neutral-500" />
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

                    {/* Print / Download Button */}
                    {payrollRun && (
                        <button
                            onClick={handlePrintReport}
                            className="flex items-center px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all gap-1.5 shadow-md shadow-blue-600/10"
                        >
                            <LucideDownload size={14} />
                            Download / Print PDF
                        </button>
                    )}
                </div>
            </div>

            {/* Empty State */}
            {!payrollRun ? (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-neutral-200 rounded-[2rem] mx-6 mb-6 p-12 text-center bg-white space-y-3">
                    <div className="w-12 h-12 bg-neutral-100 text-neutral-400 rounded-full flex items-center justify-center">
                        <LucideAlert size={22} />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-black">No Report Available</h4>
                        <p className="text-xs text-neutral-500 mt-1">
                            Please generate payroll for <span className="font-bold text-black">{MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}</span> first to view reports.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar mx-6 mb-6 pb-6">
                    <div id="report-print-content" className="space-y-4">
                        {reportType === 'payroll' ? (
                            <>
                                {/* Summary Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="summary-card bg-white border border-neutral-200 p-3.5 rounded-xl shadow-sm">
                                        <span className="text-[10px] uppercase font-bold text-neutral-400">Total Staff</span>
                                        <h4 className="text-base font-black mt-1 text-black">{totalEmployees} Members</h4>
                                        <span className="text-[10px] text-neutral-400">Status: {payrollRun.status.toUpperCase()}</span>
                                    </div>
                                    <div className="summary-card bg-white border border-neutral-200 p-3.5 rounded-xl shadow-sm">
                                        <span className="text-[10px] uppercase font-bold text-neutral-400">Gross Payroll</span>
                                        <h4 className="text-base font-black mt-1 text-black">₹{totalBaseSalary.toLocaleString('en-IN')}</h4>
                                        <span className="text-[10px] text-neutral-400">Overtime: +₹{totalOvertime.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="summary-card bg-white border border-neutral-200 p-3.5 rounded-xl shadow-sm">
                                        <span className="text-[10px] uppercase font-bold text-neutral-400">Absence Deductions</span>
                                        <h4 className="text-base font-black mt-1 text-rose-600">-₹{totalDeductions.toLocaleString('en-IN')}</h4>
                                        <span className="text-[10px] text-neutral-400">Policy & unexcused cuts</span>
                                    </div>
                                    <div className="summary-card bg-white border border-neutral-200 p-3.5 rounded-xl shadow-sm">
                                        <span className="text-[10px] uppercase font-bold text-neutral-400">Net Disbursed</span>
                                        <h4 className="text-base font-black mt-1 text-blue-600">₹{totalNetSalary.toLocaleString('en-IN')}</h4>
                                        <span className="text-[10px] text-emerald-600 font-bold">Paid: {paidCount} / {totalEmployees}</span>
                                    </div>
                                </div>

                                {/* Detailed Table */}
                                <div className="bg-white rounded-[2rem] border border-neutral-200 shadow-sm overflow-hidden mt-3">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200">
                                            <tr>
                                                <th className="px-4 py-3">Employee Name</th>
                                                <th className="px-3 py-3">Role</th>
                                                <th className="px-3 py-3">Branch</th>
                                                <th className="px-3 py-3 text-right">Gross Salary</th>
                                                <th className="px-3 py-3 text-right">Deductions</th>
                                                <th className="px-3 py-3 text-right">Overtime Pay</th>
                                                <th className="px-3 py-3 text-right">Net Payable</th>
                                                <th className="px-3 py-3 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-200">
                                            {filteredItems.map(item => (
                                                <tr key={item.id} className="hover:bg-neutral-50/70 transition-colors">
                                                    <td className="px-4 py-3 font-semibold text-black">
                                                        <div>{item.employee?.name}</div>
                                                        <div className="text-[10px] text-neutral-400 font-mono font-normal">
                                                            {item.employee?.employee_code || item.employee?.employee_id || item.employee_id.slice(0, 8)}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 capitalize text-neutral-600">
                                                        {item.employee?.role === 'delivery_boy' ? 'Delivery Boy' : item.employee?.role}
                                                    </td>
                                                    <td className="px-3 py-3 text-neutral-600">
                                                        {item.employee?.branch?.name || 'Main Branch'}
                                                    </td>
                                                    <td className="px-3 py-3 text-right font-mono text-neutral-600">
                                                        ₹{(item.gross_salary || item.monthly_salary).toLocaleString('en-IN')}
                                                    </td>
                                                    <td className="px-3 py-3 text-right font-mono text-rose-600 font-semibold">
                                                        -₹{item.deductions.toLocaleString('en-IN')}
                                                    </td>
                                                    <td className="px-3 py-3 text-right font-mono text-emerald-600 font-semibold">
                                                        +₹{item.overtime_pay.toLocaleString('en-IN')}
                                                    </td>
                                                    <td className="px-3 py-3 text-right font-mono font-bold text-black text-sm">
                                                        ₹{item.final_salary.toLocaleString('en-IN')}
                                                    </td>
                                                    <td className="px-3 py-3 text-center">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                            item.payment_status === 'paid' 
                                                                ? 'bg-emerald-100 text-emerald-800' 
                                                                : 'bg-amber-100 text-amber-800'
                                                        }`}>
                                                            {item.payment_status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="bg-neutral-50 font-bold border-t-2 border-neutral-300">
                                                <td colSpan={3} className="px-4 py-3 text-black">Total Summary ({filteredItems.length} staff)</td>
                                                <td className="px-3 py-3 text-right font-mono">₹{totalBaseSalary.toLocaleString('en-IN')}</td>
                                                <td className="px-3 py-3 text-right font-mono text-rose-600">-₹{totalDeductions.toLocaleString('en-IN')}</td>
                                                <td className="px-3 py-3 text-right font-mono text-emerald-600">+₹{totalOvertime.toLocaleString('en-IN')}</td>
                                                <td className="px-3 py-3 text-right font-mono text-blue-600 text-sm">₹{totalNetSalary.toLocaleString('en-IN')}</td>
                                                <td className="px-3 py-3 text-center text-[10px] text-neutral-500 uppercase">
                                                    {paidCount}/{totalEmployees} Paid
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Attendance Summary Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                    <div className="bg-emerald-50/70 border border-emerald-200 p-3 rounded-xl">
                                        <span className="text-[10px] uppercase font-bold text-emerald-700">Total Present Days</span>
                                        <h4 className="text-base font-black text-emerald-800 mt-1">{totalPresentDays}</h4>
                                    </div>
                                    <div className="bg-amber-50/70 border border-amber-200 p-3 rounded-xl">
                                        <span className="text-[10px] uppercase font-bold text-amber-700">Total Half Days</span>
                                        <h4 className="text-base font-black text-amber-800 mt-1">{totalHalfDays}</h4>
                                    </div>
                                    <div className="bg-rose-50/70 border border-rose-200 p-3 rounded-xl">
                                        <span className="text-[10px] uppercase font-bold text-rose-700">Total Absent Days</span>
                                        <h4 className="text-base font-black text-rose-800 mt-1">{totalAbsentDays}</h4>
                                    </div>
                                    <div className="bg-sky-50/70 border border-sky-200 p-3 rounded-xl">
                                        <span className="text-[10px] uppercase font-bold text-sky-700">Approved Leaves</span>
                                        <h4 className="text-base font-black text-sky-800 mt-1">{totalLeaveDays}</h4>
                                    </div>
                                    <div className="bg-purple-50/70 border border-purple-200 p-3 rounded-xl">
                                        <span className="text-[10px] uppercase font-bold text-purple-700">Weekly Off Days</span>
                                        <h4 className="text-base font-black text-purple-800 mt-1">{totalWeeklyOffDays}</h4>
                                    </div>
                                </div>

                                {/* Attendance Logs Detailed View */}
                                <div className="bg-white rounded-[2rem] border border-neutral-200 shadow-sm overflow-hidden mt-3">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200">
                                            <tr>
                                                <th className="px-4 py-3">Employee Name</th>
                                                <th className="px-3 py-3">Role</th>
                                                <th className="px-3 py-3">Branch</th>
                                                <th className="px-3 py-3 text-center">Present (Days)</th>
                                                <th className="px-3 py-3 text-center">Half Days</th>
                                                <th className="px-3 py-3 text-center">Absent (Days)</th>
                                                <th className="px-3 py-3 text-center">Leave (Days)</th>
                                                <th className="px-3 py-3 text-center">Weekly Off</th>
                                                <th className="px-3 py-3 text-center">Attendance Rate (%)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-200">
                                            {filteredItems.map(item => {
                                                const totalLogged = item.present_days + item.absent_days + item.half_days + (item.leave_days || 0) + (item.weekly_off_days || 0);
                                                const worked = item.present_days + (item.half_days * 0.5) + (item.leave_days || 0) + (item.weekly_off_days || 0);
                                                const rate = totalLogged > 0 ? Math.round((worked / totalLogged) * 100) : 0;

                                                return (
                                                    <tr key={item.id} className="hover:bg-neutral-50/70 transition-colors">
                                                        <td className="px-4 py-3 font-semibold text-black">
                                                            <div>{item.employee?.name}</div>
                                                            <div className="text-[10px] text-neutral-400 font-mono font-normal">
                                                                {item.employee?.employee_code || item.employee?.employee_id || item.employee_id.slice(0, 8)}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-3 capitalize text-neutral-600">
                                                            {item.employee?.role === 'delivery_boy' ? 'Delivery Boy' : item.employee?.role}
                                                        </td>
                                                        <td className="px-3 py-3 text-neutral-600">
                                                            {item.employee?.branch?.name || 'Main Branch'}
                                                        </td>
                                                        <td className="px-3 py-3 text-center text-emerald-700 font-bold bg-emerald-50/30">
                                                            {item.present_days}
                                                        </td>
                                                        <td className="px-3 py-3 text-center text-amber-700 font-bold bg-amber-50/30">
                                                            {item.half_days}
                                                        </td>
                                                        <td className="px-3 py-3 text-center text-rose-700 font-bold bg-rose-50/30">
                                                            {item.absent_days}
                                                        </td>
                                                        <td className="px-3 py-3 text-center text-sky-700 font-bold bg-sky-50/30">
                                                            {item.leave_days || 0}
                                                        </td>
                                                        <td className="px-3 py-3 text-center text-purple-700 font-bold bg-purple-50/30">
                                                            {item.weekly_off_days || 0}
                                                        </td>
                                                        <td className="px-3 py-3 text-center font-bold font-mono text-black">
                                                            <span className={`px-2 py-0.5 rounded text-[11px] ${
                                                                rate >= 80 ? 'bg-emerald-100 text-emerald-800' :
                                                                rate >= 60 ? 'bg-amber-100 text-amber-800' :
                                                                'bg-rose-100 text-rose-800'
                                                            }`}>
                                                                {rate}%
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
