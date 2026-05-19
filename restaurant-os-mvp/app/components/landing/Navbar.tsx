"use client";

import { useState, useEffect } from "react";
import { X, Menu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ThemeToggle } from "@/app/components/ThemeToggle";

const navLinks = ["Features", "Panels", "Pricing", "FAQ", "Contact"];

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    const element = document.getElementById(id.toLowerCase());
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-white/80 dark:bg-black/80 backdrop-blur-xl shadow-lg border-b border-neutral-200 dark:border-neutral-800" : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Dine <span className="gradient-text-coral text-xl">in</span> One
          </Link>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((l) => (
              <button
                key={l}
                onClick={() => scrollTo(l)}
                className={`text-sm font-medium transition-colors ${scrolled ? "text-black dark:text-black hover:text-[#FF6B6B]" : "text-black hover:text-[#FF6B6B]"}`}
              >
                {l}
              </button>
            ))}
            <Link href="/login" className={`text-sm font-medium transition-colors ${scrolled ? "text-black dark:text-black hover:text-[#FF6B6B]" : "text-black hover:text-[#FF6B6B]"}`}>
              Login
            </Link>
            <Link href="/register">
              <button className="btn-primary text-sm !py-2.5 !px-6">
                Get Started
              </button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden flex items-center gap-4">
            <button
              className="flex flex-col gap-1.5 z-[60] relative"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="text-foreground" /> : <Menu className="text-foreground" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden fixed inset-0 z-[55] bg-white dark:bg-black flex flex-col items-center justify-center gap-6"
          >
            {navLinks.map((l, i) => (
              <motion.button
                key={l}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: 0.05 * (i + 1), duration: 0.3 }}
                onClick={() => scrollTo(l)}
                className="text-2xl font-bold text-foreground hover:text-[#FF6B6B] transition-colors"
                
              >
                {l}
              </motion.button>
            ))}

            <Link href="/login">
               <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-bold text-foreground hover:text-[#FF6B6B] transition-colors"
                
              >
                Login
              </motion.button>
            </Link>

            <Link href="/register" onClick={() => setMobileOpen(false)}>
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.05 * (navLinks.length + 1), duration: 0.3 }}
                className="btn-primary text-lg mt-2"
              >
                Get Started
              </motion.button>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
