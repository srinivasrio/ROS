"use client";

import { motion } from "framer-motion";
import RevealMotion from "./RevealMotion";

const CTABanner = () => {
  const scrollTo = (id: string) => {
    document.getElementById(id.toLowerCase())?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative py-24 overflow-hidden" style={{ background: "linear-gradient(135deg, #FF6B6B, #A855F7, #4ECDC4)", backgroundSize: "200% 200%" }}>
      <style jsx>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        section {
          animation: gradientShift 6s ease infinite;
        }
      `}</style>
      
      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        <RevealMotion>
          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white" >
            Ready to Transform Your Restaurant?
          </h2>
          <p className="text-lg text-white/90 mb-10 max-w-lg mx-auto font-medium">
            Join restaurant owners already using Dine in One. Book your free demo today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.button
              whileHover={{ scale: 1.06, y: -3 }}
              whileTap={{ scale: 0.97 }}
              className="btn-primary text-lg !shadow-[0_8px_32px_rgba(0,0,0,0.3)] bg-white !text-[#FF6B6B]"
              onClick={() => scrollTo("contact")}
            >
              Book Free Demo →
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="px-8 py-3 rounded-full border border-white/40 text-lg text-white font-bold hover:bg-white/10 transition-colors"
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
