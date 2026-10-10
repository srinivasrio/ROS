import dynamic from "next/dynamic";
import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";

// Code-split below-the-fold sections into async chunks to drastically cut initial bundle size
const SolutionSection = dynamic(() => import("@/components/landing/SolutionSection"));
const FeaturesGrid = dynamic(() => import("@/components/landing/FeaturesGrid"));
const PanelsSection = dynamic(() => import("@/components/landing/PanelsSection"));
const PricingSection = dynamic(() => import("@/components/landing/PricingSection"));
const FAQSection = dynamic(() => import("@/components/landing/FAQSection"));
const CTABanner = dynamic(() => import("@/components/landing/CTABanner"));
const ContactSection = dynamic(() => import("@/components/landing/ContactSection"));
const Footer = dynamic(() => import("@/components/landing/Footer"));
const ScrollRevealObserver = dynamic(() => import("@/components/landing/ScrollRevealObserver"));

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-[#FF6B6B]/20 selection:text-slate-900 relative overflow-x-hidden">
      {/* Radiant Pastel Atmospheric Fluid Orbs behind Light Liquid Glass */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="liquid-atmosphere-orb top-[-10%] left-[-10%] w-[650px] h-[650px] bg-gradient-to-br from-[#8278FF]/20 to-[#A8DEFF]/15" />
        <div className="liquid-atmosphere-orb top-[15%] right-[-5%] w-[550px] h-[550px] bg-gradient-to-bl from-[#FF6B6B]/15 to-[#FF8E53]/15" />
        <div className="liquid-atmosphere-orb top-[40%] left-[20%] w-[600px] h-[600px] bg-gradient-to-tr from-[#4ECDC4]/18 to-[#38BDF8]/12" />
        <div className="liquid-atmosphere-orb top-[65%] right-[10%] w-[700px] h-[700px] bg-gradient-to-tl from-[#8278FF]/15 to-[#FF6B6B]/12" />
        <div className="liquid-atmosphere-orb bottom-[-5%] left-[5%] w-[600px] h-[600px] bg-gradient-to-tr from-[#FF6B6B]/15 to-[#FF8E53]/15" />
      </div>

      <div className="relative z-10">
        <Navbar />
        <HeroSection />
        <SolutionSection />
        <FeaturesGrid />
        <PanelsSection />
        <PricingSection />
        <FAQSection />
        <CTABanner />
        <ContactSection />
        <Footer />
        <ScrollRevealObserver />
      </div>
    </main>
  );
}
