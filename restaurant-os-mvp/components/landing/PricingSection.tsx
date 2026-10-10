"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import RevealMotion from "./RevealMotion";
import { Check, X, Sparkles, ArrowRight, Zap, Building2 } from "lucide-react";

interface PlanTier {
  slug: string;
  name: string;
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  popular?: boolean;
  badge?: string;
  features: { text: string; included: boolean }[];
  ctaText: string;
  ctaStyle: string;
}

const pricingPlans: PlanTier[] = [
  {
    slug: "standard",
    name: "Standard",
    tagline: "Essential operating system for single-location dine-in restaurants.",
    monthlyPrice: 999,
    annualPrice: 832, // ₹9,990/yr billed annually
    features: [
      { text: "1 Restaurant Outlet", included: true },
      { text: "Dynamic QR Code Table Ordering", included: true },
      { text: "Handheld Waiter Captain App", included: true },
      { text: "Live Kitchen Display System (KDS)", included: true },
      { text: "Admin Workstation & Menu Builder", included: true },
      { text: "Automated GST Split & Split Bills", included: true },
      { text: "Up to 10 Staff Accounts", included: true },
      { text: "Customizable Delivery & Rider App", included: false },
      { text: "Recipe Costing & Auto Inventory", included: false },
      { text: "Staff Attendance & Payroll", included: false },
      { text: "Multi-Branch Owner Panel", included: false },
    ],
    ctaText: "Start with Standard",
    ctaStyle: "border border-border/80 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-foreground",
  },
  {
    slug: "growth",
    name: "Growth",
    tagline: "High-volume restaurants running table service, delivery & inventory.",
    monthlyPrice: 1499,
    annualPrice: 1249, // ₹14,990/yr billed annually
    popular: true,
    badge: "Most Popular",
    features: [
      { text: "1 Restaurant Outlet", included: true },
      { text: "Everything in Standard", included: true },
      { text: "Customizable Delivery (KM tariffs & zones)", included: true },
      { text: "Delivery Boy & Rider App with OTP", included: true },
      { text: "Recipe Deductions & Low-Stock Alerts", included: true },
      { text: "Staff Attendance & Payroll Engine", included: true },
      { text: "Offers, Promo Coupons & Combo Builders", included: true },
      { text: "Advanced Hourly Sales & Food Margin Reports", included: true },
      { text: "Up to 25 Staff Accounts", included: true },
      { text: "24/7 Priority WhatsApp Support", included: true },
      { text: "Multi-Branch Owner Panel", included: false },
    ],
    ctaText: "Claim Growth Plan →",
    ctaStyle: "btn-primary shadow-xl shadow-[#FF6B6B]/25",
  },
  {
    slug: "pro",
    name: "Pro Enterprise",
    tagline: "Growing restaurant brands managing multiple outlets & executive teams.",
    monthlyPrice: 2999,
    annualPrice: 2499, // ₹29,990/yr billed annually
    badge: "Multi-Outlet",
    features: [
      { text: "Includes 2 Restaurant Outlets", included: true },
      { text: "Everything in Growth", included: true },
      { text: "Executive Multi-Outlet Owner Portal", included: true },
      { text: "Cross-Branch Live Sales Stream & Benchmarks", included: true },
      { text: "1-Click Central Menu Propagation", included: true },
      { text: "Consolidated Cross-Branch P&L Analytics", included: true },
      { text: "Floating Staff Access Across Outlets", included: true },
      { text: "Unlimited Staff Logins", included: true },
      { text: "Custom Brand Theme & Receipt Logo", included: true },
      { text: "Dedicated VIP Account Manager", included: true },
    ],
    ctaText: "Get Pro Multi-Branch",
    ctaStyle: "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-600/20",
  },
];

