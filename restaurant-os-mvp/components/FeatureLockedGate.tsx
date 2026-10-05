'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
    Lock, Sparkles, ArrowRight, CheckCircle2, ShieldAlert,
    Truck, ClipboardList, BarChart3, Users, Building2, MessageSquare
} from 'lucide-react';
import { FEATURE_DEFINITIONS, CANONICAL_PLANS } from '@/lib/entitlements-shared';
import type { FeatureKey, PlanSlug } from '@/lib/entitlements-shared';

const FEATURE_ICONS: Record<string, any> = {
    delivery: Truck,
    inventory: ClipboardList,
    recipe_inventory: ClipboardList,
    low_stock_alerts: ClipboardList,
    advanced_reports: BarChart3,
    advanced_analytics: BarChart3,
    advanced_staff: Users,
    owner_panel: Building2,
    multi_restaurant: Building2,
    whatsapp_bills: MessageSquare,
};

interface FeatureLockedGateProps {
    feature: FeatureKey;
    restaurantCode?: string;
    currentPlanName?: string;
    isSuspended?: boolean;
    isExpired?: boolean;
}

export default function FeatureLockedGate({
    feature,
    restaurantCode,
    currentPlanName = 'Standard',
    isSuspended = false,
    isExpired = false,
}: FeatureLockedGateProps) {
    const meta = FEATURE_DEFINITIONS[feature];
    const Icon = FEATURE_ICONS[feature] || Lock;
    const minPlanSlug = (meta?.minimumPlan || 'growth') as PlanSlug;
    const targetPlan = CANONICAL_PLANS[minPlanSlug] || CANONICAL_PLANS.growth;

    // Special status handlers
    if (isSuspended) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-3xl border border-red-200 dark:border-red-900/50 p-8 text-center shadow-xl shadow-red-500/5">
                    <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center mb-6 border border-red-100 dark:border-red-900/40">
                        <ShieldAlert size={32} />
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
                        Account Suspended
                    </span>
                    <h2 className="text-2xl font-black text-neutral-900 dark:text-white mt-4">
                        Service Temporarily Suspended
                    </h2>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
                        Operational features for this restaurant are currently paused by platform administration.
                    </p>
                    <div className="mt-8">
                        <a
                            href="mailto:support@dineinone.com"
                            className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold text-sm hover:opacity-90 transition-all"
                        >
                            Contact Support
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    if (isExpired) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-3xl border border-amber-200 dark:border-amber-900/50 p-8 text-center shadow-xl shadow-amber-500/5">
                    <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center mb-6 border border-amber-100 dark:border-amber-900/40">
                        <Lock size={32} />
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                        Subscription Expired
                    </span>
                    <h2 className="text-2xl font-black text-neutral-900 dark:text-white mt-4">
                        Renewal Required
                    </h2>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
                        Your subscription period has ended. Renew now to restore full access to {meta?.label || 'this feature'}.
                    </p>
                    <div className="mt-8 space-y-3">
                        <Link
                            href="/owner/billing"
                            className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-sm shadow-lg shadow-orange-500/20 hover:opacity-95 transition-all"
                        >
                            Renew Subscription
                            <ArrowRight size={16} />
                        </Link>
                        {restaurantCode && (
                            <Link
                                href={`/${restaurantCode}/admin/dashboard`}
                                className="inline-block text-xs font-semibold text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                            >
                                Back to Dashboard
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const featureDisplayName = feature === 'delivery' 
        ? 'Delivery Management'
        : feature === 'inventory' || feature === 'recipe_inventory'
        ? 'Inventory Management'
        : (feature === 'advanced_reports' || feature === 'advanced_analytics')
        ? 'Advanced Analytics'
        : meta?.label || 'Premium Feature';

    const featureKeyword = featureDisplayName.toLowerCase();

    return (
        <div className="min-h-[75vh] flex items-center justify-center p-6">
            <motion.div 
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="max-w-2xl w-full bg-white dark:bg-zinc-900 rounded-3xl border border-neutral-200/80 dark:border-zinc-800/80 shadow-2xl shadow-indigo-500/5 overflow-hidden"
            >
                {/* Header Banner */}
                <div className="relative p-8 pb-6 bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-transparent dark:from-indigo-950/20 dark:via-purple-950/10 border-b border-neutral-100 dark:border-zinc-800/60">
                    <div className="flex items-center justify-between gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-white dark:bg-zinc-800 shadow-md border border-neutral-200/60 dark:border-zinc-700/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <Icon size={28} />
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400 text-xs font-black uppercase tracking-wider">
                            <Sparkles size={12} className="text-amber-500 animate-pulse" />
                            <span>Feature available on Growth</span>
                        </div>
                    </div>

                    <h2 className="text-2xl font-black text-neutral-900 dark:text-white mt-5">
                        {featureDisplayName}
                    </h2>
                    <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mt-1">
                        {featureDisplayName} is available on the <span className="text-indigo-600 dark:text-indigo-400 font-bold">Growth plan</span>.
                    </p>

                    <div className="mt-4 p-4 rounded-2xl bg-neutral-50 dark:bg-zinc-800/50 border border-neutral-200/60 dark:border-zinc-700/40 text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                        Upgrade your plan to unlock {featureKeyword} and other advanced restaurant features.
                    </div>
                </div>

                {/* Plan Comparison & Perks */}
                <div className="p-8 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Current Plan */}
                        <div className="p-5 rounded-2xl border border-neutral-200/60 dark:border-zinc-800 bg-neutral-50/50 dark:bg-zinc-950/40">
                            <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Current Plan</p>
                            <h4 className="text-lg font-black text-neutral-800 dark:text-neutral-200 mt-1">
                                {currentPlanName}
                            </h4>
                            <p className="text-xs text-neutral-500 mt-2">
                                Does not include {meta?.label.toLowerCase() || 'this module'}.
                            </p>
                        </div>

                        {/* Required Plan */}
                        <div className="p-5 rounded-2xl border-2 border-indigo-500/40 bg-indigo-500/[0.03] relative">
                            <div className="absolute -top-2.5 right-4 px-2 py-0.5 rounded bg-indigo-600 text-[10px] font-black uppercase text-white tracking-wider">
                                Required
                            </div>
                            <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                {targetPlan.name} Plan
                            </p>
                            <div className="flex items-baseline gap-1 mt-1">
                                <span className="text-2xl font-black text-neutral-900 dark:text-white">
                                    ₹{targetPlan.priceMonthly.toLocaleString('en-IN')}
                                </span>
                                <span className="text-xs text-neutral-500 font-semibold">/month</span>
                            </div>
                            <p className="text-xs text-neutral-600 dark:text-neutral-350 mt-2">
                                Unlocks {meta?.label} + additional pro modules.
                            </p>
                        </div>
                    </div>

                    {/* Features unlocked list */}
                    <div className="space-y-2.5">
                        <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                            Included in {targetPlan.name}:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {targetPlan.features.slice(0, 6).map((feat, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                                    <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                                    <span className="truncate">{feat}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                        <Link
                            href="/owner/billing"
                            className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-orange-500 to-[#FF6B6B] hover:from-orange-600 hover:to-[#FF5252] text-white font-bold text-sm shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                            <span>Upgrade Plan</span>
                            <ArrowRight size={16} />
                        </Link>
                        {restaurantCode && (
                            <Link
                                href={`/${restaurantCode}/admin/dashboard`}
                                className="w-full sm:w-auto py-3.5 px-6 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-neutral-700 dark:text-neutral-200 font-bold text-sm text-center transition-all cursor-pointer"
                            >
                                Maybe Later
                            </Link>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
