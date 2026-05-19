import { useState } from "react";
import { motion } from "framer-motion";
import RevealMotion from "./RevealMotion";

const faqs = [
  { q: "Do customers need to download an app?", a: "No! Customers simply scan a QR code on their table and the menu opens in their phone's browser. No app download needed — works on any smartphone." },
  { q: "Does it work without internet?", a: "The system requires an internet connection for real-time syncing between panels. However, we recommend a basic broadband or 4G connection which is sufficient for smooth operation." },
  { q: "How does GST billing work?", a: "Dine in One automatically calculates GST (5% for non-AC restaurants, 18% for AC/premium) and generates compliant invoices. You can also share invoices via WhatsApp instantly." },
  { q: "Is it suitable for small cafés and dhabas?", a: "Absolutely! Our Starter plan is designed specifically for small eateries. Whether you have 5 tables or 50, Dine in One scales to your needs." },
  { q: "Can I manage multiple branches?", a: "Yes! Our Enterprise plan supports multi-branch management with centralized analytics, menu management, and staff control across all locations." },
  { q: "What support is included after setup?", a: "All plans include onboarding training, WhatsApp support, and regular updates. Pro and Enterprise plans get priority support with faster response times." },
  { q: "How long does setup take?", a: "Most restaurants are up and running within 24-48 hours. Our team handles the complete setup including menu digitization, table QR codes, and staff training." },
  { q: "Can I try before I buy?", a: "Yes! Book a free 30-minute demo and we'll show you exactly how Dine in One works for your restaurant. No commitment required." },
];

const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple/5 rounded-full blur-[200px]" />
      <div className="relative z-10 max-w-3xl mx-auto px-6">
        <RevealMotion className="text-center mb-16">
          <span className="gradient-text-purple text-sm font-bold uppercase tracking-widest">Got Questions?</span>
          <h2 className="text-3xl md:text-5xl font-heading font-bold mt-3">Frequently Asked</h2>
        </RevealMotion>
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <RevealMotion key={i} delay={0.05 * i}>
              <motion.div
                layout
                className={`rounded-xl border border-foreground/[0.06] overflow-hidden ${openIndex === i ? "bg-foreground/[0.05]" : "bg-foreground/[0.02]"}`}
              >
                <button
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className={`font-heading font-bold text-sm md:text-base transition-colors ${openIndex === i ? "text-coral" : ""}`}>
                    {f.q}
                  </span>
                  <motion.span
                    animate={{ rotate: openIndex === i ? 45 : 0 }}
                    transition={{ duration: 0.3 }}
                    className={`text-xl ml-4 flex-shrink-0 ${openIndex === i ? "text-coral" : "text-muted-foreground"}`}
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
                  <p className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
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
