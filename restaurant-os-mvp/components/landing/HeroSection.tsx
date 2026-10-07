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
  RotateCcw, 
  Play, 
  Pause,
  Check,
  Bell
} from "lucide-react";

const heroWords = [
  { text: "The", highlight: false },
  { text: "smartest", highlight: true },
  { text: "decision", highlight: true },
  { text: "for", highlight: false },
  { text: "your", highlight: false },
  { text: "restaurant", highlight: false },
];

interface PipelineStep {
  step: number;
  id: "scan_qr" | "order" | "kitchen" | "ready" | "served";
  name: string;
  mobileLabel: string;
  icon: React.ElementType;
  description: string;
  message: string;
  activeColor: string;
  activeDot: string;
  barColor: string;
}

// 5 Buttons with distinct activated colors for both mobile and desktop
const buttonThemes: PipelineStep[] = [
  {
    step: 1,
    id: "scan_qr",
    name: "Scan QR",
    mobileLabel: "1. Scan QR",
    icon: QrCode,
    description: "Customer scans table QR to open digital menu.",
    message: "Customer at TABLE 08 is scanning the table QR.",
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
    message: "Customer at TABLE 08 is placing an order.",
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
    message: "Order received and cooking at Kitchen Station 1.",
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
    description: "Kitchen marks order ready; waiter notified.",
    message: "Dishes ready on hot plate for pickup.",
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
    description: "Waiter serves table and order is completed.",
    message: "Order served — TABLE 08 completed.",
    activeColor: "bg-[#10B981] text-white border-transparent shadow-md shadow-[#10B981]/30",
    activeDot: "bg-[#10B981]",
    barColor: "bg-[#10B981]",
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

const orderStatusStates = ["Ordered", "Kitchen", "Ready", "Waiter", "Served"];
const stepDurations = [3500, 4200, 4200, 3500, 4200];

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
                <span className="bg-gradient-to-r from-[#FF6B6B] via-[#FF8E53] via-[#FFAE73] to-[#FF6B6B] bg-[length:200%_auto] bg-clip-text text-transparent animate-[gradient-flow_3.5s_ease_infinite] drop-shadow-sm font-black">
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
  return (
    <div
      className={`relative w-full ${
        isDesktop
          ? "max-w-[315px] xl:max-w-[335px] rounded-[38px] p-2"
          : "max-w-[215px] sm:max-w-[230px] rounded-[30px] sm:rounded-[32px] p-1 sm:p-1.5"
      } aspect-[9/18.5] bg-neutral-950 border-[1.5px] sm:border-[2px] border-neutral-800 shadow-[0_22px_55px_rgba(0,0,0,0.45)] dark:shadow-[0_28px_65px_rgba(0,0,0,0.75)] ring-1 ring-white/10 flex flex-col justify-between overflow-hidden ${className}`}
    >
      {/* Dynamic Island Pill */}
      <div className={`absolute ${isDesktop ? "top-3 w-20 h-3.5 pr-2" : "top-2 w-16 h-3 pr-1.5"} left-1/2 -translate-x-1/2 bg-neutral-900 rounded-full z-30 flex items-center justify-end`}>
        <div className={`${isDesktop ? "w-2 h-2" : "w-1.5 h-1.5"} rounded-full bg-neutral-800 border border-neutral-700/80`} />
      </div>

      {/* iPhone Inner Screen */}
      <div className={`relative ${
        isDesktop
          ? "rounded-[32px] pt-4 pb-3 px-3.5"
          : "rounded-[25px] sm:rounded-[27px] pt-3.5 pb-2 px-2.5"
      } bg-white dark:bg-neutral-900 overflow-hidden border border-neutral-200/80 dark:border-neutral-800/80 flex flex-col justify-between h-full text-foreground select-none`}>
        
        {/* Status Bar */}
        <div className={`flex items-center justify-between ${isDesktop ? "text-[11px] mb-2" : "text-[9px] mb-1"} font-semibold text-neutral-400 px-0.5 shrink-0`}>
          <span>9:41</span>
          <div className="flex items-center gap-1">
            <span className={`${isDesktop ? "w-2 h-2" : "w-1.5 h-1.5"} rounded-full bg-emerald-500`} />
            <span className={`${isDesktop ? "text-[10px]" : "text-[8px]"} font-mono`}>5G</span>
            <span className={`${isDesktop ? "text-[10px]" : "text-[8px]"}`}>100%</span>
          </div>
        </div>

        {/* App Header with Dine in One Logo on Top Left Corner */}
        <div className={`flex items-center justify-between ${isDesktop ? "pb-2" : "pb-1.5"} border-b border-border/50 shrink-0`}>
          <div className="flex items-center gap-1.5">
            <div className={`${isDesktop ? "w-6 h-6" : "w-5 h-5"} rounded-md bg-white p-0.5 border border-border/60 shadow-xs flex items-center justify-center shrink-0`}>
              <img src="/favicon.png" alt="Dine in One" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className={`${isDesktop ? "text-xs" : "text-[10px]"} font-bold leading-none text-foreground flex items-center gap-0.5`}>
                <span>Dine</span>
                <span className="gradient-text-coral">in</span>
                <span>One</span>
              </div>
              <div className={`${isDesktop ? "text-[9px]" : "text-[7.5px]"} text-muted-foreground font-medium`}>Table 08</div>
            </div>
          </div>
          <div className={`px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 ${isDesktop ? "text-[10px]" : "text-[8px]"} font-bold tracking-tight`}>
            LIVE ORDER
          </div>
        </div>

        {/* Screen Content Body */}
        <div className={`flex-1 py-1 flex flex-col justify-center ${isDesktop ? "min-h-[300px]" : "min-h-[220px]"}`}>
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
                <div className={`relative ${isDesktop ? "w-36 h-36 mb-3 rounded-2xl" : "w-28 h-28 mb-2 rounded-xl"} bg-neutral-950 border-2 border-[#FF6B6B]/40 flex items-center justify-center overflow-hidden shadow-inner`}>
                  {/* Viewfinder Target Brackets */}
                  <div className={`absolute top-1.5 left-1.5 ${isDesktop ? "w-4 h-4 border-t-3 border-l-3" : "w-3 h-3 border-t-2 border-l-2"} border-[#FF6B6B]`} />
                  <div className={`absolute top-1.5 right-1.5 ${isDesktop ? "w-4 h-4 border-t-3 border-r-3" : "w-3 h-3 border-t-2 border-r-2"} border-[#FF6B6B]`} />
                  <div className={`absolute bottom-1.5 left-1.5 ${isDesktop ? "w-4 h-4 border-b-3 border-l-3" : "w-3 h-3 border-b-2 border-l-2"} border-[#FF6B6B]`} />
                  <div className={`absolute bottom-1.5 right-1.5 ${isDesktop ? "w-4 h-4 border-b-3 border-r-3" : "w-3 h-3 border-b-2 border-r-2"} border-[#FF6B6B]`} />

                  {/* Animated Laser Scanning Line */}
                  <motion.div
                    animate={shouldReduceMotion ? {} : { y: isDesktop ? [-50, 50, -50] : [-38, 38, -38] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-[#FF6B6B] to-transparent shadow-[0_0_8px_#FF6B6B]"
                  />

                  {/* QR Code Graphic */}
                  <div className={`${isDesktop ? "p-3 rounded-xl" : "p-2 rounded-lg"} bg-white shadow-sm`}>
                    <QrCode className={`${isDesktop ? "w-20 h-20" : "w-14 h-14"} text-neutral-950`} />
                  </div>
                </div>

                <div className={`${isDesktop ? "text-xs" : "text-[10px]"} font-bold text-foreground`}>
                  Scanning Table QR
                </div>
                <div className={`inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ${isDesktop ? "text-[10px]" : "text-[8px]"} font-bold`}>
                  <Check className={`${isDesktop ? "w-3 h-3" : "w-2.5 h-2.5"}`} />
                  Table 08 Verified
                </div>
              </motion.div>
            )}

            {/* STEP 1: ORDER (With food item images!) */}
            {activeStepIndex === 1 && (
              <motion.div
                key="step-order"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col justify-between h-full py-0.5"
              >
                <div className={`${isDesktop ? "space-y-1.5" : "space-y-1"}`}>
                  <div className={`flex items-center justify-between ${isDesktop ? "text-[10px]" : "text-[8px]"} font-bold text-muted-foreground uppercase`}>
                    <span>Menu Selection</span>
                    <span className="text-purple-600 dark:text-purple-400 font-semibold">Cart (3 items)</span>
                  </div>

                  {sampleFoodItems.map((item) => (
                    <div
                      key={item.name}
                      className={`${isDesktop ? "p-1.5 text-xs" : "p-1 text-[9px]"} rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-border/50 flex items-center justify-between gap-2`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={item.image}
                          alt={item.name}
                          className={`${isDesktop ? "w-8 h-8 rounded-lg" : "w-6 h-6 rounded"} object-cover border border-border/40 shrink-0`}
                        />
                        <span className="font-semibold text-foreground truncate">
                          {item.name} <span className="text-[#8B5CF6] font-bold">×{item.qty}</span>
                        </span>
                      </div>
                      <span className="font-mono font-bold text-foreground shrink-0">
                        ₹{item.price}
                      </span>
                    </div>
                  ))}

                  <div className={`${isDesktop ? "px-2 py-1 text-[10px]" : "px-1.5 py-0.5 text-[8px]"} rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-medium truncate`}>
                    Note: Less spicy
                  </div>
                </div>

                <div className={`pt-2 border-t border-border/50 ${isDesktop ? "mt-2" : "mt-1"}`}>
                  <div className={`flex items-center justify-between ${isDesktop ? "text-xs mb-1.5" : "text-[9px] mb-1"}`}>
                    <span className="text-muted-foreground font-medium">Total Amount</span>
                    <span className={`font-mono font-black text-foreground ${isDesktop ? "text-sm" : ""}`}>₹680</span>
                  </div>
                  <div className={`w-full ${isDesktop ? "py-1.5 text-xs" : "py-1 text-[9px]"} rounded-lg bg-[#8B5CF6] text-white font-bold text-center shadow-xs`}>
                    Order Confirmed ✓
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: KITCHEN (With food images, removed DIO-108 text, enlarged Kitchen status!) */}
            {activeStepIndex === 2 && (
              <motion.div
                key="step-kitchen"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col justify-between h-full py-0.5 text-center"
              >
                {/* Kitchen Status Box with increased text size */}
                <div className={`${isDesktop ? "p-3 mb-2 rounded-xl" : "p-2 mb-1.5 rounded-xl"} bg-orange-500/10 border border-orange-500/20`}>
                  <div className={`inline-flex items-center gap-1.5 text-orange-600 dark:text-orange-400 ${isDesktop ? "text-xs" : "text-[10px]"} font-black uppercase tracking-wider`}>
                    <ChefHat className={`${isDesktop ? "w-4 h-4" : "w-3.5 h-3.5"} animate-bounce`} />
                    <span>KITCHEN (KDS)</span>
                  </div>
                  <div className={`${isDesktop ? "text-base mt-1" : "text-sm mt-0.5"} font-black text-foreground tracking-tight`}>
                    PREPARING ORDER
                  </div>
                  <div className={`${isDesktop ? "text-xs mt-1" : "text-[10px] mt-0.5"} font-mono font-bold text-orange-500`}>
                    Ticket #108 • 04:12 Remaining
                  </div>
                </div>

                {/* Items being prepared with food images */}
                <div className={`${isDesktop ? "space-y-1.5" : "space-y-1"}`}>
                  <div className={`${isDesktop ? "text-[10px]" : "text-[8px]"} font-bold text-muted-foreground uppercase text-left`}>
                    Live Cooking Station
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {sampleFoodItems.map((item) => (
                      <div
                        key={item.name}
                        className={`${isDesktop ? "p-1.5" : "p-1"} rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-border/50 flex flex-col items-center text-center`}
                      >
                        <img
                          src={item.image}
                          alt={item.name}
                          className={`${isDesktop ? "w-9 h-9 mb-1" : "w-7 h-7 mb-0.5"} rounded object-cover border border-border/40`}
                        />
                        <span className={`${isDesktop ? "text-[9px]" : "text-[7.5px]"} font-bold text-foreground truncate w-full`}>
                          {item.name}
                        </span>
                        <span className={`${isDesktop ? "text-[8px]" : "text-[7px]"} text-orange-500 font-semibold`}>
                          Cooking
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Animated Progress Bar */}
                <div className={`${isDesktop ? "my-2" : "my-1"}`}>
                  <div className={`${isDesktop ? "h-2" : "h-1.5"} w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden`}>
                    <motion.div
                      initial={{ width: "20%" }}
                      animate={{ width: "85%" }}
                      transition={{ duration: 3.5, ease: "linear" }}
                      className="h-full bg-orange-500 rounded-full"
                    />
                  </div>
                  <div className={`${isDesktop ? "text-[10px] mt-1" : "text-[8px] mt-0.5"} text-muted-foreground`}>
                    Station 1 • Cooking in progress
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 3: READY (With tick mark animation and food item images!) */}
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
                <div className={`relative flex items-center justify-center ${isDesktop ? "my-2.5" : "my-1.5"}`}>
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0.5 }}
                    animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                    className={`absolute ${isDesktop ? "w-16 h-16" : "w-12 h-12"} rounded-full bg-emerald-500/30`}
                  />
                  <motion.div
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", damping: 12, stiffness: 220 }}
                    className={`relative ${isDesktop ? "w-12 h-12" : "w-10 h-10"} rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/40`}
                  >
                    <Check className={`${isDesktop ? "w-6 h-6 stroke-[3.5]" : "w-5 h-5 stroke-[3.5]"}`} />
                  </motion.div>
                </div>

                <div>
                  <div className={`${isDesktop ? "text-sm" : "text-xs"} font-black text-foreground`}>
                    Order Ready for Pickup!
                  </div>
                  <div className={`${isDesktop ? "text-[10px]" : "text-[8px]"} text-emerald-600 dark:text-emerald-400 font-bold mt-0.5`}>
                    Dishes on hot plate
                  </div>
                </div>

                {/* Food items preview on hot plate */}
                <div className="flex items-center justify-center gap-2 my-1.5">
                  {sampleFoodItems.map((item) => (
                    <div
                      key={item.name}
                      className={`relative ${isDesktop ? "w-9 h-9" : "w-7 h-7"} rounded-md overflow-hidden border border-emerald-500/30 shadow-xs`}
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-0 right-0 bg-emerald-600 text-white text-[7px] font-black px-1 rounded-tl">
                        ✓
                      </span>
                    </div>
                  ))}
                </div>

                <div className={`${isDesktop ? "p-2 text-xs" : "p-1.5 text-[8px]"} rounded-lg bg-card border border-border/50 flex items-center gap-2 text-left`}>
                  <Bell className={`${isDesktop ? "w-4 h-4" : "w-3.5 h-3.5"} text-[#0284C7] shrink-0 animate-pulse`} />
                  <div className="text-foreground leading-tight">
                    <span className="font-bold">Waiter Captain Notified:</span> Pick up hot dishes for Table 08.
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 4: SERVED */}
            {activeStepIndex === 4 && (
              <motion.div
                key="step-served"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col justify-center h-full text-center py-1 my-auto"
              >
                <div className={`${isDesktop ? "w-14 h-14 mb-3" : "w-10 h-10 mb-2"} rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-xs`}>
                  <Utensils className={`${isDesktop ? "w-7 h-7" : "w-5 h-5"}`} />
                </div>

                <div className={`${isDesktop ? "text-base mb-1.5" : "text-xs mb-1"} font-black text-foreground`}>
                  Order Served!
                </div>

                <p className={`${isDesktop ? "text-xs mb-3 px-2" : "text-[10px] mb-2 px-1"} font-semibold text-emerald-600 dark:text-emerald-400 leading-tight`}>
                  &ldquo;Your food is served. Enjoy!&rdquo;
                </p>

                <div className={`inline-flex items-center justify-center gap-1.5 ${isDesktop ? "px-3 py-1 text-[10px]" : "px-2 py-0.5 text-[8px]"} rounded-full bg-neutral-100 dark:bg-neutral-800 font-mono font-bold text-muted-foreground mx-auto`}>
                  Table 08 • ₹680 Paid
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Bottom Micro Status Bar */}
        <div className={`pt-1.5 border-t border-border/50 shrink-0`}>
          <div className={`flex items-center justify-between ${isDesktop ? "text-[10px]" : "text-[8px]"} font-bold text-muted-foreground uppercase`}>
            <span>#DIO-108</span>
            <span className="font-mono font-bold text-primary">
              {orderStatusStates[activeStepIndex]}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5 mt-1.5">
            {orderStatusStates.map((sName, sIdx) => {
              const isCurrent = sIdx === activeStepIndex;
              const isPast = sIdx < activeStepIndex;
              return (
                <div
                  key={sName}
                  className={`${isDesktop ? "h-1.5" : "h-1"} rounded-full transition-colors duration-300 ${
                    isCurrent
                      ? buttonThemes[activeStepIndex].barColor
                      : isPast
                      ? "bg-emerald-500"
                      : "bg-muted"
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

  // Auto progression sequential loop
  useEffect(() => {
    if (!isPlaying || shouldReduceMotion) return;

    const duration = stepDurations[activeStepIndex] || 3800;
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
    timerRef.current = setTimeout(() => {
      setIsPlaying(true);
    }, 6000);
  };

  const handleRestartFlow = () => {
    setActiveStepIndex(0);
    setIsPlaying(true);
  };

  const currentStep = buttonThemes[activeStepIndex];

  return (
    <section 
      className="relative min-h-screen flex items-center justify-center overflow-hidden pt-28 pb-16 px-4 sm:px-6 lg:px-8" 
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
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Continuous Operational Workflow
                </span>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium cursor-pointer"
                  title={isPlaying ? "Pause auto-progression" : "Play auto-progression"}
                  aria-label={isPlaying ? "Pause pipeline" : "Play pipeline"}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3 h-3 text-neutral-500" />
                      <span>Live Active</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 text-emerald-500" />
                      <span>Paused</span>
                    </>
                  )}
                </button>
              </div>

              {/* 5-Step Pipeline Steps Grid with Smooth Traveling Highlight Animation */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5">
                {buttonThemes.map((item, idx) => {
                  const Icon = item.icon;
                  const isActive = idx === activeStepIndex;
                  const isCompleted = idx < activeStepIndex;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleStepClick(idx)}
                      className={`relative flex flex-col items-start p-3 rounded-xl border text-left cursor-pointer overflow-hidden transition-colors ${
                        isActive
                          ? "border-transparent text-white"
                          : isCompleted
                          ? "bg-muted/40 border-border/80 hover:border-border text-foreground"
                          : "bg-card/40 border-border/40 hover:border-border text-muted-foreground"
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
                        <div className="flex items-center justify-between w-full mb-1.5">
                          <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded transition-colors ${
                            isActive 
                              ? "bg-white/20 text-white" 
                              : isCompleted 
                              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                              : "bg-muted text-muted-foreground"
                          }`}>
                            0{item.step}
                          </span>
                          <Icon className={`w-4 h-4 transition-colors ${
                            isActive 
                              ? "text-white" 
                              : isCompleted 
                              ? "text-emerald-500" 
                              : "text-muted-foreground"
                          }`} />
                        </div>

                        <div className={`text-xs font-bold leading-tight transition-colors ${
                          isActive ? "text-white font-extrabold" : "text-foreground/90"
                        }`}>
                          {item.name}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Live Operational Message Banner */}
              <div className="mt-3 p-3 rounded-xl border border-border/80 bg-neutral-50/80 dark:bg-neutral-900/60 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-2 h-2 rounded-full ${currentStep.activeDot} shrink-0 animate-pulse`} />
                  <span className="font-semibold text-foreground truncate">
                    {currentStep.message}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono shrink-0 hidden sm:inline">
                  Step {activeStepIndex + 1} of 5
                </span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href="/register">
                <button className="btn-primary text-sm font-semibold !py-2.5 !px-5 shadow-sm">
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

          {/* RIGHT COLUMN: Realistic Restaurant Mobile Phone (Increased size only in desktop view!) */}
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
        {/* ========================================================= */}
        <div className="block lg:hidden w-full">
          {/* Mobile Continuous Lottie-Style Animated Headline */}
          <ContinuousLottieHeadline
            isDesktop={false}
            shouldReduceMotion={shouldReduceMotion}
          />

          {/* ========================================================= */}
          {/* MOBILE 70/30 SPLIT WORKFLOW DEMO                          */}
          {/* Left (70%): iPhone Mockup (Moved slightly to right)       */}
          {/* Right (30%): 5 Vertically Stacked Workflow Controls       */}
          {/* ========================================================= */}
          <div className="w-full flex items-center justify-between gap-2.5 sm:gap-4 my-4 max-w-[440px] mx-auto">
            
            {/* LEFT SECTION (70%): Moved slightly to the right towards buttons */}
            <div className="w-[68%] sm:w-[70%] flex justify-end items-center pr-1 sm:pr-2 pl-2">
              <HeroPhoneMockup
                activeStepIndex={activeStepIndex}
                shouldReduceMotion={shouldReduceMotion}
                isDesktop={false}
              />
            </div>

            {/* RIGHT SECTION (30%): 5 Vertically Stacked Visual Buttons with smooth travel animation */}
            <div 
              className="w-[32%] sm:w-[30%] flex flex-col justify-center gap-2 sm:gap-2.5 pointer-events-none select-none"
              aria-label="Workflow progress indicators"
            >
              {buttonThemes.map((btn, idx) => {
                const isActive = idx === activeStepIndex;
                const isCompleted = idx < activeStepIndex;

                return (
                  <div
                    key={btn.id}
                    className={`relative px-2 py-2 sm:px-2.5 sm:py-2.5 rounded-xl border text-left transition-colors flex flex-col justify-center overflow-hidden ${
                      isActive
                        ? "border-transparent text-white"
                        : isCompleted
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-medium"
                        : "bg-neutral-100/80 dark:bg-neutral-800/50 text-neutral-400 dark:text-neutral-500 border-neutral-200/50 dark:border-neutral-800/60"
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

                    <div className="relative z-10 flex items-center gap-1.5">
                      <btn.icon className={`w-3 h-3 shrink-0 transition-colors ${
                        isActive ? "text-white" : isCompleted ? "text-emerald-500" : "text-neutral-400"
                      }`} />
                      <span className={`text-[10px] sm:text-[11px] font-bold leading-tight truncate transition-colors ${
                        isActive ? "text-white font-extrabold" : ""
                      }`}>
                        {btn.mobileLabel}
                      </span>
                    </div>

                    {/* Glowing active indicator dot */}
                    {isActive && (
                      <span className="absolute top-1.5 right-1.5 flex h-1.5 w-1.5 z-10">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

          </div>

          {/* Mobile CTAs & Status Indicator */}
          <div className="flex flex-col items-center gap-2.5 pt-2">
            <Link href="/register" className="w-full">
              <button className="w-full btn-primary text-sm font-bold !py-3 shadow-md justify-center">
                Get Started Free →
              </button>
            </Link>
            <div className="inline-flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
              <span className={`w-1.5 h-1.5 rounded-full ${currentStep.activeDot} animate-pulse`} />
              <span>Automated workflow simulation • Step {activeStepIndex + 1} of 5</span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default HeroSection;
