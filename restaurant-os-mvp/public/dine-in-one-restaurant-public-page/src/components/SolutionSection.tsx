import { motion } from "framer-motion";
import RevealMotion from "./RevealMotion";

import boyIcon from "@/assets/icons/boy.png";
import waiterIcon from "@/assets/icons/waiter.png";
import cookingIcon from "@/assets/icons/cooking.png";
import billIcon from "@/assets/icons/bill.png";
import adminIcon from "@/assets/icons/admin-panel.png";

const customerPanel = { label: "Customer", icon: boyIcon, gradient: "from-coral to-coral-light" };
const waiterPanel = { label: "Waiter", icon: waiterIcon, gradient: "from-teal to-teal-dark" };
const kitchenPanel = { label: "Kitchen", icon: cookingIcon, gradient: "from-purple to-indigo" };
const billingPanel = { label: "Billing", icon: billIcon, gradient: "from-gold to-gold-dark" };
const adminPanel = { label: "Admin", icon: adminIcon, gradient: "from-emerald to-emerald-dark" };

const PanelPill = ({ panel, delay = 0 }: { panel: typeof customerPanel; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.7 }}
    whileInView={{ opacity: 1, scale: 1 }}
    viewport={{ once: true }}
    transition={{ duration: 0.4, delay, type: "spring", stiffness: 200 }}
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.95 }}
    className={`bg-gradient-to-r ${panel.gradient} px-2 py-1.5 md:px-7 md:py-4 rounded-full flex items-center gap-1.5 md:gap-3 shadow-lg cursor-pointer`}
  >
    <img src={panel.icon} alt={panel.label} className="w-4 h-4 md:w-9 md:h-9 object-contain" />
    <span className="font-bold text-[10px] md:text-base text-white">{panel.label}</span>
  </motion.div>
);

const Arrow = ({ delay = 0 }: { delay?: number }) => (
  <motion.span
    initial={{ opacity: 0 }}
    whileInView={{ opacity: 1 }}
    viewport={{ once: true }}
    transition={{ delay }}
    className="text-muted-foreground text-xl"
  >
    →
  </motion.span>
);

const SolutionSection = () => (
  <section id="solution" className="relative pt-12 md:pt-24 pb-24 overflow-hidden">
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple/8 rounded-full blur-[200px]" />

    <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
      <RevealMotion className="mb-16">
        <span className="gradient-text-purple text-sm font-bold uppercase tracking-widest">One Platform</span>
        <h2 className="text-3xl md:text-5xl font-heading font-bold mt-3">Dine in One Fixes All of It</h2>
      </RevealMotion>

      <RevealMotion>
        <div className="flex flex-col items-center gap-6">
          {/* Main flow layout */}
          <div className="flex items-center justify-center gap-3 md:gap-4">
            {/* Left: Customer */}
            <div className="flex flex-col items-center gap-3">
              <PanelPill panel={customerPanel} delay={0} />
            </div>

            {/* 3 arrows from Customer to each panel */}
            <div className="flex flex-col items-center gap-3">
              <Arrow delay={0.15} />
              <Arrow delay={0.25} />
              <Arrow delay={0.35} />
            </div>

            {/* Center column: Waiter, Kitchen, Admin stacked */}
            <div className="flex flex-col items-center gap-3">
              <PanelPill panel={waiterPanel} delay={0.15} />
              <PanelPill panel={kitchenPanel} delay={0.25} />
              <PanelPill panel={adminPanel} delay={0.35} />
            </div>

            <Arrow delay={0.5} />

            {/* Right: Billing */}
            <div className="flex flex-col items-center gap-3">
              <PanelPill panel={billingPanel} delay={0.55} />
            </div>
          </div>
        </div>
      </RevealMotion>

      <RevealMotion delay={0.3}>
        <p className="text-foreground mt-10 max-w-lg mx-auto">
          One shared database. Five panels. Every role connected in real time.
        </p>
      </RevealMotion>
    </div>
  </section>
);

export default SolutionSection;
