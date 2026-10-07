"use client";

import { motion } from "framer-motion";
import { ShoppingBag, Truck, ChefHat, Receipt, ShieldCheck, Smartphone, CheckCircle } from "lucide-react";
import RevealMotion from "./RevealMotion";

const PanelsSection = () => (
  <section id="panels" className="py-20 md:py-32 bg-neutral-50/70 dark:bg-neutral-900/50 relative overflow-hidden">
    <div className="max-w-6xl mx-auto px-4 md:px-6 relative z-10">
      <RevealMotion className="text-center mb-16 md:mb-24">
        <span className="gradient-text-teal text-xs md:text-sm font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-[#4ECDC4]/10 border border-[#4ECDC4]/20">
          Dedicated Workspaces
        </span>
        <h2 className="text-3xl md:text-5xl font-extrabold mt-3 text-foreground tracking-tight">
          Built for Every Role in Your Restaurant
        </h2>
        <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto mt-2">
          Tailored interfaces designed for speed, zero learning curve, and maximum staff efficiency.
        </p>
      </RevealMotion>

      {/* 1. Customer Panel */}
      <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center mb-20 md:mb-28">
        <RevealMotion direction="left">
          <span className="text-xs font-bold uppercase tracking-wider text-[#FF6B6B] block mb-2">Guest Experience</span>
          <h3 className="text-2xl md:text-3xl font-extrabold mb-4 text-foreground">Scan, Order & Track in Real Time</h3>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Guests scan table QR codes to browse high-res dish photos, select spice levels, and order directly to the kitchen without waiting for a waiter.
          </p>
          <ul className="space-y-3 text-foreground/90">
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-[#FF6B6B] shrink-0" /> Dynamic QR code table recognition</li>
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-[#FF6B6B] shrink-0" /> Visual menu with spice, veg/non-veg tags</li>
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-[#FF6B6B] shrink-0" /> Live cooking countdown and status alerts</li>
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-[#FF6B6B] shrink-0" /> 1-Click service requests (Water, Waiter, Cutlery)</li>
          </ul>
        </RevealMotion>
        <RevealMotion direction="right" delay={0.15}>
          <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-border p-6 md:p-7 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <span className="text-xs font-bold text-muted-foreground">Table #4 • Fine Dining</span>
              <span className="text-[11px] font-extrabold text-emerald-600 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">Cart Active</span>
            </div>
            {[
              { name: "Veg Biryani", img: "/images/landing/food/biryani.png", gradient: "from-[#FF6B6B] to-[#FF8E53]", price: "₹249", desc: "Fragrant basmati rice with spices" },
              { name: "Classic Burger", img: "/images/landing/food/burger.png", gradient: "from-[#4ECDC4] to-[#44A8B3]", price: "₹179", desc: "Crispy patty with house spread" },
              { name: "Butter Chicken", img: "/images/landing/food/butter-chicken.png", gradient: "from-purple-500 to-indigo-500", price: "₹349", desc: "Velvety butter gravy with naan" },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="flex items-center gap-3.5 p-2 rounded-2xl hover:bg-neutral-50 dark:hover:bg-neutral-700/40 transition-colors"
              >
                <img src={item.img} alt={item.name} className="w-14 h-14 rounded-2xl object-cover bg-neutral-100 dark:bg-neutral-700 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-foreground truncate">{item.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{item.desc}</div>
                </div>
                <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${item.gradient} text-xs font-bold text-white shrink-0`}>{item.price}</div>
              </motion.div>
            ))}
            <div className="h-12 rounded-2xl bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] flex items-center justify-center font-bold text-sm text-white gap-2 shadow-lg shadow-[#FF6B6B]/20 cursor-pointer">
              <ShoppingBag className="w-4 h-4" /> Place Order • 3 Items (₹777)
            </div>
          </div>
        </RevealMotion>
      </div>

      {/* 2. Kitchen Panel */}
      <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center mb-20 md:mb-28">
        <RevealMotion direction="left" className="order-2 md:order-1">
          <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-border p-6 md:p-7 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <ChefHat className="w-3.5 h-3.5 text-purple-600" />
                Live KDS Screen
              </span>
              <span className="text-[11px] font-bold text-purple-600 bg-purple-500/10 px-2 py-0.5 rounded-full">3 Orders In Prep</span>
            </div>
            {[
              { table: "Table 5 (Dine-in)", time: "04:12m", items: "2× Biryani, 1× Garlic Naan (No Onion)", status: "New", color: "from-[#FF6B6B] to-[#FF8E53]" },
              { table: "Order #1042 (Takeaway)", time: "11:45m", items: "1× Thali, 2× Sweet Lassi", status: "Preparing", color: "from-yellow-400 to-amber-600" },
              { table: "Table 3 (Dine-in)", time: "18:20m", items: "3× Masala Dosa, 1× Filter Coffee", status: "Ready to Serve", color: "from-emerald-500 to-teal-700" },
            ].map((o, i) => (
              <motion.div
                key={o.table}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="flex items-center justify-between p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/70 border border-border/70"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{o.table}</span>
                    <span className="text-[10px] font-mono text-muted-foreground bg-neutral-200 dark:bg-neutral-800 px-1.5 py-0.5 rounded">{o.time}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">{o.items}</p>
                </div>
                <span className={`px-3 py-1 rounded-full bg-gradient-to-r ${o.color} text-xs font-bold text-white shrink-0 shadow-xs`}>{o.status}</span>
              </motion.div>
            ))}
          </div>
        </RevealMotion>
        <RevealMotion direction="right" delay={0.15} className="order-1 md:order-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#4ECDC4] block mb-2">Back-of-House Control</span>
          <h3 className="text-2xl md:text-3xl font-extrabold mb-4 text-foreground">Zero Ticket Loss With Live KDS</h3>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Eliminate messy thermal paper roll tangles. Real-time kitchen stations display incoming dishes with cooking timer alerts, modifications, and instant ready marks.
          </p>
          <ul className="space-y-3 text-foreground/90">
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-[#4ECDC4] shrink-0" /> Live order queue with color-coded countdowns</li>
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-[#4ECDC4] shrink-0" /> Loud audio chimes on newly placed tickets</li>
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-[#4ECDC4] shrink-0" /> Customer special preparation instructions highlighted</li>
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-[#4ECDC4] shrink-0" /> Station routing (Tandoor, Curry, Bar, Desserts)</li>
          </ul>
        </RevealMotion>
      </div>

      {/* 3. Delivery & Dispatch */}
      <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center mb-20 md:mb-28">
        <RevealMotion direction="left">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-500 block mb-2">Delivery Fleet</span>
          <h3 className="text-2xl md:text-3xl font-extrabold mb-4 text-foreground">Independent Delivery & Rider Fleet</h3>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Take back control from predatory delivery aggregators. Manage your own delivery radius, dynamic KM charges, and direct rider mobile portal with secure OTP delivery confirmation.
          </p>
          <ul className="space-y-3 text-foreground/90">
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-blue-500 shrink-0" /> Set custom delivery radius & per-KM tariffs</li>
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-blue-500 shrink-0" /> Dedicated delivery boy app with customer navigation</li>
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-blue-500 shrink-0" /> 1-Tap phone dial & Google Maps routing</li>
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-blue-500 shrink-0" /> Fraud-proof delivery completion via Customer OTP</li>
          </ul>
        </RevealMotion>
        <RevealMotion direction="right" delay={0.15}>
          <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-border p-6 md:p-7 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-blue-600" />
                Rider Portal • Rahul Sharma
              </span>
              <span className="text-[11px] font-bold text-blue-600 bg-blue-500/10 px-2.5 py-0.5 rounded-full">Out For Delivery</span>
            </div>
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-border">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-xs font-bold text-foreground">Order #DEL-8821</span>
                  <p className="text-xs text-muted-foreground">Customer: Sneha Rao (98765-43210)</p>
                </div>
                <span className="font-mono font-bold text-xs text-primary">₹815</span>
              </div>
              <p className="text-[11px] text-muted-foreground bg-white dark:bg-neutral-800 p-2 rounded-xl border border-border/60">
                📍 Flat 402, Green Glen Heights, Outer Ring Rd (2.4 km away)
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <button className="flex-1 py-2 rounded-xl bg-blue-500/10 text-blue-600 text-xs font-bold">
                  📞 Call Customer
                </button>
                <button className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-600/20">
                  Verify OTP & Complete
                </button>
              </div>
            </div>
          </div>
        </RevealMotion>
      </div>

      {/* 4. Billing & POS */}
      <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center">
        <RevealMotion direction="left" className="order-2 md:order-1">
          <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-border p-6 md:p-7 shadow-xl">
            <div className="space-y-2.5 mb-4">
              <div className="flex justify-between pb-2 border-b border-border/50 text-xs font-bold text-muted-foreground">
                <span>Tax Invoice #DIN-2026-904</span>
                <span className="text-emerald-600">Paid • UPI</span>
              </div>
              {[
                { item: "Veg Biryani ×1", price: "₹249" },
                { item: "Classic Burger ×1", price: "₹179" },
                { item: "Butter Chicken ×1", price: "₹349" },
              ].map((r) => (
                <div key={r.item} className="flex justify-between text-xs md:text-sm">
                  <span className="text-foreground font-medium">{r.item}</span>
                  <span className="font-mono font-bold text-foreground">{r.price}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border/60 pt-3 space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground"><span>Subtotal</span><span className="font-mono">₹777.00</span></div>
              <div className="flex justify-between text-xs text-muted-foreground"><span>CGST (2.5%)</span><span className="font-mono">₹19.42</span></div>
              <div className="flex justify-between text-xs text-muted-foreground"><span>SGST (2.5%)</span><span className="font-mono">₹19.42</span></div>
              <div className="flex justify-between font-black text-base text-foreground mt-2 pt-2 border-t border-border/40">
                <span>Grand Total</span>
                <span className="font-mono gradient-text-coral text-lg">₹815.84</span>
              </div>
            </div>
            <div className="flex gap-2.5 mt-5">
              {["UPI QR", "Credit Card", "Cash Payment"].map((m) => (
                <span
                  key={m}
                  className="flex-1 text-center py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-border text-[11px] font-bold text-foreground"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        </RevealMotion>
        <RevealMotion direction="right" delay={0.15} className="order-1 md:order-2">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-500 block mb-2">POS & Compliance</span>
          <h3 className="text-2xl md:text-3xl font-extrabold mb-4 text-foreground">Auto GST Bills, Invoicing & Settlement</h3>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Fast cashier checkout designed for rush hours. Automatic tax splitting, multi-mode tender settlement, instant WhatsApp receipt sharing, and wireless thermal printing.
          </p>
          <ul className="space-y-3 text-foreground/90">
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-amber-500 shrink-0" /> Automatic CGST/SGST compliant calculations</li>
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-amber-500 shrink-0" /> Split bills across table guests or separate items</li>
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-amber-500 shrink-0" /> Dynamic on-screen UPI QR for instant customer scan</li>
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-amber-500 shrink-0" /> 1-Click thermal print (ESC/POS 58mm & 80mm)</li>
          </ul>
        </RevealMotion>
      </div>
    </div>
  </section>
);

export default PanelsSection;
