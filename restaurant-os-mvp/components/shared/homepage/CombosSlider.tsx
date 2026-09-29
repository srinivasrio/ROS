'use client';

import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ComboCard from './ComboCard';

interface CombosSliderProps {
  combos: any[];
  mode?: 'admin' | 'customer';
  getItemQtyInCart: (id: string) => number;
  onAdd: (combo: any) => void;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onComboClick?: (combo: any) => void;
  currencySymbol?: string;
}

export default function CombosSlider({
  combos,
  mode = 'customer',
  getItemQtyInCart,
  onAdd,
  onIncrement,
  onDecrement,
  onComboClick,
  currencySymbol = '₹',
}: CombosSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const count = (combos || []).length;
  const canSlide = count > 1;

  // Check scroll position to show/hide chevrons
  const updateScrollButtons = () => {
    const el = containerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
  };

  useEffect(() => {
    updateScrollButtons();
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollButtons, { passive: true });
    window.addEventListener('resize', updateScrollButtons);
    return () => {
      el.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [combos]);

  const scrollPrev = () => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollBy({ left: -340, behavior: 'smooth' });
  };

  const scrollNext = () => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollBy({ left: 340, behavior: 'smooth' });
  };

  if (!combos || combos.length === 0) {
    if (mode === 'admin') {
      return (
        <div className="p-8 rounded-3xl bg-white border border-dashed border-slate-300 text-center col-span-full">
          <p className="text-sm font-semibold text-slate-700">No active combo offers</p>
          <p className="text-xs text-slate-400 mt-1">Configure combos in the right panel</p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="relative group/combos">
      {/* Previous Arrow Button (Desktop hover) */}
      {canSlide && canScrollLeft && (
        <button
          onClick={scrollPrev}
          aria-label="Previous combos"
          className="hidden sm:flex absolute -left-4 top-1/2 -translate-y-1/2 z-20 size-9 rounded-full bg-white/95 backdrop-blur-md shadow-lg border border-slate-200 text-slate-700 items-center justify-center hover:bg-purple-50 hover:text-purple-600 active:scale-95 transition-all duration-200 cursor-pointer"
        >
          <ChevronLeft className="size-5" />
        </button>
      )}

      {/* Single Row, Multiple Columns Horizontal Scrollable Track */}
      <div
        ref={containerRef}
        className="flex items-start gap-4 sm:gap-6 overflow-x-auto no-scrollbar py-2.5 px-1 scroll-smooth overscroll-x-contain"
      >
        {combos.map((combo: any) => {
          // CartContext stores combos via addSpecialToCart with key `special-{id}`
          const cartKey = `special-${combo.id}`;
          return (
            <div
              key={combo.id}
              className="w-[280px] sm:w-[320px] md:w-[340px] shrink-0 snap-start"
            >
              <ComboCard
                combo={combo}
                quantity={getItemQtyInCart(cartKey)}
                onAdd={onAdd}
                onIncrement={() => onIncrement(cartKey)}
                onDecrement={() => onDecrement(cartKey)}
                onClick={onComboClick}
                currencySymbol={currencySymbol}
              />
            </div>
          );
        })}
      </div>

      {/* Next Arrow Button (Desktop hover) */}
      {canSlide && canScrollRight && (
        <button
          onClick={scrollNext}
          aria-label="Next combos"
          className="hidden sm:flex absolute -right-4 top-1/2 -translate-y-1/2 z-20 size-9 rounded-full bg-white/95 backdrop-blur-md shadow-lg border border-slate-200 text-slate-700 items-center justify-center hover:bg-purple-50 hover:text-purple-600 active:scale-95 transition-all duration-200 cursor-pointer"
        >
          <ChevronRight className="size-5" />
        </button>
      )}
    </div>
  );
}
