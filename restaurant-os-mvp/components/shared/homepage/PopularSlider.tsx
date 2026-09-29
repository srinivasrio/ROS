'use client';

import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import PopularItemCard from './PopularItemCard';

interface PopularSliderProps {
  items: any[];
  mode?: 'admin' | 'customer';
  getItemQtyInCart: (id: string) => number;
  onAdd: (item: any) => void;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onItemClick?: (item: any) => void;
  currencySymbol?: string;
}

export default function PopularSlider({
  items,
  mode = 'customer',
  getItemQtyInCart,
  onAdd,
  onIncrement,
  onDecrement,
  onItemClick,
  currencySymbol = '₹',
}: PopularSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const count = (items || []).length;
  const canSlide = count > 1;

  // Check scroll position to show/hide navigation chevrons
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
  }, [items]);

  const scrollPrev = () => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollBy({ left: -300, behavior: 'smooth' });
  };

  const scrollNext = () => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollBy({ left: 300, behavior: 'smooth' });
  };

  if (!items || items.length === 0) {
    if (mode === 'admin') {
      return (
        <div className="p-8 rounded-3xl bg-white border border-dashed border-slate-300 text-center col-span-full">
          <Sparkles className="size-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">No popular items marked</p>
          <p className="text-xs text-slate-400 mt-1">Mark items as popular in your menu management</p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="relative group/popular">
      {/* Previous Arrow Button (Desktop hover) */}
      {canSlide && canScrollLeft && (
        <button
          onClick={scrollPrev}
          aria-label="Previous popular items"
          className="hidden sm:flex absolute -left-4 top-1/2 -translate-y-1/2 z-20 size-9 rounded-full bg-white/95 backdrop-blur-md shadow-lg border border-slate-200 text-slate-700 items-center justify-center hover:bg-orange-50 hover:text-orange-600 active:scale-95 transition-all duration-200 cursor-pointer"
        >
          <ChevronLeft className="size-5" />
        </button>
      )}

      {/* Single Row, Multiple Columns Horizontal Scrollable Track */}
      <div
        ref={containerRef}
        className="flex items-stretch gap-3.5 sm:gap-5 overflow-x-auto no-scrollbar py-2.5 px-1 scroll-smooth overscroll-x-contain"
      >
        {items.map((item: any) => (
          <div
            key={item.id}
            className="w-[210px] sm:w-[235px] md:w-[255px] shrink-0 flex"
          >
            <PopularItemCard
              item={item}
              quantity={getItemQtyInCart(String(item.id))}
              onAdd={onAdd}
              onIncrement={onIncrement}
              onDecrement={onDecrement}
              onClick={onItemClick}
              currencySymbol={currencySymbol}
            />
          </div>
        ))}
      </div>

      {/* Next Arrow Button (Desktop hover) */}
      {canSlide && canScrollRight && (
        <button
          onClick={scrollNext}
          aria-label="Next popular items"
          className="hidden sm:flex absolute -right-4 top-1/2 -translate-y-1/2 z-20 size-9 rounded-full bg-white/95 backdrop-blur-md shadow-lg border border-slate-200 text-slate-700 items-center justify-center hover:bg-orange-50 hover:text-orange-600 active:scale-95 transition-all duration-200 cursor-pointer"
        >
          <ChevronRight className="size-5" />
        </button>
      )}
    </div>
  );
}
