'use client';

import { useState, useEffect } from 'react';
import { Calendar as LucideCalendar, FileText as LucideFile, Download as LucideDownload, Award as LucideAward, AlertCircle as LucideAlert } from 'lucide-react';
import { PayrollService, Employee, PayrollRun, PayrollItem } from '@/app/services/payroll';

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
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const runs = await PayrollService.fetchPayrollRuns(restaurantId);
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

    // Totals
    const totalEmployees = payrollItems.length;
    const totalBaseSalary = payrollItems.reduce((acc, i) => acc + i.monthly_salary, 0);
    const totalDeductions = payrollItems.reduce((acc, i) => acc + i.deductions, 0);
    const totalOvertime = payrollItems.reduce((acc, i) => acc + i.overtime_pay, 0);
    const totalNetSalary = payrollItems.reduce((acc, i) => acc + i.final_salary, 0);
    const paidCount = payrollItems.filter(i => i.payment_status === 'paid').length;

    const handlePrintReport = () => {
        const reportTitle = `${reportType === 'payroll' ? 'Payroll' : 'Attendance'} Report - ${MONTHS.find(m => m.value === selectedMonth)?.label} ${selectedYear}`;
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
                        body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #000; }
                        h2 { margin: 0 0 4px 0; font-size: 20px; font-weight: 800; text-align: center; }
                        p { margin: 0; font-size: 12px; color: #555; text-align: center; }
                        .subtitle { margin-bottom: 24px; color: #888; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em; }
                        table { w-full; width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                        th { background-color: #f3f4f6; font-weight: 600; text-align: left; border-bottom: 2px solid #e5e7eb; }
                        th, td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
                        .text-right { text-align: right; }
                        .text-center { text-align: center; }
                        .font-bold { font-weight: bold; }
                        .font-mono { font-family: monospace; }
                        .badge { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
                        .badge-paid { background-color: #d1fae5; color: #065f46; }
                        .badge-pending { background-color: #fef3c7; color: #92400e; }
                        .summary-grid { display: grid; grid-template-cols: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
                        .summary-card { border: 1px solid #e5e7eb; padding: 12px; border-radius: 8px; background-color: #f9fafb; }
                        .summary-card span { font-size: 10px; text-transform: uppercase; color: #6b7280; font-weight: bold; }
                        .summary-card h4 { margin: 4px 0 0 0; font-size: 16px; font-weight: 800; }
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
        <div className="flex-1 flex flex-col min-h-0 space-y-5">
            {/* Filter and Export Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-6 pt-6 gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setReportType('payroll')}
                        className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                            reportType === 'payroll'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                        }`}
                    >
                        Payroll Summary
                    </button>
                    <button
                        onClick={() => setReportType('attendance')}
                        className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                            reportType === 'attendance'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                        }`}
                    >
                        Attendance Logs
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Month Picker */}
                    <div className="flex items-center bg-neutral-100 border border-neutral-200 rounded-lg px-2 py-1.5 gap-2 text-sm text-black">
                        <LucideCalendar size={16} className="text-neutral-500" />
                        <select
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(Number(e.target.value))}
                            className="bg-transparent focus:outline-none font-semibold text-xs cursor-pointer"
                        >
                            {MONTHS.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                        <select
                            value={selectedYear}
                            onChange={e => setSelectedYear(Number(e.target.value))}
                            className="bg-transparent focus:outline-none font-semibold text-xs border-l pl-2 border-neutral-300 cursor-pointer"
                        >
                            {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    {payrollRun && (
                        <button
                            onClick={handlePrintReport}
                            className="flex items-center px-3.5 py-2 bg-neutral-900 text-white hover:bg-neutral-800 text-xs font-bold rounded-lg transition-all gap-1.5 shadow-md shadow-neutral-900/10"
                        >
                            <LucideDownload size={14} />
                            Export PDF Report
                        </button>
                    )}
                </div>
            </div>

            {/* If no data exists */}
            {!payrollRun ? (
                <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-neutral-300 rounded-[2rem] m-6 py-20 space-y-4 bg-neutral-50/50">
                    <LucideAlert className="text-neutral-400" size={40} />
                    <div className="text-center">
                        <h4 className="text-sm font-bold text-black">No Report Available</h4>
                        <p className="text-xs text-neutral-500 mt-1">Please generate payroll for {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear} first to view reports.</p>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar mx-6 mb-6 pb-6">
                    {/* Renderable print view container */}
                    <div id="report-print-content" className="space-y-6">
                        {reportType === 'payroll' ? (
                            <>
                                {/* Summary Grid for PDF & UI */}
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                    <div className="summary-card bg-white border p-4 rounded-xl shadow-sm">
                                        <span>Total Headcount</span>
                                        <h4 className="text-lg font-black mt-1 text-black">{totalEmployees} Employees</h4>
                                    </div>
                                    <div className="summary-card bg-white border p-4 rounded-xl shadow-sm">
                                        <span>Total Gross Pay</span>
                                        <h4 className="text-lg font-black mt-1 text-black">₹{totalBaseSalary.toLocaleString('en-IN')}</h4>
                                    </div>
                                    <div className="summary-card bg-white border p-4 rounded-xl shadow-sm">
                                        <span>Deductions & Credits</span>
                                        <h4 className="text-xs font-semibold mt-1 text-black">
                                            Deductions: <span className="text-red-600 font-bold">-₹{totalDeductions.toLocaleString('en-IN')}</span><br/>
                                            Overtime: <span className="text-green-600 font-bold">+₹{totalOvertime.toLocaleString('en-IN')}</span>
                                        </h4>
                                    </div>
                                    <div className="summary-card bg-white border p-4 rounded-xl shadow-sm">
                                        <span>Net Payout Release</span>
                                        <h4 className="text-lg font-black mt-1 text-blue-600">₹{totalNetSalary.toLocaleString('en-IN')}</h4>
                                        <span className="text-[10px] text-neutral-500">Paid: {paidCount} / {totalEmployees}</span>
                                    </div>
                                </div>

                                {/* Detailed Table */}
                                <div className="bg-white rounded-xl border overflow-hidden mt-4">
                                    <table className="w-full text-left text-xs">
                                        <thead>
                                            <tr>
                                                <th className="px-4 py-3">Employee Name</th>
                                                <th className="px-4 py-3">Role</th>
                                                <th className="px-4 py-3">Branch</th>
                                                <th className="px-4 py-3 text-right">Base Salary</th>
                                                <th className="px-4 py-3 text-right">Deductions</th>
                                                <th className="px-4 py-3 text-right">Overtime Pay</th>
                                                <th className="px-4 py-3 text-right">Net Disbursed</th>
                                                <th className="px-4 py-3 text-center">Payout Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {payrollItems.map(item => (
                                                <tr key={item.id}>
                                                    <td className="px-4 py-3 font-semibold text-black">{item.employee?.name}</td>
                                                    <td className="px-4 py-3 capitalize text-neutral-600">{item.employee?.role}</td>
                                                    <td className="px-4 py-3 text-neutral-600">{item.employee?.branch?.name || '-'}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-neutral-600">₹{item.monthly_salary.toLocaleString('en-IN')}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-red-600">-₹{item.deductions.toLocaleString('en-IN')}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-green-600">+₹{item.overtime_pay.toLocaleString('en-IN')}</td>
                                                    <td className="px-4 py-3 text-right font-mono font-bold text-black">₹{item.final_salary.toLocaleString('en-IN')}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`badge ${item.payment_status === 'paid' ? 'badge-paid' : 'badge-pending'}`}>
                                                            {item.payment_status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="bg-neutral-50 font-bold border-t-2">
                                                <td colSpan={3} className="px-4 py-3 text-black">Total Summary</td>
                                                <td className="px-4 py-3 text-right font-mono">₹{totalBaseSalary.toLocaleString('en-IN')}</td>
                                                <td className="px-4 py-3 text-right font-mono text-red-600">-₹{totalDeductions.toLocaleString('en-IN')}</td>
                                                <td className="px-4 py-3 text-right font-mono text-green-600">+₹{totalOvertime.toLocaleString('en-IN')}</td>
                                                <td className="px-4 py-3 text-right font-mono text-blue-600">₹{totalNetSalary.toLocaleString('en-IN')}</td>
                                                <td className="px-4 py-3 text-center text-[10px] text-neutral-400">Run: {payrollRun.status.toUpperCase()}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Attendance Logs Detailed View */}
                                <div className="bg-white rounded-xl border overflow-hidden">
                                    <table className="w-full text-left text-xs">
                                        <thead>
                                            <tr>
                                                <th className="px-4 py-3">Employee Name</th>
                                                <th className="px-4 py-3">Role</th>
                                                <th className="px-4 py-3 text-center">Present (Days)</th>
                                                <th className="px-4 py-3 text-center">Half Days</th>
                                                <th className="px-4 py-3 text-center">Absent (Days)</th>
                                                <th className="px-4 py-3 text-center">Leave (Days)</th>
                                                <th className="px-4 py-3 text-center">Log Rate (%)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {payrollItems.map(item => {
                                                const totalLogged = item.present_days + item.absent_days + item.half_days;
                                                const rate = totalLogged > 0 ? Math.round(((item.present_days + (item.half_days * 0.5)) / totalLogged) * 100) : 0;
                                                return (
                                                    <tr key={item.id}>
                                                        <td className="px-4 py-3 font-semibold text-black">{item.employee?.name}</td>
                                                        <td className="px-4 py-3 capitalize text-neutral-600">{item.employee?.role}</td>
                                                        <td className="px-4 py-3 text-center text-green-700 font-bold bg-green-50/20">{item.present_days}</td>
                                                        <td className="px-4 py-3 text-center text-amber-700 font-bold bg-amber-50/20">{item.half_days}</td>
                                                        <td className="px-4 py-3 text-center text-red-700 font-bold bg-red-50/20">{item.absent_days}</td>
                                                        <td className="px-4 py-3 text-center text-blue-700 font-bold bg-blue-50/20">
                                                            {30 - item.present_days - item.absent_days - item.half_days > 0 ? 30 - item.present_days - item.absent_days - item.half_days : 0}
                                                        </td>
                                                        <td className="px-4 py-3 text-center font-semibold font-mono text-black">{rate}%</td>
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
