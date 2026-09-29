'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X as LucideX, 
  ArrowLeft as LucideArrowLeft, 
  Star as LucideStar, 
  Clock as LucideClock, 
  Sparkles as LucideSparkles, 
  ShoppingBag as LucideShoppingBag, 
  Check as LucideCheck,
  Plus as LucidePlus,
  Minus as LucideMinus
} from 'lucide-react';
import VegNonVegBadge from './VegNonVegBadge';
import { getCategoryMenuItemImage } from '@/lib/utils';

interface SharedItemDetailModalProps {
  item: any | null;
  isOpen?: boolean;
  onClose: () => void;
  onAddToCart?: (item: any, qty?: number) => void;
  onAdd?: (item: any, qty?: number) => void;
  onUpdateQuantity?: (itemId: string, delta: number) => void;
  onIncrement?: (itemId: string) => void;
  onDecrement?: (itemId: string) => void;
  cartQuantity?: number;
  quantity?: number;
  currencySymbol?: string;
  colorHex?: string;
}

export default function SharedItemDetailModal({
  item,
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
}: SharedItemDetailModalProps) {
  const isModalOpen = Boolean(isOpen !== undefined ? isOpen : item);
  const [activeItem, setActiveItem] = React.useState(item);

  React.useEffect(() => {
    if (item) {
      setActiveItem(item);
    }
  }, [item]);

  const displayItem = item || activeItem;

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

  const itemId = displayItem ? String(displayItem.id) : '';
  const itemName = displayItem?.name || displayItem?.title || 'Delicious Dish';
  const itemImage = displayItem?.image_url || getCategoryMenuItemImage(itemName);
  const effectiveQty = propQuantity !== undefined ? propQuantity : (propCartQuantity ?? 0);

  const handleAddToCart = onAddToCart || onAdd || (() => {});
  const handleUpdateQty = (delta: number) => {
    if (onUpdateQuantity) {
      onUpdateQuantity(itemId, delta);
    } else if (delta > 0 && onIncrement) {
      onIncrement(itemId);
    } else if (delta < 0 && onDecrement) {
      onDecrement(itemId);
    }
  };

  // Resolve pricing
  const rawPrice = Number(displayItem?.price ?? 0);
  const rawSpecialPrice = displayItem?.special_price !== undefined && displayItem?.special_price !== null && Number(displayItem.special_price) > 0
    ? Number(displayItem.special_price)
    : null;

  const offerPrice = rawSpecialPrice !== null ? rawSpecialPrice : rawPrice;
  const originalPrice = rawSpecialPrice !== null && rawPrice > rawSpecialPrice ? rawPrice : null;
  const savings = originalPrice !== null ? originalPrice - offerPrice : 0;
  const savingsPercent = originalPrice !== null && savings > 0 ? Math.round((savings / originalPrice) * 100) : 0;

  const rating = Number(displayItem?.rating || 0);
  const prepTime = displayItem?.preparation_time || displayItem?.prep_time;
  const isPopular = Boolean(displayItem?.is_popular || displayItem?.isPopular);
  const isSpecial = Boolean(displayItem?.is_today_special || displayItem?.isSpecial);

  const subtotal = effectiveQty > 0 ? offerPrice * effectiveQty : offerPrice;

  return (
    <AnimatePresence>
      {isModalOpen && displayItem && (
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
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 350, mass: 0.8 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              boxShadow: '0 20px 50px rgba(15, 23, 42, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.85)',
              willChange: 'transform, opacity',
            }}
            className="relative w-full sm:max-w-lg md:max-w-xl bg-[#EEF2F6] rounded-t-[32px] sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col z-10 transform-gpu"
            role="dialog"
            aria-modal="true"
            aria-labelledby="item-modal-title"
          >
          {/* Top Grab Bar (Mobile) */}
          <div className="sm:hidden absolute top-2.5 left-1/2 -translate-x-1/2 w-12 h-1.5 rounded-full bg-white/60 z-30 pointer-events-none shadow-xs" />

          {/* 16:9 Hero Food Image */}
          <div className="relative aspect-[16/9] w-full bg-slate-900 shrink-0 overflow-hidden">
            <img
              src={itemImage}
              alt={itemName}
              className="w-full h-full object-cover select-none"
            />
            {/* Cinematic Gradient Scrim */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-black/30 pointer-events-none" />

            {/* Top Navigation / Actions */}
            <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between z-20">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back to menu"
                className="size-9 rounded-full bg-black/45 hover:bg-black/70 text-white backdrop-blur-md flex items-center justify-center transition-all active:scale-90 border border-white/20 shadow-md cursor-pointer"
              >
                <LucideArrowLeft size={18} />
              </button>

              <div className="flex items-center gap-2">
                {isPopular && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/90 text-white text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-md">
                    <LucideSparkles size={11} className="fill-white" />
                    <span>Bestseller</span>
                  </span>
                )}
                {isSpecial && !isPopular && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-600/90 text-white text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-md">
                    <LucideSparkles size={11} className="fill-white" />
                    <span>Special</span>
                  </span>
                )}
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

            {/* Bottom Hero Overlay: Veg Badge & Rating */}
            <div className="absolute bottom-3.5 left-4 right-4 flex items-end justify-between z-20 pointer-events-none">
              <div className="flex items-center gap-2 pointer-events-auto">
                <VegNonVegBadge
                  type={displayItem.item_type || displayItem.itemType}
                  isVeg={displayItem.is_veg ?? displayItem.isVeg}
                  name={itemName}
                  size="md"
                  showLabel={true}
                />
              </div>

              {rating > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white shadow-md">
                  <LucideStar size={13} className="text-amber-400 fill-amber-400" />
                  <span className="text-xs font-black tracking-wide">{rating.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Scrollable Details Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 no-scrollbar flex-1 bg-[#EEF2F6]">
            {/* Title & Metadata */}
            <div>
              <div className="flex items-start justify-between gap-3">
                <h2 id="item-modal-title" className="text-xl sm:text-2xl font-black text-slate-800 leading-tight tracking-tight">
                  {itemName}
                </h2>
              </div>

              {prepTime && (
                <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold mt-1.5">
                  <LucideClock size={13} className="text-slate-400" />
                  <span>Prep time: {prepTime} mins</span>
                </div>
              )}
            </div>

            {/* Price & Savings Banner */}
            <div 
              style={{
                boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.7)',
              }}
              className="bg-[#EEF2F6] p-4 rounded-2xl flex items-center justify-between"
            >
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">
                  Current Price
                </p>
                <div className="flex items-baseline gap-2.5">
                  <span className="text-2xl sm:text-3xl font-black text-orange-600 font-display">
                    {currencySymbol}{offerPrice}
                  </span>
                  {originalPrice !== null && (
                    <span className="text-sm sm:text-base font-bold text-slate-400 line-through">
                      {currencySymbol}{originalPrice}
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
                    ({savingsPercent}% OFF)
                  </span>
                </div>
              )}
            </div>

            {/* Description */}
            {displayItem.description ? (
              <div className="space-y-1.5">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  About this Dish
                </h3>
                <p 
                  style={{
                    boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.3), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.85)',
                    border: '1px solid rgba(255, 255, 255, 0.7)',
                  }}
                  className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed bg-[#EEF2F6] p-3.5 rounded-2xl"
                >
                  {displayItem.description}
                </p>
              </div>
            ) : (
              <div 
                style={{
                  boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.3), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.7)',
                }}
                className="bg-[#EEF2F6] p-3 rounded-xl text-xs text-slate-500 font-medium italic"
              >
                Freshly prepared with authentic ingredients and artisanal spices.
              </div>
            )}
          </div>

          {/* Sticky Bottom Action Footer */}
          <div className="p-4 sm:p-5 bg-[#EEF2F6] border-t border-slate-200/60 shrink-0 flex items-center gap-3">
            {/* Clear Back Button */}
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
                      aria-label="Decrease quantity"
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
                      aria-label="Increase quantity"
                      style={{
                        boxShadow: '2px 2px 4px rgba(234, 88, 12, 0.35)',
                      }}
                      className="size-9 rounded-xl bg-orange-600 text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer"
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
                  onClick={() => handleAddToCart(displayItem, 1)}
                  style={{
                    boxShadow: '4px 4px 10px rgba(234, 88, 12, 0.35), -2px -2px 6px rgba(255, 255, 255, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                  }}
                  className="flex-1 h-12 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
                >
                  <LucideShoppingBag size={18} />
                  <span>Add to Order • {currencySymbol}{offerPrice}</span>
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
