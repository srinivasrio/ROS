'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import OfferCard from './OfferCard';

interface OffersSliderProps {
  offers: any[];
  mode?: 'admin' | 'customer';
  onOfferClick?: (offer: any) => void;
}

export default function OffersSlider({ offers, mode = 'customer', onOfferClick }: OffersSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const count = (offers || []).length;
  const needsLoop = count > 1;

  // Infinite loop slides: [last, ...all, first]
  const slides = useMemo(() => {
    if (!needsLoop) return offers || [];
    return [offers[count - 1], ...offers, offers[0]];
  }, [offers, count, needsLoop]);

  // Virtual index: starts at 1 (which maps to real index 0)
  const [slideIndex, setSlideIndex] = useState(needsLoop ? 1 : 0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const autoplayRef = useRef<NodeJS.Timeout | null>(null);
  const resumeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPointerDown = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const deltaXRef = useRef(0);
  const gestureDirectionRef = useRef<'horizontal' | 'vertical' | null>(null);

  // Active real index for dots (0 to count - 1)
  const realIndex = needsLoop ? (slideIndex - 1 + count) % count : 0;

  // Sync state if offers count changes
  useEffect(() => {
    setSlideIndex(needsLoop ? 1 : 0);
    setIsTransitioning(false);
    setDragOffset(0);
  }, [count, needsLoop]);

  // Navigate to Next Card (always right to left!)
  const goNext = useCallback(() => {
    if (!needsLoop) return;
    setIsTransitioning(true);
    setSlideIndex((prev) => prev + 1);
  }, [needsLoop]);

  // Navigate to Previous Card
  const goPrev = useCallback(() => {
    if (!needsLoop) return;
    setIsTransitioning(true);
    setSlideIndex((prev) => prev - 1);
  }, [needsLoop]);

  // When transition completes, silently snap back if on virtual clone
  const handleTransitionEnd = useCallback(() => {
    if (!needsLoop) return;
    if (slideIndex >= count + 1) {
      // Reached cloned first card (at index count + 1):
      // Instantly jump to real first card (at index 1) with NO transition.
      // Next advance will continue right-to-left from index 1 to 2!
      setIsTransitioning(false);
      setSlideIndex(1);
    } else if (slideIndex <= 0) {
      // Reached cloned last card (at index 0):
      // Instantly jump to real last card (at index count) with NO transition.
      setIsTransitioning(false);
      setSlideIndex(count);
    }
  }, [needsLoop, slideIndex, count]);

  // Autoplay timer: advances card-by-card right to left every 3.5s
  useEffect(() => {
    if (!needsLoop || isPaused) {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
      return;
    }

    autoplayRef.current = setInterval(goNext, 3500);

    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
    };
  }, [needsLoop, isPaused, goNext]);

  // Helper to pause autoplay
  const pauseAutoplay = () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    setIsPaused(true);
  };

  // Helper to resume autoplay after grace period
  const resumeAutoplay = (delay = 2500) => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      setIsPaused(false);
    }, delay);
  };

  // Touch Handlers (Finger interaction)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!needsLoop) return;
    pauseAutoplay();
    isPointerDown.current = true;
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    deltaXRef.current = 0;
    gestureDirectionRef.current = null;
    setIsTransitioning(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPointerDown.current || !needsLoop) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startXRef.current;
    const diffY = currentY - startYRef.current;

    // Detect if the user is scrolling vertically vs swiping horizontally
    if (gestureDirectionRef.current === null) {
      if (Math.abs(diffX) > 7 || Math.abs(diffY) > 7) {
        gestureDirectionRef.current = Math.abs(diffX) > Math.abs(diffY) ? 'horizontal' : 'vertical';
      }
    }

    // Only apply horizontal drag if user is intentionally swiping horizontally
    if (gestureDirectionRef.current === 'horizontal') {
      deltaXRef.current = diffX;
      setDragOffset(diffX);
    }
  };

  const handleTouchEnd = () => {
    if (!isPointerDown.current || !needsLoop) return;
    isPointerDown.current = false;
    const diff = deltaXRef.current;
    const wasHorizontal = gestureDirectionRef.current === 'horizontal';
    setDragOffset(0);
    gestureDirectionRef.current = null;

    if (wasHorizontal) {
      if (diff < -40) {
        // Swiped left -> advance right to left
        goNext();
      } else if (diff > 40) {
        // Swiped right -> go to previous
        goPrev();
      } else {
        // Snap back to current slide
        setIsTransitioning(true);
      }
    }

    resumeAutoplay(2500);
  };

  // Mouse Handlers (Desktop drag & pause on hover)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!needsLoop) return;
    pauseAutoplay();
    isPointerDown.current = true;
    startXRef.current = e.clientX;
    deltaXRef.current = 0;
    setIsTransitioning(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPointerDown.current || !needsLoop) return;
    const diff = e.clientX - startXRef.current;
    deltaXRef.current = diff;
    if (Math.abs(diff) > 5) {
      e.preventDefault();
      setDragOffset(diff);
    }
  };

  const handleMouseUp = () => {
    if (!isPointerDown.current || !needsLoop) return;
    isPointerDown.current = false;
    const diff = deltaXRef.current;
    setDragOffset(0);

    if (diff < -40) {
      goNext();
    } else if (diff > 40) {
      goPrev();
    } else {
      setIsTransitioning(true);
    }

    resumeAutoplay(2500);
  };

  const handleMouseEnter = () => {
    pauseAutoplay();
  };

  const handleMouseLeave = () => {
    if (isPointerDown.current) {
      handleMouseUp();
    } else {
      resumeAutoplay(1500);
    }
  };

  // Dot navigation
  const handleDotClick = (targetIndex: number) => {
    if (!needsLoop) return;
    pauseAutoplay();
    setIsTransitioning(true);
    setSlideIndex(targetIndex + 1);
    resumeAutoplay(3500);
  };

  if (!offers || offers.length === 0) {
    if (mode === 'admin') {
      return (
        <div className="p-8 rounded-2xl bg-white border border-dashed border-slate-300 text-center col-span-full">
          <p className="text-sm font-semibold text-slate-700">No active promo offers</p>
          <p className="text-xs text-slate-400 mt-1">Configure coupons in the right panel</p>
        </div>
      );
    }
    return null;
  }

  // Calculate track transform
  const totalSlides = slides.length;
  const containerWidth = containerRef.current?.offsetWidth || 350;
  const dragPercent = (dragOffset / containerWidth) * (100 / totalSlides);
  const baseTranslatePercent = (slideIndex * 100) / totalSlides;

  return (
    <div className="relative w-full max-w-[350px] mx-auto group/slider select-none">
      {/* Previous Arrow Button (Desktop hover) */}
      {needsLoop && (
        <button
          onClick={() => {
            pauseAutoplay();
            goPrev();
            resumeAutoplay(3000);
          }}
          aria-label="Previous coupon"
          className="hidden sm:flex absolute -left-4 top-1/2 -translate-y-1/2 z-20 size-8 rounded-full bg-white/95 backdrop-blur-md shadow-md border border-slate-200 text-slate-700 items-center justify-center opacity-0 group-hover/slider:opacity-100 hover:bg-lime-50 hover:text-[#28a728] active:scale-95 transition-all duration-200 cursor-pointer"
        >
          <ChevronLeft className="size-4" />
        </button>
      )}

      {/* Outer Viewport: Exactly 350px, overflow-hidden, shows 1 card at a time */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="w-full overflow-hidden rounded-2xl cursor-grab active:cursor-grabbing touch-pan-y"
      >
        {/* Sliding Track: Width = totalSlides * 100% */}
        <div
          className="flex flex-nowrap"
          style={{
            width: `${totalSlides * 100}%`,
            transform: `translateX(calc(-${baseTranslatePercent}% + ${dragPercent}%))`,
            transition: isTransitioning
              ? 'transform 0.45s cubic-bezier(0.25, 1, 0.5, 1)'
              : 'none',
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {slides.map((offer: any, idx: number) => (
            <div
              key={`slide-${offer.id || idx}-${idx}`}
              className="shrink-0"
              style={{ width: `${100 / totalSlides}%` }}
            >
              <OfferCard offer={offer} onClick={onOfferClick} />
            </div>
          ))}
        </div>
      </div>

      {/* Next Arrow Button (Desktop hover) */}
      {needsLoop && (
        <button
          onClick={() => {
            pauseAutoplay();
            goNext();
            resumeAutoplay(3000);
          }}
          aria-label="Next coupon"
          className="hidden sm:flex absolute -right-4 top-1/2 -translate-y-1/2 z-20 size-8 rounded-full bg-white/95 backdrop-blur-md shadow-md border border-slate-200 text-slate-700 items-center justify-center opacity-0 group-hover/slider:opacity-100 hover:bg-lime-50 hover:text-[#28a728] active:scale-95 transition-all duration-200 cursor-pointer"
        >
          <ChevronRight className="size-4" />
        </button>
      )}

      {/* Pagination Indicator Dots */}
      {needsLoop && (
        <div className="flex items-center justify-center gap-1.5 mt-2.5">
          {offers.map((_, idx) => (
            <button
              key={idx}
              onClick={() => handleDotClick(idx)}
              aria-label={`Go to offer ${idx + 1}`}
              className={`transition-all duration-300 rounded-full h-1.5 cursor-pointer ${
                realIndex === idx
                  ? 'w-5 bg-[#32CD32] shadow-xs'
                  : 'w-1.5 bg-slate-300 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
