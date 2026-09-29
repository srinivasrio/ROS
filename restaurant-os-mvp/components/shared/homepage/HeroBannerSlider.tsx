'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { Banner } from '@/services/banner.service';
import { BannerManager, EmptyBannerState } from '@/components/admin/homepage-builder/BannerManager';
import { resolveBannerDestination } from '@/lib/banner-navigation';

interface HeroBannerSliderProps {
  banners: Banner[];
  mode: 'admin' | 'customer';
  restaurantId?: string;
  tableNumber?: string;
  homepageData?: any;
  onBannersChange?: () => void;
  onBannerClick?: (banner: Banner) => void;
}

export default function HeroBannerSlider({
  banners,
  mode,
  restaurantId,
  tableNumber,
  homepageData,
  onBannersChange,
  onBannerClick,
}: HeroBannerSliderProps) {
  const router = useRouter();

  // Filter active banners
  const visibleBanners = useMemo(() => {
    const filtered = mode === 'admin' ? banners : banners.filter((b) => b.active !== false);
    return (filtered || []).filter((b) => b && b.image_url);
  }, [banners, mode]);

  const count = visibleBanners.length;
  const needsLoop = count > 1;

  // Seamless infinite loop clones
  const slides = needsLoop
    ? [visibleBanners[count - 1], ...visibleBanners, visibleBanners[0]]
    : visibleBanners;

  const [slideIndex, setSlideIndex] = useState(needsLoop ? 1 : 0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Touch & swipe tracking
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwipingRef = useRef(false);

  const markImageLoaded = useCallback((idx: number) => {
    setLoadedImages((prev) => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
  }, []);

  const realIndex = needsLoop ? (slideIndex - 1 + count) % count : 0;

  useEffect(() => {
    setSlideIndex(needsLoop ? 1 : 0);
    setIsTransitioning(false);
  }, [count, needsLoop]);

  const goNext = useCallback(() => {
    if (!needsLoop) return;
    setIsTransitioning(true);
    setSlideIndex((prev) => prev + 1);
  }, [needsLoop]);

  const goPrev = useCallback(() => {
    if (!needsLoop) return;
    setIsTransitioning(true);
    setSlideIndex((prev) => prev - 1);
  }, [needsLoop]);

  const handleTransitionEnd = () => {
    if (!needsLoop) return;
    if (slideIndex >= count + 1) {
      setIsTransitioning(false);
      setSlideIndex(1);
    } else if (slideIndex <= 0) {
      setIsTransitioning(false);
      setSlideIndex(count);
    }
  };

  useEffect(() => {
    if (!needsLoop || mode === 'admin' || isPaused) {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
      return;
    }
    autoplayRef.current = setInterval(goNext, 5000);
    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
    };
  }, [needsLoop, mode, isPaused, goNext]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwipingRef.current = false;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diffX = touchStartX.current - e.changedTouches[0].clientX;
    const diffY = touchStartY.current - e.changedTouches[0].clientY;

    if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
      isSwipingRef.current = true;
      setTimeout(() => {
        isSwipingRef.current = false;
      }, 250);
    }

    if (Math.abs(diffX) > 40) {
      if (diffX > 0) goNext();
      else goPrev();
    }
    setIsPaused(false);
  };

  const handleSlideClick = (banner: Banner) => {
    if (mode !== 'customer') return;
    if (isSwipingRef.current) return;

    if (onBannerClick) {
      onBannerClick(banner);
      return;
    }

    const destinationUrl = resolveBannerDestination(
      banner,
      restaurantId || '',
      tableNumber || '1',
      homepageData
    );

    if (destinationUrl) {
      router.push(destinationUrl);
    }
  };

  // Admin empty state
  if (mode === 'admin' && count === 0) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <EmptyBannerState
          restaurantId={restaurantId || ''}
          onBannersChange={onBannersChange || (() => {})}
          homepageData={homepageData}
        />
      </div>
    );
  }

  // Customer empty state
  if (mode === 'customer' && count === 0) {
    return null;
  }

  return (
    <div
      className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 group/hero select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative aspect-[16/9] sm:aspect-[21/9] max-h-[360px] sm:max-h-[400px] rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-900 border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.08)]">
        {/* Track */}
        <div
          className="flex flex-nowrap w-full h-full"
          style={{
            transition: isTransitioning ? 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
            transform: `translateX(-${(slideIndex * 100) / (slides.length || 1)}%)`,
            width: `${slides.length * 100}%`,
          }}
          onTransitionEnd={handleTransitionEnd}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {slides.map((banner, idx) => {
            const destinationUrl =
              mode === 'customer'
                ? resolveBannerDestination(
                    banner,
                    restaurantId || '',
                    tableNumber || '1',
                    homepageData
                  )
                : null;
            const isClickable = Boolean(destinationUrl);

            return (
              <div
                key={`slide-${banner.id || idx}-${idx}`}
                className={`h-full shrink-0 relative overflow-hidden group/slide ${
                  isClickable ? 'cursor-pointer' : 'cursor-default'
                }`}
                style={{ width: `${100 / slides.length}%` }}
                onClick={() => handleSlideClick(banner)}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={(e) => {
                  if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    handleSlideClick(banner);
                  }
                }}
              >
                {/* Loading shimmer placeholder */}
                {!loadedImages.has(idx) && (
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
                )}
                <Image
                  src={banner.image_url}
                  alt={banner.heading || `Featured dish ${idx + 1}`}
                  fill
                  priority={idx <= 2}
                  className={`object-cover pointer-events-none transition-opacity duration-300 ${
                    loadedImages.has(idx) ? 'opacity-100' : 'opacity-0'
                  }`}
                  sizes="(max-width: 768px) 100vw, 1200px"
                  onLoad={() => markImageLoaded(idx)}
                />

                {/* Culinary Ambient Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent flex flex-col justify-end p-5 sm:p-8 lg:p-10 pointer-events-none">
                  {banner.heading && (
                    <h2 className="text-white text-xl sm:text-2xl lg:text-3xl font-black tracking-tight font-display drop-shadow-md">
                      {banner.heading}
                    </h2>
                  )}
                  {banner.subheading && (
                    <p className="text-slate-200 text-xs sm:text-sm font-medium max-w-xl mt-1 line-clamp-2 drop-shadow-sm">
                      {banner.subheading}
                    </p>
                  )}
                  {banner.cta_text && (
                    <div className="mt-3 sm:mt-4 inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-orange-600 text-white text-xs sm:text-sm font-bold shadow-lg shadow-orange-950/50 backdrop-blur-md transition-all duration-200 group-hover/slide:scale-105 group-hover/slide:bg-orange-500 w-fit pointer-events-none">
                      <span>{banner.cta_text}</span>
                      <ArrowRight className="size-3.5 sm:size-4 transition-transform group-hover/slide:translate-x-0.5" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation Arrows */}
        {needsLoop && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              aria-label="Previous banner"
              className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 size-9 sm:size-11 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center opacity-0 group-hover/hero:opacity-100 transition-all hover:bg-slate-900/80 active:scale-95 z-20"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              aria-label="Next banner"
              className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 size-9 sm:size-11 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center opacity-0 group-hover/hero:opacity-100 transition-all hover:bg-slate-900/80 active:scale-95 z-20"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}

        {/* Indicator Dots */}
        {count > 1 && (
          <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20 bg-slate-950/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
            {visibleBanners.map((_, i) => (
              <button
                key={`dot-${i}`}
                onClick={() => {
                  setIsTransitioning(true);
                  setSlideIndex(needsLoop ? i + 1 : i);
                }}
                aria-label={`Go to slide ${i + 1}`}
                className={`transition-all duration-300 rounded-full ${
                  i === realIndex ? 'w-5 h-1.5 bg-orange-500' : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        )}

        {/* Admin controls overlay (only in admin mode) */}
        {mode === 'admin' && restaurantId && onBannersChange && (
          <div className="opacity-0 group-hover/hero:opacity-100 transition-opacity">
            <BannerManager
              restaurantId={restaurantId}
              banners={visibleBanners}
              onBannersChange={onBannersChange}
              currentBannerIndex={realIndex}
              homepageData={homepageData}
            />
          </div>
        )}
      </div>
    </div>
  );
}
