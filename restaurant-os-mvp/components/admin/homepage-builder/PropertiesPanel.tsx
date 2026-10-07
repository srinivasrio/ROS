'use client';

import React, { useState } from 'react';
import {
  Type, Plus, Trash2, Tag, Layers, ChefHat,
  ShoppingBag, Sparkles, Image as ImageIcon, MapPin, Phone,
  Clock, Info, Check, Eye, Link2, ChevronDown
} from 'lucide-react';
import { BuilderSection } from './useBuilderState';
import { getServiceImageUrl, isVideoUrl } from '@/components/shared/homepage/ServiceCard';
import {
  BANNER_DESTINATION_TYPES,
  CUSTOM_PAGE_OPTIONS,
  getSuggestedCtas,
  BannerDestinationType,
} from '@/lib/banner-navigation';
import { formatCurrency } from '@/lib/utils';

interface PropertiesPanelProps {
  selectedSection: BuilderSection | any | null;
  state: any;
  dispatch: React.Dispatch<any>;
}

export default function PropertiesPanel({
  selectedSection,
  state,
  dispatch,
}: PropertiesPanelProps) {
  if (!selectedSection) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-white border-l border-slate-200">
        <div className="size-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mb-3">
          <Layers className="size-6" />
        </div>
        <h3 className="font-bold text-sm text-slate-900 font-display">No Section Selected</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
          Select any section from the left sidebar or click directly on the live preview to edit its content.
        </p>
      </div>
    );
  }

  const sectionType = selectedSection.section_type || selectedSection.type;

  // Title / Subtitle updates
  const handleTitleChange = (title: string) => {
    dispatch({
      type: 'UPDATE_SECTION',
      sectionId: selectedSection.id,
      updates: { section_title: title, title },
    });
    dispatch({ type: 'SET_DIRTY', isDirty: true });
  };

  const handleSubtitleChange = (subtitle: string) => {
    dispatch({
      type: 'UPDATE_SECTION',
      sectionId: selectedSection.id,
      updates: { section_subtitle: subtitle, subtitle },
    });
    dispatch({ type: 'SET_DIRTY', isDirty: true });
  };

  return (
    <div className="h-full flex flex-col bg-white border-l border-slate-200 overflow-hidden">
      {/* Panel Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">
              Content Configuration
            </span>
            <h2 className="text-base font-bold text-slate-900 capitalize font-display">
              {sectionType.replace('_', ' ')}
            </h2>
          </div>
          <div className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
            {selectedSection.active !== false ? 'Active' : 'Hidden'}
          </div>
        </div>
      </div>

      {/* Panel Content Form */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6 no-scrollbar">
        {/* Section Heading & Subheading (Common to most sections) */}
        {sectionType !== 'header' && sectionType !== 'footer' && (
          <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Type className="size-3.5 text-orange-600" />
              <span>Section Header</span>
            </h4>
            <div className="space-y-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={selectedSection.section_title || selectedSection.title || ''}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Section title..."
                  className="w-full px-3 py-2 rounded-xl text-xs bg-white border border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-slate-900 font-medium transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Subtitle
                </label>
                <input
                  type="text"
                  value={selectedSection.section_subtitle || selectedSection.subtitle || ''}
                  onChange={(e) => handleSubtitleChange(e.target.value)}
                  placeholder="Short description..."
                  className="w-full px-3 py-2 rounded-xl text-xs bg-white border border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-slate-900 font-medium transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* Section-Specific Content Editors */}
        {sectionType === 'header' && (
          <HeaderContentEditor
            profile={state.profile}
            dispatch={dispatch}
          />
        )}

        {sectionType === 'hero_banners' && (
          <BannersContentEditor
            banners={state.data?.banners || []}
            dispatch={dispatch}
            data={state.data}
          />
        )}

        {sectionType === 'specials' && (
          <SpecialsContentEditor
            specials={state.data?.specials || []}
            dispatch={dispatch}
          />
        )}

        {sectionType === 'combos' && (
          <CombosContentEditor
            combos={state.data?.combos || []}
            dispatch={dispatch}
          />
        )}

        {sectionType === 'offers' && (
          <OffersContentEditor
            offers={state.data?.offers || []}
            dispatch={dispatch}
          />
        )}

        {sectionType === 'services' && (
          <ServicesContentEditor
            services={state.data?.services || []}
            dispatch={dispatch}
          />
        )}

        {sectionType === 'categories' && (
          <CategoriesContentEditor
            categories={state.data?.categories || []}
            dispatch={dispatch}
          />
        )}

        {sectionType === 'popular' && (
          <PopularContentEditor
            popularItems={state.data?.popularItems || []}
            dispatch={dispatch}
          />
        )}

        {sectionType === 'footer' && (
          <FooterContentEditor
            profile={state.profile}
            dispatch={dispatch}
          />
        )}
      </div>

      {/* Bottom Safety Reminder */}
      <div className="p-3 border-t border-slate-200/80 bg-slate-50 flex items-center gap-2 text-[11px] text-slate-500">
        <Info className="size-3.5 text-orange-500 shrink-0" />
        <span>Design tokens ensure uniform layout across all devices</span>
      </div>
    </div>
  );
}

// ─── Header Content Editor ───
function HeaderContentEditor({ profile, dispatch }: { profile: any; dispatch: any }) {
  const updateProfile = (field: string, value: string) => {
    dispatch({
      type: 'UPDATE_PROFILE',
      profile: { ...profile, [field]: value },
    });
    dispatch({ type: 'SET_DIRTY', isDirty: true });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1">Restaurant Name</label>
        <input
          type="text"
          value={profile?.name || ''}
          onChange={(e) => updateProfile('name', e.target.value)}
          className="w-full px-3 py-2 rounded-xl text-xs bg-white border border-slate-200 focus:border-orange-500 outline-none text-slate-900"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1">Tagline / Slogan</label>
        <input
          type="text"
          value={profile?.tagline || ''}
          onChange={(e) => updateProfile('tagline', e.target.value)}
          placeholder="e.g. Authentic Artisan Kitchen"
          className="w-full px-3 py-2 rounded-xl text-xs bg-white border border-slate-200 focus:border-orange-500 outline-none text-slate-900"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1">Logo Image URL</label>
        <input
          type="text"
          value={profile?.logo_url || profile?.logo || ''}
          onChange={(e) => updateProfile('logo_url', e.target.value)}
          placeholder="https://..."
          className="w-full px-3 py-2 rounded-xl text-xs bg-white border border-slate-200 focus:border-orange-500 outline-none text-slate-900"
        />
      </div>
    </div>
  );
}

// ─── Banners Content Editor ───
function BannersContentEditor({
  banners,
  dispatch,
  data,
}: {
  banners: any[];
  dispatch: any;
  data?: any;
}) {
  const handleAddBanner = () => {
    const newBanner = {
      id: `banner-${Date.now()}`,
      heading: 'Special Offer',
      subheading: 'Limited time chef selection',
      image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=1200&auto=format&fit=crop&q=80',
      redirect_type: 'none',
      redirect_target: null,
      cta_text: 'Order Now',
      active: true,
      order_index: banners.length,
    };
    dispatch({
      type: 'UPDATE_SECTION_DATA',
      section: 'banners',
      payload: [...banners, newBanner],
    });
    dispatch({ type: 'SET_DIRTY', isDirty: true });
  };

  const handleUpdateBanner = (id: string, updates: any) => {
    const updated = banners.map((b) => (b.id === id ? { ...b, ...updates } : b));
    dispatch({
      type: 'UPDATE_SECTION_DATA',
      section: 'banners',
      payload: updated,
    });
    dispatch({ type: 'SET_DIRTY', isDirty: true });
  };

  const handleDeleteBanner = (id: string) => {
    const filtered = banners.filter((b) => b.id !== id);
    dispatch({
      type: 'UPDATE_SECTION_DATA',
      section: 'banners',
      payload: filtered,
    });
    dispatch({ type: 'SET_DIRTY', isDirty: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-900 uppercase">Banner Slides ({banners.length})</h4>
        <button
          onClick={handleAddBanner}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white font-bold text-xs transition-colors"
        >
          <Plus className="size-3.5" />
          <span>Add Slide</span>
        </button>
      </div>

      <div className="space-y-3">
        {banners.map((banner, idx) => {
          const destType = (banner.redirect_type as BannerDestinationType) || 'none';
          const suggestedCtas = getSuggestedCtas(destType);

          return (
            <div key={banner.id || idx} className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-slate-700">Slide {idx + 1}</span>
                  {banner.active === false && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500 font-semibold">
                      Hidden
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteBanner(banner.id)}
                  className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors"
                  title="Delete Slide"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Heading
                </label>
                <input
                  type="text"
                  value={banner.heading || ''}
                  onChange={(e) => handleUpdateBanner(banner.id, { heading: e.target.value })}
                  placeholder="Banner heading..."
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:border-orange-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Subheading
                </label>
                <input
                  type="text"
                  value={banner.subheading || ''}
                  onChange={(e) => handleUpdateBanner(banner.id, { subheading: e.target.value })}
                  placeholder="Banner subheading..."
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:border-orange-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Image URL
                </label>
                <input
                  type="text"
                  value={banner.image_url || ''}
                  onChange={(e) => handleUpdateBanner(banner.id, { image_url: e.target.value })}
                  placeholder="Image URL..."
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 border border-slate-200 text-slate-900 text-[11px] focus:border-orange-500 outline-none"
                />
              </div>

              {/* Destination Type */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <Link2 className="size-3 text-orange-600" />
                  <span>Destination Type</span>
                </label>
                <div className="relative">
                  <select
                    value={destType}
                    onChange={(e) => {
                      const newType = e.target.value as BannerDestinationType;
                      let newTarget = '';
                      let newCta = banner.cta_text;

                      if (newType === 'none') {
                        newTarget = '';
                        newCta = '';
                      } else if (newType === 'menu_item') {
                        newTarget = data?.menuItems?.[0]?.id || '';
                        if (!newCta) newCta = 'Order Now';
                      } else if (newType === 'combo') {
                        newTarget = data?.combos?.[0]?.id || 'all';
                        if (!newCta) newCta = 'View Combo';
                      } else if (newType === 'category') {
                        newTarget = data?.categories?.[0]?.id || '';
                        if (!newCta) newCta = 'Explore Menu';
                      } else if (newType === 'special') {
                        newTarget = data?.specials?.[0]?.id || 'all';
                        if (!newCta) newCta = 'View Special';
                      } else if (newType === 'offer') {
                        newTarget = 'all';
                        if (!newCta) newCta = 'Claim Offer';
                      } else if (newType === 'service') {
                        newTarget = 'all';
                        if (!newCta) newCta = 'Request Service';
                      } else if (newType === 'custom_page') {
                        newTarget = 'menu';
                        if (!newCta) newCta = 'Explore Menu';
                      }

                      handleUpdateBanner(banner.id, {
                        redirect_type: newType,
                        redirect_target: newTarget,
                        cta_text: newCta,
                      });
                    }}
                    className="w-full appearance-none px-2.5 py-1.5 pr-8 rounded-lg text-xs bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:border-orange-500 outline-none cursor-pointer"
                  >
                    {BANNER_DESTINATION_TYPES.map((opt) => (
                      <option key={opt.type} value={opt.type}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                </div>

                {/* Dynamic Destination Target */}
                {destType !== 'none' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600">
                      Destination Target
                    </label>
                    <div className="relative">
                      {destType === 'menu_item' && (
                        <select
                          value={banner.redirect_target || ''}
                          onChange={(e) => handleUpdateBanner(banner.id, { redirect_target: e.target.value })}
                          className="w-full appearance-none px-2.5 py-1.5 pr-8 rounded-lg text-xs bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:border-orange-500 outline-none cursor-pointer"
                        >
                          <option value="" disabled>-- Select Dish --</option>
                          {(data?.menuItems || []).map((item: any) => (
                            <option key={item.id} value={item.id}>
                              {item.name} — {formatCurrency(item.price)}
                            </option>
                          ))}
                        </select>
                      )}

                      {destType === 'combo' && (
                        <select
                          value={banner.redirect_target || 'all'}
                          onChange={(e) => handleUpdateBanner(banner.id, { redirect_target: e.target.value })}
                          className="w-full appearance-none px-2.5 py-1.5 pr-8 rounded-lg text-xs bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:border-orange-500 outline-none cursor-pointer"
                        >
                          <option value="all">All Combos (Combos Page)</option>
                          {(data?.combos || []).map((c: any) => (
                            <option key={c.id} value={c.id}>
                              {c.name || c.title}
                            </option>
                          ))}
                        </select>
                      )}

                      {destType === 'category' && (
                        <select
                          value={banner.redirect_target || ''}
                          onChange={(e) => handleUpdateBanner(banner.id, { redirect_target: e.target.value })}
                          className="w-full appearance-none px-2.5 py-1.5 pr-8 rounded-lg text-xs bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:border-orange-500 outline-none cursor-pointer"
                        >
                          <option value="" disabled>-- Select Category --</option>
                          {(data?.categories || []).map((c: any) => (
                            <option key={c.id} value={c.id || c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}

                      {destType === 'special' && (
                        <select
                          value={banner.redirect_target || 'all'}
                          onChange={(e) => handleUpdateBanner(banner.id, { redirect_target: e.target.value })}
                          className="w-full appearance-none px-2.5 py-1.5 pr-8 rounded-lg text-xs bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:border-orange-500 outline-none cursor-pointer"
                        >
                          <option value="all">All Specials</option>
                          {(data?.specials || []).map((sp: any) => (
                            <option key={sp.id} value={sp.id}>
                              {sp.name || sp.title}
                            </option>
                          ))}
                        </select>
                      )}

                      {destType === 'offer' && (
                        <select
                          value={banner.redirect_target || 'all'}
                          onChange={(e) => handleUpdateBanner(banner.id, { redirect_target: e.target.value })}
                          className="w-full appearance-none px-2.5 py-1.5 pr-8 rounded-lg text-xs bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:border-orange-500 outline-none cursor-pointer"
                        >
                          <option value="all">All Offers &amp; Coupons</option>
                          {(data?.offers || []).map((o: any) => (
                            <option key={o.id} value={o.id}>
                              {o.title || o.name}
                            </option>
                          ))}
                        </select>
                      )}

                      {destType === 'service' && (
                        <select
                          value={banner.redirect_target || 'all'}
                          onChange={(e) => handleUpdateBanner(banner.id, { redirect_target: e.target.value })}
                          className="w-full appearance-none px-2.5 py-1.5 pr-8 rounded-lg text-xs bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:border-orange-500 outline-none cursor-pointer"
                        >
                          <option value="all">All Guest Services</option>
                          {(data?.services || []).map((s: any) => (
                            <option key={s.id} value={s.id}>
                              {s.name || s.title}
                            </option>
                          ))}
                        </select>
                      )}

                      {destType === 'custom_page' && (
                        <select
                          value={banner.redirect_target || 'menu'}
                          onChange={(e) => handleUpdateBanner(banner.id, { redirect_target: e.target.value })}
                          className="w-full appearance-none px-2.5 py-1.5 pr-8 rounded-lg text-xs bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:border-orange-500 outline-none cursor-pointer"
                        >
                          {CUSTOM_PAGE_OPTIONS.map((p) => (
                            <option key={p.key} value={p.key}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      )}
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                )}

                {/* Optional CTA text & presets */}
                {destType !== 'none' && (
                  <div className="space-y-1 pt-1">
                    <label className="text-[10px] font-bold text-slate-600">
                      CTA Button Text
                    </label>
                    <input
                      type="text"
                      value={banner.cta_text || ''}
                      onChange={(e) => handleUpdateBanner(banner.id, { cta_text: e.target.value })}
                      placeholder="e.g. Order Now, Explore Menu..."
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:border-orange-500 outline-none"
                    />
                    <div className="flex flex-wrap gap-1 pt-1">
                      {suggestedCtas.map((cta) => (
                        <button
                          key={cta}
                          type="button"
                          onClick={() => handleUpdateBanner(banner.id, { cta_text: cta })}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                            banner.cta_text === cta
                              ? 'bg-orange-600 text-white border-orange-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
                          }`}
                        >
                          {cta}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Specials Content Editor ───
function SpecialsContentEditor({ specials, dispatch }: { specials: any[]; dispatch: any }) {
  const handleAddSpecial = () => {
    const newSpecial = {
      id: `special-${Date.now()}`,
      title: 'Chef Daily Special',
      description: 'Hand-crafted with exquisite seasonal ingredients',
      price: 299,
      badge: "Today's Special",
      image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
      active: true,
    };
    dispatch({
      type: 'UPDATE_SECTION_DATA',
      section: 'specials',
      payload: [...specials, newSpecial],
    });
    dispatch({ type: 'SET_DIRTY', isDirty: true });
  };

  const handleUpdate = (id: string, updates: any) => {
    const updated = specials.map((s) => (s.id === id ? { ...s, ...updates } : s));
    dispatch({ type: 'UPDATE_SECTION_DATA', section: 'specials', payload: updated });
    dispatch({ type: 'SET_DIRTY', isDirty: true });
  };

  const handleDelete = (id: string) => {
    const filtered = specials.filter((s) => s.id !== id);
    dispatch({ type: 'UPDATE_SECTION_DATA', section: 'specials', payload: filtered });
    dispatch({ type: 'SET_DIRTY', isDirty: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-900 uppercase">Specials ({specials.length})</h4>
        <button
          onClick={handleAddSpecial}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white font-bold text-xs transition-colors"
        >
          <Plus className="size-3.5" />
          <span>Add Special</span>
        </button>
      </div>

      <div className="space-y-3">
        {specials.map((item, idx) => (
          <div key={item.id || idx} className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-700">{item.title || `Special ${idx + 1}`}</span>
              <button onClick={() => handleDelete(item.id)} className="text-slate-400 hover:text-red-500">
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <input
              type="text"
              value={item.title || item.name || ''}
              onChange={(e) => handleUpdate(item.id, { title: e.target.value })}
              placeholder="Special title..."
              className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 border border-slate-200 font-semibold text-slate-900"
            />
            <input
              type="text"
              value={item.description || ''}
              onChange={(e) => handleUpdate(item.id, { description: e.target.value })}
              placeholder="Description..."
              className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 border border-slate-200 text-slate-900"
            />
            <div className="flex gap-2">
              <input
                type="number"
                value={item.price === 0 || item.price === undefined || item.price === null ? '' : item.price}
                onChange={(e) => handleUpdate(item.id, { price: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) })}
                placeholder="Price (₹)"
                className="w-1/2 px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 border border-slate-200 font-mono text-slate-900"
              />
              <input
                type="text"
                value={item.badge || ''}
                onChange={(e) => handleUpdate(item.id, { badge: e.target.value })}
                placeholder="Badge (e.g. Chef Choice)"
                className="w-1/2 px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 border border-slate-200 text-slate-900"
              />
            </div>
            <input
              type="text"
              value={item.image_url || ''}
              onChange={(e) => handleUpdate(item.id, { image_url: e.target.value })}
              placeholder="Image URL..."
              className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 border border-slate-200 text-slate-900 text-[11px]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Combos Content Editor ───
function CombosContentEditor({ combos, dispatch }: { combos: any[]; dispatch: any }) {
  const handleAddCombo = () => {
    const newCombo = {
      id: `combo-${Date.now()}`,
      title: 'Family Feast Combo',
      description: 'Includes 2 mains, 2 appetizers, and beverages',
      price: 699,
      original_price: 899,
      items: ['Main Curry', 'Garlic Naan', 'Beverage'],
      image_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&auto=format&fit=crop&q=80',
      active: true,
    };
    dispatch({
      type: 'UPDATE_SECTION_DATA',
      section: 'combos',
      payload: [...combos, newCombo],
    });
    dispatch({ type: 'SET_DIRTY', isDirty: true });
  };

  const handleUpdate = (id: string, updates: any) => {
    const updated = combos.map((c) => (c.id === id ? { ...c, ...updates } : c));
    dispatch({ type: 'UPDATE_SECTION_DATA', section: 'combos', payload: updated });
    dispatch({ type: 'SET_DIRTY', isDirty: true });
  };

  const handleDelete = (id: string) => {
    const filtered = combos.filter((c) => c.id !== id);
    dispatch({ type: 'UPDATE_SECTION_DATA', section: 'combos', payload: filtered });
    dispatch({ type: 'SET_DIRTY', isDirty: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-900 uppercase">Combo Deals ({combos.length})</h4>
        <button
          onClick={handleAddCombo}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white font-bold text-xs transition-colors"
        >
          <Plus className="size-3.5" />
          <span>Add Combo</span>
        </button>
      </div>

      <div className="space-y-3">
        {combos.map((combo, idx) => (
          <div key={combo.id || idx} className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-700">{combo.title || `Combo ${idx + 1}`}</span>
              <button onClick={() => handleDelete(combo.id)} className="text-slate-400 hover:text-red-500">
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <input
              type="text"
              value={combo.title || combo.name || ''}
              onChange={(e) => handleUpdate(combo.id, { title: e.target.value })}
              placeholder="Combo title..."
              className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 border border-slate-200 font-semibold text-slate-900"
            />
            <input
              type="text"
              value={combo.description || ''}
              onChange={(e) => handleUpdate(combo.id, { description: e.target.value })}
              placeholder="Combo description..."
              className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 border border-slate-200 text-slate-900"
            />
            <div className="flex gap-2">
              <input
                type="number"
                value={combo.price === 0 || combo.price === undefined || combo.price === null ? '' : combo.price}
                onChange={(e) => handleUpdate(combo.id, { price: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) })}
                placeholder="Discounted Price (₹)"
                className="w-1/2 px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 border border-slate-200 font-mono text-slate-900"
              />
              <input
                type="number"
                value={combo.original_price === 0 || combo.original_price === undefined || combo.original_price === null ? '' : combo.original_price}
                onChange={(e) => handleUpdate(combo.id, { original_price: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) })}
                placeholder="Original Price (₹)"
                className="w-1/2 px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 border border-slate-200 font-mono text-slate-900"
              />
            </div>
            <input
              type="text"
              value={combo.image_url || ''}
              onChange={(e) => handleUpdate(combo.id, { image_url: e.target.value })}
              placeholder="Image URL..."
              className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 border border-slate-200 text-slate-900 text-[11px]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Offers Content Editor ───
function OffersContentEditor({ offers, dispatch }: { offers: any[]; dispatch: any }) {
  const handleAddOffer = () => {
    const newOffer = {
      id: `offer-${Date.now()}`,
      title: 'Flat 20% Off',
      description: 'On orders above ₹500. Valid for dine-in today only.',
      coupon_code: 'DINE20',
      discount_text: '20% OFF',
      discount_type: 'percentage',
      discount_value: 20,
      active: true,
    };
    dispatch({
      type: 'UPDATE_SECTION_DATA',
      section: 'offers',
      payload: [...offers, newOffer],
    });
    dispatch({ type: 'SET_DIRTY', isDirty: true });
  };

  const handleUpdate = (id: string, updates: any) => {
    const updated = offers.map((o) => (o.id === id ? { ...o, ...updates } : o));
    dispatch({ type: 'UPDATE_SECTION_DATA', section: 'offers', payload: updated });
    dispatch({ type: 'SET_DIRTY', isDirty: true });
  };

  const handleDelete = (id: string) => {
    const filtered = offers.filter((o) => o.id !== id);
    dispatch({ type: 'UPDATE_SECTION_DATA', section: 'offers', payload: filtered });
    dispatch({ type: 'SET_DIRTY', isDirty: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-900 uppercase">Coupons ({offers.length})</h4>
        <button
          onClick={handleAddOffer}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white font-bold text-xs transition-colors"
        >
          <Plus className="size-3.5" />
          <span>Add Coupon</span>
        </button>
      </div>

      <div className="space-y-3">
        {offers.map((offer, idx) => (
          <div key={offer.id || idx} className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-700">
                {offer.coupon_code || offer.code || `Offer ${idx + 1}`}
              </span>
              <button onClick={() => handleDelete(offer.id)} className="text-slate-400 hover:text-red-500">
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={offer.coupon_code || offer.code || ''}
                onChange={(e) => handleUpdate(offer.id, { coupon_code: e.target.value.toUpperCase() })}
                placeholder="PROMO CODE"
                className="w-1/2 px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900"
              />
              <input
                type="text"
                value={offer.discount_text || ''}
                onChange={(e) => handleUpdate(offer.id, { discount_text: e.target.value })}
                placeholder="e.g. 20% OFF"
                className="w-1/2 px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 border border-slate-200 font-semibold text-slate-900"
              />
            </div>
            <input
              type="text"
              value={offer.title || ''}
              onChange={(e) => handleUpdate(offer.id, { title: e.target.value })}
              placeholder="Offer title..."
              className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 border border-slate-200 text-slate-900"
            />
            <input
              type="text"
              value={offer.description || ''}
              onChange={(e) => handleUpdate(offer.id, { description: e.target.value })}
              placeholder="Terms / validity description..."
              className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 border border-slate-200 text-slate-900"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Services Content Editor ───
function ServicesContentEditor({ services, dispatch }: { services: any[]; dispatch: any }) {
  const handleToggle = (id: string, active: boolean) => {
    const updated = services.map((s) => (s.id === id ? { ...s, active } : s));
    dispatch({ type: 'UPDATE_SECTION_DATA', section: 'services', payload: updated });
    dispatch({ type: 'SET_DIRTY', isDirty: true });
  };

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-bold text-slate-900 uppercase">Available Table Services</h4>
      <div className="space-y-2">
        {services.map((srv) => {
          const imgUrl = getServiceImageUrl(srv);
          return (
            <div
              key={srv.id}
              className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-9 rounded-lg bg-orange-50 border border-orange-100 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                  {imgUrl ? (
                    isVideoUrl(imgUrl) ? (
                      <video
                        src={encodeURI(imgUrl)}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-contain pointer-events-none"
                      />
                    ) : (
                      <img
                        src={encodeURI(imgUrl)}
                        alt={srv.service_title || srv.name || 'Service'}
                        className="w-full h-full object-contain"
                      />
                    )
                  ) : (
                    <span className="text-orange-600 text-xs">🛎️</span>
                  )}
                </div>
                <span className="font-semibold text-xs text-slate-800 truncate">
                  {srv.service_title || srv.name || 'Service'}
                </span>
              </div>
              <button
                onClick={() => handleToggle(srv.id, srv.active === false)}
                className={`text-xs px-2.5 py-1 rounded-md font-bold shrink-0 ${
                  srv.active !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {srv.active !== false ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Categories Content Editor ───
function CategoriesContentEditor({ categories, dispatch }: { categories: any[]; dispatch: any }) {
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-bold text-slate-900 uppercase">Menu Categories ({categories.length})</h4>
      <p className="text-xs text-slate-500">
        Categories and dishes are populated from your Menu Management tab.
      </p>
      <div className="space-y-2">
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white">
            <span className="font-semibold text-xs text-slate-800">{cat.name}</span>
            <span className="text-[10px] text-slate-400 font-mono">ID: {cat.id}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Popular Content Editor ───
function PopularContentEditor({ popularItems }: { popularItems: any[]; dispatch: any }) {
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-bold text-slate-900 uppercase">Trending Dishes ({popularItems.length})</h4>
      <p className="text-xs text-slate-500">
        Items marked as &quot;Popular&quot; or &quot;Chef Favorite&quot; in Menu Management appear automatically.
      </p>
      <div className="space-y-2">
        {popularItems.slice(0, 6).map((item) => (
          <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white">
            <span className="font-semibold text-xs text-slate-800">{item.name}</span>
            <span className="font-bold text-xs text-orange-600 font-display">₹{item.price}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Footer Content Editor ───
function FooterContentEditor({ profile, dispatch }: { profile: any; dispatch: any }) {
  const updateProfile = (field: string, value: string) => {
    dispatch({
      type: 'UPDATE_PROFILE',
      profile: { ...profile, [field]: value },
    });
    dispatch({ type: 'SET_DIRTY', isDirty: true });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1">Physical Address</label>
        <textarea
          rows={2}
          value={profile?.address || ''}
          onChange={(e) => updateProfile('address', e.target.value)}
          placeholder="e.g. 42 Culinary Way, Downtown"
          className="w-full px-3 py-2 rounded-xl text-xs bg-white border border-slate-200 focus:border-orange-500 outline-none text-slate-900"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1">Contact Phone</label>
        <input
          type="text"
          value={profile?.phone || ''}
          onChange={(e) => updateProfile('phone', e.target.value)}
          placeholder="+91 98765 43210"
          className="w-full px-3 py-2 rounded-xl text-xs bg-white border border-slate-200 focus:border-orange-500 outline-none text-slate-900"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1">Contact Email</label>
        <input
          type="email"
          value={profile?.email || ''}
          onChange={(e) => updateProfile('email', e.target.value)}
          placeholder="contact@restaurant.com"
          className="w-full px-3 py-2 rounded-xl text-xs bg-white border border-slate-200 focus:border-orange-500 outline-none text-slate-900"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1">Operating Hours</label>
        <input
          type="text"
          value={profile?.opening_hours || ''}
          onChange={(e) => updateProfile('opening_hours', e.target.value)}
          placeholder="11:00 AM - 11:00 PM Daily"
          className="w-full px-3 py-2 rounded-xl text-xs bg-white border border-slate-200 focus:border-orange-500 outline-none text-slate-900"
        />
      </div>
    </div>
  );
}
