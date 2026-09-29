"use client";

import { motion } from "framer-motion";
import RevealMotion from "./RevealMotion";

const plans = [
  {
    name: "Starter",
    price: "₹1,499",
    features: [
      { text: "QR Ordering", included: true },
      { text: "Unlimited Tables", included: true },
      { text: "Admin Panel", included: true },
      { text: "Customer Panel", included: true },
      { text: "Waiter Panel", included: true },
      { text: "Kitchen Panel", included: true },
      { text: "Analytics Dashboard", included: false },
      { text: "Multi-branch", included: false },
    ],
    cta: "border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-foreground",
    popular: false,
  },
  {
    name: "Pro",
    price: "₹2,999",
    features: [
      { text: "Everything in Starter", included: true },
      { text: "Kitchen Panel", included: true },
      { text: "Analytics Dashboard", included: true },
      { text: "Inventory Management", included: true },
      { text: "Priority Support", included: true },
      { text: "Multi-branch", included: false },
    ],
    cta: "btn-primary",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "₹4,999",
    features: [
      { text: "Everything in Pro", included: true },
      { text: "Multi-branch Support (2 Branches)", included: true },
      { text: "Live Invoice", included: true },
      { text: "Custom Branding", included: true },
      { text: "Dedicated Account Manager", included: true },
      { text: "24/7 Phone Support", included: true },
    ],
    cta: "bg-gradient-to-r from-emerald-500 to-emerald-700 text-white shadow-emerald-500/20",
    popular: false,
  },
];

const PricingSection = () => {
  return (
    <section id="pricing" className="py-24 bg-background">
      <div className="max-w-6xl mx-auto px-6">
        <RevealMotion className="text-center mb-14">
          <span className="gradient-text-coral text-sm font-bold uppercase tracking-widest">Simple Pricing</span>
          <h2 className="text-3xl md:text-5xl font-bold mt-3" >Start Small, Scale Freely</h2>
        </RevealMotion>

        <div className="grid md:grid-cols-3 gap-6 items-start">
          {plans.map((p, i) => (
            <RevealMotion key={p.name} delay={0.12 * i}>
              <motion.div
                whileHover={{ y: -8, boxShadow: p.popular ? "0 25px 50px rgba(255,107,107,0.15)" : "0 20px 40px rgba(0,0,0,0.08)" }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`relative p-8 rounded-2xl border ${
                  p.popular
                    ? "border-[#FF6B6B]/40 shadow-2xl shadow-[#FF6B6B]/10 scale-[1.02] bg-white dark:bg-neutral-900"
                    : "border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50"
                }`}
              >
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] text-xs font-bold text-white shadow-lg">
                    Most Popular
                  </div>
                )}
                <h3 className="text-xl font-bold mb-2" >{p.name}</h3>
                <div className="mb-6">
                  <span className="stat-number text-4xl font-bold gradient-text-coral">{p.price}</span>
                  <span className="text-sm text-black ml-1">/mo</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {p.features.map((f) => (
                    <li key={f.text} className="flex items-center gap-2 text-sm">
                      {f.included ? (
                        <span className="text-emerald-500 font-bold">✓</span>
                      ) : (
                        <span className="text-black dark:text-black">✗</span>
                      )}
                      <span className={f.included ? "text-black dark:text-black font-medium" : "text-black dark:text-black"}>{f.text}</span>
                    </li>
                  ))}
                </ul>
                <motion.button
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className={`${p.popular ? 'btn-primary' : (p.name === 'Starter' ? p.cta : p.cta + ' py-3 px-6 rounded-full font-bold shadow-lg')} w-full flex justify-center items-center py-3 px-6 rounded-full font-bold transition-all shadow-md`}
                >
                  Get Started
                </motion.button>
              </motion.div>
            </RevealMotion>
          ))}
        </div>
        <RevealMotion delay={0.3}>
          <p className="text-center text-sm text-black mt-8 font-medium">
            All plans include onboarding support. No hidden charges.
          </p>
        </RevealMotion>
      </div>
    </section>
  );
};

export default PricingSection;
