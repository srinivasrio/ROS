"use client";

import { motion } from "framer-motion";
import { ShoppingBag, Truck, ChefHat, Receipt, ShieldCheck, Smartphone, CheckCircle } from "lucide-react";
import RevealMotion from "./RevealMotion";

const PanelsSection = () => (
  <section id="panels" className="py-20 md:py-32 bg-transparent relative overflow-hidden">
    <div className="max-w-6xl mx-auto px-4 md:px-6 relative z-10">
      <RevealMotion className="text-center mb-16 md:mb-24">
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs md:text-sm font-bold uppercase tracking-widest liquid-glass-pill text-teal-700 border-teal-200/80 bg-teal-50/70 mb-3 shadow-xs">
          Dedicated Workspaces
        </span>
        <h2 className="text-3xl md:text-5xl font-extrabold mt-3 text-slate-900 tracking-tight">
          Built for Every Role in Your Restaurant
        </h2>
        <p className="text-sm md:text-base text-slate-600 max-w-xl mx-auto mt-2 font-medium">
          Tailored interfaces designed for speed, zero learning curve, and maximum staff efficiency.
        </p>
      </RevealMotion>

      {/* 1. Customer Panel */}
      <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center mb-20 md:mb-28">
        <RevealMotion direction="left">
          <span className="text-xs font-bold uppercase tracking-wider text-[#FF6B6B] block mb-2">Guest Experience</span>
          <h3 className="text-2xl md:text-3xl font-extrabold mb-4 text-slate-900">Scan, Order & Track in Real Time</h3>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed font-medium">
            Guests scan table QR codes to browse high-res dish photos, select spice levels, and order directly to the kitchen without waiting for a waiter.
          </p>
          <ul className="space-y-3 text-slate-700">
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-[#FF6B6B] shrink-0" /> Dynamic QR code table recognition</li>
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-[#FF6B6B] shrink-0" /> Visual menu with spice, veg/non-veg tags</li>
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-[#FF6B6B] shrink-0" /> Live cooking countdown and status alerts</li>
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-[#FF6B6B] shrink-0" /> 1-Click service requests (Water, Waiter, Cutlery)</li>
          </ul>
        </RevealMotion>
        <RevealMotion direction="right" delay={0.15}>
          <div className="liquid-glass-surface rounded-3xl border border-slate-200/85 p-6 md:p-7 space-y-4 shadow-xs backdrop-blur-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
              <span className="text-xs font-bold text-slate-600">Table #4 • Fine Dining</span>
              <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">Cart Active</span>
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
                className="flex items-center gap-3.5 p-2 rounded-2xl liquid-glass-clear hover:bg-white/90 transition-colors border border-slate-200/80"
              >
                <img src={item.img} alt={item.name} loading="lazy" decoding="async" className="w-14 h-14 rounded-2xl object-cover bg-slate-100 shrink-0 border border-slate-200" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-base md:text-lg text-slate-900 truncate">{item.name}</div>
                  <div className="text-xs md:text-sm text-slate-500 truncate">{item.desc}</div>
                </div>
                <div className={`px-3.5 py-1.5 rounded-full bg-gradient-to-r ${item.gradient} text-xs md:text-sm font-bold text-white shrink-0 shadow-md`}>{item.price}</div>
              </motion.div>
            ))}
            <div className="h-12 md:h-14 rounded-2xl liquid-glass-btn-primary flex items-center justify-center font-bold text-sm md:text-base text-white gap-2 shadow-lg shadow-[#FF6B6B]/25 cursor-pointer">
              <ShoppingBag className="w-5 h-5" /> Place Order • 3 Items (₹777)
            </div>
          </div>
        </RevealMotion>
      </div>

      {/* 2. Kitchen Panel */}
      <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center mb-20 md:mb-28">
        <RevealMotion direction="left" className="order-2 md:order-1">
          <div className="liquid-glass-surface rounded-3xl border border-slate-200/85 p-6 md:p-7 space-y-3.5 shadow-xs backdrop-blur-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <ChefHat className="w-3.5 h-3.5 text-[#8278FF]" />
                Live KDS Screen
              </span>
              <span className="text-[11px] font-bold text-[#8278FF] bg-[#8278FF]/10 border border-[#8278FF]/20 px-2 py-0.5 rounded-full">3 Orders In Prep</span>
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
                className="flex items-center justify-between p-4 rounded-2xl liquid-glass-clear border border-slate-200/80"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{o.table}</span>
                    <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{o.time}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-medium">{o.items}</p>
                </div>
                <span className={`px-3 py-1 rounded-full bg-gradient-to-r ${o.color} text-xs font-bold text-white shrink-0 shadow-md`}>{o.status}</span>
              </motion.div>
            ))}
          </div>
        </RevealMotion>
        <RevealMotion direction="right" delay={0.15} className="order-1 md:order-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#14B8A6] block mb-2">Back-of-House Control</span>
          <h3 className="text-2xl md:text-3xl font-extrabold mb-4 text-slate-900">Zero Ticket Loss With Live KDS</h3>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed font-medium">
            Eliminate messy thermal paper roll tangles. Real-time kitchen stations display incoming dishes with cooking timer alerts, modifications, and instant ready marks.
          </p>
          <ul className="space-y-3 text-slate-700">
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-[#14B8A6] shrink-0" /> Live order queue with color-coded countdowns</li>
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-[#14B8A6] shrink-0" /> Loud audio chimes on newly placed tickets</li>
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-[#14B8A6] shrink-0" /> Customer special preparation instructions highlighted</li>
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-[#14B8A6] shrink-0" /> Station routing (Tandoor, Curry, Bar, Desserts)</li>
          </ul>
        </RevealMotion>
      </div>

      {/* 3. Delivery & Dispatch */}
      <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center mb-20 md:mb-28">
        <RevealMotion direction="left">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 block mb-2">Delivery Fleet</span>
          <h3 className="text-2xl md:text-3xl font-extrabold mb-4 text-slate-900">Independent Delivery & Rider Fleet</h3>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed font-medium">
            Take back control from predatory delivery aggregators. Manage your own delivery radius, dynamic KM charges, and direct rider mobile portal with secure OTP delivery confirmation.
          </p>
          <ul className="space-y-3 text-slate-700">
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-blue-500 shrink-0" /> Set custom delivery radius & per-KM tariffs</li>
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-blue-500 shrink-0" /> Dedicated delivery boy app with customer navigation</li>
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-blue-500 shrink-0" /> 1-Tap phone dial & Google Maps routing</li>
            <li className="flex items-center gap-2.5 text-sm font-medium"><CheckCircle className="w-4 h-4 text-blue-500 shrink-0" /> Fraud-proof delivery completion via Customer OTP</li>
          </ul>
        </RevealMotion>
        <RevealMotion direction="right" delay={0.15}>
          <div className="liquid-glass-surface rounded-3xl border border-slate-200/85 p-6 md:p-7 space-y-4 shadow-xs backdrop-blur-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-blue-500" />
                Rider Portal • Rahul Sharma
              </span>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">Out For Delivery</span>
            </div>
            <div className="p-4 rounded-2xl liquid-glass-clear border border-slate-200/80">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-xs font-bold text-slate-900">Order #DEL-8821</span>
                  <p className="text-xs text-slate-500">Customer: Sneha Rao (98765-43210)</p>
                </div>
                <span className="font-mono font-bold text-xs text-[#FF6B6B]">₹815</span>
              </div>
              <p className="text-[11px] text-slate-600 liquid-glass-dense p-2.5 rounded-xl border border-slate-200">
                📍 Flat 402, Green Glen Heights, Outer Ring Rd (2.4 km away)
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <button className="flex-1 py-2 rounded-xl liquid-glass-clear text-blue-600 border border-blue-200 text-xs font-bold hover:bg-white transition-colors">
                  📞 Call Customer
                </button>
                <button className="flex-1 py-2 rounded-xl liquid-glass-btn-teal text-white text-xs font-bold shadow-md cursor-pointer">
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
          <div className="liquid-glass-surface rounded-3xl border border-slate-200/85 p-6 md:p-7 shadow-xs backdrop-blur-2xl">
            <div className="space-y-2.5 mb-4">
              <div className="flex justify-between pb-2 border-b border-slate-200/80 text-xs font-bold text-slate-700">
                <span>Tax Invoice #DIN-2026-904</span>
                <span className="text-emerald-700 font-bold">Paid • UPI</span>
              </div>
              {[
                { item: "Veg Biryani ×1", price: "₹249" },
                { item: "Classic Burger ×1", price: "₹179" },
                { item: "Butter Chicken ×1", price: "₹349" },
              ].map((r) => (
                <div key={r.item} className="flex justify-between text-xs md:text-sm">
                  <span className="text-slate-600 font-medium">{r.item}</span>
                  <span className="font-mono font-bold text-slate-900">{r.price}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200/80 pt-3 space-y-1.5">
              <div className="flex justify-between text-xs text-slate-600"><span>Subtotal</span><span className="font-mono text-slate-900 font-bold">₹777.00</span></div>
              <div className="flex justify-between text-xs text-slate-600"><span>CGST (2.5%)</span><span className="font-mono text-slate-900 font-bold">₹19.43</span></div>
              <div className="flex justify-between text-xs text-slate-600"><span>SGST (2.5%)</span><span className="font-mono text-slate-900 font-bold">₹19.43</span></div>
              <div className="flex justify-between font-black text-base text-slate-900 mt-2 pt-2 border-t border-slate-200/80">
                <span>Grand Total</span>
                <span className="font-mono gradient-text-coral text-lg drop-shadow-xs">₹815.86</span>
              </div>
            </div>
            <div className="flex gap-2.5 mt-5">
              {["UPI QR", "Credit Card", "Cash Payment"].map((m) => (
                <span
                  key={m}
                  className="flex-1 text-center py-2 rounded-xl liquid-glass-btn border border-slate-200 text-[11px] font-bold text-slate-700"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        </RevealMotion>
        <RevealMotion direction="right" delay={0.15} className="order-1 md:order-2">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-600 block mb-2">POS & Compliance</span>
          <h3 className="text-2xl md:text-3xl font-extrabold mb-4 text-slate-900">Auto GST Bills, Invoicing & Settlement</h3>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed font-medium">
            Fast cashier checkout designed for rush hours. Automatic tax splitting, multi-mode tender settlement, instant WhatsApp receipt sharing, and wireless thermal printing.
          </p>
          <ul className="space-y-3 text-slate-700">
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
