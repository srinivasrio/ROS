import { motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import RevealMotion from "./RevealMotion";

import biryaniImg from "@/assets/food/biryani.png";
import burgerImg from "@/assets/food/burger.png";
import butterChickenImg from "@/assets/food/butter-chicken.png";

const PanelsSection = () => (
  <section id="panels" className="py-24 bg-muted">
    <div className="max-w-6xl mx-auto px-6">
      <RevealMotion className="text-center mb-20">
        <span className="gradient-text-teal text-sm font-bold uppercase tracking-widest">5 Dedicated Panels</span>
        <h2 className="text-3xl md:text-5xl font-heading font-bold mt-3">Built for Every Role in Your Restaurant</h2>
      </RevealMotion>

      {/* Customer Panel */}
      <div className="grid md:grid-cols-2 gap-12 items-center mb-24">
        <RevealMotion direction="left">
          <h3 className="text-2xl md:text-3xl font-heading font-bold mb-4 gradient-text-coral">Scan, Order & Track in Real Time</h3>
          <ul className="space-y-3 text-muted-foreground">
            <li className="flex gap-2"><span className="text-coral">&#9670;</span> QR code scan — no app download</li>
            <li className="flex gap-2"><span className="text-coral">&#9670;</span> Browse full menu with photos & prices</li>
            <li className="flex gap-2"><span className="text-coral">&#9670;</span> Real-time order status updates</li>
            <li className="flex gap-2"><span className="text-coral">&#9670;</span> AI-powered food suggestions</li>
          </ul>
        </RevealMotion>
        <RevealMotion direction="right" delay={0.15}>
          <div className="bg-foreground/[0.03] rounded-2xl border border-foreground/[0.06] p-6 space-y-4">
            {[
              { name: "Veg Biryani", img: biryaniImg, gradient: "from-coral to-coral-light", price: "₹249", desc: "Fragrant basmati rice" },
              { name: "Classic Burger", img: burgerImg, gradient: "from-teal to-teal-dark", price: "₹179", desc: "Juicy patty, fresh veggies" },
              { name: "Butter Chicken", img: butterChickenImg, gradient: "from-purple to-indigo", price: "₹349", desc: "Creamy tomato gravy" },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-3"
              >
                <img src={item.img} alt={item.name} className="w-16 h-16 rounded-xl object-cover bg-gray-200" style={{ mixBlendMode: "multiply" }} />
                <div className="flex-1">
                  <div className="font-bold text-sm">{item.name}</div>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                </div>
                <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${item.gradient} text-xs font-bold text-white`}>{item.price}</div>
              </motion.div>
            ))}
            <div className="h-12 rounded-xl bg-gradient-to-r from-coral to-coral-light flex items-center justify-center font-bold text-sm text-white gap-2">
              <ShoppingBag className="w-4 h-4" /> View Cart — 3 Items
            </div>
          </div>
        </RevealMotion>
      </div>

      {/* Kitchen Panel */}
      <div className="grid md:grid-cols-2 gap-12 items-center mb-24">
        <RevealMotion direction="left" className="order-2 md:order-1">
          <div className="bg-foreground/[0.03] rounded-2xl border border-foreground/[0.06] p-6 space-y-3">
            {[
              { table: "Table 5", items: "2× Biryani, 1× Naan", status: "New", color: "from-coral to-coral-light" },
              { table: "Table 12", items: "1× Thali, 2× Lassi", status: "Preparing", color: "from-gold to-gold-dark" },
              { table: "Table 3", items: "3× Dosa, 1× Filter Coffee", status: "Ready", color: "from-emerald to-emerald-dark" },
            ].map((o, i) => (
              <motion.div
                key={o.table}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="flex items-center justify-between p-4 rounded-xl bg-foreground/[0.03] border border-foreground/[0.05]"
              >
                <div>
                  <span className="font-bold text-sm">{o.table}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{o.items}</p>
                </div>
                <span className={`px-3 py-1 rounded-full bg-gradient-to-r ${o.color} text-xs font-bold text-white`}>{o.status}</span>
              </motion.div>
            ))}
          </div>
        </RevealMotion>
        <RevealMotion direction="right" delay={0.15} className="order-1 md:order-2">
          <h3 className="text-2xl md:text-3xl font-heading font-bold mb-4 gradient-text-teal">Every Order, Crystal Clear</h3>
          <ul className="space-y-3 text-muted-foreground">
            <li className="flex gap-2"><span className="text-teal">&#9670;</span> Live order queue with priority sorting</li>
            <li className="flex gap-2"><span className="text-teal">&#9670;</span> Color-coded status badges</li>
            <li className="flex gap-2"><span className="text-teal">&#9670;</span> One-tap status updates</li>
            <li className="flex gap-2"><span className="text-teal">&#9670;</span> Special instructions highlighted</li>
          </ul>
        </RevealMotion>
      </div>

      {/* Billing Panel */}
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <RevealMotion direction="left">
          <h3 className="text-2xl md:text-3xl font-heading font-bold mb-4 gradient-text-gold">Auto Bills, GST Invoices & More</h3>
          <ul className="space-y-3 text-muted-foreground">
            <li className="flex gap-2"><span className="text-gold">&#9670;</span> Automatic total & GST calculation</li>
            <li className="flex gap-2"><span className="text-gold">&#9670;</span> Multiple payment modes supported</li>
            <li className="flex gap-2"><span className="text-gold">&#9670;</span> WhatsApp invoice sharing</li>
            <li className="flex gap-2"><span className="text-gold">&#9670;</span> Daily revenue summary</li>
          </ul>
        </RevealMotion>
        <RevealMotion direction="right" delay={0.15}>
          <div className="bg-foreground/[0.03] rounded-2xl border border-foreground/[0.06] p-6">
            <div className="space-y-2 mb-4">
              {[
                { item: "Veg Biryani ×1", price: "₹249" },
                { item: "Classic Burger ×1", price: "₹179" },
                { item: "Butter Chicken ×1", price: "₹349" },
              ].map((r) => (
                <div key={r.item} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{r.item}</span>
                  <span className="font-mono font-semibold">{r.price}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-foreground/10 pt-3 space-y-1">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">₹777</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">GST (5%)</span><span className="font-mono">₹38.85</span></div>
              <div className="flex justify-between font-bold mt-2"><span>Total</span><span className="font-mono gradient-text-gold">₹815.85</span></div>
            </div>
            <div className="flex gap-2 mt-4">
              {["UPI", "Card", "Cash"].map((m) => (
                <motion.span
                  key={m}
                  whileHover={{ scale: 1.05, borderColor: "rgba(247,201,72,0.5)" }}
                  whileTap={{ scale: 0.95 }}
                  className="flex-1 text-center py-2 rounded-full bg-foreground/[0.05] border border-foreground/10 text-xs font-bold cursor-pointer transition-colors"
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
