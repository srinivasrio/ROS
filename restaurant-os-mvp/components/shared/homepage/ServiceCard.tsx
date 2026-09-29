'use client';

import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Bell } from 'lucide-react';

interface ServiceCardProps {
  service: {
    id: string | number;
    name?: string;
    service_title?: string;
    service_subtitle?: string;
    service_icon?: string;
    service_key?: string;
    service_image?: string;
    image_url?: string;
    image?: string;
    active?: boolean;
  };
  onClick: (service: any) => void;
  mode?: 'customer' | 'admin';
}

const DEFAULT_SERVICE_IMAGES: Record<string, string> = {
  call_waiter: '/services/Waiter.webm',
  waiter: '/services/Waiter.webm',
  bill_requested: '/services/Bill.png',
  bill: '/services/Bill.png',
  water_requested: '/services/Water.png',
  water: '/services/Water.png',
  cutlery_requested: '/services/Cutlery.webp',
  cutlery: '/services/Cutlery.webp',
  glass_requested: '/services/Glass.jpg',
  glass: '/services/Glass.jpg',
  straw_requested: '/services/Straw.png',
  straw: '/services/Straw.png',
  plate_requested: '/services/Plate.png',
  plate: '/services/Plate.png',
  bowl_requested: '/services/Finger bowl.jpg',
  finger_bowl: '/services/Finger bowl.jpg',
  bowl: '/services/Finger bowl.jpg',
  salt_requested: '/services/Salt.jpg',
  salt: '/services/Salt.jpg',
  pepper_requested: '/services/Pepper.jpg',
  pepper: '/services/Pepper.jpg',
  sauce_requested: '/services/Ketchup.jpg',
  ketchup: '/services/Ketchup.jpg',
  sauce: '/services/Ketchup.jpg',
  tissue_requested: '/services/Tissue.png',
  tissue: '/services/Tissue.png',
  napkin: '/services/Tissue.png',
};

const TITLE_SERVICE_IMAGES: Record<string, string> = {
  waiter: '/services/Waiter.webm',
  bill: '/services/Bill.png',
  water: '/services/Water.png',
  cutlery: '/services/Cutlery.webp',
  glass: '/services/Glass.jpg',
  straw: '/services/Straw.png',
  plate: '/services/Plate.png',
  'finger bowl': '/services/Finger bowl.jpg',
  bowl: '/services/Finger bowl.jpg',
  salt: '/services/Salt.jpg',
  pepper: '/services/Pepper.jpg',
  ketchup: '/services/Ketchup.jpg',
  sauce: '/services/Ketchup.jpg',
  tissue: '/services/Tissue.png',
  napkin: '/services/Tissue.png',
};

const SERVICE_ICON_MAP: Record<string, string> = {
  call_waiter: 'HandPlatter',
  bill_requested: 'Receipt',
  water_requested: 'GlassWater',
  cutlery_requested: 'Utensils',
  glass_requested: 'GlassWater',
  straw_requested: 'Pipette',
  plate_requested: 'Disc',
  bowl_requested: 'Soup',
  salt_requested: 'GripHorizontal',
  pepper_requested: 'Wind',
  sauce_requested: 'Droplet',
  order_ready: 'BellRing',
};

export const isVideoUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  return /\.(webm|mp4|ogg)($|\?)/i.test(url);
};

export const getServiceImageUrl = (service: any): string | null => {
  if (!service) return null;

  // 1. Direct explicit properties
  const directImage = service.service_image || service.image_url || service.image;
  if (directImage && typeof directImage === 'string' && directImage.trim()) {
    const trimmed = directImage.trim();
    if (trimmed.includes('/services/Waiter.png')) {
      return '/services/Waiter.webm';
    }
    return trimmed;
  }

  // 2. Key-based lookup
  const key = (service.service_key || service.service_icon || service.key || '').toLowerCase().trim();
  if (key && DEFAULT_SERVICE_IMAGES[key]) {
    return DEFAULT_SERVICE_IMAGES[key];
  }

  // 3. Title / name based lookup
  const title = (service.service_title || service.name || service.label || '').toLowerCase().trim();
  for (const [pattern, imgPath] of Object.entries(TITLE_SERVICE_IMAGES)) {
    if (title.includes(pattern)) {
      return imgPath;
    }
  }

  return null;
};

export default function ServiceCard({
  service,
  onClick,
  mode = 'customer',
}: ServiceCardProps) {
  const [imageError, setImageError] = useState(false);

  const title = service.service_title || service.name || 'Service';
  const imageUrl = getServiceImageUrl(service);

  const iconKey = service.service_icon ? (SERVICE_ICON_MAP[service.service_icon] || service.service_icon) : 'Bell';
  const IconComponent = (LucideIcons as any)[iconKey] || Bell;

  const showImage = imageUrl && !imageError;
  const isVideo = showImage && isVideoUrl(imageUrl);

  return (
    <button
      onClick={() => onClick(service)}
      aria-label={`Request ${title}`}
      className="w-[88px] sm:w-[104px] flex flex-col items-center justify-center gap-2 group active:scale-95 focus:outline-none cursor-pointer shrink-0 transition-transform bg-transparent border-0 shadow-none p-1"
    >
      {/* Icon or Image container */}
      <div 
        style={{
          boxShadow: '5px 5px 13px rgba(166, 180, 200, 0.45), -5px -5px 13px rgba(255, 255, 255, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.85)',
        }}
        className="w-[74px] h-[74px] sm:w-[86px] sm:h-[86px] rounded-2xl bg-[#EEF2F6] text-orange-600 flex items-center justify-center group-hover:scale-105 transition-all duration-300 relative overflow-hidden shrink-0"
      >
        <div 
          style={{
            boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.32), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
          }}
          className="w-full h-full rounded-2xl flex items-center justify-center overflow-hidden p-2 sm:p-2.5"
        >
          {showImage ? (
            isVideo ? (
              <video
                src={encodeURI(imageUrl!)}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-contain p-0.5 transition-transform duration-300 group-hover:scale-110 pointer-events-none"
              />
            ) : (
              <img
                src={encodeURI(imageUrl!)}
                alt={title}
                onError={() => setImageError(true)}
                className="w-full h-full object-contain p-0.5 transition-transform duration-300 group-hover:scale-110"
                loading="lazy"
              />
            )
          ) : (
            <IconComponent className="size-8 sm:size-9 text-orange-600 transition-colors" />
          )}
        </div>
      </div>

      {/* Service Name */}
      <span className="font-extrabold text-xs sm:text-[13px] text-slate-800 group-hover:text-orange-600 text-center line-clamp-1 max-w-full transition-colors font-display px-0.5">
        {title}
      </span>
    </button>
  );
}
