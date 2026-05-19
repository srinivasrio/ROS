'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCart } from '@/app/context/CartContext';
import { HomepageBuilderService } from '@/app/services/homepage-builder.service';
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
import { SharedSkeleton } from '@/app/components/customer/SharedSkeleton';
import SharedQuantityControl from '@/app/components/shared/SharedQuantityControl';

export default function AllCombosPage() {
    const params = useParams();
    const router = useRouter();
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

                            return (
                                <motion.div
                                    key={combo.id || idx}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm"
                                >
                                    {/* Image */}
                                    <div
                                        className="relative h-44 w-full cursor-pointer"
                                        onClick={() => setSelectedCombo(combo)}
                                    >
                                        <img
                                            src={combo.image_url || '/placeholder-food.jpg'}
                                            alt={combo.title}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                                        <div className="absolute top-3 left-3">
                                            <span className="px-2.5 py-1 bg-orange-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-orange-500/30">
                                                Combo Offer
                                            </span>
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
                                            <div className="mb-3 space-y-1.5">
                                                {previewItems.map((item: any, siIdx: number) => {
                                                    const itemName = item.menu_item?.name || item.name || item.title || 'Combo Item';
                                                    return (
                                                        <div key={siIdx} className="flex items-center gap-2 text-xs text-black">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                                                            <span className="font-medium truncate">{itemName}</span>
                                                            {item.quantity > 1 && (
                                                                <span className="text-[10px] text-black font-bold">×{item.quantity}</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                {itemsCount > 3 && (
                                                    <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest pl-3.5">
                                                        +{itemsCount - 3} more items
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* Price + Cart Controls */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <div className="flex items-end gap-2">
                                                    <span className="text-xl font-black text-orange-600">₹{combo.price}</span>
                                                    {mrp > combo.price && (
                                                        <span className="text-sm font-bold text-black line-through mb-1">₹{mrp}</span>
                                                    )}
                                                </div>
                                            </div>

                                            <SharedQuantityControl
                                                qty={qty}
                                                onAdd={() => {
                                                    addSpecialToCart(combo);
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

            {/* Combo Detail Modal */}
            <AnimatePresence>
                {selectedCombo && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
                        onClick={() => setSelectedCombo(null)}
                    >
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="bg-white rounded-t-[2rem] w-full max-w-md max-h-[85vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Modal Image */}
                            <div className="relative h-56">
                                <img
                                    src={selectedCombo.image_url || '/placeholder-food.jpg'}
                                    alt={selectedCombo.title}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                <button
                                    onClick={() => setSelectedCombo(null)}
                                    className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur-md rounded-full"
                                >
                                    <LucideX size={18} className="text-black" />
                                </button>
                                <div className="absolute bottom-4 left-4 right-4">
                                    <span className="px-2 py-0.5 bg-orange-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg mb-2 inline-block">
                                        Combo Offer
                                    </span>
                                    <h2 className="text-white font-black text-2xl">{selectedCombo.title}</h2>
                                </div>
                            </div>

                            {/* Modal Content */}
                            <div className="p-5 space-y-4">
                                {selectedCombo.description && (
                                    <p className="text-black text-sm">{selectedCombo.description}</p>
                                )}

                                {/* Items List */}
                                {selectedCombo.items && selectedCombo.items.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-black text-black uppercase tracking-widest mb-2">Included Items</h4>
                                        <div className="space-y-2">
                                            {selectedCombo.items.map((item: any, idx: number) => {
                                                const itemName = item.menu_item?.name || item.name || 'Item';
                                                const itemPrice = item.menu_item?.price;
                                                const itemImage = item.menu_item?.image_url;
                                                return (
                                                    <div key={idx} className="flex items-center gap-3 p-2 bg-gray-50 rounded-xl">
                                                        <div className="size-12 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                                                            {itemImage ? (
                                                                <img src={itemImage} alt={itemName} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-black">
                                                                    <LucidePackage size={16} />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-bold text-black text-sm truncate">{itemName}</p>
                                                            {itemPrice && <p className="text-xs text-black">₹{itemPrice}</p>}
                                                        </div>
                                                        {item.quantity > 1 && (
                                                            <span className="text-xs font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-md">
                                                                ×{item.quantity}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Price + Add */}
                                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                    {(() => {
                                        const mrp = selectedCombo.items?.reduce((sum: number, i: any) => sum + ((i.menu_item?.price || i.price || 0) * (i.quantity || 1)), 0) || 0;
                                        return (
                                            <div>
                                                <p className="text-[10px] font-bold text-black uppercase tracking-widest">Combo Price</p>
                                                <div className="flex items-end gap-2">
                                                    <span className="text-2xl font-black text-orange-600">₹{selectedCombo.price}</span>
                                                    {mrp > selectedCombo.price && (
                                                        <span className="text-sm font-bold text-black line-through mb-1">₹{mrp}</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    {(() => {
                                        const cartKey = `special-${selectedCombo.id}`;
                                        const qty = getItemQtyInCart(cartKey);
                                        return <SharedQuantityControl
                                            qty={qty}
                                            onAdd={() => {
                                                addSpecialToCart(selectedCombo);
                                                toast.success(`${selectedCombo.title} added to cart`, {
                                                    duration: 2000,
                                                    position: 'bottom-center',
                                                    icon: <LucideShoppingBag size={16} className="text-green-500" />,
                                                });
                                            }}
                                            onUpdateQuantity={(delta) => updateQuantity(cartKey, delta)}
                                            colorHex="#ea580c"
                                            size="lg"
                                        />;
                                    })()}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
