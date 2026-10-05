'use client';

import { useState, useEffect } from 'react';
import { LayoutDashboard as LucideLayoutDashboard, Utensils as LucideUtensils, Table as LucideTable, FileText as LucideFileText, Users as LucideUsers, Settings as LucideSettings, ShieldCheck as LucideShield, LogOut as LucideLogOut, UserCheck as LucideUserCheck, Ticket as LucideTicket, BarChart as LucideBarChart, ChevronDown as LucideChevronDown, Plus as LucidePlus, Home as LucideHome, CreditCard as LucideCreditCard, ArrowLeftRight as LucideArrowLeftRight, Box as LucideBox, ClipboardList as LucideClipboardList, HandHelping as LucideHandHelping, Info as LucideInfo, Truck as LucideTruck, ShoppingBag as LucideShoppingBag, Lock as LucideLock } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname, useRouter, useParams } from 'next/navigation';
import { UserService } from '@/services/users.service';
import { clearRestaurantIdCache } from '@/hooks/useRestaurantId';
import { clearAllCache, markAppHydrated, rehydrateCacheFromStorage, getCached, setCache, hasFreshCache, adminCacheManager, adminPreloadManager } from '@/lib/data-cache';
import { RestaurantService } from '@/services/restaurant.service';
import AdminOrderNotificationPopup from '@/components/admin/AdminOrderNotificationPopup';
import { AdminUpgradeModalProvider, useAdminUpgradeModal } from '@/context/AdminUpgradeModalContext';

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
        { href: `/${restaurantCode}/admin/security`, icon: LucideShield, label: 'Security Center', sectionKey: 'security' },
    ];

    const [plan, setPlan] = useState<string>('Standard');
    const [restaurantName, setRestaurantName] = useState<string>('Restaurant OS');
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
            if (cached.name) setRestaurantName(cached.name);
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
                if (data.name) setRestaurantName(data.name);
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
                setCache(brandKey, {
                    name: data.name || 'Restaurant OS',
                    logoUrl: data.logoUrl || null,
                    subscriptionPlan: data.subscriptionPlan || 'Standard',
                    features: data.features || {}
                });
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

    return (
        <AdminUpgradeModalProvider restaurantCode={restaurantCode} currentPlanName={plan}>
            <div className="flex h-screen bg-[#FAFAFC] dark:bg-zinc-950 font-sans text-black dark:text-white overflow-hidden">
                {/* Sidebar */}
                <aside className="w-72 border-r border-neutral-200/50 dark:border-zinc-800/40 flex flex-col bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl shadow-[2px_0_20px_rgba(0,0,0,0.015)] z-50">
                    {/* Brand Logo Header */}
                    <div className="p-6 pb-2">
                        <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-zinc-800/50 rounded-2xl border border-neutral-200/60 dark:border-zinc-700/40 transition-all shadow-sm">
                            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center bg-white text-neutral-800 shadow-sm font-black border border-neutral-200/60">
                                {logoUrl && !logoError ? (
                                    <img
                                        src={logoUrl}
                                        alt={restaurantName}
                                        className="w-full h-full object-cover"
                                        onError={() => setLogoError(true)}
                                    />
                                ) : (
                                    <span 
                                        suppressHydrationWarning
                                        className="text-base font-black tracking-wider uppercase"
                                    >
                                        {(restaurantName || 'R').charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 
                                    suppressHydrationWarning
                                    title={restaurantName}
                                    className="text-sm font-black tracking-tight text-neutral-900 dark:text-white truncate"
                                >
                                    {restaurantName}
                                </h2>
                                <div className="flex items-center justify-between mt-0.5 gap-2">
                                    <p className="text-[10px] text-neutral-400 font-bold tracking-widest uppercase">Admin</p>
                                    <span 
                                        suppressHydrationWarning
                                        className="px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-[9px] font-black uppercase text-orange-500 tracking-wider flex-shrink-0"
                                    >
                                        {plan}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 space-y-8 premium-scrollbar pt-4 pb-2">
                        {/* General Section */}
                        <div className="space-y-1">
                            {mainNavItems.map((item) => (
                                <NavItem 
                                    key={item.href} 
                                    item={item} 
                                    isActive={pathname === item.href} 
                                    isLocked={item.featureKey ? features[item.featureKey] === false : false}
                                    restaurantId={tenantId}
                                    restaurantCode={restaurantCode}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="p-6 border-t border-neutral-200/40 dark:border-zinc-800/40 bg-neutral-50/20 dark:bg-zinc-950/20 backdrop-blur-sm">
                        <button 
                            onClick={handleSignOut}
                            className="flex items-center gap-4 w-full px-4 py-3 rounded-xl hover:bg-neutral-100/50 dark:hover:bg-zinc-800/50 transition-all text-neutral-600 dark:text-neutral-300 hover:text-red-600 dark:hover:text-red-400 group cursor-pointer"
                        >
                            <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-red-50 dark:group-hover:bg-red-950/30 transition-colors">
                                <LucideLogOut size={16} className="group-hover:text-red-500 transition-colors" />
                            </div>
                            <span className="text-sm font-semibold transition-colors">Sign Out</span>
                        </button>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth bg-[#FAFAFC] dark:bg-zinc-950">
                    {/* Background Decor */}
                    <div className="absolute top-0 right-0 w-[550px] h-[550px] bg-purple-200/20 dark:bg-purple-900/10 blur-[130px] rounded-full -mr-64 -mt-64 z-0 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-[450px] h-[450px] bg-rose-200/20 dark:bg-rose-900/10 blur-[110px] rounded-full -ml-32 -mb-32 z-0 pointer-events-none" />
                    <div className="absolute top-1/2 left-1/3 w-[300px] h-[300px] bg-amber-200/15 dark:bg-amber-900/5 blur-[90px] rounded-full z-0 pointer-events-none" />
                    
                    <div className="relative z-10 min-h-full">
                        {children}
                    </div>
                </main>

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
    highlightColor = 'bg-gradient-to-r from-orange-500 to-[#FF6B6B]' 
}: { 
    item: any, 
    isActive: boolean, 
    isLocked?: boolean,
    restaurantId?: string,
    restaurantCode?: string,
    highlightColor?: string 
}) {
    const Icon = item.icon;
    const router = useRouter();
    const { openUpgradeModal } = useAdminUpgradeModal();

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

    return (
        <Link
            href={item.href}
            prefetch={!isLocked}
            onClick={handleClick}
            onMouseEnter={() => {
                if (!isLocked) {
                    try {
                        router.prefetch(item.href);
                    } catch (_) {}
                    if (item.sectionKey && restaurantId) {
                        adminPreloadManager.preloadSection(item.sectionKey, restaurantId, restaurantCode);
                    }
                }
            }}
            className={`
                relative flex items-center justify-between px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 group cursor-pointer
                ${isActive
                    ? `text-white shadow-md shadow-orange-500/15 ${highlightColor}`
                    : isLocked
                    ? 'text-neutral-400 dark:text-neutral-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50/40 dark:hover:bg-amber-950/20'
                    : 'text-neutral-600 dark:text-neutral-350 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-neutral-50 dark:hover:bg-zinc-900/40'
                }
            `}
        >
            <div className="flex items-center gap-3 min-w-0">
                <Icon 
                    size={18} 
                    className={`relative z-10 transition-transform duration-200 ${
                        isActive 
                            ? 'text-white scale-110' 
                            : isLocked 
                            ? 'text-neutral-400 dark:text-neutral-500 group-hover:text-amber-500' 
                            : 'text-neutral-500 dark:text-neutral-400 group-hover:text-orange-500 dark:group-hover:text-orange-400'
                    }`} 
                    strokeWidth={2.3} 
                />
                <span className="relative z-10 truncate">{item.label}</span>
            </div>

            {isLocked && !isActive && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-[9px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">
                    <LucideLock size={10} />
                    <span>Lock</span>
                </div>
            )}

            {!isActive && !isLocked && (
                <div className={`w-1.5 h-1.5 rounded-full ${highlightColor} opacity-0 group-hover:opacity-100 transition-opacity`} />
            )}
        </Link>
    );
}
