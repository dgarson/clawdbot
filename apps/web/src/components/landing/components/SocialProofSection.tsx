import { LandingSection } from "./LandingSection";
import { LandingCard } from "./LandingCard";
import { Quote } from "lucide-react";

interface Testimonial {
  quote: string;
  beforeAfter: string;
  attribution: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "I used to spend Monday mornings writing status updates. Now a structured brief is waiting for me when I open my laptop.",
    beforeAfter: "2 hours of writing → 5 minutes of review",
    attribution: "Product lead, mid-size SaaS",
  },
  {
    quote:
      "The approval system is what convinced me. I can see exactly what it wants to do before anything external happens.",
    beforeAfter: "Anxiety about automation → Confidence with control",
    attribution: "Operations manager",
  },
  {
    quote:
      "Competitive research that used to take a full afternoon gets delivered as a structured summary before lunch.",
    beforeAfter: "Half-day research → Ready-to-review summary",
    attribution: "Strategy consultant",
  },
];

/** Short, believable social proof section. */
export function SocialProofSection() {
  return (
    <LandingSection belowFold>
      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6"
        data-reveal-stagger=""
      >
        {TESTIMONIALS.map((t, i) => (
          <LandingCard
            key={t.attribution}
            variant="standard"
            className="flex flex-col gap-4"
            data-reveal=""
          >
            <div style={{ "--reveal-index": i } as React.CSSProperties} />
            <Quote className="h-5 w-5 text-primary/60" />
            <blockquote className="text-sm text-foreground leading-relaxed flex-1">
              {t.quote}
            </blockquote>
            <div className="border-t border-border pt-3 space-y-1">
              <p className="text-xs font-medium text-primary">
                {t.beforeAfter}
              </p>
              <p className="text-xs text-muted-foreground">{t.attribution}</p>
            </div>
          </LandingCard>
        ))}
      </div>
    </LandingSection>
  );
}
