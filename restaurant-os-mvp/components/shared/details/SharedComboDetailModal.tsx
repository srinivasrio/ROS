'use client';

import React, { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X as LucideX, 
  ArrowLeft as LucideArrowLeft, 
  Package as LucidePackage, 
  Sparkles as LucideSparkles, 
  ShoppingBag as LucideShoppingBag, 
  Plus as LucidePlus,
  Minus as LucideMinus,
  Check as LucideCheck
} from 'lucide-react';
import VegNonVegBadge from './VegNonVegBadge';
import { getCategoryMenuItemImage } from '@/lib/utils';

interface SharedComboDetailModalProps {
  combo: any | null;
  isOpen?: boolean;
  onClose: () => void;
  onAddToCart?: (combo: any) => void;
  onAdd?: (combo: any) => void;
  onUpdateQuantity?: (cartKey: string, delta: number) => void;
  onIncrement?: (cartKey: string) => void;
  onDecrement?: (cartKey: string) => void;
  cartQuantity?: number;
  quantity?: number;
  currencySymbol?: string;
  colorHex?: string;
}

export default function SharedComboDetailModal({
  combo,
  isOpen,
  onClose,
  onAddToCart,
  onAdd,
  onUpdateQuantity,
  onIncrement,
  onDecrement,
  cartQuantity: propCartQuantity,
  quantity: propQuantity,
  currencySymbol = '₹',
  colorHex = '#ea580c',
}: SharedComboDetailModalProps) {
  const isModalOpen = Boolean(isOpen !== undefined ? isOpen : combo);
  const [activeCombo, setActiveCombo] = React.useState(combo);

  if (combo && combo !== activeCombo) {
    setActiveCombo(combo);
  }

  const displayCombo = combo || activeCombo;

  // Close on Escape key
  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen, onClose]);

  // Parse items reliably
  const comboItems = displayCombo?.items;
  const parsedItems = useMemo(() => {
    if (!comboItems || !Array.isArray(comboItems)) return [];
    return comboItems.map((it: any, idx: number) => {
      if (typeof it === 'string') {
        return {
          id: `item-${idx}`,
          name: it,
          quantity: 1,
          price: 0,
          image_url: getCategoryMenuItemImage(it),
          item_type: 'Veg',
          is_veg: true,
          description: null,
        };
      }
      const menuItem = it.menu_item || {};
      const name = menuItem.name || it.name || it.item_name || `Dish ${idx + 1}`;
      return {
        id: it.menu_item_id || it.id || `item-${idx}`,
        name,
        quantity: it.quantity || it.qty || 1,
        price: Number(menuItem.price ?? it.price ?? 0),
        image_url: menuItem.image_url || it.image_url || getCategoryMenuItemImage(name),
        item_type: menuItem.item_type || it.item_type,
        is_veg: menuItem.is_veg ?? it.is_veg,
        description: menuItem.description || it.description,
      };
    });
  }, [comboItems]);

  // Determine overall dietary type of combo (if all veg -> veg, else non-veg)
  const comboDietary = useMemo(() => {
    if (parsedItems.length === 0) return 'Veg';
    const hasNonVeg = parsedItems.some((i: any) => {
      const type = (i.item_type || (i.is_veg ? 'Veg' : 'Non-Veg')).toLowerCase();
      return type.includes('non-veg') || type.includes('nonveg') || i.is_veg === false;
    });
    return hasNonVeg ? 'Non-Veg' : 'Veg';
  }, [parsedItems]);

  // Calculate prices
  const itemsSum = useMemo(() => {
    return parsedItems.reduce((acc: number, it: any) => acc + (it.price * it.quantity), 0);
  }, [parsedItems]);

  const comboId = displayCombo ? String(displayCombo.id) : '';
  const cartKey = `special-${comboId}`;
  const title = displayCombo?.title || displayCombo?.name || 'Value Combo Deal';
  const comboImage = displayCombo?.image_url || '/placeholder-food.jpg';
  const effectiveQty = propQuantity !== undefined ? propQuantity : (propCartQuantity ?? 0);

  const handleAddToCart = onAddToCart || onAdd || (() => {});
  const handleUpdateQty = (delta: number) => {
    if (onUpdateQuantity) {
      onUpdateQuantity(cartKey, delta);
    } else if (delta > 0 && onIncrement) {
      onIncrement(cartKey);
    } else if (delta < 0 && onDecrement) {
      onDecrement(cartKey);
    }
  };

  const offerPrice = Number(displayCombo?.price ?? displayCombo?.special_price ?? 0);
  const rawOriginalPrice = Number(displayCombo?.original_price || displayCombo?.originalPrice || 0);
  const totalOriginalPrice = rawOriginalPrice > 0 ? rawOriginalPrice : (itemsSum > offerPrice ? itemsSum : 0);
  const savings = totalOriginalPrice > offerPrice ? totalOriginalPrice - offerPrice : 0;
  const savingsPercent = totalOriginalPrice > 0 && savings > 0 ? Math.round((savings / totalOriginalPrice) * 100) : 0;

  const subtotal = effectiveQty > 0 ? offerPrice * effectiveQty : offerPrice;

  return (
    <AnimatePresence>
      {isModalOpen && displayCombo && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center pointer-events-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/70 cursor-pointer"
            aria-hidden="true"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              boxShadow: '0 20px 50px rgba(15, 23, 42, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.85)',
              willChange: 'transform',
            }}
            className="relative w-full sm:max-w-lg md:max-w-xl bg-[#EEF2F6] rounded-t-[32px] sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col z-10 transform-gpu"
            role="dialog"
            aria-modal="true"
            aria-labelledby="combo-modal-title"
          >
          {/* Top Grab Bar (Mobile) */}
          <div className="sm:hidden absolute top-2.5 left-1/2 -translate-x-1/2 w-12 h-1.5 rounded-full bg-white/60 z-30 pointer-events-none shadow-xs" />

          {/* 16:9 Hero Image */}
          <div className="relative aspect-[16/9] w-full bg-slate-900 shrink-0 overflow-hidden">
            <img
              src={comboImage}
              alt={title}
              className="w-full h-full object-cover select-none"
            />
            {/* Cinematic Gradient Scrim */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-black/30 pointer-events-none" />

            {/* Top Navigation / Actions */}
            <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between z-20">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back"
                className="size-9 rounded-full bg-black/45 hover:bg-black/70 text-white backdrop-blur-md flex items-center justify-center transition-all active:scale-90 border border-white/20 shadow-md cursor-pointer"
              >
                <LucideArrowLeft size={18} />
              </button>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-md">
                  <LucidePackage size={12} />
                  <span>Combo Meal</span>
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="size-9 rounded-full bg-black/45 hover:bg-black/70 text-white backdrop-blur-md flex items-center justify-center transition-all active:scale-90 border border-white/20 shadow-md cursor-pointer"
                >
                  <LucideX size={18} />
                </button>
              </div>
            </div>

            {/* Bottom Hero Overlay: Veg Badge */}
            <div className="absolute bottom-3.5 left-4 right-4 flex items-end justify-between z-20 pointer-events-none">
              <div className="flex items-center gap-2 pointer-events-auto">
                <VegNonVegBadge
                  type={comboDietary}
                  isVeg={comboDietary === 'Veg'}
                  name={title}
                  size="md"
                  showLabel={true}
                />
              </div>

              {parsedItems.length > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white shadow-md text-xs font-black">
                  <span>{parsedItems.length} Dishes Included</span>
                </div>
              )}
            </div>
          </div>

          {/* Scrollable Details Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-5 no-scrollbar flex-1 bg-[#EEF2F6]">
            {/* Title & Description */}
            <div>
              <h2 id="combo-modal-title" className="text-xl sm:text-2xl font-black text-slate-800 leading-tight tracking-tight">
                {title}
              </h2>
              {combo.description ? (
                <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed font-medium">
                  {combo.description}
                </p>
              ) : (
                <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed font-medium">
                  Curated pairing of best-selling specialties crafted for a complete dining experience.
                </p>
              )}
            </div>

            {/* Price & Savings Comparison Card */}
            <div 
              style={{
                boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.7)',
              }}
              className="bg-[#EEF2F6] p-4 rounded-2xl flex items-center justify-between"
            >
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">
                  Bundle Offer Price
                </p>
                <div className="flex items-baseline gap-2.5">
                  <span className="text-2xl sm:text-3xl font-black text-orange-600 font-display">
                    {currencySymbol}{offerPrice}
                  </span>
                  {totalOriginalPrice > offerPrice && (
                    <span className="text-sm sm:text-base font-bold text-slate-400 line-through">
                      {currencySymbol}{totalOriginalPrice}
                    </span>
                  )}
                </div>
              </div>

              {savings > 0 && (
                <div className="flex flex-col items-end">
                  <span 
                    style={{
                      boxShadow: '2px 2px 5px rgba(16, 185, 129, 0.35), -1px -1px 3px rgba(255, 255, 255, 0.8)',
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-black uppercase tracking-wider"
                  >
                    <span>Save {currencySymbol}{savings}</span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 mt-1">
                    ({savingsPercent}% Total Savings)
                  </span>
                </div>
              )}
            </div>

            {/* Included Dishes (Item-by-Item Breakdown) */}
            {parsedItems.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <LucideSparkles size={14} className="text-orange-500" />
                    <span>Included Dishes ({parsedItems.length})</span>
                  </h3>
                  <span className="text-[11px] font-bold text-slate-500">
                    Individual Portions
                  </span>
                </div>

                <div className="space-y-2.5">
                  {parsedItems.map((item: any, idx: number) => (
                    <div
                      key={item.id || idx}
                      style={{
                        boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.3), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.85)',
                        border: '1px solid rgba(255, 255, 255, 0.7)',
                      }}
                      className="flex items-center gap-3 p-3 bg-[#EEF2F6] rounded-2xl"
                    >
                      {/* Dish Thumbnail */}
                      <div 
                        style={{
                          boxShadow: '1px 1px 3px rgba(166, 180, 200, 0.3)',
                          border: '1px solid rgba(255, 255, 255, 0.8)',
                        }}
                        className="size-13 rounded-xl overflow-hidden bg-[#EEF2F6] shrink-0"
                      >
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.currentTarget;
                            const fallback = getCategoryMenuItemImage(item.name);
                            if (target.src !== fallback && !target.src.endsWith(fallback)) {
                              target.src = fallback;
                            }
                          }}
                        />
                      </div>

                      {/* Name & Dietary */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <VegNonVegBadge
                            type={item.item_type}
                            isVeg={item.is_veg}
                            name={item.name}
                            size="xs"
                            showLabel={false}
                          />
                          <h4 className="font-extrabold text-xs sm:text-sm text-slate-800 truncate">
                            {item.name}
                          </h4>
                        </div>
                        {item.description ? (
                          <p className="text-[11px] text-slate-500 font-medium truncate">{item.description}</p>
                        ) : (
                          <p className="text-[11px] text-slate-400 font-medium">Authentic chef specialty</p>
                        )}
                      </div>

                      {/* Price & Quantity Badge */}
                      <div className="flex items-center gap-2 shrink-0">
                        {item.price > 0 && (
                          <span className="text-xs font-bold text-slate-600">
                            {currencySymbol}{item.price}
                          </span>
                        )}
                        <span 
                          style={{
                            boxShadow: 'inset 1px 1px 2px rgba(166, 180, 200, 0.3), inset -1px -1px 2px rgba(255, 255, 255, 0.8)',
                          }}
                          className="px-2.5 py-1 rounded-xl bg-[#EEF2F6] text-slate-800 text-xs font-black"
                        >
                          ×{item.quantity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sticky Bottom Action Footer */}
          <div className="p-4 sm:p-5 bg-[#EEF2F6] border-t border-slate-200/60 shrink-0 flex items-center gap-3">
            {/* Back Button */}
            <button
              type="button"
              onClick={onClose}
              style={{
                boxShadow: '3px 3px 6px rgba(166, 180, 200, 0.4), -3px -3px 6px rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.9)',
              }}
              className="px-4 py-3 rounded-2xl bg-[#EEF2F6] text-slate-700 text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <LucideArrowLeft size={16} />
              <span className="hidden sm:inline">Back</span>
            </button>

            {/* Quantity / Add to Cart Action */}
            <div className="flex-1 flex items-center gap-3">
              {effectiveQty > 0 ? (
                <div 
                  style={{
                    boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.7)',
                  }}
                  className="flex-1 flex items-center justify-between bg-[#EEF2F6] rounded-2xl p-1.5"
                >
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(-1)}
                      aria-label="Decrease combo quantity"
                      style={{
                        boxShadow: '2px 2px 4px rgba(234, 88, 12, 0.35)',
                      }}
                      className="size-9 rounded-xl bg-orange-600 text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                    >
                      <LucideMinus size={16} strokeWidth={2.5} />
                    </button>
                    <span className="font-black text-base text-slate-800 min-w-[32px] text-center tabular-nums">
                      {effectiveQty}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(1)}
                      aria-label="Increase combo quantity"
                      style={{
                        boxShadow: '2px 2px 4px rgba(234, 88, 12, 0.35)',
                      }}
                      className="size-9 rounded-xl bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                    >
                      <LucidePlus size={16} strokeWidth={2.5} />
                    </button>
                  </div>

                  <div className="pr-3 text-right">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Subtotal</p>
                    <p className="text-base font-black text-slate-800 font-display">
                      {currencySymbol}{subtotal}
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleAddToCart({
                    ...displayCombo,
                    price: offerPrice,
                    original_price: totalOriginalPrice > 0 ? totalOriginalPrice : undefined,
                  })}
                  style={{
                    boxShadow: '4px 4px 10px rgba(234, 88, 12, 0.35), -2px -2px 6px rgba(255, 255, 255, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                  }}
                  className="flex-1 h-12 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
                >
                  <LucideShoppingBag size={18} />
                  <span>Add Combo • {currencySymbol}{offerPrice}</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
}
