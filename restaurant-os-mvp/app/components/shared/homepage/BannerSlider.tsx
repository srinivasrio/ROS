'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Banner } from '@/app/services/banner.service';
import { BannerManager, EmptyBannerState } from '@/app/components/admin/homepage-builder/BannerManager';

// ─── Props ────────────────────────────────────────────────────────────────────

interface BannerSliderProps {
    /** All banner records (already filtered if needed by caller) */
    banners: Banner[];
    /** 'admin' shows edit controls and all banners; 'customer' shows only active */
    mode: 'admin' | 'customer';
    /** Restaurant ID – used by admin controls */
    restaurantId?: string;
    /** Called when admin performs a CRUD so parent re-fetches from DB */
    onBannersChange?: () => void;
    /** Section style overrides */
    sectionStyle?: Record<string, string>;
}

// ─── BannerSlider ─────────────────────────────────────────────────────────────

export default function BannerSlider({
    banners,
    mode,
    restaurantId,
    onBannersChange,
    sectionStyle,
}: BannerSliderProps) {
    // Filter: customer only sees active banners; admin sees all
    const visibleBanners = useMemo(() => {
        const filtered = mode === 'admin' ? banners : banners.filter(b => b.active !== false);
        return filtered.filter(b => b && b.image_url);
    }, [banners, mode]);

    const count = visibleBanners.length;
    const needsLoop = count > 1;

    // Extended slides: [last, ...originals, first] for seamless bidirectional loop
    const slides = needsLoop
        ? [visibleBanners[count - 1], ...visibleBanners, visibleBanners[0]]
        : visibleBanners;

    // If looping, index 0 is the clone of the last slide, so start at 1
    const [slideIndex, setSlideIndex] = useState(needsLoop ? 1 : 0);
    const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const touchStartX = useRef(0);

    // Real index within the original (non-cloned) array
    const realIndex = needsLoop ? (slideIndex - 1 + count) % count : 0;

    // Reset when banner count changes
    useEffect(() => {
        setSlideIndex(needsLoop ? 1 : 0);
        setIsTransitioning(false);
    }, [count, needsLoop]);

    const goNext = useCallback(() => {
        if (!needsLoop) return;
        setIsTransitioning(true);
        setSlideIndex(prev => prev + 1);
    }, [needsLoop]);

    const goPrev = useCallback(() => {
        if (!needsLoop) return;
        setIsTransitioning(true);
        setSlideIndex(prev => prev - 1);
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

    // Autoplay (customer only)
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

    // Swipe
    const handleTouchStart = (e: React.TouchEvent) => {
        setIsPaused(true);
        touchStartX.current = e.touches[0].clientX;
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
        const diff = touchStartX.current - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) {
            if (diff > 0) goNext(); else goPrev();
        }
        setIsPaused(false);
    };

    // ─── Admin: empty state ─────────────────────────────────────────────────
    if (mode === 'admin' && count === 0) {
        return (
            <section className="px-6 py-2">
                <EmptyBannerState
                    restaurantId={restaurantId!}
                    onBannersChange={onBannersChange!}
                />
            </section>
        );
    }

    // ─── Customer: no banners → render nothing ──────────────────────────────
    if (mode === 'customer' && count === 0) {
        return null;
    }

    return (
        <section
            className="px-6 py-2 group/hero"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            <div className="relative aspect-[16/9] rounded-[24px] overflow-hidden border border-neutral-100 bg-neutral-100 group">

                {/* Slide track */}
                <div
                    className="flex flex-nowrap w-full h-full"
                    style={{
                        transition: isTransitioning ? 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
                        transform: `translateX(-${(slideIndex * 100) / (slides.length || 1)}%)`,
                        width: `${slides.length * 100}%`,
                    }}
                    onTransitionEnd={handleTransitionEnd}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    {slides.map((banner, idx) => {
                        return (
                            <div
                                key={`slide-${banner.id || idx}-${idx}`}
                                className="h-full shrink-0 relative bg-transparent overflow-hidden"
                                style={{ width: `${100 / slides.length}%` }}
                            >
                                {/* Banner image */}
                                <Image
                                    src={banner.image_url}
                                    alt={banner.heading || `Banner ${idx + 1}`}
                                    fill
                                    className="object-cover pointer-events-none"
                                    sizes="100vw"
                                    priority={idx <= 2}
                                    onError={() => console.error(`[BannerSlider] Image failed to load: ${banner.image_url}`)}
                                />

                                {/* Overlay text */}
                                {(banner.heading || banner.subheading) && (
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-8 pb-12 pointer-events-none">
                                        {banner.heading && (
                                            <h2 className="text-white text-2xl font-black mb-2 drop-shadow-lg">
                                                {banner.heading}
                                            </h2>
                                        )}
                                        {banner.subheading && (
                                            <p className="text-white/90 text-sm font-medium max-w-[80%] line-clamp-2 drop-shadow-md">
                                                {banner.subheading}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Navigation arrows */}
                {needsLoop && (
                    <>
                        <button
                            onClick={(e) => { e.stopPropagation(); goPrev(); }}
                            className="absolute left-4 top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-white/40 active:scale-95 z-20"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); goNext(); }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-white/40 active:scale-95 z-20"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </>
                )}

                {/* Pagination dots */}
                {needsLoop && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                        {visibleBanners.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => { setIsTransitioning(true); setSlideIndex(idx + 1); }}
                                className={`h-1.5 rounded-full transition-all duration-300 ${realIndex === idx ? 'w-6 bg-white shadow-lg' : 'w-1.5 bg-white/40 hover:bg-white/60'}`}
                            />
                        ))}
                    </div>
                )}

                {/* Admin controls overlay (only in admin mode) */}
                {mode === 'admin' && restaurantId && onBannersChange && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <BannerManager
                            restaurantId={restaurantId}
                            banners={visibleBanners}
                            onBannersChange={onBannersChange}
                            currentBannerIndex={realIndex}
                        />
                    </div>
                )}
            </div>
        </section>
    );
}
