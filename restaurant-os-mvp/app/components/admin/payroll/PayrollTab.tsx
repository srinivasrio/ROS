'use client';

import { useState, useEffect } from 'react';
import { Calendar as LucideCalendar, PlusCircle as LucidePlus, DollarSign as LucideDollar, Printer as LucidePrinter, CheckCircle as LucideCheckCircle, RefreshCw as LucideRefresh, AlertCircle as LucideAlert, X as LucideX } from 'lucide-react';
import { PayrollService, Employee, PayrollRun, PayrollItem } from '@/app/services/payroll';

interface PayrollTabProps {
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

export default function PayrollTab({ restaurantId }: PayrollTabProps) {
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
    
    const [payrollRun, setPayrollRun] = useState<PayrollRun | null>(null);
    const [payrollItems, setPayrollItems] = useState<PayrollItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [previewItem, setPreviewItem] = useState<PayrollItem | null>(null);

    const loadPayroll = async () => {
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
            console.error('Failed to load payroll:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (restaurantId) {
            loadPayroll();
        }
    }, [restaurantId, selectedMonth, selectedYear]);

    const handleCreateRun = async () => {
        setActionLoading(true);
        try {
            const run = await PayrollService.createPayrollRun(restaurantId, selectedMonth, selectedYear);
            await PayrollService.generatePayrollItems(run.id, restaurantId, selectedMonth, selectedYear);
            await loadPayroll();
        } catch (error) {
            console.error(error);
            alert('Failed to generate payroll run');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRecalculate = async () => {
        if (!payrollRun) return;
        setActionLoading(true);
        try {
            await PayrollService.generatePayrollItems(payrollRun.id, restaurantId, selectedMonth, selectedYear);
            await loadPayroll();
        } catch (error) {
            console.error(error);
            alert('Failed to recalculate payroll');
        } finally {
            setActionLoading(false);
        }
    };

    const handleStatusUpdate = async (itemId: string, status: 'pending' | 'paid') => {
        try {
            await PayrollService.updatePayrollItemStatus(itemId, status);
            // Refresh inline
            setPayrollItems(prev => prev.map(item => {
                if (item.id === itemId) {
                    return { ...item, payment_status: status, paid_at: status === 'paid' ? new Date().toISOString() : null };
                }
                return item;
            }));
        } catch (error) {
            alert('Failed to update status');
        }
    };

    const handleMarkAllPaid = async () => {
        if (!payrollRun) return;
        if (!confirm('Are you sure you want to mark this entire payroll run as PAID?')) return;
        setActionLoading(true);
        try {
            await PayrollService.updatePayrollRunStatus(payrollRun.id, 'paid');
            await loadPayroll();
        } catch (error) {
            console.error(error);
            alert('Failed to update run status');
        } finally {
            setActionLoading(false);
        }
    };

    const handleOvertimeChange = async (item: PayrollItem, overtimeHours: number) => {
        try {
            const hourlyRate = item.employee?.overtime_per_hour || 0;
            const overtimePay = overtimeHours * hourlyRate;
            
            // Recompute final salary
            const deductions = item.deductions;
            const baseSalary = item.monthly_salary;
            const finalSalary = Math.max(0, Number((baseSalary - deductions + overtimePay).toFixed(2)));

            await PayrollService.updatePayrollItem(item.id, {
                overtime_hours: overtimeHours,
                overtime_pay: overtimePay,
                final_salary: finalSalary
            });

            // Update local state
            setPayrollItems(prev => prev.map(i => {
                if (i.id === item.id) {
                    return {
                        ...i,
                        overtime_hours: overtimeHours,
                        overtime_pay: overtimePay,
                        final_salary: finalSalary
                    };
                }
                return i;
            }));
        } catch (error) {
            console.error(error);
            alert('Failed to update overtime hours');
        }
    };

    // Calculate totals
    const totalSalary = payrollItems.reduce((acc, i) => acc + i.final_salary, 0);
    const paidSalary = payrollItems.reduce((acc, i) => acc + (i.payment_status === 'paid' ? i.final_salary : 0), 0);
    const pendingSalary = totalSalary - paidSalary;

    const handlePrintPayslip = (item: PayrollItem) => {
        setPreviewItem(item);
    };

    const triggerPrint = () => {
        const printContent = document.getElementById('payslip-print-view');
        if (!printContent) return;

        const win = window.open('', '_blank');
        if (!win) {
            alert('Popup blocked. Please allow popups to print payslips.');
            return;
        }

        win.document.write(`
            <html>
                <head>
                    <title>Payslip - ${previewItem?.employee?.name || 'Employee'}</title>
                    <style>
                        body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #000; }
                        .text-center { text-align: center; }
                        .border-b { border-bottom: 1px solid #e5e7eb; }
                        .pb-4 { padding-bottom: 16px; }
                        .mb-4 { margin-bottom: 16px; }
                        .mt-1 { margin-top: 4px; }
                        .mt-6 { margin-top: 24px; }
                        .grid { display: grid; grid-template-cols: 1fr 1fr; gap: 8px; }
                        .space-y-2 > * { margin-bottom: 8px; }
                        .flex { display: flex; justify-content: space-between; align-items: center; }
                        .font-bold { font-weight: bold; }
                        .font-semibold { font-weight: 600; }
                        .font-mono { font-family: monospace; }
                        .bg-neutral-50 { background-color: #f9fafb; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; }
                        .text-xs { font-size: 12px; }
                        .text-sm { font-size: 14px; }
                        .text-lg { font-size: 18px; }
                        .text-blue-600 { color: #2563eb; }
                        .text-green-600 { color: #16a34a; }
                        .text-red-600 { color: #dc2626; }
                        .text-neutral-500 { color: #6b7280; }
                        .text-neutral-400 { color: #9ca3af; }
                        .uppercase { text-transform: uppercase; }
                        .capitalize { text-transform: capitalize; }
                        @media print {
                            body { padding: 0; }
                        }
                    </style>
                </head>
                <body>
                    <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; padding: 24px; border-radius: 12px;">
                        ${printContent.innerHTML}
                    </div>
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
                Loading payroll records...
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 space-y-5">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-6 pt-6 gap-4 shrink-0">
                <div>
                    <h3 className="text-lg font-bold text-black">Monthly Payroll Sheets</h3>
                    <p className="text-xs text-neutral-500">Calculate net salaries, absence deductions, overtime credits, and release payouts.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Month Picker */}
                    <div className="flex items-center bg-neutral-100 border border-neutral-200 rounded-lg px-2 py-1.5 gap-2 text-sm text-black">
                        <LucideCalendar size={16} className="text-neutral-500" />
                        <select
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(Number(e.target.value))}
                            className="bg-transparent focus:outline-none font-semibold text-xs"
                        >
                            {MONTHS.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                        <select
                            value={selectedYear}
                            onChange={e => setSelectedYear(Number(e.target.value))}
                            className="bg-transparent focus:outline-none font-semibold text-xs border-l pl-2 border-neutral-300"
                        >
                            {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    {payrollRun && (
                        <>
                            <button
                                onClick={handleRecalculate}
                                disabled={actionLoading || payrollRun.status === 'paid'}
                                className="flex items-center px-3.5 py-2 border border-neutral-300 text-black hover:bg-neutral-50 text-xs font-bold rounded-lg transition-all gap-1.5 disabled:opacity-50"
                            >
                                <LucideRefresh size={14} className={actionLoading ? 'animate-spin' : ''} />
                                Recalculate
                            </button>

                            <button
                                onClick={handleMarkAllPaid}
                                disabled={actionLoading || payrollRun.status === 'paid'}
                                className="flex items-center px-3.5 py-2 bg-green-600 text-white hover:bg-green-700 text-xs font-bold rounded-lg transition-all gap-1.5 shadow-md shadow-green-600/10 disabled:opacity-50"
                            >
                                <LucideCheckCircle size={14} />
                                Mark Run as Paid
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* If no payroll run exists for selected month/year */}
            {!payrollRun ? (
                <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-neutral-300 rounded-[2rem] m-6 py-20 space-y-4 bg-neutral-50/50">
                    <LucideAlert className="text-neutral-400" size={40} />
                    <div className="text-center">
                        <h4 className="text-sm font-bold text-black">No Payroll Active</h4>
                        <p className="text-xs text-neutral-500 mt-1">Payroll sheet has not been generated for {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}.</p>
                    </div>
                    <button
                        onClick={handleCreateRun}
                        disabled={actionLoading}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all gap-2 shadow-lg shadow-blue-600/15"
                    >
                        <LucidePlus size={16} />
                        Generate Payroll Sheet
                    </button>
                </div>
            ) : (
                <>
                    {/* Top Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-6 shrink-0">
                        <div className="bg-white border border-neutral-200 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Payroll Status</span>
                                <h4 className={`text-sm font-bold capitalize mt-1 ${payrollRun.status === 'paid' ? 'text-green-600' : 'text-amber-500'}`}>
                                    {payrollRun.status}
                                </h4>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center">
                                <LucideAlert size={16} className="text-neutral-500" />
                            </div>
                        </div>

                        <div className="bg-white border border-neutral-200 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Total Payroll</span>
                                <h4 className="text-base font-black text-black mt-1">₹{totalSalary.toLocaleString('en-IN')}</h4>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
                                <LucideDollar size={16} className="text-blue-600" />
                            </div>
                        </div>

                        <div className="bg-white border border-neutral-200 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Total Paid</span>
                                <h4 className="text-base font-black text-green-600 mt-1">₹{paidSalary.toLocaleString('en-IN')}</h4>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center">
                                <LucideCheckCircle size={16} className="text-green-600" />
                            </div>
                        </div>

                        <div className="bg-white border border-neutral-200 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Total Pending</span>
                                <h4 className="text-base font-black text-amber-500 mt-1">₹{pendingSalary.toLocaleString('en-IN')}</h4>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-amber-55 flex items-center justify-center">
                                <LucideDollar size={16} className="text-amber-500" />
                            </div>
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="bg-white rounded-[2rem] border border-neutral-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0 mx-6 mb-6">
                        <div className="overflow-y-auto no-scrollbar flex-1">
                            <table className="w-full text-left text-sm text-black">
                                <thead className="bg-neutral-50 text-black font-medium border-b border-neutral-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-4">Employee</th>
                                        <th className="px-6 py-4">Base Salary</th>
                                        <th className="px-6 py-4 text-center">Attendance Logs</th>
                                        <th className="px-6 py-4 text-center">Deductions</th>
                                        <th className="px-6 py-4 text-center">Overtime Hours</th>
                                        <th className="px-6 py-4 text-center">Overtime Pay</th>
                                        <th className="px-6 py-4">Net Salary</th>
                                        <th className="px-6 py-4">Payout</th>
                                        <th className="px-6 py-4 text-right">Payslip</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-200">
                                    {payrollItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="px-6 py-10 text-center text-neutral-500 font-medium">
                                                No calculations found. Run recalculate to populate.
                                            </td>
                                        </tr>
                                    ) : (
                                        payrollItems.map(item => (
                                            <tr key={item.id} className="hover:bg-neutral-50 transition-colors">
                                                <td className="px-6 py-4 font-medium text-black">
                                                    {item.employee?.name || 'Unknown Employee'}
                                                </td>
                                                <td className="px-6 py-4 text-neutral-600 font-mono text-xs">
                                                    ₹{item.monthly_salary.toLocaleString('en-IN')}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex justify-center items-center gap-1.5 text-xs">
                                                        <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-bold">{item.present_days}P</span>
                                                        <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-bold">{item.absent_days}A</span>
                                                        <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold">{item.half_days}H</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center text-red-600 font-semibold font-mono text-xs">
                                                    -₹{item.deductions.toLocaleString('en-IN')}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {payrollRun.status === 'paid' ? (
                                                        <span className="font-mono text-xs">{item.overtime_hours} hrs</span>
                                                    ) : (
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            className="w-16 px-1 py-0.5 border rounded text-center text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                                                            value={item.overtime_hours}
                                                            onChange={e => handleOvertimeChange(item, Number(e.target.value))}
                                                        />
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center text-green-600 font-semibold font-mono text-xs">
                                                    +₹{item.overtime_pay.toLocaleString('en-IN')}
                                                </td>
                                                <td className="px-6 py-4 font-bold text-black font-mono">
                                                    ₹{item.final_salary.toLocaleString('en-IN')}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={() => handleStatusUpdate(item.id, item.payment_status === 'paid' ? 'pending' : 'paid')}
                                                        disabled={payrollRun.status === 'paid'}
                                                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${
                                                            item.payment_status === 'paid'
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-amber-100 text-amber-800'
                                                        }`}
                                                    >
                                                        {item.payment_status}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => handlePrintPayslip(item)}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                        title="Print Payslip"
                                                    >
                                                        <LucidePrinter size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Payslip View Modal */}
            {previewItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
                        <div className="flex justify-between items-center p-4 border-b border-neutral-100 shrink-0">
                            <h3 className="text-base font-bold text-black">Payslip Preview</h3>
                            <button onClick={() => setPreviewItem(null)} className="text-black hover:text-black">
                                <LucideX size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto no-scrollbar max-h-[70vh]">
                            <div id="payslip-print-view" className="bg-white p-6 border rounded-lg text-black font-sans text-sm">
                                <div className="text-center border-b pb-4 mb-4">
                                    <h2 className="text-lg font-black tracking-tight">DINE IN ONE</h2>
                                    <p className="text-xs text-neutral-500">Monthly Salary Statement</p>
                                    <p className="text-[10px] font-mono text-neutral-400 mt-1">
                                        For: {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-y-2 text-xs border-b pb-4 mb-4">
                                    <div>
                                        <span className="text-neutral-500 font-medium">Employee Name:</span>
                                        <p className="font-bold">{previewItem.employee?.name}</p>
                                    </div>
                                    <div>
                                        <span className="text-neutral-500 font-medium">Phone Number:</span>
                                        <p className="font-mono">{previewItem.employee?.phone}</p>
                                    </div>
                                    <div>
                                        <span className="text-neutral-500 font-medium">Designation / Role:</span>
                                        <p className="font-bold capitalize">{previewItem.employee?.role}</p>
                                    </div>
                                    <div>
                                        <span className="text-neutral-500 font-medium">Branch Location:</span>
                                        <p className="font-bold">{previewItem.employee?.branch?.name || 'N/A'}</p>
                                    </div>
                                </div>

                                <div className="space-y-2 border-b pb-4 mb-4 text-xs">
                                    <div className="flex justify-between items-center font-medium">
                                        <span>Base Monthly Salary:</span>
                                        <span className="font-mono">₹{previewItem.monthly_salary.toLocaleString('en-IN')}</span>
                                    </div>
                                    
                                    <div className="flex justify-between items-center text-neutral-600">
                                        <span>Present Days:</span>
                                        <span className="font-mono">{previewItem.present_days} Days</span>
                                    </div>

                                    <div className="flex justify-between items-center text-red-600 font-medium">
                                        <span>Absence / Half Day Deductions:</span>
                                        <span className="font-mono">-₹{previewItem.deductions.toLocaleString('en-IN')}</span>
                                    </div>

                                    <div className="flex justify-between items-center text-green-600 font-medium">
                                        <span>Overtime Pay ({previewItem.overtime_hours} hrs):</span>
                                        <span className="font-mono">+₹{previewItem.overtime_pay.toLocaleString('en-IN')}</span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center font-bold text-sm bg-neutral-50 p-2.5 rounded-lg border">
                                    <span>Net Salary Disbursed:</span>
                                    <span className="font-mono text-blue-600">₹{previewItem.final_salary.toLocaleString('en-IN')}</span>
                                </div>

                                <div className="mt-6 flex justify-between items-center text-[10px] text-neutral-400">
                                    <span>Payment Status: <span className="font-bold uppercase text-green-600">{previewItem.payment_status}</span></span>
                                    <span>Date generated: {new Date().toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-neutral-100 flex gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setPreviewItem(null)}
                                className="flex-1 px-4 py-2 border border-neutral-300 text-black font-semibold rounded-lg hover:bg-neutral-50 text-xs"
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                onClick={triggerPrint}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 text-xs flex justify-center items-center gap-1.5"
                            >
                                <LucidePrinter size={15} />
                                Print Payslip
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
