'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, ChevronUp, Flame, Sparkles, ChefHat, 
  Trash2, Utensils, Gift, ArrowLeft, Check
} from 'lucide-react';
import { CartItem, getActivePrice, isSpecialActive } from '@/context/CartContext';
import SharedQuantityControl from '@/components/shared/SharedQuantityControl';
import { getCategoryMenuItemImage } from '@/lib/utils';

interface CartItemCardProps {
  item: CartItem;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
  onUpdateQuantity: (delta: number) => void;
  onRemove: () => void;
  onUpdateNotes: (notes: string) => void;
}

export default function CartItemCard({
  item,
  isExpanded,
  onToggleExpand,
  onClose,
  onUpdateQuantity,
  onRemove,
  onUpdateNotes,
}: CartItemCardProps) {
  const isCombo = Boolean(
    item.item_type?.toLowerCase() === 'combo' ||
    item.special_type?.toLowerCase() === 'combo' ||
    item.is_combo === true ||
    item.combo_id ||
    item.combo_name ||
    (item.combo_items && item.combo_items.length > 0) ||
    String(item.menu_item_id).startsWith('combo-')
  );
  const isSpecial = !isCombo && Boolean(
    item.isSpecial || 
    item.is_today_special || 
    item.specialId || 
    item.special_type === 'special' ||
    (item.specialItemsData && item.specialItemsData.length > 0) ||
    String(item.menu_item_id).startsWith('special-')
  );
  const isRegular = !item.isSpecial && !item.is_today_special && !isCombo;

  const itemImgSrc = item.image_url || item.combo_image || getCategoryMenuItemImage(item.name);
  const activePrice = getActivePrice(item);
  const originalPrice = Number(item.original_price || item.price || 0);
  const hasDiscount = originalPrice > activePrice;

  // Extract structured sub-items for combos or specials
  const rawSubItems: any[] = item.combo_items || item.specialItemsData || [];
  const structuredSubItems: any[] = React.useMemo(() => {
    if (rawSubItems && rawSubItems.length > 0) {
      return rawSubItems.map((si: any) => {
        const subName = si.name || si.title || 'Included Item';
        return {
          name: subName,
          quantity: si.quantity || 1,
          price: si.price || 0,
          image_url: si.image_url || getCategoryMenuItemImage(subName),
          item_type: si.item_type || (subName.toLowerCase().includes('chicken') || subName.toLowerCase().includes('mutton') || subName.toLowerCase().includes('fish') || subName.toLowerCase().includes('prawn') ? 'Non-Veg' : 'Veg'),
          portion: si.portion,
          description: si.description,
        };
      });
    }

    // Fallback: Parse comma-separated `specialItems` string if available
    if (item.specialItems && typeof item.specialItems === 'string') {
      return item.specialItems.split(',').map((s) => {
        const parts = s.trim().split('×');
        const subName = parts[0]?.trim() || s.trim();
        const qty = parts[1] ? parseInt(parts[1].trim(), 10) || 1 : 1;
        return {
          name: subName,
          quantity: qty,
          image_url: getCategoryMenuItemImage(subName),
          item_type: subName.toLowerCase().includes('chicken') || subName.toLowerCase().includes('mutton') || subName.toLowerCase().includes('fish') || subName.toLowerCase().includes('prawn') ? 'Non-Veg' : 'Veg',
        };
      });
    }

    return [];
  }, [rawSubItems, item.specialItems]);

  return (
    <div
      onClick={onToggleExpand}
      className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden cursor-pointer ${
        isExpanded
          ? 'border-orange-300 shadow-md ring-2 ring-orange-500/10'
          : 'border-slate-200/80 shadow-xs hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      {/* ─── Compact Summary Card Header ─── */}
      <div className="p-3.5 sm:p-4 flex gap-3.5 items-start">
        {/* Left Column: Image with Type Badge & Quantity Controls */}
        <div className="flex flex-col items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <div className="size-16 sm:size-18 bg-slate-100 rounded-xl relative overflow-hidden border border-slate-200/70 shrink-0">
            <img
              src={itemImgSrc}
              alt={item.name}
              className="w-full h-full object-cover rounded-xl"
              onError={(e) => {
                const target = e.currentTarget;
                const fallback = getCategoryMenuItemImage(item.name);
                if (target.src !== fallback && !target.src.endsWith(fallback)) {
                  target.src = fallback;
                }
              }}
            />
            {/* Overlay badge on image */}
            {isSpecial && (
              <div className="absolute top-1 left-1 size-5 rounded-md bg-orange-600 text-white flex items-center justify-center shadow-xs" title="Today's Special">
                <Flame size={12} className="fill-white" />
              </div>
            )}
            {isCombo && (
              <div className="absolute top-1 left-1 size-5 rounded-md bg-purple-600 text-white flex items-center justify-center shadow-xs" title="Value Combo">
                <Gift size={12} className="text-white" />
              </div>
            )}
          </div>

          <SharedQuantityControl
            qty={item.quantity}
            onAdd={() => {}}
            onUpdateQuantity={(delta) => {
              if (delta === -1 && item.quantity === 1) {
                onRemove();
              } else {
                onUpdateQuantity(delta);
              }
            }}
            colorHex="#ea580c"
            buttonStyle="icon"
            size="sm"
          />
        </div>

        {/* Right Column: Item Information & Pricing */}
        <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {/* Type Badge */}
                <div className="flex items-center gap-1.5 mb-1">
                  {isCombo ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200/80">
                      <span>combo</span>
                    </span>
                  ) : isSpecial ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200/80">
                      <span>Today special</span>
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                        item.item_type === 'Non-Veg'
                          ? 'border-red-300 text-red-700 bg-red-50/60'
                          : 'border-emerald-300 text-emerald-700 bg-emerald-50/60'
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          item.item_type === 'Non-Veg' ? 'bg-red-600' : 'bg-emerald-600'
                        }`}
                      />
                      <span>{item.item_type || 'Veg'}</span>
                    </span>
                  )}

                  {(isCombo || isSpecial) && structuredSubItems.length > 0 && (
                    <span className="text-[10px] text-slate-500 font-semibold">
                      • {structuredSubItems.length} items
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug line-clamp-1">
                  {item.name}
                </h3>
              </div>

              {/* Price */}
              <div className="flex flex-col items-end shrink-0">
                <span className="font-black text-slate-900 text-sm sm:text-base font-display">
                  ₹{activePrice * item.quantity}
                </span>
                {hasDiscount && (
                  <span className="text-[11px] text-slate-400 line-through font-medium">
                    ₹{originalPrice * item.quantity}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Cooking Instructions / Chef Notes Input */}
          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={item.notes || ''}
              onChange={(e) => onUpdateNotes(e.target.value)}
              placeholder="Add cooking instructions... (e.g. less spicy)"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2.5 text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-400 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Interactive toggle prompt */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100/80">
            <div className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 group-hover:text-orange-700">
              <span>{isExpanded ? 'Click to hide details' : 'Click to view details'}</span>
              {isExpanded ? (
                <ChevronUp size={14} className="transition-transform duration-200" />
              ) : (
                <ChevronDown size={14} className="transition-transform duration-200" />
              )}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="text-[11px] font-bold text-slate-400 hover:text-red-600 flex items-center gap-1 transition-colors px-1 py-0.5"
            >
              <Trash2 size={12} />
              <span>Remove</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Animated Expanded Details Panel ─── */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-slate-100 bg-slate-50/50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3.5 sm:p-5 space-y-3.5">
              {/* Top Navigation Bar with Back / Close Button */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isCombo ? (
                    <>
                      <Sparkles className="size-4 text-purple-600" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                        Combo Package Details
                      </h4>
                    </>
                  ) : isSpecial ? (
                    <>
                      <Flame className="size-4 text-orange-600" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                        Chef&apos;s Special Details
                      </h4>
                    </>
                  ) : (
                    <>
                      <Utensils className="size-4 text-slate-700" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                        Dish Details
                      </h4>
                    </>
                  )}
                </div>

                {/* Prominent Back / Close Button */}
                <button
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200/90 shadow-2xs hover:bg-slate-100 hover:text-slate-900 active:scale-95 transition-all cursor-pointer"
                  title="Click back to close"
                >
                  <ArrowLeft size={13} />
                  <span>Back to Cart</span>
                </button>
              </div>

              {/* Description Block if available */}
              {item.description && (
                <div className="p-3 rounded-xl bg-white border border-slate-200/70 shadow-2xs">
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    {item.description}
                  </p>
                </div>
              )}

              {/* ─── Structured One-By-One Included Dishes for Combos / Specials ─── */}
              {(isCombo || isSpecial) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                      What&apos;s Included in this {isCombo ? 'Combo' : 'Special'} ({structuredSubItems.length} Items)
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      Per {item.name}
                    </span>
                  </div>

                  {structuredSubItems.length > 0 ? (
                    <div className="space-y-2">
                      {structuredSubItems.map((sub: any, sIdx: number) => (
                        <div
                          key={sIdx}
                          className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs hover:border-orange-200 transition-colors"
                        >
                          {/* Sub-item thumbnail */}
                          <div className="size-11 rounded-lg overflow-hidden bg-slate-100 border border-slate-200/60 shrink-0 relative">
                            <img
                              src={sub.image_url}
                              alt={sub.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.currentTarget;
                                const fallback = getCategoryMenuItemImage(sub.name);
                                if (target.src !== fallback && !target.src.endsWith(fallback)) {
                                  target.src = fallback;
                                }
                              }}
                            />
                          </div>

                          {/* Sub-item name & tags */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-slate-900 truncate">
                                {sub.name}
                              </p>
                              {sub.item_type && (
                                <span
                                  className={`size-2 rounded-full shrink-0 ${
                                    sub.item_type === 'Non-Veg' ? 'bg-red-500' : 'bg-emerald-500'
                                  }`}
                                  title={sub.item_type}
                                />
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                              {sub.portion ? sub.portion : (sub.price && Number(sub.price) > 0 ? `Individual price: ₹${sub.price}` : 'Freshly prepared')}
                            </p>
                          </div>

                          {/* Included Quantity Badge */}
                          <div className="shrink-0 text-right">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/80 text-[11px] font-bold text-slate-800 shadow-2xs">
                              x{sub.quantity}
                            </span>
                            {item.quantity > 1 && (
                              <p className="text-[9px] text-slate-400 font-semibold mt-0.5">
                                Total: {sub.quantity * item.quantity}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-500 text-center">
                      Curated chef selection included with this special.
                    </div>
                  )}
                </div>
              )}

              {/* ─── Regular Item Pricing Breakdown ─── */}
              {isRegular && (
                <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 block">Unit Price</span>
                    <span className="font-bold text-slate-900">₹{activePrice} each</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block">Quantity</span>
                    <span className="font-bold text-slate-900">{item.quantity} {item.quantity === 1 ? 'serving' : 'servings'}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block">Item Subtotal</span>
                    <span className="font-black text-slate-900 font-display">₹{activePrice * item.quantity}</span>
                  </div>
                </div>
              )}



              {/* Bottom Card Footer Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200/80">
                <button
                  onClick={onRemove}
                  className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  <Trash2 size={13} />
                  <span>Remove Item</span>
                </button>

                <button
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 active:scale-95 transition-all"
                >
                  <ChevronUp size={14} />
                  <span>Click back to close</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
