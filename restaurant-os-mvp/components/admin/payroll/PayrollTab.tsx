'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
    Calendar as LucideCalendar, 
    PlusCircle as LucidePlus, 
    DollarSign as LucideDollar, 
    Printer as LucidePrinter, 
    CheckCircle as LucideCheckCircle, 
    RefreshCw as LucideRefresh, 
    AlertCircle as LucideAlert, 
    X as LucideX,
    Filter as LucideFilter,
    Search as LucideSearch,
    Edit2 as LucideEdit2
} from 'lucide-react';
import { PayrollService, PayrollRun, PayrollItem, Branch } from '@/services/payroll.service';
import { toast } from 'sonner';

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
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    
    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [branchFilter, setBranchFilter] = useState('all');

    // Modals
    const [previewItem, setPreviewItem] = useState<PayrollItem | null>(null);
    const [editingDeductionItem, setEditingDeductionItem] = useState<PayrollItem | null>(null);
    const [deductionInput, setDeductionInput] = useState<string>('');

    const loadPayroll = async () => {
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
            console.error('Failed to load payroll:', error);
            toast.error('Failed to load payroll sheets');
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
            toast.success('Payroll sheet generated with attendance calculations');
            await loadPayroll();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Failed to generate payroll run');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRecalculate = async () => {
        if (!payrollRun) return;
        setActionLoading(true);
        try {
            await PayrollService.generatePayrollItems(payrollRun.id, restaurantId, selectedMonth, selectedYear);
            toast.success('Payroll re-calculated against latest attendance');
            await loadPayroll();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Failed to recalculate payroll');
        } finally {
            setActionLoading(false);
        }
    };

    const handleStatusUpdate = async (itemId: string, status: 'pending' | 'paid') => {
        try {
            await PayrollService.updatePayrollItemStatus(itemId, status);
            setPayrollItems(prev => prev.map(item => {
                if (item.id === itemId) {
                    return { ...item, payment_status: status, paid_at: status === 'paid' ? new Date().toISOString() : null };
                }
                return item;
            }));
            toast.success(`Salary marked as ${status}`);
        } catch (error) {
            toast.error('Failed to update payout status');
        }
    };

    const handleMarkAllPaid = async () => {
        if (!payrollRun) return;
        if (!confirm('Are you sure you want to mark this entire payroll run as PAID? All employees in this sheet will be marked as paid.')) return;
        setActionLoading(true);
        try {
            await PayrollService.updatePayrollRunStatus(payrollRun.id, 'paid');
            toast.success('All salaries marked as PAID');
            await loadPayroll();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Failed to update run status');
        } finally {
            setActionLoading(false);
        }
    };

    const handleOvertimeChange = async (item: PayrollItem, overtimeHours: number) => {
        try {
            const hourlyRate = item.employee?.overtime_per_hour || 0;
            const overtimePay = Number((overtimeHours * hourlyRate).toFixed(2));
            
            // Recompute final salary
            const deductions = item.deductions;
            const baseSalary = item.gross_salary || item.monthly_salary;
            const finalSalary = Math.max(0, Number((baseSalary - deductions + overtimePay).toFixed(2)));

            await PayrollService.updatePayrollItem(item.id, {
                overtime_hours: overtimeHours,
                overtime_pay: overtimePay,
                final_salary: finalSalary
            });

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
            toast.error('Failed to update overtime hours');
        }
    };

    const handleSaveDeduction = async () => {
        if (!editingDeductionItem) return;
        const newDeduction = Math.max(0, Number(deductionInput) || 0);
        try {
            const baseSalary = editingDeductionItem.gross_salary || editingDeductionItem.monthly_salary;
            const overtimePay = editingDeductionItem.overtime_pay;
            const finalSalary = Math.max(0, Number((baseSalary - newDeduction + overtimePay).toFixed(2)));

            await PayrollService.updatePayrollItem(editingDeductionItem.id, {
                deductions: newDeduction,
                final_salary: finalSalary
            });

            setPayrollItems(prev => prev.map(i => {
                if (i.id === editingDeductionItem.id) {
                    return {
                        ...i,
                        deductions: newDeduction,
                        final_salary: finalSalary
                    };
                }
                return i;
            }));

            toast.success('Deductions updated');
            setEditingDeductionItem(null);
        } catch (error) {
            console.error(error);
            toast.error('Failed to update deduction');
        }
    };

    // Filter items
    const filteredItems = useMemo(() => {
        return payrollItems.filter(item => {
            const emp = item.employee;
            if (!emp) return true;
            const matchesSearch = !searchQuery || 
                emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (emp.phone && emp.phone.includes(searchQuery)) ||
                (emp.employee_code && emp.employee_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (emp.employee_id && emp.employee_id.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesRole = roleFilter === 'all' || emp.role.toLowerCase() === roleFilter.toLowerCase();
            const matchesBranch = branchFilter === 'all' || emp.branch_id === branchFilter;
            return matchesSearch && matchesRole && matchesBranch;
        });
    }, [payrollItems, searchQuery, roleFilter, branchFilter]);

    // Unique roles
    const availableRoles = useMemo(() => {
        const roles = new Set(payrollItems.map(i => i.employee?.role).filter(Boolean));
        return Array.from(roles) as string[];
    }, [payrollItems]);

    // Calculate totals
    const totalGross = payrollItems.reduce((acc, i) => acc + (i.gross_salary || i.monthly_salary), 0);
    const totalDeductions = payrollItems.reduce((acc, i) => acc + i.deductions, 0);
    const totalOvertime = payrollItems.reduce((acc, i) => acc + i.overtime_pay, 0);
    const totalNet = payrollItems.reduce((acc, i) => acc + i.final_salary, 0);
    const paidSalary = payrollItems.reduce((acc, i) => acc + (i.payment_status === 'paid' ? i.final_salary : 0), 0);
    const pendingSalary = totalNet - paidSalary;

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
                        body { font-family: system-ui, -apple-system, sans-serif; padding: 30px; color: #111; }
                        .text-center { text-align: center; }
                        .border-b { border-bottom: 1px solid #e5e7eb; }
                        .pb-4 { padding-bottom: 16px; }
                        .mb-4 { margin-bottom: 16px; }
                        .mt-1 { margin-top: 4px; }
                        .mt-6 { margin-top: 24px; }
                        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
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
                        .text-emerald-600 { color: #059669; }
                        .text-rose-600 { color: #e11d48; }
                        .text-purple-600 { color: #9333ea; }
                        .text-neutral-500 { color: #6b7280; }
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
        <div className="flex-1 flex flex-col min-h-0 space-y-4">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-6 pt-6 gap-4 shrink-0">
                <div>
                    <h3 className="text-lg font-bold text-black">Monthly Payroll Register</h3>
                    <p className="text-xs text-neutral-500">Calculate net salaries, absence deductions, overtime credits, and release payouts.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Month Picker */}
                    <div className="flex items-center bg-neutral-100 border border-neutral-200 rounded-lg px-2.5 py-1.5 gap-2 text-sm text-black">
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

                    {payrollRun && (
                        <>
                            <button
                                onClick={handleRecalculate}
                                disabled={actionLoading || payrollRun.status === 'paid'}
                                className="flex items-center px-3 py-1.5 border border-neutral-300 text-black hover:bg-neutral-50 text-xs font-bold rounded-lg transition-all gap-1.5 disabled:opacity-50"
                                title="Recalculate deductions against current attendance logs"
                            >
                                <LucideRefresh size={14} className={actionLoading ? 'animate-spin' : ''} />
                                Recalculate
                            </button>

                            {payrollRun.status !== 'paid' && (
                                <button
                                    onClick={handleMarkAllPaid}
                                    disabled={actionLoading}
                                    className="flex items-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all gap-1.5 shadow-md shadow-emerald-600/10 disabled:opacity-50"
                                >
                                    <LucideCheckCircle size={14} />
                                    Mark All Paid
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* If no payroll run exists */}
            {!payrollRun ? (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-neutral-200 rounded-[2rem] mx-6 mb-6 p-12 text-center bg-white space-y-4">
                    <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                        <LucideDollar size={26} />
                    </div>
                    <div>
                        <h4 className="text-base font-bold text-black">No Payroll Sheet Found</h4>
                        <p className="text-xs text-neutral-500 max-w-sm mt-1">
                            A payroll run has not been calculated for <span className="font-bold text-black">{MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}</span>. Click generate to build sheet from attendance records.
                        </p>
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 shrink-0">
                        <div className="bg-white border border-neutral-200 p-3.5 rounded-xl flex items-center justify-between shadow-sm">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Payroll Status</span>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <span className={`w-2 h-2 rounded-full ${
                                        payrollRun.status === 'paid' ? 'bg-emerald-500' :
                                        payrollRun.status === 'calculated' ? 'bg-blue-500' : 'bg-amber-500'
                                    }`} />
                                    <h4 className={`text-xs font-bold uppercase tracking-wider ${
                                        payrollRun.status === 'paid' ? 'text-emerald-700' :
                                        payrollRun.status === 'calculated' ? 'text-blue-700' : 'text-amber-700'
                                    }`}>
                                        {payrollRun.status === 'calculated' ? 'Calculated (Ready)' : payrollRun.status}
                                    </h4>
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center">
                                <LucideAlert size={14} className="text-neutral-500" />
                            </div>
                        </div>

                        <div className="bg-white border border-neutral-200 p-3.5 rounded-xl flex items-center justify-between shadow-sm">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Gross Payroll</span>
                                <h4 className="text-sm font-black text-black mt-1">₹{totalGross.toLocaleString('en-IN')}</h4>
                                <span className="text-[10px] text-neutral-400">Net: ₹{totalNet.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                                <LucideDollar size={14} className="text-blue-600" />
                            </div>
                        </div>

                        <div className="bg-white border border-neutral-200 p-3.5 rounded-xl flex items-center justify-between shadow-sm">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Disbursed (Paid)</span>
                                <h4 className="text-sm font-black text-emerald-600 mt-1">₹{paidSalary.toLocaleString('en-IN')}</h4>
                                <span className="text-[10px] text-neutral-400">{payrollItems.filter(i => i.payment_status === 'paid').length} of {payrollItems.length} staff</span>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                                <LucideCheckCircle size={14} className="text-emerald-600" />
                            </div>
                        </div>

                        <div className="bg-white border border-neutral-200 p-3.5 rounded-xl flex items-center justify-between shadow-sm">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Pending Payout</span>
                                <h4 className="text-sm font-black text-amber-600 mt-1">₹{pendingSalary.toLocaleString('en-IN')}</h4>
                                <span className="text-[10px] text-neutral-400">{payrollItems.filter(i => i.payment_status !== 'paid').length} staff remaining</span>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
                                <LucideDollar size={14} className="text-amber-500" />
                            </div>
                        </div>
                    </div>

                    {/* Filter and Search Bar */}
                    <div className="flex flex-wrap items-center justify-between px-6 gap-3 shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <LucideSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                                <input
                                    type="text"
                                    placeholder="Search staff name or ID..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-8 pr-3 py-1.5 border border-neutral-200 rounded-lg text-xs w-48 sm:w-60 focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <select
                                value={roleFilter}
                                onChange={e => setRoleFilter(e.target.value)}
                                className="px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white text-neutral-700 capitalize focus:outline-none"
                            >
                                <option value="all">All Roles</option>
                                {availableRoles.map(r => (
                                    <option key={r} value={r} className="capitalize">{r === 'delivery_boy' ? 'Delivery Boy' : r}</option>
                                ))}
                            </select>

                            {branches.length > 0 && (
                                <select
                                    value={branchFilter}
                                    onChange={e => setBranchFilter(e.target.value)}
                                    className="px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white text-neutral-700 focus:outline-none"
                                >
                                    <option value="all">All Branches</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div className="text-xs text-neutral-500">
                            Showing <span className="font-bold text-black">{filteredItems.length}</span> of {payrollItems.length} staff
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="bg-white rounded-[2rem] border border-neutral-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0 mx-6 mb-6">
                        <div className="overflow-y-auto no-scrollbar flex-1">
                            <table className="w-full text-left text-xs text-black">
                                <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3">Employee</th>
                                        <th className="px-3 py-3">Role / Branch</th>
                                        <th className="px-3 py-3 text-right">Base Salary</th>
                                        <th className="px-3 py-3 text-center">Attendance (P / H / A / L / WO)</th>
                                        <th className="px-3 py-3 text-center">Deductions</th>
                                        <th className="px-3 py-3 text-center">Overtime (hrs)</th>
                                        <th className="px-3 py-3 text-right">Overtime Pay</th>
                                        <th className="px-3 py-3 text-right">Net Payable</th>
                                        <th className="px-3 py-3 text-center">Payout</th>
                                        <th className="px-4 py-3 text-right">Payslip</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-200">
                                    {filteredItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="px-6 py-10 text-center text-neutral-500 font-medium">
                                                No employees match this filter.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredItems.map(item => (
                                            <tr key={item.id} className="hover:bg-neutral-50/70 transition-colors">
                                                <td className="px-4 py-3 font-semibold text-black">
                                                    <div>{item.employee?.name || 'Unknown Staff'}</div>
                                                    <div className="text-[10px] text-neutral-400 font-mono font-normal">
                                                        {item.employee?.employee_code || item.employee?.employee_id || item.employee_id.slice(0, 8)}
                                                    </div>
                                                </td>

                                                <td className="px-3 py-3">
                                                    <div className="capitalize text-neutral-700 font-medium">
                                                        {item.employee?.role === 'delivery_boy' ? 'Delivery Boy' : item.employee?.role}
                                                    </div>
                                                    <div className="text-[10px] text-neutral-400">
                                                        {item.employee?.branch?.name || 'Main Branch'}
                                                    </div>
                                                </td>

                                                <td className="px-3 py-3 text-right text-neutral-700 font-mono">
                                                    ₹{(item.gross_salary || item.monthly_salary).toLocaleString('en-IN')}
                                                </td>

                                                <td className="px-3 py-3 text-center">
                                                    <div className="inline-flex items-center gap-1 text-[11px] font-bold">
                                                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded" title="Present Days">
                                                            {item.present_days}P
                                                        </span>
                                                        <span className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded" title="Half Days">
                                                            {item.half_days}H
                                                        </span>
                                                        <span className="bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded" title="Absent Days">
                                                            {item.absent_days}A
                                                        </span>
                                                        <span className="bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded" title="Leave Days">
                                                            {item.leave_days || 0}L
                                                        </span>
                                                        <span className="bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded" title="Weekly Off Days">
                                                            {item.weekly_off_days || 0}WO
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="px-3 py-3 text-center">
                                                    <div className="inline-flex items-center gap-1 font-mono text-rose-600 font-bold">
                                                        <span>-₹{item.deductions.toLocaleString('en-IN')}</span>
                                                        {payrollRun.status !== 'paid' && (
                                                            <button
                                                                onClick={() => {
                                                                    setEditingDeductionItem(item);
                                                                    setDeductionInput(String(item.deductions));
                                                                }}
                                                                className="text-neutral-400 hover:text-black p-0.5 rounded"
                                                                title="Adjust deduction"
                                                            >
                                                                <LucideEdit2 size={11} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-3 py-3 text-center">
                                                    {payrollRun.status === 'paid' ? (
                                                        <span className="font-mono text-neutral-600">{item.overtime_hours} hrs</span>
                                                    ) : (
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            className="w-14 px-1 py-0.5 border border-neutral-200 rounded text-center text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                                                            value={item.overtime_hours}
                                                            onChange={e => handleOvertimeChange(item, Number(e.target.value))}
                                                        />
                                                    )}
                                                </td>

                                                <td className="px-3 py-3 text-right text-emerald-600 font-semibold font-mono">
                                                    +₹{item.overtime_pay.toLocaleString('en-IN')}
                                                </td>

                                                <td className="px-3 py-3 text-right font-bold text-black font-mono text-sm">
                                                    ₹{item.final_salary.toLocaleString('en-IN')}
                                                </td>

                                                <td className="px-3 py-3 text-center">
                                                    <button
                                                        onClick={() => handleStatusUpdate(item.id, item.payment_status === 'paid' ? 'pending' : 'paid')}
                                                        disabled={payrollRun.status === 'paid'}
                                                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${
                                                            item.payment_status === 'paid'
                                                                ? 'bg-emerald-100 text-emerald-800'
                                                                : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                                        }`}
                                                    >
                                                        {item.payment_status}
                                                    </button>
                                                </td>

                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        onClick={() => setPreviewItem(item)}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Print or view payslip"
                                                    >
                                                        <LucidePrinter size={15} />
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

            {/* Deduction Adjustment Modal */}
            {editingDeductionItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-neutral-200 p-5 space-y-4">
                        <div className="flex justify-between items-center border-b pb-3">
                            <h4 className="text-sm font-bold text-black">Adjust Salary Deductions</h4>
                            <button onClick={() => setEditingDeductionItem(null)} className="text-neutral-400 hover:text-black">
                                <LucideX size={18} />
                            </button>
                        </div>
                        <div>
                            <p className="text-xs text-neutral-500 mb-1">
                                Staff: <span className="font-bold text-black">{editingDeductionItem.employee?.name}</span>
                            </p>
                            <label className="block text-xs font-bold text-neutral-600 uppercase mb-1">
                                Total Deduction Amount (₹)
                            </label>
                            <input
                                type="number"
                                min={0}
                                step="1"
                                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500"
                                value={deductionInput}
                                onChange={e => setDeductionInput(e.target.value)}
                            />
                            <p className="text-[11px] text-neutral-400 mt-1">
                                Default deduction was calculated from {editingDeductionItem.absent_days} absent days and {editingDeductionItem.half_days} half days.
                            </p>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setEditingDeductionItem(null)}
                                className="flex-1 py-2 border border-neutral-200 rounded-lg text-xs font-bold text-neutral-600 hover:bg-neutral-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveDeduction}
                                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                            >
                                Update Deduction
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payslip View Modal */}
            {previewItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-neutral-200">
                        <div className="flex justify-between items-center p-4 border-b border-neutral-100 shrink-0">
                            <h3 className="text-base font-bold text-black">Salary Payslip Preview</h3>
                            <button onClick={() => setPreviewItem(null)} className="text-neutral-400 hover:text-black">
                                <LucideX size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto no-scrollbar max-h-[75vh]">
                            <div id="payslip-print-view" className="bg-white p-6 border rounded-xl text-black font-sans text-xs space-y-4">
                                <div className="text-center border-b pb-4">
                                    <h2 className="text-lg font-black tracking-tight">DINE IN ONE</h2>
                                    <p className="text-xs text-neutral-500">Employee Salary Slip & Wage Statement</p>
                                    <p className="text-[11px] font-mono font-bold text-neutral-600 mt-1">
                                        Period: {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-y-2 border-b pb-4">
                                    <div>
                                        <span className="text-neutral-500">Employee Name:</span>
                                        <p className="font-bold text-sm">{previewItem.employee?.name}</p>
                                    </div>
                                    <div>
                                        <span className="text-neutral-500">Employee Code:</span>
                                        <p className="font-mono font-bold">{previewItem.employee?.employee_code || previewItem.employee?.employee_id || '—'}</p>
                                    </div>
                                    <div>
                                        <span className="text-neutral-500">Designation / Role:</span>
                                        <p className="font-bold capitalize">{previewItem.employee?.role === 'delivery_boy' ? 'Delivery Boy' : previewItem.employee?.role}</p>
                                    </div>
                                    <div>
                                        <span className="text-neutral-500">Branch Location:</span>
                                        <p className="font-bold">{previewItem.employee?.branch?.name || 'Main Branch'}</p>
                                    </div>
                                    <div>
                                        <span className="text-neutral-500">Phone:</span>
                                        <p className="font-mono">{previewItem.employee?.phone || '—'}</p>
                                    </div>
                                    <div>
                                        <span className="text-neutral-500">Weekly Off Day:</span>
                                        <p className="capitalize font-semibold">{previewItem.employee?.weekly_off || 'Sunday'}</p>
                                    </div>
                                </div>

                                {/* Attendance summary in payslip */}
                                <div className="border-b pb-3 space-y-1.5">
                                    <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Attendance Breakdown</span>
                                    <div className="grid grid-cols-5 gap-1 text-center">
                                        <div className="bg-emerald-50 border border-emerald-200 p-1.5 rounded">
                                            <div className="font-bold text-emerald-700 text-sm">{previewItem.present_days}</div>
                                            <div className="text-[10px] text-emerald-800">Present</div>
                                        </div>
                                        <div className="bg-amber-50 border border-amber-200 p-1.5 rounded">
                                            <div className="font-bold text-amber-700 text-sm">{previewItem.half_days}</div>
                                            <div className="text-[10px] text-amber-800">Half Day</div>
                                        </div>
                                        <div className="bg-rose-50 border border-rose-200 p-1.5 rounded">
                                            <div className="font-bold text-rose-700 text-sm">{previewItem.absent_days}</div>
                                            <div className="text-[10px] text-rose-800">Absent</div>
                                        </div>
                                        <div className="bg-sky-50 border border-sky-200 p-1.5 rounded">
                                            <div className="font-bold text-sky-700 text-sm">{previewItem.leave_days || 0}</div>
                                            <div className="text-[10px] text-sky-800">Leave</div>
                                        </div>
                                        <div className="bg-purple-50 border border-purple-200 p-1.5 rounded">
                                            <div className="font-bold text-purple-700 text-sm">{previewItem.weekly_off_days || 0}</div>
                                            <div className="text-[10px] text-purple-800">Weekly Off</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Salary Calculation breakdown */}
                                <div className="space-y-2 border-b pb-4">
                                    <div className="flex justify-between items-center font-medium">
                                        <span>Gross Monthly Salary:</span>
                                        <span className="font-mono">₹{(previewItem.gross_salary || previewItem.monthly_salary).toLocaleString('en-IN')}</span>
                                    </div>
                                    
                                    <div className="flex justify-between items-center text-rose-600 font-medium">
                                        <span>Absence & Policy Deductions:</span>
                                        <span className="font-mono">-₹{previewItem.deductions.toLocaleString('en-IN')}</span>
                                    </div>

                                    <div className="flex justify-between items-center text-emerald-600 font-medium">
                                        <span>Overtime Pay ({previewItem.overtime_hours} hrs @ ₹{previewItem.employee?.overtime_per_hour || 0}/hr):</span>
                                        <span className="font-mono">+₹{previewItem.overtime_pay.toLocaleString('en-IN')}</span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center font-bold text-sm bg-neutral-50 p-3 rounded-lg border">
                                    <span>Net Payable Amount:</span>
                                    <span className="font-mono text-base text-blue-600">₹{previewItem.final_salary.toLocaleString('en-IN')}</span>
                                </div>

                                <div className="pt-2 flex justify-between items-center text-[10px] text-neutral-400">
                                    <span>Payment Status: <span className="font-bold uppercase text-emerald-600">{previewItem.payment_status}</span></span>
                                    <span>Generated: {new Date().toLocaleDateString()}</span>
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
