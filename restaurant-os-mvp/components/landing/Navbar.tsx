"use client";

import { useState, useEffect } from "react";
import { X, Menu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

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
          scrolled
            ? "bg-white/90 dark:bg-black/90 backdrop-blur-xl shadow-lg border-b border-neutral-200 dark:border-neutral-800"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Dine <span className="gradient-text-coral text-xl">in</span> One
          </Link>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-7">
            {navLinks.map((l) => (
              <button
                key={l}
                onClick={() => scrollTo(l)}
                className={`text-sm font-medium transition-colors ${
                  scrolled
                    ? "text-neutral-800 dark:text-neutral-200 hover:text-[#FF6B6B]"
                    : "text-neutral-700 dark:text-neutral-300 hover:text-[#FF6B6B]"
                }`}
              >
                {l}
              </button>
            ))}

            <Link
              href="/login"
              className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 hover:text-[#FF6B6B] transition-colors"
            >
              Login
            </Link>

            <Link href="/register">
              <button className="btn-teal text-sm !py-2.5 !px-5 shadow-sm">
                Create Account
              </button>
            </Link>

            <button
              onClick={() => scrollTo("contact")}
              className="btn-primary text-sm !py-2.5 !px-5"
            >
              Book Free Demo
            </button>
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden flex items-center gap-4">
            <button
              className="flex flex-col gap-1.5 z-[60] relative p-2"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle navigation menu"
            >
              {mobileOpen ? <X className="text-foreground" size={24} /> : <Menu className="text-foreground" size={24} />}
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
            transition={{ duration: 0.25 }}
            className="md:hidden fixed inset-0 z-[55] bg-white dark:bg-neutral-950 flex flex-col items-center justify-center gap-6 px-6"
          >
            {navLinks.map((l, i) => (
              <motion.button
                key={l}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: 0.04 * (i + 1), duration: 0.25 }}
                onClick={() => scrollTo(l)}
                className="text-xl font-bold text-foreground hover:text-[#FF6B6B] transition-colors"
              >
                {l}
              </motion.button>
            ))}

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.25 }}
              className="w-full max-w-xs flex flex-col items-center gap-3 mt-4"
            >
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="text-lg font-semibold text-foreground hover:text-[#FF6B6B] transition-colors py-1"
              >
                Login
              </Link>

              <Link
                href="/register"
                onClick={() => setMobileOpen(false)}
                className="w-full"
              >
                <button className="btn-teal w-full text-base !py-3 justify-center">
                  Create Account
                </button>
              </Link>

              <button
                onClick={() => scrollTo("contact")}
                className="btn-primary w-full text-base !py-3 justify-center"
              >
                Book Free Demo
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
