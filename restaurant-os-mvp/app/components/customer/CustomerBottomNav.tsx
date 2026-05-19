'use client';

import { 
    Home, 
    UtensilsCrossed, 
    Bell, 
    Clock, 
    User,
    Search,
    ShoppingBag
} from 'lucide-react';
import { usePathname, useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useRestaurant } from '@/app/context/RestaurantContext';
import { useCartSafe } from '@/app/context/CartContext';
import { useMemo, useEffect, useState } from 'react';

/**
 * Premium Customer Bottom Navigation - Soft Orange Edition
 * Features:
 * - Soft orange theme background
 * - Liquid/Glass white active indicator
 * - Flush bottom positioning
 * - Smooth spring animations
 */
export function CustomerBottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const params = useParams();
    const { restaurantId: resolvedRestaurantId } = useRestaurant();
    const cartContext = useCartSafe();
    const cartTableNumber = cartContext?.tableNumber;

    const restaurantCode = (params.restaurantCode || params.restaurantId || resolvedRestaurantId) as string;
    const tableNumber = (params.tableNumber || params.tableId || cartTableNumber) as string;

    // Enhanced Theme configuration for Soft Orange style
    const theme = {
        active: 'text-orange-600',
        inactive: 'text-orange-300/80',
        indicator: 'bg-white/90 backdrop-blur-md shadow-sm', // Liquid white effect
        background: 'bg-orange-500', // Soft/vibrant orange base
        border: 'border-orange-400/20',
        shadow: 'shadow-[0_-4px_20px_0_rgba(249,115,22,0.15)]'
    };

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
            active: pathname.includes('/customer/service/') 
        },
        { 
            id: 'orders', 
            label: 'Orders', 
            icon: Clock, 
            path: `/${restaurantCode}/customer/myorders/${tableNumber}`, 
            active: pathname.includes('/customer/myorders/') 
        },
        { 
            id: 'profile', 
            label: 'Profile', 
            icon: User, 
            path: `/${restaurantCode}/customer/profile/${tableNumber}`, 
            active: pathname.includes('/customer/profile/') 
        },
    ], [restaurantCode, tableNumber, pathname]);

    // Prefetch all nav routes for instant transition
    useEffect(() => {
        if (restaurantCode && tableNumber) {
            navItems.forEach(item => {
                router.prefetch(item.path);
            });
        }
    }, [navItems, router, restaurantCode, tableNumber]);

    const activeIndex = navItems.findIndex(item => item.active);
    const [lastIndex, setLastIndex] = useState(activeIndex !== -1 ? activeIndex : 0);

    useEffect(() => {
        if (activeIndex !== -1) {
            setLastIndex(activeIndex);
        }
    }, [activeIndex]);

    if (!restaurantCode || !tableNumber) return null;

    return (
        <nav className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md ${theme.background} border-t ${theme.border} ${theme.shadow} px-4 z-[100] rounded-t-[2rem] pt-3 pb-[max(12px,env(safe-area-inset-bottom,0px))]`}>
            <div className="relative flex items-center justify-between w-full max-w-md mx-auto">
                {/* Continuous Active Indicator - Persistent for smooth travel */}
                <motion.div
                    initial={false}
                    animate={{
                        x: `${lastIndex * 100}%`,
                        opacity: activeIndex === -1 ? 0.6 : 1, // Dim slightly if no direct match, but don't jump
                    }}
                    transition={{ 
                        type: "spring", 
                        stiffness: 400, 
                        damping: 35,
                        mass: 1
                    }}
                    className="absolute inset-y-0 z-0 py-1.5"
                    style={{
                        width: `${100 / navItems.length}%`,
                        pointerEvents: 'none'
                    }}
                >
                    <div className={`mx-1 h-full rounded-2xl ${theme.indicator}`} />
                </motion.div>

                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.active;

                    return (
                        <button
                            key={item.id}
                            onClick={() => {
                                // Vibration feedback for premium feel
                                if (typeof window !== 'undefined' && window.navigator.vibrate) {
                                    window.navigator.vibrate(5);
                                }
                                router.push(item.path);
                            }}
                            className="relative flex-1 flex flex-col items-center justify-center py-2 tap-highlight-transparent outline-none transition-all duration-300"
                        >
                            {/* Floating Icon Wrapper */}
                            <motion.div
                                animate={{
                                    y: isActive ? -2 : 0,
                                    scale: isActive ? 1.1 : 1
                                }}
                                className={`relative z-10 transition-colors duration-300 ${isActive ? theme.active : theme.inactive}`}
                            >
                                <Icon 
                                    size={20} 
                                    strokeWidth={isActive ? 2.5 : 2} 
                                    className={isActive ? 'drop-shadow-sm' : ''}
                                />
                            </motion.div>
                            
                            {/* Animated Label */}
                            <motion.span 
                                animate={{
                                    opacity: isActive ? 1 : 0.7,
                                    scale: isActive ? 1 : 0.9,
                                }}
                                className={`text-[10px] font-bold mt-1 relative z-10 transition-colors duration-300 ${isActive ? theme.active : theme.inactive}`}
                            >
                                {item.label}
                            </motion.span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
