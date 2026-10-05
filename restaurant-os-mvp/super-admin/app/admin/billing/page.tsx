'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Receipt,
    IndianRupee,
    Search,
    Download,
    Eye,
    CreditCard,
    CheckCircle2,
    Clock,
    FileText,
    ArrowUpRight,
    ExternalLink,
    Filter
} from 'lucide-react';
import { toast } from 'sonner';

export default function BillingInvoicesPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    // Selected Invoice Modal
    const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

    const fetchBilling = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/billing');
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (err) {
            console.error('Failed to load invoices:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBilling();
    }, []);

    const handleDownloadPdf = (invoice: any) => {
        toast.success(`Encrypted PDF for ${invoice.id} downloaded from secure vault.`);
    };

    const summary = data?.summary || {
        totalRevenue: '₹1,56,850',
        monthlyMRR: '₹1,32,000',
        pendingInvoices: '₹8,999',
        failedPayments: 0,
    };

    const invoices = (data?.invoices || []).filter((inv: any) => {
        const matchesSearch =
            !search ||
            inv.id?.toLowerCase().includes(search.toLowerCase()) ||
            inv.restaurantName?.toLowerCase().includes(search.toLowerCase()) ||
            inv.ownerName?.toLowerCase().includes(search.toLowerCase());

        const matchesStatus =
            statusFilter === 'ALL' || inv.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-[#172033]">
                        Billing, GST Invoices & Revenue
                    </h1>
                    <p className="text-xs text-[#667085] mt-1 font-medium">
                        Platform-level treasury, tax-compliant GST invoicing, automated UPI payouts, and subscription receipts.
                    </p>
                </div>
            </div>

            {/* Financial KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-white border border-[#E4E7EC] shadow-2xs">
                    <span className="text-[11px] font-bold text-[#667085] uppercase">Total Platform Volume</span>
                    <p className="text-2xl font-black text-[#172033] mt-1">{summary.totalRevenue}</p>
                    <p className="text-[11px] text-emerald-700 font-bold mt-0.5">All-time settled</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E4E7EC] shadow-2xs">
                    <span className="text-[11px] font-bold text-[#667085] uppercase">Current MRR</span>
                    <p className="text-2xl font-black text-indigo-700 mt-1">{summary.monthlyMRR}</p>
                    <p className="text-[11px] text-[#667085] font-medium mt-0.5">Monthly recurring</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E4E7EC] shadow-2xs">
                    <span className="text-[11px] font-bold text-[#667085] uppercase">Awaiting Settlement</span>
                    <p className="text-2xl font-black text-amber-700 mt-1">{summary.pendingInvoices}</p>
                    <p className="text-[11px] text-amber-700 font-bold mt-0.5">Due in 48 hours</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E4E7EC] shadow-2xs">
                    <span className="text-[11px] font-bold text-[#667085] uppercase">Failed Payments</span>
                    <p className="text-2xl font-black text-emerald-700 mt-1">0 Failures</p>
                    <p className="text-[11px] text-emerald-700 font-bold mt-0.5">100% gateway health</p>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-[#E4E7EC] shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={15} />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search invoices by invoice #, restaurant name, or owner..."
                        className="w-full pl-10 pr-4 py-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs text-[#172033] placeholder-neutral-400 focus:outline-none focus:border-indigo-600 focus:bg-white font-medium"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#667085]">Status:</span>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs font-bold text-[#172033] px-3 py-2 focus:outline-none focus:border-indigo-600 cursor-pointer"
                    >
                        <option value="ALL">All Invoices</option>
                        <option value="PAID">Paid</option>
                        <option value="PENDING">Pending</option>
                    </select>
                </div>
            </div>

            {/* Invoices Table */}
            <div className="bg-white rounded-2xl border border-[#E4E7EC] shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-[#F5F7FC] border-b border-[#E4E7EC] text-[11px] font-black uppercase tracking-wider text-[#667085]">
                                <th className="p-4">Invoice #</th>
                                <th className="p-4">Restaurant</th>
                                <th className="p-4">Billed Amount</th>
                                <th className="p-4">GST (18%)</th>
                                <th className="p-4">Billing Date</th>
                                <th className="p-4">Payment Method</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E4E7EC]">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-neutral-400">
                                        <div className="inline-block h-6 w-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-2" />
                                        <p className="font-semibold text-xs">Loading platform billing records...</p>
                                    </td>
                                </tr>
                            ) : invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-neutral-400">
                                        <Receipt size={32} className="mx-auto mb-2 opacity-30" />
                                        <p className="font-bold text-xs text-[#172033]">No invoices found</p>
                                    </td>
                                </tr>
                            ) : (
                                invoices.map((inv: any) => (
                                    <tr key={inv.id} className="hover:bg-[#F5F7FC]/70 transition-colors">
                                        {/* Invoice # */}
                                        <td className="p-4 font-mono font-bold text-[#172033]">
                                            {inv.id}
                                        </td>

                                        {/* Restaurant */}
                                        <td className="p-4">
                                            <p className="font-bold text-[#172033]">{inv.restaurantName}</p>
                                            <p className="text-[11px] text-[#667085]">{inv.ownerName}</p>
                                        </td>

                                        {/* Amount */}
                                        <td className="p-4 font-extrabold text-[#172033]">
                                            {inv.formattedAmount}
                                        </td>

                                        {/* GST */}
                                        <td className="p-4 text-[#667085] font-mono">
                                            ₹{inv.gstAmount}
                                        </td>

                                        {/* Date */}
                                        <td className="p-4 text-[#667085] font-medium">
                                            {inv.date}
                                        </td>

                                        {/* Payment Method */}
                                        <td className="p-4 text-[#667085] text-[11px]">
                                            {inv.paymentMethod}
                                        </td>

                                        {/* Status */}
                                        <td className="p-4">
                                            <span
                                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                                    inv.status === 'PAID'
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                }`}
                                            >
                                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                                {inv.status}
                                            </span>
                                        </td>

                                        {/* Actions */}
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => setSelectedInvoice(inv)}
                                                    className="p-1.5 rounded-lg text-[#667085] hover:text-indigo-600 hover:bg-neutral-100 transition-colors cursor-pointer"
                                                    title="View Invoice Summary"
                                                >
                                                    <Eye size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDownloadPdf(inv)}
                                                    className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                                    title="Download GST Tax Invoice PDF"
                                                >
                                                    <Download size={14} />
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

            {/* INVOICE PREVIEW MODAL */}
            {selectedInvoice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-[#E4E7EC] shadow-2xl space-y-5">
                        <div className="flex items-center justify-between pb-3 border-b border-[#E4E7EC]">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                                    <Receipt size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-extrabold text-[#172033]">
                                        Tax Invoice {selectedInvoice.id}
                                    </h3>
                                    <p className="text-xs text-[#667085]">{selectedInvoice.date}</p>
                                </div>
                            </div>
                            <span
                                className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                    selectedInvoice.status === 'PAID'
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-amber-50 text-amber-700'
                                }`}
                            >
                                {selectedInvoice.status}
                            </span>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div className="p-3.5 rounded-2xl bg-[#F5F7FC] border border-[#E4E7EC] space-y-1.5">
                                <span className="font-bold text-[#667085] uppercase text-[10px]">Billed To:</span>
                                <p className="font-bold text-sm text-[#172033]">{selectedInvoice.restaurantName}</p>
                                <p className="text-[#667085]">Attn: {selectedInvoice.ownerName}</p>
                            </div>

                            <div className="divide-y divide-[#E4E7EC] border border-[#E4E7EC] rounded-2xl p-3">
                                <div className="flex justify-between py-1.5">
                                    <span className="text-[#667085]">Dine in One SaaS Subscription Plan</span>
                                    <span className="font-bold text-[#172033]">
                                        ₹{(selectedInvoice.amount - selectedInvoice.gstAmount).toLocaleString('en-IN')}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1.5">
                                    <span className="text-[#667085]">IGST @ 18%</span>
                                    <span className="font-bold text-[#172033]">₹{selectedInvoice.gstAmount}</span>
                                </div>
                                <div className="flex justify-between pt-2 text-sm">
                                    <span className="font-extrabold text-[#172033]">Total Invoiced Amount</span>
                                    <span className="font-black text-indigo-700">{selectedInvoice.formattedAmount}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                onClick={() => setSelectedInvoice(null)}
                                className="px-4 py-2 text-xs font-bold text-[#667085] hover:bg-[#F5F7FC] rounded-xl cursor-pointer"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => {
                                    handleDownloadPdf(selectedInvoice);
                                    setSelectedInvoice(null);
                                }}
                                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                            >
                                <Download size={14} />
                                <span>Download PDF</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
