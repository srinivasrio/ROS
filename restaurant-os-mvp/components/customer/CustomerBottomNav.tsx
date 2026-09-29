'use client';

import { 
    Home, 
    UtensilsCrossed, 
    Bell, 
    Clock, 
    User
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useParams } from 'next/navigation';
import { motion, type Transition } from 'framer-motion';
import { useRestaurant } from '@/context/RestaurantContext';
import { useCartSafe } from '@/context/CartContext';
import { useMemo, useEffect, useState } from 'react';

interface CustomerBottomNavProps {
    restaurantCode?: string;
    tableNumber?: string;
}

export function CustomerBottomNav({ restaurantCode: propRestaurantCode, tableNumber: propTableNumber }: CustomerBottomNavProps = {}) {
    const pathname = usePathname();
    const router = useRouter();
    const params = useParams();
    const { restaurantId: resolvedRestaurantId } = useRestaurant();
    const cartContext = useCartSafe();
    const cartTableNumber = cartContext?.tableNumber;

    // Bulletproof restaurantCode resolution with pathname fallback
    const rawRestaurantCode = (propRestaurantCode || params?.restaurantCode || params?.restaurantId || resolvedRestaurantId || '') as string;
    const restaurantCode = (rawRestaurantCode && rawRestaurantCode !== '{}' && rawRestaurantCode !== 'undefined' && rawRestaurantCode !== '[object Object]' && rawRestaurantCode !== 'null')
        ? rawRestaurantCode
        : (pathname.match(/^\/([^/?#]+)\/customer/i)?.[1] || '');

    // Bulletproof tableNumber resolution with pathname regex fallback
    let rawTableNumber = (propTableNumber || params?.tableNumber || params?.tableId || cartTableNumber || '') as string;
    if (!rawTableNumber || rawTableNumber === '{}' || rawTableNumber === 'undefined' || rawTableNumber === '[object Object]' || rawTableNumber === 'null') {
        const match = pathname.match(/\/customer\/(?:home|menu|service|services|myorders|orders|profile|combos|offers|popular|specials|cart|checkout)\/([^/?#]+)/i);
        if (match && match[1]) {
            rawTableNumber = decodeURIComponent(match[1]);
        }
    }
    const tableNumber = (rawTableNumber && rawTableNumber !== '{}' && rawTableNumber !== 'undefined' && rawTableNumber !== '[object Object]' && rawTableNumber !== 'null' && rawTableNumber !== 'NaN')
        ? rawTableNumber
        : '';

    const [isMinimized, setIsMinimized] = useState(false);
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    // Detect user's reduced motion preference for accessibility
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setPrefersReducedMotion(mq.matches);

        const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
        mq.addEventListener('change', handleChange);
        return () => mq.removeEventListener('change', handleChange);
    }, []);

    // Restore to prominent position whenever route changes
    useEffect(() => {
        setIsMinimized(false);
    }, [pathname]);

    // Directional scroll listener to minimize when scrolling down into content and restore when scrolling up
    useEffect(() => {
        let ticking = false;
        let accumulatedDelta = 0;
        const SCROLL_THRESHOLD = 15;
        const lastScrollMap = new WeakMap<EventTarget, number>();

        const handleScroll = (e: Event) => {
            // Ignore scroll events originating from within the bottom nav itself
            if ((e.target as HTMLElement)?.closest?.('nav')) return;

            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const target = (e.target || window) as any;
                    let currentScrollTop = 0;

                    if (!target || target === document || target === document.documentElement || target === window) {
                        currentScrollTop = window.scrollY || document.documentElement?.scrollTop || document.body?.scrollTop || 0;
                    } else if (typeof target.scrollTop === 'number') {
                        currentScrollTop = target.scrollTop;
                    }

                    // Always restore near the top of any container
                    if (currentScrollTop <= 25) {
                        setIsMinimized(false);
                        accumulatedDelta = 0;
                        if (target && typeof target === 'object') {
                            lastScrollMap.set(target, currentScrollTop);
                        }
                        ticking = false;
                        return;
                    }

                    const prevScrollTop = (target && typeof target === 'object' && lastScrollMap.has(target))
                        ? lastScrollMap.get(target)!
                        : currentScrollTop;

                    const delta = currentScrollTop - prevScrollTop;

                    // Accumulate directional delta for the current target
                    if (Math.sign(delta) !== Math.sign(accumulatedDelta)) {
                        accumulatedDelta = delta;
                    } else {
                        accumulatedDelta += delta;
                    }

                    if (accumulatedDelta > SCROLL_THRESHOLD) {
                        // Scrolling down into content: smoothly minimize
                        setIsMinimized(true);
                        accumulatedDelta = 0;
                    } else if (accumulatedDelta < -SCROLL_THRESHOLD) {
                        // Scrolling up towards top: smoothly restore
                        setIsMinimized(false);
                        accumulatedDelta = 0;
                    }

                    if (target && typeof target === 'object') {
                        lastScrollMap.set(target, Math.max(0, currentScrollTop));
                    }
                    ticking = false;
                });
                ticking = true;
            }
        };

        // Immediate trackpad and mouse wheel feedback
        const handleWheel = (e: WheelEvent) => {
            if (Math.abs(e.deltaY) < 5) return;
            if (e.deltaY > 0) {
                setIsMinimized(true);
            } else if (e.deltaY < 0) {
                setIsMinimized(false);
            }
        };

        window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
        window.addEventListener('wheel', handleWheel, { passive: true });

        return () => {
            window.removeEventListener('scroll', handleScroll, { capture: true });
            window.removeEventListener('wheel', handleWheel);
        };
    }, []);

    const navItems = useMemo(() => [
        { 
            id: 'home', 
            label: 'Home', 
            icon: Home, 
            path: `/${restaurantCode}/customer/home/${tableNumber}`, 
            active: pathname.includes('/customer/home/') 
        },
        { 
            id: 'menu', 
            label: 'Menu', 
            icon: UtensilsCrossed, 
            path: `/${restaurantCode}/customer/menu/${tableNumber}`, 
            active: pathname.includes('/customer/menu/') 
        },
        { 
            id: 'service', 
            label: 'Service', 
            icon: Bell, 
            path: `/${restaurantCode}/customer/service/${tableNumber}`, 
            active: pathname.includes('/customer/service/') || pathname.includes('/customer/services/')
        },
        { 
            id: 'orders', 
            label: 'Orders', 
            icon: Clock, 
            path: `/${restaurantCode}/customer/myorders/${tableNumber}`, 
            active: pathname.includes('/customer/myorders/') || pathname.includes('/customer/orders/') 
        },
        { 
            id: 'profile', 
            label: 'Profile', 
            icon: User, 
            path: `/${restaurantCode}/customer/profile/${tableNumber}`, 
            active: pathname.includes('/customer/profile/') 
        },
    ], [restaurantCode, tableNumber, pathname]);

    useEffect(() => {
        if (restaurantCode && tableNumber) {
            navItems.forEach(item => {
                router.prefetch(item.path);
            });
        }
    }, [navItems, router, restaurantCode, tableNumber]);

    if (!restaurantCode || !tableNumber) return null;

    const springPhysics: Transition = prefersReducedMotion 
        ? { duration: 0.05 } 
        : { type: "spring" as const, stiffness: 380, damping: 30, mass: 0.7 };

    return (
        <motion.nav 
            animate={{
                scale: prefersReducedMotion ? 1 : (isMinimized ? 0.92 : 1),
                y: prefersReducedMotion ? 0 : (isMinimized ? 8 : 0),
                opacity: isMinimized ? 0.95 : 1,
            }}
            transition={springPhysics}
            className="fixed left-4 right-4 max-w-md mx-auto z-[100] pointer-events-none"
            style={{
                bottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
            }}
        >
            <div 
                className={`pointer-events-auto rounded-[28px] flex items-center justify-around transition-all duration-300 ease-out ${
                    isMinimized ? 'py-1 px-1.5' : 'p-1.5'
                }`}
                style={{
                    backgroundColor: '#EEF2F6',
                    border: '1px solid rgba(255, 255, 255, 0.85)',
                    boxShadow: '0 -4px 16px rgba(166, 180, 200, 0.38), 0 4px 12px rgba(166, 180, 200, 0.25)',
                }}
            >
                {navItems.map((item) => {
                    const active = item.active;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.id}
                            href={item.path}
                            prefetch={true}
                            onClick={(e) => {
                                if (active) {
                                    e.preventDefault();
                                    return;
                                }
                            }}
                            className={`relative flex flex-col items-center justify-center rounded-2xl transition-all duration-200 ease-out active:scale-95 cursor-pointer select-none ${
                                isMinimized ? 'py-1.5 px-3 sm:px-3.5' : 'py-2 px-3.5 sm:px-4'
                            }`}
                        >
                            {/* Smooth Travel Animated Orange Background Pill */}
                            {active && (
                                <motion.div
                                    layoutId="activeCustomerBottomNavPill"
                                    className="absolute inset-0 bg-gradient-to-b from-orange-400 to-orange-500 rounded-2xl shadow-lg shadow-orange-500/30"
                                    style={{
                                        border: '1px solid rgba(255, 255, 255, 0.4)',
                                        boxShadow: '0 4px 14px -1px rgba(249, 115, 22, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.4)',
                                    }}
                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                />
                            )}

                            <div className="relative z-10 flex flex-col items-center gap-0.5">
                                <motion.div
                                    animate={{
                                        scale: active ? 1.08 : 0.95,
                                        y: active ? -1 : 0
                                    }}
                                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                    className={active ? 'text-white' : 'text-slate-500'}
                                >
                                    <Icon size={isMinimized ? 18 : 20} strokeWidth={active ? 2.5 : 2} />
                                </motion.div>

                                <span className={`tracking-tight transition-all duration-200 ${
                                    isMinimized ? 'text-[9px]' : 'text-[10px]'
                                } ${
                                    active ? 'text-white font-black drop-shadow-xs' : 'text-slate-600 font-semibold'
                                }`}>
                                    {item.label}
                                </span>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </motion.nav>
    );
}
