'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { HomepageBuilderService } from '@/services/homepage-builder.service';
import { 
    ChevronLeft as LucideChevronLeft, 
    Flame as LucideFlame, 
    ShoppingBag as LucideShoppingBag, 
    Plus as LucidePlus, 
    Minus as LucideMinus, 
    Heart as LucideHeart,
    X as LucideX
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { SharedSkeleton } from '@/components/customer/SharedSkeleton';
import SharedQuantityControl from '@/components/shared/SharedQuantityControl';
import { SharedSpecialDetailModal, VegNonVegBadge } from '@/components/shared/details';
import { getCategoryMenuItemImage } from '@/lib/utils';

export default function AllSpecialsPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const idParam = searchParams?.get('id') || searchParams?.get('special');
    const restaurantId = (params.restaurantCode || params.restaurantId) as string;
    const tableNumber = params.tableNumber as string;

    const { addToCart, addSpecialToCart, updateQuantity, cart, setTableNumber } = useCart();

    const [specials, setSpecials] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSpecial, setSelectedSpecial] = useState<any>(null);

    const getItemQtyInCart = (id: string) => cart[String(id)]?.quantity || 0;

    useEffect(() => {
        if (tableNumber) setTableNumber(tableNumber);
    }, [tableNumber, setTableNumber]);

    const handledSpecialParamRef = useRef<string | null>(null);

    const clearSpecialParam = useCallback(() => {
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            if (url.searchParams.has('id') || url.searchParams.has('special')) {
                url.searchParams.delete('id');
                url.searchParams.delete('special');
                const cleanSearch = url.searchParams.toString();
                const cleanUrl = url.pathname + (cleanSearch ? `?${cleanSearch}` : '');
                window.history.replaceState(null, '', cleanUrl);
                router.replace(cleanUrl, { scroll: false });
            }
        }
    }, [router]);

    useEffect(() => {
        if (!idParam) {
            handledSpecialParamRef.current = null;
        }
    }, [idParam]);

    // Automatically open the exact special record if redirected from banner (ONCE per navigation)
    useEffect(() => {
        if (!idParam || specials.length === 0) return;
        if (handledSpecialParamRef.current === String(idParam)) return;

        const found = specials.find(s => 
            String(s.id) === String(idParam) ||
            s.title?.toLowerCase() === String(idParam).toLowerCase() ||
            s.name?.toLowerCase() === String(idParam).toLowerCase()
        );
        if (found) {
            handledSpecialParamRef.current = String(idParam);
            setSelectedSpecial(found);
            clearSpecialParam();
        } else if (!loading) {
            handledSpecialParamRef.current = String(idParam);
            clearSpecialParam();
            toast.error('The selected special is no longer available');
        }
    }, [idParam, specials, loading, clearSpecialParam]);

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
                </div>
            </header>

            {/* Content */}
            <main className="p-3 sm:p-4">
                {specials.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="inline-block p-5 rounded-2xl bg-amber-50 mb-4">
                            <LucideFlame className="text-amber-300" size={40} />
                        </div>
                        <h3 className="text-lg font-bold text-black mb-1">No specials today</h3>
                        <p className="text-black text-sm">Check back later for new chef picks!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2.5 sm:gap-4 items-stretch">
                        <AnimatePresence>
                            {specials.map((item, idx) => {
                                const isTodaySpecial = item.is_today_special;
                                const cartKey = `special-${item.id}`;
                                const qty = getItemQtyInCart(cartKey) || getItemQtyInCart(item.id);
                                const mrp = item.items?.reduce((sum: number, i: any) => sum + ((i.menu_item?.price || i.price || 0) * (i.quantity || 1)), 0) || 0;
                                const offerPrice = (item.special_price !== undefined && item.special_price !== null && Number(item.special_price) > 0)
                                    ? Number(item.special_price)
                                    : Number(item.price || 0);
                                const rawOriginalPrice = Number(item.original_price || item.originalPrice || 0);
                                const originalPrice = rawOriginalPrice > 0
                                    ? rawOriginalPrice
                                    : (mrp > offerPrice ? mrp : (Number(item.price) > offerPrice ? Number(item.price) : 0));
                                const savings = originalPrice > offerPrice ? originalPrice - offerPrice : 0;

                                return (
                                    <motion.div
                                        key={item.id || idx}
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.04 }}
                                        onClick={() => {
                                            clearSpecialParam();
                                            setSelectedSpecial(item);
                                        }}
                                        style={{ backgroundColor: '#B2D959' }}
                                        className="h-full rounded-2xl overflow-hidden border border-[#9fc44b] shadow-xs cursor-pointer hover:shadow-md transition-all flex flex-col justify-between"
                                    >
                                        {/* 16:9 Image */}
                                        <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-black/5">
                                            <img
                                                src={item.image_url || '/placeholder-food.jpg'}
                                                alt={item.title}
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                                            <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                                                <span className="px-2 py-0.5 bg-amber-500 text-white text-[8px] sm:text-[9px] font-black uppercase tracking-wider rounded-md shadow-xs">
                                                    Chef&apos;s Choice
                                                </span>
                                                {savings > 0 && (
                                                    <span className="px-2 py-0.5 bg-emerald-600 text-white text-[8px] sm:text-[9px] font-black uppercase tracking-wider rounded-md shadow-xs">
                                                        Save ₹{savings}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="absolute top-2 right-2 z-10">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                    }}
                                                    className="p-1.5 bg-white/80 backdrop-blur-md rounded-full text-slate-800 hover:text-rose-500 transition-colors"
                                                >
                                                    <LucideHeart size={12} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Info */}
                                        <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between">
                                            <div>
                                                <h3 className="text-slate-900 font-black text-xs sm:text-sm leading-snug line-clamp-1 h-4 sm:h-5">
                                                    {item.title}
                                                </h3>
                                                <p className="text-[11px] text-slate-800/80 font-medium mt-0.5 line-clamp-1 min-h-[16px]">
                                                    {item.description || '\u00A0'}
                                                </p>
                                                <div className="mt-1 min-h-[20px] flex items-center">
                                                    {item.items && item.items.length > 0 ? (
                                                        <span className="text-[9px] font-black text-slate-900 bg-white/60 px-1.5 py-0.5 rounded-md border border-black/10">
                                                            {item.items.length} {item.items.length === 1 ? 'item' : 'items'} included
                                                        </span>
                                                    ) : (
                                                        <span className="text-[9px] opacity-0 select-none px-1.5 py-0.5">&nbsp;</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Price + Cart Controls */}
                                            <div className="mt-2.5 pt-2 border-t border-black/10 flex items-center justify-between gap-1 h-[36px]" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex flex-col min-w-0 justify-center">
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-sm sm:text-base font-black text-slate-900">₹{offerPrice}</span>
                                                        {originalPrice > offerPrice && (
                                                            <span className="text-[10px] sm:text-xs font-bold text-slate-700 line-through">₹{originalPrice}</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <SharedQuantityControl
                                                    qty={qty}
                                                    onAdd={() => {
                                                        addSpecialToCart(item);
                                                        toast.success(`${item.title || item.name || 'Special'} added to cart`, {
                                                            duration: 2000,
                                                            position: 'bottom-center',
                                                            icon: <LucideShoppingBag size={14} className="text-green-500" />,
                                                        });
                                                    }}
                                                    onUpdateQuantity={(delta) => updateQuantity(cartKey, delta)}
                                                    colorHex="#0f172a"
                                                    size="sm"
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </main>

            {/* Standardized Luxury Special Detail Modal */}
            <SharedSpecialDetailModal
                special={selectedSpecial}
                onClose={() => {
                    setSelectedSpecial(null);
                    clearSpecialParam();
                }}
                onAddToCart={(item) => {
                    addSpecialToCart(item);
                    toast.success(`${item.title || item.name || 'Special'} added to cart`, {
                        duration: 2000,
                        position: 'bottom-center',
                        icon: <LucideShoppingBag size={16} className="text-green-500" />,
                    });
                }}
                onUpdateQuantity={(cartKey, delta) => updateQuantity(cartKey, delta)}
                cartQuantity={selectedSpecial ? (getItemQtyInCart(`special-${selectedSpecial.id}`) || getItemQtyInCart(selectedSpecial.id)) : 0}
                currencySymbol="₹"
                colorHex="#ea580c"
            />
        </div>
    );
}
