"use client";

import { motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import RevealMotion from "./RevealMotion";

const PanelsSection = () => (
  <section id="panels" className="py-24 bg-neutral-50 dark:bg-neutral-900/50">
    <div className="max-w-6xl mx-auto px-6">
      <RevealMotion className="text-center mb-20">
        <span className="gradient-text-teal text-sm font-bold uppercase tracking-widest">5 Dedicated Panels</span>
        <h2 className="text-3xl md:text-5xl font-bold mt-3" >Built for Every Role in Your Restaurant</h2>
      </RevealMotion>

      {/* Customer Panel */}
      <div className="grid md:grid-cols-2 gap-12 items-center mb-24">
        <RevealMotion direction="left">
          <h3 className="text-2xl md:text-3xl font-bold mb-4 gradient-text-coral" >Scan, Order & Track in Real Time</h3>
          <ul className="space-y-3 text-black dark:text-black">
            <li className="flex gap-2 font-medium"><span className="text-[#FF6B6B]">&#9670;</span> QR code scan — no app download</li>
            <li className="flex gap-2 font-medium"><span className="text-[#FF6B6B]">&#9670;</span> Browse full menu with photos & prices</li>
            <li className="flex gap-2 font-medium"><span className="text-[#FF6B6B]">&#9670;</span> Real-time order status updates</li>
            <li className="flex gap-2 font-medium"><span className="text-[#FF6B6B]">&#9670;</span> Interactive menu with photos</li>
          </ul>
        </RevealMotion>
        <RevealMotion direction="right" delay={0.15}>
          <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-6 space-y-4 shadow-xl">
            {[
              { name: "Veg Biryani", img: "/images/landing/food/biryani.png", gradient: "from-[#FF6B6B] to-[#FF8E53]", price: "₹249", desc: "Fragrant basmati rice" },
              { name: "Classic Burger", img: "/images/landing/food/burger.png", gradient: "from-[#4ECDC4] to-[#44A8B3]", price: "₹179", desc: "Juicy patty, fresh veggies" },
              { name: "Butter Chicken", img: "/images/landing/food/butter-chicken.png", gradient: "from-purple-500 to-indigo-500", price: "₹349", desc: "Creamy tomato gravy" },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-3"
              >
                <img src={item.img} alt={item.name} className="w-16 h-16 rounded-xl object-cover bg-neutral-100 dark:bg-neutral-800" />
                <div className="flex-1">
                  <div className="font-bold text-sm">{item.name}</div>
                  <div className="text-xs text-black dark:text-black">{item.desc}</div>
                </div>
                <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${item.gradient} text-xs font-bold text-white`}>{item.price}</div>
              </motion.div>
            ))}
            <div className="h-12 rounded-xl bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] flex items-center justify-center font-bold text-sm text-white gap-2 shadow-lg">
              <ShoppingBag className="w-4 h-4" /> View Cart — 3 Items
            </div>
          </div>
        </RevealMotion>
      </div>

      {/* Kitchen Panel */}
      <div className="grid md:grid-cols-2 gap-12 items-center mb-24">
        <RevealMotion direction="left" className="order-2 md:order-1">
          <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-6 space-y-3 shadow-xl">
            {[
              { table: "Table 5", items: "2× Biryani, 1× Naan", status: "New", color: "from-[#FF6B6B] to-[#FF8E53]" },
              { table: "Table 12", items: "1× Thali, 2× Lassi", status: "Preparing", color: "from-yellow-400 to-yellow-600" },
              { table: "Table 3", items: "3× Dosa, 1× Filter Coffee", status: "Ready", color: "from-emerald-500 to-emerald-700" },
            ].map((o, i) => (
              <motion.div
                key={o.table}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="flex items-center justify-between p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800"
              >
                <div>
                  <span className="font-bold text-sm">{o.table}</span>
                  <p className="text-xs text-black dark:text-black mt-0.5">{o.items}</p>
                </div>
                <span className={`px-3 py-1 rounded-full bg-gradient-to-r ${o.color} text-xs font-bold text-white`}>{o.status}</span>
              </motion.div>
            ))}
          </div>
        </RevealMotion>
        <RevealMotion direction="right" delay={0.15} className="order-1 md:order-2">
          <h3 className="text-2xl md:text-3xl font-bold mb-4 gradient-text-teal" >Every Order, Crystal Clear</h3>
          <ul className="space-y-3 text-black dark:text-black">
            <li className="flex gap-2 font-medium"><span className="text-[#4ECDC4]">&#9670;</span> Live order queue with priority sorting</li>
            <li className="flex gap-2 font-medium"><span className="text-[#4ECDC4]">&#9670;</span> Color-coded status badges</li>
            <li className="flex gap-2 font-medium"><span className="text-[#4ECDC4]">&#9670;</span> One-tap status updates</li>
            <li className="flex gap-2 font-medium"><span className="text-[#4ECDC4]">&#9670;</span> Special instructions highlighted</li>
          </ul>
        </RevealMotion>
      </div>

      {/* Billing Panel */}
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <RevealMotion direction="left">
          <h3 className="text-2xl md:text-3xl font-bold mb-4 gradient-text-coral" >Auto Bills, GST Invoices & More</h3>
          <ul className="space-y-3 text-black dark:text-black">
            <li className="flex gap-2 font-medium"><span className="text-yellow-500">&#9670;</span> Automatic total & GST calculation</li>
            <li className="flex gap-2 font-medium"><span className="text-yellow-500">&#9670;</span> Multiple payment modes supported</li>
            <li className="flex gap-2 font-medium"><span className="text-yellow-500">&#9670;</span> WhatsApp invoice sharing</li>
            <li className="flex gap-2 font-medium"><span className="text-yellow-500">&#9670;</span> Daily revenue summary</li>
          </ul>
        </RevealMotion>
        <RevealMotion direction="right" delay={0.15}>
          <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-6 shadow-xl">
            <div className="space-y-2 mb-4">
              {[
                { item: "Veg Biryani ×1", price: "₹249" },
                { item: "Classic Burger ×1", price: "₹179" },
                { item: "Butter Chicken ×1", price: "₹349" },
              ].map((r) => (
                <div key={r.item} className="flex justify-between text-sm">
                  <span className="text-black dark:text-black font-medium">{r.item}</span>
                  <span className="font-mono font-bold">{r.price}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-neutral-100 dark:border-neutral-700 pt-3 space-y-1">
              <div className="flex justify-between text-sm"><span className="text-black dark:text-black">Subtotal</span><span className="font-mono">₹777</span></div>
              <div className="flex justify-between text-sm"><span className="text-black dark:text-black">GST (5%)</span><span className="font-mono">₹38.85</span></div>
              <div className="flex justify-between font-bold mt-2"><span>Total</span><span className="font-mono gradient-text-coral">₹815.85</span></div>
            </div>
            <div className="flex gap-2 mt-4">
              {["UPI", "Card", "Cash"].map((m) => (
                <motion.span
                  key={m}
                  whileHover={{ scale: 1.05, borderColor: "#FF6B6B" }}
                  whileTap={{ scale: 0.95 }}
                  className="flex-1 text-center py-2 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-xs font-bold cursor-pointer transition-colors"
                >
                  {m}
                </motion.span>
              ))}
            </div>
          </div>
        </RevealMotion>
      </div>
    </div>
  </section>
);

export default PanelsSection;
