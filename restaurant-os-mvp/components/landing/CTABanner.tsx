"use client";

import { motion } from "framer-motion";
import RevealMotion from "./RevealMotion";

const CTABanner = () => {
  const scrollTo = (id: string) => {
    document.getElementById(id.toLowerCase())?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative py-20 px-4 md:px-6 overflow-hidden bg-transparent">
      <div className="max-w-5xl mx-auto relative">
        <div className="relative rounded-[36px] md:rounded-[44px] p-8 md:p-16 overflow-hidden liquid-glass-surface border border-slate-200/90 shadow-[0_20px_60px_rgba(15,23,42,0.08),inset_0_1px_2px_rgba(255,255,255,0.9)] text-center backdrop-blur-3xl">
          {/* Dynamic atmospheric fluid background glows */}
          <div className="absolute -top-32 -left-32 w-80 h-80 bg-[#FF6B6B]/15 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-[#4ECDC4]/12 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#8278FF]/15 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="relative z-10 max-w-2xl mx-auto">
            <RevealMotion>
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider liquid-glass-pill text-indigo-700 border-indigo-200/70 bg-indigo-50/70 mb-4 shadow-xs">
                Start Your Journey
              </span>
              <h2 className="text-3xl md:text-5xl font-black mb-4 text-slate-900 tracking-tight">
                Ready to Transform Your Restaurant?
              </h2>
              <p className="text-base md:text-lg text-slate-600 mb-10 max-w-lg mx-auto font-medium leading-relaxed">
                Join forward-thinking restaurants already running on Dine in One. Experience pure operational clarity today.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <motion.button
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className="liquid-glass-btn-primary text-base font-bold !py-3.5 !px-8 rounded-full shadow-lg shadow-[#FF6B6B]/25 cursor-pointer"
                  onClick={() => scrollTo("contact")}
                >
                  Book Free Demo →
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className="liquid-glass-btn text-base font-bold !py-3.5 !px-8 rounded-full border border-slate-200/90 text-slate-700 hover:text-slate-900 hover:bg-white transition-all cursor-pointer shadow-xs"
                  onClick={() => scrollTo("contact")}
                >
                  Request Call Back
                </motion.button>
              </div>
            </RevealMotion>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTABanner;
