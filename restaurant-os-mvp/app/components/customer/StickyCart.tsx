'use client';

import { useCart } from '../../(customer)/context/CartContext';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function StickyCart() {
    const { totalItems } = useCart();
    const router = useRouter();
    const params = useParams();
    const pathname = usePathname();
    const tableId = params.tableId as string;

    // Hide on menu page (as it has its own big cart card)
    if (!tableId || pathname.includes('/menu/')) return null;

    return (
        <AnimatePresence>
            {totalItems > 0 && (
                <div className="fixed bottom-20 left-0 right-0 z-50 flex justify-center pointer-events-none">
                    <div className="w-full max-w-md px-4 flex justify-end">
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="pointer-events-auto"
                        >
                            <button
                                onClick={() => router.push(`/cart`)}
                                className="bg-black text-white p-4 rounded-full shadow-2xl shadow-black/30 flex items-center justify-center relative active:scale-95 transition-transform"
                            >
                                <ShoppingBag size={24} />
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold size-5 flex items-center justify-center rounded-full border-2 border-white">
                                    {totalItems}
                                </span>
                            </button>
                        </motion.div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
}
