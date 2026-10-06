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
            className="fixed left-3 right-3 sm:left-4 sm:right-4 max-w-md mx-auto z-50 pointer-events-none"
            style={{
                bottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
            }}
        >
            <div
                className="pointer-events-auto relative rounded-full p-1.5 flex items-stretch backdrop-blur-2xl backdrop-saturate-150 transition-all duration-300"
                style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.78) 0%, rgba(243, 246, 251, 0.6) 50%, rgba(255, 255, 255, 0.74) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.75)',
                    boxShadow: '0 16px 38px -6px rgba(15, 23, 42, 0.15), 0 4px 12px -2px rgba(15, 23, 42, 0.08), inset 0 1.5px 1.5px rgba(255, 255, 255, 0.95), inset 0 -1.5px 2px rgba(200, 210, 225, 0.25)',
                }}
            >
                {/* Micro specular liquid refraction gleam across top edge */}
                <div
                    aria-hidden="true"
                    className="absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none opacity-90 rounded-full"
                />

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
                            className="relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 select-none cursor-pointer active:scale-95 transition-transform"
                        >
                            {/* Activated Orange Capsule Pill with Smooth Travel Animation */}
                            {active && (
                                <motion.div
                                    layoutId="waiterNavActivePill"
                                    transition={{ type: "spring", stiffness: 440, damping: 32, mass: 0.75 }}
                                    className="absolute inset-0.5 rounded-full"
                                    style={{
                                        background: 'linear-gradient(135deg, #FF6B00 0%, #FF8533 100%)',
                                        boxShadow: '0 4px 16px -1px rgba(249, 115, 22, 0.5), 0 2px 6px 0 rgba(249, 115, 22, 0.3), inset 0 1px 1.5px rgba(255, 255, 255, 0.45), inset 0 -1px 2px rgba(194, 65, 12, 0.3)',
                                        border: '1px solid rgba(255, 255, 255, 0.35)',
                                    }}
                                />
                            )}
                            <motion.span
                                animate={{
                                    scale: active ? 1.08 : 0.96,
                                    y: active ? -0.5 : 0
                                }}
                                whileTap={{ scale: [1, 0.9, 1.12, 1] }}
                                transition={{ duration: 0.2 }}
                                className="relative z-10"
                            >
                                <Icon
                                    size={20}
                                    strokeWidth={active ? 2.5 : 1.9}
                                    className={active ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]' : 'text-slate-500'}
                                />
                                {isHydrated && tab.seg === 'alerts' && pendingCount > 0 && (
                                    <span
                                        suppressHydrationWarning
                                        className={`absolute -top-1.5 -right-2 min-w-4 h-4 px-1 flex items-center justify-center rounded-full text-[9px] font-black ${
                                            active
                                                ? 'bg-white text-orange-600 shadow-sm border border-orange-200'
                                                : 'bg-orange-500 text-white shadow-[0_2px_6px_rgba(249,115,22,0.4)] border border-white'
                                        }`}
                                    >
                                        {pendingCount > 99 ? '99+' : pendingCount}
                                    </span>
                                )}
                            </motion.span>
                            <motion.span
                                animate={{ scale: active ? 1.02 : 1 }}
                                className={`relative z-10 text-[10px] leading-none transition-colors ${
                                    active
                                        ? 'text-white font-black tracking-tight drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.2)]'
                                        : 'text-slate-500 font-semibold'
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
