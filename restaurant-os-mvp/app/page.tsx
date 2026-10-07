import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import MarqueeTicker from "@/components/landing/MarqueeTicker";
import ProblemSection from "@/components/landing/ProblemSection";
import SolutionSection from "@/components/landing/SolutionSection";
import FeaturesGrid from "@/components/landing/FeaturesGrid";
import PanelsSection from "@/components/landing/PanelsSection";
import PricingSection from "@/components/landing/PricingSection";
import FAQSection from "@/components/landing/FAQSection";
import CTABanner from "@/components/landing/CTABanner";
import ContactSection from "@/components/landing/ContactSection";
import Footer from "@/components/landing/Footer";
import WhatsAppButton from "@/components/landing/WhatsAppButton";
import ScrollRevealObserver from "@/components/landing/ScrollRevealObserver";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background selection:bg-[#FF6B6B]/30 relative overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <MarqueeTicker />
      <ProblemSection />
      <SolutionSection />
      <FeaturesGrid />
      <PanelsSection />
      <PricingSection />
      <FAQSection />
      <CTABanner />
      <ContactSection />
      <Footer />
      <WhatsAppButton />
      <ScrollRevealObserver />
    </main>
  );
}
