"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import RevealMotion from "./RevealMotion";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jmcsygpphwdubnanwjwz.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const ContactSection = () => {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    restaurantName: "",
    email: "",
    planInterest: "",
    tablesCount: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const name = formData.name.trim();
    const phone = formData.phone.trim();
    const restaurantName = formData.restaurantName.trim();
    const email = formData.email.trim();
    const planInterest = formData.planInterest || "Not sure yet";
    const tablesCount = formData.tablesCount ? parseInt(formData.tablesCount, 10) || 1 : 1;
    const message = formData.message.trim();

    if (!name || !restaurantName || !phone) {
      setErrorMessage("Please fill in your Name, Restaurant Name, and Phone Number.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const payload = {
      name,
      restaurant: restaurantName,
      restaurant_name: restaurantName,
      phone,
      email: email || null,
      plan: planInterest,
      plan_interest: planInterest,
      tables: tablesCount,
      tables_count: tablesCount,
      message: message || null,
    };

    let saved = false;

    // 1. Try local/deployed API route first
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch("/api/contact/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        saved = true;
      }
    } catch {
      console.warn("[ContactSection] API route unavailable, using direct cloud backup...");
    }

    // 2. Direct Supabase cloud fallback (triggers postgres trigger & Edge Function email dispatch)
    if (!saved && SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
        const supaRes = await fetch(`${SUPABASE_URL}/rest/v1/demo_requests`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({
            name,
            restaurant_name: restaurantName,
            phone,
            email: email || null,
            plan_interest: planInterest,
            tables_count: tablesCount,
            message: message || null,
            status: "new",
          }),
        });

        if (supaRes.ok) {
          saved = true;
        }
      } catch (err) {
        console.error("[ContactSection] Cloud fallback error:", err);
      }
    }

    setSubmitting(false);

    if (saved) {
      setSubmitted(true);
      setFormData({
        name: "",
        phone: "",
        restaurantName: "",
        email: "",
        planInterest: "",
        tablesCount: "",
        message: "",
      });
      setTimeout(() => setSubmitted(false), 8000);
    } else {
      setErrorMessage("Unable to submit demo request right now. Please call us directly at +91 95158 16084.");
    }
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
                { icon: Phone, text: "+91 95158 16084" },
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
                {errorMessage && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {submitted && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                    <span>Thank you! Your demo request has been received. Our team will contact you shortly.</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <input
                    required
                    name="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Name *"
                    disabled={submitting}
                    className="liquid-glass-input w-full px-4 py-3.5 rounded-xl text-sm font-medium disabled:opacity-60"
                  />
                  <input
                    required
                    name="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Phone *"
                    disabled={submitting}
                    className="liquid-glass-input w-full px-4 py-3.5 rounded-xl text-sm font-medium disabled:opacity-60"
                  />
                </div>
                <input
                  required
                  name="restaurantName"
                  value={formData.restaurantName}
                  onChange={(e) => setFormData({ ...formData, restaurantName: e.target.value })}
                  placeholder="Restaurant Name *"
                  disabled={submitting}
                  className="liquid-glass-input w-full px-4 py-3.5 rounded-xl text-sm font-medium disabled:opacity-60"
                />
                <input
                  required
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Email *"
                  disabled={submitting}
                  className="liquid-glass-input w-full px-4 py-3.5 rounded-xl text-sm font-medium disabled:opacity-60"
                />
                <div className="grid grid-cols-2 gap-4">
                  <select
                    name="planInterest"
                    value={formData.planInterest}
                    onChange={(e) => setFormData({ ...formData, planInterest: e.target.value })}
                    disabled={submitting}
                    className="liquid-glass-input w-full px-4 py-3.5 rounded-xl text-sm font-medium appearance-none bg-white text-slate-800 border-slate-200/90 disabled:opacity-60"
                  >
                    <option value="">Plan Interest</option>
                    <option value="Starter">Starter</option>
                    <option value="Pro">Pro</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                  <select
                    name="tablesCount"
                    value={formData.tablesCount}
                    onChange={(e) => setFormData({ ...formData, tablesCount: e.target.value })}
                    disabled={submitting}
                    className="liquid-glass-input w-full px-4 py-3.5 rounded-xl text-sm font-medium appearance-none bg-white text-slate-800 border-slate-200/90 disabled:opacity-60"
                  >
                    <option value="">Number of Tables</option>
                    <option value="5">1–10</option>
                    <option value="18">11–25</option>
                    <option value="35">26–50</option>
                    <option value="60">50+</option>
                  </select>
                </div>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Message / Specific requirements (optional)..."
                  rows={4}
                  disabled={submitting}
                  className="liquid-glass-input w-full px-4 py-3.5 rounded-xl text-sm font-medium resize-none disabled:opacity-60"
                />
                <motion.button
                  type="submit"
                  disabled={submitting}
                  whileHover={submitting ? {} : { scale: 1.02 }}
                  whileTap={submitting ? {} : { scale: 0.98 }}
                  className={`w-full h-12 rounded-full font-bold text-sm tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                    submitted 
                      ? "bg-emerald-500 text-white shadow-emerald-500/30" 
                      : "liquid-glass-btn-primary"
                  } ${submitting ? "opacity-75 cursor-not-allowed" : ""}`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending Request...</span>
                    </>
                  ) : submitted ? (
                    "✓ Sent! We'll call you soon"
                  ) : (
                    "Send Message →"
                  )}
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