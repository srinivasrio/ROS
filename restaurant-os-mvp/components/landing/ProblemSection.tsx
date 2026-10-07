"use client";

import { motion } from "framer-motion";
import RevealMotion from "./RevealMotion";
import { AlertCircle } from "lucide-react";

interface ProblemItem {
  icon: string;
  tag: string;
  title: string;
  desc: string;
  accent: "coral" | "teal" | "purple";
}

const problems: ProblemItem[] = [
  { 
    icon: "/images/landing/icons/cross.png", 
    tag: "Order Errors",
    title: "Mismatched & Lost Orders", 
    desc: "Waiters scribbling notes manually leads to wrong dishes, kitchen confusion, and angry guests sending food back.",
    accent: "coral" 
  },
  { 
    icon: "/images/landing/icons/statistics.png", 
    tag: "Rush Hour Chaos",
    title: "Peak Hours Turn Into Bottlenecks", 
    desc: "When the dining room is full, orders get delayed, tables wait 20+ minutes just to order, and staff gets overwhelmed.",
    accent: "teal" 
  },
  { 
    icon: "/images/landing/icons/transaction.png", 
    tag: "Billing Friction",
    title: "Manual Billing & GST Headaches", 
    desc: "Calculating tax splits, itemized bills, and daily end-of-day reports by hand wastes hours and causes accounting mistakes.",
    accent: "purple" 
  },
  { 
    icon: "/images/landing/icons/money.png", 
    tag: "Blind Operations",
    title: "Zero Real-Time Sales Visibility", 
    desc: "Owners don't know today's gross revenue, top selling items, or table turnover rates until midnight — or never.",
    accent: "coral" 
  },
  { 
    icon: "/images/landing/icons/order-now.png", 
    tag: "Guest Dissatisfaction",
    title: "Guests Left Wondering Status", 
    desc: "Diners have no visual tracking of whether their order is queued, cooking, or on the way, leading to frequent complaints.",
    accent: "teal" 
  },
  { 
    icon: "/images/landing/icons/checklist.png", 
    tag: "Inventory Leaks",
    title: "Running Out of Key Ingredients", 
    desc: "No automated recipe deductions means surprise 86'd items mid-rush, spoiled stock, and untracked theft.",
    accent: "purple" 
  },
];

const colorStyles = {
  coral: {
    border: "border-[#FF6B6B]/20 hover:border-[#FF6B6B]/50",
    glow: "hover:shadow-[0_12px_40px_rgba(255,107,107,0.18)]",
    iconBg: "bg-[#FF6B6B]/10 border border-[#FF6B6B]/20",
    tagBg: "bg-[#FF6B6B]/10 text-[#FF6B6B] border border-[#FF6B6B]/20",
    dot: "bg-[#FF6B6B]",
  },
  teal: {
    border: "border-[#4ECDC4]/20 hover:border-[#4ECDC4]/50",
    glow: "hover:shadow-[0_12px_40px_rgba(78,205,196,0.18)]",
    iconBg: "bg-[#4ECDC4]/10 border border-[#4ECDC4]/20",
    tagBg: "bg-[#4ECDC4]/10 text-[#0d9488] border border-[#4ECDC4]/20",
    dot: "bg-[#4ECDC4]",
  },
  purple: {
    border: "border-purple-500/20 hover:border-purple-500/50",
    glow: "hover:shadow-[0_12px_40px_rgba(168,85,247,0.18)]",
    iconBg: "bg-purple-500/10 border border-purple-500/20",
    tagBg: "bg-purple-500/10 text-purple-600 border border-purple-500/20",
    dot: "bg-purple-500",
  },
};

const ProblemSection = () => (
  <section className="relative py-16 md:py-28 overflow-hidden bg-background" id="features">
    {/* Subtle backdrop accents */}
    <div className="absolute top-1/2 left-0 -translate-y-1/2 w-96 h-96 bg-[#FF6B6B]/5 rounded-full blur-[140px] pointer-events-none" />
    <div className="absolute top-1/2 right-0 -translate-y-1/2 w-96 h-96 bg-[#4ECDC4]/5 rounded-full blur-[140px] pointer-events-none" />

    <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6">
      <RevealMotion className="text-center mb-12 md:mb-16">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 border border-rose-500/20 mb-3">
          <AlertCircle className="w-3.5 h-3.5" />
          The Restaurant Bottleneck
        </span>
        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mt-2 text-foreground">
          Every Restaurant Owner Knows These Problems
        </h2>
        <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto mt-3">
          Traditional dining setups bleed money and customer satisfaction through unorganized operations.
        </p>
      </RevealMotion>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-7">
        {problems.map((p, i) => {
          const style = colorStyles[p.accent];
          return (
            <RevealMotion key={p.title} delay={0.06 * i}>
              <motion.div
                whileHover={{ y: -6, scale: 1.015 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className={`group relative p-6 md:p-7 rounded-2xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border ${style.border} cursor-default overflow-hidden transition-all duration-300 ${style.glow} flex flex-col justify-between h-full shadow-sm`}
              >
                {/* Top Row: Icon + Category Tag */}
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className={`inline-flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-2xl ${style.iconBg} shadow-inner transition-transform group-hover:scale-105 duration-300`}>
                      <img src={p.icon} alt={p.title} loading="lazy" decoding="async" className="w-6 h-6 md:w-8 md:h-8 object-contain" />
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${style.tagBg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${style.dot} animate-pulse`} />
                      {p.tag}
                    </span>
                  </div>

                  <h3 className="text-base md:text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                    {p.title}
                  </h3>
                  <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                    {p.desc}
                  </p>
                </div>

                {/* Bottom subtle accent line */}
                <div className="mt-5 pt-3 border-t border-border/40 flex items-center justify-between text-[11px] font-semibold text-muted-foreground/80">
                  <span>Traditional System Flaw</span>
                  <span className="text-rose-500 font-bold">Solved by Dine In One →</span>
                </div>
              </motion.div>
            </RevealMotion>
          );
        })}
      </div>
    </div>
  </section>
);

export default ProblemSection;
