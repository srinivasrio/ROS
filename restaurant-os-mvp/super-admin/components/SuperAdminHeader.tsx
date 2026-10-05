'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, Bell, Shield, User, LogOut, Settings, Plus,
    Activity, ChevronDown, Check, ExternalLink, HelpCircle,
    Building2, Sparkles, X
} from 'lucide-react';

interface SuperAdminHeaderProps {
    onOpenSearch: () => void;
}

export default function SuperAdminHeader({ onOpenSearch }: SuperAdminHeaderProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [profileOpen, setProfileOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(3);
    const [notifications, setNotifications] = useState<any[]>([
        { id: '1', title: 'New Branch Provisioned', message: 'Spice Route Hospitality launched Airport Terminal T2 branch.', time: '10m ago', unread: true },
        { id: '2', title: '14-Day Free Trial Initiated', message: 'Spice Route Hospitality registered for Starter Trial.', time: '1h ago', unread: true },
        { id: '3', title: 'High-Priority Support Ticket', message: 'TICK-1001: Thermal printer configuration assistance.', time: '2h ago', unread: true },
    ]);

    // Handle logout
    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/login';
        } catch {
            window.location.href = '/login';
        }
    };

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.header-dropdown')) {
                setProfileOpen(false);
                setNotifOpen(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    // Get page title from pathname
    const getPageTitle = () => {
        if (pathname.includes('/dashboard')) return 'Platform Command Center';
        if (pathname.includes('/owners/') && pathname.split('/owners/')[1]) return 'Owner Management Workspace';
        if (pathname.includes('/owners')) return 'Owners';
        if (pathname.includes('/restaurants')) return 'Owners';
        if (pathname.includes('/branches')) return 'Owners';
        if (pathname.includes('/subscriptions')) return 'Subscriptions & Plans';
        if (pathname.includes('/billing')) return 'Billing & Invoicing';
        if (pathname.includes('/support')) return 'Support Center';
        if (pathname.includes('/audit-logs')) return 'Platform Audit Logs';
        if (pathname.includes('/security')) return 'Security & Threat Center';
        if (pathname.includes('/reports')) return 'Platform Analytics & Reports';
        if (pathname.includes('/notifications')) return 'Notification Center';
        if (pathname.includes('/settings')) return 'Platform Settings';
        return 'Super Admin';
    };

    return (
        <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur-md border-b border-[#E4E7EC] px-6 flex items-center justify-between transition-all">
            {/* Left: Page Title & Breadcrumbs */}
            <div className="flex items-center gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                            Founder Console
                        </span>
                        <span className="text-xs text-neutral-400">/</span>
                        <h1 className="text-sm font-black text-[#172033] tracking-tight">{getPageTitle()}</h1>
                    </div>
                </div>
            </div>

            {/* Middle: Global Search Trigger */}
            <div className="hidden md:flex items-center max-w-md w-full mx-6">
                <button
                    onClick={onOpenSearch}
                    className="w-full flex items-center justify-between px-3.5 py-2 bg-[#F5F7FC] hover:bg-[#EEF2FF]/60 border border-[#E4E7EC] hover:border-indigo-200 rounded-xl text-xs text-[#667085] transition-all cursor-pointer shadow-sm group"
                >
                    <div className="flex items-center gap-2.5">
                        <Search size={14} className="text-neutral-400 group-hover:text-indigo-600 transition-colors" />
                        <span>Search restaurants, owners, branches, invoices...</span>
                    </div>
                    <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 bg-white text-[10px] font-mono text-neutral-500 rounded border border-neutral-200 shadow-2xs">
                        ⌘K
                    </kbd>
                </button>
            </div>

            {/* Right: Status, Actions, Notifications & Profile */}
            <div className="flex items-center gap-3">
                {/* Platform Health Badge */}
                <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-700">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Platform Operational</span>
                </div>

                {/* Quick Add Restaurant */}
                <Link
                    href="/admin/restaurants/new"
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-indigo-600/20 transition-all cursor-pointer"
                >
                    <Plus size={14} />
                    <span>New Restaurant</span>
                </Link>

                {/* Notifications Dropdown */}
                <div className="relative header-dropdown">
                    <button
                        onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
                        className="relative p-2 rounded-xl text-[#667085] hover:text-[#172033] hover:bg-[#F5F7FC] transition-colors cursor-pointer"
                        title="Notifications"
                    >
                        <Bell size={18} />
                        {unreadCount > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-600 rounded-full ring-2 ring-white" />
                        )}
                    </button>

                    <AnimatePresence>
                        {notifOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                transition={{ duration: 0.15 }}
                                className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-[#E4E7EC] p-4 z-50"
                            >
                                <div className="flex items-center justify-between pb-3 border-b border-[#E4E7EC]">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xs font-black text-[#172033]">Platform Notifications</h3>
                                        <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 font-bold text-[10px] rounded-full">
                                            {unreadCount} new
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => { setUnreadCount(0); setNotifications(notifications.map(n => ({ ...n, unread: false }))); }}
                                        className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                                    >
                                        Mark all read
                                    </button>
                                </div>

                                <div className="divide-y divide-neutral-100 max-h-72 overflow-y-auto saas-scrollbar py-1">
                                    {notifications.map((n) => (
                                        <div key={n.id} className="py-2.5 px-2 hover:bg-[#F5F7FC] rounded-xl transition-colors cursor-pointer">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs font-bold text-[#172033]">{n.title}</p>
                                                <span className="text-[10px] text-neutral-400">{n.time}</span>
                                            </div>
                                            <p className="text-[11px] text-[#667085] mt-0.5 line-clamp-2">{n.message}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-2 border-t border-[#E4E7EC] text-center">
                                    <Link
                                        href="/admin/notifications"
                                        onClick={() => setNotifOpen(false)}
                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                                    >
                                        View All Notifications →
                                    </Link>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Founder Profile Dropdown */}
                <div className="relative header-dropdown">
                    <button
                        onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
                        className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-[#F5F7FC] transition-colors cursor-pointer"
                    >
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-black text-xs flex items-center justify-center shadow-md shadow-indigo-600/20">
                            F
                        </div>
                        <div className="hidden sm:block text-left">
                            <p className="text-xs font-black text-[#172033] leading-none">Founder</p>
                            <p className="text-[10px] font-semibold text-indigo-600 mt-0.5 leading-none">Super Admin</p>
                        </div>
                        <ChevronDown size={14} className="text-neutral-400" />
                    </button>

                    <AnimatePresence>
                        {profileOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                transition={{ duration: 0.15 }}
                                className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-[#E4E7EC] p-2 z-50"
                            >
                                <div className="p-3 bg-[#EEF2FF]/60 rounded-xl mb-2">
                                    <p className="text-xs font-black text-[#172033]">Dine in One Founder</p>
                                    <p className="text-[11px] text-[#667085] truncate">founder@dineinone.com</p>
                                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[9px] font-black uppercase tracking-wider">
                                        <Shield size={10} /> Full Platform Scope
                                    </div>
                                </div>

                                <div className="space-y-0.5 text-xs font-semibold text-[#172033]">
                                    <Link
                                        href="/admin/settings"
                                        onClick={() => setProfileOpen(false)}
                                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#F5F7FC] transition-colors"
                                    >
                                        <Settings size={14} className="text-neutral-400" />
                                        <span>Platform Settings</span>
                                    </Link>
                                    <Link
                                        href="/admin/security"
                                        onClick={() => setProfileOpen(false)}
                                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#F5F7FC] transition-colors"
                                    >
                                        <Shield size={14} className="text-neutral-400" />
                                        <span>Security Center</span>
                                    </Link>
                                    <Link
                                        href="/admin/audit-logs"
                                        onClick={() => setProfileOpen(false)}
                                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#F5F7FC] transition-colors"
                                    >
                                        <Activity size={14} className="text-neutral-400" />
                                        <span>Audit Logs</span>
                                    </Link>
                                </div>

                                <div className="mt-2 pt-2 border-t border-[#E4E7EC]">
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors text-xs font-bold cursor-pointer"
                                    >
                                        <LogOut size={14} />
                                        <span>Sign Out of Console</span>
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </header>
    );
}
