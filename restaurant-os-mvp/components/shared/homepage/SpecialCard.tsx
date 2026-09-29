'use client';

import React from 'react';
import Image from 'next/image';
import { Plus, Minus, Flame } from 'lucide-react';

interface SpecialCardProps {
  special: {
    id: string | number;
    title?: string;
    name?: string;
    description?: string;
    price: number;
    original_price?: number;
    originalPrice?: number;
    special_price?: number;
    image_url?: string;
    badge?: string;
    expiry_datetime?: string;
    items?: any[];
  };
  quantity?: number;
  onAdd: (item: any) => void;
  onIncrement: (itemId: string) => void;
  onDecrement: (itemId: string) => void;
  onClick?: (special: any) => void;
  currencySymbol?: string;
}

export default function SpecialCard({
  special,
  quantity = 0,
  onAdd,
  onIncrement,
  onDecrement,
  onClick,
  currencySymbol = '₹',
}: SpecialCardProps) {
  const itemId = String(special.id);
  const title = special.title || special.name || "Chef's Special";

  // Resolve offer price and original price
  const offerPrice =
    special.special_price !== undefined && special.special_price !== null && Number(special.special_price) > 0
      ? Number(special.special_price)
      : Number(special.price || 0);

  const rawOriginalPrice = Number(special.original_price || special.originalPrice || 0);
  const originalPrice =
    rawOriginalPrice > 0
      ? rawOriginalPrice
      : (Number(special.price) > offerPrice ? Number(special.price) : 0);

  const savings = originalPrice > offerPrice ? originalPrice - offerPrice : 0;
  const savingsPercent = originalPrice > 0 && savings > 0 ? Math.round((savings / originalPrice) * 100) : 0;

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

  const handleCardClick = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      return;
    }
    onClick?.(special);
  };

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onClick={handleCardClick}
      className={`rounded-2xl sm:rounded-3xl transition-all duration-300 overflow-hidden flex flex-col group ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        backgroundColor: '#EEF2F6',
        boxShadow: '6px 6px 14px rgba(166, 180, 200, 0.4), -6px -6px 14px rgba(255, 255, 255, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.85)'
      }}
    >
      {/* 16:9 Image with Recessed Well */}
      <div 
        className="relative aspect-[16/9] w-full overflow-hidden p-1.5"
        style={{
          backgroundColor: '#EEF2F6',
          boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.3), inset -2px -2px 4px rgba(255, 255, 255, 0.9)'
        }}
      >
        <div className="relative w-full h-full rounded-xl sm:rounded-2xl overflow-hidden">
          {special.image_url ? (
            <Image
              src={special.image_url}
              alt={title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500 rounded-xl sm:rounded-2xl"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <Flame className="size-12 text-orange-400" />
            </div>
          )}

          {/* Tap to view info overlay pill */}
          {onClick && (
            <div className="absolute bottom-2.5 right-2.5 z-10">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-900/80 text-white backdrop-blur-md shadow-xs group-hover:bg-orange-600 transition-colors">
                <span>View Info</span>
              </span>
            </div>
          )}

          {/* Gradient Overlay for Top Badges */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent pointer-events-none" />

          {/* Special Tag Badge */}
          <div className="absolute top-3 left-3 z-10">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-orange-600 text-white shadow-md">
              <span>{special.badge || "Today's Special"}</span>
            </span>
          </div>

          {/* Savings Badge */}
          {savings > 0 && (
            <div className="absolute top-3 right-3 z-10">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-600 text-white shadow-md">
                <span>Save {currencySymbol}{savings}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-base sm:text-lg font-black text-slate-800 line-clamp-1 group-hover:text-orange-600 transition-colors font-display">
            {title}
          </h3>
          {special.description && (
            <p className="text-xs sm:text-sm font-medium text-slate-500 line-clamp-2 mt-1 leading-relaxed">
              {special.description}
            </p>
          )}
        </div>

        {/* Price and Cart Interaction */}
        <div 
          className="flex items-center justify-between mt-4 pt-3"
          style={{ borderTop: '1px solid rgba(255, 255, 255, 0.8)' }}
        >
          <div className="flex flex-col justify-center">
            <div className="flex items-baseline gap-1.5">
              <div className="flex items-baseline gap-0.5">
                <span className="text-xs font-semibold text-slate-500">{currencySymbol}</span>
                <span className="text-lg sm:text-xl font-black text-slate-900 font-display">
                  {offerPrice}
                </span>
              </div>
              {originalPrice > offerPrice && (
                <span className="text-xs sm:text-sm line-through text-slate-400 font-medium">
                  {currencySymbol}{originalPrice}
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
              className="inline-flex items-center gap-2 rounded-xl p-1"
              style={{
                backgroundColor: '#EEF2F6',
                boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.8)'
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDecrement(itemId);
                }}
                aria-label="Decrease quantity"
                className="size-7 rounded-lg flex items-center justify-center font-bold text-white transition-all active:scale-90 cursor-pointer"
                style={{
                  backgroundColor: '#F97316',
                  boxShadow: '1px 1px 3px rgba(249, 115, 22, 0.4)'
                }}
              >
                <Minus className="size-3.5 stroke-[3]" />
              </button>
              <span className="font-black text-sm text-slate-800 min-w-[20px] text-center tabular-nums">
                {quantity}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onIncrement(itemId);
                }}
                aria-label="Increase quantity"
                className="size-7 rounded-lg flex items-center justify-center font-bold text-white transition-all active:scale-90 cursor-pointer"
                style={{
                  backgroundColor: '#F97316',
                  boxShadow: '1px 1px 3px rgba(249, 115, 22, 0.4)'
                }}
              >
                <Plus className="size-3.5 stroke-[3]" />
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAdd({ ...special, price: offerPrice, original_price: originalPrice > 0 ? originalPrice : undefined });
              }}
              aria-label={`Add ${title} to order`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-xs sm:text-sm text-white active:scale-95 transition-all cursor-pointer"
              style={{
                backgroundColor: '#F97316',
                boxShadow: '3px 3px 8px rgba(249, 115, 22, 0.35), -2px -2px 6px rgba(255, 255, 255, 0.4)'
              }}
            >
              <Plus className="size-4" />
              <span>Add to Order</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
