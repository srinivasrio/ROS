'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { LayoutGrid, UtensilsCrossed, BellRing, User, UserCheck } from 'lucide-react';
import { useAlertCount, haptic, useIsHydrated, useIsTableOpen } from '../components/ui';

const TABS = [
    { seg: 'dashboard', label: 'Tables', icon: LayoutGrid },
    { seg: 'menu', label: 'Menu', icon: UtensilsCrossed },
    { seg: 'alerts', label: 'Requests', icon: BellRing },
    { seg: 'profile', label: 'Profile', icon: User, activeIcon: UserCheck },
];

export default function BottomNav() {
    const pathname = usePathname();
    const params = useParams();
    const isHydrated = useIsHydrated();
    const isTableOpen = useIsTableOpen();
    
    // Robust extraction: fallback to pathname segments to ensure no empty or double-slash paths
    const segments = (pathname || '').split('/').filter(Boolean);
    const urlRestaurantCode = segments[0] || '';
    const urlStaffMobile = segments[1] === 'waiter' ? (segments[2] || '') : '';

    const restaurantCode = (params?.restaurantCode as string) || urlRestaurantCode;
    const staffMobile = (params?.staffMobile as string) || urlStaffMobile;
    const pendingCount = useAlertCount();

    if (pathname.endsWith('/login') || pathname.includes('/cart/') || isTableOpen) return null;

    const basePath = `/${restaurantCode}/waiter/${staffMobile}`;
    const activeSeg =
        TABS.find((t) => pathname.includes(`/${t.seg}`))?.seg ??
        (pathname.endsWith(`/waiter/${staffMobile}`) ? 'dashboard' : '');

    return (
        <nav
            aria-label="Waiter navigation"
            className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-50 safe-bottom"
            style={{
                backgroundColor: '#EEF2F6',
                borderTop: '1px solid rgba(255, 255, 255, 0.85)',
                boxShadow: '0 -4px 16px rgba(166, 180, 200, 0.35), 0 -1px 2px rgba(255, 255, 255, 0.95)',
            }}
        >
            <div className="flex items-stretch px-3.5 pt-1.5 pb-2">
                {TABS.map((tab) => {
                    const active = activeSeg === tab.seg;
                    const Icon = active && tab.activeIcon ? tab.activeIcon : tab.icon;
                    const href =
                        tab.seg === 'menu'
                            ? `${basePath}/menu/browse`
                            : `${basePath}/${tab.seg === 'dashboard' ? 'dashboard' : tab.seg}`;
                    return (
                        <Link
                            key={tab.seg}
                            href={href}
                            prefetch={true}
                            scroll={false}
                            aria-current={active ? 'page' : undefined}
                            onClick={(e) => {
                                if (active) {
                                    e.preventDefault();
                                    return;
                                }
                                haptic.selection();
                            }}
                            className="relative flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-w-brand/40 rounded-2xl active:scale-95 transition-transform"
                        >
                            {active && (
                                <motion.div
                                    layoutId="waiterNavCapsule"
                                    transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
                                    className="absolute inset-x-1 top-0.5 bottom-0.5 rounded-[18px]"
                                    style={{
                                        backgroundColor: '#EEF2F6',
                                        boxShadow: 'inset 2.5px 2.5px 5px rgba(166, 180, 200, 0.45), inset -2.5px -2.5px 5px rgba(255, 255, 255, 0.95)',
                                        border: '1px solid rgba(255, 107, 53, 0.3)',
                                    }}
                                />
                            )}
                            <motion.span
                                animate={{ scale: active ? 1.08 : 0.96 }}
                                whileTap={{ scale: [1, 0.88, 1.14, 1] }}
                                transition={{ duration: 0.25 }}
                                className="relative z-10"
                            >
                                <Icon
                                    size={21}
                                    strokeWidth={active ? 2.3 : 1.9}
                                    className={active ? 'text-w-brand' : 'text-slate-500'}
                                />
                                {isHydrated && tab.seg === 'alerts' && pendingCount > 0 && (
                                    <span
                                        suppressHydrationWarning
                                        className="absolute -top-1 -right-2 min-w-4 h-4 px-1 flex items-center justify-center rounded-[10px] bg-w-brand text-white text-[9px] font-black border border-white"
                                        style={{
                                            boxShadow: '2px 2px 5px rgba(255, 107, 53, 0.4), -1px -1px 3px rgba(255, 255, 255, 0.8)',
                                        }}
                                    >
                                        {pendingCount > 99 ? '99+' : pendingCount}
                                    </span>
                                )}
                            </motion.span>
                            <motion.span
                                animate={{ scale: active ? 1.03 : 1 }}
                                className={`relative z-10 text-[10.5px] leading-none transition-colors ${
                                    active ? 'text-w-brand font-black tracking-tight' : 'text-slate-500 font-semibold'
                                }`}
                            >
                                {tab.label}
                            </motion.span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
