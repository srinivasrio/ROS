'use client';

import { useState, useEffect, useRef } from 'react';
import { LayoutDashboard as LucideLayoutDashboard, Utensils as LucideUtensils, Table as LucideTable, FileText as LucideFileText, Users as LucideUsers, Settings as LucideSettings, LogOut as LucideLogOut, UserCheck as LucideUserCheck, Ticket as LucideTicket, BarChart as LucideBarChart, ChevronDown as LucideChevronDown, Plus as LucidePlus, Home as LucideHome, CreditCard as LucideCreditCard, ArrowLeftRight as LucideArrowLeftRight, Box as LucideBox, ClipboardList as LucideClipboardList, HandHelping as LucideHandHelping, Info as LucideInfo, Truck as LucideTruck, ShoppingBag as LucideShoppingBag, Lock as LucideLock } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname, useRouter, useParams } from 'next/navigation';
import { UserService } from '@/services/users.service';
import { clearRestaurantIdCache } from '@/hooks/useRestaurantId';
import { clearAllCache, markAppHydrated, rehydrateCacheFromStorage, getCached, setCache, hasFreshCache, adminCacheManager, adminPreloadManager } from '@/lib/data-cache';
import { RestaurantService } from '@/services/restaurant.service';
import AdminOrderNotificationPopup from '@/components/admin/AdminOrderNotificationPopup';
import { AdminUpgradeModalProvider, useAdminUpgradeModal } from '@/context/AdminUpgradeModalContext';
import { SyncIndicator } from '@/components/admin/SyncIndicator';

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
            window.location.href = '/login';
        } catch (error) {
            console.error('Sign out failed:', error);
            window.location.href = '/login';
        }
    };

    const mainNavItems = [
        { href: `/${restaurantCode}/admin/dashboard`, icon: LucideHome, label: 'Dashboard', sectionKey: 'dashboard' },
        { href: `/${restaurantCode}/admin/orders`, icon: LucideShoppingBag, label: 'Live Orders', sectionKey: 'orders' },
        { href: `/${restaurantCode}/admin/homepage-builder`, icon: LucideLayoutDashboard, label: 'Homepage Builder', sectionKey: 'homepage-builder' },
        { href: `/${restaurantCode}/admin/live-kitchen`, icon: LucideUtensils, label: 'Live Kitchen', sectionKey: 'tables' },
        { href: `/${restaurantCode}/admin/tables`, icon: LucideTable, label: 'Tables', sectionKey: 'tables' },
        { href: `/${restaurantCode}/admin/history`, icon: LucideFileText, label: 'Order History', sectionKey: 'history' },
        { href: `/${restaurantCode}/admin/customers`, icon: LucideUsers, label: 'Customers', sectionKey: 'customers' },
        { href: `/${restaurantCode}/admin/menu`, icon: LucideBox, label: 'Menu Management', sectionKey: 'menu' },
        { href: `/${restaurantCode}/admin/services`, icon: LucideHandHelping, label: 'Services', sectionKey: 'services' },
        { href: `/${restaurantCode}/admin/inventory`, icon: LucideClipboardList, label: 'Inventory', featureKey: 'inventory', sectionKey: 'inventory' },
        { href: `/${restaurantCode}/admin/delivery`, icon: LucideTruck, label: 'Delivery', featureKey: 'delivery', sectionKey: 'delivery' },
        { href: `/${restaurantCode}/admin/analytics`, icon: LucideBarChart, label: 'Analytics', featureKey: 'advanced_reports', sectionKey: 'analytics' },
        { href: `/${restaurantCode}/admin/about`, icon: LucideInfo, label: 'Restaurant Profile', sectionKey: 'about' },
        { href: `/${restaurantCode}/admin/staff`, icon: LucideUserCheck, label: 'Staff and payroll', sectionKey: 'staff' },
        { href: `/${restaurantCode}/admin/offers`, icon: LucideTicket, label: 'Coupons and Offers', sectionKey: 'offers' },
        { href: `/${restaurantCode}/admin/settings`, icon: LucideSettings, label: 'Settings', sectionKey: 'settings' },

    ];

    const [plan, setPlan] = useState<string>('Standard');
    const [restaurantName, setRestaurantName] = useState<string>('');
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [logoError, setLogoError] = useState(false);
    const [features, setFeatures] = useState<Record<string, boolean>>({});
    const [tenantId, setTenantId] = useState<string>(restaurantCode);

    // Rehydrate persistent device cache into L1 memory cache immediately upon hydration
    useEffect(() => {
        markAppHydrated();
        rehydrateCacheFromStorage();
        if (restaurantCode) {
            adminCacheManager.init(restaurantCode);
        }
    }, [restaurantCode]);

    useEffect(() => {
        if (!restaurantCode) return;

        const brandKey = `brand-${restaurantCode}`;
        // Check if cached brand exists in L1 memory or rehydrated from storage
        const cached = getCached<{ name: string; logoUrl: string | null; subscriptionPlan: string; features?: Record<string, boolean> }>(brandKey);
        if (cached) {
            if (cached.name && cached.name !== 'Restaurant OS') setRestaurantName(cached.name);
            if (cached.logoUrl !== undefined) {
                setLogoUrl(cached.logoUrl);
                setLogoError(false);
            }
            if (cached.subscriptionPlan) setPlan(cached.subscriptionPlan);
            if (cached.features) setFeatures(cached.features);
        }

        // 1. Fetch restaurant plan and entitlements
        fetch(`/api/restaurant/${restaurantCode}/plan`)
            .then(res => res.json())
            .then(data => {
                if (data.name && data.name !== 'Restaurant OS') setRestaurantName(data.name);
                if (data.logoUrl !== undefined) {
                    setLogoUrl(data.logoUrl);
                    setLogoError(false);
                }
                if (data.subscriptionPlan) {
                    setPlan(data.subscriptionPlan);
                }
                if (data.features) {
                    setFeatures(data.features);
                }
                if (data.name && data.name !== 'Restaurant OS') {
                    setCache(brandKey, {
                        name: data.name,
                        logoUrl: data.logoUrl || null,
                        subscriptionPlan: data.subscriptionPlan || 'Standard',
                        features: data.features || {}
                    });
                }
            })
            .catch(() => {});

        // 2. Prefetch only unlocked route JavaScript bundles
        mainNavItems.forEach((item) => {
            const isItemLocked = item.featureKey ? features[item.featureKey] === false : false;
            if (!isItemLocked) {
                try {
                    router.prefetch(item.href);
                } catch (_) {}
            }
        });

        // 3. Resolve canonical tenant ID and start background preloading queue
        let isMounted = true;
        const initPreload = async () => {
            try {
                const resolvedId = await RestaurantService.resolveRestaurantId(restaurantCode);
                if (!isMounted) return;
                const activeId = resolvedId || restaurantCode;
                setTenantId(activeId);
                adminCacheManager.setTenant(activeId);
                adminPreloadManager.startPreload(activeId, restaurantCode, pathname);
            } catch (err) {
                if (isMounted) {
                    setTenantId(restaurantCode);
                    adminPreloadManager.startPreload(restaurantCode, restaurantCode, pathname);
                }
            }
        };

        const timer = setTimeout(initPreload, 60);

        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, [restaurantCode, pathname]);

    const [sidebarHovered, setSidebarHovered] = useState(false);
    const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
        }
        setSidebarHovered(true);
    };

    const handleMouseLeave = () => {
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = setTimeout(() => {
            setSidebarHovered(false);
        }, 90);
    };

    useEffect(() => {
        return () => {
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        };
    }, []);

    return (
        <AdminUpgradeModalProvider restaurantCode={restaurantCode} currentPlanName={plan}>
            <div className="flex h-screen bg-[#FAFAFC] dark:bg-zinc-950 font-sans text-black dark:text-white overflow-hidden">
                {/* Desktop Sidebar: Fixed 64px layout slot so main section never shifts, with floating overlay on hover */}
                <div className="w-[64px] h-screen flex-shrink-0 relative z-50">
                    <motion.aside 
                        initial={false}
                        animate={{ width: sidebarHovered ? 272 : 64 }}
                        transition={{ 
                            type: "tween",
                            duration: 0.22, 
                            ease: [0.16, 1, 0.3, 1] 
                        }}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        className={`absolute top-0 left-0 h-screen border-r border-neutral-200/50 dark:border-zinc-800/40 flex flex-col bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl overflow-hidden select-none will-change-[width] transition-shadow duration-200 ${
                            sidebarHovered ? 'shadow-[8px_0_30px_rgba(0,0,0,0.12)] dark:shadow-[8px_0_30px_rgba(0,0,0,0.5)]' : 'shadow-[2px_0_10px_rgba(0,0,0,0.02)]'
                        }`}
                    >
                        <div className="w-[272px] flex flex-col h-full overflow-hidden select-none pt-3">
                            {/* Navigation Menu */}
                            <div className="flex-1 overflow-y-auto px-3 space-y-1.5 premium-scrollbar py-2">
                                {mainNavItems.map((item) => (
                                    <NavItem 
                                        key={item.href} 
                                        item={item} 
                                        isActive={pathname === item.href} 
                                        isLocked={item.featureKey ? features[item.featureKey] === false : false}
                                        restaurantId={tenantId}
                                        restaurantCode={restaurantCode}
                                        collapsed={!sidebarHovered}
                                    />
                                ))}
                            </div>

                            {/* Sign Out Footer */}
                            <div className="p-3 border-t border-neutral-200/40 dark:border-zinc-800/40 bg-neutral-50/20 dark:bg-zinc-950/20 backdrop-blur-sm">
                                <button 
                                    onClick={handleSignOut}
                                    title="Sign Out"
                                    className={`flex items-center h-10 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors text-neutral-600 dark:text-neutral-300 hover:text-red-600 dark:hover:text-red-400 group cursor-pointer shrink-0 ${
                                        !sidebarHovered ? 'w-10 h-10 justify-center rounded-xl' : 'w-full px-1 justify-start rounded-xl'
                                    }`}
                                >
                                    <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 group-hover:bg-red-50 dark:group-hover:bg-red-950/30 transition-colors">
                                        <LucideLogOut size={16} className="group-hover:text-red-500 transition-colors" />
                                    </div>
                                    <div className={`ml-2.5 flex-1 min-w-0 text-left transition-all duration-200 ease-out ${
                                        sidebarHovered ? 'opacity-100 max-w-[180px] translate-x-0' : 'opacity-0 max-w-0 -translate-x-2 pointer-events-none'
                                    }`}>
                                        <span className="text-xs font-semibold whitespace-nowrap">Sign Out</span>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </motion.aside>
                </div>

                {/* Main Content with Top Header Bar */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    {/* Top Header: Restaurant Details ALWAYS VISIBLE */}
                    <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-neutral-200/50 dark:border-zinc-800/40 px-6 flex items-center justify-between shrink-0">
                        {/* Restaurant Details: Logo + Name + Admin Badge + Subscription Plan */}
                        <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center bg-neutral-100 dark:bg-zinc-800 text-neutral-800 dark:text-neutral-200 shadow-sm font-black border border-neutral-200/60">
                                {logoUrl && !logoError ? (
                                    <img
                                        src={logoUrl}
                                        alt={restaurantName || 'Restaurant Logo'}
                                        className="w-full h-full object-cover"
                                        onError={() => setLogoError(true)}
                                    />
                                ) : restaurantName ? (
                                    <span 
                                        suppressHydrationWarning
                                        className="text-base font-black tracking-wider uppercase text-neutral-800 dark:text-neutral-200"
                                    >
                                        {restaurantName.charAt(0).toUpperCase()}
                                    </span>
                                ) : (
                                    <div className="w-full h-full bg-neutral-200/70 dark:bg-zinc-700/50 animate-pulse" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    {restaurantName ? (
                                        <h1 
                                            suppressHydrationWarning
                                            title={restaurantName}
                                            className="text-base font-black tracking-tight text-neutral-900 dark:text-white truncate"
                                        >
                                            {restaurantName}
                                        </h1>
                                    ) : (
                                        <div className="h-4 w-32 bg-neutral-200/70 dark:bg-zinc-700/50 rounded animate-pulse" />
                                    )}
                                    <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-zinc-800 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                                        Admin
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[11px] text-neutral-400 font-semibold tracking-wide">
                                        Code: <span className="font-mono text-neutral-600 dark:text-neutral-300 font-bold">{restaurantCode}</span>
                                    </span>
                                    {plan && (
                                        <>
                                            <span className="text-neutral-300 dark:text-zinc-700">•</span>
                                            <span 
                                                suppressHydrationWarning
                                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/25 text-[10px] font-black uppercase text-orange-600 dark:text-orange-400 tracking-wider shadow-xs"
                                            >
                                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                                {plan} Plan
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right: Sync Indicator */}
                        <div className="flex items-center gap-3">
                            <SyncIndicator />
                        </div>
                    </header>

                    {/* Page Content */}
                    <main className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth bg-[#FAFAFC] dark:bg-zinc-950">
                        {/* Background Decor */}
                        <div className="absolute top-0 right-0 w-[550px] h-[550px] bg-purple-200/20 dark:bg-purple-900/10 blur-[130px] rounded-full -mr-64 -mt-64 z-0 pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-[450px] h-[450px] bg-rose-200/20 dark:bg-rose-900/10 blur-[110px] rounded-full -ml-32 -mb-32 z-0 pointer-events-none" />
                        <div className="absolute top-1/2 left-1/3 w-[300px] h-[300px] bg-amber-200/15 dark:bg-amber-900/5 blur-[90px] rounded-full z-0 pointer-events-none" />
                        
                        <div className="relative z-10 min-h-full">
                            {children}
                        </div>
                    </main>
                </div>

                {/* Instant New-Order Notification Popup (Takeaway & Delivery) */}
                <AdminOrderNotificationPopup restaurantCode={restaurantCode} />
            </div>
        </AdminUpgradeModalProvider>
    );
}

function NavItem({ 
    item, 
    isActive, 
    isLocked = false,
    restaurantId,
    restaurantCode,
    collapsed = false,
    highlightColor = 'bg-gradient-to-r from-orange-500 to-[#FF6B6B]' 
}: { 
    item: any, 
    isActive: boolean, 
    isLocked?: boolean,
    restaurantId?: string,
    restaurantCode?: string,
    collapsed?: boolean,
    highlightColor?: string 
}) {
    const Icon = item.icon;
    const router = useRouter();
    const { openUpgradeModal } = useAdminUpgradeModal();
    const preloadTimerRef = useRef<NodeJS.Timeout | null>(null);

    const handleClick = (e: React.MouseEvent) => {
        if (isLocked) {
            e.preventDefault();
            e.stopPropagation();
            const modalFeature = item.featureKey === 'advanced_reports' || item.featureKey === 'advanced_analytics' 
                ? 'analytics' 
                : (item.featureKey || 'delivery');
            openUpgradeModal(modalFeature);
        }
    };

    const handleMouseEnter = () => {
        if (!isLocked) {
            try {
                router.prefetch(item.href);
            } catch (_) {}
            if (item.sectionKey && restaurantId) {
                if (preloadTimerRef.current) clearTimeout(preloadTimerRef.current);
                preloadTimerRef.current = setTimeout(() => {
                    adminPreloadManager.preloadSection(item.sectionKey, restaurantId, restaurantCode);
                }, 120);
            }
        }
    };

    const handleMouseLeave = () => {
        if (preloadTimerRef.current) {
            clearTimeout(preloadTimerRef.current);
            preloadTimerRef.current = null;
        }
    };

    return (
        <Link
            href={item.href}
            prefetch={!isLocked}
            onClick={handleClick}
            title={item.label}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`
                relative flex items-center h-10 transition-all duration-150 group cursor-pointer shrink-0
                ${collapsed ? 'w-10 h-10 justify-center rounded-xl' : 'w-full px-1 rounded-xl justify-start'}
                ${isActive
                    ? `text-white shadow-md shadow-orange-500/20 ${highlightColor}`
                    : isLocked
                    ? 'text-neutral-400 dark:text-neutral-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50/40 dark:hover:bg-amber-950/20'
                    : 'text-neutral-600 dark:text-neutral-350 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-neutral-100/70 dark:hover:bg-zinc-800/50'
                }
            `}
        >
            {/* Stationary Centered Icon Container */}
            <div className="w-8 h-8 flex items-center justify-center shrink-0">
                <Icon 
                    size={18} 
                    className={`transition-transform duration-150 ${
                        isActive 
                            ? 'text-white scale-105' 
                            : isLocked 
                            ? 'text-neutral-400 dark:text-neutral-500 group-hover:text-amber-500' 
                            : 'text-neutral-500 dark:text-neutral-400 group-hover:text-orange-500 dark:group-hover:text-orange-400'
                    }`} 
                    strokeWidth={2.3} 
                />
            </div>

            {/* Smooth Label Reveal without Unmounting */}
            <div className={`
                ml-2.5 flex-1 min-w-0 flex items-center justify-between transition-all duration-200 ease-out overflow-hidden
                ${!collapsed ? 'opacity-100 max-w-[190px] translate-x-0' : 'opacity-0 max-w-0 -translate-x-2 pointer-events-none'}
            `}>
                <span className="text-xs font-semibold whitespace-nowrap truncate">{item.label}</span>

                {isLocked && !isActive && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-[9px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider shrink-0 ml-1.5">
                        <LucideLock size={10} />
                        <span>Lock</span>
                    </div>
                )}

                {!isActive && !isLocked && (
                    <div className={`w-1.5 h-1.5 rounded-full ${highlightColor} opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1.5`} />
                )}
            </div>
        </Link>
    );
}
