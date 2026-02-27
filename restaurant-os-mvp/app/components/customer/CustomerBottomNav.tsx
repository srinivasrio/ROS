'use client';

import { LucideUtensilsCrossed, LucideReceiptIndianRupee, LucideBellRing, Home, ShoppingBag } from 'lucide-react';
import { usePathname, useRouter, useParams } from 'next/navigation';
import { cn } from '@/app/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export function CustomerBottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const params = useParams();
    const tableId = params.tableId as string;

    if (!tableId) return null;

    const tabs = [
        {
            id: 'home',
            label: 'Home',
            icon: Home,
            isActive: pathname.includes(`/home/${tableId}`),
            onClick: () => router.push(`/home/${tableId}`)
        },
        {
            id: 'menu',
            label: 'Menu',
            icon: LucideUtensilsCrossed,
            isActive: pathname.includes(`/menu/${tableId}`),
            onClick: () => router.push(`/menu/${tableId}`)
        },
        {
            id: 'waiter',
            label: 'Service',
            icon: LucideBellRing,
            isActive: pathname.includes(`/service/${tableId}`),
            onClick: () => router.push(`/service/${tableId}`)
        },
        {
            id: 'orders',
            label: 'My Orders',
            icon: LucideReceiptIndianRupee,
            isActive: pathname.includes(`/orders/${tableId}`),
            onClick: () => router.push(`/orders/${tableId}`)
        }
    ];

    return (
        <div className="fixed bottom-4 inset-x-4 z-50 pointer-events-none flex justify-center">
            <div className="pointer-events-auto w-full max-w-sm bg-white/90 backdrop-blur-xl border border-white/20 shadow-xl shadow-black/5 rounded-2xl p-1 flex items-stretch justify-between gap-1 overflow-hidden h-12">
                {tabs.map((tab) => {
                    const isActive = tab.isActive;
                    return (
                        <button
                            key={tab.id}
                            onClick={tab.onClick}
                            className={cn(
                                "relative flex items-center justify-center rounded-xl transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] overflow-hidden",
                                isActive ? "flex-[1.3] text-white" : "flex-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                            )}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute inset-0 bg-orange-500 rounded-xl"
                                    initial={false}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}

                            <div className={cn(
                                "relative z-10 flex w-full h-full transition-all duration-300",
                                isActive ? "flex-row items-center justify-center gap-1.5" : "flex-col items-center justify-center gap-0.5"
                            )}>
                                <tab.icon
                                    size={isActive ? 16 : 16}
                                    strokeWidth={isActive ? 2.5 : 2}
                                    className="shrink-0 transition-all duration-300"
                                />
                                <span className={cn(
                                    "font-bold whitespace-nowrap transition-all duration-300",
                                    isActive ? "text-xs scale-100 opacity-100" : "text-[8px] font-medium opacity-70 scale-90"
                                )}>
                                    {tab.label}
                                </span>

                                {tab.id === 'waiter' && !isActive && (
                                    <span className="absolute top-1 right-1 size-1.5 bg-red-500 rounded-full border border-white animate-pulse" />
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
