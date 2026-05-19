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
    <section id="contact" className="py-24 bg-neutral-50 dark:bg-neutral-900/50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16">
          <RevealMotion direction="left">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" >Let's Get You Started</h2>
            <p className="text-black dark:text-black mb-8 font-medium">
              Fill in your details and our team will reach out within 24 hours to schedule your free demo.
            </p>
            <div className="space-y-5">
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
                  className="flex items-center gap-3"
                >
                  <c.icon className="w-5 h-5 text-[#FF6B6B]" />
                  <span className="text-black dark:text-black font-medium">{c.text}</span>
                </motion.div>
              ))}
            </div>
          </RevealMotion>

          <RevealMotion direction="right" delay={0.15}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input required placeholder="Name *" className="w-full px-4 py-3 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-foreground placeholder:text-black focus:border-[#FF6B6B]/50 focus:shadow-[0_0_20px_rgba(255,107,107,0.15)] outline-none transition-all text-sm font-medium" />
                <input required placeholder="Phone *" className="w-full px-4 py-3 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-foreground placeholder:text-black focus:border-[#FF6B6B]/50 focus:shadow-[0_0_20px_rgba(255,107,107,0.15)] outline-none transition-all text-sm font-medium" />
              </div>
              <input required placeholder="Restaurant Name *" className="w-full px-4 py-3 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-foreground placeholder:text-black focus:border-[#FF6B6B]/50 focus:shadow-[0_0_20px_rgba(255,107,107,0.15)] outline-none transition-all text-sm font-medium" />
              <input required type="email" placeholder="Email *" className="w-full px-4 py-3 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-foreground placeholder:text-black focus:border-[#FF6B6B]/50 focus:shadow-[0_0_20px_rgba(255,107,107,0.15)] outline-none transition-all text-sm font-medium" />
              <div className="grid grid-cols-2 gap-4">
                <select className="w-full px-4 py-3 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-black focus:border-[#FF6B6B]/50 outline-none transition-all text-sm appearance-none font-medium">
                  <option value="">Plan Interest</option>
                  <option>Starter</option>
                  <option>Pro</option>
                  <option>Enterprise</option>
                </select>
                <select className="w-full px-4 py-3 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-black focus:border-[#FF6B6B]/50 outline-none transition-all text-sm appearance-none font-medium">
                  <option value="">Number of Tables</option>
                  <option>1–10</option>
                  <option>11–25</option>
                  <option>26–50</option>
                  <option>50+</option>
                </select>
              </div>
              <textarea placeholder="Message" rows={4} className="w-full px-4 py-3 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-foreground placeholder:text-black focus:border-[#FF6B6B]/50 focus:shadow-[0_0_20px_rgba(255,107,107,0.15)] outline-none transition-all text-sm font-medium resize-none" />
              <motion.button
                type="submit"
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className={`w-full h-12 rounded-full font-bold transition-all shadow-lg flex items-center justify-center gap-2 ${submitted ? "bg-emerald-500 text-white" : "btn-primary"}`}
              >
                {submitted ? "✓ Sent! We'll call you soon" : "Send Message →"}
              </motion.button>
            </form>
          </RevealMotion>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
