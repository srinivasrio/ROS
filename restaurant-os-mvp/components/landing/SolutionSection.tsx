"use client";

import { motion } from "framer-motion";
import RevealMotion from "./RevealMotion";
import { 
  Truck, 
  Sparkles 
} from "lucide-react";

interface FlowNode {
  id: string;
  role: string;
  subtitle: string;
  iconSrc?: string;
  lucideIcon?: any;
  color: string;
  badge: string;
  action: string;
}

const flowNodes: FlowNode[] = [
  {
    id: "customer",
    role: "Customer",
    subtitle: "Dine-in QR & Online Orders",
    iconSrc: "/images/landing/icons/boy.png",
    color: "from-[#FF6B6B] to-[#FF8E53]",
    badge: "Step 1: Placement",
    action: "Instant QR scan, custom modifiers & digital cart checkout"
  },
  {
    id: "waiter",
    role: "Waiter / Captain",
    subtitle: "Floor Coordination",
    iconSrc: "/images/landing/icons/waiter.png",
    color: "from-[#4ECDC4] to-[#2BA89E]",
    badge: "Step 2: Punch & Review",
    action: "Table status updates, KOT additions & item approval"
  },
  {
    id: "kitchen",
    role: "Kitchen (KDS)",
    subtitle: "Live Cooking Station",
    iconSrc: "/images/landing/icons/cooking.png",
    color: "from-purple-500 to-indigo-600",
    badge: "Step 3: Preparation",
    action: "Color-coded prep timer, station breakdown & ready alerts"
  },
  {
    id: "delivery",
    role: "Delivery",
    subtitle: "Riders & Custom Zones",
    lucideIcon: Truck,
    color: "from-blue-500 to-cyan-600",
    badge: "Step 4: Dispatch",
    action: "Automated rider allocation, OTP verification & live tracking"
  },
  {
    id: "billing",
    role: "Billing & POS",
    subtitle: "Instant Settlement",
    iconSrc: "/images/landing/icons/bill.png",
    color: "from-amber-400 to-amber-600",
    badge: "Step 5: Invoicing",
    action: "1-Click automated GST split, split bills & digital receipts"
  },
  {
    id: "admin",
    role: "Admin & Owner",
    subtitle: "Central Control HQ",
    iconSrc: "/images/landing/icons/admin-panel.png",
    color: "from-emerald-500 to-teal-700",
    badge: "Realtime Oversight",
    action: "Live analytics, auto inventory deduction & multi-branch sync"
  }
];

const SolutionSection = () => (
  <section id="solution" className="relative py-16 md:py-28 overflow-hidden bg-background">
    {/* Subtle gradient background glow */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-purple-500/5 rounded-full blur-[200px] pointer-events-none" />

    <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6">
      <RevealMotion className="text-center mb-14 md:mb-20">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 border border-purple-500/20 mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          The Unified Architecture
        </span>
        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mt-2 text-foreground">
          Working of Dine in one
        </h2>
        <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto mt-3">
          One continuous data pipeline connecting customers, dining floor, kitchen stations, delivery fleets, and management in real time.
        </p>
      </RevealMotion>

      {/* 6 Connected Panel Nodes Interactive Flow */}
      <RevealMotion>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          {flowNodes.map((node, i) => (
            <motion.div
              key={node.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              whileHover={{ y: -6, scale: 1.03 }}
              className="relative p-4 rounded-2xl bg-white/90 dark:bg-neutral-900/90 border border-border/70 shadow-sm hover:shadow-md transition-all flex flex-col justify-between text-left group"
            >
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                  {node.badge}
                </span>

                <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${node.color} flex items-center justify-center p-2 mb-3 shadow-md group-hover:scale-105 transition-transform`}>
                  {node.iconSrc ? (
                    <img src={node.iconSrc} alt={node.role} loading="lazy" decoding="async" className="w-7 h-7 object-contain" />
                  ) : (
                    <node.lucideIcon className="w-6 h-6 text-white" />
                  )}
                </div>

                <h3 className="text-sm font-bold text-foreground">
                  {node.role}
                </h3>
                <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                  {node.subtitle}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-border/40">
                <p className="text-[10px] text-muted-foreground line-clamp-2">
                  {node.action}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </RevealMotion>
    </div>
  </section>
);

export default SolutionSection;
