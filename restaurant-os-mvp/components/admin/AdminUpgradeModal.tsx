'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, Sparkles, ArrowRight, CheckCircle2, 
    Truck, ClipboardList, BarChart3, Lock 
} from 'lucide-react';
import Link from 'next/link';

export type UpgradeModalFeature = 'delivery' | 'inventory' | 'analytics' | 'advanced_reports' | 'advanced_analytics' | string;

interface FeatureDetails {
    displayName: string;
    descriptionKeyword: string;
    icon: any;
    accentGradient: string;
    iconBg: string;
    iconColor: string;
    perks: string[];
}

const FEATURE_CONFIG: Record<string, FeatureDetails> = {
    delivery: {
        displayName: 'Delivery Management',
        descriptionKeyword: 'delivery management',
        icon: Truck,
        accentGradient: 'from-blue-500 to-indigo-600',
        iconBg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/40',
        iconColor: 'text-blue-600 dark:text-blue-400',
        perks: [
            'Direct doorstep order dispatch & tracking',
            'Delivery driver roster & live availability',
            'Custom delivery polygon zones & delivery fees',
            'Real-time customer SMS / phone updates',
        ],
    },
    inventory: {
        displayName: 'Inventory Management',
        descriptionKeyword: 'inventory management',
        icon: ClipboardList,
        accentGradient: 'from-emerald-500 to-teal-600',
        iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        perks: [
            'Real-time stock level tracking & waste logs',
            'Recipe-level ingredient deductions per KOT',
            'Low-stock automated replenishment alerts',
            'Supplier purchase order management',
        ],
    },
    analytics: {
        displayName: 'Advanced Analytics',
        descriptionKeyword: 'advanced analytics',
        icon: BarChart3,
        accentGradient: 'from-purple-500 to-pink-600',
        iconBg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/40',
        iconColor: 'text-purple-600 dark:text-purple-400',
        perks: [
            'Hourly sales velocity & heatmaps',
            'Dish popularity & margin contribution matrix',
            'Customer cohort retention & repeat frequency',
            'Automated CSV & financial audit exports',
        ],
    },
    advanced_reports: {
        displayName: 'Advanced Analytics',
        descriptionKeyword: 'advanced analytics',
        icon: BarChart3,
        accentGradient: 'from-purple-500 to-pink-600',
        iconBg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/40',
        iconColor: 'text-purple-600 dark:text-purple-400',
        perks: [
            'Hourly sales velocity & heatmaps',
            'Dish popularity & margin contribution matrix',
            'Customer cohort retention & repeat frequency',
            'Automated CSV & financial audit exports',
        ],
    },
    advanced_analytics: {
        displayName: 'Advanced Analytics',
        descriptionKeyword: 'advanced analytics',
        icon: BarChart3,
        accentGradient: 'from-purple-500 to-pink-600',
        iconBg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/40',
        iconColor: 'text-purple-600 dark:text-purple-400',
        perks: [
            'Hourly sales velocity & heatmaps',
            'Dish popularity & margin contribution matrix',
            'Customer cohort retention & repeat frequency',
            'Automated CSV & financial audit exports',
        ],
    },
};

interface AdminUpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    feature: UpgradeModalFeature;
    restaurantCode?: string;
    currentPlanName?: string;
}

export default function AdminUpgradeModal({
    isOpen,
    onClose,
    feature,
    restaurantCode,
    currentPlanName = 'Standard',
}: AdminUpgradeModalProps) {
    const config = FEATURE_CONFIG[feature] || FEATURE_CONFIG.delivery;
    const Icon = config.icon || Lock;

    // Handle Escape key to close
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div 
                    role="dialog"
                    aria-modal="true"
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
                >
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-md"
                    />

                    {/* Modal Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.94, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 15 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl border border-neutral-200/80 dark:border-zinc-800 shadow-2xl overflow-hidden z-10 my-auto"
                    >
                        {/* Top decorative gradient bar */}
                        <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 via-amber-500 to-indigo-500" />

                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-5 right-5 w-9 h-9 rounded-xl bg-neutral-100 dark:bg-zinc-800 hover:bg-neutral-200 dark:hover:bg-zinc-700 text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer z-10"
                            aria-label="Close"
                        >
                            <X size={18} />
                        </button>

                        <div className="p-6 sm:p-8 space-y-6">
                            {/* Feature Available on Growth Badge */}
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400 text-xs font-black uppercase tracking-wider">
                                    <Sparkles size={12} className="text-amber-500 animate-pulse" />
                                    <span>Feature available on Growth</span>
                                </span>
                            </div>

                            {/* Header Section with Icon */}
                            <div className="flex items-start gap-4">
                                <div className={`w-14 h-14 rounded-2xl ${config.iconBg} border flex items-center justify-center flex-shrink-0 shadow-sm`}>
                                    <Icon size={28} className={config.iconColor} />
                                </div>
                                <div>
                                    <h3 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white tracking-tight leading-tight">
                                        {config.displayName}
                                    </h3>
                                    <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mt-1">
                                        {config.displayName} is available on the <span className="text-indigo-600 dark:text-indigo-400 font-bold">Growth plan</span>.
                                    </p>
                                </div>
                            </div>

                            {/* Dynamic Upgrade Description */}
                            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-zinc-800/50 border border-neutral-200/60 dark:border-zinc-700/40 text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                                Upgrade your plan to unlock {config.descriptionKeyword} and other advanced restaurant features.
                            </div>

                            {/* Growth Plan Highlight Card */}
                            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/50 via-purple-50/30 to-orange-50/20 dark:from-indigo-950/20 dark:via-purple-950/10 dark:to-orange-950/10 border border-indigo-200/60 dark:border-indigo-900/40 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                                            Growth Plan
                                        </span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                            Most Popular
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-lg font-black text-neutral-900 dark:text-white">₹1,499</span>
                                        <span className="text-[11px] text-neutral-500 font-medium">/mo</span>
                                    </div>
                                </div>

                                <div className="space-y-2 pt-1 border-t border-indigo-100 dark:border-zinc-800">
                                    {config.perks.map((perk, idx) => (
                                        <div key={idx} className="flex items-center gap-2.5 text-xs text-neutral-700 dark:text-neutral-300 font-medium">
                                            <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                                            <span>{perk}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                                <Link
                                    href="/owner/billing"
                                    onClick={onClose}
                                    className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-orange-500 to-[#FF6B6B] hover:from-orange-600 hover:to-[#FF5252] text-white font-bold text-sm shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer text-center"
                                >
                                    <span>Upgrade Plan</span>
                                    <ArrowRight size={16} />
                                </Link>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="w-full sm:w-auto py-3.5 px-6 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-neutral-700 dark:text-neutral-200 font-bold text-sm transition-colors cursor-pointer text-center"
                                >
                                    Maybe Later
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