const PricingSection = () => {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <section id="pricing" className="py-20 md:py-32 bg-transparent relative overflow-hidden">
      {/* Background radial glows */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-[#FF6B6B]/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-96 h-96 bg-[#4ECDC4]/8 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 md:px-6 relative z-10">
        <RevealMotion className="text-center mb-12 md:mb-16">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs md:text-sm font-bold uppercase tracking-widest liquid-glass-pill text-[#FF6B6B] border-slate-200 mb-3 shadow-2xs">
            Transparent SaaS Subscriptions
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold mt-3 text-slate-900 tracking-tight">
            Start Small, Scale Freely
          </h2>
          <p className="text-sm md:text-base text-slate-600 max-w-xl mx-auto mt-3 font-medium">
            Simple monthly or annual billing. Zero hidden commissions. Upgrade, downgrade, or cancel anytime.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="mt-8 inline-flex items-center gap-2 p-1.5 rounded-full liquid-glass-soft border border-slate-200/90 shadow-2xs">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-5 py-2 rounded-full text-xs md:text-sm font-bold transition-all cursor-pointer ${
                !isAnnual
                  ? "liquid-glass-btn text-slate-900 border border-slate-200 shadow-2xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-5 py-2 rounded-full text-xs md:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                isAnnual
                  ? "liquid-glass-btn-primary text-white shadow-md shadow-[#FF6B6B]/25"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <span>Annual Billing</span>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-white/20 text-white">
                Save 17%
              </span>
            </button>
          </div>
        </RevealMotion>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8 items-stretch">
          {pricingPlans.map((p, i) => {
            const displayPrice = isAnnual ? p.annualPrice : p.monthlyPrice;

            return (
              <RevealMotion key={p.slug} delay={0.1 * i} className="h-full">
                <motion.div
                  whileHover={{ y: -6, scale: 1.015 }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                  className={`relative p-7 md:p-8 rounded-3xl border flex flex-col justify-between h-full backdrop-blur-2xl transition-all duration-300 ${
                    p.popular
                      ? "border-[#FF6B6B]/40 liquid-glass-dense shadow-[0_20px_50px_rgba(255,107,107,0.12),inset_0_1px_2px_#ffffff] md:-translate-y-2 ring-1 ring-[#FF6B6B]/20"
                      : "border-slate-200/85 liquid-glass-surface shadow-xs hover:border-slate-300"
                  }`}
                >
                  {/* Badge */}
                  {p.badge && (
                    <div
                      className={`absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-black tracking-wide shadow-md ${
                        p.popular
                          ? "liquid-glass-btn-primary text-white"
                          : "bg-gradient-to-r from-purple-600 to-indigo-600 text-white border border-white/25"
                      }`}
                    >
                      {p.badge}
                    </div>
                  )}

                  <div>
                    {/* Header */}
                    <div className="mb-4">
                      <h3 className="text-xl md:text-2xl font-black text-slate-900">
                        {p.name}
                      </h3>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2 font-medium">
                        {p.tagline}
                      </p>
                    </div>

                    {/* Price */}
                    <div className="mb-6 pb-6 border-b border-slate-200/80">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl md:text-5xl font-black gradient-text-coral drop-shadow-xs">
                          ₹{displayPrice.toLocaleString("en-IN")}
                        </span>
                        <span className="text-xs md:text-sm font-semibold text-slate-500">
                          / month
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {isAnnual ? "Billed annually • 2 Months Free" : "Billed monthly • Cancel anytime"}
                      </p>
                    </div>

                    {/* Features Checklist */}
                    <ul className="space-y-2.5 mb-8">
                      {p.features.map((f) => (
                        <li key={f.text} className="flex items-start gap-2.5 text-xs md:text-sm">
                          {f.included ? (
                            <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[11px]">
                              ✓
                            </span>
                          ) : (
                            <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                              ✕
                            </span>
                          )}
                          <span className={f.included ? "text-slate-700 font-semibold" : "text-slate-400"}>
                            {f.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CTA Action */}
                  <Link href={`/register?plan=${p.slug}`} className="w-full">
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full py-3.5 px-6 rounded-2xl text-xs md:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        p.popular
                          ? "liquid-glass-btn-primary"
                          : p.slug === "pro"
                          ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white border border-white/25 shadow-md shadow-purple-600/20"
                          : "liquid-glass-btn text-slate-900 border border-slate-200"
                      }`}
                    >
                      <span>{p.ctaText}</span>
                    </motion.button>
                  </Link>
                </motion.div>
              </RevealMotion>
            );
          })}
        </div>

        {/* Enterprise Bottom Strip */}
        <RevealMotion delay={0.3} className="mt-12">
          <div className="p-6 md:p-8 rounded-3xl liquid-glass-surface border border-slate-200/85 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl liquid-glass-clear border border-slate-200 text-[#8278FF] flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  Running 3+ Restaurant Chains or Food Courts?
                </h4>
                <p className="text-xs text-slate-600 mt-0.5 font-medium">
                  Get custom enterprise franchise quotas, on-premise hardware setup, and dedicated engineering support.
                </p>
              </div>
            </div>

            <Link href="/register?plan=enterprise">
              <button className="px-6 py-3 rounded-full liquid-glass-btn text-slate-800 text-xs font-bold transition-all cursor-pointer shrink-0 border border-slate-200 shadow-2xs hover:text-slate-900">
                Speak with Sales →
              </button>
            </Link>
          </div>
        </RevealMotion>
      </div>
    </section>
  );
};

export default PricingSection;
