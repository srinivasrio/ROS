'use client';

import React, { useState } from 'react';
import { 
    CreditCard, Calendar, FileText, CheckCircle2, 
    Download, ShieldCheck, Banknote, Building2, ChevronRight, Eye, X
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface SalaryDetails {
    isSalaried?: boolean;
    monthlySalary?: number;
    perDaySalary?: number;
    overtimeRate?: number;
    allowance?: number;
    payoutCycle?: string;
    paymentMode?: string;
    advances?: number;
    deductions?: number;
    bonus?: number;
    netPayable?: number;
}

interface SalarySectionProps {
    salary?: SalaryDetails;
    employeeName?: string;
    employeeCode?: string;
}

export default function SalarySection({
    salary,
    employeeName = 'Delivery Executive',
    employeeCode = 'EMP-DEL-001',
}: SalarySectionProps) {
    const [selectedSlip, setSelectedSlip] = useState<any | null>(null);

    const baseSalary = salary?.monthlySalary || 24000;
    const allowance = salary?.allowance || 3500;
    const bonus = salary?.bonus || 1000;
    const advances = salary?.advances || 0;
    const deductions = salary?.deductions || 0;
    const netSalary = (baseSalary + allowance + bonus) - (advances + deductions);

    const pastPayslips = [
        { month: 'August 2026', amount: 28500, status: 'Paid', date: 'Aug 31, 2026', id: 'PAY-2026-08' },
        { month: 'July 2026', amount: 28500, status: 'Paid', date: 'Jul 31, 2026', id: 'PAY-2026-07' },
        { month: 'June 2026', amount: 28500, status: 'Paid', date: 'Jun 30, 2026', id: 'PAY-2026-06' },
    ];

    return (
        <div className="rounded-3xl p-5 bg-[#e8edf5] dark:bg-[#1a1e26] shadow-[-6px_-6px_16px_rgba(255,255,255,0.9),6px_6px_16px_rgba(163,177,198,0.45)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.03),4px_4px_14px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/5 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                    <div className="size-10 rounded-2xl bg-[#e8edf5] dark:bg-[#1f242e] shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),2px_2px_8px_rgba(0,0,0,0.5)] flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <CreditCard size={18} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                            Salary & Compensation
                        </h3>
                        <p className="text-[11px] font-bold text-slate-400">Fixed Monthly Salaried Staff</p>
                    </div>
                </div>

                <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider">
                    Salaried
                </span>
            </div>

            {/* Salary Hero Card */}
            <div className="bg-[#e2e8f2] dark:bg-[#13161c] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.45),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.6),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] rounded-2xl p-4.5">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fixed Monthly Base</p>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                            {formatCurrency(baseSalary)}
                            <span className="text-xs font-semibold text-slate-400 ml-1">/ month</span>
                        </h2>
                    </div>
                    <div className="size-10 rounded-xl bg-[#e8edf5] dark:bg-[#1a1e26] shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),2px_2px_8px_rgba(0,0,0,0.5)] flex items-center justify-center text-slate-600 dark:text-slate-300">
                        <Banknote size={18} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-300/40 dark:border-slate-800 text-xs">
                    <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Payout Cycle</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">1st of month</span>
                    </div>
                    <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Disbursement</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">Bank Transfer</span>
                    </div>
                </div>
            </div>

            {/* Monthly Salary Structure Breakdown */}
            <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                    Monthly Compensation Breakdown
                </h4>

                <div className="bg-[#e2e8f2] dark:bg-[#13161c] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.6),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] rounded-2xl p-4 space-y-2.5 text-xs">
                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                        <span>Base Salary</span>
                        <span className="font-bold">{formatCurrency(baseSalary)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                        <span>Fixed Fuel & Travel Allowance</span>
                        <span className="font-bold">{formatCurrency(allowance)}</span>
                    </div>
                    <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                        <span>Attendance & Operational Bonus</span>
                        <span className="font-bold">+{formatCurrency(bonus)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400">
                        <span>Salary Advances Taken</span>
                        <span>{advances > 0 ? `-${formatCurrency(advances)}` : '₹0'}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400">
                        <span>Deductions (Loss of Pay / PF)</span>
                        <span>{deductions > 0 ? `-${formatCurrency(deductions)}` : '₹0'}</span>
                    </div>

                    <div className="pt-2.5 border-t border-slate-300/50 dark:border-slate-800 flex justify-between items-center font-black text-sm text-slate-900 dark:text-white">
                        <span>Net Payable This Cycle</span>
                        <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(netSalary)}</span>
                    </div>
                </div>
            </div>

            {/* Payslips Archive */}
            <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                    Recent Payslips
                </h4>

                <div className="space-y-2">
                    {pastPayslips.map((slip) => (
                        <div
                            key={slip.id}
                            className="p-3.5 bg-[#e8edf5] dark:bg-[#1a1e26] shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),2px_2px_8px_rgba(0,0,0,0.5)] rounded-2xl flex items-center justify-between text-xs"
                        >
                            <div className="flex items-center gap-3">
                                <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                    <FileText size={16} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-slate-100">{slip.month}</p>
                                    <p className="text-[11px] text-slate-400">{slip.date}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5">
                                <span className="font-black text-slate-900 dark:text-white">
                                    {formatCurrency(slip.amount)}
                                </span>
                                <button
                                    onClick={() => setSelectedSlip(slip)}
                                    className="p-1.5 rounded-lg bg-[#e2e8f2] dark:bg-[#12151b] text-slate-600 dark:text-slate-300 hover:text-orange-500 transition-colors"
                                    title="View Payslip"
                                >
                                    <Eye size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Payslip Modal */}
            {selectedSlip && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-3xl p-6 bg-[#e8edf5] dark:bg-[#1a1e26] shadow-[-8px_-8px_20px_rgba(255,255,255,0.95),8px_8px_20px_rgba(163,177,198,0.45)] dark:shadow-[-4px_-4px_16px_rgba(255,255,255,0.03),4px_4px_16px_rgba(0,0,0,0.7)] border border-white/60 dark:border-white/5 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <h4 className="text-sm font-black text-slate-900 dark:text-white">Salary Slip</h4>
                                <p className="text-xs text-slate-400">{selectedSlip.month}</p>
                            </div>
                            <button
                                onClick={() => setSelectedSlip(null)}
                                className="size-8 rounded-full bg-[#e2e8f2] dark:bg-[#12151b] flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            >
                                <X size={15} />
                            </button>
                        </div>

                        <div className="bg-[#e2e8f2] dark:bg-[#12151b] p-4 rounded-2xl text-xs space-y-2">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Employee:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-100">{employeeName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Emp Code:</span>
                                <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{employeeCode}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Disbursed Amount:</span>
                                <span className="font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedSlip.amount)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Status:</span>
                                <span className="font-bold text-emerald-600">Disbursed (Direct Bank Transfer)</span>
                            </div>
                        </div>

                        <button
                            onClick={() => setSelectedSlip(null)}
                            className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
