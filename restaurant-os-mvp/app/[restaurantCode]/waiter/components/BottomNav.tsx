'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { LayoutGrid, ChefHat, Bell, User } from 'lucide-react';

export default function BottomNav() {
    const pathname = usePathname();
    const params = useParams();
    const restaurantCode = params.restaurantCode as string;
    const staffMobile = params.staffMobile as string;
    const isActive = (path: string) => pathname === path;

    const navItems = [
        { path: `/${restaurantCode}/waiter/${staffMobile}/dashboard`, label: 'Tables', icon: LayoutGrid },
        { path: `/${restaurantCode}/waiter/${staffMobile}/kitchen`, label: 'Kitchen', icon: ChefHat },
        { path: `/${restaurantCode}/waiter/${staffMobile}/alerts`, label: 'Alerts', icon: Bell },
        { path: `/${restaurantCode}/waiter/${staffMobile}/profile`, label: 'Profile', icon: User },
    ];

    return (
        <nav className="relative z-50">
            <div className="bg-white/95 backdrop-blur-xl border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] px-6 py-2 pb-2 flex justify-between items-center max-w-md mx-auto">

                {navItems.map((item) => {
                    const active = isActive(item.path);
                    return (
                        <Link
                            key={item.path}
                            href={item.path}
                            className="flex-1 relative z-10"
                        >
                            <div className="flex flex-col items-center justify-center py-2 relative min-h-[60px]">
                                {active && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute inset-x-2 inset-y-1 bg-orange-50 rounded-xl"
                                        transition={{
                                            type: "spring",
                                            stiffness: 400,
                                            damping: 30
                                        }}
                                    />
                                )}

                                <div className="relative z-10 flex flex-col items-center gap-1">
                                    <motion.div
                                        animate={{
                                            scale: active ? 1 : 0.9,
                                            y: active ? -2 : 0
                                        }}
                                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                        className={`${active ? 'text-orange-600' : 'text-black hover:text-black'}`}
                                    >
                                        <item.icon
                                            size={24}
                                            strokeWidth={active ? 2.5 : 2}
                                            fill={active ? "currentColor" : "none"}
                                            className={`transition-colors duration-200 ${active ? 'fill-orange-600/20' : ''}`}
                                        />
                                    </motion.div>

                                    <span
                                        className={`text-[10px] font-bold tracking-wide transition-colors duration-200 ${active ? 'text-orange-600' : 'text-black'}`}
                                    >
                                        {item.label}
                                    </span>
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
