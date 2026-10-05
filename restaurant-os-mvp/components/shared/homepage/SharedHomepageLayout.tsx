'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, X, ArrowRight, ChefHat, Eye, EyeOff, Sparkles, 
  Utensils, Plus, Minus, Check, Clock, RotateCcw, Timer, Flame
} from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';

import { HomepageSection, DEFAULT_HOMEPAGE_SECTIONS, HomepageBuilderService } from '@/services/homepage-builder.service';
import { MenuService } from '@/services/menu.service';
import { CustomerCache } from '@/services/homepage-cache.service';
import { resolveBannerDestination } from '@/lib/banner-navigation';
import { useCartSafe } from '@/context/CartContext';
import { SharedServicePopupCard } from '@/components/shared/services/SharedServicePopupCard';
import { STYLES } from '@/lib/design-tokens';

// Standardized Homepage Components
import RestaurantHeader from './RestaurantHeader';
import HeroBannerSlider from './HeroBannerSlider';
import CategoryCard from './CategoryCard';
import PopularItemCard from './PopularItemCard';
import PopularSlider from './PopularSlider';
import SpecialCard from './SpecialCard';
import SpecialsSlider from './SpecialsSlider';
import ComboCard from './ComboCard';
import CombosSlider from './CombosSlider';
import OfferCard from './OfferCard';
import OffersSlider from './OffersSlider';
import ServiceCard from './ServiceCard';
import RestaurantFooter from './RestaurantFooter';
import {
  SharedSpecialDetailModal,
  SharedComboDetailModal,
  SharedOfferDetailModal,
  SharedItemDetailModal,
  VegNonVegBadge,
} from '@/components/shared/details';

export interface SharedHomepageProps {
  mode: 'customer' | 'admin';
  restaurantId: string;
  tableNumber?: string;
  profile: any;
  theme?: any;
  sections: HomepageSection[];
  data: {
    banners?: any[];
    categories?: any[];
    services?: any[];
    specials?: any[];
    combos?: any[];
    offers?: any[];
    popularItems?: any[];
    recentOrders?: any[];
    menuItems?: any[];
    sectionStyles?: any;
  };
  onUpdate?: (type: string, data: any) => void;
  addToCart?: (item: any, qty: number) => void;
  updateQuantity?: (itemId: string, delta: number) => void;
  getItemQtyInCart?: (itemId: string) => number;
  addSpecialToCart?: (item: any) => void;
  onSearchClick?: () => void;
  onCategoryClick?: (category: any) => void;
  onServiceClick?: (service: any) => void;
  onServicesHeaderClick?: () => void;
  onBannersChange?: () => void;
  selectedSectionId?: string | null;
  onSelectSection?: (sectionId: string) => void;
}

