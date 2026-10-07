"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import RevealMotion from "./RevealMotion";
import { 
  QrCode, 
  UserCheck, 
  ChefHat, 
  Truck, 
  Settings, 
  Building2, 
  ShieldCheck, 
  Receipt, 
  Boxes, 
  Layers,
  MapPin,
  Users
} from "lucide-react";

interface SaasFeature {
  badge: string;
  title: string;
  desc: string;
  highlights: string[];
  emoji: string;
  gradient: string;
  accentColor: string;
}

const saasFeatures: SaasFeature[] = [
  { 
    badge: "Panel 1 • Guest Facing",
    title: "Customer QR Self-Ordering", 
    desc: "Contactless table ordering directly in browser. Diners browse photos, customize modifiers, and order without waiting for staff.",
    highlights: ["No app download required", "Custom food modifiers & notes", "Live preparation tracking"],
    emoji: "📱", 
    gradient: "from-[#FF6B6B]/20 via-[#FF8E53]/15 to-transparent",
    accentColor: "#FF6B6B"
  },
  { 
    badge: "Panel 2 • Floor Ops",
    title: "Waiter Captain App", 
    desc: "Mobile floor management for captains. Punch table orders, manage table merge/transfer, and relay customer notes in seconds.",
    highlights: ["Interactive table status grid", "Fast KOT additions", "PIN-protected staff access"],
    emoji: "🤵", 
    gradient: "from-[#4ECDC4]/20 via-[#2BA89E]/15 to-transparent",
    accentColor: "#4ECDC4"
  },
  { 
    badge: "Panel 3 • Kitchen Ops",
    title: "Live Kitchen Display (KDS)", 
    desc: "Paperless kitchen coordination screen. Color-coded ticket timers, sound chimes for new tickets, and one-tap order ready signals.",
    highlights: ["Color-coded prep timer alerts", "Audio chime order notifications", "Categorized station routing"],
    emoji: "🍳", 
    gradient: "from-purple-500/20 via-indigo-500/15 to-transparent",
    accentColor: "#A855F7"
  },
  { 
    badge: "Panel 4 • Dispatch Fleet",
    title: "Delivery Boy & Rider Portal", 
    desc: "Dedicated mobile interface for drivers with assigned deliveries, customer location navigation, phone dial, and OTP drop-off proof.",
    highlights: ["Live route & customer map", "1-Tap call & directions", "Secure delivery completion OTP"],
    emoji: "🛵", 
    gradient: "from-blue-500/20 via-cyan-500/15 to-transparent",
    accentColor: "#3B82F6"
  },
  { 
    badge: "Panel 5 • Branch Admin",
    title: "Branch Manager & Admin Panel", 
    desc: "Complete operational workstation. Manage live dining tables, interactive menu availability, staff shifts, coupons, and services.",
    highlights: ["Live table layout designer", "86-item menu toggle", "Thermal printer receipt integration"],
    emoji: "⚙️", 
    gradient: "from-emerald-500/20 via-teal-500/15 to-transparent",
    accentColor: "#10B981"
  },
  { 
    badge: "Panel 6 • Enterprise",
    title: "Multi-Outlet Owner Control", 
    desc: "Unified executive view for restaurant owners. Monitor multiple branches, comparative revenue streams, and centralized menus in one place.",
    highlights: ["Cross-branch live sales streams", "Consolidated P&L analytics", "Branch manager permissions"],
    emoji: "🏢", 
    gradient: "from-violet-500/20 via-purple-500/15 to-transparent",
    accentColor: "#8B5CF6"
  },
  { 
    badge: "Top Feature • Logistics",
    title: "Customizable Delivery Engine", 
    desc: "Run your own independent delivery without steep third-party commissions. Set custom KM pricing, geofenced radiuses, and min orders.",
    highlights: ["Custom per-KM delivery tariffs", "Radius & zone boundary control", "Direct WhatsApp order alerts"],
    emoji: "📍", 
    gradient: "from-amber-500/20 via-orange-500/15 to-transparent",
    accentColor: "#F59E0B"
  },
  { 
    badge: "Top Feature • Inventory",
    title: "Recipe Costing & Auto Inventory", 
    desc: "Link dishes to ingredient recipes. Every completed order automatically depletes inventory counts and warns of low-stock thresholds.",
    highlights: ["Automated batch recipe deductions", "Low-stock reorder warnings", "Food wastage cost analytics"],
    emoji: "📦", 
    gradient: "from-rose-500/20 via-pink-500/15 to-transparent",
    accentColor: "#F43F5E"
  },
  { 
    badge: "Top Feature • Finance",
    title: "Smart GST Billing & Thermal POS", 
    desc: "Generate compliant GST bills in 1 click. Split bills across diners, apply discounts, support UPI QR payments, and print instantly.",
    highlights: ["Auto CGST/SGST tax split", "Split payment methods", "58mm & 80mm thermal printing"],
    emoji: "🧾", 
    gradient: "from-teal-500/20 via-emerald-500/15 to-transparent",
    accentColor: "#14B8A6"
  },
  { 
    badge: "Top Feature • HR & Staff",
    title: "Staff Attendance & Payroll", 
    desc: "Eliminate manual register books. Track daily check-in timestamps, role permissions, advance payments, and calculate month-end salaries.",
    highlights: ["PIN-based attendance logging", "Role-based panel lockdown", "One-click payroll summaries"],
    emoji: "👥", 
    gradient: "from-indigo-500/20 via-blue-500/15 to-transparent",
    accentColor: "#6366F1"
  },
  { 
    badge: "Top Feature • Sync",
    title: "Sub-Second Realtime Engine", 
    desc: "Powered by persistent WebSockets and cloud database triggers. Orders placed anywhere update every connected screen in under 350ms.",
    highlights: ["Zero page reloads required", "Instant acoustic audio chimes", "Automatic reconnect fallback"],
    emoji: "⚡", 
    gradient: "from-yellow-400/20 via-amber-500/15 to-transparent",
    accentColor: "#EAB308"
  },
  { 
    badge: "Top Feature • Growth",
    title: "Offers, Combos & Loyalty", 
    desc: "Drive repeat orders with targeted promo coupons, combo bundle discounts, and high-margin chef's special showcases.",
    highlights: ["Time-limited discount coupons", "Meal combo meal builders", "Homepage special banners"],
    emoji: "🎁", 
    gradient: "from-pink-500/20 via-rose-500/15 to-transparent",
    accentColor: "#EC4899"
  }
];

