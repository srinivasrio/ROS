"use client";

import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import ProblemSection from "@/components/landing/ProblemSection";
import SolutionSection from "@/components/landing/SolutionSection";
import FeaturesGrid from "@/components/landing/FeaturesGrid";
import PanelsSection from "@/components/landing/PanelsSection";
import PricingSection from "@/components/landing/PricingSection";
import FAQSection from "@/components/landing/FAQSection";
import CTABanner from "@/components/landing/CTABanner";
import ContactSection from "@/components/landing/ContactSection";
import Footer from "@/components/landing/Footer";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export default function LandingPage() {
  useScrollReveal();

  return (
    <main className="min-h-screen bg-background selection:bg-[#FF6B6B]/30">
      <Navbar />
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <FeaturesGrid />
      <PanelsSection />
      <PricingSection />
      <FAQSection />
      <CTABanner />
      <ContactSection />
      <Footer />
    </main>
  );
}
