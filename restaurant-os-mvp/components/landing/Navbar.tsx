"use client";

import { useState, useEffect } from "react";
import { X, Menu, Minimize2, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

const navLinks = ["Working", "Features", "Panels", "Pricing", "FAQ", "Contact"];

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
    const targetId = id.toLowerCase() === "working" ? "solution" : id.toLowerCase();
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/80 dark:bg-black/80 backdrop-blur-xl shadow-xs border-b border-neutral-200/50 dark:border-white/5"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex flex-col items-center leading-none group">
            <div className="text-xl font-bold tracking-tight text-foreground">
              Dine <span className="gradient-text-coral text-xl">in</span> One
            </div>
            <span className="text-[7.5px] font-black tracking-[0.3em] text-neutral-500 uppercase mt-1 leading-none pl-2 text-center w-full">
              SMART POS
            </span>
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

            <a
              href="https://owner.dineinone.com/login"
              className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 hover:text-[#FF6B6B] transition-colors"
            >
              Login
            </a>

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
              className="flex items-center gap-1.5 z-[60] relative p-2 rounded-lg hover:bg-neutral-100 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle navigation menu"
            >
              {mobileOpen ? (
                <>
                  <Minimize2 className="text-foreground w-4 h-4" />
                  <span className="text-xs font-bold text-foreground">Minimize</span>
                </>
              ) : (
                <Menu className="text-foreground" size={24} />
              )}
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
            className="md:hidden fixed inset-0 z-[55] bg-white flex flex-col items-center justify-between py-6 px-6 overflow-y-auto"
          >
            {/* Top Bar with Brand & Minimize Button */}
            <div className="w-full flex items-center justify-between pb-3 border-b border-neutral-200 shrink-0">
              <div className="flex flex-col items-start leading-none">
                <div className="text-lg font-bold text-foreground">
                  Dine <span className="gradient-text-coral">in</span> One
                </div>
                <span className="text-[7.5px] font-black tracking-[0.26em] text-neutral-500 uppercase -mt-0.5 leading-none">
                  SMART POS
                </span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold border border-neutral-300 shadow-xs active:scale-95 transition-all cursor-pointer"
                aria-label="Minimize navigation menu"
              >
                <Minimize2 size={13} />
                <span>Minimize</span>
              </button>
            </div>

            {/* Menu Links */}
            <div className="flex flex-col items-center justify-center gap-5 my-auto py-4">
              {navLinks.map((l, i) => (
                <motion.button
                  key={l}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: 0.03 * (i + 1), duration: 0.22 }}
                  onClick={() => scrollTo(l)}
                  className="text-xl font-bold text-foreground hover:text-[#FF6B6B] transition-colors"
                >
                  {l}
                </motion.button>
              ))}

              <motion.button
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: 0.24, duration: 0.22 }}
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 mt-2 rounded-full border border-neutral-300 text-neutral-600 text-xs font-bold hover:bg-neutral-100 active:scale-95 transition-all cursor-pointer"
              >
                <ChevronUp size={14} />
                <span>Minimize Menu</span>
              </motion.button>
            </div>

            {/* Action buttons */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.25 }}
              className="w-full max-w-xs flex flex-col items-center gap-2.5 shrink-0"
            >
              <a
                href="https://owner.dineinone.com/login"
                onClick={() => setMobileOpen(false)}
                className="text-base font-semibold text-foreground hover:text-[#FF6B6B] transition-colors py-1"
              >
                Login
              </a>

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
