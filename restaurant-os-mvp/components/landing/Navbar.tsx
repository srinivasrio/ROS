"use client";

import { useState, useEffect } from "react";
import { X, Menu, Minimize2, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

const navLinks = ["Working", "Features", "Panels", "Pricing", "FAQ", "Contact"];

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginHref, setLoginHref] = useState("/login/owner");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const host = window.location.hostname.toLowerCase();
      if (host === "dineinone.com" || host === "www.dineinone.com") {
        setLoginHref("https://owner.dineinone.com/login");
      } else {
        setLoginHref("/login/owner");
      }
    }
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock background scroll when mobile navigation menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    const targetId = id.toLowerCase() === "working" ? "solution" : id.toLowerCase();
    setTimeout(() => {
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }, 120);
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-[70] transition-all duration-500 ${
          scrolled
            ? "py-3 bg-white/80 backdrop-blur-2xl border-b border-slate-200/80 shadow-[0_8px_30px_rgba(15,23,42,0.06),inset_0_1px_1px_rgba(255,255,255,1)]"
            : "py-5 bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center group">
            <span className="text-xl font-bold tracking-tight text-slate-900 group-hover:drop-shadow-[0_0_16px_rgba(255,107,107,0.3)] transition-all">
              Dine <span className="gradient-text-coral text-xl drop-shadow-[0_0_12px_rgba(255,107,107,0.45)]">in</span> One
            </span>
          </Link>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-7">
            {navLinks.map((l) => (
              <button
                key={l}
                onClick={() => scrollTo(l)}
                className="text-sm font-semibold text-slate-600 hover:text-slate-900 hover:drop-shadow-[0_0_8px_rgba(255,107,107,0.25)] transition-all cursor-pointer touch-manipulation"
              >
                {l}
              </button>
            ))}

            <Link
              href={loginHref}
              className="text-sm font-bold text-slate-700 hover:text-slate-900 transition-colors touch-manipulation"
            >
              Login
            </Link>

            <Link href="/register">
              <button className="liquid-glass-btn-teal text-sm !py-2.5 !px-5 rounded-full cursor-pointer shadow-sm touch-manipulation">
                Create Account
              </button>
            </Link>

            <button
              onClick={() => scrollTo("contact")}
              className="liquid-glass-btn-primary text-sm !py-2.5 !px-5 rounded-full cursor-pointer touch-manipulation"
            >
              Book Free Demo
            </button>
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden flex items-center gap-4">
            <button
              className="flex items-center justify-center relative w-10 h-10 rounded-xl liquid-glass-btn text-slate-800 transition-all cursor-pointer touch-manipulation z-[80]"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle navigation menu"
            >
              {mobileOpen ? (
                <X className="text-slate-900 w-5 h-5 stroke-[2.5]" />
              ) : (
                <Menu className="text-slate-900 w-5 h-5 stroke-[2.5]" />
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
            transition={{ duration: 0.2 }}
            className="md:hidden fixed inset-0 z-[65] bg-white/95 backdrop-blur-3xl text-slate-900 flex flex-col items-center justify-between py-6 px-6 overflow-y-auto"
          >
            {/* Top Bar with Brand & Close X Button */}
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-200/80 shrink-0">
              <Link href="/" onClick={() => setMobileOpen(false)}>
                <span className="text-lg font-bold text-slate-900">
                  Dine <span className="gradient-text-coral drop-shadow-xs">in</span> One
                </span>
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                className="w-9 h-9 rounded-full liquid-glass-btn flex items-center justify-center text-slate-700 active:scale-95 transition-all cursor-pointer shadow-xs touch-manipulation"
                aria-label="Close navigation menu"
              >
                <X size={18} className="stroke-[2.5]" />
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
                  className="text-xl font-bold text-slate-800 hover:text-[#FF6B6B] transition-all cursor-pointer"
                >
                  {l}
                </motion.button>
              ))}
            </div>

            {/* Action buttons */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.25 }}
              className="w-full max-w-xs flex flex-col items-center gap-3 shrink-0"
            >
              <Link
                href={loginHref}
                onClick={() => setMobileOpen(false)}
                className="w-full"
              >
                <button className="liquid-glass-btn w-full text-base !py-3 justify-center rounded-full cursor-pointer shadow-sm text-slate-900 font-bold border border-slate-200">
                  Owner Login
                </button>
              </Link>

              <Link
                href="/register"
                onClick={() => setMobileOpen(false)}
                className="w-full"
              >
                <button className="liquid-glass-btn-teal w-full text-base !py-3 justify-center rounded-full cursor-pointer shadow-sm">
                  Create Account
                </button>
              </Link>

              <button
                onClick={() => scrollTo("contact")}
                className="liquid-glass-btn-primary w-full text-base !py-3 justify-center rounded-full cursor-pointer shadow-md"
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
