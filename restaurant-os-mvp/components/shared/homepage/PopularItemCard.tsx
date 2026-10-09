'use client';

import React from 'react';
import Image from 'next/image';
import { Plus, Minus, Utensils } from 'lucide-react';
import { STYLES } from '@/lib/design-tokens';
import VegNonVegBadge from '@/components/shared/details/VegNonVegBadge';

interface PopularItemCardProps {
  item: {
    id: string | number;
    name: string;
    description?: string;
    price: number;
    image_url?: string;
    item_type?: 'Veg' | 'Non-Veg' | 'Egg' | string;
    itemType?: 'Veg' | 'Non-Veg' | 'Egg' | string;
    food_type?: 'Veg' | 'Non-Veg' | 'Egg' | string;
    type?: 'Veg' | 'Non-Veg' | 'Egg' | string;
    is_veg?: boolean;
    isVeg?: boolean;
    category?: string;
  };
  quantity?: number;
  onAdd: (item: any) => void;
  onIncrement: (itemId: string) => void;
  onDecrement: (itemId: string) => void;
  onClick?: (item: any) => void;
  currencySymbol?: string;
}

export default function PopularItemCard({
  item,
  quantity = 0,
  onAdd,
  onIncrement,
  onDecrement,
  onClick,
  currencySymbol = '₹',
}: PopularItemCardProps) {
  const itemId = String(item.id);

  // Robust dietary resolution across all naming conventions & semantic fallbacks
  const resolveDietary = (): 'Veg' | 'Egg' | 'Non-Veg' => {
    // 1. Check explicit fields
    const explicit = (
      item.item_type ||
      item.itemType ||
      item.food_type ||
      item.type ||
      (item.is_veg === true || item.isVeg === true ? 'Veg' : 
       item.is_veg === false || item.isVeg === false ? 'Non-Veg' : '')
    )?.toString().toLowerCase().trim();

    if (explicit) {
      if (explicit === 'egg' || explicit.includes('egg')) return 'Egg';
      if (explicit === 'veg' || explicit === 'vegetarian' || explicit === 'pure_veg') return 'Veg';
      if (explicit === 'non-veg' || explicit === 'nonveg' || explicit === 'non_veg') return 'Non-Veg';
    }

    // 2. Name-based semantic classification as safety net
    const nameLower = (item.name || '').toLowerCase();
    
    // Non-veg keywords
    if (/\b(chicken|mutton|fish|prawn|prawns|seafood|crab|meat|beef|pork|lamb|keema|tikka\s*masala|lollipop|wings)\b/i.test(nameLower)) {
      return 'Non-Veg';
    }

    // Egg keywords
    if (/\b(egg|eggs|omelette|omlet|bhurji)\b/i.test(nameLower)) {
      return 'Egg';
    }

    // Veg keywords
    if (/\b(paneer|veg|vegetarian|gobi|aloo|mushroom|dal|palak|corn|curd|soya|chaap|tofu|naan|roti|paratha|kulcha|rice|biryani|soup|salad)\b/i.test(nameLower)) {
      return 'Veg';
    }

    return 'Veg';
  };

  const dietary = resolveDietary();
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
    onClick?.(item);
  };

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onClick={handleCardClick}
      className={`w-full h-full flex flex-col rounded-2xl transition-all duration-300 overflow-hidden group ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        backgroundColor: '#AACDDC',
        boxShadow: '0 4px 14px rgba(170, 205, 220, 0.45), 0 2px 6px rgba(0, 0, 0, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.65)'
      }}
    >
      {/* Aspect-Ratio Image Container with Recessed Well */}
      <div 
        className="relative aspect-[4/3] w-full overflow-hidden p-1.5"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.25)',
          boxShadow: 'inset 1.5px 1.5px 3px rgba(0, 0, 0, 0.06), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.6)'
        }}
      >
        <div className="relative w-full h-full rounded-xl overflow-hidden bg-white/40">
          {item.image_url ? (
            <Image
              src={item.image_url}
              alt={item.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500 rounded-xl"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400">
              <Utensils className="size-10" />
            </div>
          )}

          {/* Dietary Badge */}
          <div className="absolute top-2.5 left-2.5 z-10">
            <VegNonVegBadge
              type={item.item_type || item.itemType}
              isVeg={item.is_veg ?? item.isVeg}
              name={item.name}
              size="sm"
              showLabel={true}
            />
          </div>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-black text-sm sm:text-base text-slate-900 line-clamp-1 group-hover:text-orange-600 transition-colors">
            {item.name}
          </h3>
          {item.description && (
            <p className="text-xs font-semibold text-slate-700/80 line-clamp-2 mt-1 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>

        {/* Price & Action Button */}
        <div 
          className="flex items-center justify-between mt-3 pt-3"
          style={{ borderTop: '1px solid rgba(255, 255, 255, 0.6)' }}
        >
          <div className="flex items-baseline gap-0.5">
            <span className="text-xs font-bold text-slate-700">{currencySymbol}</span>
            <span className="text-base sm:text-lg font-black text-slate-950 font-display">
              {item.price}
            </span>
          </div>

          {quantity > 0 ? (
            <div 
              className="inline-flex items-center gap-2 rounded-xl px-1.5 h-8 bg-white shadow-xs border border-white"
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
                onAdd(item);
              }}
              aria-label={`Add ${item.name} to order`}
              className="inline-flex items-center justify-center gap-1 px-4 h-8 rounded-xl font-black text-xs text-orange-600 active:scale-95 transition-all cursor-pointer bg-white shadow-xs hover:bg-orange-50 border border-white shrink-0"
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
