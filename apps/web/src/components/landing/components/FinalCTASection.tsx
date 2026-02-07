import { useNavigate } from "@tanstack/react-router";
import { LandingSection } from "./LandingSection";
import { LandingButton } from "./LandingButton";

/** Full-width final call-to-action section. */
export function FinalCTASection() {
  const navigate = useNavigate();

  return (
    <LandingSection alternate>
      <div className="flex flex-col items-center text-center gap-6" data-reveal="">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-foreground max-w-2xl">
          Ready to let your work move forward?
        </h2>
        <p className="text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
          Open the console, connect your tools, and start with a single task.
          You are always in control.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
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
      </div>
    </LandingSection>
  );
}
