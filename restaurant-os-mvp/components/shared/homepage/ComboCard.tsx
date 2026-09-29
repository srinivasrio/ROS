'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  Plus,
  Minus,
  Utensils,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  Tag,
} from 'lucide-react';

interface ComboCardProps {
  combo: {
    id: string | number;
    title?: string;
    name?: string;
    description?: string;
    price: number;
    original_price?: number;
    originalPrice?: number;
    special_price?: number;
    image_url?: string;
    items?: string[] | any[];
  };
  quantity?: number;
  onAdd: (item: any) => void;
  onIncrement: (itemId: string) => void;
  onDecrement: (itemId: string) => void;
  onClick?: (combo: any) => void;
  currencySymbol?: string;
}

export default function ComboCard({
  combo,
  quantity = 0,
  onAdd,
  onIncrement,
  onDecrement,
  onClick,
  currencySymbol = '₹',
}: ComboCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isDraggingRef = React.useRef(false);
  const touchStartPos = React.useRef({ x: 0, y: 0 });

  const handleTouchStart = (e: React.TouchEvent) => {
    isDraggingRef.current = false;
    touchStartPos.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
    const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
    if (dx > 7 || dy > 7) {
      isDraggingRef.current = true;
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      return;
    }
    if (onClick) {
      onClick(combo);
      return;
    }
    setIsExpanded((prev) => !prev);
  };

  const itemId = String(combo.id);
  const title = combo.title || combo.name || 'Combo Meal';

  // Parse items reliably regardless of backend data structure
  const parsedItems = useMemo(() => {
    if (!combo.items || !Array.isArray(combo.items)) return [];
    return combo.items.map((item: any, idx: number) => {
      if (typeof item === 'string') {
        return {
          id: `item-${idx}`,
          name: item,
          quantity: 1,
          image_url: null,
          description: null,
          price: null,
        };
      }
      const menuItem = item.menu_item || {};
      return {
        id: item.menu_item_id || item.id || `item-${idx}`,
        name: menuItem.name || item.name || item.item_name || `Combo Item ${idx + 1}`,
        quantity: item.quantity || item.qty || 1,
        image_url: menuItem.image_url || item.image_url || null,
        description: menuItem.description || item.description || null,
        price: menuItem.price ?? item.price ?? null,
      };
    });
  }, [combo.items]);

  // Resolve offer price and total original price
  const offerPrice = Number(combo.price ?? combo.special_price ?? 0);

  const totalOriginalPrice = useMemo(() => {
    const directOrig = Number(combo.original_price || (combo as any).originalPrice || 0);
    if (directOrig > 0) return directOrig;

    // Calculate sum of individual items
    if (parsedItems && parsedItems.length > 0) {
      const sum = parsedItems.reduce((acc, it) => {
        const p = Number(it.price || 0);
        const q = Number(it.quantity || 1);
        return acc + (p * q);
      }, 0);
      if (sum > 0) return sum;
    }
    return 0;
  }, [combo.original_price, (combo as any).originalPrice, parsedItems]);

  // Calculate savings
  const savings = totalOriginalPrice > offerPrice ? totalOriginalPrice - offerPrice : 0;
  const savingsPercent =
    totalOriginalPrice > 0 && savings > 0
      ? Math.round((savings / totalOriginalPrice) * 100)
      : 0;

  const displayDescription =
    combo.description?.trim() ||
    'Chef-curated value combo meal pairing with premium portions.';

  return (
    <motion.div
      layout
      transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onClick={handleCardClick}
      style={{
        boxShadow: '5px 5px 14px rgba(166, 180, 200, 0.4), -5px -5px 14px rgba(255, 255, 255, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.85)',
      }}
      className={`w-full bg-[#EEF2F6] rounded-2xl sm:rounded-3xl transition-all duration-300 overflow-hidden flex flex-col group cursor-pointer ${
        isExpanded ? 'min-h-[380px] sm:min-h-[410px] h-auto' : 'h-[380px] sm:h-[410px]'
      }`}
    >
      {/* 16:9 Culinary Image: Exact same aspect ratio across all cards */}
      <div 
        style={{
          boxShadow: 'inset 2px 2px 5px rgba(166, 180, 200, 0.35), inset -2px -2px 5px rgba(255, 255, 255, 0.9)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.8)',
        }}
        className="relative aspect-[16/9] w-full bg-[#EEF2F6] overflow-hidden shrink-0"
      >
        {combo.image_url ? (
          <Image
            src={combo.image_url}
            alt={title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 340px"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Layers className="size-12 text-orange-400" />
          </div>
        )}

        {/* Savings Badge */}
        {savings > 0 && (
          <div className="absolute top-3 right-3 z-10">
            <span 
              style={{
                boxShadow: '2px 2px 6px rgba(16, 185, 129, 0.35), -1px -1px 4px rgba(255, 255, 255, 0.8)',
              }}
              className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-600 text-white"
            >
              <span>Save {currencySymbol}{savings}</span>
            </span>
          </div>
        )}

        {/* Tap to expand overlay pill at bottom of image */}
        <div className="absolute bottom-2.5 right-2.5 z-10">
          <span 
            style={{
              boxShadow: '2px 2px 6px rgba(0, 0, 0, 0.3)',
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-900/80 text-white backdrop-blur-md transition-colors"
          >
            <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
            <ChevronDown
              className={`size-3 transition-transform duration-300 ${
                isExpanded ? 'rotate-180 text-orange-400' : 'rotate-0'
              }`}
            />
          </span>
        </div>
      </div>

      {/* Main Card Content */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between overflow-hidden">
        <div className="flex-1 flex flex-col">
          {/* Header Title: Standardized height across all cards */}
          <div className="h-6 sm:h-7 flex items-center shrink-0">
            <h3 className="text-base sm:text-lg font-black text-slate-800 group-hover:text-orange-600 transition-colors font-display truncate">
              {title}
            </h3>
          </div>

          {/* Description: Standardized 2-line height across all cards */}
          <div className={`mt-1 shrink-0 ${isExpanded ? '' : 'h-9 sm:h-10 overflow-hidden'}`}>
            <p
              className={`text-xs sm:text-sm text-slate-500 font-medium leading-relaxed ${
                isExpanded ? '' : 'line-clamp-2'
              }`}
            >
              {displayDescription}
            </p>
          </div>

          {/* Collapsed Preview: Perfectly arranged total items count badge & preview */}
          {!isExpanded && (
            <div className="h-7 mt-2.5 flex items-center gap-1.5 overflow-hidden shrink-0">
              <span 
                style={{
                  boxShadow: 'inset 1px 1px 3px rgba(166, 180, 200, 0.3), inset -1px -1px 3px rgba(255, 255, 255, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.7)',
                }}
                className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#EEF2F6] text-orange-700 font-extrabold text-[11px] shrink-0"
              >
                <span>{parsedItems.length} {parsedItems.length === 1 ? 'Item' : 'Items'}</span>
              </span>
              {parsedItems.length > 0 ? (
                <>
                  {parsedItems.slice(0, 1).map((item, idx) => (
                    <span
                      key={item.id || idx}
                      className="text-[11px] text-slate-600 font-semibold truncate max-w-[130px]"
                    >
                      {item.name}
                    </span>
                  ))}
                  {parsedItems.length > 1 && (
                    <span className="text-[11px] text-slate-400 font-medium shrink-0">
                      +{parsedItems.length - 1} more
                    </span>
                  )}
                </>
              ) : (
                <span className="text-[11px] text-slate-400 font-medium truncate">
                  Chef specialty pairing
                </span>
              )}
            </div>
          )}

          {/* EXPANDED SECTION: Detailed combo information with expand animation */}
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                key="combo-details-expanded"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
                className="overflow-hidden mt-3 pt-3 border-t border-slate-200/60"
              >
                {/* Header: "In this combo" + perfectly arranged total count badge */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center text-xs font-black text-slate-700 uppercase tracking-wider">
                    <span>In this combo</span>
                  </div>
                  <span 
                    style={{
                      boxShadow: 'inset 1px 1px 3px rgba(166, 180, 200, 0.3), inset -1px -1px 3px rgba(255, 255, 255, 0.8)',
                    }}
                    className="text-[11px] font-bold text-orange-600 bg-[#EEF2F6] px-2.5 py-0.5 rounded-full border border-white/70"
                  >
                    {parsedItems.length} {parsedItems.length === 1 ? 'item' : 'items'}
                  </span>
                </div>

                {/* Items List */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {parsedItems.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      style={{
                        boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.3), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.85)',
                        border: '1px solid rgba(255, 255, 255, 0.7)',
                      }}
                      className="p-2 rounded-xl bg-[#EEF2F6] flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {/* 1. Item Image / Icon FIRST */}
                        {item.image_url ? (
                          <div 
                            style={{
                              boxShadow: '1px 1px 3px rgba(166, 180, 200, 0.4)',
                              border: '1px solid rgba(255, 255, 255, 0.8)',
                            }}
                            className="relative size-8 rounded-lg overflow-hidden shrink-0 bg-[#EEF2F6]"
                          >
                            <Image
                              src={item.image_url}
                              alt={item.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div 
                            style={{
                              boxShadow: '1px 1px 3px rgba(166, 180, 200, 0.3)',
                              border: '1px solid rgba(255, 255, 255, 0.8)',
                            }}
                            className="size-8 rounded-lg bg-[#EEF2F6] text-orange-500 flex items-center justify-center shrink-0"
                          >
                            <CheckCircle2 className="size-4" />
                          </div>
                        )}

                        {/* 2. Item Count */}
                        <span className="shrink-0 text-xs font-black text-orange-600">
                          {item.quantity}x
                        </span>

                        {/* 3. Item Name & Details */}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {item.name}
                          </p>
                          {item.description && (
                            <p className="text-[10px] text-slate-500 line-clamp-1">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {item.price && (
                        <span className="text-[11px] font-bold text-slate-600 shrink-0">
                          {currencySymbol}{item.price}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Savings Callout Box */}
                {savings > 0 && (
                  <div 
                    style={{
                      boxShadow: 'inset 1.5px 1.5px 3px rgba(16, 185, 129, 0.15), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                    className="mt-3 p-2.5 rounded-xl bg-[#EEF2F6] flex items-center gap-2 text-emerald-800"
                  >
                    <Tag className="size-4 text-emerald-600 shrink-0" />
                    <p className="text-xs font-bold">
                      Bundle Deal: Save {currencySymbol}{savings} ({savingsPercent}% OFF) vs ordering separately!
                    </p>
                  </div>
                )}

                {/* Collapse button helper */}
                <div className="mt-2.5 text-center">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-orange-600 transition-colors">
                    <span>Tap card to collapse</span>
                    <ChevronDown className="size-3 rotate-180" />
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Price and Cart Interaction: Pinned to bottom with uniform height */}
        <div className="h-14 mt-auto pt-3 border-t border-slate-200/60 flex items-center justify-between shrink-0">
          <div className="flex flex-col justify-center">
            <div className="flex items-baseline gap-1.5">
              <div className="flex items-baseline gap-0.5">
                <span className="text-xs font-bold text-slate-500">{currencySymbol}</span>
                <span className="text-lg sm:text-xl font-black text-slate-800 font-display">
                  {offerPrice}
                </span>
              </div>
              {totalOriginalPrice > offerPrice && (
                <span className="text-xs sm:text-sm line-through text-slate-400 font-medium">
                  {currencySymbol}{totalOriginalPrice}
                </span>
              )}
            </div>
            {savings > 0 && (
              <span className="text-[10px] font-black text-emerald-600 leading-none">
                Save {currencySymbol}{savings} ({savingsPercent}% OFF)
              </span>
            )}
          </div>

          {quantity > 0 ? (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.7)',
              }}
              className="inline-flex items-center gap-2 bg-[#EEF2F6] rounded-xl p-1"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDecrement(itemId);
                }}
                aria-label="Decrease quantity"
                style={{
                  boxShadow: '2px 2px 5px rgba(234, 88, 12, 0.4), -1px -1px 3px rgba(255, 255, 255, 0.6)',
                }}
                className="size-7 rounded-lg bg-[#F97316] text-white hover:bg-orange-600 flex items-center justify-center transition-all active:scale-90 cursor-pointer"
              >
                <Minus className="size-3.5 stroke-[3]" />
              </button>
              <span className="font-black text-sm text-slate-800 min-w-[20px] text-center">
                {quantity}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onIncrement(itemId);
                }}
                aria-label="Increase quantity"
                style={{
                  boxShadow: '2px 2px 5px rgba(234, 88, 12, 0.4), -1px -1px 3px rgba(255, 255, 255, 0.6)',
                }}
                className="size-7 rounded-lg bg-[#F97316] text-white hover:bg-orange-600 flex items-center justify-center transition-all active:scale-90 cursor-pointer"
              >
                <Plus className="size-3.5 stroke-[3]" />
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAdd({ ...combo, price: offerPrice, original_price: totalOriginalPrice > 0 ? totalOriginalPrice : undefined });
              }}
              aria-label={`Add ${title} to order`}
              style={{
                boxShadow: '3px 3px 8px rgba(234, 88, 12, 0.35), -2px -2px 6px rgba(255, 255, 255, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm bg-[#F97316] text-white hover:bg-orange-600 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Add Combo</span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
