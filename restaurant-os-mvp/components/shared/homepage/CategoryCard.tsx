'use client';

import React from 'react';
import Image from 'next/image';
import { Utensils } from 'lucide-react';
import { getCategoryMenuItemImage } from '@/lib/utils';

interface CategoryCardProps {
  category: {
    id: string | number;
    name: string;
    image_url?: string;
    description?: string;
    item_count?: number;
  };
  isSelected?: boolean;
  onClick: (category: any) => void;
}

export default function CategoryCard({
  category,
  isSelected = false,
  onClick,
}: CategoryCardProps) {
  const imageUrl = category.image_url || getCategoryMenuItemImage(category.name);

  return (
    <button
      onClick={() => onClick(category)}
      className="flex flex-col items-center gap-2 group focus:outline-none shrink-0 transition-transform active:scale-95 cursor-pointer"
      aria-label={`Category: ${category.name}`}
    >
      {/* Neumorphic Circular Avatar */}
      <div
        className="relative size-20 sm:size-24 lg:size-28 rounded-full overflow-hidden transition-all duration-300 p-1.5"
        style={{
          backgroundColor: '#EEF2F6',
          boxShadow: isSelected
            ? 'inset 2px 2px 5px rgba(249, 115, 22, 0.45), inset -2px -2px 5px rgba(255, 255, 255, 0.9)'
            : '4px 4px 8px rgba(166, 180, 200, 0.38), -4px -4px 8px rgba(255, 255, 255, 0.95)',
          border: isSelected ? '2px solid rgba(249, 115, 22, 0.6)' : '1px solid rgba(255, 255, 255, 0.85)',
        }}
      >
        <div className="relative w-full h-full rounded-full overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={category.name}
              fill
              sizes="(max-width: 640px) 80px, (max-width: 1024px) 96px, 112px"
              className="object-cover transition-transform duration-500 group-hover:scale-110 rounded-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-orange-50 text-orange-600 rounded-full">
              <Utensils className="size-8 sm:size-10" />
            </div>
          )}
        </div>
      </div>

      {/* Category Name */}
      <span
        className={`text-xs sm:text-sm text-center max-w-[96px] sm:max-w-[112px] truncate transition-all duration-200 ${
          isSelected
            ? 'text-orange-600 font-black'
            : 'text-slate-800 font-bold group-hover:text-orange-600'
        }`}
      >
        {category.name}
      </span>
    </button>
  );
}
