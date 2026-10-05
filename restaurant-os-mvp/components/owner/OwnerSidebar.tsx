'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useOwner } from '@/context/OwnerContext';
import {
    LayoutDashboard, Building2, Users, UtensilsCrossed, ShoppingBag,
    Table2, Monitor, UserCircle, BarChart3, CreditCard, Settings,
    LogOut, ChevronLeft, ChevronRight, ChevronDown, X,
    Plus, ToggleLeft, ClipboardList, MapPin, Bell, UserPlus,
    Layers, DollarSign, Shield, FileText, HelpCircle
} from 'lucide-react';

interface NavSection {
    title?: string;
    items: NavItemDef[];
}

interface NavItemDef {
    href: string;
    icon: any;
    label: string;
    badge?: string | number;
    children?: { href: string; label: string }[];
}

const NAV_SECTIONS: NavSection[] = [
    {
        items: [
            { href: '/owner/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        ]
    },
    {
        title: 'Operations',
        items: [
            { href: '/owner/branches', icon: Building2, label: 'Branches' },
            { href: '/owner/employees', icon: Users, label: 'Employees' },
            { href: '/owner/menu', icon: UtensilsCrossed, label: 'Menu' },
            { href: '/owner/orders', icon: ShoppingBag, label: 'Orders' },
            { href: '/owner/tables', icon: Table2, label: 'Tables' },
            { href: '/owner/kds', icon: Monitor, label: 'KDS' },
        ]
    },
    {
        title: 'Insights',
        items: [
            { href: '/owner/customers', icon: UserCircle, label: 'Customers' },
            { href: '/owner/reports', icon: BarChart3, label: 'Reports' },
        ]
    },
    {
        title: 'Business',
        items: [
            { href: '/owner/billing', icon: CreditCard, label: 'Billing & Subscription' },
            { href: '/owner/settings', icon: Settings, label: 'Settings' },
        ]
    },
];

export default function OwnerSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { 
        restaurant, sidebarCollapsed, setSidebarCollapsed,
        mobileSidebarOpen, setMobileSidebarOpen 
    } = useOwner();
    const [expandedItems, setExpandedItems] = useState<string[]>([]);

    const toggleExpand = (href: string) => {
        setExpandedItems(prev => 
            prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href]
        );
    };

    const handleSignOut = async () => {
        try {
            const { UserService } = await import('@/services/users.service');
            await UserService.signOut();
            window.location.href = '/login';
        } catch {
            window.location.href = '/login';
        }
    };

    const sidebarContent = (
        <>
            {/* Brand Header */}
            <div className={`p-5 ${sidebarCollapsed ? 'px-3' : 'px-5'}`}>
                <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center px-2 py-3' : 'px-4 py-3.5'} bg-white dark:bg-zinc-800/50 rounded-2xl border border-neutral-200/60 dark:border-zinc-700/40 shadow-sm transition-all`}>
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-black text-base shadow-md shadow-indigo-500/20">
                        {restaurant?.logoUrl ? (
                            <img src={restaurant.logoUrl} alt={restaurant.name} className="w-full h-full object-cover" />
                        ) : (
                            <span>{(restaurant?.name || 'R').charAt(0).toUpperCase()}</span>
                        )}
                    </div>
                    {!sidebarCollapsed && (
                        <motion.div 
                            initial={{ opacity: 0, x: -10 }} 
                            animate={{ opacity: 1, x: 0 }} 
                            className="flex-1 min-w-0"
                        >
                            <h2 className="text-sm font-black tracking-tight text-neutral-900 dark:text-white truncate">
                                {restaurant?.name || 'Restaurant'}
                            </h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-neutral-400 font-bold tracking-widest uppercase">Owner</span>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <nav className={`flex-1 overflow-y-auto premium-scrollbar ${sidebarCollapsed ? 'px-2' : 'px-3'} pb-4 space-y-6`}>
                {NAV_SECTIONS.map((section, sIdx) => (
                    <div key={sIdx} className="space-y-1">
                        {section.title && !sidebarCollapsed && (
                            <p className="px-4 mb-2 text-[9px] font-black uppercase tracking-[0.15em] text-neutral-400/80 dark:text-neutral-500/80">
                                {section.title}
                            </p>
                        )}
                        {section.title && sidebarCollapsed && (
                            <div className="mx-auto w-5 h-px bg-neutral-200/60 dark:bg-zinc-700/40 mb-2" />
                        )}
                        {section.items.map((item) => (
                            <SidebarNavItem
                                key={item.href}
                                item={item}
                                collapsed={sidebarCollapsed}
                                isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
                                isExpanded={expandedItems.includes(item.href)}
                                onToggleExpand={() => toggleExpand(item.href)}
                                pathname={pathname}
                                onNavigate={() => setMobileSidebarOpen(false)}
                            />
                        ))}
                    </div>
                ))}
            </nav>

            {/* Collapse Toggle + Sign Out */}
            <div className={`border-t border-neutral-200/40 dark:border-zinc-800/40 ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
                {/* Collapse button - desktop only */}
                <button
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    className="hidden lg:flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-neutral-100/50 dark:hover:bg-zinc-800/50 transition-all text-neutral-500 dark:text-neutral-400 group cursor-pointer mb-1"
                >
                    <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-neutral-200 dark:group-hover:bg-zinc-700 transition-colors">
                        {sidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
                    </div>
                    {!sidebarCollapsed && <span className="text-sm font-semibold">Collapse</span>}
                </button>

                <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-all text-neutral-600 dark:text-neutral-300 hover:text-red-600 dark:hover:text-red-400 group cursor-pointer"
                >
                    <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-red-50 dark:group-hover:bg-red-950/30 transition-colors">
                        <LogOut size={15} className="group-hover:text-red-500 transition-colors" />
                    </div>
                    {!sidebarCollapsed && <span className="text-sm font-semibold transition-colors">Sign Out</span>}
                </button>
            </div>
        </>
    );

    return (
        <>
            {/* Desktop Sidebar */}
            <motion.aside
                animate={{ width: sidebarCollapsed ? 80 : 280 }}
                transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
                className="hidden lg:flex flex-col h-screen border-r border-neutral-200/50 dark:border-zinc-800/40 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl shadow-[2px_0_20px_rgba(0,0,0,0.015)] z-40 overflow-hidden"
            >
                {sidebarContent}
            </motion.aside>

            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {mobileSidebarOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="lg:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
                            onClick={() => setMobileSidebarOpen(false)}
                        />
                        <motion.aside
                            initial={{ x: -300 }}
                            animate={{ x: 0 }}
                            exit={{ x: -300 }}
                            transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
                            className="lg:hidden fixed left-0 top-0 h-screen w-[280px] flex flex-col bg-white dark:bg-zinc-900 shadow-2xl z-50"
                        >
                            {/* Mobile Close Button */}
                            <button
                                onClick={() => setMobileSidebarOpen(false)}
                                className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-neutral-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-zinc-700 transition-colors z-10 cursor-pointer"
                            >
                                <X size={16} className="text-neutral-500" />
                            </button>
                            {sidebarContent}
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}

function SidebarNavItem({ 
    item, collapsed, isActive, isExpanded, onToggleExpand, pathname, onNavigate 
}: { 
    item: NavItemDef; collapsed: boolean; isActive: boolean; isExpanded: boolean; 
    onToggleExpand: () => void; pathname: string; onNavigate: () => void;
}) {
    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;
    const router = useRouter();

    const handleClick = (e: React.MouseEvent) => {
        if (hasChildren && !collapsed) {
            e.preventDefault();
            onToggleExpand();
        } else {
            onNavigate();
        }
    };

    if (collapsed) {
        return (
            <Link
                href={item.href}
                prefetch={true}
                title={item.label}
                onClick={onNavigate}
                className={`
                    relative flex items-center justify-center w-full py-2.5 rounded-xl transition-all group cursor-pointer
                    ${isActive
                        ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/20'
                        : 'text-neutral-500 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-neutral-50 dark:hover:bg-zinc-800/50'
                    }
                `}
            >
                <Icon size={18} strokeWidth={2.3} />
            </Link>
        );
    }

    return (
        <div>
            <Link
                href={hasChildren ? '#' : item.href}
                prefetch={!hasChildren}
                onClick={handleClick}
                onMouseEnter={() => {
                    if (!hasChildren) {
                        try { router.prefetch(item.href); } catch {}
                    }
                }}
                className={`
                    relative flex items-center gap-3 w-full px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 group cursor-pointer
                    ${isActive && !hasChildren
                        ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/15'
                        : isActive && hasChildren
                        ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
                        : 'text-neutral-600 dark:text-neutral-350 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-neutral-50 dark:hover:bg-zinc-900/40'
                    }
                `}
            >
                <Icon
                    size={18}
                    strokeWidth={2.3}
                    className={`transition-transform duration-200 ${
                        isActive && !hasChildren
                            ? 'text-white scale-110'
                            : isActive && hasChildren
                            ? 'text-indigo-500'
                            : 'text-neutral-500 dark:text-neutral-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400'
                    }`}
                />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500/10 text-red-500 border border-red-500/20">
                        {item.badge}
                    </span>
                )}
                {hasChildren && (
                    <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <ChevronDown size={14} className={isActive ? 'text-indigo-400' : 'text-neutral-400'} />
                    </motion.div>
                )}
                {!isActive && !hasChildren && (
                    <div className="absolute right-4 w-1.5 h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
            </Link>

            {/* Sub-items */}
            <AnimatePresence>
                {hasChildren && isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="pl-11 pr-2 py-1 space-y-0.5">
                            {item.children!.map((child) => {
                                const isChildActive = pathname === child.href;
                                return (
                                    <Link
                                        key={child.href}
                                        href={child.href}
                                        prefetch={true}
                                        onClick={onNavigate}
                                        className={`
                                            block px-3 py-2 text-[13px] font-medium rounded-lg transition-all cursor-pointer
                                            ${isChildActive
                                                ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/20 font-semibold'
                                                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-zinc-800/50'
                                            }
                                        `}
                                    >
                                        {child.label}
                                    </Link>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
