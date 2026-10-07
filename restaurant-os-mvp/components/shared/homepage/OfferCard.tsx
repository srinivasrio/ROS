'use client';

import React, { useState } from 'react';
import { Tag, Copy, Check, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/utils';

interface OfferCardProps {
  offer: {
    id: string | number;
    title?: string;
    description?: string;
    coupon_code?: string;
    code?: string;
    discount_text?: string;
    discount_type?: string;
    discount_value?: number;
    valid_until?: string;
    applicable_order_type?: string;
  };
  onClick?: (offer: any) => void;
}

export default function OfferCard({ offer, onClick }: OfferCardProps) {
  const [copied, setCopied] = useState(false);
  const code = offer.coupon_code || offer.code || 'SPECIAL';
  const discountText =
    offer.discount_text ||
    (offer.discount_value
      ? offer.discount_type === 'percentage'
        ? `${offer.discount_value}% OFF`
        : `₹${offer.discount_value} OFF`
      : 'Special Discount');

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await copyToClipboard(code);
    if (success) {
      setCopied(true);
      toast.success(`Coupon "${code}" copied to clipboard!`);
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.info(`Coupon code: ${code}`);
    }
  };

  return (
    <div 
      onClick={() => onClick?.(offer)}
      className={`relative w-full h-[136px] sm:h-[144px] bg-gradient-to-br from-[#32CD32] via-[#32CD32] to-[#28a728] rounded-2xl p-3.5 sm:p-4 text-white shadow-[0_4px_20px_-2px_rgba(50,205,50,0.38)] hover:shadow-[0_8px_24px_-2px_rgba(50,205,50,0.48)] transition-all duration-300 flex flex-col justify-between overflow-hidden group select-none ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* Decorative background curves */}
      <div className="absolute -right-8 -bottom-8 size-36 rounded-full bg-white/15 pointer-events-none" />
      <div className="absolute right-12 top-0 size-16 rounded-full bg-white/10 pointer-events-none" />

      {/* Decorative ticket side notches */}
      <div className="absolute -left-2 top-1/2 -translate-y-1/2 size-3.5 rounded-full bg-[#EEF2F6] pointer-events-none shadow-inner" />
      <div className="absolute -right-2 top-1/2 -translate-y-1/2 size-3.5 rounded-full bg-[#EEF2F6] pointer-events-none shadow-inner" />

      {/* Top Tag & Discount */}
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/20 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-wider">
            <Sparkles className="size-2.5 fill-white" />
            <span>
              {offer.applicable_order_type === 'DINE_IN'
                ? 'Dine In Only'
                : offer.applicable_order_type === 'TAKEAWAY'
                ? 'Take Away Only'
                : offer.applicable_order_type === 'DELIVERY'
                ? 'Delivery Only'
                : 'Limited Offer'}
            </span>
          </span>
          <span className="text-lg sm:text-xl font-black font-display tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]">
            {discountText}
          </span>
        </div>

        <h3 className="font-bold text-sm sm:text-base text-white mt-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)] line-clamp-1">
          {offer.title || 'Exclusive Restaurant Deal'}
        </h3>
        {offer.description && (
          <p className="text-[11px] text-white/95 drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)] line-clamp-1 mt-0.5 leading-tight">
            {offer.description}
          </p>
        )}
      </div>

      {/* Bottom Coupon Code & Copy Action */}
      <div className="relative z-10 pt-2 border-t border-white/25 flex items-center justify-between gap-2">
        <div className="bg-black/30 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/25 flex items-center gap-1.5 min-w-0">
          <Tag className="size-3 text-lime-200 shrink-0" />
          <span className="font-mono font-bold text-xs tracking-wider text-white truncate">
            {code}
          </span>
        </div>

        <button
          onClick={handleCopy}
          aria-label="Copy coupon code"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-slate-900 font-bold text-[11px] sm:text-xs hover:bg-lime-50 active:scale-95 transition-all shadow-xs shrink-0 cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="size-3 text-[#28a728]" />
              <span className="text-[#208320]">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="size-3 text-slate-600" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
