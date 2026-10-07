"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const smoothScrollTo = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
};

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-32" id="hero">
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#FF6B6B]/10 rounded-full blur-[150px]" />
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#4ECDC4]/10 rounded-full blur-[150px]" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-purple-500/10 rounded-full blur-[150px]" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <motion.h1
          initial={{ opacity: 1 }}
          className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight mb-6 gradient-text-coral" 
        >
          {"The Smartest Decision for Your Restaurant".split("").map((char, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.01, delay: 0.02 + i * 0.004 }}
            >
              {char}
            </motion.span>
          ))}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="text-sm md:text-xl text-foreground max-w-[580px] mx-auto mb-10"
        >
          QR ordering, digital menu management, live kitchen coordination, and automatic GST billing — all in one platform built for Indian restaurants.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10"
        >
          <Link href="/register">
            <motion.button
              whileHover={{ scale: 1.06, y: -3 }}
              whileTap={{ scale: 0.97 }}
              className="btn-primary text-sm md:text-lg !py-2 !px-4 md:!py-[0.9rem] md:!px-[2.2rem]"
            >
              Get Started Free →
            </motion.button>
          </Link>
          <motion.button
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="btn-outline text-sm md:text-lg !py-2 !px-4 md:!py-[0.9rem] md:!px-[2.2rem]"
            onClick={() => smoothScrollTo("solution")}
          >
            See How It Works
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
