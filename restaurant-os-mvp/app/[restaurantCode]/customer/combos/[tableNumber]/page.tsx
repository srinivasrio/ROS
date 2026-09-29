'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { HomepageBuilderService } from '@/services/homepage-builder.service';
import {
    ChevronLeft as LucideChevronLeft,
    Package as LucidePackage,
    Plus as LucidePlus,
    Minus as LucideMinus,
    ShoppingBag as LucideShoppingBag,
    X as LucideX,
    Heart as LucideHeart
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { SharedSkeleton } from '@/components/customer/SharedSkeleton';
import SharedQuantityControl from '@/components/shared/SharedQuantityControl';
import { SharedComboDetailModal, VegNonVegBadge } from '@/components/shared/details';
import { getCategoryMenuItemImage } from '@/lib/utils';

export default function AllCombosPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const idParam = searchParams?.get('id') || searchParams?.get('combo');
    const restaurantId = (params.restaurantCode || params.restaurantId) as string;
    const tableNumber = params.tableNumber as string;

    const { addSpecialToCart, updateQuantity, cart, setTableNumber } = useCart();

    const [combos, setCombos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCombo, setSelectedCombo] = useState<any>(null);

    const getItemQtyInCart = (id: string) => cart[String(id)]?.quantity || 0;

    useEffect(() => {
        if (tableNumber) setTableNumber(tableNumber);
    }, [tableNumber, setTableNumber]);

    const handledComboParamRef = useRef<string | null>(null);

    const clearComboParam = useCallback(() => {
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            if (url.searchParams.has('id') || url.searchParams.has('combo')) {
                url.searchParams.delete('id');
                url.searchParams.delete('combo');
                const cleanSearch = url.searchParams.toString();
                const cleanUrl = url.pathname + (cleanSearch ? `?${cleanSearch}` : '');
                window.history.replaceState(null, '', cleanUrl);
                router.replace(cleanUrl, { scroll: false });
            }
        }
    }, [router]);

    useEffect(() => {
        if (!idParam) {
            handledComboParamRef.current = null;
        }
    }, [idParam]);

    // Automatically open the exact combo record if redirected from banner (ONCE per navigation)
    useEffect(() => {
        if (!idParam || combos.length === 0) return;
        if (handledComboParamRef.current === String(idParam)) return;

        const found = combos.find(c => 
            String(c.id) === String(idParam) ||
            c.title?.toLowerCase() === String(idParam).toLowerCase() ||
            c.name?.toLowerCase() === String(idParam).toLowerCase()
        );
        if (found) {
            handledComboParamRef.current = String(idParam);
            setSelectedCombo(found);
            clearComboParam();
        } else if (!loading) {
            handledComboParamRef.current = String(idParam);
            clearComboParam();
            toast.error('The selected combo is no longer available');
        }
    }, [idParam, combos, loading, clearComboParam]);

    useEffect(() => {
        const loadCombos = async () => {
            try {
                const data = await HomepageBuilderService.getCombos(restaurantId, true);
                setCombos(data || []);
            } catch (err) {
                console.error('Failed to load combos:', err);
            } finally {
                setLoading(false);
            }
        };
        loadCombos();
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
                        <h1 className="text-lg font-black text-black tracking-tight">Combo Offers</h1>
                        <p className="text-[10px] font-bold text-black uppercase tracking-widest">
                            {combos.length} {combos.length === 1 ? 'combo' : 'combos'} available
                        </p>
                    </div>
                    <div className="p-2 bg-gradient-to-br from-purple-50 to-orange-50 rounded-xl">
                        <LucidePackage size={20} className="text-orange-500" />
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="p-4 space-y-4">
                {combos.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="inline-block p-5 rounded-2xl bg-purple-50 mb-4">
                            <LucidePackage className="text-purple-300" size={40} />
                        </div>
                        <h3 className="text-lg font-bold text-black mb-1">No combos available</h3>
                        <p className="text-black text-sm">Check back later for new combo deals!</p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {combos.map((combo, idx) => {
                            const cartKey = `special-${combo.id}`;
                            const qty = getItemQtyInCart(cartKey);
                            const itemsCount = combo.items?.length || 0;
                            const previewItems = combo.items?.slice(0, 3) || [];
                            const mrp = combo.items?.reduce((sum: number, i: any) => sum + ((i.menu_item?.price || i.price || 0) * (i.quantity || 1)), 0) || 0;
                            const rawOriginalPrice = Number(combo.original_price || combo.originalPrice || 0);
                            const totalOriginalPrice = rawOriginalPrice > 0 ? rawOriginalPrice : mrp;
                            const offerPrice = Number(combo.price ?? combo.special_price ?? 0);
                            const savings = totalOriginalPrice > offerPrice ? totalOriginalPrice - offerPrice : 0;

                            return (
                                <motion.div
                                    key={combo.id || idx}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm"
                                >
                                    {/* Standardized 16:9 Image */}
                                    <div
                                        className="relative aspect-[16/9] w-full cursor-pointer overflow-hidden"
                                        onClick={() => {
                                            clearComboParam();
                                            setSelectedCombo(combo);
                                        }}
                                    >
                                        <img
                                            src={combo.image_url || '/placeholder-food.jpg'}
                                            alt={combo.title}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                                        <div className="absolute top-3 left-3 flex items-center gap-1.5">
                                            <span className="px-2.5 py-1 bg-orange-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-orange-500/30">
                                                Combo Offer
                                            </span>
                                            {savings > 0 && (
                                                <span className="px-2.5 py-1 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-emerald-600/30">
                                                    Save ₹{savings}
                                                </span>
                                            )}
                                        </div>
                                        <div className="absolute top-3 right-3">
                                            <button className="p-2 bg-white/80 backdrop-blur-md rounded-full" onClick={e => e.stopPropagation()}>
                                                <LucideHeart size={14} className="text-black" />
                                            </button>
                                        </div>
                                        <div className="absolute bottom-3 left-3 right-3">
                                            <h3 className="text-white font-black text-lg leading-tight drop-shadow-md">{combo.title}</h3>
                                            {combo.description && (
                                                <p className="text-white/80 text-xs mt-0.5 line-clamp-1">{combo.description}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="p-4">
                                        {/* Items preview */}
                                        {itemsCount > 0 && (
                                            <div className="mb-4 space-y-2">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black px-1 mb-2">Includes</p>
                                                {combo.items?.map((si: any, siIdx: number) => {
                                                    const itemName = si.menu_item?.name || si.name || si.title || 'Combo Item';
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
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <div className="flex items-end gap-2">
                                                    <span className="text-xl font-black text-orange-600">₹{offerPrice}</span>
                                                    {totalOriginalPrice > offerPrice && (
                                                        <span className="text-sm font-bold text-slate-400 line-through mb-0.5">₹{totalOriginalPrice}</span>
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
                                                    addSpecialToCart({ ...combo, price: offerPrice, original_price: totalOriginalPrice > 0 ? totalOriginalPrice : undefined });
                                                    toast.success(`${combo.title} added to cart`, {
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

            {/* Standardized Luxury Combo Detail Modal */}
            <SharedComboDetailModal
                combo={selectedCombo}
                onClose={() => {
                    setSelectedCombo(null);
                    clearComboParam();
                }}
                onAddToCart={(combo) => {
                    const offerPrice = Number(combo.price ?? combo.special_price ?? 0);
                    const itemsSum = combo.items?.reduce((sum: number, i: any) => sum + ((i.menu_item?.price || i.price || 0) * (i.quantity || 1)), 0) || 0;
                    const rawOriginalPrice = Number(combo.original_price || combo.originalPrice || 0);
                    const totalOriginalPrice = rawOriginalPrice > 0 ? rawOriginalPrice : itemsSum;

                    addSpecialToCart({
                        ...combo,
                        price: offerPrice,
                        original_price: totalOriginalPrice > 0 ? totalOriginalPrice : undefined,
                    });
                    toast.success(`${combo.title} added to cart`, {
                        duration: 2000,
                        position: 'bottom-center',
                        icon: <LucideShoppingBag size={16} className="text-green-500" />,
                    });
                }}
                onUpdateQuantity={(cartKey, delta) => updateQuantity(cartKey, delta)}
                cartQuantity={selectedCombo ? getItemQtyInCart(`special-${selectedCombo.id}`) : 0}
                currencySymbol="₹"
            />
        </div>
    );
}
