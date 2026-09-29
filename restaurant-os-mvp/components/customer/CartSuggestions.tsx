'use client';

import React, { useState } from 'react';
import { Plus, Minus, ChevronDown } from 'lucide-react';
import { getCategoryMenuItemImage } from '@/lib/utils';
import { toast } from 'sonner';

interface CartSuggestionsProps {
    combos: any[];
    todaySpecials: any[];
    cart: Record<string, any>;
    onAddCombo: (combo: any) => void;
    onAddSpecial: (special: any) => void;
    onIncrement: (key: string) => void;
    onDecrement: (key: string) => void;
    currencySymbol?: string;
}

export default function CartSuggestions({
    combos = [],
    todaySpecials = [],
    cart = {},
    onAddCombo,
    onAddSpecial,
    onIncrement,
    onDecrement,
    currencySymbol = '₹',
}: CartSuggestionsProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Deduplicate combos by title/id
    const uniqueCombos = React.useMemo(() => {
        const seen = new Set<string>();
        return (combos || []).filter((c) => {
            const key = (c.title || c.name || c.id || '').toLowerCase().trim();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [combos]);

    // Deduplicate specials by title/id
    const uniqueSpecials = React.useMemo(() => {
        const seen = new Set<string>();
        return (todaySpecials || []).filter((s) => {
            const key = (s.title || s.name || s.id || '').toLowerCase().trim();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [todaySpecials]);

    const hasCombos = uniqueCombos.length > 0;
    const hasSpecials = uniqueSpecials.length > 0;

    if (!hasCombos && !hasSpecials) {
        return null;
    }

    const findCartItemKey = (id: string | number): string => {
        const sid = String(id);
        const clean = sid.replace(/^(special|combo)-/, '');
        if (cart[`special-${clean}`]) return `special-${clean}`;
        if (cart[`combo-${clean}`]) return `combo-${clean}`;
        if (cart[clean]) return clean;
        if (cart[sid]) return sid;
        const found = Object.values(cart).find(
            (it: any) => String(it.specialId) === clean || String(it.combo_id) === clean || String(it.menu_item_id) === clean || String(it.menu_item_id) === `special-${clean}` || String(it.menu_item_id) === `combo-${clean}`
        );
        if (found) return String(found.menu_item_id);
        return `special-${clean}`;
    };

    const getItemQuantity = (id: string | number): number => {
        const key = findCartItemKey(id);
        return cart[key]?.quantity || 0;
    };

    return (
        <section className="my-3 space-y-2.5">
            {/* Animated Highlighted Header for Suggested Items (Text animation only, no icons, no filters) */}
            <div className="px-1 py-0.5 flex items-center">
                <h3 className="text-xs sm:text-sm font-black tracking-tight bg-gradient-to-r from-orange-600 via-amber-400 via-rose-500 to-orange-600 bg-clip-text text-transparent animate-text-shimmer animate-text-glow inline-block">
                    Suggested Items
                </h3>
            </div>

            {/* Horizontal Scroll Track - Separate Independent Standalone Cards */}
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1 overscroll-x-contain items-start">
                {/* ─── Combos Cards ─── */}
                {uniqueCombos.map((combo) => {
                        const title = combo.title || combo.name || 'Value Combo';
                        const bannerImg = combo.image_url || combo.imageUrl || combo.image || (combo.items?.[0]?.menu_item?.image_url) || getCategoryMenuItemImage(title);
                        const price = Number(combo.price || combo.special_price || 0);
                        const originalPrice = Number(combo.original_price || combo.originalPrice || 0);
                        const hasDiscount = originalPrice > price;
                        const savings = hasDiscount ? originalPrice - price : 0;
                        const comboCartKey = findCartItemKey(combo.id);
                        const qty = getItemQuantity(combo.id);

                        // Extract sub-items with images and prices
                        const subItems = (combo.items || []).map((it: any) => {
                            const subName = it.menu_item?.name || it.name || 'Item';
                            const subImg = it.menu_item?.image_url || it.image_url || getCategoryMenuItemImage(subName);
                            const isNonVeg = it.menu_item?.item_type === 'Non-Veg' || subName.toLowerCase().includes('chicken') || subName.toLowerCase().includes('mutton') || subName.toLowerCase().includes('fish') || subName.toLowerCase().includes('prawn');
                            const subPrice = Number(it.menu_item?.price ?? it.price ?? 0);
                            return {
                                name: subName,
                                quantity: it.quantity || 1,
                                image_url: subImg,
                                isNonVeg,
                                price: subPrice,
                            };
                        });

                        const comboKey = `combo-${combo.id}`;
                        const isExpanded = expandedId === comboKey;

                        return (
                            <div
                                key={comboKey}
                                className="w-[185px] sm:w-[205px] shrink-0 flex flex-col bg-white rounded-xl border border-purple-200/80 shadow-xs hover:shadow-md transition-all overflow-hidden group"
                            >
                                {/* Banner Image (Reduced height by ~30px) */}
                                <div className="relative h-[76px] sm:h-[84px] w-full bg-slate-100 overflow-hidden">
                                    <img
                                        src={bannerImg}
                                        alt={title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        onError={(e) => {
                                            const target = e.currentTarget;
                                            const fallback = getCategoryMenuItemImage(title);
                                            if (target.src !== fallback && !target.src.endsWith(fallback)) {
                                                target.src = fallback;
                                            }
                                        }}
                                    />
                                    {/* Badges */}
                                    <div className="absolute top-1 left-1 z-10">
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8.5px] font-black bg-purple-600/95 text-white backdrop-blur-md shadow-2xs">
                                            <span>Combo</span>
                                        </span>
                                    </div>
                                    {hasDiscount && (
                                        <div className="absolute top-1 right-1 z-10">
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8.5px] font-black bg-emerald-600/95 text-white backdrop-blur-md shadow-2xs">
                                                Save {currencySymbol}{savings}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Body */}
                                <div className="p-2 sm:p-2.5 flex-1 flex flex-col justify-between">
                                    <div>
                                        <h4 className="font-bold text-slate-900 text-xs line-clamp-1 group-hover:text-purple-700 transition-colors">
                                            {title}
                                        </h4>

                                        {/* Individual items breakdown with photos & prices */}
                                        {subItems.length > 0 && (
                                            <div className="mt-1.5 space-y-1.5">
                                                <div className="space-y-1 pt-1">
                                                    {(isExpanded ? subItems : subItems.slice(0, 2)).map((si: any, sIdx: number) => (
                                                        <div
                                                            key={sIdx}
                                                            className="flex items-center gap-1.5 p-1 rounded-md bg-slate-50 border border-slate-100"
                                                        >
                                                            <div className="size-7 rounded overflow-hidden bg-slate-200 shrink-0 relative border border-slate-200/60">
                                                                <img
                                                                    src={si.image_url}
                                                                    alt={si.name}
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => {
                                                                        const target = e.currentTarget;
                                                                        const fallback = getCategoryMenuItemImage(si.name);
                                                                        if (target.src !== fallback && !target.src.endsWith(fallback)) {
                                                                            target.src = fallback;
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                                <span className="text-[10px] font-bold text-slate-800 truncate block leading-tight">
                                                                    {si.name}
                                                                </span>
                                                                <span className="text-[8.5px] font-semibold text-slate-500 mt-0.5">
                                                                    Qty: {si.quantity}
                                                                </span>
                                                            </div>
                                                            {si.price > 0 && (
                                                                <span className="text-[9.5px] font-black text-purple-700 font-display shrink-0 pr-1">
                                                                    {currencySymbol}{si.price}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>

                                                {subItems.length > 2 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedId(isExpanded ? null : comboKey)}
                                                        className="w-full flex items-center justify-center gap-1 text-[9.5px] font-extrabold text-purple-600 bg-purple-50 hover:bg-purple-100 py-1.5 rounded-md border border-purple-200/80 transition-all cursor-pointer active:scale-95 shadow-2xs"
                                                    >
                                                        <span>{isExpanded ? 'Minimize' : `View all ${subItems.length} items`}</span>
                                                        <ChevronDown
                                                            size={12}
                                                            className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                                        />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Bottom Price & Add Stepper */}
                                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100">
                                        <div className="flex items-baseline gap-1">
                                            <span className="font-display font-black text-xs sm:text-sm text-slate-900">
                                                {currencySymbol}{price}
                                            </span>
                                            {hasDiscount && (
                                                <span className="text-[9.5px] text-slate-400 line-through">
                                                    {currencySymbol}{originalPrice}
                                                </span>
                                            )}
                                        </div>

                                        {qty > 0 ? (
                                            <div className="inline-flex items-center gap-1 bg-purple-100/80 border border-purple-300 rounded-lg p-0.5 shadow-2xs">
                                                <button
                                                    onClick={() => onDecrement(comboCartKey)}
                                                    aria-label="Decrease quantity"
                                                    className="size-4.5 rounded-md bg-purple-600 text-white hover:bg-purple-700 flex items-center justify-center shadow-2xs transition-all active:scale-90 cursor-pointer"
                                                >
                                                    <Minus size={10} strokeWidth={3} />
                                                </button>
                                                <span className="font-extrabold text-[10px] text-purple-950 min-w-[12px] text-center">
                                                    {qty}
                                                </span>
                                                <button
                                                    onClick={() => onIncrement(comboCartKey)}
                                                    aria-label="Increase quantity"
                                                    className="size-4.5 rounded-md bg-purple-600 text-white hover:bg-purple-700 flex items-center justify-center shadow-2xs transition-all active:scale-90 cursor-pointer"
                                                >
                                                    <Plus size={10} strokeWidth={3} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    onAddCombo(combo);
                                                    toast.success(`Added "${title}" combo to cart!`);
                                                }}
                                                className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg font-black text-[9.5px] bg-purple-600 hover:bg-purple-700 text-white shadow-2xs active:scale-95 transition-all cursor-pointer"
                                            >
                                                <Plus size={10} strokeWidth={3} />
                                                <span>ADD</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                {/* ─── Today's Specials Cards ─── */}
                {uniqueSpecials.map((special) => {
                        const title = special.title || special.name || "Chef's Special";
                        const img = special.image_url || special.imageUrl || special.image || getCategoryMenuItemImage(title);
                        const price = Number(special.special_price || special.price || 0);
                        const originalPrice = Number(special.original_price || (special.special_price ? special.price : 0) || 0);
                        const hasDiscount = originalPrice > price;
                        const savings = hasDiscount ? originalPrice - price : 0;
                        const isVeg = special.is_veg === true || special.item_type === 'Veg' || special.item_type === 'vegetarian';
                        const specialCartKey = findCartItemKey(special.id);
                        const qty = getItemQuantity(special.id);

                        // Constituents if special has included items
                        const specialItems = (special.items || []).map((it: any) => {
                            const subName = it.menu_item?.name || it.name || 'Item';
                            const subImg = it.menu_item?.image_url || it.image_url || getCategoryMenuItemImage(subName);
                            const subPrice = Number(it.menu_item?.price ?? it.price ?? 0);
                            return {
                                name: subName,
                                quantity: it.quantity || 1,
                                image_url: subImg,
                                price: subPrice,
                            };
                        });

                        const specialKey = `special-${special.id}`;
                        const isExpanded = expandedId === specialKey;
                        const hasExpandableContent = specialItems.length > 0 || !!special.description;

                        return (
                            <div
                                key={specialKey}
                                className={`${specialItems.length > 0 ? 'w-[185px] sm:w-[205px]' : 'w-[150px] sm:w-[165px]'} shrink-0 flex flex-col bg-white rounded-xl border border-orange-200/80 shadow-xs hover:shadow-md transition-all overflow-hidden group`}
                            >
                                {/* Banner Image (Reduced height by ~30px) */}
                                <div className="relative h-[76px] sm:h-[84px] w-full bg-slate-100 overflow-hidden">
                                    <img
                                        src={img}
                                        alt={title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        onError={(e) => {
                                            const target = e.currentTarget;
                                            const fallback = getCategoryMenuItemImage(title);
                                            if (target.src !== fallback && !target.src.endsWith(fallback)) {
                                                target.src = fallback;
                                            }
                                        }}
                                    />
                                    {/* Badges */}
                                    <div className="absolute top-1 left-1 z-10 flex items-center gap-1">
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8.5px] font-black bg-orange-600/95 text-white backdrop-blur-md shadow-2xs">
                                            <span>Special</span>
                                        </span>
                                        <span
                                            className={`size-1.5 rounded-full ring-1 ring-white/80 ${
                                                isVeg ? 'bg-emerald-500' : 'bg-rose-500'
                                            }`}
                                        />
                                    </div>
                                    {hasDiscount && (
                                        <div className="absolute top-1 right-1 z-10">
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8.5px] font-black bg-emerald-600/95 text-white backdrop-blur-md shadow-2xs">
                                                Save {currencySymbol}{savings}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Body */}
                                <div className="p-2 sm:p-2.5 flex-1 flex flex-col justify-between">
                                    <div>
                                        <h4 className="font-bold text-slate-900 text-xs line-clamp-1 group-hover:text-orange-600 transition-colors">
                                            {title}
                                        </h4>

                                        {/* Platter / Special items breakdown with individual prices & photos */}
                                        {specialItems.length > 0 ? (
                                            <div className="mt-1.5 space-y-1.5">
                                                <div className="space-y-1 pt-1">
                                                    {(isExpanded ? specialItems : specialItems.slice(0, 2)).map((si: any, sIdx: number) => (
                                                        <div
                                                            key={sIdx}
                                                            className="flex items-center gap-1.5 p-1 rounded-md bg-slate-50 border border-slate-100"
                                                        >
                                                            <div className="size-7 rounded overflow-hidden bg-slate-200 shrink-0 relative border border-slate-200/60">
                                                                <img
                                                                    src={si.image_url}
                                                                    alt={si.name}
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => {
                                                                        const target = e.currentTarget;
                                                                        const fallback = getCategoryMenuItemImage(si.name);
                                                                        if (target.src !== fallback && !target.src.endsWith(fallback)) {
                                                                            target.src = fallback;
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                                <span className="text-[10px] font-bold text-slate-800 truncate block leading-tight">
                                                                    {si.name}
                                                                </span>
                                                                <span className="text-[8.5px] font-semibold text-slate-500 mt-0.5">
                                                                    Qty: {si.quantity}
                                                                </span>
                                                            </div>
                                                            {si.price > 0 && (
                                                                <span className="text-[9.5px] font-black text-orange-600 font-display shrink-0 pr-1">
                                                                    {currencySymbol}{si.price}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>

                                                {specialItems.length > 2 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedId(isExpanded ? null : specialKey)}
                                                        className="w-full flex items-center justify-center gap-1 text-[9.5px] font-extrabold text-orange-600 bg-orange-50 hover:bg-orange-100 py-1.5 rounded-md border border-orange-200/80 transition-all cursor-pointer active:scale-95 shadow-2xs"
                                                    >
                                                        <span>{isExpanded ? 'Minimize' : `View all ${specialItems.length} items`}</span>
                                                        <ChevronDown
                                                            size={12}
                                                            className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                                        />
                                                    </button>
                                                )}
                                            </div>
                                        ) : special.description ? (
                                            <p className="text-[9.5px] text-slate-500 mt-1 line-clamp-2 leading-tight">
                                                {special.description}
                                            </p>
                                        ) : null}
                                    </div>

                                    {/* Bottom Price & Add Stepper */}
                                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100">
                                        <div className="flex items-baseline gap-1">
                                            <span className="font-display font-black text-xs sm:text-sm text-slate-900">
                                                {currencySymbol}{price}
                                            </span>
                                            {hasDiscount && (
                                                <span className="text-[9.5px] text-slate-400 line-through">
                                                    {currencySymbol}{originalPrice}
                                                </span>
                                            )}
                                        </div>

                                        {qty > 0 ? (
                                            <div className="inline-flex items-center gap-1 bg-orange-100/80 border border-orange-300 rounded-lg p-0.5 shadow-2xs">
                                                <button
                                                    onClick={() => onDecrement(specialCartKey)}
                                                    aria-label="Decrease quantity"
                                                    className="size-4.5 rounded-md bg-orange-600 text-white hover:bg-orange-700 flex items-center justify-center shadow-2xs transition-all active:scale-90 cursor-pointer"
                                                >
                                                    <Minus size={10} strokeWidth={3} />
                                                </button>
                                                <span className="font-extrabold text-[10px] text-orange-950 min-w-[12px] text-center">
                                                    {qty}
                                                </span>
                                                <button
                                                    onClick={() => onIncrement(specialCartKey)}
                                                    aria-label="Increase quantity"
                                                    className="size-4.5 rounded-md bg-orange-600 text-white hover:bg-orange-700 flex items-center justify-center shadow-2xs transition-all active:scale-90 cursor-pointer"
                                                >
                                                    <Plus size={10} strokeWidth={3} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    onAddSpecial(special);
                                                    toast.success(`Added "${title}" special to cart!`);
                                                }}
                                                className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg font-black text-[9.5px] bg-orange-600 hover:bg-orange-700 text-white shadow-2xs active:scale-95 transition-all cursor-pointer"
                                            >
                                                <Plus size={10} strokeWidth={3} />
                                                <span>ADD</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
            </div>
        </section>
    );
}
