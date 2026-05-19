import { motion } from "framer-motion";
import { Star } from "lucide-react";
import RevealMotion from "./RevealMotion";

const testimonials = [
  { name: "Ravi Kumar", place: "Spice Garden, Hyderabad", quote: "Reduced waiter errors by 80% in week one. The kitchen panel alone is worth the investment.", initials: "RK", gradient: "from-coral to-coral-light" },
  { name: "Priya Menon", place: "Café Bloom, Bangalore", quote: "The QR ordering — customers love it and order more. Our average order value went up 25%.", initials: "PM", gradient: "from-teal to-teal-dark" },
  { name: "Arun Sharma", place: "The Yellow Table, Pune", quote: "GST billing went from 30 minutes to automatic. I wish I had this 5 years ago.", initials: "AS", gradient: "from-purple to-indigo" },
];

const TestimonialsSection = () => (
  <section className="py-24 relative bg-muted">
    <div className="max-w-6xl mx-auto px-6">
      <RevealMotion className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-heading font-bold">Loved by Restaurant Owners Across India</h2>
      </RevealMotion>
      <div className="grid md:grid-cols-3 gap-6">
        {testimonials.map((t, i) => (
          <RevealMotion key={t.name} delay={0.12 * i}>
            <motion.div
              whileHover={{ y: -6 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="p-6 rounded-2xl bg-foreground/[0.03] border border-foreground/[0.06] h-full"
              style={{ borderTopWidth: "3px", borderTopColor: i === 0 ? "#FF6B6B" : i === 1 ? "#4ECDC4" : "#A855F7" }}
            >
              <div className="flex gap-0.5 mb-4">
                {Array(5).fill(0).map((_, j) => (
                  <Star key={j} className="w-4 h-4 text-gold fill-gold" />
                ))}
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${t.gradient} flex items-center justify-center text-xs font-bold text-white`}>
                  {t.initials}
                </div>
                <div>
                  <div className="font-bold text-sm">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.place}</div>
                </div>
              </div>
            </motion.div>
          </RevealMotion>
        ))}
      </div>
    </div>
  </section>
);

export default TestimonialsSection;
