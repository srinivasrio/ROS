'use client';

import React from 'react';
import Image from 'next/image';
import { Search, Utensils } from 'lucide-react';
import { STYLES } from '@/lib/design-tokens';

interface RestaurantHeaderProps {
  profile: any;
  tableNumber?: string;
  onSearchClick?: () => void;
  onServicesClick?: () => void;
  cartItemCount?: number;
  onCartClick?: () => void;
  mode?: 'customer' | 'admin';
}

export default function RestaurantHeader({
  profile,
  tableNumber,
  onSearchClick,
  onServicesClick,
  cartItemCount = 0,
  onCartClick,
  mode = 'customer',
}: RestaurantHeaderProps) {
  const restaurantName = profile?.name || 'Restaurant';
  const logoUrl = profile?.logo_url || profile?.logo;

  const isCustomer = mode === 'customer';

  return (
    <header 
      className="sticky top-0 z-40 w-full transition-all"
      style={isCustomer ? {
        backgroundColor: '#EEF2F6',
        borderBottom: '1px solid rgba(255, 255, 255, 0.8)',
        boxShadow: '0 2px 8px rgba(166, 180, 200, 0.15)'
      } : undefined}
    >
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-3">
        {/* Left: Restaurant Info & Table Pill */}
        <div className="flex items-center gap-3 min-w-0">
          {logoUrl ? (
            <div 
              className="relative size-10 sm:size-12 rounded-xl overflow-hidden shrink-0 p-1"
              style={isCustomer ? {
                backgroundColor: '#EEF2F6',
                boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.8)'
              } : undefined}
            >
              <Image
                src={logoUrl}
                alt={restaurantName}
                fill
                unoptimized
                className="object-contain"
                sizes="(max-width: 640px) 40px, 48px"
              />
            </div>
          ) : (
            <div 
              className="size-10 sm:size-12 rounded-xl text-orange-600 flex items-center justify-center shrink-0"
              style={isCustomer ? {
                backgroundColor: '#EEF2F6',
                boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.8)'
              } : undefined}
            >
              <Utensils className="size-6" />
            </div>
          )}

          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-black text-slate-800 truncate tracking-tight font-display">
              {restaurantName}
            </h1>
            <p className="text-xs font-semibold text-slate-500 truncate mt-0.5">
              {profile?.tagline || 'Welcome to Dine in One'}
            </p>
          </div>
        </div>

        {/* Right: Table Info & Quick Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {tableNumber && (
            <div 
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black text-emerald-800"
              style={isCustomer ? {
                backgroundColor: '#EEF2F6',
                boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.8)'
              } : undefined}
            >
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{tableNumber.toLowerCase().startsWith('table') ? tableNumber : `Table ${tableNumber}`}</span>
            </div>
          )}

          {/* Search trigger */}
          {onSearchClick && mode !== 'customer' && (
            <button
              onClick={onSearchClick}
              aria-label="Search menu"
              className="size-10 rounded-xl text-slate-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
              style={isCustomer ? {
                backgroundColor: '#EEF2F6',
                boxShadow: '3px 3px 6px rgba(166, 180, 200, 0.4), -3px -3px 6px rgba(255, 255, 255, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.85)'
              } : undefined}
            >
              <Search className="size-4 sm:size-[18px]" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