function FeatureCard({ feature, index }: { feature: SaasFeature; index: number }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const rotateX = useSpring(useTransform(mouseY, [0, 1], [6, -6]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(mouseX, [0, 1], [-6, 6]), { stiffness: 300, damping: 30 });

  const glowX = useSpring(useTransform(mouseX, [0, 1], [0, 100]), { stiffness: 200, damping: 30 });
  const glowY = useSpring(useTransform(mouseY, [0, 1], [0, 100]), { stiffness: 200, damping: 30 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    mouseX.set(0.5);
    mouseY.set(0.5);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{
        duration: 0.6,
        delay: index * 0.06,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="h-full"
    >
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX,
          rotateY,
          transformPerspective: 800,
          transformStyle: "preserve-3d",
        }}
        whileHover={{
          y: -6,
          scale: 1.015,
          transition: { type: "spring", stiffness: 400, damping: 25 },
        }}
        className="group relative rounded-3xl h-full min-h-[300px] cursor-default overflow-hidden border border-border/80 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl shadow-xs transition-shadow duration-500 hover:shadow-xl"
      >
        {/* Subtle Ambient Background Gradient Tint */}
        <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-70 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />

        {/* Dynamic Glow Cursor Light */}
        <motion.div
          className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background: useTransform(
              [glowX, glowY],
              ([x, y]) => `radial-gradient(circle at ${x}% ${y}%, rgba(255,255,255,0.3) 0%, transparent 65%)`
            ),
          }}
        />

        <div className="relative z-10 p-6 md:p-7 flex flex-col justify-between h-full">
          <div>
            {/* Top Row: Category Tag + Emoji Icon */}
            <div className="flex items-center justify-between mb-4">
              <span 
                className="text-[11px] font-bold tracking-wider px-3 py-1 rounded-full border border-border/60 bg-white/80 dark:bg-neutral-800/80 shadow-2xs"
                style={{ color: feature.accentColor }}
              >
                {feature.badge}
              </span>

              <motion.div
                className="text-2xl md:text-3xl"
                animate={isHovered ? { scale: 1.15, rotate: [0, -8, 8, 0] } : { scale: 1, rotate: 0 }}
                transition={{ duration: 0.4 }}
              >
                {feature.emoji}
              </motion.div>
            </div>

            {/* Feature Title */}
            <h3 className="font-extrabold text-lg md:text-xl mb-2 text-foreground group-hover:text-primary transition-colors">
              {feature.title}
            </h3>

            {/* Feature Description */}
            <p className="text-xs md:text-sm leading-relaxed text-muted-foreground font-medium mb-4">
              {feature.desc}
            </p>

            {/* Feature Highlights Bullet Checklist */}
            <ul className="space-y-1.5 border-t border-border/50 pt-3">
              {feature.highlights.map((h) => (
                <li key={h} className="text-[11px] font-semibold text-foreground/80 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: feature.accentColor }} />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom Interactive Progress Bar */}
          <div className="mt-5 h-[2px] rounded-full bg-border/40 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: feature.accentColor }}
              initial={{ width: "0%" }}
              animate={isHovered ? { width: "100%" } : { width: "18%" }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

const FeaturesGrid = () => (
  <section id="features" className="py-16 md:py-28 bg-background relative overflow-hidden">
    <div className="absolute top-1/3 left-0 w-80 h-80 bg-[#4ECDC4]/5 rounded-full blur-[140px] pointer-events-none" />
    <div className="absolute bottom-1/3 right-0 w-80 h-80 bg-purple-500/5 rounded-full blur-[140px] pointer-events-none" />

    <div className="max-w-6xl mx-auto px-4 md:px-6 relative z-10">
      <RevealMotion className="text-center mb-12 md:mb-18">
        <span className="gradient-text-coral text-xs md:text-sm font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-[#FF6B6B]/10 border border-[#FF6B6B]/20">
          The Dine In One SaaS Ecosystem
        </span>
        <h2 className="text-3xl md:text-5xl font-extrabold mt-4 text-foreground tracking-tight">
          The Only Platform Your Restaurant Needs
        </h2>
        <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto mt-3">
          Every specialized panel, custom delivery fleet, recipe costing engine, and live billing capability — engineered into one cohesive ecosystem.
        </p>
      </RevealMotion>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-7" style={{ perspective: "1200px" }}>
        {saasFeatures.map((f, i) => (
          <FeatureCard key={f.title} feature={f} index={i} />
        ))}
      </div>
    </div>
  </section>
);

export default FeaturesGrid;
