'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCart } from '@/app/context/CartContext';
import { HomepageBuilderService } from '@/app/services/homepage-builder.service';
import { 
    ChevronLeft as LucideChevronLeft, 
    Flame as LucideFlame, 
    ShoppingBag as LucideShoppingBag, 
    Plus as LucidePlus, 
    Minus as LucideMinus, 
    Heart as LucideHeart
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { SharedSkeleton } from '@/app/components/customer/SharedSkeleton';
import SharedQuantityControl from '@/app/components/shared/SharedQuantityControl';

export default function AllSpecialsPage() {
    const params = useParams();
    const router = useRouter();
    const restaurantId = (params.restaurantCode || params.restaurantId) as string;
    const tableNumber = params.tableNumber as string;

    const { addSpecialToCart, updateQuantity, cart, setTableNumber } = useCart();

    const [specials, setSpecials] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const getItemQtyInCart = (id: string) => cart[String(id)]?.quantity || 0;

    useEffect(() => {
        if (tableNumber) setTableNumber(tableNumber);
    }, [tableNumber, setTableNumber]);

    useEffect(() => {
        const loadSpecials = async () => {
            try {
                const data = await HomepageBuilderService.getSpecials(restaurantId, true);
                setSpecials(data || []);
            } catch (err) {
                console.error('Failed to load specials:', err);
            } finally {
                setLoading(false);
            }
        };
        loadSpecials();
    }, [restaurantId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <header className="bg-white px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full animate-pulse" />
                        <div className="flex-1 space-y-2">
                            <div className="h-5 bg-gray-100 rounded-full w-32 animate-pulse" />
                            <div className="h-3 bg-gray-100 rounded-full w-20 animate-pulse" />
                        </div>
                    </div>
                </header>
                <main className="p-4">
                    <SharedSkeleton count={5} />
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-100 px-4 py-3">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <LucideChevronLeft className="text-black" size={20} />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-lg font-black text-black tracking-tight">Today&apos;s Specials</h1>
                        <p className="text-[10px] font-bold text-black uppercase tracking-widest">
                            {specials.length} {specials.length === 1 ? 'item' : 'items'} available
                        </p>
                    </div>
                    <div className="p-2 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl">
                        <LucideFlame size={20} className="text-orange-500" />
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="p-4 space-y-4">
                {specials.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="inline-block p-5 rounded-2xl bg-amber-50 mb-4">
                            <LucideFlame className="text-amber-300" size={40} />
                        </div>
                        <h3 className="text-lg font-bold text-black mb-1">No specials today</h3>
                        <p className="text-black text-sm">Check back later for new chef picks!</p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {specials.map((item, idx) => {
                            const cartKey = `special-${item.id}`;
                            const qty = getItemQtyInCart(cartKey);
                            const mrp = item.items?.reduce((sum: number, i: any) => sum + ((i.menu_item?.price || i.price || 0) * (i.quantity || 1)), 0) || 0;

                            return (
                                <motion.div
                                    key={item.id || idx}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm"
                                >
                                    {/* Image */}
                                    <div className="relative h-48 w-full">
                                        <img
                                            src={item.image_url || '/placeholder-food.jpg'}
                                            alt={item.title}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                                        <div className="absolute top-3 left-3">
                                            <span className="px-2.5 py-1 bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-amber-500/30">
                                                Chef&apos;s Choice
                                            </span>
                                        </div>
                                        <div className="absolute top-3 right-3">
                                            <button className="p-2 bg-white/80 backdrop-blur-md rounded-full">
                                                <LucideHeart size={14} className="text-black" />
                                            </button>
                                        </div>
                                        <div className="absolute bottom-3 left-3">
                                            <h3 className="text-white font-black text-lg leading-tight drop-shadow-md">
                                                {item.title}
                                            </h3>
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="p-4">
                                        {item.description && (
                                            <p className="text-sm text-black mb-3 line-clamp-2">{item.description}</p>
                                        )}

                                        {/* Items preview */}
                                        {item.items && item.items.length > 0 && (
                                            <div className="mb-3 flex flex-wrap gap-1.5">
                                                {item.items.slice(0, 4).map((si: any, siIdx: number) => {
                                                    const itemName = si.menu_item?.name || si.name || 'Item';
                                                    return (
                                                        <span
                                                            key={si.id || siIdx}
                                                            className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-md"
                                                        >
                                                            {itemName}
                                                            {si.quantity > 1 && ` ×${si.quantity}`}
                                                        </span>
                                                    );
                                                })}
                                                {item.items.length > 4 && (
                                                    <span className="px-2 py-0.5 bg-neutral-100 text-black text-[10px] font-bold rounded-md">
                                                        +{item.items.length - 4} more
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Price + Cart Controls */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <div className="flex items-end gap-2">
                                                    <span className="text-xl font-black text-orange-600">₹{item.price}</span>
                                                    {mrp > item.price && (
                                                        <span className="text-sm font-bold text-black line-through mb-1">₹{mrp}</span>
                                                    )}
                                                </div>
                                            </div>

                                            <SharedQuantityControl
                                                qty={qty}
                                                onAdd={() => {
                                                    addSpecialToCart(item);
                                                    toast.success(`${item.title} added to cart`, {
                                                        duration: 2000,
                                                        position: 'bottom-center',
                                                        icon: <LucideShoppingBag size={16} className="text-green-500" />,
                                                    });
                                                }}
                                                onUpdateQuantity={(delta) => updateQuantity(cartKey, delta)}
                                                colorHex="#ea580c"
                                                size="lg"
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}
            </main>
        </div>
    );
}
