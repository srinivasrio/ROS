'use client';

import { LucideLayoutDashboard, LucideUtensils, LucideTable, LucideFileText, LucideUsers, LucideSettings, LucideLogOut, LucideUserCheck, LucideTicket, LucideBarChart, LucideChevronDown, LucidePlus, LucideHome, LucideCreditCard, LucideArrowLeftRight, LucideBox } from 'lucide-react';
import { motion, LayoutGroup } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    const mainNavItems = [
        { href: '/admin/dashboard', icon: LucideHome, label: 'Dashboard' },
        { href: '/admin/live-kitchen', icon: LucideUtensils, label: 'Live Kitchen' },
        { href: '/admin/tables', icon: LucideTable, label: 'Tables' },
        { href: '/admin/history', icon: LucideFileText, label: 'Order History' },
        { href: '/admin/customers', icon: LucideUsers, label: 'Customers' },
        { href: '/admin/menu', icon: LucideBox, label: 'Menu Management' },
    ];

    const shortcutItems = [
        { href: '/admin/staff', icon: LucideUserCheck, label: 'Staff' },
        { href: '/admin/offers', icon: LucideTicket, label: 'Offers & Discounts' },
    ];

    const productItems = [
        { href: '/admin/analytics', icon: LucideBarChart, label: 'Analytics' },
        { href: '/admin/settings', icon: LucideSettings, label: 'Settings' },
    ];

    return (
        <div className="flex h-screen bg-white font-sans text-neutral-900">
            {/* Sidebar */}
            <aside className="w-64 border-r border-neutral-100 flex flex-col bg-white">
                <div className="p-6">
                    <div className="flex items-center gap-2 cursor-pointer hover:bg-neutral-50 p-2 -mx-2 rounded-lg transition-colors">
                        <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white">
                            <span className="font-bold text-xs">AI</span>
                        </div>
                        <span className="font-semibold text-sm">Restaurant OS</span>
                        <LucideChevronDown size={14} className="text-neutral-400 ml-auto" />
                    </div>
                </div>

                {/* Combined Navigation */}
                <LayoutGroup>
                    <div className="space-y-0.5 px-3">
                        {[...mainNavItems, ...shortcutItems, ...productItems].map((item) => {
                            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                            return (
                                <NavItem key={item.href} item={item} isActive={isActive} />
                            );
                        })}
                    </div>
                </LayoutGroup>

                <div className="p-4 border-t border-neutral-100">
                    <button className="flex items-center gap-3 w-full px-2 py-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
                        <div className="w-6 h-6 rounded-full bg-neutral-100 flex items-center justify-center">
                            <span className="text-xs font-bold text-neutral-500">...</span>
                        </div>
                        <span>More</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto bg-white">
                <div className="h-full">
                    {children}
                </div>
            </main>
        </div>
    );
}

function NavItem({ item, isActive }: { item: any, isActive: boolean }) {
    const Icon = item.icon;
    return (
        <Link
            href={item.href}
            className={`
                relative flex items-center gap-3 px-2 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ease-in-out group
                hover:bg-blue-50 active:bg-blue-600 active:text-white
                ${isActive
                    ? 'text-white'
                    : 'text-neutral-500 hover:text-blue-700'
                }
            `}
        >
            {isActive && (
                <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 bg-blue-600 rounded-lg shadow-md shadow-blue-600/20"
                    initial={false}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
            )}
            <Icon size={18} className={`relative z-10 transition-colors ${isActive ? 'text-white' : 'text-neutral-400 group-hover:text-blue-600 group-active:text-white'}`} strokeWidth={2} />
            <span className="relative z-10">{item.label}</span>
        </Link>
    );
}
