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
    cta: "btn-outline",
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
    cta: "btn-teal",
    popular: false,
  },
];

const PricingSection = () => {
  return (
    <section id="pricing" className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <RevealMotion className="text-center mb-14">
          <span className="gradient-text-gold text-sm font-bold uppercase tracking-widest">Simple Pricing</span>
          <h2 className="text-3xl md:text-5xl font-heading font-bold mt-3">Start Small, Scale Freely</h2>
        </RevealMotion>

        <div className="grid md:grid-cols-3 gap-6 items-start">
          {plans.map((p, i) => (
            <RevealMotion key={p.name} delay={0.12 * i}>
              <motion.div
                whileHover={{ y: -8, boxShadow: p.popular ? "0 25px 50px rgba(255,107,107,0.15)" : "0 20px 40px rgba(0,0,0,0.08)" }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`relative p-8 rounded-2xl border ${
                  p.popular
                    ? "border-coral/40 shadow-2xl shadow-coral/10 scale-[1.02] bg-foreground/[0.05]"
                    : "border-foreground/[0.06] bg-foreground/[0.03]"
                }`}
              >
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-coral to-coral-light text-xs font-bold text-white">
                    Most Popular
                  </div>
                )}
                <h3 className="text-xl font-heading font-bold mb-2">{p.name}</h3>
                <div className="mb-6">
                  <span className="stat-number text-4xl font-bold gradient-text-coral">{p.price}</span>
                  <span className="text-sm text-muted-foreground ml-1">/mo</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {p.features.map((f) => (
                    <li key={f.text} className="flex items-center gap-2 text-sm">
                      {f.included ? (
                        <span className="text-emerald">✓</span>
                      ) : (
                        <span className="text-muted-foreground/40">✗</span>
                      )}
                      <span className={f.included ? "text-muted-foreground" : "text-muted-foreground/40"}>{f.text}</span>
                    </li>
                  ))}
                </ul>
                <motion.button
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className={`${p.cta} w-full justify-center`}
                >
                  Get Started
                </motion.button>
              </motion.div>
            </RevealMotion>
          ))}
        </div>
        <RevealMotion delay={0.3}>
          <p className="text-center text-sm text-muted-foreground mt-8">
            All plans include onboarding support. No hidden charges.
          </p>
        </RevealMotion>
      </div>
    </section>
  );
};

export default PricingSection;
