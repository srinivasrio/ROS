"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import RevealMotion from "./RevealMotion";

const faqs = [
  { 
    q: "Do customers need to download a mobile app to order?", 
    a: "No! Diners simply scan the dynamic QR code on their table with any camera or UPI app, and your branded menu opens instantly in their browser. No registration, no app download required." 
  },
  { 
    q: "Can I run home delivery without paying 30% aggregator commissions?", 
    a: "Yes! Dine In One includes a built-in Customizable Delivery Engine. You can define your delivery radius, set per-kilometer charges, and assign orders to your own delivery boys with an interactive rider tracking app and OTP confirmation." 
  },
  { 
    q: "How does automated GST billing and thermal printing work?", 
    a: "Dine In One calculates compliant CGST and SGST splits automatically based on government rates. With 1 click, you can print receipts to standard 58mm or 80mm wireless/USB thermal printers or send digital invoices via WhatsApp." 
  },
  { 
    q: "How does recipe costing and inventory deduction work?", 
    a: "In the Growth and Pro plans, you can link ingredients to menu items. Whenever a dish is ordered, raw stock (e.g., 200g chicken, 100g paneer) automatically deducts in real-time, sending you alerts before you run out." 
  },
  { 
    q: "Can I manage multiple outlets under one login?", 
    a: "Yes! Our Pro plan includes multi-branch management. Restaurant founders get an Executive Owner Portal with cross-branch sales benchmarking, centralized menu catalog updates, and consolidated financial statements." 
  },
  { 
    q: "What hardware or devices do we need?", 
    a: "None! Dine In One runs seamlessly on any Android/iOS smartphone, iPad, tablet, laptop, or desktop PC. You can use your existing devices without expensive proprietary POS hardware." 
  },
  { 
    q: "How fast can my restaurant go live?", 
    a: "You can create your account and set up your menu within 30 minutes. If you want our concierge team to digitize your menu and configure tables, we complete everything within 24 hours." 
  },
  { 
    q: "Can I try Dine In One before paying?", 
    a: "Yes! You can register for a free evaluation or book a live 1-on-1 walkthrough with our restaurant specialists to see all panels live in action." 
  },
];

const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 md:py-32 relative bg-transparent overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-r from-[#8278FF]/12 to-[#4ECDC4]/12 rounded-full blur-[160px] pointer-events-none" />
      <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-6">
        <RevealMotion className="text-center mb-12 md:mb-16">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs md:text-sm font-bold uppercase tracking-widest liquid-glass-pill text-indigo-700 border-indigo-200/70 bg-indigo-50/70 mb-3 shadow-xs">
            Got Questions?
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold mt-3 text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-sm md:text-base text-slate-600 mt-2 font-medium">
            Everything you need to know about Dine In One's unified restaurant operating system.
          </p>
        </RevealMotion>

        <div className="space-y-3.5">
          {faqs.map((f, i) => (
            <RevealMotion key={i} delay={0.04 * i}>
              <motion.div
                layout
                className={`rounded-2xl border overflow-hidden transition-all duration-300 ${
                  openIndex === i 
                    ? "liquid-glass-surface border-[#FF6B6B]/40 shadow-[0_12px_32px_rgba(255,107,107,0.12),inset_0_1px_2px_rgba(255,255,255,0.9)]" 
                    : "liquid-glass-soft border-slate-200/80 hover:border-slate-300 hover:bg-white/80 shadow-xs"
                }`}
              >
                <button
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left cursor-pointer"
                >
                  <span className={`font-bold text-sm md:text-base transition-colors ${
                    openIndex === i ? "text-[#FF6B6B] drop-shadow-xs" : "text-slate-800"
                  }`}>
                    {f.q}
                  </span>
                  <motion.span
                    animate={{ rotate: openIndex === i ? 45 : 0 }}
                    transition={{ duration: 0.25 }}
                    className={`text-xl ml-4 shrink-0 font-bold ${
                      openIndex === i ? "text-[#FF6B6B]" : "text-slate-400"
                    }`}
                  >
                    +
                  </motion.span>
                </button>
                <motion.div
                  initial={false}
                  animate={{ height: openIndex === i ? "auto" : 0, opacity: openIndex === i ? 1 : 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-slate-200/80 mx-5 pt-3 pb-5">
                    <p className="text-xs md:text-sm text-slate-600 leading-relaxed font-medium">
                      {f.a}
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            </RevealMotion>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
