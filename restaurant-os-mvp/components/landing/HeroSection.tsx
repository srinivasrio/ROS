"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { 
  QrCode, 
  ShoppingBag, 
  CheckCircle2, 
  Utensils, 
  PlusCircle,
  Receipt,
  RotateCcw, 
  Play, 
  Pause,
  Check,
  CreditCard,
  Banknote,
  Smartphone,
  Flame,
  Menu,
  Minimize2,
  X,
  Tag,
  ClipboardList
} from "lucide-react";
import LottiePlayer from "./LottiePlayer";

// Dynamic words cycling in hero headline: "smartest" -> "Best" -> "ultimate" -> "perfect"
const dynamicHeadlineWords = ["smartest", "Best", "ultimate", "perfect"];

export interface PipelineStep {
  step: number;
  id: "scan_qr" | "order" | "order_status" | "ready" | "served" | "add_more" | "bill";
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
    id: "order_status",
    name: "Order Status",
    mobileLabel: "3. Order Status",
    icon: ClipboardList,
    description: "Live kitchen preparing dishes one by one.",
    message: "Kitchen stations preparing Table 08 dishes.",
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
    description: "All dishes ready; waiter Srinivas assigned.",
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
    description: "Food served to guests at Table 08.",
    message: "Order served — Enjoy your meal!",
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
    description: "Add extra dishes directly to running order.",
    message: "Extra dishes appended to running Table 08 order.",
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
    message: "Bill generated (₹777.00). Settle via Cash, Card or UPI.",
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

const addedFoodItems = [
  {
    name: "Gulab Jamun (2 pcs)",
    qty: 1,
    price: 60,
    image: "/menu/gulab-jamun.jpeg",
  },
  {
    name: "Extra Garlic Naan",
    qty: 1,
    price: 80,
    image: "/menu/garlic-naan.jpeg",
  },
];

const orderStatusStates = [
  "Ordered",
  "Cart",
  "Cooking",
  "Ready",
  "Served",
  "Added Items",
  "Settled",
];

const stepDurations = [3600, 4000, 4600, 3800, 4400, 4000, 6200];

// =========================================================================
// CONTINUOUS ADVANCED LOTTIE-STYLE HEADLINE COMPONENT
// Cycles: smartest -> Best -> ultimate -> perfect smoothly
// =========================================================================
interface ContinuousLottieHeadlineProps {
  isDesktop?: boolean;
  shouldReduceMotion: boolean | null;
}

const ContinuousLottieHeadline: React.FC<ContinuousLottieHeadlineProps> = ({
  isDesktop = false,
  shouldReduceMotion = false,
}) => {
  const [dynWordIdx, setDynWordIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setDynWordIdx((prev) => (prev + 1) % dynamicHeadlineWords.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

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
      } font-black leading-[1.08] tracking-tight text-neutral-900 relative z-10`}>
        <motion.span
          animate={shouldReduceMotion ? {} : { y: [0, -3.5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="inline-block mr-[0.22em] text-neutral-900"
        >
          The
        </motion.span>

        {/* Dynamic cycling word: smartest -> Best -> ultimate -> perfect */}
        <span className="inline-block relative mr-[0.22em]">
          <AnimatePresence mode="wait">
            <motion.span
              key={dynamicHeadlineWords[dynWordIdx]}
              initial={{ opacity: 0, y: 16, scale: 0.92, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -16, scale: 0.92, filter: "blur(4px)" }}
              transition={{ type: "spring", stiffness: 280, damping: 20 }}
              className="inline-block relative"
            >
              <span className="bg-gradient-to-r from-[#FF6B6B] via-[#FF8E53] via-[#FFAE73] to-[#FF6B6B] bg-[length:200%_auto] bg-clip-text text-transparent animate-[gradient-flow_3.5s_ease_infinite] drop-shadow-xs font-black">
                {dynamicHeadlineWords[dynWordIdx]}
              </span>

              {/* Lottie Starburst Sparkle 1 */}
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
                }}
                className="absolute -top-3 -right-2.5 pointer-events-none text-[#FF8E53] drop-shadow-[0_0_8px_#FF6B6B]"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4L12 0Z" />
                </svg>
              </motion.span>
            </motion.span>
          </AnimatePresence>
        </span>

        {/* "decision" highlighted */}
        <span className="inline-block mr-[0.22em] relative">
          <span className="bg-gradient-to-r from-[#FF6B6B] via-[#FF8E53] to-[#FF6B6B] bg-clip-text text-transparent font-black">
            decision
          </span>
        </span>

        <motion.span
          animate={shouldReduceMotion ? {} : { y: [0, -3.5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
          className="inline-block mr-[0.22em] text-neutral-900"
        >
          for
        </motion.span>
        <motion.span
          animate={shouldReduceMotion ? {} : { y: [0, -3.5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
          className="inline-block mr-[0.22em] text-neutral-900"
        >
          your
        </motion.span>
        <motion.span
          animate={shouldReduceMotion ? {} : { y: [0, -3.5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
          className="inline-block text-neutral-900"
        >
          restaurant
        </motion.span>
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
// With Realistic Volume & Power Hardware Buttons on Side!
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
  const [selectedPayMethod, setSelectedPayMethod] = useState<string>("UPI");
  const [paymentDone, setPaymentDone] = useState<boolean>(false);
  const [kitchenReadyCount, setKitchenReadyCount] = useState<number>(0);
  const [phoneMenuOpen, setPhoneMenuOpen] = useState<boolean>(false);

  // Sequential kitchen items readiness: item 1 -> item 2 -> item 3
  useEffect(() => {
    if (activeStepIndex === 2) {
      setKitchenReadyCount(0);
      const t1 = setTimeout(() => setKitchenReadyCount(1), 1000);
      const t2 = setTimeout(() => setKitchenReadyCount(2), 2200);
      const t3 = setTimeout(() => setKitchenReadyCount(3), 3400);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    } else {
      setKitchenReadyCount(0);
    }
  }, [activeStepIndex]);

  // Automated Bill flow: reveals bill -> opens payment modal -> selects random method -> clicks pay -> shows Payment done
  useEffect(() => {
    if (activeStepIndex === 6) {
      setPaymentDone(false);
      const methods = ["UPI", "Card", "Cash"];
      const randomMethod = methods[Math.floor(Math.random() * methods.length)];
      setSelectedPayMethod(randomMethod);

      const t1 = setTimeout(() => {
        setShowPaymentModal(true);
      }, 1500);

      const t2 = setTimeout(() => {
        // Auto confirm payment
        setPaymentDone(true);
      }, 3400);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    } else {
      setShowPaymentModal(false);
      setPaymentDone(false);
      setPhoneMenuOpen(false);
    }
  }, [activeStepIndex]);

  const handlePayConfirm = (method?: string) => {
    if (method) setSelectedPayMethod(method);
    setPaymentDone(true);
  };

  return (
    <div className={`relative ${isDesktop ? "max-w-[325px] xl:max-w-[345px]" : "max-w-[215px] sm:max-w-[230px]"} w-full aspect-[9/18.5] ${className}`}>
      
      {/* HARDWARE BUTTON: Action Switch (Left) */}
      <div 
        className={`absolute ${
          isDesktop ? "top-18 -left-[4px] w-[4px] h-6" : "top-14 -left-[3px] w-[3px] h-4"
        } bg-neutral-700 rounded-l-xs z-0 shadow-xs border-l border-neutral-600`} 
      />

      {/* HARDWARE BUTTON: Volume Up (Left) */}
      <div 
        className={`absolute ${
          isDesktop ? "top-28 -left-[4px] w-[4px] h-10" : "top-21 -left-[3px] w-[3px] h-7"
        } bg-neutral-700 rounded-l-xs z-0 shadow-xs border-l border-neutral-600`} 
      />

      {/* HARDWARE BUTTON: Volume Down (Left) */}
      <div 
        className={`absolute ${
          isDesktop ? "top-41 -left-[4px] w-[4px] h-10" : "top-30 -left-[3px] w-[3px] h-7"
        } bg-neutral-700 rounded-l-xs z-0 shadow-xs border-l border-neutral-600`} 
      />

      {/* HARDWARE BUTTON: Power / Side Button (Right) */}
      <div 
        className={`absolute ${
          isDesktop ? "top-26 -right-[4px] w-[4px] h-14" : "top-20 -right-[3px] w-[3px] h-10"
        } bg-neutral-700 rounded-r-xs z-0 shadow-xs border-r border-neutral-600`} 
      />

      {/* iPhone Main Chassis Frame */}
      <div
        className={`relative w-full h-full ${
          isDesktop
            ? "rounded-[38px] p-2"
            : "rounded-[30px] sm:rounded-[32px] p-1 sm:p-1.5"
        } bg-neutral-950 border-[2px] border-neutral-800 shadow-[0_22px_55px_rgba(0,0,0,0.35)] ring-1 ring-black/10 flex flex-col justify-between overflow-hidden z-10`}
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

          {/* App Header with Logo on Left (NO SMART POS on phone screen) & Table Number Card on Top Right */}
          <div className={`flex items-center justify-between ${isDesktop ? "pb-2" : "pb-1.5"} border-b border-neutral-200 shrink-0`}>
            {/* Logo Left */}
            <div className="flex items-center gap-1.5">
              <div className={`${isDesktop ? "w-6 h-6" : "w-5 h-5"} rounded-md bg-white p-0.5 border border-neutral-200 shadow-xs flex items-center justify-center shrink-0`}>
                <img src="/favicon.png" alt="Dine in One" className="w-full h-full object-contain" />
              </div>
              <div className={`${isDesktop ? "text-xs" : "text-[10.5px]"} font-bold leading-none text-neutral-900 flex items-center gap-0.5`}>
                <span>Dine</span>
                <span className="gradient-text-coral">in</span>
                <span>One</span>
              </div>
            </div>

            {/* Table Number Card on Top Right */}
            <div className="flex items-center gap-1">
              <div className={`px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-800 border border-neutral-300 ${isDesktop ? "text-[10px]" : "text-[8px]"} font-bold tracking-tight shadow-xs`}>
                Table 08
              </div>
              {/* Phone mini 3-lines menu with minimize capability */}
              <button
                onClick={() => setPhoneMenuOpen(!phoneMenuOpen)}
                className="p-1 rounded text-neutral-400 hover:text-neutral-700 transition-colors"
                aria-label="Toggle mobile menu"
              >
                {phoneMenuOpen ? <Minimize2 className="w-3 h-3 text-[#FF6B6B]" /> : <Menu className="w-3 h-3" />}
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
                  <span className="text-[9px] font-bold text-neutral-700">Quick Menu</span>
                  <button
                    onClick={() => setPhoneMenuOpen(false)}
                    className="inline-flex items-center gap-0.5 text-[8px] font-bold text-[#FF6B6B] bg-white px-1.5 py-0.5 rounded border border-neutral-200"
                  >
                    <Minimize2 className="w-2.5 h-2.5" />
                    Minimize
                  </button>
                </div>
                <div className="text-[8px] text-neutral-500 space-y-0.5">
                  <div>• Starters, Mains, Breads & Beverages</div>
                  <div>• Call Waiter Srinivas / Request Water</div>
                  <div>• Instant Bill & Settlement</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Screen Content Body */}
          <div className={`flex-1 py-1 flex flex-col justify-center relative overflow-hidden ${isDesktop ? "min-h-[305px]" : "min-h-[225px]"}`}>
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
                    <div className={`absolute top-1.5 left-1.5 ${isDesktop ? "w-3.5 h-3.5 border-t-2 border-l-2" : "w-2.5 h-2.5 border-t-2 border-l-2"} border-[#FF6B6B]`} />
                    <div className={`absolute top-1.5 right-1.5 ${isDesktop ? "w-3.5 h-3.5 border-t-2 border-r-2" : "w-2.5 h-2.5 border-t-2 border-r-2"} border-[#FF6B6B]`} />
                    <div className={`absolute bottom-1.5 left-1.5 ${isDesktop ? "w-3.5 h-3.5 border-b-2 border-l-2" : "w-2.5 h-2.5 border-b-2 border-l-2"} border-[#FF6B6B]`} />
                    <div className={`absolute bottom-1.5 right-1.5 ${isDesktop ? "w-3.5 h-3.5 border-b-2 border-r-2" : "w-2.5 h-2.5 border-b-2 border-r-2"} border-[#FF6B6B]`} />

                    <motion.div
                      animate={shouldReduceMotion ? {} : { y: isDesktop ? [-45, 45, -45] : [-34, 34, -34] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-[#FF6B6B] to-transparent shadow-[0_0_8px_#FF6B6B]"
                    />

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

              {/* STEP 1: ORDER */}
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
                      <span>Menu Selection</span>
                      <span className="text-purple-600 font-semibold">Cart (3 items)</span>
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

              {/* STEP 2: ORDER STATUS (Items ready one by one!) */}
              {activeStepIndex === 2 && (
                <motion.div
                  key="step-order-status"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col justify-between h-full py-0.5 text-left"
                >
                  {/* Renamed from KITCHEN to ORDER STATUS */}
                  <div className={`${isDesktop ? "p-2 mb-1.5 rounded-xl" : "p-1.5 mb-1 rounded-lg"} bg-orange-50 border border-orange-200`}>
                    <div className="flex items-center justify-between">
                      <div className={`inline-flex items-center gap-1 text-orange-600 ${isDesktop ? "text-[11px]" : "text-[9px]"} font-black uppercase tracking-wider`}>
                        <ClipboardList className="w-3.5 h-3.5" />
                        <span>ORDER STATUS</span>
                      </div>
                      <span className={`${isDesktop ? "text-[9px]" : "text-[7.5px]"} font-mono font-bold text-orange-600`}>
                        Ticket #108
                      </span>
                    </div>
                    <div className={`${isDesktop ? "text-sm mt-0.5" : "text-xs mt-0.5"} font-black text-neutral-900 tracking-tight`}>
                      {kitchenReadyCount === 3 ? "ALL ITEMS READY!" : "PREPARING DISHES..."}
                    </div>
                  </div>

                  {/* Vertical items becoming ready one by one */}
                  <div className={`${isDesktop ? "space-y-1.5" : "space-y-1"} my-auto`}>
                    <div className={`flex items-center justify-between ${isDesktop ? "text-[9px]" : "text-[7.5px]"} font-bold text-neutral-400 uppercase`}>
                      <span>Dishes Live Progress</span>
                      <span className="text-orange-600 font-semibold">{kitchenReadyCount}/3 Done</span>
                    </div>

                    {sampleFoodItems.map((item, idx) => {
                      const isReady = idx < kitchenReadyCount;
                      return (
                        <div
                          key={item.name}
                          className={`${isDesktop ? "p-1.5" : "p-1"} rounded-lg border transition-all duration-300 flex items-center justify-between gap-1.5 ${
                            isReady 
                              ? "bg-emerald-50/80 border-emerald-300 shadow-xs" 
                              : "bg-neutral-50 border-neutral-200/90"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <img
                              src={item.image}
                              alt={item.name}
                              className={`${isDesktop ? "w-7 h-7 rounded-md" : "w-6 h-6 rounded"} object-cover border border-neutral-200 shrink-0`}
                            />
                            <div className="min-w-0">
                              <div className={`${isDesktop ? "text-[11px]" : "text-[9px]"} font-bold text-neutral-900 truncate`}>
                                {item.name} <span className="text-orange-600 font-bold">×{item.qty}</span>
                              </div>
                              <div className={`${isDesktop ? "text-[8px]" : "text-[7px]"} text-neutral-500 font-medium`}>
                                Station {idx + 1}
                              </div>
                            </div>
                          </div>
                          <div className="shrink-0">
                            {isReady ? (
                              <motion.span 
                                initial={{ scale: 0.6, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className={`inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 ${isDesktop ? "text-[8px]" : "text-[7px]"} font-bold`}
                              >
                                <Check className="w-2.5 h-2.5 mr-0.5 stroke-[3] text-emerald-600" />
                                Ready
                              </motion.span>
                            ) : (
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 ${isDesktop ? "text-[8px]" : "text-[7px]"} font-bold`}>
                                <Flame className="w-2.5 h-2.5 mr-0.5 text-orange-600 animate-pulse" />
                                Cooking
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Progress Indicator */}
                  <div className={`${isDesktop ? "mt-1.5 pt-1.5" : "mt-1 pt-1"} border-t border-neutral-200`}>
                    <div className={`${isDesktop ? "h-1.5" : "h-1"} w-full bg-neutral-100 rounded-full overflow-hidden`}>
                      <motion.div
                        animate={{ width: `${(kitchenReadyCount / 3) * 100}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="h-full bg-orange-500 rounded-full"
                      />
                    </div>
                    <div className={`flex items-center justify-between ${isDesktop ? "text-[9px] mt-1" : "text-[7.5px] mt-0.5"} text-neutral-500`}>
                      <span>Kitchen Live Station</span>
                      <span className="font-mono font-bold text-orange-600">{kitchenReadyCount * 33}% Completed</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: READY (Vertical ordered items & "Srinivas Picked your order") */}
              {activeStepIndex === 3 && (
                <motion.div
                  key="step-ready"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col justify-between h-full py-0.5 text-left"
                >
                  {/* Status header banner */}
                  <div className="text-center pb-1">
                    <div className={`${isDesktop ? "text-xs" : "text-[10.5px]"} font-black text-neutral-900 leading-tight`}>
                      Order is ready waiter is on the way
                    </div>
                    <div className={`${isDesktop ? "text-[8.5px]" : "text-[7px]"} text-emerald-600 font-bold mt-0.5`}>
                      Plated hot on kitchen counter
                    </div>
                  </div>

                  {/* All ordered items shown vertically top-to-bottom */}
                  <div className={`${isDesktop ? "space-y-1.5" : "space-y-1"} my-auto`}>
                    <div className={`flex items-center justify-between ${isDesktop ? "text-[9px]" : "text-[7.5px]"} font-bold text-neutral-400 uppercase`}>
                      <span>Ready Dishes (3)</span>
                      <span className="text-emerald-600 font-bold">Hot Plate ✓</span>
                    </div>

                    {sampleFoodItems.map((item) => (
                      <div
                        key={item.name}
                        className={`${isDesktop ? "p-1.5" : "p-1"} rounded-lg bg-emerald-50/50 border border-emerald-200/90 flex items-center justify-between gap-1.5`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <img
                            src={item.image}
                            alt={item.name}
                            className={`${isDesktop ? "w-7 h-7 rounded-md" : "w-6 h-6 rounded"} object-cover border border-emerald-300 shrink-0`}
                          />
                          <span className={`${isDesktop ? "text-[11px]" : "text-[9px]"} font-bold text-neutral-900 truncate`}>
                            {item.name} <span className="text-emerald-700">×{item.qty}</span>
                          </span>
                        </div>
                        <span className={`inline-flex items-center px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 ${isDesktop ? "text-[8px]" : "text-[7px]"} font-black`}>
                          Ready ✓
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Waiter Srinivas Notification Card with Animated Waiter Tray */}
                  <div className={`${isDesktop ? "p-2" : "p-1.5"} rounded-xl bg-sky-50 border border-sky-200 flex items-center gap-2 mt-1 shadow-xs`}>
                    <div className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center shrink-0 border border-sky-300">
                      <motion.div
                        animate={{ y: [0, -2, 0] }}
                        transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                      >
                        <Utensils className="w-3.5 h-3.5 text-[#0284C7]" />
                      </motion.div>
                    </div>
                    <div className="leading-tight">
                      <div className={`${isDesktop ? "text-[10px]" : "text-[8.5px]"} font-black text-neutral-900`}>
                        Srinivas Picked your order
                      </div>
                      <div className={`${isDesktop ? "text-[8.5px]" : "text-[7px]"} text-neutral-500 font-medium`}>
                        Waiter Srinivas is serving Table 08 now.
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 4: SERVED ("Enjoy you meal" with Lottie Animation) */}
              {activeStepIndex === 4 && (
                <motion.div
                  key="step-served"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col justify-center h-full text-center py-1 my-auto"
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

                  {/* Clean text: "Enjoy you meal" */}
                  <p className={`${isDesktop ? "text-sm my-1" : "text-xs my-0.5"} font-black text-emerald-600 leading-tight`}>
                    Enjoy you meal
                  </p>

                  <div className={`inline-flex items-center justify-center gap-1 ${isDesktop ? "px-2.5 py-0.5 text-[9px]" : "px-2 py-0.2 text-[7.5px]"} rounded-full bg-neutral-100 font-mono font-bold text-neutral-600 mx-auto mt-1`}>
                    <span>Table 08 Completed</span>
                  </div>
                </motion.div>
              )}

              {/* STEP 5: ADD MORE ITEMS */}
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
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`${isDesktop ? "text-[10px]" : "text-[8.5px]"} font-black text-cyan-600 uppercase tracking-wider flex items-center gap-1`}>
                        <PlusCircle className="w-3 h-3 text-cyan-600" />
                        Add More Items
                      </span>
                      <span className={`px-1.5 py-0.2 rounded bg-cyan-50 border border-cyan-200 text-cyan-700 ${isDesktop ? "text-[9px]" : "text-[7.5px]"} font-bold`}>
                        Table 08
                      </span>
                    </div>

                    {/* Newly added items with actual food photos */}
                    <div className={`${isDesktop ? "space-y-1.5" : "space-y-1"}`}>
                      {addedFoodItems.map((item) => (
                        <div
                          key={item.name}
                          className={`${isDesktop ? "p-1.5" : "p-1"} rounded-lg bg-cyan-50/60 border border-cyan-200 flex items-center justify-between gap-1.5`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <img
                              src={item.image}
                              alt={item.name}
                              className={`${isDesktop ? "w-8 h-8 rounded-md" : "w-6 h-6 rounded"} object-cover border border-cyan-200 shrink-0`}
                            />
                            <div className="min-w-0">
                              <div className={`${isDesktop ? "text-[11px]" : "text-[9px]"} font-bold text-neutral-900 truncate`}>
                                {item.name}
                              </div>
                              <div className={`${isDesktop ? "text-[8px]" : "text-[7px]"} text-cyan-700 font-medium`}>
                                +{item.qty} Added
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono font-bold text-neutral-900 text-[10px]">₹{item.price}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Total of newly added items */}
                    <div className={`mt-2 p-1.5 rounded-lg bg-neutral-50 border border-neutral-200 flex items-center justify-between ${isDesktop ? "text-xs" : "text-[9px]"}`}>
                      <span className="font-semibold text-neutral-600">Total Newly Added:</span>
                      <span className="font-mono font-black text-cyan-700">₹140.00</span>
                    </div>
                  </div>

                  {/* Renamed button to "Add items" */}
                  <div className={`${isDesktop ? "py-2" : "py-1.5"} w-full rounded-lg bg-cyan-500 text-white font-bold text-center text-xs shadow-xs cursor-pointer active:scale-95 transition-all`}>
                    Add items ✓
                  </div>
                </motion.div>
              )}

              {/* STEP 6: BILL (Taller bill, Coupon option, Payment Done screen with Lottie) */}
              {activeStepIndex === 6 && (
                <motion.div
                  key="step-bill"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col justify-between h-full py-0.5 relative text-left"
                >
                  {!paymentDone ? (
                    <>
                      {/* Increased Height Authentic Restaurant Thermal Bill */}
                      <div className={`${isDesktop ? "p-2.5" : "p-2"} bg-amber-50/40 rounded-xl border-2 border-dashed border-neutral-300 font-mono relative overflow-hidden shadow-xs flex-1 flex flex-col justify-between`}>
                        {/* Bill Header */}
                        <div className="text-center pb-1 border-b border-dashed border-neutral-300">
                          <div className={`${isDesktop ? "text-xs" : "text-[9.5px]"} font-black text-neutral-900 tracking-wider uppercase`}>
                            DINE IN ONE BISTRO
                          </div>
                          <div className={`${isDesktop ? "text-[8.5px]" : "text-[7px]"} text-neutral-500`}>
                            Table 08 • Bill #DIO-108 • 08 Oct
                          </div>
                        </div>

                        {/* Bill Items List */}
                        <div className={`${isDesktop ? "text-[9.5px] space-y-1 my-1" : "text-[7.5px] space-y-0.5 my-0.5"} text-neutral-700`}>
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
                            <span>1x Gulab Jamun & Naan</span>
                            <span>₹60.00</span>
                          </div>
                        </div>

                        {/* Coupon Option Label with Button */}
                        <div className="flex items-center justify-between p-1 rounded-md bg-white border border-dashed border-indigo-200 my-1">
                          <div className="flex items-center gap-1 min-w-0">
                            <Tag className="w-3 h-3 text-indigo-600 shrink-0" />
                            <span className={`${isDesktop ? "text-[8.5px]" : "text-[7px]"} font-bold text-neutral-700 truncate`}>
                              Add Coupon: <span className="text-indigo-600">DINE10</span>
                            </span>
                          </div>
                          <button className={`px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 ${isDesktop ? "text-[8px]" : "text-[6.5px]"} font-black border border-indigo-200`}>
                            Apply
                          </button>
                        </div>

                        {/* Taxes and Exact Grand Total */}
                        <div className={`pt-1 border-t border-dashed border-neutral-300 ${isDesktop ? "text-[9px]" : "text-[7px]"} text-neutral-600`}>
                          <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>₹740.00</span>
                          </div>
                          <div className="flex justify-between">
                            <span>CGST + SGST (5%)</span>
                            <span>₹37.00</span>
                          </div>
                          <div className={`flex justify-between font-black text-neutral-900 pt-0.5 mt-0.5 border-t border-neutral-300 ${isDesktop ? "text-xs" : "text-[9.5px]"}`}>
                            <span>GRAND TOTAL</span>
                            <span className="text-[#6366F1]">₹777.00</span>
                          </div>
                        </div>
                      </div>

                      {/* Pay Button */}
                      <button
                        onClick={() => setShowPaymentModal(true)}
                        className={`w-full ${isDesktop ? "py-2 text-xs" : "py-1.5 text-[9.5px]"} mt-1.5 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] text-white font-black text-center shadow-xs flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer`}
                      >
                        <span>Click to Pay ₹777.00 →</span>
                      </button>
                    </>
                  ) : (
                    /* SUCCESS SCREEN: Payment done with green style & "Thank you for dining with us!" with Lottie animation above text */
                    <motion.div
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", damping: 16, stiffness: 240 }}
                      className="flex flex-col items-center justify-center h-full text-center py-1 my-auto"
                    >
                      {/* Lottie Animation above text */}
                      <div className={`${isDesktop ? "w-28 h-28" : "w-20 h-20"} mx-auto flex items-center justify-center`}>
                        <LottiePlayer
                          animationPath="/animations/one-click-order.json"
                          loop={true}
                          autoplay={true}
                          className="w-full h-full"
                        />
                      </div>

                      {/* "Payment done" in green style */}
                      <div className={`${isDesktop ? "text-lg" : "text-sm"} font-black text-emerald-600 mt-1 flex items-center justify-center gap-1`}>
                        <Check className="w-4 h-4 stroke-[3.5]" />
                        <span>Payment Done</span>
                      </div>

                      {/* "Thank you for dining with us!" */}
                      <p className={`${isDesktop ? "text-xs my-1" : "text-[9.5px] my-0.5"} font-bold text-neutral-700`}>
                        Thank you for dining with us!
                      </p>

                      <div className={`inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 ${isDesktop ? "text-[9px]" : "text-[7.5px]"} font-bold`}>
                        Table 08 • Settled via {selectedPayMethod}
                      </div>
                    </motion.div>
                  )}

                  {/* Payment Mode Popup Modal */}
                  <AnimatePresence>
                    {showPaymentModal && !paymentDone && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 15 }}
                        transition={{ type: "spring", damping: 18, stiffness: 260 }}
                        className="absolute inset-0 bg-white/95 backdrop-blur-xs rounded-2xl p-2.5 z-30 flex flex-col justify-between border border-neutral-200 shadow-xl"
                      >
                        <div className="flex items-center justify-between pb-1 border-b border-neutral-200">
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[#6366F1] animate-ping" />
                            <span className={`${isDesktop ? "text-xs" : "text-[10px]"} font-black text-neutral-900`}>
                              Select Payment Mode
                            </span>
                          </div>
                          <button
                            onClick={() => setShowPaymentModal(false)}
                            className="p-0.5 text-neutral-400 hover:text-neutral-700"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Payment Total */}
                        <div className="text-center py-1 bg-neutral-50 rounded-lg border border-neutral-200">
                          <div className={`${isDesktop ? "text-[9px]" : "text-[7.5px]"} text-neutral-500`}>
                            Grand Total
                          </div>
                          <div className={`${isDesktop ? "text-base" : "text-xs"} font-black text-[#6366F1] font-mono`}>
                            ₹777.00
                          </div>
                        </div>

                        {/* Interactive Cash, Card, UPI Buttons with random selection */}
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
                            {selectedPayMethod === "UPI" && <Check className="w-3 h-3 text-emerald-600" />}
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
                              <span>Card (Debit / Credit POS)</span>
                            </div>
                            {selectedPayMethod === "Card" && <Check className="w-3 h-3 text-blue-600" />}
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
                            {selectedPayMethod === "Cash" && <Check className="w-3 h-3 text-amber-600" />}
                          </button>
                        </div>

                        {/* Confirm Pay Button */}
                        <button
                          onClick={() => handlePayConfirm()}
                          className={`w-full ${isDesktop ? "py-1.5 text-xs" : "py-1 text-[9px]"} rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-center shadow-xs cursor-pointer active:scale-95 transition-all`}
                        >
                          Pay ₹777.00 ({selectedPayMethod}) ✓
                        </button>
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
          
          {/* LEFT COLUMN: Animated Headline, Operational Pipeline, CTAs */}
          <div className="lg:col-span-7 flex flex-col justify-center text-left">
            
            {/* Main Headline with Dynamic Word Cycling */}
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

          {/* RIGHT COLUMN: Realistic Restaurant Mobile Phone */}
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
        {/* Buttons span from exact top to exact bottom of mobile!    */}
        {/* All buttons have increased height & are fully clickable!  */}
        {/* ========================================================= */}
        <div className="block lg:hidden w-full">
          {/* Mobile Animated Headline with Dynamic Word Cycling */}
          <ContinuousLottieHeadline
            isDesktop={false}
            shouldReduceMotion={shouldReduceMotion}
          />

          {/* Mobile Auto Mode Toggle Bar */}
          <div className="flex items-center justify-between px-1 mb-2 max-w-[440px] mx-auto">
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
              Operational Flow
            </span>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold transition-all cursor-pointer shadow-xs active:scale-95 ${
                isPlaying
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                  : "bg-neutral-100 border-neutral-300 text-neutral-600"
              }`}
            >
              {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span>Auto Mode: {isPlaying ? "ON" : "OFF"}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? "bg-emerald-500 animate-pulse" : "bg-neutral-400"}`} />
            </button>
          </div>

          {/* 
            MOBILE ALIGNMENT: 
            items-stretch ensures the Right column height matches the Phone Mockup height exactly!
            The 1st button aligns flush with the top of the mobile, and the 7th button aligns flush with the bottom of the mobile!
          */}
          <div className="w-full flex items-stretch justify-between gap-2 sm:gap-3 my-2 max-w-[450px] mx-auto">
            
            {/* LEFT SECTION: iPhone Mockup */}
            <div className="w-[60%] sm:w-[62%] flex justify-end items-center pr-0.5">
              <HeroPhoneMockup
                activeStepIndex={activeStepIndex}
                shouldReduceMotion={shouldReduceMotion}
                isDesktop={false}
              />
            </div>

            {/* RIGHT SECTION: 7 Buttons stretched from top to bottom perfectly */}
            <div 
              className="w-[40%] sm:w-[38%] flex flex-col justify-between gap-1.5 pointer-events-auto"
              aria-label="Workflow step buttons"
            >
              {buttonThemes.map((btn, idx) => {
                const isActive = idx === activeStepIndex;
                const isCompleted = idx < activeStepIndex;

                return (
                  <button
                    key={btn.id}
                    onClick={() => handleStepClick(idx)}
                    className={`relative flex-1 flex flex-col justify-center px-2 py-2 sm:px-2.5 sm:py-2.5 rounded-xl border text-left transition-all overflow-hidden cursor-pointer active:scale-95 ${
                      isActive
                        ? "border-transparent text-white shadow-sm"
                        : isCompleted
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-medium"
                        : "bg-neutral-50 text-neutral-700 border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    {/* Smooth Spring Travel Indicator */}
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
                      <btn.icon className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                        isActive ? "text-white" : isCompleted ? "text-emerald-600" : "text-neutral-500"
                      }`} />
                      <span className={`text-[10px] sm:text-[11px] font-bold leading-tight truncate transition-colors ${
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
