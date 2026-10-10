"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin } from "lucide-react";
import RevealMotion from "./RevealMotion";

const ContactSection = () => {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <section id="contact" className="py-24 bg-transparent relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          <RevealMotion direction="left">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider liquid-glass-pill text-[#FF6B6B] border-[#FF6B6B]/30 bg-rose-50/70 mb-3 shadow-xs">
              Connect With Us
            </span>
            <h2 className="text-3xl md:text-5xl font-black mb-4 text-slate-900 tracking-tight">Let's Get You Started</h2>
            <p className="text-slate-600 mb-8 font-medium leading-relaxed text-sm md:text-base">
              Fill in your details and our restaurant tech specialists will reach out within 24 hours for a personalized demo walkthrough.
            </p>
            <div className="space-y-4">
              {[
                { icon: Mail, text: "contact@dineinone.com" },
                { icon: Phone, text: "+91 82470 05501" },
                { icon: MapPin, text: "Nellore, Andhra Pradesh, India" },
              ].map((c, i) => (
                <motion.div
                  key={c.text}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="flex items-center gap-3.5 p-3 rounded-2xl liquid-glass-soft border border-slate-200/90 hover:border-slate-300 shadow-xs transition-all"
                >
                  <div className="w-9 h-9 rounded-xl liquid-glass-pill flex items-center justify-center border border-[#FF6B6B]/25 bg-rose-50/80 shrink-0">
                    <c.icon className="w-4 h-4 text-[#FF6B6B]" />
                  </div>
                  <span className="text-slate-700 font-semibold text-sm">{c.text}</span>
                </motion.div>
              ))}
            </div>
          </RevealMotion>

          <RevealMotion direction="right" delay={0.15}>
            <div className="liquid-glass-surface rounded-3xl border border-slate-200/90 p-6 md:p-8 shadow-xl backdrop-blur-2xl">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input required placeholder="Name *" className="liquid-glass-input w-full px-4 py-3.5 rounded-xl text-sm font-medium" />
                  <input required placeholder="Phone *" className="liquid-glass-input w-full px-4 py-3.5 rounded-xl text-sm font-medium" />
                </div>
                <input required placeholder="Restaurant Name *" className="liquid-glass-input w-full px-4 py-3.5 rounded-xl text-sm font-medium" />
                <input required type="email" placeholder="Email *" className="liquid-glass-input w-full px-4 py-3.5 rounded-xl text-sm font-medium" />
                <div className="grid grid-cols-2 gap-4">
                  <select className="liquid-glass-input w-full px-4 py-3.5 rounded-xl text-sm font-medium appearance-none bg-white text-slate-800 border-slate-200/90">
                    <option value="">Plan Interest</option>
                    <option value="standard">Standard (₹999/mo)</option>
                    <option value="growth">Growth (₹1,499/mo)</option>
                    <option value="pro">Pro Multi-Branch (₹2,999/mo)</option>
                  </select>
                  <select className="liquid-glass-input w-full px-4 py-3.5 rounded-xl text-sm font-medium appearance-none bg-white text-slate-800 border-slate-200/90">
                    <option value="">Number of Tables</option>
                    <option>1–10</option>
                    <option>11–25</option>
                    <option>26–50</option>
                    <option>50+</option>
                  </select>
                </div>
                <textarea placeholder="Message / Specific requirements..." rows={4} className="liquid-glass-input w-full px-4 py-3.5 rounded-xl text-sm font-medium resize-none" />
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full h-12 rounded-full font-bold text-sm tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                    submitted 
                      ? "bg-emerald-500 text-white shadow-emerald-500/30" 
                      : "liquid-glass-btn-primary"
                  }`}
                >
                  {submitted ? "✓ Sent! We'll call you soon" : "Send Message →"}
                </motion.button>
              </form>
            </div>
          </RevealMotion>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
