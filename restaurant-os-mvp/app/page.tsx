"use client";

import Navbar from "@/app/components/landing/Navbar";
import HeroSection from "@/app/components/landing/HeroSection";
import ProblemSection from "@/app/components/landing/ProblemSection";
import SolutionSection from "@/app/components/landing/SolutionSection";
import FeaturesGrid from "@/app/components/landing/FeaturesGrid";
import PanelsSection from "@/app/components/landing/PanelsSection";
import PricingSection from "@/app/components/landing/PricingSection";
import FAQSection from "@/app/components/landing/FAQSection";
import CTABanner from "@/app/components/landing/CTABanner";
import ContactSection from "@/app/components/landing/ContactSection";
import Footer from "@/app/components/landing/Footer";
import { useScrollReveal } from "@/app/hooks/useScrollReveal";

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
