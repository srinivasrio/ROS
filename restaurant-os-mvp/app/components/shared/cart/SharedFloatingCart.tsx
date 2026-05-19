'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { useCartSafe } from '@/app/context/CartContext';
import { useRestaurant } from '@/app/context/RestaurantContext';

export function SharedFloatingCart() {
    const cartContext = useCartSafe();
    const router = useRouter();
    const params = useParams();
    const pathname = usePathname();
    const { restaurantId: resolvedRestaurantId } = useRestaurant();
    
    // Fallback logic for restaurantCode and tableNumber to ensure links work on all pages
    const restaurantCode = (params.restaurantCode || params.restaurantId || resolvedRestaurantId) as string;
    const tableNumber = (params.tableNumber || params.tableId || cartContext?.tableNumber) as string;

    // Hide if context is missing, no items, or if we're on a page where the cart shouldn't show
    if (!cartContext || cartContext.totalItems === 0) return null;
    
    // Check if we are on cart or checkout page to avoid double cart
    // We also might want to hide it on the homepage if it's already there, 
    // but the goal is to unify it, so we'll remove it from the homepage and keep it here.
    const isCartPage = pathname.includes('/customer/cart/');
    const isCheckoutPage = pathname.includes('/customer/checkout/');
    
    if (isCartPage || isCheckoutPage) return null;

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, y: 20 }}
                className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md flex justify-end px-5 pointer-events-none z-[90]"
            >
                <button 
                    onClick={() => router.push(`/${restaurantCode}/customer/cart/${tableNumber}`)}
                    className="pointer-events-auto bg-orange-500 text-white flex items-center gap-2.5 px-4 py-2.5 rounded-2xl ring-4 ring-white active:scale-95 transition-transform shadow-lg shadow-orange-500/20"
                >
                    <div className="relative">
                        <LucideIcons.ShoppingBag size={20} />
                        <span className="absolute -top-1 -right-1 size-4 bg-white text-orange-500 text-[8px] font-black flex items-center justify-center rounded-full">
                            {cartContext.totalItems}
                        </span>
                    </div>
                    <div className="flex flex-col items-start leading-tight">
                        <span className="text-[8px] font-black uppercase tracking-widest text-white">View Cart</span>
                        <span className="text-xs font-black">
                            ₹{cartContext.subtotal}
                        </span>
                    </div>
                    <LucideIcons.ChevronRight size={14} className="text-white" />
                </button>
            </motion.div>
        </AnimatePresence>
    );
}
