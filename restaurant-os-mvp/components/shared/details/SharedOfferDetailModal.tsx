'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X as LucideX, 
  ArrowLeft as LucideArrowLeft, 
  Ticket as LucideTicket, 
  Copy as LucideCopy, 
  CheckCircle as LucideCheckCircle, 
  Sparkles as LucideSparkles, 
  Clock as LucideClock, 
  ShoppingBag as LucideShoppingBag,
  Info as LucideInfo
} from 'lucide-react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/utils';

interface SharedOfferDetailModalProps {
  offer: any | null;
  isOpen?: boolean;
  onClose: () => void;
  currencySymbol?: string;
  restaurantCode?: string;
  tableNumber?: string;
}

export default function SharedOfferDetailModal({
  offer,
  isOpen,
  onClose,
  currencySymbol = '₹',
  restaurantCode,
  tableNumber,
}: SharedOfferDetailModalProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  // Close on Escape key and lock background scroll
  useEffect(() => {
    if ((isOpen !== undefined && !isOpen) || !offer) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    // Lock body and customer-scroll-container
    const originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    const scrollContainer = document.getElementById('customer-scroll-container');
    const originalContainerOverflow = scrollContainer ? scrollContainer.style.overflow : '';
    if (scrollContainer) {
      scrollContainer.style.overflow = 'hidden';
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalBodyOverflow;
      if (scrollContainer) {
        scrollContainer.style.overflow = originalContainerOverflow;
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, offer, onClose]);

  if ((isOpen !== undefined && !isOpen) || !offer) return null;

  const code = offer.code || offer.coupon_code || 'PROMO';
  const title = offer.title || (offer.discount_type === 'flat' ? `Flat ₹${offer.discount_value} Off` : `${offer.discount_value}% Discount Deal`);
  const discountHighlight = offer.discount_type === 'flat' ? `₹${offer.discount_value} OFF` : `${offer.discount_value}% OFF`;
  const minOrder = Number(offer.min_order_value || offer.minOrder || 0);
  const maxDiscount = Number(offer.max_discount || offer.maxDiscount || 0);
  const expiry = offer.end_datetime || offer.valid_until;

  const handleCopyCode = async () => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopied(true);
      toast.success(`Coupon code ${code} copied!`, {
        duration: 2500,
        position: 'bottom-center',
        icon: <LucideCheckCircle size={16} className="text-emerald-500" />,
      });
      setTimeout(() => setCopied(false), 2500);
    } else {
      toast.info(`Coupon code: ${code}`);
    }
  };

  const handleApplyAndOrder = async () => {
    await handleCopyCode();
    onClose();
    if (restaurantCode && tableNumber) {
      router.push(`/${restaurantCode}/customer/menu/${tableNumber}`);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm cursor-pointer"
          aria-hidden="true"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            boxShadow: '0 20px 50px rgba(15, 23, 42, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.85)',
          }}
          className="relative w-full sm:max-w-md bg-[#EEF2F6] rounded-t-[32px] sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col z-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby="offer-modal-title"
        >
          {/* Top Grab Bar (Mobile) */}
          <div className="sm:hidden absolute top-2.5 left-1/2 -translate-x-1/2 w-12 h-1.5 rounded-full bg-white/60 z-30 pointer-events-none shadow-xs" />

          {/* Ticket Header Graphic */}
          <div className="relative bg-gradient-to-br from-[#32CD32] via-[#28a728] to-[#1e821e] p-6 text-white overflow-hidden shrink-0">
            {/* Ambient Ticket Curves */}
            <div className="absolute -right-10 -bottom-10 size-44 rounded-full bg-white/10 pointer-events-none" />
            <div className="absolute -left-6 top-0 size-24 rounded-full bg-white/10 pointer-events-none" />

            {/* Header Actions */}
            <div className="flex items-center justify-between relative z-10 mb-4">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back"
                className="size-9 rounded-full bg-black/25 hover:bg-black/40 text-white backdrop-blur-md flex items-center justify-center transition-all active:scale-90 border border-white/20 shadow-md cursor-pointer"
              >
                <LucideArrowLeft size={18} />
              </button>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-[11px] font-black uppercase tracking-wider">
                <LucideSparkles size={12} className="fill-white" />
                <span>Special Promo</span>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="size-9 rounded-full bg-black/25 hover:bg-black/40 text-white backdrop-blur-md flex items-center justify-center transition-all active:scale-90 border border-white/20 shadow-md cursor-pointer"
              >
                <LucideX size={18} />
              </button>
            </div>

            {/* Discount Callout */}
            <div className="relative z-10 text-center py-2">
              <span className="text-4xl sm:text-5xl font-black font-display tracking-tight text-white drop-shadow-md">
                {discountHighlight}
              </span>
              <p className="text-white/90 text-xs font-bold uppercase tracking-widest mt-1">
                Exclusive Dining Privilege
              </p>
            </div>
          </div>

          {/* Notched Divider Bar */}
          <div className="relative h-6 bg-[#EEF2F6] flex items-center justify-between border-y border-dashed border-slate-300">
            <div 
              style={{ boxShadow: 'inset 2px 2px 3px rgba(166, 180, 200, 0.4)' }}
              className="size-6 -ml-3 rounded-full bg-[#EEF2F6]" 
            />
            <div className="flex-1 border-t-2 border-dashed border-slate-300 mx-3" />
            <div 
              style={{ boxShadow: 'inset -2px 2px 3px rgba(166, 180, 200, 0.4)' }}
              className="size-6 -mr-3 rounded-full bg-[#EEF2F6]" 
            />
          </div>

          {/* Details Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 no-scrollbar flex-1 bg-[#EEF2F6]">
            <div>
              <h2 id="offer-modal-title" className="text-lg sm:text-xl font-black text-slate-800 leading-tight tracking-tight">
                {title}
              </h2>
              {offer.description && (
                <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1.5 leading-relaxed">
                  {offer.description}
                </p>
              )}
            </div>

            {/* Stylized Coupon Box */}
            <div className="bg-lime-50/80 border-2 border-dashed border-[#32CD32] rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#208320] mb-0.5">
                  Coupon Code
                </p>
                <span className="font-mono text-xl font-black text-slate-900 tracking-wider">
                  {code}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopyCode}
                className="px-4 py-2.5 rounded-xl bg-[#32CD32] hover:bg-[#28a728] text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-[#32CD32]/25 cursor-pointer shrink-0"
              >
                {copied ? (
                  <>
                    <LucideCheckCircle size={15} />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <LucideCopy size={15} />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>

            {/* Terms & Applicable Details */}
            <div className="space-y-2.5 pt-1">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <LucideInfo size={14} className="text-slate-400" />
                <span>Offer Terms & Details</span>
              </h3>

              <div 
                style={{
                  boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.3), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.7)',
                }}
                className="bg-[#EEF2F6] rounded-2xl p-3.5 space-y-2 text-xs text-slate-600"
              >
                {minOrder > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-500">Minimum Order Value:</span>
                    <span className="font-black text-slate-800">₹{minOrder}</span>
                  </div>
                )}
                {maxDiscount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-500">Maximum Discount:</span>
                    <span className="font-black text-slate-800">₹{maxDiscount}</span>
                  </div>
                )}
                {expiry && (
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-500">Valid Until:</span>
                    <span className="font-black text-slate-800" suppressHydrationWarning>
                      {new Date(expiry).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-500">Applicability:</span>
                  <span className="font-black text-emerald-700">
                    {offer.applicable_order_type === 'DINE_IN'
                      ? 'Dine-In Orders Only'
                      : offer.applicable_order_type === 'TAKEAWAY'
                      ? 'Take Away Orders Only'
                      : offer.applicable_order_type === 'DELIVERY'
                      ? 'Delivery Orders Only'
                      : 'All Orders (Dine-in, Takeaway & Delivery)'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Bottom Action Footer */}
          <div className="p-4 sm:p-5 bg-[#EEF2F6] border-t border-slate-200/60 shrink-0 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              style={{
                boxShadow: '3px 3px 6px rgba(166, 180, 200, 0.4), -3px -3px 6px rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.9)',
              }}
              className="px-4 py-3 rounded-2xl bg-[#EEF2F6] text-slate-700 text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <LucideArrowLeft size={16} />
              <span className="hidden sm:inline">Back</span>
            </button>

            <button
              type="button"
              onClick={handleApplyAndOrder}
              className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-[#32CD32] to-[#28a728] hover:from-[#2eb82e] hover:to-[#229222] text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-[#32CD32]/25 active:scale-98 transition-all cursor-pointer"
            >
              <LucideShoppingBag size={18} />
              <span>Copy Code & Browse Menu</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
