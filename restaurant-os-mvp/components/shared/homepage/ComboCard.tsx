'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { getCategoryMenuItemImage } from '@/lib/utils';
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

  // Slideshow images: Combo image first, then individual item images, cycling every 1 second
  const slideshowImages = useMemo(() => {
    const list: { src: string; name: string }[] = [];
    if (combo.image_url) {
      list.push({ src: combo.image_url, name: title });
    }
    parsedItems.forEach((it, idx) => {
      const src = it.image_url || (it.name ? getCategoryMenuItemImage(it.name) : null);
      if (src && !list.some((existing) => existing.src === src)) {
        list.push({ src, name: it.name || `Item ${idx + 1}` });
      }
    });
    return list;
  }, [combo.image_url, title, parsedItems]);

  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  useEffect(() => {
    if (slideshowImages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slideshowImages.length);
    }, 1000);
    return () => clearInterval(interval);
  }, [slideshowImages.length]);

  const activeSlide = slideshowImages[currentSlideIndex] || (combo.image_url ? { src: combo.image_url, name: title } : null);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onClick={handleCardClick}
      style={{
        backgroundColor: '#AACDDC',
        boxShadow: '0 4px 14px rgba(170, 205, 220, 0.45), 0 2px 6px rgba(0, 0, 0, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.65)',
      }}
      className="w-full flex flex-col rounded-2xl transition-all duration-300 overflow-hidden group cursor-pointer"
    >
      {/* Aspect-Ratio 4/3 Culinary Image with Recessed Well matching Popular Items */}
      <div 
        className="relative aspect-[4/3] w-full overflow-hidden p-1.5"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.25)',
          boxShadow: 'inset 1.5px 1.5px 3px rgba(0, 0, 0, 0.06), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.6)'
        }}
      >
        <div className="relative w-full h-full rounded-xl overflow-hidden bg-white/40">
          {activeSlide?.src ? (
            <Image
              key={activeSlide.src}
              src={activeSlide.src}
              alt={activeSlide.name || title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 340px"
              className="object-cover group-hover:scale-105 transition-opacity duration-300 rounded-xl"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400">
              <Layers className="size-10 text-orange-500" />
            </div>
          )}

          {/* Active slide item indicator badge when cycling item images */}
          {slideshowImages.length > 1 && currentSlideIndex > 0 && activeSlide?.name && (
            <div className="absolute bottom-2 left-2 z-10 animate-in fade-in duration-200">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black bg-slate-900/80 text-white backdrop-blur-md border border-white/20">
                <span className="truncate max-w-[120px]">{activeSlide.name}</span>
              </span>
            </div>
          )}

          {/* Savings Badge */}
          {savings > 0 && (
            <div className="absolute top-2.5 right-2.5 z-10">
              <span 
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white shadow-sm"
              >
                <span>Save {currencySymbol}{savings}</span>
              </span>
            </div>
          )}

          {/* Combo Badge */}
          <div className="absolute top-2.5 left-2.5 z-10">
            <span 
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-orange-500 text-white shadow-sm"
            >
              <Sparkles className="size-3" />
              <span>COMBO</span>
            </span>
          </div>

          {/* Tap to view info overlay pill at bottom of image */}
          <div className="absolute bottom-2 right-2 z-10">
            <span 
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-950/80 text-white backdrop-blur-md group-hover:bg-orange-600 transition-colors"
            >
              <span>{isExpanded ? 'Hide' : 'Details'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Card Content */}
      <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between overflow-hidden">
        <div className="flex-1 flex flex-col">
          {/* Header Title: Standardized height across all cards */}
          <div className="h-5 sm:h-6 flex items-center shrink-0">
            <h3 className="text-sm sm:text-base font-black text-slate-900 group-hover:text-orange-700 transition-colors font-display truncate">
              {title}
            </h3>
          </div>

          {/* Description */}
          <div className={`mt-0.5 shrink-0 ${isExpanded ? '' : 'h-4 sm:h-5 overflow-hidden'}`}>
            <p
              className={`text-[11px] sm:text-xs text-slate-700 font-medium leading-tight ${
                isExpanded ? '' : 'line-clamp-1'
              }`}
            >
              {displayDescription}
            </p>
          </div>

          {/* Collapsed Preview: Perfectly arranged total items count badge & preview */}
          {!isExpanded && (
            <div className="h-6 mt-1.5 flex items-center gap-1.5 overflow-hidden shrink-0">
              <span 
                className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-[#F5DE52] text-orange-950 font-black text-[10px] sm:text-[11px] shrink-0 border border-amber-400/50"
              >
                <span>{parsedItems.length} {parsedItems.length === 1 ? 'Item' : 'Items'}</span>
              </span>
              {parsedItems.length > 0 ? (
                <>
                  {parsedItems.slice(0, 1).map((item, idx) => (
                    <span
                      key={item.id || idx}
                      className="text-[10px] sm:text-[11px] text-slate-800 font-semibold truncate max-w-[110px]"
                    >
                      {item.name}
                    </span>
                  ))}
                  {parsedItems.length > 1 && (
                    <span className="text-[10px] sm:text-[11px] text-slate-600 font-medium shrink-0">
                      +{parsedItems.length - 1} more
                    </span>
                  )}
                </>
              ) : (
                <span className="text-[10px] sm:text-[11px] text-slate-600 font-medium truncate">
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
                className="overflow-hidden mt-2 pt-2 border-t border-amber-300/60"
              >
                {/* Header: "In this combo" + perfectly arranged total count badge */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center text-[11px] font-black text-slate-900 uppercase tracking-wider">
                    <span>In this combo</span>
                  </div>
                  <span 
                    className="text-[10px] font-bold text-orange-950 bg-[#F5DE52] px-2 py-0.5 rounded-full border border-amber-400/50"
                  >
                    {parsedItems.length} {parsedItems.length === 1 ? 'item' : 'items'}
                  </span>
                </div>

                {/* Items List */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {parsedItems.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-1.5 rounded-xl bg-[#F5DE52]/70 border border-amber-400/40 flex items-center justify-between gap-1.5"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {/* 1. Item Image / Icon FIRST */}
                        {item.image_url ? (
                          <div 
                            className="relative size-7 rounded-lg overflow-hidden shrink-0 bg-[#F5DE52] border border-amber-300/50"
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
                            className="size-7 rounded-lg bg-[#F5DE52] text-orange-600 flex items-center justify-center shrink-0 border border-amber-300/50"
                          >
                            <CheckCircle2 className="size-3.5" />
                          </div>
                        )}

                        {/* 2. Item Count */}
                        <span className="shrink-0 text-xs font-black text-orange-700">
                          {item.quantity}x
                        </span>

                        {/* 3. Item Name & Details */}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {item.name}
                          </p>
                          {item.description && (
                            <p className="text-[10px] text-slate-600 line-clamp-1">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {item.price && (
                        <span className="text-[10px] font-bold text-slate-800 shrink-0">
                          {currencySymbol}{item.price}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Savings Callout Box */}
                {savings > 0 && (
                  <div 
                    className="mt-2 p-2 rounded-xl bg-emerald-100/80 border border-emerald-300/60 flex items-center gap-1.5 text-emerald-900"
                  >
                    <Tag className="size-3.5 text-emerald-700 shrink-0" />
                    <p className="text-[11px] font-bold">
                      Save {currencySymbol}{savings} ({savingsPercent}% OFF)!
                    </p>
                  </div>
                )}

                {/* Collapse button helper */}
                <div className="mt-2 text-center">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 hover:text-orange-700 transition-colors">
                    <span>Tap card to collapse</span>
                    <ChevronDown className="size-2.5 rotate-180" />
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Price & Action Button matching Popular Items Card */}
        <div 
          className="flex items-center justify-between mt-3 pt-3"
          style={{ borderTop: '1px solid rgba(255, 255, 255, 0.6)' }}
        >
          <div className="flex flex-col justify-center">
            <div className="flex items-baseline gap-1">
              <div className="flex items-baseline gap-0.5">
                <span className="text-xs font-bold text-slate-700">{currencySymbol}</span>
                <span className="text-base sm:text-lg font-black text-slate-950 font-display">
                  {offerPrice}
                </span>
              </div>
              {totalOriginalPrice > offerPrice && (
                <span className="text-[11px] line-through text-slate-500 font-medium">
                  {currencySymbol}{totalOriginalPrice}
                </span>
              )}
            </div>
            {savings > 0 && (
              <span className="text-[9px] font-black text-emerald-800 leading-none">
                Save {currencySymbol}{savings} ({savingsPercent}% OFF)
              </span>
            )}
          </div>

          {quantity > 0 ? (
            <div
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-2 rounded-xl p-1 bg-white shadow-xs border border-white"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDecrement(itemId);
                }}
                aria-label="Decrease quantity"
                className="size-6 rounded-lg flex items-center justify-center font-bold text-white transition-all active:scale-90 cursor-pointer bg-orange-500 shadow-xs hover:bg-orange-600"
              >
                <Minus className="size-3.5 stroke-[3]" />
              </button>
              <span className="font-black text-sm text-slate-900 min-w-[18px] text-center tabular-nums">
                {quantity}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onIncrement(itemId);
                }}
                aria-label="Increase quantity"
                className="size-6 rounded-lg flex items-center justify-center font-bold text-white transition-all active:scale-90 cursor-pointer bg-orange-500 shadow-xs hover:bg-orange-600"
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
              className="px-3.5 py-1.5 rounded-xl font-black text-xs bg-orange-500 text-white shadow-xs active:scale-95 hover:bg-orange-600 flex items-center gap-1 cursor-pointer transition-all"
            >
              <Plus className="size-3.5 stroke-[3]" />
              <span>ADD</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
