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
  Sparkles, 
  ArrowRight, 
  Clock, 
  Bell, 
  RotateCcw, 
  Play, 
  Pause,
  Smartphone,
  Receipt,
  Store,
  Check
} from "lucide-react";

const heroWords = [
  { text: "The", highlight: false },
  { text: "smartest", highlight: true },
  { text: "decision", highlight: true },
  { text: "for", highlight: false },
  { text: "your", highlight: false },
  { text: "restaurant", highlight: false },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.05,
    },
  },
};

const wordVariants = {
  hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

interface PipelineStep {
  step: number;
  id: "scan_qr" | "order" | "kitchen" | "ready" | "served";
  name: string;
  icon: React.ElementType;
  description: string;
  message: string;
}

const pipelineSteps: PipelineStep[] = [
  {
    step: 1,
    id: "scan_qr",
    name: "Scan QR",
    icon: QrCode,
    description: "Customer scans the QR code placed on the restaurant table using their mobile phone.",
    message: "Customer at TABLE 08 is scanning the table QR.",
  },
  {
    step: 2,
    id: "order",
    name: "Order",
    icon: ShoppingBag,
    description: "Customer views the menu, selects items, adds notes and places the order.",
    message: "Customer at TABLE 08 is placing an order.",
  },
  {
    step: 3,
    id: "kitchen",
    name: "Kitchen",
    icon: ChefHat,
    description: "The kitchen receives the order instantly through the KDS.",
    message: "Order received by the kitchen.",
  },
  {
    step: 4,
    id: "ready",
    name: "Ready",
    icon: CheckCircle2,
    description: "Kitchen marks the order as ready and the waiter is notified.",
    message: "Paneer Tikka is ready for pickup.",
  },
  {
    step: 5,
    id: "served",
    name: "Served",
    icon: Utensils,
    description: "Waiter serves the table and the order becomes completed.",
    message: "Order served — TABLE 08 completed.",
  },
];

const orderStatusStates = ["Ordered", "Kitchen", "Ready", "Waiter", "Served"];

const mobileWorkflowButtons = [
  { id: "scan_qr", label: "1. Scan QR", icon: QrCode },
  { id: "order", label: "2. Order", icon: ShoppingBag },
  { id: "kitchen", label: "3. Kitchen", icon: ChefHat },
  { id: "ready", label: "4. Ready", icon: CheckCircle2 },
  { id: "served", label: "5. Served", icon: Utensils },
];

const stepDurations = [3500, 4200, 4200, 3500, 4200];

const HeroSection: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto progression sequential loop
  useEffect(() => {
    if (!isPlaying || shouldReduceMotion) return;

    const duration = stepDurations[activeStepIndex] || 3800;
    timerRef.current = setTimeout(() => {
      setActiveStepIndex((prev) => (prev + 1) % pipelineSteps.length);
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeStepIndex, isPlaying, shouldReduceMotion]);

  const handleStepClick = (index: number) => {
    setActiveStepIndex(index);
    setIsManualOverride(true);
    // Resume auto-play after 6 seconds of user inactivity
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsManualOverride(false);
    }, 6000);
  };

  const handleRestartFlow = () => {
    setActiveStepIndex(0);
    setIsPlaying(true);
    setIsManualOverride(false);
  };

  const handleScanQRTrigger = () => {
    setActiveStepIndex(0);
    setIsManualOverride(true);
  };

  const handlePlaceOrder = () => {
    setActiveStepIndex(2); // Jump to kitchen received
    setIsPlaying(true);
    setIsManualOverride(false);
  };

  const currentStep = pipelineSteps[activeStepIndex];

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
        {/* DESKTOP HERO VIEW (Preserved exactly as-is for lg+ screens) */}
        {/* ========================================================= */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          
          {/* ========================================================= */}
          {/* LEFT COLUMN: Headline, Concept, Operational Pipeline, CTAs */}
          {/* ========================================================= */}
          <div className="lg:col-span-7 flex flex-col justify-center text-left">
            
            {/* Live Restaurant Operations Badge */}
            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold tracking-wider uppercase mb-5 self-start shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>LIVE RESTAURANT OPERATIONS</span>
              <span className="text-neutral-400 dark:text-neutral-500 font-mono text-[11px] font-medium border-l border-emerald-500/30 pl-2">
                ORDER #DIO-108
              </span>
            </div>

            {/* Main Headline with Staggered Word Reveal */}
            <motion.h1
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="text-3xl sm:text-4xl md:text-5xl lg:text-[2.75rem] font-extrabold leading-[1.15] tracking-tight mb-4 text-foreground"
            >
              {heroWords.map((item, idx) => (
                <motion.span
                  key={idx}
                  variants={wordVariants}
                  className={`inline-block mr-[0.24em] ${
                    item.highlight
                      ? "gradient-text-coral drop-shadow-xs"
                      : "text-foreground"
                  }`}
                >
                  {item.text}
                </motion.span>
              ))}
            </motion.h1>

            {/* Section Concept & Supporting Text */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2 tracking-tight">
                One order. Every operation.
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl mb-6 font-medium">
                Dine in One connects the customer, waiter, kitchen and restaurant admin in one real-time operational pipeline — starting with a simple table QR scan.
              </p>
            </motion.div>

            {/* ========================================================= */}
            {/* OPERATIONAL PIPELINE (Interactive 5-Step Continuous Flow) */}
            {/* ========================================================= */}
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

              {/* 5-Step Pipeline Steps Grid / Rail */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5">
                {pipelineSteps.map((item, idx) => {
                  const Icon = item.icon;
                  const isActive = idx === activeStepIndex;
                  const isCompleted = idx < activeStepIndex;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleStepClick(idx)}
                      className={`relative flex flex-col items-start p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                        isActive
                          ? "bg-primary/5 dark:bg-primary/10 border-primary/50 shadow-sm ring-1 ring-primary/30"
                          : isCompleted
                          ? "bg-muted/40 border-border/80 hover:border-border text-foreground"
                          : "bg-card/40 border-border/40 hover:border-border text-muted-foreground"
                      }`}
                    >
                      {/* Step Number + Icon */}
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                          isActive 
                            ? "bg-primary text-white" 
                            : isCompleted 
                            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                            : "bg-muted text-muted-foreground"
                        }`}>
                          0{item.step}
                        </span>
                        <Icon className={`w-4 h-4 ${
                          isActive 
                            ? "text-primary" 
                            : isCompleted 
                            ? "text-emerald-500" 
                            : "text-muted-foreground"
                        }`} />
                      </div>

                      <div className={`text-xs font-bold leading-tight ${isActive ? "text-foreground" : "text-foreground/90"}`}>
                        {item.name}
                      </div>

                      {/* Active Progress Bar Underneath */}
                      {isActive && (
                        <motion.div 
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-b-xl"
                          layoutId="activePipelineBar"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Live Operational Message Banner */}
              <div className="mt-3 p-3 rounded-xl border border-border/80 bg-neutral-50/80 dark:bg-neutral-900/60 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse" />
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
              <button
                onClick={handleScanQRTrigger}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg border border-border/60 hover:border-border transition-colors cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5 text-primary" />
                Scan table QR
              </button>
            </div>

          </div>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: Realistic Restaurant Customer Mobile Phone  */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 flex justify-center items-center">
            
            {/* Phone Exterior Frame */}
            <div className="relative w-full max-w-[340px] sm:max-w-[360px] rounded-[44px] p-3 bg-neutral-950 border-[5px] border-neutral-800 shadow-[0_20px_50px_rgba(0,0,0,0.35)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.8)] ring-1 ring-white/10">
              
              {/* Dynamic Island Pill / Camera */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-4 bg-neutral-900 rounded-full z-30 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-neutral-800 border border-neutral-700/60 ml-12" />
              </div>

              {/* Phone Inner Screen Screen */}
              <div className="relative rounded-[36px] bg-white dark:bg-neutral-900 overflow-hidden border border-neutral-200/80 dark:border-neutral-800 flex flex-col justify-between min-h-[550px] sm:min-h-[580px] p-4 pt-6 text-foreground select-none">
                
                {/* Status Bar */}
                <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 mb-3 px-1">
                  <span>9:41</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-mono">5G</span>
                    <span className="text-[10px]">100%</span>
                  </div>
                </div>

                {/* App Header */}
                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-xs">
                      D1
                    </div>
                    <div>
                      <div className="text-xs font-bold leading-none text-foreground">Dine in One</div>
                      <div className="text-[10px] text-muted-foreground font-medium">Table Ordering</div>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-[11px] font-black tracking-wide">
                    TABLE 08
                  </div>
                </div>

                {/* Screen Content Body: Switchable based on active operational state */}
                <div className="flex-1 py-3 flex flex-col justify-center">
                  
                  {/* STATE 1: SCAN QR (Camera Viewfinder with animated laser line) */}
                  {activeStepIndex === 0 && (
                    <motion.div
                      key="scan"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                      className="flex flex-col items-center justify-center text-center py-2"
                    >
                      <div className="relative w-44 h-44 rounded-2xl bg-neutral-950 border-2 border-primary/40 flex items-center justify-center overflow-hidden mb-3 shadow-inner">
                        {/* Viewfinder Target Brackets */}
                        <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-primary" />
                        <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-primary" />
                        <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-primary" />
                        <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-primary" />

                        {/* Animated Laser Scanning Line */}
                        <motion.div
                          animate={shouldReduceMotion ? {} : { y: [-65, 65, -65] }}
                          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                          className="absolute left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-[#FF6B6B] to-transparent shadow-[0_0_8px_#FF6B6B]"
                        />

                        {/* QR Code Graphics Simulation */}
                        <div className="p-3 bg-white rounded-xl shadow-md">
                          <QrCode className="w-24 h-24 text-neutral-900" />
                        </div>
                      </div>

                      <div className="text-xs font-bold text-foreground mb-1">
                        Scanning Table QR Code
                      </div>
                      <p className="text-[11px] text-muted-foreground max-w-[240px] leading-tight mb-3">
                        Scan the table QR to order without waiting for a waiter.
                      </p>

                      <button
                        onClick={() => setActiveStepIndex(1)}
                        className="btn-primary text-xs !py-2 !px-4 shadow-sm cursor-pointer"
                      >
                        Open Menu (Table 08) →
                      </button>
                    </motion.div>
                  )}

                  {/* STATE 2: ORDER CART (Exact specification content: TABLE 08, Paneer Tikka, Garlic Naan, Lassi, Special Note, ₹680) */}
                  {activeStepIndex === 1 && (
                    <motion.div
                      key="order"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="flex flex-col justify-between h-full"
                    >
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                          <span>Your Selection</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Dine-in</span>
                        </div>

                        {/* Order Items List */}
                        <div className="space-y-2 mb-2">
                          <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-border/60 text-xs">
                            <div className="font-semibold text-foreground">
                              Paneer Tikka <span className="text-muted-foreground font-normal">×2</span>
                            </div>
                            <div className="font-mono font-bold text-foreground">₹360</div>
                          </div>

                          <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-border/60 text-xs">
                            <div className="font-semibold text-foreground">
                              Garlic Naan <span className="text-muted-foreground font-normal">×1</span>
                            </div>
                            <div className="font-mono font-bold text-foreground">₹80</div>
                          </div>

                          <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-border/60 text-xs">
                            <div className="font-semibold text-foreground">
                              Lassi <span className="text-muted-foreground font-normal">×2</span>
                            </div>
                            <div className="font-mono font-bold text-foreground">₹240</div>
                          </div>
                        </div>

                        {/* Special Note Box */}
                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-1.5 font-medium">
                          <span className="font-bold">Special note:</span> Less spicy
                        </div>
                      </div>

                      {/* Total & Place Order Button */}
                      <div className="pt-2 border-t border-border/60">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-muted-foreground font-medium">Total Amount</span>
                          <span className="text-base font-black font-mono text-foreground">₹680</span>
                        </div>
                        <button
                          onClick={handlePlaceOrder}
                          className="w-full btn-primary text-xs !py-2.5 font-bold justify-center shadow-md active:scale-95 transition-transform cursor-pointer"
                        >
                          Place Order (TABLE 08)
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* STATE 3: KITCHEN KDS (Order dispatched to kitchen display) */}
                  {activeStepIndex === 2 && (
                    <motion.div
                      key="kitchen"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      className="flex flex-col justify-between h-full py-2"
                    >
                      <div>
                        <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-center mb-3">
                          <div className="inline-flex items-center gap-1.5 text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-wider mb-1">
                            <ChefHat className="w-4 h-4 animate-bounce" />
                            <span>Kitchen Station (KDS)</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Order #DIO-108 received instantly on the kitchen screen.
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg border border-border/60 bg-card text-xs space-y-1.5 font-mono">
                          <div className="flex justify-between font-bold text-foreground">
                            <span>Ticket #108</span>
                            <span className="text-orange-500">Preparing • 04:12</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground border-t border-border/40 pt-1">
                            • 2× Paneer Tikka (Less spicy)<br />
                            • 1× Garlic Naan<br />
                            • 2× Lassi
                          </div>
                        </div>
                      </div>

                      <div className="text-center text-[11px] text-muted-foreground">
                        Live kitchen display timer running
                      </div>
                    </motion.div>
                  )}

                  {/* STATE 4: READY (Kitchen marks ready, waiter notified) */}
                  {activeStepIndex === 3 && (
                    <motion.div
                      key="ready"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      className="flex flex-col justify-between h-full py-2"
                    >
                      <div>
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center mb-3">
                          <div className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Ready For Pickup</span>
                          </div>
                          <div className="text-xs text-foreground font-semibold">
                            Paneer Tikka & items ready on hot plate!
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg border border-border/60 bg-card text-xs flex items-center gap-2">
                          <Bell className="w-4 h-4 text-primary shrink-0 animate-pulse" />
                          <div className="text-[11px] text-foreground">
                            <span className="font-bold">Waiter Captain Notified:</span> Pick up hot dishes for Table 08.
                          </div>
                        </div>
                      </div>

                      <div className="text-center text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        ✓ Notification dispatched to waiter app
                      </div>
                    </motion.div>
                  )}

                  {/* STATE 5: SERVED (Waiter serves, order completed) */}
                  {activeStepIndex === 4 && (
                    <motion.div
                      key="served"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      className="flex flex-col justify-between h-full py-2 text-center"
                    >
                      <div className="my-auto">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-3">
                          <Utensils className="w-6 h-6" />
                        </div>
                        <div className="text-sm font-black text-foreground mb-1">
                          Order Served!
                        </div>
                        <p className="text-xs text-muted-foreground mb-3 max-w-[220px] mx-auto">
                          Waiter served Table 08. Dishes enjoyed by customer.
                        </p>
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] font-mono font-bold text-foreground">
                          Total: ₹680 • GST Paid
                        </div>
                      </div>

                      <button
                        onClick={handleRestartFlow}
                        className="btn-outline text-xs !py-2 !px-3 mx-auto flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Restart Simulation
                      </button>
                    </motion.div>
                  )}

                </div>

                {/* Live Order Status Progression Bar (At bottom of phone UI) */}
                <div className="pt-2.5 border-t border-border/60">
                  <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase mb-1.5">
                    <span>ORDER #DIO-108</span>
                    <span className="text-primary font-mono">{orderStatusStates[activeStepIndex]}</span>
                  </div>
                  
                  {/* Progress Line with State Dots */}
                  <div className="grid grid-cols-5 gap-1">
                    {orderStatusStates.map((stateName, sIdx) => {
                      const isPastOrActive = sIdx <= activeStepIndex;
                      const isCurrent = sIdx === activeStepIndex;

                      return (
                        <div key={stateName} className="flex flex-col items-center">
                          <div className={`h-1.5 w-full rounded-full transition-colors duration-300 ${
                            isCurrent
                              ? "bg-primary"
                              : isPastOrActive
                              ? "bg-emerald-500"
                              : "bg-muted"
                          }`} />
                          <span className={`text-[8px] font-medium tracking-tight mt-1 truncate ${
                            isCurrent 
                              ? "text-primary font-bold" 
                              : isPastOrActive 
                              ? "text-foreground" 
                              : "text-muted-foreground/60"
                          }`}>
                            {stateName}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>

          </div>

        </div>

        {/* ========================================================= */}
        {/* MOBILE HERO VIEW (Dedicated mobile responsive layout)     */}
        {/* 70% Animation area (iPhone) + 30% Workflow controls       */}
        {/* ========================================================= */}
        <div className="block lg:hidden w-full">
          {/* Mobile Header: Live Badge & Staggered Word Headline */}
          <div className="flex flex-col items-start text-left mb-4">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold tracking-wider uppercase mb-2.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>LIVE RESTAURANT OPERATIONS</span>
              <span className="text-neutral-400 dark:text-neutral-500 font-mono text-[9px] border-l border-emerald-500/30 pl-1.5">
                #DIO-108
              </span>
            </div>

            <motion.h1
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="text-2xl sm:text-3xl font-extrabold leading-[1.2] tracking-tight mb-2 text-foreground"
            >
              {heroWords.map((item, idx) => (
                <motion.span
                  key={idx}
                  variants={wordVariants}
                  className={`inline-block mr-[0.2em] ${
                    item.highlight
                      ? "gradient-text-coral drop-shadow-xs"
                      : "text-foreground"
                  }`}
                >
                  {item.text}
                </motion.span>
              ))}
            </motion.h1>

            <h2 className="text-sm sm:text-base font-bold text-foreground mb-1">
              One order. Every operation.
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Watch how Dine in One connects tables, floor staff, and kitchen in real time.
            </p>
          </div>

          {/* ========================================================= */}
          {/* MOBILE 70/30 SPLIT WORKFLOW DEMO                          */}
          {/* Left (70%): Realistic iPhone Mockup                       */}
          {/* Right (30%): 5 Vertically Stacked Workflow Controls       */}
          {/* ========================================================= */}
          <div className="w-full flex items-center justify-between gap-2.5 sm:gap-4 my-3 max-w-[440px] mx-auto">
            
            {/* LEFT SECTION (70%): Realistic iPhone Mockup */}
            <div className="w-[68%] sm:w-[70%] flex justify-start items-center">
              <div className="relative w-full max-w-[215px] sm:max-w-[230px] aspect-[9/18.5] rounded-[34px] sm:rounded-[38px] p-2 sm:p-2.5 bg-neutral-950 border-[3.5px] border-neutral-800 shadow-[0_16px_40px_rgba(0,0,0,0.4)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.7)] ring-1 ring-white/10 flex flex-col justify-between overflow-hidden">
                
                {/* Dynamic Island Pill */}
                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-16 h-3 bg-neutral-900 rounded-full z-30 flex items-center justify-end pr-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-800 border border-neutral-700/80" />
                </div>

                {/* iPhone Inner Screen */}
                <div className="relative rounded-[26px] sm:rounded-[28px] bg-white dark:bg-neutral-900 overflow-hidden border border-neutral-200/80 dark:border-neutral-800/80 flex flex-col justify-between h-full pt-3.5 pb-2 px-2.5 text-foreground select-none">
                  
                  {/* Status Bar */}
                  <div className="flex items-center justify-between text-[9px] font-semibold text-neutral-400 mb-1 px-0.5 shrink-0">
                    <span>9:41</span>
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[8px] font-mono">5G</span>
                      <span className="text-[8px]">100%</span>
                    </div>
                  </div>

                  {/* App Header */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-border/50 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-md bg-[#FF6B6B]/15 flex items-center justify-center text-[#FF6B6B] font-black text-[9px]">
                        D1
                      </div>
                      <div>
                        <div className="text-[10px] font-bold leading-none text-foreground">Dine in One</div>
                        <div className="text-[8px] text-muted-foreground">Live Flow</div>
                      </div>
                    </div>
                    <div className="px-1.5 py-0.5 rounded-full bg-[#FF6B6B]/10 text-[#FF6B6B] border border-[#FF6B6B]/20 text-[9px] font-black">
                      TABLE 08
                    </div>
                  </div>

                  {/* Screen Content Body: 5 Sequential Storytelling Animations */}
                  <div className="flex-1 py-1 flex flex-col justify-center min-h-[220px]">
                    <AnimatePresence mode="wait">
                      {/* STEP 1: SCAN QR */}
                      {activeStepIndex === 0 && (
                        <motion.div
                          key="m-scan"
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ duration: 0.25 }}
                          className="flex flex-col items-center justify-center text-center my-auto"
                        >
                          <div className="relative w-28 h-28 rounded-xl bg-neutral-950 border-2 border-[#FF6B6B]/40 flex items-center justify-center overflow-hidden mb-2 shadow-inner">
                            {/* Viewfinder Target Brackets */}
                            <div className="absolute top-1.5 left-1.5 w-3 h-3 border-t-2 border-l-2 border-[#FF6B6B]" />
                            <div className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 border-[#FF6B6B]" />
                            <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b-2 border-l-2 border-[#FF6B6B]" />
                            <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b-2 border-r-2 border-[#FF6B6B]" />

                            {/* Animated Laser Scanning Line */}
                            <motion.div
                              animate={shouldReduceMotion ? {} : { y: [-38, 38, -38] }}
                              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                              className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-[#FF6B6B] to-transparent shadow-[0_0_6px_#FF6B6B]"
                            />

                            {/* QR Code Graphics */}
                            <div className="p-2 bg-white rounded-lg shadow-sm">
                              <QrCode className="w-14 h-14 text-neutral-950" />
                            </div>
                          </div>

                          <div className="text-[10px] font-bold text-foreground">
                            Scanning Table QR
                          </div>
                          <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-bold">
                            <Check className="w-2.5 h-2.5" />
                            Table 08 Verified
                          </div>
                        </motion.div>
                      )}

                      {/* STEP 2: ORDER */}
                      {activeStepIndex === 1 && (
                        <motion.div
                          key="m-order"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.25 }}
                          className="flex flex-col justify-between h-full py-0.5"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[8px] font-bold text-muted-foreground uppercase">
                              <span>Menu Selection</span>
                              <span className="text-emerald-600 dark:text-emerald-400">Cart (3)</span>
                            </div>

                            <div className="p-1 rounded-md bg-neutral-50 dark:bg-neutral-800/60 border border-border/50 text-[9px] flex items-center justify-between">
                              <span className="font-semibold text-foreground truncate">Paneer Tikka <span className="text-[#FF6B6B] font-bold">×2</span></span>
                              <span className="font-mono font-bold text-foreground">₹360</span>
                            </div>
                            <div className="p-1 rounded-md bg-neutral-50 dark:bg-neutral-800/60 border border-border/50 text-[9px] flex items-center justify-between">
                              <span className="font-semibold text-foreground truncate">Garlic Naan <span className="text-[#FF6B6B] font-bold">×1</span></span>
                              <span className="font-mono font-bold text-foreground">₹80</span>
                            </div>
                            <div className="p-1 rounded-md bg-neutral-50 dark:bg-neutral-800/60 border border-border/50 text-[9px] flex items-center justify-between">
                              <span className="font-semibold text-foreground truncate">Lassi <span className="text-[#FF6B6B] font-bold">×2</span></span>
                              <span className="font-mono font-bold text-foreground">₹240</span>
                            </div>

                            <div className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[8px] text-amber-600 dark:text-amber-400 font-medium truncate">
                              Note: Less spicy
                            </div>
                          </div>

                          <div className="pt-1.5 border-t border-border/50 mt-1">
                            <div className="flex items-center justify-between text-[9px] mb-1">
                              <span className="text-muted-foreground">Total</span>
                              <span className="font-mono font-black text-foreground">₹680</span>
                            </div>
                            <div className="w-full py-1 rounded-lg bg-[#FF6B6B] text-white text-[9px] font-bold text-center shadow-xs">
                              Order Confirmed ✓
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* STEP 3: KITCHEN */}
                      {activeStepIndex === 2 && (
                        <motion.div
                          key="m-kitchen"
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ duration: 0.25 }}
                          className="flex flex-col justify-between h-full py-0.5 text-center"
                        >
                          <div className="p-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 mb-1.5">
                            <div className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 text-[9px] font-bold uppercase">
                              <ChefHat className="w-3 h-3 animate-bounce" />
                              <span>Kitchen KDS</span>
                            </div>
                            <div className="text-[8px] text-muted-foreground mt-0.5">
                              Ticket #108 • Table 08
                            </div>
                          </div>

                          <div className="p-1.5 rounded-lg bg-card border border-border/50 text-left font-mono text-[8px] space-y-0.5">
                            <div className="flex justify-between font-bold text-foreground">
                              <span>Preparing Order</span>
                              <span className="text-orange-500">04:12</span>
                            </div>
                            <div className="text-muted-foreground text-[8px]">
                              • 2× Paneer Tikka (Less spicy)<br />
                              • 1× Garlic Naan • 2× Lassi
                            </div>
                          </div>

                          {/* Animated Progress Bar */}
                          <div className="my-1.5">
                            <div className="h-1.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: "20%" }}
                                animate={{ width: "85%" }}
                                transition={{ duration: 3.5, ease: "linear" }}
                                className="h-full bg-orange-500 rounded-full"
                              />
                            </div>
                            <div className="text-[8px] text-muted-foreground mt-1">
                              Cooking in progress...
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* STEP 4: READY */}
                      {activeStepIndex === 3 && (
                        <motion.div
                          key="m-ready"
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ duration: 0.25 }}
                          className="flex flex-col justify-between h-full py-1 text-center"
                        >
                          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                            <div className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold uppercase mb-0.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Order Ready</span>
                            </div>
                            <div className="text-[9px] font-bold text-foreground">
                              Dishes on hot plate!
                            </div>
                          </div>

                          <div className="p-1.5 rounded-lg bg-card border border-border/50 flex items-center gap-1.5 text-left my-auto">
                            <Bell className="w-3.5 h-3.5 text-[#FF6B6B] shrink-0 animate-pulse" />
                            <div className="text-[8px] text-foreground leading-tight">
                              <span className="font-bold">Waiter Notified:</span> Pick up order for Table 08.
                            </div>
                          </div>

                          <div className="text-[8px] text-emerald-600 dark:text-emerald-400 font-bold">
                            ✓ Captain en route to table
                          </div>
                        </motion.div>
                      )}

                      {/* STEP 5: SERVED */}
                      {activeStepIndex === 4 && (
                        <motion.div
                          key="m-served"
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ duration: 0.25 }}
                          className="flex flex-col justify-center h-full text-center py-1 my-auto"
                        >
                          <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-2 shadow-xs">
                            <Utensils className="w-5 h-5" />
                          </div>

                          <div className="text-xs font-black text-foreground mb-1">
                            Order Served!
                          </div>

                          {/* EXACT USER SPECIFICATION MESSAGE */}
                          <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 leading-tight mb-2 px-1">
                            &ldquo;Your food is served. Enjoy!&rdquo;
                          </p>

                          <div className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[8px] font-mono font-bold text-muted-foreground mx-auto">
                            Table 08 • ₹680 Paid
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Bottom Micro Status Bar */}
                  <div className="pt-1 border-t border-border/50 shrink-0">
                    <div className="flex items-center justify-between text-[8px] font-bold text-muted-foreground uppercase">
                      <span>#DIO-108</span>
                      <span className="text-[#FF6B6B] font-mono">{orderStatusStates[activeStepIndex]}</span>
                    </div>
                    {/* 5-step micro indicator dots */}
                    <div className="grid grid-cols-5 gap-1 mt-1">
                      {orderStatusStates.map((sName, sIdx) => (
                        <div
                          key={sName}
                          className={`h-1 rounded-full transition-colors duration-300 ${
                            sIdx === activeStepIndex
                              ? "bg-[#FF6B6B]"
                              : sIdx < activeStepIndex
                              ? "bg-emerald-500"
                              : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* RIGHT SECTION (30%): 5 Vertically Stacked Visual Buttons */}
            {/* Spec: Non-clickable visual indicators, active button FULLY COLOURED */}
            <div 
              className="w-[32%] sm:w-[30%] flex flex-col justify-center gap-2 sm:gap-2.5 pointer-events-none select-none"
              aria-label="Workflow progress indicators"
            >
              {mobileWorkflowButtons.map((btn, idx) => {
                const isActive = idx === activeStepIndex;
                const isCompleted = idx < activeStepIndex;

                return (
                  <div
                    key={btn.id}
                    className={`relative px-2 py-2 sm:px-2.5 sm:py-2.5 rounded-xl border text-left transition-all duration-300 flex flex-col justify-center ${
                      isActive
                        ? "bg-[#FF6B6B] text-white border-transparent shadow-md shadow-[#FF6B6B]/30 scale-[1.03]"
                        : isCompleted
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-medium"
                        : "bg-neutral-100/80 dark:bg-neutral-800/50 text-neutral-400 dark:text-neutral-500 border-neutral-200/50 dark:border-neutral-800/60"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <btn.icon className={`w-3 h-3 shrink-0 ${
                        isActive ? "text-white" : isCompleted ? "text-emerald-500" : "text-neutral-400"
                      }`} />
                      <span className={`text-[10px] sm:text-[11px] font-bold leading-tight truncate ${
                        isActive ? "text-white" : ""
                      }`}>
                        {btn.label}
                      </span>
                    </div>

                    {/* Glowing active indicator dot */}
                    {isActive && (
                      <span className="absolute top-1.5 right-1.5 flex h-1.5 w-1.5">
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
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Automated workflow simulation • Step {activeStepIndex + 1} of 5</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
