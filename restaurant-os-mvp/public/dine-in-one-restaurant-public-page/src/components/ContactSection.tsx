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
    <section id="contact" className="py-24 bg-muted">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16">
          <RevealMotion direction="left">
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">Let's Get You Started</h2>
            <p className="text-muted-foreground mb-8">
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
                  <c.icon className="w-5 h-5 text-coral" />
                  <span className="text-muted-foreground">{c.text}</span>
                </motion.div>
              ))}
            </div>
          </RevealMotion>

          <RevealMotion direction="right" delay={0.15}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input required placeholder="Name *" className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground/60 focus:border-coral/50 focus:shadow-[0_0_20px_rgba(255,107,107,0.15)] outline-none transition-all text-sm" />
                <input required placeholder="Phone *" className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground/60 focus:border-coral/50 focus:shadow-[0_0_20px_rgba(255,107,107,0.15)] outline-none transition-all text-sm" />
              </div>
              <input required placeholder="Restaurant Name *" className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground/60 focus:border-coral/50 focus:shadow-[0_0_20px_rgba(255,107,107,0.15)] outline-none transition-all text-sm" />
              <input required type="email" placeholder="Email *" className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground/60 focus:border-coral/50 focus:shadow-[0_0_20px_rgba(255,107,107,0.15)] outline-none transition-all text-sm" />
              <div className="grid grid-cols-2 gap-4">
                <select className="w-full px-4 py-3 rounded-xl bg-background border border-border text-muted-foreground/60 focus:border-coral/50 outline-none transition-all text-sm appearance-none">
                  <option value="">Plan Interest</option>
                  <option>Starter</option>
                  <option>Pro</option>
                  <option>Enterprise</option>
                </select>
                <select className="w-full px-4 py-3 rounded-xl bg-background border border-border text-muted-foreground/60 focus:border-coral/50 outline-none transition-all text-sm appearance-none">
                  <option value="">Number of Tables</option>
                  <option>1–10</option>
                  <option>11–25</option>
                  <option>26–50</option>
                  <option>50+</option>
                </select>
              </div>
              <textarea placeholder="Message" rows={4} className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground/60 focus:border-coral/50 focus:shadow-[0_0_20px_rgba(255,107,107,0.15)] outline-none transition-all text-sm resize-none" />
              <motion.button
                type="submit"
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className={`w-full justify-center ${submitted ? "btn-teal" : "btn-primary"}`}
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
