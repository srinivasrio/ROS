'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    UtensilsCrossed,
    Users,
    GitBranch,
    CreditCard,
    Receipt,
    Headset,
    ShieldAlert,
    Shield,
    BarChart3,
    Bell,
    Settings,
    ChevronDown,
    ChevronRight,
    LogOut,
    Sparkles,
    PanelLeftClose,
    PanelLeftOpen,
    PlusCircle,
    UserCheck,
    AlertCircle,
    KeyRound,
    FileCheck2,
    Database,
    Zap,
    ExternalLink
} from 'lucide-react';

interface NavItem {
    label: string;
    href?: string;
    icon: any;
    badge?: string;
    badgeVariant?: 'primary' | 'warning' | 'danger' | 'success';
    children?: {
        label: string;
        href: string;
        badge?: string;
    }[];
}

const NAV_ITEMS: NavItem[] = [
    {
        label: 'Dashboard',
        href: '/admin/dashboard',
        icon: LayoutDashboard,
    },
    {
        label: 'Owners',
        href: '/admin/owners',
        icon: Users,
    },
    {
        label: 'Subscriptions',
        href: '/admin/subscriptions',
        icon: Zap,
    },
    {
        label: 'Billing & Invoices',
        icon: Receipt,
        children: [
            { label: 'All Invoices', href: '/admin/billing' },
            { label: 'Payment Gateway', href: '/admin/billing?tab=payments' },
            { label: 'Revenue Analytics', href: '/admin/billing?tab=revenue' },
        ],
    },
    {
        label: 'Support Center',
        icon: Headset,
        badge: '3',
        badgeVariant: 'warning',
        children: [
            { label: 'All Tickets', href: '/admin/support' },
            { label: 'Restaurant Requests', href: '/admin/support?tab=restaurant' },
            { label: 'User Issues', href: '/admin/support?tab=user' },
        ],
    },
    {
        label: 'Audit Logs',
        href: '/admin/audit-logs',
        icon: ShieldAlert,
    },
    {
        label: 'Security Center',
        icon: Shield,
        children: [
            { label: 'Security Overview', href: '/admin/security' },
            { label: 'Login Activity', href: '/admin/security?tab=logins' },
            { label: 'Failed Attempts', href: '/admin/security?tab=failed' },
            { label: 'Suspicious Activity', href: '/admin/security?tab=suspicious' },
            { label: 'Security Events', href: '/admin/security?tab=events' },
        ],
    },
    {
        label: 'Reports & BI',
        icon: BarChart3,
        children: [
            { label: 'Platform Reports', href: '/admin/reports' },
            { label: 'Restaurant Analytics', href: '/admin/reports?tab=restaurants' },
            { label: 'Branch Footprint', href: '/admin/reports?tab=branches' },
            { label: 'Revenue Trends', href: '/admin/reports?tab=revenue' },
        ],
    },
    {
        label: 'Notifications',
        href: '/admin/notifications',
        icon: Bell,
        badge: 'New',
        badgeVariant: 'primary',
    },
    {
        label: 'Platform Settings',
        icon: Settings,
        children: [
            { label: 'Dine in One Profile', href: '/admin/settings?tab=profile' },
            { label: 'Subscription Settings', href: '/admin/settings?tab=subscriptions' },
            { label: 'Billing Configuration', href: '/admin/settings?tab=billing' },
            { label: 'Legal & Policies', href: '/admin/settings?tab=legal' },
            { label: 'Notification Rules', href: '/admin/settings?tab=notifications' },
            { label: 'Data Retention', href: '/admin/settings?tab=retention' },
            { label: 'System Settings', href: '/admin/settings?tab=system' },
        ],
    },
];

interface SuperAdminSidebarProps {
    mobileOpen: boolean;
    onCloseMobile: () => void;
    collapsed: boolean;
    onToggleCollapsed: () => void;
}

