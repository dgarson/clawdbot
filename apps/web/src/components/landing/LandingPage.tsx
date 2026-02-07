import { useRef } from "react";
import { useRevealOnScroll } from "./hooks/useRevealOnScroll";
import { LandingHeader } from "./components/LandingHeader";
import { HeroSection } from "./components/HeroSection";
import { HowItWorksSection } from "./components/HowItWorksSection";
import { PersonalizationSection } from "./components/PersonalizationSection";
import { AlwaysOnSection } from "./components/AlwaysOnSection";
import { ControlSection } from "./components/ControlSection";
import { CapabilitiesSection } from "./components/CapabilitiesSection";
import { ExamplesSection } from "./components/ExamplesSection";
import { FAQSection } from "./components/FAQSection";
import { SocialProofSection } from "./components/SocialProofSection";
import { FinalCTASection } from "./components/FinalCTASection";
import { LandingFooter } from "./components/LandingFooter";

import "./landing-theme.css";

/**
 * Public landing page — product tour that renders without Gateway connection.
 * Follows: value → proof → how it works → safety → breadth → reassurance → CTA.
 */
export function LandingPage() {
  const mainRef = useRef<HTMLElement>(null);
  useRevealOnScroll(mainRef.current);

  return (
    <div className="landing-theme min-h-screen bg-background text-foreground">
      <LandingHeader />
      <main ref={mainRef} id="main-content">
        <HeroSection />
        <HowItWorksSection />
        <PersonalizationSection />
        <AlwaysOnSection />
        <ControlSection />
        <CapabilitiesSection />
        <ExamplesSection />
        <FAQSection />
        <SocialProofSection />
        <FinalCTASection />
      </main>
      <LandingFooter />
    </div>
  );
}
