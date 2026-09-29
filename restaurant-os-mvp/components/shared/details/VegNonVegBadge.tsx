'use client';

import React from 'react';

export type DietaryType = 'Veg' | 'Non-Veg' | 'Egg';

interface VegNonVegBadgeProps {
  type?: DietaryType | string | null;
  isVeg?: boolean | null;
  name?: string;
  showLabel?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function resolveDietaryType(
  type?: string | null,
  isVeg?: boolean | null,
  name?: string
): DietaryType {
  const explicit = (type || (isVeg === true ? 'Veg' : isVeg === false ? 'Non-Veg' : ''))
    ?.toString()
    .toLowerCase()
    .trim();

  if (explicit) {
    if (explicit.includes('egg')) return 'Egg';
    if (explicit === 'veg' || explicit === 'vegetarian' || explicit === 'pure_veg') return 'Veg';
    if (explicit.includes('non-veg') || explicit.includes('nonveg') || explicit.includes('non_veg')) {
      return 'Non-Veg';
    }
  }

  if (name) {
    const nameLower = name.toLowerCase();
    if (/\b(chicken|mutton|fish|prawn|prawns|seafood|crab|meat|beef|pork|lamb|keema|tikka\s*masala|wings|pepperoni|bacon)\b/i.test(nameLower)) {
      return 'Non-Veg';
    }
    if (/\b(egg|eggs|omelette|omlet|bhurji|anda)\b/i.test(nameLower)) {
      return 'Egg';
    }
    if (/\b(paneer|veg|vegetarian|gobi|aloo|mushroom|dal|palak|corn|curd|soya|chaap|tofu|naan|roti|paratha|kulcha|rice|biryani|salad)\b/i.test(nameLower)) {
      return 'Veg';
    }
  }

  return 'Veg';
}

export default function VegNonVegBadge({
  type,
  isVeg,
  name,
  showLabel = true,
  size = 'md',
  className = '',
}: VegNonVegBadgeProps) {
  const dietary = resolveDietaryType(type, isVeg, name);

  // Size dimensions
  const squareSizes = {
    xs: 'size-3 rounded-[3px] border-[1.5px] p-[1.5px]',
    sm: 'size-3.5 rounded-[4px] border-[1.5px] p-[2px]',
    md: 'size-4 rounded-[4.5px] border-[1.8px] p-[2.5px]',
    lg: 'size-5 rounded-[5px] border-[2px] p-[3px]',
  };

  const dotSizes = {
    xs: 'size-1',
    sm: 'size-1.5',
    md: 'size-1.5',
    lg: 'size-2',
  };

  const pillTextSizes = {
    xs: 'text-[9px] px-1.5 py-0.5 gap-1',
    sm: 'text-[10px] px-2 py-0.5 gap-1.5',
    md: 'text-[11px] px-2.5 py-1 gap-1.5',
    lg: 'text-xs px-3 py-1.5 gap-2',
  };

  const isVegType = dietary === 'Veg';
  const isEggType = dietary === 'Egg';

  // Dietary colors
  const borderColor = isVegType ? 'border-emerald-600' : isEggType ? 'border-amber-500' : 'border-rose-600';
  const dotColor = isVegType ? 'bg-emerald-600' : isEggType ? 'bg-amber-500' : 'bg-rose-600';
  const pillStyle = isVegType
    ? 'bg-emerald-50/95 text-emerald-800 border-emerald-200/90 shadow-emerald-500/5'
    : isEggType
    ? 'bg-amber-50/95 text-amber-800 border-amber-200/90 shadow-amber-500/5'
    : 'bg-rose-50/95 text-rose-800 border-rose-200/90 shadow-rose-500/5';

  const labelText = isVegType ? 'Pure Veg' : isEggType ? 'Contains Egg' : 'Non-Veg';

  const iconElement = (
    <span
      className={`inline-flex items-center justify-center bg-white shrink-0 ${squareSizes[size]} ${borderColor} shadow-xs`}
      aria-hidden="true"
    >
      <span className={`rounded-full ${dotSizes[size]} ${dotColor}`} />
    </span>
  );

  if (!showLabel) {
    return (
      <span className={`inline-flex items-center ${className}`} title={labelText} aria-label={labelText}>
        {iconElement}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full border shadow-2xs backdrop-blur-md transition-all ${pillTextSizes[size]} ${pillStyle} ${className}`}
      aria-label={labelText}
    >
      {iconElement}
      <span className="tracking-wide font-black uppercase text-[10px]">{labelText}</span>
    </span>
  );
}
