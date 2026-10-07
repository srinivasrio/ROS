"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { 
  QrCode, 
  ShoppingBag, 
  ChefHat, 
  CheckCircle2, 
  Utensils, 
  PlusCircle,
  Receipt,
  RotateCcw, 
  Play, 
  Pause,
  Check,
  Bell,
  CreditCard,
  Banknote,
  Smartphone,
  Flame,
  Menu,
  Minimize2,
  X
} from "lucide-react";
import LottiePlayer from "./LottiePlayer";

const heroWords = [
  { text: "The", highlight: false },
  { text: "smartest", highlight: true },
  { text: "decision", highlight: true },
  { text: "for", highlight: false },
  { text: "your", highlight: false },
  { text: "restaurant", highlight: false },
];

export interface PipelineStep {
  step: number;
  id: "scan_qr" | "order" | "kitchen" | "ready" | "served" | "add_more" | "bill";
  name: string;
  mobileLabel: string;
  icon: React.ElementType;
  description: string;
  message: string;
  activeColor: string;
  activeDot: string;
  barColor: string;
}

// 7 Buttons with distinct activated colors for both mobile and desktop
export const buttonThemes: PipelineStep[] = [
  {
    step: 1,
    id: "scan_qr",
    name: "Scan QR",
    mobileLabel: "1. Scan QR",
    icon: QrCode,
    description: "Customer scans table QR to open digital menu.",
    message: "Customer at Table 08 is scanning the QR code.",
    activeColor: "bg-[#FF6B6B] text-white border-transparent shadow-md shadow-[#FF6B6B]/30",
    activeDot: "bg-[#FF6B6B]",
    barColor: "bg-[#FF6B6B]",
  },
  {
    step: 2,
    id: "order",
    name: "Order",
    mobileLabel: "2. Order",
    icon: ShoppingBag,
    description: "Customer views menu, selects items & places order.",
    message: "Order DIO-108 placed for Table 08 (3 items).",
    activeColor: "bg-[#8B5CF6] text-white border-transparent shadow-md shadow-[#8B5CF6]/30",
    activeDot: "bg-[#8B5CF6]",
    barColor: "bg-[#8B5CF6]",
  },
  {
    step: 3,
    id: "kitchen",
    name: "Kitchen",
    mobileLabel: "3. Kitchen",
    icon: ChefHat,
    description: "Kitchen station prepares the food items in real time.",
    message: "Order cooking at Live Kitchen Station 1 & 2.",
    activeColor: "bg-[#F97316] text-white border-transparent shadow-md shadow-[#F97316]/30",
    activeDot: "bg-[#F97316]",
    barColor: "bg-[#F97316]",
  },
  {
    step: 4,
    id: "ready",
    name: "Ready",
    mobileLabel: "4. Ready",
    icon: CheckCircle2,
    description: "Kitchen marks order ready; waiter is notified.",
    message: "Order is ready waiter is on the way to Table 08.",
    activeColor: "bg-[#0284C7] text-white border-transparent shadow-md shadow-[#0284C7]/30",
    activeDot: "bg-[#0284C7]",
    barColor: "bg-[#0284C7]",
  },
  {
    step: 5,
    id: "served",
    name: "Served",
    mobileLabel: "5. Served",
    icon: Utensils,
    description: "Waiter serves table and food is presented to guests.",
    message: "Order served with 1-click confirmation at Table 08.",
    activeColor: "bg-[#10B981] text-white border-transparent shadow-md shadow-[#10B981]/30",
    activeDot: "bg-[#10B981]",
    barColor: "bg-[#10B981]",
  },
  {
    step: 6,
    id: "add_more",
    name: "Add Items",
    mobileLabel: "6. Add Items",
    icon: PlusCircle,
    description: "Add extra dishes directly to running active order.",
    message: "1x Masala Chaas appended to running Table 08 order.",
    activeColor: "bg-[#06B6D4] text-white border-transparent shadow-md shadow-[#06B6D4]/30",
    activeDot: "bg-[#06B6D4]",
    barColor: "bg-[#06B6D4]",
  },
  {
    step: 7,
    id: "bill",
    name: "Bill",
    mobileLabel: "7. Bill",
    icon: Receipt,
    description: "Itemized restaurant bill with UPI, Card & Cash payment.",
    message: "Final bill generated (₹777.00). Settle via Cash, Card or UPI.",
    activeColor: "bg-[#6366F1] text-white border-transparent shadow-md shadow-[#6366F1]/30",
    activeDot: "bg-[#6366F1]",
    barColor: "bg-[#6366F1]",
  },
];

const sampleFoodItems = [
  {
    name: "Paneer Tikka",
    qty: 2,
    price: 360,
    image: "/menu/paneer-tikka.png",
  },
  {
    name: "Garlic Naan",
    qty: 1,
    price: 80,
    image: "/menu/garlic-naan.jpeg",
  },
  {
    name: "Butter Chicken",
    qty: 1,
    price: 240,
    image: "/menu/butter-chicken.png",
  },
];

const orderStatusStates = [
  "Ordered",
  "Kitchen",
  "Cooking",
  "Ready",
  "Served",
  "Add Items",
  "Settlement",
];

const stepDurations = [3600, 4200, 4500, 3800, 4600, 4200, 5600];

// =========================================================================
// CONTINUOUS ADVANCED LOTTIE-STYLE HEADLINE COMPONENT
// =========================================================================
interface ContinuousLottieHeadlineProps {
  isDesktop?: boolean;
  shouldReduceMotion: boolean | null;
}

