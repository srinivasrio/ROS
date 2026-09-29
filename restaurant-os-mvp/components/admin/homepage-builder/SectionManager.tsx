'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Layers, Eye, EyeOff, ChevronUp, ChevronDown,
  LayoutDashboard, Image as ImageIcon, Grid, Zap,
  ChefHat, ShoppingBag, Megaphone, Award, LayoutTemplate
} from 'lucide-react';
import { BuilderSection } from './useBuilderState';

const SECTION_ICONS: Record<string, React.ElementType> = {
  header: LayoutDashboard,
  hero_banners: ImageIcon,
  categories: Grid,
  services: Zap,
  specials: ChefHat,
  combos: ShoppingBag,
  offers: Megaphone,
  popular: Award,
  reorder: Layers,
  footer: LayoutTemplate,
};

const SECTION_DESCRIPTIONS: Record<string, string> = {
  header: 'Logo, restaurant name & quick actions',
  hero_banners: 'Featured marketing slides & banners',
  categories: 'Menu category circles & quick access',
  services: 'Table service call buttons',
  specials: "Chef's daily special recommendations",
  combos: 'Value meal packs & bundle deals',
  offers: 'Promo discount codes & coupons',
  popular: 'Most popular & trending dishes',
  reorder: 'Quick repeat past customer orders',
  footer: 'Address, hours & Dine in One branding',
};

interface SectionManagerProps {
  sections: BuilderSection[];
  selectedSectionId: string | null;
  dispatch: React.Dispatch<any>;
}

export default function SectionManager({
  sections,
  selectedSectionId,
  dispatch,
}: SectionManagerProps) {
  const handleToggleActive = (e: React.MouseEvent, sectionId: string) => {
    e.stopPropagation();
    dispatch({ type: 'TOGGLE_SECTION_ACTIVE', sectionId });
  };

  const sortedSections = [...sections].sort((a: any, b: any) => {
    const orderA = a.order !== undefined ? a.order : (a.display_order ?? 0);
    const orderB = b.order !== undefined ? b.order : (b.display_order ?? 0);
    return orderA - orderB;
  });

  const handleMove = (e: React.MouseEvent, index: number, direction: 'up' | 'down') => {
    e.stopPropagation();
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedSections.length) return;

    const newSections = [...sortedSections];
    const temp = newSections[index];
    newSections[index] = newSections[targetIndex];
    newSections[targetIndex] = temp;

    // Update order property
    const reordered = newSections.map((s, idx) => ({
      ...s,
      order: idx,
      display_order: idx,
    }));

    dispatch({ type: 'SET_SECTIONS', sections: reordered });
    dispatch({ type: 'SET_DIRTY', isDirty: true });
  };

  return (
    <div className="h-full flex flex-col bg-white border-r border-slate-200 select-none">
      {/* Sidebar Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-xs">
            <Layers className="size-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-slate-900 font-display">Homepage Sections</h2>
            <p className="text-[11px] text-slate-500">Reorder &amp; toggle visibility</p>
          </div>
        </div>
      </div>

      {/* Section List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
        {sortedSections.map((section: any, index: number) => {
          const sectionType = section.section_type || section.type;
          const Icon = SECTION_ICONS[sectionType] || Layers;
          const isSelected =
            selectedSectionId === section.id || selectedSectionId === sectionType;
          const isActive = section.active !== false;

          return (
            <div
              key={section.id || sectionType}
              onClick={() => dispatch({ type: 'SELECT_SECTION', sectionId: section.id || sectionType })}
              className={`group relative flex items-center gap-2.5 p-3 rounded-xl cursor-pointer transition-all duration-200 border ${
                isSelected
                  ? 'bg-orange-50/70 border-orange-300 shadow-xs ring-1 ring-orange-400'
                  : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/80'
              } ${!isActive ? 'opacity-50' : ''}`}
            >
              {/* Left Accent Bar */}
              {isSelected && (
                <div className="absolute left-0 top-2 bottom-2 w-1 bg-orange-600 rounded-r-full" />
              )}

              {/* Section Icon */}
              <div
                className={`size-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  isSelected
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                }`}
              >
                <Icon className="size-4" />
              </div>

              {/* Section Details */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-xs font-bold truncate ${
                    isSelected ? 'text-orange-950' : 'text-slate-900'
                  }`}
                >
                  {section.section_title ||
                    section.title ||
                    sectionType
                      .split('_')
                      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                      .join(' ')}
                </p>
                <p className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">
                  {SECTION_DESCRIPTIONS[sectionType] || sectionType.replace('_', ' ')}
                </p>
              </div>

              {/* Action Buttons (Reorder & Visibility) */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Reorder Up / Down */}
                <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleMove(e, index, 'up')}
                    disabled={index === 0}
                    aria-label="Move section up"
                    className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 disabled:hover:text-slate-400"
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleMove(e, index, 'down')}
                    disabled={index === sortedSections.length - 1}
                    aria-label="Move section down"
                    className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 disabled:hover:text-slate-400"
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                </div>

                {/* Visibility Toggle */}
                <button
                  onClick={(e) => handleToggleActive(e, section.id)}
                  aria-label={isActive ? 'Hide section' : 'Show section'}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isActive
                      ? 'text-emerald-600 hover:bg-emerald-50'
                      : 'text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  {isActive ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer info note */}
      <div className="p-3 border-t border-slate-200/80 bg-slate-50 text-[11px] text-slate-500 text-center">
        <span>Standardized Dine in One Design System</span>
      </div>
    </div>
  );
}
