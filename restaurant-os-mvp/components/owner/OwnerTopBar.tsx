import React, { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Menu, Bell, Search, User, CheckCircle2, AlertTriangle, 
    MessageSquare, ShoppingBag, ExternalLink, Settings, 
    CreditCard, LogOut, X, RefreshCw 
} from 'lucide-react';
import { useOwner } from '@/context/OwnerContext';
import BranchSelector from './BranchSelector';

export default function OwnerTopBar() {
    const { restaurant, setMobileSidebarOpen, currentBranch, isAllBranches, restaurants } = useOwner();
    const pathname = usePathname();
    const router = useRouter();

    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [loadingNotifs, setLoadingNotifs] = useState(false);

    const notifRef = useRef<HTMLDivElement>(null);
    const profileRef = useRef<HTMLDivElement>(null);

    // Click outside to close dropdowns
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setNotificationsOpen(false);
            }
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
                setProfileOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch real-time notifications for all branches and customer complaints
    const fetchNotifications = async () => {
        setLoadingNotifs(true);
        try {
            const res = await fetch('/api/owner/notifications');
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications || []);
                setUnreadCount(data.unreadCount || 0);
            }
        } catch (e) {
            console.error('[OwnerTopBar] Failed to load notifications:', e);
        } finally {
            setLoadingNotifs(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 20000); // Poll every 20s
        return () => clearInterval(interval);
    }, []);

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

    const isDashboard = pathname === '/owner/dashboard' || pathname === '/owner';

    return (
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-neutral-200/40 dark:border-zinc-800/40">
            <div className="flex items-center justify-between px-6 py-3 lg:px-8">
                {/* Left: Mobile menu + Restaurant Details (Always visible) */}
                <div className="flex items-center gap-3.5 min-w-0">
                    <button
                        onClick={() => setMobileSidebarOpen(true)}
                        className="lg:hidden w-9 h-9 rounded-xl bg-neutral-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer shrink-0"
                    >
                        <Menu size={18} className="text-neutral-600 dark:text-neutral-300" />
                    </button>

                    {/* Restaurant Logo */}
                    <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-black text-sm shadow-sm shadow-indigo-500/20">
                        {restaurant?.logoUrl ? (
                            <img src={restaurant.logoUrl} alt={restaurant.name} className="w-full h-full object-cover" />
                        ) : (
                            <span>{(restaurant?.name || 'R').charAt(0).toUpperCase()}</span>
                        )}
                    </div>

                    {/* Restaurant Name & Context */}
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-black tracking-tight text-neutral-900 dark:text-white truncate">
                                {restaurant?.name || 'Restaurant'}
                            </h2>
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/50 dark:border-indigo-800/40 text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                Owner
                            </span>
                            <span className="text-neutral-300 dark:text-zinc-700 hidden sm:inline">•</span>
                            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 hidden sm:inline">
                                {getPageTitle()}
                            </span>
                        </div>
                        {!isAllBranches && currentBranch && (
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-500 dark:text-indigo-400 mt-0.5">
                                <span className="truncate max-w-[180px]">{currentBranch.name}</span>
                                <span className="text-neutral-300 dark:text-zinc-700">•</span>
                                <span className="font-mono text-[10px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-1 py-0.2 rounded font-bold">
                                    ID: {currentBranch.restaurant_id || currentBranch.id}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Branch selector + Actions */}
                <div className="flex items-center gap-3">
                    {/* Search (desktop only, removed on dashboard section per item 15) */}
                    {!isDashboard && (
                        <div className="hidden xl:flex items-center gap-2 px-4 py-2.5 bg-neutral-50 dark:bg-zinc-800/50 border border-neutral-200/40 dark:border-zinc-700/30 rounded-xl text-neutral-400 dark:text-neutral-500 w-56 cursor-text group hover:border-indigo-200 dark:hover:border-indigo-800/30 transition-colors">
                            <Search size={14} />
                            <span className="text-sm">Search...</span>
                            <kbd className="ml-auto text-[10px] font-mono bg-neutral-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-neutral-400">⌘K</kbd>
                        </div>
                    )}

                    {/* Branch Selector */}
                    <BranchSelector />

                    {/* Notifications (item 5) */}
                    <div ref={notifRef} className="relative">
                        <button 
                            onClick={() => {
                                setNotificationsOpen(!notificationsOpen);
                                if (!notificationsOpen) fetchNotifications();
                            }}
                            className="relative w-10 h-10 rounded-xl bg-neutral-50 dark:bg-zinc-800/50 border border-neutral-200/40 dark:border-zinc-700/30 flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer group"
                            aria-label="View notifications"
                        >
                            <Bell size={16} className="text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-300 transition-colors" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 rounded-full flex items-center justify-center shadow-xs">
                                    <span className="text-[8px] font-black text-white">{unreadCount}</span>
                                </span>
                            )}
                        </button>

                        <AnimatePresence>
                            {notificationsOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-zinc-900 border border-neutral-200/70 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
                                >
                                    <div className="p-4 border-b border-neutral-100 dark:border-zinc-800 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Bell size={16} className="text-indigo-600 dark:text-indigo-400" />
                                            <h4 className="text-sm font-black text-neutral-900 dark:text-white">Branch Alerts & Complaints</h4>
                                        </div>
                                        <button
                                            onClick={fetchNotifications}
                                            className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-zinc-800 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                                            title="Refresh"
                                        >
                                            <RefreshCw size={13} className={loadingNotifs ? 'animate-spin' : ''} />
                                        </button>
                                    </div>

                                    <div className="max-h-80 overflow-y-auto premium-scrollbar divide-y divide-neutral-100 dark:divide-zinc-800/60">
                                        {notifications.length === 0 ? (
                                            <div className="p-8 text-center text-xs text-neutral-400">
                                                No active complaints or order alerts across your branches.
                                            </div>
                                        ) : (
                                            notifications.map((n) => (
                                                <div 
                                                    key={n.id}
                                                    onClick={() => {
                                                        setNotificationsOpen(false);
                                                        if (n.link) router.push(n.link);
                                                    }}
                                                    className="p-3.5 hover:bg-neutral-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer flex items-start gap-3 text-xs"
                                                >
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                                        n.type === 'complaint'
                                                            ? 'bg-red-50 dark:bg-red-950/40 text-red-600'
                                                            : n.type === 'order'
                                                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600'
                                                            : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600'
                                                    }`}>
                                                        {n.type === 'complaint' ? <AlertTriangle size={15} /> : n.type === 'order' ? <ShoppingBag size={15} /> : <MessageSquare size={15} />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-1">
                                                            <p className="font-bold text-neutral-900 dark:text-white truncate">
                                                                {n.title}
                                                            </p>
                                                            <span className="text-[10px] text-neutral-400 font-mono shrink-0">
                                                                {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                            </span>
                                                        </div>
                                                        <p className="text-neutral-500 dark:text-neutral-400 text-[11px] mt-0.5 line-clamp-2">
                                                            {n.message}
                                                        </p>
                                                        <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
                                                            {n.restaurantName}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Profile Button & Menu (item 6) */}
                    <div ref={profileRef} className="relative">
                        <button 
                            onClick={() => setProfileOpen(!profileOpen)}
                            className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-500/20 cursor-pointer hover:shadow-lg hover:shadow-indigo-500/30 transition-shadow"
                            aria-label="Owner Profile"
                        >
                            <User size={16} className="text-white" />
                        </button>

                        <AnimatePresence>
                            {profileOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-zinc-900 border border-neutral-200/70 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
                                >
                                    <div className="p-4 border-b border-neutral-100 dark:border-zinc-800">
                                        <p className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
                                            Owner Profile
                                        </p>
                                        <h4 className="text-sm font-black text-neutral-900 dark:text-white mt-0.5 truncate">
                                            {restaurant?.name || 'Restaurant Owner'}
                                        </h4>
                                        <p className="text-[11px] text-neutral-400 mt-0.5">
                                            {restaurants?.length || 1} Outlets Connected
                                        </p>
                                    </div>

                                    <div className="p-2 space-y-1 text-xs font-semibold">
                                        <button
                                            onClick={() => {
                                                setProfileOpen(false);
                                                router.push('/owner/settings');
                                            }}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                                        >
                                            <Settings size={15} className="text-neutral-500" />
                                            <span>Account Settings & Profile</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                setProfileOpen(false);
                                                router.push('/owner/billing');
                                            }}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                                        >
                                            <CreditCard size={15} className="text-neutral-500" />
                                            <span>Billing & Subscriptions</span>
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </header>
    );
}