const ContinuousLottieHeadline: React.FC<ContinuousLottieHeadlineProps> = ({
  isDesktop = false,
  shouldReduceMotion = false,
}) => {
  return (
    <div className="relative mb-5 sm:mb-6 select-none">
      {/* Ambient glowing aura that continuously breathes */}
      <motion.div 
        animate={shouldReduceMotion ? {} : {
          opacity: [0.35, 0.65, 0.35],
          scale: [0.96, 1.05, 0.96],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute -top-6 -left-6 w-80 sm:w-96 h-36 bg-gradient-to-r from-[#FF6B6B]/25 via-[#A855F7]/20 to-[#4ECDC4]/25 blur-3xl rounded-full pointer-events-none"
      />

      <h1 className={`${
        isDesktop 
          ? "text-4xl sm:text-5xl md:text-6xl lg:text-[3.5rem] xl:text-[4.15rem]" 
          : "text-3xl sm:text-4xl"
      } font-black leading-[1.08] tracking-tight text-foreground relative z-10`}>
        {heroWords.map((item, idx) => {
          if (item.highlight) {
            return (
              <motion.span
                key={idx}
                animate={shouldReduceMotion ? {} : {
                  y: [0, -5, 0],
                }}
                transition={{
                  duration: 2.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: idx * 0.16,
                }}
                className="inline-block mr-[0.22em] relative group"
              >
                {/* Continuous liquid gradient shimmer */}
                <span className="bg-gradient-to-r from-[#FF6B6B] via-[#FF8E53] via-[#FFAE73] to-[#FF6B6B] bg-[length:200%_auto] bg-clip-text text-transparent animate-[gradient-flow_3.5s_ease_infinite] drop-shadow-xs font-black">
                  {item.text}
                </span>

                {/* Continuous Lottie Starburst Sparkle 1 */}
                <motion.span
                  animate={shouldReduceMotion ? {} : {
                    rotate: [0, 180, 360],
                    scale: [0.8, 1.25, 0.8],
                    opacity: [0.65, 1, 0.65],
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: idx * 0.3,
                  }}
                  className="absolute -top-3 -right-2.5 pointer-events-none text-[#FF8E53] drop-shadow-[0_0_8px_#FF6B6B]"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4L12 0Z" />
                  </svg>
                </motion.span>

                {/* Continuous Lottie Micro-Sparkle 2 */}
                <motion.span
                  animate={shouldReduceMotion ? {} : {
                    rotate: [360, 180, 0],
                    scale: [0.65, 1.15, 0.65],
                    opacity: [0.45, 0.95, 0.45],
                  }}
                  transition={{
                    duration: 3.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: (idx + 1) * 0.4,
                  }}
                  className="absolute -bottom-1 -left-2 pointer-events-none text-[#FFD93D] drop-shadow-[0_0_6px_#FFAE73]"
                >
                  <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4L12 0Z" />
                  </svg>
                </motion.span>
              </motion.span>
            );
          }

          return (
            <motion.span
              key={idx}
              animate={shouldReduceMotion ? {} : {
                y: [0, -3.5, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
                delay: idx * 0.12,
              }}
              className="inline-block mr-[0.22em] text-foreground"
            >
              {item.text}
            </motion.span>
          );
        })}
      </h1>

      {/* Continuous animated luminous energy beam underneath headline */}
      <div className="relative mt-2.5 h-1 w-44 sm:w-56 overflow-hidden rounded-full bg-gradient-to-r from-transparent via-[#FF6B6B]/25 to-transparent">
        <motion.div
          animate={shouldReduceMotion ? {} : {
            x: ["-100%", "200%"],
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="h-full w-24 bg-gradient-to-r from-transparent via-[#FF6B6B] to-transparent shadow-[0_0_10px_#FF6B6B]"
        />
      </div>
    </div>
  );
};

// =========================================================================
// REUSABLE IPHONE MOCKUP COMPONENT
// Supports isDesktop=true for increased size on desktop only!
// =========================================================================
interface HeroPhoneMockupProps {
  activeStepIndex: number;
  shouldReduceMotion: boolean | null;
  isDesktop?: boolean;
  className?: string;
}

const HeroPhoneMockup: React.FC<HeroPhoneMockupProps> = ({
  activeStepIndex,
  shouldReduceMotion,
  isDesktop = false,
  className = "",
}) => {
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [selectedPayMethod, setSelectedPayMethod] = useState<string | null>(null);
  const [phoneMenuOpen, setPhoneMenuOpen] = useState<boolean>(false);

  // Auto trigger payment popup on bill step after brief receipt reveal
  useEffect(() => {
    if (activeStepIndex === 6) {
      const timer = setTimeout(() => {
        setShowPaymentModal(true);
      }, 1600);
      return () => clearTimeout(timer);
    } else {
      setShowPaymentModal(false);
      setSelectedPayMethod(null);
      setPhoneMenuOpen(false);
    }
  }, [activeStepIndex]);

  return (
    <div
      className={`relative w-full ${
        isDesktop
          ? "max-w-[320px] xl:max-w-[340px] rounded-[38px] p-2"
          : "max-w-[215px] sm:max-w-[230px] rounded-[30px] sm:rounded-[32px] p-1 sm:p-1.5"
      } aspect-[9/18.5] bg-neutral-950 border-[1.5px] sm:border-[2px] border-neutral-800 shadow-[0_22px_55px_rgba(0,0,0,0.35)] ring-1 ring-black/5 flex flex-col justify-between overflow-hidden ${className}`}
    >
      {/* Dynamic Island Pill */}
      <div className={`absolute ${isDesktop ? "top-3 w-20 h-3.5 pr-2" : "top-2 w-16 h-3 pr-1.5"} left-1/2 -translate-x-1/2 bg-neutral-900 rounded-full z-30 flex items-center justify-end`}>
        <div className={`${isDesktop ? "w-2 h-2" : "w-1.5 h-1.5"} rounded-full bg-neutral-800 border border-neutral-700/80`} />
      </div>

      {/* iPhone Inner Screen */}
      <div className={`relative ${
        isDesktop
          ? "rounded-[32px] pt-4 pb-2.5 px-3"
          : "rounded-[25px] sm:rounded-[27px] pt-3 pb-2 px-2"
      } bg-white overflow-hidden border border-neutral-200 flex flex-col justify-between h-full text-neutral-900 select-none`}>
        
        {/* Status Bar */}
        <div className={`flex items-center justify-between ${isDesktop ? "text-[11px] mb-1.5" : "text-[9px] mb-1"} font-semibold text-neutral-400 px-0.5 shrink-0`}>
          <span>9:41</span>
          <div className="flex items-center gap-1">
            <span className={`${isDesktop ? "w-2 h-2" : "w-1.5 h-1.5"} rounded-full bg-emerald-500`} />
            <span className={`${isDesktop ? "text-[10px]" : "text-[8px]"} font-mono`}>5G</span>
            <span className={`${isDesktop ? "text-[10px]" : "text-[8px]"}`}>100%</span>
          </div>
        </div>

        {/* App Header with Dine in One Logo + SMART POS underneath */}
        <div className={`flex items-center justify-between ${isDesktop ? "pb-2" : "pb-1.5"} border-b border-neutral-200 shrink-0`}>
          <div className="flex items-center gap-1.5">
            <div className={`${isDesktop ? "w-6 h-6" : "w-5 h-5"} rounded-md bg-white p-0.5 border border-neutral-200 shadow-xs flex items-center justify-center shrink-0`}>
              <img src="/favicon.png" alt="Dine in One" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col items-start leading-none">
              <div className={`${isDesktop ? "text-xs" : "text-[10px]"} font-bold leading-none text-neutral-900 flex items-center gap-0.5`}>
                <span>Dine</span>
                <span className="gradient-text-coral">in</span>
                <span>One</span>
              </div>
              {/* SMART POS tiny letters below the bottom */}
              <span className={`${isDesktop ? "text-[6.5px]" : "text-[5.5px]"} font-black tracking-[0.2em] text-[#FF6B6B] uppercase leading-none mt-0.5`}>
                SMART POS
              </span>
              <span className={`${isDesktop ? "text-[8px]" : "text-[6.5px]"} text-neutral-400 font-medium leading-none mt-0.5`}>
                Table 08
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <div className={`px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 ${isDesktop ? "text-[9px]" : "text-[7.5px]"} font-bold tracking-tight`}>
              LIVE ORDER
            </div>
            {/* Phone mini 3-lines menu with minimize capability */}
            <button
              onClick={() => setPhoneMenuOpen(!phoneMenuOpen)}
              className="p-1 rounded text-neutral-400 hover:text-neutral-700 transition-colors"
              aria-label="Toggle mobile menu"
            >
              {phoneMenuOpen ? <Minimize2 className="w-3 h-3" /> : <Menu className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Interactive mini menu drawer inside phone mockup */}
        <AnimatePresence>
          {phoneMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-neutral-50 border-b border-neutral-200 p-2 text-left z-20 shrink-0"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold text-neutral-700">Quick Navigation</span>
                <button
                  onClick={() => setPhoneMenuOpen(false)}
                  className="inline-flex items-center gap-0.5 text-[8px] font-bold text-[#FF6B6B] bg-white px-1.5 py-0.5 rounded border border-neutral-200"
                >
                  <Minimize2 className="w-2.5 h-2.5" />
                  Minimize
                </button>
              </div>
              <div className="text-[8px] text-neutral-500 space-y-0.5">
                <div>• Menu Categories (Starters, Mains, Drinks)</div>
                <div>• Call Waiter / Request Water</div>
                <div>• Bill & Settlement</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Screen Content Body */}
        <div className={`flex-1 py-1 flex flex-col justify-center relative overflow-hidden ${isDesktop ? "min-h-[300px]" : "min-h-[220px]"}`}>
          <AnimatePresence mode="wait">
            
            {/* STEP 0: SCAN QR */}
            {activeStepIndex === 0 && (
              <motion.div
                key="step-scan"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center justify-center text-center my-auto"
              >
                <div className={`relative ${isDesktop ? "w-32 h-32 mb-2.5 rounded-2xl" : "w-24 h-24 mb-2 rounded-xl"} bg-neutral-950 border-2 border-[#FF6B6B]/40 flex items-center justify-center overflow-hidden shadow-inner`}>
                  {/* Viewfinder Target Brackets */}
                  <div className={`absolute top-1.5 left-1.5 ${isDesktop ? "w-3.5 h-3.5 border-t-2 border-l-2" : "w-2.5 h-2.5 border-t-2 border-l-2"} border-[#FF6B6B]`} />
                  <div className={`absolute top-1.5 right-1.5 ${isDesktop ? "w-3.5 h-3.5 border-t-2 border-r-2" : "w-2.5 h-2.5 border-t-2 border-r-2"} border-[#FF6B6B]`} />
                  <div className={`absolute bottom-1.5 left-1.5 ${isDesktop ? "w-3.5 h-3.5 border-b-2 border-l-2" : "w-2.5 h-2.5 border-b-2 border-l-2"} border-[#FF6B6B]`} />
                  <div className={`absolute bottom-1.5 right-1.5 ${isDesktop ? "w-3.5 h-3.5 border-b-2 border-r-2" : "w-2.5 h-2.5 border-b-2 border-r-2"} border-[#FF6B6B]`} />

                  {/* Animated Laser Scanning Line */}
                  <motion.div
                    animate={shouldReduceMotion ? {} : { y: isDesktop ? [-45, 45, -45] : [-34, 34, -34] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-[#FF6B6B] to-transparent shadow-[0_0_8px_#FF6B6B]"
                  />

                  {/* QR Code Graphic */}
                  <div className={`${isDesktop ? "p-2.5 rounded-xl" : "p-1.5 rounded-lg"} bg-white shadow-xs`}>
                    <QrCode className={`${isDesktop ? "w-16 h-16" : "w-12 h-12"} text-neutral-950`} />
                  </div>
                </div>

                <div className={`${isDesktop ? "text-xs" : "text-[10px]"} font-bold text-neutral-900`}>
                  Scanning Table QR
                </div>
                <div className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 ${isDesktop ? "text-[9px]" : "text-[8px]"} font-bold`}>
                  <Check className={`${isDesktop ? "w-3 h-3" : "w-2.5 h-2.5"}`} />
                  Table 08 Verified
                </div>
              </motion.div>
            )}

            {/* STEP 1: ORDER (With food item images) */}
            {activeStepIndex === 1 && (
              <motion.div
                key="step-order"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col justify-between h-full py-0.5 text-left"
              >
                <div className={`${isDesktop ? "space-y-1.5" : "space-y-1"}`}>
                  <div className={`flex items-center justify-between ${isDesktop ? "text-[10px]" : "text-[8px]"} font-bold text-neutral-500 uppercase`}>
                    <span>Menu Cart</span>
                    <span className="text-purple-600 font-semibold">3 items</span>
                  </div>

                  {sampleFoodItems.map((item) => (
                    <div
                      key={item.name}
                      className={`${isDesktop ? "p-1.5 text-xs" : "p-1 text-[9px]"} rounded-lg bg-neutral-50 border border-neutral-200/80 flex items-center justify-between gap-2`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <img
                          src={item.image}
                          alt={item.name}
                          className={`${isDesktop ? "w-7 h-7 rounded-md" : "w-6 h-6 rounded"} object-cover border border-neutral-200 shrink-0`}
                        />
                        <span className="font-semibold text-neutral-800 truncate">
                          {item.name} <span className="text-[#8B5CF6] font-bold">×{item.qty}</span>
                        </span>
                      </div>
                      <span className="font-mono font-bold text-neutral-900 shrink-0">
                        ₹{item.price}
                      </span>
                    </div>
                  ))}

                  <div className={`${isDesktop ? "px-2 py-1 text-[9px]" : "px-1.5 py-0.5 text-[8px]"} rounded-md bg-amber-50 border border-amber-200 text-amber-700 font-medium truncate`}>
                    Note: Less spicy & extra napkins
                  </div>
                </div>

                <div className={`pt-1.5 border-t border-neutral-200 ${isDesktop ? "mt-1.5" : "mt-1"}`}>
                  <div className={`flex items-center justify-between ${isDesktop ? "text-xs mb-1" : "text-[9px] mb-1"}`}>
                    <span className="text-neutral-500 font-medium">Subtotal</span>
                    <span className={`font-mono font-black text-neutral-900 ${isDesktop ? "text-sm" : ""}`}>₹680</span>
                  </div>
                  <div className={`w-full ${isDesktop ? "py-1.5 text-xs" : "py-1 text-[9px]"} rounded-lg bg-[#8B5CF6] text-white font-bold text-center shadow-xs`}>
                    Order Confirmed ✓
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: KITCHEN (Vertical top-to-bottom list of all cooking items!) */}
            {activeStepIndex === 2 && (
              <motion.div
                key="step-kitchen"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col justify-between h-full py-0.5 text-left"
              >
                {/* Kitchen Status Header Banner */}
                <div className={`${isDesktop ? "p-2 mb-1.5 rounded-xl" : "p-1.5 mb-1 rounded-lg"} bg-orange-50 border border-orange-200`}>
                  <div className="flex items-center justify-between">
                    <div className={`inline-flex items-center gap-1 text-orange-600 ${isDesktop ? "text-[11px]" : "text-[9px]"} font-black uppercase tracking-wider`}>
                      <ChefHat className={`${isDesktop ? "w-3.5 h-3.5" : "w-3 h-3"} animate-bounce`} />
                      <span>KITCHEN KDS</span>
                    </div>
                    <span className={`${isDesktop ? "text-[9px]" : "text-[7.5px]"} font-mono font-bold text-orange-600`}>
                      Ticket #108
                    </span>
                  </div>
                  <div className={`${isDesktop ? "text-sm mt-0.5" : "text-xs mt-0.5"} font-black text-neutral-900 tracking-tight`}>
                    COOKING IN PROGRESS
                  </div>
                </div>

                {/* Vertical Top-to-Bottom list of all food items */}
                <div className={`${isDesktop ? "space-y-1.5" : "space-y-1"} my-auto`}>
                  <div className={`flex items-center justify-between ${isDesktop ? "text-[9px]" : "text-[7.5px]"} font-bold text-neutral-400 uppercase`}>
                    <span>Order Dishes (3)</span>
                    <span className="text-orange-600 font-semibold">Live Stations</span>
                  </div>

                  {sampleFoodItems.map((item, idx) => (
                    <div
                      key={item.name}
                      className={`${isDesktop ? "p-1.5" : "p-1"} rounded-lg bg-neutral-50 border border-neutral-200/90 flex items-center justify-between gap-1.5`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <img
                          src={item.image}
                          alt={item.name}
                          className={`${isDesktop ? "w-7 h-7 rounded-md" : "w-6 h-6 rounded"} object-cover border border-neutral-200 shrink-0`}
                        />
                        <div className="min-w-0">
                          <div className={`${isDesktop ? "text-[11px]" : "text-[9px]"} font-bold text-neutral-900 truncate`}>
                            {item.name} <span className="text-orange-600 font-extrabold">×{item.qty}</span>
                          </div>
                          <div className={`${isDesktop ? "text-[8px]" : "text-[7px]"} text-neutral-500 font-medium`}>
                            Station {idx + 1} • Grill & Prep
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-0.5">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 ${isDesktop ? "text-[8px]" : "text-[7px]"} font-bold`}>
                          <Flame className="w-2.5 h-2.5 mr-0.5 text-orange-600 animate-pulse" />
                          Cooking
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Progress Bar */}
                <div className={`${isDesktop ? "mt-1.5 pt-1.5" : "mt-1 pt-1"} border-t border-neutral-200`}>
                  <div className={`${isDesktop ? "h-1.5" : "h-1"} w-full bg-neutral-100 rounded-full overflow-hidden`}>
                    <motion.div
                      initial={{ width: "30%" }}
                      animate={{ width: "90%" }}
                      transition={{ duration: 3.8, ease: "linear" }}
                      className="h-full bg-orange-500 rounded-full"
                    />
                  </div>
                  <div className={`flex items-center justify-between ${isDesktop ? "text-[9px] mt-1" : "text-[7.5px] mt-0.5"} text-neutral-500`}>
                    <span>Chef Rajesh Assigned</span>
                    <span className="font-mono font-bold text-orange-600">03:45 left</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 3: READY ("Order is ready waiter is on the way") */}
            {activeStepIndex === 3 && (
              <motion.div
                key="step-ready"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col justify-between h-full py-0.5 text-center"
              >
                {/* Tick Mark Animation with pulsing ring */}
                <div className={`relative flex items-center justify-center ${isDesktop ? "my-2" : "my-1"}`}>
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0.5 }}
                    animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                    className={`absolute ${isDesktop ? "w-14 h-14" : "w-11 h-11"} rounded-full bg-emerald-500/20`}
                  />
                  <motion.div
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", damping: 12, stiffness: 220 }}
                    className={`relative ${isDesktop ? "w-11 h-11" : "w-9 h-9"} rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/40`}
                  >
                    <Check className={`${isDesktop ? "w-5 h-5 stroke-[3.5]" : "w-4 h-4 stroke-[3.5]"}`} />
                  </motion.div>
                </div>

                <div>
                  <div className={`${isDesktop ? "text-sm" : "text-xs"} font-black text-neutral-900 leading-tight`}>
                    Order is ready waiter is on the way
                  </div>
                  <div className={`${isDesktop ? "text-[9px]" : "text-[7.5px]"} text-emerald-600 font-bold mt-0.5`}>
                    Plated hot on kitchen counter
                  </div>
                </div>

                {/* Food items preview on hot plate */}
                <div className="flex items-center justify-center gap-1.5 my-1">
                  {sampleFoodItems.map((item) => (
                    <div
                      key={item.name}
                      className={`relative ${isDesktop ? "w-8 h-8" : "w-6 h-6"} rounded-md overflow-hidden border border-emerald-400/40 shadow-xs`}
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-0 right-0 bg-emerald-600 text-white text-[6.5px] font-black px-0.5 rounded-tl">
                        ✓
                      </span>
                    </div>
                  ))}
                </div>

                <div className={`${isDesktop ? "p-1.5 text-xs" : "p-1 text-[8px]"} rounded-lg bg-sky-50 border border-sky-200 flex items-center gap-1.5 text-left`}>
                  <Bell className={`${isDesktop ? "w-3.5 h-3.5" : "w-3 h-3"} text-[#0284C7] shrink-0 animate-pulse`} />
                  <div className="text-neutral-800 leading-tight">
                    <span className="font-bold">Captain Amit Notified:</span> Serving Table 08 now.
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 4: SERVED (With uploaded One Click Order.json Lottie animation!) */}
            {activeStepIndex === 4 && (
              <motion.div
                key="step-served"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col justify-center h-full text-center py-0.5 my-auto"
              >
                {/* Uploaded Lottie Animation in Served Section */}
                <div className={`relative ${isDesktop ? "w-28 h-28 my-1" : "w-20 h-20 my-0.5"} mx-auto flex items-center justify-center`}>
                  <LottiePlayer
                    animationPath="/animations/one-click-order.json"
                    loop={true}
                    autoplay={true}
                    className="w-full h-full"
                  />
                </div>

                <div className={`${isDesktop ? "text-base mt-1" : "text-xs mt-0.5"} font-black text-neutral-900 leading-tight`}>
                  Order Served!
                </div>

                <p className={`${isDesktop ? "text-xs my-1 px-1" : "text-[9px] my-0.5 px-0.5"} font-semibold text-emerald-600 leading-tight`}>
                  &ldquo;Dishes served to Table 08. Enjoy your meal!&rdquo;
                </p>

                <div className={`inline-flex items-center justify-center gap-1 ${isDesktop ? "px-2.5 py-1 text-[9px]" : "px-2 py-0.5 text-[7.5px]"} rounded-full bg-neutral-100 font-mono font-bold text-neutral-600 mx-auto mt-0.5`}>
                  <span>Table 08</span>
                  <span>•</span>
                  <span className="text-emerald-600 font-bold">1-Click Served</span>
                </div>
              </motion.div>
            )}

            {/* STEP 5: ADD MORE ITEMS (6th Button Information) */}
            {activeStepIndex === 5 && (
              <motion.div
                key="step-add-more"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col justify-between h-full py-0.5 text-left"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`${isDesktop ? "text-[10px]" : "text-[8px]"} font-black text-cyan-600 uppercase tracking-wider flex items-center gap-1`}>
                      <PlusCircle className="w-3 h-3 text-cyan-600" />
                      Add More Items
                    </span>
                    <span className={`px-1.5 py-0.2 rounded bg-cyan-50 border border-cyan-200 text-cyan-700 ${isDesktop ? "text-[9px]" : "text-[7.5px]"} font-bold`}>
                      Table 08
                    </span>
                  </div>

                  <div className={`${isDesktop ? "text-xs mb-1.5" : "text-[9px] mb-1"} font-bold text-neutral-700`}>
                    Appends directly to active ticket:
                  </div>

                  {/* Extra items being added */}
                  <div className={`${isDesktop ? "space-y-1.5" : "space-y-1"}`}>
                    <div className={`${isDesktop ? "p-1.5" : "p-1"} rounded-lg bg-cyan-50/70 border border-cyan-200 flex items-center justify-between`}>
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold text-[9px]">
                          +1
                        </div>
                        <div>
                          <div className={`${isDesktop ? "text-[11px]" : "text-[9px]"} font-bold text-neutral-900`}>
                            Masala Chaas
                          </div>
                          <div className={`${isDesktop ? "text-[8px]" : "text-[7px]"} text-neutral-500`}>
                            Beverage • Chilled
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-neutral-900 text-[10px]">₹60</span>
                        <div className="text-[7px] text-cyan-700 font-bold">Added ✓</div>
                      </div>
                    </div>

                    <div className={`${isDesktop ? "p-1.5" : "p-1"} rounded-lg bg-neutral-50 border border-neutral-200 flex items-center justify-between opacity-80`}>
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded bg-neutral-200 text-neutral-700 flex items-center justify-center font-bold text-[9px]">
                          +1
                        </div>
                        <div>
                          <div className={`${isDesktop ? "text-[11px]" : "text-[9px]"} font-bold text-neutral-900`}>
                            Extra Garlic Naan
                          </div>
                          <div className={`${isDesktop ? "text-[8px]" : "text-[7px]"} text-neutral-500`}>
                            Breads • Crispy
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-neutral-900 text-[10px]">₹80</span>
                        <div className="text-[7px] text-emerald-600 font-bold">Synced</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`${isDesktop ? "p-1.5 mt-1" : "p-1 mt-0.5"} rounded-lg bg-cyan-500 text-white text-center shadow-xs`}>
                  <div className={`${isDesktop ? "text-xs" : "text-[9px]"} font-bold leading-tight`}>
                    Instant KDS Sync
                  </div>
                  <div className={`${isDesktop ? "text-[9px]" : "text-[7.5px]"} text-cyan-100 leading-tight`}>
                    No re-billing required • Added to running bill
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 6: BILL (Original Restaurant Style Thermal Bill & Payment Modal!) */}
            {activeStepIndex === 6 && (
              <motion.div
                key="step-bill"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col justify-between h-full py-0.5 relative text-left"
              >
                {/* Restaurant Style Thermal Bill */}
                <div className={`${isDesktop ? "p-2" : "p-1.5"} bg-amber-50/50 rounded-lg border-2 border-dashed border-neutral-300 font-mono relative overflow-hidden shadow-xs`}>
                  {/* Bill Header */}
                  <div className="text-center pb-1 border-b border-dashed border-neutral-300 mb-1">
                    <div className={`${isDesktop ? "text-[11px]" : "text-[9px]"} font-black text-neutral-900 tracking-wider uppercase`}>
                      DINE IN ONE BISTRO
                    </div>
                    <div className={`${isDesktop ? "text-[8px]" : "text-[6.5px]"} text-neutral-500`}>
                      T-08 • Bill #DIO-108 • 08 Oct 13:42
                    </div>
                  </div>

                  {/* Bill Items with exact prices */}
                  <div className={`${isDesktop ? "text-[9px] space-y-0.5" : "text-[7.5px] space-y-0.2"} text-neutral-700`}>
                    <div className="flex justify-between">
                      <span>2x Paneer Tikka</span>
                      <span className="font-bold">₹360.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span>1x Garlic Naan</span>
                      <span className="font-bold">₹80.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span>1x Butter Chicken</span>
                      <span className="font-bold">₹240.00</span>
                    </div>
                    <div className="flex justify-between text-cyan-700 font-bold">
                      <span>1x Masala Chaas (Add-on)</span>
                      <span>₹60.00</span>
                    </div>
                  </div>

                  {/* Taxes and Exact Total */}
                  <div className={`mt-1 pt-1 border-t border-dashed border-neutral-300 ${isDesktop ? "text-[8.5px]" : "text-[7px]"} text-neutral-600`}>
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>₹740.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CGST (2.5%) + SGST (2.5%)</span>
                      <span>₹37.00</span>
                    </div>
                    <div className={`flex justify-between font-black text-neutral-900 pt-0.5 mt-0.5 border-t border-neutral-300 ${isDesktop ? "text-[11px]" : "text-[9px]"}`}>
                      <span>GRAND TOTAL</span>
                      <span className="text-[#6366F1]">₹777.00</span>
                    </div>
                  </div>
                </div>

                {/* Click to Pay Button */}
                <div className="mt-1">
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    className={`w-full ${isDesktop ? "py-1.5 text-xs" : "py-1 text-[9px]"} rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] text-white font-black text-center shadow-xs flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer`}
                  >
                    <span>Click to Pay ₹777.00</span>
                    <span>→</span>
                  </button>
                </div>

                {/* Animated Lottie Payment Mode Popup */}
                <AnimatePresence>
                  {showPaymentModal && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 15 }}
                      transition={{ type: "spring", damping: 18, stiffness: 260 }}
                      className="absolute inset-0 bg-white/95 backdrop-blur-xs rounded-2xl p-2 z-30 flex flex-col justify-between border border-neutral-200 shadow-xl"
                    >
                      <div className="flex items-center justify-between pb-1 border-b border-neutral-200">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-[#6366F1] animate-ping" />
                          <span className={`${isDesktop ? "text-xs" : "text-[9.5px]"} font-black text-neutral-900`}>
                            Choose Payment Mode
                          </span>
                        </div>
                        <button
                          onClick={() => setShowPaymentModal(false)}
                          className="p-0.5 text-neutral-400 hover:text-neutral-700"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Payment Total Badge */}
                      <div className="text-center py-0.5 bg-neutral-50 rounded-lg border border-neutral-200">
                        <div className={`${isDesktop ? "text-[9px]" : "text-[7.5px]"} text-neutral-500`}>
                          Total Payable
                        </div>
                        <div className={`${isDesktop ? "text-base" : "text-xs"} font-black text-[#6366F1] font-mono`}>
                          ₹777.00
                        </div>
                      </div>

                      {/* Cash, Card, UPI Buttons */}
                      <div className={`${isDesktop ? "space-y-1.5" : "space-y-1"}`}>
                        <button
                          onClick={() => setSelectedPayMethod("UPI")}
                          className={`w-full ${isDesktop ? "p-1.5 text-[10px]" : "p-1 text-[8.5px]"} rounded-lg border flex items-center justify-between font-bold transition-all cursor-pointer ${
                            selectedPayMethod === "UPI"
                              ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs"
                              : "bg-white border-neutral-200 hover:border-neutral-300 text-neutral-800"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center">
                              <Smartphone className="w-2.5 h-2.5" />
                            </div>
                            <span>UPI (GPay / PhonePe / QR)</span>
                          </div>
                          <span className="text-[7.5px] text-emerald-600 font-bold">Fast</span>
                        </button>

                        <button
                          onClick={() => setSelectedPayMethod("Card")}
                          className={`w-full ${isDesktop ? "p-1.5 text-[10px]" : "p-1 text-[8.5px]"} rounded-lg border flex items-center justify-between font-bold transition-all cursor-pointer ${
                            selectedPayMethod === "Card"
                              ? "bg-blue-50 border-blue-500 text-blue-800 shadow-xs"
                              : "bg-white border-neutral-200 hover:border-neutral-300 text-neutral-800"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded bg-blue-100 text-blue-700 flex items-center justify-center">
                              <CreditCard className="w-2.5 h-2.5" />
                            </div>
                            <span>Debit / Credit Card</span>
                          </div>
                          <span className="text-[7.5px] text-blue-600 font-bold">POS</span>
                        </button>

                        <button
                          onClick={() => setSelectedPayMethod("Cash")}
                          className={`w-full ${isDesktop ? "p-1.5 text-[10px]" : "p-1 text-[8.5px]"} rounded-lg border flex items-center justify-between font-bold transition-all cursor-pointer ${
                            selectedPayMethod === "Cash"
                              ? "bg-amber-50 border-amber-500 text-amber-800 shadow-xs"
                              : "bg-white border-neutral-200 hover:border-neutral-300 text-neutral-800"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded bg-amber-100 text-amber-700 flex items-center justify-center">
                              <Banknote className="w-2.5 h-2.5" />
                            </div>
                            <span>Cash at Counter</span>
                          </div>
                          <span className="text-[7.5px] text-amber-600 font-bold">Counter</span>
                        </button>
                      </div>

                      <div className="text-center">
                        <div className={`${isDesktop ? "text-[9px]" : "text-[7.5px]"} text-emerald-600 font-bold flex items-center justify-center gap-1`}>
                          <Check className="w-2.5 h-2.5" />
                          <span>Auto GST Invoice • Table 08 Closed</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Bottom Micro Status Bar */}
        <div className={`pt-1.5 border-t border-neutral-200 shrink-0`}>
          <div className={`flex items-center justify-between ${isDesktop ? "text-[10px]" : "text-[8px]"} font-bold text-neutral-500 uppercase`}>
            <span>#DIO-108</span>
            <span className="font-mono font-bold text-[#FF6B6B]">
              {orderStatusStates[activeStepIndex]}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1 mt-1">
            {buttonThemes.map((bItem, sIdx) => {
              const isCurrent = sIdx === activeStepIndex;
              const isPast = sIdx < activeStepIndex;
              return (
                <div
                  key={bItem.id}
                  className={`${isDesktop ? "h-1.5" : "h-1"} rounded-full transition-colors duration-300 ${
                    isCurrent
                      ? bItem.barColor
                      : isPast
                      ? "bg-emerald-500"
                      : "bg-neutral-200"
                  }`}
                />
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};

// =========================================================================
// MAIN HERO SECTION COMPONENT
// =========================================================================
const HeroSection: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto progression sequential loop across 7 steps
  useEffect(() => {
    if (!isPlaying || shouldReduceMotion) return;

    const duration = stepDurations[activeStepIndex] || 4000;
    timerRef.current = setTimeout(() => {
      setActiveStepIndex((prev) => (prev + 1) % buttonThemes.length);
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeStepIndex, isPlaying, shouldReduceMotion]);

  const handleStepClick = (index: number) => {
    setActiveStepIndex(index);
    if (timerRef.current) clearTimeout(timerRef.current);
    // Pause briefly after user interaction then resume auto flow
    timerRef.current = setTimeout(() => {
      setIsPlaying(true);
    }, 7000);
  };

  const handleRestartFlow = () => {
    setActiveStepIndex(0);
    setIsPlaying(true);
  };

  const currentStep = buttonThemes[activeStepIndex];

  return (
    <section 
      className="relative min-h-screen flex items-center justify-center overflow-hidden pt-28 pb-16 px-4 sm:px-6 lg:px-8 bg-white" 
      id="hero"
      aria-label="Live Operational Pipeline Hero"
    >
      {/* Background ambient decorative blurs */}
      <div className="absolute top-10 left-10 w-[450px] h-[450px] bg-[#FF6B6B]/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-20 right-10 w-[450px] h-[450px] bg-[#4ECDC4]/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-purple-500/8 rounded-full blur-[160px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto w-full">
        
        {/* ========================================================= */}
        {/* DESKTOP HERO VIEW (lg+ screens)                           */}
        {/* ========================================================= */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          
          {/* LEFT COLUMN: Continuous Animated Headline, Operational Pipeline, CTAs */}
          <div className="lg:col-span-7 flex flex-col justify-center text-left">
            
            {/* Main Headline with Advanced Continuous Lottie Motion */}
            <ContinuousLottieHeadline
              isDesktop={true}
              shouldReduceMotion={shouldReduceMotion}
            />

            {/* Continuous Operational Workflow Pipeline */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Continuous Operational Workflow
                </span>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="inline-flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-900 transition-colors font-semibold cursor-pointer px-2.5 py-1 rounded-full bg-neutral-100 hover:bg-neutral-200 border border-neutral-200"
                  title={isPlaying ? "Pause auto-progression" : "Play auto-progression"}
                  aria-label={isPlaying ? "Pause pipeline" : "Play pipeline"}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3 h-3 text-neutral-600" />
                      <span>Auto Mode: ON</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 text-emerald-600" />
                      <span>Auto Mode: OFF</span>
                    </>
                  )}
                </button>
              </div>

              {/* 7-Step Pipeline Steps Grid with Smooth Traveling Highlight Animation */}
              <div className="grid grid-cols-4 xl:grid-cols-7 gap-2">
                {buttonThemes.map((item, idx) => {
                  const Icon = item.icon;
                  const isActive = idx === activeStepIndex;
                  const isCompleted = idx < activeStepIndex;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleStepClick(idx)}
                      className={`relative flex flex-col items-start p-2.5 rounded-xl border text-left cursor-pointer overflow-hidden transition-all ${
                        isActive
                          ? "border-transparent text-white shadow-sm"
                          : isCompleted
                          ? "bg-neutral-50 border-neutral-200 hover:border-neutral-300 text-neutral-800"
                          : "bg-white border-neutral-200 hover:border-neutral-300 text-neutral-500"
                      }`}
                    >
                      {/* Smooth Spring Travel Animation From Button to Button */}
                      {isActive && (
                        <motion.div
                          layoutId="desktopButtonTravelIndicator"
                          className={`absolute inset-0 ${item.activeColor} rounded-xl z-0`}
                          transition={{
                            type: "spring",
                            stiffness: 350,
                            damping: 32,
                            mass: 0.8,
                          }}
                        />
                      )}

                      {/* Button Foreground Content */}
                      <div className="relative z-10 w-full">
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className={`text-[9.5px] font-bold font-mono px-1 py-0.2 rounded transition-colors ${
                            isActive 
                              ? "bg-white/20 text-white" 
                              : isCompleted 
                              ? "bg-emerald-100 text-emerald-700" 
                              : "bg-neutral-100 text-neutral-500"
                          }`}>
                            0{item.step}
                          </span>
                          <Icon className={`w-3.5 h-3.5 transition-colors ${
                            isActive 
                              ? "text-white" 
                              : isCompleted 
                              ? "text-emerald-600" 
                              : "text-neutral-400"
                          }`} />
                        </div>

                        <div className={`text-[11px] font-bold leading-tight truncate transition-colors ${
                          isActive ? "text-white font-extrabold" : "text-neutral-800"
                        }`}>
                          {item.name}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Live Operational Message Banner */}
              <div className="mt-3 p-3 rounded-xl border border-neutral-200 bg-neutral-50 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-2 h-2 rounded-full ${currentStep.activeDot} shrink-0 animate-pulse`} />
                  <span className="font-semibold text-neutral-800 truncate">
                    {currentStep.message}
                  </span>
                </div>
                <span className="text-[11px] text-neutral-500 font-mono shrink-0 hidden sm:inline">
                  Step {activeStepIndex + 1} of 7
                </span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href="/register">
                <button className="btn-primary text-sm font-semibold !py-2.5 !px-5 shadow-xs">
                  Get Started Free →
                </button>
              </Link>
              <button
                onClick={handleRestartFlow}
                className="btn-outline text-sm font-medium !py-2.5 !px-4 flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                See live order flow
              </button>
            </div>

          </div>

          {/* RIGHT COLUMN: Realistic Restaurant Mobile Phone (Increased size in desktop view!) */}
          <div className="lg:col-span-5 flex justify-center items-center">
            <HeroPhoneMockup
              activeStepIndex={activeStepIndex}
              shouldReduceMotion={shouldReduceMotion}
              isDesktop={true}
            />
          </div>

        </div>

        {/* ========================================================= */}
        {/* MOBILE HERO VIEW (Dedicated mobile layout)                */}
        {/* 70% Animation area (iPhone) + 30% Workflow controls       */}
        {/* All buttons are fully clickable + Auto Mode button!       */}
        {/* ========================================================= */}
        <div className="block lg:hidden w-full">
          {/* Mobile Continuous Lottie-Style Animated Headline */}
          <ContinuousLottieHeadline
            isDesktop={false}
            shouldReduceMotion={shouldReduceMotion}
          />

          {/* 70/30 SPLIT WORKFLOW DEMO */}
          <div className="w-full flex items-center justify-between gap-2 sm:gap-3.5 my-3 max-w-[460px] mx-auto">
            
            {/* LEFT SECTION (70%): iPhone Mockup */}
            <div className="w-[66%] sm:w-[68%] flex justify-end items-center pr-1 pl-1">
              <HeroPhoneMockup
                activeStepIndex={activeStepIndex}
                shouldReduceMotion={shouldReduceMotion}
                isDesktop={false}
              />
            </div>

            {/* RIGHT SECTION (30%): 7 Clickable Workflow Buttons + Auto Mode Button */}
            <div 
              className="w-[34%] sm:w-[32%] flex flex-col justify-center gap-1.5 select-none pointer-events-auto"
              aria-label="Workflow step buttons"
            >
              {/* Mobile Auto Mode Toggle Button */}
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`flex items-center justify-between px-2 py-1 rounded-lg border text-[9px] font-bold transition-all cursor-pointer shadow-xs active:scale-95 ${
                  isPlaying
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                    : "bg-neutral-100 border-neutral-300 text-neutral-600"
                }`}
                title="Toggle Auto progression"
              >
                <span className="flex items-center gap-1">
                  {isPlaying ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
                  <span>Auto</span>
                </span>
                <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? "bg-emerald-500 animate-pulse" : "bg-neutral-400"}`} />
              </button>

              {/* 7 Stacked Clickable Step Buttons */}
              {buttonThemes.map((btn, idx) => {
                const isActive = idx === activeStepIndex;
                const isCompleted = idx < activeStepIndex;

                return (
                  <button
                    key={btn.id}
                    onClick={() => handleStepClick(idx)}
                    className={`relative px-2 py-1.5 sm:px-2.5 sm:py-2 rounded-xl border text-left transition-all flex flex-col justify-center overflow-hidden cursor-pointer active:scale-95 ${
                      isActive
                        ? "border-transparent text-white shadow-sm"
                        : isCompleted
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300 font-medium"
                        : "bg-neutral-50 text-neutral-600 border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    {/* Smooth Spring Travel Animation in Mobile Stack */}
                    {isActive && (
                      <motion.div
                        layoutId="mobileButtonTravelIndicator"
                        className={`absolute inset-0 ${btn.activeColor} rounded-xl z-0`}
                        transition={{
                          type: "spring",
                          stiffness: 350,
                          damping: 32,
                          mass: 0.8,
                        }}
                      />
                    )}

                    <div className="relative z-10 flex items-center gap-1">
                      <btn.icon className={`w-3 h-3 shrink-0 transition-colors ${
                        isActive ? "text-white" : isCompleted ? "text-emerald-600" : "text-neutral-500"
                      }`} />
                      <span className={`text-[9.5px] sm:text-[10.5px] font-bold leading-tight truncate transition-colors ${
                        isActive ? "text-white font-black" : ""
                      }`}>
                        {btn.mobileLabel}
                      </span>
                    </div>

                    {/* Glowing active indicator dot */}
                    {isActive && (
                      <span className="absolute top-1 right-1 flex h-1.5 w-1.5 z-10">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

          </div>

          {/* Mobile CTAs & Status Indicator */}
          <div className="flex flex-col items-center gap-2 pt-2">
            <Link href="/register" className="w-full">
              <button className="w-full btn-primary text-sm font-bold !py-3 shadow-md justify-center">
                Get Started Free →
              </button>
            </Link>
            <div className="inline-flex items-center gap-2 text-[11px] text-neutral-500 font-medium">
              <span className={`w-1.5 h-1.5 rounded-full ${currentStep.activeDot} animate-pulse`} />
              <span>Step {activeStepIndex + 1} of 7 • {currentStep.name}</span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default HeroSection;
