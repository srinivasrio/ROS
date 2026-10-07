'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useOwner } from '@/context/OwnerContext';
import { 
    CreditCard, FileText, CheckCircle2, ArrowUpRight, 
    Store, RefreshCw, Lock, Sparkles, Building2, Check,
    MessageSquare, Shield, AlertCircle
} from 'lucide-react';

export default function BillingPage() {
    const { selectedRestaurantId, isAllRestaurants, currentRestaurant, restaurants: ownerBranches } = useOwner();
    const [billingData, setBillingData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'matrix' | 'plans' | 'invoices'>('matrix');
    const [selectedBranchId, setSelectedBranchId] = useState<string>('');

    const fetchBilling = async (branchId?: string) => {
        setLoading(true);
        try {
            const targetId = branchId || (!isAllRestaurants && selectedRestaurantId ? selectedRestaurantId : '');
            const branchParam = targetId ? `?branch=${targetId}` : '';
            const res = await fetch(`/api/owner/billing${branchParam}`);
            if (res.ok) {
                const data = await res.json();
                setBillingData(data);
                if (data.currentEntitlement?.restaurantId && !selectedBranchId) {
                    setSelectedBranchId(data.currentEntitlement.restaurantId);
                }
            }
        } catch (err) {
            console.error('[Billing] Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBilling();
    }, [selectedRestaurantId, isAllRestaurants]);

    const branchList = billingData?.restaurants || [];
    const currentEntitlement = branchList.find((r: any) => r.restaurantId === selectedBranchId) 
        || billingData?.currentEntitlement;

    const planName = currentEntitlement?.planName || 'Standard';
    const planSlug = currentEntitlement?.planSlug || 'standard';
    const status = currentEntitlement?.status || 'ACTIVE';
    const isTrial = Boolean(currentEntitlement?.isTrial);
    const daysRemaining = currentEntitlement?.daysRemaining ?? null;
    const renewalDate = currentEntitlement?.renewalDate 
        ? new Date(currentEntitlement.renewalDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Active Ongoing';

    const availableFeatures = currentEntitlement?.availableFeatures || [];
    const lockedFeatures = currentEntitlement?.lockedFeatures || [];
    const plans = billingData?.plans || [];
    const invoices = billingData?.invoices || [];

    const getStatusBadge = (st: string, trial: boolean) => {
        if (st === 'SUSPENDED') {
            return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase bg-neutral-100 dark:bg-zinc-800 text-rose-600 border border-neutral-200 dark:border-zinc-700">Suspended</span>;
        }
        if (st === 'EXPIRED') {
            return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase bg-neutral-100 dark:bg-zinc-800 text-amber-600 border border-neutral-200 dark:border-zinc-700">Expired</span>;
        }
        if (trial || st === 'TRIAL') {
            return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase bg-neutral-100 dark:bg-zinc-800 text-indigo-600 border border-neutral-200 dark:border-zinc-700">Trial</span>;
        }
        return <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase bg-neutral-100 dark:bg-zinc-800 text-emerald-600 border border-neutral-200 dark:border-zinc-700">Active</span>;
    };

    return (
        <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight flex items-center gap-2.5">
                        <CreditCard className="text-indigo-600 dark:text-indigo-400" size={24} />
                        Billing & Subscriptions
                    </h2>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        Manage subscription tiers, feature access matrix, and invoices across all your restaurant branches.
                    </p>
                </div>
                <button
                    onClick={() => fetchBilling(selectedBranchId)}
                    disabled={loading}
                    className="p-2.5 self-start sm:self-auto rounded-xl border border-neutral-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-zinc-800 transition cursor-pointer shadow-xs"
                    title="Refresh billing data"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-600' : ''} />
                </button>
            </div>

            {/* Top Filter Buttons Bar */}
            <div className="flex items-center gap-2 p-1.5 bg-neutral-100/80 dark:bg-zinc-900 border border-neutral-200/80 dark:border-zinc-800 rounded-2xl overflow-x-auto">
                <button
                    onClick={() => setActiveTab('matrix')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === 'matrix'
                            ? 'bg-white dark:bg-zinc-800 text-neutral-900 dark:text-white shadow-xs border border-neutral-200/50 dark:border-zinc-700/50'
                            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                >
                    <Shield size={14} />
                    <span>Feature Access Matrix</span>
                </button>
                <button
                    onClick={() => setActiveTab('plans')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === 'plans'
                            ? 'bg-white dark:bg-zinc-800 text-neutral-900 dark:text-white shadow-xs border border-neutral-200/50 dark:border-zinc-700/50'
                            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                >
                    <Sparkles size={14} />
                    <span>Available Plans & Pricing</span>
                </button>
                <button
                    onClick={() => setActiveTab('invoices')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === 'invoices'
                            ? 'bg-white dark:bg-zinc-800 text-neutral-900 dark:text-white shadow-xs border border-neutral-200/50 dark:border-zinc-700/50'
                            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                >
                    <FileText size={14} />
                    <span>Invoices & Payments</span>
                </button>
            </div>

            {/* Restaurant Branches & Subscription Status Overview (Clean, Compact Neutral Card) */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-neutral-200/70 dark:border-zinc-800 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-100 dark:border-zinc-800 pb-3">
                    <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-neutral-700 dark:text-neutral-300" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                            Restaurant Branches & Subscriptions
                        </h3>
                    </div>
                    <span className="text-[11px] font-bold text-neutral-400">
                        {branchList.length > 0 ? `${branchList.length} Branches Registered` : `${ownerBranches.length} Branches`}
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-neutral-100 dark:border-zinc-800 text-neutral-400 font-semibold uppercase text-[10px] tracking-wider">
                                <th className="py-2.5 px-3">Branch Location</th>
                                <th className="py-2.5 px-3">Branch Code</th>
                                <th className="py-2.5 px-3">Subscription Type</th>
                                <th className="py-2.5 px-3">Status</th>
                                <th className="py-2.5 px-3">Renewal / Expiry</th>
                                <th className="py-2.5 px-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-zinc-800">
                            {(branchList.length > 0 ? branchList : ownerBranches).map((b: any) => {
                                const bId = b.restaurantId || b.id;
                                const bName = b.restaurantName || b.name;
                                const bPlan = b.planName || b.subscription_plan || 'Standard';
                                const bStatus = b.status || 'active';
                                const bTrial = Boolean(b.isTrial);
                                const isSelected = selectedBranchId === bId || (!selectedBranchId && bId === currentEntitlement?.restaurantId);

                                return (
                                    <tr 
                                        key={bId}
                                        className={`transition-colors ${
                                            isSelected 
                                                ? 'bg-neutral-50/80 dark:bg-zinc-800/40' 
                                                : 'hover:bg-neutral-50/40 dark:hover:bg-zinc-800/20'
                                        }`}
                                    >
                                        <td className="py-3 px-3">
                                            <div className="flex items-center gap-2">
                                                <Store size={14} className="text-neutral-500" />
                                                <span className="font-bold text-neutral-900 dark:text-white">
                                                    {bName}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-3 font-mono text-neutral-500 text-[11px]">
                                            {bId.slice(0, 10)}...
                                        </td>
                                        <td className="py-3 px-3">
                                            <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                                                {bPlan}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3">
                                            {getStatusBadge(bStatus, bTrial)}
                                        </td>
                                        <td className="py-3 px-3 text-neutral-500 text-[11px]">
                                            {b.renewalDate ? new Date(b.renewalDate).toLocaleDateString() : (b.daysRemaining !== undefined ? `${b.daysRemaining} days left` : 'Active')}
                                        </td>
                                        <td className="py-3 px-3 text-right">
                                            <button
                                                onClick={() => {
                                                    setSelectedBranchId(bId);
                                                    setActiveTab('matrix');
                                                }}
                                                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                                                    isSelected
                                                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                                                        : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-neutral-700 dark:text-neutral-300'
                                                }`}
                                            >
                                                {isSelected ? 'Viewing' : 'View Matrix'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* TAB 1: FEATURE ACCESS MATRIX */}
            {activeTab === 'matrix' && (
                <div className="space-y-6">
                    {/* Active branch indicator banner */}
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-neutral-200/70 dark:border-zinc-800 text-xs">
                        <div className="flex items-center gap-2">
                            <Store size={14} className="text-indigo-600 dark:text-indigo-400" />
                            <span className="font-medium text-neutral-600 dark:text-neutral-300">
                                Feature Access Matrix for: <strong className="text-neutral-900 dark:text-white">{currentEntitlement?.restaurantName || 'Selected Outlet'}</strong>
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-neutral-100 dark:bg-zinc-800 text-neutral-600 dark:text-neutral-400 uppercase">
                                {planName} Plan
                            </span>
                        </div>
                        <span className="text-[11px] text-neutral-400">
                            {lockedFeatures.length} locked · {availableFeatures.length} unlocked
                        </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Section 1: All Locked Features According to Subscription */}
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-neutral-200/70 dark:border-zinc-800 p-5 shadow-xs space-y-4">
                            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-zinc-800 pb-3">
                                <div className="flex items-center gap-2">
                                    <Lock size={15} className="text-neutral-500" />
                                    <h4 className="text-xs font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                                        Locked Features (Upgrade Required)
                                    </h4>
                                </div>
                                <span className="text-xs font-bold text-neutral-400">
                                    {lockedFeatures.length} Locked
                                </span>
                            </div>

                            {lockedFeatures.length === 0 ? (
                                <div className="py-8 text-center text-neutral-400 text-xs">
                                    All platform features are unlocked on this subscription plan tier.
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {lockedFeatures.map((feat: any) => (
                                        <div 
                                            key={feat.key} 
                                            className="p-3 rounded-xl bg-neutral-50/60 dark:bg-zinc-800/30 border border-neutral-200/50 dark:border-zinc-800 flex items-start gap-3"
                                        >
                                            <div className="p-1.5 rounded-lg bg-neutral-200/50 dark:bg-zinc-800 text-neutral-500 shrink-0 mt-0.5">
                                                <Lock size={12} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                                                        {feat.label}
                                                    </p>
                                                    <span className="text-[10px] font-bold text-neutral-500 bg-neutral-200/60 dark:bg-zinc-800 px-2 py-0.5 rounded">
                                                        Requires {feat.minimumPlanLabel || 'Pro'}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                                                    {feat.upgradeMessage || feat.description}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Section 2: Active & Unlocked Features */}
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-neutral-200/70 dark:border-zinc-800 p-5 shadow-xs space-y-4">
                            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-zinc-800 pb-3">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={15} className="text-emerald-500" />
                                    <h4 className="text-xs font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                                        Active Features ({planName})
                                    </h4>
                                </div>
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                    {availableFeatures.length} Active
                                </span>
                            </div>

                            <div className="space-y-2.5">
                                {availableFeatures.map((feat: any) => (
                                    <div 
                                        key={feat.key} 
                                        className="p-3 rounded-xl bg-neutral-50/60 dark:bg-zinc-800/30 border border-neutral-200/50 dark:border-zinc-800 flex items-start gap-3"
                                    >
                                        <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                                            <Check size={12} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                                                {feat.label}
                                            </p>
                                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1">
                                                {feat.description}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: AVAILABLE PLANS & PRICING */}
            {activeTab === 'plans' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        {plans.map((p: any) => {
                            const isCurrent = planSlug === p.slug;
                            return (
                                <div 
                                    key={p.slug}
                                    className={`rounded-2xl p-5 flex flex-col justify-between transition-all bg-white dark:bg-zinc-900 border shadow-xs ${
                                        isCurrent 
                                            ? 'border-indigo-600 ring-1 ring-indigo-600' 
                                            : 'border-neutral-200/70 dark:border-zinc-800'
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-base font-black text-neutral-900 dark:text-white">
                                                {p.name}
                                            </h4>
                                            {isCurrent && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-neutral-100 dark:bg-zinc-800 text-neutral-700 dark:text-neutral-300">
                                                    Current
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-neutral-400 mt-1 min-h-[32px]">
                                            {p.tagline}
                                        </p>

                                        <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-zinc-800">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-2xl font-black text-neutral-900 dark:text-white">
                                                    ₹{p.priceMonthly.toLocaleString('en-IN')}
                                                </span>
                                                <span className="text-xs text-neutral-400">/mo</span>
                                            </div>
                                            {p.priceAnnual > 0 && (
                                                <p className="text-[11px] text-neutral-500 font-medium mt-0.5">
                                                    or ₹{p.priceAnnual.toLocaleString('en-IN')}/year
                                                </p>
                                            )}
                                        </div>

                                        <div className="mt-5 space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                                                Included Modules:
                                            </p>
                                            {p.features.map((f: string, i: number) => {
                                                const isExclusion = f.startsWith('✕') || f.startsWith('No ');
                                                return (
                                                    <div key={i} className="flex items-start gap-2 text-xs">
                                                        {isExclusion ? (
                                                            <span className="text-neutral-400 font-bold">✕</span>
                                                        ) : (
                                                            <CheckCircle2 size={13} className="text-neutral-500 shrink-0 mt-0.5" />
                                                        )}
                                                        <span className={isExclusion ? 'text-neutral-400' : 'text-neutral-700 dark:text-neutral-300'}>
                                                            {f.replace(/^✕\s*/, '')}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-3 border-t border-neutral-100 dark:border-zinc-800">
                                        {isCurrent ? (
                                            <div className="w-full py-2 rounded-xl bg-neutral-100 dark:bg-zinc-800 text-neutral-500 font-bold text-xs text-center">
                                                Current Plan
                                            </div>
                                        ) : (
                                            <a
                                                href={`mailto:billing@dineinone.com?subject=Plan Upgrade Request to ${p.name}`}
                                                className="w-full py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 font-bold text-xs text-center flex items-center justify-center gap-1.5 transition"
                                            >
                                                <span>Upgrade to {p.name}</span>
                                                <ArrowUpRight size={13} />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB 3: INVOICES & PAYMENTS */}
            {activeTab === 'invoices' && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-neutral-200/70 dark:border-zinc-800 p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-100 dark:border-zinc-800 pb-3">
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                                Statutory Tax Invoices & Payment Logs
                            </h4>
                            <p className="text-[11px] text-neutral-400 mt-0.5">Auto-generated upon each billing renewal cycle</p>
                        </div>
                        <span className="text-[11px] font-bold text-neutral-400">
                            {invoices.length} Invoices
                        </span>
                    </div>

                    {invoices.length === 0 ? (
                        <div className="py-8 text-center text-neutral-400 text-xs">
                            No billing invoice records yet. Invoices are generated automatically on monthly subscription renewals.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-neutral-100 dark:border-zinc-800 text-neutral-400 font-semibold uppercase text-[10px] tracking-wider">
                                        <th className="py-2.5 px-3">Invoice #</th>
                                        <th className="py-2.5 px-3">Billing Date</th>
                                        <th className="py-2.5 px-3">Location ID</th>
                                        <th className="py-2.5 px-3">Amount</th>
                                        <th className="py-2.5 px-3 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100 dark:divide-zinc-800">
                                    {invoices.map((inv: any) => (
                                        <tr key={inv.id} className="hover:bg-neutral-50/50 dark:hover:bg-zinc-800/30 transition">
                                            <td className="py-3 px-3 font-mono font-bold text-neutral-900 dark:text-white">
                                                {inv.invoice_number}
                                            </td>
                                            <td className="py-3 px-3 text-neutral-500">
                                                {new Date(inv.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="py-3 px-3 text-neutral-600 dark:text-neutral-400 font-mono text-[11px]">
                                                {inv.restaurant_id}
                                            </td>
                                            <td className="py-3 px-3 font-bold text-neutral-900 dark:text-white">
                                                ₹{Number(inv.total || inv.amount || 0).toLocaleString('en-IN')}
                                            </td>
                                            <td className="py-3 px-3 text-right">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-neutral-100 dark:bg-zinc-800 text-emerald-600">
                                                    {inv.status || 'PAID'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
