import { useScrollReveal } from "@/hooks/useScrollReveal";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import MarqueeTicker from "@/components/MarqueeTicker";
import ProblemSection from "@/components/ProblemSection";
import SolutionSection from "@/components/SolutionSection";
import FeaturesGrid from "@/components/FeaturesGrid";
import PanelsSection from "@/components/PanelsSection";

import PricingSection from "@/components/PricingSection";
import FAQSection from "@/components/FAQSection";
import CTABanner from "@/components/CTABanner";
import ContactSection from "@/components/ContactSection";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";


const Index = () => {
  useScrollReveal();

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
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
      
    </div>
  );
};

export default Index;
