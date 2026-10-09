'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, ChevronRight } from 'lucide-react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { useCartSafe } from '@/context/CartContext';
import { useRestaurant } from '@/context/RestaurantContext';

interface SharedFloatingCartProps {
    restaurantCode?: string;
    tableNumber?: string;
}

export function SharedFloatingCart({ restaurantCode: propRestaurantCode, tableNumber: propTableNumber }: SharedFloatingCartProps = {}) {
    const cartContext = useCartSafe();
    const router = useRouter();
    const params = useParams();
    const pathname = usePathname();
    const { restaurantId: resolvedRestaurantId } = useRestaurant();
    
    // Bulletproof restaurantCode resolution with pathname fallback
    const rawRestaurantCode = (propRestaurantCode || params?.restaurantCode || params?.restaurantId || resolvedRestaurantId || '') as string;
    const restaurantCode = (rawRestaurantCode && rawRestaurantCode !== '{}' && rawRestaurantCode !== 'undefined' && rawRestaurantCode !== '[object Object]' && rawRestaurantCode !== 'null')
        ? rawRestaurantCode
        : (pathname.match(/^\/([^/?#]+)\/customer/i)?.[1] || '');

    // Bulletproof tableNumber resolution with pathname regex fallback
    let rawTableNumber = (propTableNumber || params?.tableNumber || params?.tableId || cartContext?.tableNumber || '') as string;
    if (!rawTableNumber || rawTableNumber === '{}' || rawTableNumber === 'undefined' || rawTableNumber === '[object Object]' || rawTableNumber === 'null') {
        const match = pathname.match(/\/customer\/(?:home|menu|service|services|myorders|orders|profile|combos|offers|popular|specials|cart|checkout)\/([^/?#]+)/i);
        if (match && match[1]) {
            rawTableNumber = decodeURIComponent(match[1]);
        }
    }
    const tableNumber = (rawTableNumber && rawTableNumber !== '{}' && rawTableNumber !== 'undefined' && rawTableNumber !== '[object Object]' && rawTableNumber !== 'null' && rawTableNumber !== 'NaN')
        ? rawTableNumber
        : '';

    // Hide if context is missing, no items, or if we're on a page where the cart shouldn't show
    if (!cartContext || cartContext.totalItems === 0) return null;
    
    // Check if we are on cart, checkout, or order status page to avoid double cart or button overlap
    const isCartPage = pathname.includes('/customer/cart/');
    const isCheckoutPage = pathname.includes('/customer/checkout/');
    const isStatusPage = pathname.includes('/customer/status/');
    
    if (isCartPage || isCheckoutPage || isStatusPage) return null;

    const formattedPrice = Number(cartContext.subtotal || 0).toLocaleString('en-IN');
    const itemCountText = cartContext.totalItems === 1 ? '1 item' : `${cartContext.totalItems} items`;

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ scale: 0.85, opacity: 0, y: 16 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.85, opacity: 0, y: 16 }}
                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 w-full max-w-md flex justify-end px-4 pointer-events-none z-[150]"
            >
                <style>{`
                    @keyframes multiColorFlow {
                        0% { background-position: 0% 50%; }
                        50% { background-position: 100% 50%; }
                        100% { background-position: 0% 50%; }
                    }
                    .animated-multicolor-cart {
                        background: linear-gradient(135deg, #f97316, #ef4444, #ec4899, #8b5cf6, #3b82f6, #06b6d4, #10b981, #f59e0b, #f97316);
                        background-size: 350% 350%;
                        animation: multiColorFlow 7s ease infinite;
                    }
                `}</style>
                <button 
                    type="button"
                    onClick={() => {
                        const tokenMatch = pathname ? pathname.match(/\/customer\/t\/([^/?#]+)/i) : null;
                        const currentToken = tokenMatch ? tokenMatch[1] : null;
                        if (currentToken) {
                            router.push(`/customer/t/${currentToken}/cart`);
                        } else {
                            router.push(`/${restaurantCode}/customer/cart/${tableNumber}`);
                        }
                    }}
                    className="group pointer-events-auto relative flex items-center gap-3 pl-2.5 pr-3.5 py-2 rounded-2xl animated-multicolor-cart text-white shadow-[0_10px_25px_-3px_rgba(236,72,153,0.35),0_4px_12px_rgba(0,0,0,0.12)] border border-white/40 backdrop-blur-xl active:scale-[0.96] hover:brightness-105 transition-all duration-200 cursor-pointer select-none"
                    aria-label={`View cart with ${cartContext.totalItems} items for ₹${formattedPrice}`}
                >
                    {/* Beautiful Cart Icon with badge */}
                    <div className="relative flex items-center justify-center size-9 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 shadow-inner shrink-0">
                        <ShoppingCart size={18} className="text-white drop-shadow-xs" strokeWidth={2.4} />
                        <motion.span 
                            key={cartContext.totalItems}
                            initial={{ scale: 0.5 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-white text-orange-600 text-[10px] font-black flex items-center justify-center rounded-full shadow-md border border-orange-200 leading-none"
                        >
                            {cartContext.totalItems}
                        </motion.span>
                    </div>

                    {/* Item count & Price */}
                    <div className="flex flex-col items-start text-left leading-tight min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-wider text-white/90 truncate drop-shadow-xs">
                            {itemCountText}
                        </span>
                        <motion.span 
                            key={cartContext.subtotal}
                            initial={{ scale: 1.15, color: '#FEF08A' }}
                            animate={{ scale: 1, color: '#FFFFFF' }}
                            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                            className="text-sm font-black text-white font-display tracking-tight drop-shadow-xs"
                        >
                            ₹{formattedPrice}
                        </motion.span>
                    </div>

                    {/* Subtle Right Chevron */}
                    <div className="size-6 rounded-lg bg-white/20 border border-white/25 flex items-center justify-center text-white/95 group-hover:translate-x-0.5 transition-transform shrink-0">
                        <ChevronRight size={14} strokeWidth={2.6} />
                    </div>
                </button>
            </motion.div>
        </AnimatePresence>
    );
}
