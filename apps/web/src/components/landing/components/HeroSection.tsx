import { useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LandingButton } from "./LandingButton";
import { DeliverablePreviewCard } from "./DeliverablePreviewCard";
import { LandingCard } from "./LandingCard";
import { useParallaxLite } from "../hooks/useParallaxLite";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { ShieldCheck, Pause, History } from "lucide-react";

/** Hero section: value proposition + proof artifact above the fold. */
export function HeroSection() {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();

  // Optional parallax on desktop (transform-only, rAF-throttled)
  useParallaxLite(!reducedMotion, heroRef);

  return (
    <section
      ref={heroRef}
      className="relative overflow-hidden px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 lg:pt-28 pb-16 sm:pb-20 lg:pb-24"
    >
      {/* Aurora background */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 lp-aurora-drift"
        style={{ background: "var(--lp-aurora)" }}
        aria-hidden="true"
      />
      {/* Mesh overlay */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "var(--lp-mesh)" }}
        aria-hidden="true"
      />

      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          {/* Left: copy */}
          <div className="flex flex-col gap-6">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground">
              Your work moves forward—even when you step away
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
              Turn an idea into a plan, a draft, or a decision-ready summary.
              You stay in control of anything sensitive.
            </p>

            {/* CTA row */}
            <div className="flex flex-wrap items-center gap-3">
              <LandingButton
                glow
                arrow
                size="lg"
                onClick={() => navigate({ to: "/" })}
              >
                Open Console
              </LandingButton>
              <LandingButton
                variant="outline"
                size="lg"
                onClick={() => {
                  document
                    .getElementById("how-it-works")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Watch a quick tour
              </LandingButton>
            </div>

            {/* Trust microline */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-success" />
                Approvals for sensitive actions
              </span>
              <span className="flex items-center gap-1.5">
                <Pause className="h-3.5 w-3.5 text-warning" />
                Pause anytime
              </span>
              <span className="flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-primary" />
                Clear activity history
              </span>
            </div>
          </div>

          {/* Right: proof artifact + floating decorative cards */}
          <div className="relative flex justify-center lg:justify-end">
            {/* Floating decorative cards */}
            <LandingCard
              variant="elevated"
              className="lp-float-1 absolute -top-6 -left-4 w-36 p-3 opacity-60 hidden sm:block"
              data-parallax="0.04"
            >
              <div className="text-xs text-muted-foreground">Agent</div>
              <div className="text-sm font-medium text-foreground mt-0.5">
                Research assistant
              </div>
            </LandingCard>

            <LandingCard
              variant="elevated"
              className="lp-float-2 absolute -bottom-4 -left-8 w-40 p-3 opacity-60 hidden sm:block"
              data-parallax="0.08"
            >
              <div className="text-xs text-muted-foreground">Status</div>
              <div className="text-sm font-medium text-success mt-0.5">
                3 tasks completed
              </div>
            </LandingCard>

            <LandingCard
              variant="elevated"
              className="lp-float-3 absolute top-12 -right-4 w-36 p-3 opacity-60 hidden lg:block"
              data-parallax="0.06"
            >
              <div className="text-xs text-muted-foreground">Next</div>
              <div className="text-sm font-medium text-foreground mt-0.5">
                Awaiting your review
              </div>
            </LandingCard>

            {/* Main deliverable preview */}
            <DeliverablePreviewCard
              title="Competitive research summary"
              status="done"
              statusLabel="Ready for review"
              metadata="Updated 4 minutes ago  ·  Sources reviewed: 47"
              sections={[
                {
                  heading: "Market positioning",
                  bullets: [
                    "Three direct competitors have launched similar features this quarter",
                    "Pricing ranges from $29–$79/seat across the segment",
                  ],
                },
                {
                  heading: "Recommended next steps",
                  bullets: [
                    "Prioritize integration depth as the key differentiator",
                    "Schedule stakeholder review before Thursday",
                  ],
                },
              ]}
              actions={
                <a
                  href="#examples"
                  className="text-xs text-primary hover:underline"
                >
                  View full example
                </a>
              }
              className="relative z-10"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
