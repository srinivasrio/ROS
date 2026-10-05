'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOwner } from '@/context/OwnerContext';
import { 
    CreditCard, FileText, CheckCircle2, AlertTriangle, ArrowUpRight, 
    Download, Store, RefreshCw, Lock, Sparkles, ShieldCheck, Check,
    Clock, HelpCircle, MessageSquare, Zap, ChevronRight
} from 'lucide-react';

export default function BillingPage() {
    const { selectedRestaurantId, isAllRestaurants, currentRestaurant, setSelectedRestaurant } = useOwner();
    const [billingData, setBillingData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'features' | 'plans' | 'invoices'>('overview');
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
                if (data.currentEntitlement?.restaurantId) {
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

    const currentEntitlement = billingData?.restaurants?.find((r: any) => r.restaurantId === selectedBranchId) 
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
            return <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-red-500/20 text-red-200 border border-red-500/30">Suspended</span>;
        }
        if (st === 'EXPIRED') {
            return <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-amber-500/20 text-amber-200 border border-amber-500/30">Expired</span>;
        }
        if (trial || st === 'TRIAL') {
            return <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-cyan-400/20 text-cyan-200 border border-cyan-400/30">14-Day Trial</span>;
        }
        if (st === 'CANCELLED') {
            return <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-zinc-500/20 text-zinc-300 border border-zinc-500/30">Cancelled (Grace Period)</span>;
        }
        return <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">Active Service</span>;
    };

    return (
        <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight flex items-center gap-2">
                        <CreditCard className="text-indigo-500" size={24} />
                        Subscription & Feature Entitlements
                    </h2>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                        Real-time plan tier, operational feature access, and tax invoices per restaurant location.
                    </p>
                </div>
                <button
                    onClick={() => fetchBilling(selectedBranchId)}
                    className="p-2.5 self-start sm:self-auto rounded-xl border border-neutral-200/60 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-zinc-700 transition cursor-pointer"
                    title="Refresh billing data"
                >
                    <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Restaurant Selector when multiple locations exist */}
            {billingData?.restaurants && billingData.restaurants.length > 1 && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-neutral-200/70 dark:border-zinc-800 p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-2">
                        <Store size={18} className="text-indigo-600 dark:text-indigo-400" />
                        <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                            Select Restaurant Location:
                        </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {billingData.restaurants.map((r: any) => (
                            <button
                                key={r.restaurantId}
                                onClick={() => setSelectedBranchId(r.restaurantId)}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    selectedBranchId === r.restaurantId
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-neutral-100 dark:bg-zinc-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-zinc-700'
                                }`}
                            >
                                {r.restaurantName} ({r.planName})
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Hero Subscription Card */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-800 p-6 lg:p-8 shadow-xl shadow-indigo-600/20 text-white"
            >
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -mr-28 -mt-28 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-violet-400/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

                <div className="relative z-10">
                    <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
                        <div>
                            <div className="flex items-center gap-2 text-xs font-bold text-indigo-200 uppercase tracking-wider mb-1">
                                <span>Active Location</span>
                                <span>•</span>
                                <span className="font-mono text-white/90">{currentEntitlement?.restaurantId}</span>
                            </div>
                            <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                                {currentEntitlement?.restaurantName || 'Restaurant OS'}
                            </h3>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="text-lg font-bold text-white/90">
                                    {planName} Plan
                                </span>
                                {getStatusBadge(status, isTrial)}
                            </div>
                        </div>

                        {daysRemaining !== null && (
                            <div className="px-4 py-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-right">
                                <p className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider">
                                    {isTrial ? 'Trial Period' : 'Next Renewal'}
                                </p>
                                <p className="text-lg font-black text-white">
                                    {daysRemaining} Days Left
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-4 border-t border-white/15">
                        <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-sm">
                            <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Plan Tier</p>
                            <p className="text-base font-black text-white mt-0.5">{planName}</p>
                        </div>
                        <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-sm">
                            <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Renewal Date</p>
                            <p className="text-base font-black text-white mt-0.5">{renewalDate}</p>
                        </div>
                        <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-sm">
                            <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Active Features</p>
                            <p className="text-base font-black text-emerald-300 mt-0.5">{availableFeatures.length} Modules</p>
                        </div>
                        <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-sm">
                            <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Locked Features</p>
                            <p className="text-base font-black text-amber-300 mt-0.5">{lockedFeatures.length} Upgrades</p>
                        </div>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-3">
                        <button 
                            onClick={() => setActiveTab('plans')}
                            className="px-6 py-3 bg-white text-indigo-700 hover:bg-neutral-100 rounded-xl text-sm font-bold shadow-lg shadow-black/10 transition-all cursor-pointer flex items-center gap-2"
                        >
                            <span>Upgrade or Change Plan</span>
                            <ArrowUpRight size={16} />
                        </button>
                        <button 
                            onClick={() => setActiveTab('features')}
                            className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold border border-white/20 transition-all cursor-pointer"
                        >
                            View Feature Entitlements
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-neutral-200 dark:border-zinc-800 gap-6">
                {[
                    { id: 'overview', label: 'Feature Access Matrix' },
                    { id: 'plans', label: 'Available Plans & Pricing' },
                    { id: 'invoices', label: 'Invoices & Payments' },
                ].map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id as any)}
                        className={`pb-3 text-sm font-bold transition-all relative cursor-pointer ${
                            activeTab === t.id
                                ? 'text-indigo-600 dark:text-indigo-400'
                                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                        }`}
                    >
                        {t.label}
                        {activeTab === t.id && (
                            <motion.div
                                layoutId="activeTabIndicator"
                                className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400"
                            />
                        )}
                    </button>
                ))}
            </div>

            {/* TAB 1: FEATURE ENTITLEMENTS MATRIX */}
            {(activeTab === 'overview' || activeTab === 'features') && (
                <div className="space-y-6">
                    {/* Add-on spotlight */}
                    <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                                <MessageSquare size={24} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="text-base font-black text-neutral-900 dark:text-white">
                                        WhatsApp Digital Bills & Alerts
                                    </h4>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                                        Paid Add-on
                                    </span>
                                </div>
                                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 max-w-xl">
                                    Send official PDF tax invoices and live kitchen status notifications directly to customer WhatsApp automatically.
                                    Never included automatically in base subscriptions.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {currentEntitlement?.hasWhatsAppBills ? (
                                <span className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5">
                                    <Check size={14} /> Active on this location
                                </span>
                            ) : (
                                <a
                                    href="mailto:support@dineinone.com?subject=Enable WhatsApp Bills Addon"
                                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition"
                                >
                                    Activate for ₹499/mo
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Features Lists */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Included Features */}
                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-neutral-200/70 dark:border-zinc-800 p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                        <CheckCircle2 size={18} />
                                    </div>
                                    <h4 className="text-base font-black text-neutral-900 dark:text-white">
                                        Included in {planName}
                                    </h4>
                                </div>
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                    {availableFeatures.length} Active
                                </span>
                            </div>
                            <div className="space-y-3">
                                {availableFeatures.map((feat: any) => (
                                    <div 
                                        key={feat.key} 
                                        className="p-3.5 rounded-2xl bg-neutral-50/70 dark:bg-zinc-800/40 border border-neutral-100 dark:border-zinc-800/60 flex items-start gap-3"
                                    >
                                        <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
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

                        {/* Locked Features */}
                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-neutral-200/70 dark:border-zinc-800 p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                        <Lock size={18} />
                                    </div>
                                    <h4 className="text-base font-black text-neutral-900 dark:text-white">
                                        Locked Features
                                    </h4>
                                </div>
                                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                                    {lockedFeatures.length} Locked
                                </span>
                            </div>

                            {lockedFeatures.length === 0 ? (
                                <div className="p-8 text-center text-neutral-400 text-xs font-semibold">
                                    All standard platform features are currently unlocked for this restaurant.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {lockedFeatures.map((feat: any) => (
                                        <div 
                                            key={feat.key} 
                                            className="p-3.5 rounded-2xl bg-amber-50/40 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/30 flex items-start gap-3"
                                        >
                                            <Lock size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                                                        {feat.label}
                                                    </p>
                                                    <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                                                        Requires {feat.minimumPlanLabel}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1">
                                                    {feat.upgradeMessage || feat.description}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: PLANS & PRICING */}
            {activeTab === 'plans' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {plans.map((p: any) => {
                            const isCurrent = planSlug === p.slug;
                            return (
                                <div 
                                    key={p.slug}
                                    className={`relative rounded-3xl p-6 flex flex-col justify-between transition-all ${
                                        isCurrent 
                                            ? 'bg-white dark:bg-zinc-900 border-2 border-indigo-600 shadow-xl shadow-indigo-600/10'
                                            : 'bg-white dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-800 shadow-sm hover:border-indigo-400'
                                    }`}
                                >
                                    {isCurrent && (
                                        <div className="absolute -top-3 left-6 px-3 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider">
                                            Current Active Plan
                                        </div>
                                    )}

                                    <div>
                                        <h4 className="text-lg font-black text-neutral-900 dark:text-white">
                                            {p.name}
                                        </h4>
                                        <p className="text-xs text-neutral-500 mt-1 min-h-[32px]">
                                            {p.tagline}
                                        </p>

                                        <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-zinc-800">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-2xl font-black text-neutral-900 dark:text-white">
                                                    ₹{p.priceMonthly.toLocaleString('en-IN')}
                                                </span>
                                                <span className="text-xs text-neutral-500 font-semibold">/month</span>
                                            </div>
                                            {p.priceAnnual > 0 && (
                                                <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                                                    or ₹{p.priceAnnual.toLocaleString('en-IN')}/year
                                                </p>
                                            )}
                                        </div>

                                        <div className="mt-6 space-y-2.5">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                                                What's Included:
                                            </p>
                                            {p.features.map((f: string, i: number) => {
                                                const isExclusion = f.startsWith('✕') || f.startsWith('No ');
                                                return (
                                                    <div key={i} className="flex items-start gap-2 text-xs">
                                                        {isExclusion ? (
                                                            <span className="text-neutral-400 font-bold">✕</span>
                                                        ) : (
                                                            <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                                                        )}
                                                        <span className={isExclusion ? 'text-neutral-400' : 'text-neutral-700 dark:text-neutral-300 font-medium'}>
                                                            {f.replace(/^✕\s*/, '')}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="mt-8 pt-4 border-t border-neutral-100 dark:border-zinc-800">
                                        {isCurrent ? (
                                            <div className="w-full py-2.5 rounded-xl bg-neutral-100 dark:bg-zinc-800 text-neutral-500 font-bold text-xs text-center">
                                                Active on this restaurant
                                            </div>
                                        ) : (
                                            <a
                                                href={`mailto:billing@dineinone.com?subject=Plan Upgrade Request to ${p.name} for Restaurant ${currentEntitlement?.restaurantId}`}
                                                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs text-center flex items-center justify-center gap-1.5 transition"
                                            >
                                                <span>Upgrade to {p.name}</span>
                                                <ArrowUpRight size={14} />
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
                <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-neutral-200/70 dark:border-zinc-800 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h4 className="text-base font-black text-neutral-900 dark:text-white">
                                GST Compliant Tax Invoices
                            </h4>
                            <p className="text-xs text-neutral-500">Official statutory invoices generated per billing cycle</p>
                        </div>
                        <span className="text-xs font-semibold text-neutral-400">
                            {invoices.length} Invoices Found
                        </span>
                    </div>

                    {invoices.length === 0 ? (
                        <div className="p-8 text-center text-neutral-400 text-xs">
                            No billing invoice records yet. Invoices are generated automatically on monthly subscription renewal.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-neutral-200/60 dark:border-zinc-800 text-neutral-400 font-semibold uppercase tracking-wider">
                                        <th className="py-3 px-4">Invoice #</th>
                                        <th className="py-3 px-4">Billing Date</th>
                                        <th className="py-3 px-4">Location</th>
                                        <th className="py-3 px-4">Amount</th>
                                        <th className="py-3 px-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100 dark:divide-zinc-800/60 font-medium">
                                    {invoices.map((inv: any) => (
                                        <tr key={inv.id} className="hover:bg-neutral-50/60 dark:hover:bg-zinc-800/40 transition">
                                            <td className="py-3 px-4 font-mono font-bold text-neutral-900 dark:text-white">
                                                {inv.invoice_number}
                                            </td>
                                            <td className="py-3 px-4 text-neutral-500">
                                                {new Date(inv.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400">
                                                {inv.restaurant_id}
                                            </td>
                                            <td className="py-3 px-4 font-black text-neutral-900 dark:text-white">
                                                ₹{Number(inv.total || inv.amount || 0).toLocaleString('en-IN')}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
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
