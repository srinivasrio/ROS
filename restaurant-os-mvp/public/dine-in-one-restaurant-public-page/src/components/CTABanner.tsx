import { motion } from "framer-motion";

import RevealMotion from "./RevealMotion";

const CTABanner = () => {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative py-24 overflow-hidden" style={{ background: "linear-gradient(135deg, #FF6B6B, #A855F7, #4ECDC4)", backgroundSize: "200% 200%", animation: "gradientShift 6s ease infinite" }}>
      
      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        <RevealMotion>
          <h2 className="text-3xl md:text-5xl font-heading font-extrabold mb-4 text-white">
            Ready to Transform Your Restaurant?
          </h2>
          <p className="text-lg text-white/90 mb-10 max-w-lg mx-auto">
            Join restaurant owners already using Dine in One. Book your free 30-minute demo today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.button
              whileHover={{ scale: 1.06, y: -3 }}
              whileTap={{ scale: 0.97 }}
              className="btn-primary text-lg pulse-glow !shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
              onClick={() => scrollTo("contact")}
            >
              Book Free Demo →
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="btn-outline !border-white/40 text-lg text-white"
              onClick={() => scrollTo("contact")}
            >
              Request Call Back
            </motion.button>
          </div>
        </RevealMotion>
      </div>
    </section>
  );
};

export default CTABanner;
