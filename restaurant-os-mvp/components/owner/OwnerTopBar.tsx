'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Menu, Bell, Search, User } from 'lucide-react';
import { useOwner } from '@/context/OwnerContext';
import BranchSelector from './BranchSelector';

export default function OwnerTopBar() {
    const { restaurant, setMobileSidebarOpen, currentBranch, isAllBranches } = useOwner();
    const pathname = usePathname();

    // Derive page title from pathname
    const getPageTitle = () => {
        const segment = pathname.split('/').filter(Boolean).pop() || 'dashboard';
        const titles: Record<string, string> = {
            dashboard: 'Dashboard',
            branches: 'Branches',
            new: 'Add Branch',
            employees: 'Employees',
            menu: 'Menu',
            orders: 'Orders',
            tables: 'Tables',
            kds: 'KDS',
            customers: 'Customers',
            reports: 'Reports',
            billing: 'Billing & Subscription',
            settings: 'Settings',
        };
        return titles[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    };

    return (
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-neutral-200/40 dark:border-zinc-800/40">
            <div className="flex items-center justify-between px-6 py-3 lg:px-8">
                {/* Left: Mobile menu + Page title */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setMobileSidebarOpen(true)}
                        className="lg:hidden w-10 h-10 rounded-xl bg-neutral-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                    >
                        <Menu size={18} className="text-neutral-600 dark:text-neutral-300" />
                    </button>

                    <div>
                        <motion.h1
                            key={pathname}
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                            className="text-lg font-black text-neutral-900 dark:text-white tracking-tight"
                        >
                            {getPageTitle()}
                        </motion.h1>
                        {!isAllBranches && currentBranch && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-500 dark:text-indigo-400 mt-0.5"
                            >
                                <span className="truncate max-w-[200px]">{currentBranch.name}</span>
                                <span className="text-neutral-300 dark:text-zinc-700">•</span>
                                <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-200/50 dark:border-indigo-800/40 font-bold">
                                    ID: {currentBranch.restaurant_id || currentBranch.id}
                                </span>
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* Right: Branch selector + Actions */}
                <div className="flex items-center gap-3">
                    {/* Search (desktop only) */}
                    <div className="hidden xl:flex items-center gap-2 px-4 py-2.5 bg-neutral-50 dark:bg-zinc-800/50 border border-neutral-200/40 dark:border-zinc-700/30 rounded-xl text-neutral-400 dark:text-neutral-500 w-56 cursor-text group hover:border-indigo-200 dark:hover:border-indigo-800/30 transition-colors">
                        <Search size={14} />
                        <span className="text-sm">Search...</span>
                        <kbd className="ml-auto text-[10px] font-mono bg-neutral-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-neutral-400">⌘K</kbd>
                    </div>

                    {/* Branch Selector */}
                    <BranchSelector />

                    {/* Notifications */}
                    <button className="relative w-10 h-10 rounded-xl bg-neutral-50 dark:bg-zinc-800/50 border border-neutral-200/40 dark:border-zinc-700/30 flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer group">
                        <Bell size={16} className="text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-300 transition-colors" />
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                            <span className="text-[8px] font-black text-white">3</span>
                        </span>
                    </button>

                    {/* Profile */}
                    <button className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-500/20 cursor-pointer hover:shadow-lg hover:shadow-indigo-500/30 transition-shadow">
                        <User size={16} className="text-white" />
                    </button>
                </div>
            </div>
        </header>
    );
}
