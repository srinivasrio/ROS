'use client';

import { LayoutDashboard as LucideLayoutDashboard, Utensils as LucideUtensils, Table as LucideTable, FileText as LucideFileText, Users as LucideUsers, Settings as LucideSettings, LogOut as LucideLogOut, UserCheck as LucideUserCheck, Ticket as LucideTicket, BarChart as LucideBarChart, ChevronDown as LucideChevronDown, Plus as LucidePlus, Home as LucideHome, CreditCard as LucideCreditCard, ArrowLeftRight as LucideArrowLeftRight, Box as LucideBox, ClipboardList as LucideClipboardList, HandHelping as LucideHandHelping, Info as LucideInfo, Star as LucideStar } from 'lucide-react';
import { motion, LayoutGroup } from 'framer-motion';
import Link from 'next/link';
import { usePathname, useRouter, useParams } from 'next/navigation';
import { UserService } from '@/app/services/users';
import { clearRestaurantIdCache } from '@/app/hooks/useRestaurantId';
import { clearAllCache } from '@/app/lib/data-cache';


export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const params = useParams();
    const restaurantCode = params.restaurantCode as string;

    const handleSignOut = async () => {
        try {
            clearRestaurantIdCache();
            clearAllCache();
            await UserService.signOut();
            router.push('/');
        } catch (error) {
            console.error('Sign out failed:', error);
        }
    };

    const mainNavItems = [
        { href: `/${restaurantCode}/admin/dashboard`, icon: LucideHome, label: 'Dashboard' },
        { href: `/${restaurantCode}/admin/homepage-builder`, icon: LucideLayoutDashboard, label: 'Homepage Builder' },
        { href: `/${restaurantCode}/admin/live-kitchen`, icon: LucideUtensils, label: 'Live Kitchen' },
        { href: `/${restaurantCode}/admin/tables`, icon: LucideTable, label: 'Tables' },
        { href: `/${restaurantCode}/admin/history`, icon: LucideFileText, label: 'Order History' },
        { href: `/${restaurantCode}/admin/customers`, icon: LucideUsers, label: 'Customers' },
        { href: `/${restaurantCode}/admin/menu`, icon: LucideBox, label: 'Menu Management' },
        { href: `/${restaurantCode}/admin/specials`, icon: LucideStar, label: 'Today Special' },
        { href: `/${restaurantCode}/admin/services`, icon: LucideHandHelping, label: 'Services' },
        { href: `/${restaurantCode}/admin/inventory`, icon: LucideClipboardList, label: 'Inventory' },
        { href: `/${restaurantCode}/admin/analytics`, icon: LucideBarChart, label: 'Analytics' },
        { href: `/${restaurantCode}/admin/about`, icon: LucideInfo, label: 'Restaurant Profile' },
        { href: `/${restaurantCode}/admin/staff`, icon: LucideUserCheck, label: 'Staff and payroll' },
        { href: `/${restaurantCode}/admin/offers`, icon: LucideTicket, label: 'Coupons and Offers' },
        { href: `/${restaurantCode}/admin/settings`, icon: LucideSettings, label: 'Settings' },
    ];

    return (
        <div className="flex h-screen bg-[#FDFCFD] font-sans text-black overflow-hidden">
            {/* Sidebar */}
            <aside className="w-72 border-r border-neutral-100 flex flex-col bg-white shadow-[1px_0_10px_rgba(0,0,0,0.02)] z-50">
                <div className="flex-1 overflow-y-auto px-4 space-y-8 scrollbar-hide pt-8 pb-2">
                    {/* General Section */}
                    <div>
                        <LayoutGroup id="main-nav">
                            <div className="space-y-1">
                                {mainNavItems.map((item) => (
                                    <NavItem key={item.href} item={item} isActive={pathname === item.href} />
                                ))}
                            </div>
                        </LayoutGroup>
                    </div>
                </div>

                <div className="p-6 border-t border-neutral-50 bg-neutral-50/30 backdrop-blur-sm">
                    <button 
                        onClick={handleSignOut}
                        className="flex items-center gap-4 w-full px-4 py-3 rounded-xl hover:bg-white hover:shadow-sm transition-all text-black hover:text-black group"
                    >
                        <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center group-hover:bg-purple-50 transition-colors">
                            <LucideLogOut size={16} className="group-hover:text-purple-600 transition-colors" />
                        </div>
                        <span className="text-sm font-semibold">Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth bg-[#FDFCFD]">
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-100/30 blur-[120px] rounded-full -mr-64 -mt-64 z-0 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-coral-100/20 blur-[100px] rounded-full -ml-32 -mb-32 z-0 pointer-events-none" />
                
                <div className="relative z-10 min-h-full">
                    {children}
                </div>
            </main>
        </div>
    );
}

function NavItem({ item, isActive, highlightColor = 'bg-[#FF6B6B]' }: { item: any, isActive: boolean, highlightColor?: string }) {
    const Icon = item.icon;
    return (
        <Link
            href={item.href}
            className={`
                relative flex items-center gap-3 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 ease-out group
                ${isActive
                    ? 'text-white shadow-lg'
                    : 'text-black hover:text-black hover:bg-neutral-50'
                }
            `}
        >
            {isActive && (
                <motion.div
                    layoutId="sidebar-active-pill"
                    className={`absolute inset-0 ${highlightColor} rounded-xl shadow-xl shadow-purple-500/10`}
                    initial={false}
                    transition={{ 
                        type: "spring", 
                        stiffness: 500, 
                        damping: 35,
                        mass: 0.8
                    }}
                />
            )}
            <Icon 
                size={18} 
                className={`relative z-10 transition-all duration-300 ${isActive ? 'text-white scale-110' : 'text-black group-hover:text-black'}`} 
                strokeWidth={2.5} 
            />
            <span className="relative z-10">{item.label}</span>
            {!isActive && (
                <div className={`absolute right-4 w-1 h-1 rounded-full ${highlightColor} opacity-0 group-hover:opacity-100 transition-opacity`} />
            )}
        </Link>
    );
}
