import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
    document.getElementById(id.toLowerCase())?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-background backdrop-blur-xl shadow-lg border-b border-border" : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="#" className="text-xl font-heading font-bold tracking-tight">
            Dine <span className="gradient-text-coral text-xl">in</span> One
          </a>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((l) => (
              <button
                key={l}
                onClick={() => scrollTo(l)}
                className={`text-sm font-medium transition-colors ${scrolled ? "text-foreground hover:text-coral" : "text-muted-foreground hover:text-coral"}`}
              >
                {l}
              </button>
            ))}
            <a href="http://localhost:3000/login" className={`text-sm font-medium transition-colors ${scrolled ? "text-foreground hover:text-coral" : "text-muted-foreground hover:text-coral"}`}>
              Login
            </a>
            <button className="btn-primary text-sm !py-2.5 !px-6" onClick={() => window.location.href = "http://localhost:3000/register"}>
              Get Started
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden flex flex-col gap-1.5 z-[60] relative"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <span className={`block w-6 h-0.5 bg-foreground transition-all duration-300 ${mobileOpen ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block w-6 h-0.5 bg-foreground transition-all duration-300 ${mobileOpen ? "opacity-0" : ""}`} />
            <span className={`block w-6 h-0.5 bg-foreground transition-all duration-300 ${mobileOpen ? "-rotate-45 -translate-y-2" : ""}`} />
          </button>
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
            className="md:hidden fixed inset-0 z-[55] bg-background flex flex-col items-center justify-center gap-6 will-change-[opacity]"
          >
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ delay: 0.1 }}
              onClick={() => setMobileOpen(false)}
              className="absolute top-5 right-6 text-foreground hover:text-coral transition-colors"
              aria-label="Close menu"
            >
              <X size={28} />
            </motion.button>

            {navLinks.map((l, i) => (
              <motion.button
                key={l}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: 0.05 * (i + 1), duration: 0.3 }}
                onClick={() => scrollTo(l)}
                className="text-2xl font-heading font-bold text-foreground hover:text-coral transition-colors"
              >
                {l}
              </motion.button>
            ))}

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.05 * (navLinks.length + 1), duration: 0.3 }}
              className="btn-primary text-lg mt-2"
              onClick={() => scrollTo("Contact")}
            >
              Book Free Demo
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