export default function SuperAdminSidebar({
    mobileOpen,
    onCloseMobile,
    collapsed,
    onToggleCollapsed,
}: SuperAdminSidebarProps) {
    const pathname = usePathname();
    const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

    // Auto-expand menu if child is active
    useEffect(() => {
        const newOpen: Record<string, boolean> = {};
        NAV_ITEMS.forEach((item) => {
            if (item.children) {
                const hasActive = item.children.some(
                    (child) => pathname === child.href || pathname.startsWith(child.href.split('?')[0])
                );
                if (hasActive) {
                    newOpen[item.label] = true;
                }
            }
        });
        setOpenMenus((prev) => ({ ...prev, ...newOpen }));
    }, [pathname]);

    const toggleMenu = (label: string) => {
        setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
    };

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/login';
        } catch {
            window.location.href = '/login';
        }
    };

    const sidebarContent = (
        <div className="flex flex-col h-full bg-white select-none">
            {/* Brand Logo Header */}
            <div className="h-16 px-5 border-b border-[#E4E7EC] flex items-center justify-between">
                <Link href="/admin/dashboard" className="flex items-center gap-3 group">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center text-white shadow-sm shadow-indigo-600/30 font-black text-lg tracking-tighter">
                        D
                    </div>
                    {!collapsed && (
                        <div className="flex flex-col">
                            <span className="font-extrabold text-sm tracking-tight text-[#172033] leading-none flex items-center gap-1.5">
                                Dine in One
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.2 rounded">
                                    HQ
                                </span>
                            </span>
                            <span className="text-[11px] text-[#667085] font-medium tracking-wide mt-1">
                                Founder Command Center
                            </span>
                        </div>
                    )}
                </Link>

                {!collapsed && (
                    <button
                        onClick={onToggleCollapsed}
                        title="Collapse sidebar"
                        className="hidden lg:flex p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                    >
                        <PanelLeftClose size={16} />
                    </button>
                )}
            </div>

            {/* Navigation Menu */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 custom-scrollbar">
                {NAV_ITEMS.map((item) => {
                    const isParentActive =
                        item.href === pathname ||
                        (item.children &&
                            item.children.some(
                                (c) => pathname === c.href || pathname.startsWith(c.href.split('?')[0])
                            ));
                    const isExpanded = openMenus[item.label];

                    if (item.children) {
                        return (
                            <div key={item.label} className="space-y-0.5">
                                <button
                                    onClick={() => toggleMenu(item.label)}
                                    title={collapsed ? item.label : undefined}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                        isParentActive
                                            ? 'bg-indigo-50/70 text-indigo-700'
                                            : 'text-[#667085] hover:bg-[#F5F7FC] hover:text-[#172033]'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <item.icon
                                            size={17}
                                            className={isParentActive ? 'text-indigo-600' : 'text-neutral-400'}
                                        />
                                        {!collapsed && (
                                            <span className="truncate tracking-tight">{item.label}</span>
                                        )}
                                    </div>
                                    {!collapsed && (
                                        <div className="flex items-center gap-1.5">
                                            {item.badge && (
                                                <span
                                                    className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                                                        item.badgeVariant === 'warning'
                                                            ? 'bg-amber-100 text-amber-800'
                                                            : item.badgeVariant === 'danger'
                                                            ? 'bg-red-100 text-red-800'
                                                            : 'bg-indigo-100 text-indigo-800'
                                                    }`}
                                                >
                                                    {item.badge}
                                                </span>
                                            )}
                                            {isExpanded ? (
                                                <ChevronDown size={14} className="text-neutral-400" />
                                            ) : (
                                                <ChevronRight size={14} className="text-neutral-400" />
                                            )}
                                        </div>
                                    )}
                                </button>

                                {/* Sub-items accordion */}
                                {!collapsed && isExpanded && (
                                    <div className="pl-9 pr-2 py-1 space-y-0.5 border-l-2 border-indigo-100 ml-4 my-0.5">
                                        {item.children.map((child) => {
                                            const isChildActive =
                                                pathname === child.href ||
                                                (pathname === child.href.split('?')[0] && !child.href.includes('?'));
                                            return (
                                                <Link
                                                    key={child.label}
                                                    href={child.href}
                                                    onClick={onCloseMobile}
                                                    className={`block px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                                                        isChildActive
                                                            ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                                                            : 'text-[#667085] hover:text-[#172033] hover:bg-[#F5F7FC]'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span>{child.label}</span>
                                                        {child.badge && (
                                                            <span className="text-[9px] font-bold bg-neutral-200 text-neutral-700 px-1 rounded">
                                                                {child.badge}
                                                            </span>
                                                        )}
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    }

                    // Single Item Link
                    const isActive = pathname === item.href || (Boolean(item.href) && item.href !== '/admin/dashboard' && pathname.startsWith((item.href as string) + '/'));
                    return (
                        <Link
                            key={item.label}
                            href={item.href || '#'}
                            onClick={onCloseMobile}
                            title={collapsed ? item.label : undefined}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                                isActive
                                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                                    : 'text-[#667085] hover:bg-[#F5F7FC] hover:text-[#172033]'
                            }`}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <item.icon
                                    size={17}
                                    className={isActive ? 'text-white' : 'text-neutral-400'}
                                />
                                {!collapsed && <span className="truncate tracking-tight">{item.label}</span>}
                            </div>
                            {!collapsed && item.badge && (
                                <span
                                    className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                                        isActive
                                            ? 'bg-white/20 text-white'
                                            : 'bg-indigo-100 text-indigo-800'
                                    }`}
                                >
                                    {item.badge}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom Founder Profile & Actions */}
            <div className="p-3 border-t border-[#E4E7EC] bg-[#F5F7FC]/70">
                {collapsed ? (
                    <div className="flex flex-col items-center gap-2">
                        <button
                            onClick={onToggleCollapsed}
                            title="Expand sidebar"
                            className="p-2 text-neutral-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                        >
                            <PanelLeftOpen size={16} />
                        </button>
                        <button
                            onClick={handleLogout}
                            title="Sign out"
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-white border border-[#E4E7EC] shadow-2xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                                    FP
                                </div>
                                <div className="truncate">
                                    <p className="text-xs font-bold text-[#172033] leading-none truncate">
                                        Founder Console
                                    </p>
                                    <p className="text-[10px] text-[#667085] truncate mt-0.5">
                                        Secure session active
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleLogout}
                                title="Sign Out"
                                className="p-1 text-neutral-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                            >
                                <LogOut size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop Fixed Sidebar */}
            <aside
                className={`hidden md:block fixed top-0 left-0 bottom-0 z-40 bg-white border-r border-[#E4E7EC] transition-all duration-300 ease-in-out ${
                    collapsed ? 'w-18' : 'w-64'
                }`}
            >
                {sidebarContent}
            </aside>

            {/* Mobile Drawer Overlay */}
            <AnimatePresence>
                {mobileOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.5 }}
                            exit={{ opacity: 0 }}
                            onClick={onCloseMobile}
                            className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs md:hidden"
                        />
                        <motion.aside
                            initial={{ x: -280 }}
                            animate={{ x: 0 }}
                            exit={{ x: -280 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                            className="fixed top-0 bottom-0 left-0 z-50 w-72 bg-white shadow-2xl md:hidden"
                        >
                            {sidebarContent}
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