export default function SharedHomepageLayout({
  mode,
  restaurantId,
  tableNumber,
  profile,
  sections,
  data,
  onUpdate,
  addToCart: propAddToCart,
  updateQuantity: propUpdateQuantity,
  getItemQtyInCart: propGetItemQtyInCart,
  addSpecialToCart: propAddSpecialToCart,
  onSearchClick: propOnSearchClick,
  onCategoryClick: propOnCategoryClick,
  onServiceClick: propOnServiceClick,
  onServicesHeaderClick: propOnServicesHeaderClick,
  onBannersChange,
  selectedSectionId,
  onSelectSection,
}: SharedHomepageProps) {
  const router = useRouter();
  const cartContext = useCartSafe();

  // Unified cart actions
  const addToCart = useCallback(
    (item: any, qty: number = 1) => {
      if (propAddToCart) propAddToCart(item, qty);
      else if (cartContext?.addToCart) cartContext.addToCart(item, qty);
    },
    [propAddToCart, cartContext]
  );

  const updateQuantity = useCallback(
    (itemId: string, delta: number) => {
      if (propUpdateQuantity) propUpdateQuantity(itemId, delta);
      else if (cartContext?.updateQuantity) cartContext.updateQuantity(itemId, delta);
    },
    [propUpdateQuantity, cartContext]
  );

  const getItemQtyInCart = useCallback(
    (itemId: string): number => {
      if (propGetItemQtyInCart) return propGetItemQtyInCart(itemId);
      if (cartContext?.getItemQtyInCart) return cartContext.getItemQtyInCart(itemId);
      return 0;
    },
    [propGetItemQtyInCart, cartContext]
  );

  const addSpecialToCart = useCallback(
    (item: any) => {
      if (propAddSpecialToCart) propAddSpecialToCart(item);
      else if (cartContext?.addSpecialToCart) cartContext.addSpecialToCart(item);
      else addToCart(item, 1);
    },
    [propAddSpecialToCart, cartContext, addToCart]
  );

  // Helper to deduplicate items by ID
  const deduplicate = (items: any[] | undefined) => {
    if (!items) return [];
    const seen = new Set();
    return items.filter((item) => {
      const id = item.id || item.section_type || item.name || item.title || JSON.stringify(item);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };

  const banners = useMemo(() => deduplicate(data?.banners), [data?.banners]);
  const categories = useMemo(() => deduplicate(data?.categories), [data?.categories]);
  const services = useMemo(() => deduplicate(data?.services), [data?.services]);
  const specials = useMemo(() => deduplicate(data?.specials), [data?.specials]);
  const combos = useMemo(() => deduplicate(data?.combos), [data?.combos]);
  const offers = useMemo(() => deduplicate(data?.offers), [data?.offers]);
  const popularItems = useMemo(() => deduplicate(data?.popularItems), [data?.popularItems]);
  const recentOrders = useMemo(() => data?.recentOrders || [], [data?.recentOrders]);
  const menuItems = useMemo(() => data?.menuItems || [], [data?.menuItems]);

  const effectiveSections = (sections && sections.length > 0) ? sections : DEFAULT_HOMEPAGE_SECTIONS;
  const sortedSections = useMemo(() => {
    const list = [...deduplicate(effectiveSections)].sort((a: any, b: any) => {
      const orderA = a.order !== undefined ? a.order : (a.display_order ?? 0);
      const orderB = b.order !== undefined ? b.order : (b.display_order ?? 0);
      return orderA - orderB;
    });

    // Enforce platform standard: Popular Items must always sit below banners and above categories
    const popularIndex = list.findIndex(s => (s.section_type || s.type) === 'popular');
    const categoriesIndex = list.findIndex(s => (s.section_type || s.type) === 'categories');
    if (popularIndex !== -1 && categoriesIndex !== -1 && popularIndex > categoriesIndex) {
      const [popularSec] = list.splice(popularIndex, 1);
      list.splice(categoriesIndex, 0, popularSec);
    }

    return list;
  }, [effectiveSections]);

  // Modals & Interaction States
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [selectedSpecial, setSelectedSpecial] = useState<any>(null);
  const [selectedCombo, setSelectedCombo] = useState<any>(null);
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchModalOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isSearchModalOpen]);

  // Search indexing
  const combinedSearchItems = useMemo(() => {
    const items = [
      ...menuItems.map((i: any) => ({ ...i, image_url: i.image_url || i.image || i.photo_url, itemType: 'menu' })),
      ...specials.map((i: any) => ({ ...i, name: i.title || i.name, image_url: i.image_url || i.image || i.photo_url, itemType: 'special' })),
      ...combos.map((i: any) => ({ ...i, name: i.title || i.name, image_url: i.image_url || i.image || i.photo_url, itemType: 'combo' })),
      ...popularItems.map((i: any) => ({ ...i, image_url: i.image_url || i.image || i.photo_url, itemType: 'popular' })),
    ];
    const seen = new Map();
    items.forEach((item) => {
      if (!item) return;
      const key = String(item.id || `${item.name}-${item.price}`);
      if (!seen.has(key)) {
        seen.set(key, item);
      } else {
        const existing = seen.get(key);
        if (!existing.image_url && item.image_url) {
          existing.image_url = item.image_url;
        }
      }
    });
    return Array.from(seen.values());
  }, [menuItems, specials, combos, popularItems]);

  const filteredSearchItems = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const query = searchTerm.toLowerCase().trim();
    return combinedSearchItems
      .filter((item) => item.name?.toLowerCase().includes(query) || item.description?.toLowerCase().includes(query))
      .slice(0, 25);
  }, [combinedSearchItems, searchTerm]);

  // Dishes for selected category modal
  const categoryDishes = useMemo(() => {
    if (!selectedCategory || !menuItems) return [];
    return menuItems.filter((item: any) => String(item.category_id) === String(selectedCategory.id));
  }, [selectedCategory, menuItems]);

  // Handle Category click
  const handleCategoryClick = (category: any) => {
    if (propOnCategoryClick) {
      propOnCategoryClick(category);
      return;
    }
    if (mode === 'customer') {
      router.push(`/${restaurantId}/customer/menu/${tableNumber}?category=${encodeURIComponent(category.name || category.id)}`);
      return;
    }
    setSelectedCategory(category);
  };

  // Handle Service click
  const handleServiceClick = (service: any) => {
    if (propOnServiceClick) {
      propOnServiceClick(service);
      return;
    }
    setSelectedService(service);
  };

  // Handle Hero Banner click directly on Homepage without redirecting to Menu
  const handleBannerClick = useCallback(async (banner: any) => {
    if (!banner || !banner.redirect_type || banner.redirect_type === 'none') {
      return;
    }

    const target = banner.redirect_target?.trim();
    if (!target) return;

    // 1. Menu Item: Show Item Detail Modal directly on Homepage (NO redirect to menu section)
    if (banner.redirect_type === 'menu_item') {
      const pool = [...(menuItems || []), ...(popularItems || []), ...(specials || [])];
      let found = pool.find((m: any) => 
        String(m.id) === target || 
        m.name?.toLowerCase() === target.toLowerCase()
      );

      if (!found) {
        const cachedMenu = CustomerCache.get(restaurantId, 'menu', tableNumber);
        if (cachedMenu?.allMenuItems) {
          found = cachedMenu.allMenuItems.find((m: any) => 
            String(m.id) === target || 
            m.name?.toLowerCase() === target.toLowerCase()
          );
        }
      }

      if (found) {
        if ((found as any).isSpecial || (found as any).is_today_special) {
          setSelectedSpecial(found);
        } else {
          setSelectedItem(found);
        }
        return;
      }

      // Asynchronous fallback if item is not in local memory yet
      try {
        const fetchedItems = await MenuService.fetchMenuItems(restaurantId);
        const asyncFound = fetchedItems?.find((m: any) => 
          String(m.id) === target || 
          m.name?.toLowerCase() === target.toLowerCase()
        );
        if (asyncFound) {
          setSelectedItem(asyncFound);
          return;
        }
      } catch (e) {
        // Fall through to toast
      }
      toast.error('The selected menu item is no longer available');
      return;
    }

    // 2. Combo: Show Combo Detail Modal directly on Homepage (NO redirect to combos/menu)
    if (banner.redirect_type === 'combo') {
      if (target === 'all') {
        router.push(`/${restaurantId}/customer/combos/${tableNumber}`);
        return;
      }
      let found = (combos || []).find((c: any) => 
        String(c.id) === target ||
        c.title?.toLowerCase() === target.toLowerCase() ||
        c.name?.toLowerCase() === target.toLowerCase()
      );
      if (found) {
        setSelectedCombo(found);
        return;
      }

      try {
        const fetchedCombos = await HomepageBuilderService.getCombos(restaurantId, true);
        const asyncFound = fetchedCombos?.find((c: any) => 
          String(c.id) === target ||
          c.title?.toLowerCase() === target.toLowerCase() ||
          c.name?.toLowerCase() === target.toLowerCase()
        );
        if (asyncFound) {
          setSelectedCombo(asyncFound);
          return;
        }
      } catch (e) {}
      toast.error('The selected combo is no longer available');
      return;
    }

    // 3. Special: Show Special Detail Modal directly on Homepage (NO redirect to specials/menu)
    if (banner.redirect_type === 'special') {
      if (target === 'all') {
        router.push(`/${restaurantId}/customer/specials/${tableNumber}`);
        return;
      }
      let found = (specials || []).find((s: any) => 
        String(s.id) === target ||
        s.title?.toLowerCase() === target.toLowerCase() ||
        s.name?.toLowerCase() === target.toLowerCase()
      );
      if (found) {
        setSelectedSpecial(found);
        return;
      }

      try {
        const fetchedSpecials = await HomepageBuilderService.getSpecials(restaurantId, true);
        const asyncFound = fetchedSpecials?.find((s: any) => 
          String(s.id) === target ||
          s.title?.toLowerCase() === target.toLowerCase() ||
          s.name?.toLowerCase() === target.toLowerCase()
        );
        if (asyncFound) {
          setSelectedSpecial(asyncFound);
          return;
        }
      } catch (e) {}
      toast.error('The selected special is no longer available');
      return;
    }

    // 4. Offer: Show Offer Detail Modal directly on Homepage
    if (banner.redirect_type === 'offer') {
      if (target === 'all') {
        router.push(`/${restaurantId}/customer/offers/${tableNumber}`);
        return;
      }
      let found = (offers || []).find((o: any) => 
        String(o.id) === target ||
        o.code?.toLowerCase() === target.toLowerCase() ||
        o.coupon_code?.toLowerCase() === target.toLowerCase() ||
        o.title?.toLowerCase() === target.toLowerCase()
      );
      if (found) {
        setSelectedOffer(found);
        return;
      }

      try {
        const fetchedOffers = await HomepageBuilderService.getOffers(restaurantId);
        const asyncFound = fetchedOffers?.find((o: any) => 
          String(o.id) === target ||
          o.code?.toLowerCase() === target.toLowerCase() ||
          o.coupon_code?.toLowerCase() === target.toLowerCase() ||
          o.title?.toLowerCase() === target.toLowerCase()
        );
        if (asyncFound) {
          setSelectedOffer(asyncFound);
          return;
        }
      } catch (e) {}
      toast.error('The selected offer is no longer available');
      return;
    }

    // 5. Category: Open Category Dishes Bottom Sheet on Homepage (NO redirect to menu section)
    if (banner.redirect_type === 'category') {
      const found = (categories || []).find((c: any) => 
        String(c.id) === target || 
        c.name?.toLowerCase() === target.toLowerCase()
      );
      if (found) {
        setSelectedCategory(found);
        return;
      }
      toast.error('The selected category is no longer available');
      return;
    }

    // 6. Service: Show Service Modal directly on Homepage
    if (banner.redirect_type === 'service') {
      const found = (services || []).find((s: any) => 
        String(s.id) === target || 
        s.title?.toLowerCase() === target.toLowerCase() ||
        s.name?.toLowerCase() === target.toLowerCase()
      );
      if (found) {
        setSelectedService(found);
        return;
      }
      return;
    }

    // 7. General Custom Page Navigation (e.g. My Orders, Cart)
    const destinationUrl = resolveBannerDestination(
      banner,
      restaurantId || '',
      tableNumber || '1',
      data
    );
    if (destinationUrl) {
      router.push(destinationUrl);
    }
  }, [
    menuItems,
    popularItems,
    specials,
    combos,
    offers,
    categories,
    services,
    restaurantId,
    tableNumber,
    data,
    router
  ]);

  // Visibility toggle for admin
  const handleToggleActive = (e: React.MouseEvent, sectionType: string) => {
    e.stopPropagation();
    if (!onUpdate) return;
    const currentSection = sortedSections.find((s) => s.section_type === sectionType || s.id === sectionType);
    if (!currentSection) return;
    const newActive = !currentSection.active;
    const updated = sortedSections.map((s) =>
      s.id === currentSection.id || s.section_type === sectionType ? { ...s, active: newActive } : s
    );
    onUpdate('sections', updated);
    toast.success(`Section ${newActive ? 'enabled' : 'hidden'}`);
  };

  return (
    <div className={`w-full ${mode === 'customer' ? 'bg-[#EEF2F6]' : 'bg-slate-50'} text-slate-900 font-sans antialiased pb-20 sm:pb-24`}>
      {sortedSections.map((section: any, sectionIdx: number) => {
        const sectionType = section.section_type || section.type;
        const isActive = section.active !== false;

        // In customer mode, skip inactive sections
        if (mode === 'customer' && !isActive) return null;

        const isSelectedInBuilder =
          mode === 'admin' && (selectedSectionId === section.id || selectedSectionId === sectionType);

        const wrapperClasses = `relative transition-all duration-200 ${
          mode === 'admin'
            ? `cursor-pointer ${
                isSelectedInBuilder
                  ? 'ring-3 ring-orange-500 rounded-2xl ring-offset-4 ring-offset-slate-100 bg-orange-500/5'
                  : 'hover:outline-dashed hover:outline-2 hover:outline-orange-300 rounded-xl'
              } ${!isActive ? 'opacity-40 grayscale' : ''}`
            : ''
        }`;

        return (
          <div
            key={section.id || `${sectionType || 'sec'}-${sectionIdx}`}
            id={`section-${sectionType}`}
            onClick={() => {
              if (mode === 'admin' && onSelectSection) {
                onSelectSection(section.id || sectionType);
              }
            }}
            className={wrapperClasses}
          >
            {/* Admin Floating Badge with Quick Visibility Toggle */}
            {mode === 'admin' && (
              <div className="absolute top-3 right-4 z-30 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md text-white px-2.5 py-1 rounded-full text-[11px] font-bold shadow-md pointer-events-auto">
                <span className="capitalize">{sectionType.replace('_', ' ')}</span>
                <button
                  onClick={(e) => handleToggleActive(e, sectionType)}
                  aria-label={isActive ? 'Hide section' : 'Show section'}
                  className="p-1 rounded-full hover:bg-white/20 transition-colors"
                >
                  {isActive ? <Eye className="size-3 text-emerald-400" /> : <EyeOff className="size-3 text-red-400" />}
                </button>
              </div>
            )}

            {/* Render Standardized Section Content */}
            {sectionType === 'header' && (
              <RestaurantHeader
                profile={profile}
                tableNumber={tableNumber}
                onSearchClick={() => setIsSearchModalOpen(true)}
                onServicesClick={() => setIsServiceModalOpen(true)}
                cartItemCount={cartContext?.totalItems || 0}
                onCartClick={() => router.push(`/${restaurantId}/customer/cart/${tableNumber}`)}
                mode={mode}
              />
            )}

            {sectionType === 'hero_banners' && (
              <HeroBannerSlider
                banners={banners}
                mode={mode}
                restaurantId={restaurantId}
                tableNumber={tableNumber}
                homepageData={data}
                onBannersChange={onBannersChange}
                onBannerClick={handleBannerClick}
              />
            )}

            {sectionType === 'categories' && (
              <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                <div className={STYLES.sectionHeader}>
                  <div>
                    <h2 className={STYLES.sectionTitle}>
                      {section.section_title || section.title || 'Explore Menu'}
                    </h2>
                    {mode === 'admin' && <p className={STYLES.sectionSubtitle}>
                      {section.section_subtitle || section.subtitle || 'Fresh, delicious meals prepared daily'}
                    </p>}
                  </div>
                  <button
                    onClick={() => router.push(`/${restaurantId}/customer/menu/${tableNumber}`)}
                    className={STYLES.sectionViewAll}
                  >
                    <span>View All</span>
                    <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>

                {/* Standardized Circular Category Cards Grid / Scroll */}
                <div className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar py-2 px-1 overscroll-x-contain">
                  {(categories || []).map((cat: any) => (
                    <CategoryCard
                      key={cat.id}
                      category={cat}
                      isSelected={selectedCategory?.id === cat.id}
                      onClick={handleCategoryClick}
                    />
                  ))}
                  {categories.length === 0 && mode === 'admin' && (
                    <div className="p-6 rounded-2xl bg-white border border-dashed border-slate-300 text-center w-full">
                      <p className="text-xs text-slate-500 font-medium">
                        No categories found. Add categories to your menu to see them here.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {sectionType === 'services' && (
              <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                <div className={STYLES.sectionHeader}>
                  <div>
                    <h2 className={STYLES.sectionTitle}>
                      {section.section_title || section.title || 'Quick Services'}
                    </h2>
                    {mode === 'admin' && <p className={STYLES.sectionSubtitle}>
                      {section.section_subtitle || section.subtitle || 'Tap any service for immediate table assistance'}
                    </p>}
                  </div>
                  <button
                    onClick={() => setIsServiceModalOpen(true)}
                    className={STYLES.sectionViewAll}
                  >
                    <span>All Services</span>
                    <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>

                {/* 2 Rows, Multiple Columns Grid with Horizontal Swipe */}
                <div className="grid grid-rows-2 grid-flow-col auto-cols-max gap-3.5 sm:gap-4 overflow-x-auto no-scrollbar py-2.5 px-1.5 scroll-smooth overscroll-x-contain">
                  {(services || []).filter((s: any) => mode === 'admin' || s.active !== false).map((srv: any) => (
                    <ServiceCard
                      key={srv.id}
                      service={srv}
                      onClick={handleServiceClick}
                      mode={mode}
                    />
                  ))}
                </div>
              </section>
            )}

            {sectionType === 'specials' && (
              <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                <div className={STYLES.sectionHeader}>
                  <div>
                    <h2 className={STYLES.sectionTitle}>
                      {section.section_title || section.title || "Chef's Specials"}
                    </h2>
                    {mode === 'admin' && <p className={STYLES.sectionSubtitle}>
                      {section.section_subtitle || section.subtitle || 'Signature delicacies curated exclusively for today'}
                    </p>}
                  </div>
                  <button
                    onClick={() => router.push(`/${restaurantId}/customer/specials/${tableNumber}`)}
                    className={STYLES.sectionViewAll}
                  >
                    <span>View All</span>
                    <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>

                {/* Single Row, Multiple Columns Slider */}
                <SpecialsSlider
                  specials={specials || []}
                  mode={mode}
                  getItemQtyInCart={getItemQtyInCart}
                  onAdd={addSpecialToCart}
                  onIncrement={(id) => updateQuantity(id, 1)}
                  onDecrement={(id) => updateQuantity(id, -1)}
                  onSpecialClick={(special) => setSelectedSpecial(special)}
                />
              </section>
            )}

            {sectionType === 'combos' && (
              <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                <div className={STYLES.sectionHeader}>
                  <div>
                    <h2 className={STYLES.sectionTitle}>
                      {section.section_title || section.title || 'Value Combos'}
                    </h2>
                    {mode === 'admin' && <p className={STYLES.sectionSubtitle}>
                      {section.section_subtitle || section.subtitle || 'Complete delicious meals at unbeatable bundled prices'}
                    </p>}
                  </div>
                  <button
                    onClick={() => router.push(`/${restaurantId}/customer/combos/${tableNumber}`)}
                    className={STYLES.sectionViewAll}
                  >
                    <span>View All</span>
                    <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>

                {/* Single Row, Multiple Columns Slider with Expandable Cards */}
                <CombosSlider
                  combos={combos || []}
                  mode={mode}
                  getItemQtyInCart={getItemQtyInCart}
                  onAdd={addSpecialToCart}
                  onIncrement={(id) => updateQuantity(id, 1)}
                  onDecrement={(id) => updateQuantity(id, -1)}
                  onComboClick={(combo) => setSelectedCombo(combo)}
                />
              </section>
            )}

            {sectionType === 'offers' && (
              <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                <div className={STYLES.sectionHeader}>
                  <div>
                    <h2 className={STYLES.sectionTitle}>
                      {section.section_title || section.title || 'Offers & Discounts'}
                    </h2>
                    {mode === 'admin' && <p className={STYLES.sectionSubtitle}>
                      {section.section_subtitle || section.subtitle || 'Claim exclusive coupons for your dining bill'}
                    </p>}
                  </div>
                  <button
                    onClick={() => router.push(`/${restaurantId}/customer/offers/${tableNumber}`)}
                    className={STYLES.sectionViewAll}
                  >
                    <span>View All</span>
                    <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>

                {/* Single Row Auto-Advancing & Interactive Swipe Slider */}
                <OffersSlider
                  offers={offers || []}
                  mode={mode}
                  onOfferClick={(offer) => setSelectedOffer(offer)}
                />
              </section>
            )}

            {sectionType === 'popular' && (
              <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                <div className={STYLES.sectionHeader}>
                  <div>
                    <h2 className={STYLES.sectionTitle}>
                      {section.section_title || section.title || 'Most Loved Dishes'}
                    </h2>
                    {mode === 'admin' && <p className={STYLES.sectionSubtitle}>
                      {section.section_subtitle || section.subtitle || 'Top rated selections favored by our guests'}
                    </p>}
                  </div>
                  <button
                    onClick={() => router.push(`/${restaurantId}/customer/popular/${tableNumber}`)}
                    className={STYLES.sectionViewAll}
                  >
                    <span>View All Items</span>
                    <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>

                {/* Single Row, Multiple Columns 1-Row Grid with Uniform Card Sizing */}
                <PopularSlider
                  items={popularItems || []}
                  mode={mode}
                  getItemQtyInCart={getItemQtyInCart}
                  onAdd={(it) => addToCart(it, 1)}
                  onIncrement={(id) => updateQuantity(id, 1)}
                  onDecrement={(id) => updateQuantity(id, -1)}
                  onItemClick={(item) => setSelectedItem(item)}
                  currencySymbol="₹"
                />
              </section>
            )}

            {sectionType === 'reorder' && (
              <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                <div className={STYLES.sectionHeader}>
                  <div>
                    <h2 className={STYLES.sectionTitle}>
                      {section.section_title || section.title || 'Quick Reorder'}
                    </h2>
                    {mode === 'admin' && <p className={STYLES.sectionSubtitle}>
                      {section.section_subtitle || section.subtitle || 'Easily repeat your favorite previous orders'}
                    </p>}
                  </div>
                </div>

                <div className="flex gap-4 overflow-x-auto no-scrollbar py-2 overscroll-x-contain">
                  {(recentOrders || []).map((order: any, orderIdx: number) => (
                    <div
                      key={order.id || `order-${orderIdx}`}
                      className="w-64 shrink-0 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                          <span className="font-semibold text-slate-900">Order #{order.id?.slice?.(0, 6) || 'Past'}</span>
                          <span className="flex items-center gap-1" suppressHydrationWarning>
                            <Clock className="size-3" />
                            {order.created_at ? new Date(order.created_at).toLocaleDateString() : 'Recent'}
                          </span>
                        </div>
                        <div className="space-y-1 my-3 text-xs text-slate-600">
                          {(order.items || order.order_items || []).slice(0, 2).map((item: any, idx: number) => (
                            <p key={idx} className="truncate">
                              {item.quantity}x {item.menu_item?.name || item.name || 'Dish'}
                            </p>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          (order.items || order.order_items || []).forEach((item: any) => {
                            addToCart(item.menu_item || item, item.quantity || 1);
                          });
                          toast.success('Items added to cart!');
                        }}
                        className="w-full py-2 rounded-xl bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                      >
                        <RotateCcw className="size-3.5" />
                        <span>Reorder Items</span>
                      </button>
                    </div>
                  ))}

                  {recentOrders.length === 0 && (
                    <div className="p-6 rounded-2xl bg-white border border-slate-200/80 text-center w-full">
                      <p className="text-xs text-slate-500">No past orders on this device yet.</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {sectionType === 'footer' && <RestaurantFooter profile={profile} mode={mode} />}
          </div>
        );
      })}

      {/* Table Service Action Sheet */}
      <SharedServicePopupCard
        service={selectedService}
        isOpen={!!selectedService}
        onClose={() => setSelectedService(null)}
        restaurantId={restaurantId}
        tableNumber={tableNumber || ''}
      />

      {/* Services List Modal */}
      <AnimatePresence>
        {isServiceModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => setIsServiceModalOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              style={{
                boxShadow: '0 20px 50px rgba(15, 23, 42, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.85)',
              }}
              className="bg-[#EEF2F6] w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-slate-200/60 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-800 font-display">Request Table Service</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Select an option for instant staff response</p>
                </div>
                <button
                  onClick={() => setIsServiceModalOpen(false)}
                  style={{
                    boxShadow: '3px 3px 6px rgba(166, 180, 200, 0.4), -3px -3px 6px rgba(255, 255, 255, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.8)',
                  }}
                  className="size-8 rounded-full bg-[#EEF2F6] text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors active:scale-95 cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-3.5 sm:gap-4 justify-items-center no-scrollbar">
                {(services || []).filter((s: any) => mode === 'admin' || s.active !== false).map((srv: any) => (
                  <ServiceCard
                    key={srv.id}
                    service={srv}
                    onClick={(service) => {
                      setIsServiceModalOpen(false);
                      setSelectedService(service);
                    }}
                    mode={mode}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category Dishes Bottom Sheet Modal */}
      <AnimatePresence>
        {selectedCategory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => setSelectedCategory(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              style={{
                boxShadow: '0 20px 50px rgba(15, 23, 42, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.85)',
              }}
              className="bg-[#EEF2F6] w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-slate-200/60 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-800 font-display">{selectedCategory.name}</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{categoryDishes.length} dishes in this category</p>
                </div>
                <button
                  onClick={() => setSelectedCategory(null)}
                  style={{
                    boxShadow: '3px 3px 6px rgba(166, 180, 200, 0.4), -3px -3px 6px rgba(255, 255, 255, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.8)',
                  }}
                  className="size-8 rounded-full bg-[#EEF2F6] text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors active:scale-95 cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto space-y-3 no-scrollbar flex-1">
                {categoryDishes.map((dish: any) => (
                  <div
                    key={dish.id}
                    style={{
                      boxShadow: '4px 4px 10px rgba(166, 180, 200, 0.35), -4px -4px 10px rgba(255, 255, 255, 0.95)',
                      border: '1px solid rgba(255, 255, 255, 0.85)',
                    }}
                    className="flex items-center justify-between p-3 rounded-2xl bg-[#EEF2F6] transition-all"
                  >
                    <div
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer pr-2"
                      onClick={() => {
                        setSelectedCategory(null);
                        setSelectedItem(dish);
                      }}
                    >
                      {dish.image_url ? (
                        <div 
                          style={{
                            boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.85)',
                            border: '1px solid rgba(255, 255, 255, 0.8)',
                          }}
                          className="relative size-14 rounded-xl overflow-hidden bg-[#EEF2F6] shrink-0 p-0.5"
                        >
                          <Image src={dish.image_url} alt={dish.name} fill className="object-cover rounded-lg" />
                        </div>
                      ) : (
                        <div 
                          style={{
                            boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.85)',
                            border: '1px solid rgba(255, 255, 255, 0.8)',
                          }}
                          className="size-14 rounded-xl bg-[#EEF2F6] text-orange-600 flex items-center justify-center shrink-0"
                        >
                          <Utensils className="size-6" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-slate-800 truncate hover:text-orange-600 transition-colors">{dish.name}</h4>
                        <span className="font-black text-sm text-slate-800 font-display">₹{dish.price}</span>
                      </div>
                    </div>

                    <div>
                      {getItemQtyInCart(String(dish.id)) > 0 ? (
                        <div 
                          style={{
                            boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                            border: '1px solid rgba(255, 255, 255, 0.7)',
                          }}
                          className="inline-flex items-center gap-1.5 bg-[#EEF2F6] rounded-xl p-1"
                        >
                          <button
                            onClick={() => updateQuantity(String(dish.id), -1)}
                            style={{
                              boxShadow: '2px 2px 4px rgba(234, 88, 12, 0.35)',
                            }}
                            className="size-6 rounded-lg bg-orange-600 text-white flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="size-3 stroke-[3]" />
                          </button>
                          <span className="font-black text-xs text-slate-800 min-w-[16px] text-center">
                            {getItemQtyInCart(String(dish.id))}
                          </span>
                          <button
                            onClick={() => updateQuantity(String(dish.id), 1)}
                            style={{
                              boxShadow: '2px 2px 4px rgba(234, 88, 12, 0.35)',
                            }}
                            className="size-6 rounded-lg bg-orange-600 text-white flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                            aria-label="Increase quantity"
                          >
                            <Plus className="size-3 stroke-[3]" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(dish, 1)}
                          style={{
                            boxShadow: '3px 3px 7px rgba(234, 88, 12, 0.35), -2px -2px 5px rgba(255, 255, 255, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.4)',
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-orange-600 text-white font-bold text-xs hover:bg-orange-700 transition-all active:scale-95 cursor-pointer"
                        >
                          Add +
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-slate-200/60 bg-[#EEF2F6]">
                <button
                  onClick={() => {
                    const catId = selectedCategory.id;
                    setSelectedCategory(null);
                    router.push(`/${restaurantId}/customer/menu/${tableNumber}?category=${catId}`);
                  }}
                  style={{
                    boxShadow: '3px 3px 8px rgba(166, 180, 200, 0.45), -3px -3px 8px rgba(255, 255, 255, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.9)',
                  }}
                  className="w-full py-3 rounded-xl bg-[#EEF2F6] text-slate-800 font-extrabold text-sm hover:text-orange-600 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  <span>View in Full Menu</span>
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Standardized Detail Modals */}
      <SharedSpecialDetailModal
        special={selectedSpecial}
        isOpen={Boolean(selectedSpecial)}
        onClose={() => setSelectedSpecial(null)}
        quantity={
          selectedSpecial
            ? getItemQtyInCart(`special-${selectedSpecial.id}`) ||
              getItemQtyInCart(String(selectedSpecial.id))
            : 0
        }
        onAdd={addSpecialToCart}
        onIncrement={(id) => updateQuantity(id, 1)}
        onDecrement={(id) => updateQuantity(id, -1)}
        currencySymbol="₹"
      />

      <SharedComboDetailModal
        combo={selectedCombo}
        isOpen={Boolean(selectedCombo)}
        onClose={() => setSelectedCombo(null)}
        quantity={
          selectedCombo
            ? getItemQtyInCart(`special-${selectedCombo.id}`) ||
              getItemQtyInCart(String(selectedCombo.id))
            : 0
        }
        onAdd={addSpecialToCart}
        onIncrement={(id) => updateQuantity(id, 1)}
        onDecrement={(id) => updateQuantity(id, -1)}
        currencySymbol="₹"
      />

      <SharedOfferDetailModal
        offer={selectedOffer}
        isOpen={Boolean(selectedOffer)}
        onClose={() => setSelectedOffer(null)}
        currencySymbol="₹"
        restaurantCode={restaurantId}
        tableNumber={tableNumber}
      />

      <SharedItemDetailModal
        item={selectedItem}
        isOpen={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        quantity={selectedItem ? getItemQtyInCart(String(selectedItem.id)) : 0}
        onAdd={(item, qty) => addToCart(item, qty)}
        onIncrement={(id) => updateQuantity(id, 1)}
        onDecrement={(id) => updateQuantity(id, -1)}
        currencySymbol="₹"
      />

      {/* Global Search Modal */}
      <AnimatePresence>
        {isSearchModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 backdrop-blur-sm p-4 pt-16 sm:pt-20"
            onClick={() => setIsSearchModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                boxShadow: '0 20px 50px rgba(15, 23, 42, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.85)',
              }}
              className="bg-[#EEF2F6] w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Search Bar Input */}
              <div className="p-4 border-b border-slate-200/60">
                <div 
                  style={{
                    boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.7)',
                  }}
                  className="bg-[#EEF2F6] px-3.5 py-2.5 rounded-2xl flex items-center gap-3"
                >
                  <Search className="size-5 text-orange-500 shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search dishes, drinks, specials..."
                    className="flex-1 text-base font-bold text-slate-800 placeholder:text-slate-400 outline-none bg-transparent"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      style={{
                        boxShadow: '2px 2px 5px rgba(166, 180, 200, 0.4), -2px -2px 5px rgba(255, 255, 255, 0.9)',
                      }}
                      className="size-7 rounded-full bg-[#EEF2F6] text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer active:scale-90"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Search Results */}
              <div className="p-4 overflow-y-auto space-y-2.5 flex-1 no-scrollbar">
                {searchTerm.trim() === '' ? (
                  <div className="py-12 text-center text-slate-500 font-medium text-xs sm:text-sm">
                    Type to search through all menu items, chef specials, and combos
                  </div>
                ) : filteredSearchItems.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 font-medium text-xs sm:text-sm">
                    No dishes found matching &quot;{searchTerm}&quot;
                  </div>
                ) : (
                  filteredSearchItems.map((item: any) => {
                    const imageUrl = item.image_url || item.image || item.photo_url || item.banner_image;
                    const qtyInCart = getItemQtyInCart(String(item.id));

                    return (
                      <div
                        key={item.id}
                        style={{
                          boxShadow: '3px 3px 8px rgba(166, 180, 200, 0.35), -3px -3px 8px rgba(255, 255, 255, 0.95)',
                          border: '1px solid rgba(255, 255, 255, 0.85)',
                        }}
                        className="flex items-center gap-3 p-2.5 sm:p-3 rounded-2xl bg-[#EEF2F6] transition-all hover:bg-white/40 group"
                      >
                        {/* Item Image with recessed neumorphic styling */}
                        <div
                          className="relative size-14 sm:size-16 rounded-xl overflow-hidden shrink-0 p-0.5 cursor-pointer"
                          style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                            border: '1px solid rgba(255, 255, 255, 0.7)',
                          }}
                          onClick={() => {
                            setIsSearchModalOpen(false);
                            if (item.itemType === 'special') setSelectedSpecial(item);
                            else if (item.itemType === 'combo') setSelectedCombo(item);
                            else setSelectedItem(item);
                          }}
                        >
                          {imageUrl ? (
                            <div className="relative w-full h-full rounded-[10px] overflow-hidden">
                              <Image
                                src={imageUrl}
                                alt={item.name}
                                fill
                                unoptimized
                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                                sizes="64px"
                              />
                            </div>
                          ) : (
                            <div className="w-full h-full rounded-[10px] bg-slate-200/60 flex items-center justify-center text-slate-400">
                              <Utensils className="size-5 sm:size-6 text-slate-400" />
                            </div>
                          )}
                        </div>

                        {/* Item Info */}
                        <div
                          className="min-w-0 flex-1 cursor-pointer"
                          onClick={() => {
                            setIsSearchModalOpen(false);
                            if (item.itemType === 'special') setSelectedSpecial(item);
                            else if (item.itemType === 'combo') setSelectedCombo(item);
                            else setSelectedItem(item);
                          }}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {(item.item_type || item.food_type || item.is_veg !== undefined || item.name) && (
                              <VegNonVegBadge
                                type={item.item_type || item.food_type}
                                isVeg={item.is_veg}
                                name={item.name}
                                size="xs"
                                showLabel={false}
                                className="shrink-0"
                              />
                            )}
                            <h4 className="font-bold text-sm text-slate-800 truncate group-hover:text-orange-600 transition-colors">
                              {item.name}
                            </h4>
                          </div>

                          {item.description && (
                            <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 leading-snug">
                              {item.description}
                            </p>
                          )}

                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-black text-orange-600 font-display">
                              ₹{item.price}
                            </span>
                            {item.itemType && (
                              <span 
                                style={{
                                  boxShadow: 'inset 1px 1px 2px rgba(166, 180, 200, 0.3), inset -1px -1px 2px rgba(255, 255, 255, 0.8)',
                                }}
                                className="text-[9px] uppercase font-bold text-slate-500 px-1.5 py-0.5 rounded bg-[#EEF2F6]"
                              >
                                {item.itemType}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Add to cart / Quantity controls */}
                        {qtyInCart > 0 ? (
                          <div 
                            className="flex items-center gap-1.5 p-1 rounded-xl bg-orange-600 text-white shadow-md shadow-orange-600/25 shrink-0"
                            style={{
                              boxShadow: '2px 2px 6px rgba(234, 88, 12, 0.35), -1px -1px 4px rgba(255, 255, 255, 0.8)',
                            }}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuantity(String(item.id), -1);
                              }}
                              className="size-6 rounded-lg bg-orange-700/60 hover:bg-orange-700 flex items-center justify-center active:scale-90 transition-all cursor-pointer"
                              title="Decrease"
                            >
                              <Minus size={13} strokeWidth={2.5} />
                            </button>
                            <span className="text-xs font-black min-w-4 text-center px-0.5">
                              {qtyInCart}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (item.itemType === 'special' || item.itemType === 'combo') {
                                  addSpecialToCart(item);
                                } else {
                                  updateQuantity(String(item.id), 1);
                                }
                              }}
                              className="size-6 rounded-lg bg-orange-700/60 hover:bg-orange-700 flex items-center justify-center active:scale-90 transition-all cursor-pointer"
                              title="Increase"
                            >
                              <Plus size={13} strokeWidth={2.5} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.itemType === 'special' || item.itemType === 'combo') {
                                addSpecialToCart(item);
                              } else {
                                addToCart(item, 1);
                              }
                              toast.success(`Added ${item.name} to cart`);
                            }}
                            style={{
                              boxShadow: '2px 2px 6px rgba(234, 88, 12, 0.35), -1px -1px 4px rgba(255, 255, 255, 0.8)',
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-orange-600 text-white font-bold text-xs hover:bg-orange-700 transition-all active:scale-95 shrink-0 cursor-pointer"
                          >
                            Add +
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
