'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useOwner } from '@/context/OwnerContext';
import {
    LayoutDashboard, Building2, Users, UtensilsCrossed, ShoppingBag,
    Table2, Monitor, UserCircle, BarChart3, CreditCard, Settings,
    LogOut, ChevronDown, X
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
        restaurant, mobileSidebarOpen, setMobileSidebarOpen 
    } = useOwner();
    const [expandedItems, setExpandedItems] = useState<string[]>([]);
    const [isHovered, setIsHovered] = useState(false);
    const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
        }
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = setTimeout(() => {
            setIsHovered(false);
        }, 90);
    };

    useEffect(() => {
        return () => {
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        };
    }, []);

    const toggleExpand = (href: string) => {
        setExpandedItems(prev => 
            prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href]
        );
    };

    const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

    const handleSignOut = async () => {
        try {
            const { UserService } = await import('@/services/users.service');
            await UserService.signOut();
            window.location.href = '/login';
        } catch {
            window.location.href = '/login';
        }
    };

    const renderSidebarContent = (isExpanded: boolean) => (
        <div className="w-[272px] flex flex-col h-full overflow-hidden select-none pt-3">
            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto premium-scrollbar px-3 pb-4 space-y-3">
                {NAV_SECTIONS.map((section, sIdx) => (
                    <div key={sIdx} className="space-y-1">
                        {section.title && (
                            <div className="pt-2 pb-1 px-1">
                                <div className={`overflow-hidden transition-all duration-200 ease-out ${
                                    isExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'
                                }`}>
                                    <p className="text-[9px] font-black uppercase tracking-[0.15em] text-neutral-400/90 dark:text-neutral-500/90 whitespace-nowrap">
                                        {section.title}
                                    </p>
                                </div>
                                {!isExpanded && (
                                    <div className="w-10 flex justify-center my-1.5">
                                        <div className="w-5 h-px bg-neutral-200/80 dark:bg-zinc-800" />
                                    </div>
                                )}
                            </div>
                        )}
                        {section.items.map((item) => (
                            <SidebarNavItem
                                key={item.href}
                                item={item}
                                isHovered={isExpanded}
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

            {/* Sign Out */}
            <div className="p-3 border-t border-neutral-200/40 dark:border-zinc-800/40">
                <button
                    onClick={() => setShowSignOutConfirm(true)}
                    title="Sign Out"
                    className={`flex items-center h-10 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors text-neutral-600 dark:text-neutral-300 hover:text-red-600 dark:hover:text-red-400 group cursor-pointer shrink-0 ${
                        !isExpanded ? 'w-10 h-10 justify-center rounded-xl' : 'w-full px-1 justify-start rounded-xl'
                    }`}
                >
                    <div className="w-8 h-8 flex items-center justify-center shrink-0 rounded-lg bg-neutral-100 dark:bg-zinc-800 group-hover:bg-red-50 dark:group-hover:bg-red-950/30 transition-colors">
                        <LogOut size={15} className="group-hover:text-red-500 transition-colors" />
                    </div>
                    <div className={`ml-2.5 flex-1 min-w-0 text-left transition-all duration-200 ease-out ${
                        isExpanded ? 'opacity-100 max-w-[170px] translate-x-0' : 'opacity-0 max-w-0 -translate-x-2 pointer-events-none'
                    }`}>
                        <span className="text-xs font-semibold whitespace-nowrap">Sign Out</span>
                    </div>
                </button>
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop Sidebar: Fixed 64px layout slot so main section never shifts, with floating overlay on hover */}
            <div className="hidden lg:block w-[64px] h-screen flex-shrink-0 relative z-40">
                <motion.aside
                    initial={false}
                    animate={{ width: isHovered ? 272 : 64 }}
                    transition={{
                        type: "tween",
                        duration: 0.22,
                        ease: [0.16, 1, 0.3, 1]
                    }}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    className={`absolute top-0 left-0 h-screen flex flex-col border-r border-neutral-200/50 dark:border-zinc-800/40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl overflow-hidden select-none will-change-[width] transition-shadow duration-200 ${
                        isHovered ? 'shadow-[8px_0_30px_rgba(0,0,0,0.12)] dark:shadow-[8px_0_30px_rgba(0,0,0,0.5)]' : 'shadow-[2px_0_10px_rgba(0,0,0,0.02)]'
                    }`}
                >
                    {renderSidebarContent(isHovered)}
                </motion.aside>
            </div>

            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {mobileSidebarOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="lg:hidden fixed inset-0 bg-black/30 backdrop-blur-xs z-40"
                            onClick={() => setMobileSidebarOpen(false)}
                        />
                        <motion.aside
                            initial={{ x: -280 }}
                            animate={{ x: 0 }}
                            exit={{ x: -280 }}
                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            className="lg:hidden fixed left-0 top-0 h-screen w-[260px] flex flex-col bg-white dark:bg-zinc-900 shadow-2xl z-50 overflow-hidden"
                        >
                            {/* Mobile Close Button */}
                            <button
                                onClick={() => setMobileSidebarOpen(false)}
                                className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-neutral-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-zinc-700 transition-colors z-10 cursor-pointer"
                            >
                                <X size={16} className="text-neutral-500" />
                            </button>
                            {renderSidebarContent(true)}
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* Logout Confirmation Modal */}
            <AnimatePresence>
                {showSignOutConfirm && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-neutral-200/80 dark:border-zinc-800 text-center space-y-4"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-500 mx-auto flex items-center justify-center">
                                <LogOut size={22} />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-neutral-900 dark:text-white">
                                    Sign Out of Owner Panel?
                                </h3>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                    Are you sure you want to log out? You will need to sign in again to access the restaurant management tools.
                                </p>
                            </div>
                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    onClick={() => setShowSignOutConfirm(false)}
                                    className="flex-1 py-2.5 rounded-xl border border-neutral-200 dark:border-zinc-700 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        setShowSignOutConfirm(false);
                                        handleSignOut();
                                    }}
                                    className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-600/20 transition cursor-pointer"
                                >
                                    Yes, Sign Out
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}

function SidebarNavItem({ 
    item, isHovered, isActive, isExpanded, onToggleExpand, pathname, onNavigate 
}: { 
    item: NavItemDef; isHovered: boolean; isActive: boolean; isExpanded: boolean; 
    onToggleExpand: () => void; pathname: string; onNavigate: () => void;
}) {
    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;
    const router = useRouter();

    const handleClick = (e: React.MouseEvent) => {
        if (hasChildren && isHovered) {
            e.preventDefault();
            onToggleExpand();
        } else {
            onNavigate();
        }
    };

    return (
        <div className="relative">
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
                    relative flex items-center h-10 transition-all duration-150 group cursor-pointer shrink-0
                    ${!isHovered ? 'w-10 h-10 justify-center rounded-xl' : 'w-full px-1 rounded-xl justify-start'}
                    ${isActive && !hasChildren
                        ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20'
                        : isActive && hasChildren
                        ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
                        : 'text-neutral-600 dark:text-neutral-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-neutral-100/70 dark:hover:bg-zinc-800/50'
                    }
                `}
            >
                {/* Stationary Centered Icon Container */}
                <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    <Icon
                        size={18}
                        strokeWidth={2.3}
                        className={`transition-transform duration-150 ${
                            isActive && !hasChildren
                                ? 'text-white scale-105'
                                : isActive && hasChildren
                                ? 'text-indigo-500'
                                : 'text-neutral-500 dark:text-neutral-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400'
                        }`}
                    />
                </div>

                {/* Smooth Label Reveal */}
                <div className={`
                    ml-2.5 flex-1 min-w-0 flex items-center justify-between transition-all duration-200 ease-out overflow-hidden
                    ${isHovered ? 'opacity-100 max-w-[190px] translate-x-0' : 'opacity-0 max-w-0 -translate-x-2 pointer-events-none'}
                `}>
                    <span className="text-xs font-semibold whitespace-nowrap truncate">{item.label}</span>
                    {item.badge && (
                        <span className="ml-2 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-red-500/10 text-red-500 border border-red-500/20 shrink-0">
                            {item.badge}
                        </span>
                    )}
                    {hasChildren && (
                        <ChevronDown 
                            size={13} 
                            className={`ml-1.5 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} ${isActive ? 'text-indigo-400' : 'text-neutral-400'}`} 
                        />
                    )}
                </div>
            </Link>

            {/* Sub-items (only when expanded & hovered) */}
            <AnimatePresence>
                {hasChildren && isExpanded && isHovered && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden pl-11 pr-2 py-1 space-y-0.5"
                    >
                        {item.children!.map((child) => {
                            const isChildActive = pathname === child.href;
                            return (
                                <Link
                                    key={child.href}
                                    href={child.href}
                                    prefetch={true}
                                    onClick={onNavigate}
                                    className={`
                                        block px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer truncate
                                        ${isChildActive
                                            ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/20 font-semibold'
                                            : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100/50 dark:hover:bg-zinc-800/40'
                                        }
                                    `}
                                >
                                    {child.label}
                                </Link>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
