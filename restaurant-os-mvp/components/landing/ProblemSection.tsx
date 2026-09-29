"use client";

import { motion } from "framer-motion";
import RevealMotion from "./RevealMotion";

const problems = [
  { icon: "/images/landing/icons/cross.png", title: "Wrong Orders", desc: "Waiters writing incorrectly, kitchen gets confused", color: "coral" },
  { icon: "/images/landing/icons/statistics.png", title: "Peak Hour", desc: "No coordination, orders getting lost mid-rush", color: "teal" },
  { icon: "/images/landing/icons/transaction.png", title: "Manual GST Billing", desc: "30+ minutes of manual calculation every night", color: "purple" },
  { icon: "/images/landing/icons/money.png", title: "No Sales Visibility", desc: "No idea what's selling and what's wasting money", color: "coral" },
  { icon: "/images/landing/icons/order-now.png", title: "No Order Updates", desc: "Customers waiting with zero status information", color: "teal" },
  { icon: "/images/landing/icons/checklist.png", title: "Inventory Surprises", desc: "Running out of key ingredients mid-service", color: "purple" },
];

const colorConfig: Record<string, { border: string; iconBg: string; glow: string }> = {
  coral: {
    border: "border-[#FF6B6B]/20",
    iconBg: "bg-[#FF6B6B]/10",
    glow: "group-hover:shadow-[0_8px_40px_rgba(255,107,107,0.15)]",
  },
  teal: {
    border: "border-[#4ECDC4]/20",
    iconBg: "bg-[#4ECDC4]/10",
    glow: "group-hover:shadow-[0_8px_40px_rgba(78,205,196,0.15)]",
  },
  purple: {
    border: "border-purple-500/20",
    iconBg: "bg-purple-500/10",
    glow: "group-hover:shadow-[0_8px_40px_rgba(168,85,247,0.15)]",
  },
};

const ProblemSection = () => (
  <section className="relative py-12 md:py-24 overflow-hidden bg-background" id="features">
    <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6">
      <RevealMotion className="text-center mb-8 md:mb-16">
        <h2 className="text-3xl md:text-5xl font-bold mt-3" >
          Every Restaurant Owner Knows These Problems
        </h2>
      </RevealMotion>
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
        {problems.map((p, i) => {
          const cfg = colorConfig[p.color];
          return (
            <RevealMotion key={p.title} delay={0.08 * i}>
              <motion.div
                whileHover={{ y: -8, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`group relative p-3 md:p-7 rounded-xl md:rounded-2xl bg-neutral-50 dark:bg-neutral-900 border ${cfg.border} cursor-default overflow-hidden transition-shadow duration-300 ${cfg.glow} h-full`}
              >
                <div className={`inline-flex items-center justify-center w-8 h-8 md:w-14 md:h-14 rounded-lg md:rounded-xl ${cfg.iconBg} mb-2 md:mb-4`}>
                  <img src={p.icon} alt={p.title} className="w-5 h-5 md:w-9 md:h-9 object-contain" />
                </div>
                <h3 className="text-sm md:text-lg font-bold mb-1 md:mb-2">{p.title}</h3>
                <p className="text-[10px] md:text-sm text-black dark:text-black leading-relaxed hidden md:block">{p.desc}</p>
              </motion.div>
            </RevealMotion>
          );
        })}
      </div>
    </div>
  </section>
);

export default ProblemSection;
