'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, AlertTriangle, X, Gift, Flame, Utensils } from 'lucide-react';
import { CartItem, getActivePrice } from '@/context/CartContext';
import { getCategoryMenuItemImage } from '@/lib/utils';

interface ConfirmRemoveItemModalProps {
  isOpen: boolean;
  item: CartItem | null;
  isClearAll?: boolean;
  totalItems?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmRemoveItemModal({
  isOpen,
  item,
  isClearAll = false,
  totalItems = 0,
  onConfirm,
  onCancel,
}: ConfirmRemoveItemModalProps) {
  // Lock body scroll when modal is open and handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const isCombo = Boolean(
    item?.item_type?.toLowerCase() === 'combo' ||
    item?.special_type?.toLowerCase() === 'combo' ||
    item?.is_combo ||
    item?.combo_id ||
    item?.combo_name ||
    (item?.combo_items && item.combo_items.length > 0) ||
    String(item?.menu_item_id).startsWith('combo-')
  );
  const isSpecial = !isCombo && Boolean(
    item?.isSpecial || 
    item?.is_today_special || 
    item?.specialId || 
    item?.special_type === 'special' ||
    (item?.specialItemsData && item.specialItemsData.length > 0) ||
    String(item?.menu_item_id).startsWith('special-')
  );
  const activePrice = item ? getActivePrice(item) : 0;
  const itemImg = item
    ? item.image_url || item.combo_image || getCategoryMenuItemImage(item.name)
    : '';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onCancel}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 12 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10"
        >
          {/* Close button */}
          <button
            onClick={onCancel}
            aria-label="Close modal"
            className="absolute top-4 right-4 size-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>

          <div className="p-6 text-center">
            {/* Warning Icon Badge */}
            <div className="size-14 rounded-2xl bg-red-50 text-red-600 border border-red-100/80 flex items-center justify-center mx-auto mb-4 shadow-xs">
              <Trash2 className="size-7 text-red-500" />
            </div>

            {/* Title & Description */}
            {isClearAll ? (
              <>
                <h3 className="text-lg font-black text-slate-900 leading-tight">
                  Clear entire cart?
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Are you sure you want to remove all{' '}
                  <span className="font-bold text-slate-800">
                    {totalItems} {totalItems === 1 ? 'item' : 'items'}
                  </span>{' '}
                  from your cart? This cannot be undone.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-black text-slate-900 leading-tight">
                  Remove item from cart?
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Are you sure you want to remove{' '}
                  <span className="font-bold text-slate-800">{item?.name}</span> from your order?
                </p>
              </>
            )}

            {/* Item Preview Strip (if single item) */}
            {!isClearAll && item && (
              <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center gap-3 text-left">
                {/* Thumbnail */}
                <div className="size-12 rounded-xl overflow-hidden bg-white border border-slate-200 shrink-0 relative">
                  <img
                    src={itemImg}
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
                  {isSpecial && (
                    <div className="absolute top-0.5 left-0.5 size-4 rounded bg-orange-600 text-white flex items-center justify-center shadow-xs">
                      <Flame size={10} className="fill-white" />
                    </div>
                  )}
                  {isCombo && (
                    <div className="absolute top-0.5 left-0.5 size-4 rounded bg-purple-600 text-white flex items-center justify-center shadow-xs">
                      <Gift size={10} className="text-white" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {item.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-slate-500 font-medium">
                      Qty: <span className="font-bold text-slate-800">{item.quantity}</span>
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-[11px] font-extrabold text-orange-600 font-display">
                      ₹{activePrice * item.quantity}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 flex items-center gap-2.5">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm active:scale-95 transition-all cursor-pointer"
              >
                Keep Item
              </button>

              <button
                type="button"
                onClick={onConfirm}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-red-500/25 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={15} />
                <span>{isClearAll ? 'Clear Cart' : 'Yes, Remove'}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
