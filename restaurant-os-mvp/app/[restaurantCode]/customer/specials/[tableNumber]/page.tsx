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
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    onClick={() => {
                                        clearSpecialParam();
                                        setSelectedSpecial(item);
                                    }}
                                    className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                                >
                                    {/* Standardized 16:9 Image */}
                                    <div className="relative aspect-[16/9] w-full overflow-hidden">
                                        <img
                                            src={item.image_url || '/placeholder-food.jpg'}
                                            alt={item.title}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                                        <div className="absolute top-3 left-3 flex items-center gap-1.5">
                                            <span className="px-2.5 py-1 bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-amber-500/30">
                                                Chef&apos;s Choice
                                            </span>
                                            {savings > 0 && (
                                                <span className="px-2.5 py-1 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-emerald-600/30">
                                                    Save ₹{savings}
                                                </span>
                                            )}
                                        </div>
                                        <div className="absolute top-3 right-3">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                }}
                                                className="p-2 bg-white/80 backdrop-blur-md rounded-full"
                                            >
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
                                            <div className="mb-4 space-y-2">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black px-1 mb-2">Includes</p>
                                                {item.items.map((si: any, siIdx: number) => {
                                                    const itemName = si.menu_item?.name || si.name || 'Item';
                                                    const itemImage = si.menu_item?.image_url || getCategoryMenuItemImage(itemName);
                                                    const itemPrice = si.menu_item?.price || si.price || 0;
                                                    
                                                    return (
                                                        <div key={si.id || siIdx} className="flex gap-3 items-center bg-neutral-50/50 p-2 rounded-xl border border-neutral-100/50">
                                                            <div className="size-12 bg-white rounded-lg flex-shrink-0 overflow-hidden border border-neutral-100">
                                                                <img src={itemImage} alt={itemName} className="w-full h-full object-cover" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className="font-bold text-black text-xs tracking-tight truncate">{itemName}</h4>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className="text-[10px] font-black text-black bg-white px-1.5 py-0.5 rounded border border-neutral-100">QTY: {si.quantity || 1}</span>
                                                                    <span className="text-[10px] font-bold text-black">₹{itemPrice} each</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Price + Cart Controls */}
                                        <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex flex-col">
                                                <div className="flex items-end gap-2">
                                                    <span className="text-xl font-black text-orange-600">₹{offerPrice}</span>
                                                    {originalPrice > offerPrice && (
                                                        <span className="text-sm font-bold text-slate-400 line-through mb-0.5">₹{originalPrice}</span>
                                                    )}
                                                </div>
                                                {savings > 0 && (
                                                    <span className="text-[10px] font-bold text-emerald-600 leading-none mt-0.5">
                                                        Save ₹{savings}
                                                    </span>
                                                )}
                                            </div>

                                            <SharedQuantityControl
                                                qty={qty}
                                                onAdd={() => {
                                                    addSpecialToCart(item);
                                                    toast.success(`${item.title || item.name || 'Special'} added to cart`, {
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
