'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import {
  X,
  Upload,
  Sparkles,
  Link2,
  ChevronDown,
  Check,
  Loader2,
  Utensils,
  Layers,
  Flame,
  Gift,
  BellRing,
  Compass,
  ArrowRight,
  Info,
} from 'lucide-react';
import { Banner, BannerService } from '@/services/banner.service';
import { MenuService, MenuItem } from '@/services/menu.service';
import { HomepageBuilderService } from '@/services/homepage-builder.service';
import { formatCurrency } from '@/lib/utils';
import {
  BannerDestinationType,
  BANNER_DESTINATION_TYPES,
  CUSTOM_PAGE_OPTIONS,
  getSuggestedCtas,
} from '@/lib/banner-navigation';
import { toast } from 'sonner';

interface BannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: 'create' | 'edit';
  initialBanner?: Banner | null;
  restaurantId: string;
  homepageData?: {
    menuItems?: any[];
    categories?: any[];
    combos?: any[];
    specials?: any[];
    offers?: any[];
    services?: any[];
  };
}

export default function BannerModal({
  isOpen,
  onClose,
  onSuccess,
  mode,
  initialBanner,
  restaurantId,
  homepageData,
}: BannerModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [heading, setHeading] = useState('');
  const [subheading, setSubheading] = useState('');
  const [destinationType, setDestinationType] = useState<BannerDestinationType>('none');
  const [destinationTarget, setDestinationTarget] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [active, setActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(homepageData?.menuItems || []);
  const [combos, setCombos] = useState<any[]>(homepageData?.combos || []);
  const [specials, setSpecials] = useState<any[]>(homepageData?.specials || []);
  const [offers, setOffers] = useState<any[]>(homepageData?.offers || []);
  const [services, setServices] = useState<any[]>(homepageData?.services || []);
  const [categories, setCategories] = useState<any[]>(homepageData?.categories || []);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form state when opening or when initialBanner changes
  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'edit' && initialBanner) {
      setHeading(initialBanner.heading || '');
      setSubheading(initialBanner.subheading || '');
      setPreviewUrl(initialBanner.image_url || '');
      setDestinationType((initialBanner.redirect_type as BannerDestinationType) || 'none');
      setDestinationTarget(initialBanner.redirect_target || '');
      setCtaText(initialBanner.cta_text || '');
      setActive(initialBanner.active !== false);
    } else {
      setHeading('');
      setSubheading('');
      setPreviewUrl('');
      setSelectedFile(null);
      setDestinationType('none');
      setDestinationTarget('');
      setCtaText('');
      setActive(true);
    }
  }, [isOpen, mode, initialBanner]);

  // Load menu items and all destinations if not already available in homepageData
  useEffect(() => {
    if (!isOpen || !restaurantId) return;

    let isMounted = true;
    const fetchDestinations = async () => {
      try {
        if (!homepageData?.menuItems || homepageData.menuItems.length === 0) {
          setLoadingItems(true);
          MenuService.fetchMenuItems(restaurantId).then(items => {
            if (isMounted && items) setMenuItems(items);
          }).finally(() => {
            if (isMounted) setLoadingItems(false);
          });
        } else {
          setMenuItems(homepageData.menuItems);
        }

        if (!homepageData?.combos || homepageData.combos.length === 0) {
          HomepageBuilderService.getCombos(restaurantId, false).then(data => {
            if (isMounted && data) setCombos(data);
          });
        } else {
          setCombos(homepageData.combos);
        }

        if (!homepageData?.specials || homepageData.specials.length === 0) {
          HomepageBuilderService.getSpecials(restaurantId, false).then(data => {
            if (isMounted && data) setSpecials(data);
          });
        } else {
          setSpecials(homepageData.specials);
        }

        if (!homepageData?.offers || homepageData.offers.length === 0) {
          HomepageBuilderService.getOffers(restaurantId).then(data => {
            if (isMounted && data) setOffers(data);
          });
        } else {
          setOffers(homepageData.offers);
        }

        if (!homepageData?.services || homepageData.services.length === 0) {
          HomepageBuilderService.getServices(restaurantId).then(data => {
            if (isMounted && data) setServices(data);
          });
        } else {
          setServices(homepageData.services);
        }

        if (!homepageData?.categories || homepageData.categories.length === 0) {
          MenuService.fetchCategories(restaurantId).then(data => {
            if (isMounted && data) setCategories(data);
          });
        } else {
          setCategories(homepageData.categories);
        }
      } catch (e) {
        console.error('Failed to load destinations for banner picker:', e);
      }
    };

    fetchDestinations();
    return () => {
      isMounted = false;
    };
  }, [isOpen, restaurantId, homepageData]);

  // Clean up object URL when component unmounts or file changes
  useEffect(() => {
    if (!selectedFile) return;
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  // Handle destination type change
  const handleDestinationTypeChange = (newType: BannerDestinationType) => {
    setDestinationType(newType);

    // Auto-select initial target based on new type
    if (newType === 'none') {
      setDestinationTarget('');
      setCtaText('');
    } else if (newType === 'menu_item') {
      const first = menuItems[0]?.id ? String(menuItems[0].id) : '';
      setDestinationTarget(first);
      if (!ctaText) setCtaText('Order Now');
    } else if (newType === 'combo') {
      const first = combos[0]?.id ? String(combos[0].id) : 'all';
      setDestinationTarget(first);
      if (!ctaText) setCtaText('View Combo');
    } else if (newType === 'category') {
      const first = categories[0]?.id != null ? String(categories[0].id) : (categories[0]?.name || '');
      setDestinationTarget(first);
      if (!ctaText) setCtaText('Explore Menu');
    } else if (newType === 'special') {
      const first = specials[0]?.id ? String(specials[0].id) : 'all';
      setDestinationTarget(first);
      if (!ctaText) setCtaText('View Special');
    } else if (newType === 'offer') {
      const first = offers[0]?.id ? String(offers[0].id) : 'all';
      setDestinationTarget(first);
      if (!ctaText) setCtaText('Claim Offer');
    } else if (newType === 'service') {
      const first = services[0]?.id ? String(services[0].id) : 'all';
      setDestinationTarget(first);
      if (!ctaText) setCtaText('Request Service');
    } else if (newType === 'custom_page') {
      setDestinationTarget('menu');
      if (!ctaText) setCtaText('Explore Menu');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'create' && !selectedFile) {
      toast.error('Please select an image file for the banner');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'create') {
        if (!selectedFile) return;
        await BannerService.createBannerFromFile(restaurantId, selectedFile, {
          heading: heading.trim() || null,
          subheading: subheading.trim() || null,
          redirect_type: destinationType,
          redirect_target: destinationType === 'none' ? null : destinationTarget.trim() || null,
          cta_text: ctaText.trim() || null,
          active,
        });
        toast.success('Homepage banner created successfully!');
      } else if (mode === 'edit' && initialBanner) {
        // If a new image was chosen, replace image first
        if (selectedFile) {
          await BannerService.replaceBannerImage(
            initialBanner.id,
            restaurantId,
            selectedFile,
            initialBanner.image_url
          );
        }

        // Update banner metadata
        await BannerService.updateBanner(initialBanner.id, {
          heading: heading.trim() || null,
          subheading: subheading.trim() || null,
          redirect_type: destinationType,
          redirect_target: destinationType === 'none' ? null : destinationTarget.trim() || null,
          cta_text: ctaText.trim() || null,
          active,
        });
        toast.success('Banner updated successfully!');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to save banner:', err);
      toast.error(err?.message || 'Failed to save banner. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const filteredMenuItems = useMemo(() => {
    if (!itemSearchQuery.trim()) return menuItems;
    const q = itemSearchQuery.toLowerCase();
    return menuItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
    );
  }, [menuItems, itemSearchQuery]);

  const suggestedCtas = useMemo(() => getSuggestedCtas(destinationType), [destinationType]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900 font-display">
              {mode === 'create' ? 'Add Homepage Banner' : 'Edit Banner & Destination'}
            </h3>
            <p className="text-xs text-slate-500">
              Configure banner visuals, customer destination redirect, and CTA
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Image Upload / Preview Area */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Banner Image <span className="text-red-500">*</span>
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`relative aspect-[21/9] rounded-2xl overflow-hidden border-2 border-dashed transition-all cursor-pointer group flex flex-col items-center justify-center ${
                previewUrl
                  ? 'border-orange-300 bg-slate-900'
                  : 'border-slate-300 bg-slate-50 hover:bg-orange-50/40 hover:border-orange-400'
              }`}
            >
              {previewUrl ? (
                <>
                  <Image
                    src={previewUrl}
                    alt="Banner preview"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  {/* Subtle Culinary Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent flex flex-col justify-end p-4 pointer-events-none">
                    {heading && (
                      <h4 className="text-white font-bold text-base line-clamp-1 drop-shadow-md">
                        {heading}
                      </h4>
                    )}
                    {subheading && (
                      <p className="text-slate-200 text-xs line-clamp-1 drop-shadow-sm">
                        {subheading}
                      </p>
                    )}
                    {ctaText && (
                      <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-orange-600 text-white text-[11px] font-bold shadow-md w-fit">
                        <span>{ctaText}</span>
                        <ArrowRight className="size-3" />
                      </div>
                    )}
                  </div>

                  {/* Change overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-bold backdrop-blur-xs">
                    <Upload className="size-4" />
                    <span>Click to Change Image</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <div className="size-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="size-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      Click to upload banner image
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      JPG, PNG, or WebP · 16:9 or 21:9 recommended
                    </p>
                  </div>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Heading & Subheading */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Heading <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={heading}
                onChange={(e) => setHeading(e.target.value)}
                placeholder="e.g. Royal Chef Biryani"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-slate-900 transition-all placeholder:text-slate-400 font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Subheading <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={subheading}
                onChange={(e) => setSubheading(e.target.value)}
                placeholder="e.g. Authentic dum cooked perfection"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-slate-900 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Destination Section */}
          <div className="p-4 sm:p-5 rounded-2xl bg-orange-50/50 border border-orange-200/80 space-y-4">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-orange-600 text-white flex items-center justify-center shrink-0">
                <Link2 className="size-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Banner Click Destination</h4>
                <p className="text-xs text-slate-600">
                  Select where customers land when tapping this banner. No manual URLs required.
                </p>
              </div>
            </div>

            {/* Destination Type Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Destination Type
              </label>
              <div className="relative">
                <select
                  value={destinationType}
                  onChange={(e) =>
                    handleDestinationTypeChange(e.target.value as BannerDestinationType)
                  }
                  className="w-full appearance-none px-3.5 py-2.5 pr-10 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all cursor-pointer"
                >
                  {BANNER_DESTINATION_TYPES.map((opt) => (
                    <option key={opt.type} value={opt.type}>
                      {opt.label} — {opt.description}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Dynamic Destination Target Selector */}
            {destinationType !== 'none' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select {BANNER_DESTINATION_TYPES.find((t) => t.type === destinationType)?.label} Destination
                </label>

                {/* 1. Menu Item */}
                {destinationType === 'menu_item' && (
                  <div className="space-y-2">
                    {loadingItems ? (
                      <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                        <Loader2 className="size-3.5 animate-spin text-orange-600" />
                        <span>Loading dishes from menu...</span>
                      </div>
                    ) : menuItems.length === 0 ? (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                        <Info className="size-4 shrink-0" />
                        <span>No dishes found in your menu yet. Add items in Admin &gt; Menu.</span>
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          value={itemSearchQuery}
                          onChange={(e) => setItemSearchQuery(e.target.value)}
                          placeholder="Search dish by name..."
                          className="w-full px-3 py-1.5 rounded-lg text-xs bg-white border border-slate-200 outline-none focus:border-orange-500"
                        />
                        <div className="relative">
                          <select
                            value={destinationTarget}
                            onChange={(e) => setDestinationTarget(e.target.value)}
                            className="w-full appearance-none px-3.5 py-2.5 pr-10 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all cursor-pointer max-h-48"
                          >
                            <option value="" disabled>
                              -- Select a Menu Item --
                            </option>
                            {filteredMenuItems.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} — {formatCurrency(item.price)}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* 2. Combo */}
                {destinationType === 'combo' && (
                  <div className="relative">
                    <select
                      value={destinationTarget}
                      onChange={(e) => setDestinationTarget(e.target.value)}
                      className="w-full appearance-none px-3.5 py-2.5 pr-10 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all cursor-pointer"
                    >
                      <option value="" disabled>-- Select a Combo Meal --</option>
                      {combos.map((combo: any) => (
                        <option key={combo.id} value={combo.id}>
                          {combo.title || combo.name} {combo.price ? `— ${formatCurrency(combo.price)}` : ''}
                        </option>
                      ))}
                      <option value="all">View All Combo Meals (Combos Page)</option>
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  </div>
                )}

                {/* 3. Category */}
                {destinationType === 'category' && (
                  <div className="relative">
                    <select
                      value={destinationTarget}
                      onChange={(e) => setDestinationTarget(e.target.value)}
                      className="w-full appearance-none px-3.5 py-2.5 pr-10 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all cursor-pointer"
                    >
                      <option value="" disabled>
                        -- Select Category --
                      </option>
                      {categories.map((cat: any) => (
                        <option key={cat.id} value={cat.id || cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  </div>
                )}

                {/* 4. Special */}
                {destinationType === 'special' && (
                  <div className="relative">
                    <select
                      value={destinationTarget}
                      onChange={(e) => setDestinationTarget(e.target.value)}
                      className="w-full appearance-none px-3.5 py-2.5 pr-10 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all cursor-pointer"
                    >
                      <option value="" disabled>-- Select a Chef Special --</option>
                      {specials.map((sp: any) => (
                        <option key={sp.id} value={sp.id}>
                          {sp.title || sp.name} {sp.price ? `— ${formatCurrency(sp.price)}` : ''}
                        </option>
                      ))}
                      <option value="all">View All Today's Specials</option>
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  </div>
                )}

                {/* 5. Offer */}
                {destinationType === 'offer' && (
                  <div className="relative">
                    <select
                      value={destinationTarget}
                      onChange={(e) => setDestinationTarget(e.target.value)}
                      className="w-full appearance-none px-3.5 py-2.5 pr-10 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all cursor-pointer"
                    >
                      <option value="" disabled>-- Select an Offer or Coupon --</option>
                      {offers.map((offer: any) => (
                        <option key={offer.id} value={offer.id}>
                          {offer.title || offer.name} {offer.discount_value ? `(${offer.discount_type === 'flat' ? `₹${offer.discount_value}` : `${offer.discount_value}%`} OFF)` : ''}
                        </option>
                      ))}
                      <option value="all">View All Offers &amp; Coupons</option>
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  </div>
                )}

                {/* 6. Service */}
                {destinationType === 'service' && (
                  <div className="relative">
                    <select
                      value={destinationTarget}
                      onChange={(e) => setDestinationTarget(e.target.value)}
                      className="w-full appearance-none px-3.5 py-2.5 pr-10 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all cursor-pointer"
                    >
                      <option value="" disabled>-- Select a Service Request --</option>
                      {services.map((svc: any) => (
                        <option key={svc.id} value={svc.id}>
                          {svc.label || svc.name || svc.title}
                        </option>
                      ))}
                      <option value="all">View All Guest Services</option>
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  </div>
                )}

                {/* 7. Custom Page */}
                {destinationType === 'custom_page' && (
                  <div className="relative">
                    <select
                      value={destinationTarget}
                      onChange={(e) => setDestinationTarget(e.target.value)}
                      className="w-full appearance-none px-3.5 py-2.5 pr-10 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all cursor-pointer"
                    >
                      {CUSTOM_PAGE_OPTIONS.map((page) => (
                        <option key={page.key} value={page.key}>
                          {page.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  </div>
                )}
              </div>
            )}

            {/* Optional CTA Input & Presets */}
            {destinationType !== 'none' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Call-to-Action (CTA) Button <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={ctaText}
                      onChange={(e) => setCtaText(e.target.value)}
                      placeholder="e.g. Order Now, Explore Menu..."
                      className="flex-1 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                    />
                    {ctaText && (
                      <button
                        type="button"
                        onClick={() => setCtaText('')}
                        className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Preset Quick-Pills */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 font-medium mr-1">Suggestions:</span>
                    {suggestedCtas.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCtaText(preset)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                          ctaText === preset
                            ? 'bg-orange-600 border-orange-600 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-orange-300 hover:text-orange-600'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Active status */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
            <div>
              <p className="text-xs font-bold text-slate-800">Banner Visibility</p>
              <p className="text-[11px] text-slate-500">Show this banner on customer homepage</p>
            </div>
            <button
              type="button"
              onClick={() => setActive(!active)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                active ? 'bg-orange-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`size-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${
                  active ? 'left-5.5' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || (!previewUrl && mode === 'create')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md shadow-orange-600/20 active:scale-95 disabled:opacity-50 transition-all"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Saving Banner...</span>
              </>
            ) : (
              <>
                <Check className="size-4" />
                <span>{mode === 'create' ? 'Add Banner' : 'Save Changes'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
