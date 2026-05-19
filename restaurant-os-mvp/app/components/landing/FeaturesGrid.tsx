"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import RevealMotion from "./RevealMotion";

const features = [
  { title: "QR Table Ordering", desc: "Customers scan, browse the menu, and order from their phone. No app download needed.", emoji: "📱", gradient: "from-[#f49f51]/80 to-[#f7c948]/60" },
  { title: "Live Kitchen Panel", desc: "Real-time order queue with status tracking. Kitchen staff see every order instantly.", emoji: "👨‍🍳", gradient: "from-[#bee4e7]/80 to-[#4ECDC4]/40" },
  { title: "Smart Billing", desc: "Auto-calculate totals, taxes, discounts. GST-ready invoices generated instantly.", emoji: "🧾", gradient: "from-[#e94560]/60 to-[#FF6B6B]/40" },
  { title: "Inventory Management", desc: "Track stock levels, get low-stock alerts, and reduce food waste automatically.", emoji: "📦", gradient: "from-[#660000]/40 to-[#e94560]/30" },
  { title: "Analytics Dashboard", desc: "Know your best-sellers, peak hours, revenue trends, and customer insights.", emoji: "📊", gradient: "from-[#ff6b35]/60 to-[#f49f51]/40" },
  { title: "Today's Specials", desc: "Highlight daily specials and chef's picks right on the customer's screen.", emoji: "⭐", gradient: "from-[#b585d6]/60 to-[#A855F7]/40" },
  { title: "Combo Builder", desc: "Create meal combos and bundles to boost average order value effortlessly.", emoji: "🍔", gradient: "from-[#cccc33]/60 to-[#10B981]/30" },
  { title: "Admin Control Panel", desc: "Full control over menus, staff, tables, and settings from one dashboard.", emoji: "⚙️", gradient: "from-[#f6a3e7]/60 to-[#ffd4e5]/40" },
];

function FeatureCard({ feature, index }: { feature: typeof features[0]; index: number }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const rotateX = useSpring(useTransform(mouseY, [0, 1], [8, -8]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(mouseX, [0, 1], [-8, 8]), { stiffness: 300, damping: 30 });

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
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        duration: 0.7,
        delay: index * 0.12,
        ease: [0.22, 1, 0.36, 1],
      }}
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
          y: -8,
          scale: 1.02,
          transition: { type: "spring", stiffness: 400, damping: 25 },
        }}
        className="group relative rounded-[20px] h-full min-h-[220px] md:min-h-[240px] cursor-pointer overflow-hidden"
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} backdrop-blur-xl rounded-[20px]`} />
        <div className="absolute inset-0 rounded-[20px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),inset_0_-1px_1px_rgba(0,0,0,0.05)]" />
        <div className="absolute inset-0 rounded-[20px] transition-shadow duration-500 shadow-[0_4px_24px_rgba(0,0,0,0.06)] group-hover:shadow-[0_20px_60px_rgba(0,0,0,0.12),0_0_0_1px_rgba(255,255,255,0.2)]" />

        <motion.div
          className="absolute inset-0 rounded-[20px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background: useTransform(
              [glowX, glowY],
              ([x, y]) => `radial-gradient(circle at ${x}% ${y}%, rgba(255,255,255,0.25) 0%, transparent 60%)`
            ),
          }}
        />

        <div className="relative z-10 p-6 md:p-8 flex flex-col justify-between h-full">
          <div>
            <motion.div
              className="text-3xl md:text-4xl mb-4 inline-block"
              animate={isHovered ? { scale: 1.15, rotate: [0, -10, 10, 0] } : { scale: 1, rotate: 0 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            >
              {feature.emoji}
            </motion.div>

            <h3 className="font-bold text-base md:text-xl mb-2 text-black dark:text-white" >
              {feature.title}
            </h3>
            <p className="text-xs md:text-sm leading-relaxed text-black dark:text-black font-medium">
              {feature.desc}
            </p>
          </div>

          <motion.div className="mt-4 h-[2px] rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <motion.div
              className="h-full bg-black/30 dark:bg-white/30 rounded-full"
              initial={{ width: "0%" }}
              animate={isHovered ? { width: "100%" } : { width: "0%" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

const FeaturesGrid = () => (
  <section id="features" className="py-12 md:py-24 bg-background">
    <div className="max-w-6xl mx-auto px-4 md:px-6">
      <RevealMotion className="text-center mb-8 md:mb-16">
        <span className="gradient-text-coral text-sm font-bold uppercase tracking-widest">Everything Included</span>
        <h2 className="text-3xl md:text-5xl font-bold mt-3 gradient-text-hero" >
          The Only Platform Your Restaurant Needs
        </h2>
      </RevealMotion>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-7" style={{ perspective: "1200px" }}>
        {features.map((f, i) => (
          <FeatureCard key={f.title} feature={f} index={i} />
        ))}
      </div>
    </div>
  </section>
);

export default FeaturesGrid;
