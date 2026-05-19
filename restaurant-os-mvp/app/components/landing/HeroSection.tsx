"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Rocket, Check, Smartphone, Receipt } from "lucide-react";
import Link from "next/link";

import RevealMotion from "./RevealMotion";

const stats = [
  { value: 5, label: "Smart Panels", prefix: "", suffix: "" },
  { value: 10000, label: "Orders Processed", prefix: "", suffix: "+" },
  { value: 0, label: "Setup Cost", prefix: "₹", suffix: "" },
  { value: 0, label: "Support", prefix: "", suffix: "", text: "24/7" },
];

const Counter = ({ value, prefix, suffix, text }: { value: number; prefix: string; suffix: string; text?: string }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animated.current) {
          animated.current = true;
          if (text) { setCount(0); return; }
          const duration = 1500;
          const steps = 40;
          const increment = value / steps;
          let current = 0;
          const timer = setInterval(() => {
            current += increment;
            if (current >= value) {
              setCount(value);
              clearInterval(timer);
            } else {
              setCount(Math.floor(current));
            }
          }, duration / steps);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, text]);

  return (
    <div ref={ref} className="text-center">
      <div className="stat-number text-3xl md:text-4xl font-bold gradient-text-coral">
        {text || `${prefix}${count.toLocaleString()}${suffix}`}
      </div>
    </div>
  );
};

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

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.65 }}
          className="flex flex-row md:flex-row flex-wrap justify-center items-center gap-3 mb-14"
        >
          {[
            { icon: Check, text: "No Setup Fee" },
            { icon: Smartphone, text: "Works on Any Device" },
            { icon: Receipt, text: "GST-Ready" },
          ].map((t, i) => (
            <motion.span
              key={t.text}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.7 + i * 0.1 }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-border text-sm font-medium text-muted-foreground"
            >
              <t.icon className="w-4 h-4 text-emerald-500" />
              {t.text}
            </motion.span>
          ))}
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <RevealMotion key={s.label} delay={0.1 * i}>
              <Counter value={s.value} prefix={s.prefix} suffix={s.suffix} text={s.text} />
              <p className="text-sm text-black mt-1">{s.label}</p>
            </RevealMotion>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
