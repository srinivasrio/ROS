'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Utensils,
  ChevronDown,
  ExternalLink,
  Store,
} from 'lucide-react';
import { cn, formatAddress } from '@/lib/utils';

interface RestaurantFooterProps {
  profile: any;
  mode?: 'customer' | 'admin';
}

export default function RestaurantFooter({ profile }: RestaurantFooterProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const restaurantName = profile?.name || 'Restaurant';
  const logoUrl = profile?.logo_url || profile?.logo;
  const subtitle =
    profile?.description ||
    profile?.tagline ||
    'Experience delicious food crafted with passion and fresh ingredients.';
  const address = formatAddress(profile?.address);
  const phone = profile?.phone || '';
  const email = profile?.email || '';
  const openingHours = profile?.opening_hours || profile?.hours || '11:00 AM - 11:00 PM';

  return (
    <footer 
      style={{
        boxShadow: '0 -6px 20px rgba(166, 180, 200, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
        borderTop: '1px solid rgba(255, 255, 255, 0.9)',
      }}
      className="w-full bg-[#EEF2F6] text-slate-700 mt-12 sm:mt-16 pt-8 sm:pt-10 pb-28 sm:pb-20 rounded-t-[2.5rem]"
    >
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Always Visible Top Section: Brand Info + Subtitle + Restaurant Details Button */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pb-6 border-b border-slate-200/60">
          {/* Brand Header */}
          <div className="flex items-start sm:items-center gap-3.5">
            {logoUrl ? (
              <div 
                style={{
                  boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.8)',
                }}
                className="size-12 rounded-2xl overflow-hidden shrink-0 bg-[#EEF2F6] p-1 flex items-center justify-center"
              >
                <img src={logoUrl} alt={restaurantName} className="w-full h-full object-contain" />
              </div>
            ) : (
              <div 
                style={{
                  boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.8)',
                }}
                className="size-12 rounded-2xl text-orange-600 flex items-center justify-center font-bold shrink-0 bg-[#EEF2F6]"
              >
                <Utensils className="size-6" />
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              <h3 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight font-display">
                {restaurantName}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed max-w-md">
                {subtitle}
              </p>
            </div>
          </div>

          {/* Restaurant Details Toggle Button */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              aria-expanded={isExpanded}
              style={{
                boxShadow: isExpanded 
                  ? 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)'
                  : '3px 3px 8px rgba(166, 180, 200, 0.45), -3px -3px 8px rgba(255, 255, 255, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.9)',
              }}
              className={cn(
                'w-full md:w-auto inline-flex items-center justify-center gap-2.5 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 select-none active:scale-[0.98] cursor-pointer group bg-[#EEF2F6]',
                isExpanded ? 'text-orange-600' : 'text-slate-700 hover:text-slate-900'
              )}
            >
              <Store
                className={cn(
                  'size-4 transition-colors duration-300',
                  isExpanded ? 'text-orange-600' : 'text-slate-500 group-hover:text-slate-700'
                )}
              />
              <span>Restaurant details</span>
              <ChevronDown
                className={cn(
                  'size-4 transition-transform duration-500 ease-out',
                  isExpanded ? 'rotate-180 text-orange-600' : 'text-slate-400 group-hover:text-slate-600'
                )}
              />
            </button>
          </div>
        </div>

        {/* Collapsible Restaurant Details Section - Slowly Expands on Click */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              key="restaurant-details-drawer"
              initial={{ height: 0, opacity: 0 }}
              animate={{
                height: 'auto',
                opacity: 1,
                transition: {
                  height: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.3, delay: 0.1, ease: 'easeOut' },
                },
              }}
              exit={{
                height: 0,
                opacity: 0,
                transition: {
                  height: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.2, ease: 'easeIn' },
                },
              }}
              className="overflow-hidden border-b border-slate-200/60"
            >
              <div className="py-6 sm:py-8 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                {/* Location & Address Card */}
                <div 
                  style={{
                    boxShadow: '4px 4px 10px rgba(166, 180, 200, 0.35), -4px -4px 10px rgba(255, 255, 255, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.85)',
                  }}
                  className="flex flex-col gap-3 p-4 sm:p-5 rounded-2xl bg-[#EEF2F6]"
                >
                  <div className="flex items-center gap-2.5">
                    <div 
                      style={{
                        boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                        border: '1px solid rgba(255, 255, 255, 0.8)',
                      }}
                      className="size-8 rounded-xl bg-[#EEF2F6] text-orange-600 flex items-center justify-center shrink-0"
                    >
                      <MapPin className="size-4" />
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Location & Address
                    </h4>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed flex-1">
                    {address || 'Address information not provided'}
                  </p>
                  {address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        `${restaurantName} ${address}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline w-fit pt-1 transition-colors group"
                    >
                      <span>Get directions</span>
                      <ExternalLink className="size-3 group-hover:translate-x-0.5 transition-transform" />
                    </a>
                  )}
                </div>

                {/* Contact Information Card */}
                <div 
                  style={{
                    boxShadow: '4px 4px 10px rgba(166, 180, 200, 0.35), -4px -4px 10px rgba(255, 255, 255, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.85)',
                  }}
                  className="flex flex-col gap-3 p-4 sm:p-5 rounded-2xl bg-[#EEF2F6]"
                >
                  <div className="flex items-center gap-2.5">
                    <div 
                      style={{
                        boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                        border: '1px solid rgba(255, 255, 255, 0.8)',
                      }}
                      className="size-8 rounded-xl bg-[#EEF2F6] text-orange-600 flex items-center justify-center shrink-0"
                    >
                      <Phone className="size-4" />
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Contact Information
                    </h4>
                  </div>
                  <div className="flex flex-col gap-2.5 text-xs sm:text-sm text-slate-600 flex-1">
                    {phone ? (
                      <a
                        href={`tel:${phone.replace(/\s+/g, '')}`}
                        className="flex items-center gap-2.5 text-slate-700 hover:text-orange-600 transition-colors group"
                      >
                        <div 
                          style={{
                            boxShadow: 'inset 1px 1px 2px rgba(166, 180, 200, 0.3), inset -1px -1px 2px rgba(255, 255, 255, 0.8)',
                          }}
                          className="size-6 rounded-lg bg-[#EEF2F6] flex items-center justify-center text-slate-500 group-hover:text-orange-600 transition-colors shrink-0"
                        >
                          <Phone className="size-3" />
                        </div>
                        <span className="font-semibold">{phone}</span>
                      </a>
                    ) : (
                      <p className="text-slate-400 text-xs">No phone number listed</p>
                    )}

                    {email ? (
                      <a
                        href={`mailto:${email}`}
                        className="flex items-center gap-2.5 text-slate-700 hover:text-orange-600 transition-colors group"
                      >
                        <div 
                          style={{
                            boxShadow: 'inset 1px 1px 2px rgba(166, 180, 200, 0.3), inset -1px -1px 2px rgba(255, 255, 255, 0.8)',
                          }}
                          className="size-6 rounded-lg bg-[#EEF2F6] flex items-center justify-center text-slate-500 group-hover:text-orange-600 transition-colors shrink-0"
                        >
                          <Mail className="size-3" />
                        </div>
                        <span className="font-semibold truncate">{email}</span>
                      </a>
                    ) : null}
                  </div>
                </div>

                {/* Operating Hours Card */}
                <div 
                  style={{
                    boxShadow: '4px 4px 10px rgba(166, 180, 200, 0.35), -4px -4px 10px rgba(255, 255, 255, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.85)',
                  }}
                  className="flex flex-col gap-3 p-4 sm:p-5 rounded-2xl bg-[#EEF2F6]"
                >
                  <div className="flex items-center gap-2.5">
                    <div 
                      style={{
                        boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                        border: '1px solid rgba(255, 255, 255, 0.8)',
                      }}
                      className="size-8 rounded-xl bg-[#EEF2F6] text-orange-600 flex items-center justify-center shrink-0"
                    >
                      <Clock className="size-4" />
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Opening Hours
                    </h4>
                  </div>
                  <div className="flex flex-col gap-1.5 text-xs sm:text-sm text-slate-600 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                      <p className="font-bold text-slate-800">Daily Service</p>
                    </div>
                    <p className="text-slate-600 pl-4 font-medium">{openingHours}</p>
                  </div>
                  <div className="pt-1">
                    <span 
                      style={{
                        boxShadow: 'inset 1px 1px 3px rgba(16, 185, 129, 0.15), inset -1px -1px 3px rgba(255, 255, 255, 0.9)',
                      }}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#EEF2F6] text-emerald-700 border border-emerald-500/20"
                    >
                      Dine-in & Takeaway
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Platform Credit - Always Visible */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
          <p>© {new Date().getFullYear()} {restaurantName}. All rights reserved.</p>
          <div className="flex items-center gap-1.5">
            <span>Powered by</span>
            <span className="font-black text-orange-600 tracking-tight">Dine in One</span>
            <span>OS</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

